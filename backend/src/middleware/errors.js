import { HttpError } from "../lib/errors.js";

export function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, "Not found"));
}

// Logs only the method, path and error message. Request bodies, headers,
// cookies and query strings are never logged.
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err?.type === "entity.parse.failed") err = new HttpError(400, "Request body is not valid JSON");
    if (err?.type === "entity.too.large") err = new HttpError(413, "Request body is too large");
    if (err?.code === 11000) err = new HttpError(409, "That already exists");

    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) logger.error(`${req.method} ${req.path} failed: ${err?.message}`);
    res.status(status).json({ error: status >= 500 ? "Something went wrong on our side." : err.message });
  };
}
