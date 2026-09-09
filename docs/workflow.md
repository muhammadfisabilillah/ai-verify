# AI Verify

**Open-source verification infrastructure for AI-generated software.**

AI Verify adalah proyek open-source yang bertujuan membantu developer **memverifikasi software dan perubahan kode yang dihasilkan atau dibantu oleh AI** sebelum perubahan tersebut dianggap aman untuk digunakan.

AI dapat mempercepat proses development secara signifikan. Namun, semakin besar penggunaan AI dalam software engineering, semakin penting pula kemampuan untuk memastikan bahwa kode yang dihasilkan:

* benar secara teknis,
* tidak memperkenalkan bug,
* tidak menimbulkan vulnerability,
* tidak merusak behavior yang sudah ada,
* sesuai dengan konteks project,
* dan dapat dipertanggungjawabkan oleh developer.

AI Verify dibangun dengan prinsip:

> **AI can generate code. AI Verify helps verify it.**

---

## Why AI Verify?

Penggunaan AI coding assistant dan AI agent berkembang sangat cepat.

Developer sekarang dapat memberikan instruksi sederhana kepada AI dan mendapatkan:

* function,
* component,
* API,
* database schema,
* authentication system,
* bahkan satu aplikasi lengkap.

Masalahnya bukan hanya apakah AI dapat menghasilkan kode.

Masalah yang lebih penting adalah:

> **Bagaimana kita mengetahui bahwa kode tersebut benar dan aman?**

Kode yang terlihat masuk akal belum tentu benar.

AI-generated code dapat mengandung:

* logic errors,
* security vulnerabilities,
* dependency problems,
* incorrect assumptions,
* configuration mistakes,
* regression,
* missing tests,
* dan implementasi yang tidak sesuai dengan kebutuhan sebenarnya.

Selain itu, ketergantungan berlebihan terhadap AI dapat membuat developer menerima kode tanpa benar-benar memahami apa yang terjadi di dalamnya.

Karena itu, AI Verify berfokus pada **verification layer**.

---

# Vision

AI Verify ingin menjadi sebuah **open-source verification infrastructure** yang dapat digunakan oleh berbagai developer, project, CI/CD pipeline, IDE, maupun AI coding agent.

Visi jangka panjang:

```text
AI generates software
        │
        ▼
   AI Verify
        │
        ├── Analyze changes
        ├── Assess risk
        ├── Select verification depth
        ├── Run verification
        └── Report findings
        │
        ▼
Developer / CI / AI Agent
```

AI Verify tidak bertujuan menggantikan developer.

AI Verify bertujuan memberikan **lapisan verifikasi** antara perubahan kode dan software yang akan digunakan.

---

# Core Philosophy

AI Verify dibangun berdasarkan beberapa prinsip utama.

### 1. Verification over Generation

AI Verify bukan AI coding assistant.

Fokus utamanya bukan menghasilkan kode baru, tetapi **memeriksa perubahan yang sudah dibuat**.

### 2. Risk-Adaptive Verification

Tidak semua perubahan memiliki risiko yang sama.

Contoh:

```text
README.md
    ↓
Low Risk
    ↓
Light verification
```

Sedangkan:

```text
Authentication
    ↓
Database
    ↓
Payment
    ↓
Security-sensitive logic
    ↓
High Risk
    ↓
Deep verification
```

Karena itu AI Verify tidak seharusnya menjalankan semua pemeriksaan dengan tingkat kedalaman yang sama.

AI Verify akan menentukan:

> **Apa yang berubah → seberapa berisiko → pemeriksaan apa yang diperlukan.**

### 3. Language Agnostic

AI Verify tidak dirancang hanya untuk JavaScript atau TypeScript.

Arsitektur internal menggunakan kontrak umum sehingga analyzer dan verifier dapat mendukung berbagai bahasa.

Target bahasa dapat mencakup:

* TypeScript
* JavaScript
* Python
* Go
* Rust
* Java
* PHP
* Ruby
* C
* C++
* C#
* Swift
* Kotlin

Bahasa baru dapat ditambahkan tanpa harus mengubah core architecture.

### 4. Open Source First

AI Verify dirancang sebagai proyek open-source.

Tujuannya adalah memungkinkan developer lain untuk:

* menggunakan AI Verify,
* memeriksa cara kerjanya,
* menambahkan analyzer,
* menambahkan verifier,
* menambahkan rule,
* membuat integration,
* dan berkontribusi terhadap ecosystem.

---

