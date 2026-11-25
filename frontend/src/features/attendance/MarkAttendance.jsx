import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, Save, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useApi, useOptions } from "../../hooks/useApi";
import api, { errorMessage } from "../../services/api";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, SkeletonRows } from "../../components/ui";
import { OPT } from "../../utils/options";
import { todayISO } from "../../utils/format";

const STATUSES = [
  { value: "present", label: "P", title: "Present", on: "bg-emerald-600 text-white border-emerald-600" },
  { value: "absent", label: "A", title: "Absent", on: "bg-rose-600 text-white border-rose-600" },
  { value: "late", label: "L", title: "Late", on: "bg-amber-500 text-white border-amber-500" },
  { value: "leave", label: "LV", title: "Leave", on: "bg-brand-600 text-white border-brand-600" },
];

/** Select class → subject → date, load students, mark P/A/L/Leave and save. */
export default function MarkAttendance({ initial = {} }) {
  const { user } = useAuth();
  const mine = user.role === "faculty" ? { mine: "true" } : undefined;
  const [section, setSection] = useState(initial.section || "");
  const [subject, setSubject] = useState(initial.subject || "");
  const [date, setDate] = useState(initial.date || todayISO());
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);

  const { options: sections } = useOptions("/sections", OPT.section.map, mine);
  const { options: subjects } = useOptions(section ? "/subjects" : null, OPT.subject.map, { section, ...(mine || {}) });
  const ready = section && subject && date;
  const { data: sheet, loading, error, refetch } = useApi(ready ? "/attendance/sheet" : null, { section, subject, date });

  useEffect(() => {
    if (!sheet) return;
    setMarks(Object.fromEntries(sheet.students.map((s) => [s._id, { status: s.status || "present", remark: s.remark || "" }])));
  }, [sheet]);

  useEffect(() => {
    if (subject && subjects.length && !subjects.some((s) => s.value === subject)) setSubject("");
  }, [subjects, subject]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const m of Object.values(marks)) c[m.status] = (c[m.status] || 0) + 1;
    return c;
  }, [marks]);

  const setAll = (status) => setMarks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, status }])));
  const editable = !sheet || sheet.editable;

  const save = async () => {
    const records = Object.entries(marks).map(([student, v]) => ({ student, status: v.status, remark: v.remark || undefined }));
    setSaving(true);
    try {
      const res = sheet.exists
        ? await api.put(`/attendance/${sheet.attendanceId}`, { records })
        : await api.post("/attendance", { section, subject, date, records });
      toast.success(res.data.message);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="1. Class / section">
            <Select value={section} onChange={(e) => { setSection(e.target.value); setSubject(""); }} options={sections} placeholder="Select class" />
          </Field>
          <Field label="2. Subject">
            <Select value={subject} onChange={(e) => setSubject(e.target.value)} options={subjects} disabled={!section} placeholder={section ? "Select subject" : "Select class first"} />
          </Field>
          <Field label="3. Date">
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="flex items-end">
            {sheet && (
              <div className="w-full rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {sheet.exists ? <><Badge tone="blue">Already marked</Badge> <span className="ml-1">{editable ? "You can edit it." : "Edit window has passed."}</span></> : <Badge tone="amber">Not marked yet</Badge>}
              </div>
            )}
          </div>
        </div>
      </Card>

      {!ready ? (
        <Card><EmptyState title="Select class, subject and date" message="The student list will load automatically." /></Card>
      ) : loading && !sheet ? (
        <Card bodyClass="p-0"><SkeletonRows rows={8} cols={4} /></Card>
      ) : error ? (
        <Card><ErrorState message={error} onRetry={refetch} /></Card>
      ) : sheet && sheet.students.length === 0 ? (
        <Card><EmptyState title="No active students in this section" /></Card>
      ) : sheet && (
        <Card
          bodyClass="p-0"
          title={`${sheet.students.length} students`}
          subtitle={`Present ${counts.present} · Absent ${counts.absent} · Late ${counts.late} · Leave ${counts.leave}`}
          actions={editable && (
            <>
              <Button size="sm" variant="secondary" icon={CheckCheck} onClick={() => setAll("present")}>All present</Button>
              <Button size="sm" variant="secondary" icon={XCircle} onClick={() => setAll("absent")}>All absent</Button>
            </>
          )}
        >
          <ul className="divide-y divide-slate-100">
            {sheet.students.map((s, i) => {
              const m = marks[s._id] || { status: "present", remark: "" };
              const low = s.percentage !== null && s.percentage < sheet.minAttendancePercent;
              return (
                <li key={s._id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-6 text-right text-xs text-slate-400 tabular-nums">{i + 1}</span>
                    <Avatar name={s.name} src={s.avatar} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        {s.rollNumber}
                        {s.percentage !== null && <span className={low ? "inline-flex items-center gap-1 font-semibold text-rose-600" : ""}>{low && <AlertTriangle className="h-3 w-3" />}{s.percentage}%</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-9 sm:pl-0">
                    <div className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                      {STATUSES.map((st) => (
                        <button
                          key={st.value}
                          type="button"
                          title={st.title}
                          disabled={!editable}
                          onClick={() => setMarks((x) => ({ ...x, [s._id]: { ...m, status: st.value } }))}
                          className={`h-8 min-w-9 rounded-md border px-2 text-xs font-semibold transition ${m.status === st.value ? st.on : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={m.remark}
                      disabled={!editable}
                      onChange={(e) => setMarks((x) => ({ ...x, [s._id]: { ...m, remark: e.target.value } }))}
                      placeholder="Remark"
                      className="input hidden h-8 w-36 py-1 text-xs md:block"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
            <p className="text-xs text-slate-500">Late counts as attended. Students below {sheet.minAttendancePercent}% are highlighted.</p>
            {editable && <Button icon={Save} loading={saving} onClick={save}>{sheet.exists ? "Update attendance" : "Save attendance"}</Button>}
          </div>
        </Card>
      )}
    </div>
  );
}
