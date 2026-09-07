import { describe, expect, it } from "vitest";

import { detectLanguage } from "../../src/analyzer/language.js";

describe("detectLanguage", () => {
  it("detects TypeScript", () => {
    expect(detectLanguage("src/index.ts")).toBe("typescript");
  });

  it("detects Python", () => {
    expect(detectLanguage("app/main.py")).toBe("python");
  });

  it("returns undefined for unknown extensions", () => {
    expect(detectLanguage("README.md")).toBeUndefined();
  });
});
