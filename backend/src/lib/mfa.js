import crypto from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = { window: 1, step: 30 };
const ISSUER = "Daybook";

export const generateSecret = () => authenticator.generateSecret(20);

export async function setupPayload(email, secret) {
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
  return { otpauthUrl, qrDataUrl, secret };
}

// Returns the time step the code belongs to, or null if invalid.
export function verifyTotp(code, secret) {
  if (!/^\d{6}$/.test(code) || !secret) return null;
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  return Math.floor(Date.now() / 1000 / 30) + delta;
}

const hashCode = (code) =>
  crypto.createHash("sha256").update(code.toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");

export function generateRecoveryCodes(count = 8) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(10);
    const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return { codes, hashes: codes.map(hashCode) };
}

// Returns the remaining hashes if the code matched, otherwise null.
export function consumeRecoveryCode(code, hashes) {
  const h = hashCode(code);
  const idx = hashes.findIndex((x) => x.length === h.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(h)));
  if (idx === -1) return null;
  return hashes.filter((_, i) => i !== idx);
}

// Checks a TOTP or recovery code and records the result on the user
// document (caller saves). Rejects reuse of an already-used TOTP step.
export function checkSecondFactor(user, code) {
  const step = verifyTotp(code, user.mfa.secret);
  if (step !== null) {
    if (step <= (user.mfa.lastUsedStep || 0)) return false;
    user.mfa.lastUsedStep = step;
    return true;
  }
  const remaining = consumeRecoveryCode(code, user.mfa.recoveryCodes || []);
  if (remaining) {
    user.mfa.recoveryCodes = remaining;
    return true;
  }
  return false;
}
