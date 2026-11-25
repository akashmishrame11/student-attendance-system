import mongoose from "mongoose";
import { Examination, ExaminationResult, Student, Section, Semester, Setting } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, getPagination, getSort } from "../utils/query.js";
import { getContext } from "../services/access.js";
import { notifyUsers } from "../services/notify.js";
import { calcGrade } from "../utils/grade.js";
import { audit } from "../services/audit.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));

const POPULATE = [
  { path: "course", select: "name code" },
  { path: "semester", select: "name number academicYear" },
  { path: "sections", select: "name" },
  { path: "schedule.subject", select: "name code type" },
];

async function examScope(req) {
  const ctx = await getContext(req);
  if (ctx.role === "student") {
    const s = ctx.student;
    return {
      course: s.course,
      semester: s.semester,
      $or: [{ sections: { $size: 0 } }, { sections: s.section }],
    };
  }
  if (ctx.role === "faculty") {
    const sections = await Section.find({ _id: { $in: ctx.sectionIds } }).select("semester").lean();
    const semesters = [...new Set(sections.map((s) => String(s.semester)))].map(oid);
    return {
      semester: { $in: semesters },
      $or: [{ sections: { $size: 0 } }, { sections: { $in: ctx.sectionIds.map(oid) } }],
    };
  }
  return {};
}

export const listExams = asyncHandler(async (req, res) => {
  const filter = await examScope(req);
  for (const f of ["type", "course"]) if (req.query[f]) filter[f] = req.query[f];
  if (req.query.semester && !filter.semester?.$in) filter.semester = req.query.semester;
  if (req.query.upcoming === "true") filter.$and = [{ $or: [{ endDate: { $gte: new Date() } }, { startDate: { $gte: new Date() } }] }];
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    Examination.countDocuments(filter),
    Examination.find(filter).sort(getSort(req.query, "-startDate")).skip(skip).limit(limit).populate(POPULATE),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const getExam = asyncHandler(async (req, res) => {
  const exam = await Examination.findOne({ _id: req.params.id, ...(await examScope(req)) }).populate(POPULATE);
  if (!exam) throw ApiError.notFound("Examination not found");
  return ok(res, exam);
});

const FIELDS = ["name", "type", "course", "semester", "sections", "academicYear", "startDate", "endDate", "schedule"];

async function validateExam(req, body) {
  const sem = await Semester.findById(body.semester);
  if (!sem || String(sem.course) !== String(body.course)) throw ApiError.badRequest("Semester does not belong to the selected course");
  body.academicYear = body.academicYear || sem.academicYear;
  body.sections = (body.sections || []).filter(Boolean);
  if (req.user.role === "faculty") {
    const ctx = await getContext(req);
    if (!body.sections.length) throw ApiError.badRequest("Select the sections this exam is for");
    if (body.sections.some((s) => !ctx.sectionIds.includes(String(s)))) throw ApiError.forbidden("You can only create exams for your assigned sections");
  }
  for (const item of body.schedule || []) {
    if (Number(item.passMarks) > Number(item.maxMarks)) throw ApiError.badRequest("Pass marks cannot exceed max marks");
  }
  if (body.schedule?.length) {
    const dates = body.schedule.map((s) => new Date(s.date)).sort((a, b) => a - b);
    body.startDate = body.startDate || dates[0];
    body.endDate = body.endDate || dates[dates.length - 1];
  }
  return body;
}

export const createExam = asyncHandler(async (req, res) => {
  const body = await validateExam(req, Object.fromEntries(FIELDS.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]])));
  const exam = await Examination.create({ ...body, createdBy: req.user._id });
  await audit(req, "create", "Examination", exam._id);
  const students = await Student.find({
    course: exam.course, semester: exam.semester, status: "active",
    ...(exam.sections.length ? { section: { $in: exam.sections } } : {}),
  }).distinct("user");
  await notifyUsers(students, { title: `Exam scheduled: ${exam.name}`, message: `Starts ${exam.startDate.toLocaleDateString("en-IN")}`, type: "exam", link: "/student/exams" });
  await exam.populate(POPULATE);
  return created(res, exam, "Examination created");
});

