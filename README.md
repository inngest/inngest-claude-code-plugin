<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/inngest-wordmark-light.png">
    <img src="assets/inngest-wordmark.png" alt="Inngest" width="280">
  </picture>
</p>

# Inngest Plugin for Claude Code

The official Inngest plugin for Claude Code. One install, and Claude Code knows how to build reliable durable functions, design event-driven workflows, configure flow control, and stream realtime updates with [Inngest](https://www.inngest.com).

> **Beta:** v0.1.0 is the first public beta. We'd love your feedback — [open an issue](https://github.com/inngest/inngest-claude-code-plugin/issues), drop into our [Discord](https://www.inngest.com/discord), or ping [@inngest](https://twitter.com/inngest) on socials.

<!-- TODO: hero gif showing the plugin in action -->

## What's included

- **7 skills** covering setup, events, durable functions, steps, flow control, middleware, and realtime — Claude Code loads the right one automatically based on what you're building.
- **MCP server** for the local Inngest dev server. Claude Code can inspect runs, events, and function state on your machine while you work.
- **Eval harness** so you can verify the skills are actually steering Claude Code on your codebase (and contribute new prompts back).
- **More on the way** — commands, agents, and migrators are tracked in [ROADMAP.md](./ROADMAP.md).

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

1. Install the plugin (above).
2. Start your Inngest dev server in your project:

   ```bash
   npx inngest-cli@latest dev
   ```

3. Open Claude Code in your project and ask it something Inngest-shaped:

   ```
   "Add a durable function that sends a welcome email when a user signs up,
    retries on failure, and waits 24 hours before sending the second email."
   ```

   Claude Code picks up the relevant skill (`inngest-durable-functions`,
   `inngest-steps`, etc.), writes the function, registers it on your dev
   server's `/api/inngest` route, and triggers a test event through the MCP
   server so you can watch it run.

## Skills

| Skill | What it covers | When it triggers |
|-------|----------------|------------------|
| [`inngest-setup`](./skills/inngest-setup/) | SDK install, client config, serve endpoints (Next.js, Express, Hono, Fastify), connect-as-worker, dev server | Adding Inngest to a TypeScript project |
| [`inngest-durable-functions`](./skills/inngest-durable-functions/) | Function config, triggers, step execution, idempotency, cancellation, error handling, retries, observability | Building functions that survive crashes, retry, run on schedule |
| [`inngest-steps`](./skills/inngest-steps/) | `step.run`, `step.sleep`, `step.waitForEvent`, `step.invoke`, `step.ai`, parallel + loops | Durable delays, human-in-the-loop, polling, memoization |
| [`inngest-events`](./skills/inngest-events/) | Event schema, IDs for idempotency, fan-out patterns, system events | Designing event-driven workflows, decoupling services |
| [`inngest-flow-control`](./skills/inngest-flow-control/) | Concurrency, throttle, rate limit, debounce, priority, singleton, batching | Handling rate limits, deduping bursts, per-tenant fairness |
| [`inngest-middleware`](./skills/inngest-middleware/) | Lifecycle, dependency injection, Sentry + encryption middleware, custom middleware | Cross-cutting concerns: logging, tracing, DI, encryption |
| [`inngest-realtime`](./skills/inngest-realtime/) | v4 native realtime, channels, subscription tokens, `useRealtime` hook, SSE | Streaming workflow updates to a UI in real time |

## Dev server MCP

The plugin ships an `.mcp.json` that registers the local Inngest dev server's MCP endpoint with Claude Code:

```json
{
  "mcpServers": {
    "inngest-dev": {
      "type": "http",
      "url": "http://127.0.0.1:8288/mcp"
    }
  }
}
```

This lets the agent inspect runs, events, and function state on your local dev server while you're working.

**Port note:** the URL is hardcoded to `8288`, the dev server's default. If `8288` is already in use, the dev server falls back to `8289+` — in that case, edit the `url` in `.mcp.json` to point at the active port. Run `lsof -i :8288` (or check the dev server's startup output) to find which port it bound to.

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

This is v0.1.0. We're shipping early to learn from real usage:

- **What's missing:** open a [GitHub issue](https://github.com/inngest/inngest-claude-code-plugin/issues) — even a one-liner helps.
- **What's broken:** same place. Include the prompt and the skill that fired (or didn't).
- **What to build next:** chime in on [ROADMAP.md](./ROADMAP.md) discussions.
- **Real-time chat:** [Inngest Discord](https://www.inngest.com/discord) — there's a `#claude-code-plugin` channel.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the v0.x → v1.0 plan: more skills, slash commands, agents, migrators between SDK majors, and the path to the official Anthropic plugin marketplace.

## License

Apache 2.0. See [LICENSE](./LICENSE).
