#!/usr/bin/env node

import path from "node:path";

import { CoreOrchestrator } from "../core/orchestrator.js";
import { GitAnalyzer } from "../analyzer/git-analyzer.js";
import { RiskEngineV01 } from "../risk/risk-engine.js";
import { selectVerifiers } from "../verifier/index.js";
import {
  hasFailed,
  printBanner,
  printChangeReport,
  printRiskReport,
  printVerificationReport,
} from "./report.js";
import { getVersion } from "./version.js";

export async function run(repositoryPath: string): Promise<number> {
  const request = {
    repositoryPath: path.resolve(repositoryPath),
    includeUncommittedChanges: true,
  };

  const analyzer = new GitAnalyzer();
  const riskEngine = new RiskEngineV01();
  const core = new CoreOrchestrator(analyzer, riskEngine, selectVerifiers);

  const { changeSet, risk, verification } = await core.run(request);

  printBanner(getVersion());
  printChangeReport(changeSet);
  printRiskReport(risk);
  printVerificationReport(verification);

  return hasFailed(verification) ? 1 : 0;
}

async function main(): Promise<void> {
  const repositoryPath = process.argv[2] ?? ".";
  process.exitCode = await run(repositoryPath);
}

main().catch((error: unknown) => {
  console.error("AI Verify failed.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
