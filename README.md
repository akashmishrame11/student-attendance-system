# Attendify — College Student Management System (College ERP)

A full-stack, role-based college ERP with separate **Admin**, **Faculty** and **Student** panels.

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Axios, React Hook Form, Recharts, Lucide icons, react-hot-toast |
| Backend | Node.js (≥ 20), Express 5, REST API, JWT auth, bcrypt (bcryptjs), express-validator, Multer, Helmet, rate limiting, Nodemailer, ExcelJS, PDFKit, AWS SDK (S3) |
| Database | MongoDB with Mongoose (local MongoDB or MongoDB Atlas) |

---

## 1. Quick start

**Prerequisites:** Node.js 20 or newer, and MongoDB 6+ (local install or a free MongoDB Atlas cluster).

```bash
# 1. Install everything (root tooling + backend + frontend)
npm install
npm run install:all

# 2. Configure the backend
cp backend/.env.example backend/.env      # Windows: copy backend\.env.example backend\.env
#    → set MONGO_URI and a long random JWT_SECRET (see section 3)

# 3. Load demo data (WARNING: wipes the configured database first)
npm run seed

# 4. Run API (port 5000) + web app (port 5173) together
npm run dev
```

Open **http://localhost:5173** and sign in with a demo account (section 4).

Run the parts separately with `npm run dev:api` and `npm run dev:web`.

### Using the shared Atlas database (team members)

The project's shared MongoDB Atlas database already contains the data, so skip step 3:

```bash
copy backend\.env.atlas.example backend\.env     # macOS/Linux: cp backend/.env.atlas.example backend/.env
#  → replace <password> in MONGO_URI with the Atlas password from the project owner
#  → set a long random JWT_SECRET
npm run dev                                       # do NOT run "npm run seed": it wipes the shared data
```

If the connection fails, ask the owner to allow your IP in Atlas → Network Access.
The password is never committed; `backend/.env` is git-ignored.

---

## 2. Database setup

**Local MongoDB (Windows).** Install MongoDB Community Server, then start the service:

```powershell
net start MongoDB
```

You can also run `mongod` directly:

```powershell
"C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath C:\data\db
```

Keep `MONGO_URI=mongodb://127.0.0.1:27017/college_erp`.

> If the MongoDB Windows service fails to start with error 1067, check `C:\Program Files\MongoDB\Server\8.0\log\mongod.log`. An "out of memory" crash can be avoided by adding `storage.wiredTiger.engineConfig.cacheSizeGB: 0.5` to `mongod.cfg`.

**MongoDB Atlas.**
1. Create a free cluster.
2. Add a database user.
3. Allow your IP address.
4. Copy the connection string into `MONGO_URI`.

Collections, indexes and unique constraints are created automatically by Mongoose. `npm run seed` loads the demo data.

---

## 3. Environment variables

### `backend/.env`

| Variable | Example | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `production` hides internal error details and the dev password-reset link |
| `PORT` | `5000` | API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/college_erp` | MongoDB / Atlas connection string |
| `JWT_SECRET` | *(64+ random chars)* | Signs login tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `1d` | Session length; expired sessions are logged out automatically |
| `CLIENT_URL` | `http://localhost:5173` | Comma-separated list of allowed frontend origins (CORS) |
| `UPLOAD_DIR` | `src/uploads` | Where uploaded files are stored |
| `MAX_FILE_SIZE_MB` | `10` | Per-file upload limit |
| `STORAGE_DRIVER` | `local` | `local` disk, or `s3` for any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL` | | Required when `STORAGE_DRIVER=s3`. `S3_PUBLIC_URL` is the public base URL files are served from |
| `MAIL_TRANSPORT` | `console` | `smtp` sends real email, `console` prints emails in the API log (development), `none` disables email |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | | SMTP settings for `MAIL_TRANSPORT=smtp`. For Gmail: `smtp.gmail.com`, port 465, secure `true`, and an App Password |

`backend/.env.production.example` is a production template.

### `frontend/.env` (optional)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Leave empty in development: Vite proxies `/api` and `/uploads` to `localhost:5000`. In production, set it to the API URL, e.g. `https://api.example.com/api` |

---

## 4. Demo login credentials

Created by `npm run seed`.

| Role | Email | Username | Password |
|---|---|---|---|
| Admin | `admin@college.edu` | `admin` | `Admin@123` |
| Faculty (×5) | `faculty1@college.edu` … `faculty5@college.edu` | `fac0001` … `fac0005` | `Faculty@123` |
| Student (×50) | `student1@college.edu` … `student50@college.edu` | `stu20250001` … | `Student@123` |

