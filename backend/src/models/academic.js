import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

/* ------------------------------------------------------------ departments */
const departmentSchema = new Schema(
  {
    name: { type: String, required: [true, "Department name is required"], trim: true, unique: true },
    code: { type: String, required: [true, "Department code is required"], trim: true, uppercase: true, unique: true },
    description: String,
    head: { type: Types.ObjectId, ref: "Faculty" },
    establishedYear: Number,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "departments" }
);
export const Department = model("Department", departmentSchema);

/* ---------------------------------------------------------------- courses */
const courseSchema = new Schema(
  {
    name: { type: String, required: [true, "Course name is required"], trim: true },
    code: { type: String, required: [true, "Course code is required"], trim: true, uppercase: true, unique: true },
    department: { type: Types.ObjectId, ref: "Department", required: [true, "Department is required"] },
    durationYears: { type: Number, required: true, min: 1, max: 6, default: 4 },
    totalSemesters: { type: Number, required: true, min: 1, max: 12, default: 8 },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "courses" }
);
export const Course = model("Course", courseSchema);

/* -------------------------------------------------------------- semesters */
const semesterSchema = new Schema(
  {
    course: { type: Types.ObjectId, ref: "Course", required: [true, "Course is required"] },
    number: { type: Number, required: [true, "Semester number is required"], min: 1, max: 12 },
    name: { type: String, trim: true },
    academicYear: { type: String, required: [true, "Academic year is required"], trim: true },
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "semesters" }
);
semesterSchema.index({ course: 1, number: 1, academicYear: 1 }, { unique: true });
semesterSchema.pre("validate", function setName() {
  if (!this.name && this.number) this.name = `Semester ${this.number}`;
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "End date must be after start date");
  }
});
export const Semester = model("Semester", semesterSchema);

/* --------------------------------------------- sections (classes/sections) */
const sectionSchema = new Schema(
  {
    name: { type: String, required: [true, "Section name is required"], trim: true, uppercase: true },
    course: { type: Types.ObjectId, ref: "Course", required: [true, "Course is required"] },
    semester: { type: Types.ObjectId, ref: "Semester", required: [true, "Semester is required"] },
    batch: { type: String, trim: true },
    classTeacher: { type: Types.ObjectId, ref: "Faculty" },
    room: { type: String, trim: true },
    capacity: { type: Number, default: 60, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "sections", toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
sectionSchema.index({ course: 1, semester: 1, name: 1 }, { unique: true });
export const Section = model("Section", sectionSchema);

/* --------------------------------------------------------------- subjects */
const subjectSchema = new Schema(
  {
    name: { type: String, required: [true, "Subject name is required"], trim: true },
    code: { type: String, required: [true, "Subject code is required"], trim: true, uppercase: true, unique: true },
    department: { type: Types.ObjectId, ref: "Department", required: [true, "Department is required"] },
    course: { type: Types.ObjectId, ref: "Course", required: [true, "Course is required"] },
    semester: { type: Types.ObjectId, ref: "Semester", required: [true, "Semester is required"] },
    type: { type: String, enum: ["theory", "practical"], default: "theory" },
    credits: { type: Number, min: 0, max: 10, default: 4 },
    faculty: { type: Types.ObjectId, ref: "Faculty" },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "subjects" }
);
export const Subject = model("Subject", subjectSchema);

/* ------------------------------------------------------------ enrollments */
const enrollmentSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "Student", required: true },
    subject: { type: Types.ObjectId, ref: "Subject", required: true },
    section: { type: Types.ObjectId, ref: "Section", required: true },
    semester: { type: Types.ObjectId, ref: "Semester", required: true },
    status: { type: String, enum: ["enrolled", "dropped", "completed"], default: "enrolled" },
  },
  { timestamps: true, collection: "enrollments" }
);
enrollmentSchema.index({ student: 1, subject: 1, semester: 1 }, { unique: true });
export const Enrollment = model("Enrollment", enrollmentSchema);

/* ------------------------------------------------------------- timetables */
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const timetableSchema = new Schema(
  {
    section: { type: Types.ObjectId, ref: "Section", required: [true, "Section is required"] },
    subject: { type: Types.ObjectId, ref: "Subject", required: [true, "Subject is required"] },
    faculty: { type: Types.ObjectId, ref: "Faculty", required: [true, "Faculty is required"] },
    room: { type: String, required: [true, "Room is required"], trim: true },
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: [true, "Day is required"],
    },
    startTime: { type: String, required: true, match: [timeRegex, "Use HH:mm format"] },
    endTime: { type: String, required: true, match: [timeRegex, "Use HH:mm format"] },
  },
  { timestamps: true, collection: "timetables" }
);
timetableSchema.pre("validate", function checkTimes() {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate("endTime", "End time must be after start time");
  }
});
timetableSchema.index({ day: 1, faculty: 1 });
timetableSchema.index({ day: 1, section: 1 });
export const Timetable = model("Timetable", timetableSchema);
