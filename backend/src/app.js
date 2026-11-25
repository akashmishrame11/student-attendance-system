import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    // Unknown origins get no CORS headers (so browsers block them), while
    // same-origin / proxied requests keep working instead of erroring.
    origin: (origin, cb) => cb(null, !origin || env.clientUrls.includes(origin)),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
if (!env.isProd) app.use(morgan("dev"));
else app.use(morgan("combined"));

// Strip Mongo operators from user input ($ and . keys) to prevent NoSQL injection.
function sanitize(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) delete obj[key];
    else sanitize(obj[key]);
  }
}
// (Express 5's default "simple" query parser never produces nested objects.)
app.use((req, _res, next) => {
  sanitize(req.body);
  sanitize(req.params);
  next();
});

app.get("/api/health", (_req, res) => {
  const dbState = ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState];
  res.status(dbState === "connected" ? 200 : 503).json({ success: true, status: "ok", db: dbState, uptime: process.uptime(), time: new Date() });
});

// Uploaded files. Only whitelisted types (PDF/Office/images/txt/zip) can be uploaded, and
// nosniff prevents browsers from reinterpreting them. Framing is allowed so the
// frontend can preview PDFs/images inline.
app.use(
  "/uploads",
  express.static(env.uploadDir, {
    dotfiles: "deny",
    index: false,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
    },
  })
);

app.use("/api", apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

export default app;
