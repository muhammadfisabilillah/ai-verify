#!/usr/bin/env node

import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CoreOrchestrator } from "../core/orchestrator.js";
import { GitAnalyzer } from "../analyzer/git-analyzer.js";
import { RiskEngineV01 } from "../risk/risk-engine.js";
import { deriveVerdict, selectVerifiers } from "../verifier/index.js";
import { appendHistory, buildHistoryEntry } from "../history/store.js";
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
  history?: boolean;
}

export interface CliArgs {
  repositoryPath: string;
  json: boolean;
  help: boolean;
  version: boolean;
  history: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  let repositoryPath = ".";
  let json = false;
  let help = false;
  let version = false;
  let history = true;

  for (const arg of argv.slice(2)) {
    if (arg === "--json") {
      json = true;
    } else if (arg === "--no-history") {
      history = false;
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

  return { repositoryPath, json, help, version, history };
}

export function printHelp(): void {
  console.log(`AI Verify — AI can generate code. AI Verify helps verify it.
------------------------------
Usage: ai-verify [path] [options]

Arguments:
  [path]        Target git repository (default: .)

Options:
  --json        Machine-readable JSON output ({ changeSet, risk, verification, verdict })
  --no-history  Skip recording this run to the local history
  -h, --help    Show this help
  -V, --version Show version

History: every run appends one summary line to
~/.cache/ai-verify/runs.jsonl (override with AI_VERIFY_HISTORY_FILE).
No file contents are recorded. Use --no-history to opt out.

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

  const output = await core.run(request);
  const { changeSet, risk, verification } = output;
  const verdict = deriveVerdict(verification);

  if (options?.history !== false) {
    await appendHistory(
      buildHistoryEntry(output, verdict, getVersion(), request.repositoryPath),
    );
  }

  if (options?.json === true) {
    console.log(
      JSON.stringify({
        changeSet,
        risk,
        verification,
        verdict,
      }),
    );
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

  return run(args.repositoryPath, { json: args.json, history: args.history });
}

const entryPath = fileURLToPath(import.meta.url);

// npm .bin links, npx, and global installs invoke the CLI through a symlink,
// so argv[1] never equals the real module path. Compare canonical paths or
// every symlinked install exits silently without running anything.
export function isEntryModule(
  invokedPath: string | undefined,
  metaUrl: string,
): boolean {
  if (invokedPath === undefined) {
    return false;
  }

  try {
    return realpathSync(invokedPath) === fileURLToPath(metaUrl);
  } catch {
    return false;
  }
}

if (isEntryModule(process.argv[1], import.meta.url)) {
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
