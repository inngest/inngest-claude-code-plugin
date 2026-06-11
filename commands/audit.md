---
description: Audit this codebase for durability gaps — find anti-patterns, prioritize them, and propose Inngest refactors
argument-hint: [path] [--apply]
---

# Audit a codebase for durability gaps

Audit the codebase at `$ARGUMENTS` (default: the current repository) for durability gaps using the `inngest-brownfield-audit` skill. Load that skill for the full discovery and detection methodology.

Follow this flow:

1. **Discover.** Map the repo: framework, package manager, existing job/queue infrastructure, and whether Inngest is already present. Use the skill's detection commands to find anti-patterns: `setTimeout`/`setInterval` for scheduled work, polling loops, manual retry loops, fire-and-forget detached Promises, queue libraries (BullMQ, Bee-Queue, node-cron), long-running HTTP handlers, webhooks that don't ack fast, and unprotected AI/LLM call sites.

2. **Report.** Produce a prioritized findings list. For each hotspot: file and line, the anti-pattern, severity (how likely it is to lose work in production), and the specific Inngest refactor (which primitive — function, step.run, step.sleep, flow control — and why). Lead with the highest-severity findings. Do not pad the list; if the codebase is already durable, say so.

3. **Apply (only with `--apply` or explicit approval).** Refactor hotspots one at a time, highest severity first, pairing the relevant domain skill (`inngest-setup`, `inngest-durable-functions`, `inngest-steps`, `inngest-flow-control`) for the code patterns. After each refactor, verify: run existing tests, and if a dev server is running, register the function and trigger a test event through it.

Without `--apply`, stop after the report. The report is the deliverable; don't change code the user hasn't seen a plan for.
