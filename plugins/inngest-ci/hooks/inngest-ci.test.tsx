/**
 * @module inngest-ci.test
 *
 * The band over session files in a temp dir, on the terminal and the
 * desktop: what it draws for zero, one and five sessions, how runs dim and
 * leave, what it skips, what selecting a line does, and the notes Claude
 * reads (a run's ending, once; how to run CI, only where CI is set up).
 *
 * A test has no file system of its own, so the temp dir lives in memory and
 * answers `$.fs` beneath the plugin, mtimes and all.
 */

import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { isAnotherModsDrawing } from './look'

const ME = 'claude-session-me'
const T0 = 1_791_240_000_000
const DIR = '/tmp/inngest-ci-test'
const SURFACES = ['terminal', 'desktop'] as const
const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] }
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100 } } as const

type World = {
  /** The temp dir's files by path. */
  files: Map<string, { text: string; mtimeMs: number }>
  clock: ReturnType<typeof mock.clock>
  /** Every command the mod ran. */
  ran: string[][]
  /** Writes of the band's view: an unchanged poll must add none. */
  viewWrites: number
  /** Prompts the mod submitted itself. */
  submitted: string[]
}

async function setUp($: Engine, on: On): Promise<World> {
  const world: World = { files: new Map(), clock: mock.clock(on, { now: T0 }), ran: [], viewWrites: 0, submitted: [] }

  put(world, `${DIR}/project/package.json`, '{"name":"project"}')
  mock.env(on, { INNGEST_CI_STATE_DIR: `${DIR}/state`, HOME: '/home/me' })
  mock.store(on)

  on('fs.list', ($, e) => {
    const entries = [...world.files].flatMap(([path, file]) => {
      const name = path.slice(e.path.length + 1)
      const isHere = path.startsWith(`${e.path}/`) && !name.includes('/')

      return isHere ? [{ name, kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false }] : []
    })

    return { value: entries }
  })

  on('fs.read', ($, e) => {
    const file = world.files.get(e.path)

    if (!file) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: file.text }
  })

  on('fs.exists', ($, e) => {
    return { value: world.files.has(e.path) }
  })

  on('session.start', () => {
    return { cwd: `${DIR}/project` }
  })

  on('session.id', () => {
    return { value: ME }
  })

  on('session.cwd', () => {
    return { value: `${DIR}/project` }
  })

  on('process.run', ($, e) => {
    world.ran.push([...e.argv])

    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  on('state.set', ($, e, next) => {
    if (e.plugin === 'inngest-ci' && e.key === 'view') {
      world.viewWrites += 1
    }

    return next(e)
  })

  on('prompt.submit', ($, e) => {
    world.submitted.push(e.text)

    return { text: e.text, context: e.context }
  })

  on('prompt.compose', () => {
    return { sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' as const }] }
  })

  // Another mod's line in the shared band: ours must keep it.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>another mod</Text>
  })

  await $.session.start({ cwd: `${DIR}/project`, surface: 'terminal', isInteractive: true } as never)

  return world
}

let tick = 0

/** Writes a file, its mtime moving on as a real write's does. */
function put(world: World, path: string, text: string) {
  tick += 1
  world.files.set(path, { text, mtimeMs: T0 + tick })
}

type Fixture = Record<string, unknown> & { sessionId: string }

function session(id: string, over: Record<string, unknown> = {}): Fixture {
  return {
    v: 1,
    sessionId: id,
    pid: 4242,
    startedAt: T0 - 41_000,
    updatedAt: T0,
    startedBy: { kind: 'claude', sessionId: ME },
    project: { root: '/repo/inngest-js', name: 'inngest-js' },
    repo: { fullName: 'inngest/inngest-js', ref: 'main', sha: '70f798f', dirty: true },
    target: { kind: 'pipeline', id: 'pr', trigger: 'pull_request.opened' },
    devServerUrl: 'http://127.0.0.1:24288',
    conclusion: 'running',
    runs: [
      {
        runId: '01RUN',
        pipelineId: 'pr',
        url: 'http://127.0.0.1:24288/run?runID=01RUN',
        status: 'running',
        startedAt: T0 - 40_000,
        jobs: [
          { id: 'base', status: 'cached' },
          { id: 'lint', status: 'passed' },
          { id: 'test', status: 'running', parentId: 'base', command: { name: 'pnpm test', attempt: 1, status: 'running' } },
          { id: 'e2e', status: 'queued' },
        ],
      },
    ],
    ...over,
  }
}

