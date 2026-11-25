import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, ClipboardList, Users } from "lucide-react";
import { useApi, useDebounce, useOptions } from "../../hooks/useApi";
import { AsyncBlock, Avatar, Badge, Button, Card, DataTable, FilterSelect, Modal, PageHeader, Pagination, SearchInput } from "../../components/ui";
import { OPT } from "../../utils/options";
import { sectionLabel } from "../../utils/format";

export function MyClasses() {
  const { data, loading, error, refetch } = useApi("/sections", { mine: "true", withStrength: "true" });
  const [open, setOpen] = useState(null);
  const { data: students, loading: sl } = useApi(open ? `/sections/${open._id}/students` : null);
  return (
    <>
      <PageHeader title="My Classes" subtitle="Classes and sections assigned to you" />
      <AsyncBlock loading={loading && !data} error={error} onRetry={refetch} empty={!data?.length} emptyProps={{ title: "No classes assigned", message: "Ask the administrator to assign you to sections." }}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((c) => (
            <div key={c._id} className="card p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-lg font-semibold text-slate-900">{sectionLabel(c)}</p><p className="text-sm text-slate-500">{c.course?.name}</p></div>
                <Badge tone="blue">{c.strength} students</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <p>Semester: <b>{c.semester?.number}</b></p><p>Room: <b>{c.room || "—"}</b></p>
                <p>Batch: <b>{c.batch || "—"}</b></p><p>Year: <b>{c.semester?.academicYear}</b></p>
                <p className="col-span-2">Class teacher: <b>{c.classTeacher?.user?.name || "—"}</b></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="soft" icon={Users} onClick={() => setOpen(c)}>Student list</Button>
                <Link to="/faculty/attendance"><Button size="sm" variant="secondary" icon={CalendarCheck}>Attendance</Button></Link>
                <Link to="/faculty/assignments"><Button size="sm" variant="secondary" icon={ClipboardList}>Assignments</Button></Link>
              </div>
            </div>
          ))}
        </div>
      </AsyncBlock>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} size="lg" title={`Students — ${sectionLabel(open)}`}>
        <DataTable dense loading={sl} rows={students} empty={{ title: "No students" }} columns={[
          { key: "rollNumber", label: "Roll No" },
          { key: "name", label: "Name", render: (s) => s.user?.name },
          { key: "email", label: "Email", render: (s) => s.user?.email },
          { key: "phone", label: "Phone", hideOn: "sm", render: (s) => s.user?.phone },
        ]} />
      </Modal>
    </>
  );
}

export function MyStudents() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { options: sections } = useOptions("/sections", OPT.section.map, { mine: "true" });
  const { data, meta, loading, error, refetch } = useApi("/students", { page, limit: 15, search: q || undefined, section: section || undefined });
  return (
    <>
      <PageHeader title="My Students" subtitle="Students in your assigned classes" />
      <Card bodyClass="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or roll number…" className="sm:max-w-xs sm:flex-1" />
          <FilterSelect value={section} onChange={(v) => { setSection(v); setPage(1); }} options={sections} placeholder="All my classes" />
        </div>
        <DataTable loading={loading && !data} error={error} onRetry={refetch} rows={data} onRowClick={(s) => navigate(`/faculty/students/${s._id}`)} empty={{ title: "No students found" }} columns={[
          { key: "name", label: "Student", render: (s) => <div className="flex items-center gap-3"><Avatar size="sm" name={s.user?.name} src={s.user?.avatar} /><div><p className="font-medium">{s.user?.name}</p><p className="text-xs text-slate-500">{s.rollNumber}</p></div></div> },
          { key: "class", label: "Class", render: (s) => `${s.course?.code} S${s.semester?.number}-${s.section?.name || "—"}` },
          { key: "email", label: "Email", hideOn: "md", render: (s) => s.user?.email },
          { key: "guardian", label: "Guardian", hideOn: "lg", render: (s) => s.guardianPhone ? `${s.guardianName} (${s.guardianPhone})` : "—" },
          { key: "a", label: "", className: "text-right", render: (s) => <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); navigate(`/faculty/students/${s._id}`); }}>Profile & attendance</Button> },
        ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}

export function MySubjects() {
  const { data, loading, error, refetch } = useApi("/subjects", { mine: "true", all: "true" });
  const { data: timetable } = useApi("/timetable");
  const { data: assignments } = useApi("/assignments", { limit: 200 });
  return (
    <>
      <PageHeader title="My Subjects" subtitle="Subjects you teach, with schedule and assignment counts" />
      <AsyncBlock loading={loading && !data} error={error} onRetry={refetch} empty={!data?.length} emptyProps={{ title: "No subjects assigned" }}>
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((s) => {
            const slots = (timetable || []).filter((t) => t.subject?._id === s._id);
            const asg = (assignments || []).filter((a) => a.subject?._id === s._id);
            const secs = [...new Map(slots.map((t) => [t.section?._id, t.section])).values()];
            return (
              <div key={s._id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div><p className="font-semibold text-slate-900">{s.code} — {s.name}</p><p className="text-sm text-slate-500">{s.course?.code} · {s.semester?.name} · {s.credits} credits</p></div>
                  <Badge status={s.type} />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-slate-600">Sections: {secs.length ? secs.map(sectionLabel).join(", ") : "—"}</p>
                  <p className="text-slate-600">Weekly classes: <b>{slots.length}</b> · Assignments: <b>{asg.length}</b></p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((t) => <Badge key={t._id} tone="slate">{t.day.slice(0, 3)} {t.startTime}</Badge>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AsyncBlock>
    </>
  );
}

export function StudentClasses() {
  const { data: subjects, loading, error, refetch } = useApi("/subjects", { mine: "true", all: "true" });
  const { data: timetable } = useApi("/timetable");
  return (
    <>
      <PageHeader title="My Classes" subtitle="Your subjects, faculty, classrooms and weekly schedule" />
      <AsyncBlock loading={loading && !subjects} error={error} onRetry={refetch} empty={!subjects?.length} emptyProps={{ title: "No subjects found for your semester" }}>
        <Card bodyClass="p-0">
          <DataTable rows={subjects} columns={[
            { key: "code", label: "Code", render: (s) => <span className="font-semibold">{s.code}</span> },
            { key: "name", label: "Subject" },
            { key: "type", label: "Type", render: (s) => <Badge status={s.type} /> },
            { key: "credits", label: "Credits", hideOn: "sm" },
            { key: "faculty", label: "Faculty", render: (s) => { const t = (timetable || []).find((x) => x.subject?._id === s._id); return t?.faculty?.user?.name || s.faculty?.user?.name || "—"; } },
            { key: "room", label: "Classroom", hideOn: "md", render: (s) => [...new Set((timetable || []).filter((x) => x.subject?._id === s._id).map((x) => x.room))].join(", ") || "—" },
            { key: "schedule", label: "Schedule", hideOn: "lg", render: (s) => <div className="flex flex-wrap gap-1">{(timetable || []).filter((x) => x.subject?._id === s._id).map((x) => <Badge key={x._id} tone="slate">{x.day.slice(0, 3)} {x.startTime}</Badge>)}</div> },
          ]} />
        </Card>
      </AsyncBlock>
    </>
  );
}
