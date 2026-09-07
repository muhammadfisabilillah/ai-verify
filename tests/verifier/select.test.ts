import { describe, expect, it } from "vitest";

import type { ChangeSet } from "../../src/core/types/index.js";
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

describe("selectVerifiers", () => {
  it("selects typecheck when TypeScript files changed", () => {
    const verifiers = selectVerifiers(
      changeSet([{ path: "src/app.ts", language: "typescript" }]),
    );

    expect(verifiers.map((v) => v.id)).toEqual(["typecheck"]);
  });

  it("selects typecheck by extension even without language label", () => {
    const verifiers = selectVerifiers(changeSet([{ path: "src/app.tsx" }]));

    expect(verifiers.map((v) => v.id)).toEqual(["typecheck"]);
  });

  it("selects nothing for docs-only changes", () => {
    expect(selectVerifiers(changeSet([{ path: "README.md" }]))).toEqual([]);
    expect(selectVerifiers({ files: [], totalAdditions: 0, totalDeletions: 0 })).toEqual([]);
  });

  it("selects typecheck for mixed changes", () => {
    const verifiers = selectVerifiers(
      changeSet([{ path: "README.md" }, { path: "main.py", language: "python" }]),
    );

    // Python has no verifier yet: honest empty selection, not a forced check.
    expect(verifiers).toEqual([]);
  });
});
