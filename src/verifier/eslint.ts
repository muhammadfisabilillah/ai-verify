import { execFile } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Finding, VerificationCheck } from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

const execFileAsync = promisify(execFile);

const LINTABLE_EXTENSION = /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts)$/i;

const CONFIG_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.yaml",
  ".eslintrc.yml",
  ".eslintrc.json",
  ".eslintrc",
];

interface EslintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line?: number;
  column?: number;
}

interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
}

export function isLintableFile(
  filePath: string,
  language: string | undefined,
): boolean {
  if (language === "javascript" || language === "typescript") {
    return true;
  }

  return LINTABLE_EXTENSION.test(filePath);
}

function toFinding(
  message: EslintMessage,
  filePath: string,
  repositoryPath: string,
  index: number,
): Finding {
  const relative =
    path.isAbsolute(filePath) &&
    filePath.startsWith(repositoryPath + path.sep)
      ? path.relative(repositoryPath, filePath)
      : filePath;

  const finding: Finding = {
    id: `lint-${index + 1}`,
    title:
      message.ruleId !== null
        ? `${message.ruleId}: ${message.message}`
        : message.message,
    description: `ESLint ${message.ruleId ?? "fatal"} in ${relative}`,
    severity: message.severity === 2 ? "medium" : "low",
    category: "quality",
    source: "lint",
    file: relative,
  };

  if (message.ruleId !== null) {
    finding.ruleId = message.ruleId;
  }

  if (message.line !== undefined) {
    finding.line = message.line;
  }

  return finding;
}

function parseResults(stdout: string): EslintResult[] | undefined {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as EslintResult[];
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

async function isEslintAvailable(repositoryPath: string): Promise<boolean> {
  try {
    await execFileAsync("npx", ["--no-install", "eslint", "--version"], {
      cwd: repositoryPath,
      timeout: 60_000,
    });

    return true;
  } catch {
    return false;
  }
}

async function hasEslintConfig(repositoryPath: string): Promise<boolean> {
  for (const file of CONFIG_FILES) {
    try {
      await access(path.join(repositoryPath, file));
      return true;
    } catch {
      // Try the next candidate.
    }
  }

  try {
    const pkg = JSON.parse(
      await readFile(path.join(repositoryPath, "package.json"), "utf8"),
    ) as { eslintConfig?: unknown };

    return pkg.eslintConfig !== undefined;
  } catch {
    return false;
  }
}

export class EslintVerifier implements Verifier {
  readonly id = "lint";
  readonly name = "Lint";

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
          isLintableFile(file.path, file.language),
      )
      .map((file) => file.path);

    if (targets.length === 0) {
      return finish("skipped", [], "No JavaScript/TypeScript files to lint.");
    }

    if (!(await isAccessibleDirectory(context.repositoryPath))) {
      return finish(
        "error",
        [],
        `Cannot access repository path: ${context.repositoryPath}`,
      );
    }

    if (!(await isEslintAvailable(context.repositoryPath))) {
      return finish(
        "skipped",
        [],
        "ESLint is not available in this repository.",
      );
    }

    if (!(await hasEslintConfig(context.repositoryPath))) {
      return finish(
        "skipped",
        [],
        "No ESLint configuration found in this repository.",
      );
    }

    try {
      await execFileAsync(
        "npx",
        [
          "--no-install",
          "eslint",
          "--format",
          "json",
          "--max-warnings",
          "0",
          "--no-warn-ignored",
          "--",
          ...targets,
        ],
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
        const results = parseResults(error.stdout);

        if (results !== undefined) {
          const findings = results.flatMap((result, index) =>
            result.messages.map((message, messageIndex) =>
              toFinding(
                message,
                result.filePath,
                context.repositoryPath,
                index + messageIndex,
              ),
            ),
          );

          return finish("failed", findings);
        }
      }

      return finish(
        "error",
        [],
        "Lint execution failed before producing output.",
      );
    }
  }
}
