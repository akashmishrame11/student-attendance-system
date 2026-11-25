import mongoose from "mongoose";
import { Assignment, AssignmentSubmission, Section, Subject, Student, Faculty } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, escapeRegex, getPagination, getSort } from "../utils/query.js";
import { assertClassAccess, getContext } from "../services/access.js";
import { notifySection, notifyUsers } from "../services/notify.js";
import { toStored, removeFile } from "../services/storage.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));

const POPULATE = [
  { path: "subject", select: "name code" },
  {
    path: "section",
    select: "name course semester",
    populate: [{ path: "course", select: "code name" }, { path: "semester", select: "number name" }],
  },
  { path: "faculty", select: "employeeId", populate: { path: "user", select: "name" } },
];

const bool = (v) => v === true || v === "true" || v === "on";

async function scopeFilter(req) {
  const ctx = await getContext(req);
  if (ctx.role === "faculty") return { faculty: ctx.faculty._id };
  if (ctx.role === "student") {
    if (!ctx.student.section) return { _id: null };
    return { section: ctx.student.section, isPublished: true };
  }
  return {};
}

async function findAccessible(req, id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest("Invalid id");
  const doc = await Assignment.findOne({ _id: id, ...(await scopeFilter(req)) });
  if (!doc) throw ApiError.notFound("Assignment not found");
  return doc;
}

