---
description: Debug an Inngest function run from its run ID — pull the trace, find the failing step, propose a fix, verify locally
argument-hint: <run-id> [--prod]
---

# Debug an Inngest function run

Debug the Inngest function run with ID `$ARGUMENTS` using the `inngest api` commands. Load the `inngest-api-cli` skill for the full command reference; use `inngest-api` only if raw REST API v2/OpenAPI fallback is needed.

Follow this loop:

1. **Resolve the target.** If the arguments include `--prod`, target Inngest Cloud (requires `$INNGEST_API_KEY`; if it's missing, stop and ask the user to create a key at https://app.inngest.com/settings/api-keys). Otherwise target the local dev server — verify it's up with `npx inngest-cli@latest api health` first.

2. **Get the run summary.**

   ```bash
   npx inngest-cli@latest api [--prod] get-function-run <run-id>
   ```

   Report status, function, trigger, and timing. If the run is `QUEUED` or `RUNNING`, say so and offer to poll instead of debugging.

3. **Pull the trace with outputs.**

   ```bash
   npx inngest-cli@latest api [--prod] get-function-trace <run-id> --include-output
   ```

   Filter for failures: `jq '[.data.rootSpan.children[] | select(.status == "FAILED")]'`. Check nested children too. Also look for `WAITING` spans if the run appears stuck rather than failed.

4. **Diagnose from real data.** Read the failing step's `output` (the actual error), its `stepOp`, and its `input` if present. Locate the corresponding `step.run` / step call in the codebase and explain the root cause. Work from the trace, not from guessing.

5. **Propose and apply the fix** (with the user's normal review flow for code changes).

6. **Verify locally.** Invoke the function against the dev server with representative data:

   ```bash
   npx inngest-cli@latest api invoke-function <app-id> <function-id> --data '<json>'
   ```

   Take the `runId` from the response and re-run step 3 against it to confirm every span is `COMPLETED`. Report the before/after.

Never invoke against `--prod` to verify a fix unless the user explicitly asks — production invokes execute real side effects.
