import {
  Department, Course, Semester, Section, Subject, Enrollment, Timetable, Student, Faculty,
  Attendance, Assignment, Fee,
} from "../models/index.js";
import { crud, assertNotReferenced } from "../utils/crud.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, DAYS } from "../utils/query.js";
import { getContext } from "../services/access.js";
import { enrollSection, enrollStudent } from "../services/enrollment.js";
import { audit } from "../services/audit.js";
import { STUDENT_POPULATE } from "./student.controller.js";

const facultyUserPopulate = { path: "user", select: "name email" };

/* ------------------------------------------------------------ departments */
export const departments = crud(Department, {
  entity: "Department",
  fields: ["name", "code", "description", "head", "establishedYear", "isActive"],
  searchFields: ["name", "code"],
  filterFields: ["isActive"],
  defaultSort: "name",
  populate: [{ path: "head", select: "employeeId designation", populate: facultyUserPopulate }],
  beforeDelete: (doc) =>
    assertNotReferenced([
      [Course, { department: doc._id }, "course(s)"],
      [Faculty, { department: doc._id }, "faculty member(s)"],
      [Student, { department: doc._id }, "student(s)"],
    ]),
});

export const departmentSummary = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id).populate({ path: "head", populate: facultyUserPopulate });
  if (!dept) throw ApiError.notFound("Department not found");
  const [courses, faculty, students, subjects] = await Promise.all([
    Course.find({ department: dept._id }).sort("name"),
    Faculty.find({ department: dept._id }).populate(facultyUserPopulate).sort("employeeId"),
    Student.countDocuments({ department: dept._id, status: "active" }),
    Subject.countDocuments({ department: dept._id }),
  ]);
  return ok(res, { department: dept, courses, faculty, studentCount: students, subjectCount: subjects });
});

export const departmentStats = asyncHandler(async (_req, res) => {
  const [students, faculty, courses] = await Promise.all([
    Student.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$department", count: { $sum: 1 } } }]),
    Faculty.aggregate([{ $group: { _id: "$department", count: { $sum: 1 } } }]),
    Course.aggregate([{ $group: { _id: "$department", count: { $sum: 1 } } }]),
  ]);
  const toMap = (arr) => Object.fromEntries(arr.map((a) => [String(a._id), a.count]));
  return ok(res, { students: toMap(students), faculty: toMap(faculty), courses: toMap(courses) });
});

/* ---------------------------------------------------------------- courses */
export const courses = crud(Course, {
  entity: "Course",
  fields: ["name", "code", "department", "durationYears", "totalSemesters", "description", "isActive"],
  searchFields: ["name", "code"],
  filterFields: ["department", "isActive"],
  defaultSort: "code",
  populate: [{ path: "department", select: "name code" }],
  beforeDelete: (doc) =>
    assertNotReferenced([
      [Semester, { course: doc._id }, "semester(s)"],
      [Student, { course: doc._id }, "student(s)"],
      [Subject, { course: doc._id }, "subject(s)"],
    ]),
});

/* -------------------------------------------------------------- semesters */
export const semesters = crud(Semester, {
  entity: "Semester",
  fields: ["course", "number", "name", "academicYear", "startDate", "endDate", "isActive"],
  searchFields: ["name", "academicYear"],
  filterFields: ["course", "isActive", "academicYear", "number"],
  defaultSort: "number",
  populate: [{ path: "course", select: "name code totalSemesters" }],
  beforeDelete: (doc) =>
    assertNotReferenced([
      [Section, { semester: doc._id }, "section(s)"],
      [Student, { semester: doc._id }, "student(s)"],
      [Subject, { semester: doc._id }, "subject(s)"],
      [Fee, { semester: doc._id }, "fee structure(s)"],
    ]),
});

export const validateSemesterCourse = asyncHandler(async (req, _res, next) => {
  const courseId = req.body.course;
  if (courseId && req.body.number) {
    const course = await Course.findById(courseId);
    if (!course) throw ApiError.badRequest("Course not found");
    if (Number(req.body.number) > course.totalSemesters) {
      throw ApiError.badRequest(`${course.code} only has ${course.totalSemesters} semesters`);
    }
  }
  next();
});

/* --------------------------------------------------------------- sections */
async function sectionScope(req) {
  if (req.user.role !== "faculty" || req.query.mine !== "true") return {};
  const ctx = await getContext(req);
  return { _id: { $in: ctx.sectionIds } };
}

const sectionPopulate = [
  { path: "course", select: "name code" },
  { path: "semester", select: "name number academicYear" },
  { path: "classTeacher", select: "employeeId", populate: facultyUserPopulate },
];

export const sections = crud(Section, {
  entity: "Section",
  fields: ["name", "course", "semester", "batch", "classTeacher", "room", "capacity", "isActive"],
  searchFields: ["name", "room", "batch"],
  filterFields: ["course", "semester", "isActive", "classTeacher"],
  defaultSort: "name",
  populate: sectionPopulate,
  scope: sectionScope,
  beforeDelete: (doc) =>
    assertNotReferenced([
      [Student, { section: doc._id }, "student(s)"],
      [Timetable, { section: doc._id }, "timetable entr(ies)"],
      [Attendance, { section: doc._id }, "attendance record(s)"],
    ]),
});