# Current Status

AI Verify saat ini masih berada pada tahap awal development.

## Phase 1 — Change Detection

Status:

* [x] Git repository detection
* [x] Git diff integration
* [x] Untracked file detection
* [x] Language detection
* [x] ChangeSet generation
* [x] Human-readable CLI report
* [x] Automated GitAnalyzer tests

Phase 1 selesai dan stabil — development dilanjutkan ke **Risk Engine** (Phase 2, selesai).

---

# Architecture

Arsitektur AI Verify dirancang menggunakan beberapa layer.

```text
┌───────────────────────────┐
│            CLI            │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│           Core            │
│       Orchestrator        │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│         Analyzer          │
│                           │
│ Git / GitHub / IDE / ...  │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│         ChangeSet         │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│        Risk Engine        │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│    Verification Engine    │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│          Result           │
└───────────────────────────┘
```

---

# Project Structure

Current project structure:

```text
ai-verify/
│
├── src/
│   │
│   ├── cli/
│   │   ├── index.ts
│   │   └── report.ts
│   │
│   ├── core/
│   │   ├── orchestrator.ts
│   │   │
│   │   └── types/
│   │       ├── analysis.ts
│   │       ├── change.ts
│   │       ├── finding.ts
│   │       ├── risk.ts
│   │       ├── verification.ts
│   │       └── index.ts
│   │
│   ├── analyzer/
│   │   ├── analyzer.ts
│   │   ├── git-analyzer.ts
│   │   └── language.ts
│   │
│   ├── risk/
│   │
│   └── verifier/
│
├── tests/
│   └── analyzer/
│       └── language.test.ts
│
├── docs/
│   └── workflow.md
├── examples/
│   ├── output-pass.json
│   └── output-review.json
│
├── .gitignore
├── README.md
├── package.json
└── tsconfig.json
```

---

# Directory Responsibilities

## `src/cli`

Berisi command-line interface AI Verify.

Contohnya:

```bash
ai-verify .
```

CLI bertanggung jawab untuk:

* menerima input dari user,
* menjalankan orchestrator,
* menampilkan hasil verification.

---

## `src/core`

Core merupakan bagian yang tidak seharusnya bergantung pada implementasi analyzer tertentu.

Core berisi:

* orchestration,
* shared contracts,
* domain types.

Contohnya:

```text
AnalysisRequest
ChangeSet
Finding
RiskAssessment
VerificationResult
```

Tujuannya agar analyzer dan verifier dapat diganti tanpa mengubah keseluruhan sistem.

---

## `src/core/types`

Folder ini berisi kontrak utama AI Verify.

### `change.ts`

Mendefinisikan perubahan kode.

```ts
FileChange
ChangeSet
ChangeType
ChangeSource
```

Contoh:

```text
src/auth/login.ts
    modified
    +42
    -8
    typescript
```

---

### `finding.ts`

Mendefinisikan masalah yang ditemukan oleh verification system.

Kategori dapat berupa:

```text
security
quality
reliability
dependency
configuration
test
unknown
```

Severity:

```text
info
low
medium
high
critical
```

---

### `risk.ts`

Mendefinisikan risk assessment.

Contoh:

```text
Score: 82
Level: HIGH

Factors:
- Authentication change
- Database query modification
- No test changes
```

---

### `verification.ts`

Mendefinisikan hasil pemeriksaan.

Sebuah verification dapat memiliki:

```text
passed
failed
skipped
error
```

dan menghasilkan `Finding`.

---

### `analysis.ts`

Mendefinisikan request yang masuk ke sistem.

Contohnya:

```ts
{
  repositoryPath: "...",
  includeUncommittedChanges: true
}
```

---

# Analyzer

Folder:

```text
src/analyzer/
```

Analyzer bertugas menjawab:

> **Apa yang berubah?**

Analyzer tidak menentukan apakah perubahan tersebut aman.

Ia hanya mengumpulkan dan menormalisasi informasi perubahan.

---

## Analyzer Interface

Analyzer menggunakan kontrak:

```ts
interface Analyzer {
  analyze(request: AnalysisRequest): Promise<ChangeSet>;
}
```

Dengan kontrak ini, analyzer baru dapat ditambahkan tanpa mengubah Core.

Contoh future architecture:

```text
Analyzer
│
├── GitAnalyzer
├── GitHubAnalyzer
├── GitLabAnalyzer
├── IDEAnalyzer
└── CIAnalyzer
```

Semua menghasilkan:

