// Feature checks for exports (Excel/PDF), spreadsheet import, file uploads, password reset
// and access control on downloads. Requires a freshly seeded DB and a running API.
//   npm run test:features            (API_URL overrides http://localhost:5000/api)
import ExcelJS from "exceljs";

const BASE = process.env.API_URL || "http://localhost:5000/api";
const ORIGIN = BASE.replace(/\/api$/, "");
let pass = 0;
const failures = [];
const check = (label, cond, extra = "") => (cond ? pass++ : failures.push(`${label} ${extra}`));

async function req(method, path, token, body, isForm) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !isForm ? { "Content-Type": "application/json" } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  return res;
}
const json = async (r) => r.json().catch(() => ({}));
const login = async (identifier, password) => (await json(await req("POST", "/auth/login", null, { identifier, password }))).data?.token;

const A = await login("admin@college.edu", "Admin@123");
const F = await login("faculty1@college.edu", "Faculty@123");
const S = await login("student1@college.edu", "Student@123");
const S2 = await login("student2@college.edu", "Student@123");
check("logins", A && F && S && S2);

/* ---------------------------------------------------- report exports */
for (const fmt of ["xlsx", "pdf", "csv"]) {
  for (const type of ["students", "attendance", "fees", "departments", "library"]) {
    const r = await req("GET", `/reports/${type}?format=${fmt}`, A);
    const buf = Buffer.from(await r.arrayBuffer());
    const magic = fmt === "pdf" ? buf.subarray(0, 4).toString() === "%PDF" : fmt === "xlsx" ? buf.subarray(0, 2).toString() === "PK" : buf.length > 10;
    check(`report ${type}.${fmt}`, r.status === 200 && magic, `status=${r.status}`);
  }
}
// Excel content is real data
{
  const r = await req("GET", "/reports/students?format=xlsx", A);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  const ws = wb.worksheets[0];
  check("xlsx has header + 50 students", ws.getRow(1).getCell(1).value === "Student ID" && ws.rowCount === 51, `rows=${ws.rowCount}`);
}
// Faculty restricted from admin-only exports
check("faculty cannot export fees pdf", (await req("GET", "/reports/fees?format=pdf", F)).status === 403);

/* ------------------------------------------------ attendance exports */
const fMe = (await json(await req("GET", "/faculty/me", F))).data;
const section = fMe.sections[0]._id;
for (const fmt of ["xlsx", "pdf"]) {
  const r = await req("GET", `/attendance/export?section=${section}&format=${fmt}`, F);
  const buf = Buffer.from(await r.arrayBuffer());
  check(`attendance export ${fmt}`, r.status === 200 && buf.length > 500 && /attachment/.test(r.headers.get("content-disposition") || ""));
}

/* ------------------------------------------------------- receipt pdf */
const fees = (await json(await req("GET", "/fees/me", S))).data;
const pending = fees.records[0].pending;
let paymentId = fees.payments[0]?._id;
if (!paymentId && pending > 0) {
  const p = await json(await req("POST", "/fees/payments", A, { student: fees.student._id, fee: fees.records[0].fee._id, amount: 500, method: "upi" }));
  paymentId = p.data._id;
}
{
  const r = await req("GET", `/fees/payments/${paymentId}/pdf`, S);
  const buf = Buffer.from(await r.arrayBuffer());
  check("own receipt pdf", r.status === 200 && buf.subarray(0, 4).toString() === "%PDF");
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  check("receipt is a single page", pages === 1, `pages=${pages}`);
  check("other student's receipt pdf blocked", (await req("GET", `/fees/payments/${paymentId}/pdf`, S2)).status === 404);
}

/* ------------------------------------------------------ xlsx import */
{
  const dept = (await json(await req("GET", "/departments?all=true", A))).data.find((d) => d.code === "CSE");
  check("dept exists", Boolean(dept));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Students");
  ws.addRow(["name", "email", "phone", "gender", "dateOfBirth", "departmentCode", "courseCode", "semesterNumber", "sectionName", "batch", "guardianName", "guardianPhone", "address"]);
  ws.addRow(["Excel Imported One", "excel.one@college.edu", "9876500001", "female", new Date("2006-03-04"), "CSE", "BCS", 3, "B", "2025-2029", "Mr. One", "9811100001", "Delhi"]);
  ws.addRow(["Excel Imported Two", { text: "excel.two@college.edu", hyperlink: "mailto:excel.two@college.edu" }, "9876500002", "male", "2006-05-06", "CSE", "BCS", 3, "A", "2025-2029", "Mr. Two", "9811100002", "Noida"]);
  ws.addRow(["Bad Row", "bad@college.edu", "", "", "", "CSE", "NOPE", 1, "", "", "", "", ""]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "students.xlsx");
  const r = await json(await req("POST", "/students/import", A, fd, true));
  check("xlsx import 2 created / 1 error", r.data?.created === 2 && r.data?.errors?.length === 1, JSON.stringify(r).slice(0, 200));
  const found = (await json(await req("GET", "/students?search=Excel%20Imported", A))).data;
  check("imported students searchable", found?.length === 2);
  // csv import too
  const csv = "name,email,departmentCode,courseCode,semesterNumber,sectionName\nCsv Person,csv.person@college.edu,CSE,BCS,3,A\n";
  const fd2 = new FormData();
  fd2.append("file", new Blob([csv], { type: "text/csv" }), "s.csv");
  const r2 = await json(await req("POST", "/students/import", A, fd2, true));
  check("csv import", r2.data?.created === 1, JSON.stringify(r2).slice(0, 200));
  // wrong type rejected
  const fd3 = new FormData();
  fd3.append("file", new Blob(["x"], { type: "text/html" }), "evil.html");
  check("html upload rejected", (await req("POST", "/students/import", A, fd3, true)).status === 400);
}

