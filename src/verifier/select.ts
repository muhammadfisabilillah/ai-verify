import type { ChangeSet, RiskAssessment } from "../core/types/index.js";

import { EslintVerifier, isLintableFile } from "./eslint.js";
import { PytestVerifier, isPythonFile } from "./pytest.js";
import { RuffVerifier } from "./ruff.js";
import { SecretsVerifier } from "./secrets.js";
import { TypeCheckVerifier, isTypeScriptFile } from "./typecheck.js";
import type { Verifier } from "./verifier.js";

export type VerifierSelector = (
  changeSet: ChangeSet,
  risk: RiskAssessment,
) => Verifier[];

// Risk-adaptive selection: risk only ever ADDS depth, never removes it.
// A check that applies to a change at LOW risk still applies at HIGH risk.
// Secret Scan is the risk-independent baseline (always on when files remain);
// risk-adaptive outcomes for it derive from per-rule severity in the verdict,
// not from selection. Future checks branch on `risk` here.
export function selectVerifiers(
  changeSet: ChangeSet,
  _risk: RiskAssessment,
): Verifier[] {
  const verifiers: Verifier[] = [];

  const touchesTypeScript = changeSet.files.some((file) =>
    isTypeScriptFile(file.path, file.language),
  );

  if (touchesTypeScript) {
    verifiers.push(new TypeCheckVerifier());
  }

  const touchesLintable = changeSet.files.some((file) =>
    isLintableFile(file.path, file.language),
  );

  if (touchesLintable) {
    verifiers.push(new EslintVerifier());
  }

  const touchesPython = changeSet.files.some((file) =>
    isPythonFile(file.path, file.language),
  );

  if (touchesPython) {
    verifiers.push(new RuffVerifier());
    verifiers.push(new PytestVerifier());
  }

  const touchesScannableFile = changeSet.files.some(
    (file) => file.changeType !== "deleted",
  );

  if (touchesScannableFile) {
    verifiers.push(new SecretsVerifier());
  }

  return verifiers;
}
