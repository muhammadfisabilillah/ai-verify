import type { Finding } from "./finding.js";
import type { RiskAssessment } from "./risk.js";
export type VerificationStatus = "passed" | "failed" | "skipped" | "error";
export interface VerificationCheck {
    id: string;
    name: string;
    status: VerificationStatus;
    durationMs: number;
    findings: Finding[];
}
export interface VerificationResult {
    checks: VerificationCheck[];
    findings: Finding[];
    risk: RiskAssessment;
    durationMs: number;
}
