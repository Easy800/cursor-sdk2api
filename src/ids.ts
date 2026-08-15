import { randomUUID } from "node:crypto";

export function requestId(): string {
  return `req_${randomUUID()}`;
}

export function messageId(): string {
  return `msg_${randomUUID()}`;
}

export function sessionId(): string {
  return `ses_${randomUUID()}`;
}

export function toolUseId(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit;
  return `toolu_${randomUUID()}`;
}

export function instanceId(configured?: string): string {
  return configured && configured.trim() ? configured.trim() : `inst_${randomUUID()}`;
}
