import { useState } from "react";
import { MessageSquarePlus, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi, useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { Badge, Button, Card, DataTable, Field, FilterSelect, Modal, PageHeader, Pagination, Select, StatCard, Tabs, Textarea } from "../../components/ui";
import { ResourceForm } from "../../features/resource/ResourceForm";
import { fmtDate, fmtDateTime, titleCase } from "../../utils/format";

const CATEGORIES = ["academic", "attendance_correction", "profile_correction", "infrastructure", "hostel", "transport", "library", "fees", "other"].map((c) => ({ value: c, label: titleCase(c) }));
const STATUS = ["open", "in_progress", "resolved", "closed"].map((s) => ({ value: s, label: titleCase(s) }));
const FB_CATS = ["teaching", "facilities", "curriculum", "administration", "app", "other"].map((c) => ({ value: c, label: titleCase(c) }));

function Stars({ value }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}</span>;
}

function NewComplaint({ onClose, defaults }) {
  const [saving, setSaving] = useState(false);
  const fields = [
    { name: "category", label: "Category", type: "select", options: CATEGORIES, required: true },
    { name: "priority", label: "Priority", type: "select", options: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }], placeholder: false },
    { name: "subject", label: "Subject", required: true, colSpan: 2, rules: { minLength: { value: 3, message: "Too short" } } },
    { name: "description", label: "Description", type: "textarea", required: true, rules: { minLength: { value: 10, message: "Please give at least 10 characters" } } },
  ];
  const submit = async (v) => {
    setSaving(true);
    try {
      const { data } = await api.post("/complaints", v);
      toast.success(data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={() => onClose(false)} title="Submit a complaint / request" footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" form="complaint-form" loading={saving}>Submit</Button></>}>
      <ResourceForm id="complaint-form" fields={fields} onSubmit={submit} defaultValues={{ priority: "medium", ...defaults }} />
    </Modal>
  );
}

function RespondModal({ complaint, onClose }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(complaint.status);
  const [response, setResponse] = useState(complaint.response || "");
  const [assignedTo, setAssignedTo] = useState(complaint.assignedTo?._id || "");
  const [category, setCategory] = useState(complaint.category);
  const [saving, setSaving] = useState(false);
  const { options: staff } = useOptions(user.role === "admin" ? "/users" : null, (u) => ({ value: u._id, label: `${u.name} (${u.role})` }), { limit: 200, isActive: "true" });
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/complaints/${complaint._id}`, { status, response, ...(user.role === "admin" ? { assignedTo, category } : {}) });
      toast.success(data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={() => onClose(false)} title={complaint.subject} subtitle={`${complaint.user?.name} · ${fmtDateTime(complaint.createdAt)}`}
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button loading={saving} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{complaint.description}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS} placeholder={false} /></Field>
          {user.role === "admin" && <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES} placeholder={false} /></Field>}
          {user.role === "admin" && <Field label="Assign to" className="sm:col-span-2"><Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} options={staff.filter((s) => !s.label.endsWith("(student)"))} placeholder="Unassigned" /></Field>}
        </div>
        <Field label="Response"><Textarea rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Reply to the user" /></Field>
      </div>
    </Modal>
  );
}

export function ComplaintList({ admin }) {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [responding, setResponding] = useState(null);
  const { data, meta, loading, error, refetch } = useApi("/complaints", { page, limit: 12, status: status || undefined, category: category || undefined });
  return (
    <Card bodyClass="p-0" title={admin ? "All complaints" : "My complaints & requests"} actions={
      <>
        <FilterSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={CATEGORIES} placeholder="All categories" />
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS} placeholder="Any status" />
        {!admin && <Button size="sm" icon={MessageSquarePlus} onClick={() => setCreating(true)}>New complaint</Button>}
      </>
    }>
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} empty={{ title: "No complaints" }} columns={[
        { key: "subject", label: "Subject", render: (c) => <div><p className="font-medium text-slate-900">{c.subject}</p><p className="text-xs text-slate-500">{titleCase(c.category)}{admin ? ` · ${c.user?.name} (${c.user?.role})` : ""}</p></div> },
        { key: "priority", label: "Priority", hideOn: "sm", render: (c) => <Badge status={c.priority} /> },
        { key: "createdAt", label: "Raised", hideOn: "md", render: (c) => fmtDate(c.createdAt) },
        { key: "assignedTo", label: "Assigned", hideOn: "lg", render: (c) => c.assignedTo?.name || "—" },
        { key: "status", label: "Status", render: (c) => <Badge status={c.status} /> },
        { key: "response", label: "Response", hideOn: "md", className: "max-w-xs", render: (c) => <span className="line-clamp-2 text-xs">{c.response || "—"}</span> },
        { key: "a", label: "", className: "text-right", render: (c) => (admin || String(c.assignedTo?._id) === String(user._id)) && <Button size="sm" variant="soft" onClick={() => setResponding(c)}>Respond</Button> },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
      {creating && <NewComplaint onClose={(ch) => { setCreating(false); if (ch) refetch(); }} />}
      {responding && <RespondModal complaint={responding} onClose={(ch) => { setResponding(null); if (ch) refetch(); }} />}
    </Card>
  );
}

function FeedbackForm() {
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(0);
  const [key, setKey] = useState(0);
  const fields = [
    { name: "category", label: "About", type: "select", options: FB_CATS, placeholder: false },
    { name: "message", label: "Your feedback", type: "textarea", required: true, rules: { minLength: { value: 3, message: "Too short" } } },
    { name: "isAnonymous", type: "checkbox", checkboxLabel: "Submit anonymously" },
  ];
  const submit = async (v) => {
    if (!rating) return toast.error("Please choose a rating");
    setSaving(true);
    try {
      const { data } = await api.post("/feedback", { ...v, rating });
      toast.success(data.message);
      setRating(0);
      setKey((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Share feedback" className="max-w-2xl">
      <div className="mb-4">
        <p className="mb-1.5 text-sm font-medium text-slate-700">Rating <span className="text-rose-500">*</span></p>
        <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`}><Star className={`h-7 w-7 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>)}</div>
      </div>
      <ResourceForm key={key} id="feedback-form" fields={fields} onSubmit={submit} defaultValues={{ category: "teaching" }} />
      <div className="mt-4 flex justify-end"><Button type="submit" form="feedback-form" loading={saving}>Submit feedback</Button></div>
    </Card>
  );
}

export function FeedbackList() {
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useApi("/feedback", { page, limit: 12, category: category || undefined });
  return (
    <>
      <PageHeader title="Feedback" subtitle="Ratings and suggestions from students and faculty" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Average rating" value={meta ? `${meta.averageRating} / 5` : null} loading={!meta} icon={Star} tone="amber" />
        <StatCard label="Responses" value={meta?.total} loading={!meta} />
      </div>
      <Card bodyClass="p-0" actions={<FilterSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={FB_CATS} placeholder="All categories" />} title="All feedback">
        <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} empty={{ title: "No feedback yet" }} columns={[
          { key: "rating", label: "Rating", render: (f) => <Stars value={f.rating} /> },
          { key: "category", label: "About", render: (f) => titleCase(f.category) + (f.subject ? ` · ${f.subject.code}` : "") },
          { key: "message", label: "Feedback", className: "max-w-md", render: (f) => <span className="line-clamp-2">{f.message}</span> },
          { key: "user", label: "From", hideOn: "md", render: (f) => `${f.user?.name} (${titleCase(f.user?.role || "")})` },
          { key: "createdAt", label: "Date", hideOn: "sm", render: (f) => fmtDate(f.createdAt) },
        ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}

/** Student/faculty help desk: complaints + feedback. */
export default function HelpDesk() {
  const [tab, setTab] = useState("complaints");
  return (
    <>
      <PageHeader title="Complaints & Feedback" subtitle="Raise issues (incl. attendance or profile corrections) and share feedback" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "complaints", label: "Complaints" }, { value: "feedback", label: "Give feedback" }]} />
      {tab === "complaints" ? <ComplaintList /> : <FeedbackForm />}
    </>
  );
}

export function AdminComplaints() {
  return (
    <>
      <PageHeader title="Complaints" subtitle="Assign, respond and resolve complaints and correction requests" />
      <ComplaintList admin />
    </>
  );
}
