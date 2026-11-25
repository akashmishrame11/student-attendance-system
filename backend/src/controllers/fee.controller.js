import mongoose from "mongoose";
import { Fee, FeePayment, Student, Semester, Setting } from "../models/index.js";
import { streamReceiptPdf } from "../utils/pdf.js";
import { crud } from "../utils/crud.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, getPagination, dayStart } from "../utils/query.js";
import { getContext } from "../services/access.js";
import { notifyUsers } from "../services/notify.js";
import { audit } from "../services/audit.js";

export const feeStructures = crud(Fee, {
  entity: "Fee structure",
  fields: ["name", "course", "semester", "academicYear", "components", "totalAmount", "dueDate", "finePerDay", "isActive"],
  searchFields: ["name", "academicYear"],
  filterFields: ["course", "semester", "isActive"],
  defaultSort: "-dueDate",
  populate: [{ path: "course", select: "name code" }, { path: "semester", select: "name number academicYear" }],
  scope: async (req) => {
    if (req.user.role !== "student") return {};
    const { student } = await getContext(req);
    return { course: student.course };
  },
  beforeDelete: async (doc) => {
    if (await FeePayment.exists({ fee: doc._id })) throw ApiError.conflict("Payments exist for this fee. Deactivate it instead.");
  },
});

export const validateFee = asyncHandler(async (req, _res, next) => {
  if (req.body.course && req.body.semester) {
    const sem = await Semester.findById(req.body.semester);
    if (!sem || String(sem.course) !== String(req.body.course)) throw ApiError.badRequest("Semester does not belong to the selected course");
    req.body.academicYear = req.body.academicYear || sem.academicYear;
  }
  next();
});

function computeFine(fee, pending, asOf = new Date()) {
  if (pending <= 0 || !fee.finePerDay) return 0;
  const days = Math.floor((dayStart(asOf) - dayStart(fee.dueDate)) / 86400000);
  return days > 0 ? days * fee.finePerDay : 0;
}

/** Fee ledger for one student: every applicable structure with paid / pending / fine. */
export async function studentLedger(studentId) {
  const student = await Student.findById(studentId).populate("user", "name email").populate("course", "name code").populate("semester", "name number");
  if (!student) throw ApiError.notFound("Student not found");
  const paidFeeIds = await FeePayment.find({ student: student._id }).distinct("fee");
  const fees = await Fee.find({
    $or: [{ course: student.course._id, semester: student.semester._id, isActive: true }, { _id: { $in: paidFeeIds } }],
  })
    .populate("semester", "name number academicYear")
    .sort("dueDate");
  const payments = await FeePayment.find({ student: student._id }).populate("fee", "name").sort("-paidAt");

  const records = fees.map((f) => {
    const paid = payments.filter((p) => String(p.fee._id) === String(f._id)).reduce((s, p) => s + p.amount, 0);
    const finePaid = payments.filter((p) => String(p.fee._id) === String(f._id)).reduce((s, p) => s + (p.fine || 0), 0);
    const pending = Math.max(0, f.totalAmount - paid);
    const fine = Math.max(0, computeFine(f, pending) - finePaid);
    return {
      fee: f,
      totalAmount: f.totalAmount,
      paid,
      pending,
      fine,
      dueDate: f.dueDate,
      status: pending === 0 ? "paid" : paid > 0 ? "partial" : new Date() > f.dueDate ? "overdue" : "unpaid",
    };
  });
  const summary = records.reduce(
    (s, r) => ({ total: s.total + r.totalAmount, paid: s.paid + r.paid, pending: s.pending + r.pending, fine: s.fine + r.fine }),
    { total: 0, paid: 0, pending: 0, fine: 0 }
  );
  return { student, records, payments, summary };
}

export const myFees = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  return ok(res, await studentLedger(ctx.student._id));
});

export const studentFees = asyncHandler(async (req, res) => ok(res, await studentLedger(req.params.studentId)));

/** All students' fee status for one structure (admin "student fee records"). */
export const feeStatusList = asyncHandler(async (req, res) => {
  const fee = await Fee.findById(req.params.id).populate("course", "code").populate("semester", "name number");
  if (!fee) throw ApiError.notFound("Fee structure not found");
  const students = await Student.find({ course: fee.course._id, semester: fee.semester._id, status: "active" })
    .populate("user", "name email")
    .populate("section", "name")
    .sort("rollNumber");
  const paidAgg = await FeePayment.aggregate([
    { $match: { fee: fee._id } },
    { $group: { _id: "$student", paid: { $sum: "$amount" }, fine: { $sum: "$fine" } } },
  ]);
  const map = Object.fromEntries(paidAgg.map((p) => [String(p._id), p]));
  let rows = students.map((s) => {
    const paid = map[String(s._id)]?.paid || 0;
    const pending = Math.max(0, fee.totalAmount - paid);
    const fine = Math.max(0, computeFine(fee, pending) - (map[String(s._id)]?.fine || 0));
    return {
      student: { _id: s._id, name: s.user?.name, rollNumber: s.rollNumber, section: s.section?.name },
      paid, pending, fine,
      status: pending === 0 ? "paid" : paid > 0 ? "partial" : new Date() > fee.dueDate ? "overdue" : "unpaid",
    };
  });
  if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
  const summary = {
    expected: fee.totalAmount * students.length,
    collected: paidAgg.reduce((s, p) => s + p.paid, 0),
    students: students.length,
    paidCount: rows.filter((r) => r.status === "paid").length,
  };
  return ok(res, { fee, summary, rows });
});

