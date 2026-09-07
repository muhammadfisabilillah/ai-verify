# AI Verify

> AI can generate code. AI Verify helps verify it.

Open-source, risk-adaptive verification infrastructure for AI-generated software.
It analyzes what changed, assesses how risky it is, and runs only the checks
that fit — then reports a clear `PASSED` / `FAILED` result.

## Requirements

* Node.js `>= 18`
* Git

No config files. No extra services. Check tools (like `tsc`) are used from the
target repository itself when available — never downloaded automatically.

## Quickstart

```bash
git clone <this-repo>
cd ai-verify
npm install
npm run build
node dist/cli/index.js /path/to/your/repo
```

Or during development:

```bash
npm run dev -- /path/to/your/repo
```

## What the output means

```text
Risk: HIGH (72)            # NONE / LOW / MEDIUM / HIGH / CRITICAL + score 0-100
Factors:                   # why: auth change, no tests, large change, ...
  +30 Authentication change — ...

Verification (812ms)
  ✓ Type Check — passed    # ✓ passed, ✗ failed, - skipped, ! error
  - Type Check — skipped (TypeScript compiler (tsc) is not available ...)
Findings: 1
  [HIGH] TS2322: ... (src/app.ts:12)
Result: PASSED             # FAILED if any check failed or errored
```

Honesty rules:

* A check that does not apply is `skipped` with a reason — never a failure.
* A missing tool is `skipped`, never downloaded or installed for you.
* A crashed tool is `error`, not silently treated as passed.

## Quality checks

```bash
npm run check   # type check
npm run test    # tests
npm run build   # build
```

See `docs/workflow.md` for the full vision, architecture, and roadmap.
