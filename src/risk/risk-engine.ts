import type {
  ChangeSet,
  RiskAssessment,
} from "../core/types/index.js";

import { scoreToLevel } from "./levels.js";
import { collectRiskFactors } from "./rules.js";

export interface RiskEngine {
  assess(changeSet: ChangeSet): RiskAssessment;
}

export class RiskEngineV01 implements RiskEngine {
  assess(changeSet: ChangeSet): RiskAssessment {
    const factors = collectRiskFactors(changeSet);

    const raw = factors.reduce((total, factor) => total + factor.score, 0);
    const score = Math.min(100, Math.max(0, raw));

    return {
      score,
      level: scoreToLevel(score),
      factors,
    };
  }
}
