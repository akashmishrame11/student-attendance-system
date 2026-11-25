import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage, toFormData } from "../../services/api";
import { Avatar, Badge, Button, Card, DataTable, Field, FilterSelect, Modal, PageHeader, Pagination, Tabs, Textarea, useConfirm } from "../../components/ui";
import { ResourceForm } from "../../features/resource/ResourceForm";
import { FileList } from "./AssignmentDetail";
import { fmtDate, titleCase } from "../../utils/format";

const TYPES = ["sick", "casual", "medical", "personal", "academic", "other"].map((t) => ({ value: t, label: titleCase(t) }));
const STATUS = ["pending", "approved", "rejected"].map((s) => ({ value: s, label: titleCase(s) }));
const days = (l) => Math.round((new Date(l.toDate) - new Date(l.fromDate)) / 864e5) + 1;

function ApplyModal({ onClose }) {
  const [saving, setSaving] = useState(false);
  const fields = [
    { name: "leaveType", label: "Leave type", type: "select", options: TYPES, placeholder: false },
    { name: "fromDate", label: "From", type: "date", required: true },
    { name: "toDate", label: "To", type: "date", required: true },
    { name: "reason", label: "Reason", type: "textarea", required: true, rules: { minLength: { value: 5, message: "Please describe the reason" } } },
    { name: "document", label: "Supporting document (optional)", type: "file", accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
  ];
  const submit = async (v) => {
    if (v.toDate < v.fromDate) return toast.error("'To' date must be on or after 'From' date");
    setSaving(true);
    try {
      const { document, ...rest } = v;
      const { data } = await api.post("/leaves", toFormData(rest, { document }));
      toast.success(data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={() => onClose(false)} title="Apply for leave" footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" form="leave-form" loading={saving}>Submit application</Button></>}>
      <ResourceForm id="leave-form" fields={fields} onSubmit={submit} defaultValues={{ leaveType: "casual" }} />
    </Modal>
  );
}

function ReviewModal({ leave, onClose }) {
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState("");
  const act = async (status) => {
    setBusy(status);
    try {
      const { data } = await api.patch(`/leaves/${leave._id}/review`, { status, remarks });
      toast.success(data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy("");
    }
  };
  return (
    <Modal open onClose={() => onClose(false)} title={`Leave request — ${leave.applicant?.name}`} subtitle={`${titleCase(leave.leaveType)} · ${fmtDate(leave.fromDate)} → ${fmtDate(leave.toDate)} (${days(leave)} day${days(leave) > 1 ? "s" : ""})`}
      footer={<><Button variant="danger" icon={X} loading={busy === "rejected"} onClick={() => act("rejected")}>Reject</Button><Button variant="success" icon={Check} loading={busy === "approved"} onClick={() => act("approved")}>Approve</Button></>}>
      <div className="space-y-4">
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{leave.reason}</p>
        {leave.document && <FileList files={[leave.document]} />}
        <Field label="Remarks"><Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional note to the applicant" /></Field>
      </div>
    </Modal>
  );
}

function LeaveTable({ mine, roleFilter }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [status, setStatus] = useState(mine ? "" : "pending");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState(null);
  const [applying, setApplying] = useState(false);
  const { data, meta, loading, error, refetch } = useApi("/leaves", { page, limit: 12, status: status || undefined, role: role || undefined, mine: mine && user.role === "faculty" ? "true" : undefined });
  const cancel = async (l) => {
    if (!(await confirm({ title: "Cancel leave request?", tone: "danger", confirmText: "Cancel request" }))) return;
    try {
      await api.delete(`/leaves/${l._id}`);
      toast.success("Request cancelled");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Card bodyClass="p-0" title={mine ? "My leave applications" : "Leave requests to review"} actions={
      <>
        {roleFilter && <FilterSelect value={role} onChange={(v) => { setRole(v); setPage(1); }} options={[{ value: "student", label: "Students" }, { value: "faculty", label: "Faculty" }]} placeholder="All applicants" />}
        <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={STATUS} placeholder="Any status" />
        {mine && <Button size="sm" icon={Plus} onClick={() => setApplying(true)}>Apply for leave</Button>}
      </>
    }>
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} empty={{ title: mine ? "No leave applications" : "No leave requests" }} columns={[
        ...(!mine ? [{ key: "applicant", label: "Applicant", render: (l) => <div className="flex items-center gap-2"><Avatar size="sm" name={l.applicant?.name} src={l.applicant?.avatar} /><div><p className="font-medium">{l.applicant?.name}</p><p className="text-xs text-slate-500">{titleCase(l.role)}</p></div></div> }] : []),
        { key: "leaveType", label: "Type", render: (l) => titleCase(l.leaveType) },
        { key: "dates", label: "Dates", render: (l) => `${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)}` },
        { key: "days", label: "Days", hideOn: "sm", render: days },
        { key: "reason", label: "Reason", hideOn: "lg", className: "max-w-xs truncate", render: (l) => l.reason },
        { key: "status", label: "Status", render: (l) => <Badge status={l.status} /> },
        { key: "remarks", label: "Remarks", hideOn: "md", render: (l) => l.remarks ? <span title={l.remarks}>{l.remarks} <span className="text-xs text-slate-400">— {l.reviewedBy?.name}</span></span> : "—" },
        { key: "a", label: "", className: "text-right", render: (l) => mine
          ? l.status === "pending" && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => cancel(l)}>Cancel</Button>
          : l.status === "pending" && <Button size="sm" variant="soft" onClick={() => setReviewing(l)}>Review</Button> },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
      {reviewing && <ReviewModal leave={reviewing} onClose={(c) => { setReviewing(null); if (c) refetch(); }} />}
      {applying && <ApplyModal onClose={(c) => { setApplying(false); if (c) refetch(); }} />}
    </Card>
  );
}

export default function Leaves() {
  const { user } = useAuth();
  const [tab, setTab] = useState(user.role === "student" ? "mine" : "review");
  return (
    <>
      <PageHeader title={user.role === "student" ? "Leave Application" : "Leave Requests"} subtitle={user.role === "admin" ? "Approve or reject student and faculty leave" : user.role === "faculty" ? "Review your students' leave and apply for your own" : "Apply for leave and track approval status"} />
      {user.role === "faculty" && <Tabs value={tab} onChange={setTab} tabs={[{ value: "review", label: "Student requests" }, { value: "mine", label: "My leave" }]} />}
      {tab === "mine" ? <LeaveTable mine /> : <LeaveTable roleFilter={user.role === "admin"} />}
    </>
  );
}
