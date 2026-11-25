import crypto from "node:crypto";
import { User, Student, Faculty } from "../models/index.js";
import { signToken } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok } from "../utils/response.js";
import { env } from "../config/env.js";
import { toStored, removeFile } from "../services/storage.js";
import { audit } from "../services/audit.js";
import { sendMail, layout, escapeHtml } from "../services/mailer.js";

const ACADEMIC_POPULATE = [
  { path: "department", select: "name code" },
  { path: "course", select: "name code totalSemesters" },
  { path: "semester", select: "name number academicYear" },
  { path: "section", select: "name room batch" },
];

export async function loadProfile(user) {
  if (user.role === "student") {
    return Student.findOne({ user: user._id }).populate(ACADEMIC_POPULATE);
  }
  if (user.role === "faculty") {
    return Faculty.findOne({ user: user._id }).populate([
      { path: "department", select: "name code" },
      { path: "subjects", select: "name code" },
      { path: "sections", select: "name", populate: [{ path: "course", select: "code" }, { path: "semester", select: "number" }] },
    ]);
  }
  return null;
}

export const login = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || req.body.email || "").trim().toLowerCase();
  const { password } = req.body;

  const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Invalid email/username or password");
  }
  if (!user.isActive) throw ApiError.forbidden("Your account has been deactivated. Contact the administrator.");

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const profile = await loadProfile(user);
  return ok(res, { token: signToken(user), user, profile }, "Logged in successfully");
});

export const me = asyncHandler(async (req, res) => {
  const profile = await loadProfile(req.user);
  return ok(res, { user: req.user, profile });
});

export const logout = asyncHandler(async (_req, res) => {
  // JWTs are stateless; the client discards the token.
  return ok(res, null, "Logged out");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await User.findOne({ email, isActive: true });
  const data = {};
  if (user) {
    const token = user.createResetToken();
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${env.clientUrls[0]}/reset-password/${token}`;
    const sent = await sendMail({
      to: user.email,
      subject: "Reset your Attendify password",
      text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      html: layout("Reset your password", `<p>Hi ${escapeHtml(user.name)},</p><p>We received a request to reset your password. The link is valid for <b>30 minutes</b>.</p><p>If you did not request this, you can safely ignore this email.</p>`, { url: resetUrl, label: "Reset password" }),
    });
    // Without a configured mail provider, expose the link in development so the flow can be tested.
    if (!sent || env.mail.transport === "console") {
      console.log(`[password reset] ${email}: ${resetUrl}`);
      if (!env.isProd) data.resetUrl = resetUrl;
    }
  }
  return ok(res, data, "If an account exists for this email, a password reset link has been sent.");
});

/** Notify the account owner whenever their password changes. */
async function passwordChangedEmail(user) {
  await sendMail({
    to: user.email,
    subject: "Your Attendify password was changed",
    text: `Hi ${user.name},\n\nYour password was changed on ${new Date().toLocaleString("en-IN")}. If this wasn't you, contact the administrator immediately.`,
    html: layout("Password changed", `<p>Hi ${escapeHtml(user.name)},</p><p>Your password was changed on <b>${new Date().toLocaleString("en-IN")}</b>.</p><p>If this wasn't you, contact the college administrator immediately.</p>`),
  });
}

export const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash("sha256").update(String(req.params.token)).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires");
  if (!user) throw ApiError.badRequest("Reset link is invalid or has expired");

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  await passwordChangedEmail(user);
  return ok(res, null, "Password reset successfully. You can now log in.");
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest("Current password is incorrect");
  }
  if (req.body.currentPassword === req.body.newPassword) {
    throw ApiError.badRequest("New password must be different from the current password");
  }
  user.password = req.body.newPassword;
  await user.save();
  await audit(req, "change_password", "User", user._id);
  await passwordChangedEmail(user);
  return ok(res, { token: signToken(user) }, "Password changed successfully");
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  if (req.body.name && user.role !== "student") user.name = req.body.name; // students request corrections instead
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.file) {
    await removeFile(user.avatar);
    user.avatar = toStored(req.file, "avatars").url;
  }
  await user.save();

  // Students and faculty may update their own address / contact basics.
  if (user.role === "student" && req.body.address !== undefined) {
    await Student.updateOne({ user: user._id }, { address: req.body.address });
  }
  const profile = await loadProfile(user);
  return ok(res, { user, profile }, "Profile updated");
});
