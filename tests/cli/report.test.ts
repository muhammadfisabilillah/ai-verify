import { afterEach, describe, expect, it, vi } from "vitest";

import type { VerificationResult } from "../../src/core/types/index.js";
import { printVerificationReport } from "../../src/cli/report.js";

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

describe("printVerificationReport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says so honestly when no verifier applies", () => {
    const result: VerificationResult = {
      checks: [],
      findings: [],
      risk: { score: 0, level: "none", factors: [] },
      durationMs: 5,
    };

    const lines = captureOutput(() => printVerificationReport(result));

    expect(lines).toContain("No applicable verifiers for these changes.");
    expect(lines).toContain("Result: PASSED");
  });

  it("shows skip reasons inline", () => {
    const result: VerificationResult = {
      checks: [
        {
          id: "typecheck",
          name: "Type Check",
          status: "skipped",
          durationMs: 1,
          findings: [],
          reason: "TypeScript compiler (tsc) is not available in this repository.",
        },
      ],
      findings: [],
      risk: { score: 0, level: "none", factors: [] },
      durationMs: 5,
    };

    const lines = captureOutput(() => printVerificationReport(result));

    expect(
      lines.some((line) => line.includes("- Type Check — skipped (TypeScript compiler")),
    ).toBe(true);
  });
});