```text
ChangeSet
```

---

# GitAnalyzer

Implementasi analyzer pertama adalah:

```text
GitAnalyzer
```

GitAnalyzer saat ini dapat:

* mendeteksi Git repository,
* membaca Git diff,
* mendeteksi modified files,
* mendeteksi added files,
* mendeteksi deleted files,
* mendeteksi renamed files,
* mendeteksi untracked files,
* menghitung additions,
* menghitung deletions,
* mendeteksi bahasa berdasarkan extension.

Contoh:

```text
AI Verify
------------------------------
Files changed : 3
Additions     : +59
Deletions     : -6

Changes:
  modified  src/auth/login.ts (typescript) +30/-4
  added     src/auth/session.ts (typescript) +24/-0
  modified  README.md (unknown) +5/-2
```

---

# Language Detection

AI Verify memiliki language detector sederhana.

Contoh:

```text
.ts       → TypeScript
.tsx      → TypeScript
.js       → JavaScript
.py       → Python
.go       → Go
.rs       → Rust
.java     → Java
.php      → PHP
.rb       → Ruby
.cs       → C#
.cpp      → C++
.c        → C
.swift    → Swift
.kt       → Kotlin
```

Language detection nantinya dapat digunakan oleh verification engine untuk memilih tool yang sesuai.

Contoh:

```text
Python
  ↓
pytest
ruff
mypy
bandit

TypeScript
  ↓
tsc
eslint
vitest

Rust
  ↓
cargo check
cargo test
clippy
```

---

# Risk Engine

Risk Engine v0.1 sudah diimplementasikan (`src/risk/`).
Ia menjawab pertanyaan utama:

> **"Seberapa berisiko perubahan ini?"**

Risk Engine tidak hanya melihat jumlah baris yang berubah.

Ia dapat mempertimbangkan:

```text
File type
+
Change type
+
Language
+
Code location
+
Security sensitivity
+
Dependency changes
+
Authentication changes
+
Database changes
+
Test coverage
+
Configuration changes
```

Kemudian menghasilkan:

```text
RiskAssessment
```

Contoh:

```text
Score: 87
Level: HIGH

Factors:

Authentication change       +30
Database change             +25
Security-sensitive file     +20
No related tests            +12
Large change                +10
```

---

# Risk Levels

AI Verify menggunakan lima level:

```text
NONE
LOW
MEDIUM
HIGH
CRITICAL
```

Contoh:

### Low

```text
README.md
documentation
formatting
```

Verification:

```text
Light
```

### Medium

```text
business logic
API changes
component changes
```

Verification:

```text
Standard
```

### High

```text
authentication
authorization
database
external API
configuration
```

Verification:

```text
Deep
```

### Critical

```text
payment
secrets
privilege escalation
critical security logic
```

Verification:

```text
Maximum
```

---

# Verification Engine

Setelah Risk Engine menentukan tingkat risiko, Verification Engine akan menentukan pemeriksaan yang diperlukan.

Contoh:

```text
ChangeSet
    │
    ▼
Risk Engine
    │
    ▼
HIGH
    │
    ├── Type Check
    ├── Lint
    ├── Unit Test
    ├── SAST
    ├── Dependency Scan
    └── Security Rules
```

Sedangkan perubahan sederhana:

```text
ChangeSet
    │
    ▼
Risk Engine
    │
    ▼
LOW
    │
    └── Basic Verification
```

Ini merupakan inti dari konsep **Risk-Adaptive Verification**.

---

# Findings

Semua verifier akan menggunakan format `Finding` yang sama.

Contoh:

```text
Finding

ID:
SEC-001

Severity:
HIGH

Category:
security

Title:
Potential SQL injection

File:
src/api/users.ts

Line:
42

Description:
User-controlled input is directly interpolated
into a SQL query.

Remediation:
Use parameterized queries.
```

Dengan format standar, berbagai tool dapat menghasilkan output yang konsisten.

---

# Result

Pada akhirnya AI Verify akan menghasilkan:

```text
VerificationResult
```

yang berisi:

```text
Checks
Findings
Risk Assessment
Duration
```

Contoh konsep output:

```text
AI Verify
──────────────────────────────

Risk: HIGH
Score: 82

Verification

✓ Type Check
✓ Unit Tests
✓ Dependency Scan
✗ Security Scan

Findings: 2

HIGH   Potential SQL Injection
MEDIUM Missing test coverage

Result: BLOCK
```

