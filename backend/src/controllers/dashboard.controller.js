import mongoose from "mongoose";
import {
  Student, Faculty, Department, Course, Section, Subject, Attendance, Assignment, AssignmentSubmission,
  Examination, Notice, AuditLog, FeePayment, LeaveRequest, Complaint, Timetable,
} from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { dayStart, DAYS } from "../utils/query.js";
import { getContext } from "../services/access.js";
import { pct } from "./attendance.controller.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const counts = {
  total: { $sum: 1 },
  present: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
  late: { $sum: { $cond: [{ $eq: ["$records.status", "late"] }, 1, 0] } },
  absent: { $sum: { $cond: [{ $eq: ["$records.status", "absent"] }, 1, 0] } },
  leave: { $sum: { $cond: [{ $eq: ["$records.status", "leave"] }, 1, 0] } },
};

async function attendanceTrend(match, days = 7) {
  const today = dayStart(new Date());
  const from = new Date(today.getTime() - (days - 1) * 86400000);
  const rows = await Attendance.aggregate([
    { $match: { ...match, date: { $gte: from, $lte: today } } },
    { $unwind: "$records" },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, ...counts } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, percentage: pct(r), present: r.present + r.late, absent: r.absent }));
}

const ttPopulate = [
  { path: "subject", select: "name code" },
  { path: "faculty", select: "employeeId", populate: { path: "user", select: "name" } },
  { path: "section", select: "name", populate: [{ path: "course", select: "code" }, { path: "semester", select: "number" }] },
];

export const adminDashboard = asyncHandler(async (_req, res) => {
  const today = dayStart(new Date());
  const [
    students, faculty, departments, courses, sections, subjects, todayAtt, upcomingExams, pendingAssignments,
    recent, byDept, feeAgg, pendingLeaves, openComplaints, trend,
  ] = await Promise.all([
    Student.countDocuments({ status: "active" }),
    Faculty.countDocuments({ status: { $ne: "inactive" } }),
    Department.countDocuments({ isActive: true }),
    Course.countDocuments({ isActive: true }),
    Section.countDocuments({ isActive: true }),
    Subject.countDocuments({ isActive: true }),
    Attendance.aggregate([{ $match: { date: today } }, { $unwind: "$records" }, { $group: { _id: null, ...counts } }]),
    Examination.find({ $or: [{ startDate: { $gte: today } }, { endDate: { $gte: today } }] })
      .sort("startDate").limit(5).populate("course", "code").populate("semester", "number"),
    Assignment.countDocuments({ isPublished: true, dueDate: { $gte: new Date() } }),
    AuditLog.find().sort("-createdAt").limit(8).populate("user", "name role"),
    Student.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "d" } },
      { $project: { name: { $arrayElemAt: ["$d.code", 0] }, count: 1 } },
    ]),
    FeePayment.aggregate([
      { $match: { paidAt: { $gte: new Date(today.getTime() - 180 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } }, amount: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]),
    LeaveRequest.countDocuments({ status: "pending" }),
    Complaint.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    attendanceTrend({}),
  ]);
  const t = todayAtt[0];
  return ok(res, {
    counts: { students, faculty, departments, courses, sections, subjects, pendingAssignments, pendingLeaves, openComplaints },
    todayAttendance: t ? pct(t) : null,
    todayMarked: t?.total || 0,
    upcomingExams,
    recentActivities: recent,
    studentsByDepartment: byDept.map((d) => ({ name: d.name || "—", count: d.count })),
    feeCollection: feeAgg.map((f) => ({ month: f._id, amount: f.amount })),
    attendanceTrend: trend,
  });
});