const FAILED_RUN = [
  {
    runId: '01REL',
    url: 'http://127.0.0.1:24300/run?runID=01REL',
    status: 'failed',
    jobs: [
      { id: 'base', status: 'passed' },
      { id: 'build', status: 'failed', command: { name: 'pnpm build', attempt: 1, status: 'failed' }, title: '`pnpm build` exited with 1' },
      { id: 'publish', status: 'skipped' },
    ],
  },
]

function write(world: World, ...sessions: Fixture[]) {
  for (const s of sessions) {
    put(world, `${DIR}/state/sessions/${s.sessionId}.json`, JSON.stringify(s))
  }
}

/** The keys of the lines the band drew, top to bottom. */
async function lines(ui: { findAll: (query: { type: string }) => Promise<{ key: string | undefined }[]> }): Promise<string[]> {
  const boxes = await ui.findAll({ type: 'Box' })

  return boxes.flatMap(box => {
    return box.key?.startsWith('line:') ? [box.key] : []
  })
}

/** The band as the terminal lays it out, near enough to read: fixed widths padded, the growing column filling the row. */
function paint(node: unknown, columns: number = BAND.props.bodyColumns): string {
  if (typeof node === 'string') {
    return node
  }

  if (!node || typeof node !== 'object') {
    return ''
  }

  const { type, props = {}, children = [] } = node as { type: string; props?: Record<string, unknown>; children?: unknown[] }
  const kids = children.filter(child => {
    return child !== null && child !== undefined && child !== false
  }) as { props?: Record<string, unknown> }[]

  if (type === 'Button' || type === 'Link') {
    return String(props.label ?? '')
  }

  if (type !== 'Box') {
    return kids
      .map(kid => {
        return paint(kid)
      })
      .join('')
  }

  const inner = columns - 2 * Number(props.paddingX ?? 0)
  const gap = ' '.repeat(Number(props.columnGap ?? 0))
  let text: string

  if (props.flexDirection === 'column') {
    text = kids
      .map(kid => {
        return paint(kid, inner)
      })
      .join('\n')
  } else {
    const parts = kids.map(kid => {
      return kid.props?.flexGrow ? '' : paint(kid, inner)
    })

    const used = parts.join(gap).length + gap.length
    const grown = kids.map((kid, i) => {
      return kid.props?.flexGrow ? paint(kid, inner).padEnd(inner - used) : parts[i]
    })

    text = grown.join(gap)
  }

  const lead = ' '.repeat(Number(props.paddingX ?? props.paddingLeft ?? 0))
  const indented = text.replace(/^/gm, lead)

  return typeof props.width === 'number' ? indented.padEnd(props.width) : indented
}

async function band($: Engine, surface: (typeof SURFACES)[number]) {
  return $.ui.mount({ plugin: 'inngest-ci', surface, ...BAND } as never)
}

test('no sessions: the band draws nothing of its own and keeps the other mods', async ($, on) => {
  const world = await setUp($, on)

  await world.clock.advance(5000)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect(await ui.find({ type: 'Text', text: 'another mod' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Claude' })).toBeUndefined()
    await ui.unmount()
  }
})

test("only runs this Claude session started show: not your own, not other sessions'", async ($, on) => {
  const world = await setUp($, on)

  write(world, session('mine'), session('yours', { startedBy: { kind: 'user' } }), session('theirs', { startedBy: { kind: 'claude', sessionId: 'someone-else' } }))
  await world.clock.advance(5000)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect(await lines(ui)).toEqual(['line:mine'])
    await ui.unmount()
  }
})

test('a rule separates CI from a mod drawing beneath it, and only then', async ($, on) => {
  const world = await setUp($, on)

  write(world, session('s1'))
  await world.clock.advance(5000)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect(await ui.find({ type: 'Text', text: /^─+$/ })).toBeDefined()
    await ui.unmount()
  }

  expect(isAnotherModsDrawing({ type: 'engine', ref: 1 })).toBe(false)
  expect(isAnotherModsDrawing(null)).toBe(false)
  expect(isAnotherModsDrawing({ type: 'Text', props: {}, children: ['another mod'] })).toBe(true)
})