Aturan verdict (`deriveVerdict` di `src/verifier/verdict.ts`):
`BLOCK` untuk tool `error`, finding `critical`, atau finding `high`
di risk `high`/`critical`; `REVIEW` untuk check `failed`, finding
lainnya, atau perubahan berisiko tanpa verifier yang cocok;
selain itu `PASS`. Risk sendiri tidak pernah memblokir — ia memilih
kedalaman pemeriksaan.

---

# Supported Ecosystem

AI Verify dirancang agar dapat berkembang menjadi ecosystem, bukan hanya sebuah CLI.

Target integration:

```text
CLI
 │
 ├── Local development
 │
 ├── Git hooks
 │
 ├── CI/CD
 │
 ├── GitHub
 │
 ├── GitLab
 │
 ├── IDE
 │
 └── AI Coding Agents
```

Contoh future workflow:

```text
Developer
    │
    ▼
AI Agent
    │
    ▼
Code Changes
    │
    ▼
AI Verify
    │
    ├── Analyze
    ├── Risk Assessment
    └── Verification
    │
    ▼
PASS / REVIEW / BLOCK
```

---

# AI Verify and AI Agents

AI Verify juga dapat digunakan sebagai verification layer untuk AI coding agents.

Contoh:

```text
User
 │
 ▼
AI Agent
 │
 ├── writes code
 ├── modifies files
 └── runs commands
 │
 ▼
AI Verify
 │
 ├── analyze changes
 ├── assess risk
 └── verify
 │
 ▼
Agent receives result
```

Dengan pendekatan ini, AI agent tidak hanya:

> generate → selesai

tetapi:

> generate → verify → fix → verify again

---

# Multi-Language Architecture

Walaupun implementation awal menggunakan TypeScript/Node.js, AI Verify **bukan Node.js-only architecture**.

Node.js digunakan sebagai host untuk CLI dan core implementation.

Verification tools dapat berasal dari ecosystem bahasa masing-masing.

Contoh:

```text
AI Verify Core
      │
      ├── TypeScript
      │    ├── tsc
      │    ├── eslint
      │    └── vitest
      │
      ├── Python
      │    ├── pytest
      │    ├── ruff
      │    └── mypy
      │
      ├── Rust
      │    ├── cargo check
      │    ├── cargo test
      │    └── clippy
      │
      └── Go
           ├── go test
           ├── go vet
           └── staticcheck
```

Dengan demikian AI Verify dapat menjadi orchestration layer untuk berbagai ecosystem.

---

# Technology Stack

Current stack:

```text
Language:
TypeScript

Runtime:
Node.js

Package Manager:
npm

Testing:
Vitest

Type Checking:
TypeScript

Linting:
ESLint

Formatting:
Prettier

Version Control:
Git
```

Configuration:

```text
NodeNext
ES2022
Strict TypeScript
```

---

# Development Principles

AI Verify dikembangkan dengan beberapa prinsip teknis.

### Stable Contracts

Core types harus stabil.

Analyzer dan verifier sebaiknya berkomunikasi melalui contract yang jelas.

### Small Components

Setiap bagian memiliki tanggung jawab yang jelas.

```text
Analyzer
Risk Engine
Verifier
Reporter
```

tidak dicampur menjadi satu class besar.

### Test Before Expansion

Feature baru tidak langsung ditambahkan hanya karena terlihat menarik.

Setiap layer harus cukup stabil sebelum layer berikutnya dibangun.

### CLI First

CLI menjadi interface awal karena mudah digunakan oleh:

* developer,
* scripts,
* CI/CD,
* AI agents.

---

# Roadmap

## Phase 1 — Change Detection

```text
[x] Git repository detection
[x] Git diff
[x] Untracked files
[x] Language detection
[x] ChangeSet
[x] CLI report
[x] GitAnalyzer tests
[x] Windows-safe line counting (Node fs, tanpa shell `wc`)
```

## Phase 2 — Risk Engine v0.1

```text
[x] Risk scoring
[x] Risk factors
[x] Risk levels
[x] File-based risk detection
[x] Change-size risk
[x] Security-sensitive paths
[x] Test-change correlation
```

## Phase 3 — Verification Engine

```text
[x] Verification interface
[x] Type checking
[x] Linting (ESLint)
[x] Testing (Vitest for JS/TS, pytest for Python)
[x] Basic secret scanning (SecretsVerifier, stdlib-only, no external tool)
[ ] Dependency and SAST checks
[x] Finding aggregation
[x] Verification result
[x] PASS / REVIEW / BLOCK verdict
```

