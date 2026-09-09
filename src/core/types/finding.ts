export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type FindingCategory =
  | "security"
  | "quality"
  | "reliability"
  | "dependency"
  | "configuration"
  | "test"
  | "unknown";

export type FindingSource =
  | "typecheck"
  | "lint"
  | "test"
  | "sast"
  | "dependency"
  | "secret"
  | "llm"
  | "unknown";

export interface Finding {
  id: string;
  title: string;
  description: string;

  severity: Severity;
  category: FindingCategory;
  source: FindingSource;

  file?: string;
  line?: number;

  ruleId?: string;
  remediation?: string;
}
