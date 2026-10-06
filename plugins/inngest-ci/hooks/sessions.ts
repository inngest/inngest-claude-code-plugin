/**
 * @module sessions
 *
 * Pure logic over the session files the `inngest-ci` CLI writes: parsing a
 * file, deciding which sessions the band shows and how, laying them out as
 * lines, and the note Claude reads when a session it started ends. No `$`
 * here, so every rule is a plain function of the files and the time.
 */

import type { CiLine, CiStatus, CiTone, CiView } from '../types'

/** A session file, version 1. Unknown fields are ignored. */
export type CiSession = {
  v: 1
  sessionId: string
  pid: number
  startedAt: number
  updatedAt: number
  endedAt?: number
  /** When the CLI exited: its Dev Server is gone, so run URLs no longer open. */
  closedAt?: number
  startedBy: { kind: 'claude'; sessionId?: string } | { kind: 'user' }
  project: { root: string; name: string }
  repo?: { fullName?: string }
  target: { kind: 'pipeline' | 'job'; id: string; trigger?: string }
  devServerUrl?: string
  conclusion: 'running' | 'passed' | 'failed' | 'cancelled' | 'setup-error'
  setupError?: string
  runs: CiRun[]
}

type CiRun = {
  runId?: string
  url?: string
  /** Why the run failed, when it failed outside a job's commands too. */
  reason?: string
  jobs: CiJob[]
}

type CiJob = {
  id: string
  status: CiStatus
  command?: { name: string; attempt?: number }
  /** What the job is doing while no command runs, like `creating machine…`. */
  activity?: string
  title?: string
}

/** A live session with no update for this long is lost: the CLI writes at least every 15s while it runs. */
const STALE_MS = 60_000

/** How long a finished or lost session stays, dimmed. */
const LINGER_MS = 60_000

/** How long a failed session stays when no later one in its project starts. */
const FAILED_MS = 10 * 60_000

/** Lines drawn before the rest fold into `+ N more`. */
const MAX_LINES = 4

const RANK: Record<CiTone, number> = { running: 0, failed: 1, lost: 2, passed: 3, cancelled: 3 }

const WORD: Record<CiTone, string> = { running: 'running', failed: 'failed', lost: 'lost', passed: 'passed', cancelled: 'cancelled' }

/** Parses a session file, or answers null for one this version does not read. */
export function parseSession(text: string): CiSession | null {
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch {
    return null
  }

  const s = data as Partial<CiSession> | null
  const isReadable =
    s?.v === 1 &&
    typeof s.sessionId === 'string' &&
    typeof s.startedAt === 'number' &&
    typeof s.updatedAt === 'number' &&
    typeof s.target?.id === 'string' &&
    typeof s.project?.root === 'string'

  if (!isReadable) {
    return null
  }

  return { ...(s as CiSession), runs: Array.isArray(s.runs) ? s.runs : [] }
}

/** The band's lines at `now`: only the sessions this Claude session (`me`) started, subagents included. */
export function viewOf(all: readonly CiSession[], now: number, me: string): CiView {
  const sessions = all.filter(s => {
    return isMine(s, me)
  })

  const shown = sessions
    .map(s => {
      return { s, tone: toneOf(s, now, sessions) }
    })
    .filter((item): item is { s: CiSession; tone: CiTone } => {
      return item.tone !== null
    })
    .sort((a, b) => {
      return RANK[a.tone] - RANK[b.tone] || b.s.startedAt - a.s.startedAt
    })
    .map(({ s, tone }) => {
      return lineOf(s, tone, now)
    })

  const lines = shown.length > MAX_LINES ? shown.slice(0, MAX_LINES) : shown
  const rest = shown.slice(lines.length)
  const more = rest.length
    ? {
        count: rest.length,
        text: rest
          .map(line => {
            return `${line.target} in ${line.repo} ${WORD[line.tone]}`
          })
          .join(' · '),
      }
    : null

  return { lines, more }
}

/** The title's summary of the lines drawn: `2 running · 1 failed`, in the band's order. */
export function summaryOf(view: CiView): string {
  const counts = new Map<CiTone, number>()

  for (const line of view.lines) {
    counts.set(line.tone, (counts.get(line.tone) ?? 0) + 1)
  }

  return [...counts]
    .sort(([a], [b]) => {
      return RANK[a] - RANK[b]
    })
    .map(([tone, count]) => {
      return `${count} ${WORD[tone]}`
    })
    .join(' · ')
}

/** How a session reads now, or null once it is gone from the band. */
function toneOf(s: CiSession, now: number, all: readonly CiSession[]): CiTone | null {
  if (s.endedAt === undefined) {
    const silence = now - s.updatedAt

    if (silence <= STALE_MS) {
      return 'running'
    }

    return silence <= STALE_MS + LINGER_MS ? 'lost' : null
  }

  if (s.conclusion === 'failed' || s.conclusion === 'setup-error') {
    const isSuperseded = all.some(other => {
      return other.project.root === s.project.root && other.startedAt > s.startedAt
    })

    return isSuperseded || now - s.endedAt > FAILED_MS ? null : 'failed'
  }

  if (now - s.endedAt > LINGER_MS) {
    return null
  }

  return s.conclusion === 'cancelled' ? 'cancelled' : 'passed'
}

