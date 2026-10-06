/**
 * @module register
 *
 * The `inngest-ci` band: one line per local CI session above the prompt,
 * read from the session files the `inngest-ci` CLI writes. Selecting a line
 * opens its run. When a run this Claude session started ends, Claude reads a
 * short note with its next prompt; in a project that uses `@inngest/ci`,
 * Claude (and its subagents) read how to run CI.
 */

import type { EngineInterface, Register, RenderSurface, Timer } from 'claude-code'

import type { CiLine, CiView } from '../types'
import { LOGO_SVG, MARK, TICK, TICK_PX, TONE, markSvg, ticksAlt, ticksSvg } from './look'
import { endingNote, isMineAndEnded, parseSession, summaryOf, viewOf } from './sessions'
import type { CiSession } from './sessions'

const VIEW = { plugin: 'inngest-ci', key: 'view' } as const
const TOLD = { plugin: 'inngest-ci', key: 'told' } as const

const LIVE_POLL_MS = 500
const IDLE_POLL_MS = 5000

/** How long a "no `@inngest/ci` here" answer stands before it is checked again. */
const RECHECK_MS = 30_000

/** About how wide a cell is on the desktop, in CSS pixels: sizes the column the tick SVG sits in. */
const CELL_PX = 7.5

/** Folders walked up from the working directory looking for `@inngest/ci`. */
const MAX_DEPTH = 8

const GUIDANCE = `# Inngest CI

This project runs CI with \`@inngest/ci\`. To run it, use \`npx inngest-ci <pipeline|job> --no-interactive\` from the repository root and pick exactly what to run:

- A pipeline or job ID as the target; \`--pipeline <id>\` or \`--job <id>\` when a name is both.
- \`--event <name>\` to pick a trigger when a pipeline has several, \`--data <json>\` for a \`ci.manual()\` trigger, \`--input <json>\` for a job's input, and \`--<axis> <value>\` for one matrix combination.

Exit codes: 0 passed, 1 failed or cancelled, 2 setup error (the output says what to change). \`inngest-ci\` starts and stops its own Dev Server and app, so do not start a Dev Server or the app by hand for CI. The \`inngest-ci\` skill covers writing pipelines and reading failures.`

type Host = {
  /** Where the CLI keeps `sessions/`. */
  dir: string
  /** The command that opens a URL in the browser, the URL appended. */
  opener: string[]
}

