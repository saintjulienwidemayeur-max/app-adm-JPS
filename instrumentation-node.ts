// Node-only part of instrumentation.ts (the database driver can't be bundled for the edge runtime).
import { initStore } from "./lib/persist";

export async function start() {
  await initStore();
}
