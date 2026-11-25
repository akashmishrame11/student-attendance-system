import mongoose from "mongoose";
import { Attendance, Student, Section, Subject, Setting } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, dayStart, getPagination, toCSV, sendCSV } from "../utils/query.js";
import { assertClassAccess, getContext } from "../services/access.js";
import { buildWorkbook } from "../utils/sheet.js";
import { streamTablePdf } from "../utils/pdf.js";
import { notifyUsers } from "../services/notify.js";
import { audit } from "../services/audit.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const STATUSES = ["present", "absent", "late", "leave"];

const statusCounts = {
  total: { $sum: 1 },
  present: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
  absent: { $sum: { $cond: [{ $eq: ["$records.status", "absent"] }, 1, 0] } },
  late: { $sum: { $cond: [{ $eq: ["$records.status", "late"] }, 1, 0] } },
  leave: { $sum: { $cond: [{ $eq: ["$records.status", "leave"] }, 1, 0] } },
};

/** Late counts as attended. Percentage rounded to 1 decimal. */
export const pct = (r) => (r.total ? Math.round(((r.present + r.late) / r.total) * 1000) / 10 : 0);

async function getSettings() {
  return (await Setting.findOne({ key: "global" }).lean()) || { minAttendancePercent: 75, attendanceEditWindowDays: 3 };
}

