import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { ChangeSet, FileChange } from "../../src/core/types/index.js";
import { RuffVerifier } from "../../src/verifier/ruff.js";

// Full coverage needs `ruff` on PATH (https://astral.sh/ruff).
// Without it, only the tool-independent paths run —
// the verifier itself still skips honestly instead of failing.
let HAS_RUFF = false;
try {
  execFileSync("ruff", ["--version"], { stdio: "ignore" });
  HAS_RUFF = true;
} catch {
  HAS_RUFF = false;
}

function pyFile(filePath: string): FileChange {
  return {
    path: filePath,
    changeType: "modified",
    additions: 1,
    deletions: 0,
    source: "unknown",
    language: "python",
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
const passDir = path.resolve(testDir, "../fixtures/ruff-pass");
const failDir = path.resolve(testDir, "../fixtures/ruff-fail");

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("RuffVerifier", () => {
  it("skips when no Python files changed", async () => {
    const verifier = new RuffVerifier();
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
    expect(check.reason).toMatch(/no python/i);
  });

  it("skips deleted files with nothing left to lint", async () => {
    const verifier = new RuffVerifier();
    const check = await verifier.run(
      changeSet(
        [
          {
            path: "removed.py",
            changeType: "deleted",
            additions: 0,
            deletions: 5,
            source: "unknown",
            language: "python",
          },
        ],
        passDir,
      ),
    );

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
  });

  it.runIf(HAS_RUFF)(
    "passes on a clean Python file",
    async () => {
      const verifier = new RuffVerifier();
      const check = await verifier.run(changeSet([pyFile("ok.py")], passDir));

      expect(check.status).toBe("passed");
      expect(check.findings).toEqual([]);
    },
    60_000,
  );

  it.runIf(HAS_RUFF)(
    "fails with parsed findings on lint errors",
    async () => {
      const verifier = new RuffVerifier();
      const check = await verifier.run(changeSet([pyFile("bad.py")], failDir));

      expect(check.status).toBe("failed");
      expect(check.findings).toHaveLength(2);
      expect(check.findings).toContainEqual(
        expect.objectContaining({
          source: "lint",
          severity: "medium",
          category: "quality",
          ruleId: "F401",
          file: "bad.py",
          line: 1,
        }),
      );
      expect(check.findings).toContainEqual(
        expect.objectContaining({
          source: "lint",
          severity: "medium",
          category: "quality",
          ruleId: "F821",
          file: "bad.py",
          line: 4,
        }),
      );
    },
    60_000,
  );

  it("errors when the repository path is unusable", async () => {
    const verifier = new RuffVerifier();
    const check = await verifier.run(
      changeSet([pyFile("x.py")], "/tmp/ai-verify-does-not-exist-xyz"),
    );

    expect(check.status).toBe("error");
    expect(check.reason).toMatch(/cannot access/i);
  });

  it.runIf(!HAS_RUFF)(
    "skips when ruff is not available in the environment",
    async () => {
      const bare = mkdtempSync(path.join(tmpdir(), "ai-verify-no-ruff-"));
      tempDirs.push(bare);

      const verifier = new RuffVerifier();
      const check = await verifier.run(changeSet([pyFile("app.py")], bare));

      expect(check.status).toBe("skipped");
      expect(check.findings).toEqual([]);
      expect(check.reason).toMatch(/not available/i);
    },
    60_000,
  );
});
