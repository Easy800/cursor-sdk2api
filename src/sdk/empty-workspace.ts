import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensurePrivateDir } from "../core/lineage-store.js";

export function ensureEmptyWorkspace(instanceId: string, configured?: string): string {
  const dir = configured?.trim() || join(tmpdir(), "cursor-sdk2api", instanceId, "empty-workspace");
  ensurePrivateDir(dir);
  return dir;
}