export const updateExam = asyncHandler(async (req, res) => {
  const exam = await Examination.findOne({ _id: req.params.id, ...(await examScope(req)) });
  if (!exam) throw ApiError.notFound("Examination not found");
  if (req.user.role === "faculty" && String(exam.createdBy) !== String(req.user._id)) throw ApiError.forbidden("Only the creator or an admin can edit this exam");
  const merged = { ...exam.toObject(), ...Object.fromEntries(FIELDS.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]])) };
  const body = await validateExam(req, merged);
  for (const f of FIELDS) if (body[f] !== undefined) exam.set(f, body[f]);
  await exam.save();
  await audit(req, "update", "Examination", exam._id);
  await exam.populate(POPULATE);
  return ok(res, exam, "Examination updated");
});

export const deleteExam = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) throw ApiError.notFound("Examination not found");
  if (req.user.role === "faculty" && String(exam.createdBy) !== String(req.user._id)) throw ApiError.forbidden();
  await ExaminationResult.deleteMany({ exam: exam._id });
  await exam.deleteOne();
  await audit(req, "delete", "Examination", exam._id);
  return ok(res, { _id: exam._id }, "Examination deleted");
});

export const publishResults = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) throw ApiError.notFound("Examination not found");
  exam.resultsPublished = Boolean(req.body.publish);
  exam.publishedAt = exam.resultsPublished ? new Date() : undefined;
  await exam.save();
  await audit(req, exam.resultsPublished ? "publish" : "unpublish", "Examination", exam._id);
  if (exam.resultsPublished) {
    const studentIds = await ExaminationResult.find({ exam: exam._id }).distinct("student");
    const users = await Student.find({ _id: { $in: studentIds } }).distinct("user");
    await notifyUsers(users, { title: `Results published: ${exam.name}`, message: "Your results are now available.", type: "result", link: "/student/results" });
  }
  return ok(res, exam, exam.resultsPublished ? "Results published" : "Results unpublished");
});

/* ---------------------------------------------------------------- results */
async function grading() {
  const s = await Setting.findOne({ key: "global" }).lean();
  return s?.grading;
}

function recompute(result, exam, scale) {
  const scheduleSubjects = exam.schedule.map((s) => String(s.subject));
  let total = 0;
  let maxTotal = 0;
  let failed = false;
  for (const m of result.marks) {
    total += m.isAbsent ? 0 : m.marksObtained;
    maxTotal += m.maxMarks;
    const p = m.maxMarks ? (m.marksObtained / m.maxMarks) * 100 : 0;
    m.grade = m.isAbsent ? "AB" : calcGrade(p, scale);
    if (m.isAbsent || m.marksObtained < (m.passMarks ?? 0)) failed = true;
  }
  const complete = scheduleSubjects.every((sid) => result.marks.some((m) => String(m.subject) === sid));
  result.total = total;
  result.maxTotal = maxTotal;
  result.percentage = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
  result.grade = calcGrade(result.percentage, scale);
  result.status = failed ? "fail" : complete ? "pass" : "pending";
}

async function loadExamForMarks(req, examId, subjectId) {
  const exam = await Examination.findById(examId);
  if (!exam) throw ApiError.notFound("Examination not found");
  const item = exam.schedule.find((s) => String(s.subject) === String(subjectId));
  if (!item) throw ApiError.badRequest("Subject is not part of this examination");
  if (req.user.role === "faculty") {
    const ctx = await getContext(req);
    if (!ctx.subjectIds.includes(String(subjectId))) throw ApiError.forbidden("You are not assigned to this subject");
  }
  return { exam, item };
}

/** GET /results/exam/:examId/sheet?subject&section — marks entry sheet. */
export const marksSheet = asyncHandler(async (req, res) => {
  const { subject, section } = req.query;
  if (!subject) throw ApiError.badRequest("subject is required");
  const { exam, item } = await loadExamForMarks(req, req.params.examId, subject);
  const filter = { course: exam.course, semester: exam.semester, status: "active" };
  if (section) filter.section = section;
  else if (exam.sections.length) filter.section = { $in: exam.sections };
  if (req.user.role === "faculty") {
    const ctx = await getContext(req);
    if (section && !ctx.sectionIds.includes(String(section))) throw ApiError.forbidden();
    filter.section = section || { $in: ctx.sectionIds };
  }
  const students = await Student.find(filter).populate("user", "name").populate("section", "name").sort("rollNumber");
  const results = await ExaminationResult.find({ exam: exam._id, student: { $in: students.map((s) => s._id) } }).lean();
  const map = Object.fromEntries(results.map((r) => [String(r.student), r.marks.find((m) => String(m.subject) === String(subject))]));
  return ok(res, {
    exam: { _id: exam._id, name: exam.name, resultsPublished: exam.resultsPublished },
    maxMarks: item.maxMarks,
    passMarks: item.passMarks,
    rows: students.map((s) => ({
      student: s._id,
      name: s.user?.name,
      rollNumber: s.rollNumber,
      section: s.section?.name,
      marksObtained: map[String(s._id)]?.marksObtained ?? null,
      isAbsent: map[String(s._id)]?.isAbsent ?? false,
      grade: map[String(s._id)]?.grade ?? null,
    })),
  });
});

