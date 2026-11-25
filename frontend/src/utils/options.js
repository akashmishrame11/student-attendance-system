import { sectionLabel } from "./format";

/** Reusable optionsFrom configs for ResourceForm / filters. */
export const OPT = {
  department: { path: "/departments", map: (d) => ({ value: d._id, label: `${d.code} — ${d.name}` }) },
  course: { path: "/courses", map: (c) => ({ value: c._id, label: `${c.code} — ${c.name}` }) },
  semester: { path: "/semesters", map: (s) => ({ value: s._id, label: `${s.course?.code ? `${s.course.code} · ` : ""}${s.name} (${s.academicYear})` }) },
  section: { path: "/sections", map: (s) => ({ value: s._id, label: sectionLabel(s) }) },
  faculty: { path: "/faculty", map: (f) => ({ value: f._id, label: `${f.user?.name} (${f.employeeId})` }) },
  subject: { path: "/subjects", map: (s) => ({ value: s._id, label: `${s.code} — ${s.name}` }) },
};

/** Dependent option helpers: semesters of the selected course, etc. */
export const semestersOfCourse = { ...OPT.semester, requires: "course", params: (v) => ({ course: v.course, sort: "number" }) };
export const coursesOfDepartment = { ...OPT.course, requires: "department", params: (v) => ({ department: v.department }) };
export const sectionsOfSemester = { ...OPT.section, requires: "semester", params: (v) => ({ semester: v.semester }) };
export const subjectsOfSemester = { ...OPT.subject, requires: "semester", params: (v) => ({ semester: v.semester }) };

export const idOf = (v) => (v && typeof v === "object" ? v._id : v || "");
