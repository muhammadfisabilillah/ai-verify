#!/usr/bin/env node

import path from "node:path";

import { CoreOrchestrator } from "../core/orchestrator.js";
import { GitAnalyzer } from "../analyzer/git-analyzer.js";
import { RiskEngineV01 } from "../risk/risk-engine.js";
import { TypeCheckVerifier, VerificationEngine } from "../verifier/index.js";
import {
  printChangeReport,
  printRiskReport,
  printVerificationReport,
} from "./report.js";

async function main(): Promise<void> {
  const repositoryPath = process.argv[2] ?? ".";

  const request = {
    repositoryPath: path.resolve(repositoryPath),
    includeUncommittedChanges: true,
  };

  const analyzer = new GitAnalyzer();
  const riskEngine = new RiskEngineV01();
  const verificationEngine = new VerificationEngine([new TypeCheckVerifier()]);
  const core = new CoreOrchestrator(analyzer, riskEngine, verificationEngine);

  const { changeSet, risk, verification } = await core.run(request);

  printChangeReport(changeSet);
  printRiskReport(risk);
  printVerificationReport(verification);
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