/** POST /results/exam/:examId/marks { subject, entries: [{student, marksObtained, isAbsent}] } */
export const saveMarks = asyncHandler(async (req, res) => {
  const { subject, entries } = req.body;
  if (!Array.isArray(entries) || !entries.length) throw ApiError.badRequest("No marks to save");
  const { exam, item } = await loadExamForMarks(req, req.params.examId, subject);
  if (exam.resultsPublished && req.user.role !== "admin") throw ApiError.forbidden("Results are published; only an admin can change marks");

  const eligible = new Set((await Student.find({ course: exam.course, semester: exam.semester }).distinct("_id")).map(String));
  if (req.user.role === "faculty") {
    const ctx = await getContext(req);
    const mine = new Set((await Student.find({ section: { $in: ctx.sectionIds } }).distinct("_id")).map(String));
    for (const id of [...eligible]) if (!mine.has(id)) eligible.delete(id);
  }
  const scale = await grading();
  let saved = 0;
  for (const e of entries) {
    if (!eligible.has(String(e.student))) throw ApiError.badRequest("A student in the list is not eligible for this exam");
    if (e.marksObtained === null || e.marksObtained === "" || e.marksObtained === undefined) {
      if (!e.isAbsent) continue;
    }
    const marks = e.isAbsent ? 0 : Number(e.marksObtained);
    if (Number.isNaN(marks) || marks < 0 || marks > item.maxMarks) throw ApiError.badRequest(`Marks must be between 0 and ${item.maxMarks}`);

    let result = await ExaminationResult.findOne({ exam: exam._id, student: e.student });
    if (!result) result = new ExaminationResult({ exam: exam._id, student: e.student, marks: [] });
    const existing = result.marks.find((m) => String(m.subject) === String(subject));
    const entry = { subject, marksObtained: marks, maxMarks: item.maxMarks, passMarks: item.passMarks, isAbsent: Boolean(e.isAbsent) };
    if (existing) Object.assign(existing, entry);
    else result.marks.push(entry);
    recompute(result, exam, scale);
    result.enteredBy = req.user._id;
    await result.save();
    saved++;
  }
  if (req.user.role === "admin" && exam.resultsPublished) await audit(req, "correct_marks", "Examination", exam._id, { subject });
  return ok(res, { saved }, `Marks saved for ${saved} students`);
});

export const examResults = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.examId).populate(POPULATE);
  if (!exam) throw ApiError.notFound("Examination not found");
  const filter = { exam: exam._id };
  if (req.user.role === "faculty") {
    const ctx = await getContext(req);
    filter.student = { $in: await Student.find({ section: { $in: ctx.sectionIds } }).distinct("_id") };
  }
  const rows = await ExaminationResult.find(filter)
    .populate({ path: "student", select: "rollNumber studentId section", populate: [{ path: "user", select: "name" }, { path: "section", select: "name" }] })
    .populate("marks.subject", "name code")
    .sort("-percentage");
  const stats = {
    count: rows.length,
    pass: rows.filter((r) => r.status === "pass").length,
    fail: rows.filter((r) => r.status === "fail").length,
    average: rows.length ? Math.round((rows.reduce((s, r) => s + (r.percentage || 0), 0) / rows.length) * 10) / 10 : 0,
  };
  return ok(res, { exam, stats, rows });
});

export const myResults = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const published = await Examination.find({ resultsPublished: true }).distinct("_id");
  const rows = await ExaminationResult.find({ student: ctx.student._id, exam: { $in: published } })
    .populate({ path: "exam", select: "name type startDate academicYear semester", populate: { path: "semester", select: "name number" } })
    .populate("marks.subject", "name code type credits")
    .sort("-createdAt");
  return ok(res, rows);
});
