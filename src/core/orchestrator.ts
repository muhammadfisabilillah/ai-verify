import type {
  AnalysisRequest,
  ChangeSet,
  RiskAssessment,
  VerificationResult,
} from "./types/index.js";

import type { Analyzer } from "../analyzer/analyzer.js";
import type { RiskEngine } from "../risk/risk-engine.js";
import { VerificationEngine } from "../verifier/engine.js";
import type { Verifier } from "../verifier/verifier.js";

export interface AnalysisOutput {
  changeSet: ChangeSet;
  risk: RiskAssessment;
  verification: VerificationResult;
}

export class CoreOrchestrator {
  constructor(
    private readonly analyzer: Analyzer,
    private readonly riskEngine: RiskEngine,
    private readonly selectVerifiers: (changeSet: ChangeSet) => Verifier[],
  ) {}

  async analyze(request: AnalysisRequest): Promise<ChangeSet> {
    return this.analyzer.analyze(request);
  }

  async run(request: AnalysisRequest): Promise<AnalysisOutput> {
    const changeSet = await this.analyze(request);
    const risk = this.riskEngine.assess(changeSet);
    const verification = await new VerificationEngine(
      this.selectVerifiers(changeSet),
    ).run({ repositoryPath: request.repositoryPath, changeSet }, risk);

    return { changeSet, risk, verification };
  }
}
