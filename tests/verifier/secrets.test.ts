import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ChangeSet, FileChange } from "../../src/core/types/index.js";
import { SecretsVerifier } from "../../src/verifier/secrets.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-secrets-"));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

function fileEntry(filePath: string): FileChange {
  return {
    path: filePath,
    changeType: "modified",
    additions: 1,
    deletions: 0,
    source: "unknown",
  };
}

function context(
  repo: string,
  files: FileChange[],
): { repositoryPath: string; changeSet: ChangeSet } {
  return {
    repositoryPath: repo,
    changeSet: {
      files,
      totalAdditions: files.length,
      totalDeletions: 0,
    },
  };
}

describe("SecretsVerifier", () => {
  it("skips when no files changed", async () => {
    const repo = makeRepo({});
    const check = await new SecretsVerifier().run(context(repo, []));

    expect(check.status).toBe("skipped");
    expect(check.findings).toEqual([]);
  });

  it("skips deleted files with nothing left to scan", async () => {
    const repo = makeRepo({});
    const check = await new SecretsVerifier().run(
      context(repo, [
        {
          path: "removed.ts",
          changeType: "deleted",
          additions: 0,
          deletions: 5,
          source: "unknown",
        },
      ]),
    );

    expect(check.status).toBe("skipped");
  });

  it("passes on clean files", async () => {
    const repo = makeRepo({ "app.ts": "export const a = 1;\n" });
    const check = await new SecretsVerifier().run(
      context(repo, [fileEntry("app.ts")]),
    );

    expect(check.status).toBe("passed");
    expect(check.findings).toEqual([]);
  });

  it("fails with a critical finding on an AWS key without leaking it", async () => {
    const key = "AKIAIOSFODNN7EXAMPLE";
    const repo = makeRepo({ "deploy.ts": `const k = "${key}";\n` });
    const check = await new SecretsVerifier().run(
      context(repo, [fileEntry("deploy.ts")]),
    );

    expect(check.status).toBe("failed");
    expect(check.findings).toHaveLength(1);
    expect(check.findings[0]).toMatchObject({
      severity: "critical",
      category: "security",
      source: "secret",
      file: "deploy.ts",
      line: 1,
      ruleId: "secret-aws-access-key",
    });
    expect(JSON.stringify(check.findings)).not.toContain(key);
  });

  it("flags private key blocks and generic assignments", async () => {
    const repo = makeRepo({
      "key.pem": "-----BEGIN RSA PRIVATE KEY-----\nabc\n",
      "config.js": 'password = "hunter2-hunter"\n',
    });
    const check = await new SecretsVerifier().run(
      context(repo, [fileEntry("key.pem"), fileEntry("config.js")]),
    );

    expect(check.status).toBe("failed");
    expect(check.findings.map((f) => f.ruleId).sort()).toEqual(
      expect.arrayContaining([
        "secret-generic-assignment",
        "secret-private-key",
      ]),
    );
  });

  it("errors when the repository path is unusable", async () => {
    const check = await new SecretsVerifier().run(
      context("/tmp/ai-verify-does-not-exist-xyz", [fileEntry("a.ts")]),
    );

    expect(check.status).toBe("error");
    expect(check.reason).toMatch(/cannot access/i);
  });
});
