import { Setting } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { DEFAULT_GRADING } from "../utils/grade.js";
import { toStored, removeFile } from "../services/storage.js";
import { audit } from "../services/audit.js";
import { env } from "../config/env.js";

export async function getOrCreateSettings() {
  let s = await Setting.findOne({ key: "global" });
  if (!s) s = await Setting.create({ key: "global", grading: DEFAULT_GRADING });
  return s;
}

export const getSettings = asyncHandler(async (req, res) => {
  const s = (await getOrCreateSettings()).toObject();
  // Admins also see which infrastructure drivers are active.
  if (req.user.role === "admin") s.system = { mail: env.mail.transport, storage: env.storageDriver };
  return ok(res, s);
});

/** Public subset for the login page / branding. */
export const publicSettings = asyncHandler(async (_req, res) => {
  const s = await getOrCreateSettings();
  return ok(res, { collegeName: s.collegeName, collegeLogo: s.collegeLogo, academicYear: s.academicYear });
});

const FIELDS = [
  "collegeName", "address", "contactEmail", "contactPhone", "academicYear", "semesterSystem",
  "minAttendancePercent", "attendanceEditWindowDays", "allowLateSubmission", "maxUploadSizeMb",
  "libraryFinePerDay", "libraryLoanDays", "grading", "timeSlots", "notifications",
];

export const updateSettings = asyncHandler(async (req, res) => {
  const s = await getOrCreateSettings();
  for (const f of FIELDS) {
    if (req.body[f] === undefined) continue;
    let v = req.body[f];
    if (typeof v === "string" && ["grading", "timeSlots", "notifications"].includes(f)) {
      try { v = JSON.parse(v); } catch { continue; }
    }
    s.set(f, v);
  }
  if (req.file) {
    await removeFile(s.collegeLogo);
    s.collegeLogo = toStored(req.file, "branding").url;
  }
  await s.save();
  await audit(req, "update", "Settings", s._id);
  return ok(res, s, "Settings saved");
});
