import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    // Claude Code task worktrees live under .claude/ inside the repo —
    // their copies of the suite must not double-count here.
    exclude: ["**/node_modules/**", "**/.claude/**", "**/.next/**"],
  },
});
