import { User, Faculty, Timetable, Section, Subject, Student, Department, Assignment } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ok, created } from "../utils/response.js";
import { buildMeta, escapeRegex, getPagination, getSort, pick } from "../utils/query.js";
import { audit } from "../services/audit.js";
import { getContext } from "../services/access.js";
import { toStored, removeFile } from "../services/storage.js";

export const FACULTY_POPULATE = [
  { path: "user", select: "name email phone avatar isActive lastLogin username" },
  { path: "department", select: "name code" },
  { path: "subjects", select: "name code type credits" },
  { path: "courses", select: "name code" },
  {
    path: "sections",
    select: "name course semester",
    populate: [{ path: "course", select: "code name" }, { path: "semester", select: "number name" }],
  },
];

const FIELDS = ["department", "designation", "qualification", "specialization", "subjects", "sections", "courses", "joiningDate", "status"];

const parseList = (v) => {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* comma separated */ }
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

function normalize(body) {
  const out = {};
  for (const [k, v] of Object.entries(body)) out[k] = v === "" ? undefined : v;
  for (const k of ["subjects", "sections", "courses"]) if (k in body) out[k] = parseList(body[k]);
  return out;
}

async function nextEmployeeId() {
  const last = await Faculty.findOne({ employeeId: /^FAC\d{4}$/ }).sort({ employeeId: -1 }).lean();
  const n = last ? parseInt(last.employeeId.slice(3), 10) + 1 : 1;
  return `FAC${String(n).padStart(4, "0")}`;
}

export const listFaculty = asyncHandler(async (req, res) => {
  const filter = {};
  for (const f of ["department", "designation", "status"]) if (req.query[f]) filter[f] = req.query[f];
  if (req.query.subject) filter.subjects = req.query.subject;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), "i");
    const userIds = await User.find({ role: "faculty", $or: [{ name: rx }, { email: rx }] }).distinct("_id");
    filter.$or = [{ user: { $in: userIds } }, { employeeId: rx }, { designation: rx }];
  }
  const sort = getSort(req.query, "employeeId");
  if (req.query.all === "true") {
    const data = await Faculty.find(filter).sort(sort).populate(FACULTY_POPULATE);
    return ok(res, data, "Success", buildMeta(data.length, 1, data.length || 1));
  }
  const { page, limit, skip } = getPagination(req.query);
  const [total, data] = await Promise.all([
    Faculty.countDocuments(filter),
    Faculty.find(filter).sort(sort).skip(skip).limit(limit).populate(FACULTY_POPULATE),
  ]);
  return ok(res, data, "Success", buildMeta(total, page, limit));
});

export const getFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id).populate(FACULTY_POPULATE);
  if (!faculty) throw ApiError.notFound("Faculty not found");
  return ok(res, faculty);
});

export const getMyFacultyProfile = asyncHandler(async (req, res) => {
  const ctx = await getContext(req);
  const faculty = await Faculty.findById(ctx.faculty._id).populate(FACULTY_POPULATE);
  return ok(res, { ...faculty.toObject(), accessibleSections: ctx.sectionIds, accessibleSubjects: ctx.subjectIds });
});

export const createFaculty = asyncHandler(async (req, res) => {
  const body = normalize(req.body);
  if (!body.name || !body.email) throw ApiError.badRequest("Name and email are required");
  if (!(await Department.exists({ _id: body.department }))) throw ApiError.badRequest("Department not found");
  const employeeId = body.employeeId?.toUpperCase() || (await nextEmployeeId());

  const user = await User.create({
    name: body.name,
    email: body.email,
    phone: body.phone,
    username: employeeId.toLowerCase(),
    password: body.password || `${employeeId}@123`,
    role: "faculty",
    avatar: req.file ? toStored(req.file, "avatars").url : undefined,
  });
  try {
    const faculty = await Faculty.create({ ...pick(body, FIELDS), employeeId, user: user._id });
    await audit(req, "create", "Faculty", faculty._id, { employeeId });
    await faculty.populate(FACULTY_POPULATE);
    return created(res, faculty, `Faculty created. Login: ${user.email} / ${body.password ? "(password set)" : `${employeeId}@123`}`);
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }
});

export const updateFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw ApiError.notFound("Faculty not found");
  const body = normalize(req.body);
  for (const [k, v] of Object.entries(pick(body, FIELDS))) faculty.set(k, v);
  await faculty.save();

  const user = await User.findById(faculty.user);
  if (body.name) user.name = body.name;
  if (body.email) user.email = body.email;
  if (body.phone !== undefined) user.phone = body.phone;
  if (req.file) {
    await removeFile(user.avatar);
    user.avatar = toStored(req.file, "avatars").url;
  }
  if (body.status) user.isActive = body.status !== "inactive";
  await user.save();

  await audit(req, "update", "Faculty", faculty._id);
  await faculty.populate(FACULTY_POPULATE);
  return ok(res, faculty, "Faculty updated");
});

export const deleteFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw ApiError.notFound("Faculty not found");
  if (req.query.permanent === "true") {
    const refs = await Promise.all([
      Timetable.countDocuments({ faculty: faculty._id }),
      Assignment.countDocuments({ faculty: faculty._id }),
    ]);
    if (refs.some(Boolean)) throw ApiError.conflict("Faculty has timetable entries or assignments. Deactivate instead.");
    await Promise.all([
      Section.updateMany({ classTeacher: faculty._id }, { $unset: { classTeacher: 1 } }),
      Subject.updateMany({ faculty: faculty._id }, { $unset: { faculty: 1 } }),
      Department.updateMany({ head: faculty._id }, { $unset: { head: 1 } }),
    ]);
    await User.deleteOne({ _id: faculty.user });
    await faculty.deleteOne();
    await audit(req, "delete", "Faculty", faculty._id);
    return ok(res, { _id: faculty._id }, "Faculty permanently deleted");
  }
  faculty.status = "inactive";
  await faculty.save();
  await User.updateOne({ _id: faculty.user }, { isActive: false });
  await audit(req, "deactivate", "Faculty", faculty._id);
  return ok(res, faculty, "Faculty deactivated");
});

/** Weekly timetable and workload summary for a faculty member. */
export const facultyWorkload = asyncHandler(async (req, res) => {
  let facultyId = req.params.id;
  if (req.user.role === "faculty") facultyId = (await getContext(req)).faculty._id;
  const faculty = await Faculty.findById(facultyId).populate("user", "name");
  if (!faculty) throw ApiError.notFound("Faculty not found");

  const slots = await Timetable.find({ faculty: faculty._id })
    .populate("subject", "name code type")
    .populate({ path: "section", select: "name course semester", populate: [{ path: "course", select: "code" }, { path: "semester", select: "number" }] })
    .sort({ day: 1, startTime: 1 });

  const minutes = slots.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return sum + (eh * 60 + em - (sh * 60 + sm));
  }, 0);
  const sectionIds = [...new Set(slots.map((s) => String(s.section?._id)).concat((faculty.sections || []).map(String)))];
  const students = await Student.countDocuments({ section: { $in: sectionIds }, status: "active" });

  return ok(res, {
    faculty: { _id: faculty._id, name: faculty.user?.name, employeeId: faculty.employeeId },
    timetable: slots,
    weeklyHours: Math.round((minutes / 60) * 10) / 10,
    classesPerWeek: slots.length,
    subjects: new Set(slots.map((s) => String(s.subject?._id))).size,
    sections: sectionIds.length,
    students,
  });
});