function lineOf(s: CiSession, tone: CiTone, now: number): CiLine {
  const jobs = s.runs.flatMap(run => {
    return run.jobs ?? []
  })

  const { detail, aside } = describe(s, tone, jobs)
  const isServing = isDevServerUp(s, now)
  const runId = s.runs.at(-1)?.runId

  return {
    id: s.sessionId,
    tone,
    isDim: tone !== 'running' && tone !== 'failed',
    target: s.target.id,
    repo: s.repo?.fullName?.split('/').pop() || s.project.name,
    ticks: jobs.map(job => {
      return job.status
    }),
    detail,
    aside,
    time: timeOf(s, tone, now),
    url: isServing ? linkable(s.runs.at(-1)?.url ?? s.devServerUrl) : null,
    reopen: !isServing && runId ? reopenCommand(runId) : null,
  }
}

/**
 * Whether the session's Dev Server still answers: the CLI hasn't exited, and
 * it's still writing (it heartbeats every 15s, so silence means it was killed).
 */
function isDevServerUp(s: CiSession, now: number): boolean {
  return s.closedAt === undefined && now - s.updatedAt <= STALE_MS
}

function reopenCommand(runId: string): string {
  return `npx inngest-ci open ${runId}`
}

function describe(s: CiSession, tone: CiTone, jobs: readonly CiJob[]): { detail: string; aside: string } {
  if (tone === 'lost') {
    return { detail: 'stopped reporting', aside: '' }
  }

  if (tone === 'cancelled') {
    return { detail: 'cancelled', aside: '' }
  }

  if (tone === 'passed') {
    return { detail: `passed in ${duration((s.endedAt ?? s.updatedAt) - s.startedAt)}`, aside: '' }
  }

  if (tone === 'failed') {
    return { detail: failureOf(s, jobs), aside: '' }
  }

  const current = jobs.findLast(job => {
    return job.status === 'running'
  })

  if (current?.command) {
    const attempt = (current.command.attempt ?? 1) > 1 ? ` · attempt ${current.command.attempt}` : ''

    // `$` marks a command, so it reads apart from a status like `cached`.
    return { detail: `$ ${current.command.name}${attempt}`, aside: current.id }
  }

  if (current?.activity) {
    return { detail: current.activity, aside: current.id }
  }

  if (current) {
    return { detail: current.id, aside: '' }
  }

  return { detail: s.runs.length ? 'queued' : 'starting', aside: '' }
}

/** The one-line reason a session failed. */
function failureOf(s: CiSession, jobs: readonly CiJob[]): string {
  if (s.conclusion === 'setup-error') {
    return s.setupError?.split('\n')[0] || 'setup failed'
  }

  const job = failedJob(jobs)

  if (job?.title) {
    return job.title.replaceAll('`', '')
  }

  if (job?.command) {
    return `$ ${job.command.name} failed`
  }

  return runReason(s) ?? 'failed'
}

/** The latest run's failure reason, on one line. */
function runReason(s: CiSession): string | undefined {
  return s.runs.at(-1)?.reason?.split('\n')[0] || undefined
}

function failedJob(jobs: readonly CiJob[]): CiJob | undefined {
  return jobs.find(job => {
    return job.status === 'failed'
  })
}

function timeOf(s: CiSession, tone: CiTone, now: number): string {
  if (tone === 'running') {
    return duration(now - s.startedAt)
  }

  const ago = now - (s.endedAt ?? s.updatedAt)

  if (ago < 60_000) {
    return 'just now'
  }

  const minutes = Math.floor(ago / 60_000)

  return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`
}

/** `41s`, `2m 14s`, `1h 3m`. */
export function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** The URL as a band Link takes it: `https:`, or `http://localhost` for the Dev Server on a loopback address. */
export function linkable(url: string | undefined): string | null {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)

    if (parsed.protocol === 'https:') {
      return parsed.href
    }

    if (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
      parsed.hostname = 'localhost'

      return parsed.href
    }
  } catch {
    return null
  }

  return null
}

/** Whether this Claude session (or one of its subagents, which share its id) started the session. */
export function isMine(s: CiSession, me: string): boolean {
  return s.startedBy?.kind === 'claude' && s.startedBy.sessionId === me
}

/** Whether this Claude session started the session and it has ended. */
export function isMineAndEnded(s: CiSession, me: string): boolean {
  return s.endedAt !== undefined && isMine(s, me)
}

/** The few lines Claude reads beside its next prompt once a session it started ends. */
export function endingNote(s: CiSession): string {
  const jobs = s.runs.flatMap(run => {
    return run.jobs ?? []
  })

  const where = s.repo?.fullName ?? s.project.name
  const conclusion = s.conclusion === 'setup-error' ? 'hit a setup error' : s.conclusion
  const lines = [`[inngest-ci] The CI run you started has ended: ${s.target.kind} \`${s.target.id}\` ${conclusion} (${where}).`]

  if (s.conclusion === 'setup-error' && s.setupError) {
    lines.push(`Setup error: ${s.setupError.split('\n')[0]}`)
  }

  const job = failedJob(jobs)

  if (s.conclusion === 'failed' && job) {
    lines.push(`Failed job: ${job.id}${job.command ? `, command \`${job.command.name}\`` : ''}`)

    if (job.title) {
      lines.push(`Failure: ${job.title}`)
    }
  } else if (s.conclusion === 'failed' && runReason(s)) {
    lines.push(`Failure: ${runReason(s)}`)
  }

  const run = s.runs.at(-1)

  if (run?.url && s.closedAt === undefined) {
    lines.push(`Run: ${run.url}`)
  } else if (run?.runId) {
    lines.push(`Reopen the run with \`${reopenCommand(run.runId)}\` in ${s.project.root}.`)
  }

  return lines.join('\n')
}
