import { afterEach, expect, test } from "vitest";
import { api, closeTestApp, startTestApp, type TestContext } from "../helpers/app.js";

let ctx: TestContext;

afterEach(async () => {
  if (ctx) await closeTestApp(ctx);
});

test("account is partial when spending and limits are not on the official surface", async () => {
  ctx = await startTestApp();
  const res = await api(ctx, "/v1/account");
  const body = (await res.json()) as {
    status: string;
    identity: { api_key_name?: string };
    spending?: unknown;
    limits?: unknown;
    remaining?: unknown;
    capabilities: { identity: boolean; spending: boolean; limits: boolean };
    reasons: Record<string, string>;
  };
  expect(res.status).toBe(200);
  expect(body.status).toBe("partial");
  expect(body.identity.api_key_name).toBe("test-key");
  expect(body.spending).toBeUndefined();
  expect(body.limits).toBeUndefined();
  expect(body.remaining).toBeUndefined();
  expect(body.capabilities.identity).toBe(true);
  expect(body.capabilities.spending).toBe(false);
  expect(body.capabilities.limits).toBe(false);
  expect(body.reasons.spending).toBe("official_sdk_surface_unavailable");
});

test("account degrades when identity itself is unavailable", async () => {
  ctx = await startTestApp({
    sdk: { account: { ok: false, reason: "cursor_account_unavailable", message: "no me()" } },
  });
  const body = (await (await api(ctx, "/v1/account")).json()) as {
    status: string;
    identity: unknown;
    capabilities: { identity: boolean };
  };
  expect(body.status).toBe("unavailable");
  expect(body.identity).toBeNull();
  expect(body.capabilities.identity).toBe(false);
});

test("account never fabricates remaining quota when spending is missing", async () => {
  ctx = await startTestApp({
    sdk: {
      account: {
        ok: true,
        identity: { apiKeyName: "svc" },
      },
    },
  });
  const raw = await (await api(ctx, "/v1/account")).text();
  expect(raw).not.toContain("remaining");
  expect(raw).not.toContain("hard_limit");
});