// This load's own memory; a hot reload starts it over and the first poll fills it again.
const files = new Map<string, { mtimeMs: number; session: CiSession | null }>()
const usesCi = new Map<string, { at: number; value: boolean }>()
let host: Host | undefined
let me = ''
let timer: Timer | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    host = await hostOf($)
    me = await $.session.id()
    void poll($)

    return started
  })

  // Once per run this session started: the outcome rides along with Claude's next prompt.
  on('prompt.submit', async ($, e, next) => {
    await refresh($).catch(() => {
      return undefined
    })

    const told = (await $.state.get(TOLD)).value ?? []
    const fresh = sessions().filter(s => {
      return isMineAndEnded(s, me) && !told.includes(s.sessionId)
    })

    if (!fresh.length) {
      return next(e)
    }

    const present = new Set(
      sessions().map(s => {
        return s.sessionId
      }),
    )

    const kept = told.filter(id => {
      return present.has(id)
    })

    await $.state.set(TOLD, [
      ...kept,
      ...fresh.map(s => {
        return s.sessionId
      }),
    ])

    return next({ ...e, context: [...(e.context ?? []), ...fresh.map(endingNote)] })
  })

  // How to run CI, in every system prompt (the main loop's and each subagent's) of a project that uses it.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const isCi = await hasCi($).catch(() => {
      return false
    })

    if (!isCi) {
      return composed
    }

    return { sections: [...composed.sections, { id: 'inngest-ci:guidance', text: GUIDANCE, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Every mod shares the band: what the mods beneath draw stays, below ours.
    const theirs = await next(e)
    const view = (await $.state.get(VIEW)).value

    if (e.props.hasSurvey || !view?.lines.length) {
      return theirs
    }

    const table = $.ui.resolve(e)
    const { Box, Text, Button, Link } = table
    // Only the desktop draws Svg in the band; the terminal draws glyphs.
    const Svg = e.surface === 'desktop' && 'Svg' in table ? table.Svg : undefined
    const surface = e.surface
    const opener = host?.opener ?? ['xdg-open']
    const targetWidth = columnWidth(view.lines, 'target', 8, 14)
    const repoWidth = columnWidth(view.lines, 'repo', 8, 16)
    const tickWidth = Math.min(
      24,
      Math.max(
        ...view.lines.map(line => {
          return line.ticks.length
        }),
      ),
    )

    const target = (line: CiLine) => {
      // Its Dev Server has stopped: the name copies the command that reopens the run instead.
      if (!line.url && line.reopen) {
        const reopen = line.reopen

        return (
          <Button
            key={`reopen:${line.id}`}
            plain
            dimColor={line.isDim}
            label={line.target}
            onPress={() => {
              void $.ui.copy({ text: reopen, surface }).then(
                () => {
                  $.ui.toast(`Its Dev Server has stopped. Copied: ${reopen}`)
                },
                () => {
                  $.ui.toast(`Its Dev Server has stopped. Reopen it with: ${reopen}`)
                },
              )
            }}
          />
        )
      }

      if (!line.url) {
        return (
          <Text bold={!line.isDim} dimColor={line.isDim}>
            {line.target}
          </Text>
        )
      }

      // The desktop opens a Link in the browser; on the terminal the Button takes the band's focus and Enter.
      if (Svg) {
        return <Link href={line.url} label={line.target} />
      }

      const argv = [...opener, line.url]

      return (
        <Button
          key={`open:${line.id}`}
          plain
          dimColor={line.isDim}
          label={line.target}
          onPress={() => {
            void openUrl($, argv, surface)
          }}
        />
      )
    }

    const mark = (line: CiLine) => {
      if (Svg) {
        return <Svg source={markSvg(line.tone)} alt={line.tone} width={12} height={12} />
      }

      return (
        <Text color={TONE[line.tone]} dimColor={line.isDim}>
          {MARK[line.tone]}
        </Text>
      )
    }

    const ticks = (line: CiLine) => {
      if (!line.ticks.length) {
        return null
      }

      if (Svg) {
        return <Svg source={ticksSvg(line.ticks, line.isDim)} alt={ticksAlt(line.ticks)} width={line.ticks.length * TICK_PX - 3} height={12} />
      }

      return (
        <Text>
          {line.ticks.map(status => {
            const tick = TICK[status]

            return (
              <Text color={tick.color} dimColor={tick.isDim || line.isDim}>
                {tick.glyph}
              </Text>
            )
          })}
        </Text>
      )
    }

    // Whoever stacks two blocks in the band puts the gap between them, so a band with only CI in it has none.
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1}>
          <Box flexDirection="row" columnGap={2}>
            <Box flexDirection="row" columnGap={1}>
              {Svg && <Svg source={LOGO_SVG} alt="Inngest" width={14} height={14} />}
              <Text bold>Inngest CI</Text>
            </Box>
            <Text dimColor>{summaryOf(view)}</Text>
          </Box>
          {view.lines.map(line => {
            const isClaude = line.startedBy === 'claude'

            return (
              <Box key={`line:${line.id}`} flexDirection="row" columnGap={1}>
                <Box width={1} flexShrink={0}>
                  {mark(line)}
                </Box>
                <Box width={targetWidth} flexShrink={0}>
                  {target(line)}
                </Box>
                <Box width={repoWidth} flexShrink={0}>
                  <Text dimColor wrap="truncate-end">
                    {line.repo}
                  </Text>
                </Box>
                {tickWidth > 0 && (
                  <Box width={Svg ? Math.ceil((tickWidth * TICK_PX) / CELL_PX) : tickWidth} flexShrink={0}>
                    {ticks(line)}
                  </Box>
                )}
                <Box flexGrow={1} flexShrink={1}>
                  <Text wrap="truncate-end" color={line.tone === 'failed' ? 'error' : undefined} dimColor={line.isDim}>
                    {line.detail}
                    {line.aside && <Text dimColor>{` · ${line.aside}`}</Text>}
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <Text dimColor>{line.time}</Text>
                </Box>
                <Box width={7} flexShrink={0} paddingLeft={1}>
                  <Text color={isClaude ? 'claude' : undefined} dimColor={!isClaude || line.isDim}>
                    {isClaude ? 'Claude' : 'you'}
                  </Text>
                </Box>
              </Box>
            )
          })}
          {view.more && (
            <Box flexDirection="row" columnGap={1}>
              <Box width={1} flexShrink={0}>
                <Text dimColor>+</Text>
              </Box>
              <Text dimColor wrap="truncate-end">{`${view.more.count} more  ${view.more.text}`}</Text>
            </Box>
          )}
        </Box>
        {theirs && <Box paddingTop={1}>{theirs}</Box>}
      </Box>
    )
  })
}

function sessions(): CiSession[] {
  return [...files.values()].flatMap(file => {
    return file.session ? [file.session] : []
  })
}

/** Polls every 500ms while a run is live and every 5s otherwise. */
async function poll($: EngineInterface): Promise<void> {
  timer?.cancel()

  const view = await refresh($).catch(() => {
    return undefined
  })

  const isLive = view?.lines.some(line => {
    return line.tone === 'running'
  })

  timer = $.clock.after(isLive ? LIVE_POLL_MS : IDLE_POLL_MS, () => {
    void poll($)
  })
}

