import { DAYS, todayName, sectionLabel } from "../../utils/format";
import { EmptyState } from "../../components/ui";
import { CalendarX2 } from "lucide-react";

const COLORS = ["bg-brand-50 border-brand-200 text-brand-900", "bg-emerald-50 border-emerald-200 text-emerald-900", "bg-amber-50 border-amber-200 text-amber-900", "bg-violet-50 border-violet-200 text-violet-900", "bg-rose-50 border-rose-200 text-rose-900", "bg-cyan-50 border-cyan-200 text-cyan-900"];

/**
 * Weekly grid (desktop) / per-day list (mobile).
 * show: what to display as the secondary line — "faculty" | "section"
 */
export default function WeeklyTimetable({ slots = [], show = "faculty", onSlotClick, emptyAction }) {
  if (!slots.length) return <EmptyState icon={CalendarX2} title="No timetable entries" message="Classes will appear here once the timetable is published." action={emptyAction} />;

  const times = [...new Set(slots.map((s) => `${s.startTime}-${s.endTime}`))].sort();
  const days = DAYS.filter((d) => d !== "Saturday" || slots.some((s) => s.day === "Saturday"));
  const subjects = [...new Set(slots.map((s) => s.subject?._id))];
  const colorOf = (id) => COLORS[subjects.indexOf(id) % COLORS.length];
  const today = todayName();

  const Cell = ({ s }) => (
    <button
      type="button"
      onClick={onSlotClick ? () => onSlotClick(s) : undefined}
      className={`block w-full rounded-lg border px-2.5 py-2 text-left text-xs transition ${colorOf(s.subject?._id)} ${onSlotClick ? "hover:shadow-md" : "cursor-default"}`}
    >
      <p className="font-semibold">{s.subject?.code}</p>
      <p className="truncate opacity-80">{s.subject?.name}</p>
      <p className="mt-1 truncate opacity-70">{show === "section" ? sectionLabel(s.section) : s.faculty?.user?.name} · {s.room}</p>
    </button>
  );

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th className="w-28 px-2 text-left text-xs font-semibold uppercase text-slate-500">Time</th>
              {days.map((d) => (
                <th key={d} className={`px-2 py-1 text-left text-xs font-semibold uppercase ${d === today ? "text-brand-700" : "text-slate-500"}`}>
                  {d.slice(0, 3)} {d === today && <span className="ml-1 rounded bg-brand-100 px-1 text-[10px]">Today</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t) => (
              <tr key={t}>
                <td className="px-2 align-top text-xs font-medium text-slate-500 tabular-nums">{t.replace("-", " – ")}</td>
                {days.map((d) => {
                  const cell = slots.filter((s) => s.day === d && `${s.startTime}-${s.endTime}` === t);
                  return (
                    <td key={d} className="align-top">
                      <div className="space-y-1">{cell.map((s) => <Cell key={s._id} s={s} />)}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-4 md:hidden">
        {days.map((d) => {
          const list = slots.filter((s) => s.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
          if (!list.length) return null;
          return (
            <div key={d}>
              <p className={`mb-2 text-xs font-semibold uppercase ${d === today ? "text-brand-700" : "text-slate-500"}`}>{d}{d === today ? " · Today" : ""}</p>
              <div className="space-y-2">
                {list.map((s) => (
                  <div key={s._id} className="flex gap-3">
                    <p className="w-20 shrink-0 pt-2 text-xs text-slate-500 tabular-nums">{s.startTime}–{s.endTime}</p>
                    <div className="flex-1"><Cell s={s} /></div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Compact list of today's classes for dashboards. */
export function TodayClasses({ slots = [], show = "faculty" }) {
  if (!slots.length) return <EmptyState icon={CalendarX2} title="No classes today" message="Enjoy your free day!" />;
  return (
    <ul className="divide-y divide-slate-100">
      {slots.map((s) => (
        <li key={s._id} className="flex items-center gap-4 py-3">
          <div className="w-24 shrink-0 text-xs font-medium text-slate-500 tabular-nums">{s.startTime} – {s.endTime}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{s.subject?.code} · {s.subject?.name}</p>
            <p className="truncate text-xs text-slate-500">{show === "section" ? sectionLabel(s.section) : s.faculty?.user?.name} · Room {s.room}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
