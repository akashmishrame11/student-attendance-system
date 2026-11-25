import mongoose from "mongoose";
import { asyncHandler } from "./asyncHandler.js";
import { ApiError } from "./ApiError.js";
import { ok, created } from "./response.js";
import { buildMeta, escapeRegex, getPagination, getSort, pick } from "./query.js";
import { audit } from "../services/audit.js";

/**
 * Generic CRUD controller factory used by simple master-data modules.
 *
 * options:
 *  - fields:        whitelist of writable fields (prevents mass assignment)
 *  - searchFields:  fields matched by ?search=
 *  - filterFields:  query params copied into the filter as exact matches
 *  - populate:      mongoose populate spec for list/get
 *  - scope(req):    async fn returning an extra filter (row-level security)
 *  - softDelete:    if true, DELETE sets isActive=false
 *  - entity:        name used in audit logs and messages
 *  - beforeDelete(doc): async hook (e.g. block delete when referenced)
 */
export function crud(Model, options = {}) {
  const {
    fields = [],
    searchFields = [],
    filterFields = [],
    populate,
    scope,
    softDelete = false,
    entity = Model.modelName,
    defaultSort = "-createdAt",
    beforeDelete,
  } = options;

  const baseFilter = async (req) => (scope ? await scope(req) : {});

  const castFilterValue = (key, value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    const path = Model.schema.path(key);
    if (path?.instance === "ObjectId" || path?.caster?.instance === "ObjectId") {
      if (!mongoose.isValidObjectId(value)) throw ApiError.badRequest(`Invalid ${key}`);
    }
    return value;
  };

  const list = asyncHandler(async (req, res) => {
    const filter = { ...(await baseFilter(req)) };
    for (const f of filterFields) {
      const v = req.query[f];
      if (v !== undefined && v !== "") filter[f] = castFilterValue(f, v);
    }
    if (req.query.search && searchFields.length) {
      const rx = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    const sort = getSort(req.query, defaultSort);

    if (req.query.all === "true") {
      const data = await Model.find(filter).sort(sort).limit(1000).populate(populate || []);
      return ok(res, data, "Success", buildMeta(data.length, 1, data.length || 1));
    }
    const { page, limit, skip } = getPagination(req.query);
    const [total, data] = await Promise.all([
      Model.countDocuments(filter),
      Model.find(filter).sort(sort).skip(skip).limit(limit).populate(populate || []),
    ]);
    return ok(res, data, "Success", buildMeta(total, page, limit));
  });

  const findScoped = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid id");
    const doc = await Model.findOne({ _id: req.params.id, ...(await baseFilter(req)) });
    if (!doc) throw ApiError.notFound(`${entity} not found`);
    return doc;
  };

  const getOne = asyncHandler(async (req, res) => {
    const doc = await findScoped(req);
    if (populate) await doc.populate(populate);
    return ok(res, doc);
  });

  const create = asyncHandler(async (req, res) => {
    const doc = await Model.create(pick(req.body, fields));
    await audit(req, "create", entity, doc._id);
    if (populate) await doc.populate(populate);
    return created(res, doc, `${entity} created successfully`);
  });

  const update = asyncHandler(async (req, res) => {
    const doc = await findScoped(req);
    const changes = pick(req.body, fields);
    for (const [k, v] of Object.entries(changes)) doc.set(k, v === "" ? undefined : v);
    await doc.save();
    await audit(req, "update", entity, doc._id, { fields: Object.keys(changes) });
    if (populate) await doc.populate(populate);
    return ok(res, doc, `${entity} updated successfully`);
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await findScoped(req);
    if (beforeDelete) await beforeDelete(doc, req);
    if (softDelete && req.query.permanent !== "true") {
      doc.set("isActive", false);
      await doc.save();
      await audit(req, "deactivate", entity, doc._id);
      return ok(res, doc, `${entity} deactivated`);
    }
    await doc.deleteOne();
    await audit(req, "delete", entity, doc._id);
    return ok(res, { _id: doc._id }, `${entity} deleted successfully`);
  });

  return { list, getOne, create, update, remove, findScoped };
}

/** Throws 409 if any of the given models still reference the document. */
export async function assertNotReferenced(checks) {
  for (const [Model, filter, label] of checks) {
    const n = await Model.countDocuments(filter);
    if (n > 0) throw ApiError.conflict(`Cannot delete: ${n} ${label} still linked. Reassign or remove them first.`);
  }
}
