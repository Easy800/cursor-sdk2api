import { redactSecrets } from "./errors.js";

const BLOCKED_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api_key",
  "apikey",
  "token",
  "secret",
  "password",
  "content",
  "text",
  "thinking",
  "input",
  "args",
  "result",
  "prompt",
  "system",
  "messages",
  "email",
  "useremail",
]);

export interface Logger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export function createLogger(level = "info"): Logger {
  const ranks: Record<string, number> = { info: 0, warn: 1, error: 2 };
  const minimum = ranks[level.toLowerCase()] ?? ranks.info!;
  const write = (severity: string, fields: Record<string, unknown>, message: string) => {
    if ((ranks[severity] ?? ranks.info!) < minimum) return;
    const safe = sanitize(fields) as Record<string, unknown>;
    const line = JSON.stringify({
      level: severity,
      msg: message,
      service: "cursor-sdk2api",
      ...safe,
    });
    if (severity === "error") console.error(line);
    else if (severity === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    info: (fields, message) => write("info", fields, message),
    warn: (fields, message) => write("warn", fields, message),
    error: (fields, message) => write("error", fields, message),
  };
}

export function sanitize(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_KEYS.has(key.toLowerCase())) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = sanitize(nested);
    }
    return out;
  }
  return value;
}

export function assertNoSecretLeak(text: string, canaries: string[]): void {
  for (const canary of canaries) {
    if (canary && text.includes(canary)) {
      throw new Error("secret canary leaked into log or response");
    }
  }
}
