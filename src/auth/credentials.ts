import type { IncomingMessage } from "node:http";
import { authenticationError } from "../errors.js";
import { credentialFingerprint } from "../digest.js";
import type { GatewayConfig } from "../config.js";
import { headerValue } from "../server/http-util.js";

export interface AuthContext {
  mode: "byok" | "managed";
  cursorApiKey: string;
  fingerprint: string;
}

export function authenticate(req: IncomingMessage, config: GatewayConfig): AuthContext {
  const presented = presentedSecret(req);
  if (!presented) {
    throw authenticationError("Provide Authorization: Bearer or x-api-key");
  }

  if (config.authMode === "managed") {
    if (!config.gatewayAccessKey || !config.managedCursorKey) {
      throw authenticationError("Managed auth is not configured");
    }
    if (presented !== config.gatewayAccessKey) {
      throw authenticationError("Invalid gateway access key");
    }
    return {
      mode: "managed",
      cursorApiKey: config.managedCursorKey,
      fingerprint: credentialFingerprint(presented),
    };
  }

  return {
    mode: "byok",
    cursorApiKey: presented,
    fingerprint: credentialFingerprint(presented),
  };
}

function presentedSecret(req: IncomingMessage): string | undefined {
  const apiKey = headerValue(req, "x-api-key");
  if (apiKey) return apiKey.trim();
  const authorization = headerValue(req, "authorization");
  if (!authorization) return undefined;
  const match = /^Bearer\s+(\S+)/i.exec(authorization);
  return match?.[1];
}
