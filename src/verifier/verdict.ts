import type { VerificationResult, Verdict } from "../core/types/index.js";

function isRisky(level: VerificationResult["risk"]["level"]): boolean {
  return level === "medium" || level === "high" || level === "critical";
}

// Verdict derives from check outcomes + findings + risk.
// Risk alone never blocks: it selects depth, and only concrete
// outcomes (errors, findings) or unverified risky changes move the verdict.
export function deriveVerdict(result: VerificationResult): Verdict {
  // BLOCK: crashed tooling, critical findings, or high-severity findings
  // in high-risk changes. Never silent, never negotiable.
  if (result.checks.some((check) => check.status === "error")) {
    return "BLOCK";
  }

  if (result.findings.some((finding) => finding.severity === "critical")) {
    return "BLOCK";
  }

  if (
    (result.risk.level === "high" || result.risk.level === "critical") &&
    result.findings.some((finding) => finding.severity === "high")
  ) {
    return "BLOCK";
  }

  // REVIEW: something failed or was found and needs a human decision.
  if (result.checks.some((check) => check.status === "failed")) {
    return "REVIEW";
  }

  if (result.findings.length > 0) {
    return "REVIEW";
  }

  // REVIEW: risky change with nothing actually verifying it
  // (no applicable verifier, or every check skipped). Honest admission
  // of a coverage gap instead of a hollow PASS.
  if (
    isRisky(result.risk.level) &&
    !result.checks.some((check) => check.status === "passed")
  ) {
    return "REVIEW";
  }

  return "PASS";
}
