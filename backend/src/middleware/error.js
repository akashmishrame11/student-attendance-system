import multer from "multer";
import { env } from "../config/env.js";

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express identifies error middleware by its 4 arguments.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors;

  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ") || "Validation failed";
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid value for ${err.path}`;
    errors = undefined;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {}).join(", ");
    message = `A record with this ${field || "value"} already exists`;
    errors = undefined;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? `File too large (max ${env.maxFileSizeMb}MB)` : err.message;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  }

  if (status >= 500) console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);

  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProd ? "Internal server error" : message,
    ...(errors ? { errors } : {}),
  });
}
