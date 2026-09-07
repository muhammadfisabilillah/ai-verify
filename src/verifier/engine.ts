import type { RiskAssessment, VerificationResult } from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

export class VerificationEngine {
  constructor(private readonly verifiers: Verifier[]) {}

  async run(
    context: VerifierContext,
    risk: RiskAssessment,
  ): Promise<VerificationResult> {
    const start = Date.now();

    const checks = [];
    for (const verifier of this.verifiers) {
      checks.push(await verifier.run(context));
    }

    return {
      checks,
      findings: checks.flatMap((check) => check.findings),
      risk,
      durationMs: Date.now() - start,
    };
  }
}
