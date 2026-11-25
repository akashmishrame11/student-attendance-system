import { User, AuditLog } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, escapeRegex, getPagination, getSort } from "../utils/query.js";
import { audit } from "../services/audit.js";

export const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive) filter.isActive = req.query.isActive === "true";
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = [{ name: rx }, { email: rx }, { username: rx }];
  }
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(getSort(req.query, "-createdAt")).skip(skip).limit(limit),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, phone, username } = req.body;
  const user = await User.create({ name, email, password, phone, username, role: "admin" });
  await audit(req, "create", "User", user._id, { role: "admin" });
  return created(res, user, "Admin account created");
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest("You cannot deactivate your own account");
  user.isActive = Boolean(req.body.isActive);
  await user.save({ validateBeforeSave: false });
  await audit(req, user.isActive ? "activate" : "deactivate", "User", user._id);
  return ok(res, user, `Account ${user.isActive ? "activated" : "deactivated"}`);
});

export const adminResetPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  user.password = req.body.password;
  await user.save();
  await audit(req, "reset_password", "User", user._id);
  return ok(res, null, "Password reset successfully");
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.action) filter.action = req.query.action;
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort("-createdAt").skip(skip).limit(limit).populate("user", "name email role"),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});
