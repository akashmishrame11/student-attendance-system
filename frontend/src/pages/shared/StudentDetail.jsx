import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage, fileUrl, toFormData } from "../../services/api";
import { Avatar, Badge, Button, Card, DataTable, ErrorState, FileInput, KeyValue, PageSkeleton, Select, Tabs, useConfirm } from "../../components/ui";
import AttendanceSummary from "../../features/attendance/AttendanceSummary";
import { fmtDate, fmtMoney, titleCase } from "../../utils/format";

function Documents({ student, onChange }) {
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const upload = async () => {
    if (!files?.length) return;
    setBusy(true);
    try {
      await api.post(`/students/${student._id}/documents`, toFormData({}, { files }));
      toast.success("Documents uploaded");
      setFiles(null);
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (i) => {
    if (!(await confirm({ title: "Remove document?", tone: "danger", confirmText: "Remove" }))) return;
    try {
      await api.delete(`/students/${student._id}/documents/${i}`);
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Card title="Documents" subtitle="ID proofs, mark sheets, certificates">
      <ul className="mb-4 divide-y divide-slate-100">
        {student.documents.length === 0 && <li className="py-3 text-sm text-slate-500">No documents uploaded.</li>}
        {student.documents.map((d, i) => (
          <li key={d.url} className="flex items-center justify-between gap-3 py-2.5">
            <a href={fileUrl(d.url)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-brand-700 hover:underline"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{d.name}</span></a>
            <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
      <FileInput multiple files={files} onChange={(e) => setFiles(e.target.files)} />
      <Button className="mt-3" icon={Upload} loading={busy} disabled={!files?.length} onClick={upload}>Upload</Button>
    </Card>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [tab, setTab] = useState("profile");
  const { data: s, loading, error, refetch } = useApi(`/students/${id}`);
  const { data: fees } = useApi(isAdmin && tab === "fees" ? `/fees/student/${id}` : null);
  const confirm = useConfirm();

  if (loading && !s) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const setStatus = async (status) => {
    if (!(await confirm({ title: `Change status to ${status}?`, message: status === "active" ? "The student will be able to log in." : "The student's login will be disabled." }))) return;
    try {
      const { data } = await api.patch(`/students/${id}/status`, { status });
      toast.success(data.message);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <Link to={`/${user.role}/students`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Back to students</Link>
      <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={s.user?.name} src={s.user?.avatar} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{s.user?.name}</h1>
            <Badge status={s.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{s.studentId} · Roll {s.rollNumber} · {s.user?.email}</p>
          <p className="mt-1 text-sm text-slate-600">{s.course?.name} · {s.semester?.name} · Section {s.section?.name || "—"}</p>
        </div>
        {isAdmin && (
          <div className="w-full sm:w-48">
            <Select value={s.status} onChange={(e) => setStatus(e.target.value)} placeholder={false} options={["active", "inactive", "graduated", "suspended"].map((v) => ({ value: v, label: `Status: ${titleCase(v)}` }))} />
          </div>
        )}
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: "profile", label: "Profile" }, { value: "attendance", label: "Attendance" }, ...(isAdmin ? [{ value: "fees", label: "Fees" }, { value: "documents", label: "Documents" }] : [])]} />

      {tab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Personal details">
            <KeyValue items={[["Gender", titleCase(s.gender || "")], ["Date of birth", fmtDate(s.dateOfBirth)], ["Phone", s.user?.phone], ["Address", s.address], ["Last login", s.user?.lastLogin ? fmtDate(s.user.lastLogin) : "Never"]]} />
          </Card>
          <Card title="Academic details">
            <KeyValue items={[["Department", s.department?.name], ["Course", `${s.course?.code} — ${s.course?.name}`], ["Semester", s.semester?.name], ["Section", s.section?.name], ["Batch", s.batch], ["Admission date", fmtDate(s.admissionDate)]]} />
          </Card>
          <Card title="Parent / guardian">
            <KeyValue items={[["Name", s.guardianName], ["Contact", s.guardianPhone]]} />
          </Card>
        </div>
      )}
      {tab === "attendance" && <AttendanceSummary endpoint={`/attendance/student/${id}`} />}
      {tab === "fees" && (
        <Card title="Fee records">
          {!fees ? <p className="text-sm text-slate-500">Loading…</p> : (
            <DataTable rows={fees.records} rowKey={(r) => r.fee._id} empty={{ title: "No fee structures apply" }} columns={[
              { key: "fee", label: "Fee", render: (r) => r.fee.name },
              { key: "total", label: "Total", render: (r) => fmtMoney(r.totalAmount) },
              { key: "paid", label: "Paid", render: (r) => fmtMoney(r.paid) },
              { key: "pending", label: "Pending", render: (r) => fmtMoney(r.pending) },
              { key: "fine", label: "Fine", render: (r) => (r.fine ? fmtMoney(r.fine) : "—") },
              { key: "due", label: "Due", render: (r) => fmtDate(r.dueDate) },
              { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
            ]} />
          )}
        </Card>
      )}
      {tab === "documents" && <Documents student={s} onChange={refetch} />}
    </div>
  );
}
