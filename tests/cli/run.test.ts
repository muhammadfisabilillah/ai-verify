import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

import { run } from "../../src/cli/index.js";

const execFileAsync = promisify(execFile);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function initRepo(): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-run-"));
  tempDirs.push(dir);
  await git(dir, ["init", "-q"]);
  await git(dir, ["config", "user.email", "test@ai-verify.dev"]);
  await git(dir, ["config", "user.name", "AI Verify Test"]);
  return dir;
}

function silenceOutput(): void {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
}

function isolateHistory(): void {
  const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-run-hist-"));
  tempDirs.push(dir);
  vi.stubEnv("AI_VERIFY_HISTORY_FILE", path.join(dir, "runs.jsonl"));
}

describe("run exit code", () => {
  it("returns 0 when nothing fails", async () => {
    isolateHistory();
    const repo = await initRepo();
    writeFileSync(path.join(repo, "README.md"), "hello\n");
    await git(repo, ["add", "-A"]);
    await git(repo, ["commit", "-qm", "init"]);
    writeFileSync(path.join(repo, "README.md"), "hello\nmore docs\n");
    silenceOutput();

    await expect(run(repo)).resolves.toBe(0);
  });

  it("returns 1 when verification fails", async () => {
    isolateHistory();
    const repo = await initRepo();
    writeFileSync(
      path.join(repo, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, skipLibCheck: true },
        include: ["*.ts"],
      }),
    );
    writeFileSync(path.join(repo, "bad.ts"), "export const x = 1;\n");
    await git(repo, ["add", "-A"]);
    await git(repo, ["commit", "-qm", "init"]);
    // Link this repo's node_modules so the temp repo has a local tsc
    // without touching the network.
    symlinkSync(
      path.join(repoRoot, "node_modules"),
      path.join(repo, "node_modules"),
    );
    writeFileSync(
      path.join(repo, "bad.ts"),
      'export const answer: number = "bukan angka";\n',
    );
    silenceOutput();

    await expect(run(repo)).resolves.toBe(1);
  }, 90_000);
});
