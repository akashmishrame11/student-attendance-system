import { useState } from "react";
import { Megaphone, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi, useDebounce } from "../../hooks/useApi";
import api, { errorMessage, toFormData } from "../../services/api";
import { AsyncBlock, Badge, Button, FilterSelect, Modal, PageHeader, Pagination, SearchInput, Tabs, useConfirm } from "../../components/ui";
import { ResourceForm } from "../../features/resource/ResourceForm";
import { FileList } from "./AssignmentDetail";
import { OPT, idOf } from "../../utils/options";
import { fmtDate, titleCase, toInputDate } from "../../utils/format";

const CATEGORIES = ["general", "exam", "academic", "event", "holiday", "fee", "urgent"].map((c) => ({ value: c, label: titleCase(c) }));
const CAT_TONE = { general: "slate", exam: "violet", academic: "blue", event: "green", holiday: "amber", fee: "amber", urgent: "red" };

function audienceText(a) {
  if (!a) return "Everyone";
  switch (a.type) {
    case "all": return "Everyone";
    case "students": return "All students";
    case "faculty": return "All faculty";
    case "department": return `Dept: ${a.department?.code || ""}`;
    case "course": return `Course: ${a.course?.code || ""}`;
    case "semester": return `Semester: ${a.semester?.name || ""}`;
    case "section": return `Section: ${a.section?.name || ""}`;
    default: return a.type;
  }
}

export function NoticeForm({ notice, onClose }) {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const isEdit = Boolean(notice?._id);
  const [saving, setSaving] = useState(false);
  const fields = [
    { name: "title", label: "Title", required: true, colSpan: 2 },
    { name: "content", label: "Content", type: "textarea", required: true, rows: 5 },
    { name: "category", label: "Category", type: "select", options: CATEGORIES, placeholder: false },
    isAdmin
      ? { name: "audienceType", label: "Target audience", type: "select", placeholder: false, options: [
          { value: "all", label: "Everyone" }, { value: "students", label: "All students" }, { value: "faculty", label: "All faculty" },
          { value: "department", label: "A department" }, { value: "course", label: "A course" }, { value: "semester", label: "A semester" }, { value: "section", label: "A class / section" },
        ] }
      : { name: "audienceType", label: "Target audience", type: "select", placeholder: false, options: [{ value: "section", label: "My class / section" }] },
    { name: "department", label: "Department", type: "select", optionsFrom: OPT.department, required: true, showWhen: (v) => v.audienceType === "department" },
    { name: "course", label: "Course", type: "select", optionsFrom: OPT.course, required: true, showWhen: (v) => ["course", "semester"].includes(v.audienceType) },
    { name: "semester", label: "Semester", type: "select", optionsFrom: { ...OPT.semester, requires: "course", params: (v) => ({ course: v.course }) }, required: true, showWhen: (v) => v.audienceType === "semester" },
    { name: "section", label: "Section", type: "select", optionsFrom: { ...OPT.section, params: () => (isAdmin ? {} : { mine: "true" }) }, required: true, showWhen: (v) => v.audienceType === "section" },
    { name: "subject", label: "Subject (optional)", type: "select", optionsFrom: { ...OPT.subject, requires: "section", params: (v) => ({ section: v.section, ...(isAdmin ? {} : { mine: "true" }) }) }, placeholder: "Not subject-specific", showWhen: (v) => v.audienceType === "section" },
    { name: "publishDate", label: "Publish date", type: "date" },
    { name: "expiryDate", label: "Expiry date", type: "date", hint: "Hidden after this date" },
    { name: "files", label: "Attachments", type: "file", multiple: true },
  ];
  const save = async (v) => {
    setSaving(true);
    try {
      const audience = { type: v.audienceType };
      for (const k of ["department", "course", "semester", "section"]) if (v[k] && (v.audienceType === k || (k === "course" && v.audienceType === "semester"))) audience[k] = v[k];
      const body = toFormData({
        title: v.title, content: v.content, category: v.category, audience,
        publishDate: v.publishDate || undefined, expiryDate: v.expiryDate || "", subject: v.audienceType === "section" ? v.subject || "" : "",
      }, { files: v.files });
      const res = isEdit ? await api.put(`/notices/${notice._id}`, body) : await api.post("/notices", body);
      toast.success(res.data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const a = notice?.audience || {};
  return (
    <Modal open onClose={() => onClose(false)} size="lg" title={isEdit ? "Edit notice" : "Publish notice"}
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" form="notice-form" loading={saving}>{isEdit ? "Save" : "Publish"}</Button></>}>
      <ResourceForm id="notice-form" fields={fields} isEdit={isEdit} onSubmit={save}
        defaultValues={isEdit
          ? { title: notice.title, content: notice.content, category: notice.category, audienceType: a.type, department: idOf(a.department), course: idOf(a.course), semester: idOf(a.semester), section: idOf(a.section), subject: idOf(notice.subject), publishDate: toInputDate(notice.publishDate), expiryDate: toInputDate(notice.expiryDate) }
          : { category: "general", audienceType: isAdmin ? "all" : "section" }} />
    </Modal>
  );
}

export default function Notices() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canPost = user.role !== "student";
  const [tab, setTab] = useState("feed");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const q = useDebounce(search);
  const { data, meta, loading, error, refetch } = useApi("/notices", { page, limit: 10, category: category || undefined, search: q || undefined, manage: tab === "manage" ? "true" : undefined });

  const remove = async (n) => {
    if (!(await confirm({ title: "Delete notice?", tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api.delete(`/notices/${n._id}`);
      toast.success("Notice deleted");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const canModify = (n) => user.role === "admin" || n.createdBy?._id === user._id;

  return (
    <>
      <PageHeader title="Notices" subtitle="College, department, class and exam notices" actions={canPost && <Button icon={Plus} onClick={() => setEditing({})}>New notice</Button>} />
      {canPost && <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[{ value: "feed", label: "Notice board" }, { value: "manage", label: user.role === "admin" ? "Manage all" : "Posted by me" }]} />}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search notices…" className="sm:max-w-xs sm:flex-1" />
        <FilterSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={CATEGORIES} placeholder="All categories" />
      </div>
      <AsyncBlock loading={loading && !data} error={error} onRetry={refetch} empty={!data?.length} emptyProps={{ icon: Megaphone, title: "No notices" }}>
        <div className="space-y-4">
          {data?.map((n) => (
            <article key={n._id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CAT_TONE[n.category]}>{titleCase(n.category)}</Badge>
                    <Badge tone="slate">{audienceText(n.audience)}</Badge>
                    {n.subject && <Badge tone="blue">{n.subject.code}</Badge>}
                    {n.expiryDate && new Date(n.expiryDate) < new Date() && <Badge tone="red">Expired</Badge>}
                    {new Date(n.publishDate) > new Date() && <Badge tone="amber">Scheduled</Badge>}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">{n.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{fmtDate(n.publishDate)} · {n.createdBy?.name} ({titleCase(n.createdBy?.role || "")})</p>
                </div>
                {canModify(n) && canPost && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(n)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => remove(n)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{n.content}</p>
              {n.attachments?.length > 0 && <div className="mt-3 flex items-start gap-2"><Paperclip className="mt-0.5 h-4 w-4 text-slate-400" /><FileList files={n.attachments} /></div>}
            </article>
          ))}
          <Pagination meta={meta} onPage={setPage} />
        </div>
      </AsyncBlock>
      {editing && <NoticeForm notice={editing} onClose={(c) => { setEditing(null); if (c) refetch(); }} />}
    </>
  );
}
