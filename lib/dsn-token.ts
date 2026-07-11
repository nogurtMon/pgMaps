import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Lazy: computed on first real use, not at module load. Next.js's build-time
// page-data collection imports API route modules without runtime env vars set,
// so throwing here eagerly would fail the build even though the key is never used.
let _key: Buffer | null = null;
function getKey(): Buffer {
  if (_key) return _key;
  const raw = process.env.DSN_ENCRYPTION_KEY;
  if (!raw) throw new Error("DSN_ENCRYPTION_KEY is required. Generate one with: openssl rand -hex 32");
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) throw new Error("DSN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  _key = key;
  return key;
}

function tryDecryptWithKey(key: Buffer, buf: Buffer): string | null {
  try {
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}

export function encryptDsn(dsn: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(dsn, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptDsn(token: string): string {
  const buf = Buffer.from(token, "base64url");
  const result = tryDecryptWithKey(getKey(), buf);
  if (result !== null) return result;
  throw new Error("Unable to decrypt connection string — the encryption key may have changed. Re-add this connection to fix it.");
}

/** Returns true if token was encrypted with a different key than the current one and should be re-encrypted. */
export function needsReencrypt(token: string): boolean {
  const buf = Buffer.from(token, "base64url");
  return tryDecryptWithKey(getKey(), buf) === null;
}
