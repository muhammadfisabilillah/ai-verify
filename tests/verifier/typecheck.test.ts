import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { ChangeSet, FileChange } from "../../src/core/types/index.js";
import { TypeCheckVerifier } from "../../src/verifier/typecheck.js";

function tsFile(filePath: string): FileChange {
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

const testDir = path.dirname(fileURLToPath(import.meta.url));
const passDir = path.resolve(testDir, "../fixtures/ts-pass");
const failDir = path.resolve(testDir, "../fixtures/ts-fail");

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("TypeCheckVerifier", () => {
  it("skips when no TypeScript files changed", async () => {
    const verifier = new TypeCheckVerifier();
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
    expect(check.reason).toMatch(/no typescript/i);
  });

  it("passes on a clean TypeScript project", async () => {
    const verifier = new TypeCheckVerifier();
    const check = await verifier.run(changeSet([tsFile("ok.ts")], passDir));

    expect(check.status).toBe("passed");
    expect(check.findings).toEqual([]);
  }, 30_000);

  it("fails with parsed findings on type errors", async () => {
    const verifier = new TypeCheckVerifier();
    const check = await verifier.run(changeSet([tsFile("bad.ts")], failDir));

    expect(check.status).toBe("failed");
    expect(check.findings.length).toBeGreaterThan(0);
    expect(check.findings[0]).toMatchObject({
      source: "typecheck",
      severity: "high",
      category: "reliability",
      ruleId: "TS2322",
      line: 1,
    });
    expect(check.findings[0]?.file).toContain("bad.ts");
  }, 30_000);

  it("errors when the repository path is unusable", async () => {
    const verifier = new TypeCheckVerifier();
    const check = await verifier.run(
      changeSet([tsFile("x.ts")], "/tmp/ai-verify-does-not-exist-xyz"),
    );

    expect(check.status).toBe("error");
    expect(check.reason).toMatch(/cannot access/i);
  });

  it("skips when tsc is not available in the target repository", async () => {
    // A bare temp dir outside this repo tree has no local typescript,
    // so `npx --no-install tsc` must fail without touching the network.
    const bare = mkdtempSync(path.join(tmpdir(), "ai-verify-no-tsc-"));
    tempDirs.push(bare);

    const verifier = new TypeCheckVerifier();
    const check = await verifier.run(changeSet([tsFile("app.ts")], bare));

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
    expect(check.reason).toMatch(/not available/i);
  }, 30_000);
});