/** Section list including current student strength. */
export const listSectionsWithStrength = asyncHandler(async (req, res, next) => {
  if (req.query.withStrength !== "true") return next();
  const filter = { ...(await sectionScope(req)) };
  for (const f of ["course", "semester"]) if (req.query[f]) filter[f] = req.query[f];
  const data = await Section.find(filter).sort("name").populate(sectionPopulate).lean();
  const counts = await Student.aggregate([
    { $match: { section: { $in: data.map((d) => d._id) }, status: "active" } },
    { $group: { _id: "$section", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  const rows = data.map((d) => ({ ...d, strength: map[String(d._id)] || 0 }));
  return ok(res, rows, "Success", buildMeta(rows.length, 1, rows.length || 1));
});

export const validateSection = asyncHandler(async (req, _res, next) => {
  const { course, semester } = req.body;
  if (course && semester) {
    const sem = await Semester.findById(semester);
    if (!sem || String(sem.course) !== String(course)) throw ApiError.badRequest("Semester does not belong to the selected course");
  }
  next();
});

export const sectionStudents = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.id);
  if (!section) throw ApiError.notFound("Section not found");
  if (req.user.role === "faculty") {
    const ctx = await getContext(req);
    if (!ctx.sectionIds.includes(String(section._id))) throw ApiError.forbidden("You are not assigned to this section");
  }
  const students = await Student.find({ section: section._id, status: "active" }).populate(STUDENT_POPULATE).sort("rollNumber");
  return ok(res, students);
});

export const assignStudentsToSection = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.id);
  if (!section) throw ApiError.notFound("Section not found");
  const { studentIds = [] } = req.body;
  const current = await Student.countDocuments({ section: section._id, status: "active", _id: { $nin: studentIds } });
  if (current + studentIds.length > section.capacity) {
    throw ApiError.badRequest(`Capacity exceeded: ${section.capacity} max, ${current + studentIds.length} requested`);
  }
  const students = await Student.find({ _id: { $in: studentIds } });
  const wrong = students.filter((s) => String(s.semester) !== String(section.semester));
  if (wrong.length) throw ApiError.badRequest(`${wrong.length} student(s) are not in this section's semester`);
  for (const s of students) {
    s.section = section._id;
    await s.save();
    await enrollStudent(s);
  }
  await audit(req, "assign_students", "Section", section._id, { count: students.length });
  return ok(res, { assigned: students.length }, `${students.length} student(s) assigned to section ${section.name}`);
});

/* --------------------------------------------------------------- subjects */
async function subjectScope(req) {
  if (req.query.section) {
    const sec = await Section.findById(req.query.section).lean();
    if (!sec) throw ApiError.badRequest("Section not found");
    const base = { semester: sec.semester };
    if (req.user.role === "faculty" && req.query.mine === "true") base._id = { $in: (await getContext(req)).subjectIds };
    return base;
  }
  if (req.user.role === "faculty" && req.query.mine === "true") {
    const ctx = await getContext(req);
    return { _id: { $in: ctx.subjectIds } };
  }
  if (req.user.role === "student" && req.query.mine === "true") {
    const ctx = await getContext(req);
    return { semester: ctx.student.semester, course: ctx.student.course };
  }
  return {};
}

export const subjects = crud(Subject, {
  entity: "Subject",
  fields: ["name", "code", "department", "course", "semester", "type", "credits", "faculty", "description", "isActive"],
  searchFields: ["name", "code"],
  filterFields: ["department", "course", "semester", "type", "faculty", "isActive"],
  defaultSort: "code",
  scope: subjectScope,
  populate: [
    { path: "department", select: "name code" },
    { path: "course", select: "name code" },
    { path: "semester", select: "name number academicYear" },
    { path: "faculty", select: "employeeId designation", populate: facultyUserPopulate },
  ],
  beforeDelete: (doc) =>
    assertNotReferenced([
      [Timetable, { subject: doc._id }, "timetable entr(ies)"],
      [Attendance, { subject: doc._id }, "attendance record(s)"],
      [Assignment, { subject: doc._id }, "assignment(s)"],
    ]),
});

export const validateSubject = asyncHandler(async (req, _res, next) => {
  const { course, semester } = req.body;
  if (course && semester) {
    const sem = await Semester.findById(semester);
    if (!sem || String(sem.course) !== String(course)) throw ApiError.badRequest("Semester does not belong to the selected course");
  }
  next();
});

/* ------------------------------------------------------------ enrollments */
export const enrollments = crud(Enrollment, {
  entity: "Enrollment",
  fields: ["student", "subject", "section", "semester", "status"],
  filterFields: ["student", "subject", "section", "semester", "status"],
  populate: [
    { path: "student", select: "studentId rollNumber", populate: { path: "user", select: "name" } },
    { path: "subject", select: "name code" },
    { path: "section", select: "name" },
    { path: "semester", select: "name number" },
  ],
  scope: async (req) => {
    if (req.user.role === "student") return { student: (await getContext(req)).student._id };
    if (req.user.role === "faculty") return { subject: { $in: (await getContext(req)).subjectIds } };
    return {};
  },
});