The login page also has one-click demo buttons.

**Seed data:**
- 1 admin, 5 faculty and 50 students
- 3 departments and 3 courses, each with all its semesters
- 8 sections and 12 subjects
- 80 weekly timetable slots
- About 30 days of attendance, including some students below 75%
- Assignments with submissions (some late, some evaluated)
- Internal exam with published results, plus an upcoming mid-term
- Fee structures and payments, including overdue fines
- Notices, library books and issues, leave requests, complaints and feedback

Each role sees different data:
- `faculty1` (Dr. Rajesh Kumar) teaches CS301 and CS303 in BCS Sem 3, sections A and B.
- `faculty5` teaches the BBA section.
- `student1` is in BCS Sem 3 – A.

---

## 5. Features

### Completed

**Authentication & security**
- Login with email or username
- Role-based redirection after login
- JWT sessions, with automatic logout when a session expires
- bcrypt password hashing
- Logout
- Forgot / reset password by email, with time-limited, single-use, hashed tokens
- "Password changed" confirmation emails
- Change password, which invalidates older tokens
- Profile and photo update
- Account activation and deactivation
- Rate-limited login (10 failed attempts per 15 minutes)
- Protected frontend routes and backend endpoints
- Row-level access control:
  - Students only see their own records.
  - Faculty only see their assigned sections and subjects.
- Validation on both frontend and backend
- NoSQL-injection sanitising
- Helmet security headers and CORS whitelist
- File type and size validation
- Audit logs for admin operations

**Admin panel**

| Module | Details |
|---|---|
| Dashboard | Counts, today's attendance, 7-day attendance chart, students per department, fee collection chart, upcoming exams, recent activity |
| Students | Add, edit, view, deactivate, delete. Auto student ID and roll number, photo, documents. Search, filters, pagination, Excel (.xlsx) or CSV import with per-row error report, promotion to the next semester (graduates final-semester students), status management |
| Faculty | Add, edit, deactivate. Department, designation, assigned courses, subjects and sections. Weekly timetable and workload view |
| Departments | Head of department, detail view with faculty, courses and counts. Deletion is blocked while records are linked |
| Courses, Semesters | Academic year, start and end dates, active-semester flag |
| Classes & Sections | Course, semester and section; batch, class teacher, room, capacity. Assign students, with capacity enforced |
| Subjects | Theory or practical, credits, assigned faculty. Enrollment sync |
| Timetable | Weekly and daily views. Blocks section, faculty and room clashes, and subjects from the wrong semester |
| Attendance | Mark and correct attendance. History by class, subject and date. Monthly class reports, low-attendance list, Excel / PDF / CSV export, 14-day overview |
| Assignments | All assignments with submitted, pending, late and evaluated counts. Submissions and marks |
| Exams & Results | Internal, mid-term, practical and final exams with an exam timetable. Marks entry, automatic grades, pass/fail, publish and unpublish, Excel / PDF / CSV export |
| Fees | Fee structures with components, fine per day and due date. Per-student status (paid, partial, unpaid, overdue), payment recording with overpayment checks, PDF receipts, reminders, reports |
| Notices | Attachments, publish and expiry dates. Audience: everyone, students, faculty, department, course, semester or section |
| Notifications | Send to any audience. Automatic notifications for assignments, deadlines, evaluations, low attendance, exams, results, fees, leave and notices. Optional email copies (toggle in Settings, per-type switches for assignment, attendance and fee mails) |
| Leave | Student and faculty requests; approve or reject with remarks |
| Library | Books, categories and inventory. Issue, return, due dates, automatic fines, overdue tracking, statistics |
| Complaints & Feedback | Categories (including attendance and profile correction requests), assignment to staff, status and responses. Feedback ratings |
| Reports | Students, faculty, attendance (by class, subject or student), assignments, results, fees, departments, courses, library and leave. Each downloads as a formatted Excel workbook, a paginated PDF or CSV |
| Settings | College name and logo, academic year, minimum attendance %, attendance edit window, grading scale, time slots, library rules, notification preferences |
| User accounts | Activate or deactivate any login, reset passwords, create additional admins |

