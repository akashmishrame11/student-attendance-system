import mongoose from "mongoose";
import {
  Student, Faculty, Department, Course, Attendance, Assignment, AssignmentSubmission, ExaminationResult,
  FeePayment, BookIssue, LeaveRequest, Examination, Setting,
} from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok } from "../utils/response.js";
import { toCSV, sendCSV, dayStart } from "../utils/query.js";
import { buildWorkbook } from "../utils/sheet.js";
import { streamTablePdf } from "../utils/pdf.js";
import { getContext } from "../services/access.js";
import { pct } from "./attendance.controller.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const d = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");

function range(q, field) {
  if (!q.from && !q.to) return {};
  const r = {};
  if (q.from) r.$gte = dayStart(q.from);
  if (q.to) r.$lt = new Date(dayStart(q.to).getTime() + 86400000);
  return { [field]: r };
}

/** Each report returns { title, columns: [{key,label}], rows }. Faculty get scoped data. */
const REPORTS = {
  async students(q) {
    const filter = {};
    for (const f of ["department", "course", "semester", "section", "status"]) if (q[f]) filter[f] = q[f];
    if (q._sections) filter.section = { $in: q._sections };
    const rows = await Student.find(filter).populate("user", "name email phone").populate("department", "code").populate("course", "code")
      .populate("semester", "number").populate("section", "name").sort("rollNumber").lean();
    return {
      title: "Student Records",
      columns: [
        { key: "studentId", label: "Student ID" }, { key: "rollNumber", label: "Roll No" }, { key: "name", label: "Name" },
        { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "department", label: "Dept" },
        { key: "course", label: "Course" }, { key: "semester", label: "Sem" }, { key: "section", label: "Section" },
        { key: "batch", label: "Batch" }, { key: "status", label: "Status" },
      ],
      rows: rows.map((r) => ({
        studentId: r.studentId, rollNumber: r.rollNumber, name: r.user?.name, email: r.user?.email, phone: r.user?.phone,
        department: r.department?.code, course: r.course?.code, semester: r.semester?.number, section: r.section?.name, batch: r.batch, status: r.status,
      })),
    };
  },
  async faculty(q) {
    const filter = q.department ? { department: q.department } : {};
    const rows = await Faculty.find(filter).populate("user", "name email phone").populate("department", "code").populate("subjects", "code").lean();
    return {
      title: "Faculty Records",
      columns: [
        { key: "employeeId", label: "Employee ID" }, { key: "name", label: "Name" }, { key: "email", label: "Email" },
        { key: "department", label: "Dept" }, { key: "designation", label: "Designation" }, { key: "subjects", label: "Subjects" },
        { key: "joiningDate", label: "Joined" }, { key: "status", label: "Status" },
      ],
      rows: rows.map((r) => ({
        employeeId: r.employeeId, name: r.user?.name, email: r.user?.email, department: r.department?.code, designation: r.designation,
        subjects: (r.subjects || []).map((s) => s.code).join(" "), joiningDate: d(r.joiningDate), status: r.status,
      })),
    };
  },
  async attendance(q) {
    const match = { ...range(q, "date") };
    if (q.section) match.section = oid(q.section);
    if (q.subject) match.subject = oid(q.subject);
    if (q._sections) match.section = match.section || { $in: q._sections.map(oid) };
    const groupBy = q.groupBy === "subject" ? "$subject" : q.groupBy === "student" ? "$records.student" : "$section";
    const rows = await Attendance.aggregate([
      { $match: match }, { $unwind: "$records" },
      {
        $group: {
          _id: groupBy, sessions: { $addToSet: "$_id" }, total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$records.status", "present"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$records.status", "late"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$records.status", "absent"] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ["$records.status", "leave"] }, 1, 0] } },
        },
      },
    ]);
    const model = q.groupBy === "subject" ? "Subject" : q.groupBy === "student" ? "Student" : "Section";
    const populate = model === "Section"
      ? { path: "_id", model, select: "name course semester", populate: [{ path: "course", select: "code" }, { path: "semester", select: "number" }] }
      : model === "Student" ? { path: "_id", model, select: "rollNumber user", populate: { path: "user", select: "name" } }
        : { path: "_id", model, select: "code name" };
    await Attendance.populate(rows, populate);
    const label = (r) => model === "Section" ? `${r._id?.course?.code} S${r._id?.semester?.number}-${r._id?.name}` : model === "Student" ? `${r._id?.rollNumber} ${r._id?.user?.name}` : `${r._id?.code} ${r._id?.name}`;
    return {
      title: `Attendance Report (by ${model.toLowerCase()})`,
      columns: [
        { key: "group", label: model }, { key: "sessions", label: "Sessions" }, { key: "present", label: "Present" },
        { key: "late", label: "Late" }, { key: "absent", label: "Absent" }, { key: "leave", label: "Leave" }, { key: "percentage", label: "Attendance %" },
      ],
      rows: rows.map((r) => ({ group: label(r), sessions: r.sessions.length, present: r.present, late: r.late, absent: r.absent, leave: r.leave, percentage: pct(r) }))
        .sort((a, b) => String(a.group).localeCompare(String(b.group))),
    };
  },
  async assignments(q) {
    const filter = { ...range(q, "dueDate") };
    if (q.section) filter.section = q.section;
    if (q._faculty) filter.faculty = q._faculty;
    const list = await Assignment.find(filter).populate("subject", "code").populate("section", "name").populate({ path: "faculty", populate: { path: "user", select: "name" } }).sort("-dueDate").lean();
    const agg = await AssignmentSubmission.aggregate([
      { $match: { assignment: { $in: list.map((a) => a._id) } } },
      { $group: { _id: "$assignment", submitted: { $sum: 1 }, late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } }, evaluated: { $sum: { $cond: [{ $eq: ["$status", "evaluated"] }, 1, 0] } }, avg: { $avg: "$marks" } } },
    ]);
    const strength = await Student.aggregate([{ $match: { status: "active", section: { $in: list.map((a) => a.section?._id) } } }, { $group: { _id: "$section", n: { $sum: 1 } } }]);
    const m = Object.fromEntries(agg.map((a) => [String(a._id), a]));
    const sm = Object.fromEntries(strength.map((s) => [String(s._id), s.n]));
    return {
      title: "Assignment Report",
      columns: [
        { key: "title", label: "Title" }, { key: "subject", label: "Subject" }, { key: "section", label: "Section" }, { key: "faculty", label: "Faculty" },
        { key: "dueDate", label: "Due" }, { key: "strength", label: "Students" }, { key: "submitted", label: "Submitted" }, { key: "late", label: "Late" },
        { key: "pending", label: "Pending" }, { key: "evaluated", label: "Evaluated" }, { key: "avgMarks", label: "Avg Marks" },
      ],
      rows: list.map((a) => {
        const s = m[String(a._id)] || {};
        const n = sm[String(a.section?._id)] || 0;
        return {
          title: a.title, subject: a.subject?.code, section: a.section?.name, faculty: a.faculty?.user?.name, dueDate: d(a.dueDate), strength: n,
          submitted: s.submitted || 0, late: s.late || 0, pending: Math.max(0, n - (s.submitted || 0)), evaluated: s.evaluated || 0,
          avgMarks: s.avg != null ? `${Math.round(s.avg * 10) / 10}/${a.maxMarks}` : "",
        };
      }),
    };
  },
  async results(q) {
    if (!q.exam) throw ApiError.badRequest("Select an examination");
    const exam = await Examination.findById(q.exam).populate("schedule.subject", "code");
    if (!exam) throw ApiError.notFound("Examination not found");
    const filter = { exam: exam._id };
    if (q._sections) filter.student = { $in: await Student.find({ section: { $in: q._sections } }).distinct("_id") };
    const rows = await ExaminationResult.find(filter).populate({ path: "student", select: "rollNumber", populate: { path: "user", select: "name" } }).sort("student").lean();
    const subjects = exam.schedule.map((s) => s.subject);
    return {
      title: `Results — ${exam.name}`,
      columns: [
        { key: "rollNumber", label: "Roll No" }, { key: "name", label: "Name" },
        ...subjects.map((s) => ({ key: String(s._id), label: s.code })),
        { key: "total", label: "Total" }, { key: "percentage", label: "%" }, { key: "grade", label: "Grade" }, { key: "status", label: "Result" },
      ],
      rows: rows.map((r) => ({
        rollNumber: r.student?.rollNumber, name: r.student?.user?.name,
        ...Object.fromEntries(r.marks.map((m) => [String(m.subject), m.isAbsent ? "AB" : m.marksObtained])),
        total: `${r.total}/${r.maxTotal}`, percentage: r.percentage, grade: r.grade, status: r.status,
      })),
    };
  },
  async fees(q) {
    const rows = await FeePayment.find(range(q, "paidAt")).populate("fee", "name").populate({ path: "student", select: "rollNumber", populate: { path: "user", select: "name" } }).sort("-paidAt").lean();
    return {
      title: "Fee Collection Report",
      columns: [
        { key: "receiptNo", label: "Receipt" }, { key: "paidAt", label: "Date" }, { key: "rollNumber", label: "Roll No" }, { key: "name", label: "Student" },
        { key: "fee", label: "Fee" }, { key: "amount", label: "Amount" }, { key: "fine", label: "Fine" }, { key: "method", label: "Method" },
      ],
      rows: rows.map((r) => ({ receiptNo: r.receiptNo, paidAt: d(r.paidAt), rollNumber: r.student?.rollNumber, name: r.student?.user?.name, fee: r.fee?.name, amount: r.amount, fine: r.fine, method: r.method })),
    };
  },
  async departments() {
    const [depts, s, f, c] = await Promise.all([
      Department.find().populate({ path: "head", populate: { path: "user", select: "name" } }).lean(),
      Student.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$department", n: { $sum: 1 } } }]),
      Faculty.aggregate([{ $group: { _id: "$department", n: { $sum: 1 } } }]),
      Course.aggregate([{ $group: { _id: "$department", n: { $sum: 1 } } }]),
    ]);
    const m = (arr) => Object.fromEntries(arr.map((a) => [String(a._id), a.n]));
    const [sm, fm, cm] = [m(s), m(f), m(c)];
    return {
      title: "Department Report",
      columns: [{ key: "code", label: "Code" }, { key: "name", label: "Department" }, { key: "head", label: "Head" }, { key: "courses", label: "Courses" }, { key: "faculty", label: "Faculty" }, { key: "students", label: "Students" }],
      rows: depts.map((x) => ({ code: x.code, name: x.name, head: x.head?.user?.name || "", courses: cm[String(x._id)] || 0, faculty: fm[String(x._id)] || 0, students: sm[String(x._id)] || 0 })),
    };
  },
  async courses() {
    const [list, s] = await Promise.all([
      Course.find().populate("department", "code").lean(),
      Student.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$course", n: { $sum: 1 } } }]),
    ]);
    const sm = Object.fromEntries(s.map((a) => [String(a._id), a.n]));
    return {
      title: "Course Report",
      columns: [{ key: "code", label: "Code" }, { key: "name", label: "Course" }, { key: "department", label: "Dept" }, { key: "duration", label: "Years" }, { key: "semesters", label: "Semesters" }, { key: "students", label: "Students" }],
      rows: list.map((c) => ({ code: c.code, name: c.name, department: c.department?.code, duration: c.durationYears, semesters: c.totalSemesters, students: sm[String(c._id)] || 0 })),
    };
  },
  async library(q) {
    const filter = { ...range(q, "issueDate") };
    if (q.status) filter.status = q.status;
    const rows = await BookIssue.find(filter).populate("book", "title isbn").populate({ path: "student", select: "rollNumber", populate: { path: "user", select: "name" } }).sort("-issueDate").lean();
    return {
      title: "Library Issue Report",
      columns: [{ key: "book", label: "Book" }, { key: "isbn", label: "ISBN" }, { key: "student", label: "Student" }, { key: "issueDate", label: "Issued" }, { key: "dueDate", label: "Due" }, { key: "returnDate", label: "Returned" }, { key: "fine", label: "Fine" }, { key: "status", label: "Status" }],
      rows: rows.map((r) => ({ book: r.book?.title, isbn: r.book?.isbn, student: `${r.student?.rollNumber} ${r.student?.user?.name}`, issueDate: d(r.issueDate), dueDate: d(r.dueDate), returnDate: d(r.returnDate), fine: r.fine, status: r.status })),
    };
  },
  async leaves(q) {
    const filter = { ...range(q, "fromDate") };
    if (q.status) filter.status = q.status;
    if (q.role) filter.role = q.role;
    const rows = await LeaveRequest.find(filter).populate("applicant", "name role").populate("reviewedBy", "name").sort("-fromDate").lean();
    return {
      title: "Leave Requests Report",
      columns: [{ key: "applicant", label: "Applicant" }, { key: "role", label: "Role" }, { key: "type", label: "Type" }, { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "status", label: "Status" }, { key: "reviewedBy", label: "Reviewed by" }, { key: "remarks", label: "Remarks" }],
      rows: rows.map((r) => ({ applicant: r.applicant?.name, role: r.role, type: r.leaveType, from: d(r.fromDate), to: d(r.toDate), status: r.status, reviewedBy: r.reviewedBy?.name || "", remarks: r.remarks || "" })),
    };
  },
};

