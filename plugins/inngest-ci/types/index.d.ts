/**
 * @module types
 *
 * The band's `$.state` contract: the lines it draws, already laid out by the
 * poller, and the CI sessions whose end Claude has been told about.
 */

/** A job's status, as the `inngest-ci` CLI reports it. */
export type CiStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped' | 'cached'

/** How a CI session reads at a glance: its mark and colour. */
export type CiTone = 'running' | 'failed' | 'passed' | 'cancelled' | 'lost'

/** One line of the band: one CI session. */
export type CiLine = {
  /** The CLI session's id. */
  id: string
  tone: CiTone
  /** Drawn faded: finished, or lost. */
  isDim: boolean
  /** The pipeline or job the session runs. */
  target: string
  /** The repository's short name, or the project folder's. */
  repo: string
  /** One per job, matrix combinations included, in order of first appearance. */
  ticks: CiStatus[]
  /** The command in flight, the failure, or how it ended. */
  detail: string
  /** Said quietly after `detail`: the job the command runs in. */
  aside: string
  /** `2m 14s` while running, `just now` or `3m ago` once ended. */
  time: string
  /** The run in the Dev Server, or the Dev Server before the run exists; null once that Dev Server has stopped. */
  url: string | null
  /** The command that reopens the run from saved history, once its Dev Server has stopped. */
  reopen: string | null
}

/** What the band draws: up to four lines, and a summary of the rest. */
export type CiView = {
  lines: CiLine[]
  /** `pr in inngest-js queued · nightly in inngest-js cancelled` */
  more: { count: number; text: string } | null
}

declare module 'claude-code' {
  interface PluginState {
    'inngest-ci': {
      view: CiView
      /** Sessions this Claude session started whose end Claude was told about. */
      told: string[]
      /** The project the set-up line offers to set up CI in, or null when it doesn't show. */
      setup: { root: string } | null
    }
  }
}
