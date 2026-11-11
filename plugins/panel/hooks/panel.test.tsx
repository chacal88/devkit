import type { ToolCallResult } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock, TestBody } from 'claude-code/testing'

import { CHANGE_OPTION_EXIT, CHANGE_OPTION_STDERR, CHANGE_OPTION_STDOUT } from './fixtures/change-option'
import { DELIVER_EXIT, DELIVER_STDOUT } from './fixtures/deliver'
import { ROUND_STDOUT } from './fixtures/round'

type On = Parameters<TestBody>[1]

const PLUGIN = 'devkit-panel'
const LIST = 'mcp__ccd_session_mgmt__list_sessions'
const SURFACES = ['terminal', 'desktop'] as const
const REFRESH_MS = 60_000

const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'devkit-panel',
  props: { title: 'devkit', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

type Run = { exitCode: number; stdout: string; stderr: string }
type Permission = 'allow' | 'ask' | 'deny'

const MARKET = JSON.stringify({ name: 'devkit', plugins: [{ name: 'devkit-openspec', source: './plugins/openspec' }] })
const CHANGE_OPTION_RUN: Run = { exitCode: CHANGE_OPTION_EXIT, stdout: CHANGE_OPTION_STDOUT, stderr: CHANGE_OPTION_STDERR }
const CHECKER = '/w/plugins/openspec/hooks'

const session = (name: string, extra: Record<string, unknown> = {}) => ({
  sessionId: `local_${name}`,
  name,
  title: `${name}`,
  cwd: `/w/.claude/worktrees/${name}`,
  isRunning: false,
  isArchived: false,
  startedBy: 'local_me',
  ...extra,
})

type World = {
  files: Map<string, string>
  dirs: Set<string>
  clock: MockClock
  /** Every `$.process.run`: its argv and init. */
  runs: { argv: readonly string[]; cwd?: string; env?: Record<string, string>; timeoutMs?: number }[]
  /** What the checkers answer; `reject` makes the run reject (a timeout, `node` missing). */
  round: Run | 'reject'
  change: Run | 'reject'
  deliver: Run
  /** A run the mock holds before answering: the promise it awaits, or nothing to answer at once. */
  hold?: (argv: readonly string[]) => Promise<void> | undefined
  permission: Permission
  tools: string[]
  /** Every `$.tool.check` argument and every `$.tool.call` input. */
  checks: unknown[]
  calls: Record<string, unknown>[]
  rows: Record<string, unknown>[]
  /** How `list_sessions` answers, given the rows as JSON text: core's `{ result, text }` unless a test shapes it. */
  listAnswer: (text: string) => ToolCallResult
  fills: { text: string; mode?: string }[]
  isFilled: boolean
  toasts: string[]
  /** The ids `$.ui.panes()` lists as open. */
  panes: string[]
  registered: string[]
  /** Every `$.ui.open` and `$.ui.close`, by pane id; what the open answers. */
  opens: string[]
  closes: string[]
  isPlaced: boolean
  /** Every `prompt.submit` that reached the engine: the panel must never make one. */
  submits: string[]
}

/** A devkit project at /w with the repository's own checkers, a disk in memory and an engine that answers every noun. */
const world = (on: On, { devkit = true, checker = true }: { devkit?: boolean; checker?: boolean } = {}): World => {
  mock.store(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  const w: World = {
    files: new Map(),
    dirs: new Set(['/w', '/w/openspec/changes', '/w/openspec/changes/archive', '/w/openspec/changes/devkit-panel', '/w/openspec/changes/archive/2026-11-08-ship-modes', '/w/openspec/changes/archive/2026-11-10-conduct-sessions', '/w/.claude/worktrees/commit-and-pr-trailer']),
    clock,
    runs: [],
    round: { exitCode: 0, stdout: ROUND_STDOUT, stderr: '' },
    change: CHANGE_OPTION_RUN,
    deliver: { exitCode: DELIVER_EXIT, stdout: DELIVER_STDOUT, stderr: '' },
    permission: 'allow',
    tools: [LIST, 'Bash'],
    checks: [],
    calls: [],
    rows: [],
    listAnswer: text => ({ result: text, text }),
    fills: [],
    isFilled: true,
    toasts: [],
    panes: [],
    registered: [],
    opens: [],
    closes: [],
    isPlaced: true,
    submits: [],
  }
  if (devkit) w.files.set('/w/openspec/config.yaml', 'schema: devkit-lite\nship:\n  devkit-lite: merge\n')
  if (checker) w.files.set('/w/.claude-plugin/marketplace.json', MARKET)
  const exists = (path: string) => w.files.has(path) || w.dirs.has(path)
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/h' : undefined }))
  on('session.root', () => ({ value: '/w' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.exists', ($, e) => ({ value: exists(e.path) }))
  on('fs.read', ($, e) => (w.files.has(e.path) ? { value: w.files.get(e.path) ?? '' } : { deny: `no such file: ${e.path}` }))
  on('fs.list', ($, e) => {
    if (!w.dirs.has(e.path)) return { deny: `no such directory: ${e.path}` }
    const names = [...w.files.keys(), ...w.dirs].filter(k => k.startsWith(`${e.path}/`) && !k.slice(e.path.length + 1).includes('/'))
    return {
      value: names.map(k => ({ name: k.slice(e.path.length + 1), kind: w.dirs.has(k) ? 'dir' : 'file', size: 0, mtimeMs: 0, isLink: false })),
    }
  })
  on('process.run', async ($, e) => {
    w.runs.push({ argv: e.argv, cwd: e.init?.cwd, env: e.init?.env, timeoutMs: e.init?.timeoutMs })
    const held = w.hold?.(e.argv)
    if (held !== undefined) await held
    const script = String(e.argv[1] ?? '')
    const ran = (run: Run | 'reject') => (run === 'reject' ? { deny: 'timed out after 60000 ms' } : { value: { ...run, isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv.includes('--change')) return ran(w.change)
    if (script.endsWith('conduct-check.mjs')) return ran(w.round)
    if (script.endsWith('deliver-check.mjs')) return ran(w.deliver)
    return { deny: `unexpected command: ${e.argv.join(' ')}` }
  })
  on('tool.list', () => ({ value: w.tools.map(name => ({ name, description: '', mcp: true })) }))
  on('tool.check', ($, e) => {
    w.checks.push({ tool: e.tool, input: e.input })
    return { decision: e.tool === LIST ? w.permission : 'allow' }
  })
  on('tool.call', ($, e) => {
    const input = e as unknown as Record<string, unknown>
    w.calls.push(input)
    if (input.tool !== LIST) return { result: 'ok', text: 'ok' }
    return w.listAnswer(JSON.stringify(w.rows))
  })
  on('prompt.fill', ($, e) => {
    w.fills.push({ text: e.text, mode: e.mode })
    return { isFilled: w.isFilled }
  })
  on('ui.toast', ($, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    w.opens.push(e.id)
    return { value: w.isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'under the floor of 110 columns: 80 now' } }
  })
  on('ui.close', ($, e) => {
    w.closes.push(e.id)
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    w.submits.push(e.text)
    return { text: e.text }
  })
  // the engine beneath: what a band the panel leaves alone draws, and a command it hands on
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('command.run', () => ({ text: 'engine' }))
  on('ui.panes', () => ({ value: w.panes.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('command.register', ($, e) => {
    w.registered.push(`/${e.name}`)
    return { value: { command: e.name } }
  })
  on('tool.register', ($, e) => {
    w.registered.push(`tool:${e.name}`)
    return { value: { tool: `mcp__${PLUGIN}__${e.name}` } }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return w
}

const BAND = {
  plugin: PLUGIN,
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  // a wide column: the fixture's line is 112 cells, and the cut is its own case
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const start = ($: Engine) => $.session.start({ cwd: '/w', surface: 'desktop', isInteractive: true })
/** `/devkit-panel <args>` as the person types it. */
const command = ($: Engine, args = '') =>
  $.command.run({ command: 'devkit-panel', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
/** The round fixture with its rows replaced: one change per step, each in its own worktree. */
const roundWith = (changes: { id: string; step: string; actor?: string }[]): string => {
  const report = JSON.parse(ROUND_STDOUT) as Record<string, unknown>
  const rows = changes.map(c => ({
    id: c.id,
    round: 5,
    worktree: `/w/.claude/worktrees/${c.id}`,
    next: { step: c.step, actor: c.actor ?? 'owner' },
    state: `ready to run: ${c.step}`,
    sessionPrefix: `${c.id}-p`,
  }))
  return JSON.stringify({ ...report, changes: rows })
}
/** One row per owner step of design D8: a delivery step, the plan approval, the retro answers, a creation. */
const OWNER_ROWS = [
  { id: 'a', step: 'gate', actor: 'gate' },
  { id: 'b', step: 'stop-plan-approval' },
  { id: 'c', step: 'stop-retro-answers' },
  { id: 'd', step: 'create', actor: 'main' },
]
const OWNER_KEYS = ['conduct:a', 'ship:a', 'conduct:b', 'ship:b', 'approve:b', 'conduct:c', 'ship:c', 'answer:c', 'conduct:d']
const turn = ($: Engine, agentId?: string) =>
  $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', ...(agentId === undefined ? {} : { agentId }) })
const conductRuns = (w: World) => w.runs.filter(r => String(r.argv[1]).endsWith('conduct-check.mjs') && !r.argv.includes('--change'))
const deliverRuns = (w: World) => w.runs.filter(r => String(r.argv[1]).endsWith('deliver-check.mjs'))
const probeRuns = (w: World) => w.runs.filter(r => r.argv.includes('--change'))
/** Lets the refresh a hook left running settle: the mocked clock's event loop, a few turns over. */
const settle = async (w: World) => {
  for (let i = 0; i < 5; i++) await w.clock.settle()
}
/** A promise a `process.run` mock can be held on, and the hand that releases it. */
const gate = () => {
  let release = (): void => {}
  const promise = new Promise<void>(resolve => {
    release = resolve
  })
  return { promise, release }
}
const isScript = (argv: readonly string[], name: string) => String(argv[1]).endsWith(`${name}.mjs`)
const DELIVER_LINE = '    deliver: in progress: item 1 · 1/8 ok · próximo: implement'

test('AC-2: after session start the pane lists every change of the round with its state, step and actor; the header names the checker', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  expect(w.registered).toEqual(['/devkit-panel', 'tool:status'])
  expect(conductRuns(w)).toEqual([{ argv: ['node', `${CHECKER}/conduct-check.mjs`, '--json'], cwd: '/w', env: { DEVKIT_HOST: 'app' }, timeoutMs: 60_000 }])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^devkit · repo/ }))?.text).toMatch(/atualizado há 0 s/)
    expect((await ui.find({ type: 'Text', text: /Rodada 5/ }))?.text).toBe('Rodada 5: Round 5: trailer fix, one change at a time · 0/2 · dispatch 1 · owner 0 · github 0 · parados 0')
    expect((await ui.find({ type: 'Text', text: /commit-and-pr-trailer/ }))?.text).toBe('> commit-and-pr-trailer · ready to run: gate · gate · gate')
    expect((await ui.find({ type: 'Text', text: /conventions-trailer/ }))?.text).toBe('> conventions-trailer · waiting on commit-and-pr-trailer · wait-dependencies · none')
    expect(await ui.find({ key: 'refresh' })).toBeDefined()
    expect(await ui.find({ key: 'toggle:commit-and-pr-trailer' })).toBeDefined()
    await ui.unmount()
  }
})

test('AC-3: open changes not in the round and archived changes are listed by name, collapsed, with no checker run for them', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Outras mudanças/ }))?.text).toBe('> Outras mudanças (1) · devkit-panel')
    expect((await ui.find({ type: 'Text', text: /Arquivadas/ }))?.text).toBe('> Arquivadas (2) · 2026-11-10-conduct-sessions, 2026-11-08-ship-modes')
    await ui.press({ key: 'toggle:archived' })
    expect((await ui.find({ type: 'Text', text: /^v Arquivadas/ }))?.text).toBe('v Arquivadas (2)')
    expect(await ui.find({ type: 'Text', text: /^    2026-11-08-ship-modes$/ })).toBeDefined()
    await ui.press({ key: 'toggle:archived' })
    await ui.unmount()
  }
  expect(w.runs.filter(r => r.argv.some(a => a.includes('devkit-panel') || a.includes('ship-modes')))).toEqual([])
  expect(deliverRuns(w)).toEqual([])
})

test('AC-4: a plain OpenSpec project (config.yaml with another schema) is the same one line, no checker run and the engine band', async ($, on) => {
  const w = world(on)
  w.files.set('/w/openspec/config.yaml', 'schema: spec-driven\n')
  await start($)
  await settle(w)
  await turn($)
  await settle(w)
  expect(w.runs).toEqual([])
  for (const surface of SURFACES) {
    const pane = await $.ui.mount({ ...PANE, surface })
    expect((await pane.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['Não é um projeto OpenSpec devkit.'])
    await pane.unmount()
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['engine'])
    await band.unmount()
  }
})

test('AC-4: outside an OpenSpec devkit project the pane is one line and no checker runs', async ($, on) => {
  const w = world(on, { devkit: false })
  await start($)
  await settle(w)
  await turn($)
  await settle(w)
  expect(w.runs).toEqual([])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['Não é um projeto OpenSpec devkit.'])
    await ui.unmount()
  }
})

