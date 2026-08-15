import http, { createServer } from "node:http";
import https from "node:https";
import { afterEach, expect, test } from "vitest";
import { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import {
  PROXY_ENV_KEYS,
  configureSdkOutboundProxy,
  hasOutboundProxy,
  proxyEnvironment,
  resolveOutboundProxy,
} from "../../src/sdk/proxy.js";

const originalHttpAgent = http.globalAgent;
const originalHttpsAgent = https.globalAgent;
const originalDispatcher = getGlobalDispatcher();
const originalProxyEnv = Object.fromEntries(PROXY_ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(async () => {
  const currentHttp = http.globalAgent;
  const currentHttps = https.globalAgent;
  const currentDispatcher = getGlobalDispatcher();
  http.globalAgent = originalHttpAgent;
  https.globalAgent = originalHttpsAgent;
  setGlobalDispatcher(originalDispatcher);
  if (currentHttp !== originalHttpAgent) currentHttp.destroy();
  if (currentHttps !== originalHttpsAgent && currentHttps !== currentHttp) currentHttps.destroy();
  if (currentDispatcher !== originalDispatcher) await currentDispatcher.close();
  for (const key of PROXY_ENV_KEYS) {
    const value = originalProxyEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("proxy detection accepts standard upper and lower case variables", () => {
  expect(hasOutboundProxy({ HTTPS_PROXY: "http://127.0.0.1:7890" })).toBe(true);
  expect(hasOutboundProxy({ all_proxy: "http://127.0.0.1:7890" })).toBe(true);
  expect(hasOutboundProxy({ NO_PROXY: "localhost" })).toBe(false);
  expect(hasOutboundProxy({})).toBe(false);
});

test("proxy resolution falls back from HTTPS_PROXY to HTTP_PROXY and rejects partial SOCKS support", () => {
  expect(resolveOutboundProxy({ HTTP_PROXY: "http://127.0.0.1:7890" })).toEqual({
    httpProxy: "http://127.0.0.1:7890",
    httpsProxy: "http://127.0.0.1:7890",
  });
  expect(
    resolveOutboundProxy({
      HTTP_PROXY: "http://http-proxy.invalid:8080",
      HTTPS_PROXY: "http://https-proxy.invalid:8443",
    }),
  ).toEqual({
    httpProxy: "http://http-proxy.invalid:8080",
    httpsProxy: "http://https-proxy.invalid:8443",
  });
  expect(
    resolveOutboundProxy({
      HTTP_PROXY: "http://explicit-proxy.invalid:8080",
      ALL_PROXY: "socks5://ambient-proxy.invalid:1080",
    }),
  ).toEqual({
    httpProxy: "http://explicit-proxy.invalid:8080",
    httpsProxy: "http://explicit-proxy.invalid:8080",
  });
  expect(() => resolveOutboundProxy({ ALL_PROXY: "socks5://127.0.0.1:7890" })).toThrow(
    /http or https scheme/,
  );
});

test("proxy environment forwards only standard proxy variables", () => {
  expect(
    proxyEnvironment({
      HTTPS_PROXY: " http://proxy.invalid:7890 ",
      no_proxy: "localhost",
      CURSOR_API_KEY: "must-not-forward-here",
      UNRELATED_SECRET: "must-not-forward-here",
    }),
  ).toEqual({
    HTTPS_PROXY: "http://proxy.invalid:7890",
    no_proxy: "localhost",
  });
});

test("HTTP_PROXY-only installs both Agent and fetch proxy data planes", async () => {
  let proxyHits = 0;
  const proxy = createServer((_, res) => {
    proxyHits += 1;
    res.end("proxied");
  });
  const proxyPort = await listen(proxy);
  try {
    const status = configureSdkOutboundProxy({ HTTP_PROXY: `http://127.0.0.1:${proxyPort}` });
    expect(status).toEqual({
      configured: true,
      agentTransport: "http1-proxy",
      fetchTransport: "undici-proxy",
    });
    expect(http.globalAgent).not.toBe(originalHttpAgent);
    expect(https.globalAgent).not.toBe(originalHttpsAgent);
    expect(getGlobalDispatcher()).toBeInstanceOf(EnvHttpProxyAgent);
    const response = await fetch("http://cursor-sdk2api.invalid/probe");
    expect(await response.text()).toBe("proxied");
    expect(proxyHits).toBe(1);
  } finally {
    await close(proxy);
  }
});

test("NO_PROXY bypasses the fetch proxy for loopback", async () => {
  let proxyHits = 0;
  const proxy = createServer((_, res) => {
    proxyHits += 1;
    res.statusCode = 502;
    res.end("wrong-path");
  });
  const target = createServer((_, res) => res.end("direct"));
  const [proxyPort, targetPort] = await Promise.all([listen(proxy), listen(target)]);
  try {
    configureSdkOutboundProxy({
      HTTP_PROXY: `http://127.0.0.1:${proxyPort}`,
      NO_PROXY: "127.0.0.1,localhost",
    });
    const response = await fetch(`http://127.0.0.1:${targetPort}/health`);
    expect(await response.text()).toBe("direct");
    expect(proxyHits).toBe(0);
  } finally {
    await Promise.all([close(proxy), close(target)]);
  }
});

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return address.port;
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
