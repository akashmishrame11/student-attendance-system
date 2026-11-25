import { useState } from "react";
import { Award, FileText, Printer } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { AsyncBlock, Badge, Button, Card, DataTable, PageHeader, Tabs } from "../../components/ui";
import { ExamSchedule } from "../shared/ExamDetail";
import { fmtDate } from "../../utils/format";

export function StudentExams() {
  const [tab, setTab] = useState("upcoming");
  const { data, loading, error, refetch } = useApi("/exams", { upcoming: tab === "upcoming" ? "true" : undefined, limit: 50 });
  return (
    <>
      <PageHeader title="Examinations" subtitle="Upcoming exams and examination timetables" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "upcoming", label: "Upcoming" }, { value: "all", label: "All exams" }]} />
      <AsyncBlock loading={loading && !data} error={error} onRetry={refetch} empty={!data?.length} emptyProps={{ icon: FileText, title: "No examinations scheduled" }}>
        <div className="space-y-6">
          {data?.map((e) => (
            <div key={e._id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">{e.name}</h3>
                <Badge status={e.type} />
                <span className="text-sm text-slate-500">{fmtDate(e.startDate)} – {fmtDate(e.endDate)}</span>
              </div>
              <ExamSchedule exam={e} />
            </div>
          ))}
        </div>
      </AsyncBlock>
    </>
  );
}

export function StudentResults() {
  const { data, loading, error, refetch } = useApi("/results/me");
  return (
    <>
      <PageHeader title="Results" subtitle="Published examination results" actions={data?.length > 0 && <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>} />
      <AsyncBlock loading={loading && !data} error={error} onRetry={refetch} empty={!data?.length} emptyProps={{ icon: Award, title: "No results published yet", message: "Results appear here once your college publishes them." }}>
        <div className="space-y-6">
          {data?.map((r) => (
            <Card key={r._id} title={r.exam?.name} subtitle={`${r.exam?.semester?.name || ""} · ${r.exam?.academicYear || ""} · ${fmtDate(r.exam?.startDate)}`}
              actions={<><Badge tone="violet">Grade {r.grade}</Badge><Badge status={r.status} /></>} bodyClass="p-0">
              <DataTable dense rows={r.marks} rowKey={(m) => m.subject?._id} columns={[
                { key: "subject", label: "Subject", render: (m) => `${m.subject?.code} — ${m.subject?.name}` },
                { key: "type", label: "Type", hideOn: "sm", render: (m) => <Badge status={m.subject?.type} /> },
                { key: "marks", label: "Marks", render: (m) => (m.isAbsent ? "Absent" : `${m.marksObtained} / ${m.maxMarks}`) },
                { key: "pass", label: "Pass", hideOn: "sm", render: (m) => m.passMarks },
                { key: "grade", label: "Grade", render: (m) => <span className={`font-semibold ${m.grade === "F" || m.grade === "AB" ? "text-rose-600" : ""}`}>{m.grade}</span> },
              ]} />
              <div className="flex flex-wrap justify-end gap-6 border-t border-slate-100 px-5 py-3 text-sm">
                <span>Total: <b>{r.total}/{r.maxTotal}</b></span>
                <span>Percentage: <b>{r.percentage}%</b></span>
              </div>
            </Card>
          ))}
        </div>
      </AsyncBlock>
    </>
  );
}
