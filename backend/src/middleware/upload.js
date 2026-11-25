import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { persistUploads } from "../services/storage.js";

const TYPES = {
  image: {
    ext: [".jpg", ".jpeg", ".png", ".webp"],
    mime: ["image/jpeg", "image/png", "image/webp"],
  },
  document: {
    ext: [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".txt", ".ppt", ".pptx", ".xls", ".xlsx", ".zip"],
    mime: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "text/plain",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "application/x-zip-compressed",
    ],
  },
  sheet: {
    ext: [".csv", ".xlsx"],
    mime: [
      "text/csv",
      "application/vnd.ms-excel",
      "text/plain",
      "application/octet-stream",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
    ],
  },
};

/**
 * Multer instance storing files under uploads/<folder>.
 * Validates both extension and MIME type, and enforces MAX_FILE_SIZE_MB.
 * kind: "image" | "document" | "sheet" (sheets are kept in memory for parsing).
 * Returns { single(field), array(field, max) } producing middleware arrays that also
 * persist files to cloud storage when STORAGE_DRIVER=s3.
 */
export function uploader(folder, kind = "document") {
  const dir = path.join(env.uploadDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  const allowed = TYPES[kind];

  const storage =
    kind === "sheet"
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, dir),
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
          },
        });

  const m = multer({
    storage,
    limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.ext.includes(ext) || !allowed.mime.includes(file.mimetype)) {
        return cb(
          ApiError.badRequest(`File type not allowed: ${file.originalname}. Allowed: ${allowed.ext.join(", ")}`)
        );
      }
      cb(null, true);
    },
  });
  return {
    single: (field) => [m.single(field), persistUploads],
    array: (field, max = 5) => [m.array(field, max), persistUploads],
  };
}
