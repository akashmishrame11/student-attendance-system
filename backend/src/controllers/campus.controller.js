import mongoose from "mongoose";
import { LeaveRequest, Book, BookIssue, Complaint, Feedback, Student, Setting, User } from "../models/index.js";
import { crud } from "../utils/crud.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, dayStart, escapeRegex, getPagination } from "../utils/query.js";
import { getContext } from "../services/access.js";
import { notifyUsers } from "../services/notify.js";
import { toStored } from "../services/storage.js";
import { audit } from "../services/audit.js";

const applicantPopulate = { path: "applicant", select: "name email role avatar" };

/* ----------------------------------------------------------------- leaves */
export const applyLeave = asyncHandler(async (req, res) => {
  const { leaveType, fromDate, toDate, reason } = req.body;
  const from = dayStart(fromDate);
  const to = dayStart(toDate);
  if (!from || !to) throw ApiError.badRequest("Valid from and to dates are required");
  const overlap = await LeaveRequest.exists({
    applicant: req.user._id, status: { $ne: "rejected" }, fromDate: { $lte: to }, toDate: { $gte: from },
  });
  if (overlap) throw ApiError.conflict("You already have a leave request overlapping these dates");
  const leave = await LeaveRequest.create({
    applicant: req.user._id,
    role: req.user.role,
    leaveType, fromDate: from, toDate: to, reason,
    document: req.file ? toStored(req.file, "leaves") : undefined,
  });
  return created(res, leave, "Leave application submitted");
});

async function leaveScope(req) {
  const ctx = await getContext(req);
  if (ctx.role === "admin") return {};
  if (ctx.role === "faculty") {
    if (req.query.mine === "true") return { applicant: req.user._id };
    // Faculty can review leave of students in their assigned sections.
    const users = await Student.find({ section: { $in: ctx.sectionIds } }).distinct("user");
    return { applicant: { $in: users }, role: "student" };
  }
  return { applicant: req.user._id };
}

export const listLeaves = asyncHandler(async (req, res) => {
  const filter = await leaveScope(req);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.role && req.user.role === "admin") filter.role = req.query.role;
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    LeaveRequest.countDocuments(filter),
    LeaveRequest.find(filter).sort("-createdAt").skip(skip).limit(limit).populate(applicantPopulate).populate("reviewedBy", "name role"),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const reviewLeave = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;
  if (!["approved", "rejected"].includes(status)) throw ApiError.badRequest("Status must be approved or rejected");
  const leave = await LeaveRequest.findOne({ _id: req.params.id, ...(await leaveScope(req)) });
  if (!leave) throw ApiError.notFound("Leave request not found");
  if (String(leave.applicant) === String(req.user._id)) throw ApiError.forbidden("You cannot review your own leave");
  if (leave.role === "faculty" && req.user.role !== "admin") throw ApiError.forbidden("Only admins can review faculty leave");
  Object.assign(leave, { status, remarks, reviewedBy: req.user._id, reviewedAt: new Date() });
  await leave.save();
  await notifyUsers([leave.applicant], {
    title: `Leave ${status}`,
    message: `Your leave from ${leave.fromDate.toLocaleDateString("en-IN")} to ${leave.toDate.toLocaleDateString("en-IN")} was ${status}.${remarks ? ` Remarks: ${remarks}` : ""}`,
    type: "leave",
    link: `/${leave.role}/leaves`,
  });
  return ok(res, leave, `Leave ${status}`);
});

export const cancelLeave = asyncHandler(async (req, res) => {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, applicant: req.user._id });
  if (!leave) throw ApiError.notFound("Leave request not found");
  if (leave.status !== "pending") throw ApiError.badRequest("Only pending requests can be cancelled");
  await leave.deleteOne();
  return ok(res, { _id: leave._id }, "Leave request cancelled");
});

/* ---------------------------------------------------------------- library */
export const books = crud(Book, {
  entity: "Book",
  fields: ["title", "author", "isbn", "category", "publisher", "edition", "shelf", "totalCopies", "isActive"],
  searchFields: ["title", "author", "isbn", "category"],
  filterFields: ["category", "isActive"],
  defaultSort: "title",
  beforeDelete: async (doc) => {
    if (await BookIssue.exists({ book: doc._id, status: "issued" })) throw ApiError.conflict("Copies of this book are currently issued");
  },
});

