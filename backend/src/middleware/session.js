import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { HttpError } from "../lib/errors.js";

export const SESSION_COOKIE = "daybook_session";
const ISSUER = "daybook";
const ALGORITHM = "HS256";

export function createSessionTools(config) {
  const cookieOptions = {
    httpOnly: true, // never readable from JavaScript
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: "/",
  };

  function issueSession(res, user) {
    const token = jwt.sign({ tv: user.tokenVersion }, config.jwtSecret, {
      algorithm: ALGORITHM,
      subject: user._id.toString(),
      issuer: ISSUER,
      expiresIn: config.jwtTtlSeconds,
    });
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: config.jwtTtlSeconds * 1000 });
  }

  function clearSession(res) {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
  }

  async function requireAuth(req, _res, next) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return next(new HttpError(401, "Sign in to continue"));
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM], issuer: ISSUER });
    } catch {
      return next(new HttpError(401, "Your session has expired. Sign in again."));
    }
    if (!mongoose.isValidObjectId(payload.sub)) return next(new HttpError(401, "Sign in to continue"));
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) {
      return next(new HttpError(401, "Your session has expired. Sign in again."));
    }
    req.user = user;
    next();
  }

  return { issueSession, clearSession, requireAuth };
}
