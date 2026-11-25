import { useState } from "react";
import { FileBarChart, Play, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import ExportButtons from "../../features/ExportButtons";
import { Button, Card, DataTable, Field, Input, PageHeader, Select } from "../../components/ui";
import { OPT } from "../../utils/options";
import { fmtDateTime } from "../../utils/format";

const ALL = [
  { value: "students", label: "Student records", filters: ["department", "course", "section", "status"] },
  { value: "faculty", label: "Faculty records", filters: ["department"], admin: true },
  { value: "attendance", label: "Attendance", filters: ["section", "groupBy", "dates"] },
  { value: "assignments", label: "Assignments", filters: ["section", "dates"] },
  { value: "results", label: "Examination results", filters: ["exam"] },
  { value: "fees", label: "Fee collection", filters: ["dates"], admin: true },
  { value: "departments", label: "Departments", filters: [], admin: true },
  { value: "courses", label: "Courses", filters: [], admin: true },
  { value: "library", label: "Library issues", filters: ["dates", "libraryStatus"], admin: true },
  { value: "leaves", label: "Leave requests", filters: ["dates", "leaveStatus"], admin: true },
];

export default function Reports() {
  const { user } = useAuth();
  const types = ALL.filter((t) => user.role === "admin" || !t.admin);
  const [type, setType] = useState(types[0].value);
  const [params, setParams] = useState({});
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const def = types.find((t) => t.value === type);
  const mine = user.role === "faculty" ? { mine: "true" } : undefined;
  const { options: depts } = useOptions(def.filters.includes("department") ? "/departments" : null, OPT.department.map);
  const { options: courses } = useOptions(def.filters.includes("course") ? "/courses" : null, OPT.course.map);
  const { options: sections } = useOptions(def.filters.includes("section") ? "/sections" : null, OPT.section.map, mine);
  const { options: exams } = useOptions(def.filters.includes("exam") ? "/exams" : null, (e) => ({ value: e._id, label: `${e.name} — ${e.course?.code} ${e.semester?.name}` }), { limit: 100 });
  const set = (k) => (e) => setParams((p) => ({ ...p, [k]: e.target.value || undefined }));

  const run = async () => {
    if (type === "results" && !params.exam) return toast.error("Select an examination");
    setBusy(true);
    try {
      const { data } = await api.get(`/reports/${type}`, { params });
      setReport(data.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Generate reports and download them as Excel, PDF or CSV" />
      <Card className="no-print mb-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Report"><Select value={type} onChange={(e) => { setType(e.target.value); setParams({}); setReport(null); }} options={types} placeholder={false} /></Field>
          {def.filters.includes("department") && <Field label="Department"><Select value={params.department || ""} onChange={set("department")} options={depts} placeholder="All" /></Field>}
          {def.filters.includes("course") && <Field label="Course"><Select value={params.course || ""} onChange={set("course")} options={courses} placeholder="All" /></Field>}
          {def.filters.includes("section") && <Field label="Class"><Select value={params.section || ""} onChange={set("section")} options={sections} placeholder="All" /></Field>}
          {def.filters.includes("status") && <Field label="Status"><Select value={params.status || ""} onChange={set("status")} options={["active", "inactive", "graduated", "suspended"].map((s) => ({ value: s, label: s }))} placeholder="All" /></Field>}
          {def.filters.includes("groupBy") && <Field label="Group by"><Select value={params.groupBy || "section"} onChange={set("groupBy")} options={[{ value: "section", label: "Class" }, { value: "subject", label: "Subject" }, { value: "student", label: "Student" }]} placeholder={false} /></Field>}
          {def.filters.includes("exam") && <Field label="Examination"><Select value={params.exam || ""} onChange={set("exam")} options={exams} /></Field>}
          {def.filters.includes("libraryStatus") && <Field label="Status"><Select value={params.status || ""} onChange={set("status")} options={["issued", "returned", "lost"].map((s) => ({ value: s, label: s }))} placeholder="All" /></Field>}
          {def.filters.includes("leaveStatus") && <Field label="Status"><Select value={params.status || ""} onChange={set("status")} options={["pending", "approved", "rejected"].map((s) => ({ value: s, label: s }))} placeholder="All" /></Field>}
          {def.filters.includes("dates") && (
            <>
              <Field label="From"><Input type="date" value={params.from || ""} onChange={set("from")} /></Field>
              <Field label="To"><Input type="date" value={params.to || ""} onChange={set("to")} /></Field>
            </>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button icon={Play} loading={busy} onClick={run}>Generate</Button>
          <ExportButtons size="md" path={`/reports/${type}`} params={params} />
          {report && <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>}
        </div>
      </Card>
      {report ? (
        <Card className="print-area" title={report.title} subtitle={`${report.count} rows · generated ${fmtDateTime(report.generatedAt)}`} bodyClass="p-0">
          <DataTable dense rows={report.rows} rowKey={(_r, i) => i} columns={report.columns.map((c) => ({ key: c.key, label: c.label, render: (r) => r[c.key] ?? "—" }))} empty={{ title: "No data for these filters" }} />
        </Card>
      ) : (
        <Card><div className="flex flex-col items-center py-12 text-center text-slate-500"><FileBarChart className="h-10 w-10 text-slate-300" /><p className="mt-3 text-sm">Choose a report and click Generate.</p></div></Card>
      )}
    </>
  );
}
