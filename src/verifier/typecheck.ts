import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Finding, VerificationCheck } from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

const execFileAsync = promisify(execFile);

const TSC_ERROR_LINE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;

function isTypeScriptFile(filePath: string, language: string | undefined): boolean {
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

export class TypeCheckVerifier implements Verifier {
  readonly id = "typecheck";
  readonly name = "Type Check";

  async run(context: VerifierContext): Promise<VerificationCheck> {
    const start = Date.now();

    const touchesTypeScript = context.changeSet.files.some((file) =>
      isTypeScriptFile(file.path, file.language),
    );

    if (!touchesTypeScript) {
      return { id: this.id, name: this.name, status: "skipped", durationMs: 0, findings: [] };
    }

    try {
      await execFileAsync("npx", ["--no-install", "tsc", "--noEmit"], {
        cwd: context.repositoryPath,
        timeout: 120_000,
      });

      return {
        id: this.id,
        name: this.name,
        status: "passed",
        durationMs: Date.now() - start,
        findings: [],
      };
    } catch (error: unknown) {
      const durationMs = Date.now() - start;

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

        return { id: this.id, name: this.name, status: "failed", durationMs, findings };
      }

      return { id: this.id, name: this.name, status: "error", durationMs, findings: [] };
    }
  }
}
