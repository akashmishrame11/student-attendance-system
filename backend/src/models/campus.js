import mongoose from "mongoose";
import { fileSchema } from "./people.js";

const { Schema, model, Types } = mongoose;

/* ------------------------------------------------- fees (fee structures) */
const feeSchema = new Schema(
  {
    name: { type: String, required: [true, "Fee name is required"], trim: true },
    course: { type: Types.ObjectId, ref: "Course", required: [true, "Course is required"] },
    semester: { type: Types.ObjectId, ref: "Semester", required: [true, "Semester is required"] },
    academicYear: String,
    components: [{ _id: false, name: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } }],
    totalAmount: { type: Number, min: 0 },
    dueDate: { type: Date, required: [true, "Due date is required"] },
    finePerDay: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "fees" }
);
feeSchema.pre("validate", function computeTotal() {
  if (this.components?.length) this.totalAmount = this.components.reduce((s, c) => s + (c.amount || 0), 0);
  if (this.totalAmount === undefined) this.invalidate("totalAmount", "Total amount or components required");
});
export const Fee = model("Fee", feeSchema);

/* ------------------------------------------------------------ feePayments */
const feePaymentSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "Student", required: true },
    fee: { type: Types.ObjectId, ref: "Fee", required: true },
    amount: { type: Number, required: [true, "Amount is required"], min: [1, "Amount must be positive"] },
    fine: { type: Number, default: 0, min: 0 },
    method: { type: String, enum: ["cash", "card", "upi", "bank_transfer", "cheque", "online"], default: "cash" },
    transactionId: String,
    receiptNo: { type: String, unique: true },
    paidAt: { type: Date, default: Date.now },
    remarks: String,
    receivedBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "feePayments" }
);
feePaymentSchema.pre("validate", function makeReceipt() {
  if (!this.receiptNo) {
    this.receiptNo = `RCPT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e4)
      .toString()
      .padStart(4, "0")}`;
  }
});
export const FeePayment = model("FeePayment", feePaymentSchema);

/* ---------------------------------------------------------------- notices */
const audienceSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["all", "students", "faculty", "department", "course", "semester", "section"],
      default: "all",
    },
    department: { type: Types.ObjectId, ref: "Department" },
    course: { type: Types.ObjectId, ref: "Course" },
    semester: { type: Types.ObjectId, ref: "Semester" },
    section: { type: Types.ObjectId, ref: "Section" },
  },
  { _id: false }
);
export { audienceSchema };

const noticeSchema = new Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 200 },
    content: { type: String, required: [true, "Content is required"] },
    category: { type: String, enum: ["general", "exam", "academic", "event", "holiday", "fee", "urgent"], default: "general" },
    attachments: [fileSchema],
    publishDate: { type: Date, default: Date.now },
    expiryDate: Date,
    audience: { type: audienceSchema, default: () => ({ type: "all" }) },
    subject: { type: Types.ObjectId, ref: "Subject" },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "notices" }
);
export const Notice = model("Notice", noticeSchema);

/* ---------------------------------------------------------- notifications */
const notificationSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["assignment", "deadline", "attendance", "exam", "notice", "fee", "leave", "result", "general"],
      default: "general",
    },
    link: String,
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "notifications" }
);
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
export const Notification = model("Notification", notificationSchema);

/* ---------------------------------------------------------- leaveRequests */
const leaveSchema = new Schema(
  {
    applicant: { type: Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["student", "faculty"], required: true },
    leaveType: { type: String, enum: ["sick", "casual", "medical", "personal", "academic", "other"], default: "casual" },
    fromDate: { type: Date, required: [true, "From date is required"] },
    toDate: { type: Date, required: [true, "To date is required"] },
    reason: { type: String, required: [true, "Reason is required"], maxlength: 1000 },
    document: fileSchema,
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedBy: { type: Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    remarks: String,
  },
  { timestamps: true, collection: "leaveRequests" }
);
leaveSchema.pre("validate", function checkDates() {
  if (this.fromDate && this.toDate && this.toDate < this.fromDate) this.invalidate("toDate", "To date must be after from date");
});
export const LeaveRequest = model("LeaveRequest", leaveSchema);

/* ------------------------------------------------------------------ books */
const bookSchema = new Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true },
    author: { type: String, required: [true, "Author is required"], trim: true },
    isbn: { type: String, trim: true, unique: true, sparse: true },
    category: { type: String, required: [true, "Category is required"], trim: true },
    publisher: String,
    edition: String,
    shelf: String,
    totalCopies: { type: Number, required: true, min: 0, default: 1 },
    availableCopies: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "books" }
);
bookSchema.pre("validate", function defaultAvailable() {
  if (this.isNew && this.availableCopies === undefined) this.availableCopies = this.totalCopies;
});
export const Book = model("Book", bookSchema);