function monthRange(month) {
  if (!month) return null;
  const [y, m] = String(month).split("-").map(Number);
  if (!y || !m) throw ApiError.badRequest("month must be YYYY-MM");
  return { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
}

function dateRange({ from, to, month }) {
  const range = monthRange(month) || {};
  if (from) range.$gte = dayStart(from);
  if (to) range.$lte = dayStart(to);
  return Object.keys(range).length ? range : null;
}

/** GET /attendance/sheet?section&subject&date — students + existing marks. */
export const getSheet = asyncHandler(async (req, res) => {
  const { section, subject, date } = req.query;
  if (!section || !subject || !date) throw ApiError.badRequest("section, subject and date are required");
  await assertClassAccess(req, section, subject);

  const [sec, sub] = await Promise.all([Section.findById(section), Subject.findById(subject)]);
  if (!sec || !sub) throw ApiError.notFound("Section or subject not found");
  if (String(sub.semester) !== String(sec.semester)) throw ApiError.badRequest("Subject is not taught in this section's semester");

  const day = dayStart(date);
  const [students, existing, settings] = await Promise.all([
    Student.find({ section, status: "active" }).populate("user", "name avatar").sort("rollNumber"),
    Attendance.findOne({ section, subject, date: day }),
    getSettings(),
  ]);

  // Overall attendance % of each student in this subject, to warn about low attendance.
  const stats = await Attendance.aggregate([
    { $match: { section: oid(section), subject: oid(subject) } },
    { $unwind: "$records" },
    { $group: { _id: "$records.student", ...statusCounts } },
  ]);
  const statMap = Object.fromEntries(stats.map((s) => [String(s._id), pct(s)]));
  const marks = Object.fromEntries((existing?.records || []).map((r) => [String(r.student), r]));

  const editable =
    !existing ||
    req.user.role === "admin" ||
    (Date.now() - existing.date.getTime()) / 86400000 <= (settings.attendanceEditWindowDays ?? 3);

  return ok(res, {
    attendanceId: existing?._id || null,
    exists: Boolean(existing),
    editable,
    minAttendancePercent: settings.minAttendancePercent ?? 75,
    students: students.map((s) => ({
      _id: s._id,
      name: s.user?.name,
      avatar: s.user?.avatar,
      rollNumber: s.rollNumber,
      studentId: s.studentId,
      status: marks[String(s._id)]?.status || null,
      remark: marks[String(s._id)]?.remark || "",
      percentage: statMap[String(s._id)] ?? null,
    })),
  });
});

async function validateRecords(section, records) {
  if (!Array.isArray(records) || !records.length) throw ApiError.badRequest("Attendance records are required");
  const valid = new Set((await Student.find({ section, status: "active" }).distinct("_id")).map(String));
  const seen = new Set();
  for (const r of records) {
    if (!STATUSES.includes(r.status)) throw ApiError.badRequest(`Invalid status "${r.status}"`);
    if (!valid.has(String(r.student))) throw ApiError.badRequest("A student in the list does not belong to this section");
    if (seen.has(String(r.student))) throw ApiError.badRequest("Duplicate student in attendance list");
    seen.add(String(r.student));
  }
  return records.map((r) => ({ student: r.student, status: r.status, remark: r.remark }));
}

async function warnLowAttendance(section, subject, records, sub) {
  const settings = await getSettings();
  const absentees = records.filter((r) => r.status === "absent").map((r) => oid(r.student));
  if (!absentees.length) return;
  const stats = await Attendance.aggregate([
    { $match: { section: oid(section), subject: oid(subject) } },
    { $unwind: "$records" },
    { $match: { "records.student": { $in: absentees } } },
    { $group: { _id: "$records.student", ...statusCounts } },
  ]);
  const low = stats.filter((s) => s.total >= 3 && pct(s) < settings.minAttendancePercent);
  if (!low.length) return;
  const users = await Student.find({ _id: { $in: low.map((l) => l._id) } }).distinct("user");
  await notifyUsers(users, {
    title: "Low attendance warning",
    message: `Your attendance in ${sub?.name || "a subject"} is below ${settings.minAttendancePercent}%.`,
    type: "attendance",
    link: "/student/attendance",
  });
}

export const markAttendance = asyncHandler(async (req, res) => {
  const { section, subject, date } = req.body;
  if (!section || !subject || !date) throw ApiError.badRequest("section, subject and date are required");
  await assertClassAccess(req, section, subject);

  const day = dayStart(date);
  if (!day) throw ApiError.badRequest("Invalid date");
  if (day > dayStart(new Date())) throw ApiError.badRequest("Cannot mark attendance for a future date");

  const [sec, sub] = await Promise.all([Section.findById(section), Subject.findById(subject)]);
  if (!sec || !sub) throw ApiError.notFound("Section or subject not found");
  if (String(sub.semester) !== String(sec.semester)) throw ApiError.badRequest("Subject is not taught in this section");

  if (await Attendance.exists({ section, subject, date: day })) {
    throw ApiError.conflict("Attendance already marked for this class, subject and date. Edit the existing record instead.");
  }
  const records = await validateRecords(section, req.body.records);
  const doc = await Attendance.create({ section, subject, date: day, markedBy: req.user._id, records });
  await warnLowAttendance(section, subject, records, sub);
  return created(res, doc, `Attendance saved for ${records.length} students`);
});

export const updateAttendance = asyncHandler(async (req, res) => {
  const doc = await Attendance.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Attendance record not found");
  await assertClassAccess(req, doc.section, doc.subject);

  if (req.user.role !== "admin") {
    const settings = await getSettings();
    const ageDays = (Date.now() - doc.date.getTime()) / 86400000;
    if (ageDays > (settings.attendanceEditWindowDays ?? 3)) {
      throw ApiError.forbidden(`Attendance can only be edited within ${settings.attendanceEditWindowDays} days. Ask an admin for corrections.`);
    }
  }
  doc.records = await validateRecords(doc.section, req.body.records);
  doc.markedBy = req.user._id;
  await doc.save();
  if (req.user.role === "admin") await audit(req, "correct", "Attendance", doc._id);
  return ok(res, doc, "Attendance updated");
});

export const deleteAttendance = asyncHandler(async (req, res) => {
  const doc = await Attendance.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Attendance record not found");
  await audit(req, "delete", "Attendance", doc._id);
  return ok(res, { _id: doc._id }, "Attendance record deleted");
});

/** GET /attendance — list of sessions (history), scoped by role. */
export const listSessions = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const match = {};
  if (req.query.section) match.section = oid(req.query.section);
  if (req.query.subject) match.subject = oid(req.query.subject);
  const range = dateRange(req.query);
  if (range) match.date = range;
  if (ctx.role === "faculty") {
    if (req.query.section && !ctx.sectionIds.includes(String(req.query.section))) throw ApiError.forbidden();
    match.section = match.section || { $in: ctx.sectionIds.map(oid) };
    match.subject = match.subject || { $in: ctx.subjectIds.map(oid) };
  } else if (ctx.role === "student") {
    throw ApiError.forbidden();
  }

  const { page, limit, skip } = getPagination(req.query);
  const [total, rows] = await Promise.all([
    Attendance.countDocuments(match),
    Attendance.aggregate([
      { $match: match },
      { $sort: { date: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          section: 1, subject: 1, date: 1, markedBy: 1, updatedAt: 1,
          total: { $size: "$records" },
          present: { $size: { $filter: { input: "$records", cond: { $eq: ["$$this.status", "present"] } } } },
          absent: { $size: { $filter: { input: "$records", cond: { $eq: ["$$this.status", "absent"] } } } },
          late: { $size: { $filter: { input: "$records", cond: { $eq: ["$$this.status", "late"] } } } },
          leave: { $size: { $filter: { input: "$records", cond: { $eq: ["$$this.status", "leave"] } } } },
        },
      },
    ]),
  ]);
  await Attendance.populate(rows, [
    { path: "section", select: "name course semester", populate: [{ path: "course", select: "code" }, { path: "semester", select: "number" }] },
    { path: "subject", select: "name code" },
    { path: "markedBy", select: "name role" },
  ]);
  const data = rows.map((r) => ({ ...r, percentage: pct(r) }));
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const getSession = asyncHandler(async (req, res) => {
  const doc = await Attendance.findById(req.params.id)
    .populate({ path: "records.student", select: "rollNumber studentId", populate: { path: "user", select: "name" } })
    .populate("subject", "name code")
    .populate({ path: "section", select: "name", populate: { path: "course", select: "code" } });
  if (!doc) throw ApiError.notFound("Attendance record not found");
  await assertClassAccess(req, doc.section._id, doc.subject._id);
  return ok(res, doc);
});

/** Student summary: overall, subject-wise, monthly and day history. */
async function studentSummary(studentId, query = {}) {
  const sid = oid(studentId);
  const match = { "records.student": sid };
  const range = dateRange(query);
  if (range) match.date = range;
  if (query.subject) match.subject = oid(query.subject);

  const base = [{ $match: match }, { $unwind: "$records" }, { $match: { "records.student": sid } }];
  const [bySubject, byMonth, history, settings] = await Promise.all([
    Attendance.aggregate([...base, { $group: { _id: "$subject", ...statusCounts } }]),
    Attendance.aggregate([
      ...base,
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, ...statusCounts } },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      ...base,
      { $sort: { date: -1 } },
      { $limit: Number(query.historyLimit) || 60 },
      { $project: { date: 1, subject: 1, status: "$records.status", remark: "$records.remark" } },
    ]),
    getSettings(),
  ]);
  await Attendance.populate(bySubject, { path: "_id", model: "Subject", select: "name code type" });
  await Attendance.populate(history, { path: "subject", model: "Subject", select: "name code" });

  const overall = bySubject.reduce(
    (acc, s) => {
      for (const k of ["total", "present", "absent", "late", "leave"]) acc[k] += s[k];
      return acc;
    },
    { total: 0, present: 0, absent: 0, late: 0, leave: 0 }
  );
  const threshold = settings.minAttendancePercent ?? 75;
  return {
    threshold,
    overall: { ...overall, percentage: pct(overall), isLow: overall.total > 0 && pct(overall) < threshold },
    subjects: bySubject
      .map((s) => ({ subject: s._id, ...s, _id: undefined, percentage: pct(s), isLow: pct(s) < threshold }))
      .sort((a, b) => String(a.subject?.code).localeCompare(String(b.subject?.code))),
    monthly: byMonth.map((m) => ({ month: m._id, ...m, _id: undefined, percentage: pct(m) })),
    history,
  };
}

