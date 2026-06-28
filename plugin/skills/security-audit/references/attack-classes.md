# Attack Classes Reference

Use this reference to scope hunting agents. Assign one or more attack classes per agent based on the subsystem being investigated.

---

## 1. Injection

Trace untrusted input to dangerous execution sinks.

**What to look for:**
- Shell injection: `exec`, `spawn`, `execSync`, `child_process.*` with user-controlled arguments
- Template injection: template engines (Handlebars, EJS, Pug, Nunjucks) with user-controlled template strings
- Code injection: `eval`, `Function()`, `vm.runInContext` with external data
- Path injection: file operations where the path is derived from user input
- Log injection: user input written to logs that are parsed downstream
- Second-order injection: data stored safely but later used unsafely in a different context

**Hunting heuristics:**
- Search for shell invocations and trace every argument back to its source
- Look for string concatenation near dangerous sinks
- Check indirect paths: does user data flow through a queue, database, or cache before reaching the sink?
- Verify escaping is applied at the sink, not only at input time

---

## 2. Access Control

Verify that permission checks are correct, complete, and applied to the right resource.

**What to look for:**
- Missing authorization checks on privileged operations
- Checks on the wrong object (verifying permission for resource A while operating on resource B)
- IDOR: operations that accept a resource ID without verifying the caller owns that resource
- Horizontal privilege escalation: user A accessing user B's data
- Vertical privilege escalation: low-privilege user gaining admin capabilities
- Mass assignment: accepting untrusted object fields that include privilege attributes
- Forced browsing: endpoints accessible without authentication

**Hunting heuristics:**
- List every privileged operation; for each, find where the permission check occurs in the call stack
- Check whether the checked resource ID and the operated-on resource ID are always the same value
- Look for admin/debug routes that bypass normal checks
- Test whether authentication middleware applies to all routes or only some

---

## 3. Resource and File Handling

Investigate file operations, network requests, and resource management.

**What to look for:**
- Path traversal: `../` sequences or absolute paths in file operations derived from user input
- SSRF: user-controlled URLs fetched by the server; check for internal network access
- Zip slip: archive extraction where member paths escape the target directory
- Race conditions: TOCTOU (time-of-check/time-of-use) on file or resource access
- Unsafe deserialization: parsing untrusted data with formats that execute code (pickle, Java serialization, YAML with custom tags)
- Resource exhaustion: operations with no size or rate limits on user-controlled inputs

**Hunting heuristics:**
- Find all `fs.*`, `path.join`, `path.resolve` calls; trace path components back to user input
- Find all HTTP client calls (fetch, axios, got, node-fetch); check if the URL is user-controlled
- For file extraction, check if the library validates member paths before writing

---

## 4. Cryptography and Secrets

Find weak or missing cryptographic controls and hardcoded sensitive values.

**What to look for:**
- Hardcoded credentials, API keys, tokens, or passwords in source code or config files
- Weak randomness: `Math.random()` for security-sensitive values (tokens, session IDs, nonces)
- Broken key derivation: MD5/SHA1 for passwords, missing salt, low iteration count
- Timing side-channels: string comparison with `===` instead of constant-time compare for secrets
- Crypto primitive misuse: ECB mode, reused IVs, unauthenticated encryption
- Secret leakage: credentials in logs, error messages, URLs, or client-facing responses

**Hunting heuristics:**
- Grep for hardcoded strings that look like credentials: API keys, tokens, passwords
- Find all random number generation; verify crypto-safe source for security contexts
- Find all password hashing; verify bcrypt/argon2/scrypt with appropriate parameters
- Find all HMAC/signature verification; check for timing-safe comparison

---

## 5. Business Logic

Find flaws in the application's intended behavior rather than its implementation.

**What to look for:**
- State machine violations: operations that should only be valid in certain states
- Numeric manipulation: integer overflow, floating-point precision, currency rounding
- Race conditions with business impact: double-spend, double-submit, concurrent state transitions
- Time-based logic flaws: expiry checks that can be bypassed, replay of time-limited tokens
- Access boundary violations: operations that should be limited but accept arbitrary scope

**Hunting heuristics:**
- Map the state machine for key workflows; test operations in unexpected sequences
- Find all numeric comparisons on business-critical values; check for overflow/underflow
- Find all time-based checks; verify the reference clock is trustworthy and expiry is enforced server-side
- Find all rate-limited operations; test whether limits are per-user, per-IP, or global

---

## 6. Feature Abuse and Data Leakage

Investigate how legitimate features can be turned into attack vectors.

**What to look for:**
- Export abuse: export features that leak data beyond the user's authorized scope
- Import injection: importing attacker-controlled data that gets processed with elevated trust
- Search oracles: search endpoints that reveal existence of resources the caller shouldn't see
- Enumeration: predictable IDs or paginated endpoints that allow iterating over all records
- Notification hijacking: webhooks or callbacks where the target URL is user-controlled
- Reflection: any user-supplied value echoed back in a response (potential XSS or information disclosure)

**Hunting heuristics:**
- Find all export/download endpoints; verify scope limits are applied
- Find all search endpoints; check whether results are filtered to the caller's authorized scope
- Find all webhook/callback mechanisms; verify the target URL is validated or whitelisted

---

## 7. Chained Attacks and Trust Boundaries

Find vulnerabilities that require combining multiple lower-severity issues or crossing trust boundaries.

**What to look for:**
- Combinations of individually-safe behaviors that together create an exploit
- Cross-component trust gaps: component A trusts component B's output without re-validation
- Second-order attacks: input stored safely at write time, but unsafely used later
- Trust boundary violations: data crossing from untrusted to trusted context without re-validation
- CSRF on state-changing operations without proper token validation

**Hunting heuristics:**
- Map every trust boundary in `architecture.md`; at each boundary, check what validation is re-applied
- Find all stored data that is later rendered or executed; trace write path and read path separately
- Look for operations that require multiple steps; check if partial completion leaves the system in an exploitable state

---

## 8. Wildcard

Investigate anything that doesn't fit the above categories.

**What to look for:**
- Unusual code patterns that lack obvious explanation
- Experimental or undocumented features
- Feature interactions that were clearly not designed together
- Anything that would surprise a developer familiar with the codebase

**Hunting heuristics:**
- Read the `TODO`, `FIXME`, `HACK`, `XXX` comments — they often mark known issues
- Check for commented-out security checks
- Look for debug endpoints, admin backdoors, or test credentials left in production paths
- Review the most recently changed files for hastily written code

---

## Obvious Things (always check)

Regardless of assigned class, every hunter must verify:

- [ ] No hardcoded credentials in source files, config, or `.env.example`
- [ ] No debug mode, test mode, or admin bypass enabled by a simple flag
- [ ] No unprotected endpoints serving sensitive data
- [ ] No dependency with a known critical CVE (run `npm audit` or equivalent)
- [ ] CORS policy is not `Access-Control-Allow-Origin: *` on credentialed endpoints
- [ ] No sensitive data in client-accessible locations (public directory, response headers)