export const listAssignments = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const filter = await scopeFilter(req);
  for (const f of ["section", "subject", "faculty"]) if (req.query[f] && !filter[f]) filter[f] = req.query[f];
  if (req.query.subject) filter.subject = req.query.subject;
  if (req.query.status === "upcoming") filter.dueDate = { $gte: new Date() };
  if (req.query.status === "past") filter.dueDate = { $lt: new Date() };
  if (req.query.search) filter.title = new RegExp(escapeRegex(req.query.search), "i");

  const { page, limit, skip } = getPagination(req.query);
  const [total, docs] = await Promise.all([
    Assignment.countDocuments(filter),
    Assignment.find(filter).sort(getSort(req.query, "-dueDate")).skip(skip).limit(limit).populate(POPULATE).lean(),
  ]);

  const ids = docs.map((d) => d._id);
  let data = docs;
  if (ctx.role === "student") {
    const subs = await AssignmentSubmission.find({ assignment: { $in: ids }, student: ctx.student._id }).lean();
    const map = Object.fromEntries(subs.map((s) => [String(s.assignment), s]));
    data = docs.map((d) => {
      const s = map[String(d._id)];
      return { ...d, submission: s || null, submissionStatus: s ? s.status : new Date(d.dueDate) < new Date() ? "missing" : "pending" };
    });
  } else {
    const [counts, strengths] = await Promise.all([
      AssignmentSubmission.aggregate([
        { $match: { assignment: { $in: ids } } },
        {
          $group: {
            _id: "$assignment",
            submitted: { $sum: 1 },
            evaluated: { $sum: { $cond: [{ $eq: ["$status", "evaluated"] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          },
        },
      ]),
      Student.aggregate([
        { $match: { section: { $in: [...new Set(docs.map((d) => String(d.section?._id)))].map(oid) }, status: "active" } },
        { $group: { _id: "$section", count: { $sum: 1 } } },
      ]),
    ]);
    const cMap = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    const sMap = Object.fromEntries(strengths.map((c) => [String(c._id), c.count]));
    data = docs.map((d) => {
      const c = cMap[String(d._id)] || { submitted: 0, evaluated: 0, late: 0 };
      const strength = sMap[String(d.section?._id)] || 0;
      return { ...d, stats: { ...c, _id: undefined, strength, pending: Math.max(0, strength - c.submitted), toEvaluate: c.submitted - c.evaluated } };
    });
  }
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const getAssignment = asyncHandler(async (req, res) => {
  const doc = await findAccessible(req, req.params.id);
  await doc.populate(POPULATE);
  const out = doc.toObject();
  if (req.user.role === "student") {
    const ctx = await getContext(req);
    out.submission = await AssignmentSubmission.findOne({ assignment: doc._id, student: ctx.student._id });
  }
  return ok(res, out);
});

const FIELDS = ["title", "description", "instructions", "subject", "section", "maxMarks", "dueDate", "allowResubmission", "allowLateSubmission", "isPublished"];

function readBody(body) {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined && body[f] !== "") out[f] = body[f];
  for (const f of ["allowResubmission", "allowLateSubmission", "isPublished"]) if (f in out) out[f] = bool(out[f]);
  return out;
}

export const createAssignment = asyncHandler(async (req, res) => {
  const body = readBody(req.body);
  if (!body.section || !body.subject) throw ApiError.badRequest("Section and subject are required");
  const ctx = await assertClassAccess(req, body.section, body.subject);

  const [section, subject] = await Promise.all([Section.findById(body.section), Subject.findById(body.subject)]);
  if (!section || !subject) throw ApiError.badRequest("Section or subject not found");
  if (String(subject.semester) !== String(section.semester)) throw ApiError.badRequest("Subject is not taught in this section");

  let faculty = ctx.faculty?._id;
  if (req.user.role === "admin") {
    faculty = req.body.faculty || subject.faculty;
    if (!faculty || !(await Faculty.exists({ _id: faculty }))) throw ApiError.badRequest("Select the faculty responsible for this assignment");
  }

  const doc = await Assignment.create({
    ...body,
    faculty,
    course: section.course,
    semester: section.semester,
    attachments: (req.files || []).map((f) => toStored(f, "assignments")),
  });
  if (doc.isPublished) {
    await notifySection(doc.section, {
      title: `New assignment: ${doc.title}`,
      message: `${subject.name} — due ${doc.dueDate.toLocaleDateString("en-IN")}`,
      type: "assignment",
      link: `/student/assignments/${doc._id}`,
    });
  }
  await doc.populate(POPULATE);
  return created(res, doc, "Assignment created");
});

export const updateAssignment = asyncHandler(async (req, res) => {
  const doc = await findAccessible(req, req.params.id);
  if (req.user.role === "student") throw ApiError.forbidden();
  const wasPublished = doc.isPublished;
  const body = readBody(req.body);
  if (body.section || body.subject) {
    await assertClassAccess(req, body.section || doc.section, body.subject || doc.subject);
  }
  Object.assign(doc, body);
  if (req.files?.length) doc.attachments.push(...req.files.map((f) => toStored(f, "assignments")));
  if (req.body.removeAttachments) {
    const remove = [].concat(req.body.removeAttachments);
    for (const url of remove) await removeFile(url);
    doc.attachments = doc.attachments.filter((a) => !remove.includes(a.url));
  }
  await doc.save();
  if (!wasPublished && doc.isPublished) {
    await notifySection(doc.section, { title: `New assignment: ${doc.title}`, message: `Due ${doc.dueDate.toLocaleDateString("en-IN")}`, type: "assignment", link: `/student/assignments/${doc._id}` });
  }
  await doc.populate(POPULATE);
  return ok(res, doc, "Assignment updated");
});

export const deleteAssignment = asyncHandler(async (req, res) => {
  const doc = await findAccessible(req, req.params.id);
  if (req.user.role === "student") throw ApiError.forbidden();
  const subs = await AssignmentSubmission.find({ assignment: doc._id });
  for (const s of subs) for (const f of s.files) await removeFile(f.url);
  for (const a of doc.attachments) await removeFile(a.url);
  await AssignmentSubmission.deleteMany({ assignment: doc._id });
  await doc.deleteOne();
  return ok(res, { _id: doc._id }, "Assignment deleted");
});

/** All students of the section with their submission state (incl. pending). */
export const assignmentSubmissions = asyncHandler(async (req, res) => {
  const doc = await findAccessible(req, req.params.id);
  if (req.user.role === "student") throw ApiError.forbidden();
  const [students, subs] = await Promise.all([
    Student.find({ section: doc.section, status: "active" }).populate("user", "name email").sort("rollNumber"),
    AssignmentSubmission.find({ assignment: doc._id }),
  ]);
  const map = Object.fromEntries(subs.map((s) => [String(s.student), s]));
  const overdue = new Date() > doc.dueDate;
  const rows = students.map((st) => {
    const sub = map[String(st._id)];
    return {
      student: { _id: st._id, name: st.user?.name, email: st.user?.email, rollNumber: st.rollNumber },
      submission: sub || null,
      status: sub ? sub.status : overdue ? "missing" : "pending",
    };
  });
  let filtered = rows;
  if (req.query.status) filtered = rows.filter((r) => r.status === req.query.status);
  return ok(res, { assignment: await doc.populate(POPULATE), rows: filtered });
});

/* ------------------------------------------------------------ submissions */
export const submitAssignment = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const assignment = await findAccessible(req, req.params.id);
  const textAnswer = String(req.body.textAnswer || "").trim();
  const files = (req.files || []).map((f) => toStored(f, "submissions"));
  if (!textAnswer && !files.length) throw ApiError.badRequest("Add a text answer or upload at least one file");

  const now = new Date();
  const isLate = now > assignment.dueDate;
  if (isLate && !assignment.allowLateSubmission) {
    for (const f of files) await removeFile(f.url);
    throw ApiError.badRequest("The deadline has passed and late submissions are not allowed");
  }

  let sub = await AssignmentSubmission.findOne({ assignment: assignment._id, student: ctx.student._id });
  if (sub) {
    const canResubmit = sub.status === "resubmission_required" || (assignment.allowResubmission && sub.status !== "evaluated");
    if (!canResubmit) {
      for (const f of files) await removeFile(f.url);
      throw ApiError.badRequest(sub.status === "evaluated" ? "This submission has already been evaluated" : "Resubmission is not allowed for this assignment");
    }
    sub.history.push({ textAnswer: sub.textAnswer, files: sub.files, submittedAt: sub.submittedAt, marks: sub.marks, feedback: sub.feedback });
    Object.assign(sub, { textAnswer, files, submittedAt: now, status: isLate ? "late" : "submitted", attempts: sub.attempts + 1, marks: undefined });
    await sub.save();
  } else {
    sub = await AssignmentSubmission.create({
      assignment: assignment._id, student: ctx.student._id, textAnswer, files, submittedAt: now, status: isLate ? "late" : "submitted",
    });
  }
  const faculty = await Faculty.findById(assignment.faculty);
  if (faculty) {
    await notifyUsers([faculty.user], {
      title: "New submission",
      message: `${req.user.name} submitted "${assignment.title}"${isLate ? " (late)" : ""}`,
      type: "assignment",
      link: `/faculty/assignments/${assignment._id}`,
    });
  }
  return created(res, sub, isLate ? "Submitted (late)" : "Assignment submitted successfully");
});

export const mySubmissions = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const data = await AssignmentSubmission.find({ student: ctx.student._id })
    .sort("-submittedAt")
    .populate({ path: "assignment", select: "title dueDate maxMarks subject", populate: { path: "subject", select: "name code" } });
  return ok(res, data);
});