test('AC-4: a devkit project with no checker installed is one line naming the install command, and no run', async ($, on) => {
  const w = world(on, { checker: false })
  await start($)
  await settle(w)
  expect(w.runs).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['Sem checker: instale devkit-openspec@devkit --scope project.'])
  await ui.unmount()
})

test('AC-5: expanding a row runs deliver-check once in its worktree and draws the 8 items; each refresh runs it once more while expanded', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  expect(deliverRuns(w)).toEqual([])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    expect(deliverRuns(w)).toEqual([
      { argv: ['node', `${CHECKER}/deliver-check.mjs`, 'commit-and-pr-trailer', '--json'], cwd: '/w/.claude/worktrees/commit-and-pr-trailer', env: { DEVKIT_HOST: 'app' }, timeoutMs: 60_000 },
    ])
    expect((await ui.find({ type: 'Text', text: /^v commit-and-pr-trailer/ }))?.text).toBe('v commit-and-pr-trailer · ready to run: gate · gate · gate')
    expect((await ui.find({ type: 'Text', text: /deliver:/ }))?.text).toBe('    deliver: in progress: item 1 · 1/8 ok · próximo: implement')
    const items = (await ui.findAll({ type: 'Text', text: /^    [1-8] [+ox] / })).map(t => t.text)
    expect(items).toHaveLength(8)
    expect(items[0]).toBe('    1 o tasks · unticked tasks: 1.1, 1.2, 1.3, 1.4, 1.9, 2.1, 2.2, 2.3, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.9')
    expect(items[2]).toBe('    3 + findings · 0 fixed, 0 refuted')
    expect(items[7]).toBe('    8 o body · no pull request for this branch yet')

    // a refresh runs the expanded row's check once, never the collapsed one's
    await turn($)
    await settle(w)
    expect(deliverRuns(w)).toHaveLength(2)
    expect(deliverRuns(w).every(r => r.argv[2] === 'commit-and-pr-trailer')).toBe(true)

    // collapsed again: no deliver run at the next refresh, and the cached report is dropped
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    await turn($)
    await settle(w)
    expect(deliverRuns(w)).toHaveLength(2)
    expect(await ui.find({ type: 'Text', text: /deliver:/ })).toBeUndefined()
    await ui.unmount()
    w.runs = []
  }
})

