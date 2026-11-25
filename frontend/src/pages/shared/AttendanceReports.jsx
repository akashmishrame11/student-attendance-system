import { useState } from "react";
import { Eye, Pencil, Printer, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useApi, useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import ExportButtons from "../../features/ExportButtons";
import { Badge, Button, Card, DataTable, FilterSelect, Input, Modal, PageHeader, Pagination, ProgressBar, StatCard, Tabs, useConfirm } from "../../components/ui";
import MarkAttendance from "../../features/attendance/MarkAttendance";
import { OPT } from "../../utils/options";
import { fmtDate, sectionLabel } from "../../utils/format";
import { CalendarCheck, Users, ClipboardCheck } from "lucide-react";

function Filters({ section, setSection, subject, setSubject, month, setMonth, requireSection }) {
  const { user } = useAuth();
  const mine = user.role === "faculty" ? { mine: "true" } : undefined;
  const { options: sections } = useOptions("/sections", OPT.section.map, mine);
  const { options: subjects } = useOptions(section ? "/subjects" : null, OPT.subject.map, { section, ...(mine || {}) });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect value={section} onChange={(v) => { setSection(v); setSubject?.(""); }} options={sections} placeholder={requireSection ? "Select class…" : "All classes"} />
      {setSubject && <FilterSelect value={subject} onChange={setSubject} options={subjects} placeholder="All subjects" />}
      {setMonth && <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />}
    </div>
  );
}

function SessionView({ id, onClose }) {
  const { data } = useApi(id ? `/attendance/${id}` : null);
  return (
    <Modal open={Boolean(id)} onClose={onClose} title={data ? `${data.subject?.code} · ${data.section?.course?.code}-${data.section?.name}` : "Attendance"} subtitle={data && fmtDate(data.date)}>
      {!data ? <p className="text-sm text-slate-500">Loading…</p> : (
        <DataTable dense rows={data.records} rowKey={(r) => r.student?._id} columns={[
          { key: "roll", label: "Roll No", render: (r) => r.student?.rollNumber },
          { key: "name", label: "Name", render: (r) => r.student?.user?.name },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          { key: "remark", label: "Remark", render: (r) => r.remark || "—" },
        ]} />
      )}
    </Modal>
  );
}

