import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

for (const key of ["MONGO_URI", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}. Copy .env.example to .env`);
    process.exit(1);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  uploadDir: path.resolve(__dirname, "../..", process.env.UPLOAD_DIR || "src/uploads"),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 10,
  storageDriver: (process.env.STORAGE_DRIVER || "local").toLowerCase(),

  // Email. MAIL_TRANSPORT: "smtp" (needs SMTP_HOST), "console" (logs emails), or "none".
  mail: {
    transport: (process.env.MAIL_TRANSPORT || (process.env.SMTP_HOST ? "smtp" : "none")).toLowerCase(),
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || "Attendify <no-reply@attendify.local>",
  },

  // S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces…).
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    publicUrl: (process.env.S3_PUBLIC_URL || "").replace(/\/$/, ""),
  },
};

if (env.storageDriver === "s3") {
  const missing = ["bucket", "accessKeyId", "secretAccessKey", "publicUrl"].filter((k) => !env.s3[k]);
  if (missing.length) {
    console.error(`STORAGE_DRIVER=s3 requires: ${missing.map((k) => `S3_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`).join(", ")}`);
    process.exit(1);
  }
}
if (env.mail.transport === "smtp" && !env.mail.host) {
  console.error("MAIL_TRANSPORT=smtp requires SMTP_HOST");
  process.exit(1);
}
