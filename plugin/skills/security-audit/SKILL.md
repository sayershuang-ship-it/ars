---
name: ars:security-audit
description: Run a structured six-phase security audit on the ARS codebase or a target subsystem, producing architecture notes, a markdown report, detailed findings, and a validated findings.json.
argument-hint: "[<subsystem>]"
model: claude-sonnet-4-6
effort: high
---

Run a structured, multi-phase security audit. The goal is to find **exploitable vulnerabilities**, not theoretical risks. Every finding must demonstrate a concrete attack: who is the attacker, what do they do, and what do they get?

## Core principle

Only report what you can exploit. A short report with 3 real findings is worth more than a long report with 30 theoretical ones.

## Setup

Establish the output directory before starting:

```bash
AUDIT_DIR=".ars/security-audits/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"
```

If prior audit runs exist under `.ars/security-audits/`, read the most recent `architecture.md` to avoid redundant reconnaissance. Skip phases already completed in that run.

The audit argument, if given, scopes the target to a subsystem (e.g. `cli`, `web`, `plugin`, `engine`). Without an argument, audit the full codebase.

## Phase 1 — Reconnaissance

Launch three agents in parallel to map the application before hunting.

**Agent 1a — Application fundamentals**
- What does the software do? Who uses it and how?
- Technology stack, directory structure, dependency inventory
- Entry points: CLI commands, web endpoints, API surfaces, IPC mechanisms
- Third-party integrations and data flows

**Agent 1b — Trust model**
- Where does untrusted input enter the system?
- Authentication and authorization mechanisms; where are they enforced?
- Privilege boundaries and separation
- Any bypass mechanisms, admin flags, or debug modes

**Agent 1c — Input surface inventory**
- All channels where external data arrives: CLI args, env vars, HTTP bodies, files, IPC, webhooks
- Dangerous sinks: shell execution, SQL, template rendering, file writes, eval, deserialization
- Map each input source to the sinks it can reach

Synthesize findings into `$AUDIT_DIR/architecture.md`:
- 1–2 page overview: app type, stack, trust boundaries, input surfaces
- Key file paths as starting points for Phase 2
- Flag any complexity that warrants additional research before Phase 2 (plugin systems, multi-tenant auth, complex chains)

See `references/reconnaissance.md` for detailed agent prompts.

## Phase 2 — Vulnerability Hunting

Using `architecture.md` as context, launch 3–12 parallel agents, each targeting a specific attack class and subsystem combination.

Assign agents by attack class:

1. **Injection** — trace untrusted input to dangerous sinks (shell, template, SQL, eval)
2. **Access Control** — verify permission checks are correct for the correct resource; find bypass paths
3. **Resource and File Handling** — path traversal, SSRF, race conditions, unsafe deserialization
4. **Cryptography and Secrets** — hardcoded secrets, weak randomness, broken key derivation, timing channels
5. **Business Logic** — state machine violations, numeric manipulation, time-based flaws, race conditions
6. **Feature Abuse and Data Leakage** — export/import abuse, enumeration, notification hijacking, search oracles
7. **Chained Attacks** — combine individually-safe behaviors; cross-component trust gaps; second-order attacks
8. **Wildcard** — odd code, experimental features, undocumented paths, feature interactions

Each agent must:
- Trace complete code paths, not surface patterns
- Construct a concrete exploit before reporting: specific inputs, exact steps, expected outcome
- Verify other defensive layers don't already prevent exploitation
- Return ONLY confirmed findings with concrete attacks

See `references/hunting.md` and `references/attack-classes.md` for per-class prompts and heuristics.

## Phase 3 — Validation

Consolidate raw findings from Phase 2:
1. Deduplicate findings that describe the same root cause
2. For each unique finding, spawn a **separate validation agent** whose job is to disprove it

Validation agents apply five tests:
- **Exploitation test**: Verify the data flow exists; construct the triggering input
- **Impact test**: What does the attacker actually gain? Is it meaningful?
- **Baseline test**: Is this pattern common in comparable systems? Is it considered a vulnerability there?
- **Mitigation test**: Are there defensive layers (WAF, sanitizer, framework guard) that prevent exploitation?
- **Parser/runtime test**: Verify behavior against actual spec, not intuition

Hunting agents are biased toward finding things. Validation agents are biased toward killing false positives. The result after validation is the working finding list.

## Phase 4 — Report

Generate two markdown documents:

**`$AUDIT_DIR/REPORT.md`** — executive summary:
- Findings table: title, severity, confidence, one-line description
- Scope and methodology summary
- Overall risk posture

**`$AUDIT_DIR/FINDINGS-DETAIL.md`** — detailed findings:
- For each confirmed finding: description, root cause, data flow trace, conditions, exploit steps, remediation
- Rejected findings with brief rejection reasons (for auditability)

## Phase 5 — Structured Output

Generate `$AUDIT_DIR/findings.json` conforming to `references/report-schema.json`.

Required fields for each confirmed finding:
- `verdict`: `"confirmed"`
- `title`, `description`, `root_cause` (format: "[component] in [file] does not [missing action]")
- `trace`: sequential steps from entrypoint → propagation → sink, each with real file paths and line numbers verified against source
- `conditions`: auth level, user interaction, prerequisites
- `execution`: attacker perspective, specific payloads, step-by-step, expected result
- `remediation`: strategy and optional code patch
- `severity`: `likelihood` and `impact` (informational / low / medium / high / critical)
- `confidence`: score with reasoning

Rejected findings only need `verdict: "rejected"` and `reason`.

Validate the output:
```bash
node plugin/skills/security-audit/references/validate-findings.cjs "$AUDIT_DIR/findings.json"
```

Fix all validation errors before proceeding.

## Phase 6 — Independent Verification

Spawn a fresh agent with no prior context from this run. Provide only `findings.json` and the codebase.

The verifier checks every factual claim:
- Do the file paths in `trace` exist?
- Do the line numbers match the described code?
- Would the described payload actually reach the described sink?
- Is the severity rating consistent with the described impact?

If a claim is wrong: update the finding in `findings.json` with corrected facts, or change `verdict` to `"rejected"` with a correction note.

After verification, re-run the validator to confirm the output is still schema-valid.

## Severity framework

| Rating | Examples |
|--------|---------|
| CRITICAL | Unauthenticated RCE, full data breach, admin account takeover |
| HIGH | Authenticated RCE, SQLi with exfiltration, security boundary defeat |
| MEDIUM | Targeted XSS, CSRF, credential disclosure, limited-scope bypass |
| LOW | Non-secret info disclosure, difficult DoS, hardening gaps |
| INFORMATIONAL | Defense-in-depth improvement, no direct exploitability |

## Anti-patterns to avoid

- Treating OWASP as a checklist without verifying exploitability
- Reporting defense-in-depth gaps as vulnerabilities
- Ignoring deployment context (e.g. flagging a local-only file path as SSRF)
- Padding the report with trivial or theoretical findings
- Abandoning investigation after the first dead end — follow the full code path
- Reporting findings whose trace contains fictional file paths or line numbers

## Completion

When all six phases are done, report:
- `$AUDIT_DIR/architecture.md` — reconnaissance output
- `$AUDIT_DIR/REPORT.md` — executive summary
- `$AUDIT_DIR/FINDINGS-DETAIL.md` — detailed findings
- `$AUDIT_DIR/findings.json` — validated structured output
- Total confirmed findings by severity
- Any findings rejected during validation and why
