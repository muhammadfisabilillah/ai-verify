import type { ChangeSet, RiskFactor } from "../core/types/index.js";

interface PathRule {
  name: string;
  score: number;
  reason: string;
  patterns: RegExp[];
}

const PATH_RULES: PathRule[] = [
  {
    name: "Authentication change",
    score: 30,
    reason: "Touches authentication or authorization logic",
    patterns: [
      /auth/i,
      /login|logout/i,
      /session/i,
      /password/i,
      /oauth/i,
      /\bjwt\b/i,
      /\btoken\b/i,
      /\bmfa\b/i,
      /permission|\brole\b|\bacl\b|identity/i,
    ],
  },
  {
    name: "Payment change",
    score: 30,
    reason: "Touches payment or billing logic",
    patterns: [
      /payment|billing|checkout|stripe|invoice|transaction|subscription|payout|refund/i,
    ],
  },
  {
    name: "Secrets touched",
    score: 30,
    reason: "Touches secrets or credentials",
    patterns: [
      /secret|credential/i,
      /\.pem$|\.key$/i,
      /private[_-]?key/i,
      /vault/i,
      /(^|\/)\.env(\.|$)/i,
    ],
  },
  {
    name: "Database change",
    score: 25,
    reason: "Touches database schema, migration, or query logic",
    patterns: [
      /migrat|prisma|\.sql$/i,
      /database|\/db\/|^db\//i,
      /repository|seed/i,
    ],
  },
  {
    name: "Security-sensitive file",
    score: 20,
    reason: "Touches security-sensitive code",
    patterns: [
      /crypto|cipher|\bhash\b|cert|\btls\b|\bssl\b|security|sanitiz|xss|csrf|inject/i,
    ],
  },
  {
    name: "Configuration / infra change",
    score: 15,
    reason: "Touches configuration or infrastructure",
    patterns: [
      /dockerfile|docker-compose/i,
      /\.github\/workflows/i,
      /terraform|\.tf$/i,
      /k8s|kubernetes|nginx/i,
      /^infra\/|^config\//i,
    ],
  },
];

const TEST_PATH =
  /__tests__|[/]tests?[/]|\.test\.|\.spec\.|_test\.go$|test_.*\.py$/i;

function isTestFile(filePath: string): boolean {
  return TEST_PATH.test(filePath);
}

function isCodeFile(language: string | undefined): boolean {
  return language !== undefined;
}

function collectPathFactors(changeSet: ChangeSet): RiskFactor[] {
  const factors: RiskFactor[] = [];

  for (const rule of PATH_RULES) {
    const matched = changeSet.files
      .map((file) => file.path)
      .filter((filePath) =>
        rule.patterns.some((pattern) => pattern.test(filePath)),
      );

    if (matched.length === 0) {
      continue;
    }

    factors.push({
      name: rule.name,
      score: rule.score,
      reason: `${rule.reason}: ${matched.slice(0, 5).join(", ")}`,
    });
  }

  return factors;
}

function collectTestFactor(changeSet: ChangeSet): RiskFactor[] {
  const codeChanged = changeSet.files.some((file) => isCodeFile(file.language));

  if (!codeChanged) {
    return [];
  }

  const testChanged = changeSet.files.some((file) => isTestFile(file.path));

  if (testChanged) {
    return [];
  }

  return [
    {
      name: "No related tests",
      score: 12,
      reason: "Code changed without accompanying test changes",
    },
  ];
}

function collectSizeFactor(changeSet: ChangeSet): RiskFactor[] {
  const total = changeSet.totalAdditions + changeSet.totalDeletions;

  if (total > 500) {
    return [
      {
        name: "Large change",
        score: 10,
        reason: `Change spans ${total} lines`,
      },
    ];
  }

  if (total > 200) {
    return [
      {
        name: "Medium-large change",
        score: 5,
        reason: `Change spans ${total} lines`,
      },
    ];
  }

  return [];
}

export function collectRiskFactors(changeSet: ChangeSet): RiskFactor[] {
  return [
    ...collectPathFactors(changeSet),
    ...collectTestFactor(changeSet),
    ...collectSizeFactor(changeSet),
  ];
}