test("between commands, a running job's activity says what it's doing", async ($, on) => {
  const world = await setUp($, on)
  const base = session('s1') as { runs: { jobs: Record<string, unknown>[] }[] }

  base.runs[0].jobs[2] = { id: 'test', status: 'running', activity: 'restoring base snapshot…' }
  write(world, base as Fixture)
  await world.clock.advance(5000)

  const ui = await band($, 'terminal')

  expect(await ui.find({ type: 'Text', text: /^restoring base snapshot… · test$/ })).toBeDefined()
  await ui.unmount()
})

test('one running session: mark, target, repo, a tick per job, the command, elapsed, who; selecting opens the run', async ($, on) => {
  const world = await setUp($, on)

  write(world, session('s1'))
  await world.clock.advance(5000)

  const terminal = await band($, 'terminal')

  expect((await terminal.find({ type: 'Text', text: '●' }))?.props.color).toBe('suggestion')
  expect(await terminal.find({ type: 'Text', text: 'inngest-js' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /^pnpm test · test$/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: '46s' })).toBeDefined()

  const ticks = await terminal.findAll({ type: 'Text', text: /^[■□–]$/ })

  expect(
    ticks.map(tick => {
      return `${tick.text}${tick.props.color ?? ''}${tick.props.dimColor ? '~' : ''}`
    }),
  ).toEqual(['■success~', '■success', '■suggestion', '□~'])

  await terminal.press({ key: 'open:s1' })
  expect(world.ran.at(-1)).toEqual(['xdg-open', 'http://localhost:24288/run?runID=01RUN'])
  expect(await terminal.find({ type: 'Text', text: 'another mod' })).toBeDefined()
  await terminal.unmount()

  const desktop = await band($, 'desktop')
  const link = await desktop.find({ type: 'Link' })

  expect(link?.props.href).toBe('http://localhost:24288/run?runID=01RUN')
  expect(link?.props.label).toBe('pr')
  expect((await desktop.findAll({ type: 'Svg' })).map(svg => svg.props.alt)).toEqual(['Inngest', 'running', '4 jobs: 1 from cache, 1 passed, 1 running, 1 queued'])
  await desktop.unmount()
})

test('before the run exists, selecting opens the Dev Server', async ($, on) => {
  const world = await setUp($, on)

  write(world, session('s1', { runs: [] }))
  await world.clock.advance(5000)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect(await ui.find({ type: 'Text', text: 'starting' })).toBeDefined()

    if (surface === 'desktop') {
      expect((await ui.find({ type: 'Link' }))?.props.href).toBe('http://localhost:24288/')
    }

    await ui.unmount()
  }
})

test("once a run's Dev Server has stopped, selecting copies the command that reopens it", async ($, on) => {
  const copied: string[] = []

  on('ui.copy', ($, e) => {
    copied.push(e.text)

    return undefined as never
  })

  const world = await setUp($, on)

  write(world, session('s1', { conclusion: 'passed', endedAt: T0 - 2000, closedAt: T0 - 1000 }))
  await world.clock.advance(5000)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect(await ui.find({ type: 'Link' })).toBeUndefined()
    await ui.press({ key: 'reopen:s1' })
    await ui.unmount()
  }

  expect(copied).toEqual(['npx inngest-ci open 01RUN', 'npx inngest-ci open 01RUN'])
  expect(world.ran).toEqual([])
})

