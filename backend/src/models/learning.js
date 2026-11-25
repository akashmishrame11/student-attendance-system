import mongoose from "mongoose";
import { fileSchema } from "./people.js";

const { Schema, model, Types } = mongoose;

/* ------------------------------------------------------------- attendance */
// One document per class session (section + subject + date).
const attendanceSchema = new Schema(
  {
    section: { type: Types.ObjectId, ref: "Section", required: true },
    subject: { type: Types.ObjectId, ref: "Subject", required: true },
    date: { type: Date, required: true },
    markedBy: { type: Types.ObjectId, ref: "User", required: true },
    records: [
      {
        _id: false,
        student: { type: Types.ObjectId, ref: "Student", required: true },
        status: { type: String, enum: ["present", "absent", "late", "leave"], required: true },
        remark: String,
      },
    ],
  },
  { timestamps: true, collection: "attendance" }
);
attendanceSchema.index({ section: 1, subject: 1, date: 1 }, { unique: true });
attendanceSchema.index({ "records.student": 1 });
export const Attendance = model("Attendance", attendanceSchema);

/* ------------------------------------------------------------ assignments */
const assignmentSchema = new Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 200 },
    description: { type: String, required: [true, "Description is required"] },
    instructions: String,
    subject: { type: Types.ObjectId, ref: "Subject", required: [true, "Subject is required"] },
    section: { type: Types.ObjectId, ref: "Section", required: [true, "Section is required"] },
    course: { type: Types.ObjectId, ref: "Course" },
    semester: { type: Types.ObjectId, ref: "Semester" },
    faculty: { type: Types.ObjectId, ref: "Faculty", required: true },
    attachments: [fileSchema],
    maxMarks: { type: Number, required: true, min: 1, default: 10 },
    dueDate: { type: Date, required: [true, "Deadline is required"] },
    allowResubmission: { type: Boolean, default: false },
    allowLateSubmission: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "assignments" }
);
assignmentSchema.index({ section: 1, dueDate: -1 });
export const Assignment = model("Assignment", assignmentSchema);

/* -------------------------------------------------- assignmentSubmissions */
const submissionSchema = new Schema(
  {
    assignment: { type: Types.ObjectId, ref: "Assignment", required: true },
    student: { type: Types.ObjectId, ref: "Student", required: true },
    textAnswer: String,
    files: [fileSchema],
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["submitted", "late", "evaluated", "resubmission_required"],
      default: "submitted",
    },
    marks: { type: Number, min: 0 },
    feedback: String,
    evaluatedBy: { type: Types.ObjectId, ref: "User" },
    evaluatedAt: Date,
    attempts: { type: Number, default: 1 },
    history: [
      { _id: false, textAnswer: String, files: [fileSchema], submittedAt: Date, marks: Number, feedback: String },
    ],
  },
  { timestamps: true, collection: "assignmentSubmissions" }
);
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
export const AssignmentSubmission = model("AssignmentSubmission", submissionSchema);

/* ----------------------------------------------------------- examinations */
const examinationSchema = new Schema(
  {
    name: { type: String, required: [true, "Exam name is required"], trim: true },
    type: { type: String, enum: ["internal", "midterm", "practical", "final"], required: true },
    course: { type: Types.ObjectId, ref: "Course", required: [true, "Course is required"] },
    semester: { type: Types.ObjectId, ref: "Semester", required: [true, "Semester is required"] },
    sections: [{ type: Types.ObjectId, ref: "Section" }],
    academicYear: String,
    startDate: { type: Date, required: [true, "Start date is required"] },
    endDate: Date,
    schedule: [
      {
        subject: { type: Types.ObjectId, ref: "Subject", required: true },
        date: { type: Date, required: true },
        startTime: String,
        endTime: String,
        room: String,
        maxMarks: { type: Number, default: 100, min: 1 },
        passMarks: { type: Number, default: 40, min: 0 },
      },
    ],
    createdBy: { type: Types.ObjectId, ref: "User" },
    resultsPublished: { type: Boolean, default: false },
    publishedAt: Date,
  },
  { timestamps: true, collection: "examinations" }
);
export const Examination = model("Examination", examinationSchema);

/* ----------------------------------------------------- examinationResults */
const resultSchema = new Schema(
  {
    exam: { type: Types.ObjectId, ref: "Examination", required: true },
    student: { type: Types.ObjectId, ref: "Student", required: true },
    marks: [
      {
        _id: false,
        subject: { type: Types.ObjectId, ref: "Subject", required: true },
        marksObtained: { type: Number, min: 0, required: true },
        maxMarks: { type: Number, required: true },
        passMarks: Number,
        grade: String,
        isAbsent: { type: Boolean, default: false },
      },
    ],
    total: Number,
    maxTotal: Number,
    percentage: Number,
    grade: String,
    status: { type: String, enum: ["pass", "fail", "pending"], default: "pending" },
    enteredBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "examinationResults" }
);
resultSchema.index({ exam: 1, student: 1 }, { unique: true });
export const ExaminationResult = model("ExaminationResult", resultSchema);
