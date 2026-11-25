import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, GuestRoute, FullScreenLoader } from "./ProtectedRoute";
import { useAuth, HOME_BY_ROLE } from "../context/AuthContext";
import DashboardLayout from "../layouts/DashboardLayout";
import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import { PageSkeleton } from "../components/ui";

// Code-split the panels so the landing/login pages stay light.
const lazyNamed = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const dash = () => import("../pages/dashboards");
const AdminDashboard = lazyNamed(dash, "AdminDashboard");
const FacultyDashboard = lazyNamed(dash, "FacultyDashboard");
const StudentDashboard = lazyNamed(dash, "StudentDashboard");
const md = () => import("../pages/admin/MasterData");
const Departments = lazyNamed(md, "Departments");
const Courses = lazyNamed(md, "Courses");
const Semesters = lazyNamed(md, "Semesters");
const Sections = lazyNamed(md, "Sections");
const Subjects = lazyNamed(md, "Subjects");
const Students = lazy(() => import("../pages/admin/Students"));
const StudentDetail = lazy(() => import("../pages/shared/StudentDetail"));
const Faculty = lazy(() => import("../pages/admin/Faculty"));
const Timetable = lazy(() => import("../pages/shared/Timetable"));
const AttendanceReports = lazy(() => import("../pages/shared/AttendanceReports"));
const MarkAttendance = lazy(() => import("../features/attendance/MarkAttendance"));
const Assignments = lazy(() => import("../pages/shared/Assignments"));
const AssignmentDetail = lazy(() => import("../pages/shared/AssignmentDetail"));
const Exams = lazy(() => import("../pages/shared/Exams"));
const ExamDetail = lazy(() => import("../pages/shared/ExamDetail"));
const fees = () => import("../pages/admin/Fees");
const Fees = lazy(fees);
const FeeStatus = lazyNamed(fees, "FeeStatus");
const lib = () => import("../pages/admin/Library");
const Library = lazy(lib);
const StudentLibrary = lazyNamed(lib, "StudentLibrary");
const Notices = lazy(() => import("../pages/shared/Notices"));
const notif = () => import("../pages/shared/Notifications");
const Notifications = lazy(notif);
const SendNotification = lazyNamed(notif, "SendNotification");
const Leaves = lazy(() => import("../pages/shared/Leaves"));
const comp = () => import("../pages/shared/Complaints");
const HelpDesk = lazy(comp);
const AdminComplaints = lazyNamed(comp, "AdminComplaints");
const FeedbackList = lazyNamed(comp, "FeedbackList");
const Reports = lazy(() => import("../pages/shared/Reports"));
const sys = () => import("../pages/admin/System");
const Settings = lazyNamed(sys, "Settings");
const Users = lazyNamed(sys, "Users");
const AuditLogs = lazyNamed(sys, "AuditLogs");
const Profile = lazy(() => import("../pages/shared/Profile"));
const fp = () => import("../pages/faculty/FacultyPages");
const MyClasses = lazyNamed(fp, "MyClasses");
const MyStudents = lazyNamed(fp, "MyStudents");
const MySubjects = lazyNamed(fp, "MySubjects");
const StudentClasses = lazyNamed(fp, "StudentClasses");
const sa = () => import("../pages/student/StudentAssignments");
const StudentAssignments = lazyNamed(sa, "StudentAssignments");
const StudentAssignmentDetail = lazyNamed(sa, "StudentAssignmentDetail");
const se = () => import("../pages/student/StudentExams");
const StudentExams = lazyNamed(se, "StudentExams");
const StudentResults = lazyNamed(se, "StudentResults");
const StudentFees = lazy(() => import("../pages/student/StudentFees"));
const AttendanceSummary = lazy(() => import("../features/attendance/AttendanceSummary"));

function StudentAttendancePage() {
  return (
    <>
      <div className="mb-6"><h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">My Attendance</h1><p className="mt-1 text-sm text-slate-500">Subject-wise, monthly and day-by-day attendance (read-only)</p></div>
      <AttendanceSummary endpoint="/attendance/me" />
    </>
  );
}

function FacultyMarkPage() {
  return (
    <>
      <div className="mb-6"><h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Mark Attendance</h1><p className="mt-1 text-sm text-slate-500">Select class, subject and date — the student list loads automatically</p></div>
      <MarkAttendance />
    </>
  );
}

/** Redirect role-agnostic links (e.g. "/notices" from notifications). */
function RoleRedirect({ path }) {
  const { user } = useAuth();
  return <Navigate to={user ? `/${user.role}/${path}` : "/login"} replace />;
}

function NotFound() {
  const { user } = useAuth();
  return (
    <div className="app-root flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <p className="mt-3 text-lg font-semibold text-slate-900">Page not found</p>
      <a href={user ? HOME_BY_ROLE[user.role] : "/"} className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Go home</a>
    </div>
  );
}