export const listSubmissions = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignment) filter.assignment = req.query.assignment;
  if (ctx.role === "faculty") {
    const mine = await Assignment.find({ faculty: ctx.faculty._id }).distinct("_id");
    filter.assignment = req.query.assignment ? { $in: mine.filter((m) => String(m) === String(req.query.assignment)) } : { $in: mine };
  }
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    AssignmentSubmission.countDocuments(filter),
    AssignmentSubmission.find(filter)
      .sort("-submittedAt")
      .skip(skip)
      .limit(limit)
      .populate({ path: "assignment", select: "title dueDate maxMarks subject section", populate: [{ path: "subject", select: "code name" }, { path: "section", select: "name" }] })
      .populate({ path: "student", select: "rollNumber", populate: { path: "user", select: "name" } }),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const evaluateSubmission = asyncHandler(async (req, res) => {
  const sub = await AssignmentSubmission.findById(req.params.id);
  if (!sub) throw ApiError.notFound("Submission not found");
  const assignment = await Assignment.findById(sub.assignment);
  const ctx = await getContext(req);
  if (ctx.role === "faculty" && String(assignment.faculty) !== String(ctx.faculty._id)) throw ApiError.forbidden();

  const { action = "evaluate", marks, feedback } = req.body;
  if (action === "resubmit") {
    sub.status = "resubmission_required";
    sub.feedback = feedback;
  } else {
    const m = Number(marks);
    if (marks === undefined || marks === "" || Number.isNaN(m)) throw ApiError.badRequest("Marks are required");
    if (m < 0 || m > assignment.maxMarks) throw ApiError.badRequest(`Marks must be between 0 and ${assignment.maxMarks}`);
    sub.marks = m;
    sub.feedback = feedback;
    sub.status = "evaluated";
  }
  sub.evaluatedBy = req.user._id;
  sub.evaluatedAt = new Date();
  await sub.save();

  const student = await Student.findById(sub.student);
  await notifyUsers([student?.user], {
    title: action === "resubmit" ? "Resubmission requested" : "Assignment evaluated",
    message: action === "resubmit" ? `Please resubmit "${assignment.title}". ${feedback || ""}` : `"${assignment.title}": ${sub.marks}/${assignment.maxMarks}`,
    type: "assignment",
    link: `/student/assignments/${assignment._id}`,
  });
  return ok(res, sub, action === "resubmit" ? "Resubmission requested" : "Evaluation saved");
});
