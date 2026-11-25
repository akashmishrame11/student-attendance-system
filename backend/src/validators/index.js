import { body, param } from "express-validator";
import { validate } from "../middleware/validate.js";

const objectId = (field, label = field) => body(field).isMongoId().withMessage(`Select a valid ${label}`);
const password = (field) =>
  body(field)
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/[A-Za-z]/).withMessage("Password must contain a letter")
    .matches(/\d/).withMessage("Password must contain a number");

export const loginRules = validate([
  body("identifier").trim().notEmpty().withMessage("Email or username is required").isLength({ max: 120 }),
  body("password").notEmpty().withMessage("Password is required").isLength({ max: 128 }),
]);

export const forgotRules = validate([body("email").trim().isEmail().withMessage("Enter a valid email address")]);
export const resetRules = validate([param("token").isHexadecimal().isLength({ min: 64, max: 64 }).withMessage("Invalid reset link"), password("password")]);
export const changePasswordRules = validate([body("currentPassword").notEmpty().withMessage("Current password is required"), password("newPassword")]);
export const adminPasswordRules = validate([password("password")]);
export const profileRules = validate([
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("phone").optional({ values: "falsy" }).trim().matches(/^[0-9+\-\s]{7,15}$/).withMessage("Enter a valid phone number"),
]);

export const createAdminRules = validate([
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("Enter a valid email"),
  password("password"),
]);

const personRules = (isCreate) => [
  ...(isCreate
    ? [body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"), body("email").trim().isEmail().withMessage("Enter a valid email")]
    : [body("name").optional().trim().isLength({ min: 2, max: 100 }), body("email").optional().trim().isEmail().withMessage("Enter a valid email")]),
  body("phone").optional({ values: "falsy" }).trim().matches(/^[0-9+\-\s]{7,15}$/).withMessage("Enter a valid phone number"),
  body("password").optional({ values: "falsy" }).isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
];

export const studentRules = (isCreate) =>
  validate([
    ...personRules(isCreate),
    ...(isCreate ? [objectId("department", "department"), objectId("course", "course"), objectId("semester", "semester")] : []),
    body("section").optional({ values: "falsy" }).isMongoId().withMessage("Select a valid section"),
    body("gender").optional({ values: "falsy" }).isIn(["male", "female", "other"]),
    body("dateOfBirth").optional({ values: "falsy" }).isISO8601().withMessage("Invalid date of birth"),
    body("guardianPhone").optional({ values: "falsy" }).matches(/^[0-9+\-\s]{7,15}$/).withMessage("Enter a valid guardian phone"),
  ]);

export const facultyRules = (isCreate) =>
  validate([...personRules(isCreate), ...(isCreate ? [objectId("department", "department")] : [])]);

export const attendanceRules = validate([
  objectId("section", "section"),
  objectId("subject", "subject"),
  body("date").isISO8601().withMessage("Invalid date"),
  body("records").isArray({ min: 1 }).withMessage("Attendance records are required"),
]);

export const timetableRules = validate([
  objectId("section", "section"), objectId("subject", "subject"), objectId("faculty", "faculty"),
  body("room").trim().notEmpty().withMessage("Room is required"),
  body("day").isIn(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]).withMessage("Select a day"),
  body("startTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("Start time must be HH:mm"),
  body("endTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("End time must be HH:mm"),
]);

export const assignmentRules = (isCreate) =>
  validate([
    ...(isCreate
      ? [body("title").trim().isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"), body("description").trim().notEmpty().withMessage("Description is required"), objectId("section", "section"), objectId("subject", "subject"), body("dueDate").isISO8601().withMessage("Valid deadline is required")]
      : [body("title").optional().trim().isLength({ min: 3, max: 200 }), body("dueDate").optional().isISO8601()]),
    body("maxMarks").optional().isInt({ min: 1, max: 1000 }).withMessage("Max marks must be 1-1000"),
  ]);

export const examRules = validate([
  body("name").trim().notEmpty().withMessage("Exam name is required"),
  body("type").isIn(["internal", "midterm", "practical", "final"]).withMessage("Select an exam type"),
  objectId("course", "course"), objectId("semester", "semester"),
  body("schedule").optional().isArray(),
  body("schedule.*.subject").optional().isMongoId().withMessage("Invalid subject in schedule"),
  body("schedule.*.date").optional().isISO8601().withMessage("Invalid date in schedule"),
  body("schedule.*.maxMarks").optional().isInt({ min: 1 }),
]);

export const paymentRules = validate([
  objectId("student", "student"), objectId("fee", "fee"),
  body("amount").isFloat({ gt: 0 }).withMessage("Amount must be positive"),
  body("method").optional().isIn(["cash", "card", "upi", "bank_transfer", "cheque", "online"]),
]);

export const noticeRules = validate([
  body("title").trim().isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
  body("content").trim().notEmpty().withMessage("Content is required"),
  body("expiryDate").optional({ values: "falsy" }).isISO8601(),
]);

export const leaveRules = validate([
  body("fromDate").isISO8601().withMessage("From date is required"),
  body("toDate").isISO8601().withMessage("To date is required"),
  body("reason").trim().isLength({ min: 5, max: 1000 }).withMessage("Reason must be 5-1000 characters"),
]);

export const complaintRules = validate([
  body("category").notEmpty().withMessage("Category is required"),
  body("subject").trim().isLength({ min: 3, max: 200 }).withMessage("Subject must be 3-200 characters"),
  body("description").trim().isLength({ min: 10, max: 3000 }).withMessage("Description must be 10-3000 characters"),
]);

export const feedbackRules = validate([
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be 1-5"),
  body("message").trim().isLength({ min: 3, max: 2000 }).withMessage("Message is required"),
]);

export const issueRules = validate([objectId("book", "book"), objectId("student", "student")]);
