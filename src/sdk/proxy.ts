import http from "node:http";
import https from "node:https";
import { configureCursorSdk } from "@cursor/sdk";
import { ProxyAgent } from "proxy-agent";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

export const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
] as const;

const ROUTING_PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
] as const;

export interface ProxyRuntimeStatus {
  configured: boolean;
  agentTransport: "http1-proxy" | "http2-direct";
  fetchTransport: "undici-proxy" | "fetch-direct";
}

export interface ResolvedProxy {
  httpProxy: string;
  httpsProxy: string;
  noProxy?: string;
}

export function proxyEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of PROXY_ENV_KEYS) {
    const value = source[key]?.trim();
    if (value) result[key] = value;
  }
  return result;
}

export function hasOutboundProxy(source: NodeJS.ProcessEnv = process.env): boolean {
  return ROUTING_PROXY_ENV_KEYS.some((key) => Boolean(source[key]?.trim()));
}

export function resolveOutboundProxy(
  source: NodeJS.ProcessEnv = process.env,
): ResolvedProxy | undefined {
  const allProxy = source.ALL_PROXY?.trim() || source.all_proxy?.trim();
  const explicitHttp = source.HTTP_PROXY?.trim() || source.http_proxy?.trim();
  const explicitHttps = source.HTTPS_PROXY?.trim() || source.https_proxy?.trim();
  // Protocol-specific settings win. If only one explicit HTTP(S) proxy is
  // configured, use it for both Cursor HTTPS data planes before considering an
  // unrelated ambient ALL_PROXY (commonly a SOCKS desktop setting).
  const httpProxy = explicitHttp || explicitHttps || allProxy;
  const httpsProxy = explicitHttps || explicitHttp || allProxy;
  if (!httpProxy || !httpsProxy) return undefined;
  for (const raw of new Set([httpProxy, httpsProxy])) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("Outbound proxy must be a valid HTTP or HTTPS URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Outbound proxy must use the http or https scheme");
    }
  }
  return {
    httpProxy,
    httpsProxy,
    noProxy: source.NO_PROXY?.trim() || source.no_proxy?.trim() || undefined,
  };
}

/**
 * The official SDK uses Node's http/https clients and defaults local Agent runs
 * to HTTP/2. Node does not route either transport through HTTP_PROXY by itself.
 * When a proxy is configured, switch the SDK to HTTP/1.1 and install a standard
 * env-aware Agent that honors HTTP(S)_PROXY, ALL_PROXY, and NO_PROXY.
 */
export function configureSdkOutboundProxy(
  source: NodeJS.ProcessEnv = process.env,
): ProxyRuntimeStatus {
  const proxy = resolveOutboundProxy(source);
  if (!proxy) {
    return {
      configured: false,
      agentTransport: "http2-direct",
      fetchTransport: "fetch-direct",
    };
  }

  // proxy-agent follows process env per destination. Normalize an HTTP_PROXY-
  // only configuration so Cursor's HTTPS Agent endpoints use the same proxy.
  process.env.HTTP_PROXY = proxy.httpProxy;
  process.env.http_proxy = proxy.httpProxy;
  process.env.HTTPS_PROXY = proxy.httpsProxy;
  process.env.https_proxy = proxy.httpsProxy;
  if (proxy.noProxy) {
    process.env.NO_PROXY = proxy.noProxy;
    process.env.no_proxy = proxy.noProxy;
  }
  http.globalAgent = new ProxyAgent();
  https.globalAgent = new ProxyAgent();
  setGlobalDispatcher(
    new EnvHttpProxyAgent({
      httpProxy: proxy.httpProxy,
      httpsProxy: proxy.httpsProxy,
      noProxy: proxy.noProxy,
    }),
  );
  configureCursorSdk({ local: { useHttp1ForAgent: true } });
  return {
    configured: true,
    agentTransport: "http1-proxy",
    fetchTransport: "undici-proxy",
  };
}
