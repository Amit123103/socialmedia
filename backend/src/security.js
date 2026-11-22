import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export function sha(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
export function randomToken() { return crypto.randomBytes(32).toString("hex"); }

export function encrypt(text) {
  if (!text) return null;
  const key = crypto.createHash("sha256").update(process.env.TOKEN_ENCRYPTION_KEY || "development-token-key").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decrypt(encoded) {
  if (!encoded) return null;
  const raw = Buffer.from(encoded, "base64");
  const key = crypto.createHash("sha256").update(process.env.TOKEN_ENCRYPTION_KEY || "development-token-key").digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
export function accessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_ACCESS_SECRET || "access-dev", { expiresIn: "15m" });
}
export function refreshToken(user) {
  return jwt.sign({ sub: user.id, type: "refresh" }, process.env.JWT_REFRESH_SECRET || "refresh-dev", { expiresIn: "30d" });
}
