import { HttpError } from "../lib/errors.js";

// Validates req.body against a zod schema. Rejects anything that is not
// the expected shape (e.g. {"$ne": null} where a string is required),
// which also blocks MongoDB operator injection.
export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.join(".");
    return next(new HttpError(400, field ? `${field}: ${issue.message}` : issue.message));
  }
  req.body = result.data;
  next();
};

export const validateQuery = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) return next(new HttpError(400, "Invalid query parameters"));
  req.validQuery = result.data;
  next();
};