export const syncSectionEnrollments = asyncHandler(async (req, res) => {
  const result = await enrollSection(req.params.sectionId);
  await audit(req, "sync_enrollments", "Section", req.params.sectionId, result);
  return ok(res, result, `Enrolled ${result.students} students in ${result.enrollments} subject slots`);
});

/* -------------------------------------------------------------- timetable */
const ttPopulate = [
  { path: "subject", select: "name code type" },
  { path: "faculty", select: "employeeId", populate: facultyUserPopulate },
  {
    path: "section",
    select: "name room course semester",
    populate: [{ path: "course", select: "code name" }, { path: "semester", select: "number name" }],
  },
];

export const listTimetable = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const filter = {};
  for (const f of ["section", "faculty", "day", "subject", "room"]) if (req.query[f]) filter[f] = req.query[f];
  if (req.query.today === "true") filter.day = DAYS[new Date().getDay()];

  if (ctx.role === "student") {
    if (!ctx.student.section) return ok(res, []);
    filter.section = ctx.student.section;
    delete filter.faculty;
  } else if (ctx.role === "faculty") {
    if (filter.section && !ctx.sectionIds.includes(String(filter.section))) throw ApiError.forbidden("You are not assigned to this section");
    if (!filter.section) filter.faculty = ctx.faculty._id;
  }
  const data = await Timetable.find(filter).populate(ttPopulate).sort({ startTime: 1 });
  const order = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  data.sort((a, b) => order[a.day] - order[b.day] || a.startTime.localeCompare(b.startTime));
  return ok(res, data);
});

async function checkTimetableConflicts(entry, excludeId) {
  const { day, startTime, endTime, section, faculty, room } = entry;
  const overlapping = await Timetable.find({
    _id: { $ne: excludeId },
    day,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
    $or: [{ section }, { faculty }, { room }],
  }).populate(ttPopulate);

  for (const o of overlapping) {
    const when = `${o.day} ${o.startTime}-${o.endTime}`;
    if (String(o.section?._id) === String(section)) {
      throw ApiError.conflict(`Section already has ${o.subject?.code} at ${when}`);
    }
    if (String(o.faculty?._id) === String(faculty)) {
      throw ApiError.conflict(`${o.faculty?.user?.name || "Faculty"} is already teaching ${o.section?.course?.code}-${o.section?.name} at ${when}`);
    }
    if (o.room === room) throw ApiError.conflict(`Room ${room} is already booked at ${when}`);
  }
}

async function validateTimetableEntry(entry) {
  const [section, subject, faculty] = await Promise.all([
    Section.findById(entry.section),
    Subject.findById(entry.subject),
    Faculty.findById(entry.faculty),
  ]);
  if (!section) throw ApiError.badRequest("Section not found");
  if (!subject) throw ApiError.badRequest("Subject not found");
  if (!faculty) throw ApiError.badRequest("Faculty not found");
  if (String(subject.semester) !== String(section.semester)) {
    throw ApiError.badRequest("Subject does not belong to this section's semester");
  }
}

const TT_FIELDS = ["section", "subject", "faculty", "room", "day", "startTime", "endTime"];

export const createTimetable = asyncHandler(async (req, res) => {
  const entry = Object.fromEntries(TT_FIELDS.map((f) => [f, req.body[f]]));
  await validateTimetableEntry(entry);
  const doc = new Timetable(entry);
  await doc.validate();
  await checkTimetableConflicts(entry);
  await doc.save();
  await audit(req, "create", "Timetable", doc._id);
  await doc.populate(ttPopulate);
  return created(res, doc, "Timetable slot added");
});

export const updateTimetable = asyncHandler(async (req, res) => {
  const doc = await Timetable.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Timetable slot not found");
  for (const f of TT_FIELDS) if (req.body[f] !== undefined) doc.set(f, req.body[f]);
  await doc.validate();
  await validateTimetableEntry(doc);
  await checkTimetableConflicts(doc, doc._id);
  await doc.save();
  await audit(req, "update", "Timetable", doc._id);
  await doc.populate(ttPopulate);
  return ok(res, doc, "Timetable slot updated");
});

export const deleteTimetable = asyncHandler(async (req, res) => {
  const doc = await Timetable.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound("Timetable slot not found");
  await audit(req, "delete", "Timetable", doc._id);
  return ok(res, { _id: doc._id }, "Timetable slot deleted");
});

/** Simple paginated list of distinct rooms in use, for dropdowns. */
export const listRooms = asyncHandler(async (_req, res) => {
  const [a, b] = await Promise.all([Timetable.distinct("room"), Section.distinct("room")]);
  return ok(res, [...new Set([...a, ...b].filter(Boolean))].sort());
});