/* ------------------------------------------------------------- bookIssues */
const bookIssueSchema = new Schema(
  {
    book: { type: Types.ObjectId, ref: "Book", required: true },
    student: { type: Types.ObjectId, ref: "Student", required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    returnDate: Date,
    fine: { type: Number, default: 0 },
    finePaid: { type: Boolean, default: false },
    status: { type: String, enum: ["issued", "returned", "lost"], default: "issued", index: true },
    issuedBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "bookIssues" }
);
export const BookIssue = model("BookIssue", bookIssueSchema);

/* ------------------------------------------------------------- complaints */
const complaintSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    category: {
      type: String,
      enum: ["academic", "attendance_correction", "infrastructure", "hostel", "transport", "library", "fees", "profile_correction", "other"],
      required: true,
    },
    subject: { type: String, required: [true, "Subject is required"], trim: true, maxlength: 200 },
    description: { type: String, required: [true, "Description is required"], maxlength: 3000 },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open", index: true },
    assignedTo: { type: Types.ObjectId, ref: "User" },
    response: String,
    respondedAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true, collection: "complaints" }
);
export const Complaint = model("Complaint", complaintSchema);

/* --------------------------------------------------------------- feedback */
const feedbackSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    category: { type: String, enum: ["teaching", "facilities", "curriculum", "administration", "app", "other"], default: "other" },
    subject: { type: Types.ObjectId, ref: "Subject" },
    rating: { type: Number, min: 1, max: 5, required: [true, "Rating is required"] },
    message: { type: String, required: [true, "Message is required"], maxlength: 2000 },
    isAnonymous: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "feedback" }
);
export const Feedback = model("Feedback", feedbackSchema);

/* -------------------------------------------------------------- auditLogs */
const auditLogSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: Types.ObjectId,
    details: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true, collection: "auditLogs" }
);
auditLogSchema.index({ createdAt: -1 });
export const AuditLog = model("AuditLog", auditLogSchema);

/* --------------------------------------------------------------- settings */
const settingSchema = new Schema(
  {
    key: { type: String, default: "global", unique: true },
    collegeName: { type: String, default: "Attendify College of Engineering" },
    collegeLogo: String,
    address: String,
    contactEmail: String,
    contactPhone: String,
    academicYear: { type: String, default: "2026-2027" },
    semesterSystem: { type: String, enum: ["semester", "trimester", "annual"], default: "semester" },
    minAttendancePercent: { type: Number, default: 75, min: 0, max: 100 },
    attendanceEditWindowDays: { type: Number, default: 3, min: 0 },
    allowLateSubmission: { type: Boolean, default: true },
    maxUploadSizeMb: { type: Number, default: 10 },
    libraryFinePerDay: { type: Number, default: 5, min: 0 },
    libraryLoanDays: { type: Number, default: 14, min: 1 },
    grading: [{ _id: false, grade: String, min: Number, point: Number }],
    timeSlots: [{ _id: false, label: String, startTime: String, endTime: String }],
    notifications: {
      email: { type: Boolean, default: false },
      assignment: { type: Boolean, default: true },
      attendance: { type: Boolean, default: true },
      fee: { type: Boolean, default: true },
    },
  },
  { timestamps: true, collection: "settings" }
);
export const Setting = model("Setting", settingSchema);