export const myAttendance = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  return ok(res, await studentSummary(ctx.student._id, req.query));
});

export const studentAttendance = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.studentId).populate("user", "name");
  if (!student) throw ApiError.notFound("Student not found");
  const ctx = await getContext(req);
  if (ctx.role === "faculty" && !ctx.sectionIds.includes(String(student.section))) throw ApiError.forbidden();
  if (ctx.role === "student" && String(ctx.student._id) !== String(student._id)) throw ApiError.forbidden();
  return ok(res, { student: { _id: student._id, name: student.user?.name, rollNumber: student.rollNumber }, ...(await studentSummary(student._id, req.query)) });
});

/** Class/subject/month report: one row per student in the section. */
async function buildSectionReport(req) {
  const { section, subject } = req.query;
  if (!section) throw ApiError.badRequest("section is required");
  await assertClassAccess(req, section, subject);

  const match = { section: oid(section) };
  if (subject) match.subject = oid(subject);
  const range = dateRange(req.query);
  if (range) match.date = range;

  const [students, stats, sessions, settings] = await Promise.all([
    Student.find({ section, status: "active" }).populate("user", "name").sort("rollNumber"),
    Attendance.aggregate([{ $match: match }, { $unwind: "$records" }, { $group: { _id: "$records.student", ...statusCounts } }]),
    Attendance.countDocuments(match),
    getSettings(),
  ]);
  const map = Object.fromEntries(stats.map((s) => [String(s._id), s]));
  const threshold = settings.minAttendancePercent ?? 75;
  const rows = students.map((s) => {
    const st = map[String(s._id)] || { total: 0, present: 0, absent: 0, late: 0, leave: 0 };
    return {
      student: s._id,
      name: s.user?.name,
      rollNumber: s.rollNumber,
      studentId: s.studentId,
      total: st.total, present: st.present, absent: st.absent, late: st.late, leave: st.leave,
      percentage: pct(st),
      isLow: st.total > 0 && pct(st) < threshold,
    };
  });
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.percentage, 0) / rows.length) * 10) / 10 : 0;
  return { sessions, threshold, average: avg, lowCount: rows.filter((r) => r.isLow).length, rows };
}

