import { describe, expect, it } from "vitest";

import type { ChangeSet, FileChange } from "../../src/core/types/index.js";
import { scoreToLevel } from "../../src/risk/levels.js";
import { RiskEngineV01 } from "../../src/risk/risk-engine.js";

function file(
  path: string,
  additions: number,
  deletions = 0,
  language?: string,
): FileChange {
  const change: FileChange = {
    path,
    changeType: "modified",
    additions,
    deletions,
    source: "unknown",
  };

  if (language !== undefined) {
    change.language = language;
  }

  return change;
}

function changeSet(files: FileChange[]): ChangeSet {
  return {
    files,
    totalAdditions: files.reduce((t, f) => t + f.additions, 0),
    totalDeletions: files.reduce((t, f) => t + f.deletions, 0),
  };
}

function factorNames(cs: ChangeSet): string[] {
  return new RiskEngineV01().assess(cs).factors.map((f) => f.name);
}

describe("scoreToLevel", () => {
  it.each([
    [0, "none"],
    [1, "low"],
    [29, "low"],
    [30, "medium"],
    [59, "medium"],
    [60, "high"],
    [89, "high"],
    [90, "critical"],
    [100, "critical"],
  ] as const)("score %i maps to %s", (score, level) => {
    expect(scoreToLevel(score)).toBe(level);
  });
});

describe("RiskEngineV01", () => {
  it("scores empty ChangeSet as none", () => {
    const result = new RiskEngineV01().assess(changeSet([]));

    expect(result).toEqual({ score: 0, level: "none", factors: [] });
  });

  it("scores docs-only change as none", () => {
    const result = new RiskEngineV01().assess(
      changeSet([file("README.md", 5, 2)]),
    );

    expect(result.score).toBe(0);
    expect(result.level).toBe("none");
    expect(result.factors).toEqual([]);
  });

  it("flags authentication change without tests", () => {
    const result = new RiskEngineV01().assess(
      changeSet([file("src/auth/login.ts", 30, 4, "typescript")]),
    );

    expect(
      factorNames(changeSet([file("src/auth/login.ts", 30, 4, "typescript")])),
    ).toContain("Authentication change");
    expect(result.factors).toContainEqual(
      expect.objectContaining({ name: "No related tests", score: 12 }),
    );
    expect(result.score).toBe(42);
    expect(result.level).toBe("medium");
  });

  it("drops no-test factor when tests change together", () => {
    const cs = changeSet([
      file("src/auth/login.ts", 30, 4, "typescript"),
      file("tests/auth.test.ts", 10, 0, "typescript"),
    ]);
    const result = new RiskEngineV01().assess(cs);

    expect(result.score).toBe(30);
    expect(result.level).toBe("medium");
    expect(factorNames(cs)).not.toContain("No related tests");
  });

  it("flags payment and secrets changes", () => {
    const cs = changeSet([
      file("src/payment/checkout.ts", 20, 0, "typescript"),
      file("tests/payment.test.ts", 5, 0, "typescript"),
    ]);

    expect(factorNames(cs)).toContain("Payment change");
    expect(new RiskEngineV01().assess(cs).score).toBe(30);

    const secrets = changeSet([file("deploy/.env.production", 3, 0)]);
    expect(factorNames(secrets)).toContain("Secrets touched");
  });

  it("flags database migration without requiring tests", () => {
    const result = new RiskEngineV01().assess(
      changeSet([file("prisma/migrations/001_init.sql", 50, 0)]),
    );

    expect(result.score).toBe(25);
    expect(result.level).toBe("low");
    expect(
      factorNames(changeSet([file("prisma/migrations/001_init.sql", 50, 0)])),
    ).not.toContain("No related tests");
  });

  it("flags configuration change", () => {
    const result = new RiskEngineV01().assess(
      changeSet([file(".github/workflows/ci.yml", 10, 2)]),
    );

    expect(result.score).toBe(15);
    expect(result.level).toBe("low");
  });

  it("emits one security factor even for multiple matching patterns", () => {
    const cs = changeSet([file("src/security/crypto.ts", 10, 0, "typescript")]);
    const result = new RiskEngineV01().assess(cs);

    expect(
      result.factors.filter((f) => f.name === "Security-sensitive file"),
    ).toHaveLength(1);
    // +20 security, +12 no tests
    expect(result.score).toBe(32);
    expect(result.level).toBe("medium");
  });

  it("tiers change-size risk", () => {
    const medium = new RiskEngineV01().assess(
      changeSet([file("docs/big.md", 250, 0)]),
    );
    expect(medium.factors).toContainEqual(
      expect.objectContaining({ name: "Medium-large change", score: 5 }),
    );
    expect(medium.score).toBe(5);

    const large = new RiskEngineV01().assess(
      changeSet([file("docs/huge.md", 600, 0)]),
    );
    expect(large.factors).toContainEqual(
      expect.objectContaining({ name: "Large change", score: 10 }),
    );
    expect(large.score).toBe(10);
  });

  it("clamps score at 100 for critical changes", () => {
    const result = new RiskEngineV01().assess(
      changeSet([
        file("src/auth/session.ts", 200, 0, "typescript"),
        file("src/payment/stripe.ts", 200, 0, "typescript"),
        file("config/secrets.pem", 5, 0),
        file("prisma/migrations/002.sql", 200, 0),
      ]),
    );

    expect(result.score).toBe(100);
    expect(result.level).toBe("critical");
  });
});
