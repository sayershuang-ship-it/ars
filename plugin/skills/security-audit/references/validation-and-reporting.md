# Phases 3–6: Validation, Reporting, and Verification

---

## Phase 3 — Validation

After Phase 2 produces raw findings, run validation before writing any report.

### Step 1: Deduplicate

Collect all findings from hunting agents. Group findings that describe the same root cause (same file, same sink, same mechanism). Keep the most detailed description; discard duplicates.

### Step 2: Spawn validation agents

For each unique finding, spawn a **separate validation agent** whose only job is to disprove it. These agents are adversarially positioned: they assume the finding is wrong and try to prove it.

**Validation agent instructions:**

You have been given a security finding. Your job is to determine whether it is real and exploitable. Assume it is wrong until proven otherwise.

Apply all five tests:

1. **Exploitation test**
   - Does the described data flow actually exist in the code?
   - Read the specific file and line numbers cited. Does the code do what the finding claims?
   - Construct the triggering input. Does it actually reach the described sink?

2. **Impact test**
   - If the exploit works, what does the attacker actually gain?
   - Is that impact meaningful given the application's deployment context?
   - Does the attacker need unusual prerequisites that reduce real-world risk?

3. **Baseline test**
   - Is this pattern common in similar applications?
   - Is it generally accepted as a vulnerability in that ecosystem, or a known acceptable tradeoff?

4. **Mitigation test**
   - Are there framework-level, middleware-level, or OS-level controls that prevent exploitation?
   - Does a WAF, CSP header, or runtime sandbox block the described attack?
   - If so, can those controls be bypassed or misconfigured?

5. **Parser/runtime behavior test**
   - Does the described parser behavior match the actual library specification?
   - Have you verified the runtime semantics, not just assumed them?

**Validation output:** `confirmed` (all tests pass) or `rejected` (with specific reason — cite the file and line that disproves the claim).

---

## Phase 4 — Report

Generate two documents after validation.

### REPORT.md (executive summary)

```markdown
# Security Audit Report

**Date**: <ISO date>
**Scope**: <full codebase or named subsystem>
**Auditor**: Claude (automated security audit via ars:security-audit)

## Summary

| Finding | Severity | Confidence |
|---------|----------|-----------|
| <title> | <critical/high/medium/low/info> | <high/medium/low> |

## Overall Risk Posture

<2-4 sentences: what the most significant risks are and what category of attacker they require>

## Methodology

Six-phase structured audit: reconnaissance → hunting → validation → reporting → structured output → independent verification.
```

### FINDINGS-DETAIL.md (technical detail)

For each confirmed finding:

```markdown
## [Title]

**Severity**: <rating> | **Confidence**: <rating>

### Description
<Comprehensive explanation of the vulnerability>

### Root Cause
[component] in [file:line] does not [missing action]

### Data Flow
1. `[file:line]` — [description of what happens here]
2. `[file:line]` — [description]
3. `[file:line]` — [sink reached]

### Conditions
- Authentication required: <yes/no/partial>
- Attacker position: <unauthenticated/authenticated/admin/network-adjacent>
- Additional prerequisites: <if any>

### Exploit
**Attacker**: <who>
**Steps**:
1. <step>
2. <step>
**Payload**: `<specific input>`
**Expected result**: <what the attacker gains>

### Remediation
<Concrete fix strategy>

```<optional code patch>```
```

For rejected findings, include a brief section:

```markdown
## Rejected: [Original Title]

**Reason**: <Why this was rejected — cite the code that disproves the claim>
```

---

## Phase 5 — Structured Output

Generate `findings.json` conforming to `report-schema.json`.

### Critical requirement

> "If you cannot fill `trace` with real file paths and line numbers verified against the source, the finding is not sufficiently verified."

Every `trace` entry must reference:
- `file`: a path that actually exists in the codebase
- `line`: a line number you have verified contains what you claim
- `kind`: `entrypoint` (first step), `propagation` (middle steps), or `sink` (last step)

The trace array must start with `kind: "entrypoint"` and end with `kind: "sink"`.

### Validation

After generating `findings.json`, run:

```bash
node plugin/skills/security-audit/references/validate-findings.cjs "$AUDIT_DIR/findings.json"
```

Fix all errors before proceeding to Phase 6. Common errors:
- Missing required fields on confirmed findings
- Trace that doesn't start with `entrypoint` or end with `sink`
- Invalid severity/likelihood/impact values

---

## Phase 6 — Independent Verification

Spawn a fresh agent with no memory of the prior phases. Provide:
- `findings.json`
- Access to the codebase

**Verifier instructions:**

You are an independent auditor verifying a security findings report. For each finding with `"verdict": "confirmed"`:

1. Check every file path in `trace` — does the file exist?
2. Check every line number — does the code at that line match the description?
3. Check the described exploit — would the payload actually reach the described sink given the code you see?
4. Check severity consistency — is the rating appropriate for the described impact?

If a claim is factually wrong:
- Update the finding with corrected file paths and line numbers, OR
- Change `"verdict"` to `"rejected"` and set `"reason"` to the specific factual error

After corrections, re-run the validator to confirm schema compliance.

**Verifier output:** Updated `findings.json` with a verification note added to each finding's `confidence.reasoning` field.
