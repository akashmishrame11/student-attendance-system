import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { uploader } from "../middleware/upload.js";
import * as V from "../validators/index.js";

import * as auth from "../controllers/auth.controller.js";
import * as users from "../controllers/user.controller.js";
import * as st from "../controllers/student.controller.js";
import * as fac from "../controllers/faculty.controller.js";
import * as ac from "../controllers/academic.controller.js";
import * as att from "../controllers/attendance.controller.js";
import * as asg from "../controllers/assignment.controller.js";
import * as ex from "../controllers/exam.controller.js";
import * as fee from "../controllers/fee.controller.js";
import * as com from "../controllers/communication.controller.js";
import * as cam from "../controllers/campus.controller.js";
import * as dash from "../controllers/dashboard.controller.js";
import * as rep from "../controllers/report.controller.js";
import * as set from "../controllers/setting.controller.js";

const ADMIN = authorize("admin");
const STAFF = authorize("admin", "faculty");
const avatar = uploader("avatars", "image").single("avatar");
const docs = (folder) => uploader(folder, "document").array("files", 5);

/** Mount standard CRUD from the factory with admin-only writes. */
function crudRoutes(r, path, c, { read = [], writeGuard = ADMIN, pre = [] } = {}) {
  r.get(path, ...read, c.list);
  r.get(`${path}/:id`, ...read, c.getOne);
  r.post(path, writeGuard, ...pre, c.create);
  r.put(`${path}/:id`, writeGuard, ...pre, c.update);
  r.delete(`${path}/:id`, writeGuard, c.remove);
}

const r = Router();

/* --------------------------------------------------------------- auth */
r.post("/auth/login", loginLimiter, V.loginRules, auth.login);
r.post("/auth/forgot-password", loginLimiter, V.forgotRules, auth.forgotPassword);
r.post("/auth/reset-password/:token", loginLimiter, V.resetRules, auth.resetPassword);
r.get("/settings/public", set.publicSettings);
r.get("/stats/public", dash.publicStats);

r.use(protect); // ---- everything below requires a valid token ----

r.get("/auth/me", auth.me);
r.post("/auth/logout", auth.logout);
r.patch("/auth/change-password", V.changePasswordRules, auth.changePassword);
r.patch("/auth/profile", avatar, V.profileRules, auth.updateProfile);

/* -------------------------------------------------------------- users */
r.get("/users", ADMIN, users.listUsers);
r.post("/users/admins", ADMIN, V.createAdminRules, users.createAdmin);
r.patch("/users/:id/status", ADMIN, users.setUserStatus);
r.patch("/users/:id/password", ADMIN, V.adminPasswordRules, users.adminResetPassword);
r.get("/audit-logs", ADMIN, users.listAuditLogs);

/* ---------------------------------------------------------- dashboard */
r.get("/dashboard/admin", ADMIN, dash.adminDashboard);
r.get("/dashboard/faculty", authorize("faculty"), dash.facultyDashboard);
r.get("/dashboard/student", authorize("student"), dash.studentDashboard);

/* ----------------------------------------------------------- students */
r.get("/students/me", authorize("student"), st.getMyStudentProfile);
r.get("/students", STAFF, st.listStudents);
r.post("/students/import", ADMIN, uploader("imports", "sheet").single("file"), st.importStudents);
r.post("/students/promote", ADMIN, st.promoteStudents);
r.get("/students/:id", st.getStudent);
r.post("/students", ADMIN, avatar, V.studentRules(true), st.createStudent);
r.put("/students/:id", ADMIN, avatar, V.studentRules(false), st.updateStudent);
r.patch("/students/:id/status", ADMIN, st.setStudentStatus);
r.delete("/students/:id", ADMIN, st.deleteStudent);
r.post("/students/:id/documents", ADMIN, docs("documents"), st.uploadDocuments);
r.delete("/students/:id/documents/:index", ADMIN, st.deleteDocument);

/* ------------------------------------------------------------ faculty */
r.get("/faculty/me", authorize("faculty"), fac.getMyFacultyProfile);
r.get("/faculty/me/workload", authorize("faculty"), fac.facultyWorkload);
r.get("/faculty", STAFF, fac.listFaculty);
r.get("/faculty/:id", ADMIN, fac.getFaculty);
r.get("/faculty/:id/workload", ADMIN, fac.facultyWorkload);
r.post("/faculty", ADMIN, avatar, V.facultyRules(true), fac.createFaculty);
r.put("/faculty/:id", ADMIN, avatar, V.facultyRules(false), fac.updateFaculty);
r.delete("/faculty/:id", ADMIN, fac.deleteFaculty);

/* -------------------------------------------------- academic structure */
r.get("/departments/stats", ADMIN, ac.departmentStats);
r.get("/departments/:id/summary", ADMIN, ac.departmentSummary);
crudRoutes(r, "/departments", ac.departments);
crudRoutes(r, "/courses", ac.courses);
crudRoutes(r, "/semesters", ac.semesters, { pre: [ac.validateSemesterCourse] });
r.get("/sections", ac.listSectionsWithStrength);
r.get("/sections/:id/students", STAFF, ac.sectionStudents);
r.post("/sections/:id/students", ADMIN, ac.assignStudentsToSection);
crudRoutes(r, "/sections", ac.sections, { pre: [ac.validateSection] });
crudRoutes(r, "/subjects", ac.subjects, { pre: [ac.validateSubject] });
r.post("/enrollments/sync/:sectionId", ADMIN, ac.syncSectionEnrollments);
crudRoutes(r, "/enrollments", ac.enrollments);

