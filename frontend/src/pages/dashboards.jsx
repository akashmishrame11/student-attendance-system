import { Link } from "react-router-dom";
import {
  AlertTriangle, BookMarked, Building2, BookOpen, CalendarCheck, CalendarClock, ClipboardList, FileText, GraduationCap, Layers,
  Megaphone, School, Users, CalendarOff, ArrowRight,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { Badge, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, ProgressBar, StatCard } from "../components/ui";
import { TodayClasses } from "../features/timetable/WeeklyTimetable";
import { fmtDate, fmtDateTime, fmtMoney, sectionLabel, timeAgo, titleCase } from "../utils/format";

const PIE = ["#2546ea", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];
const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

function TrendChart({ data, height = 220 }) {
  if (!data?.length) return <EmptyState icon={CalendarCheck} title="No attendance data yet" />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b65f5" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b65f5" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: "2-digit", month: "short" })} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} labelFormatter={(d) => fmtDate(d)} />
          <Area type="monotone" dataKey="percentage" stroke="#2546ea" strokeWidth={2} fill="url(#g1)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ExamList({ exams }) {
  if (!exams?.length) return <EmptyState icon={FileText} title="No upcoming exams" />;
  return (
    <ul className="divide-y divide-slate-100">
      {exams.map((e) => (
        <li key={e._id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{e.name}</p><p className="text-xs text-slate-500">{e.course?.code}{e.semester?.number ? ` · Sem ${e.semester.number}` : ""} · {fmtDate(e.startDate)}</p></div>
          <Badge status={e.type} />
        </li>
      ))}
    </ul>
  );
}

