import { AuditLog } from "../models/index.js";

/** Record an important admin operation. Never throws. */
export async function audit(req, action, entity, entityId, details) {
  try {
    await AuditLog.create({ user: req.user?._id, action, entity, entityId, details, ip: req.ip });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}
