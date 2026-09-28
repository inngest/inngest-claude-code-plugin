<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/inngest-wordmark-light.png">
    <img src="assets/inngest-wordmark.png" alt="Inngest" width="280">
  </picture>
</p>

# Inngest Plugin for Claude

Connect your Inngest account through OAuth to inspect Cloud apps, functions,
events, runs, traces, and Insights. Coding skills also help build durable
functions and agents, audit codebases, configure flow control and realtime,
and migrate SDK versions. Cloud operations work in chat; repository edits and
local commands require a coding host.

> **Development:** v0.4.0 adds Cloud OAuth MCP. Directory submission is pending. We'd love your feedback — [open an issue](https://github.com/inngest/inngest-claude-code-plugin/issues), drop into our [Discord](https://www.inngest.com/discord), or ping [@inngest](https://twitter.com/inngest) on socials.

## What's included

- **14 skills** covering setup, events, durable functions, steps, flow control, middleware, realtime, AI agents, CLI/dev-server workflows, API CLI operations, REST API fallback, brownfield audits, and v3→v4 migration — Claude Code loads the right one automatically based on what you're building.
- **Cloud OAuth MCP.** Connect your account in the host and use `inngest-cloud` to inspect deployed apps, functions, runs, traces, events, and Insights. CLI and REST skills remain available for terminal or raw HTTP work.
- **`/inngest:debug-run` command** — hand Claude Code a run ID and it pulls the trace, explains the failing step, and fixes the code when requested.
- **`/inngest:audit` command** — point Claude Code at an existing codebase and it finds durability gaps (polling loops, manual retries, fire-and-forget promises, queue libraries), prioritizes them, and proposes Inngest refactors.
- **Cloud MCP connection** bundled by default, with an optional local Dev Server connection for Claude Code.
- **Eval harness** so you can verify the skills are actually steering Claude Code on your codebase (and contribute new prompts back).
- **More on the way** — competitor migrations (Temporal, Trigger.dev) are tracked in [ROADMAP.md](./ROADMAP.md).

## Installation

### Claude Code marketplace

```
/plugin marketplace add inngest/inngest-claude-code-plugin
/plugin install inngest@inngest-claude-code-plugin
```

### Local clone

```bash
git clone https://github.com/inngest/inngest-claude-code-plugin.git
cd your-project/
claude --plugin-dir /path/to/inngest-claude-code-plugin
```

## Quick start

1. Install the plugin from this repository's marketplace for Claude Code.
2. Open `/mcp` and complete OAuth sign-in for the Inngest Cloud connection.
3. Ask: "In staging, find recent failed runs and explain the failed steps."

For local development, start your app and `inngest dev`, then add the optional
local MCP connection described below. Coding skills remain available for
building workflows, auditing code, and SDK migrations.

For hosted Claude, use the endpoint as a custom connector while the directory
submission is pending. The connector provides tools; the plugin bundle adds
skills. See [submission materials](docs/submission.md).

## Skills

