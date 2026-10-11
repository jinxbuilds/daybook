import bcrypt from "bcryptjs";
import { z } from "zod";

const ROUNDS = 12;

// bcrypt only uses the first 72 bytes, so longer passwords are rejected
// rather than silently truncated.
export const passwordSchema = z
  .string()
  .min(8, "must be at least 8 characters")
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "must be at most 72 bytes");

export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Compared against when the email is unknown, so response time does not
// reveal whether an account exists.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-placeholder", ROUNDS);
