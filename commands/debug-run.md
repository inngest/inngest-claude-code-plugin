---
description: Inspect an Inngest run and trace, explain its failure, and fix the code when available
argument-hint: <run-id> [--prod]
---

# Debug an Inngest function run

Inspect the run in `$ARGUMENTS`. With `--prod`, use the connected Cloud MCP
server and load `inngest-cloud`. Resolve the intended environment explicitly.
Without `--prod`, use the local Dev Server connection; do not switch to Cloud
if the local server is unavailable.

Use `get_run` and `get_run_trace` to identify failed or waiting spans, fetching
outputs only as needed. Explain the failure with the run ID, step, and error.
If code is available and the user requests a fix, locate the implementation,
make the change, and run the relevant local checks. If the user only asked for
a diagnosis, stop after explaining it.

Use `inngest-api-cli` for explicit terminal workflows or missing MCP tools.
Use `inngest-api` for raw HTTP. Do not request an API key when OAuth MCP is
available. Don't invoke, rerun, or send an event as part of a read-only
investigation. A production verification run needs the user's authorization
because it executes real application side effects.
