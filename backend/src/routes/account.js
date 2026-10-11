import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../lib/errors.js";
import { passwordSchema, hashPassword, verifyPassword } from "../lib/passwords.js";
import { generateSecret, setupPayload, verifyTotp, generateRecoveryCodes, checkSecondFactor } from "../lib/mfa.js";

const SENSITIVE = "+passwordHash +mfa.secret +mfa.pendingSecret +mfa.lastUsedStep +mfa.recoveryCodes";

async function loadWithSecrets(id) {
  const user = await User.findById(id).select(SENSITIVE);
  if (!user) throw new HttpError(401, "Sign in to continue");
  return user;
}

async function requirePassword(user, password) {
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Current password is incorrect.");
  }
}

export function accountRoutes({ session, limiters }) {
  const router = Router();
  router.use(session.requireAuth);

  router.patch(
    "/profile",
    validateBody(z.object({ username: z.string().trim().min(1, "is required").max(40) })),
    async (req, res) => {
      req.user.username = req.body.username;
      await req.user.save();
      res.json({ user: req.user.toPublic() });
    }
  );

  router.post(
    "/password",
    limiters.auth,
    validateBody(z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema })),
    async (req, res) => {
      const user = await loadWithSecrets(req.user._id);
      await requirePassword(user, req.body.currentPassword);
      user.passwordHash = await hashPassword(req.body.newPassword);
      user.tokenVersion += 1; // signs out every other session
      await user.save();
      session.issueSession(res, user);
      res.json({ ok: true });
    }
  );

  router.post("/logout-everywhere", async (req, res) => {
    req.user.tokenVersion += 1;
    await req.user.save();
    session.clearSession(res);
    res.json({ ok: true });
  });

  // --- Two-factor authentication (TOTP) ---

  router.post("/mfa/setup", limiters.auth, async (req, res) => {
    const user = await loadWithSecrets(req.user._id);
    if (user.mfa.enabled) throw new HttpError(409, "Two-factor sign-in is already on.");
    user.mfa.pendingSecret = generateSecret();
    await user.save();
    res.json(await setupPayload(user.email, user.mfa.pendingSecret));
  });

  router.post(
    "/mfa/enable",
    limiters.auth,
    validateBody(z.object({ code: z.string().trim().max(10) })),
    async (req, res) => {
      const user = await loadWithSecrets(req.user._id);
      if (user.mfa.enabled) throw new HttpError(409, "Two-factor sign-in is already on.");
      const step = verifyTotp(req.body.code, user.mfa.pendingSecret);
      if (step === null) throw new HttpError(400, "That code didn't match. Check your app's clock and try the newest code.");
      const { codes, hashes } = generateRecoveryCodes();
      user.mfa.secret = user.mfa.pendingSecret;
      user.mfa.pendingSecret = undefined;
      user.mfa.enabled = true;
      user.mfa.lastUsedStep = step;
      user.mfa.recoveryCodes = hashes;
      user.tokenVersion += 1;
      await user.save();
      session.issueSession(res, user);
      res.json({ user: user.toPublic(), recoveryCodes: codes });
    }
  );

  router.post(
    "/mfa/disable",
    limiters.auth,
    validateBody(z.object({ password: z.string().min(1).max(200), code: z.string().trim().max(20) })),
    async (req, res) => {
      const user = await loadWithSecrets(req.user._id);
      if (!user.mfa.enabled) throw new HttpError(409, "Two-factor sign-in is already off.");
      await requirePassword(user, req.body.password);
      if (!checkSecondFactor(user, req.body.code)) throw new HttpError(401, "That code didn't work.");
      user.mfa = { enabled: false, recoveryCodes: [], lastUsedStep: 0 };
      await user.save();
      res.json({ user: user.toPublic() });
    }
  );

  router.delete(
    "/",
    limiters.auth,
    validateBody(z.object({ password: z.string().min(1).max(200) })),
    async (req, res) => {
      const user = await loadWithSecrets(req.user._id);
      await requirePassword(user, req.body.password);
      await Task.deleteMany({ owner: user._id });
      await User.deleteOne({ _id: user._id });
      session.clearSession(res);
      res.json({ ok: true });
    }
  );

  return router;
}
