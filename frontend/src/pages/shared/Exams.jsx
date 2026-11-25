import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi, useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { Badge, Button, Card, Checkbox, DataTable, Field, FilterSelect, Input, Modal, PageHeader, Pagination, Select, useConfirm } from "../../components/ui";
import { OPT, idOf } from "../../utils/options";
import { fmtDate, toInputDate } from "../../utils/format";

const TYPES = [{ value: "internal", label: "Internal" }, { value: "midterm", label: "Mid-term" }, { value: "practical", label: "Practical" }, { value: "final", label: "Final" }];

export function ExamForm({ exam, onClose }) {
  const { user } = useAuth();
  const isEdit = Boolean(exam?._id);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    defaultValues: isEdit
      ? { name: exam.name, type: exam.type, course: idOf(exam.course), semester: idOf(exam.semester), sections: (exam.sections || []).map(idOf), schedule: exam.schedule.map((s) => ({ ...s, subject: idOf(s.subject), date: toInputDate(s.date) })) }
      : { type: "internal", sections: [], schedule: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "schedule" });
  const course = watch("course");
  const semester = watch("semester");
  const sections = watch("sections") || [];
  const { options: courses } = useOptions("/courses", OPT.course.map);
  const { options: semesters } = useOptions(course ? "/semesters" : null, OPT.semester.map, { course, sort: "number" });
  const { options: sectionOpts } = useOptions(semester ? "/sections" : null, OPT.section.map, { semester, ...(user.role === "faculty" ? { mine: "true" } : {}) });
  const { options: subjects } = useOptions(semester ? "/subjects" : null, OPT.subject.map, { semester });

  useEffect(() => {
    if (!isEdit && subjects.length && fields.length === 0) {
      subjects.forEach((s, i) => append({ subject: s.value, date: toInputDate(Date.now() + (7 + i) * 864e5), startTime: "10:00", endTime: "13:00", room: "", maxMarks: 100, passMarks: 40 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.length]);

  const save = async (v) => {
    if (!v.schedule.length) return toast.error("Add at least one subject to the schedule");
    setSaving(true);
    try {
      const body = { ...v, schedule: v.schedule.map((s) => ({ ...s, maxMarks: Number(s.maxMarks), passMarks: Number(s.passMarks) })) };
      const res = isEdit ? await api.put(`/exams/${exam._id}`, body) : await api.post("/exams", body);
      toast.success(res.data.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} size="xl" title={isEdit ? "Edit examination" : "Create examination"}
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button type="submit" form="exam-form" loading={saving}>Save examination</Button></>}>
      <form id="exam-form" onSubmit={handleSubmit(save)} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Exam name" required error={errors.name?.message} className="lg:col-span-2"><Input {...register("name", { required: "Exam name is required" })} placeholder="Mid-Term Examination" error={errors.name} /></Field>
          <Field label="Type" required><Select {...register("type")} options={TYPES} placeholder={false} /></Field>
          <div />
          <Field label="Course" required error={errors.course?.message}><Select {...register("course", { required: "Course is required", onChange: () => { setValue("semester", ""); setValue("schedule", []); } })} options={courses} error={errors.course} /></Field>
          <Field label="Semester" required error={errors.semester?.message}><Select {...register("semester", { required: "Semester is required", onChange: () => { setValue("schedule", []); setValue("sections", []); } })} options={semesters} disabled={!course} error={errors.semester} /></Field>
          <Field label={user.role === "faculty" ? "Sections (required)" : "Sections (empty = all)"} className="lg:col-span-2">
            <div className="flex min-h-[38px] flex-wrap gap-2 rounded-lg border border-slate-300 px-3 py-2">
              {!semester && <span className="text-sm text-slate-400">Select semester first</span>}
              {sectionOpts.map((o) => (
                <Checkbox key={o.value} label={o.label} checked={sections.includes(o.value)} onChange={() => setValue("sections", sections.includes(o.value) ? sections.filter((x) => x !== o.value) : [...sections, o.value])} />
              ))}
            </div>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Exam timetable</h4>
            <Button size="sm" variant="soft" icon={Plus} disabled={!semester} onClick={() => append({ subject: "", date: "", startTime: "10:00", endTime: "13:00", room: "", maxMarks: 100, passMarks: 40 })}>Add subject</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{["Subject", "Date", "Start", "End", "Room", "Max", "Pass", ""].map((h) => <th key={h} className="px-2 py-2 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {fields.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No subjects yet</td></tr>}
                {fields.map((f, i) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="p-1.5"><Select {...register(`schedule.${i}.subject`, { required: true })} options={subjects} /></td>
                    <td className="p-1.5"><Input type="date" {...register(`schedule.${i}.date`, { required: true })} /></td>
                    <td className="p-1.5"><Input type="time" {...register(`schedule.${i}.startTime`)} /></td>
                    <td className="p-1.5"><Input type="time" {...register(`schedule.${i}.endTime`)} /></td>
                    <td className="p-1.5"><Input {...register(`schedule.${i}.room`)} placeholder="Hall 1" /></td>
                    <td className="w-20 p-1.5"><Input type="number" min={1} {...register(`schedule.${i}.maxMarks`, { required: true })} /></td>
                    <td className="w-20 p-1.5"><Input type="number" min={0} {...register(`schedule.${i}.passMarks`)} /></td>
                    <td className="p-1.5"><Button size="icon" variant="ghost" className="text-rose-600" onClick={() => remove(i)}><X className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.schedule && <p className="mt-1 text-xs text-rose-600">Every row needs a subject, date and max marks.</p>}
        </div>
      </form>
    </Modal>
  );
}

export default function Exams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [course, setCourse] = useState("");
  const [editing, setEditing] = useState(null);
  const { options: courses } = useOptions("/courses", OPT.course.map);
  const { data, meta, loading, error, refetch } = useApi("/exams", { page, limit: 12, type: type || undefined, course: course || undefined });
  const canModify = (e) => user.role === "admin" || String(e.createdBy) === String(user._id);

  const remove = async (e) => {
    if (!(await confirm({ title: "Delete examination?", message: `"${e.name}" and all entered marks will be deleted.`, tone: "danger", confirmText: "Delete" }))) return;
    try {
      await api.delete(`/exams/${e._id}`);
      toast.success("Examination deleted");
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title={user.role === "admin" ? "Examinations & Results" : "Exams & Marks"} subtitle="Schedule exams, enter marks, publish results" actions={<Button icon={Plus} onClick={() => setEditing({})}>New examination</Button>} />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <FilterSelect value={type} onChange={(v) => { setType(v); setPage(1); }} options={TYPES} placeholder="All types" />
          <FilterSelect value={course} onChange={(v) => { setCourse(v); setPage(1); }} options={courses} placeholder="All courses" />
        </div>
        <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} onRowClick={(r) => navigate(`/${user.role}/exams/${r._id}`)} empty={{ title: "No examinations" }} columns={[
          { key: "name", label: "Examination", render: (r) => <div><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.course?.code} · {r.semester?.name} · {r.sections?.length ? r.sections.map((s) => s.name).join(", ") : "All sections"}</p></div> },
          { key: "type", label: "Type", render: (r) => <Badge status={r.type} /> },
          { key: "dates", label: "Dates", render: (r) => `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}` },
          { key: "subjects", label: "Subjects", hideOn: "md", render: (r) => r.schedule.length },
          { key: "results", label: "Results", render: (r) => <Badge tone={r.resultsPublished ? "green" : "slate"}>{r.resultsPublished ? "Published" : "Not published"}</Badge> },
          { key: "a", label: "", className: "text-right whitespace-nowrap", render: (r) => (
            <div onClick={(e) => e.stopPropagation()}>
              <Button size="icon" variant="ghost" title="Open" onClick={() => navigate(`/${user.role}/exams/${r._id}`)}><Eye className="h-4 w-4" /></Button>
              {canModify(r) && <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>}
              {canModify(r) && <Button size="icon" variant="ghost" title="Delete" className="text-rose-600" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ) },
        ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      {editing && <ExamForm exam={editing} onClose={(changed) => { setEditing(null); if (changed) refetch(); }} />}
    </>
  );
}
