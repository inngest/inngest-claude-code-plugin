# Inngest CI for Claude Code

> [!NOTE]
> **Inngest Labs, experimental.** This plugin follows [`@inngest/ci`](https://github.com/inngest/inngest-js/blob/main/packages/ci/README.md), an [Inngest Labs](https://www.inngest.com/docs/labs) project. Both are early and may change between releases.

See your local [`@inngest/ci`](https://github.com/inngest/inngest-js/blob/main/packages/ci/README.md) runs above the prompt, and let Claude set up and run Inngest CI by itself.

## What's included

- **A line per run, above the prompt.** Every `inngest-ci` run on this machine, whoever started it, gets one line: its status, pipeline or job, repository, a small square per job, the command in flight, the time, and whether Claude or you started it.

  ```
  ● pr       inngest-js ■■■□    pnpm test · test                              46s  Claude
  ● nightly  inngest    ■■■■■■■ pnpm test · compat (node:24, db:postgres)  2m 19s  Claude
  ✕ release  inngest-js ■■–     pnpm build exited with 1                 just now  you
  ```

  Green squares passed (pale from cache), blue is running, red failed, hollow is queued, and a dash was skipped. Passed runs dim and leave after a minute. Failed runs stay until the next run in that project, or for ten minutes. Past four runs, the rest fold into one `+ N more` line. With no runs, nothing shows.

- **Select a line to open its run** in the Dev Server. On the desktop app, click the pipeline name. In the terminal, click it, or press `ctrl+x tab` to focus the band and `enter` on a line.

- **Claude hears how its runs ended.** When a run Claude started ends, Claude's next prompt carries the target, the conclusion, the failed job and command, the failure, and the run's URL.

- **Claude runs CI the right way.** In a project that uses `@inngest/ci`, Claude and its subagents know to run `npx inngest-ci <pipeline|job> --no-interactive` with exact targets and flags, what the exit codes mean, and not to start a Dev Server or the app by hand.

- **The `inngest-ci` skill** sets up `@inngest/ci` in a TypeScript project, writes pipelines and jobs, runs them locally, and reads failures.

The plugin never approves a tool call for you.

## Installation

```
/plugin marketplace add inngest/inngest-claude-code-plugin
/plugin install inngest-ci@inngest-claude-code-plugin
```

The band needs a Claude Code build with plugin function hooks. The skill works everywhere.

## Try it

```
"Set up Inngest CI for this repo with lint and test jobs, then run it."
```

Claude installs `@inngest/ci`, writes the client, a pipeline and the server, configures `inngest.json`, and runs `npx inngest-ci pr --no-interactive`. The run appears above your prompt while it runs.

## Where the runs come from

The `inngest-ci` CLI writes one JSON file per run under `$INNGEST_CI_STATE_DIR`, else `$XDG_STATE_HOME/inngest-ci`, else `~/Library/Application Support/inngest-ci` on macOS, `%LOCALAPPDATA%\inngest-ci` on Windows, and `~/.local/state/inngest-ci` elsewhere. The band reads those files and nothing else.

## Development

```bash
claude plugin validate plugins/inngest-ci
claude plugin test plugins/inngest-ci
claude --plugin-dir plugins/inngest-ci
```
