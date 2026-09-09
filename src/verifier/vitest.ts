import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { Finding, VerificationCheck } from "../core/types/index.js";

import { isLintableFile } from "./eslint.js";
import type { Verifier, VerifierContext } from "./verifier.js";

const execFileAsync = promisify(execFile);

interface VitestAssertionResult {
  ancestorTitles?: string[];
  title?: string;
  status?: string;
  failureMessages?: string[];
}

interface VitestFileResult {
  name?: string;
  assertionResults?: VitestAssertionResult[];
}

interface VitestJsonReport {
  success?: boolean;
  numFailedTests?: number;
  testResults?: VitestFileResult[];
}

export function isTestFile(filePath: string): boolean {
  if (filePath.includes("__tests__/")) {
    return true;
  }

  return /(\.|_)(test|spec)\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/i.test(
    path.basename(filePath),
  );
}

function toFinding(
  fileName: string,
  assertion: VitestAssertionResult,
  repositoryPath: string,
  index: number,
): Finding {
  const relative =
    path.isAbsolute(fileName) && fileName.startsWith(repositoryPath + path.sep)
      ? path.relative(repositoryPath, fileName)
      : fileName;

  const ancestors = (assertion.ancestorTitles ?? []).filter(Boolean);
  const name = [...ancestors, assertion.title ?? "test"]
    .filter(Boolean)
    .join(" ");

  const finding: Finding = {
    id: `vitest-${index + 1}`,
    title: `${name} failed`,
    description: `Test ${name} failed in ${relative}`,
    severity: "medium",
    category: "test",
    source: "test",
    file: relative,
    ruleId: "test-failure",
  };

  const firstMessage = assertion.failureMessages?.find(
    (message) => message.trim() !== "",
  );

  if (firstMessage !== undefined) {
    finding.description = firstMessage.slice(0, 2000);
  }

  return finding;
}

function parseReport(content: string): VitestJsonReport | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed === null || typeof parsed !== "object") {
      return undefined;
    }
    return parsed as VitestJsonReport;
  } catch {
    return undefined;
  }
}

async function isAccessibleDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function isVitestAvailable(repositoryPath: string): Promise<boolean> {
  try {
    await execFileAsync("npx", ["--no-install", "vitest", "--version"], {
      cwd: repositoryPath,
      timeout: 60_000,
    });

    return true;
  } catch {
    return false;
  }
}

export class VitestVerifier implements Verifier {
  readonly id = "vitest";
  readonly name = "JS/TS Tests";

  async run(context: VerifierContext): Promise<VerificationCheck> {
    const start = Date.now();
    const finish = (
      status: VerificationCheck["status"],
      findings: Finding[] = [],
      reason?: string,
    ): VerificationCheck => {
      if (reason === undefined) {
        return {
          id: this.id,
          name: this.name,
          status,
          durationMs: Date.now() - start,
          findings,
        };
      }

      return {
        id: this.id,
        name: this.name,
        status,
        durationMs: Date.now() - start,
        findings,
        reason,
      };
    };

    const jsTsFiles = context.changeSet.files.filter(
      (file) =>
        file.changeType !== "deleted" &&
        isLintableFile(file.path, file.language),
    );

    if (jsTsFiles.length === 0) {
      return finish("skipped", [], "No JavaScript/TypeScript files changed.");
    }

    if (!jsTsFiles.some((file) => isTestFile(file.path))) {
      return finish("skipped", [], "No test files found in changes.");
    }

    if (!(await isAccessibleDirectory(context.repositoryPath))) {
      return finish(
        "error",
        [],
        `Cannot access repository path: ${context.repositoryPath}`,
      );
    }

    if (!(await isVitestAvailable(context.repositoryPath))) {
      return finish(
        "skipped",
        [],
        "Vitest is not available in this repository.",
      );
    }

    const tempDir = mkdtempSync(path.join(tmpdir(), "ai-verify-vitest-"));
    const outputFile = path.join(tempDir, "results.json");

    try {
      await execFileAsync(
        "npx",
        [
          "--no-install",
          "vitest",
          "run",
          "--reporter=json",
          `--outputFile=${outputFile}`,
        ],
        {
          cwd: context.repositoryPath,
          timeout: 180_000,
        },
      );

      return finish("passed");
    } catch {
      let findings: Finding[] = [];

      try {
        const report = parseReport(await readFile(outputFile, "utf8"));

        if (report?.testResults) {
          let index = 0;
          for (const fileResult of report.testResults) {
            for (const assertion of fileResult.assertionResults ?? []) {
              if (assertion.status !== "failed") {
                continue;
              }
              findings.push(
                toFinding(
                  fileResult.name ?? "unknown",
                  assertion,
                  context.repositoryPath,
                  index,
                ),
              );
              index += 1;
            }
          }
        }
      } catch {
        // Report unreadable: fall through to the honest error below.
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }

      if (findings.length > 0) {
        return finish("failed", findings);
      }

      return finish(
        "error",
        [],
        "Test execution failed before producing results.",
      );
    }
  }
}