**Faculty panel**
- Dashboard: classes, students, today's timetable, pending evaluations, 7-day attendance, deadlines, exams, notices
- My Classes, My Students (search, profile, attendance), My Subjects
- Mark attendance:
  - Pick class → subject → date, and the student list loads automatically.
  - Mark P, A, Late or Leave, with bulk actions and remarks.
  - Duplicate sessions are prevented.
  - Edits are allowed within the configured edit window.
  - Low-attendance warnings are shown.
- Attendance reports and CSV export
- Assignments:
  - Create, edit and delete, with attachments, deadline, resubmission and late rules, and a publish toggle.
  - Evaluation screen with file preview for PDFs and images.
  - Marks, feedback, approval or a resubmission request.
- Exams & marks:
  - Create exams for their own sections and enter marks.
  - Marks lock for faculty once results are published.
- Notices to their own sections or subjects; review students' leave; reports; help desk

**Student panel**
- Dashboard: profile summary, attendance % with warning, today's classes, assignment status, exams, notices
- Profile:
  - Edit phone, address and photo.
  - Request corrections to other details through the help desk.
- My Classes, Timetable (weekly and today)
- Attendance: read-only; subject-wise, monthly chart and day history
- Assignments:
  - Download attachments.
  - Submit a text answer and/or files (PDF, DOC, DOCX, JPG, PNG and more).
  - Late detection, resubmission if allowed, history, marks and feedback.
- Exams (timetables) and published results with grades
- Fees: structure, dues, fines, payment history, PDF receipts
- Library: issued books, due dates, fines, catalogue
- Notices, leave applications with documents, complaints and feedback, notifications

### Remaining / known limitations
- **Online fee payment** is not integrated with a payment gateway (e.g. Razorpay or Stripe), because that needs a merchant account and live keys. Payments are recorded by the accounts office and students receive PDF receipts.
- **Email needs your SMTP account.** Email is fully implemented (password reset, password-changed alerts, notification copies). Without SMTP credentials, `MAIL_TRANSPORT=console` prints each email in the API log, and the reset link is also shown on screen in development.
- **S3 storage was tested against an S3-compatible mock server, not a real bucket.** Set your bucket credentials to use it.
- **Automated tests** are API-level: 128 API/permission checks plus 43 feature checks (exports, imports, uploads, password reset). There are no unit or component test suites.

---

## 6. Project structure

```
├── package.json              # root scripts (dev, seed, build, test:api)
├── backend/
│   ├── .env.example  .env.production.example
│   ├── tests/                # api.smoke.mjs (128 checks), features.test.mjs (43 checks)
│   └── src/
│       ├── app.js  server.js
│       ├── config/           # env loading, MongoDB connection
│       ├── models/           # 26 Mongoose models (people, academic, learning, campus)
│       ├── controllers/      # auth, users, students, faculty, academic, attendance,
│       │                     # assignments, exams, fees, communication, campus,
│       │                     # dashboard, reports, settings
│       ├── routes/index.js   # all REST routes + role guards
│       ├── middleware/       # auth (JWT + roles), validation, upload, rate limit, errors
│       ├── services/         # access control, notifications, mailer, enrollment,
│       │                     # storage (local / S3), audit
│       ├── validators/       # express-validator rule sets
│       ├── utils/            # CRUD factory, query/CSV helpers, Excel (sheet.js),
│       │                     # PDF (pdf.js), grading
│       ├── seed/seed.js      # demo data
│       └── uploads/          # local file storage (git-ignored)
└── frontend/
    ├── vercel.json  public/_redirects     # SPA routing on Vercel / Netlify
    └── src/
        ├── App.jsx  main.jsx  index.css
        ├── routes/           # AppRoutes (lazy-loaded), ProtectedRoute / GuestRoute
        ├── layouts/          # DashboardLayout (sidebar, top bar, bell), navigation per role
        ├── context/          # AuthContext
        ├── services/api.js   # Axios instance, token handling, downloads
        ├── hooks/            # useApi, useOptions, useDebounce
        ├── components/ui/    # Button, Card, Modal, ConfirmDialog, DataTable, Pagination,
        │                     # form fields, skeletons, empty/error states…
        ├── components/landing/  # public landing page sections
        ├── features/         # ResourcePage/Form (config-driven CRUD), attendance,
        │                     # timetable, fees widgets
        ├── pages/            # auth/, admin/, faculty/, student/, shared/, dashboards.jsx
        ├── styles/legacy.css # original landing/login styles
        └── utils/            # formatters, dropdown option helpers
```

