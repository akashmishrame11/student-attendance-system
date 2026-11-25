import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const { Schema, model, Types } = mongoose;

const fileSchema = new Schema(
  { name: String, url: String, size: Number, mimeType: String },
  { _id: false }
);
export { fileSchema };

/* ------------------------------------------------------------------ users */
const userSchema = new Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["admin", "faculty", "student"], required: true, index: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    passwordChangedAt: Date,
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true, collection: "users" }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
  if (!this.isNew) this.passwordChangedAt = new Date();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.createResetToken = function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(token).digest("hex");
  this.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  return token;
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

export const User = model("User", userSchema);

/* --------------------------------------------------------------- students */
const studentSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, unique: true },
    studentId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    rollNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    gender: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: Date,
    address: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    department: { type: Types.ObjectId, ref: "Department", required: [true, "Department is required"] },
    course: { type: Types.ObjectId, ref: "Course", required: [true, "Course is required"] },
    semester: { type: Types.ObjectId, ref: "Semester", required: [true, "Semester is required"] },
    section: { type: Types.ObjectId, ref: "Section" },
    batch: { type: String, trim: true },
    admissionDate: { type: Date, default: Date.now },
    documents: [fileSchema],
    status: {
      type: String,
      enum: ["active", "inactive", "graduated", "suspended"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true, collection: "students" }
);
studentSchema.index({ section: 1, status: 1 });
studentSchema.index({ course: 1, semester: 1 });
export const Student = model("Student", studentSchema);

/* -------------------------------------------------------------- faculties */
const facultySchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    department: { type: Types.ObjectId, ref: "Department", required: [true, "Department is required"] },
    designation: {
      type: String,
      enum: ["Professor", "Associate Professor", "Assistant Professor", "Lecturer", "Lab Assistant", "Head of Department"],
      default: "Assistant Professor",
    },
    qualification: String,
    specialization: String,
    subjects: [{ type: Types.ObjectId, ref: "Subject" }],
    sections: [{ type: Types.ObjectId, ref: "Section" }],
    courses: [{ type: Types.ObjectId, ref: "Course" }],
    joiningDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["active", "inactive", "on_leave"], default: "active" },
  },
  { timestamps: true, collection: "faculties" }
);
export const Faculty = model("Faculty", facultySchema);
