import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpCircle, Eye, FileUp } from "lucide-react";
import toast from "react-hot-toast";
import ResourcePage from "../../features/resource/ResourcePage";
import { Avatar, Badge, Button, Checkbox, DataTable, Field, FileInput, Modal, Select } from "../../components/ui";
import api, { errorMessage } from "../../services/api";
import { useApi, useOptions } from "../../hooks/useApi";
import { OPT, idOf, semestersOfCourse, coursesOfDepartment, sectionsOfSemester } from "../../utils/options";
import { toInputDate } from "../../utils/format";

const STATUS = ["active", "inactive", "graduated", "suspended"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

export const studentFields = [
  { name: "name", label: "Full name", required: true, rules: { minLength: { value: 2, message: "Too short" } } },
  { name: "email", label: "Email", type: "email", required: true, rules: { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" } } },
  { name: "phone", label: "Phone", rules: { pattern: { value: /^[0-9+\-\s]{7,15}$/, message: "Invalid phone" } } },
  { name: "password", label: "Initial password", type: "password", createOnly: true, hint: "Leave empty to use <StudentID>@123", rules: { minLength: { value: 8, message: "Min 8 characters" } } },
  { name: "gender", label: "Gender", type: "select", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }] },
  { name: "dateOfBirth", label: "Date of birth", type: "date" },
  { name: "department", label: "Department", type: "select", required: true, optionsFrom: OPT.department },
  { name: "course", label: "Course", type: "select", required: true, optionsFrom: coursesOfDepartment },
  { name: "semester", label: "Semester", type: "select", required: true, optionsFrom: semestersOfCourse },
  { name: "section", label: "Section", type: "select", optionsFrom: sectionsOfSemester, placeholder: "Not assigned" },
  { name: "batch", label: "Batch", placeholder: "2025-2029" },
  { name: "admissionDate", label: "Admission date", type: "date" },
  { name: "rollNumber", label: "Roll number", hint: "Auto-generated if empty", placeholder: "Auto" },
  { name: "status", label: "Status", type: "select", options: STATUS, placeholder: false, showWhen: (_v, isEdit) => isEdit },
  { name: "guardianName", label: "Parent / guardian name" },
  { name: "guardianPhone", label: "Parent / guardian contact", rules: { pattern: { value: /^[0-9+\-\s]{7,15}$/, message: "Invalid phone" } } },
  { name: "address", label: "Address", type: "textarea", rows: 2 },
  { name: "avatar", label: "Profile photo", type: "file", accept: ".jpg,.jpeg,.png,.webp" },
];

function ImportModal({ open, onClose }) {
  const [files, setFiles] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!files?.[0]) return toast.error("Choose a CSV file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const { data } = await api.post("/students/import", fd);
      setResult(data.data);
      toast.success(data.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const template = "name,email,phone,gender,dateOfBirth,departmentCode,courseCode,semesterNumber,sectionName,batch,guardianName,guardianPhone,address\nJohn Doe,john.doe@college.edu,9876543210,male,2006-05-14,CSE,BCS,3,A,2025-2029,Mr. Doe,9811111111,\"12, MG Road, Delhi\"\n";
  return (
    <Modal open={open} onClose={() => onClose(Boolean(result?.created))} title="Import students from Excel or CSV" footer={<><Button variant="secondary" onClick={() => onClose(Boolean(result?.created))}>Close</Button><Button loading={busy} onClick={submit}>Import</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Columns: <code className="rounded bg-slate-100 px-1 text-xs">name, email, phone, gender, dateOfBirth, departmentCode, courseCode, semesterNumber, sectionName, batch, guardianName, guardianPhone, address</code>.
          Student IDs, roll numbers and passwords (<code className="text-xs">StudentID@123</code>) are generated. Upload an Excel (.xlsx) or CSV file with these column headers in the first row.
        </p>
        <a className="text-sm font-medium text-brand-600 hover:underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="students-template.csv">Download template (CSV — open in Excel)</a>
        <FileInput accept=".xlsx,.csv" files={files} onChange={(e) => setFiles(e.target.files)} />
        {result && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p><b>{result.created}</b> created · <b>{result.errors.length}</b> failed</p>
            <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-rose-600">
              {result.errors.map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PromoteModal({ open, onClose }) {
  const { options: courses } = useOptions(open ? "/courses" : null, OPT.course.map);
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const { options: semesters } = useOptions(course ? "/semesters" : null, OPT.semester.map, { course, sort: "number" });
  const { data: students, loading } = useApi(semester ? "/students" : null, { semester, status: "active", all: "true" });
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const rows = students || [];
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/students/promote", { studentIds: selected });
      toast.success(data.message);
      for (const s of data.data.skipped) toast.error(`${s.studentId}: ${s.reason}`);
      setSelected([]);
      onClose(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={() => onClose(false)} size="lg" title="Promote students" subtitle="Moves students to the next semester (same section name). Final-semester students are marked graduated."
      footer={<><Button variant="secondary" onClick={() => onClose(false)}>Cancel</Button><Button icon={ArrowUpCircle} loading={busy} disabled={!selected.length} onClick={submit}>Promote {selected.length || ""}</Button></>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Course"><Select value={course} onChange={(e) => { setCourse(e.target.value); setSemester(""); setSelected([]); }} options={courses} /></Field>
        <Field label="Current semester"><Select value={semester} onChange={(e) => { setSemester(e.target.value); setSelected([]); }} options={semesters} disabled={!course} /></Field>
      </div>
      {semester && (
        <DataTable loading={loading} rows={rows} dense empty={{ title: "No active students in this semester" }} columns={[
          { key: "sel", label: <Checkbox checked={rows.length > 0 && selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r._id) : [])} />, render: (r) => <Checkbox checked={selected.includes(r._id)} onChange={() => setSelected((s) => (s.includes(r._id) ? s.filter((x) => x !== r._id) : [...s, r._id]))} /> },
          { key: "rollNumber", label: "Roll No" },
          { key: "name", label: "Name", render: (r) => r.user?.name },
          { key: "section", label: "Section", render: (r) => r.section?.name || "—" },
        ]} />
      )}
    </Modal>
  );
}

export default function Students() {
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <ResourcePage key={key} config={{
        title: "Students", subtitle: "Admissions, profiles, sections and status", endpoint: "/students", entity: "Student", defaultSort: "rollNumber", pageSize: 12, modalSize: "lg",
        searchPlaceholder: "Search name, email, ID or roll no…",
        filters: [
          { key: "department", label: "All departments", optionsFrom: OPT.department },
          { key: "course", label: "All courses", optionsFrom: OPT.course },
          { key: "section", label: "All sections", optionsFrom: OPT.section },
          { key: "status", label: "Any status", options: STATUS },
        ],
        columns: [
          { key: "rollNumber", label: "Student", sortable: true, render: (r) => (
            <div className="flex items-center gap-3">
              <Avatar name={r.user?.name} src={r.user?.avatar} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{r.user?.name}</p>
                <p className="text-xs text-slate-500">{r.rollNumber} · {r.studentId}</p>
              </div>
            </div>
          ) },
          { key: "email", label: "Email", hideOn: "lg", render: (r) => r.user?.email },
          { key: "course", label: "Course", render: (r) => `${r.course?.code} · S${r.semester?.number}` },
          { key: "section", label: "Section", render: (r) => r.section?.name || <span className="text-slate-400">—</span> },
          { key: "batch", label: "Batch", hideOn: "md" },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
        ],
        fields: studentFields,
        multipart: { avatar: "avatar" },
        toForm: (r) => ({
          ...r, name: r.user?.name, email: r.user?.email, phone: r.user?.phone, department: idOf(r.department), course: idOf(r.course),
          semester: idOf(r.semester), section: idOf(r.section), dateOfBirth: toInputDate(r.dateOfBirth), admissionDate: toInputDate(r.admissionDate), avatar: undefined,
        }),
        toPayload: (v) => {
          const out = { ...v };
          for (const k of ["user", "_id", "studentId", "documents", "createdAt", "updatedAt", "__v"]) delete out[k];
          if (!out.password) delete out.password;
          if (!out.rollNumber) delete out.rollNumber;
          out.section = out.section || "";
          return out;
        },
        deleteMessage: (r) => `Deactivate ${r.user?.name}? The account will be disabled but records are kept.`,
        onRowClick: (r) => navigate(`/admin/students/${r._id}`),
        rowActions: (r) => <Button size="icon" variant="ghost" title="View profile" onClick={() => navigate(`/admin/students/${r._id}`)}><Eye className="h-4 w-4" /></Button>,
        headerActions: () => (
          <>
            <Button variant="secondary" icon={FileUp} onClick={() => setImportOpen(true)}>Import CSV</Button>
            <Button variant="secondary" icon={ArrowUpCircle} onClick={() => setPromoteOpen(true)}>Promote</Button>
          </>
        ),
      }} />
      <ImportModal open={importOpen} onClose={(changed) => { setImportOpen(false); if (changed) setKey((k) => k + 1); }} />
      <PromoteModal open={promoteOpen} onClose={(changed) => { setPromoteOpen(false); if (changed) setKey((k) => k + 1); }} />
    </>
  );
}

