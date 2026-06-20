import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(): Buffer {
  const key = process.env.AUTH_SECRET;
  if (!key) throw new Error("AUTH_SECRET is not set");
  return crypto.createHash("sha256").update(key).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptToken(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64url");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function signState(payload: object): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.AUTH_SECRET || "dev-secret-change-me")
    .update(data)
    .digest("hex");
  return `${data}.${sig}`;
}

export function verifyState<T = unknown>(state: string): T {
  const lastDot = state.lastIndexOf(".");
  if (lastDot < 0) throw new Error("Invalid state");
  const data = state.slice(0, lastDot);
  const sig = state.slice(lastDot + 1);
  const expected = crypto
    .createHmac("sha256", process.env.AUTH_SECRET || "dev-secret-change-me")
    .update(data)
    .digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
    throw new Error("State signature mismatch");
  }
  return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T;
}