| Skill | What it covers | When it triggers |
|-------|----------------|------------------|
| [`inngest-cloud`](./skills/inngest-cloud/) | OAuth MCP operations and run diagnosis | Inspecting deployed environments, apps, functions, runs, traces, events, and Insights |
| [`inngest-setup`](./skills/inngest-setup/) | SDK install, client config, serve endpoints (Next.js, Express, Hono, Fastify), connect-as-worker, dev server | Adding Inngest to a TypeScript project |
| [`inngest-durable-functions`](./skills/inngest-durable-functions/) | Function config, triggers, step execution, idempotency, cancellation, error handling, retries, observability | Building functions that survive crashes, retry, run on schedule |
| [`inngest-steps`](./skills/inngest-steps/) | `step.run`, `step.sleep`, `step.waitForEvent`, `step.invoke`, `step.ai`, parallel + loops | Durable delays, human-in-the-loop, polling, memoization |
| [`inngest-events`](./skills/inngest-events/) | Event schema, IDs for idempotency, fan-out patterns, system events | Designing event-driven workflows, decoupling services |
| [`inngest-flow-control`](./skills/inngest-flow-control/) | Concurrency, throttle, rate limit, debounce, priority, singleton, batching | Handling rate limits, deduping bursts, per-tenant fairness |
| [`inngest-middleware`](./skills/inngest-middleware/) | Lifecycle, dependency injection, Sentry + encryption middleware, custom middleware | Cross-cutting concerns: logging, tracing, DI, encryption |
| [`inngest-realtime`](./skills/inngest-realtime/) | v4 native realtime, channels, subscription tokens, `useRealtime` hook, SSE | Streaming workflow updates to a UI in real time |
| [`inngest-cli`](./skills/inngest-cli/) | CLI and Dev Server workflows: `inngest dev`, local testing, Docker, MCP setup, deployment checks, self-hosted `inngest start` | Local development, testing, self-hosted server operations |
| [`inngest-api-cli`](./skills/inngest-api-cli/) | `inngest api` commands, API keys, run traces, direct invocation, app syncs, Insights SQL | Debugging failed runs, scripting against Inngest, CI/CD |
| [`inngest-api`](./skills/inngest-api/) | REST API v2 and OpenAPI fallback | Raw HTTP, OpenAPI, endpoint request shapes |
| [`inngest-agents`](./skills/inngest-agents/) | AgentKit, `step.ai`, tool calls, multi-agent networks, human approval, realtime progress | Building durable AI agents and agentic workflows |
| [`inngest-brownfield-audit`](./skills/inngest-brownfield-audit/) | Repo discovery, durability anti-pattern detection, incremental integration planning | Introducing Inngest to an existing codebase |
| [`inngest-v3-v4-migration`](./skills/inngest-v3-v4-migration/) | Usage detection, trigger/schema/serve/realtime API changes, verification | Upgrading from SDK v3 to v4, fixing mixed v3/v4 usage |

## Debug runs from the terminal

For Cloud investigations in chat, prefer the OAuth MCP connection and
`inngest-cloud`. The commands below are for explicit terminal workflows.

