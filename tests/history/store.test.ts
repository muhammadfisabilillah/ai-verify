import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisOutput } from "../../src/core/orchestrator.js";
import {
  appendHistory,
  buildHistoryEntry,
  defaultHistoryFile,
  type HistoryEntry,
} from "../../src/history/store.js";

const tempDirs: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function tempFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-history-"));
  tempDirs.push(dir);
  return path.join(dir, "runs.jsonl");
}

const output: AnalysisOutput = {
  changeSet: { files: [], totalAdditions: 0, totalDeletions: 0 },
  risk: { score: 12, level: "low", factors: [] },
  verification: {
    checks: [
      {
        id: "ruff",
        name: "Ruff",
        status: "failed",
        durationMs: 54,
        findings: [
          {
            id: "ruff-1",
            title: "F401: `os` imported but unused",
            description: "Ruff F401 in app.py",
            severity: "medium",
            category: "quality",
            source: "lint",
            file: "app.py",
            ruleId: "F401",
            line: 1,
          },
        ],
      },
    ],
    findings: [
      {
        id: "ruff-1",
        title: "F401: `os` imported but unused",
        description: "Ruff F401 in app.py",
        severity: "medium",
        category: "quality",
        source: "lint",
        file: "app.py",
        ruleId: "F401",
        line: 1,
      },
    ],
    risk: { score: 12, level: "low", factors: [] },
    durationMs: 54,
  },
};

describe("buildHistoryEntry", () => {
  it("summarizes a run without file contents", () => {
    const entry = buildHistoryEntry(output, "REVIEW", "0.1.0", "/repo/demo");

    expect(entry).toMatchObject({
      v: 1,
      aiVerify: "0.1.0",
      repo: "/repo/demo",
      files: 0,
      additions: 0,
      deletions: 0,
      riskScore: 12,
      riskLevel: "low",
      verdict: "REVIEW",
      checks: [{ id: "ruff", status: "failed", findings: 1 }],
      findings: 1,
      durationMs: 54,
    });
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(entry)).not.toContain("imported but unused");
  });
});

describe("defaultHistoryFile", () => {
  it("honors AI_VERIFY_HISTORY_FILE", () => {
    vi.stubEnv("AI_VERIFY_HISTORY_FILE", "/tmp/custom.jsonl");

    expect(defaultHistoryFile()).toBe("/tmp/custom.jsonl");
  });

  it("defaults to the user cache outside analyzed repos", () => {
    vi.stubEnv("AI_VERIFY_HISTORY_FILE", "");

    expect(defaultHistoryFile()).toMatch(/ai-verify[/\\]runs\.jsonl$/);
  });
});

describe("appendHistory", () => {
  it("appends one JSON line per run", async () => {
    const file = tempFile();
    const entry = buildHistoryEntry(output, "REVIEW", "0.1.0", "/repo/demo");

    await appendHistory(entry, file);
    await appendHistory(entry, file);

    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string) as HistoryEntry).toMatchObject({
      verdict: "REVIEW",
    });
  });

  it("never throws on unwritable paths", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-history-dir-"));
    tempDirs.push(dir);

    const entry = buildHistoryEntry(output, "PASS", "0.1.0", "/repo/demo");

    // A directory is not a file: append must fail silently, not break the run.
    await expect(appendHistory(entry, dir)).resolves.toBeUndefined();
  });
});