export const sectionReport = asyncHandler(async (req, res) => ok(res, await buildSectionReport(req)));

export const exportReport = asyncHandler(async (req, res) => {
  const report = await buildSectionReport(req);
  const columns = [
    { key: "rollNumber", label: "Roll No" },
    { key: "studentId", label: "Student ID" },
    { key: "name", label: "Name" },
    { key: "total", label: "Sessions" },
    { key: "present", label: "Present" },
    { key: "late", label: "Late" },
    { key: "absent", label: "Absent" },
    { key: "leave", label: "Leave" },
    { key: "percentage", label: "Attendance %" },
    { key: "low", label: "Below threshold" },
  ];
  const rows = report.rows.map((r) => ({ ...r, low: r.isLow ? "YES" : "" }));
  const [section, subject] = await Promise.all([
    Section.findById(req.query.section).populate("course", "code").populate("semester", "number"),
    req.query.subject ? Subject.findById(req.query.subject) : null,
  ]);
  const label = `${section?.course?.code || ""} S${section?.semester?.number || ""}-${section?.name || ""}${subject ? ` · ${subject.code}` : ""}`;
  const base = `attendance-${label.replace(/[^A-Za-z0-9-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}`;

  if (req.query.format === "xlsx") {
    const buf = await buildWorkbook("Attendance", columns, rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  if (req.query.format === "pdf") {
    const s = await Setting.findOne({ key: "global" }).lean();
    return streamTablePdf(res, {
      filename: `${base}.pdf`,
      college: s?.collegeName || "College",
      title: `Attendance Report — ${label}`,
      subtitle: `${req.query.month ? `Month ${req.query.month} · ` : ""}${report.sessions} sessions · class average ${report.average}% · threshold ${report.threshold}% · ${report.lowCount} below threshold`,
      columns,
      rows,
    });
  }
  return sendCSV(res, `${base}.csv`, toCSV(rows, columns.map((c) => ({ label: c.label, value: c.key }))));
});

/** Students whose overall attendance is below the threshold. */
export const lowAttendance = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const settings = await getSettings();
  const threshold = Number(req.query.threshold) || settings.minAttendancePercent || 75;
  const match = {};
  if (req.query.section) match.section = oid(req.query.section);
  if (ctx.role === "faculty") {
    if (req.query.section && !ctx.sectionIds.includes(String(req.query.section))) throw ApiError.forbidden();
    match.section = match.section || { $in: ctx.sectionIds.map(oid) };
  }
  const rows = await Attendance.aggregate([
    { $match: match },
    { $unwind: "$records" },
    { $group: { _id: "$records.student", ...statusCounts } },
    { $addFields: { percentage: { $round: [{ $multiply: [{ $divide: [{ $add: ["$present", "$late"] }, "$total"] }, 100] }, 1] } } },
    { $match: { percentage: { $lt: threshold }, total: { $gte: 1 } } },
    { $sort: { percentage: 1 } },
    { $limit: 200 },
  ]);
  await Attendance.populate(rows, {
    path: "_id",
    model: "Student",
    select: "rollNumber studentId section user",
    populate: [{ path: "user", select: "name email" }, { path: "section", select: "name", populate: { path: "course", select: "code" } }],
  });
  return ok(res, { threshold, rows: rows.filter((r) => r._id).map((r) => ({ ...r, student: r._id, _id: r._id._id })) });
});

/** Admin overview: today's percentage, last 14 days trend, sections not yet marked today. */
export const overview = asyncHandler(async (req, res) => {
  const date = dayStart(req.query.date || new Date());
  const from = new Date(date.getTime() - 13 * 86400000);
  const [today, trend] = await Promise.all([
    Attendance.aggregate([{ $match: { date } }, { $unwind: "$records" }, { $group: { _id: null, ...statusCounts } }]),
    Attendance.aggregate([
      { $match: { date: { $gte: from, $lte: date } } },
      { $unwind: "$records" },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, ...statusCounts } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const sessionsToday = await Attendance.countDocuments({ date });
  const t = today[0] || { total: 0, present: 0, absent: 0, late: 0, leave: 0 };
  return ok(res, {
    date,
    sessionsToday,
    today: { ...t, _id: undefined, percentage: pct(t) },
    trend: trend.map((d) => ({ date: d._id, percentage: pct(d), present: d.present + d.late, absent: d.absent, total: d.total })),
  });
});