/** Keep availableCopies consistent when totalCopies changes. */
export const adjustCopies = asyncHandler(async (req, _res, next) => {
  if (req.body.totalCopies !== undefined && req.params.id) {
    const book = await Book.findById(req.params.id);
    if (book) {
      const issued = book.totalCopies - book.availableCopies;
      const total = Number(req.body.totalCopies);
      if (total < issued) throw ApiError.badRequest(`${issued} copies are issued; total cannot be less than that`);
      book.availableCopies = total - issued;
      await book.save();
    }
  }
  next();
});

export const bookCategories = asyncHandler(async (_req, res) => ok(res, (await Book.distinct("category")).sort()));

async function librarySettings() {
  const s = await Setting.findOne({ key: "global" }).lean();
  return { finePerDay: s?.libraryFinePerDay ?? 5, loanDays: s?.libraryLoanDays ?? 14 };
}

const issuePopulate = [
  { path: "book", select: "title author isbn category" },
  { path: "student", select: "rollNumber studentId", populate: { path: "user", select: "name" } },
];

function liveFine(issue, finePerDay) {
  if (issue.status !== "issued") return issue.fine;
  const days = Math.floor((dayStart(new Date()) - dayStart(issue.dueDate)) / 86400000);
  return days > 0 ? days * finePerDay : 0;
}

export const issueBook = asyncHandler(async (req, res) => {
  const { book: bookId, student: studentId, dueDate } = req.body;
  const student = await Student.findById(studentId);
  if (!student || student.status !== "active") throw ApiError.badRequest("Active student not found");
  const active = await BookIssue.countDocuments({ student: student._id, status: "issued" });
  if (active >= 5) throw ApiError.badRequest("Student already has 5 books issued");
  if (await BookIssue.exists({ student: student._id, book: bookId, status: "issued" })) throw ApiError.conflict("Student already has a copy of this book");

  const book = await Book.findOneAndUpdate({ _id: bookId, availableCopies: { $gt: 0 }, isActive: true }, { $inc: { availableCopies: -1 } }, { new: true });
  if (!book) throw ApiError.badRequest("No copies available for this book");
  const { loanDays } = await librarySettings();
  const issue = await BookIssue.create({
    book: book._id, student: student._id, issuedBy: req.user._id,
    dueDate: dueDate ? dayStart(dueDate) : new Date(Date.now() + loanDays * 86400000),
  });
  await notifyUsers([student.user], { title: "Book issued", message: `"${book.title}" due ${issue.dueDate.toLocaleDateString("en-IN")}`, type: "general", link: "/student/library" });
  await issue.populate(issuePopulate);
  return created(res, issue, "Book issued");
});

export const returnBook = asyncHandler(async (req, res) => {
  const issue = await BookIssue.findById(req.params.id);
  if (!issue) throw ApiError.notFound("Issue record not found");
  if (issue.status !== "issued") throw ApiError.badRequest("Book already returned");
  const { finePerDay } = await librarySettings();
  issue.fine = liveFine(issue, finePerDay);
  issue.returnDate = new Date();
  issue.status = req.body.lost ? "lost" : "returned";
  issue.finePaid = Boolean(req.body.finePaid);
  await issue.save();
  if (!req.body.lost) await Book.updateOne({ _id: issue.book }, { $inc: { availableCopies: 1 } });
  await issue.populate(issuePopulate);
  return ok(res, issue, issue.fine ? `Returned with fine ₹${issue.fine}` : "Book returned");
});

export const listIssues = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const filter = {};
  if (ctx.role === "student") filter.student = ctx.student._id;
  else if (req.query.student) filter.student = req.query.student;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.overdue === "true") Object.assign(filter, { status: "issued", dueDate: { $lt: dayStart(new Date()) } });
  const { page, limit, skip } = getPagination(req.query);
  const { finePerDay } = await librarySettings();
  const [total, data] = await Promise.all([
    BookIssue.countDocuments(filter),
    BookIssue.find(filter).sort("-issueDate").skip(skip).limit(limit).populate(issuePopulate),
  ]);
  const rows = data.map((d) => ({ ...d.toObject(), currentFine: liveFine(d, finePerDay), isOverdue: d.status === "issued" && d.dueDate < dayStart(new Date()) }));
  return ok(res, rows, "Success", buildMeta(total, page, limit));
});

