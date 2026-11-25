import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

/** Run express-validator chains, then fail with 400 and field errors. */
export const validate = (chains) => [
  ...chains,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
    next(ApiError.badRequest(errors[0]?.message || "Validation failed", errors));
  },
];
