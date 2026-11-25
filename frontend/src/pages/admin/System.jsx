import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { KeyRound, Plus, Power, Save, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi, useDebounce } from "../../hooks/useApi";
import api, { errorMessage, fileUrl, toFormData } from "../../services/api";
import { Avatar, Badge, Button, Card, Checkbox, DataTable, Field, FileInput, FilterSelect, Input, Modal, PageHeader, PageSkeleton, Pagination, SearchInput, Select, useConfirm } from "../../components/ui";
import { ResourceForm } from "../../features/resource/ResourceForm";
import { fmtDateTime, titleCase } from "../../utils/format";

/* --------------------------------------------------------------- settings */
export function Settings() {
  const { data, loading, refetch } = useApi("/settings");
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control, reset } = useForm();
  const grading = useFieldArray({ control, name: "grading" });
  const slots = useFieldArray({ control, name: "timeSlots" });
  useEffect(() => { if (data) reset(data); }, [data, reset]);
  if (loading && !data) return <PageSkeleton />;

  const save = async (v) => {
    setSaving(true);
    try {
      const body = {
        collegeName: v.collegeName, address: v.address, contactEmail: v.contactEmail, contactPhone: v.contactPhone, academicYear: v.academicYear, semesterSystem: v.semesterSystem,
        minAttendancePercent: Number(v.minAttendancePercent), attendanceEditWindowDays: Number(v.attendanceEditWindowDays), allowLateSubmission: v.allowLateSubmission,
        maxUploadSizeMb: Number(v.maxUploadSizeMb), libraryFinePerDay: Number(v.libraryFinePerDay), libraryLoanDays: Number(v.libraryLoanDays),
        grading: v.grading.map((g) => ({ grade: g.grade, min: Number(g.min), point: Number(g.point) })),
        timeSlots: v.timeSlots, notifications: v.notifications,
      };
      await api.put("/settings", toFormData(body, { logo }));
      toast.success("Settings saved");
      setLogo(null);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const n = (name, label, props = {}) => <Field label={label}><Input type="number" {...register(name)} {...props} /></Field>;

  return (
    <form onSubmit={handleSubmit(save)}>
      <PageHeader title="System Settings" subtitle="College profile, academic rules and system preferences" actions={<Button type="submit" icon={Save} loading={saving}>Save settings</Button>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="College profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="College name" className="sm:col-span-2"><Input {...register("collegeName", { required: true })} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input {...register("address")} /></Field>
            <Field label="Contact email"><Input type="email" {...register("contactEmail")} /></Field>
            <Field label="Contact phone"><Input {...register("contactPhone")} /></Field>
            <Field label="College logo" className="sm:col-span-2">
              <div className="flex items-center gap-4">
                {data?.collegeLogo && <img src={fileUrl(data.collegeLogo)} alt="logo" className="h-14 w-14 rounded-lg border border-slate-200 object-contain" />}
                <FileInput accept=".png,.jpg,.jpeg,.webp" files={logo} onChange={(e) => setLogo(e.target.files)} className="flex-1" />
              </div>
            </Field>
          </div>
        </Card>
        <Card title="Academic configuration">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Academic year"><Input {...register("academicYear")} placeholder="2026-2027" /></Field>
            <Field label="Semester system"><Select {...register("semesterSystem")} options={[{ value: "semester", label: "Semester" }, { value: "trimester", label: "Trimester" }, { value: "annual", label: "Annual" }]} placeholder={false} /></Field>
            {n("minAttendancePercent", "Minimum attendance %", { min: 0, max: 100 })}
            {n("attendanceEditWindowDays", "Faculty attendance edit window (days)", { min: 0 })}
            {n("maxUploadSizeMb", "Max upload size (MB)", { min: 1, max: 50 })}
            <div className="flex items-end pb-2"><Checkbox {...register("allowLateSubmission")} label="Allow late assignment submissions by default" /></div>
            {n("libraryFinePerDay", "Library fine per day (₹)", { min: 0 })}
            {n("libraryLoanDays", "Library loan period (days)", { min: 1 })}
          </div>
        </Card>
        <Card title="Grading system" actions={<Button size="sm" variant="soft" icon={Plus} onClick={() => grading.append({ grade: "", min: 0, point: 0 })}>Add grade</Button>}>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-semibold uppercase text-slate-500"><span>Grade</span><span>Min %</span><span>Grade point</span><span className="w-8" /></div>
            {grading.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input {...register(`grading.${i}.grade`)} /><Input type="number" {...register(`grading.${i}.min`)} /><Input type="number" {...register(`grading.${i}.point`)} />
                <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => grading.remove(i)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Time slots" actions={<Button size="sm" variant="soft" icon={Plus} onClick={() => slots.append({ label: "", startTime: "", endTime: "" })}>Add slot</Button>}>
          <div className="space-y-2">
            {slots.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input {...register(`timeSlots.${i}.label`)} placeholder="Period 1" /><Input type="time" {...register(`timeSlots.${i}.startTime`)} /><Input type="time" {...register(`timeSlots.${i}.endTime`)} />
                <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => slots.remove(i)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Notification settings" subtitle={data?.system ? `Email: ${data.system.mail === "none" ? "not configured (set SMTP_* in backend .env)" : data.system.mail} · File storage: ${data.system.storage}` : undefined}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox {...register("notifications.assignment")} label="Assignment notifications" />
            <Checkbox {...register("notifications.attendance")} label="Low attendance warnings" />
            <Checkbox {...register("notifications.fee")} label="Fee reminders" />
            <Checkbox {...register("notifications.email")} label="Also send notifications by email" />
          </div>
        </Card>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ users */
export function Users() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [resetting, setResetting] = useState(null);
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const q = useDebounce(search);
  const { data, meta, loading, error, refetch } = useApi("/users", { page, limit: 15, role: role || undefined, search: q || undefined });

  const toggle = async (u) => {
    if (!(await confirm({ title: `${u.isActive ? "Deactivate" : "Activate"} account?`, message: `${u.name} will ${u.isActive ? "no longer" : "now"} be able to log in.`, tone: u.isActive ? "danger" : undefined }))) return;
    try {
      const { data: res } = await api.patch(`/users/${u._id}/status`, { isActive: !u.isActive });
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const doReset = async () => {
    try {
      await api.patch(`/users/${resetting._id}/password`, { password });
      toast.success("Password reset");
      setResetting(null);
      setPassword("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const createAdmin = async (v) => {
    try {
      await api.post("/users/admins", v);
      toast.success("Admin account created");
      setCreating(false);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="User Accounts" subtitle="Activate/deactivate logins and reset passwords" actions={<Button icon={Plus} onClick={() => setCreating(true)}>New admin</Button>} />
      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, email or username…" className="sm:max-w-xs sm:flex-1" />
          <FilterSelect value={role} onChange={(v) => { setRole(v); setPage(1); }} options={["admin", "faculty", "student"].map((r) => ({ value: r, label: titleCase(r) }))} placeholder="All roles" />
        </div>
        <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} columns={[
          { key: "name", label: "User", render: (u) => <div className="flex items-center gap-3"><Avatar size="sm" name={u.name} src={u.avatar} /><div><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></div></div> },
          { key: "username", label: "Username", hideOn: "md" },
          { key: "role", label: "Role", render: (u) => <Badge tone={u.role === "admin" ? "violet" : u.role === "faculty" ? "blue" : "slate"}>{titleCase(u.role)}</Badge> },
          { key: "lastLogin", label: "Last login", hideOn: "md", render: (u) => (u.lastLogin ? fmtDateTime(u.lastLogin) : "Never") },
          { key: "isActive", label: "Status", render: (u) => <Badge status={u.isActive ? "active" : "inactive"} /> },
          { key: "a", label: "", className: "text-right whitespace-nowrap", render: (u) => (
            <>
              <Button size="icon" variant="ghost" title="Reset password" onClick={() => setResetting(u)}><KeyRound className="h-4 w-4" /></Button>
              {u._id !== me._id && <Button size="icon" variant="ghost" title={u.isActive ? "Deactivate" : "Activate"} className={u.isActive ? "text-rose-600" : "text-emerald-600"} onClick={() => toggle(u)}><Power className="h-4 w-4" /></Button>}
            </>
          ) },
        ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      <Modal open={Boolean(resetting)} onClose={() => setResetting(null)} size="sm" title={`Reset password — ${resetting?.name}`} footer={<><Button variant="secondary" onClick={() => setResetting(null)}>Cancel</Button><Button onClick={doReset} disabled={password.length < 8}>Reset</Button></>}>
        <Field label="New password" hint="At least 8 characters with a letter and a number"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Create admin account" footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" form="admin-form">Create</Button></>}>
        <ResourceForm id="admin-form" onSubmit={createAdmin} fields={[
          { name: "name", label: "Name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "username", label: "Username" },
          { name: "phone", label: "Phone" },
          { name: "password", label: "Password", type: "password", required: true, rules: { minLength: { value: 8, message: "Min 8 characters" } } },
        ]} />
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------- audit logs */
export function AuditLogs() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const { data, meta, loading, error, refetch } = useApi("/audit-logs", { page, limit: 20, entity: entity || undefined });
  const entities = ["Student", "Faculty", "Department", "Course", "Semester", "Section", "Subject", "Timetable", "Attendance", "Examination", "FeePayment", "Notice", "User", "Settings"];
  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Important administrative operations" />
      <Card bodyClass="p-0" actions={<FilterSelect value={entity} onChange={(v) => { setEntity(v); setPage(1); }} options={entities.map((e) => ({ value: e, label: e }))} placeholder="All entities" />} title="Activity">
        <DataTable dense loading={loading && !data} error={error} onRetry={refetch} rows={data} columns={[
          { key: "createdAt", label: "When", render: (l) => fmtDateTime(l.createdAt) },
          { key: "user", label: "User", render: (l) => l.user ? `${l.user.name} (${l.user.role})` : "System" },
          { key: "action", label: "Action", render: (l) => <Badge tone="slate">{titleCase(l.action)}</Badge> },
          { key: "entity", label: "Entity" },
          { key: "details", label: "Details", hideOn: "md", className: "max-w-sm truncate text-xs text-slate-500", render: (l) => (l.details ? JSON.stringify(l.details) : "—") },
          { key: "ip", label: "IP", hideOn: "lg" },
        ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
