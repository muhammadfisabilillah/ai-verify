import { describe, expect, it } from "vitest";

import type {
  Finding,
  RiskAssessment,
  VerificationCheck,
  VerificationResult,
} from "../../src/core/types/index.js";
import { deriveVerdict } from "../../src/verifier/verdict.js";

function risk(level: RiskAssessment["level"]): RiskAssessment {
  return { level, score: 0, factors: [] };
}

function check(overrides: Partial<VerificationCheck> = {}): VerificationCheck {
  return {
    id: "c",
    name: "C",
    status: "passed",
    durationMs: 0,
    findings: [],
    ...overrides,
  };
}

function finding(severity: Finding["severity"]): Finding {
  return {
    id: "f1",
    title: "t",
    description: "d",
    severity,
    category: "reliability",
    source: "typecheck",
  };
}

function result(
  overrides: Partial<VerificationResult> = {},
): VerificationResult {
  return {
    checks: [],
    findings: [],
    risk: risk("none"),
    durationMs: 0,
    ...overrides,
  };
}

describe("deriveVerdict", () => {
  it("PASS when nothing changed and nothing ran", () => {
    expect(deriveVerdict(result())).toBe("PASS");
  });

  it("PASS when all applicable checks passed", () => {
    expect(
      deriveVerdict(
        result({ checks: [check({ status: "passed" })], risk: risk("high") }),
      ),
    ).toBe("PASS");
  });

  it("PASS when checks were skipped for low-risk changes", () => {
    expect(
      deriveVerdict(
        result({
          checks: [check({ status: "skipped", reason: "no tool" })],
          risk: risk("low"),
        }),
      ),
    ).toBe("PASS");
  });

  it("BLOCK on error checks", () => {
    expect(
      deriveVerdict(result({ checks: [check({ status: "error" })] })),
    ).toBe("BLOCK");
  });

  it("BLOCK on critical findings", () => {
    expect(
      deriveVerdict(
        result({ findings: [finding("critical")], risk: risk("low") }),
      ),
    ).toBe("BLOCK");
  });

  it("BLOCK on high findings in high-risk changes", () => {
    expect(
      deriveVerdict(
        result({ findings: [finding("high")], risk: risk("high") }),
      ),
    ).toBe("BLOCK");
  });

  it("REVIEW on failed checks", () => {
    expect(
      deriveVerdict(result({ checks: [check({ status: "failed" })] })),
    ).toBe("REVIEW");
  });

  it("REVIEW on high findings in low-risk changes", () => {
    expect(
      deriveVerdict(result({ findings: [finding("high")], risk: risk("low") })),
    ).toBe("REVIEW");
  });

  it("REVIEW on medium findings", () => {
    expect(deriveVerdict(result({ findings: [finding("medium")] }))).toBe(
      "REVIEW",
    );
  });

  it("REVIEW for risky changes with no applicable verifier", () => {
    expect(deriveVerdict(result({ checks: [], risk: risk("high") }))).toBe(
      "REVIEW",
    );
  });

  it("REVIEW when every check was skipped for risky changes", () => {
    expect(
      deriveVerdict(
        result({
          checks: [check({ status: "skipped", reason: "no tool" })],
          risk: risk("medium"),
        }),
      ),
    ).toBe("REVIEW");
  });
});
