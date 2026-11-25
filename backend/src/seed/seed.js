/**
 * Seed the database with realistic demo data.
 *   npm run seed           -> wipes the database and seeds
 * Demo credentials are printed at the end (and documented in README.md).
 */
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import {
  User, Student, Faculty, Department, Course, Semester, Section, Subject, Enrollment, Timetable,
  Attendance, Assignment, AssignmentSubmission, Examination, ExaminationResult, Fee, FeePayment,
  Notice, Notification, LeaveRequest, Book, BookIssue, Complaint, Feedback, AuditLog, Setting,
} from "../models/index.js";
import { DEFAULT_GRADING, calcGrade } from "../utils/grade.js";
import { dayStart, DAYS } from "../utils/query.js";

// Deterministic PRNG so every seed produces the same data.
let seed = 20261119;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pickOne = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => Math.floor(a + rand() * (b - a + 1));

const TODAY = dayStart(new Date());
const daysAgo = (n) => new Date(TODAY.getTime() - n * 86400000);
const daysAhead = (n) => new Date(TODAY.getTime() + n * 86400000);
const YEAR = "2026-2027";
// 23:59 India time on the given (UTC-midnight) date.
const endOfDayIST = (d) => new Date(d.getTime() + (18 * 60 + 29) * 60000);

const FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Saanvi", "Aadhya", "Pari", "Myra", "Anika", "Navya", "Kiara", "Riya", "Rohan", "Kabir", "Dev", "Neha", "Priya", "Sneha", "Pooja", "Rahul", "Karan", "Meera"];
const LAST = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Reddy", "Nair", "Iyer", "Mehta", "Joshi", "Kapoor", "Malhotra", "Chopra", "Bose", "Das", "Kulkarni", "Rao", "Mishra", "Pandey", "Yadav"];

async function wipe() {
  const models = [User, Student, Faculty, Department, Course, Semester, Section, Subject, Enrollment, Timetable, Attendance, Assignment, AssignmentSubmission, Examination, ExaminationResult, Fee, FeePayment, Notice, Notification, LeaveRequest, Book, BookIssue, Complaint, Feedback, AuditLog, Setting];
  for (const m of models) await m.deleteMany({});
  for (const m of models) await m.syncIndexes();
}