test('AC-5: a row whose worktree is not there yet runs deliver-check in the project root, and an exit 3 is one error line', async ($, on) => {
  const w = world(on)
  w.deliver = { exitCode: 3, stdout: '', stderr: 'deliver-check: unknown change "conventions-trailer"\n' }
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'toggle:conventions-trailer' })
  expect(deliverRuns(w).map(r => r.cwd)).toEqual(['/w'])
  expect((await ui.find({ type: 'Text', text: /deliver:/ }))?.text).toBe('    deliver: deliver-check: unknown change "conventions-trailer"')
  await ui.unmount()
})

test('AC-5: a row expanded during a refresh keeps the deliver report its toggle wrote once the refresh lands', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'toggle:commit-and-pr-trailer' })
  expect(deliverRuns(w)).toHaveLength(1)
  // the refresh's deliver-check of the expanded row is held; meanwhile the owner expands the other row
  const held = gate()
  w.hold = argv => (isScript(argv, 'deliver-check') && argv[2] === 'commit-and-pr-trailer' ? held.promise : undefined)
  await turn($)
  await settle(w)
  expect(deliverRuns(w)).toHaveLength(2)
  await ui.press({ key: 'toggle:conventions-trailer' })
  await settle(w)
  expect(deliverRuns(w).map(r => r.argv[2])).toEqual(['commit-and-pr-trailer', 'commit-and-pr-trailer', 'conventions-trailer'])
  // the toggle's own write is drawn at once; the refresh landing must not drop it
  expect((await ui.findAll({ type: 'Text', text: /^    deliver:/ })).map(t => t.text)).toEqual([DELIVER_LINE, DELIVER_LINE])
  held.release()
  await settle(w)
  await ui.redraw()
  expect((await ui.findAll({ type: 'Text', text: /^v [a-z]/ })).map(t => t.text)).toEqual([
    'v commit-and-pr-trailer · ready to run: gate · gate · gate',
    'v conventions-trailer · waiting on commit-and-pr-trailer · wait-dependencies · none',
  ])
  expect((await ui.findAll({ type: 'Text', text: /^    deliver:/ })).map(t => t.text)).toEqual([DELIVER_LINE, DELIVER_LINE])
  await ui.unmount()
})

