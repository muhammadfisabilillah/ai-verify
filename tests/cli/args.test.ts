import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

import { main, parseArgs, printHelp, run } from "../../src/cli/index.js";
import { getVersion } from "../../src/cli/version.js";

const execFileAsync = promisify(execFile);

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
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
  const dir = mkdtempSync(path.join(tmpdir(), "ai-verify-args-"));
  tempDirs.push(dir);
  await git(dir, ["init", "-q"]);
  await git(dir, ["config", "user.email", "test@ai-verify.dev"]);
  await git(dir, ["config", "user.name", "AI Verify Test"]);
  return dir;
}

function captureLog(fn: () => void | Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation(() => {});

  return (async () => {
    await fn();
    return lines;
  })();
}

describe("parseArgs", () => {
  it("defaults to current dir with no flags", () => {
    expect(parseArgs(["node", "ai-verify"])).toEqual({
      repositoryPath: ".",
      json: false,
      help: false,
      version: false,
    });
  });

  it("takes path positionally and flags anywhere", () => {
    expect(parseArgs(["node", "ai-verify", "/tmp/repo", "--json"])).toMatchObject({
      repositoryPath: "/tmp/repo",
      json: true,
    });
    expect(parseArgs(["node", "ai-verify", "--json", "/tmp/repo"])).toMatchObject({
      repositoryPath: "/tmp/repo",
      json: true,
    });
  });

  it("supports -h and -V shorthands", () => {
    expect(parseArgs(["node", "ai-verify", "-h"]).help).toBe(true);
    expect(parseArgs(["node", "ai-verify", "-V"]).version).toBe(true);
  });

  it("throws on unknown option", () => {
    expect(() => parseArgs(["node", "ai-verify", "--yaml"])).toThrow(/Unknown option/);
  });
});

describe("help and version", () => {
  it("prints usage with examples", async () => {
    const lines = await captureLog(() => printHelp());

    expect(lines.join("\n")).toMatch(/Usage: ai-verify/);
    expect(lines.join("\n")).toMatch(/--json/);
  });

  it("main --help returns 0 without analyzing", async () => {
    const lines = await captureLog(async () => {
      await expect(main(["node", "ai-verify", "--help"])).resolves.toBe(0);
    });

    expect(lines.join("\n")).toMatch(/Usage: ai-verify/);
  });

  it("main --version prints package version", async () => {
    const lines = await captureLog(async () => {
      await expect(main(["node", "ai-verify", "--version"])).resolves.toBe(0);
    });

    expect(lines.join("")).toContain(getVersion());
  });
});

describe("run --json", () => {
  it("emits parseable JSON with changeSet, risk, verification", async () => {
    const repo = await initRepo();
    writeFileSync(path.join(repo, "README.md"), "hello\n");
    await git(repo, ["add", "-A"]);
    await git(repo, ["commit", "-qm", "init"]);
    writeFileSync(path.join(repo, "README.md"), "hello\nmore docs\n");

    let code = -1;
    const lines = await captureLog(async () => {
      code = await run(repo, { json: true });
    });

    expect(code).toBe(0);
    const parsed = JSON.parse(lines.join("\n")) as {
      changeSet: unknown;
      risk: unknown;
      verification: unknown;
    };
    expect(parsed).toHaveProperty("changeSet");
    expect(parsed).toHaveProperty("risk");
    expect(parsed).toHaveProperty("verification");
  });
});
