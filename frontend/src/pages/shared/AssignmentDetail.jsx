import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileText, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage, fileUrl } from "../../services/api";
import { Badge, Button, Card, DataTable, ErrorState, Field, Input, KeyValue, Modal, PageSkeleton, Tabs, Textarea } from "../../components/ui";
import { fmtDateTime, sectionLabel } from "../../utils/format";

export function FileList({ files = [] }) {
  if (!files.length) return <span className="text-sm text-slate-400">No files</span>;
  return (
    <ul className="space-y-1">
      {files.map((f) => (
        <li key={f.url}>
          <a href={fileUrl(f.url)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm text-brand-700 hover:underline">
            <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{f.name}</span>
            {f.size ? <span className="text-xs text-slate-400">({Math.round(f.size / 1024)} KB)</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Preview({ file }) {
  if (!file) return null;
  const url = fileUrl(file.url);
  if (file.mimeType?.startsWith("image/")) return <img src={url} alt={file.name} className="max-h-96 rounded-lg border border-slate-200" />;
  if (file.mimeType === "application/pdf") return <iframe src={url} title={file.name} className="h-96 w-full rounded-lg border border-slate-200" />;
  return null;
}

function EvaluateModal({ row, assignment, onClose }) {
  const sub = row?.submission;
  const [marks, setMarks] = useState(sub?.marks ?? "");
  const [feedback, setFeedback] = useState(sub?.feedback || "");
  const [busy, setBusy] = useState("");
  const submit = async (action) => {
    if (action === "evaluate" && (marks === "" || Number(marks) < 0 || Number(marks) > assignment.maxMarks)) {
      return toast.error(`Marks must be between 0 and ${assignment.maxMarks}`);
    }
    setBusy(action);
    try {
      const { data } = await api.patch(`/submissions/${sub._id}/evaluate`, { action, marks: action === "evaluate" ? Number(marks) : undefined, feedback });
      toast.success(data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy("");
    }
  };
  if (!row) return null;
  const previewable = sub?.files?.find((f) => f.mimeType?.startsWith("image/") || f.mimeType === "application/pdf");
  return (
    <Modal open onClose={() => onClose(false)} size="lg" title={`Evaluate — ${row.student.name}`} subtitle={`${row.student.rollNumber} · submitted ${fmtDateTime(sub.submittedAt)} · attempt ${sub.attempts}`}
      footer={<>
        <Button variant="secondary" icon={RotateCcw} loading={busy === "resubmit"} onClick={() => submit("resubmit")}>Request resubmission</Button>
        <Button variant="success" icon={CheckCircle2} loading={busy === "evaluate"} onClick={() => submit("evaluate")}>Approve & save marks</Button>
      </>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><Badge status={sub.status} />{sub.status === "late" && <span className="text-xs text-amber-700">Submitted after the deadline</span>}</div>
        {sub.textAnswer && <div><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Answer</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{sub.textAnswer}</p></div>}
        <div><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Files</p><FileList files={sub.files} /></div>
        <Preview file={previewable} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Marks (out of ${assignment.maxMarks})`} required><Input type="number" min={0} max={assignment.maxMarks} value={marks} onChange={(e) => setMarks(e.target.value)} /></Field>
          <Field label="Feedback" className="sm:col-span-2"><Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Comments for the student" /></Field>
        </div>
      </div>
    </Modal>
  );
}

export default function AssignmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [evaluating, setEvaluating] = useState(null);
  const { data, loading, error, refetch } = useApi(`/assignments/${id}/submissions`);
  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const { assignment: a, rows } = data;
  const count = (s) => rows.filter((r) => r.status === s).length;
  const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);

  return (
    <div className="space-y-6">
      <Link to={`/${user.role}/assignments`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> All assignments</Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={a.title} subtitle={`${a.subject?.code} — ${a.subject?.name} · ${sectionLabel(a.section)}`} className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{a.description}</p>
          {a.instructions && <><p className="mt-4 text-xs font-semibold uppercase text-slate-500">Instructions</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{a.instructions}</p></>}
          <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Attachments</p>
          <div className="mt-1"><FileList files={a.attachments} /></div>
        </Card>
        <Card title="Details">
          <KeyValue items={[["Deadline", fmtDateTime(a.dueDate)], ["Max marks", a.maxMarks], ["Resubmission", a.allowResubmission ? "Allowed" : "Not allowed"], ["Late submission", a.allowLateSubmission ? "Accepted" : "Blocked"], ["Status", a.isPublished ? "Published" : "Draft"], ["Faculty", a.faculty?.user?.name]]} />
        </Card>
      </div>

      <Card bodyClass="p-0" title="Submissions">
        <div className="px-4 pt-3">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: "all", label: "All", count: rows.length },
            { value: "submitted", label: "Submitted", count: count("submitted") },
            { value: "late", label: "Late", count: count("late") },
            { value: "evaluated", label: "Evaluated", count: count("evaluated") },
            { value: "resubmission_required", label: "Resubmission", count: count("resubmission_required") },
            { value: new Date(a.dueDate) < new Date() ? "missing" : "pending", label: new Date(a.dueDate) < new Date() ? "Missing" : "Pending", count: count("missing") + count("pending") },
          ]} />
        </div>
        <DataTable rows={filtered} rowKey={(r) => r.student._id} empty={{ title: "No students in this category" }} columns={[
          { key: "roll", label: "Roll No", render: (r) => r.student.rollNumber },
          { key: "name", label: "Student", render: (r) => r.student.name },
          { key: "submittedAt", label: "Submitted", hideOn: "md", render: (r) => (r.submission ? fmtDateTime(r.submission.submittedAt) : "—") },
          { key: "files", label: "Files", hideOn: "lg", render: (r) => (r.submission ? <FileList files={r.submission.files} /> : "—") },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          { key: "marks", label: "Marks", render: (r) => (r.submission?.marks !== undefined && r.submission?.marks !== null ? `${r.submission.marks}/${a.maxMarks}` : "—") },
          { key: "a", label: "", className: "text-right", render: (r) => r.submission && (
            <Button size="sm" variant={r.status === "evaluated" ? "secondary" : "soft"} onClick={() => setEvaluating(r)}>{r.status === "evaluated" ? "Update" : "Evaluate"}</Button>
          ) },
        ]} />
      </Card>
      {evaluating && <EvaluateModal row={evaluating} assignment={a} onClose={(changed) => { setEvaluating(null); if (changed) refetch(); }} />}
    </div>
  );
}