/** Re-reads the session files whose mtime moved, then writes the view only when it changed. */
async function refresh($: EngineInterface): Promise<CiView | undefined> {
  if (!host) {
    return undefined
  }

  const dir = `${host.dir}/sessions`
  const entries = await $.fs.list(dir).catch(() => {
    return []
  })

  const listed = new Set<string>()

  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) {
      continue
    }

    listed.add(entry.name)

    if (files.get(entry.name)?.mtimeMs === entry.mtimeMs) {
      continue
    }

    const text = await $.fs.read(`${dir}/${entry.name}`).catch(() => {
      return undefined
    })

    // A file that could not be read is tried again on the next poll.
    files.set(entry.name, text === undefined ? { mtimeMs: -1, session: null } : { mtimeMs: entry.mtimeMs, session: parseSession(text) })
  }

  for (const name of files.keys()) {
    if (!listed.has(name)) {
      files.delete(name)
    }
  }

  const now = await $.clock.now()
  const view = viewOf(sessions(), now)
  const held = await $.state.get(VIEW)

  if (JSON.stringify(held.value) !== JSON.stringify(view)) {
    await $.state.set(VIEW, view)
  }

  // A fresh process (not a hot reload) counts every run that already ended as told.
  if ((await $.state.get(TOLD)).value === undefined) {
    const ended = sessions().filter(s => {
      return isMineAndEnded(s, me)
    })

    await $.state.set(
      TOLD,
      ended.map(s => {
        return s.sessionId
      }),
    )
  }

  return view
}

/** A column as wide as its widest value, within bounds. */
function columnWidth(lines: readonly CiLine[], field: 'target' | 'repo', min: number, max: number): number {
  const widest = Math.max(
    ...lines.map(line => {
      return line[field].length
    }),
  )

  return Math.min(max, Math.max(min, widest))
}

/** Where the CLI keeps its state and how this machine opens a URL, as the state contract resolves them. */
async function hostOf($: EngineInterface): Promise<Host> {
  const explicit = await $.env.get('INNGEST_CI_STATE_DIR')
  const xdg = await $.env.get('XDG_STATE_HOME')
  const home = (await $.env.get('HOME')) ?? ''
  const localAppData = await $.env.get('LOCALAPPDATA')
  const isWsl = (await $.env.get('WSL_DISTRO_NAME')) !== undefined
  const isMac = home.startsWith('/Users/')
  const isWindows = !isWsl && localAppData !== undefined
  const fallback = isMac ? `${home}/Library/Application Support/inngest-ci` : isWindows ? `${localAppData}/inngest-ci` : `${home}/.local/state/inngest-ci`
  const opener = isWsl ? ['explorer.exe'] : isMac ? ['open'] : isWindows ? ['rundll32', 'url.dll,FileProtocolHandler'] : ['xdg-open']

  return { dir: explicit ?? (xdg ? `${xdg}/inngest-ci` : fallback), opener }
}

/** Opens a run in the browser from the terminal; where the opener cannot start, the link is copied instead. */
async function openUrl($: EngineInterface, argv: string[], surface: RenderSurface): Promise<void> {
  const url = argv.at(-1) ?? ''
  const ran = await $.process.run(argv, { timeoutMs: 10_000 }).catch(() => {
    return undefined
  })

  if (!ran) {
    await $.ui.copy({ text: url, surface })
    $.ui.toast(`Copied ${url}`)
  }
}

/** Whether this working directory uses `@inngest/ci`; a yes is kept, a no is asked again after a while. */
async function hasCi($: EngineInterface): Promise<boolean> {
  const cwd = await $.session.cwd()
  const now = await $.clock.now()
  const known = usesCi.get(cwd)

  if (known && (known.value || now - known.at < RECHECK_MS)) {
    return known.value
  }

  const value = await findsCi($, cwd)

  usesCi.set(cwd, { at: now, value })

  return value
}

/** Whether `@inngest/ci` is set up in `cwd` or a folder above it, up to the repository root. */
async function findsCi($: EngineInterface, cwd: string): Promise<boolean> {
  let dir = cwd

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const config = await readJson($, `${dir}/inngest.json`)
    const pkg = await readJson($, `${dir}/package.json`)
    const deps = { ...(pkg?.dependencies as object | undefined), ...(pkg?.devDependencies as object | undefined) }

    if ((config?.ci && typeof config.ci === 'object') || '@inngest/ci' in deps) {
      return true
    }

    const parent = dir.replace(/\/[^/]*$/, '')

    if (!parent || parent === dir || (await $.fs.exists(`${dir}/.git`))) {
      return false
    }

    dir = parent
  }

  return false
}

async function readJson($: EngineInterface, path: string): Promise<Record<string, unknown> | undefined> {
  const text = await $.fs.read(path).catch(() => {
    return undefined
  })

  try {
    return text === undefined ? undefined : (JSON.parse(text) as Record<string, unknown>)
  } catch {
    return undefined
  }
}
