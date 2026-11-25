import { Notification, Student, Faculty, User, Setting } from "../models/index.js";
import { sendMail, mailEnabled, layout, escapeHtml } from "./mailer.js";
import { env } from "../config/env.js";

// Settings toggles that can switch off e-mail for a notification type.
const TYPE_TOGGLE = { assignment: "assignment", deadline: "assignment", attendance: "attendance", fee: "fee" };

/** E-mail copies of notifications (when enabled in Settings). Runs in the background. */
async function emailCopies(ids, { title, message, type, link }) {
  if (!mailEnabled()) return;
  const s = await Setting.findOne({ key: "global" }).lean();
  if (!s?.notifications?.email) return;
  const toggle = TYPE_TOGGLE[type];
  if (toggle && s.notifications[toggle] === false) return;
  const emails = await User.find({ _id: { $in: ids }, isActive: true }).distinct("email");
  const url = link ? `${env.clientUrls[0]}${link}` : env.clientUrls[0];
  // Send in BCC batches of 50 so recipients don't see each other.
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    await sendMail({
      to: env.mail.from,
      bcc: batch,
      subject: title,
      text: `${message}\n\nOpen: ${url}`,
      html: layout(title, `<p>${escapeHtml(message)}</p>`, { url, label: "Open in Attendify" }),
    });
  }
}

/** Create one notification per user id (+ optional e-mail). Never throws. */
export async function notifyUsers(userIds, { title, message, type = "general", link }) {
  try {
    const ids = [...new Set(userIds.filter(Boolean).map(String))];
    if (!ids.length) return 0;
    await Notification.insertMany(ids.map((user) => ({ user, title, message, type, link })));
    emailCopies(ids, { title, message, type, link }).catch((err) => console.error("Notification email failed:", err.message));
    return ids.length;
  } catch (err) {
    console.error("Notification failed:", err.message);
    return 0;
  }
}

/**
 * Resolve an audience descriptor to user ids.
 * audience.type: all | students | faculty | department | course | semester | section
 */
export async function resolveAudience(audience = { type: "all" }) {
  const { type, department, course, semester, section } = audience;
  const studentUsers = (filter) =>
    Student.find({ status: "active", ...filter }).distinct("user");

  switch (type) {
    case "students":
      return studentUsers({});
    case "faculty":
      return Faculty.find({ status: { $ne: "inactive" } }).distinct("user");
    case "department": {
      const [s, f] = await Promise.all([
        studentUsers({ department }),
        Faculty.find({ department }).distinct("user"),
      ]);
      return [...s, ...f];
    }
    case "course":
      return studentUsers({ course });
    case "semester":
      return studentUsers({ semester });
    case "section":
      return studentUsers({ section });
    case "all":
    default:
      return User.find({ isActive: true, role: { $in: ["student", "faculty"] } }).distinct("_id");
  }
}

export async function notifyAudience(audience, payload) {
  const ids = await resolveAudience(audience);
  return notifyUsers(ids, payload);
}

export async function notifySection(sectionId, payload) {
  const ids = await Student.find({ section: sectionId, status: "active" }).distinct("user");
  return notifyUsers(ids, payload);
}
