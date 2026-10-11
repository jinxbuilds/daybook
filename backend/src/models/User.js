import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    username: { type: String, required: true, trim: true, maxlength: 40 },
    passwordHash: { type: String, required: true, select: false },
    // Incremented on logout-everywhere / password change to revoke existing sessions.
    tokenVersion: { type: Number, default: 0 },
    mfa: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      pendingSecret: { type: String, select: false },
      lastUsedStep: { type: Number, default: 0, select: false },
      // SHA-256 hashes of single-use recovery codes.
      recoveryCodes: { type: [String], default: [], select: false },
    },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    email: this.email,
    username: this.username,
    mfaEnabled: Boolean(this.mfa?.enabled),
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
