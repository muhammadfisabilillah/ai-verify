import type { RiskLevel } from "../core/types/index.js";

export function scoreToLevel(score: number): RiskLevel {
  if (score <= 0) {
    return "none";
  }

  if (score < 30) {
    return "low";
  }

  if (score < 60) {
    return "medium";
  }

  if (score < 90) {
    return "high";
  }

  return "critical";
}
