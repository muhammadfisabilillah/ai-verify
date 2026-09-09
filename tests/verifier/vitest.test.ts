import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { ChangeSet, FileChange } from "../../src/core/types/index.js";
import { VitestVerifier } from "../../src/verifier/vitest.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const passDir = path.resolve(testDir, "../fixtures/vitest-pass");
const failDir = path.resolve(testDir, "../fixtures/vitest-fail");

// Full coverage needs `vitest` resolvable from the target repository.
// Without it, only the tool-independent paths run —
// the verifier itself still skips honestly instead of failing.
let HAS_VITEST = false;
try {
  execFileSync("npx", ["--no-install", "vitest", "--version"], {
    cwd: repoRoot,
    stdio: "ignore",
  });
  HAS_VITEST = true;
} catch {
  HAS_VITEST = false;
}

function jsFile(filePath: string): FileChange {
  return {
    path: filePath,
    changeType: "modified",
    additions: 1,
    deletions: 0,
    source: "unknown",
    language: "typescript",
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

function cleanVitestCache(dir: string): void {
  rmSync(path.join(dir, "node_modules", ".vite"), {
    recursive: true,
    force: true,
  });
}

const tempDirs: string[] = [];

afterEach(() => {
  cleanVitestCache(passDir);
  cleanVitestCache(failDir);
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("VitestVerifier", () => {
  it("skips when no JavaScript/TypeScript files changed", async () => {
    const verifier = new VitestVerifier();
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

  it("skips deleted files with nothing left to test", async () => {
    const verifier = new VitestVerifier();
    const check = await verifier.run(
      changeSet(
        [
          {
            path: "removed.test.ts",
            changeType: "deleted",
            additions: 0,
            deletions: 5,
            source: "unknown",
            language: "typescript",
          },
        ],
        passDir,
      ),
    );

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
  });

  it("skips when changes hold no test files", async () => {
    const verifier = new VitestVerifier();
    const check = await verifier.run(
      changeSet([jsFile("src/app.ts")], passDir),
    );

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
    expect(check.reason).toMatch(/no test files/i);
  });

  it.runIf(HAS_VITEST)(
    "passes on a clean test file",
    async () => {
      const verifier = new VitestVerifier();
      const check = await verifier.run(
        changeSet([jsFile("ok.test.ts")], passDir),
      );

      expect(check.status).toBe("passed");
      expect(check.findings).toEqual([]);
    },
    120_000,
  );

  it.runIf(HAS_VITEST)(
    "fails with parsed findings on test failures",
    async () => {
      const verifier = new VitestVerifier();
      const check = await verifier.run(
        changeSet([jsFile("bad.test.ts")], failDir),
      );

      expect(check.status).toBe("failed");
      expect(check.findings).toHaveLength(1);
      expect(check.findings).toContainEqual(
        expect.objectContaining({
          source: "test",
          severity: "medium",
          category: "test",
          ruleId: "test-failure",
          file: "bad.test.ts",
        }),
      );
    },
    120_000,
  );

  it("errors when the repository path is unusable", async () => {
    const verifier = new VitestVerifier();
    const check = await verifier.run(
      changeSet([jsFile("x.test.ts")], "/tmp/ai-verify-does-not-exist-xyz"),
    );

    expect(check.status).toBe("error");
    expect(check.reason).toMatch(/cannot access/i);
  });

  it.runIf(!HAS_VITEST)(
    "skips when vitest is not available in the repository",
    async () => {
      const bare = mkdtempSync(path.join(tmpdir(), "ai-verify-no-vitest-"));
      tempDirs.push(bare);

      const verifier = new VitestVerifier();
      const check = await verifier.run(
        changeSet([jsFile("app.test.ts")], bare),
      );

      expect(check.status).toBe("skipped");
      expect(check.findings).toEqual([]);
      expect(check.reason).toMatch(/not available/i);
    },
    60_000,
  );
});
