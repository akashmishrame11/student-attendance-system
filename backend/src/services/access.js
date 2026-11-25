import { Faculty, Student, Section, Subject, Timetable } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Access-control context for the current user.
 *  - faculty: the sections and subjects they are assigned to (explicit
 *    assignment, class-teacher role, primary subject faculty, or timetable).
 *  - student: their own student record.
 * Cached on the request so it is computed at most once per request.
 */
export async function getContext(req) {
  if (req._ctx) return req._ctx;
  const { user } = req;
  const ctx = { role: user.role };

  if (user.role === "faculty") {
    const faculty = await Faculty.findOne({ user: user._id }).lean();
    if (!faculty) throw ApiError.forbidden("Faculty profile not found for this account");
    const [ctSections, primarySubjects, ttSections, ttSubjects] = await Promise.all([
      Section.find({ classTeacher: faculty._id }).distinct("_id"),
      Subject.find({ faculty: faculty._id }).distinct("_id"),
      Timetable.find({ faculty: faculty._id }).distinct("section"),
      Timetable.find({ faculty: faculty._id }).distinct("subject"),
    ]);
    const uniq = (arr) => [...new Set(arr.map(String))];
    ctx.faculty = faculty;
    ctx.sectionIds = uniq([...(faculty.sections || []), ...ctSections, ...ttSections]);
    ctx.subjectIds = uniq([...(faculty.subjects || []), ...primarySubjects, ...ttSubjects]);
  } else if (user.role === "student") {
    const student = await Student.findOne({ user: user._id }).lean();
    if (!student) throw ApiError.forbidden("Student profile not found for this account");
    ctx.student = student;
  }
  req._ctx = ctx;
  return ctx;
}

export function facultyHasSection(ctx, sectionId) {
  return ctx.sectionIds?.includes(String(sectionId));
}

export function facultyHasSubject(ctx, subjectId) {
  return ctx.subjectIds?.includes(String(subjectId));
}

/** Throws 403 unless the user may work with this section (and subject). */
export async function assertClassAccess(req, sectionId, subjectId) {
  const ctx = await getContext(req);
  if (ctx.role === "admin") return ctx;
  if (ctx.role === "faculty") {
    if (!facultyHasSection(ctx, sectionId)) throw ApiError.forbidden("You are not assigned to this class/section");
    if (subjectId && !facultyHasSubject(ctx, subjectId)) throw ApiError.forbidden("You are not assigned to this subject");
    return ctx;
  }
  throw ApiError.forbidden();
}
