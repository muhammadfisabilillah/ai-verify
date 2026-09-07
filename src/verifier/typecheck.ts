import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

import type { Finding, VerificationCheck } from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

const execFileAsync = promisify(execFile);

const TSC_ERROR_LINE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;

export function isTypeScriptFile(
  filePath: string,
  language: string | undefined,
): boolean {
  if (language === "typescript") {
    return true;
  }

  return /\.(ts|tsx|mts|cts)$/i.test(filePath);
}

function parseFinding(line: string, index: number): Finding | undefined {
  const match = TSC_ERROR_LINE.exec(line.trim());

  if (!match) {
    return undefined;
  }

  const [, filePath, lineStr, , code, message] = match;

  if (!filePath || !lineStr || !code || !message) {
    return undefined;
  }

  const parsedLine = Number.parseInt(lineStr, 10);

  const finding: Finding = {
    id: `typecheck-${index + 1}`,
    title: `${code}: ${message}`,
    description: `TypeScript error ${code} in ${filePath}`,
    severity: "high",
    category: "reliability",
    source: "typecheck",
    file: filePath,
    ruleId: code,
  };

  if (!Number.isNaN(parsedLine)) {
    finding.line = parsedLine;
  }

  return finding;
}

async function isAccessibleDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isTscAvailable(repositoryPath: string): Promise<boolean> {
  try {
    await execFileAsync("npx", ["--no-install", "tsc", "--version"], {
      cwd: repositoryPath,
      timeout: 60_000,
    });

    return true;
  } catch {
    return false;
  }
}

export class TypeCheckVerifier implements Verifier {
  readonly id = "typecheck";
  readonly name = "Type Check";

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

    const touchesTypeScript = context.changeSet.files.some((file) =>
      isTypeScriptFile(file.path, file.language),
    );

    if (!touchesTypeScript) {
      return finish("skipped", [], "No TypeScript files changed.");
    }

    if (!(await isAccessibleDirectory(context.repositoryPath))) {
      return finish(
        "error",
        [],
        `Cannot access repository path: ${context.repositoryPath}`,
      );
    }

    if (!(await isTscAvailable(context.repositoryPath))) {
      return finish(
        "skipped",
        [],
        "TypeScript compiler (tsc) is not available in this repository.",
      );
    }

    try {
      await execFileAsync("npx", ["--no-install", "tsc", "--noEmit"], {
        cwd: context.repositoryPath,
        timeout: 120_000,
      });

      return finish("passed");
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === "object" &&
        "stdout" in error &&
        typeof error.stdout === "string" &&
        error.stdout.trim() !== ""
      ) {
        const findings = error.stdout
          .split("\n")
          .map((line, index) => parseFinding(line, index))
          .filter((finding): finding is Finding => finding !== undefined);

        return finish("failed", findings);
      }

      return finish(
        "error",
        [],
        "Type check execution failed before producing output.",
      );
    }
  }
}
