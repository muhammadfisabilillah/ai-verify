import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { ChangeSet, FileChange } from "../../src/core/types/index.js";
import { PytestVerifier } from "../../src/verifier/pytest.js";

let HAS_PYTEST = false;
try {
  execFileSync("python3", ["-m", "pytest", "--version"], { stdio: "ignore" });
  HAS_PYTEST = true;
} catch {
  HAS_PYTEST = false;
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
const passDir = path.resolve(testDir, "../fixtures/pytest-pass");
const failDir = path.resolve(testDir, "../fixtures/pytest-fail");

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("PytestVerifier", () => {
  it("skips when no Python files changed", async () => {
    const verifier = new PytestVerifier();
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

  it("skips when no test files in changes", async () => {
    const verifier = new PytestVerifier();
    const check = await verifier.run(
      changeSet([pyFile("calculator.py")], passDir),
    );

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
    expect(check.reason).toMatch(/no test files/i);
  });

  it("skips deleted test files with nothing left", async () => {
    const verifier = new PytestVerifier();
    const check = await verifier.run(
      changeSet(
        [
          {
            path: "test_old.py",
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

  it.runIf(HAS_PYTEST)(
    "passes on clean Python tests",
    async () => {
      const verifier = new PytestVerifier();
      const check = await verifier.run(
        changeSet([pyFile("test_calculator.py")], passDir),
      );

      expect(check.status).toBe("passed");
      expect(check.findings).toEqual([]);
    },
    120_000,
  );

  it.runIf(HAS_PYTEST)(
    "fails with parsed findings on test failures",
    async () => {
      const verifier = new PytestVerifier();
      const check = await verifier.run(
        changeSet([pyFile("test_calculator.py")], failDir),
      );

      expect(check.status).toBe("failed");
      expect(check.findings.length).toBeGreaterThan(0);
      expect(check.findings[0]).toMatchObject({
        source: "test",
        severity: "medium",
        category: "test",
        ruleId: "test-failure",
      });
      expect(check.findings[0]?.title).toMatch(/test_add_fail/);
    },
    120_000,
  );

  it("errors when the repository path is unusable", async () => {
    const verifier = new PytestVerifier();
    const check = await verifier.run(
      changeSet([pyFile("test_x.py")], "/tmp/ai-verify-does-not-exist-xyz"),
    );

    expect(check.status).toBe("error");
    expect(check.reason).toMatch(/cannot access/i);
  });

  it.runIf(!HAS_PYTEST)(
    "skips when pytest is not available in the environment",
    async () => {
      const bare = mkdtempSync(path.join(tmpdir(), "ai-verify-no-pytest-"));
      tempDirs.push(bare);

      const verifier = new PytestVerifier();
      const check = await verifier.run(
        changeSet([pyFile("test_app.py")], bare),
      );

      expect(check.status).toBe("skipped");
      expect(check.findings).toEqual([]);
      expect(check.reason).toMatch(/not available/i);
    },
    60_000,
  );
});
