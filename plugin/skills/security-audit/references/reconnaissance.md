# Phase 1: Reconnaissance — Agent Prompts

Launch all three agents in parallel. Their outputs feed `architecture.md`.

---

## Agent 1a — Application Fundamentals

You are a security researcher mapping an application before a vulnerability assessment.

Investigate:
1. What does this software do? Who are its users and how do they interact with it?
2. Technology stack: languages, frameworks, runtimes, package managers
3. Directory structure: what lives where and why?
4. External dependencies: npm packages, system binaries invoked, cloud APIs called
5. Build and deployment pipeline: how does code get to production?
6. Entry points: CLI commands, web routes, background jobs, cron tasks

Output a concise profile covering the above. Include specific file paths for each component identified.

---

## Agent 1b — Trust Model

You are a security researcher mapping trust boundaries before a vulnerability assessment.

Investigate:
1. What actors interact with the system? (unauthenticated users, authenticated users, admins, service accounts, external APIs)
2. What can each actor do? Where are those permissions enforced in code?
3. Authentication: how are identities established? What tokens, sessions, or keys are used?
4. Authorization: how is access to resources controlled? Are checks performed on the right resource, for the right operation?
5. Privilege boundaries: does the application ever escalate privileges? Under what conditions?
6. Trust assumptions: what does the application implicitly trust that an attacker might control?
7. Debug modes, admin flags, environment variables that change security posture

Output a trust map: actors → capabilities → enforcement locations (file:line). Flag any path that bypasses a check.

---

## Agent 1c — Input Surface Inventory

You are a security researcher cataloging where untrusted data enters an application.

Enumerate every location where external data arrives:
- Network: HTTP request bodies, query params, headers, cookies, WebSocket frames
- CLI: command-line arguments, stdin, environment variables
- Files: config files, uploaded files, imported data, template files
- IPC: inter-process messages, shared memory, named pipes
- External APIs: webhook payloads, API responses ingested and processed
- User-generated content: any data stored and later rendered or executed

For each input source, trace where that data flows. Flag paths that reach **dangerous sinks**:
- Shell execution: `exec`, `spawn`, `system`, backtick operators
- Template rendering: any templating engine with user-controlled input
- SQL or query builders: ORM calls with unsanitized values
- File writes: paths derived from user input
- `eval` or dynamic code execution
- Deserialization of untrusted data
- HTML rendering without escaping

Output a table: Input Source → Data Type → Dangerous Sink(s) → File:Line.

---

## Synthesis: architecture.md

Combine the three agents' output into `architecture.md`:

```markdown
# Application Architecture

## Overview
<1-2 paragraphs: what the app does, who uses it, deployment model>

## Technology Stack
<languages, frameworks, key packages>

## Trust Boundaries
<actors, their capabilities, enforcement locations>

## Input Surface
<table or list of input sources and their reachable sinks>

## Key Files
<paths identified as starting points for Phase 2, with brief notes>

## Complexity Flags
<anything warranting extra research before Phase 2>
```

The quality of Phase 2 depends entirely on the quality of this document. If the reconnaissance reveals a plugin system, multi-tenant architecture, or complex auth chain, launch additional research agents before proceeding.