export const facultyDashboard = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const sectionIds = ctx.sectionIds.map(oid);
  const day = DAYS[new Date().getDay()];
  const now = new Date();
  const myAssignments = await Assignment.find({ faculty: ctx.faculty._id }).distinct("_id");
  const sectionDocs = await Section.find({ _id: { $in: sectionIds } }).select("semester").lean();
  const [classes, students, todayClasses, pendingEval, trend, exams, notices, upcomingAssignments] = await Promise.all([
    Section.find({ _id: { $in: sectionIds } }).populate("course", "code name").populate("semester", "number name"),
    Student.countDocuments({ section: { $in: sectionIds }, status: "active" }),
    Timetable.find({ faculty: ctx.faculty._id, day }).sort("startTime").populate(ttPopulate),
    AssignmentSubmission.countDocuments({ assignment: { $in: myAssignments }, status: { $in: ["submitted", "late"] } }),
    attendanceTrend({ section: { $in: sectionIds }, subject: { $in: ctx.subjectIds.map(oid) } }),
    Examination.find({
      semester: { $in: sectionDocs.map((s) => s.semester) },
      $or: [{ startDate: { $gte: dayStart(now) } }, { endDate: { $gte: dayStart(now) } }],
    }).sort("startDate").limit(5).populate("course", "code"),
    Notice.find({
      isActive: true, publishDate: { $lte: now },
      $or: [{ "audience.type": { $in: ["all", "faculty"] } }, { "audience.type": "department", "audience.department": ctx.faculty.department }],
    }).sort("-publishDate").limit(5),
    Assignment.find({ faculty: ctx.faculty._id, dueDate: { $gte: now } }).sort("dueDate").limit(5).populate("subject", "code name").populate("section", "name"),
  ]);
  const avg = trend.length ? Math.round((trend.reduce((s, t) => s + t.percentage, 0) / trend.length) * 10) / 10 : null;
  return ok(res, {
    counts: { classes: classes.length, students, subjects: ctx.subjectIds.length, pendingEvaluations: pendingEval, todayClasses: todayClasses.length },
    classes, todayClasses, attendanceTrend: trend, averageAttendance: avg, upcomingExams: exams, recentNotices: notices, upcomingAssignments,
  });
});

export const studentDashboard = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const s = ctx.student;
  const now = new Date();
  const day = DAYS[now.getDay()];
  const student = await Student.findById(s._id)
    .populate("user", "name email avatar").populate("course", "name code").populate("semester", "name number")
    .populate("section", "name room").populate("department", "name code");

  const [overallAgg, todayClasses, assignments, exams, notices] = await Promise.all([
    Attendance.aggregate([
      { $match: { "records.student": s._id } }, { $unwind: "$records" }, { $match: { "records.student": s._id } },
      { $group: { _id: null, ...counts } },
    ]),
    s.section ? Timetable.find({ section: s.section, day }).sort("startTime").populate(ttPopulate) : [],
    s.section ? Assignment.find({ section: s.section, isPublished: true, dueDate: { $gte: new Date(now.getTime() - 7 * 86400000) } }).sort("dueDate").limit(8).populate("subject", "name code").lean() : [],
    Examination.find({
      course: s.course, semester: s.semester,
      $and: [
        { $or: [{ sections: { $size: 0 } }, { sections: s.section }] },
        { $or: [{ startDate: { $gte: dayStart(now) } }, { endDate: { $gte: dayStart(now) } }] },
      ],
    }).sort("startDate").limit(5).populate("schedule.subject", "code name"),
    Notice.find({
      isActive: true, publishDate: { $lte: now },
      $or: [
        { "audience.type": { $in: ["all", "students"] } },
        { "audience.type": "department", "audience.department": s.department },
        { "audience.type": "course", "audience.course": s.course },
        { "audience.type": "semester", "audience.semester": s.semester },
        { "audience.type": "section", "audience.section": s.section },
      ],
    }).sort("-publishDate").limit(5),
  ]);
  const subs = await AssignmentSubmission.find({ student: s._id, assignment: { $in: assignments.map((a) => a._id) } }).lean();
  const subMap = Object.fromEntries(subs.map((x) => [String(x.assignment), x]));
  const o = overallAgg[0];
  return ok(res, {
    student,
    attendance: o ? { percentage: pct(o), total: o.total, attended: o.present + o.late } : { percentage: null, total: 0, attended: 0 },
    todayClasses,
    assignments: assignments.map((a) => ({
      ...a,
      submissionStatus: subMap[String(a._id)]?.status || (new Date(a.dueDate) < now ? "missing" : "pending"),
      marks: subMap[String(a._id)]?.marks,
    })),
    upcomingExams: exams,
    latestNotices: notices,
  });
});

/** Public, non-sensitive counts for the landing page. */
export const publicStats = asyncHandler(async (_req, res) => {
  const [students, faculty, sections, avg] = await Promise.all([
    Student.countDocuments({ status: "active" }),
    Faculty.countDocuments({ status: { $ne: "inactive" } }),
    Section.countDocuments({ isActive: true }),
    Attendance.aggregate([
      { $match: { date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $unwind: "$records" },
      { $group: { _id: null, ...counts } },
    ]),
  ]);
  return ok(res, { students, faculty, classes: sections, attendance: avg[0] ? pct(avg[0]) : null });
});
