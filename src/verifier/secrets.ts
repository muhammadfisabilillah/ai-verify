import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type {
  Finding,
  Severity,
  VerificationCheck,
} from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

const MAX_FILE_BYTES = 1_000_000;
const MAX_FINDINGS = 20;

interface SecretRule {
  ruleId: string;
  title: string;
  pattern: RegExp;
  // High-confidence patterns (provider-shaped tokens, key blocks) are
  // `critical`: they BLOCK at any risk level. The generic heuristic is
  // `high`: REVIEW at low/medium risk, BLOCK at high/critical risk —
  // the verdict derives risk-adaptivity from severity, no selector
  // plumbing needed.
  severity: Severity;
}

const SECRET_RULES: SecretRule[] = [
  {
    ruleId: "secret-aws-access-key",
    title: "Possible AWS access key",
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: "critical",
  },
  {
    ruleId: "secret-private-key",
    title: "Possible private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    ruleId: "secret-github-token",
    title: "Possible GitHub token",
    pattern:
      /\bghp_[0-9A-Za-z]{10,}|\bgho_[0-9A-Za-z]{10,}|\bgithub_pat_[0-9A-Za-z_]{10,}/,
    severity: "critical",
  },
  {
    ruleId: "secret-stripe-live-key",
    title: "Possible Stripe live secret key",
    pattern: /\bsk_live_[0-9A-Za-z]{10,}/,
    severity: "critical",
  },
  {
    ruleId: "secret-generic-assignment",
    title: "Possible hardcoded credential assignment",
    pattern:
      /\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"]?[^'"\s]{4,}/i,
    severity: "high",
  },
];

async function isAccessibleDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function isBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

function scanLine(
  line: string,
  filePath: string,
  lineNumber: number,
  index: number,
): Finding | undefined {
  for (const rule of SECRET_RULES) {
    if (rule.pattern.test(line)) {
      return {
        id: `secrets-${index + 1}`,
        title: `${rule.title} in ${filePath}:${lineNumber}`,
        description: `${rule.title}. Value redacted. Remove the credential from source and rotate it.`,
        severity: rule.severity,
        category: "security",
        source: "secret",
        file: filePath,
        line: lineNumber,
        ruleId: rule.ruleId,
        remediation:
          "Remove the hardcoded credential, load it from the environment or a secret manager, and rotate the exposed value.",
      };
    }
  }

  return undefined;
}

export class SecretsVerifier implements Verifier {
  readonly id = "secrets";
  readonly name = "Secret Scan";

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

    const targets = context.changeSet.files.filter(
      (file) => file.changeType !== "deleted",
    );

    if (targets.length === 0) {
      return finish("skipped", [], "No files to scan for secrets.");
    }

    if (!(await isAccessibleDirectory(context.repositoryPath))) {
      return finish(
        "error",
        [],
        `Cannot access repository path: ${context.repositoryPath}`,
      );
    }

    const findings: Finding[] = [];

    for (const file of targets) {
      const absolute = path.join(context.repositoryPath, file.path);

      let buffer: Buffer;
      try {
        const fileStat = await stat(absolute);
        if (!fileStat.isFile() || fileStat.size > MAX_FILE_BYTES) {
          continue;
        }
        buffer = await readFile(absolute);
      } catch {
        continue;
      }

      if (isBinary(buffer)) {
        continue;
      }

      const content = buffer.toString("utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line) {
          continue;
        }
        const finding = scanLine(line ?? "", file.path, i + 1, findings.length);
        if (finding) {
          findings.push(finding);
          if (findings.length >= MAX_FINDINGS) {
            return finish("failed", findings);
          }
        }
      }
    }

    if (findings.length > 0) {
      return finish("failed", findings);
    }

    return finish("passed");
  }
}
