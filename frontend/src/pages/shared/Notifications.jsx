import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { AsyncBlock, Badge, Button, Card, PageHeader, Pagination, Tabs } from "../../components/ui";
import { ResourceForm } from "../../features/resource/ResourceForm";
import { OPT } from "../../utils/options";
import { timeAgo, titleCase } from "../../utils/format";

const TYPES = ["general", "assignment", "deadline", "attendance", "exam", "notice", "fee", "leave", "result"];

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, refetch } = useApi("/notifications", { page, limit: 15, unread: tab === "unread" ? "true" : undefined, type: !["all", "unread"].includes(tab) ? tab : undefined });

  const open = async (n) => {
    if (!n.isRead) await api.patch(`/notifications/${n._id}/read`).catch(() => {});
    if (n.link) navigate(n.link === "/notices" ? `/${user.role}/notices` : n.link);
    else refetch();
  };
  const readAll = async () => {
    await api.patch("/notifications/read-all");
    toast.success("All marked as read");
    refetch();
  };
  const remove = async (n) => {
    await api.delete(`/notifications/${n._id}`).catch((e) => toast.error(errorMessage(e)));
    refetch();
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle={meta ? `${meta.unread} unread` : undefined} actions={<Button variant="secondary" icon={CheckCheck} onClick={readAll}>Mark all read</Button>} />
      <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }, { value: "assignment", label: "Assignments" }, { value: "attendance", label: "Attendance" }, { value: "exam", label: "Exams" }, { value: "fee", label: "Fees" }, { value: "notice", label: "Notices" }]} />
      <Card bodyClass="p-0">
        <AsyncBlock loading={loading && !data} error={error} onRetry={refetch} empty={!data?.length} emptyProps={{ icon: Bell, title: "No notifications" }}>
          <ul className="divide-y divide-slate-100">
            {data?.map((n) => (
              <li key={n._id} className={`flex items-start gap-3 px-5 py-4 ${n.isRead ? "" : "bg-brand-50/40"}`}>
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-slate-200" : "bg-brand-500"}`} />
                <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400"><Badge tone="slate">{titleCase(n.type)}</Badge> <span className="ml-1">{timeAgo(n.createdAt)}</span></p>
                </button>
                <Button size="icon" variant="ghost" onClick={() => remove(n)} title="Remove"><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
          <Pagination meta={meta} onPage={setPage} />
        </AsyncBlock>
      </Card>
    </>
  );
}

export function SendNotification() {
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(0);
  const fields = [
    { name: "title", label: "Title", required: true, colSpan: 2 },
    { name: "message", label: "Message", type: "textarea", required: true, rows: 4 },
    { name: "type", label: "Type", type: "select", options: TYPES.map((t) => ({ value: t, label: titleCase(t) })), placeholder: false },
    { name: "audienceType", label: "Send to", type: "select", placeholder: false, options: [
      { value: "all", label: "All students & faculty" }, { value: "students", label: "All students" }, { value: "faculty", label: "All faculty" },
      { value: "department", label: "Specific department" }, { value: "course", label: "Specific course" }, { value: "semester", label: "Specific semester" }, { value: "section", label: "Specific class / section" },
    ] },
    { name: "department", label: "Department", type: "select", optionsFrom: OPT.department, required: true, showWhen: (v) => v.audienceType === "department" },
    { name: "course", label: "Course", type: "select", optionsFrom: OPT.course, required: true, showWhen: (v) => ["course", "semester"].includes(v.audienceType) },
    { name: "semester", label: "Semester", type: "select", optionsFrom: { ...OPT.semester, requires: "course", params: (v) => ({ course: v.course }) }, required: true, showWhen: (v) => v.audienceType === "semester" },
    { name: "section", label: "Section", type: "select", optionsFrom: OPT.section, required: true, showWhen: (v) => v.audienceType === "section" },
    { name: "link", label: "Link (optional)", placeholder: "/student/fees", hint: "In-app path opened when the notification is clicked" },
  ];
  const send = async (v) => {
    setSaving(true);
    try {
      const audience = { type: v.audienceType };
      for (const k of ["department", "course", "semester", "section"]) if (v[k]) audience[k] = v[k];
      const { data } = await api.post("/notifications/send", { title: v.title, message: v.message, type: v.type, link: v.link || undefined, audience });
      toast.success(data.message);
      setKey((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeader title="Send Notification" subtitle="Push in-app notifications to students and faculty" />
      <Card className="max-w-3xl">
        <ResourceForm key={key} id="notify-form" fields={fields} onSubmit={send} defaultValues={{ type: "general", audienceType: "all" }} />
        <div className="mt-5 flex justify-end"><Button type="submit" form="notify-form" icon={Send} loading={saving}>Send notification</Button></div>
      </Card>
    </>
  );
}