/* ------------------------------------------ file upload + storage */
{
  // Faculty creates a fresh assignment for student1's section, so the test is self-contained.
  const me = (await json(await req("GET", "/students/me", S))).data;
  const subject = (await json(await req("GET", `/subjects?section=${me.section._id}&mine=true&all=true`, F))).data[0];
  const created = await json(await req("POST", "/assignments", F, {
    title: "Upload test", description: "Attach a PDF", section: me.section._id, subject: subject._id,
    dueDate: new Date(Date.now() + 3 * 864e5).toISOString(), maxMarks: 10,
  }));
  check("faculty creates assignment", Boolean(created.data?._id), JSON.stringify(created).slice(0, 160));
  const asg = created.data;
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  const fd = new FormData();
  fd.append("textAnswer", "See attached");
  fd.append("files", new Blob([pdf], { type: "application/pdf" }), "answer.pdf");
  const r = await req("POST", `/assignments/${asg._id}/submit`, S, fd, true);
  const body = await json(r);
  check("submit with file", r.status === 201, JSON.stringify(body).slice(0, 200));
  const url = body.data?.files?.[0]?.url;
  check("stored url", Boolean(url), url);
  if (url) {
    const fileRes = await fetch(url.startsWith("http") ? url : ORIGIN + url);
    const got = Buffer.from(await fileRes.arrayBuffer());
    check("uploaded file retrievable", fileRes.status === 200 && got.subarray(0, 4).toString() === "%PDF", `${fileRes.status} ${url}`);
  }
  const big = new Blob([Buffer.alloc(11 * 1024 * 1024)], { type: "application/pdf" });
  const fdBig = new FormData();
  fdBig.append("files", big, "big.pdf");
  check("oversized file rejected", (await req("POST", `/assignments/${asg._id}/submit`, S, fdBig, true)).status === 400);
  const fdExe = new FormData();
  fdExe.append("files", new Blob(["MZ"], { type: "application/x-msdownload" }), "virus.exe");
  check("exe rejected", (await req("POST", `/assignments/${asg._id}/submit`, S, fdExe, true)).status === 400);
}

/* --------------------------------------------- password reset flow */
{
  const r = await json(await req("POST", "/auth/forgot-password", null, { email: "student3@college.edu" }));
  const link = r.data?.resetUrl;
  check("reset link issued (dev/console mail)", Boolean(link), JSON.stringify(r));
  const token = link?.split("/").pop();
  const bad = await req("POST", `/auth/reset-password/${"0".repeat(64)}`, null, { password: "NewPass123" });
  check("invalid token rejected", bad.status === 400);
  const good = await req("POST", `/auth/reset-password/${token}`, null, { password: "NewPass123" });
  check("reset works", good.status === 200);
  check("login with new password", Boolean(await login("student3@college.edu", "NewPass123")));
  check("token single-use", (await req("POST", `/auth/reset-password/${token}`, null, { password: "Other123x" })).status === 400);
  const unknown = await json(await req("POST", "/auth/forgot-password", null, { email: "nobody@college.edu" }));
  check("unknown email gives same message", unknown.success && !unknown.data?.resetUrl);
}

/* --------------------------------------- notification e-mail toggle */
{
  await req("PUT", "/settings", A, { notifications: { email: true, assignment: true, attendance: true, fee: true } });
  const r = await req("POST", "/notifications/send", A, { title: "Email test", message: "Hello by email", audience: { type: "faculty" } });
  check("send notification with email on", r.status === 200);
  await req("PUT", "/settings", A, { notifications: { email: false, assignment: true, attendance: true, fee: true } });
  const s = (await json(await req("GET", "/settings", A))).data;
  check("settings exposes drivers to admin", Boolean(s.system?.mail && s.system?.storage), JSON.stringify(s.system));
  const s2 = (await json(await req("GET", "/settings", S))).data;
  check("settings hides drivers from students", !s2.system);
}

console.log(`PASS ${pass}  FAIL ${failures.length}`);
for (const f of failures) console.log("  ✗ " + f);
process.exitCode = failures.length ? 1 : 0;
