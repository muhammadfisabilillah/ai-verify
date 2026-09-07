import type { AnalysisRequest, ChangeSet } from "../core/types/index.js";
import type { Analyzer } from "./analyzer.js";
export declare class GitAnalyzer implements Analyzer {
    analyze(request: AnalysisRequest): Promise<ChangeSet>;
    private buildDiffArgs;
    private parseNumstat;
    private parseLine;
    private parseStat;
}