## Stabilisasi v0.2 — Selesai

```text
[x] CLI flags (--help, --version, --json, --no-history)
[x] Risk-aware verifier selection (risk hanya menambah depth)
[x] Machine-readable JSON ({ changeSet, risk, verification, verdict })
[x] Contoh output di examples/ dengan contract test
[x] Engine hardening: per-verifier timeout, crash containment
[x] Run history (JSONL, opt-out via --no-history)
```

## Phase 4 — Multi-Language

```text
[x] Python lint (ruff)
[x] Python test runner (pytest)
[ ] Go
[ ] Rust
[ ] Java
[ ] Other languages
```

## Phase 5 — Developer Integrations

```text
[ ] Git hooks
[x] GitHub Action (`action.yml`: composite, Node 18+, `verdict` output, fails on REVIEW/BLOCK)
[ ] GitLab CI
[ ] Pre-commit hook
[ ] IDE integration
[ ] CI/CD integration
```

## Phase 6 — AI Agent Integration

```text
[ ] Agent verification protocol
[ ] Automatic verification
[ ] Verification feedback
[ ] Automatic fix → verify loop
[ ] Agent safety policies
```

---

# Current Development Workflow

Development saat ini mengikuti alur:

```text
1. Define contract
       ↓
2. Implement smallest feature
       ↓
3. Test
       ↓
4. Build
       ↓
5. Run CLI
       ↓
6. Review result
       ↓
7. Commit
```

Quality checks:

```bash
npm run check
npm run build
npm run test
```

Run CLI:

```bash
npm run dev -- .
```

atau setelah build:

```bash
node dist/cli/index.js .
```

---

# Example

Run AI Verify inside a Git repository:

```bash
ai-verify .
```

Conceptual result:

```text
AI Verify
------------------------------

Files changed : 4
Additions     : +127
Deletions     : -31

Changes:
  modified  src/auth/login.ts
  modified  src/api/users.ts
  added     src/security/session.ts
  modified  tests/auth.test.ts
```

Output verifikasi saat ini (dengan verdict):

```text
AI Verify
──────────────────────────────

Changes
4 files
+127 / -31

Risk
HIGH
Score: 76

Verification
✓ Type Check
✓ Tests
✓ Lint
✗ Security Scan

Findings
1 HIGH
2 MEDIUM

Result
BLOCK
```

---

# What AI Verify Is Not

AI Verify bukan:

* AI coding assistant,
* code generator,
* replacement untuk developer,
* jaminan bahwa software 100% aman,
* pengganti security engineer,
* atau sekadar wrapper untuk satu static analyzer.

AI Verify adalah **orchestration and verification infrastructure**.

Tujuannya adalah menggabungkan berbagai metode pemeriksaan berdasarkan konteks dan risiko perubahan.

---

# Long-Term Goal

Tujuan jangka panjang AI Verify adalah membangun sistem di mana AI-generated software tidak langsung dipercaya hanya karena berhasil di-generate.

Target workflow:

```text
GENERATE
   ↓
ANALYZE
   ↓
ASSESS RISK
   ↓
VERIFY
   ↓
UNDERSTAND RESULT
   ↓
FIX
   ↓
VERIFY AGAIN
   ↓
SHIP
```

Dengan demikian:

> **AI mempercepat pembuatan software, sementara AI Verify membantu memastikan software tersebut layak dipercaya.**

---

# Status

**Stabilisasi v0.2 — Selesai**

Phase 1 (Change Detection), Phase 2 (Risk Engine v0.1), dan
Phase 3 (Verification Engine v0.1) selesai, plus stabilisasi:
CLI flags, risk-aware selection, verdict `PASS / REVIEW / BLOCK`,
dan contoh output mesin.

Prioritas berikutnya:

```text
Multi-language verification (Python/Ruff, ESLint)
        ↓
Developer integrations (GitHub Action, pre-commit)
        ↓
AI agent protocol loop
```

---

# Contributing

AI Verify dirancang sebagai proyek open-source.

Kontribusi yang nantinya dapat diterima antara lain:

* analyzer baru,
* language support,
* risk rules,
* verification checks,
* security rules,
* CI integrations,
* documentation,
* tests,
* performance improvements.

Contribution guidelines menyusul di `README.md` — untuk saat ini:
satu scope per commit, kontrak stabil, `npm run check && npm run test && npm run build`
hijau sebelum push.

---

# License

ISC — lihat `package.json`.