async function main() {
  await connectDB();
  console.log("Clearing existing data...");
  await wipe();

  await Setting.create({
    key: "global", collegeName: "Attendify Institute of Technology", academicYear: YEAR,
    address: "Knowledge Park, Sector 12, New Delhi", contactEmail: "office@college.edu", contactPhone: "+91 11 4000 1234",
    grading: DEFAULT_GRADING,
    timeSlots: [
      { label: "Period 1", startTime: "09:00", endTime: "10:00" },
      { label: "Period 2", startTime: "10:00", endTime: "11:00" },
      { label: "Period 3", startTime: "11:15", endTime: "12:15" },
      { label: "Period 4", startTime: "12:15", endTime: "13:15" },
    ],
  });

  /* ---------------------------------------------------------- users */
  console.log("Creating users...");
  const admin = await User.create({ name: "System Administrator", email: "admin@college.edu", username: "admin", password: "Admin@123", role: "admin", phone: "9800000001" });

  /* --------------------------------------------- departments/courses */
  const [cse, ece, mgt] = await Department.insertMany([
    { name: "Computer Science & Engineering", code: "CSE", description: "Software, systems and computing.", establishedYear: 2005 },
    { name: "Electronics & Communication", code: "ECE", description: "Circuits, signals and communication systems.", establishedYear: 2007 },
    { name: "Management Studies", code: "MGT", description: "Business administration and management.", establishedYear: 2010 },
  ]);
  const [bcs, bec, bba] = await Course.insertMany([
    { name: "B.Tech Computer Science", code: "BCS", department: cse._id, durationYears: 4, totalSemesters: 8, description: "Four-year undergraduate engineering program in computer science." },
    { name: "B.Tech Electronics & Communication", code: "BEC", department: ece._id, durationYears: 4, totalSemesters: 8, description: "Four-year undergraduate program in electronics." },
    { name: "Bachelor of Business Administration", code: "BBA", department: mgt._id, durationYears: 3, totalSemesters: 6, description: "Three-year undergraduate management program." },
  ]);

  const semesters = {};
  for (const course of [bcs, bec, bba]) {
    const docs = await Semester.insertMany(
      Array.from({ length: course.totalSemesters }, (_, i) => ({
        course: course._id, number: i + 1, name: `Semester ${i + 1}`, academicYear: YEAR,
        startDate: i % 2 === 0 ? new Date("2026-07-15") : new Date("2027-01-10"),
        endDate: i % 2 === 0 ? new Date("2026-12-15") : new Date("2027-05-30"),
        isActive: i % 2 === 0,
      }))
    );
    semesters[course.code] = docs;
  }
  const bcs3 = semesters.BCS[2];
  const bec3 = semesters.BEC[2];
  const bba1 = semesters.BBA[0];

  /* ---------------------------------------------------------- faculty */
  const facultySpec = [
    { name: "Dr. Rajesh Kumar", email: "faculty1@college.edu", dept: cse, designation: "Professor", qualification: "Ph.D. Computer Science", specialization: "Algorithms" },
    { name: "Prof. Sunita Rao", email: "faculty2@college.edu", dept: cse, designation: "Associate Professor", qualification: "M.Tech CSE", specialization: "Databases" },
    { name: "Dr. Anil Menon", email: "faculty3@college.edu", dept: ece, designation: "Professor", qualification: "Ph.D. Electronics", specialization: "Signal Processing" },
    { name: "Prof. Kavita Desai", email: "faculty4@college.edu", dept: ece, designation: "Assistant Professor", qualification: "M.E. VLSI", specialization: "Digital Design" },
    { name: "Dr. Vikram Sethi", email: "faculty5@college.edu", dept: mgt, designation: "Associate Professor", qualification: "Ph.D. Management", specialization: "Finance" },
  ];
  const faculty = [];
  for (const [i, f] of facultySpec.entries()) {
    const employeeId = `FAC${String(i + 1).padStart(4, "0")}`;
    const user = await User.create({ name: f.name, email: f.email, username: employeeId.toLowerCase(), password: "Faculty@123", role: "faculty", phone: `98100000${10 + i}` });
    faculty.push(await Faculty.create({
      user: user._id, employeeId, department: f.dept._id, designation: f.designation, qualification: f.qualification,
      specialization: f.specialization, joiningDate: new Date(2015 + i, 6, 1), courses: [],
    }));
  }
  const [F1, F2, F3, F4, F5] = faculty;
  await Department.updateOne({ _id: cse._id }, { head: F1._id });
  await Department.updateOne({ _id: ece._id }, { head: F3._id });
  await Department.updateOne({ _id: mgt._id }, { head: F5._id });

  /* --------------------------------------------------------- sections */
  const [bcsA, bcsB, becA, bbaA] = await Section.insertMany([
    { name: "A", course: bcs._id, semester: bcs3._id, batch: "2025-2029", classTeacher: F1._id, room: "CS-101", capacity: 60 },
    { name: "B", course: bcs._id, semester: bcs3._id, batch: "2025-2029", classTeacher: F2._id, room: "CS-102", capacity: 60 },
    { name: "A", course: bec._id, semester: bec3._id, batch: "2025-2029", classTeacher: F3._id, room: "EC-201", capacity: 60 },
    { name: "A", course: bba._id, semester: bba1._id, batch: "2026-2029", classTeacher: F5._id, room: "MB-301", capacity: 60 },
  ]);
  // Next-semester sections so promotion has somewhere to go.
  await Section.insertMany([
    { name: "A", course: bcs._id, semester: semesters.BCS[3]._id, batch: "2025-2029", room: "CS-103" },
    { name: "B", course: bcs._id, semester: semesters.BCS[3]._id, batch: "2025-2029", room: "CS-104" },
    { name: "A", course: bec._id, semester: semesters.BEC[3]._id, batch: "2025-2029", room: "EC-202" },
    { name: "A", course: bba._id, semester: semesters.BBA[1]._id, batch: "2026-2029", room: "MB-302" },
  ]);

  /* --------------------------------------------------------- subjects */
  const subj = (code, name, dept, course, sem, fac, type = "theory", credits = 4) => ({ code, name, department: dept._id, course: course._id, semester: sem._id, faculty: fac._id, type, credits });
  const subjects = await Subject.insertMany([
    subj("CS301", "Data Structures", cse, bcs, bcs3, F1),
    subj("CS302", "Database Management Systems", cse, bcs, bcs3, F2),
    subj("CS303", "Operating Systems", cse, bcs, bcs3, F1),
    subj("CS304", "Data Structures Lab", cse, bcs, bcs3, F2, "practical", 2),
    subj("EC301", "Signals & Systems", ece, bec, bec3, F3),
    subj("EC302", "Digital Electronics", ece, bec, bec3, F4),
    subj("EC303", "Network Theory", ece, bec, bec3, F3),
    subj("EC304", "Electronics Lab", ece, bec, bec3, F4, "practical", 2),
    subj("BA101", "Principles of Management", mgt, bba, bba1, F5),
    subj("BA102", "Business Economics", mgt, bba, bba1, F5),
    subj("BA103", "Financial Accounting", mgt, bba, bba1, F5),
    subj("BA104", "Business Communication", mgt, bba, bba1, F5, "theory", 3),
  ]);
  const S = Object.fromEntries(subjects.map((s) => [s.code, s]));
  const sectionSubjects = new Map([
    [String(bcsA._id), ["CS301", "CS302", "CS303", "CS304"]],
    [String(bcsB._id), ["CS301", "CS302", "CS303", "CS304"]],
    [String(becA._id), ["EC301", "EC302", "EC303", "EC304"]],
    [String(bbaA._id), ["BA101", "BA102", "BA103", "BA104"]],
  ]);

  const assignFaculty = async (f, codes, secs, courses) =>
    Faculty.updateOne({ _id: f._id }, { subjects: codes.map((c) => S[c]._id), sections: secs.map((s) => s._id), courses: courses.map((c) => c._id) });
  await assignFaculty(F1, ["CS301", "CS303"], [bcsA, bcsB], [bcs]);
  await assignFaculty(F2, ["CS302", "CS304"], [bcsA, bcsB], [bcs]);
  await assignFaculty(F3, ["EC301", "EC303"], [becA], [bec]);
  await assignFaculty(F4, ["EC302", "EC304"], [becA], [bec]);
  await assignFaculty(F5, ["BA101", "BA102", "BA103", "BA104"], [bbaA], [bba]);

  /* --------------------------------------------------------- students */
  console.log("Creating 50 students...");
  const plan = [[bcsA, bcs, cse, bcs3, 15], [bcsB, bcs, cse, bcs3, 13], [becA, bec, ece, bec3, 12], [bbaA, bba, mgt, bba1, 10]];
  const students = [];
  let n = 0;
  for (const [section, course, dept, sem, count] of plan) {
    const admitYear = course.code === "BBA" ? 2026 : 2025;
    for (let i = 0; i < count; i++) {
      n++;
      const first = FIRST[(n * 7) % FIRST.length];
      const last = LAST[(n * 3) % LAST.length];
      const studentId = `STU${admitYear}${String(n).padStart(4, "0")}`;
      const user = await User.create({
        name: `${first} ${last}`, email: `student${n}@college.edu`, username: studentId.toLowerCase(),
        password: "Student@123", role: "student", phone: `9900${String(100000 + n)}`,
      });
      const st = await Student.create({
        user: user._id, studentId, rollNumber: `${course.code}${String(admitYear).slice(2)}${String(students.filter((s) => String(s.course) === String(course._id)).length + 1).padStart(3, "0")}`,
        gender: ["Ananya", "Diya", "Saanvi", "Aadhya", "Pari", "Myra", "Anika", "Navya", "Kiara", "Riya", "Neha", "Priya", "Sneha", "Pooja", "Meera"].includes(first) ? "female" : "male",
        dateOfBirth: new Date(admitYear - 18, between(0, 11), between(1, 28)),
        address: `${between(10, 499)}, ${pickOne(["MG Road", "Park Street", "Lake View", "Civil Lines", "Model Town"])}, ${pickOne(["Delhi", "Noida", "Gurugram", "Faridabad"])}`,
        guardianName: `${pickOne(["Mr.", "Mrs."])} ${pickOne(FIRST)} ${last}`, guardianPhone: `9811${String(200000 + n)}`,
        department: dept._id, course: course._id, semester: sem._id, section: section._id,
        batch: section.batch, admissionDate: new Date(admitYear, 6, 15),
      });
      st._attendanceRate = n % 9 === 0 ? 0.6 : n % 5 === 0 ? 0.72 : 0.82 + rand() * 0.16;
      students.push(st);
    }
  }
  const bySection = (sec) => students.filter((s) => String(s.section) === String(sec._id));

  // Enrollments
  const enrollmentDocs = [];
  for (const st of students) {
    for (const code of sectionSubjects.get(String(st.section))) {
      enrollmentDocs.push({ student: st._id, subject: S[code]._id, section: st.section, semester: st.semester });
    }
  }
  await Enrollment.insertMany(enrollmentDocs);

  /* -------------------------------------------------------- timetable */
  console.log("Building timetable...");
  const periods = [["09:00", "10:00"], ["10:00", "11:00"], ["11:15", "12:15"], ["12:15", "13:15"]];
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const tt = [];
  const sectionOffset = new Map([[String(bcsA._id), 0], [String(bcsB._id), 1], [String(becA._id), 0], [String(bbaA._id), 0]]);
  for (const section of [bcsA, bcsB, becA, bbaA]) {
    const codes = sectionSubjects.get(String(section._id));
    weekdays.forEach((day, d) => {
      periods.forEach(([startTime, endTime], p) => {
        const subject = S[codes[(p + d + sectionOffset.get(String(section._id))) % 4]];
        tt.push({ section: section._id, subject: subject._id, faculty: subject.faculty, room: subject.type === "practical" ? `${section.room.split("-")[0]}-LAB` : section.room, day, startTime, endTime });
      });
    });
  }
  await Timetable.insertMany(tt);

  /* ------------------------------------------------------- attendance */
  console.log("Generating attendance history...");
  const facultyUser = Object.fromEntries(faculty.map((f) => [String(f._id), f.user]));
  const attendanceDocs = [];
  for (let back = 30; back >= 1; back--) {
    const date = daysAgo(back);
    const dayName = DAYS[date.getUTCDay()];
    if (!weekdays.includes(dayName)) continue;
    for (const slot of tt.filter((t) => t.day === dayName)) {
      const records = students
        .filter((s) => String(s.section) === String(slot.section))
        .map((s) => {
          const r = rand();
          let status = r < s._attendanceRate ? (rand() < 0.06 ? "late" : "present") : rand() < 0.15 ? "leave" : "absent";
          return { student: s._id, status };
        });
      attendanceDocs.push({ section: slot.section, subject: slot.subject, date, markedBy: facultyUser[String(slot.faculty)], records });
    }
  }
  await Attendance.insertMany(attendanceDocs);

  /* ------------------------------------------------------ assignments */
  console.log("Creating assignments and submissions...");
  const assignmentSpecs = [
    { code: "CS301", title: "Implement a Linked List", description: "Implement a singly linked list with insert, delete and reverse operations.", past: true },
    { code: "CS302", title: "ER Diagram for Library System", description: "Design an ER diagram and convert it into relational tables.", past: false },
    { code: "CS303", title: "CPU Scheduling Simulation", description: "Simulate FCFS, SJF and Round Robin scheduling and compare waiting times.", past: true },
    { code: "EC301", title: "Fourier Series Problems", description: "Solve the attached set of Fourier series problems.", past: true },
    { code: "EC302", title: "Design a 4-bit Adder", description: "Design and simulate a 4-bit ripple carry adder.", past: false },
    { code: "BA101", title: "Case Study: Leadership Styles", description: "Analyse the leadership styles in the provided case study (800 words).", past: true },
    { code: "BA103", title: "Prepare a Trial Balance", description: "Prepare a trial balance from the given journal entries.", past: false },
  ];
  for (const section of [bcsA, bcsB, becA, bbaA]) {
    const codes = sectionSubjects.get(String(section._id));
    for (const spec of assignmentSpecs.filter((a) => codes.includes(a.code))) {
      const subject = S[spec.code];
      const a = await Assignment.create({
        title: spec.title, description: spec.description,
        instructions: "Submit a PDF or DOCX. Mention your roll number on the first page. Plagiarism will be penalised.",
        subject: subject._id, section: section._id, course: section.course, semester: section.semester, faculty: subject.faculty,
        maxMarks: 20, dueDate: endOfDayIST(spec.past ? daysAgo(between(3, 10)) : daysAhead(between(4, 12))), allowResubmission: !spec.past,
        createdAt: daysAgo(15),
      });
      const subs = [];
      for (const st of bySection(section)) {
        const chance = spec.past ? 0.85 : 0.35;
        if (rand() > chance) continue;
        const late = spec.past && rand() < 0.15;
        const evaluated = spec.past && rand() < 0.7;
        subs.push({
          assignment: a._id, student: st._id,
          textAnswer: "Please find my solution attached. I have explained each step in detail.",
          submittedAt: late ? new Date(a.dueDate.getTime() + 86400000) : new Date(a.dueDate.getTime() - between(1, 3) * 86400000),
          status: evaluated ? "evaluated" : late ? "late" : "submitted",
          ...(evaluated ? { marks: between(9, 20), feedback: pickOne(["Good work.", "Well structured answer.", "Needs more explanation.", "Excellent!", "Check edge cases."]), evaluatedBy: facultyUser[String(subject.faculty)], evaluatedAt: daysAgo(1) } : {}),
        });
      }
      await AssignmentSubmission.insertMany(subs);
    }
  }

  /* ------------------------------------------------- exams & results */
  console.log("Creating examinations and results...");
  for (const [course, sem, sections] of [[bcs, bcs3, [bcsA, bcsB]], [bec, bec3, [becA]], [bba, bba1, [bbaA]]]) {
    const codes = sectionSubjects.get(String(sections[0]._id));
    const theory = codes.filter((c) => S[c].type === "theory");
    const internal = await Examination.create({
      name: "Internal Assessment I", type: "internal", course: course._id, semester: sem._id, sections: [], academicYear: YEAR,
      startDate: daysAgo(20), endDate: daysAgo(17),
      schedule: theory.map((c, i) => ({ subject: S[c]._id, date: daysAgo(20 - i), startTime: "10:00", endTime: "11:30", room: sections[0].room, maxMarks: 30, passMarks: 12 })),
      createdBy: admin._id, resultsPublished: true, publishedAt: daysAgo(10),
    });
    await Examination.create({
      name: "Mid-Term Examination", type: "midterm", course: course._id, semester: sem._id, sections: [], academicYear: YEAR,
      startDate: daysAhead(8), endDate: daysAhead(8 + theory.length - 1),
      schedule: theory.map((c, i) => ({ subject: S[c]._id, date: daysAhead(8 + i), startTime: "10:00", endTime: "13:00", room: "Exam Hall 1", maxMarks: 100, passMarks: 40 })),
      createdBy: admin._id,
    });
    const results = [];
    for (const st of students.filter((s) => String(s.semester) === String(sem._id))) {
      const marks = internal.schedule.map((it) => {
        const m = Math.min(30, Math.max(6, Math.round(st._attendanceRate * 30 - 4 + rand() * 8)));
        return { subject: it.subject, marksObtained: m, maxMarks: 30, passMarks: 12, grade: calcGrade((m / 30) * 100), isAbsent: false };
      });
      const total = marks.reduce((s, m) => s + m.marksObtained, 0);
      const maxTotal = marks.length * 30;
      const percentage = Math.round((total / maxTotal) * 1000) / 10;
      results.push({ exam: internal._id, student: st._id, marks, total, maxTotal, percentage, grade: calcGrade(percentage), status: marks.some((m) => m.marksObtained < 12) ? "fail" : "pass", enteredBy: admin._id });
    }
    await ExaminationResult.insertMany(results);
  }

  /* -------------------------------------------------------------- fees */
  console.log("Creating fee structures and payments...");
  const feeDefs = [
    [bcs, bcs3, 65000, daysAgo(12)], [bec, bec3, 62000, daysAhead(15)], [bba, bba1, 45000, daysAhead(20)],
  ];
  for (const [course, sem, tuition, due] of feeDefs) {
    const fee = await Fee.create({
      name: `Semester ${sem.number} Fee ${YEAR}`, course: course._id, semester: sem._id, academicYear: YEAR,
      components: [{ name: "Tuition Fee", amount: tuition }, { name: "Laboratory Fee", amount: 5000 }, { name: "Library Fee", amount: 2000 }, { name: "Examination Fee", amount: 3000 }],
      dueDate: due, finePerDay: 50,
    });
    for (const st of students.filter((s) => String(s.semester) === String(sem._id))) {
      const r = rand();
      if (r < 0.6) {
        await FeePayment.create({ student: st._id, fee: fee._id, amount: fee.totalAmount, method: pickOne(["upi", "card", "bank_transfer", "cash"]), transactionId: `TXN${between(100000, 999999)}`, paidAt: daysAgo(between(15, 40)), receivedBy: admin._id });
      } else if (r < 0.8) {
        await FeePayment.create({ student: st._id, fee: fee._id, amount: Math.round(fee.totalAmount / 2), method: "upi", transactionId: `TXN${between(100000, 999999)}`, paidAt: daysAgo(between(15, 40)), receivedBy: admin._id });
      }
    }
  }

  /* ------------------------------------------------------------ notices */
  await Notice.insertMany([
    { title: "Welcome to the new academic session", content: `Classes for the academic year ${YEAR} have begun. Please check your timetable on the portal.`, category: "general", audience: { type: "all" }, createdBy: admin._id, publishDate: daysAgo(25) },
    { title: "Mid-Term Examination schedule released", content: "The mid-term examination schedule is now available under Exams. Hall tickets will be issued one week before.", category: "exam", audience: { type: "students" }, createdBy: admin._id, publishDate: daysAgo(3) },
    { title: "Faculty meeting on Friday", content: "All faculty members are requested to attend the academic council meeting at 3 PM in the Seminar Hall.", category: "academic", audience: { type: "faculty" }, createdBy: admin._id, publishDate: daysAgo(2) },
    { title: "Data Structures lab moved to Lab 2", content: "From next week the DS lab sessions will be held in CS-LAB 2.", category: "academic", audience: { type: "section", section: bcsA._id }, subject: S.CS304._id, createdBy: F2.user, publishDate: daysAgo(1) },
    { title: "Semester fee due date", content: "B.Tech CSE students must clear semester fees. A fine of ₹50/day applies after the due date.", category: "fee", audience: { type: "course", course: bcs._id }, createdBy: admin._id, publishDate: daysAgo(20) },
    { title: "Annual Tech Fest – Registrations open", content: "Register for coding, robotics and quiz events before the end of the month.", category: "event", audience: { type: "department", department: cse._id }, createdBy: admin._id, publishDate: daysAgo(5), expiryDate: daysAhead(30) },
  ]);

  /* ------------------------------------------------------------ library */
  const books = await Book.insertMany([
    { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", isbn: "9780262046305", category: "Computer Science", publisher: "MIT Press", totalCopies: 5, shelf: "CS-A1" },
    { title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", isbn: "9780078022159", category: "Computer Science", publisher: "McGraw Hill", totalCopies: 4, shelf: "CS-A2" },
    { title: "Operating System Concepts", author: "Silberschatz, Galvin, Gagne", isbn: "9781119800361", category: "Computer Science", publisher: "Wiley", totalCopies: 4, shelf: "CS-A3" },
    { title: "Clean Code", author: "Robert C. Martin", isbn: "9780132350884", category: "Computer Science", publisher: "Prentice Hall", totalCopies: 3, shelf: "CS-B1" },
    { title: "Signals and Systems", author: "Alan V. Oppenheim", isbn: "9780138147570", category: "Electronics", publisher: "Pearson", totalCopies: 4, shelf: "EC-A1" },
    { title: "Digital Design", author: "M. Morris Mano", isbn: "9780134549897", category: "Electronics", publisher: "Pearson", totalCopies: 4, shelf: "EC-A2" },
    { title: "Network Analysis", author: "M. E. Van Valkenburg", isbn: "9789353433611", category: "Electronics", publisher: "Pearson", totalCopies: 3, shelf: "EC-A3" },
    { title: "Principles of Management", author: "Harold Koontz", isbn: "9789339221478", category: "Management", publisher: "McGraw Hill", totalCopies: 4, shelf: "MG-A1" },
    { title: "Financial Accounting", author: "T. S. Grewal", isbn: "9789352531387", category: "Management", publisher: "Sultan Chand", totalCopies: 5, shelf: "MG-A2" },
    { title: "Managerial Economics", author: "D. N. Dwivedi", isbn: "9789325982871", category: "Management", publisher: "Vikas", totalCopies: 3, shelf: "MG-A3" },
    { title: "Wings of Fire", author: "A. P. J. Abdul Kalam", isbn: "9788173711466", category: "General", publisher: "Universities Press", totalCopies: 2, shelf: "GN-A1" },
    { title: "Atomic Habits", author: "James Clear", isbn: "9780735211292", category: "General", publisher: "Avery", totalCopies: 2, shelf: "GN-A2" },
  ]);
  const issues = [
    [books[0], students[0], daysAgo(10), daysAhead(4)], [books[1], students[1], daysAgo(20), daysAgo(6)], [books[2], students[2], daysAgo(5), daysAhead(9)],
    [books[4], students[28], daysAgo(18), daysAgo(4)], [books[5], students[30], daysAgo(3), daysAhead(11)], [books[7], students[41], daysAgo(7), daysAhead(7)],
  ];
  for (const [book, st, issueDate, dueDate] of issues) {
    await BookIssue.create({ book: book._id, student: st._id, issueDate, dueDate, issuedBy: admin._id });
    await Book.updateOne({ _id: book._id }, { $inc: { availableCopies: -1 } });
  }
  await BookIssue.create({ book: books[3]._id, student: students[0]._id, issueDate: daysAgo(40), dueDate: daysAgo(26), returnDate: daysAgo(22), status: "returned", fine: 20, finePaid: true, issuedBy: admin._id });

  /* --------------------------------------------- leaves/complaints/feedback */
  const su = (i) => students[i].user;
  await LeaveRequest.insertMany([
    { applicant: su(0), role: "student", leaveType: "sick", fromDate: daysAhead(1), toDate: daysAhead(2), reason: "Fever and doctor advised two days of rest." },
    { applicant: su(3), role: "student", leaveType: "personal", fromDate: daysAgo(8), toDate: daysAgo(7), reason: "Family function out of town.", status: "approved", reviewedBy: F1.user, reviewedAt: daysAgo(9), remarks: "Approved" },
    { applicant: su(30), role: "student", leaveType: "medical", fromDate: daysAhead(3), toDate: daysAhead(5), reason: "Scheduled minor surgery." },
    { applicant: F4.user, role: "faculty", leaveType: "casual", fromDate: daysAhead(6), toDate: daysAhead(6), reason: "Attending a workshop on VLSI design." },
  ]);
  await Complaint.insertMany([
    { user: su(0), category: "infrastructure", subject: "Projector not working in CS-101", description: "The projector in CS-101 has not been working for the past three days.", priority: "high" },
    { user: su(5), category: "attendance_correction", subject: "Marked absent on 5th", description: "I was present in the DBMS class but was marked absent. Requesting correction.", status: "in_progress", response: "Forwarded to the subject faculty.", respondedAt: daysAgo(1) },
    { user: su(40), category: "library", subject: "Need more copies of Financial Accounting", description: "There are not enough copies for the whole class before exams.", status: "resolved", response: "Two more copies have been ordered.", respondedAt: daysAgo(3), resolvedAt: daysAgo(3) },
  ]);
  await Feedback.insertMany([
    { user: su(1), category: "teaching", subject: S.CS301._id, rating: 5, message: "Data Structures classes are very clear and well paced." },
    { user: su(20), category: "facilities", rating: 3, message: "Wi-Fi in the library is slow during peak hours.", isAnonymous: true },
    { user: F1.user, category: "app", rating: 4, message: "Attendance marking on the portal is quick and easy." },
  ]);

  await Notification.insertMany(
    students.slice(0, 50).map((s) => ({ user: s.user, title: "Welcome to Attendify", message: "Your student portal is ready. Check your timetable, attendance and assignments.", type: "general" }))
  );
  await AuditLog.create({ user: admin._id, action: "seed", entity: "System", details: { note: "Demo data loaded" } });

  console.log("\n✅ Seed complete");
  console.log(`   ${students.length} students, ${faculty.length} faculty, ${subjects.length} subjects, ${tt.length} timetable slots, ${attendanceDocs.length} attendance sessions`);
  console.log("\nDemo logins:");
  console.log("   Admin    admin@college.edu     / Admin@123");
  console.log("   Faculty  faculty1@college.edu  / Faculty@123   (faculty1..faculty5)");
  console.log("   Student  student1@college.edu  / Student@123   (student1..student50)");
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.connection.close();
  process.exit(1);
});
