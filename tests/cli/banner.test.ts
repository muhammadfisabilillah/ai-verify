import { afterEach, describe, expect, it, vi } from "vitest";

import { printBanner } from "../../src/cli/report.js";
import { getVersion } from "../../src/cli/version.js";

function captureOutput(fn: () => void): string[] {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.join(" "));
  });

  try {
    fn();
  } finally {
    spy.mockRestore();
  }

  return lines;
}

describe("welcome banner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("greets with name, version, and tagline", () => {
    const lines = captureOutput(() => printBanner("0.1.0"));

    expect(
      lines.some((line) =>
        line.includes("AI Verify v0.1.0 — AI can generate code. AI Verify helps verify it."),
      ),
    ).toBe(true);
  });

  it("shows block-letter art in fancy mode", () => {
    const lines = captureOutput(() => printBanner("0.1.0", true));

    expect(lines.some((line) => line.includes("/_/"))).toBe(true);
    expect(lines).toHaveLength(8);
  });

  it("stays compact outside a terminal", () => {
    const lines = captureOutput(() => printBanner("0.1.0", false));

    expect(lines.some((line) => line.includes("█"))).toBe(false);
    expect(lines).toHaveLength(3);
  });

  it("reads the version from package.json", () => {
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