test('AC-6: while a refresh is in flight the header reads refreshing and the last report stays; once it lands, its age', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  const held = gate()
  w.hold = argv => (isScript(argv, 'conduct-check') ? held.promise : undefined)
  await turn($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^devkit · repo/ }))?.text).toBe('devkit · repo · atualizando...')
    expect((await ui.find({ type: 'Text', text: /^> commit-and-pr-trailer/ }))?.text).toBe('> commit-and-pr-trailer · ready to run: gate · gate · gate')
    await ui.unmount()
  }
  held.release()
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^devkit · repo/ }))?.text).toBe('devkit · repo · atualizado há 0 s')
  await ui.unmount()
})

test('AC-6: the report refreshes at session start, at the end of a main-loop turn and every 60 s while the pane is open; never for a subagent', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  expect(conductRuns(w)).toHaveLength(1)
  await turn($, 'agent-1')
  await settle(w)
  expect(conductRuns(w)).toHaveLength(1)
  await turn($)
  await settle(w)
  expect(conductRuns(w)).toHaveLength(2)
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(conductRuns(w)).toHaveLength(2)
  w.panes = ['devkit-panel']
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(conductRuns(w)).toHaveLength(3)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(conductRuns(w)).toHaveLength(4)
  await ui.unmount()
})

test('AC-6: two triggers at once make one checker run; a failed run is one header line and the last good report stays with its age', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  expect(conductRuns(w)).toHaveLength(1)
  await Promise.all([turn($), turn($)])
  await settle(w)
  expect(conductRuns(w)).toHaveLength(2)

  w.round = { exitCode: 3, stdout: '{"version":2,"error":"missing origin/main: git fetch origin main"}', stderr: '' }
  await w.clock.advance(5_000)
  await turn($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^devkit · repo/ }))?.text).toMatch(/atualizado há 5 s/)
    expect((await ui.find({ type: 'Text', text: /conduct-check:/ }))?.text).toBe('! conduct-check: missing origin/main: git fetch origin main')
    expect(await ui.find({ type: 'Text', text: /^> commit-and-pr-trailer/ })).toBeDefined()
    await ui.unmount()
  }

  w.round = 'reject'
  await turn($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // the engine prefixes what a rejected call says with the plugin and the call
  expect((await ui.find({ type: 'Text', text: /conduct-check:/ }))?.text).toMatch(/^! conduct-check: .*timed out after 60000 ms$/)
  expect(await ui.find({ type: 'Text', text: /^> conventions-trailer/ })).toBeDefined()
  await ui.unmount()
})

test('D5: a conduct-check report of a newer JSON version is one error line and the last good report stays; a newer deliver-check is the deliver line', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  w.round = { exitCode: 0, stdout: JSON.stringify({ ...(JSON.parse(ROUND_STDOUT) as Record<string, unknown>), version: 3 }), stderr: '' }
  w.deliver = { exitCode: 1, stdout: JSON.stringify({ ...(JSON.parse(DELIVER_STDOUT) as Record<string, unknown>), version: 2 }), stderr: '' }
  await w.clock.advance(5_000)
  await turn($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^devkit · repo/ }))?.text).toBe('devkit · repo · atualizado há 5 s')
    expect((await ui.find({ type: 'Text', text: /conduct-check:/ }))?.text).toBe('! conduct-check: JSON version 3 is newer than the 2 this panel reads')
    expect(await ui.find({ type: 'Text', text: /^> commit-and-pr-trailer/ })).toBeDefined()
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    expect((await ui.find({ type: 'Text', text: /deliver:/ }))?.text).toBe('    deliver: JSON version 2 is newer than the 1 this panel reads')
    expect(await ui.find({ type: 'Text', text: /^    [1-8] [+ox] / })).toBeUndefined()
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    await ui.unmount()
  }
})

