import { describe, expect, it } from "vitest";

import type { ChangeSet, RiskAssessment } from "../../src/core/types/index.js";
import { selectVerifiers } from "../../src/verifier/select.js";

function changeSet(paths: Array<{ path: string; language?: string }>): ChangeSet {
  const files = paths.map(({ path, language }) => {
    if (language === undefined) {
      return {
        path,
        changeType: "modified" as const,
        additions: 1,
        deletions: 0,
        source: "unknown" as const,
      };
    }

    return {
      path,
      changeType: "modified" as const,
      additions: 1,
      deletions: 0,
      source: "unknown" as const,
      language,
    };
  });

  return { files, totalAdditions: files.length, totalDeletions: 0 };
}

function risk(level: RiskAssessment["level"], score: number): RiskAssessment {
  return { level, score, factors: [] };
}

describe("selectVerifiers", () => {
  it("selects typecheck and lint when TypeScript files changed", () => {
    const verifiers = selectVerifiers(
      changeSet([{ path: "src/app.ts", language: "typescript" }]),
      risk("low", 10),
    );

    expect(verifiers.map((v) => v.id)).toEqual([
      "typecheck",
      "lint",
      "vitest",
      "secrets",
    ]);
  });

  it("selects typecheck and lint by extension even without language label", () => {
    const verifiers = selectVerifiers(
      changeSet([{ path: "src/app.tsx" }]),
      risk("low", 10),
    );

    expect(verifiers.map((v) => v.id)).toEqual([
      "typecheck",
      "lint",
      "vitest",
      "secrets",
    ]);
  });

  it("selects only lint for plain JavaScript", () => {
    const verifiers = selectVerifiers(
      changeSet([{ path: "src/app.js", language: "javascript" }]),
      risk("low", 10),
    );

    expect(verifiers.map((v) => v.id)).toEqual(["lint", "vitest", "secrets"]);
  });

  it("selects secret scan even for docs-only changes", () => {
    expect(
      selectVerifiers(changeSet([{ path: "README.md" }]), risk("none", 0)).map(
        (v) => v.id,
      ),
    ).toEqual(["secrets"]);
    expect(
      selectVerifiers(
        { files: [], totalAdditions: 0, totalDeletions: 0 },
        risk("none", 0),
      ),
    ).toEqual([]);
  });

  it("selects ruff and pytest for python changes", () => {
    const verifiers = selectVerifiers(
      changeSet([{ path: "README.md" }, { path: "main.py", language: "python" }]),
      risk("low", 10),
    );

    expect(verifiers.map((v) => v.id)).toEqual(["ruff", "pytest", "secrets"]);
  });

  it("never drops checks at higher risk (depth only adds)", () => {
    const changes = changeSet([{ path: "src/app.ts", language: "typescript" }]);
    const levels = [
      risk("none", 0),
      risk("low", 10),
      risk("medium", 40),
      risk("high", 70),
      risk("critical", 95),
    ] as const;

    for (const r of levels) {
      expect(selectVerifiers(changes, r).map((v) => v.id)).toEqual([
        "typecheck",
        "lint",
        "vitest",
        "secrets",
      ]);
    }
  });
});
