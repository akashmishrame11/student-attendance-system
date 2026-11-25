import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { KeyRound, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import api, { errorMessage, storage, toFormData } from "../../services/api";
import { Avatar, Badge, Button, Card, Field, FileInput, Input, KeyValue, PageHeader, Tabs, Textarea } from "../../components/ui";
import { fmtDate, titleCase, sectionLabel } from "../../utils/format";

function PasswordForm() {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const [saving, setSaving] = useState(false);
  const submit = async (v) => {
    setSaving(true);
    try {
      const { data } = await api.patch("/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword });
      storage.set(data.data.token);
      toast.success("Password changed");
      reset();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Change password" className="max-w-xl">
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <Field label="Current password" error={errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...register("currentPassword", { required: "Required" })} /></Field>
        <Field label="New password" error={errors.newPassword?.message} hint="At least 8 characters with a letter and a number">
          <Input type="password" autoComplete="new-password" {...register("newPassword", { required: "Required", minLength: { value: 8, message: "At least 8 characters" }, validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || "Include a letter and a number" })} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}><Input type="password" {...register("confirm", { validate: (v) => v === watch("newPassword") || "Passwords do not match" })} /></Field>
        <Button type="submit" icon={KeyRound} loading={saving}>Update password</Button>
      </form>
    </Card>
  );
}

export default function Profile() {
  const { user, profile, setUser, setProfile } = useAuth();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "password" ? "password" : "profile");
  const [avatar, setAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm({ defaultValues: { name: user.name, phone: user.phone || "", address: profile?.address || "" } });

  const save = async (v) => {
    setSaving(true);
    try {
      const { data } = await api.patch("/auth/profile", toFormData(v, { avatar }));
      setUser(data.data.user);
      setProfile(data.data.profile);
      setAvatar(null);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const p = profile || {};
  return (
    <>
      <PageHeader title="My Profile" subtitle="Personal information and account security" />
      <div className="card mb-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={user.name} src={user.avatar} size="xl" />
        <div>
          <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">{user.name}</h2><Badge tone="blue">{titleCase(user.role)}</Badge></div>
          <p className="mt-1 text-sm text-slate-500">{user.email} · username <span className="font-mono">{user.username}</span></p>
          {user.role === "student" && <p className="mt-1 text-sm text-slate-600">{p.studentId} · Roll {p.rollNumber} · {p.course?.name} · {p.semester?.name} · Section {p.section?.name || "—"}</p>}
          {user.role === "faculty" && <p className="mt-1 text-sm text-slate-600">{p.employeeId} · {p.designation} · {p.department?.name}</p>}
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "profile", label: "Profile" }, { value: "password", label: "Password" }]} />
      {tab === "password" ? <PasswordForm /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Edit contact details">
            <form onSubmit={handleSubmit(save)} className="space-y-4">
              <Field label="Full name"><Input {...register("name", { required: true, minLength: 2 })} disabled={user.role === "student"} /></Field>
              <Field label="Phone"><Input {...register("phone")} /></Field>
              {user.role === "student" && <Field label="Address"><Textarea rows={2} {...register("address")} /></Field>}
              <Field label="Profile photo"><FileInput accept=".jpg,.jpeg,.png,.webp" files={avatar} onChange={(e) => setAvatar(e.target.files)} /></Field>
              <Button type="submit" icon={Save} loading={saving}>Save changes</Button>
              {user.role === "student" && <p className="text-xs text-slate-500">To correct your name, date of birth or academic details, submit a “Profile correction” request under Complaints & Feedback.</p>}
            </form>
          </Card>
          {user.role === "student" && (
            <Card title="Academic & guardian information">
              <KeyValue items={[
                ["Department", p.department?.name], ["Course", p.course?.name], ["Semester", p.semester?.name], ["Section", sectionLabel(p.section ? { ...p.section, course: p.course, semester: p.semester } : null)],
                ["Batch", p.batch], ["Admission date", fmtDate(p.admissionDate)], ["Date of birth", fmtDate(p.dateOfBirth)], ["Gender", titleCase(p.gender || "")],
                ["Guardian", p.guardianName], ["Guardian contact", p.guardianPhone],
              ]} />
            </Card>
          )}
          {user.role === "faculty" && (
            <Card title="Teaching assignments">
              <KeyValue items={[
                ["Department", p.department?.name], ["Designation", p.designation], ["Joined", fmtDate(p.joiningDate)], ["Qualification", p.qualification],
                ["Subjects", (p.subjects || []).map((s) => s.code).join(", ")], ["Sections", (p.sections || []).map((s) => `${s.course?.code}-S${s.semester?.number}-${s.name}`).join(", ")],
              ]} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
