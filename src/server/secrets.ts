import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
function key() {
  const value = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!value || value.length < 16) throw new Error("Configure an encryption key.");
  return createHash("sha256").update(value).digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["enc", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptSecret(value: string) {
  if (!value.startsWith("enc.")) return value;
  const [, iv, tag, text] = value.split(".");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url")); cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([cipher.update(Buffer.from(text, "base64url")), cipher.final()]).toString("utf8");
}