/** Human-readable filter summary for the PDF header. */
function describeFilters(q) {
  const parts = [];
  if (q.from || q.to) parts.push(`Period: ${q.from || "…"} to ${q.to || "…"}`);
  if (q.status) parts.push(`Status: ${q.status}`);
  if (q.groupBy) parts.push(`Grouped by: ${q.groupBy}`);
  return parts.join("   ·   ") || "All records";
}

const FACULTY_ALLOWED = ["students", "attendance", "assignments", "results"];

export const getReport = asyncHandler(async (req, res) => {
  const builder = REPORTS[req.params.type];
  if (!builder) throw ApiError.notFound("Unknown report type");
  const q = { ...req.query };
  if (req.user.role === "faculty") {
    if (!FACULTY_ALLOWED.includes(req.params.type)) throw ApiError.forbidden();
    const ctx = await getContext(req);
    q._sections = ctx.sectionIds;
    q._faculty = ctx.faculty._id;
    if (q.section && !ctx.sectionIds.includes(String(q.section))) throw ApiError.forbidden();
  }
  const report = await builder(q);
  const base = `${req.params.type}-report-${new Date().toISOString().slice(0, 10)}`;
  if (req.query.format === "csv") {
    return sendCSV(res, `${base}.csv`, toCSV(report.rows, report.columns.map((c) => ({ label: c.label, value: c.key }))));
  }
  if (req.query.format === "xlsx") {
    const buf = await buildWorkbook(report.title, report.columns, report.rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
    return res.send(Buffer.from(buf));
  }
  if (req.query.format === "pdf") {
    const settings = await Setting.findOne({ key: "global" }).lean();
    return streamTablePdf(res, {
      filename: `${base}.pdf`,
      college: settings?.collegeName || "College",
      title: report.title,
      subtitle: describeFilters(q),
      columns: report.columns,
      rows: report.rows,
    });
  }
  return ok(res, { ...report, generatedAt: new Date(), count: report.rows.length });
});
