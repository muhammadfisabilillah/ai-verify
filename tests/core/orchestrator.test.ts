import { describe, expect, it } from "vitest";

import type {
  AnalysisRequest,
  ChangeSet,
  RiskAssessment,
  VerificationCheck,
} from "../../src/core/types/index.js";
import { CoreOrchestrator } from "../../src/core/orchestrator.js";
import type { VerifierContext } from "../../src/verifier/verifier.js";

const stubChangeSet: ChangeSet = {
  files: [],
  totalAdditions: 0,
  totalDeletions: 0,
};

const stubRisk: RiskAssessment = {
  score: 0,
  level: "none",
  factors: [],
};

const stubCheck: VerificationCheck = {
  id: "stub",
  name: "Stub",
  status: "passed",
  durationMs: 0,
  findings: [],
};

function stubSelector(calls: string[]) {
  return (_changeSet: ChangeSet, _risk: RiskAssessment) => [
    {
      id: "stub",
      name: "Stub",
      run: async (_context: VerifierContext): Promise<VerificationCheck> => {
        calls.push("verify");
        return stubCheck;
      },
    },
  ];
}

describe("CoreOrchestrator", () => {
  it("runs analyze then assess then verify in order", async () => {
    const calls: string[] = [];

    const analyzer = {
      analyze: async (_request: AnalysisRequest): Promise<ChangeSet> => {
        calls.push("analyze");
        return stubChangeSet;
      },
    };

    const riskEngine = {
      assess: (_changeSet: ChangeSet): RiskAssessment => {
        calls.push("assess");
        return stubRisk;
      },
    };

    const core = new CoreOrchestrator(
      analyzer,
      riskEngine,
      stubSelector(calls),
    );

    const output = await core.run({
      repositoryPath: ".",
      includeUncommittedChanges: true,
    });

    expect(output.changeSet).toBe(stubChangeSet);
    expect(output.risk).toBe(stubRisk);
    expect(output.verification.checks).toEqual([stubCheck]);
    expect(output.verification.risk).toBe(stubRisk);
    expect(calls).toEqual(["analyze", "assess", "verify"]);
  });

  it("passes the analyzed ChangeSet to risk and verifier selection", async () => {
    const received: ChangeSet[] = [];
    const risksSeen: RiskAssessment[] = [];

    const analyzer = {
      analyze: async (_request: AnalysisRequest): Promise<ChangeSet> =>
        stubChangeSet,
    };

    const riskEngine = {
      assess: (changeSet: ChangeSet): RiskAssessment => {
        received.push(changeSet);
        return stubRisk;
      },
    };

    const selector = (changeSet: ChangeSet, risk: RiskAssessment) => {
      received.push(changeSet);
      risksSeen.push(risk);
      return [];
    };

    const core = new CoreOrchestrator(analyzer, riskEngine, selector);

    const output = await core.run({
      repositoryPath: ".",
      includeUncommittedChanges: false,
    });

    expect(received).toEqual([stubChangeSet, stubChangeSet]);
    expect(risksSeen).toEqual([stubRisk]);
    expect(output.verification.checks).toEqual([]);
  });
});