function NoticeList({ notices, role }) {
  if (!notices?.length) return <EmptyState icon={Megaphone} title="No notices" />;
  return (
    <ul className="divide-y divide-slate-100">
      {notices.map((n) => (
        <li key={n._id} className="py-3">
          <Link to={`/${role}/notices`} className="block hover:text-brand-700">
            <p className="truncate text-sm font-medium">{n.title}</p>
            <p className="line-clamp-1 text-xs text-slate-500">{n.content}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{fmtDate(n.publishDate)} · {titleCase(n.category)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const More = ({ to, children = "View all" }) => <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">{children} <ArrowRight className="h-3 w-3" /></Link>;

/* ------------------------------------------------------------------ admin */
export function AdminDashboard() {
  const { user } = useAuth();
  const { data: d, loading, error, refetch } = useApi("/dashboard/admin");
  if (loading && !d) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const c = d.counts;
  return (
    <div className="space-y-6">
      <PageHeader title={`${greet()}, ${user.name}`} subtitle={`Here's what's happening across campus today — ${fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={c.students} icon={GraduationCap} hint="Active enrollments" />
        <StatCard label="Faculty" value={c.faculty} icon={Users} tone="violet" />
        <StatCard label="Today's attendance" value={d.todayAttendance === null ? "—" : `${d.todayAttendance}%`} icon={CalendarCheck} tone="green" hint={d.todayMarked ? `${d.todayMarked} entries marked` : "Not marked yet"} />
        <StatCard label="Open assignments" value={c.pendingAssignments} icon={ClipboardList} tone="amber" hint="Deadline not passed" />
        <StatCard label="Departments" value={c.departments} icon={Building2} tone="slate" />
        <StatCard label="Courses" value={c.courses} icon={BookOpen} tone="slate" />
        <StatCard label="Classes" value={c.sections} icon={Layers} tone="slate" hint={`${c.subjects} subjects`} />
        <StatCard label="Pending requests" value={c.pendingLeaves + c.openComplaints} icon={CalendarOff} tone="red" hint={`${c.pendingLeaves} leave · ${c.openComplaints} complaints`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Attendance — last 7 days" className="xl:col-span-2" actions={<More to="/admin/attendance">Attendance</More>}><TrendChart data={d.attendanceTrend} /></Card>
        <Card title="Students by department">
          {d.studentsByDepartment.length === 0 ? <EmptyState title="No students yet" /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.studentsByDepartment} dataKey="count" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {d.studentsByDepartment.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            {d.studentsByDepartment.map((s, i) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />{s.name} ({s.count})</span>)}
          </div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Fee collection (6 months)" actions={<More to="/admin/fees">Fees</More>}>
          {d.feeCollection.length === 0 ? <EmptyState title="No payments yet" /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.feeCollection} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v) => [fmtMoney(v), "Collected"]} />
                  <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Upcoming examinations" actions={<More to="/admin/exams" />}><ExamList exams={d.upcomingExams} /></Card>
        <Card title="Recent activity" actions={<More to="/admin/audit-logs" />}>
          {d.recentActivities.length === 0 ? <EmptyState title="No activity yet" /> : (
            <ul className="space-y-3">
              {d.recentActivities.map((a) => (
                <li key={a._id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0"><p className="truncate"><b className="font-medium">{a.user?.name || "System"}</b> {titleCase(a.action).toLowerCase()} <span className="text-slate-500">{a.entity}</span></p><p className="text-xs text-slate-400">{timeAgo(a.createdAt)}</p></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- faculty */
export function FacultyDashboard() {
  const { user } = useAuth();
  const { data: d, loading, error, refetch } = useApi("/dashboard/faculty");
  if (loading && !d) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <div className="space-y-6">
      <PageHeader title={`${greet()}, ${user.name}`} subtitle={`You have ${d.counts.todayClasses} class${d.counts.todayClasses === 1 ? "" : "es"} today.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="My classes" value={d.counts.classes} icon={School} />
        <StatCard label="Students" value={d.counts.students} icon={GraduationCap} tone="violet" />
        <StatCard label="Subjects" value={d.counts.subjects} icon={BookMarked} tone="slate" />
        <StatCard label="To evaluate" value={d.counts.pendingEvaluations} icon={ClipboardList} tone="amber" hint="Submissions pending" />
        <StatCard label="Avg attendance" value={d.averageAttendance === null ? "—" : `${d.averageAttendance}%`} icon={CalendarCheck} tone="green" hint="Last 7 days" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Today's timetable" className="xl:col-span-2" actions={<More to="/faculty/attendance">Mark attendance</More>}><TodayClasses slots={d.todayClasses} show="section" /></Card>
        <Card title="Assigned classes" actions={<More to="/faculty/classes" />}>
          {d.classes.length === 0 ? <EmptyState title="No classes assigned" /> : (
            <ul className="divide-y divide-slate-100">{d.classes.map((c) => <li key={c._id} className="flex justify-between py-2.5 text-sm"><span className="font-medium">{sectionLabel(c)}</span><span className="text-slate-500">{c.room}</span></li>)}</ul>
          )}
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Attendance summary — my classes" className="xl:col-span-2"><TrendChart data={d.attendanceTrend} /></Card>
        <Card title="Upcoming deadlines" actions={<More to="/faculty/assignments" />}>
          {d.upcomingAssignments.length === 0 ? <EmptyState icon={ClipboardList} title="No open assignments" /> : (
            <ul className="divide-y divide-slate-100">{d.upcomingAssignments.map((a) => (
              <li key={a._id} className="py-2.5"><Link to={`/faculty/assignments/${a._id}`} className="block hover:text-brand-700"><p className="truncate text-sm font-medium">{a.title}</p><p className="text-xs text-slate-500">{a.subject?.code} · Sec {a.section?.name} · due {fmtDateTime(a.dueDate)}</p></Link></li>
            ))}</ul>
          )}
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming exams" actions={<More to="/faculty/exams" />}><ExamList exams={d.upcomingExams} /></Card>
        <Card title="Recent notices" actions={<More to="/faculty/notices" />}><NoticeList notices={d.recentNotices} role="faculty" /></Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- student */
export function StudentDashboard() {
  const { data: d, loading, error, refetch } = useApi("/dashboard/student");
  if (loading && !d) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const s = d.student;
  const pct = d.attendance.percentage;
  const low = pct !== null && pct < 75;
  const pending = d.assignments.filter((a) => a.submissionStatus === "pending").length;
  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-6 text-white">
          <p className="text-sm text-brand-100">{greet()},</p>
          <h1 className="text-2xl font-semibold">{s.user?.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-brand-50">
            <span>ID <b>{s.studentId}</b></span><span>Roll <b>{s.rollNumber}</b></span><span>{s.course?.name}</span><span>{s.semester?.name}</span><span>Section <b>{s.section?.name || "—"}</b></span>
          </div>
        </div>
      </div>
      {low && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p><b>Low attendance:</b> your overall attendance is {pct}%. Attend classes regularly to stay eligible for exams. <Link className="font-medium underline" to="/student/attendance">View details</Link></p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance</p>
          <p className={`mt-1 text-2xl font-semibold ${low ? "text-rose-600" : "text-slate-900"}`}>{pct === null ? "—" : `${pct}%`}</p>
          <div className="mt-2"><ProgressBar value={pct || 0} /></div>
          <p className="mt-1 text-xs text-slate-500">{d.attendance.attended}/{d.attendance.total} classes</p>
        </div>
        <StatCard label="Classes today" value={d.todayClasses.length} icon={CalendarClock} />
        <StatCard label="Pending assignments" value={pending} icon={ClipboardList} tone="amber" />
        <StatCard label="Upcoming exams" value={d.upcomingExams.length} icon={FileText} tone="violet" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Today's timetable" className="xl:col-span-2" actions={<More to="/student/timetable">Full timetable</More>}><TodayClasses slots={d.todayClasses} /></Card>
        <Card title="Latest notices" actions={<More to="/student/notices" />}><NoticeList notices={d.latestNotices} role="student" /></Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Assignments" className="xl:col-span-2" actions={<More to="/student/assignments" />}>
          {d.assignments.length === 0 ? <EmptyState icon={ClipboardList} title="No recent assignments" /> : (
            <ul className="divide-y divide-slate-100">
              {d.assignments.map((a) => (
                <li key={a._id}>
                  <Link to={`/student/assignments/${a._id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-700">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{a.title}</p><p className="text-xs text-slate-500">{a.subject?.code} · due {fmtDateTime(a.dueDate)}</p></div>
                    <div className="flex items-center gap-2">{a.marks !== undefined && a.marks !== null && <span className="text-xs font-semibold">{a.marks}/{a.maxMarks}</span>}<Badge status={a.submissionStatus} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Upcoming exams" actions={<More to="/student/exams" />}>
          <ExamList exams={d.upcomingExams.map((e) => ({ ...e, course: { code: e.schedule.map((x) => x.subject?.code).slice(0, 3).join(", ") } }))} />
        </Card>
      </div>
    </div>
  );
}