**Database collections:**
- `users`, `students`, `faculties`, `departments`, `courses`, `semesters`, `sections`
- `subjects`, `enrollments`, `timetables`, `attendance`
- `assignments`, `assignmentSubmissions`, `examinations`, `examinationResults`
- `fees`, `feePayments`, `notices`, `notifications`, `leaveRequests`
- `books`, `bookIssues`, `complaints`, `feedback`, `auditLogs`, `settings`

---

## 7. Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | API + web app with live reload |
| `npm run seed` | Reset the database to the demo data |
| `npm run build` | Production build of the frontend (`frontend/dist`) |
| `npm start` | Start the API in production mode |
| `npm run lint` | Lint the frontend |
| `npm run test:api` | Run 128 API + permission checks against a running, freshly seeded API (`API_URL` overrides the target) |
| `npm run test:features` | Run 43 feature checks: Excel/PDF/CSV exports, .xlsx import, uploads, password reset, email toggle (re-seed first) |

---

## 8. API overview

- **Base URL:** `/api`
- **Auth:** send `Authorization: Bearer <token>` with every request.
- **Response format:** `{ success, message, data, meta? }`
- **List endpoints** support `page`, `limit`, `search`, `sort` (e.g. `-createdAt`), field filters, and `all=true` (used for dropdowns).

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password/:token`, `PATCH /auth/change-password`, `PATCH /auth/profile` |
| People | `/students` (+ `/me`, `/import`, `/promote`, `/:id/status`, `/:id/documents`), `/faculty` (+ `/me`, `/:id/workload`), `/users`, `/audit-logs` |
| Academic | `/departments`, `/courses`, `/semesters`, `/sections` (+ `/:id/students`), `/subjects`, `/enrollments`, `/timetable` |
| Attendance | `/attendance` (sessions), `/attendance/sheet`, `/attendance/report`, `/attendance/export`, `/attendance/low`, `/attendance/me`, `/attendance/student/:id`, `/attendance/overview` |
| Assessment | `/assignments` (+ `/:id/submit`, `/:id/submissions`), `/submissions` (+ `/me`, `/:id/evaluate`), `/exams` (+ `/:id/publish`), `/results/me`, `/results/exam/:id` (+ `/sheet`, `/marks`) |
| Campus | `/fees` (+ `/me`, `/payments`, `/:id/status`, `/:id/reminders`, `/student/:id`), `/notices`, `/notifications` (+ `/send`, `/read-all`), `/leaves`, `/library/books`, `/library/issues`, `/complaints`, `/feedback` |
| Exports (`format` = `xlsx`, `pdf` or `csv`) | `/reports/:type?format=…`, `/attendance/export?format=…`, `/fees/payments/:id/pdf` |
| Other | `/dashboard/{admin,faculty,student}`, `/settings`, `/health` |

---

## 9. Deployment

The frontend and backend deploy separately.

### Backend (Render, Railway, a VPS, etc.)
1. Create a MongoDB Atlas cluster and copy its connection string.
2. Create a Node web service with root directory `backend/`, build command `npm install` and start command `npm start`.
3. Set the variables from `backend/.env.production.example`:
   - `NODE_ENV=production`
   - `MONGO_URI` (your Atlas string)
   - a strong `JWT_SECRET`
   - `CLIENT_URL=https://<your-frontend-domain>`
4. Health check path: `/api/health`. It returns 503 when the database is unreachable.
5. Optionally seed once: run `npm run seed` from the service shell. This wipes the database.
6. Uploads: on platforms with ephemeral disks (Render, Railway, Heroku), set `STORAGE_DRIVER=s3` and the `S3_*` variables (AWS S3, Cloudflare R2, etc.). The bucket or its CDN must allow public reads at `S3_PUBLIC_URL`. Alternatively, attach a persistent disk mounted at `UPLOAD_DIR`.
7. Email: set `MAIL_TRANSPORT=smtp` and the `SMTP_*` variables (Gmail App Password, SendGrid, Mailgun, Amazon SES SMTP…).

### Frontend (Vercel, Netlify, any static host)
1. Use root directory `frontend/`, build command `npm run build` and output directory `dist`.
2. Set `VITE_API_URL=https://<your-api-domain>/api`.
3. SPA routing is preconfigured: `vercel.json` for Vercel, `public/_redirects` for Netlify.

### Single server (optional)
Build the frontend, serve `frontend/dist` with Nginx, and reverse-proxy `/api` and `/uploads` to the Node process on port 5000.

In that setup, `VITE_API_URL` can stay empty.
