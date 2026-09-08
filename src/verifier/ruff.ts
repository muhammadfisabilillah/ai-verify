import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Finding, VerificationCheck } from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

const execFileAsync = promisify(execFile);

const PYTHON_EXTENSION = /\.pyi?$/i;

interface RuffLocation {
  row: number;
  column: number;
}

interface RuffDiagnostic {
  code: string;
  message: string;
  filename: string;
  location: RuffLocation;
  severity?: string;
}

export function isPythonFile(
  filePath: string,
  language: string | undefined,
): boolean {
  if (language === "python") {
    return true;
  }

  return PYTHON_EXTENSION.test(filePath);
}

function toFinding(
  diagnostic: RuffDiagnostic,
  repositoryPath: string,
  index: number,
): Finding {
  const relative =
    path.isAbsolute(diagnostic.filename) &&
    diagnostic.filename.startsWith(repositoryPath + path.sep)
      ? path.relative(repositoryPath, diagnostic.filename)
      : diagnostic.filename;

  const finding: Finding = {
    id: `ruff-${index + 1}`,
    title: `${diagnostic.code}: ${diagnostic.message}`,
    description: `Ruff ${diagnostic.code} in ${relative}`,
    severity: diagnostic.severity === "warning" ? "low" : "medium",
    category: "quality",
    source: "lint",
    file: relative,
    ruleId: diagnostic.code,
  };

  if (
    diagnostic.location !== undefined &&
    diagnostic.location.row !== undefined
  ) {
    finding.line = diagnostic.location.row;
  }

  return finding;
}

function parseDiagnostics(stdout: string): RuffDiagnostic[] | undefined {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as RuffDiagnostic[];
  } catch {
    return undefined;
  }
}

async function isAccessibleDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isRuffAvailable(repositoryPath: string): Promise<boolean> {
  try {
    await execFileAsync("ruff", ["--version"], {
      cwd: repositoryPath,
      timeout: 30_000,
    });

    return true;
  } catch {
    return false;
  }
}

export class RuffVerifier implements Verifier {
  readonly id = "ruff";
  readonly name = "Ruff";

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

    const targets = context.changeSet.files
      .filter(
        (file) =>
          file.changeType !== "deleted" &&
          isPythonFile(file.path, file.language),
      )
      .map((file) => file.path);

    if (targets.length === 0) {
      return finish("skipped", [], "No Python files to lint.");
    }

    if (!(await isAccessibleDirectory(context.repositoryPath))) {
      return finish(
        "error",
        [],
        `Cannot access repository path: ${context.repositoryPath}`,
      );
    }

    if (!(await isRuffAvailable(context.repositoryPath))) {
      return finish(
        "skipped",
        [],
        "Ruff is not available in this environment.",
      );
    }

    try {
      await execFileAsync(
        "ruff",
        ["check", "--output-format", "json", "--no-fix", "--", ...targets],
        {
          cwd: context.repositoryPath,
          timeout: 120_000,
        },
      );

      return finish("passed");
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === "object" &&
        "stdout" in error &&
        typeof error.stdout === "string" &&
        error.stdout.trim() !== ""
      ) {
        const diagnostics = parseDiagnostics(error.stdout);

        if (diagnostics !== undefined) {
          const findings = diagnostics.map((diagnostic, index) =>
            toFinding(diagnostic, context.repositoryPath, index),
          );

          return finish("failed", findings);
        }
      }

      return finish(
        "error",
        [],
        "Ruff execution failed before producing output.",
      );
    }
  }
}
