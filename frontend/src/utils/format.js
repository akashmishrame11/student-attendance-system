export const fmtDate = (d, opts = { day: "2-digit", month: "short", year: "numeric" }) =>
  d ? new Date(d).toLocaleDateString("en-IN", opts) : "—";

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtMoney = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);

export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const titleCase = (s = "") => String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
};

export const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

export const sectionLabel = (s) =>
  s ? `${s.course?.code ? `${s.course.code} ` : ""}${s.semester?.number ? `S${s.semester.number}-` : ""}${s.name}` : "—";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const todayName = () => ["Sunday", ...DAYS][new Date().getDay()];

/** Tone for status badges. */
export const STATUS_TONE = {
  active: "green", inactive: "slate", graduated: "blue", suspended: "red", on_leave: "amber",
  present: "green", absent: "red", late: "amber", leave: "blue",
  pending: "amber", submitted: "blue", late_submitted: "amber", evaluated: "green", resubmission_required: "red", missing: "red",
  approved: "green", rejected: "red",
  open: "amber", in_progress: "blue", resolved: "green", closed: "slate",
  paid: "green", partial: "amber", unpaid: "slate", overdue: "red",
  issued: "blue", returned: "green", lost: "red",
  pass: "green", fail: "red",
  internal: "blue", midterm: "violet", practical: "amber", final: "red",
  theory: "blue",
  high: "red", medium: "amber", low: "slate",
};