function Sessions() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);
  const { data, meta, loading, error, refetch } = useApi("/attendance", { section: section || undefined, subject: subject || undefined, page, limit: 15 });
  const remove = async (r) => {
    if (!(await confirm({ title: "Delete attendance record?", message: "The whole session will be removed.", tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api.delete(`/attendance/${r._id}`);
      toast.success("Deleted");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Card bodyClass="p-0">
      <div className="border-b border-slate-100 p-4"><Filters section={section} setSection={(v) => { setSection(v); setPage(1); }} subject={subject} setSubject={(v) => { setSubject(v); setPage(1); }} /></div>
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} empty={{ title: "No attendance sessions recorded" }} columns={[
        { key: "date", label: "Date", render: (r) => fmtDate(r.date, { weekday: "short", day: "2-digit", month: "short" }) },
        { key: "section", label: "Class", render: (r) => sectionLabel(r.section) },
        { key: "subject", label: "Subject", render: (r) => r.subject?.code },
        { key: "counts", label: "P / A / L / LV", hideOn: "md", render: (r) => <span className="tabular-nums">{r.present} / {r.absent} / {r.late} / {r.leave}</span> },
        { key: "percentage", label: "Present", render: (r) => <div className="flex w-28 items-center gap-2"><ProgressBar value={r.percentage} /><span className="text-xs tabular-nums">{r.percentage}%</span></div> },
        { key: "markedBy", label: "Marked by", hideOn: "lg", render: (r) => r.markedBy?.name },
        { key: "a", label: "", className: "text-right whitespace-nowrap", render: (r) => (
          <>
            <Button size="icon" variant="ghost" title="View" onClick={() => setView(r._id)}><Eye className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Edit" onClick={() => setEdit({ section: r.section?._id, subject: r.subject?._id, date: new Date(r.date).toISOString().slice(0, 10) })}><Pencil className="h-4 w-4" /></Button>
            {user.role === "admin" && <Button size="icon" variant="ghost" className="text-rose-600" title="Delete" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>}
          </>
        ) },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
      <SessionView id={view} onClose={() => setView(null)} />
      <Modal open={Boolean(edit)} onClose={() => { setEdit(null); refetch(); }} size="lg" title="Edit attendance">
        {edit && <MarkAttendance initial={edit} />}
      </Modal>
    </Card>
  );
}

function ClassReport() {
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [month, setMonth] = useState("");
  const params = { section, subject: subject || undefined, month: month || undefined };
  const { data, loading, error, refetch } = useApi(section ? "/attendance/report" : null, params);
  return (
    <Card bodyClass="p-0">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <Filters requireSection section={section} setSection={setSection} subject={subject} setSubject={setSubject} month={month} setMonth={setMonth} />
        {data && (
          <div className="flex gap-2">
            <ExportButtons path="/attendance/export" params={params} />
            <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>
          </div>
        )}
      </div>
      {!section ? <p className="py-14 text-center text-sm text-slate-500">Select a class to generate the report (optionally a subject and month).</p> : (
        <>
          {data && (
            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 md:grid-cols-4">
              <StatCard label="Sessions" value={data.sessions} />
              <StatCard label="Class average" value={`${data.average}%`} />
              <StatCard label="Threshold" value={`${data.threshold}%`} />
              <StatCard label="Below threshold" value={data.lowCount} tone="red" />
            </div>
          )}
          <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data?.rows} rowKey={(r) => r.student} empty={{ title: "No students" }} columns={[
            { key: "rollNumber", label: "Roll No" },
            { key: "name", label: "Name" },
            { key: "total", label: "Sessions" },
            { key: "present", label: "Present" },
            { key: "late", label: "Late", hideOn: "sm" },
            { key: "absent", label: "Absent" },
            { key: "leave", label: "Leave", hideOn: "sm" },
            { key: "percentage", label: "%", render: (r) => <span className={`font-semibold ${r.isLow ? "text-rose-600" : "text-emerald-700"}`}>{r.percentage}%</span> },
          ]} />
        </>
      )}
    </Card>
  );
}

function LowAttendance() {
  const [section, setSection] = useState("");
  const { data, loading, error, refetch } = useApi("/attendance/low", { section: section || undefined });
  return (
    <Card bodyClass="p-0">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <Filters section={section} setSection={setSection} />
        {data && <Badge tone="red">Below {data.threshold}%</Badge>}
      </div>
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data?.rows} empty={{ title: "No students below the threshold 🎉" }} columns={[
        { key: "roll", label: "Roll No", render: (r) => r.student?.rollNumber },
        { key: "name", label: "Name", render: (r) => r.student?.user?.name },
        { key: "email", label: "Email", hideOn: "md", render: (r) => r.student?.user?.email },
        { key: "section", label: "Class", render: (r) => `${r.student?.section?.course?.code || ""}-${r.student?.section?.name || ""}` },
        { key: "att", label: "Attended", render: (r) => `${r.present + r.late}/${r.total}` },
        { key: "percentage", label: "%", render: (r) => <span className="font-semibold text-rose-600">{r.percentage}%</span> },
      ]} />
    </Card>
  );
}

function AdminOverview() {
  const { data } = useApi("/attendance/overview");
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-4">
      <div className="grid grid-cols-2 gap-4 lg:col-span-1 lg:grid-cols-1">
        <StatCard label="Today's attendance" value={data ? (data.today.total ? `${data.today.percentage}%` : "—") : null} loading={!data} icon={CalendarCheck} tone="green" hint={data && `${data.sessionsToday} sessions marked`} />
        <StatCard label="Marked today" value={data?.today.total} loading={!data} icon={Users} hint="student-class entries" />
      </div>
      <Card title="Last 14 days" className="lg:col-span-3">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.trend || []} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs><linearGradient id="att" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b65f5" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b65f5" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
              <Area type="monotone" dataKey="percentage" stroke="#2546ea" strokeWidth={2} fill="url(#att)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

export default function AttendanceReports({ defaultTab = "sessions" }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(defaultTab);
  const tabs = [
    ...(user.role === "admin" ? [{ value: "mark", label: "Mark / Correct" }] : []),
    { value: "sessions", label: "Attendance history" },
    { value: "report", label: "Class report" },
    { value: "low", label: "Low attendance" },
  ];
  return (
    <>
      <PageHeader title={user.role === "admin" ? "Attendance Management" : "Attendance Reports"} subtitle="Class-wise, subject-wise, date-wise and monthly attendance" actions={<Badge tone="slate"><ClipboardCheck className="mr-1 h-3 w-3" /> Late counts as present</Badge>} />
      {user.role === "admin" && <AdminOverview />}
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === "mark" && <MarkAttendance />}
      {tab === "sessions" && <Sessions />}
      {tab === "report" && <ClassReport />}
      {tab === "low" && <LowAttendance />}
    </>
  );
}
