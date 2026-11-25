import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowLeft, BellRing, Eye, Pencil, Plus, Receipt, Trash2, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import { useApi, useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { Badge, Button, Card, DataTable, ErrorState, Field, FilterSelect, Input, Modal, PageHeader, PageSkeleton, Pagination, Select, StatCard, Tabs, useConfirm } from "../../components/ui";
import { PaymentModal, ReceiptModal, METHODS } from "../../features/fees/FeeComponents";
import { OPT, idOf } from "../../utils/options";
import { fmtDate, fmtDateTime, fmtMoney, titleCase, toInputDate } from "../../utils/format";

function FeeForm({ fee, onClose }) {
  const isEdit = Boolean(fee?._id);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    defaultValues: isEdit
      ? { ...fee, course: idOf(fee.course), semester: idOf(fee.semester), dueDate: toInputDate(fee.dueDate) }
      : { components: [{ name: "Tuition Fee", amount: "" }], finePerDay: 50, isActive: true },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "components" });
  const course = watch("course");
  const comps = watch("components") || [];
  const total = comps.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const { options: courses } = useOptions("/courses", OPT.course.map);
  const { options: semesters } = useOptions(course ? "/semesters" : null, OPT.semester.map, { course, sort: "number" });

  const save = async (v) => {
    setSaving(true);
    try {
      const body = { name: v.name, course: v.course, semester: v.semester, dueDate: v.dueDate, finePerDay: Number(v.finePerDay) || 0, isActive: v.isActive, components: v.components.map((c) => ({ name: c.name, amount: Number(c.amount) })) };
      const res = isEdit ? await api.put(`/fees/${fee._id}`, body) : await api.post("/fees", body);
      toast.success(res.data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={() => onClose(false)} size="lg" title={isEdit ? "Edit fee structure" : "Create fee structure"}
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" form="fee-form" loading={saving}>Save</Button></>}>
      <form id="fee-form" onSubmit={handleSubmit(save)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.message} className="sm:col-span-2"><Input {...register("name", { required: "Name is required" })} placeholder="Semester 3 Fee 2026-27" /></Field>
          <Field label="Course" required error={errors.course?.message}><Select {...register("course", { required: "Course is required", onChange: () => setValue("semester", "") })} options={courses} /></Field>
          <Field label="Semester" required error={errors.semester?.message}><Select {...register("semester", { required: "Semester is required" })} options={semesters} disabled={!course} /></Field>
          <Field label="Due date" required error={errors.dueDate?.message}><Input type="date" {...register("dueDate", { required: "Due date is required" })} /></Field>
          <Field label="Late fine per day (₹)"><Input type="number" min={0} {...register("finePerDay")} /></Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold">Fee components</h4><Button size="sm" variant="soft" icon={Plus} onClick={() => append({ name: "", amount: "" })}>Add</Button></div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input {...register(`components.${i}.name`, { required: true })} placeholder="Component" />
                <Input type="number" min={0} className="w-40" {...register(`components.${i}.amount`, { required: true, min: 0 })} placeholder="Amount" />
                <Button size="icon" variant="ghost" className="mt-0.5 text-rose-600" onClick={() => remove(i)} disabled={fields.length === 1}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          {errors.components && <p className="mt-1 text-xs text-rose-600">Each component needs a name and amount.</p>}
          <p className="mt-3 text-right text-sm">Total: <b>{fmtMoney(total)}</b></p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" {...register("isActive")} /> Active</label>
      </form>
    </Modal>
  );
}

function Structures() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [course, setCourse] = useState("");
  const { options: courses } = useOptions("/courses", OPT.course.map);
  const { data, meta, loading, error, refetch } = useApi("/fees", { page, limit: 10, course: course || undefined });
  const remind = async (f) => {
    try {
      const { data: res } = await api.post(`/fees/${f._id}/reminders`);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (f) => {
    if (!(await confirm({ title: "Delete fee structure?", message: "Blocked if payments exist.", tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api.delete(`/fees/${f._id}`, { params: { permanent: true } });
      toast.success("Deleted");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Card bodyClass="p-0" title="Fee structures" actions={<><FilterSelect value={course} onChange={setCourse} options={courses} placeholder="All courses" /><Button size="sm" icon={Plus} onClick={() => setEditing({})}>New structure</Button></>}>
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} onRowClick={(r) => navigate(`/admin/fees/${r._id}`)} empty={{ title: "No fee structures" }} columns={[
        { key: "name", label: "Fee", render: (r) => <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.course?.code} · {r.semester?.name} · {r.academicYear}</p></div> },
        { key: "components", label: "Components", hideOn: "lg", render: (r) => r.components.map((c) => c.name).join(", ") },
        { key: "totalAmount", label: "Amount", render: (r) => <span className="font-medium">{fmtMoney(r.totalAmount)}</span> },
        { key: "dueDate", label: "Due", render: (r) => <span className={new Date(r.dueDate) < new Date() ? "text-rose-600" : ""}>{fmtDate(r.dueDate)}</span> },
        { key: "fine", label: "Fine/day", hideOn: "md", render: (r) => fmtMoney(r.finePerDay) },
        { key: "isActive", label: "Status", render: (r) => <Badge status={r.isActive ? "active" : "inactive"} /> },
        { key: "a", label: "", className: "text-right whitespace-nowrap", render: (r) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" title="Student status" onClick={() => navigate(`/admin/fees/${r._id}`)}><Eye className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Send reminders" onClick={() => remind(r)}><BellRing className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" title="Delete" className="text-rose-600" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ) },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
      {editing && <FeeForm fee={editing} onClose={(c) => { setEditing(null); if (c) refetch(); }} />}
    </Card>
  );
}

function Payments() {
  const [page, setPage] = useState(1);
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [paying, setPaying] = useState(false);
  const { data, meta, loading, error, refetch } = useApi("/fees/payments", { page, limit: 15, method: method || undefined, from: from || undefined, to: to || undefined });
  return (
    <Card bodyClass="p-0" title="Payment records" subtitle={meta && `Collected ${fmtMoney(meta.totalAmount)} + fines ${fmtMoney(meta.totalFine)} in this view`} actions={
      <>
        <FilterSelect value={method} onChange={(v) => { setMethod(v); setPage(1); }} options={METHODS} placeholder="Any method" />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        <Button size="sm" icon={Wallet} onClick={() => setPaying(true)}>Record payment</Button>
      </>
    }>
      <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} empty={{ title: "No payments" }} columns={[
        { key: "receiptNo", label: "Receipt", render: (r) => <span className="font-mono text-xs">{r.receiptNo}</span> },
        { key: "paidAt", label: "Date", render: (r) => fmtDateTime(r.paidAt) },
        { key: "student", label: "Student", render: (r) => `${r.student?.rollNumber} — ${r.student?.user?.name}` },
        { key: "fee", label: "Fee", hideOn: "lg", render: (r) => r.fee?.name },
        { key: "amount", label: "Amount", render: (r) => <span className="font-medium">{fmtMoney(r.amount)}</span> },
        { key: "fine", label: "Fine", hideOn: "md", render: (r) => (r.fine ? fmtMoney(r.fine) : "—") },
        { key: "method", label: "Method", hideOn: "md", render: (r) => titleCase(r.method) },
        { key: "a", label: "", className: "text-right", render: (r) => <Button size="icon" variant="ghost" title="Receipt" onClick={() => setReceipt(r._id)}><Receipt className="h-4 w-4" /></Button> },
      ]} />
      <Pagination meta={meta} onPage={setPage} />
      <ReceiptModal id={receipt} onClose={() => setReceipt(null)} />
      <PaymentModal open={paying} onClose={(id) => { setPaying(false); if (id) { refetch(); setReceipt(id); } }} />
    </Card>
  );
}

export default function Fees() {
  const [tab, setTab] = useState("structures");
  const { data } = useApi("/reports/fees");
  const total = data?.rows.reduce((s, r) => s + r.amount, 0) || 0;
  return (
    <>
      <PageHeader title="Fees Management" subtitle="Fee structures, student dues, payments and receipts" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total collected" value={data ? fmtMoney(total) : null} loading={!data} icon={Wallet} tone="green" />
        <StatCard label="Payments" value={data?.count} loading={!data} icon={Receipt} />
        <StatCard label="Fines collected" value={data ? fmtMoney(data.rows.reduce((s, r) => s + (r.fine || 0), 0)) : null} loading={!data} icon={BellRing} tone="amber" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "structures", label: "Fee structures" }, { value: "payments", label: "Payments" }]} />
      {tab === "structures" ? <Structures /> : <Payments />}
    </>
  );
}

export function FeeStatus() {
  const { id } = useParams();
  const [status, setStatus] = useState("");
  const [paying, setPaying] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const { data, loading, error, refetch } = useApi(`/fees/${id}/status`, { status: status || undefined });
  if (loading && !data) return <PageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const { fee, summary, rows } = data;
  return (
    <div className="space-y-6">
      <Link to="/admin/fees" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Fees</Link>
      <PageHeader title={fee.name} subtitle={`${fee.course?.code} · ${fee.semester?.name} · ${fmtMoney(fee.totalAmount)} due ${fmtDate(fee.dueDate)} · fine ${fmtMoney(fee.finePerDay)}/day`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Expected" value={fmtMoney(summary.expected)} />
        <StatCard label="Collected" value={fmtMoney(summary.collected)} tone="green" />
        <StatCard label="Outstanding" value={fmtMoney(summary.expected - summary.collected)} tone="red" />
        <StatCard label="Fully paid" value={`${summary.paidCount}/${summary.students}`} tone="violet" />
      </div>
      <Card bodyClass="p-0" title="Student fee records" actions={<FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={["paid", "partial", "unpaid", "overdue"].map((s) => ({ value: s, label: titleCase(s) }))} />}>
        <DataTable rows={rows} rowKey={(r) => r.student._id} empty={{ title: "No students" }} columns={[
          { key: "roll", label: "Roll No", render: (r) => r.student.rollNumber },
          { key: "name", label: "Student", render: (r) => r.student.name },
          { key: "section", label: "Sec", hideOn: "sm", render: (r) => r.student.section },
          { key: "paid", label: "Paid", render: (r) => fmtMoney(r.paid) },
          { key: "pending", label: "Pending", render: (r) => fmtMoney(r.pending) },
          { key: "fine", label: "Fine", hideOn: "md", render: (r) => (r.fine ? fmtMoney(r.fine) : "—") },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          { key: "a", label: "", className: "text-right", render: (r) => r.pending > 0 && <Button size="sm" variant="soft" onClick={() => setPaying(r.student._id)}>Collect</Button> },
        ]} />
      </Card>
      {paying && <PaymentModal open studentId={paying} feeId={fee._id} onClose={(pid) => { setPaying(null); if (pid) { refetch(); setReceipt(pid); } }} />}
      <ReceiptModal id={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
