import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../lib/errors.js";
import { passwordSchema, hashPassword, verifyPassword, DUMMY_HASH } from "../lib/passwords.js";
import { checkSecondFactor } from "../lib/mfa.js";

const emailSchema = z.string().trim().toLowerCase().email("must be a valid email").max(254);

const registerSchema = z.object({
  email: emailSchema,
  username: z.string().trim().min(1, "is required").max(40),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  code: z.string().trim().max(20).optional(),
});

export function authRoutes({ session, limiters, csrf }) {
  const router = Router();

  router.get("/csrf", csrf.issue);

  router.post("/register", limiters.auth, validateBody(registerSchema), async (req, res) => {
    const { email, username, password } = req.body;
    if (await User.exists({ email })) {
      throw new HttpError(409, "An account with that email already exists. Sign in instead.");
    }
    const user = await User.create({ email, username, passwordHash: await hashPassword(password) });
    session.issueSession(res, user);
    res.status(201).json({ user: user.toPublic() });
  });

  router.post("/login", limiters.auth, validateBody(loginSchema), async (req, res) => {
    const { email, password, code } = req.body;
    const user = await User.findOne({ email }).select(
      "+passwordHash +mfa.secret +mfa.lastUsedStep +mfa.recoveryCodes"
    );
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, "Email or password is incorrect.");

    if (user.mfa?.enabled) {
      if (!code) return res.json({ mfaRequired: true });
      if (!checkSecondFactor(user, code)) throw new HttpError(401, "That code didn't work. Try the newest code from your app.");
      await user.save();
    }
    session.issueSession(res, user);
    res.json({ user: user.toPublic() });
  });

  router.post("/logout", (req, res) => {
    session.clearSession(res);
    res.json({ ok: true });
  });

  // Used on page load: answers "who am I?" without an error when signed out.
  router.get("/session", (req, res, next) => {
    session.requireAuth(req, res, (err) => {
      if (err?.status === 401) return res.json({ user: null });
      if (err) return next(err);
      res.json({ user: req.user.toPublic() });
    });
  });

  router.get("/me", session.requireAuth, (req, res) => {
    res.json({ user: req.user.toPublic() });
  });

  return router;
}
