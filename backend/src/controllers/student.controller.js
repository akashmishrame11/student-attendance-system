import mongoose from "mongoose";
import { User, Student, Course, Semester, Section, Department, Attendance, AssignmentSubmission, ExaminationResult, FeePayment, BookIssue, Enrollment } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, escapeRegex, getPagination, getSort, pick } from "../utils/query.js";
import { parseSpreadsheet } from "../utils/sheet.js";
import { audit } from "../services/audit.js";
import { getContext } from "../services/access.js";
import { enrollStudent } from "../services/enrollment.js";
import { toStored, removeFile } from "../services/storage.js";

export const STUDENT_POPULATE = [
  { path: "user", select: "name email phone avatar isActive lastLogin username" },
  { path: "department", select: "name code" },
  { path: "course", select: "name code totalSemesters" },
  { path: "semester", select: "name number academicYear" },
  { path: "section", select: "name room batch" },
];

const STUDENT_FIELDS = [
  "gender", "dateOfBirth", "address", "guardianName", "guardianPhone", "department",
  "course", "semester", "section", "batch", "admissionDate", "status",
];

const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === "" || v === "null" ? undefined : v;
  return out;
};

async function nextSequence(Model, field, prefix, pad) {
  const rx = new RegExp(`^${prefix}\\d{${pad}}$`);
  const last = await Model.findOne({ [field]: rx }).sort({ [field]: -1 }).select(field).lean();
  const n = last ? parseInt(last[field].slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(pad, "0")}`;
}

export async function generateStudentIds(courseId, admissionDate = new Date()) {
  const course = await Course.findById(courseId).lean();
  if (!course) throw ApiError.badRequest("Course not found");
  const year = new Date(admissionDate).getFullYear();
  const studentId = await nextSequence(Student, "studentId", `STU${year}`, 4);
  const rollNumber = await nextSequence(Student, "rollNumber", `${course.code}${String(year).slice(2)}`, 3);
  return { studentId, rollNumber };
}

async function validateAcademic({ department, course, semester, section }) {
  const [c, s, sec] = await Promise.all([
    course ? Course.findById(course).lean() : null,
    semester ? Semester.findById(semester).lean() : null,
    section ? Section.findById(section).lean() : null,
  ]);
  if (course && !c) throw ApiError.badRequest("Course not found");
  if (department && c && String(c.department) !== String(department)) throw ApiError.badRequest("Course does not belong to the selected department");
  if (semester && !s) throw ApiError.badRequest("Semester not found");
  if (s && c && String(s.course) !== String(c._id)) throw ApiError.badRequest("Semester does not belong to the selected course");
  if (section && !sec) throw ApiError.badRequest("Section not found");
  if (sec && s && String(sec.semester) !== String(s._id)) throw ApiError.badRequest("Section does not belong to the selected semester");
  if (sec) {
    const count = await Student.countDocuments({ section: sec._id, status: "active" });
    return { section: sec, count };
  }
  return {};
}

async function studentFilter(req) {
  const ctx = await getContext(req);
  const filter = {};
  if (ctx.role === "faculty") filter.section = { $in: ctx.sectionIds.map((id) => new mongoose.Types.ObjectId(id)) };
  if (ctx.role === "student") filter._id = ctx.student._id;
  for (const f of ["department", "course", "semester", "section", "status", "batch", "gender"]) {
    const v = req.query[f];
    if (!v) continue;
    if (f === "section" && ctx.role === "faculty" && !ctx.sectionIds.includes(String(v))) {
      throw ApiError.forbidden("You are not assigned to this section");
    }
    filter[f] = ["department", "course", "semester", "section"].includes(f) ? new mongoose.Types.ObjectId(String(v)) : v;
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    const userIds = await User.find({ role: "student", $or: [{ name: rx }, { email: rx }] }).distinct("_id");
    filter.$or = [{ user: { $in: userIds } }, { studentId: rx }, { rollNumber: rx }];
  }
  return filter;
}

export const listStudents = asyncHandler(async (req, res) => {
  const filter = await studentFilter(req);
  const sort = getSort(req.query, "rollNumber");
  if (req.query.all === "true") {
    const data = await Student.find(filter).sort(sort).limit(2000).populate(STUDENT_POPULATE);
    return ok(res, data, "Success", buildMeta(data.length, 1, data.length || 1));
  }
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    Student.countDocuments(filter),
    Student.find(filter).sort(sort).skip(skip).limit(limit).populate(STUDENT_POPULATE),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const getStudent = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid id");
  const ctx = await getContext(req);
  const filter = { _id: req.params.id };
  if (ctx.role === "faculty") filter.section = { $in: ctx.sectionIds };
  if (ctx.role === "student" && String(ctx.student._id) !== req.params.id) throw ApiError.notFound("Student not found");
  const student = await Student.findOne(filter).populate(STUDENT_POPULATE);
  if (!student) throw ApiError.notFound("Student not found");
  return ok(res, student);
});

export const getMyStudentProfile = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const student = await Student.findById(ctx.student._id).populate(STUDENT_POPULATE);
  return ok(res, student);
});

export const createStudent = asyncHandler(async (req, res) => {
  const body = clean(req.body);
  if (!body.name || !body.email) throw ApiError.badRequest("Name and email are required");
  const academic = pick(body, STUDENT_FIELDS);
  const { section, count } = await validateAcademic(academic);
  if (section && count >= section.capacity) throw ApiError.badRequest(`Section ${section.name} is full (capacity ${section.capacity})`);

  const ids = await generateStudentIds(academic.course, academic.admissionDate);
  const user = await User.create({
    name: body.name,
    email: body.email,
    phone: body.phone,
    username: ids.studentId.toLowerCase(),
    password: body.password || `${ids.studentId}@123`,
    role: "student",
    avatar: req.file ? toStored(req.file, "avatars").url : undefined,
  });

  try {
    const student = await Student.create({ ...academic, user: user._id, studentId: ids.studentId, rollNumber: body.rollNumber || ids.rollNumber });
    await enrollStudent(student);
    await audit(req, "create", "Student", student._id, { studentId: student.studentId });
    await student.populate(STUDENT_POPULATE);
    return created(res, student, `Student created. Login: ${user.email} / ${body.password ? "(password set)" : `${ids.studentId}@123`}`);
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }
});

export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound("Student not found");
  const body = clean(req.body);
  const academic = pick(body, STUDENT_FIELDS);
  const merged = {
    department: academic.department ?? student.department,
    course: academic.course ?? student.course,
    semester: academic.semester ?? student.semester,
    section: "section" in req.body ? academic.section : student.section,
  };
  const sectionChanged = String(merged.section || "") !== String(student.section || "");
  const { section, count } = await validateAcademic(merged);
  if (section && sectionChanged && count >= section.capacity) throw ApiError.badRequest(`Section ${section.name} is full`);

  for (const [k, v] of Object.entries(academic)) student.set(k, v);
  if ("section" in req.body && !academic.section) student.section = undefined;
  if (body.rollNumber) student.rollNumber = body.rollNumber;
  await student.save();

  const user = await User.findById(student.user);
  if (body.name) user.name = body.name;
  if (body.email) user.email = body.email;
  if (body.phone !== undefined) user.phone = body.phone;
  if (req.file) {
    await removeFile(user.avatar);
    user.avatar = toStored(req.file, "avatars").url;
  }
  if (academic.status) user.isActive = academic.status === "active" || academic.status === "graduated";
  await user.save();

  if (sectionChanged || academic.semester) await enrollStudent(student);
  await audit(req, "update", "Student", student._id);
  await student.populate(STUDENT_POPULATE);
  return ok(res, student, "Student updated");
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound("Student not found");

  if (req.query.permanent === "true") {
    await Promise.all([
      Attendance.updateMany({}, { $pull: { records: { student: student._id } } }),
      AssignmentSubmission.deleteMany({ student: student._id }),
      ExaminationResult.deleteMany({ student: student._id }),
      Enrollment.deleteMany({ student: student._id }),
    ]);
    const hasFinance = await FeePayment.exists({ student: student._id }) || await BookIssue.exists({ student: student._id, status: "issued" });
    if (hasFinance) throw ApiError.conflict("Student has fee payments or issued books. Deactivate instead of deleting.");
    await User.deleteOne({ _id: student.user });
    await student.deleteOne();
    await audit(req, "delete", "Student", student._id, { studentId: student.studentId });
    return ok(res, { _id: student._id }, "Student permanently deleted");
  }
  student.status = "inactive";
  await student.save();
  await User.updateOne({ _id: student.user }, { isActive: false });
  await audit(req, "deactivate", "Student", student._id);
  return ok(res, student, "Student deactivated");
});

export const setStudentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "inactive", "graduated", "suspended"].includes(status)) throw ApiError.badRequest("Invalid status");
  const student = await Student.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!student) throw ApiError.notFound("Student not found");
  await User.updateOne({ _id: student.user }, { isActive: status === "active" || status === "graduated" });
  await audit(req, "status", "Student", student._id, { status });
  return ok(res, student, `Status changed to ${status}`);
});

/** Promote students to the next semester of their course. */
export const promoteStudents = asyncHandler(async (req, res) => {
  const { studentIds = [], targetSection } = req.body;
  if (!Array.isArray(studentIds) || !studentIds.length) throw ApiError.badRequest("Select at least one student");
  const students = await Student.find({ _id: { $in: studentIds }, status: "active" }).populate("semester course");
  const results = { promoted: 0, graduated: 0, skipped: [] };

  for (const s of students) {
    const currentNo = s.semester?.number || 0;
    if (currentNo >= (s.course?.totalSemesters || 0)) {
      s.status = "graduated";
      s.section = undefined;
      await s.save();
      results.graduated++;
      continue;
    }
    const next = await Semester.findOne({ course: s.course._id, number: currentNo + 1 }).sort({ academicYear: -1 });
    if (!next) {
      results.skipped.push({ studentId: s.studentId, reason: `Semester ${currentNo + 1} not created for ${s.course.code}` });
      continue;
    }
    let section;
    if (targetSection) section = await Section.findOne({ _id: targetSection, semester: next._id });
    if (!section) section = await Section.findOne({ semester: next._id, name: (await Section.findById(s.section))?.name });
    s.semester = next._id;
    s.section = section?._id;
    await s.save();
    await enrollStudent(s);
    results.promoted++;
  }
  await audit(req, "promote", "Student", undefined, { count: results.promoted });
  return ok(res, results, `${results.promoted} promoted, ${results.graduated} graduated, ${results.skipped.length} skipped`);
});

export const uploadDocuments = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound("Student not found");
  if (!req.files?.length) throw ApiError.badRequest("No files uploaded");
  student.documents.push(...req.files.map((f) => toStored(f, "documents")));
  await student.save();
  return ok(res, student.documents, "Documents uploaded");
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound("Student not found");
  const doc = student.documents[Number(req.params.index)];
  if (!doc) throw ApiError.notFound("Document not found");
  await removeFile(doc.url);
  student.documents.splice(Number(req.params.index), 1);
  await student.save();
  return ok(res, student.documents, "Document removed");
});

/**
 * Import students from CSV or Excel (.xlsx). Columns (header row):
 * name,email,phone,gender,dateOfBirth,departmentCode,courseCode,semesterNumber,sectionName,batch,guardianName,guardianPhone,address
 */
export const importStudents = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Upload a CSV or Excel (.xlsx) file");
  let rows;
  try {
    rows = await parseSpreadsheet(req.file);
  } catch {
    throw ApiError.badRequest("Could not read the file. Save it as .xlsx or .csv and try again.");
  }
  if (!rows.length) throw ApiError.badRequest("The file has no data rows");
  if (rows.length > 1000) throw ApiError.badRequest("Maximum 1000 rows per import");

  const [departments, courses] = await Promise.all([Department.find().lean(), Course.find().lean()]);
  const result = { created: 0, errors: [] };

  for (const [i, row] of rows.entries()) {
    const line = i + 2;
    try {
      const course = courses.find((c) => c.code === String(row.courseCode).toUpperCase());
      if (!course) throw new Error(`Unknown courseCode "${row.courseCode}"`);
      const department = departments.find((d) => d.code === String(row.departmentCode || "").toUpperCase()) || departments.find((d) => String(d._id) === String(course.department));
      const semester = await Semester.findOne({ course: course._id, number: Number(row.semesterNumber) || 1 }).sort({ academicYear: -1 });
      if (!semester) throw new Error(`Semester ${row.semesterNumber} not found for ${course.code}`);
      const section = row.sectionName ? await Section.findOne({ semester: semester._id, name: String(row.sectionName).toUpperCase() }) : null;
      if (!row.name || !row.email) throw new Error("name and email are required");
      if (await User.exists({ email: String(row.email).toLowerCase() })) throw new Error(`Email ${row.email} already exists`);

      const ids = await generateStudentIds(course._id);
      const user = await User.create({ name: row.name, email: row.email, phone: row.phone, role: "student", username: ids.studentId.toLowerCase(), password: `${ids.studentId}@123` });
      try {
        const student = await Student.create({
          user: user._id, ...ids, department: department?._id, course: course._id, semester: semester._id, section: section?._id,
          gender: row.gender?.toLowerCase() || undefined, dateOfBirth: row.dateOfBirth || undefined, batch: row.batch,
          guardianName: row.guardianName, guardianPhone: row.guardianPhone, address: row.address,
        });
        await enrollStudent(student);
      } catch (e) {
        await User.deleteOne({ _id: user._id });
        throw e;
      }
      result.created++;
    } catch (err) {
      result.errors.push({ line, message: err.message });
    }
  }
  await audit(req, "import", "Student", undefined, { created: result.created, failed: result.errors.length });
  return ok(res, result, `${result.created} students imported, ${result.errors.length} failed`);
});
