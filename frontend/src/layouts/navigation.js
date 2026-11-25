import {
  LayoutDashboard, Building2, BookOpen, CalendarRange, Layers, BookMarked, Clock, GraduationCap, Users, UserCog,
  CalendarCheck, ClipboardList, FileText, Wallet, Library, CalendarOff, MessageSquareWarning, Star, Megaphone,
  Bell, BarChart3, ScrollText, Settings, UserCircle, School, ListChecks, Award,
} from "lucide-react";

/** Sidebar navigation per role. Every entry maps to a real route in routes/AppRoutes.jsx. */
export const NAV = {
  admin: [
    { section: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    {
      section: "Academics",
      items: [
        { to: "/admin/departments", label: "Departments", icon: Building2 },
        { to: "/admin/courses", label: "Courses", icon: BookOpen },
        { to: "/admin/semesters", label: "Semesters", icon: CalendarRange },
        { to: "/admin/sections", label: "Classes & Sections", icon: Layers },
        { to: "/admin/subjects", label: "Subjects", icon: BookMarked },
        { to: "/admin/timetable", label: "Timetable", icon: Clock },
      ],
    },
    {
      section: "People",
      items: [
        { to: "/admin/students", label: "Students", icon: GraduationCap },
        { to: "/admin/faculty", label: "Faculty", icon: Users },
        { to: "/admin/users", label: "User Accounts", icon: UserCog },
      ],
    },
    {
      section: "Academic Operations",
      items: [
        { to: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
        { to: "/admin/assignments", label: "Assignments", icon: ClipboardList },
        { to: "/admin/exams", label: "Exams & Results", icon: FileText },
      ],
    },
    {
      section: "Campus",
      items: [
        { to: "/admin/fees", label: "Fees", icon: Wallet },
        { to: "/admin/library", label: "Library", icon: Library },
        { to: "/admin/leaves", label: "Leave Requests", icon: CalendarOff },
        { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning },
        { to: "/admin/feedback", label: "Feedback", icon: Star },
      ],
    },
    {
      section: "Communication",
      items: [
        { to: "/admin/notices", label: "Notices", icon: Megaphone },
        { to: "/admin/notifications/send", label: "Send Notification", icon: Bell },
      ],
    },
    {
      section: "Insights",
      items: [
        { to: "/admin/reports", label: "Reports", icon: BarChart3 },
        { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
        { to: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
  faculty: [
    { section: "Overview", items: [{ to: "/faculty", label: "Dashboard", icon: LayoutDashboard, end: true }] },
    {
      section: "Teaching",
      items: [
        { to: "/faculty/classes", label: "My Classes", icon: School },
        { to: "/faculty/students", label: "My Students", icon: GraduationCap },
        { to: "/faculty/subjects", label: "My Subjects", icon: BookMarked },
        { to: "/faculty/timetable", label: "Timetable", icon: Clock },
      ],
    },
    {
      section: "Attendance",
      items: [
        { to: "/faculty/attendance", label: "Mark Attendance", icon: ListChecks, end: true },
        { to: "/faculty/attendance/reports", label: "Attendance Reports", icon: CalendarCheck },
      ],
    },
    {
      section: "Assessment",
      items: [
        { to: "/faculty/assignments", label: "Assignments", icon: ClipboardList },
        { to: "/faculty/exams", label: "Exams & Marks", icon: FileText },
        { to: "/faculty/reports", label: "Reports", icon: BarChart3 },
      ],
    },
    {
      section: "General",
      items: [
        { to: "/faculty/notices", label: "Notices", icon: Megaphone },
        { to: "/faculty/leaves", label: "Leave Requests", icon: CalendarOff },
        { to: "/faculty/complaints", label: "Help Desk", icon: MessageSquareWarning },
      ],
    },
  ],
  student: [
    { section: "Overview", items: [{ to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true }, { to: "/student/profile", label: "My Profile", icon: UserCircle }] },
    {
      section: "Academics",
      items: [
        { to: "/student/classes", label: "My Classes", icon: School },
        { to: "/student/timetable", label: "Timetable", icon: Clock },
        { to: "/student/attendance", label: "Attendance", icon: CalendarCheck },
        { to: "/student/assignments", label: "Assignments", icon: ClipboardList },
        { to: "/student/exams", label: "Exams", icon: FileText },
        { to: "/student/results", label: "Results", icon: Award },
      ],
    },
    {
      section: "Campus",
      items: [
        { to: "/student/fees", label: "Fees", icon: Wallet },
        { to: "/student/library", label: "Library", icon: Library },
        { to: "/student/notices", label: "Notices", icon: Megaphone },
        { to: "/student/leaves", label: "Leave", icon: CalendarOff },
        { to: "/student/complaints", label: "Complaints & Feedback", icon: MessageSquareWarning },
      ],
    },
  ],
};
