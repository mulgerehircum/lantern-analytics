import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping — tsc resolves it
// natively, but Vitest's own module resolution needs it spelled out
// separately, or any test importing a file that imports via "@/..." fails.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
