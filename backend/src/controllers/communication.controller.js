import mongoose from "mongoose";
import { Notice, Notification, Section } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, escapeRegex, getPagination } from "../utils/query.js";
import { getContext } from "../services/access.js";
import { notifyAudience, resolveAudience, notifyUsers } from "../services/notify.js";
import { toStored, removeFile } from "../services/storage.js";
import { audit } from "../services/audit.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));

const NOTICE_POPULATE = [
  { path: "createdBy", select: "name role" },
  { path: "audience.department", select: "name code" },
  { path: "audience.course", select: "name code" },
  { path: "audience.semester", select: "name number" },
  { path: "audience.section", select: "name" },
  { path: "subject", select: "name code" },
];

/** Notices visible to the current user (active, published, not expired, targeted). */
async function visibleNoticeFilter(req) {
  const ctx = await getContext(req);
  const now = new Date();
  const live = { isActive: true, publishDate: { $lte: now }, $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] };
  if (ctx.role === "admin") return req.query.manage === "true" ? {} : live;

  let audienceOr;
  if (ctx.role === "student") {
    const s = ctx.student;
    audienceOr = [
      { "audience.type": "all" },
      { "audience.type": "students" },
      { "audience.type": "department", "audience.department": s.department },
      { "audience.type": "course", "audience.course": s.course },
      { "audience.type": "semester", "audience.semester": s.semester },
      ...(s.section ? [{ "audience.type": "section", "audience.section": s.section }] : []),
    ];
  } else {
    const f = ctx.faculty;
    audienceOr = [
      { "audience.type": "all" },
      { "audience.type": "faculty" },
      { "audience.type": "department", "audience.department": f.department },
      { "audience.type": "section", "audience.section": { $in: ctx.sectionIds.map(oid) } },
      { createdBy: req.user._id },
    ];
  }
  if (req.query.manage === "true" && ctx.role === "faculty") return { createdBy: req.user._id };
  return { $and: [live, { $or: audienceOr }] };
}

export const listNotices = asyncHandler(async (req, res) => {
  const filter = await visibleNoticeFilter(req);
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) filter.title = new RegExp(escapeRegex(req.query.search), "i");
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    Notice.countDocuments(filter),
    Notice.find(filter).sort("-publishDate").skip(skip).limit(limit).populate(NOTICE_POPULATE),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const getNotice = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid id");
  const notice = await Notice.findOne({ _id: req.params.id, ...(await visibleNoticeFilter(req)) }).populate(NOTICE_POPULATE);
  if (!notice) throw ApiError.notFound("Notice not found");
  return ok(res, notice);
});

function parseAudience(body) {
  let audience = body.audience;
  if (typeof audience === "string") {
    try { audience = JSON.parse(audience); } catch { audience = { type: audience }; }
  }
  audience = audience || { type: "all" };
  for (const k of ["department", "course", "semester", "section"]) if (!audience[k]) delete audience[k];
  return audience;
}

async function validateAudience(req, audience) {
  const need = { department: "department", course: "course", semester: "semester", section: "section" }[audience.type];
  if (need && !audience[need]) throw ApiError.badRequest(`Select a ${need} for this audience`);
  if (req.user.role === "faculty") {
    const ctx = await getContext(req);
    if (audience.type !== "section" || !ctx.sectionIds.includes(String(audience.section))) {
      throw ApiError.forbidden("Faculty can only send notices to their assigned sections");
    }
  }
}

const FIELDS = ["title", "content", "category", "publishDate", "expiryDate", "subject", "isActive"];

export const createNotice = asyncHandler(async (req, res) => {
  const audience = parseAudience(req.body);
  await validateAudience(req, audience);
  const body = Object.fromEntries(FIELDS.filter((f) => req.body[f] !== undefined && req.body[f] !== "").map((f) => [f, req.body[f]]));
  if (audience.section && !audience.course) {
    const sec = await Section.findById(audience.section);
    if (!sec) throw ApiError.badRequest("Section not found");
  }
  const notice = await Notice.create({
    ...body,
    audience,
    createdBy: req.user._id,
    attachments: (req.files || []).map((f) => toStored(f, "notices")),
  });
  if (notice.publishDate <= new Date()) {
    await notifyAudience(audience, { title: `Notice: ${notice.title}`, message: notice.content.slice(0, 140), type: "notice", link: "/notices" });
  }
  await audit(req, "create", "Notice", notice._id);
  await notice.populate(NOTICE_POPULATE);
  return created(res, notice, "Notice published");
});

async function ownNotice(req) {
  const notice = await Notice.findById(req.params.id);
  if (!notice) throw ApiError.notFound("Notice not found");
  if (req.user.role !== "admin" && String(notice.createdBy) !== String(req.user._id)) throw ApiError.forbidden();
  return notice;
}

export const updateNotice = asyncHandler(async (req, res) => {
  const notice = await ownNotice(req);
  if (req.body.audience) {
    const audience = parseAudience(req.body);
    await validateAudience(req, audience);
    notice.audience = audience;
  }
  for (const f of FIELDS) if (req.body[f] !== undefined) notice.set(f, req.body[f] === "" ? undefined : req.body[f]);
  if (req.files?.length) notice.attachments.push(...req.files.map((f) => toStored(f, "notices")));
  await notice.save();
  await notice.populate(NOTICE_POPULATE);
  return ok(res, notice, "Notice updated");
});

export const deleteNotice = asyncHandler(async (req, res) => {
  const notice = await ownNotice(req);
  for (const a of notice.attachments) await removeFile(a.url);
  await notice.deleteOne();
  await audit(req, "delete", "Notice", notice._id);
  return ok(res, { _id: notice._id }, "Notice deleted");
});

/* ---------------------------------------------------------- notifications */
export const myNotifications = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === "true") filter.isRead = false;
  if (req.query.type) filter.type = req.query.type;
  const { page, limit, skip } = getPagination(req.query);
  const [total, unread, data] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
    Notification.find(filter).sort("-createdAt").skip(skip).limit(limit),
  ]);
  return ok(res, data, "Success", { ...buildMeta(total, page, limit), unread });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { new: true });
  if (!n) throw ApiError.notFound("Notification not found");
  return ok(res, n);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const r = await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  return ok(res, { updated: r.modifiedCount }, "All notifications marked as read");
});

export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  return ok(res, null, "Notification removed");
});

/** Admin: send a notification to an audience. */
export const sendNotification = asyncHandler(async (req, res) => {
  const { title, message, type = "general", link } = req.body;
  if (!title || !message) throw ApiError.badRequest("Title and message are required");
  const audience = parseAudience(req.body);
  await validateAudience(req, audience);
  const users = await resolveAudience(audience);
  const sent = await notifyUsers(users, { title, message, type, link });
  await audit(req, "send", "Notification", undefined, { audience: audience.type, sent });
  return ok(res, { sent }, `Notification sent to ${sent} user(s)`);
});
