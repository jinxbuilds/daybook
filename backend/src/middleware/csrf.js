import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";

// Signed double-submit CSRF protection.
// GET /api/auth/csrf sets a cookie and returns the same token in the body.
// Every state-changing request must echo it in the X-CSRF-Token header.
// Another site can neither read the token (CORS) nor forge a valid signature.

export const CSRF_COOKIE = "daybook_csrf";
export const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createCsrf(config) {
  const key = crypto.createHash("sha256").update(`csrf:${config.jwtSecret}`).digest();
  const sign = (nonce) => crypto.createHmac("sha256", key).update(nonce).digest("base64url");

  function newToken() {
    const nonce = crypto.randomBytes(24).toString("base64url");
    return `${nonce}.${sign(nonce)}`;
  }

  function isWellFormed(token) {
    if (typeof token !== "string") return false;
    const [nonce, sig] = token.split(".");
    if (!nonce || !sig) return false;
    const expected = Buffer.from(sign(nonce));
    const given = Buffer.from(sig);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  }

  function issue(req, res) {
    const existing = req.cookies?.[CSRF_COOKIE];
    const token = isWellFormed(existing) ? existing : newToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      path: "/",
    });
    res.json({ csrfToken: token });
  }

  function protect(req, _res, next) {
    if (SAFE_METHODS.has(req.method)) return next();
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get(CSRF_HEADER);
    if (
      !isWellFormed(cookieToken) ||
      typeof headerToken !== "string" ||
      cookieToken.length !== headerToken.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
    ) {
      return next(new HttpError(403, "Security check failed. Refresh the page and try again."));
    }
    next();
  }

  return { issue, protect };
}
