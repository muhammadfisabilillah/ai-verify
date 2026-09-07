import type {
  AnalysisRequest,
  ChangeSet,
  RiskAssessment,
} from "./types/index.js";

import type { Analyzer } from "../analyzer/analyzer.js";
import type { RiskEngine } from "../risk/risk-engine.js";

export interface AnalysisOutput {
  changeSet: ChangeSet;
  risk: RiskAssessment;
}

export class CoreOrchestrator {
  constructor(
    private readonly analyzer: Analyzer,
    private readonly riskEngine: RiskEngine,
  ) {}

  async analyze(request: AnalysisRequest): Promise<ChangeSet> {
    return this.analyzer.analyze(request);
  }

  async run(request: AnalysisRequest): Promise<AnalysisOutput> {
    const changeSet = await this.analyze(request);
    const risk = this.riskEngine.assess(changeSet);

    return { changeSet, risk };
  }
}