test('AC-7: with list_sessions allowed the check is asked with { tool, input } and each change lists its children by prefix with a state', async ($, on) => {
  const w = world(on)
  w.rows = [
    session('commit-and-pr-traile-p1', { isRunning: true }),
    session('commit-and-pr-traile-p2', { isArchived: true }),
    session('commit-and-pr-traile-pagination-p1', { isRunning: true }),
    session('conventions-trailer-p1'),
    session('unrelated', { isRunning: true }),
  ]
  await start($)
  await settle(w)
  // the probe, then the call's own permission check the engine raises for it: the same argument both times
  expect(w.checks[0]).toEqual({ tool: LIST, input: { linked: true, limit: 100 } })
  expect(w.checks.every(c => JSON.stringify(c) === JSON.stringify(w.checks[0]))).toBe(true)
  expect(w.calls).toHaveLength(1)
  expect(w.calls[0]).toMatchObject({ tool: LIST, linked: true, limit: 100 })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    expect((await ui.find({ type: 'Text', text: /^    sessões:/ }))?.text).toBe('    sessões: commit-and-pr-traile-p1 · running, commit-and-pr-traile-p2 · archived')
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    await ui.press({ key: 'toggle:conventions-trailer' })
    expect((await ui.find({ type: 'Text', text: /^    sessões:/ }))?.text).toBe('    sessões: conventions-trailer-p1 · idle')
    await ui.press({ key: 'toggle:conventions-trailer' })
    expect(await ui.find({ type: 'Text', text: /permita/ })).toBeUndefined()
    await ui.unmount()
  }
})

/** With `ask` or `deny` on the list tool: no call, empty lists, one line naming the tool; the timer asks nothing. */
const noList = (permission: Permission): TestBody => async ($, on) => {
  const w = world(on)
  w.permission = permission
  w.rows = [session('commit-and-pr-traile-p1', { isRunning: true })]
  await start($)
  await settle(w)
  w.panes = ['devkit-panel']
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(w.calls).toEqual([])
  expect(w.checks.length).toBeGreaterThan(0)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /permita/ }))?.text).toBe('permita mcp__ccd_session_mgmt__list_sessions para ver as sessões filhas')
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    expect(await ui.find({ type: 'Text', text: /^    sessões:/ })).toBeUndefined()
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    await ui.unmount()
  }
}

test('AC-7: with ask no session tool is called, the lists stay empty and one line names the tool; a timer never asks', noList('ask'))
test('AC-7: with deny the same: no call, empty lists, the line', noList('deny'))

/** A `list_sessions` call answered with `answer`: the error line names the tool and the reason; no permission notice, no rows. */
const listFails = (answer: ToolCallResult, line: string): TestBody => async ($, on) => {
  const w = world(on)
  w.rows = [session('commit-and-pr-traile-p1', { isRunning: true })]
  w.listAnswer = () => answer
  await start($)
  await settle(w)
  expect(w.calls).toHaveLength(1)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /list_sessions/ }))?.text).toBe(line)
    expect(await ui.find({ type: 'Text', text: /permita/ })).toBeUndefined()
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    expect(await ui.find({ type: 'Text', text: /^    sessões:/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^> conventions-trailer/ })).toBeDefined()
    await ui.press({ key: 'toggle:commit-and-pr-trailer' })
    await ui.unmount()
  }
}

test('AC-7: a refused list_sessions call ({ deny }) is one error line naming the tool, never a silent empty list', listFails({ deny: 'refused by a hook' }, '! list_sessions: refused by a hook'))
test('AC-7: a failed list_sessions call ({ isError }) is one error line with the text the model read', listFails({ isError: true, result: 'the app is away', text: 'the app is away' }, '! list_sessions: the app is away'))

/** The rows read from a `list_sessions` answer of that shape: the children are listed. */
const listAnswers = (answer: (text: string) => ToolCallResult): TestBody => async ($, on) => {
  const w = world(on)
  w.rows = [session('commit-and-pr-traile-p1', { isRunning: true })]
  w.listAnswer = answer
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /list_sessions/ })).toBeUndefined()
  await ui.press({ key: 'toggle:commit-and-pr-trailer' })
  expect((await ui.find({ type: 'Text', text: /^    sessões:/ }))?.text).toBe('    sessões: commit-and-pr-traile-p1 · running')
  await ui.unmount()
}

test("AC-7: the rows are read from a hook's own answer, a string result with no text", listAnswers(text => ({ result: text })))
test("AC-7: the rows are read from core's text when the result is not a string", listAnswers(text => ({ result: { rows: 1 }, text })))

test('AC-7: when the tool is not listed at all, no check and no call are made', async ($, on) => {
  const w = world(on)
  w.tools = ['Bash']
  await start($)
  await settle(w)
  expect(w.checks).toEqual([])
  expect(w.calls).toEqual([])
})

/** A probe that does not exit 0 answers `no`, once per session: Conduct fills `/conduct` and the next refresh probes no more. */
const probeIsNo = (change: Run | 'reject'): TestBody => async ($, on) => {
  const w = world(on)
  w.change = change
  await start($)
  await settle(w)
  expect(probeRuns(w)).toHaveLength(1)
  await turn($)
  await settle(w)
  expect(probeRuns(w)).toHaveLength(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'conduct:commit-and-pr-trailer' })
  expect(w.fills).toEqual([{ text: '/conduct', mode: 'replace' }])
  expect(await ui.find({ type: 'Text', text: /conduct-check:/ })).toBeUndefined()
  await ui.unmount()
}

test('the --change probe: exit 3 with another error than the usage one is no, probed once', probeIsNo({ exitCode: 3, stdout: '{"version":2,"error":"missing origin/main: git fetch origin main"}', stderr: '' }))
test('the --change probe: a rejected run is no, probed once', probeIsNo('reject'))