test('five sessions: four lines and + 1 more, as the terminal lays them out', async ($, on) => {
  const world = await setUp($, on)

  write(
    world,
    session('nightly', {
      startedAt: T0 - 134_000,
      project: { root: '/repo/inngest', name: 'inngest' },
      repo: { fullName: 'inngest/inngest' },
      target: { kind: 'pipeline', id: 'nightly' },
      runs: [
        {
          url: 'http://127.0.0.1:24400/run?runID=N',
          jobs: [
            { id: 'base', status: 'cached' },
            ...['20', '22', '24'].flatMap(node => {
              return [
                { id: `compat (node:${node}, db:sqlite)`, status: 'passed' },
                { id: `compat (node:${node}, db:postgres)`, status: node === '24' ? 'running' : node === '22' ? 'failed' : 'passed', command: { name: 'pnpm test' } },
              ]
            }),
          ],
        },
      ],
    }),
    session('pr'),
    session('release', { target: { kind: 'pipeline', id: 'release' }, startedAt: T0 - 90_000, endedAt: T0 - 2_000, conclusion: 'failed', runs: FAILED_RUN, project: { root: '/repo/other', name: 'other' } }),
    session('done', { project: { root: '/repo/inngest', name: 'inngest' }, repo: { fullName: 'inngest/inngest' }, startedAt: T0 - 200_000, endedAt: T0 - 178_000, updatedAt: T0 - 178_000, conclusion: 'passed' }),
    session('lint-job', { target: { kind: 'job', id: 'lint' }, startedAt: T0 - 300_000, endedAt: T0 - 30_000, conclusion: 'cancelled' }),
    session('docs', { target: { kind: 'pipeline', id: 'docs' }, startedAt: T0 - 5_000 }),
  )

  await world.clock.advance(5000)

  // Running first, then failed, then the rest, newest first; `done` ended minutes ago and has gone.
  for (const surface of SURFACES) {
    const ui = await band($, surface)
    expect(await lines(ui)).toEqual(['line:docs', 'line:pr', 'line:nightly', 'line:release'])
    expect(await ui.find({ type: 'Text', text: '1 more  lint in inngest-js cancelled' })).toBeDefined()
    await ui.unmount()
  }

  const terminal = await band($, 'terminal')
  const drawn = (await terminal.drawn()) as { children: unknown[] }

  expect(paint(drawn.children[0]).split('\n')).toEqual([
    ' Inngest CI  3 running · 1 failed',
    ' ● docs     inngest-js ■■■□    pnpm test · test                                                10s',
    ' ● pr       inngest-js ■■■□    pnpm test · test                                                46s',
    ' ● nightly  inngest    ■■■■■■■ pnpm test · compat (node:24, db:postgres)                    2m 19s',
    ' ✕ release  inngest-js ■■–     pnpm build exited with 1                                   just now',
    ' + 1 more  lint in inngest-js cancelled',
  ])
  await terminal.unmount()
})

test('passed runs dim at once and leave after a minute; failed runs stay red until the next run in their project', async ($, on) => {
  const world = await setUp($, on)

  write(world, session('ok', { endedAt: T0, conclusion: 'passed' }), session('bad', { target: { kind: 'pipeline', id: 'release' }, project: { root: '/repo/b', name: 'b' }, endedAt: T0, conclusion: 'failed', runs: FAILED_RUN }))
  await world.clock.advance(5000)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect((await ui.find({ type: 'Text', text: 'passed in 41s' }))?.props.dimColor).toBe(true)
    expect((await ui.find({ type: 'Text', text: 'pnpm build exited with 1' }))?.props.color).toBe('error')
    expect(await ui.find({ type: 'Text', text: 'just now' })).toBeDefined()
    await ui.unmount()
  }

  await world.clock.advance(65_000)

  const later = await band($, 'terminal')

  expect(await later.find({ type: 'Text', text: 'passed in 41s' })).toBeUndefined()
  expect(await later.find({ type: 'Text', text: '1m ago' })).toBeDefined()
  await later.unmount()

  write(world, session('again', { project: { root: '/repo/b', name: 'b' }, startedAt: T0 + 70_000, updatedAt: T0 + 70_000 }))
  await world.clock.advance(5000)

  const superseded = await band($, 'terminal')

  expect(await superseded.find({ type: 'Text', text: 'pnpm build exited with 1' })).toBeUndefined()
  expect(await lines(superseded)).toHaveLength(1)
  await superseded.unmount()
})

test('a session that stops writing is lost and dims, then leaves; one that keeps its heartbeat stays', async ($, on) => {
  const world = await setUp($, on)

  write(world, session('alive'), session('gone', { target: { kind: 'pipeline', id: 'docs' } }))
  await world.clock.advance(45_000)
  write(world, session('alive', { updatedAt: T0 + 45_000 }))
  await world.clock.advance(20_000)

  const ui = await band($, 'terminal')

  expect((await ui.find({ type: 'Text', text: 'stopped reporting' }))?.props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: '◌' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^pnpm test/ })).toBeDefined()
  await ui.unmount()

  write(world, session('alive', { updatedAt: T0 + 65_000 }))
  await world.clock.advance(60_000)

  const after = await band($, 'terminal')

  expect(await after.find({ type: 'Text', text: 'stopped reporting' })).toBeUndefined()
  expect(await lines(after)).toHaveLength(1)
  await after.unmount()
})

