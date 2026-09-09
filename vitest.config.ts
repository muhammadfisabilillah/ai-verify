import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Intentionally-failing fixtures for VitestVerifier mirror real target
    // repositories and must never run as part of this repo's own suite.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "tests/fixtures/**",
    ],
  },
});
