import { afterEach, describe, expect, it, vi } from "vitest";

import type { VerificationResult } from "../../src/core/types/index.js";
import { hasFailed, printVerificationReport } from "../../src/cli/report.js";

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
    expect(lines).toContain("Result: PASS");
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

describe("hasFailed", () => {
  function resultWith(status: "passed" | "failed" | "skipped" | "error"): VerificationResult {
    return {
      checks: [
        { id: "c", name: "C", status, durationMs: 0, findings: [] },
      ],
      findings: [],
      risk: { score: 0, level: "none", factors: [] },
      durationMs: 0,
    };
  }

  it.each(["failed", "error"] as const)("is true when a check %s", (status) => {
    expect(hasFailed(resultWith(status))).toBe(true);
  });

  it.each(["passed", "skipped"] as const)("is false when a check %s", (status) => {
    expect(hasFailed(resultWith(status))).toBe(false);
  });

  it("is false when no checks ran", () => {
    expect(
      hasFailed({ checks: [], findings: [], risk: { score: 0, level: "none", factors: [] }, durationMs: 0 }),
    ).toBe(false);
  });
});
