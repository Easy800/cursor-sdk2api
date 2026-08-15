import type { Clock } from "../clock.js";
import type { SdkModel, SdkRuntime } from "./port.js";

interface CacheEntry {
  fetchedAt: number;
  models: SdkModel[];
}

export class ModelCatalog {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly sdk: SdkRuntime,
    private readonly clock: Clock,
    private readonly ttlMs: number,
  ) {}

  async list(apiKey: string, fingerprint: string): Promise<{
    status: "ok" | "unavailable" | "stale";
    reason?: string;
    models: SdkModel[];
    stale: boolean;
  }> {
    const cached = this.cache.get(fingerprint);
    const now = this.clock.now();
    if (cached && now - cached.fetchedAt < this.ttlMs) {
      return { status: "ok", models: cached.models, stale: false };
    }

    const live = await this.sdk.listModels(apiKey);
    if (live.ok) {
      this.cache.set(fingerprint, { fetchedAt: now, models: live.models });
      return { status: "ok", models: live.models, stale: false };
    }
    if (cached) {
      return {
        status: "stale",
        reason: live.reason,
        models: cached.models,
        stale: true,
      };
    }
    return { status: "unavailable", reason: live.reason, models: [], stale: false };
  }
}
