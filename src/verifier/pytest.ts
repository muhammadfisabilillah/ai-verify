import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { Finding, VerificationCheck } from "../core/types/index.js";

import type { Verifier, VerifierContext } from "./verifier.js";

const execFileAsync = promisify(execFile);

const PYTHON_EXTENSION = /\.pyi?$/i;

interface JUnitTestCase {
  classname: string;
  name: string;
  time: string;
  failure?: { message: string; _text: string };
  error?: { message: string; _text: string };
  skipped?: { message: string };
}

interface JUnitTestSuite {
  tests: string;
  failures: string;
  errors: string;
  skipped: string;
  time: string;
  testcase: JUnitTestCase[] | JUnitTestCase;
}

interface JUnitReport {
  testsuite: JUnitTestSuite | JUnitTestSuite[];
}

function parseJUnitXml(xml: string): JUnitReport | undefined {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return undefined;
    }
    return doc.documentElement as unknown as JUnitReport;
  } catch {
    return undefined;
  }
}

function normalizeTestCases(
  suites: JUnitTestSuite | JUnitTestSuite[],
): JUnitTestCase[] {
  const suiteArray = Array.isArray(suites) ? suites : [suites];
  return suiteArray.flatMap((suite) => {
    const cases = suite.testcase;
    return Array.isArray(cases) ? cases : [cases];
  });
}

export function isPythonFile(
  filePath: string,
  language: string | undefined,
): boolean {
  if (language === "python") {
    return true;
  }

  return PYTHON_EXTENSION.test(filePath);
}

function isTestFile(filePath: string): boolean {
  const testPatterns = [
    /^test_.*\.py$/,
    /^.*_test\.py$/,
    /^.*\.test\.py$/,
    /^test\.py$/,
  ];
  return testPatterns.some((pattern) => pattern.test(path.basename(filePath)));
}

function toFinding(
  testCase: JUnitTestCase,
  repositoryPath: string,
  index: number,
): Finding {
  const filePath = testCase.classname
    ? path.join(...testCase.classname.split("."))
    : "unknown";
  const relative = path.isAbsolute(filePath)
    ? filePath
    : filePath;

  const finding: Finding = {
    id: `pytest-${index + 1}`,
    title: `${testCase.name} failed`,
    description: `Test ${testCase.classname}.${testCase.name} failed`,
    severity: "medium",
    category: "test",
    source: "test",
    file: relative,
    ruleId: "test-failure",
  };

  if (testCase.failure) {
    finding.title = `${testCase.name}: ${testCase.failure.message}`;
    finding.description = testCase.failure._text;
  } else if (testCase.error) {
    finding.title = `${testCase.name}: ${testCase.error.message}`;
    finding.description = testCase.error._text;
  }

  return finding;
}

async function isAccessibleDirectory(path: string): Promise<boolean> {
  try {
    const { stat } = await import("node:fs/promises");
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isPytestAvailable(repositoryPath: string): Promise<boolean> {
  try {
    await execFileAsync("python3", ["-m", "pytest", "--version"], {
      cwd: repositoryPath,
      timeout: 30_000,
    });

    return true;
  } catch {
    return false;
  }
}

export class PytestVerifier implements Verifier {
  readonly id = "pytest";
  readonly name = "Python Tests";

  async run(context: VerifierContext): Promise<VerificationCheck> {
    const start = Date.now();
    const finish = (
      status: VerificationCheck["status"],
      findings: Finding[] = [],
      reason?: string,
    ): VerificationCheck => {
      if (reason === undefined) {
        return {
          id: this.id,
          name: this.name,
          status,
          durationMs: Date.now() - start,
          findings,
        };
      }

      return {
        id: this.id,
        name: this.name,
        status,
        durationMs: Date.now() - start,
        findings,
        reason,
      };
    };

    const pythonFiles = context.changeSet.files.filter(
      (file) =>
        file.changeType !== "deleted" &&
        isPythonFile(file.path, file.language),
    );

    if (pythonFiles.length === 0) {
      return finish("skipped", [], "No Python files changed.");
    }

    const hasTestFile = pythonFiles.some((file) => isTestFile(file.path));

    if (!hasTestFile) {
      return finish("skipped", [], "No test files found in changes.");
    }

    if (!(await isAccessibleDirectory(context.repositoryPath))) {
      return finish(
        "error",
        [],
        `Cannot access repository path: ${context.repositoryPath}`,
      );
    }

    if (!(await isPytestAvailable(context.repositoryPath))) {
      return finish(
        "skipped",
        [],
        "pytest is not available in this environment.",
      );
    }

    const tempDir = mkdtempSync(path.join(tmpdir(), "ai-verify-pytest-"));
    const xmlFile = path.join(tempDir, "results.xml");

    try {
      await execFileAsync(
        "python3",
        [
          "-m",
          "pytest",
          "--junit-xml",
          xmlFile,
          "--tb=short",
          "-q",
        ],
        {
          cwd: context.repositoryPath,
          timeout: 180_000,
        },
      );

      return finish("passed");
    } catch (error: unknown) {
      let findings: Finding[] = [];
      let xmlContent = "";

      try {
        const { readFileSync } = await import("node:fs");
        xmlContent = readFileSync(xmlFile, "utf8");
      } catch {
        // XML file might not exist if pytest crashed before writing.
      }

      if (xmlContent) {
        const report = parseJUnitXml(xmlContent);
        if (report) {
          const testCases = normalizeTestCases(report.testsuite);
          findings = testCases
            .filter((tc) => tc.failure || tc.error)
            .map((tc, index) => toFinding(tc, context.repositoryPath, index));
        }
      }

      await rmSync(tempDir, { recursive: true, force: true });

      if (findings.length > 0) {
        return finish("failed", findings);
      }

      return finish(
        "error",
        [],
        "Test execution failed before producing results.",
      );
    }
  }
}