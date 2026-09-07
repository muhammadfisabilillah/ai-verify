import type {
  AnalysisRequest,
  ChangeSet,
} from "./types/index.js";

import type { Analyzer } from "../analyzer/analyzer.js";

export class CoreOrchestrator {
  constructor(private readonly analyzer: Analyzer) {}

  async analyze(request: AnalysisRequest): Promise<ChangeSet> {
    return this.analyzer.analyze(request);
  }
}