const S = ({ children }) => <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;

export default function AppRoutes() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forget" element={<ForgotPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/notices" element={<RoleRedirect path="notices" />} />
          <Route path="/dashboard" element={<RoleRedirect path="" />} />
        </Route>

        {/* ------------------------------ admin ------------------------------ */}
        <Route path="/admin" element={<ProtectedRoute roles={["admin"]} />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<S><AdminDashboard /></S>} />
            <Route path="departments" element={<S><Departments /></S>} />
            <Route path="courses" element={<S><Courses /></S>} />
            <Route path="semesters" element={<S><Semesters /></S>} />
            <Route path="sections" element={<S><Sections /></S>} />
            <Route path="subjects" element={<S><Subjects /></S>} />
            <Route path="timetable" element={<S><Timetable /></S>} />
            <Route path="students" element={<S><Students /></S>} />
            <Route path="students/:id" element={<S><StudentDetail /></S>} />
            <Route path="faculty" element={<S><Faculty /></S>} />
            <Route path="users" element={<S><Users /></S>} />
            <Route path="attendance" element={<S><AttendanceReports defaultTab="mark" /></S>} />
            <Route path="assignments" element={<S><Assignments /></S>} />
            <Route path="assignments/:id" element={<S><AssignmentDetail /></S>} />
            <Route path="exams" element={<S><Exams /></S>} />
            <Route path="exams/:id" element={<S><ExamDetail /></S>} />
            <Route path="fees" element={<S><Fees /></S>} />
            <Route path="fees/:id" element={<S><FeeStatus /></S>} />
            <Route path="library" element={<S><Library /></S>} />
            <Route path="leaves" element={<S><Leaves /></S>} />
            <Route path="complaints" element={<S><AdminComplaints /></S>} />
            <Route path="feedback" element={<S><FeedbackList /></S>} />
            <Route path="notices" element={<S><Notices /></S>} />
            <Route path="notifications" element={<S><Notifications /></S>} />
            <Route path="notifications/send" element={<S><SendNotification /></S>} />
            <Route path="reports" element={<S><Reports /></S>} />
            <Route path="audit-logs" element={<S><AuditLogs /></S>} />
            <Route path="settings" element={<S><Settings /></S>} />
            <Route path="profile" element={<S><Profile /></S>} />
          </Route>
        </Route>

        {/* ----------------------------- faculty ----------------------------- */}
        <Route path="/faculty" element={<ProtectedRoute roles={["faculty"]} />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<S><FacultyDashboard /></S>} />
            <Route path="classes" element={<S><MyClasses /></S>} />
            <Route path="students" element={<S><MyStudents /></S>} />
            <Route path="students/:id" element={<S><StudentDetail /></S>} />
            <Route path="subjects" element={<S><MySubjects /></S>} />
            <Route path="timetable" element={<S><Timetable /></S>} />
            <Route path="attendance" element={<S><FacultyMarkPage /></S>} />
            <Route path="attendance/reports" element={<S><AttendanceReports /></S>} />
            <Route path="assignments" element={<S><Assignments /></S>} />
            <Route path="assignments/:id" element={<S><AssignmentDetail /></S>} />
            <Route path="exams" element={<S><Exams /></S>} />
            <Route path="exams/:id" element={<S><ExamDetail /></S>} />
            <Route path="reports" element={<S><Reports /></S>} />
            <Route path="notices" element={<S><Notices /></S>} />
            <Route path="leaves" element={<S><Leaves /></S>} />
            <Route path="complaints" element={<S><HelpDesk /></S>} />
            <Route path="notifications" element={<S><Notifications /></S>} />
            <Route path="profile" element={<S><Profile /></S>} />
          </Route>
        </Route>

        {/* ----------------------------- student ----------------------------- */}
        <Route path="/student" element={<ProtectedRoute roles={["student"]} />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<S><StudentDashboard /></S>} />
            <Route path="profile" element={<S><Profile /></S>} />
            <Route path="classes" element={<S><StudentClasses /></S>} />
            <Route path="timetable" element={<S><Timetable /></S>} />
            <Route path="attendance" element={<S><StudentAttendancePage /></S>} />
            <Route path="assignments" element={<S><StudentAssignments /></S>} />
            <Route path="assignments/:id" element={<S><StudentAssignmentDetail /></S>} />
            <Route path="exams" element={<S><StudentExams /></S>} />
            <Route path="results" element={<S><StudentResults /></S>} />
            <Route path="fees" element={<S><StudentFees /></S>} />
            <Route path="library" element={<S><StudentLibrary /></S>} />
            <Route path="notices" element={<S><Notices /></S>} />
            <Route path="leaves" element={<S><Leaves /></S>} />
            <Route path="complaints" element={<S><HelpDesk /></S>} />
            <Route path="notifications" element={<S><Notifications /></S>} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
