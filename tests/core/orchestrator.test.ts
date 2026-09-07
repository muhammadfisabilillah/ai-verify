import { describe, expect, it } from "vitest";

import type {
  AnalysisRequest,
  ChangeSet,
  RiskAssessment,
} from "../../src/core/types/index.js";
import { CoreOrchestrator } from "../../src/core/orchestrator.js";

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

describe("CoreOrchestrator", () => {
  it("runs analyze then assess in order", async () => {
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

    const core = new CoreOrchestrator(analyzer, riskEngine);

    const output = await core.run({
      repositoryPath: ".",
      includeUncommittedChanges: true,
    });

    expect(output).toEqual({ changeSet: stubChangeSet, risk: stubRisk });
    expect(calls).toEqual(["analyze", "assess"]);
  });

  it("passes the analyzed ChangeSet to the risk engine", async () => {
    let received: ChangeSet | undefined;

    const analyzer = {
      analyze: async (_request: AnalysisRequest): Promise<ChangeSet> =>
        stubChangeSet,
    };

    const riskEngine = {
      assess: (changeSet: ChangeSet): RiskAssessment => {
        received = changeSet;
        return stubRisk;
      },
    };

    const core = new CoreOrchestrator(analyzer, riskEngine);

    await core.run({
      repositoryPath: ".",
      includeUncommittedChanges: false,
    });

    expect(received).toBe(stubChangeSet);
  });
});
