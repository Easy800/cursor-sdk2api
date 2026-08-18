import type { AssistantTurn } from "./types.js";

export function encodeMessage(turn: AssistantTurn, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: turn.messageId,
    type: "message",
    role: "assistant",
    model: turn.model,
    content: turn.blocks.map((block) => block.type === "tool_use"
      ? { type: block.type, id: block.id, name: block.name, input: block.input }
      : block),
    stop_reason: turn.stopReason,
    stop_sequence: null,
    usage: encodeUsage(turn),
    cursor_session_id: turn.sessionId,
    ...(turn.usage.usage_deferred ? { usage_deferred: true } : {}),
    ...(turn.usage.usage_status ? { usage_status: turn.usage.usage_status } : {}),
    ...extra,
  };
}

export function encodeUsage(turn: AssistantTurn): Record<string, unknown> {
  const usage: Record<string, unknown> = {
    input_tokens: turn.usage.input_tokens,
    output_tokens: turn.usage.output_tokens,
  };
  if (typeof turn.usage.cache_creation_input_tokens === "number") {
    usage.cache_creation_input_tokens = turn.usage.cache_creation_input_tokens;
  }
  if (typeof turn.usage.cache_read_input_tokens === "number") {
    usage.cache_read_input_tokens = turn.usage.cache_read_input_tokens;
  }
  return usage;
}