/* ---------------------------------------------------------- timetable */
r.get("/timetable", ac.listTimetable);
r.get("/timetable/rooms", STAFF, ac.listRooms);
r.post("/timetable", ADMIN, V.timetableRules, ac.createTimetable);
r.put("/timetable/:id", ADMIN, ac.updateTimetable);
r.delete("/timetable/:id", ADMIN, ac.deleteTimetable);

/* --------------------------------------------------------- attendance */
r.get("/attendance/me", authorize("student"), att.myAttendance);
r.get("/attendance/sheet", STAFF, att.getSheet);
r.get("/attendance/report", STAFF, att.sectionReport);
r.get("/attendance/export", STAFF, att.exportReport);
r.get("/attendance/low", STAFF, att.lowAttendance);
r.get("/attendance/overview", ADMIN, att.overview);
r.get("/attendance/student/:studentId", att.studentAttendance);
r.get("/attendance", STAFF, att.listSessions);
r.get("/attendance/:id", STAFF, att.getSession);
r.post("/attendance", STAFF, V.attendanceRules, att.markAttendance);
r.put("/attendance/:id", STAFF, att.updateAttendance);
r.delete("/attendance/:id", ADMIN, att.deleteAttendance);

/* -------------------------------------------- assignments/submissions */
r.get("/assignments", asg.listAssignments);
r.get("/assignments/:id", asg.getAssignment);
r.post("/assignments", STAFF, docs("assignments"), V.assignmentRules(true), asg.createAssignment);
r.put("/assignments/:id", STAFF, docs("assignments"), V.assignmentRules(false), asg.updateAssignment);
r.delete("/assignments/:id", STAFF, asg.deleteAssignment);
r.get("/assignments/:id/submissions", STAFF, asg.assignmentSubmissions);
r.post("/assignments/:id/submit", authorize("student"), docs("submissions"), asg.submitAssignment);
r.get("/submissions/me", authorize("student"), asg.mySubmissions);
r.get("/submissions", STAFF, asg.listSubmissions);
r.patch("/submissions/:id/evaluate", STAFF, asg.evaluateSubmission);

/* --------------------------------------------------- exams & results */
r.get("/exams", ex.listExams);
r.get("/exams/:id", ex.getExam);
r.post("/exams", STAFF, V.examRules, ex.createExam);
r.put("/exams/:id", STAFF, ex.updateExam);
r.delete("/exams/:id", STAFF, ex.deleteExam);
r.patch("/exams/:id/publish", ADMIN, ex.publishResults);
r.get("/results/me", authorize("student"), ex.myResults);
r.get("/results/exam/:examId", STAFF, ex.examResults);
r.get("/results/exam/:examId/sheet", STAFF, ex.marksSheet);
r.post("/results/exam/:examId/marks", STAFF, ex.saveMarks);

/* --------------------------------------------------------------- fees */
r.get("/fees/me", authorize("student"), fee.myFees);
r.get("/fees/payments", fee.listPayments);
r.get("/fees/payments/:id", fee.getReceipt);
r.get("/fees/payments/:id/pdf", fee.getReceiptPdf);
r.post("/fees/payments", ADMIN, V.paymentRules, fee.recordPayment);
r.get("/fees/student/:studentId", ADMIN, fee.studentFees);
r.get("/fees/:id/status", ADMIN, fee.feeStatusList);
r.post("/fees/:id/reminders", ADMIN, fee.sendFeeReminders);
crudRoutes(r, "/fees", fee.feeStructures, { pre: [fee.validateFee] });

/* ----------------------------------------------------- notices/notifs */
r.get("/notices", com.listNotices);
r.get("/notices/:id", com.getNotice);
r.post("/notices", STAFF, docs("notices"), V.noticeRules, com.createNotice);
r.put("/notices/:id", STAFF, docs("notices"), com.updateNotice);
r.delete("/notices/:id", STAFF, com.deleteNotice);
r.get("/notifications", com.myNotifications);
r.patch("/notifications/read-all", com.markAllRead);
r.patch("/notifications/:id/read", com.markRead);
r.delete("/notifications/:id", com.deleteNotification);
r.post("/notifications/send", ADMIN, com.sendNotification);

/* ------------------------------------------------------------- leaves */
r.get("/leaves", cam.listLeaves);
r.post("/leaves", authorize("student", "faculty"), uploader("leaves", "document").single("document"), V.leaveRules, cam.applyLeave);
r.patch("/leaves/:id/review", STAFF, cam.reviewLeave);
r.delete("/leaves/:id", cam.cancelLeave);

/* ------------------------------------------------------------ library */
r.get("/library/categories", cam.bookCategories);
r.get("/library/stats", ADMIN, cam.libraryStats);
r.get("/library/issues", cam.listIssues);
r.post("/library/issues", ADMIN, V.issueRules, cam.issueBook);
r.patch("/library/issues/:id/return", ADMIN, cam.returnBook);
r.put("/library/books/:id", ADMIN, cam.adjustCopies);
crudRoutes(r, "/library/books", cam.books);

/* --------------------------------------------------- complaints/feedback */
r.get("/complaints", cam.listComplaints);
r.post("/complaints", authorize("student", "faculty"), V.complaintRules, cam.createComplaint);
r.patch("/complaints/:id", cam.updateComplaint);
r.get("/feedback", cam.listFeedback);
r.post("/feedback", authorize("student", "faculty"), V.feedbackRules, cam.createFeedback);

/* ------------------------------------------------------ reports/settings */
r.get("/reports/:type", STAFF, rep.getReport);
r.get("/settings", set.getSettings);
r.put("/settings", ADMIN, uploader("branding", "image").single("logo"), set.updateSettings);

export default r;