test('the --change probe waits for a round id: none without changes, one at the first refresh that has one', async ($, on) => {
  const w = world(on)
  w.round = { exitCode: 0, stdout: roundWith([]), stderr: '' }
  await start($)
  await settle(w)
  await turn($)
  await settle(w)
  expect(probeRuns(w)).toEqual([])
  w.round = { exitCode: 0, stdout: ROUND_STDOUT, stderr: '' }
  await turn($)
  await settle(w)
  expect(probeRuns(w)).toHaveLength(1)
  await turn($)
  await settle(w)
  expect(probeRuns(w)).toHaveLength(1)
})

test('the --change probe runs once per session: a usage error (exit 3) makes Conduct fill /conduct, exit 0 makes it fill /conduct <id>', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  expect(probeRuns(w)).toEqual([{ argv: ['node', `${CHECKER}/conduct-check.mjs`, '--json', '--change', 'commit-and-pr-trailer'], cwd: '/w', env: { DEVKIT_HOST: 'app' }, timeoutMs: 60_000 }])
  await turn($)
  await settle(w)
  expect(probeRuns(w)).toHaveLength(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'conduct:commit-and-pr-trailer' })
  expect(w.fills).toEqual([{ text: '/conduct', mode: 'replace' }])
  await ui.unmount()
  // nothing but the list tool is ever called, and nothing is submitted
  expect(w.calls.filter(c => c.tool !== LIST)).toEqual([])
})

test('the --change probe: a checker that accepts the option makes Conduct fill /conduct <id>', async ($, on) => {
  const w = world(on)
  w.change = { exitCode: 0, stdout: ROUND_STDOUT, stderr: '' }
  await start($)
  await settle(w)
  expect(probeRuns(w)).toHaveLength(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'conduct:conventions-trailer' })
  expect(w.fills).toEqual([{ text: '/conduct conventions-trailer', mode: 'replace' }])
  await ui.press({ key: 'ship:commit-and-pr-trailer' })
  expect(w.fills[1]).toEqual({ text: '/ship-change commit-and-pr-trailer', mode: 'replace' })
  await ui.unmount()
  expect(w.toasts).toEqual([])
})

test('a create row\'s Conduct fills /conduct <id> when the checker accepts --change: the create path of /conduct <id>', async ($, on) => {
  const w = world(on)
  w.round = { exitCode: 0, stdout: roundWith(OWNER_ROWS), stderr: '' }
  w.change = { exitCode: 0, stdout: ROUND_STDOUT, stderr: '' }
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const owner = (await ui.findAll({ type: 'Button' })).map(b => b.key).filter(k => k?.startsWith('conduct:d') || k?.startsWith('ship:d'))
  expect(owner).toEqual(['conduct:d'])
  await ui.press({ key: 'conduct:d' })
  expect(w.fills).toEqual([{ text: '/conduct d', mode: 'replace' }])
  await ui.unmount()
  expect(w.submits).toEqual([])
})

test('the --change probe skips the create rows: a round whose first row is create probes with the first found change', async ($, on) => {
  const w = world(on)
  w.round = { exitCode: 0, stdout: roundWith([{ id: 'd', step: 'create', actor: 'main' }, { id: 'e', step: 'new-change', actor: 'main' }, { id: 'a', step: 'gate', actor: 'gate' }]), stderr: '' }
  w.change = { exitCode: 0, stdout: ROUND_STDOUT, stderr: '' }
  await start($)
  await settle(w)
  expect(probeRuns(w)).toEqual([{ argv: ['node', `${CHECKER}/conduct-check.mjs`, '--json', '--change', 'a'], cwd: '/w', env: { DEVKIT_HOST: 'app' }, timeoutMs: 60_000 }])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'conduct:d' })
  expect(w.fills).toEqual([{ text: '/conduct d', mode: 'replace' }])
  await ui.unmount()
})

test('the --change probe waits for a found change: a round of only create rows makes no probe, the first refresh with a found row makes one', async ($, on) => {
  const w = world(on)
  w.round = { exitCode: 0, stdout: roundWith([{ id: 'd', step: 'create', actor: 'main' }, { id: 'e', step: 'new-change', actor: 'main' }]), stderr: '' }
  w.change = { exitCode: 0, stdout: ROUND_STDOUT, stderr: '' }
  await start($)
  await settle(w)
  await turn($)
  await settle(w)
  expect(probeRuns(w)).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'conduct:d' })
  expect(w.fills).toEqual([{ text: '/conduct', mode: 'replace' }])
  await ui.unmount()
  w.round = { exitCode: 0, stdout: roundWith([{ id: 'd', step: 'create', actor: 'main' }, { id: 'a', step: 'gate', actor: 'gate' }]), stderr: '' }
  await turn($)
  await settle(w)
  expect(probeRuns(w).map(r => r.argv.at(-1))).toEqual(['a'])
  await turn($)
  await settle(w)
  expect(probeRuns(w)).toHaveLength(1)
  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await again.press({ key: 'conduct:d' })
  expect(w.fills.at(-1)).toEqual({ text: '/conduct d', mode: 'replace' })
  await again.unmount()
})

