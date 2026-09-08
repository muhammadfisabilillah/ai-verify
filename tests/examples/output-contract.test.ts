import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const examplesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../examples",
);

const LEVELS = ["none", "low", "medium", "high", "critical"];
const SEVERITIES = ["info", "low", "medium", "high", "critical"];
const VERDICTS = ["PASS", "REVIEW", "BLOCK"];

describe("examples/*.json --json contract", () => {
  const files = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));

  it("ships a PASS and a REVIEW sample", () => {
    expect(files).toContain("output-pass.json");
    expect(files).toContain("output-review.json");
  });

  it.each(files)("%s matches the --json shape", (file) => {
    const doc = JSON.parse(
      readFileSync(path.join(examplesDir, file), "utf8"),
    ) as Record<string, unknown>;

    expect(Object.keys(doc).sort()).toEqual([
      "changeSet",
      "risk",
      "verdict",
      "verification",
    ]);
    expect(VERDICTS).toContain(doc["verdict"]);

    const changeSet = doc["changeSet"] as {
      files: Array<{ additions: number; deletions: number }>;
      totalAdditions: number;
      totalDeletions: number;
    };
    expect(changeSet.totalAdditions).toBe(
      changeSet.files.reduce((t, f) => t + f.additions, 0),
    );
    expect(changeSet.totalDeletions).toBe(
      changeSet.files.reduce((t, f) => t + f.deletions, 0),
    );

    const risk = doc["risk"] as {
      score: number;
      level: string;
      factors: unknown[];
    };
    expect(LEVELS).toContain(risk.level);
    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(risk.score).toBeLessThanOrEqual(100);

    const verification = doc["verification"] as {
      checks: unknown[];
      findings: Array<{ severity: string }>;
      risk: unknown;
    };
    for (const finding of verification.findings) {
      expect(SEVERITIES).toContain(finding.severity);
    }

    // The risk embedded in the verification result is the same assessment.
    expect(verification.risk).toEqual(risk);
  });
});
