import { describe, expect, it } from "vitest";

import type {
  ChangeSet,
  RiskAssessment,
  VerificationCheck,
} from "../../src/core/types/index.js";
import { VerificationEngine } from "../../src/verifier/engine.js";
import type { VerifierContext } from "../../src/verifier/verifier.js";

const changeSet: ChangeSet = { files: [], totalAdditions: 0, totalDeletions: 0 };
const risk: RiskAssessment = { score: 10, level: "low", factors: [] };

function stubCheck(id: string, findings: VerificationCheck["findings"] = []): VerificationCheck {
  return { id, name: id, status: "passed", durationMs: 1, findings };
}

describe("VerificationEngine", () => {
  it("runs verifiers in order and aggregates findings", async () => {
    const calls: string[] = [];

    const engine = new VerificationEngine([
      {
        id: "a",
        name: "A",
        run: async (_ctx: VerifierContext) => {
          calls.push("a");
          return stubCheck("a");
        },
      },
      {
        id: "b",
        name: "B",
        run: async (_ctx: VerifierContext) => {
          calls.push("b");
          return stubCheck("b", [
            {
              id: "b-1",
              title: "Boom",
              description: "Something broke",
              severity: "high",
              category: "reliability",
              source: "typecheck",
            },
          ]);
        },
      },
    ]);

    const result = await engine.run({ repositoryPath: ".", changeSet }, risk);

    expect(calls).toEqual(["a", "b"]);
    expect(result.checks.map((c) => c.id)).toEqual(["a", "b"]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.id).toBe("b-1");
    expect(result.risk).toBe(risk);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns empty findings when all checks pass", async () => {
    const engine = new VerificationEngine([
      {
        id: "a",
        name: "A",
        run: async (_ctx: VerifierContext) => stubCheck("a"),
      },
    ]);

    const result = await engine.run({ repositoryPath: ".", changeSet }, risk);

    expect(result.checks).toHaveLength(1);
    expect(result.findings).toEqual([]);
  });
});