export const recordPayment = asyncHandler(async (req, res) => {
  const { student: studentId, fee: feeId, amount, method, transactionId, remarks, paidAt } = req.body;
  const [student, fee] = await Promise.all([Student.findById(studentId), Fee.findById(feeId)]);
  if (!student) throw ApiError.badRequest("Student not found");
  if (!fee) throw ApiError.badRequest("Fee structure not found");
  const paid = (await FeePayment.find({ student: student._id, fee: fee._id })).reduce((s, p) => s + p.amount, 0);
  const pending = fee.totalAmount - paid;
  if (pending <= 0) throw ApiError.badRequest("This fee is already fully paid");
  const amt = Number(amount);
  if (!amt || amt <= 0) throw ApiError.badRequest("Amount must be positive");
  if (amt > pending) throw ApiError.badRequest(`Amount exceeds pending balance (₹${pending})`);
  const fine = req.body.includeFine === false ? 0 : computeFine(fee, pending, paidAt || new Date());

  const payment = await FeePayment.create({
    student: student._id, fee: fee._id, amount: amt, fine, method, transactionId, remarks,
    paidAt: paidAt || new Date(), receivedBy: req.user._id,
  });
  await audit(req, "payment", "FeePayment", payment._id, { amount: amt, receiptNo: payment.receiptNo });
  await notifyUsers([student.user], {
    title: "Fee payment received",
    message: `₹${amt}${fine ? ` + ₹${fine} fine` : ""} received for ${fee.name}. Receipt ${payment.receiptNo}`,
    type: "fee",
    link: "/student/fees",
  });
  return created(res, payment, `Payment recorded. Receipt ${payment.receiptNo}`);
});

export const listPayments = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const filter = {};
  if (ctx.role === "student") filter.student = ctx.student._id;
  else {
    if (req.query.student) filter.student = req.query.student;
    if (req.query.fee) filter.fee = req.query.fee;
    if (req.query.method) filter.method = req.query.method;
  }
  if (req.query.from || req.query.to) {
    filter.paidAt = {};
    if (req.query.from) filter.paidAt.$gte = dayStart(req.query.from);
    if (req.query.to) filter.paidAt.$lt = new Date(dayStart(req.query.to).getTime() + 86400000);
  }
  if (req.query.search) filter.receiptNo = new RegExp(String(req.query.search).replace(/[^A-Za-z0-9-]/g, ""), "i");
  const { page, limit, skip } = getPagination(req.query);
  const [total, data, sum] = await Promise.all([
    FeePayment.countDocuments(filter),
    FeePayment.find(filter)
      .sort("-paidAt")
      .skip(skip)
      .limit(limit)
      .populate("fee", "name totalAmount")
      .populate({ path: "student", select: "rollNumber studentId", populate: { path: "user", select: "name" } }),
    FeePayment.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: "$amount" }, fine: { $sum: "$fine" } } }]),
  ]);
  return ok(res, data, "Success", { ...buildMeta(total, page, limit), totalAmount: sum[0]?.amount || 0, totalFine: sum[0]?.fine || 0 });
});

async function loadReceipt(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid id");
  const payment = await FeePayment.findById(req.params.id)
    .populate({ path: "fee", populate: [{ path: "course", select: "name code" }, { path: "semester", select: "name number academicYear" }] })
    .populate({ path: "student", select: "rollNumber studentId section", populate: [{ path: "user", select: "name email phone" }, { path: "section", select: "name" }] })
    .populate("receivedBy", "name");
  if (!payment) throw ApiError.notFound("Payment not found");
  if (req.user.role === "student") {
    const ctx = await getContext(req);
    if (String(payment.student._id) !== String(ctx.student._id)) throw ApiError.notFound("Payment not found");
  }
  return payment;
}

export const getReceipt = asyncHandler(async (req, res) => ok(res, await loadReceipt(req)));

export const getReceiptPdf = asyncHandler(async (req, res) => {
  const payment = await loadReceipt(req);
  const settings = (await Setting.findOne({ key: "global" }).lean()) || {};
  streamReceiptPdf(res, payment.toObject(), settings);
});

export const sendFeeReminders = asyncHandler(async (req, res) => {
  const fee = await Fee.findById(req.params.id);
  if (!fee) throw ApiError.notFound("Fee structure not found");
  const students = await Student.find({ course: fee.course, semester: fee.semester, status: "active" });
  const paidAgg = await FeePayment.aggregate([{ $match: { fee: fee._id } }, { $group: { _id: "$student", paid: { $sum: "$amount" } } }]);
  const map = Object.fromEntries(paidAgg.map((p) => [String(p._id), p.paid]));
  const due = students.filter((s) => (map[String(s._id)] || 0) < fee.totalAmount);
  const n = await notifyUsers(due.map((s) => s.user), {
    title: "Fee payment reminder",
    message: `${fee.name}: ₹${fee.totalAmount} due by ${fee.dueDate.toLocaleDateString("en-IN")}. Please clear pending dues.`,
    type: "fee",
    link: "/student/fees",
  });
  return ok(res, { sent: n }, `Reminder sent to ${n} student(s)`);
});
