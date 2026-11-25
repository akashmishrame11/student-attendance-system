import { useState } from "react";
import { Eye, UserPlus, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import ResourcePage from "../../features/resource/ResourcePage";
import { Badge, Button, Checkbox, DataTable, KeyValue, Modal } from "../../components/ui";
import api, { errorMessage } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { OPT, idOf, semestersOfCourse, coursesOfDepartment } from "../../utils/options";
import { fmtDate, sectionLabel, toInputDate } from "../../utils/format";

const activeCol = { key: "isActive", label: "Status", render: (r) => <Badge status={r.isActive ? "active" : "inactive"} /> };
const activeField = { name: "isActive", type: "checkbox", label: "Active", checkboxLabel: "Active" };

/* ------------------------------------------------------------ departments */
function DepartmentDetail({ id, onClose }) {
  const { data, loading } = useApi(id ? `/departments/${id}/summary` : null);
  return (
    <Modal open={Boolean(id)} onClose={onClose} title={data?.department?.name || "Department"} subtitle={data?.department?.code} size="lg">
      {loading || !data ? <p className="text-sm text-slate-500">Loading…</p> : (
        <div className="space-y-6">
          <KeyValue items={[
            ["Head of department", data.department.head?.user?.name],
            ["Established", data.department.establishedYear],
            ["Active students", data.studentCount],
            ["Subjects", data.subjectCount],
            ["Description", data.department.description],
          ]} />
          <div>
            <h4 className="mb-2 text-sm font-semibold">Courses ({data.courses.length})</h4>
            <div className="flex flex-wrap gap-2">{data.courses.map((c) => <Badge key={c._id} tone="blue">{c.code} — {c.name}</Badge>)}</div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Faculty ({data.faculty.length})</h4>
            <DataTable dense rows={data.faculty} columns={[
              { key: "employeeId", label: "ID" },
              { key: "name", label: "Name", render: (f) => f.user?.name },
              { key: "designation", label: "Designation" },
              { key: "status", label: "Status", render: (f) => <Badge status={f.status} /> },
            ]} empty={{ title: "No faculty in this department" }} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export function Departments() {
  const [view, setView] = useState(null);
  return (
    <>
      <ResourcePage config={{
        title: "Departments", subtitle: "Academic departments and their heads", endpoint: "/departments", entity: "Department", defaultSort: "name",
        columns: [
          { key: "code", label: "Code", sortable: true, render: (r) => <span className="font-semibold text-slate-900">{r.code}</span> },
          { key: "name", label: "Name", sortable: true },
          { key: "head", label: "Head", render: (r) => r.head?.user?.name || <span className="text-slate-400">Not assigned</span> },
          { key: "establishedYear", label: "Est.", hideOn: "md" },
          activeCol,
        ],
        fields: [
          { name: "name", label: "Department name", required: true },
          { name: "code", label: "Code", required: true, placeholder: "e.g. CSE", rules: { maxLength: { value: 10, message: "Max 10 characters" } } },
          { name: "head", label: "Head of department", type: "select", optionsFrom: OPT.faculty, placeholder: "None" },
          { name: "establishedYear", label: "Established year", type: "number", min: 1900, max: 2100 },
          { name: "description", label: "Description", type: "textarea" },
          activeField,
        ],
        defaults: { isActive: true },
        toForm: (r) => ({ ...r, head: idOf(r.head) }),
        toPayload: (v) => ({ ...v, head: v.head || null }),
        deleteParams: { permanent: true },
        deleteMessage: (r) => `Delete ${r.name}? This is blocked if courses, faculty or students are linked.`,
        rowActions: (r) => <Button size="icon" variant="ghost" title="View" onClick={() => setView(r._id)}><Eye className="h-4 w-4" /></Button>,
      }} />
      <DepartmentDetail id={view} onClose={() => setView(null)} />
    </>
  );
}

/* ---------------------------------------------------------------- courses */
export function Courses() {
  return (
    <ResourcePage config={{
      title: "Courses", subtitle: "Degree programs offered by each department", endpoint: "/courses", entity: "Course", defaultSort: "code",
      filters: [{ key: "department", label: "All departments", optionsFrom: OPT.department }],
      columns: [
        { key: "code", label: "Code", sortable: true, render: (r) => <span className="font-semibold text-slate-900">{r.code}</span> },
        { key: "name", label: "Course", sortable: true },
        { key: "department", label: "Department", render: (r) => r.department?.code },
        { key: "durationYears", label: "Duration", render: (r) => `${r.durationYears} yrs` },
        { key: "totalSemesters", label: "Semesters" },
        activeCol,
      ],
      fields: [
        { name: "name", label: "Course name", required: true },
        { name: "code", label: "Course code", required: true, placeholder: "e.g. BCS" },
        { name: "department", label: "Department", type: "select", required: true, optionsFrom: OPT.department },
        { name: "durationYears", label: "Duration (years)", type: "number", required: true, min: 1, max: 6 },
        { name: "totalSemesters", label: "Number of semesters", type: "number", required: true, min: 1, max: 12 },
        { name: "description", label: "Description", type: "textarea" },
        activeField,
      ],
      defaults: { durationYears: 4, totalSemesters: 8, isActive: true },
      toForm: (r) => ({ ...r, department: idOf(r.department) }),
      deleteParams: { permanent: true },
    }} />
  );
}

/* -------------------------------------------------------------- semesters */
export function Semesters() {
  return (
    <ResourcePage config={{
      title: "Semesters", subtitle: "Semesters per course with academic year and dates", endpoint: "/semesters", entity: "Semester", defaultSort: "number", pageSize: 15,
      filters: [{ key: "course", label: "All courses", optionsFrom: OPT.course }, { key: "isActive", label: "Any status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }],
      hideSearch: false,
      columns: [
        { key: "course", label: "Course", render: (r) => <span className="font-medium">{r.course?.code}</span> },
        { key: "number", label: "Semester", sortable: true, render: (r) => r.name },
        { key: "academicYear", label: "Academic year", sortable: true },
        { key: "startDate", label: "Dates", hideOn: "md", render: (r) => `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}` },
        { key: "isActive", label: "Status", render: (r) => <Badge status={r.isActive ? "active" : "inactive"}>{r.isActive ? "Running" : "Inactive"}</Badge> },
      ],
      fields: [
        { name: "course", label: "Course", type: "select", required: true, optionsFrom: OPT.course },
        { name: "number", label: "Semester number", type: "number", required: true, min: 1, max: 12 },
        { name: "academicYear", label: "Academic year", required: true, placeholder: "2026-2027", rules: { pattern: { value: /^\d{4}-\d{4}$/, message: "Use YYYY-YYYY" } } },
        { name: "name", label: "Display name", placeholder: "Semester 1 (auto)" },
        { name: "startDate", label: "Start date", type: "date" },
        { name: "endDate", label: "End date", type: "date" },
        { name: "isActive", type: "checkbox", label: "Active", checkboxLabel: "Currently running (active semester)" },
      ],
      toForm: (r) => ({ ...r, course: idOf(r.course), startDate: toInputDate(r.startDate), endDate: toInputDate(r.endDate) }),
      deleteParams: { permanent: true },
    }} />
  );
}

/* --------------------------------------------------------------- sections */
function AssignStudents({ section, onClose }) {
  const { data, loading } = useApi(section ? "/students" : null, { semester: idOf(section?.semester), all: "true", status: "active" });
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const rows = (data || []).filter((s) => idOf(s.section) !== section?._id);
  const save = async () => {
    setSaving(true);
    try {
      const { data: res } = await api.post(`/sections/${section._id}/students`, { studentIds: selected });
      toast.success(res.message);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={Boolean(section)} onClose={() => onClose(false)} size="lg" title={`Assign students to ${sectionLabel(section)}`} subtitle="Students in the same semester who are not in this section"
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button loading={saving} disabled={!selected.length} onClick={save}>Assign {selected.length || ""}</Button></>}>
      <DataTable loading={loading} rows={rows} dense empty={{ title: "No unassigned students in this semester" }} columns={[
        { key: "sel", label: <Checkbox checked={rows.length > 0 && selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r._id) : [])} />, render: (r) => <Checkbox checked={selected.includes(r._id)} onChange={() => setSelected((s) => s.includes(r._id) ? s.filter((x) => x !== r._id) : [...s, r._id])} /> },
        { key: "rollNumber", label: "Roll No" },
        { key: "name", label: "Name", render: (r) => r.user?.name },
        { key: "section", label: "Current section", render: (r) => r.section?.name || "—" },
      ]} />
    </Modal>
  );
}

export function Sections() {
  const [assign, setAssign] = useState(null);
  const [refetchRef, setRefetch] = useState(null);
  return (
    <>
      <ResourcePage config={{
        title: "Classes & Sections", subtitle: "Class = course + semester + section, with class teacher and room", endpoint: "/sections", entity: "Section", defaultSort: "name", pageSize: 15,
        filters: [{ key: "course", label: "All courses", optionsFrom: OPT.course }],
        columns: [
          { key: "class", label: "Class", render: (r) => <span className="font-semibold text-slate-900">{sectionLabel(r)}</span> },
          { key: "semester", label: "Academic year", hideOn: "md", render: (r) => r.semester?.academicYear },
          { key: "batch", label: "Batch", hideOn: "lg" },
          { key: "classTeacher", label: "Class teacher", render: (r) => r.classTeacher?.user?.name || <span className="text-slate-400">—</span> },
          { key: "room", label: "Room" },
          { key: "capacity", label: "Capacity", hideOn: "md" },
        ],
        fields: [
          { name: "course", label: "Course", type: "select", required: true, optionsFrom: OPT.course },
          { name: "semester", label: "Semester", type: "select", required: true, optionsFrom: semestersOfCourse },
          { name: "name", label: "Section name", required: true, placeholder: "A" },
          { name: "batch", label: "Batch", placeholder: "2025-2029" },
          { name: "classTeacher", label: "Class teacher", type: "select", optionsFrom: OPT.faculty, placeholder: "None" },
          { name: "room", label: "Classroom", placeholder: "CS-101" },
          { name: "capacity", label: "Class strength (max)", type: "number", min: 1, required: true },
          activeField,
        ],
        defaults: { capacity: 60, isActive: true },
        toForm: (r) => ({ ...r, course: idOf(r.course), semester: idOf(r.semester), classTeacher: idOf(r.classTeacher) }),
        toPayload: (v) => ({ ...v, classTeacher: v.classTeacher || null }),
        deleteParams: { permanent: true },
        rowActions: (r, { refetch }) => (
          <Button size="icon" variant="ghost" title="Assign students" onClick={() => { setAssign(r); setRefetch(() => refetch); }}><UserPlus className="h-4 w-4" /></Button>
        ),
        headerActions: () => null,
      }} />
      <AssignStudents section={assign} onClose={(changed) => { setAssign(null); if (changed) refetchRef?.(); }} />
    </>
  );
}

/* --------------------------------------------------------------- subjects */
export function Subjects() {
  return (
    <ResourcePage config={{
      title: "Subjects", subtitle: "Subjects per course and semester with assigned faculty", endpoint: "/subjects", entity: "Subject", defaultSort: "code", pageSize: 15,
      filters: [
        { key: "department", label: "All departments", optionsFrom: OPT.department },
        { key: "course", label: "All courses", optionsFrom: OPT.course },
        { key: "type", label: "Any type", options: [{ value: "theory", label: "Theory" }, { value: "practical", label: "Practical" }] },
      ],
      columns: [
        { key: "code", label: "Code", sortable: true, render: (r) => <span className="font-semibold text-slate-900">{r.code}</span> },
        { key: "name", label: "Subject", sortable: true },
        { key: "course", label: "Course / Sem", render: (r) => `${r.course?.code} · S${r.semester?.number}` },
        { key: "type", label: "Type", render: (r) => <Badge status={r.type} /> },
        { key: "credits", label: "Credits", hideOn: "md" },
        { key: "faculty", label: "Faculty", render: (r) => r.faculty?.user?.name || <span className="text-slate-400">Unassigned</span> },
      ],
      fields: [
        { name: "code", label: "Subject code", required: true, placeholder: "CS301" },
        { name: "name", label: "Subject name", required: true },
        { name: "department", label: "Department", type: "select", required: true, optionsFrom: OPT.department },
        { name: "course", label: "Course", type: "select", required: true, optionsFrom: coursesOfDepartment },
        { name: "semester", label: "Semester", type: "select", required: true, optionsFrom: semestersOfCourse },
        { name: "type", label: "Type", type: "select", required: true, options: [{ value: "theory", label: "Theory" }, { value: "practical", label: "Practical" }], placeholder: false },
        { name: "credits", label: "Credits", type: "number", min: 0, max: 10 },
        { name: "faculty", label: "Assigned faculty", type: "select", optionsFrom: OPT.faculty, placeholder: "None" },
        { name: "description", label: "Description", type: "textarea" },
      ],
      defaults: { type: "theory", credits: 4 },
      toForm: (r) => ({ ...r, department: idOf(r.department), course: idOf(r.course), semester: idOf(r.semester), faculty: idOf(r.faculty) }),
      toPayload: (v) => ({ ...v, faculty: v.faculty || null }),
      deleteParams: { permanent: true },
      headerActions: () => <SyncEnrollmentsButton />,
    }} />
  );
}

function SyncEnrollmentsButton() {
  const [open, setOpen] = useState(false);
  const { data } = useApi(open ? "/sections" : null, { all: "true" });
  const [busy, setBusy] = useState("");
  const sync = async (id) => {
    setBusy(id);
    try {
      const { data: res } = await api.post(`/enrollments/sync/${id}`);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <Button variant="secondary" icon={RefreshCw} onClick={() => setOpen(true)}>Sync enrollments</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sync student enrollments" subtitle="Enroll every student of a section in all subjects of its semester">
        <ul className="divide-y divide-slate-100">
          {(data || []).map((s) => (
            <li key={s._id} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium">{sectionLabel(s)}</span>
              <Button size="sm" variant="soft" loading={busy === s._id} onClick={() => sync(s._id)}>Sync</Button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
