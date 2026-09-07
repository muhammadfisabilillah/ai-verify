#!/usr/bin/env node

import path from "node:path";

import { CoreOrchestrator } from "../core/orchestrator.js";
import { GitAnalyzer } from "../analyzer/git-analyzer.js";
import { printChangeReport } from "./report.js";

async function main(): Promise<void> {
  const repositoryPath = process.argv[2] ?? ".";

  const request = {
    repositoryPath: path.resolve(repositoryPath),
    includeUncommittedChanges: true,
  };

  const analyzer = new GitAnalyzer();
  const core = new CoreOrchestrator(analyzer);

  const changeSet = await core.analyze(request);

  printChangeReport(changeSet);
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
