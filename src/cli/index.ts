#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

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

export interface RunOptions {
  json?: boolean;
}

export interface CliArgs {
  repositoryPath: string;
  json: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  let repositoryPath = ".";
  let json = false;
  let help = false;
  let version = false;

  for (const arg of argv.slice(2)) {
    if (arg === "--json") {
      json = true;
    } else if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--version" || arg === "-V") {
      version = true;
    } else if (!arg.startsWith("-") && repositoryPath === ".") {
      repositoryPath = arg;
    } else if (!arg.startsWith("-")) {
      repositoryPath = arg;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { repositoryPath, json, help, version };
}

export function printHelp(): void {
  console.log(`AI Verify — AI can generate code. AI Verify helps verify it.
------------------------------
Usage: ai-verify [path] [options]

Arguments:
  [path]        Target git repository (default: .)

Options:
  --json        Machine-readable JSON output ({ changeSet, risk, verification })
  -h, --help    Show this help
  -V, --version Show version

Examples:
  ai-verify .
  ai-verify /path/to/repo --json
  ai-verify --help`);
}

export async function run(
  repositoryPath: string,
  options?: RunOptions,
): Promise<number> {
  const request = {
    repositoryPath: path.resolve(repositoryPath),
    includeUncommittedChanges: true,
  };

  const analyzer = new GitAnalyzer();
  const riskEngine = new RiskEngineV01();
  const core = new CoreOrchestrator(analyzer, riskEngine, selectVerifiers);

  const { changeSet, risk, verification } = await core.run(request);

  if (options?.json === true) {
    console.log(JSON.stringify({ changeSet, risk, verification }));
    return hasFailed(verification) ? 1 : 0;
  }

  printBanner(getVersion());
  printChangeReport(changeSet);
  printRiskReport(risk);
  printVerificationReport(verification);

  return hasFailed(verification) ? 1 : 0;
}

export async function main(argv: string[] = process.argv): Promise<number> {
  const args = parseArgs(argv);

  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.version) {
    console.log(getVersion());
    return 0;
  }

  return run(args.repositoryPath, { json: args.json });
}

const entryPath = fileURLToPath(import.meta.url);

if (process.argv[1] === entryPath) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error("AI Verify failed.");

      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error(error);
      }

      process.exitCode = 1;
    },
  );
}