The [`inngest-api-cli`](./skills/inngest-api-cli/) skill gives the agent programmatic access to real execution data through the [Inngest CLI's `api` commands](https://www.inngest.com/docs/cli). The [`inngest-api`](./skills/inngest-api/) skill covers raw REST API v2 and OpenAPI fallback.

```bash
# Run summary
npx inngest-cli@latest api --prod get-function-run 01KTCTWT8XDEGWDMVX3Q9M69ND

# Full step trace, with outputs
npx inngest-cli@latest api --prod get-function-trace 01KTCTWT8XDEGWDMVX3Q9M69ND --include-output

# Runs triggered by an event
npx inngest-cli@latest api --prod get-event-runs 01KTCTWSZJEKAFEDA4F9GYHFQW --limit 5

# Invoke a function directly
npx inngest-cli@latest api invoke-function my-app my-function --data '{"message": "hello"}'
```

The CLI targets the local dev server by default (no API key needed); `--prod` targets Inngest Cloud with an [API key](https://www.inngest.com/docs/platform/api-keys) from `$INNGEST_API_KEY`. The skills ship complete references for [every CLI command](./skills/inngest-api-cli/references/cli-commands.md) and [every v2 endpoint](./skills/inngest-api/references/rest-api-v2.md), so the agent can work the whole surface — including finding run IDs itself via Insights SQL — without a human driving.

Or just run the command:

```
/inngest:debug-run 01KTCTWT8XDEGWDMVX3Q9M69ND --prod
```

Claude Code pulls the trace and explains the failed step. If you request a fix,
it updates the code and runs the relevant local checks.

## Cloud MCP and OAuth

The plugin bundles `https://api.inngest.com/mcp` using Streamable HTTP. Connect
through your host's OAuth sign-in flow, choose the Inngest account and access,
and return to the conversation. No API key or client secret belongs in the
plugin configuration. The connection uses OAuth discovery and CIMD.

Try: "In staging, find recent failed runs and explain the failed steps."
The `inngest-cloud` skill resolves the environment and uses live tools and
schemas. Cloud reads work in chat; editing a repository and running local
commands require a coding host. Writes such as sending events, invoking
functions, rerunning, cancelling, and syncing apps can affect your application.

If a call needs authentication, reconnect in the host. If it is denied, check
the selected account, environment, and grants. An access error does not mean
that a run or function is missing.

### Optional local Dev Server

Ask: "Set up local Inngest Dev Server MCP for this project alongside Cloud."
The `inngest-cli` skill checks the running port, reuses an existing connection,
and verifies the local apps. See [local setup and removal](skills/inngest-cli/references/local-mcp.md).

Cloud and local can stay connected together. Requests for local apps use
`inngest-dev`; requests for deployed apps use `inngest-cloud`. A local
connection failure never redirects the operation to Cloud.

Local MCP is no longer installed automatically. Keep it as a separate
connection when developing on your machine. Start `inngest dev`, then add it:

```bash
claude mcp add --scope local --transport http inngest-dev http://127.0.0.1:8288/mcp
```

Use the actual port from the Dev Server's startup output if it differs from
8288. The Cloud connection remains separate. Hosted chat cannot reach localhost.

See [submission materials](docs/submission.md) for directory packaging, listing
copy, reviewer tests, and the remaining release gates. This repository can be
installed for development before a directory listing is approved.

## What you can do

### Build a retry-safe webhook handler

```
"I'm getting Stripe webhooks. Wrap the handler in an Inngest function that
 retries on failure and dedupes on event ID."
```

→ Plugin generates the serve endpoint, the function with `id` set as the idempotency key, and the step.run blocks for each side effect.

### Add concurrency limits to an OpenAI-heavy function

```
"This function calls OpenAI on every event. Add concurrency: max 5 in
 flight per user, throttle the org to 100/min."
```

→ Plugin writes the `concurrency` and `throttle` config keyed by user/org.

### Stream agent tokens to a Next.js page in realtime

```
"Run this LLM agent as an Inngest function and stream its tokens to a
 React component."
```

→ Plugin sets up a typed channel, publishes from inside `step.run`, mints a subscription token via a server action, and writes the client component using the `useRealtime` hook.

### Debug a production failure from a log line

```
"This run failed in production: 01KTCTWT8XDEGWDMVX3Q9M69ND. Figure out why
 and fix it."
```

→ Plugin pulls the run summary and full step trace via `inngest api`, isolates the `FAILED` span, reads the real error output, fixes the step code, and verifies by invoking the function locally.

### Find the durability gaps in a legacy codebase

```
/inngest:audit
```

→ Plugin maps the repo, flags polling loops, manual retries, `setTimeout` scheduling, fire-and-forget promises, and queue libraries, then produces a prioritized report with a specific Inngest refactor per hotspot. Add `--apply` to refactor highest-severity first, with tests.

### Upgrade from SDK v3 to v4

```
"We're on inngest v3. Upgrade us to v4."
```

→ Plugin detects current usage, moves triggers into `createFunction` options, replaces `EventSchemas`, updates serve options and realtime imports, rewrites `step.invoke` string IDs, and verifies the result.

## Skills source of truth

The skills in this plugin are mirrored from [`inngest/inngest-skills`](https://github.com/inngest/inngest-skills) — that's where they're authored and where skills.sh users install them. This plugin pulls them in via `scripts/sync-skills.sh` so the Claude Code experience stays in lockstep with the skills.sh experience.

## Eval harness

Inside `eval/` is a prompt catalog and runner you can use to verify the plugin is actually steering Claude Code on real Inngest-shaped tasks.

```bash
cd eval/runner
./run.sh
```

See [`eval/README.md`](./eval/README.md) for prompt format, judge config, and how to add your own.

## Beta feedback

This is the v0.4.0 development candidate. We're shipping early to learn from real usage:

- **What's missing:** open a [GitHub issue](https://github.com/inngest/inngest-claude-code-plugin/issues) — even a one-liner helps.
- **What's broken:** same place. Include the prompt and the skill that fired (or didn't).
- **What to build next:** chime in on [ROADMAP.md](./ROADMAP.md) discussions.
- **Real-time chat:** [Inngest Discord](https://www.inngest.com/discord) — there's a `#claude-code-plugin` channel.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the v0.x → v1.0 plan: more skills, slash commands, agents, migrators between SDK majors, and the path to the official Anthropic plugin marketplace.

## License

Apache 2.0. See [LICENSE](./LICENSE).
