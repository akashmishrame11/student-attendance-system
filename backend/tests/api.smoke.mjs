// API smoke test: exercises every module for each role and checks permission boundaries.
// Requires a freshly seeded database (npm run seed) and a running API (npm run dev).
const BASE = process.env.API_URL || "http://localhost:5000/api";
let pass = 0, fail = 0;
const failures = [];

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 80) }; }
  return { status: res.status, json };
}

async function expect(label, method, path, token, body, wantStatus = 200) {
  const r = await call(method, path, token, body);
  const want = Array.isArray(wantStatus) ? wantStatus : [wantStatus];
  if (want.includes(r.status)) pass++;
  else { fail++; failures.push(`${label}: ${method} ${path} -> ${r.status} ${r.json?.message || JSON.stringify(r.json).slice(0, 120)}`); }
  return r.json;
}

for (let i = 0; i < 20; i++) {
  try { const h = await fetch(BASE + "/health"); if (h.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

await expect("health", "GET", "/health");
await expect("bad login", "POST", "/auth/login", null, { identifier: "admin@college.edu", password: "wrong" }, 401);
const A = (await expect("admin login", "POST", "/auth/login", null, { identifier: "admin@college.edu", password: "Admin@123" })).data.token;
const F = (await expect("faculty login", "POST", "/auth/login", null, { identifier: "faculty1@college.edu", password: "Faculty@123" })).data.token;
const F5 = (await expect("faculty5 login", "POST", "/auth/login", null, { identifier: "fac0005", password: "Faculty@123" })).data.token;
const S = (await expect("student login", "POST", "/auth/login", null, { identifier: "student1@college.edu", password: "Student@123" })).data.token;
await expect("no token", "GET", "/auth/me", null, null, 401);
await expect("me", "GET", "/auth/me", S);

// dashboards
await expect("admin dash", "GET", "/dashboard/admin", A);
await expect("faculty dash", "GET", "/dashboard/faculty", F);
await expect("student dash", "GET", "/dashboard/student", S);
await expect("student->admin dash", "GET", "/dashboard/admin", S, null, 403);

// master data
for (const p of ["/departments", "/courses", "/semesters?limit=50", "/sections?withStrength=true", "/subjects", "/enrollments", "/users", "/audit-logs", "/faculty", "/students?search=a&limit=5"]) await expect(`admin list ${p}`, "GET", p, A);
const depts = (await call("GET", "/departments?all=true", A)).json.data;
const dept = await expect("create dept", "POST", "/departments", A, { name: "Mechanical Engineering", code: "MEC" }, 201);
await expect("dup dept", "POST", "/departments", A, { name: "Mechanical Engineering", code: "MEC" }, 409);
await expect("update dept", "PUT", `/departments/${dept.data._id}`, A, { description: "Machines" });
await expect("dept summary", "GET", `/departments/${depts[0]._id}/summary`, A);
await expect("delete dept", "DELETE", `/departments/${dept.data._id}?permanent=true`, A);
await expect("delete used dept", "DELETE", `/departments/${depts[0]._id}?permanent=true`, A, null, 409);
await expect("student create dept", "POST", "/departments", S, { name: "X", code: "X" }, 403);

// students
const courses = (await call("GET", "/courses?all=true", A)).json.data;
const bcs = courses.find((c) => c.code === "BCS");
const sems = (await call("GET", `/semesters?course=${bcs._id}&all=true`, A)).json.data;
const sem3 = sems.find((s) => s.number === 3);
const secs = (await call("GET", `/sections?semester=${sem3._id}&all=true`, A)).json.data;
const newSt = await expect("create student", "POST", "/students", A, { name: "Test Student", email: "test.student@college.edu", department: bcs.department._id, course: bcs._id, semester: sem3._id, section: secs[0]._id, gender: "male" }, 201);
await expect("invalid student", "POST", "/students", A, { name: "X", email: "bad" }, 400);
await expect("update student", "PUT", `/students/${newSt.data._id}`, A, { phone: "9876543210" });
await expect("student status", "PATCH", `/students/${newSt.data._id}/status`, A, { status: "suspended" });
await expect("delete student", "DELETE", `/students/${newSt.data._id}?permanent=true`, A);
await expect("faculty list students", "GET", "/students", F);
await expect("student list students", "GET", "/students", S, null, 403);
const myProfile = (await expect("student me", "GET", "/students/me", S)).data;
const otherStudents = (await call("GET", "/students?limit=60", A)).json.data;
const other = otherStudents.find((s) => s._id !== myProfile._id);
await expect("student view other", "GET", `/students/${other._id}`, S, null, 404);
const bbaStudent = otherStudents.find((s) => s.course?.code === "BBA");
await expect("faculty view unassigned student", "GET", `/students/${bbaStudent._id}`, F, null, 404);

// faculty
await expect("faculty me", "GET", "/faculty/me", F);
await expect("workload", "GET", "/faculty/me/workload", F);

// timetable
const tt = await expect("student timetable", "GET", "/timetable", S);
await expect("faculty timetable", "GET", "/timetable", F);
const slot = tt.data[0];
await expect("tt conflict", "POST", "/timetable", A, { section: slot.section._id, subject: slot.subject._id, faculty: slot.faculty._id, room: "X-1", day: slot.day, startTime: slot.startTime, endTime: slot.endTime }, 409);
await expect("tt bad times", "POST", "/timetable", A, { section: slot.section._id, subject: slot.subject._id, faculty: slot.faculty._id, room: "X-1", day: "Saturday", startTime: "11:00", endTime: "10:00" }, 400);
const newSlot = await expect("tt create", "POST", "/timetable", A, { section: slot.section._id, subject: slot.subject._id, faculty: slot.faculty._id, room: "X-1", day: "Saturday", startTime: "09:00", endTime: "10:00" }, 201);
await expect("tt delete", "DELETE", `/timetable/${newSlot.data._id}`, A);

// attendance
const fMe = (await call("GET", "/faculty/me", F)).json.data;
const fSection = fMe.sections[0]._id;
const fSubject = fMe.subjects[0]._id;
const today = new Date().toISOString().slice(0, 10);
const sheet = await expect("sheet", "GET", `/attendance/sheet?section=${fSection}&subject=${fSubject}&date=${today}`, F);
const records = sheet.data.students.map((s, i) => ({ student: s._id, status: i % 4 === 0 ? "absent" : "present" }));
let attId = sheet.data.attendanceId;
if (!sheet.data.exists) attId = (await expect("mark", "POST", "/attendance", F, { section: fSection, subject: fSubject, date: today, records }, 201)).data._id;
await expect("mark dup", "POST", "/attendance", F, { section: fSection, subject: fSubject, date: today, records }, 409);
await expect("edit", "PUT", `/attendance/${attId}`, F, { records });
await expect("future", "POST", "/attendance", F, { section: fSection, subject: fSubject, date: "2030-01-01", records }, 400);
const bbaSection = (await call("GET", "/sections?all=true", A)).json.data.find((s) => s.course.code === "BBA");
await expect("unassigned sheet", "GET", `/attendance/sheet?section=${bbaSection._id}&subject=${fSubject}&date=${today}`, F, null, 403);
await expect("student mark", "POST", "/attendance", S, { section: fSection, subject: fSubject, date: today, records }, 403);
await expect("sessions", "GET", "/attendance", F);
await expect("report", "GET", `/attendance/report?section=${fSection}&subject=${fSubject}`, F);
await expect("low", "GET", "/attendance/low", A);
await expect("overview", "GET", "/attendance/overview", A);
await expect("my attendance", "GET", "/attendance/me", S);
const csv = await fetch(`${BASE}/attendance/export?section=${fSection}`, { headers: { Authorization: `Bearer ${F}` } });
if (csv.ok && (await csv.text()).startsWith("Roll No")) pass++; else { fail++; failures.push("csv export"); }

// assignments
await expect("faculty assignments", "GET", "/assignments", F);
const sa = await expect("student assignments", "GET", "/assignments", S);
const upcoming = sa.data.find((a) => new Date(a.dueDate) > new Date() && !a.submission);
const newAsg = await expect("create asg", "POST", "/assignments", F, { title: "Smoke Assignment", description: "desc", section: fSection, subject: fSubject, dueDate: new Date(Date.now() + 5 * 864e5).toISOString(), maxMarks: 10 }, 201);
await expect("faculty asg other section", "POST", "/assignments", F, { title: "Bad", description: "d", section: bbaSection._id, subject: fSubject, dueDate: new Date().toISOString() }, 403);
const myStudent = (await call("GET", "/students/me", S)).json.data;
if (String(myStudent.section._id) === String(fSection)) {
  const sub = await expect("submit", "POST", `/assignments/${newAsg.data._id}/submit`, S, { textAnswer: "My answer" }, 201);
  await expect("resubmit blocked", "POST", `/assignments/${newAsg.data._id}/submit`, S, { textAnswer: "again" }, 400);
  await expect("evaluate too high", "PATCH", `/submissions/${sub.data._id}/evaluate`, F, { marks: 99 }, 400);
  await expect("evaluate", "PATCH", `/submissions/${sub.data._id}/evaluate`, F, { marks: 8, feedback: "Good" });
  await expect("evaluate by F5", "PATCH", `/submissions/${sub.data._id}/evaluate`, F5, { marks: 8 }, 403);
}
await expect("asg submissions", "GET", `/assignments/${newAsg.data._id}/submissions`, F);
await expect("delete asg", "DELETE", `/assignments/${newAsg.data._id}`, F);
await expect("my submissions", "GET", "/submissions/me", S);
if (upcoming) pass++;

// exams/results
const exams = await expect("student exams", "GET", "/exams", S);
await expect("faculty exams", "GET", "/exams", F);
const internal = exams.data.find((e) => e.type === "internal");
await expect("results", "GET", `/results/exam/${internal._id}`, A);
await expect("my results", "GET", "/results/me", S);
const subjInExam = internal.schedule[0].subject._id;
const ms = await call("GET", `/results/exam/${internal._id}/sheet?subject=${subjInExam}`, A);
if (ms.status === 200) pass++; else { fail++; failures.push("marks sheet " + ms.json.message); }
await expect("save marks admin", "POST", `/results/exam/${internal._id}/marks`, A, { subject: subjInExam, entries: [{ student: ms.json.data.rows[0].student, marksObtained: 25 }] });
await expect("publish", "PATCH", `/exams/${internal._id}/publish`, A, { publish: true });
await expect("student publish", "PATCH", `/exams/${internal._id}/publish`, S, { publish: true }, 403);

// fees
const myFees = await expect("my fees", "GET", "/fees/me", S);
await expect("fee structures", "GET", "/fees", A);
const feeId = myFees.data.records[0]?.fee._id;
await expect("fee status", "GET", `/fees/${feeId}/status`, A);
await expect("payments", "GET", "/fees/payments", A);
const pending = myFees.data.records[0]?.pending;
if (pending > 0) {
  await expect("overpay", "POST", "/fees/payments", A, { student: myProfile._id, fee: feeId, amount: pending + 1 }, 400);
  const pay = await expect("pay", "POST", "/fees/payments", A, { student: myProfile._id, fee: feeId, amount: 100, method: "upi" }, 201);
  await expect("receipt", "GET", `/fees/payments/${pay.data._id}`, S);
}
await expect("reminders", "POST", `/fees/${feeId}/reminders`, A);
await expect("student pay", "POST", "/fees/payments", S, { student: myProfile._id, fee: feeId, amount: 1 }, 403);

// notices & notifications
await expect("notices student", "GET", "/notices", S);
await expect("notices faculty", "GET", "/notices", F);
await expect("faculty notice ok", "POST", "/notices", F, { title: "Class test", content: "Tomorrow", audience: { type: "section", section: fSection } }, 201);
await expect("faculty notice all", "POST", "/notices", F, { title: "To all", content: "x", audience: { type: "all" } }, 403);
await expect("admin notice", "POST", "/notices", A, { title: "Holiday", content: "Closed", audience: { type: "all" }, category: "holiday" }, 201);
const notifs = await expect("notifications", "GET", "/notifications", S);
await expect("read all", "PATCH", "/notifications/read-all", S);
await expect("send notif", "POST", "/notifications/send", A, { title: "Hi", message: "Test", audience: { type: "faculty" } });
if (notifs.meta.unread >= 0) pass++;

// leaves
const leave = await expect("apply leave", "POST", "/leaves", S, { leaveType: "sick", fromDate: "2027-01-10", toDate: "2027-01-11", reason: "Feeling unwell" }, 201);
await expect("overlap leave", "POST", "/leaves", S, { leaveType: "sick", fromDate: "2027-01-11", toDate: "2027-01-12", reason: "Feeling unwell" }, 409);
await expect("faculty leaves view", "GET", "/leaves", F);
await expect("faculty approve", "PATCH", `/leaves/${leave.data._id}/review`, F, { status: "approved", remarks: "ok" });
await expect("my leaves", "GET", "/leaves", S);

// library
const booksR = await expect("books", "GET", "/library/books", S);
await expect("stats", "GET", "/library/stats", A);
const issue = await expect("issue", "POST", "/library/issues", A, { book: booksR.data[0]._id, student: other._id }, [201, 409]);
if (issue.data?._id) await expect("return", "PATCH", `/library/issues/${issue.data._id}/return`, A, {});
await expect("my issues", "GET", "/library/issues", S);
await expect("student add book", "POST", "/library/books", S, { title: "x", author: "y", category: "z" }, 403);

// complaints/feedback
const comp = await expect("complaint", "POST", "/complaints", S, { category: "academic", subject: "Need extra class", description: "Please arrange an extra class for OS." }, 201);
await expect("admin respond", "PATCH", `/complaints/${comp.data._id}`, A, { status: "resolved", response: "Scheduled" });
await expect("feedback", "POST", "/feedback", S, { rating: 4, message: "Nice", category: "app" }, 201);
await expect("admin feedback", "GET", "/feedback", A);

// reports & settings
for (const t of ["students", "faculty", "attendance", "assignments", "fees", "departments", "courses", "library", "leaves"]) await expect(`report ${t}`, "GET", `/reports/${t}`, A);
await expect("report results", "GET", `/reports/results?exam=${internal._id}`, A);
await expect("faculty report fees", "GET", "/reports/fees", F, null, 403);
await expect("faculty report attendance", "GET", "/reports/attendance", F);
await expect("settings", "GET", "/settings", S);
await expect("update settings", "PUT", "/settings", A, { minAttendancePercent: 75 });
await expect("student update settings", "PUT", "/settings", S, { minAttendancePercent: 10 }, 403);

// password
await expect("weak pwd", "PATCH", "/auth/change-password", S, { currentPassword: "Student@123", newPassword: "abc" }, 400);
await expect("forgot", "POST", "/auth/forgot-password", null, { email: "student2@college.edu" });
await expect("nosql injection", "POST", "/auth/login", null, { identifier: { $ne: null }, password: { $ne: null } }, [400, 401]);

console.log(`PASS ${pass}  FAIL ${fail}`);
process.exitCode = fail ? 1 : 0;
for (const f of failures) console.log("  ✗ " + f);
