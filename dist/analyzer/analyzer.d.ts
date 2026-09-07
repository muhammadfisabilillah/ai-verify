import type { AnalysisRequest, ChangeSet } from "../core/types/index.js";
export interface Analyzer {
    analyze(request: AnalysisRequest): Promise<ChangeSet>;
}
