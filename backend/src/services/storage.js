import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { env } from "../config/env.js";

/**
 * Storage abstraction.
 *  - STORAGE_DRIVER=local (default): files stay in UPLOAD_DIR and are served at /uploads/...
 *  - STORAGE_DRIVER=s3: files are pushed to an S3-compatible bucket (AWS S3, Cloudflare R2,
 *    MinIO, DigitalOcean Spaces, Backblaze B2) and served from S3_PUBLIC_URL.
 * Multer always writes to local disk first (so type/size validation is identical);
 * `persistUploads` then moves the files to the bucket when the S3 driver is active.
 */
let s3Client = null;
async function s3() {
  if (s3Client) return s3Client;
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: env.s3.region,
    endpoint: env.s3.endpoint,
    forcePathStyle: env.s3.forcePathStyle,
    credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
  });
  s3Client = { client, PutObjectCommand, DeleteObjectCommand };
  return s3Client;
}

/** Express middleware (after multer): upload req.file / req.files to S3 when enabled. */
export async function persistUploads(req, _res, next) {
  if (env.storageDriver !== "s3") return next();
  const files = [].concat(req.file || [], Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat());
  try {
    const { client, PutObjectCommand } = await s3();
    for (const file of files) {
      if (!file.path) continue; // memory uploads (imports) are not persisted
      const key = path.relative(env.uploadDir, file.path).split(path.sep).join("/");
      await client.send(new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        Body: createReadStream(file.path),
        ContentType: file.mimetype,
        ContentLength: file.size,
        ContentDisposition: `inline; filename="${encodeURIComponent(file.originalname)}"`,
      }));
      file.storedUrl = `${env.s3.publicUrl}/${key}`;
      await fs.unlink(file.path).catch(() => {});
    }
    next();
  } catch (err) {
    for (const f of files) if (f.path) await fs.unlink(f.path).catch(() => {});
    next(err);
  }
}

/** Metadata saved in MongoDB for an uploaded file. */
export function toStored(file, folder) {
  if (!file) return null;
  return {
    name: file.originalname,
    url: file.storedUrl || `/uploads/${folder}/${file.filename}`,
    size: file.size,
    mimeType: file.mimetype,
  };
}

/** Delete a previously stored file (local or S3). Never throws. */
export async function removeFile(url) {
  if (!url) return;
  try {
    if (env.s3.publicUrl && url.startsWith(`${env.s3.publicUrl}/`)) {
      const { client, DeleteObjectCommand } = await s3();
      await client.send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: url.slice(env.s3.publicUrl.length + 1) }));
      return;
    }
    if (!url.startsWith("/uploads/")) return;
    const filePath = path.resolve(env.uploadDir, url.replace(/^\/uploads\//, ""));
    if (!filePath.startsWith(env.uploadDir)) return;
    await fs.unlink(filePath);
  } catch {
    /* already gone */
  }
}
