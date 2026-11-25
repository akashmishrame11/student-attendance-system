import { useState } from "react";
import { BarChart2 } from "lucide-react";
import ResourcePage from "../../features/resource/ResourcePage";
import { Avatar, Badge, Button, Modal, StatCard } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import WeeklyTimetable from "../../features/timetable/WeeklyTimetable";
import { OPT, idOf } from "../../utils/options";
import { sectionLabel, toInputDate } from "../../utils/format";

const DESIGNATIONS = ["Professor", "Associate Professor", "Assistant Professor", "Lecturer", "Lab Assistant", "Head of Department"].map((d) => ({ value: d, label: d }));
const STATUS = [{ value: "active", label: "Active" }, { value: "on_leave", label: "On leave" }, { value: "inactive", label: "Inactive" }];

function Workload({ id, onClose }) {
  const { data, loading } = useApi(id ? `/faculty/${id}/workload` : null);
  return (
    <Modal open={Boolean(id)} onClose={onClose} size="xl" title={data ? `${data.faculty.name} — timetable & workload` : "Workload"}>
      {loading || !data ? <p className="text-sm text-slate-500">Loading…</p> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Weekly hours" value={data.weeklyHours} />
            <StatCard label="Classes/week" value={data.classesPerWeek} />
            <StatCard label="Subjects" value={data.subjects} />
            <StatCard label="Sections" value={data.sections} />
            <StatCard label="Students" value={data.students} />
          </div>
          <WeeklyTimetable slots={data.timetable} show="section" />
        </div>
      )}
    </Modal>
  );
}

export default function Faculty() {
  const [workload, setWorkload] = useState(null);
  return (
    <>
      <ResourcePage config={{
        title: "Faculty", subtitle: "Teaching staff, assignments and workload", endpoint: "/faculty", entity: "Faculty", defaultSort: "employeeId", modalSize: "lg",
        searchPlaceholder: "Search name, email or employee ID…",
        filters: [{ key: "department", label: "All departments", optionsFrom: OPT.department }, { key: "status", label: "Any status", options: STATUS }],
        columns: [
          { key: "employeeId", label: "Faculty", sortable: true, render: (r) => (
            <div className="flex items-center gap-3">
              <Avatar name={r.user?.name} src={r.user?.avatar} size="sm" />
              <div className="min-w-0"><p className="truncate font-medium text-slate-900">{r.user?.name}</p><p className="text-xs text-slate-500">{r.employeeId} · {r.user?.email}</p></div>
            </div>
          ) },
          { key: "department", label: "Dept", render: (r) => r.department?.code },
          { key: "designation", label: "Designation", hideOn: "md" },
          { key: "subjects", label: "Subjects", hideOn: "lg", render: (r) => <div className="flex flex-wrap gap-1">{r.subjects?.map((s) => <Badge key={s._id} tone="slate">{s.code}</Badge>)}</div> },
          { key: "sections", label: "Classes", hideOn: "lg", render: (r) => r.sections?.map(sectionLabel).join(", ") || "—" },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
        ],
        fields: [
          { name: "name", label: "Full name", required: true },
          { name: "email", label: "Email", type: "email", required: true, rules: { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" } } },
          { name: "phone", label: "Phone" },
          { name: "password", label: "Initial password", type: "password", createOnly: true, hint: "Leave empty to use <EmployeeID>@123" },
          { name: "employeeId", label: "Employee ID", createOnly: true, hint: "Auto-generated if empty", placeholder: "Auto" },
          { name: "department", label: "Department", type: "select", required: true, optionsFrom: OPT.department },
          { name: "designation", label: "Designation", type: "select", options: DESIGNATIONS, placeholder: false },
          { name: "joiningDate", label: "Joining date", type: "date" },
          { name: "qualification", label: "Qualification" },
          { name: "specialization", label: "Specialization" },
          { name: "status", label: "Status", type: "select", options: STATUS, placeholder: false, showWhen: (_v, e) => e },
          { name: "courses", label: "Assigned courses", type: "multiselect", optionsFrom: OPT.course },
          { name: "subjects", label: "Assigned subjects", type: "multiselect", optionsFrom: OPT.subject },
          { name: "sections", label: "Assigned classes / sections", type: "multiselect", optionsFrom: OPT.section },
          { name: "avatar", label: "Profile photo", type: "file", accept: ".jpg,.jpeg,.png,.webp" },
        ],
        defaults: { designation: "Assistant Professor", subjects: [], sections: [], courses: [] },
        multipart: { avatar: "avatar" },
        toForm: (r) => ({
          ...r, name: r.user?.name, email: r.user?.email, phone: r.user?.phone, department: idOf(r.department), joiningDate: toInputDate(r.joiningDate),
          subjects: (r.subjects || []).map(idOf), sections: (r.sections || []).map(idOf), courses: (r.courses || []).map(idOf), avatar: undefined,
        }),
        toPayload: (v) => {
          const out = { ...v };
          for (const k of ["user", "_id", "createdAt", "updatedAt", "__v"]) delete out[k];
          if (!out.password) delete out.password;
          if (!out.employeeId) delete out.employeeId;
          return out;
        },
        deleteMessage: (r) => `Deactivate ${r.user?.name}? Their login will be disabled.`,
        rowActions: (r) => <Button size="icon" variant="ghost" title="Timetable & workload" onClick={() => setWorkload(r._id)}><BarChart2 className="h-4 w-4" /></Button>,
      }} />
      <Workload id={workload} onClose={() => setWorkload(null)} />
    </>
  );
}
