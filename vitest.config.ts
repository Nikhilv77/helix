import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // The `.spec.` files use Jest-style globals rather than importing from
    // vitest. Explicit imports keep working, so this only widens what resolves.
    globals: true,
    // Both suffixes, deliberately. The repo uses `.test.` and `.spec.`
    // interchangeably; matching only one silently excluded 72 files.
    include: ["src/**/*.{test,spec}.{ts,tsx}"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
