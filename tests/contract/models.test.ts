import { afterEach, expect, test } from "vitest";
import { api, closeTestApp, startTestApp, type TestContext } from "../helpers/app.js";

let ctx: TestContext;

afterEach(async () => {
  if (ctx) await closeTestApp(ctx);
});

test("models require auth", async () => {
  ctx = await startTestApp();
  const res = await fetch(`${ctx.url}/v1/models`);
  expect(res.status).toBe(401);
});

test("models preserve exact catalog ids and do not invent aliases", async () => {
  ctx = await startTestApp({
    sdk: {
      models: {
        ok: true,
        models: [
          {
            id: "claude-sonnet-4-6",
            displayName: "Sonnet 4.6",
            parameters: [{ id: "fast", values: [{ value: "true" }, { value: "false" }] }],
          },
        ],
      },
    },
  });
  const res = await api(ctx, "/v1/models");
  const body = (await res.json()) as { data: Array<{ id: string }>; status: string };
  expect(res.status).toBe(200);
  expect(body.status).toBe("ok");
  expect(body.data.map((item) => item.id)).toEqual(["claude-sonnet-4-6"]);
  expect(JSON.stringify(body)).not.toContain("cursor/");
});

test("models degrade honestly when the SDK catalog is unavailable", async () => {
  ctx = await startTestApp({
    sdk: {
      models: { ok: false, reason: "cursor_models_list_unavailable", message: "no catalog" },
    },
  });
  const body = (await (await api(ctx, "/v1/models")).json()) as {
    data: unknown[];
    status: string;
    reason: string;
  };
  expect(body.data).toEqual([]);
  expect(body.status).toBe("unavailable");
  expect(body.reason).toBe("cursor_models_list_unavailable");
});

test("stale catalog is marked after a live refresh failure", async () => {
  ctx = await startTestApp({
    config: { catalogCacheMs: 1 },
    sdk: {
      models: { ok: true, models: [{ id: "composer-2.5" }] },
    },
  });
  await api(ctx, "/v1/models");
  ctx.sdk.models = { ok: false, reason: "cursor_models_list_unavailable", message: "down" };
  await new Promise((resolve) => setTimeout(resolve, 5));
  const body = (await (await api(ctx, "/v1/models")).json()) as {
    status: string;
    cache: { stale: boolean };
    data: Array<{ id: string }>;
  };
  expect(body.status).toBe("stale");
  expect(body.cache.stale).toBe(true);
  expect(body.data[0]?.id).toBe("composer-2.5");
});

test("catalog cache is scoped to credential fingerprint", async () => {
  ctx = await startTestApp({
    sdk: { models: { ok: true, models: [{ id: "only-for-a" }] } },
  });
  await api(ctx, "/v1/models", { apiKey: "key-a" });
  ctx.sdk.models = { ok: true, models: [{ id: "only-for-b" }] };
  const body = (await (await api(ctx, "/v1/models", { apiKey: "key-b" })).json()) as {
    data: Array<{ id: string }>;
  };
  expect(body.data[0]?.id).toBe("only-for-b");
});
