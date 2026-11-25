import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Save, Send, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi, useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import ExportButtons from "../../features/ExportButtons";
import { Badge, Button, Card, Checkbox, DataTable, ErrorState, FilterSelect, PageSkeleton, StatCard, Tabs, useConfirm } from "../../components/ui";
import { OPT } from "../../utils/options";
import { fmtDate } from "../../utils/format";

function MarksEntry({ exam }) {
  const { user } = useAuth();
  const [subject, setSubject] = useState(exam.schedule[0]?.subject?._id || "");
  const [section, setSection] = useState("");
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const { options: sections } = useOptions("/sections", OPT.section.map, { semester: exam.semester?._id, ...(user.role === "faculty" ? { mine: "true" } : {}) });
  const { data, loading, error, refetch } = useApi(subject ? `/results/exam/${exam._id}/sheet` : null, { subject, section: section || undefined });
  useEffect(() => { if (data) setRows(data.rows.map((r) => ({ ...r, marksObtained: r.marksObtained ?? "" }))); }, [data]);
  const locked = exam.resultsPublished && user.role !== "admin";

  const save = async () => {
    const bad = rows.find((r) => !r.isAbsent && r.marksObtained !== "" && (Number(r.marksObtained) < 0 || Number(r.marksObtained) > data.maxMarks));
    if (bad) return toast.error(`${bad.name}: marks must be 0–${data.maxMarks}`);
    setSaving(true);
    try {
      const { data: res } = await api.post(`/results/exam/${exam._id}/marks`, { subject, entries: rows.map((r) => ({ student: r.student, marksObtained: r.marksObtained === "" ? null : Number(r.marksObtained), isAbsent: r.isAbsent })) });
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Card bodyClass="p-0">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterSelect value={subject} onChange={setSubject} placeholder="Select subject" options={exam.schedule.map((s) => ({ value: s.subject?._id, label: `${s.subject?.code} — ${s.subject?.name}` }))} />
          <FilterSelect value={section} onChange={setSection} options={sections} placeholder={user.role === "faculty" ? "All my sections" : "All sections"} />
        </div>
        {data && <p className="text-xs text-slate-500">Max {data.maxMarks} · Pass {data.passMarks}</p>}
      </div>
      {locked && <p className="bg-amber-50 px-4 py-2 text-xs text-amber-800">Results are published. Only an admin can change marks now.</p>}
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={rows} rowKey={(r) => r.student} dense empty={{ title: "No students for this exam" }} columns={[
        { key: "rollNumber", label: "Roll No" },
        { key: "name", label: "Name" },
        { key: "section", label: "Sec", hideOn: "sm" },
        { key: "marks", label: "Marks", render: (r, i) => (
          <input type="number" min={0} max={data?.maxMarks} disabled={r.isAbsent || locked} value={r.isAbsent ? "" : r.marksObtained} onChange={(e) => set(i, { marksObtained: e.target.value })}
            className={`input h-8 w-24 py-1 ${r.marksObtained !== "" && Number(r.marksObtained) < (data?.passMarks ?? 0) ? "border-rose-300 text-rose-700" : ""}`} />
        ) },
        { key: "absent", label: "Absent", render: (r, i) => <Checkbox checked={r.isAbsent} disabled={locked} onChange={(e) => set(i, { isAbsent: e.target.checked })} /> },
        { key: "grade", label: "Grade", render: (r) => r.grade || "—" },
      ]} />
      {!locked && rows.length > 0 && (
        <div className="flex justify-end border-t border-slate-100 px-4 py-3"><Button icon={Save} loading={saving} onClick={save}>Save marks</Button></div>
      )}
    </Card>
  );
}

function Results({ exam, onPublished }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(`/results/exam/${exam._id}`);
  const publish = async (publish) => {
    if (!(await confirm({ title: publish ? "Publish results?" : "Unpublish results?", message: publish ? "Students will be able to see their marks and will be notified." : "Students will no longer see these results." }))) return;
    try {
      const { data: res } = await api.patch(`/exams/${exam._id}/publish`, { publish });
      toast.success(res.message);
      onPublished();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const subjects = exam.schedule.map((s) => s.subject);
  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Students" value={data.stats.count} />
          <StatCard label="Passed" value={data.stats.pass} tone="green" />
          <StatCard label="Failed" value={data.stats.fail} tone="red" />
          <StatCard label="Average" value={`${data.stats.average}%`} tone="violet" />
        </div>
      )}
      <Card bodyClass="p-0" title="Result sheet" actions={
        <>
          <ExportButtons path="/reports/results" params={{ exam: exam._id }} />
          {user.role === "admin" && (exam.resultsPublished
            ? <Button size="sm" variant="secondary" icon={EyeOff} onClick={() => publish(false)}>Unpublish</Button>
            : <Button size="sm" icon={Send} onClick={() => publish(true)}>Publish results</Button>)}
        </>
      }>
        <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data?.rows} dense empty={{ title: "No marks entered yet" }} columns={[
          { key: "roll", label: "Roll No", render: (r) => r.student?.rollNumber },
          { key: "name", label: "Name", render: (r) => r.student?.user?.name },
          ...subjects.map((s) => ({ key: s._id, label: s.code, hideOn: "md", render: (r) => { const m = r.marks.find((x) => x.subject?._id === s._id); return m ? (m.isAbsent ? "AB" : m.marksObtained) : "—"; } })),
          { key: "total", label: "Total", render: (r) => `${r.total}/${r.maxTotal}` },
          { key: "percentage", label: "%", render: (r) => `${r.percentage}%` },
          { key: "grade", label: "Grade", render: (r) => <span className="font-semibold">{r.grade}</span> },
          { key: "status", label: "Result", render: (r) => <Badge status={r.status} /> },
        ]} />
      </Card>
    </div>
  );
}

export default function ExamDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState("marks");
  const { data: exam, loading, error, refetch } = useApi(`/exams/${id}`);
  if (loading && !exam) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <div className="space-y-6">
      <Link to={`/${user.role}/exams`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> All examinations</Link>
      <div className="card flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{exam.name}</h1><Badge status={exam.type} /><Badge tone={exam.resultsPublished ? "green" : "slate"}>{exam.resultsPublished ? "Results published" : "Results not published"}</Badge></div>
          <p className="mt-1 text-sm text-slate-500">{exam.course?.name} · {exam.semester?.name} · {exam.academicYear} · {fmtDate(exam.startDate)} – {fmtDate(exam.endDate)}</p>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "marks", label: "Enter marks" }, { value: "results", label: "Results" }, { value: "schedule", label: "Exam timetable" }]} />
      {tab === "marks" && <MarksEntry exam={exam} />}
      {tab === "results" && <Results exam={exam} onPublished={refetch} />}
      {tab === "schedule" && <ExamSchedule exam={exam} />}
    </div>
  );
}

export function ExamSchedule({ exam }) {
  return (
    <Card bodyClass="p-0">
      <DataTable rows={[...exam.schedule].sort((a, b) => new Date(a.date) - new Date(b.date))} dense columns={[
        { key: "date", label: "Date", render: (r) => fmtDate(r.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) },
        { key: "time", label: "Time", render: (r) => `${r.startTime || "—"} – ${r.endTime || "—"}` },
        { key: "subject", label: "Subject", render: (r) => `${r.subject?.code} — ${r.subject?.name}` },
        { key: "room", label: "Room", render: (r) => r.room || "—" },
        { key: "marks", label: "Max / Pass", render: (r) => `${r.maxMarks} / ${r.passMarks}` },
      ]} />
    </Card>
  );
}
