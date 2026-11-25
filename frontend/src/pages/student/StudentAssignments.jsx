import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, ClipboardList, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage, toFormData } from "../../services/api";
import { AsyncBlock, Badge, Button, Card, ErrorState, Field, FileInput, KeyValue, PageHeader, PageSkeleton, Pagination, Tabs, Textarea } from "../../components/ui";
import { FileList } from "../shared/AssignmentDetail";
import { fmtDateTime, titleCase } from "../../utils/format";

function dueLabel(due) {
  const ms = new Date(due) - Date.now();
  if (ms < 0) return "Deadline passed";
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

export function StudentAssignments() {
  const [status, setStatus] = useState("upcoming");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useApi("/assignments", { status: status === "all" ? undefined : status, page, limit: 12, sort: status === "upcoming" ? "dueDate" : "-dueDate" });
  return (
    <>
      <PageHeader title="Assignments" subtitle="View, download and submit your assignments" />
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: "upcoming", label: "Open" }, { value: "past", label: "Past deadline" }, { value: "all", label: "All" }]} />
      <AsyncBlock loading={loading && !data} error={error} onRetry={refetch} empty={!data?.length} emptyProps={{ icon: ClipboardList, title: "No assignments here", message: status === "upcoming" ? "You have no open assignments." : undefined }}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((a) => (
            <Link key={a._id} to={`/student/assignments/${a._id}`} className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <Badge tone="blue">{a.subject?.code}</Badge>
                <Badge status={a.submissionStatus}>{a.submissionStatus === "late" ? "Late submitted" : titleCase(a.submissionStatus)}</Badge>
              </div>
              <h3 className="mt-3 line-clamp-2 font-semibold text-slate-900">{a.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.description}</p>
              <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{fmtDateTime(a.dueDate)}</span>
                <span className="font-medium">{a.submission?.marks !== undefined && a.submission?.marks !== null ? `${a.submission.marks}/${a.maxMarks}` : dueLabel(a.dueDate)}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4"><Pagination meta={meta} onPage={setPage} /></div>
      </AsyncBlock>
    </>
  );
}

export function StudentAssignmentDetail() {
  const { id } = useParams();
  const { data: a, loading, error, refetch } = useApi(`/assignments/${id}`);
  const [text, setText] = useState("");
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  if (loading && !a) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const sub = a.submission;
  const overdue = new Date(a.dueDate) < new Date();
  const canSubmit = !sub ? !overdue || a.allowLateSubmission : sub.status === "resubmission_required" || (a.allowResubmission && sub.status !== "evaluated");

  const submit = async () => {
    if (!text.trim() && !files?.length) return toast.error("Write an answer or attach at least one file");
    setBusy(true);
    try {
      const { data } = await api.post(`/assignments/${id}/submit`, toFormData({ textAnswer: text }, { files }));
      toast.success(data.message);
      setText("");
      setFiles(null);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/student/assignments" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> All assignments</Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={a.title} subtitle={`${a.subject?.code} — ${a.subject?.name} · ${a.faculty?.user?.name}`} className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{a.description}</p>
          {a.instructions && <><p className="mt-4 text-xs font-semibold uppercase text-slate-500">Instructions</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{a.instructions}</p></>}
          <p className="mt-4 text-xs font-semibold uppercase text-slate-500">Attachments</p>
          <div className="mt-1"><FileList files={a.attachments} /></div>
        </Card>
        <Card title="Submission status">
          <KeyValue items={[
            ["Deadline", <span key="d" className={overdue ? "text-rose-600" : ""}>{fmtDateTime(a.dueDate)} ({dueLabel(a.dueDate)})</span>],
            ["Status", <Badge key="s" status={sub ? sub.status : overdue ? "missing" : "pending"} />],
            ["Marks", sub?.marks !== undefined && sub?.marks !== null ? `${sub.marks} / ${a.maxMarks}` : `— / ${a.maxMarks}`],
            ["Resubmission", a.allowResubmission ? "Allowed" : "Not allowed"],
          ]} />
          {sub?.feedback && <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900"><p className="text-xs font-semibold uppercase">Faculty feedback</p><p className="mt-1">{sub.feedback}</p></div>}
        </Card>
      </div>

      {sub && (
        <Card title="Your submission" subtitle={`Submitted ${fmtDateTime(sub.submittedAt)} · attempt ${sub.attempts}`}>
          {sub.textAnswer && <p className="mb-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{sub.textAnswer}</p>}
          <FileList files={sub.files} />
          {sub.history?.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-slate-500">Previous attempts ({sub.history.length})</summary>
              <ul className="mt-2 space-y-3">
                {sub.history.map((h, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{fmtDateTime(h.submittedAt)}{h.feedback ? ` · Feedback: ${h.feedback}` : ""}</p>
                    {h.textAnswer && <p className="mt-1 whitespace-pre-wrap">{h.textAnswer}</p>}
                    <div className="mt-1"><FileList files={h.files} /></div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}

      {canSubmit ? (
        <Card title={sub ? "Resubmit" : "Submit your work"} subtitle={overdue ? "The deadline has passed — this will be marked as a late submission." : "PDF, DOC, DOCX, JPG or PNG up to 10MB each (max 5 files)."}>
          <div className="space-y-4">
            <Field label="Text answer"><Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer or a note for your faculty…" /></Field>
            <Field label="Upload files"><FileInput multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.ppt,.pptx,.zip" files={files} onChange={(e) => setFiles(e.target.files)} /></Field>
            <Button icon={Send} loading={busy} onClick={submit}>{sub ? "Resubmit" : "Submit assignment"}</Button>
          </div>
        </Card>
      ) : !sub && overdue ? (
        <Card><p className="text-sm text-rose-600">The deadline has passed and late submissions are not accepted for this assignment.</p></Card>
      ) : null}
    </div>
  );
}
