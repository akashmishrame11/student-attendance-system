import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../hooks/useApi";
import api, { errorMessage, toFormData } from "../../services/api";
import { Badge, Button, Card, DataTable, FilterSelect, Modal, PageHeader, Pagination, SearchInput, useConfirm } from "../../components/ui";
import { ResourceForm } from "../../features/resource/ResourceForm";
import { useDebounce, useOptions } from "../../hooks/useApi";
import { OPT, idOf } from "../../utils/options";
import { fmtDateTime, sectionLabel } from "../../utils/format";

const toLocalInput = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function AssignmentForm({ assignment, onClose }) {
  const { user } = useAuth();
  const isEdit = Boolean(assignment?._id);
  const mine = user.role === "faculty" ? { mine: "true" } : {};
  const [saving, setSaving] = useState(false);
  const fields = [
    { name: "section", label: "Class / section", type: "select", required: true, optionsFrom: { ...OPT.section, params: () => mine } },
    { name: "subject", label: "Subject", type: "select", required: true, optionsFrom: { ...OPT.subject, requires: "section", params: (v) => ({ section: v.section, ...mine }) } },
    ...(user.role === "admin" ? [{ name: "faculty", label: "Faculty", type: "select", optionsFrom: OPT.faculty, hint: "Defaults to the subject's faculty" }] : []),
    { name: "title", label: "Title", required: true, colSpan: 2, rules: { minLength: { value: 3, message: "At least 3 characters" } } },
    { name: "description", label: "Description", type: "textarea", required: true },
    { name: "instructions", label: "Instructions", type: "textarea", rows: 3 },
    { name: "maxMarks", label: "Maximum marks", type: "number", required: true, min: 1, max: 1000 },
    { name: "dueDate", label: "Submission deadline", type: "datetime-local", required: true },
    { name: "allowResubmission", type: "checkbox", checkboxLabel: "Allow resubmission" },
    { name: "allowLateSubmission", type: "checkbox", checkboxLabel: "Accept late submissions (marked late)" },
    { name: "isPublished", type: "checkbox", checkboxLabel: "Publish now (students are notified)" },
    { name: "files", label: isEdit ? "Add attachments" : "Attachments", type: "file", multiple: true },
  ];
  const save = async (v) => {
    setSaving(true);
    try {
      const { files, ...rest } = v;
      const body = toFormData({ ...rest, dueDate: new Date(rest.dueDate).toISOString() }, { files });
      const res = isEdit ? await api.put(`/assignments/${assignment._id}`, body) : await api.post("/assignments", body);
      toast.success(res.data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={Boolean(assignment)} onClose={() => onClose(false)} size="lg" title={isEdit ? "Edit assignment" : "Create assignment"}
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" form="assignment-form" loading={saving}>{isEdit ? "Save" : "Create"}</Button></>}>
      {assignment && (
        <ResourceForm id="assignment-form" fields={fields} isEdit={isEdit} onSubmit={save}
          defaultValues={isEdit
            ? { title: assignment.title, description: assignment.description, instructions: assignment.instructions, maxMarks: assignment.maxMarks, dueDate: toLocalInput(assignment.dueDate), allowResubmission: assignment.allowResubmission, allowLateSubmission: assignment.allowLateSubmission, isPublished: assignment.isPublished, section: idOf(assignment.section), subject: idOf(assignment.subject) }
            : { maxMarks: 10, allowLateSubmission: true, isPublished: true, dueDate: toLocalInput(Date.now() + 7 * 864e5) }} />
      )}
    </Modal>
  );
}

export default function Assignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const q = useDebounce(search);
  const { options: sections } = useOptions("/sections", OPT.section.map, user.role === "faculty" ? { mine: "true" } : undefined);
  const { data, meta, loading, error, refetch } = useApi("/assignments", { page, limit: 12, section: section || undefined, status: status || undefined, search: q || undefined });

  const remove = async (a) => {
    if (!(await confirm({ title: "Delete assignment?", message: `"${a.title}" and all its submissions will be permanently deleted.`, tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api.delete(`/assignments/${a._id}`);
      toast.success("Assignment deleted");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Assignments" subtitle={user.role === "admin" ? "All assignments, submissions and evaluation progress" : "Create assignments and evaluate submissions"}
        actions={<Button icon={Plus} onClick={() => setEditing({})}>New assignment</Button>} />
      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by title…" className="lg:max-w-xs lg:flex-1" />
          <div className="flex flex-wrap gap-2">
            <FilterSelect value={section} onChange={(v) => { setSection(v); setPage(1); }} options={sections} placeholder="All classes" />
            <FilterSelect value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "upcoming", label: "Open (upcoming)" }, { value: "past", label: "Deadline passed" }]} placeholder="Any deadline" />
          </div>
        </div>
        <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} onRowClick={(r) => navigate(`/${user.role}/assignments/${r._id}`)}
          empty={{ title: "No assignments yet", message: "Create one to share it with a class." }}
          columns={[
            { key: "title", label: "Assignment", render: (r) => (
              <div className="min-w-0"><p className="truncate font-medium text-slate-900">{r.title}</p><p className="text-xs text-slate-500">{r.subject?.code} · {sectionLabel(r.section)}{user.role === "admin" ? ` · ${r.faculty?.user?.name}` : ""}</p></div>
            ) },
            { key: "dueDate", label: "Deadline", render: (r) => <span className={new Date(r.dueDate) < new Date() ? "text-slate-500" : "font-medium text-slate-800"}>{fmtDateTime(r.dueDate)}</span> },
            { key: "submitted", label: "Submitted", render: (r) => `${r.stats.submitted}/${r.stats.strength}` },
            { key: "pending", label: "Pending", hideOn: "md", render: (r) => r.stats.pending },
            { key: "late", label: "Late", hideOn: "md", render: (r) => r.stats.late },
            { key: "toEvaluate", label: "To evaluate", render: (r) => (r.stats.toEvaluate ? <Badge tone="amber">{r.stats.toEvaluate}</Badge> : <Badge tone="green">Done</Badge>) },
            { key: "pub", label: "", hideOn: "lg", render: (r) => !r.isPublished && <Badge tone="slate">Draft</Badge> },
            { key: "a", label: "", className: "text-right whitespace-nowrap", render: (r) => (
              <div onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="ghost" title="Open" onClick={() => navigate(`/${user.role}/assignments/${r._id}`)}><Eye className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" title="Delete" className="text-rose-600" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ) },
          ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      <AssignmentForm assignment={editing} onClose={(changed) => { setEditing(null); if (changed) refetch(); }} />
    </>
  );
}
