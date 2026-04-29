import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/.worktrees/**"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/migrations/**",
        "**/e2e/**",
        "**/scripts/**",
      ],
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
