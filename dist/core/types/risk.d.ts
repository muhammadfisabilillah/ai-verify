export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";
export interface RiskFactor {
    name: string;
    score: number;
    reason: string;
}
export interface RiskAssessment {
    score: number;
    level: RiskLevel;
    factors: RiskFactor[];
}
