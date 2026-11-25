import { useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useApi } from "../../hooks/useApi";
import { AsyncBlock, Badge, Card, DataTable, FilterSelect, PageSkeleton, ProgressBar, StatCard } from "../../components/ui";
import { fmtDate } from "../../utils/format";

/** Student attendance summary: overall, subject-wise, monthly chart and history. */
export default function AttendanceSummary({ endpoint }) {
  const [subject, setSubject] = useState("");
  const { data, loading, error, refetch } = useApi(endpoint, { subject: subject || undefined, historyLimit: 100 });
  if (loading && !data) return <PageSkeleton />;
  return (
    <AsyncBlock error={error} onRetry={refetch}>
      {data && (
        <div className="space-y-6">
          {data.overall.isLow && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p><b>Low attendance warning.</b> Overall attendance is {data.overall.percentage}%, below the required {data.threshold}%. Students below the threshold may be barred from examinations.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Overall" value={`${data.overall.percentage}%`} icon={CalendarCheck} tone={data.overall.isLow ? "red" : "green"} hint={`Required ${data.threshold}%`} />
            <StatCard label="Present" value={data.overall.present} icon={CheckCircle2} tone="green" hint={`of ${data.overall.total} classes`} />
            <StatCard label="Late" value={data.overall.late} icon={Clock} tone="amber" />
            <StatCard label="Absent" value={data.overall.absent} icon={XCircle} tone="red" hint={`${data.overall.leave} on leave`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card title="Subject-wise attendance" className="xl:col-span-3" bodyClass="p-0">
              <DataTable rows={data.subjects} rowKey={(r) => r.subject?._id} empty={{ title: "No attendance recorded yet" }} columns={[
                { key: "subject", label: "Subject", render: (r) => <div><p className="font-medium text-slate-900">{r.subject?.code}</p><p className="text-xs text-slate-500">{r.subject?.name}</p></div> },
                { key: "attended", label: "Attended", render: (r) => `${r.present + r.late}/${r.total}` },
                { key: "absent", label: "Absent", hideOn: "sm" },
                { key: "pct", label: "Percentage", className: "w-48", render: (r) => (
                  <div className="flex items-center gap-2"><ProgressBar value={r.percentage} /><span className={`w-12 text-right text-xs font-semibold tabular-nums ${r.isLow ? "text-rose-600" : "text-slate-700"}`}>{r.percentage}%</span></div>
                ) },
              ]} />
            </Card>
            <Card title="Monthly attendance" className="xl:col-span-2">
              {data.monthly.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No data yet</p> : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} cursor={{ fill: "#f1f5f9" }} />
                      <ReferenceLine y={data.threshold} stroke="#f43f5e" strokeDasharray="4 4" />
                      <Bar dataKey="percentage" fill="#3b65f5" radius={[6, 6, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <Card title="Attendance history" actions={
            <FilterSelect value={subject} onChange={setSubject} placeholder="All subjects" options={data.subjects.map((s) => ({ value: s.subject?._id, label: s.subject?.code }))} />
          } bodyClass="p-0">
            <DataTable dense rows={data.history} rowKey={(r, i) => `${r._id}-${i}`} empty={{ title: "No classes recorded" }} columns={[
              { key: "date", label: "Date", render: (r) => fmtDate(r.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) },
              { key: "subject", label: "Subject", render: (r) => `${r.subject?.code} — ${r.subject?.name}` },
              { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
              { key: "remark", label: "Remark", hideOn: "sm", render: (r) => r.remark || "—" },
            ]} />
          </Card>
        </div>
      )}
    </AsyncBlock>
  );
}
