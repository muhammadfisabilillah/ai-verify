import type {
  RiskAssessment,
  VerificationCheck,
  VerificationResult,
} from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

export interface EngineOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

export class VerificationEngine {
  constructor(
    private readonly verifiers: Verifier[],
    private readonly options: EngineOptions = {},
  ) {}

  async run(
    context: VerifierContext,
    risk: RiskAssessment,
  ): Promise<VerificationResult> {
    const start = Date.now();
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const checks = [];
    for (const verifier of this.verifiers) {
      checks.push(await this.runGuarded(verifier, context, timeoutMs));
    }

    return {
      checks,
      findings: checks.flatMap((check) => check.findings),
      risk,
      durationMs: Date.now() - start,
    };
  }

  // Stability: one misbehaving verifier must never sink the whole run.
  // A hang becomes an `error` check at the deadline; a throw becomes an
  // `error` check with the message attached. Both still fail the verdict
  // (BLOCK) instead of crashing without a report.
  private async runGuarded(
    verifier: Verifier,
    context: VerifierContext,
    timeoutMs: number,
  ): Promise<VerificationCheck> {
    const start = Date.now();
    let timer: NodeJS.Timeout | undefined;

    try {
      const timeout = new Promise<VerificationCheck>((resolve) => {
        timer = setTimeout(() => {
          resolve({
            id: verifier.id,
            name: verifier.name,
            status: "error",
            durationMs: Date.now() - start,
            findings: [],
            reason: `Verifier timed out after ${timeoutMs}ms.`,
          });
        }, timeoutMs);
      });

      return await Promise.race([verifier.run(context), timeout]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      return {
        id: verifier.id,
        name: verifier.name,
        status: "error",
        durationMs: Date.now() - start,
        findings: [],
        reason: `Verifier crashed: ${message.slice(0, 200)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
