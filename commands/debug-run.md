---
description: Inspect an Inngest run and trace, explain its failure, and fix the code when available
argument-hint: <run-id> [--prod]
---

# Debug an Inngest function run

Inspect the run in `$ARGUMENTS`. With `--prod`, use the connected Cloud MCP
server and load `inngest-cloud`. Resolve the intended environment explicitly.
Without `--prod`, use the local Dev Server connection; do not switch to Cloud
if the local server is unavailable.

For Cloud, use `get_run` and `get_run_trace`. For local runs, inspect the
configured local connection’s live tool schema first: newer servers expose
those tools, while older versions may expose `get_run_status` and
`poll_run_status`. Use the available read-only run tools and report any missing
trace capability. Fetch outputs only as needed, then explain the failure with
the run ID, step, and error.
If code is available and the user requests a fix, locate the implementation,
make the change, and run the relevant local checks. If the user only asked for
a diagnosis, stop after explaining it.

Use `inngest-api-cli` for explicit terminal workflows or missing MCP tools.
Use `inngest-api` for raw HTTP. Do not request an API key when OAuth MCP is
available. Don't invoke, rerun, or send an event as part of a read-only
investigation. A production verification run needs the user's authorization
because it executes real application side effects.
