import type { ChangeSet, RiskAssessment } from "../core/types/index.js";

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
