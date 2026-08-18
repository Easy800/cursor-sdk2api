import { afterEach, expect, test } from "vitest";
import { GatewayError } from "../../src/errors.js";
import { parseMessagesRequest, renderPrompt } from "../../src/protocols/anthropic/parse.js";
import { api, closeTestApp, startTestApp, type TestContext } from "../helpers/app.js";

let ctx: TestContext;

afterEach(async () => {
  if (ctx) await closeTestApp(ctx);
  ctx = undefined as never;
});

test("system and developer roles retain transcript order", () => {
  const parsed = parseMessagesRequest({
    model: "composer-2.5",
    system: "top rule",
    messages: [
      { role: "user", content: "first" },
      { role: "developer", content: "late rule" },
      { role: "user", content: "second" },
    ],
  });
  const prompt = renderPrompt(parsed).text;
  expect(prompt.indexOf("System:\ntop rule")).toBeLessThan(prompt.indexOf("user:\nfirst"));
  expect(prompt.indexOf("user:\nfirst")).toBeLessThan(prompt.indexOf("developer:\nlate rule"));
  expect(prompt.indexOf("developer:\nlate rule")).toBeLessThan(prompt.indexOf("user:\nsecond"));
});

test("historical tool and function roles preserve result content", () => {
  const parsed = parseMessagesRequest({
    model: "composer-2.5",
    messages: [
      { role: "user", content: "lookup" },
      { role: "assistant", content: "calling" },
      { role: "tool", tool_call_id: "call_1", content: "72F" },
      { role: "function", name: "legacy_lookup", content: "legacy-result" },
      { role: "user", content: "summarize" },
    ],
  });
  const prompt = renderPrompt(parsed).text;
  expect(prompt).toContain("[tool_result call_1 is_error=false]\n72F");
  expect(prompt).toContain("function:\n[compatibility tool transcript name=legacy_lookup]\nlegacy-result");
});

test("trailing tool role requires an authoritative call id", () => {
  expect(() => parseMessagesRequest({
    model: "composer-2.5",
    messages: [
      { role: "user", content: "lookup" },
      { role: "function", name: "lookup", content: "result" },
    ],
  })).toThrowError(/trailing function message requires tool_call_id, call_id, or id/);
});

test("an old tool result followed by assistant text is history, not a continuation", () => {
  const parsed = parseMessagesRequest({
    model: "composer-2.5",
    messages: [
      { role: "tool", tool_call_id: "call_old", content: "done" },
      { role: "assistant", content: "finished" },
    ],
  });
  expect(parsed.continuation).toBeUndefined();
});

test("trailing tool role with a call id enters fail-closed continuation lookup", async () => {
  ctx = await startTestApp();
  const response = await api(ctx, "/v1/messages", {
    method: "POST",
    body: JSON.stringify({
      model: "composer-2.5",
      messages: [
        { role: "user", content: "lookup" },
        { role: "tool", tool_call_id: "call_missing", content: "result" },
      ],
    }),
  });
  const body = (await response.json()) as { error: { type: string } };
  expect(response.status).toBe(409);
  expect(body.error.type).toBe("cursor_session_lost");
  expect(ctx.sdk.lastCreate).toBeUndefined();
});

test("unknown roles still fail closed", () => {
  try {
    parseMessagesRequest({
      model: "composer-2.5",
      messages: [{ role: "spectator", content: "nope" }],
    });
    expect.unreachable("expected invalid role");
  } catch (error) {
    expect(error).toBeInstanceOf(GatewayError);
    expect(error).toMatchObject({ code: "invalid_request", httpStatus: 422 });
  }
});
