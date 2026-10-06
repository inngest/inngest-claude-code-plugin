---
name: inngest-ci
description: Use when setting up CI for a TypeScript project with Inngest, writing or editing `@inngest/ci` pipelines and jobs (`ci.pipeline`, `ci.job`, `ci.matrix`, `from()`, `$` commands, caching), or running and debugging CI locally with `npx inngest-ci`. Covers installing `@inngest/ci`, the client, a first pipeline, the server, the `inngest.json` `ci` config, local run targets and flags, exit codes, `ci.local`, and reading failures.
---

# Inngest CI

`@inngest/ci` writes CI pipelines in TypeScript. Each pipeline is an Inngest function and each job runs on its own Inngest Sandbox. `inngest-ci` runs any pipeline or job locally against the working tree.

> **Inngest Labs.** `@inngest/ci` is early and its APIs may change between 0.x releases. The [package README](https://github.com/inngest/inngest-js/blob/main/packages/ci/README.md) is the source of truth: check it before using an API this skill does not show.

## Set up

Needs Node.js 20+, `inngest` 4.22.0+, an Inngest account with Sandboxes, and the Inngest CLI signed in once. `npx inngest-cli@latest login` is interactive: ask the user to run it.

```bash
npm install @inngest/ci inngest
npm install --save-dev inngest-cli
```

`ci/client.ts`:

```ts
import { Inngest } from "inngest";
import { createCi } from "@inngest/ci";

export const inngest = new Inngest({ id: "my-app" });
export const ci = createCi(inngest);
```

### Layout

One file per job and per pipeline, named after it. Create this layout, and follow it when adding to an existing project:

```
ci/
  client.ts          inngest and ci (createCi)
  helpers.ts         shared helpers
  jobs/base.ts       one job (or ci.matrix) per file
  jobs/lint.ts
  pipelines/pr.ts    one pipeline per file
  index.ts           imports every pipeline, re-exports ci
  server.ts          serves ci.functions()
```

Jobs `from()` the jobs they start from by importing their files. Pipelines import the jobs they call. Keep imports one way (pipelines to jobs to client) so none are circular. Import a job no pipeline calls in `index.ts` too, or it is not registered.

### A first pipeline

`base` checks out and installs once; `lint` and `test` each start from a copy of its machine and run in parallel. Match the install and script commands to the project's package manager. In each pipeline file, `ci.pipeline()` comes first with its options expanded.

`ci/jobs/base.ts`:

```ts
import { checkout, $ } from "@inngest/ci";
import { ci } from "../client";

export const base = ci.job("base", async () => {
  await checkout();
  await $`pnpm install`;
});
```

`ci/jobs/lint.ts` (`test.ts` is the same with `pnpm test` and `.retries(1)`):

```ts
import { from, $ } from "@inngest/ci";
import { ci } from "../client";
import { base } from "./base";

export const lint = ci.job("lint", async () => {
  await from(base);
  await $`pnpm lint`;
});
```

`ci/pipelines/pr.ts`:

```ts
import { github } from "@inngest/ci";
import { ci } from "../client";
import { lint } from "../jobs/lint";
import { test } from "../jobs/test";

export const pr = ci.pipeline(
  {
    id: "pr",
    on: github.pullRequest(),
    singleton: { key: "event.data.pull_request.number", mode: "cancel" },
  },
  async () => {
    await Promise.all([lint(), test()]);
  },
);
```

### The server

It must serve `ci.functions()` (the pipelines plus the functions CI needs) and listen on `PORT`, which `inngest-ci` sets.

`ci/index.ts`:

```ts
import "./pipelines/pr";

export { ci } from "./client";
```

`ci/server.ts`:

```ts
import { createServer } from "inngest/node";
import { inngest } from "./client";
import { ci } from "./index";

const server = createServer({ client: inngest, functions: ci.functions() });

server.listen(Number(process.env.PORT ?? 3000));
```

### Config

`inngest-ci` reads the `ci` key of `inngest.json` at the repository root. Without it, it starts `ci/server.{ts,mts,js,mjs}` with `tsx` or `node`.

```json
{
  "ci": {
    "start": "tsx ci/server.ts",
    "path": "/api/inngest",
    "dir": ".inngest/ci",
    "devServer": { "bin": "/path/to/inngest" }
  }
}
```

| Key | Default | Does |
| --- | --- | --- |
| `start` | | Shell command that serves the app on `PORT`. |
| `path` | `/api/inngest` | Where the app serves Inngest. |
| `dir` | `.inngest/ci` | Where runs keep the Dev Server's data and logs. |
| `devServer.bin` | | Path to a Dev Server binary. |

Add `.inngest/` to `.gitignore`.

## Run it

Always run CI non-interactively, from the repository root, and pick exactly what to run:

```bash
npx inngest-ci pr --no-interactive
npx inngest-ci lint --no-interactive
npx inngest-ci release --event push --no-interactive
npx inngest-ci deploy --data '{"env":"preview"}' --no-interactive
npx inngest-ci build --input '{"target":"web"}' --no-interactive
npx inngest-ci compat --node 22 --no-interactive
```

- The target is a pipeline ID or a job ID; a job target runs only that job. When a name is both, use `--pipeline <id>` or `--job <id>`.
- `--event <name>` picks the trigger of a pipeline with several. Without a terminal it is required for those.
- `--data <json>` is `event.data` for a `ci.manual()` trigger. `--input <json>` is a job's input.
- `--<axis> <value>` picks matrix combinations; with no axis flags every combination runs.

| Exit code | Meaning |
| --- | --- |
| `0` | Passed. |
| `1` | Failed or cancelled. |
| `2` | Setup error: missing config, unknown target, a Dev Server that did not start. The message says what to change. |

`inngest-ci` starts a Dev Server and the app for the run and stops both after. Never start a Dev Server or the app by hand for CI. The Dev Server comes from `INNGEST_CI_DEV_SERVER_BIN`, then `ci.devServer.bin`, then the project's `inngest-cli` package (1.45.1+).

Local runs use real Sandboxes. Guard steps that must not run from a laptop, such as releases and deploys, with `ci.local`:

```ts
if (ci.local) {
  return ci.skip("not publishing from a local run");
}
```

## Read a failure

- The output prints each transition, and a failure with the job, the reason and the run's URL, such as ``✕ pr / test  `pnpm test` exited with 1  → http://localhost:8288/run?runID=…``. The run's trace in the Dev Server shows each job and command.
- App and Dev Server logs are in `.inngest/ci/logs/app.log` and `.inngest/ci/logs/dev-server.log`.
- A failing command stops its job and the pipeline. Fix it, then rerun the narrowest target: the failed job alone (`npx inngest-ci test --no-interactive`), then the pipeline.
- `$` runs without a shell; use `` $.sh`…` `` for pipes and `&&`. Command output arrives when the command ends.

## Run on GitHub

Real CI starts pipelines from GitHub webhooks and reports checks through a GitHub App. Follow [Run on GitHub](https://github.com/inngest/inngest-js/blob/main/packages/ci/README.md#run-on-github) in the package README.

## More

The [package README](https://github.com/inngest/inngest-js/blob/main/packages/ci/README.md) covers triggers, matrices, caching, extra machines, checks and reports, and recipes. [`examples/ci-pipelines`](https://github.com/inngest/inngest-js/tree/main/examples/ci-pipelines) is a runnable example.
