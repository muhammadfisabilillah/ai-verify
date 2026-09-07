import type {
  ChangeSet,
  RiskAssessment,
  VerificationResult,
} from "../core/types/index.js";

export function printChangeReport(changeSet: ChangeSet): void {
  console.log("");
  console.log("AI Verify");
  console.log("------------------------------");
  console.log(`Files changed : ${changeSet.files.length}`);
  console.log(`Additions     : +${changeSet.totalAdditions}`);
  console.log(`Deletions     : -${changeSet.totalDeletions}`);
  console.log("");

  if (changeSet.files.length === 0) {
    console.log("No changes detected.");
    return;
  }

  console.log("Changes:");

  for (const file of changeSet.files) {
    const language = file.language ?? "unknown";

    console.log(
      `  ${file.changeType.padEnd(8)} ${file.path} (${language}) +${file.additions}/-${file.deletions}`,
    );
  }
}

export function printRiskReport(risk: RiskAssessment): void {
  console.log("");
  console.log(`Risk: ${risk.level.toUpperCase()} (${risk.score})`);

  if (risk.factors.length === 0) {
    console.log("No risk factors.");
    return;
  }

  console.log("Factors:");

  for (const factor of risk.factors) {
    console.log(`  +${factor.score} ${factor.name} — ${factor.reason}`);
  }
}

const CHECK_ICONS: Record<string, string> = {
  passed: "✓",
  failed: "✗",
  skipped: "-",
  error: "!",
};

export function printVerificationReport(result: VerificationResult): void {
  console.log("");
  console.log(`Verification (${result.durationMs}ms)`);

  for (const check of result.checks) {
    const icon = CHECK_ICONS[check.status] ?? "?";
    const detail =
      check.findings.length > 0 ? `, ${check.findings.length} finding(s)` : "";

    console.log(`  ${icon} ${check.name} — ${check.status}${detail}`);
  }

  console.log(`Findings: ${result.findings.length}`);

  for (const finding of result.findings.slice(0, 20)) {
    const location =
      finding.file !== undefined
        ? ` (${finding.file}${finding.line !== undefined ? `:${finding.line}` : ""})`
        : "";

    console.log(`  [${finding.severity.toUpperCase()}] ${finding.title}${location}`);
  }

  const failed = result.checks.some(
    (check) => check.status === "failed" || check.status === "error",
  );

  console.log(`Result: ${failed ? "FAILED" : "PASSED"}`);
}