test('files of another version, or broken, are skipped; an unchanged poll writes nothing', async ($, on) => {
  const world = await setUp($, on)

  write(world, session('future', { v: 2 }), { sessionId: 'broken', v: 1 } as Fixture)
  await world.clock.advance(5000)

  const ui = await band($, 'terminal')

  expect(await lines(ui)).toHaveLength(0)
  await ui.unmount()

  write(world, session('s1', { endedAt: T0, conclusion: 'passed' }))
  await world.clock.advance(5000)

  const writes = world.viewWrites

  await world.clock.advance(20_000)
  expect(world.viewWrites).toBe(writes)
})

test("Claude reads a run's ending once, only for runs this session started", async ($, on) => {
  const world = await setUp($, on)

  write(world, session('mine'), session('theirs', { startedBy: { kind: 'claude', sessionId: 'someone-else' } }))
  await world.clock.advance(1000)

  const quiet = await $.prompt.submit({ text: 'hi' } as never)

  expect(quiet.context).toBeUndefined()

  write(
    world,
    session('mine', { endedAt: T0 + 2000, updatedAt: T0 + 2000, conclusion: 'failed', runs: FAILED_RUN }),
    session('theirs', { startedBy: { kind: 'claude', sessionId: 'someone-else' }, endedAt: T0 + 2000, updatedAt: T0 + 2000, conclusion: 'failed', runs: FAILED_RUN }),
  )

  const told = await $.prompt.submit({ text: 'and now?' } as never)

  expect(told.context).toEqual([
    [
      '[inngest-ci] The CI run you started has ended: pipeline `pr` failed (inngest/inngest-js).',
      'Failed job: build, command `pnpm build`',
      'Failure: `pnpm build` exited with 1',
      'Run: http://127.0.0.1:24300/run?runID=01REL',
    ].join('\n'),
  ])

  const again = await $.prompt.submit({ text: 'again' } as never)

  expect(again.context).toBeUndefined()
})

test("a JS project without @inngest/ci offers to set it up, and hiding the offer keeps it hidden", async ($, on) => {
  const world = await setUp($, on)

  await world.clock.advance(5000)

  for (const surface of SURFACES) {
    const ui = await band($, surface)

    expect(await ui.find({ type: 'Text', text: 'not set up in this project' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'another mod' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await band($, 'terminal')

  await ui.press({ key: 'setup' })
  expect(world.submitted.at(-1)).toContain('using the inngest-ci skill')

  await ui.press({ key: 'setup-hide' })
  await world.clock.advance(5000)
  expect(await ui.find({ type: 'Text', text: 'not set up in this project' })).toBeUndefined()
  await ui.unmount()
})

test("no set-up offer where @inngest/ci is set up, or outside a JS project", async ($, on) => {
  const world = await setUp($, on)

  put(world, `${DIR}/project/inngest.json`, '{"ci":{"start":"tsx server.ts"}}')
  await world.clock.advance(5000)

  const withCi = await band($, 'terminal')

  expect(await withCi.find({ type: 'Text', text: 'not set up in this project' })).toBeUndefined()
  await withCi.unmount()

  world.files.delete(`${DIR}/project/inngest.json`)
  world.files.delete(`${DIR}/project/package.json`)
  await world.clock.advance(31_000)

  const notJs = await band($, 'terminal')

  expect(await notJs.find({ type: 'Text', text: 'not set up in this project' })).toBeUndefined()
  await notJs.unmount()
})

test('Claude reads how to run CI only where @inngest/ci is set up', async ($, on) => {
  const world = await setUp($, on)

  const before = await $.prompt.compose(COMPOSE)

  expect(before.sections.map(s => s.id)).toEqual(['intro'])

  put(world, `${DIR}/project/inngest.json`, '{"ci":{"start":"tsx server.ts"}}')
  await world.clock.advance(31_000)

  const after = await $.prompt.compose(COMPOSE)
  const guidance = after.sections.find(s => s.id === 'inngest-ci:guidance')

  expect(guidance?.scope).toBe('session')
  expect(guidance?.text).toContain('npx inngest-ci <pipeline|job> --no-interactive')
  expect(guidance?.text).toContain('0 passed, 1 failed or cancelled, 2 setup error')
})