test('AC-8: every owner button fills the prompt box with its exact text; nothing is submitted, started or called', async ($, on) => {
  const w = world(on)
  w.round = { exitCode: 0, stdout: roundWith(OWNER_ROWS), stderr: '' }
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    w.fills = []
    const ui = await $.ui.mount({ ...PANE, surface })
    const owner = (await ui.findAll({ type: 'Button' })).map(b => b.key).filter(k => /^(conduct|ship|approve|answer):/.test(k ?? ''))
    expect(owner).toEqual(OWNER_KEYS)
    expect((await ui.find({ key: 'conduct:a' }))?.text).toBe('Conduzir')
    expect((await ui.find({ key: 'ship:a' }))?.text).toBe('Entregar')
    expect((await ui.find({ key: 'approve:b' }))?.text).toBe('Aprovar')
    expect((await ui.find({ key: 'answer:c' }))?.text).toBe('Responder')
    for (const key of OWNER_KEYS) await ui.press({ key })
    expect(w.fills).toEqual(
      ['/conduct', '/ship-change a', '/conduct', '/ship-change b', 'Aprovo o plano de b', '/conduct', '/ship-change c', 'Approve proposal 1 of c', '/conduct'].map(text => ({ text, mode: 'replace' })),
    )
    await ui.unmount()
  }
  expect(w.toasts).toEqual([])
  expect(w.submits).toEqual([])
  expect(w.opens).toEqual([])
  expect(w.calls.filter(c => c.tool !== LIST)).toEqual([])
})

test('AC-8: when no box can take the text, the same text is toasted', async ($, on) => {
  const w = world(on)
  w.isFilled = false
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'ship:commit-and-pr-trailer' })
    await ui.press({ key: 'conduct:conventions-trailer' })
    await ui.unmount()
  }
  expect(w.toasts).toEqual(['/ship-change commit-and-pr-trailer', '/conduct', '/ship-change commit-and-pr-trailer', '/conduct'])
  expect(w.fills.map(f => f.text)).toEqual(w.toasts)
  expect(w.submits).toEqual([])
})

test('the pane draws the same tree on mobile', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  expect((await ui.find({ type: 'Text', text: /commit-and-pr-trailer/ }))?.text).toBe('> commit-and-pr-trailer · ready to run: gate · gate · gate')
  expect(await ui.findAll({ type: 'Input' })).toEqual([])
  await ui.press({ key: 'ship:commit-and-pr-trailer' })
  expect(w.fills).toEqual([{ text: '/ship-change commit-and-pr-trailer', mode: 'replace' }])
  await ui.unmount()
})

test('AC-9: in a devkit project the band is one line with the round summary and a button that opens the pane, then closes it', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    w.panes = []
    w.opens = []
    w.closes = []
    const before = conductRuns(w).length
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /devkit/ }))?.text).toBe('devkit · rodada 5 Round 5: trailer fix, one change at a time · 0/2 · dispatch 1 · owner 0 · github 0 · parados 0')
    expect(await ui.find({ type: 'Text', text: /engine/ })).toBeUndefined()
    expect((await ui.find({ key: 'band:pane' }))?.text).toBe('Abrir')
    await ui.press({ key: 'band:pane' })
    expect(w.opens).toEqual(['devkit-panel'])
    expect(w.closes).toEqual([])
    // the open refreshes the report
    expect(conductRuns(w)).toHaveLength(before + 1)
    w.panes = ['devkit-panel']
    await ui.redraw()
    expect((await ui.find({ key: 'band:pane' }))?.text).toBe('Fechar')
    await ui.press({ key: 'band:pane' })
    expect(w.closes).toEqual(['devkit-panel'])
    expect(w.opens).toEqual(['devkit-panel'])
    await ui.unmount()
  }
  expect(w.submits).toEqual([])
})

test('AC-9: the band line is cut to bodyColumns', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: 40 } })
    const line = (await ui.find({ type: 'Text', text: /devkit/ }))?.text ?? ''
    expect(line.length).toBeLessThanOrEqual(40)
    expect(line).toMatch(/^devkit · rodada 5 .*…$/)
    await ui.unmount()
  }
})

test('AC-9: outside a devkit project the band passes to the engine', async ($, on) => {
  const w = world(on, { devkit: false })
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['engine'])
    expect(await ui.find({ key: 'band:pane' })).toBeUndefined()
    await ui.unmount()
  }
})

test('AC-9: under a survey, and before any report exists, the band passes to the engine', async ($, on) => {
  const w = world(on)
  w.round = { exitCode: 3, stdout: '{"version":2,"error":"not a git repository"}', stderr: '' }
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const none = await $.ui.mount({ ...BAND, surface })
    expect((await none.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['engine'])
    await none.unmount()
  }
  w.round = { exitCode: 0, stdout: ROUND_STDOUT, stderr: '' }
  await turn($)
  await settle(w)
  for (const surface of SURFACES) {
    const survey = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
    expect((await survey.findAll({ type: 'Text' })).map(t => t.text)).toEqual(['engine'])
    await survey.unmount()
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.find({ type: 'Text', text: /devkit/ }))?.text).toMatch(/^devkit · rodada 5/)
    await band.unmount()
  }
})

test('AC-9: /devkit-panel toggles the pane with one of three answers; /devkit-panel status answers the pane as text', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  expect(await command($)).toMatchObject({ text: 'painel devkit aberto' })
  expect(w.opens).toEqual(['devkit-panel'])
  await settle(w)
  w.panes = ['devkit-panel']
  expect(await command($)).toMatchObject({ text: 'painel devkit fechado' })
  expect(w.closes).toEqual(['devkit-panel'])
  w.panes = []
  w.isPlaced = false
  expect(await command($)).toMatchObject({ text: 'painel devkit aguardando espaço' })
  expect(w.opens).toEqual(['devkit-panel', 'devkit-panel'])
  await settle(w)
  const lines = ((await command($, 'status')).text ?? '').split('\n')
  expect(lines[0]).toBe('devkit · repo · atualizado há 0 s')
  expect(lines).toContain('Rodada 5: Round 5: trailer fix, one change at a time · 0/2 · dispatch 1 · owner 0 · github 0 · parados 0')
  expect(lines).toContain('v commit-and-pr-trailer · ready to run: gate · gate · gate')
  expect(lines).toContain('v conventions-trailer · waiting on commit-and-pr-trailer · wait-dependencies · none')
  expect(lines).toContain('> Outras mudanças (1) · devkit-panel')
  expect(lines).toContain('> Arquivadas (2) · 2026-11-10-conduct-sessions, 2026-11-08-ship-modes')
  expect(w.submits).toEqual([])
})

