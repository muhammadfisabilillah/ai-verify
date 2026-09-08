import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { AnalysisOutput } from "../core/orchestrator.js";
import type { Verdict } from "../core/types/index.js";

// One compact line per run: enough to learn from (what changed, how risky,
// what the verdict was), never file contents. The user's repo is untouched —
// history lives in the local cache, outside the analyzed project.
export interface HistoryEntry {
  v: 1;
  at: string;
  aiVerify: string;
  repo: string;
  files: number;
  additions: number;
  deletions: number;
  riskScore: number;
  riskLevel: string;
  verdict: Verdict;
  checks: Array<{ id: string; status: string; findings: number }>;
  findings: number;
  durationMs: number;
}

export function buildHistoryEntry(
  output: AnalysisOutput,
  verdict: Verdict,
  version: string,
  repo: string,
): HistoryEntry {
  return {
    v: 1,
    at: new Date().toISOString(),
    aiVerify: version,
    repo,
    files: output.changeSet.files.length,
    additions: output.changeSet.totalAdditions,
    deletions: output.changeSet.totalDeletions,
    riskScore: output.risk.score,
    riskLevel: output.risk.level,
    verdict,
    checks: output.verification.checks.map((check) => ({
      id: check.id,
      status: check.status,
      findings: check.findings.length,
    })),
    findings: output.verification.findings.length,
    durationMs: output.verification.durationMs,
  };
}

export function defaultHistoryFile(): string {
  const explicit = process.env["AI_VERIFY_HISTORY_FILE"];
  if (explicit !== undefined && explicit !== "") {
    return explicit;
  }

  const cache =
    process.env["XDG_CACHE_HOME"] ?? path.join(homedir(), ".cache");

  return path.join(cache, "ai-verify", "runs.jsonl");
}

// Recording must never break a run: unwritable cache, full disk,
// read-only home — all swallowed, the verdict already stands.
export async function appendHistory(
  entry: HistoryEntry,
  file: string = defaultHistoryFile(),
): Promise<void> {
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // History is a learning aid, not part of the verdict.
  }
}
