import { Enrollment, Subject, Student } from "../models/index.js";

/** Enroll a student in every active subject of their current semester. */
export async function enrollStudent(student) {
  if (!student.section || !student.semester) return 0;
  const subjects = await Subject.find({ semester: student.semester, course: student.course, isActive: true }).distinct("_id");
  if (!subjects.length) return 0;
  const ops = subjects.map((subject) => ({
    updateOne: {
      filter: { student: student._id, subject, semester: student.semester },
      update: { $set: { section: student.section, status: "enrolled" } },
      upsert: true,
    },
  }));
  await Enrollment.bulkWrite(ops);
  return subjects.length;
}

export async function enrollSection(sectionId) {
  const students = await Student.find({ section: sectionId, status: "active" });
  let total = 0;
  for (const s of students) total += await enrollStudent(s);
  return { students: students.length, enrollments: total };
}