export const libraryStats = asyncHandler(async (_req, res) => {
  const [titles, copies, issued, overdue, fines, byCategory] = await Promise.all([
    Book.countDocuments({ isActive: true }),
    Book.aggregate([{ $group: { _id: null, total: { $sum: "$totalCopies" }, available: { $sum: "$availableCopies" } } }]),
    BookIssue.countDocuments({ status: "issued" }),
    BookIssue.countDocuments({ status: "issued", dueDate: { $lt: dayStart(new Date()) } }),
    BookIssue.aggregate([{ $group: { _id: null, total: { $sum: "$fine" } } }]),
    Book.aggregate([{ $group: { _id: "$category", titles: { $sum: 1 }, copies: { $sum: "$totalCopies" } } }, { $sort: { titles: -1 } }]),
  ]);
  return ok(res, {
    titles, issued, overdue,
    totalCopies: copies[0]?.total || 0,
    availableCopies: copies[0]?.available || 0,
    finesCollected: fines[0]?.total || 0,
    byCategory: byCategory.map((c) => ({ category: c._id, titles: c.titles, copies: c.copies })),
  });
});

/* ------------------------------------------------------------- complaints */
export const createComplaint = asyncHandler(async (req, res) => {
  const { category, subject, description, priority } = req.body;
  const c = await Complaint.create({ user: req.user._id, category, subject, description, priority });
  const admins = await User.find({ role: "admin", isActive: true }).distinct("_id");
  await notifyUsers(admins, { title: "New complaint", message: `${req.user.name}: ${subject}`, type: "general", link: "/admin/complaints" });
  return created(res, c, "Complaint submitted");
});

export const listComplaints = asyncHandler(async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { $or: [{ user: req.user._id }, { assignedTo: req.user._id }] };
  for (const f of ["status", "category", "priority"]) if (req.query[f]) filter[f] = req.query[f];
  if (req.query.search) filter.subject = new RegExp(escapeRegex(req.query.search), "i");
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    Complaint.countDocuments(filter),
    Complaint.find(filter).sort("-createdAt").skip(skip).limit(limit).populate("user", "name email role").populate("assignedTo", "name role"),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const updateComplaint = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid id");
  const filter = { _id: req.params.id };
  if (req.user.role !== "admin") filter.assignedTo = req.user._id;
  const c = await Complaint.findOne(filter);
  if (!c) throw ApiError.notFound("Complaint not found");
  const { status, response, assignedTo, priority, category } = req.body;
  if (status) c.status = status;
  if (priority) c.priority = priority;
  if (category && req.user.role === "admin") c.category = category;
  if (assignedTo !== undefined && req.user.role === "admin") c.assignedTo = assignedTo || undefined;
  if (response !== undefined && response !== c.response) {
    c.response = response;
    c.respondedAt = new Date();
  }
  if (status === "resolved") c.resolvedAt = new Date();
  await c.save();
  await notifyUsers([c.user], { title: "Complaint updated", message: `"${c.subject}" is now ${c.status.replace("_", " ")}`, type: "general", link: `/${(await User.findById(c.user))?.role}/complaints` });
  if (req.user.role === "admin") await audit(req, "update", "Complaint", c._id, { status: c.status });
  await c.populate([{ path: "user", select: "name email role" }, { path: "assignedTo", select: "name role" }]);
  return ok(res, c, "Complaint updated");
});

/* --------------------------------------------------------------- feedback */
export const createFeedback = asyncHandler(async (req, res) => {
  const { category, subject, rating, message, isAnonymous } = req.body;
  const f = await Feedback.create({ user: req.user._id, category, subject: subject || undefined, rating, message, isAnonymous: Boolean(isAnonymous) });
  return created(res, f, "Thank you for your feedback");
});

export const listFeedback = asyncHandler(async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user._id };
  if (req.query.category) filter.category = req.query.category;
  const { page, limit, skip } = getPagination(req.query);
  const [total, docs, avg] = await Promise.all([
    Feedback.countDocuments(filter),
    Feedback.find(filter).sort("-createdAt").skip(skip).limit(limit).populate("user", "name role").populate("subject", "name code"),
    Feedback.aggregate([{ $match: filter }, { $group: { _id: null, avg: { $avg: "$rating" } } }]),
  ]);
  const data = docs.map((d) => {
    const o = d.toObject();
    if (o.isAnonymous && req.user.role === "admin") o.user = { name: "Anonymous", role: o.user?.role };
    return o;
  });
  return ok(res, data, "Success", { ...buildMeta(total, page, limit), averageRating: Math.round((avg[0]?.avg || 0) * 10) / 10 });
});
