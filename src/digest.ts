import { createHash, scryptSync } from "node:crypto";

const CREDENTIAL_FINGERPRINT_SALT = "cursor-sdk2api:credential-fingerprint:v1";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function credentialFingerprint(secret: string): string {
  return scryptSync(secret, CREDENTIAL_FINGERPRINT_SALT, 32).toString("hex");
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function digestJson(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const out: Record<string, unknown> = {};
    for (const [key, nested] of entries) {
      out[key] = sortValue(nested);
    }
    return out;
  }
  return value;
}
