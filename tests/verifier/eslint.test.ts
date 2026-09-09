import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { ChangeSet, FileChange } from "../../src/core/types/index.js";
import { EslintVerifier } from "../../src/verifier/eslint.js";

function jsFile(filePath: string): FileChange {
  return {
    path: filePath,
    changeType: "modified",
    additions: 1,
    deletions: 0,
    source: "unknown",
    language: "javascript",
  };
}

function changeSet(
  files: FileChange[],
  repo: string,
): { repositoryPath: string; changeSet: ChangeSet } {
  return {
    repositoryPath: repo,
    changeSet: {
      files,
      totalAdditions: files.reduce((t, f) => t + f.additions, 0),
      totalDeletions: 0,
    },
  };
}

const testDir = path.dirname(fileURLToPath(import.meta.url));
const passDir = path.resolve(testDir, "../fixtures/eslint-pass");
const failDir = path.resolve(testDir, "../fixtures/eslint-fail");
const noConfigDir = path.resolve(testDir, "../fixtures/eslint-noconfig");

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("EslintVerifier", () => {
  it("skips when no JavaScript/TypeScript files changed", async () => {
    const verifier = new EslintVerifier();
    const check = await verifier.run(
      changeSet(
        [
          {
            path: "README.md",
            changeType: "modified",
            additions: 2,
            deletions: 0,
            source: "unknown",
          },
        ],
        passDir,
      ),
    );

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
    expect(check.reason).toMatch(/no javascript/i);
  });

  it("skips deleted files with nothing left to lint", async () => {
    const verifier = new EslintVerifier();
    const check = await verifier.run(
      changeSet(
        [
          {
            path: "removed.js",
            changeType: "deleted",
            additions: 0,
            deletions: 5,
            source: "unknown",
            language: "javascript",
          },
        ],
        passDir,
      ),
    );

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
  });

  it(
    "passes on a clean JavaScript project",
    async () => {
      const verifier = new EslintVerifier();
      const check = await verifier.run(changeSet([jsFile("ok.js")], passDir));

      expect(check.status).toBe("passed");
      expect(check.findings).toEqual([]);
    },
    60_000,
  );

  it(
    "fails with parsed findings on lint errors",
    async () => {
      const verifier = new EslintVerifier();
      const check = await verifier.run(changeSet([jsFile("bad.js")], failDir));

      expect(check.status).toBe("failed");
      expect(check.findings).toHaveLength(2);
      expect(check.findings).toContainEqual(
        expect.objectContaining({
          source: "lint",
          severity: "medium",
          category: "quality",
          ruleId: "no-unused-vars",
          file: "bad.js",
          line: 1,
        }),
      );
      expect(check.findings).toContainEqual(
        expect.objectContaining({
          source: "lint",
          severity: "medium",
          category: "quality",
          ruleId: "no-undef",
          file: "bad.js",
          line: 2,
        }),
      );
    },
    60_000,
  );

  it("errors when the repository path is unusable", async () => {
    const verifier = new EslintVerifier();
    const check = await verifier.run(
      changeSet([jsFile("x.js")], "/tmp/ai-verify-does-not-exist-xyz"),
    );

    expect(check.status).toBe("error");
    expect(check.reason).toMatch(/cannot access/i);
  });

  it(
    "skips when eslint is not available in the target repository",
    async () => {
      // A bare temp dir outside this repo tree has no local eslint,
      // so `npx --no-install eslint` must fail without touching the network.
      const bare = mkdtempSync(path.join(tmpdir(), "ai-verify-no-eslint-"));
      tempDirs.push(bare);

      const verifier = new EslintVerifier();
      const check = await verifier.run(changeSet([jsFile("app.js")], bare));

      expect(check.status).toBe("skipped");
      expect(check.findings).toEqual([]);
      expect(check.reason).toMatch(/not available/i);
    },
    60_000,
  );

  it("skips when the repository has no eslint configuration", async () => {
    // Self-contained fixture with no config file and no eslintConfig key,
    // so the check is honestly not applicable instead of an error —
    // independent of whatever config the ai-verify repo itself carries.
    const verifier = new EslintVerifier();
    const check = await verifier.run(changeSet([jsFile("x.js")], noConfigDir));

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
    expect(check.reason).toMatch(/no .* configuration/i);
  });
});