test('/devkit-panel status outside a devkit project is the one line', async ($, on) => {
  const w = world(on, { devkit: false })
  await start($)
  await settle(w)
  expect(await command($, ' status ')).toMatchObject({ text: 'Não é um projeto OpenSpec devkit.' })
  expect(w.runs).toEqual([])
})

test('the mcp__devkit-panel__status tool answers the pane as text after a refresh: every row with its child sessions, whatever the folds', async ($, on) => {
  const w = world(on)
  w.rows = [session('commit-and-pr-traile-p1', { isRunning: true }), session('conventions-trailer-p1', { isArchived: true })]
  await start($)
  await settle(w)
  const before = conductRuns(w).length
  const answer = await $.tool.call({ tool: 'mcp__devkit-panel__status' })
  expect(conductRuns(w)).toHaveLength(before + 1)
  const lines = String(answer.result).split('\n')
  expect(lines[0]).toBe('devkit · repo · atualizado há 0 s')
  expect(lines.slice(2, 6)).toEqual([
    'v commit-and-pr-trailer · ready to run: gate · gate · gate',
    '    sessões: commit-and-pr-traile-p1 · running',
    'v conventions-trailer · waiting on commit-and-pr-trailer · wait-dependencies · none',
    '    sessões: conventions-trailer-p1 · archived',
  ])
  // no deliver line without a cached report, and the text view runs no deliver-check
  expect(lines.some(l => l.startsWith('    deliver:'))).toBe(false)
  expect(deliverRuns(w)).toEqual([])
  expect(w.submits).toEqual([])
  expect(w.opens).toEqual([])
})

test('the status text lists the deliver items of a row whose report is cached by the pane; the pane keeps its folds', async ($, on) => {
  const w = world(on)
  w.rows = [session('commit-and-pr-traile-p1', { isRunning: true })]
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'toggle:commit-and-pr-trailer' })
  const lines = ((await command($, 'status')).text ?? '').split('\n')
  expect(lines.slice(2, 5)).toEqual(['v commit-and-pr-trailer · ready to run: gate · gate · gate', DELIVER_LINE, '    1 o tasks · unticked tasks: 1.1, 1.2, 1.3, 1.4, 1.9, 2.1, 2.2, 2.3, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.9'])
  expect(lines).toContain('    sessões: commit-and-pr-traile-p1 · running')
  expect(lines).toContain('v conventions-trailer · waiting on commit-and-pr-trailer · wait-dependencies · none')
  expect(lines.filter(l => l.startsWith('    deliver:'))).toHaveLength(1)
  expect(deliverRuns(w)).toHaveLength(1)
  // the pane itself keeps the other row folded
  expect((await ui.find({ type: 'Text', text: /conventions-trailer ·/ }))?.text).toBe('> conventions-trailer · waiting on commit-and-pr-trailer · wait-dependencies · none')
  await ui.unmount()
})

test('AC-10: language en draws the pane, the band, the toasts and the command answers in English', { options: { language: 'en' } }, async ($, on) => {
  const w = world(on)
  w.round = { exitCode: 0, stdout: roundWith(OWNER_ROWS), stderr: '' }
  w.isFilled = false
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    w.toasts = []
    const pane = await $.ui.mount({ ...PANE, surface })
    expect((await pane.find({ type: 'Text', text: /^devkit · repo/ }))?.text).toBe('devkit · repo · updated 0 s ago')
    expect((await pane.find({ type: 'Text', text: /Round 5/ }))?.text).toBe('Round 5: Round 5: trailer fix, one change at a time · 0/2 · dispatch 1 · owner 0 · github 0 · stopped 0')
    expect((await pane.find({ key: 'refresh' }))?.text).toBe('Refresh')
    expect((await pane.find({ key: 'conduct:a' }))?.text).toBe('Conduct')
    expect((await pane.find({ key: 'ship:a' }))?.text).toBe('Ship')
    expect((await pane.find({ key: 'approve:b' }))?.text).toBe('Approve')
    expect((await pane.find({ key: 'answer:c' }))?.text).toBe('Answer')
    expect((await pane.find({ type: 'Text', text: /Other changes/ }))?.text).toBe('> Other changes (1) · devkit-panel')
    expect((await pane.find({ type: 'Text', text: /Archived/ }))?.text).toBe('> Archived (2) · 2026-11-10-conduct-sessions, 2026-11-08-ship-modes')
    await pane.press({ key: 'approve:b' })
    await pane.press({ key: 'answer:c' })
    expect(w.toasts).toEqual(['I approve the plan of b', 'Approve proposal 1 of c'])
    await pane.unmount()
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.find({ type: 'Text', text: /devkit/ }))?.text).toBe('devkit · round 5 Round 5: trailer fix, one change at a time · 0/2 · dispatch 1 · owner 0 · github 0 · stopped 0')
    expect((await band.find({ key: 'band:pane' }))?.text).toBe('Open')
    await band.unmount()
  }
  expect(await command($)).toMatchObject({ text: 'devkit panel opened' })
  await settle(w)
  expect(((await command($, 'status')).text ?? '').split('\n')[0]).toBe('devkit · repo · updated 0 s ago')
})
