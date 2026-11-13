import type { SessionMessage, ToolCallResult } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock, TestBody } from 'claude-code/testing'

import { CHANGE_STDOUT, DELIVERY, MID_IMPLEMENTATION, MISSING_EXIT, MISSING_STDERR, MISSING_STDOUT, PLANNING } from './fixtures/change'
import type { FlowFixture } from './fixtures/change'
import { DELIVER_EXIT, DELIVER_STDOUT } from './fixtures/deliver'
import { DELIVER_OPEN_EXIT, DELIVER_OPEN_STDOUT } from './fixtures/deliver-open'
import { PROPOSAL_TEXT } from './fixtures/proposal'
import { TASKS_TEXT } from './fixtures/tasks'
import { chat, commandTags, plainCommand, skillToolUse } from './fixtures/messages'
import { childRow } from './fixtures/sessions'
import { WORKTREES_STDOUT } from './fixtures/worktrees'
import { commandLabel } from './detail'
import { readTasks } from './steps'

type On = Parameters<TestBody>[1]

const PLUGIN = 'devkit-panel'
const LIST = 'mcp__ccd_session_mgmt__list_sessions'
const OPEN = 'mcp__ccd_window__open_session_in'
const SURFACES = ['terminal', 'desktop'] as const
const REFRESH_MS = 60_000
const FRESH_MS = 5 * 60_000
const BACKOFF_MS = 15 * 60_000

const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'devkit-panel',
  props: { title: 'devkit', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

type Run = { exitCode: number; stdout: string; stderr: string }
type Permission = 'allow' | 'ask' | 'deny'

const MARKET = JSON.stringify({ name: 'devkit', plugins: [{ name: 'devkit-openspec', source: './plugins/openspec' }] })
const CHECKER = '/w/plugins/openspec/hooks'
const MISSING: Run = { exitCode: MISSING_EXIT, stdout: MISSING_STDOUT, stderr: MISSING_STDERR }

type Step = { step?: string; actor?: string; state?: string; prefix?: string }

/** The `--change` fixture re-labelled for `id`: its worktree, branch and session prefix follow the id. */
const changeRun = (id: string, { step = 'gate', actor = 'gate', state, prefix }: Step = {}): Run => {
  const report = JSON.parse(CHANGE_STDOUT) as { change: string; changes: Record<string, unknown>[] }
  const row = report.changes[0] ?? {}
  report.change = id
  report.changes = [{ ...row, id, worktree: `/w/.claude/worktrees/${id}`, branch: id, next: { step, actor, phase: 1 }, state: state ?? `ready to run: ${step}`, sessionPrefix: prefix ?? `${id}-p` }]
  return { exitCode: 0, stdout: JSON.stringify(report), stderr: '' }
}

/** The deliver fixture with item 6 saying `gh` is rate limited, in `gh`'s own wording (nothing in this repository produces the string). */
const rateLimitedDeliver = (): Run => {
  const report = JSON.parse(DELIVER_STDOUT) as { items: Record<string, unknown>[] }
  report.items = report.items.map(i => (i.id === 6 ? { ...i, status: 'blocked', reason: 'GraphQL: rate limited' } : i))
  return { exitCode: DELIVER_EXIT, stdout: JSON.stringify(report), stderr: '' }
}

/** The deliver fixture with a pull request, the first `done` phases finished, and item 6 in the given state (the fixture has no PR: the tests build one). */
const deliverWith = ({ pr = true, done = 1, item6 }: { pr?: boolean; done?: number; item6?: Record<string, unknown> } = {}): Run => {
  const report = JSON.parse(DELIVER_STDOUT) as { pr: unknown; phases: { n: number; open: string[]; gate: { done: boolean } | null }[]; items: Record<string, unknown>[]; met: number }
  if (pr) report.pr = { number: 31, url: 'https://github.com/chacal88/devkit/pull/31' }
  report.phases = report.phases.map((p, i) => (i < done ? { ...p, open: [], gate: { ...(p.gate ?? {}), done: true } } : p) as (typeof report.phases)[number])
  if (item6 !== undefined) report.items = report.items.map(i => (i.id === 6 ? { ...i, ...item6 } : i))
  return { exitCode: DELIVER_EXIT, stdout: JSON.stringify(report), stderr: '' }
}

type World = {
  files: Map<string, string>
  dirs: Set<string>
  clock: MockClock
  /** Every `$.process.run`: its argv and init. */
  runs: { argv: readonly string[]; cwd?: string; env?: Record<string, string>; timeoutMs?: number }[]
  /** What `conduct-check --change <id>` answers by id (a change nobody listed is exit 3); `reject` makes the run reject. */
  changes: Record<string, Run | 'reject'>
  deliver: Run
  /** `git worktree list --porcelain`'s stdout, or `reject`. */
  worktrees: string | 'reject'
  /** The transcript `$.session.messages()` reads, oldest first. */
  messages: SessionMessage[]
  /** A run the mock holds before answering: the promise it awaits, or nothing to answer at once. */
  hold?: (argv: readonly string[]) => Promise<void> | undefined
  permission: Permission
  /** The permission `open_session_in` is checked with, and what its calls answer in turn (the last repeats). */
  openPermission: Permission
  openAnswers: ToolCallResult[]
  /** What `$.prompt.read()` answers. */
  prompt: string
  /** The permission the engine's own check raises for every tool call: the tool name and its input. */
  tools: string[]
  /** Every `$.tool.check` argument and every `$.tool.call` input. */
  checks: unknown[]
  calls: Record<string, unknown>[]
  rows: Record<string, unknown>[]
  /** How `list_sessions` answers, given the rows as JSON text: core's `{ result, text }` unless a test shapes it. */
  listAnswer: (text: string) => ToolCallResult
  fills: { text: string; mode?: string }[]
  toasts: string[]
  /** The ids `$.ui.panes()` lists as open. */
  panes: string[]
  registered: string[]
  /** Every `$.ui.open` and `$.ui.close`, by pane id; what the open answers. */
  opens: string[]
  /** Every `$.ui.open` argument. */
  openArgs: Record<string, unknown>[]
  closes: string[]
  /** Every `$.ui.copy` and `$.ui.scroll`. */
  copies: { text: string; surface?: string }[]
  scrolls: Record<string, unknown>[]
  isCopyable: boolean
  isPlaced: boolean
  /** Whether `prompt.fill` finds a box to fill. */
  isFillable: boolean
  /** Every `prompt.submit` that reached the engine: the panel must never make one. */
  submits: string[]
  /** Every `session.send` and `fs.write` that reached the engine: the panel must never make one either. */
  forbidden: string[]
}

const worktreeChanges = (name: string, ids: string[]): string[] => [`/w/.claude/worktrees/${name}/openspec/changes`, `/w/.claude/worktrees/${name}/openspec/changes/archive`, ...ids.map(id => `/w/.claude/worktrees/${name}/openspec/changes/${id}`)]

/**
 * A devkit project at /w with the repository's own checkers, a disk in memory and an engine that answers every noun.
 * Candidates: the folders of commit-and-pr-trailer and panel-conduct-view, and the branches conventions-trailer and
 * getting-started-roadmap, from the real `git worktree list` fixture.
 */
const world = (on: On, { devkit = true, checker = true }: { devkit?: boolean; checker?: boolean } = {}): World => {
  mock.store(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  const w: World = {
    files: new Map(),
    dirs: new Set([
      '/w',
      '/w/openspec/changes',
      '/w/openspec/changes/archive',
      '/w/.claude/worktrees/panel-conduct-view',
      ...worktreeChanges('commit-and-pr-trailer', ['commit-and-pr-trailer']),
      ...worktreeChanges('panel-conduct-view-404c57', ['panel-conduct-view']),
    ]),
    clock,
    runs: [],
    changes: {
      'commit-and-pr-trailer': changeRun('commit-and-pr-trailer'),
      'panel-conduct-view': changeRun('panel-conduct-view', { step: 'implement', actor: 'session' }),
      'conventions-trailer': changeRun('conventions-trailer', { step: 'wait-dependencies', actor: 'none', state: 'waiting on commit-and-pr-trailer' }),
      'getting-started-roadmap': changeRun('getting-started-roadmap', { step: 'stop-plan-approval', actor: 'owner', state: 'waiting for the owner: plan approval' }),
    },
    deliver: { exitCode: DELIVER_EXIT, stdout: DELIVER_STDOUT, stderr: '' },
    worktrees: WORKTREES_STDOUT,
    messages: [],
    permission: 'allow',
    openPermission: 'allow',
    openAnswers: [{ result: 'ok', text: 'ok' }],
    prompt: '',
    tools: [LIST, OPEN, 'Bash'],
    checks: [],
    calls: [],
    rows: [],
    listAnswer: text => ({ result: text, text }),
    fills: [],
    toasts: [],
    panes: [],
    registered: [],
    opens: [],
    openArgs: [],
    closes: [],
    copies: [],
    scrolls: [],
    isCopyable: true,
    isPlaced: true,
    isFillable: true,
    submits: [],
    forbidden: [],
  }
  if (devkit) w.files.set('/w/openspec/config.yaml', 'schema: devkit-lite\nship:\n  devkit-lite: merge\n')
  if (checker) w.files.set('/w/.claude-plugin/marketplace.json', MARKET)
  const exists = (path: string) => w.files.has(path) || w.dirs.has(path)
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/h' : undefined }))
  on('session.root', () => ({ value: '/w' }))
  on('session.messages', () => ({ value: w.messages }))
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
    if (e.argv[0] === 'git') return ran(w.worktrees === 'reject' ? 'reject' : { exitCode: 0, stdout: w.worktrees, stderr: '' })
    if (e.argv.includes('--change')) return ran(w.changes[String(e.argv[e.argv.indexOf('--change') + 1])] ?? MISSING)
    if (script.endsWith('deliver-check.mjs')) return ran(w.deliver)
    return { deny: `unexpected command: ${e.argv.join(' ')}` }
  })
  on('tool.list', () => ({ value: w.tools.map(name => ({ name, description: '', mcp: true })) }))
  on('tool.check', ($, e) => {
    w.checks.push({ tool: e.tool, input: e.input })
    return { decision: e.tool === LIST ? w.permission : e.tool === OPEN ? w.openPermission : 'allow' }
  })
  on('tool.call', ($, e) => {
    const input = e as unknown as Record<string, unknown>
    w.calls.push(input)
    if (input.tool === OPEN) return w.openAnswers.length > 1 ? (w.openAnswers.shift() as ToolCallResult) : (w.openAnswers[0] as ToolCallResult)
    if (input.tool !== LIST) return { result: 'ok', text: 'ok' }
    return w.listAnswer(JSON.stringify(w.rows))
  })
  on('prompt.read', () => ({ value: { text: w.prompt, cursor: w.prompt.length } }))
  on('prompt.fill', ($, e) => {
    w.fills.push({ text: e.text, mode: e.mode })
    if (w.isFillable) w.prompt = e.text
    return { isFilled: w.isFillable }
  })
  on('ui.toast', ($, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    w.opens.push(e.id)
    w.openArgs.push(e as unknown as Record<string, unknown>)
    return { value: w.isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'under the floor of 110 columns: 80 now' } }
  })
  on('ui.close', ($, e) => {
    w.closes.push(e.id)
    return { value: undefined }
  })
  on('ui.copy', ($, e) => {
    w.copies.push({ text: e.text, surface: e.surface })
    return { value: w.isCopyable ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } } as const
  })
  on('ui.scroll', ($, e) => {
    w.scrolls.push(e as unknown as Record<string, unknown>)
    return {}
  })
  on('prompt.submit', ($, e) => {
    w.submits.push(e.text)
    return { text: e.text }
  })
  on('session.send', () => {
    w.forbidden.push('session.send')
    return { isDelivered: false, reason: 'the panel never sends' } as const
  })
  on('fs.write', () => {
    w.forbidden.push('fs.write')
    return { deny: 'the panel never writes' }
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
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const start = ($: Engine) => $.session.start({ cwd: '/w', surface: 'desktop', isInteractive: true })
/** `/devkit-panel <args>` as the person types it. */
const command = ($: Engine, args = '') =>
  $.command.run({ command: 'devkit-panel', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
const turn = ($: Engine, agentId?: string) =>
  $.turn.complete({ answer: 'done', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', ...(agentId === undefined ? {} : { agentId }) })
/** The checker runs: `node` processes (git is not a checker). */
const nodeRuns = (w: World) => w.runs.filter(r => r.argv[0] === 'node')
const isScript = (argv: readonly string[], name: string) => String(argv[1]).endsWith(`${name}.mjs`)
const changeRuns = (w: World) => nodeRuns(w).filter(r => r.argv.includes('--change'))
const deliverRuns = (w: World) => nodeRuns(w).filter(r => isScript(r.argv, 'deliver-check'))
/** The ids `--change` ran for, in order. */
const changeIds = (w: World) => changeRuns(w).map(r => String(r.argv[r.argv.indexOf('--change') + 1]))
const gitRuns = (w: World) => w.runs.filter(r => r.argv[0] === 'git')
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
type Drawn = { type?: string; props?: Record<string, unknown>; children?: unknown[] }
const isNode = (n: unknown): n is Drawn => typeof n === 'object' && n !== null
/** The text a drawn node shows, leaf by leaf in document order: a Button's label, a Link's label, a Text's strings. */
const leaves = (n: unknown): string[] => {
  if (typeof n === 'string') return [n]
  if (!isNode(n)) return []
  if (n.type === 'Button' && n.props?.label !== undefined) return [String(n.props.label)]
  const kids = (n.children ?? []).flatMap(leaves)
  if (n.type === 'Link') return kids.length > 0 ? kids : [String(n.props?.label ?? n.props?.href ?? '')]
  return kids
}
/** One line per keyed row Box of the mounted tree, indented by its padding; a rule is one `─`. */
const lines = async (ui: { drawn: () => Promise<unknown> }): Promise<string[]> => {
  const out: string[] = []
  const walk = (n: unknown): void => {
    if (!isNode(n)) return
    const key = n.props?.key
    if (n.type === 'Box' && typeof key === 'string' && key.startsWith('row:')) {
      const line = `${' '.repeat(Number(n.props?.paddingLeft ?? 0))}${leaves(n).map(l => l.trim()).filter(l => l !== '').join(' ')}`
      // a graphical surface draws no rule: the top margin of the row after one reads as the one glyph of its kind; a bar is two Boxes of colour
      const isBar = n.props?.height === 1 && (n.children ?? []).some(c => isNode(c) && typeof c.props?.width === 'string' && /%$/.test(c.props.width))
      if (n.props?.marginTop === 1) out.push('─')
      out.push(isBar ? '━' : /^─+$/.test(line) ? '─' : line)
      return
    }
    for (const child of n.children ?? []) walk(child)
  }
  walk(await ui.drawn())
  return out
}
/** Every Text of a mounted tree, one string each (the engine's own band is not keyed rows). */
const texts = async (ui: { findAll: (q: { type: string }) => Promise<{ text?: string }[]> }): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '')
/** The text form (the status answer) with its rules as one `─`, so it compares with `lines`. */
const textLines = (text: string): string[] => text.split('\n').map(l => (/^─+$/.test(l) ? '─' : l))
const CAPTION = 'Esta conversa conduz'
const OTHERS = /^[›▾] Outras changes abertas \d+$/

/** The lines of a section: from the one that starts with `head` to the rule that ends it. */
const section = (all: string[], head: string | RegExp): string[] => {
  const at = all.findIndex(l => (typeof head === 'string' ? l.startsWith(head) : head.test(l)))
  if (at === -1) return []
  const end = all.indexOf('─', at)
  return all.slice(at, end === -1 ? undefined : end)
}
/** The rows under `Outras changes abertas`. */
const othersLines = (all: string[]): string[] => section(all, OTHERS).slice(1)
/** The change block and the Now box: from the caption to the first rule after it. */
const changeBlock = (all: string[]): string[] => section(all, CAPTION)
/** The folder of the built flow fixtures' change. */
const FOLDER = '/w/.claude/worktrees/panel-conduct-view-404c57/openspec/changes/panel-conduct-view'
const WORKTREE = '/w/.claude/worktrees/panel-conduct-view-404c57'
const planFile = (file: string) => `# ${file}\n\n## One\n\nfirst\n\n## Two\n\nsecond\n`

/** A world whose conducted change is one of the built flow fixtures: its rows, its reports and its folder on the in-memory disk. */
const flowWorld = (on: On, fx: FlowFixture): World => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.changes['panel-conduct-view'] = { exitCode: 0, stdout: fx.rowStdout, stderr: '' }
  w.deliver = { exitCode: DELIVER_OPEN_EXIT, stdout: fx.deliverStdout, stderr: '' }
  w.dirs.add(WORKTREE)
  for (const file of fx.files) {
    w.files.set(`${FOLDER}/${file}`, file === 'tasks.md' ? fx.tasks : file === 'proposal.md' ? PROPOSAL_TEXT : file === 'approval.md' ? `# Plan approval\n\n- Status: APPROVED\n- Date: ${fx.approvedOn ?? 'n/a'}\n` : planFile(file))
  }
  return w
}

// ---------------------------------------------------------------- the conducted change, screen 1 (design D3, D8, D22 to D24)

const CHECKS_PENDING = { status: 'open', details: { required: 3, failing: [], pending: ['build'] } }
const THREE_CHILDREN = () => [childRow('panel-conduct-view-p1', { isArchived: true }), childRow('panel-conduct-view-p2', { isRunning: true })]
const SUMMARY = "The devkit pane shows the change this conversation conducts (what it is, where it stands in the flow, what is pending, its documents) and the other open changes, as the owner's approved mock draws it."

test('AC-15 summary-and-documents, AC-19 now-box, AC-14 flow-steps-you-are-here, AC-2 phase-progress, AC-20 pending-list: a /conduct <id> transcript draws screen 1 in the mock\'s order', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.rows = THREE_CHILDREN()
  await start($)
  await settle(w)
  expect(w.registered).toEqual(['/devkit-panel', 'tool:status'])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    expect(all).toEqual([
      'devkit ↻ Atualizar',
      '─',
      CAPTION,
      'panel-conduct-view',
      SUMMARY,
      'w · branch panel-conduct-view',
      'Agora Claude age',
      'Implementar a fase 2: The pane',
      'Faltam 2 tarefas nesta fase.',
      'Depois: provas, revisão, PR e checks.',
      'Continuar aqui põe /conduct panel-conduct-view na caixa',
      '─',
      'Passos 4 de 10',
      '✓ Requisitos 21 critérios',
      '✓ Plano 3 seções',
      '✓ Prontidão aprovada',
      '✓ Sua aprovação 18 set',
      '● Implementação 4 de 9 tarefas ›',
      '○ Provas',
      '○ Revisão',
      '○ PR e checks',
      '○ Merge',
      '○ Retro e arquivo',
      '─',
      'Pendências 5',
      '◐ 2.2 Fourth thing Claude',
      '◐ 2.3 Fifth thing Claude',
      '◐ 2.9 Gate: guard suite gate',
      '◐ 3.1 Sixth thing Claude',
      '◐ 3.9 Gate: guard suite gate',
      '─',
      'Documentos',
      'Proposta Design Tarefas',
      '─',
      'Sessões desta change 2',
      '● Fase 2 · The pane executando ›',
      '› 1 arquivadas',
      '─',
      '› Outras changes abertas 3',
      '─',
      expect.stringMatching(/^Atualizado há \d+ s · próxima em \d+ s$/),
    ])
    // no line holds a bar, and the other changes are not drawn while folded
    expect(all.some(l => l.includes('━'))).toBe(false)
    expect(all.some(l => l.includes('Conduzir'))).toBe(false)
    await ui.unmount()
  }
})

test('AC-14 flow-steps-you-are-here: the planning row draws Readiness as the current step; the delivery row draws PR and checks as the current step', async ($, on) => {
  const planning = flowWorld(on, PLANNING)
  await start($)
  await settle(planning)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const steps = section(await lines(ui), 'Passos')
    expect(steps.slice(0, 4)).toEqual(['Passos 2 de 10', '✓ Requisitos 21 critérios', '✓ Plano 3 seções', '● Prontidão a revisar'])
    expect(steps.slice(4)).toEqual(['○ Sua aprovação', '○ Implementação', '○ Provas', '○ Revisão', '○ PR e checks', '○ Merge', '○ Retro e arquivo'])
    expect(changeBlock(await lines(ui))).toContain('Prontidão do plano')
    await ui.unmount()
  }
})

test('AC-14 flow-steps-you-are-here, AC-3 pr-and-checks: the delivery row has Implementation to Proofs done and PR and checks current with PR #n and its checks word', async ($, on) => {
  const w = flowWorld(on, DELIVERY)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const steps = section(await lines(ui), 'Passos')
    expect(steps.slice(0, 1)).toEqual(['Passos 7 de 10'])
    expect(steps.slice(6, 10)).toEqual(['✓ Provas 2 de 2 critérios', '✓ Revisão', '● PR e checks PR #31 · rodando · aguardando CI', '○ Merge'])
    expect(changeBlock(await lines(ui))).toContain('Aguardando CI')
    await ui.unmount()
  }
})

test('AC-7 panel-order: with next.step verify both surfaces draw Provas as the current step and Revisão after it, pending', async ($, on) => {
  const row = JSON.parse(DELIVERY.rowStdout) as { changes: { next: Record<string, unknown> }[] }
  row.changes = row.changes.map(c => ({ ...c, next: { ...c.next, step: 'verify', actor: 'session' } }))
  const w = flowWorld(on, { ...DELIVERY, rowStdout: JSON.stringify(row) })
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    const steps = section(all, 'Passos')
    const proofs = steps.findIndex(l => l.startsWith('● Provas'))
    expect(proofs).toBeGreaterThan(0)
    expect(steps[proofs + 1]).toBe('○ Revisão')
    expect(steps.indexOf('✓ Revisão')).toBe(-1)
    await ui.unmount()
  }
})

/** The `PR e checks` fact for each state of item 6, on the delivery row. */
const checksRead = (item6: Record<string, unknown>, fact: string): TestBody => async ($, on) => {
  const w = flowWorld(on, DELIVERY)
  const report = JSON.parse(DELIVERY.deliverStdout) as { items: Record<string, unknown>[] }
  report.items = report.items.map(i => (i.id === 6 ? { ...i, ...item6 } : i))
  w.deliver = { exitCode: DELIVER_OPEN_EXIT, stdout: JSON.stringify(report), stderr: '' }
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(section(await lines(ui), 'Passos').some(l => l.startsWith(`● PR e checks ${fact}`)), fact).toBe(true)
    await ui.unmount()
  }
}

test('AC-3 pr-and-checks: item 6 met reads green on the PR and checks row', checksRead({ status: 'met', details: {} }, 'PR #31 · verde'))
test('AC-3 pr-and-checks: item 6 open with a failing check reads red', checksRead({ status: 'open', details: { required: 3, failing: [{ name: 'build', link: '' }], pending: [] } }, 'PR #31 · vermelho'))
test('AC-3 pr-and-checks: item 6 open with only pending checks reads running', checksRead(CHECKS_PENDING, 'PR #31 · rodando'))
test('AC-3 pr-and-checks: item 6 open with neither failing nor pending, and a blocked item 6, read unreadable', checksRead({ status: 'open', details: { required: 3, failing: [], pending: [] } }, 'PR #31 · ilegível'))

/** One transcript form of `/conduct panel-conduct-view` finds the change on top, via command. */
const formFindsChange = (message: SessionMessage): TestBody => async ($, on) => {
  const w = world(on)
  w.messages = [message]
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(changeBlock(await lines(ui)).slice(0, 2)).toEqual([CAPTION, 'panel-conduct-view'])
    await ui.unmount()
  }
}

test('AC-1 conducted-change-on-top: a first line /conduct <id> finds the change on top', formFindsChange(plainCommand('/conduct panel-conduct-view')))
test('AC-1 conducted-change-on-top: a first line /<plugin>:conduct <id> finds the change on top', formFindsChange(plainCommand('/devkit-openspec:conduct panel-conduct-view')))
test('AC-1 conducted-change-on-top: a Skill tool use finds the change on top', formFindsChange(skillToolUse('panel-conduct-view')))

test('AC-1 conducted-change-on-top: a conducted id the checker does not know is its id and the checker\'s line, and nothing else', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('typo-id')]
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await lines(ui)
  const error = (JSON.parse(MISSING_STDOUT) as { error: string }).error
  expect(all).toContain(`! ${error}`)
  expect(changeBlock(all)).toEqual([CAPTION, 'typo-id'])
  expect(all.some(l => l.startsWith('Passos') || l.startsWith('Agora') || l.startsWith('Pendências'))).toBe(false)
  expect(deliverRuns(w)).toEqual([])
  expect(othersLines(await lines(ui)).concat(all).some(l => l.includes('typo-id') && l !== 'typo-id')).toBe(false)
  await ui.unmount()
})

test('AC-7 no-conducted-change, AC-6 other-changes-collapsed: with no conduct invocation and no own child the pane is screen 3: its title, sentence and every open change', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    expect(all.slice(0, 5)).toEqual(['devkit ↻ Atualizar', '─', 'Nenhuma change nesta conversa', 'Escolha uma abaixo para conduzir aqui. O botão põe o comando na caixa de texto; você aperta Enter.', 'Changes abertas em w 4'])
    expect(all.slice(5, -2)).toEqual([
      '◐ getting-started-roadmap Conduzir',
      '  aprovar o plano',
      '● commit-and-pr-trailer Conduzir',
      '  gate da fase 1',
      '● panel-conduct-view Conduzir',
      '  implementar fase 1',
      '○ conventions-trailer Conduzir',
      '  aguardando dependências',
    ])
    expect(all.some(l => l.includes(CAPTION) || l.startsWith('Passos'))).toBe(false)
    expect(all.some(l => l.includes('Entregar') || l.includes('Ship'))).toBe(false)
    await ui.unmount()
  }
  // every candidate was asked once, and the listing came from git and the folders
  expect(changeIds(w).sort()).toEqual(['commit-and-pr-trailer', 'conventions-trailer', 'getting-started-roadmap', 'panel-conduct-view'])
  expect(gitRuns(w)).toEqual([{ argv: ['git', '-C', '/w', 'worktree', 'list', '--porcelain'], cwd: '/w', env: undefined, timeoutMs: 10_000 }])
})

test('AC-1 conducted-change-on-top, AC-5 child-sessions-with-icons: a round 5 transcript plus an own child named <prefix>2 makes that change the top one, via children', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('round 5')]
  w.rows = [childRow('panel-conduct-view-p1', { isArchived: true }), childRow('panel-conduct-view-p2', { isRunning: true })]
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    expect(changeBlock(all).slice(0, 2)).toEqual([CAPTION, 'panel-conduct-view'])
    expect(section(all, 'Sessões')).toEqual(['Sessões desta change 2', '● Fase 2 · The pane, the band, the buttons… executando ›', '› 1 arquivadas'])
    expect(othersLines(all).some(l => l.includes('panel-conduct-view'))).toBe(false)
    await ui.unmount()
  }
  // the permission check, then the call's own check the engine raises for it: the new input both times
  expect(w.checks[0]).toEqual({ tool: LIST, input: { linked: true, include_archived: true, limit: 100 } })
  expect(w.checks.every(c => JSON.stringify(c) === JSON.stringify(w.checks[0]))).toBe(true)
  expect(w.calls).toHaveLength(1)
  expect(w.calls[0]).toMatchObject({ tool: LIST, linked: true, include_archived: true, limit: 100 })
})

test('AC-1 conducted-change-on-top, AC-5 child-sessions-with-icons: a compacted transcript plus an own child gives the same top change on a light trigger and with the pane closed, from the stored rows', async ($, on) => {
  const w = world(on)
  w.messages = [chat('user', 'summary of the conversation so far')]
  w.rows = [childRow('panel-conduct-view-p1', { isRunning: true })]
  await start($)
  await settle(w)
  const top = async () => {
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const all = await lines(ui)
    await ui.unmount()
    return changeBlock(all).slice(0, 2)
  }
  expect(await top()).toEqual([CAPTION, 'panel-conduct-view'])
  // the pane closed, a turn ends: the conducted change's two checkers, and no other candidate
  w.runs = []
  await w.clock.advance(1_000)
  await turn($)
  await settle(w)
  expect(changeIds(w)).toEqual(['panel-conduct-view'])
  expect(deliverRuns(w).map(r => r.argv[2])).toEqual(['panel-conduct-view'])
  expect(await top()).toEqual([CAPTION, 'panel-conduct-view'])
  // the pane open, a timer tick: the same two, no row younger than 5 minutes
  w.runs = []
  w.panes = ['devkit-panel']
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(changeIds(w)).toEqual(['panel-conduct-view'])
  expect(await top()).toEqual([CAPTION, 'panel-conduct-view'])
})

test('AC-5 child-sessions-with-icons: two ids sharing a prefix: a round 5 transcript finds neither; /conduct <a> shows a with one line naming b and no child', async ($, on) => {
  const w = world(on)
  w.worktrees = 'worktree /w\nHEAD x\nbranch refs/heads/main\n'
  w.dirs.add('/w/openspec/changes/checkout-discount-codes-a')
  w.dirs.add('/w/openspec/changes/checkout-discount-codes-b')
  w.changes = {
    'checkout-discount-codes-a': changeRun('checkout-discount-codes-a', { prefix: 'checkout-discount-co-p' }),
    'checkout-discount-codes-b': changeRun('checkout-discount-codes-b', { prefix: 'checkout-discount-co-p' }),
  }
  w.rows = [childRow('checkout-discount-co-p2', { isRunning: true })]
  w.messages = [commandTags('round 5')]
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await lines(ui)).some(l => l === 'Nenhuma change nesta conversa')).toBe(true)
  w.messages = [commandTags('checkout-discount-codes-a')]
  await turn($)
  await settle(w)
  await ui.redraw()
  const all = await lines(ui)
  expect(changeBlock(all).slice(0, 2)).toEqual([CAPTION, 'checkout-discount-codes-a'])
  expect(section(all, 'Sessões')).toEqual(['Sessões desta change —', 'nomes de sessão compartilhados com checkout-discount-codes-b'])
  expect(all.some(l => l.includes('checkout-discount-co-p2'))).toBe(false)
  await ui.press({ key: 'toggle:in-progress' })
  await ui.redraw()
  expect(othersLines(await lines(ui)).some(l => l.includes('checkout-discount-codes-b'))).toBe(true)
  await ui.unmount()
})

// ---------------------------------------------------------------- which runs, on which trigger (design D5)

test('D5: a light trigger runs the conducted change\'s two checkers; a full trigger runs every candidate; the pane closed runs only the conducted change', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  expect(changeIds(w).sort()).toEqual(['commit-and-pr-trailer', 'conventions-trailer', 'getting-started-roadmap', 'panel-conduct-view'])
  expect(deliverRuns(w)).toEqual([{ argv: ['node', `${CHECKER}/deliver-check.mjs`, 'panel-conduct-view', '--json'], cwd: '/w/.claude/worktrees/panel-conduct-view', env: { DEVKIT_HOST: 'app' }, timeoutMs: 60_000 }])
  expect(changeRuns(w).find(r => r.argv.includes('panel-conduct-view'))).toEqual({
    argv: ['node', `${CHECKER}/conduct-check.mjs`, '--json', '--change', 'panel-conduct-view'],
    cwd: '/w',
    env: { DEVKIT_HOST: 'app' },
    timeoutMs: 60_000,
  })
  // the pane closed
  w.runs = []
  await w.clock.advance(1_000)
  await turn($)
  await settle(w)
  expect(changeIds(w)).toEqual(['panel-conduct-view'])
  expect(deliverRuns(w)).toHaveLength(1)
  // a full trigger: the pane's Refresh
  w.runs = []
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  await settle(w)
  expect(changeIds(w).sort()).toEqual(['commit-and-pr-trailer', 'conventions-trailer', 'getting-started-roadmap', 'panel-conduct-view'])
  expect(deliverRuns(w)).toHaveLength(1)
  await ui.unmount()
})

test('D5: a candidate that appears after session start is fetched once on the next light trigger, pane open or closed, and not again until the 5-minute rule', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  // pane closed: a turn ends
  w.dirs.add('/w/openspec/changes/newbie')
  w.changes.newbie = changeRun('newbie', { step: 'implement', actor: 'session' })
  w.runs = []
  await w.clock.advance(1_000)
  await turn($)
  await settle(w)
  expect(changeIds(w).filter(id => id === 'newbie')).toEqual(['newbie'])
  w.runs = []
  await turn($)
  await settle(w)
  expect(changeIds(w)).toEqual(['panel-conduct-view'])
  // pane open: the next tick fetches the second newcomer once
  w.dirs.add('/w/openspec/changes/newbie-two')
  w.changes['newbie-two'] = changeRun('newbie-two')
  w.panes = ['devkit-panel']
  w.runs = []
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(changeIds(w).filter(id => id === 'newbie-two')).toEqual(['newbie-two'])
  w.runs = []
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(changeIds(w)).toEqual(['panel-conduct-view'])
  // 5 minutes after their fetch the stale rows are asked again, once each
  w.runs = []
  await w.clock.advance(FRESH_MS)
  await settle(w)
  const ids = changeIds(w)
  expect(ids.filter(id => id === 'newbie')).toEqual(['newbie'])
  expect(ids.filter(id => id === 'commit-and-pr-trailer')).toEqual(['commit-and-pr-trailer'])
})

test('D5: an archived row and a branch-only exit 3 are absent and are not fetched on light triggers; a folder candidate with exit 3 is a row with its error', async ($, on) => {
  const w = world(on)
  w.dirs.add('/w/openspec/changes/old-one')
  w.dirs.add('/w/openspec/changes/broken-folder')
  w.changes['old-one'] = changeRun('old-one', { step: 'archived', actor: 'none', state: 'archived' })
  w.changes['getting-started-roadmap'] = MISSING
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(all.some(l => l.includes('old-one'))).toBe(false)
  expect(all.some(l => l.includes('getting-started-roadmap'))).toBe(false)
  expect(all).toContain('✕ broken-folder Conduzir')
  expect(all).toContain(`  ! ${(JSON.parse(MISSING_STDOUT) as { error: string }).error}`)
  await ui.unmount()
  // the pane open for 6 minutes: the dropped ids are never asked again, a live one is
  w.panes = ['devkit-panel']
  w.runs = []
  await w.clock.advance(FRESH_MS + REFRESH_MS)
  await settle(w)
  const ids = changeIds(w)
  expect(ids).not.toContain('old-one')
  expect(ids).not.toContain('getting-started-roadmap')
  expect(ids).toContain('commit-and-pr-trailer')
})

test('D5: at most three checker runs at once', async ($, on) => {
  const w = world(on)
  const held: ReturnType<typeof gate>[] = []
  let active = 0
  let peak = 0
  w.hold = argv => {
    if (!argv.includes('--change')) return undefined
    const g = gate()
    held.push(g)
    active++
    peak = Math.max(peak, active)
    return g.promise.then(() => {
      active--
    })
  }
  await start($)
  await settle(w)
  expect(held).toHaveLength(3)
  while (held.length > 0) {
    held.shift()?.release()
    await settle(w)
  }
  expect(peak).toBe(3)
  expect(changeIds(w)).toHaveLength(4)
})

test('D5: a rate-limited gh pauses the checks: light runs none, a full trigger runs the conducted change only, nothing fetches a newcomer until the pause ends', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.deliver = rateLimitedDeliver()
  await start($)
  await settle(w)
  expect(deliverRuns(w)).toHaveLength(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // a candidate appears during the pause
  w.dirs.add('/w/openspec/changes/newbie')
  w.changes.newbie = changeRun('newbie')
  w.runs = []
  await w.clock.advance(1_000)
  await turn($)
  await settle(w)
  expect(nodeRuns(w)).toEqual([])
  await ui.redraw()
  const all = await lines(ui)
  expect(all.some(l => /^! limite do GitHub: checagens pausadas até \d\d:\d\d$/.test(l))).toBe(true)
  expect(all.at(-1)).toMatch(/^Atualizado há \d+ s · pausado até \d\d:\d\d$/)
  expect(changeBlock(all).slice(0, 2)).toEqual([CAPTION, 'panel-conduct-view'])
  expect(textLines(((await command($, 'status')).text) ?? '').some(l => l.includes('newbie'))).toBe(false)
  // a full trigger: only the conducted change's two checkers, and the pause restarts
  await ui.press({ key: 'refresh' })
  await settle(w)
  expect(changeIds(w)).toEqual(['panel-conduct-view'])
  expect(deliverRuns(w)).toHaveLength(1)
  await ui.redraw()
  expect(textLines(((await command($, 'status')).text) ?? '').some(l => l.includes('newbie'))).toBe(false)
  // the pause ends: the first light trigger runs as usual and fetches the newcomer
  w.deliver = { exitCode: DELIVER_EXIT, stdout: DELIVER_STDOUT, stderr: '' }
  await w.clock.advance(BACKOFF_MS + 1_000)
  w.runs = []
  await turn($)
  await settle(w)
  expect(changeIds(w).sort()).toEqual(['newbie', 'panel-conduct-view'])
  await ui.redraw()
  const later = await lines(ui)
  expect(later.some(l => l.includes('limite do GitHub') || l.includes('pausado até'))).toBe(false)
  expect(textLines(((await command($, 'status')).text) ?? '').some(l => l.includes('newbie'))).toBe(true)
  await ui.unmount()
})

test('D5: a rate-limit line from a conduct-check run pauses the checks too', async ($, on) => {
  const w = world(on)
  w.changes['commit-and-pr-trailer'] = { exitCode: 3, stdout: '{"version":2,"error":"gh: API rate limit exceeded for user ID 1"}', stderr: '' }
  await start($)
  await settle(w)
  w.runs = []
  await turn($)
  await settle(w)
  expect(nodeRuns(w)).toEqual([])
})

test('D4, D6: an installed checker 0.9.1 is the one old-checker line and runs nothing', async ($, on) => {
  const w = world(on, { checker: false })
  w.files.set(
    '/h/.claude/plugins/installed_plugins.json',
    JSON.stringify({ version: 2, plugins: { 'devkit-openspec@devkit': [{ scope: 'user', installPath: '/h/.claude/plugins/cache/devkit/devkit-openspec/0.9.1', version: '0.9.1' }] } }),
  )
  await start($)
  await settle(w)
  await turn($)
  await settle(w)
  expect(w.runs).toEqual([])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await lines(ui)).toEqual(['requer devkit-openspec 0.10.0 ou mais novo'])
    await ui.unmount()
  }
})

test('D4: a failed git worktree list is one error line and the root alone is used', async ($, on) => {
  const w = world(on)
  w.worktrees = 'reject'
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(all.some(l => /^! conduct-check: git worktree list: .*timed out after 60000 ms$/.test(l))).toBe(true)
  // the root's own folders: none in this disk
  expect(all.some(l => l.includes('Conduzir'))).toBe(false)
  await ui.unmount()
})

// ---------------------------------------------------------------- one refresh at a time, errors (design D5)

test('D5: while a refresh is in flight the header reads refreshing and the last view stays; once it lands, its age', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  const held = gate()
  w.hold = argv => (argv.includes('--change') ? held.promise : undefined)
  await turn($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    expect(all.at(-1)).toBe('atualizando...')
    expect(changeBlock(all).slice(0, 2)).toEqual([CAPTION, 'panel-conduct-view'])
    await ui.unmount()
  }
  held.release()
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await lines(ui)).at(-1)).toMatch(/^Atualizado há 0 s · próxima em \d+ s$/)
  await ui.unmount()
})

test('D5: the view refreshes at session start, at the end of a main-loop turn and every 60 s while the pane is open; never for a subagent; Refresh is a full run', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  expect(gitRuns(w)).toHaveLength(1)
  await turn($, 'agent-1')
  await settle(w)
  expect(gitRuns(w)).toHaveLength(1)
  await turn($)
  await settle(w)
  expect(gitRuns(w)).toHaveLength(2)
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(gitRuns(w)).toHaveLength(2)
  w.panes = ['devkit-panel']
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(gitRuns(w)).toHaveLength(3)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  await settle(w)
  expect(gitRuns(w)).toHaveLength(4)
  await ui.unmount()
})

test('D5: two triggers at once make one run, and a full trigger during a light run queues one full run behind it', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  expect(gitRuns(w)).toHaveLength(1)
  await Promise.all([turn($), turn($)])
  await settle(w)
  expect(gitRuns(w)).toHaveLength(2)
  // a light run held, a full trigger (the pane's Refresh) meanwhile, twice: one more run, a full one
  const held = gate()
  w.hold = argv => (argv[0] === 'git' ? held.promise : undefined)
  w.runs = []
  await turn($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  await ui.press({ key: 'refresh' })
  await settle(w)
  expect(gitRuns(w)).toHaveLength(1)
  w.hold = undefined
  held.release()
  await settle(w)
  expect(gitRuns(w)).toHaveLength(2)
  expect(changeIds(w).sort()).toEqual(['commit-and-pr-trailer', 'conventions-trailer', 'getting-started-roadmap', 'panel-conduct-view', 'panel-conduct-view'].sort())
  await ui.unmount()
})

test('D5: a failed run keeps the entry\'s last good row, sets its error, and the conducted change stays on top', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  w.changes['panel-conduct-view'] = 'reject'
  await w.clock.advance(5_000)
  await turn($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    expect(all.at(-1)).toMatch(/^Atualizado há 0 s · próxima em \d+ s$/)
    expect(changeBlock(all).slice(0, 2)).toEqual([CAPTION, 'panel-conduct-view'])
    expect(all.some(l => /^! .*timed out after 60000 ms$/.test(l))).toBe(true)
    // the last good row stays: the Now box and the steps are still drawn
    expect(all.some(l => l.startsWith('Passos'))).toBe(true)
    await ui.unmount()
  }
  // a report of a newer JSON version is the same one error line
  w.changes['panel-conduct-view'] = { exitCode: 0, stdout: JSON.stringify({ ...(JSON.parse(CHANGE_STDOUT) as Record<string, unknown>), version: 3 }), stderr: '' }
  await turn($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await lines(ui)).toContain('! JSON version 3 is newer than the 2 this panel reads')
  await ui.unmount()
})

// ---------------------------------------------------------------- not a devkit project, no checker (design D4)

test('D4: a plain OpenSpec project (config.yaml with another schema) is the same one line, no checker run and the engine band', async ($, on) => {
  const w = world(on)
  w.files.set('/w/openspec/config.yaml', 'schema: spec-driven\n')
  await start($)
  await settle(w)
  await turn($)
  await settle(w)
  expect(w.runs).toEqual([])
  for (const surface of SURFACES) {
    const pane = await $.ui.mount({ ...PANE, surface })
    expect(await lines(pane)).toEqual(['Não é um projeto OpenSpec devkit.'])
    await pane.unmount()
    const band = await $.ui.mount({ ...BAND, surface })
    expect(await texts(band)).toEqual(['engine'])
    await band.unmount()
  }
})

test('D4: outside an OpenSpec devkit project the pane is one line and no checker runs', async ($, on) => {
  const w = world(on, { devkit: false })
  await start($)
  await settle(w)
  await turn($)
  await settle(w)
  expect(w.runs).toEqual([])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await lines(ui)).toEqual(['Não é um projeto OpenSpec devkit.'])
    await ui.unmount()
  }
})

test('D4: a devkit project with no checker installed is one line naming the install command, and no run', async ($, on) => {
  const w = world(on, { checker: false })
  await start($)
  await settle(w)
  expect(w.runs).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await lines(ui)).toEqual(['Sem checker: instale devkit-openspec@devkit --scope project.'])
  await ui.unmount()
})

// ---------------------------------------------------------------- the family (design D9)

/** `ask` or `deny`: no session tool is called, the lists stay empty and one line names the tool; a timer never asks. */
const noList = (permission: Permission): TestBody => async ($, on) => {
  const w = world(on)
  w.permission = permission
  w.messages = [commandTags('panel-conduct-view')]
  w.rows = [childRow('panel-conduct-view-p1', { isRunning: true })]
  await start($)
  await settle(w)
  w.panes = ['devkit-panel']
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  expect(w.calls).toEqual([])
  expect(w.checks.length).toBeGreaterThan(0)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    expect(all).toContain(`permita ${LIST} para ver as sessões filhas`)
    expect(all.some(l => l.includes('executando'))).toBe(false)
    await ui.unmount()
  }
}

test('AC-5 child-sessions-with-icons: with ask no tool.call is made and one line names the tool; a timer never asks', noList('ask'))
test('AC-5 child-sessions-with-icons: with deny the same: no call, no children, the line', noList('deny'))

/** A `list_sessions` call answered with `answer`: the error line names the tool and the reason; no permission notice, no rows. */
const listFails = (answer: ToolCallResult, reason: string): TestBody => async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.rows = [childRow('panel-conduct-view-p1', { isRunning: true })]
  w.listAnswer = () => answer
  await start($)
  await settle(w)
  expect(w.calls).toHaveLength(1)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    expect(all).toContain(`! list_sessions: ${reason}`)
    expect(all.some(l => l.includes('permita'))).toBe(false)
    expect(all.some(l => l.includes('executando'))).toBe(false)
    expect(changeBlock(all).slice(0, 2)).toEqual([CAPTION, 'panel-conduct-view'])
    await ui.unmount()
  }
}

test('AC-5 child-sessions-with-icons: a refused list_sessions call ({ deny }) is one error line naming the tool, never a silent empty list', listFails({ deny: 'refused by a hook' }, 'refused by a hook'))
test('AC-5 child-sessions-with-icons: a failed list_sessions call ({ isError }) is one error line with the text the model read', listFails({ isError: true, result: 'the app is away', text: 'the app is away' }, 'the app is away'))

/** The rows read from a `list_sessions` answer of that shape: the children are listed. */
const listAnswers = (answer: (text: string) => ToolCallResult): TestBody => async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.rows = [childRow('panel-conduct-view-p1', { isRunning: true })]
  w.listAnswer = answer
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(all.some(l => l.includes('list_sessions'))).toBe(false)
  expect(all.some(l => /^● Fase 1 · .* executando ›$/.test(l))).toBe(true)
  await ui.unmount()
}

test("AC-5 child-sessions-with-icons: the rows are read from a hook's own answer, a string result with no text", listAnswers(text => ({ result: text })))
test("AC-5 child-sessions-with-icons: the rows are read from core's text when the result is not a string", listAnswers(text => ({ result: { rows: 1 }, text })))

test('AC-5 child-sessions-with-icons: when the tool is not listed at all, no check and no call are made', async ($, on) => {
  const w = world(on)
  w.tools = ['Bash']
  await start($)
  await settle(w)
  expect(w.checks).toEqual([])
  expect(w.calls).toEqual([])
})

test('D9: no refresh, timer tick or render ever calls open_session_in', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.rows = [childRow('panel-conduct-view-p1', { isRunning: true })]
  await start($)
  await settle(w)
  w.panes = ['devkit-panel']
  await turn($)
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  await settle(w)
  await ui.unmount()
  expect(w.calls.every(c => c.tool === LIST)).toBe(true)
  expect(w.checks.every(c => (c as { tool: string }).tool === LIST)).toBe(true)
})

// ---------------------------------------------------------------- the in-progress group, the child rows (design D8)

test('AC-6 other-changes-collapsed: Outras changes abertas is folded while a change is conducted and unfolds on a press; each row has its progress and Conduzir, and there is no Ship', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.files.set('/w/.claude/worktrees/commit-and-pr-trailer/openspec/changes/commit-and-pr-trailer/tasks.md', '## 1. A\n\n- [x] 1.1 a\n- [x] 1.2 b\n- [ ] 1.3 c\n')
  w.dirs.add('/w/.claude/worktrees/commit-and-pr-trailer')
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await lines(ui)).toContain('› Outras changes abertas 3')
    expect(othersLines(await lines(ui))).toEqual([])
    await ui.press({ key: 'toggle:in-progress' })
    await ui.redraw()
    const open = await lines(ui)
    expect(open).toContain('▾ Outras changes abertas 3')
    expect(othersLines(open)).toEqual([
      'independentes desta conversa; nenhuma precisa terminar antes',
      '◐ getting-started-roadmap Conduzir',
      '  aprovar o plano',
      '● commit-and-pr-trailer Conduzir',
      '  2 de 3 tarefas · gate da fase 1',
      '○ conventions-trailer Conduzir',
      '  aguardando dependências',
    ])
    expect(open.some(l => l.includes('Entregar') || l.includes('Ship'))).toBe(false)
    await ui.press({ key: 'toggle:in-progress' })
    await ui.unmount()
  }
})

/** After six rows the list offers show more, which unfolds the rest. */
const showMore = (surface: (typeof SURFACES)[number]): TestBody => async ($, on) => {
  const w = world(on)
  for (let i = 1; i <= 5; i++) {
    w.dirs.add(`/w/openspec/changes/extra-${i}`)
    w.changes[`extra-${i}`] = changeRun(`extra-${i}`)
  }
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface })
  const folded = await lines(ui)
  expect(folded).toContain('Changes abertas em w 9')
  const rows = (all: string[]) => all.filter(l => l.endsWith('Conduzir'))
  expect(rows(folded)).toHaveLength(6)
  expect(folded).toContain('mostrar mais (3)')
  await ui.press({ key: 'toggle:more' })
  await ui.redraw()
  const all = await lines(ui)
  expect(rows(all)).toHaveLength(9)
  expect(all.some(l => l.includes('mostrar mais'))).toBe(false)
  await ui.unmount()
}

test('AC-6 other-changes-collapsed: after six rows the list offers show more (terminal)', showMore('terminal'))
test('AC-6 other-changes-collapsed: after six rows the list offers show more (desktop)', showMore('desktop'))

test('AC-5 child-sessions-with-icons: each child row has its glyph, phase n and state word; the archived ones are one folded row', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.rows = [childRow('panel-conduct-view-p3'), childRow('panel-conduct-view-p1', { isArchived: true }), childRow('panel-conduct-view-p2', { isRunning: true })]
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(section(await lines(ui), 'Sessões')).toEqual([
      'Sessões desta change 3',
      '● Fase 2 · The pane, the band, the buttons… executando ›',
      '○ Fase 3 · Release files and docs ociosa ›',
      '› 1 arquivadas',
    ])
    await ui.press({ key: 'toggle:archived' })
    await ui.redraw()
    expect(section(await lines(ui), 'Sessões').at(-1)).toBe('✓ Fase 1 · Loading in both CLIs, and the d… arquivada ›')
    await ui.press({ key: 'toggle:archived' })
    await ui.unmount()
  }
})

// ---------------------------------------------------------------- a press opens a child (design D9)

const CHILD = { sessionId: 'local_panel-conduct-view-p2', key: 'open:local_panel-conduct-view-p2' }
const openCalls = (w: World) => w.calls.filter(c => c.tool === OPEN).map(({ tool_use_id: _id, ...call }) => call)

/** A conducted change with one running child, the pane mounted on `surface`. */
const withChild = async ($: Engine, w: World, surface: (typeof SURFACES)[number]) => {
  w.messages = [commandTags('panel-conduct-view')]
  w.rows = [childRow('panel-conduct-view-p2', { isRunning: true })]
  await start($)
  await settle(w)
  return $.ui.mount({ ...PANE, surface })
}

test('AC-5 child-sessions-with-icons: a press on a child row calls open_session_in with its sessionId and target split, and no other session tool', async ($, on) => {
  const w = world(on)
  const ui = await withChild($, w, 'desktop')
  expect((await ui.find({ key: CHILD.key }))?.text).toBe('Fase 2 · The pane, the band, the buttons…')
  w.calls = []
  await ui.press({ key: CHILD.key })
  await settle(w)
  expect(openCalls(w)).toEqual([{ tool: OPEN, session_id: CHILD.sessionId, target: 'split' }])
  expect(w.calls).toHaveLength(1)
  expect(w.toasts).toEqual([])
  await ui.unmount()
})

test('AC-5 child-sessions-with-icons: on the terminal a press opens the same call', async ($, on) => {
  const w = world(on)
  const ui = await withChild($, w, 'terminal')
  w.calls = []
  await ui.press({ key: CHILD.key })
  await settle(w)
  expect(openCalls(w)).toEqual([{ tool: OPEN, session_id: CHILD.sessionId, target: 'split' }])
  await ui.unmount()
})

test('AC-5 child-sessions-with-icons: an error answer makes exactly one window call; a window call that fails too toasts the app\'s text', async ($, on) => {
  const w = world(on)
  const ui = await withChild($, w, 'desktop')
  w.openAnswers = [{ isError: true, result: 'no room for a split', text: 'no room for a split' }, { result: 'ok', text: 'ok' }]
  w.calls = []
  await ui.press({ key: CHILD.key })
  await settle(w)
  expect(openCalls(w)).toEqual([
    { tool: OPEN, session_id: CHILD.sessionId, target: 'split' },
    { tool: OPEN, session_id: CHILD.sessionId, target: 'window' },
  ])
  expect(w.toasts).toEqual([])
  w.openAnswers = [{ isError: true, result: 'Ask the user to open it from the sidebar', text: 'Ask the user to open it from the sidebar' }]
  w.calls = []
  await ui.press({ key: CHILD.key })
  await settle(w)
  expect(openCalls(w)).toHaveLength(2)
  expect(w.toasts).toEqual(['Ask the user to open it from the sidebar'])
  await ui.unmount()
})

test('AC-5 child-sessions-with-icons: with deny there is no call and one toast naming the tool; with ask the call is made and the engine raises its own permission check', async ($, on) => {
  const w = world(on)
  const ui = await withChild($, w, 'desktop')
  w.openPermission = 'deny'
  w.calls = []
  w.checks = []
  await ui.press({ key: CHILD.key })
  await settle(w)
  expect(openCalls(w)).toEqual([])
  expect(w.checks).toHaveLength(1)
  expect(w.toasts).toEqual([`permita ${OPEN} para abrir a sessão`])
  // ask: the panel's check lets the call go to the engine, whose own check (there is no dialog in a test) refuses it: one more toast
  w.openPermission = 'ask'
  w.checks = []
  await ui.press({ key: CHILD.key })
  await settle(w)
  expect(w.checks.length).toBeGreaterThan(1)
  expect(w.toasts).toHaveLength(2)
  expect(w.toasts[1]).toContain(`Permission to use ${OPEN}`)
  await ui.unmount()
})

test('AC-5 child-sessions-with-icons: a { deny } answer or a rejection is one toast and no retry', async ($, on) => {
  const w = world(on)
  const ui = await withChild($, w, 'desktop')
  w.openAnswers = [{ deny: 'blocked by a hook' }]
  w.calls = []
  await ui.press({ key: CHILD.key })
  await settle(w)
  expect(openCalls(w)).toHaveLength(1)
  expect(w.toasts).toEqual(['blocked by a hook'])
  await ui.unmount()
})

test('AC-5 child-sessions-with-icons: with open_session_in unlisted the child row is plain text with the sidebar hint, and nothing is checked or called for it', async ($, on) => {
  const w = world(on)
  w.tools = [LIST, 'Bash']
  const ui = await withChild($, w, 'desktop')
  expect(await ui.find({ key: CHILD.key })).toBeUndefined()
  const all = await lines(ui)
  expect(all).toContain('● Fase 2 · The pane, the band, the buttons… executando')
  expect(all).toContain('abra pela barra lateral')
  expect(w.checks.every(c => (c as { tool: string }).tool === LIST)).toBe(true)
  expect(openCalls(w)).toEqual([])
  await ui.unmount()
})

// ---------------------------------------------------------------- the buttons visibly fill (design D10, D24)

const FILLED = 'clique na caixa de texto e aperte Enter'

/** A conducted change at a step where the owner has a button for each of the texts. */
const ownerWorld = (on: On, step: string, actor: string) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  w.changes['panel-conduct-view'] = changeRun('panel-conduct-view', { step, actor })
  return w
}

/** Each button of the Now box fills its exact text with `replace`, then reads `✓ ` plus its label; the hint and the toast read the filled text. */
const buttonFills = (step: string, actor: string, buttons: [key: string, label: string, text: string][]): TestBody => async ($, on) => {
  const w = ownerWorld(on, step, actor)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const [key, label, text] of buttons) {
      expect((await ui.find({ key }))?.text, key).toBe(label)
      w.fills = []
      w.toasts = []
      await ui.press({ key })
      await ui.redraw()
      expect(w.fills).toEqual([{ text, mode: 'replace' }])
      expect((await ui.find({ key }))?.text).toBe(`✓ ${label}`)
      expect((await lines(ui)).some(l => l.endsWith(FILLED))).toBe(true)
      expect(w.toasts).toEqual([FILLED])
    }
    expect(await ui.find({ key: 'ship:panel-conduct-view' })).toBeUndefined()
    await ui.unmount()
    await turn($)
    await settle(w)
  }
  expect(w.submits).toEqual([])
}

test('AC-8 buttons-visibly-fill: Continue here fills /conduct <id> and reads the filled label; there is no Ship button', buttonFills('implement', 'session', [['conduct:panel-conduct-view', 'Continuar aqui', '/conduct panel-conduct-view']]))
test('AC-8 buttons-visibly-fill: Approve plan fills the plan approval text', buttonFills('stop-plan-approval', 'owner', [['approve:panel-conduct-view', 'Aprovar plano', 'Aprovo o plano de panel-conduct-view']]))
test('AC-8 buttons-visibly-fill: Answer retro fills the retro answer text', buttonFills('stop-retro-answers', 'owner', [['answer:panel-conduct-view', 'Responder retro', 'Approve proposal 1 of panel-conduct-view']]))

test('AC-8 buttons-visibly-fill: a second press on the filled button, while the box still holds its text, makes no second fill and no second toast', async ($, on) => {
  const w = ownerWorld(on, 'implement', 'session')
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: SURFACES[0] })
  const key = 'conduct:panel-conduct-view'
  await ui.press({ key })
  await ui.redraw()
  expect(w.prompt).toBe('/conduct panel-conduct-view')
  await ui.press({ key })
  await ui.redraw()
  expect(w.fills).toEqual([{ text: '/conduct panel-conduct-view', mode: 'replace' }])
  expect(w.toasts).toEqual([FILLED])
  expect((await ui.find({ key }))?.text).toBe('✓ Continuar aqui')
  await ui.unmount()
})

test('AC-8 buttons-visibly-fill: after the box changes, a press on the marked button fills again', async ($, on) => {
  const w = ownerWorld(on, 'implement', 'session')
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: SURFACES[0] })
  const key = 'conduct:panel-conduct-view'
  await ui.press({ key })
  w.prompt = 'outra coisa'
  await ui.press({ key })
  await ui.redraw()
  expect(w.fills).toHaveLength(2)
  expect(w.toasts).toEqual([FILLED, FILLED])
  expect(w.prompt).toBe('/conduct panel-conduct-view')
  await ui.unmount()
})

test('AC-8 buttons-visibly-fill: an other-change row fills /conduct <id>, reads ✓ Conduzir, keeps its whole progress and adds one dim line', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const key = 'conduct:commit-and-pr-trailer'
  await ui.press({ key })
  await ui.redraw()
  expect(w.fills).toEqual([{ text: '/conduct commit-and-pr-trailer', mode: 'replace' }])
  expect((await ui.find({ key }))?.text).toBe('✓ Conduzir')
  const all = await lines(ui)
  const at = all.indexOf('● commit-and-pr-trailer ✓ Conduzir')
  expect(all.slice(at, at + 3)).toEqual(['● commit-and-pr-trailer ✓ Conduzir', '  gate da fase 1', `  ${FILLED}`])
  await ui.unmount()
})

test('AC-8 buttons-visibly-fill: another fill moves the mark; a prompt that differs clears it at the next refresh, and so does a turn end; the same text keeps it', async ($, on) => {
  const w = ownerWorld(on, 'stop-plan-approval', 'owner')
  w.panes = ['devkit-panel']
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async (key: string) => (await ui.find({ key }))?.text
  await ui.press({ key: 'conduct:panel-conduct-view' })
  await ui.press({ key: 'approve:panel-conduct-view' })
  await ui.redraw()
  expect(await label('conduct:panel-conduct-view')).toBe('Continuar aqui')
  expect(await label('approve:panel-conduct-view')).toBe('✓ Aprovar plano')
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  await ui.redraw()
  expect(await label('approve:panel-conduct-view')).toBe('✓ Aprovar plano')
  w.prompt = 'Aprovo o plano de panel-conduct-view agora'
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  await ui.redraw()
  expect(await label('approve:panel-conduct-view')).toBe('Aprovar plano')
  await ui.press({ key: 'approve:panel-conduct-view' })
  await turn($, 'agent-1')
  await settle(w)
  await ui.redraw()
  expect(await label('approve:panel-conduct-view')).toBe('✓ Aprovar plano')
  await turn($)
  await settle(w)
  await ui.redraw()
  expect(await label('approve:panel-conduct-view')).toBe('Aprovar plano')
  await ui.unmount()
})

test('AC-8 buttons-visibly-fill: when no box can take the text the command itself is toasted and the label stays', async ($, on) => {
  const w = ownerWorld(on, 'implement', 'session')
  w.isFillable = false
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'conduct:panel-conduct-view' })
  await ui.redraw()
  expect(w.toasts).toEqual(['/conduct panel-conduct-view'])
  expect((await ui.find({ key: 'conduct:panel-conduct-view' }))?.text).toBe('Continuar aqui')
  expect(w.submits).toEqual([])
  await ui.unmount()
})

// ---------------------------------------------------------------- the detail pane (design D20, D21, D22)

const DETAIL = 'devkit-panel-detail'
const DETAIL_PANE = { ...PANE, requestId: DETAIL } as const
const detailOpens = (w: World) => w.openArgs.filter(a => a.id === DETAIL)
const FULL_TASKS = { ...MID_IMPLEMENTATION, tasks: TASKS_TEXT }

/** A world on the mid-implementation row with this repository's own tasks.md (twelve open tasks, gates with $HOME paths). */
const detailWorld = async ($: Engine, on: On, fx: FlowFixture = MID_IMPLEMENTATION) => {
  const w = flowWorld(on, fx)
  await start($)
  await settle(w)
  return w
}

test('AC-16 detail-pane: a press on a pending row opens the detail pane with the three dialog flags; the body has the callout, one group per section, one sentence per task, and no $HOME text until the full text unfolds', async ($, on) => {
  const w = await detailWorld($, on, FULL_TASKS)
  for (const surface of SURFACES) {
    w.openArgs = []
    const main = await $.ui.mount({ ...PANE, surface })
    await main.press({ key: 'pending:4.1' })
    expect(detailOpens(w)).toEqual([expect.objectContaining({ id: DETAIL, title: 'Pendências', focus: true, closeOnEscape: true, holdToasts: true })])
    const ui = await $.ui.mount({ ...DETAIL_PANE, surface })
    const all = await lines(ui)
    expect(all[0]).toBe('Pendências panel-conduct-view · 12 de 29 tarefas ✕')
    expect(all[1]).toMatch(/^12 pendências /)
    expect(all.some(l => l.startsWith('Seção 4 · The approved mock: what the cha…'))).toBe(true)
    expect(all.some(l => l.startsWith('Seção 5 · Live check, owner-run'))).toBe(true)
    expect(all.filter(l => /^ {2}\S/.test(l)).length).toBeGreaterThanOrEqual(9)
    expect(all.some(l => l.includes('$HOME'))).toBe(false)
    expect(all).toContain('› Texto completo das tarefas Copiar')
    expect(all.at(-1)).toBe('Esc fecha e volta ao painel')
    await ui.press({ key: 'detail:full' })
    await ui.redraw()
    expect((await ui.find({ type: 'Code' }))?.props.source).toContain('$HOME')
    await ui.unmount()
    await main.unmount()
  }
})

test('AC-16 detail-pane: Copiar calls ui.copy with the full text and then reads ✓ Copiado; an isCopied: false answer draws the fallback line', async ($, on) => {
  const w = await detailWorld($, on, FULL_TASKS)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'pending:4.1' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  await ui.press({ key: 'detail:copy' })
  await ui.redraw()
  expect(w.copies).toHaveLength(1)
  expect(w.copies[0]?.surface).toBe('desktop')
  expect(w.copies[0]?.text).toContain('- [ ] 4.1 The texts of the six screens')
  expect(w.copies[0]?.text).toContain('$HOME')
  expect((await ui.find({ key: 'detail:copy' }))?.text).toBe('✓ Copiado')
  w.isCopyable = false
  await ui.press({ key: 'detail:full' })
  await ui.press({ key: 'detail:copy' })
  await ui.redraw()
  expect((await lines(ui)).some(l => l.includes('copiar não está disponível aqui'))).toBe(true)
  expect(w.toasts).toEqual([])
  await ui.unmount()
  await main.unmount()
})

test('AC-21 step-detail: a press on Implementação shows k de n tarefas, the percentage, the clipped bar, Faltam with one row per open section, Feitas dimmed and Ver tarefas.md', async ($, on) => {
  const w = await detailWorld($, on)
  for (const surface of SURFACES) {
    const main = await $.ui.mount({ ...PANE, surface })
    await main.press({ key: 'step:implementation' })
    const ui = await $.ui.mount({ ...DETAIL_PANE, surface })
    const all = await lines(ui)
    expect(all[0]).toBe('Implementação panel-conduct-view · 4 de 9 tarefas ✕')
    expect(all[1]).toBe('4 de 9 tarefas 44%')
    expect(all[2]).toBe('━')
    expect(all.slice(3)).toEqual(['─', 'Faltam 2 seções · 5 tarefas', '◐ 2 The pane 1/4 · Claude ›', '◐ 3 Release 0/2 · Claude ›', '─', 'Feitas 1 seção', '✓ 1 Loading 3/3', 'Ver tasks.md Esc fecha'])
    expect(await ui.findAll({ type: 'Text', text: /^━+$/ })).toEqual([])
    // a missing section opens the pending detail for it; Ver tarefas.md opens screen 5
    await ui.press({ key: 'section:3' })
    await ui.redraw()
    const pending = await lines(ui)
    expect(pending.some(l => l.startsWith('Seção 3 · Release'))).toBe(true)
    expect(pending.some(l => l.startsWith('Seção 2'))).toBe(false)
    await ui.unmount()
    await main.unmount()
  }
  expect(w.opens.filter(id => id === DETAIL).length).toBeGreaterThanOrEqual(2)
})

test('AC-4 delivery-items, AC-21 step-detail: Provas shows item 1\'s proofs part and item 4 under their head rows, with labels and no $HOME or task id; Implementação never shows a gate label', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.deliver = { exitCode: DELIVER_OPEN_EXIT, stdout: DELIVER_OPEN_STDOUT, stderr: '' }
  await start($)
  await settle(w)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:proofs' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(all.slice(0, 5)).toEqual(['Provas panel-conduct-view ✕', '○ tarefas aberto', '  1 ausente · 8 sem prova', '  evidence.md ausente', '  test panel (app) sem prova'])
  expect(all).toContain('  +1')
  expect(all).toContain('○ aceitação aberto')
  expect(all).toContain('  1 ausente · 21 sem prova')
  expect(all).toContain('  AC-1 sem prova')
  expect(all.some(l => l.includes('$HOME') || /^ +4\.\d/.test(l))).toBe(false)
  await ui.press({ key: 'detail:full' })
  await ui.redraw()
  expect((await ui.find({ type: 'Code' }))?.props.source).toContain('unticked tasks')
  await ui.unmount()
  await main.press({ key: 'step:implementation' })
  const impl = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const text = (await lines(impl)).join('\n')
  expect(text).not.toContain('sem prova')
  expect(text).not.toContain('(app)')
  await impl.unmount()
  await main.unmount()
})

test('AC-4 delivery-items: Revisão shows items 2 and 3, the missing reviewers by name', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.deliver = { exitCode: DELIVER_OPEN_EXIT, stdout: DELIVER_OPEN_STDOUT, stderr: '' }
  await start($)
  await settle(w)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:review' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(all).toContain('○ revisões aberto')
  expect(all).toContain('  code-quality-reviewer ausente')
  expect(all).toContain('  test-coverage-reviewer ausente')
  expect(all).toContain('✓ achados ok')
  await ui.unmount()
  await main.unmount()
})

test('AC-3 pr-and-checks, AC-4 delivery-items: PR e checks shows a Link to the PR, the checks word and items 5 to 8; without a PR it shows sem PR ainda and item 5\'s line, and no Link', async ($, on) => {
  const w = await detailWorld($, on, DELIVERY)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:pr' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const link = await ui.find({ type: 'Link' })
  expect(link?.props.href).toBe('https://github.com/chacal88/devkit/pull/31')
  expect(link?.props.label).toBe('PR #31 ↗')
  const all = await lines(ui)
  expect(all).toContain('● rodando')
  expect(all).toContain('✓ PR ok')
  expect(all).toContain('○ CI aberto')
  expect(all).toContain('  build rodando')
  await ui.unmount()
  await main.unmount()
  expect(w.forbidden).toEqual([])
})

test('AC-3 pr-and-checks, AC-4 delivery-items: without a pull request PR e checks reads sem PR ainda and item 5\'s line', async ($, on) => {
  const w = await detailWorld($, on)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:pr' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(await ui.find({ type: 'Link' })).toBeUndefined()
  expect(all).toContain('sem PR ainda')
  expect(all).toContain('○ PR aberto')
  expect(all.some(l => l.includes('no pull request for this branch yet'))).toBe(true)
  expect(w.forbidden).toEqual([])
  await ui.unmount()
  await main.unmount()
})

test('AC-14 flow-steps-you-are-here: Requisitos, Prontidão and Sua aprovação show their fact and a Ver <file> press that opens the document', async ($, on) => {
  await detailWorld($, on)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  for (const [key, file, fact] of [['requirements', 'requirements.md', '21 critérios'], ['readiness', 'readiness.md', 'aprovada'], ['approval', 'approval.md', '18 set']] as const) {
    await main.press({ key: `step:${key}` })
    const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
    expect((await lines(ui))[0]).toContain(fact)
    expect((await ui.find({ key: `file:${file}` }))?.text).toBe(`Ver ${file}`)
    await ui.press({ key: `file:${file}` })
    await ui.redraw()
    expect((await lines(ui))[0]).toContain(file)
    await ui.unmount()
  }
  await main.unmount()
})

test('AC-15 summary-and-documents: a press on Design shows screen 5: its tabs, one button per ## heading that scrolls, the file as markdown and the Abrir no editor link', async ($, on) => {
  const w = await detailWorld($, on)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'doc:design.md' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(all[0]).toBe('Design panel-conduct-view · design.md ✕')
  expect(all[1]).toBe('Requisitos Proposta Design Tarefas Prontidão Aprovação')
  expect(all[2]).toBe('─')
  expect(all[3]).toBe('Seções One Two')
  expect((await ui.findAll({ type: 'Markdown' })).map(m => m.props.key)).toEqual(['sec:0', 'sec:1'])
  // the desktop draws a file: link as plain text (the engine says so); the element is still the Link of design D23
  const links: Drawn[] = []
  const find = (n: unknown): void => {
    if (!isNode(n)) return
    if (n.type === 'Link') links.push(n)
    for (const c of n.children ?? []) find(c)
  }
  find(await ui.drawn())
  expect(links).toEqual([])
  const terminal = await $.ui.mount({ ...DETAIL_PANE, surface: 'terminal' })
  find(await terminal.drawn())
  expect(links.map(l => l.props?.href)).toEqual([`file://${FOLDER}/design.md`])
  await terminal.unmount()
  await ui.press({ key: 'index:1' })
  await settle(w)
  // the test engine answers a scroll on a pane it did not place itself: the mocked hook beneath is not reached, so the call's reach is
  // left to the live check (phase 5); the press must neither throw nor call any other engine noun
  expect(w.forbidden).toEqual([])
  expect(w.submits).toEqual([])
  await ui.press({ key: 'tab:tasks.md' })
  await ui.redraw()
  expect((await lines(ui))[0]).toContain('Tarefas')
  expect(detailOpens(w).at(-1)).toMatchObject({ title: 'Tarefas' })
  await ui.unmount()
  await main.unmount()
})

test('AC-16 detail-pane: a press on another row re-opens the same id, a refresh redraws, a gone subject draws its dim line, and no refresh, tick or render opens, closes, scrolls or copies', async ($, on) => {
  const w = await detailWorld($, on)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:review' })
  await main.press({ key: 'pending:2.2' })
  expect(detailOpens(w).map(a => a.title)).toEqual(['Revisão', 'Pendências'])
  w.panes = [DETAIL, 'devkit-panel']
  const before = [w.opens.length, w.closes.length, w.scrolls.length, w.copies.length]
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  await turn($)
  await w.clock.advance(REFRESH_MS)
  await settle(w)
  await ui.redraw()
  await main.redraw()
  expect([w.opens.length, w.closes.length, w.scrolls.length, w.copies.length]).toEqual(before)
  // the change goes away: the subject is gone and the pane stays with its dim line
  w.messages = []
  w.changes['panel-conduct-view'] = MISSING
  await turn($)
  await settle(w)
  await ui.redraw()
  expect((await lines(ui)).some(l => l.includes('não está mais aberta'))).toBe(true)
  await ui.unmount()
  await main.unmount()
})

test('AC-16 detail-pane: ✕ closes the pane and clears the subject; Fechar painel closes both panes; a fill from inside it closes it before its toast', async ($, on) => {
  const w = flowWorld(on, { ...MID_IMPLEMENTATION })
  w.changes['panel-conduct-view'] = changeRun('panel-conduct-view', { step: 'stop-plan-approval', actor: 'owner' })
  w.deliver = { exitCode: DELIVER_EXIT, stdout: DELIVER_STDOUT, stderr: '' }
  await start($)
  await settle(w)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:approval' })
  w.panes = [DETAIL, 'devkit-panel']
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  w.closes = []
  await ui.press({ key: 'detail:close' })
  expect(w.closes).toEqual([DETAIL])
  w.panes = ['devkit-panel']
  // the band's Fechar painel closes both
  await main.press({ key: 'pending:2.2' }).catch(() => undefined)
  w.panes = [DETAIL, 'devkit-panel']
  w.closes = []
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await band.press({ key: 'band:pane' })
  expect(w.closes.sort()).toEqual(['devkit-panel', DETAIL])
  await band.unmount()
  await ui.unmount()
  await main.unmount()
})

test('AC-16 detail-pane: an isPlaced: false answer leaves no detail open and toasts the row\'s summary; one mobile mount draws screens 1 and 2', async ($, on) => {
  const w = await detailWorld($, on)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  w.isPlaced = false
  w.closes = []
  await main.press({ key: 'step:implementation' })
  expect(w.closes).toEqual([DETAIL])
  expect(w.toasts).toEqual(['Implementação · panel-conduct-view · 4 de 9 tarefas'])
  await main.unmount()
  w.isPlaced = true
  const mobile = await $.ui.mount({ ...PANE, surface: 'mobile' })
  expect(changeBlock(await lines(mobile)).slice(0, 2)).toEqual([CAPTION, 'panel-conduct-view'])
  await mobile.press({ key: 'step:implementation' })
  const two = await $.ui.mount({ ...DETAIL_PANE, surface: 'mobile' })
  expect((await lines(two))[0]).toBe('Implementação panel-conduct-view · 4 de 9 tarefas ✕')
  await two.unmount()
  await mobile.unmount()
})

test('AC-16 detail-pane: another change and an error line open their own subject; a fill from the detail closes it first', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'toggle:in-progress' })
  await main.redraw()
  await main.press({ key: 'change:getting-started-roadmap' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const all = await lines(ui)
  expect(all[0]).toBe('getting-started-roadmap aprovar o plano ✕')
  expect(all).toContain('planeja e executa aqui, com sessões filhas')
  w.panes = [DETAIL]
  w.closes = []
  w.toasts = []
  await ui.press({ key: 'conduct:getting-started-roadmap' })
  expect(w.fills).toEqual([{ text: '/conduct getting-started-roadmap', mode: 'replace' }])
  expect(w.closes).toEqual([DETAIL])
  expect(w.toasts).toEqual([FILLED])
  await ui.unmount()
  w.worktrees = 'reject'
  await turn($)
  await settle(w)
  await main.redraw()
  await main.press({ key: 'error:view' })
  const err = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  expect((await err.find({ type: 'Code' }))?.props.source).toContain('git worktree list')
  await err.unmount()
  await main.unmount()
})

test('AC-15 summary-and-documents: the change folder is read with no checker run: the summary, the documents present and another change\'s progress', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.files.set('/w/.claude/worktrees/commit-and-pr-trailer/openspec/changes/commit-and-pr-trailer/tasks.md', '## 1. A\n\n- [x] 1.1 a\n- [ ] 1.2 b\n')
  w.dirs.add('/w/.claude/worktrees/commit-and-pr-trailer')
  w.dirs.add(`${FOLDER}/specs`)
  w.dirs.add(`${FOLDER}/specs/panel`)
  w.files.set(`${FOLDER}/specs/panel/spec.md`, '# Panel spec\n')
  await start($)
  await settle(w)
  w.runs = []
  const status = textLines((await command($, 'status')).text ?? '')
  expect(status.some(l => l.startsWith(SUMMARY.slice(0, 60)))).toBe(true)
  expect(status).toContain('Proposta Design Tarefas Specs')
  expect(status.some(l => l.includes('1 de 2 tarefas · gate da fase 1'))).toBe(true)
  expect(w.runs).toEqual([])
})

test('AC-15 summary-and-documents: a worktree that is gone falls back to <root>/openspec/changes/<id> for the conducted change and for another change\'s progress (design D23, D27)', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  // the conducted change's worktree is gone: its files are on the root checkout only
  w.dirs.delete(WORKTREE)
  for (const [path, text] of [...w.files]) {
    if (path.startsWith(`${FOLDER}/`)) {
      w.files.delete(path)
      w.files.set(path.replace(FOLDER, '/w/openspec/changes/panel-conduct-view'), text)
    }
  }
  w.dirs.add('/w/openspec/changes/panel-conduct-view/specs')
  w.dirs.add('/w/openspec/changes/panel-conduct-view/specs/panel')
  // another change's worktree is gone too: its tasks are read from the root
  w.dirs.delete('/w/.claude/worktrees/commit-and-pr-trailer')
  w.files.set('/w/openspec/changes/commit-and-pr-trailer/tasks.md', '## 1. A\n\n- [x] 1.1 a\n- [ ] 1.2 b\n')
  await start($)
  await settle(w)
  const status = textLines((await command($, 'status')).text ?? '')
  expect(status.some(l => l.startsWith(SUMMARY.slice(0, 60)))).toBe(true)
  expect(status).toContain('Proposta Design Tarefas Specs')
  expect(status).toContain('● Implementação 4 de 9 tarefas ›')
  expect(status.some(l => l.includes('1 de 2 tarefas · gate da fase 1'))).toBe(true)
})

// ---------------------------------------------------------------- the owner-run actor, the layout (design D25, D26)

test('AC-18 owner-run-actor: the pill and the band read você age on an owner-run phase; Claude age without the marker', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  const report = JSON.parse(MID_IMPLEMENTATION.deliverStdout) as { phases: { n: number; title: string }[] }
  report.phases = report.phases.map(p => (p.n === 2 ? { ...p, title: 'Live check, owner-run' } : p))
  w.deliver = { exitCode: DELIVER_OPEN_EXIT, stdout: JSON.stringify(report), stderr: '' }
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(changeBlock(await lines(ui))).toContain('Agora você age')
    await ui.unmount()
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.find({ type: 'Text', text: /panel-conduct-view/ }))?.text).toBe('panel-conduct-view · implementação, 4 de 9 tarefas · faltam 5 · você age')
    expect((await band.find({ type: 'Text', text: /^◐$/ }))?.props.color).toBe('warning')
    await band.unmount()
  }
})

test('AC-9 band-shows-conducted-change: the band reads glyph, id, step with its fact, what is left and who acts, with Abrir painel; then Fechar painel', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    w.panes = []
    w.opens = []
    w.closes = []
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /panel-conduct-view/ }))?.text).toBe('panel-conduct-view · implementação, 4 de 9 tarefas · faltam 5 · Claude age')
    expect((await ui.find({ type: 'Text', text: /^●$/ }))?.props.color).toBe('claude')
    expect(await ui.find({ type: 'Text', text: /engine/ })).toBeUndefined()
    expect((await ui.find({ key: 'band:pane' }))?.text).toBe('Abrir painel')
    await ui.press({ key: 'band:pane' })
    expect(w.opens).toEqual(['devkit-panel'])
    w.panes = ['devkit-panel']
    await ui.redraw()
    expect((await ui.find({ key: 'band:pane' }))?.text).toBe('Fechar painel')
    await ui.press({ key: 'band:pane' })
    expect(w.closes).toEqual(['devkit-panel'])
    await ui.unmount()
  }
  expect(w.submits).toEqual([])
})

test('AC-9 band-shows-conducted-change: with no conducted change the band is the count of open changes, then none; English too', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ type: 'Text', text: /devkit/ }))?.text).toBe('devkit · 4 changes abertas')
  await band.unmount()
  w.worktrees = 'worktree /w\nHEAD x\nbranch refs/heads/main\n'
  w.dirs = new Set(['/w', '/w/openspec/changes'])
  await turn($)
  await settle(w)
  const none = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await none.find({ type: 'Text', text: /devkit/ }))?.text).toBe('devkit · nenhuma change aberta')
  await none.unmount()
})

test('AC-17 sections-say-what-they-are: under Outras changes abertas one dim line says the others are independent, in pt-BR on desktop; the no-conducted screen does not carry it', async ($, on) => {
  const w = world(on)
  w.messages = [commandTags('panel-conduct-view')]
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'toggle:in-progress' })
  await ui.redraw()
  expect(othersLines(await lines(ui))[0]).toBe('independentes desta conversa; nenhuma precisa terminar antes')
  await ui.unmount()
})

test('AC-17 sections-say-what-they-are: the no-conducted screen does not carry the others hint', async ($, on) => {
  const w = world(on)
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await lines(ui)).some(l => l.includes('independentes desta conversa'))).toBe(false)
  await ui.unmount()
})

test('AC-17 sections-say-what-they-are: the same line in English on desktop', { options: { language: 'en' } }, async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  await start($)
  await settle(w)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'toggle:in-progress' })
  await ui.redraw()
  const all = await lines(ui)
  const at = all.findIndex(l => /^[›▾] Other open changes \d+$/.test(l))
  expect(at).toBeGreaterThan(-1)
  expect(all[at + 1]).toBe('independent of this conversation; none has to finish first')
  await ui.unmount()
})

test('AC-9 band-shows-conducted-change: in English the band and the pill read in English', { options: { language: 'en' } }, async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  await start($)
  await settle(w)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ type: 'Text', text: /panel-conduct-view/ }))?.text).toBe('panel-conduct-view · implementation, 4 of 9 tasks · 5 left · Claude acts')
  expect((await band.find({ key: 'band:pane' }))?.text).toBe('Open panel')
  await band.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const all = await lines(pane)
  expect(all).toContain('Steps 4 of 10')
  expect(all).toContain('This conversation conducts')
  expect(all).toContain('● Implementation 4 of 9 tasks ›')
  expect(all.at(-1)).toMatch(/^Updated 0 s ago · next in \d+ s$/)
  await pane.unmount()
  expect(await command($)).toMatchObject({ text: 'devkit panel opened' })
})

test('AC-12 looks-like-app-panel: on terminal no line of the text form is longer than the columns; on desktop there is no rule element and no glyph; on terminal a clipped Box whose Text never truncates (no ellipsis)', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.rows = THREE_CHILDREN()
  await start($)
  await settle(w)
  const status = ((await $.command.run({ command: 'devkit-panel', args: 'status', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 60 } })) as { text: string }).text
  for (const line of status.split('\n')) expect(line.length, line).toBeLessThanOrEqual(60)
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await lines(term)).filter(l => l === '─').length).toBeGreaterThan(3)
  await term.unmount()
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const glyphs = nodes(await desktop.drawn()).filter(n => n.type === 'Text' && /^[─━]+$/.test(leaves(n).join('')))
  expect(glyphs, 'desktop draws no glyph run').toEqual([])
  expect(nodes(await desktop.drawn()).filter(n => n.type === 'Box' && n.props?.height === 1 && (n.children ?? []).length === 0), 'desktop draws no rule element').toEqual([])
  expect((await lines(desktop)).filter(l => l === '─').length).toBeGreaterThan(3)
  await desktop.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const rules: Drawn[] = []
  const walk = (n: unknown): void => {
    if (!isNode(n)) return
    if (n.type === 'Box' && typeof n.props?.key === 'string' && /^─+$/.test(leaves(n).join(''))) rules.push(n)
    for (const c of n.children ?? []) walk(c)
  }
  walk(await ui.drawn())
  expect(rules.length).toBeGreaterThan(3)
  for (const rule of rules) {
    expect(rule.props?.overflow).toBe('hidden')
    expect((rule.children ?? []).every(c => isNode(c) && c.type === 'Text' && c.props?.wrap === 'wrap')).toBe(true)
  }
  await ui.unmount()
})

// ---------------------------------------------------------------- the pane against the mock (live-check findings, design D8)

/** Every node of a drawn tree, depth first. */
const nodes = (root: unknown): Drawn[] => {
  const out: Drawn[] = []
  const walk = (n: unknown): void => {
    if (!isNode(n)) return
    out.push(n)
    for (const c of n.children ?? []) walk(c)
  }
  walk(root)
  return out
}
const MOCK_COLORS = { nowBg: '#F6F5F2', stepBg: '#FBF1EC', accent: '#B0502C', done: '#2F7D4F', amber: '#A16207', pending: '#A8A49C', warnBg: '#FBF4E6', chipOn: '#1A1A19', chipBg: '#F2F1ED' }

test('AC-12 looks-like-app-panel: every row is laid out to the pane\'s own width: the label shrinks and truncates, the right part never shrinks, and no Box is as wide as a column count', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.rows = THREE_CHILDREN()
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, bodyColumns: 38 } })
    const tree = await ui.drawn()
    const all = nodes(tree)
    // nothing is sized to the computed column count: the pane's own width is a percentage
    expect(all.filter(n => n.type === 'Box' && typeof n.props?.width === 'number'), `${surface} fixed widths`).toEqual([])
    expect((tree as Drawn).props?.width).toBe('100%')
    const stepRow = all.find(n => n.type === 'Box' && typeof n.props?.key === 'string' && n.props.key.startsWith('row:') && leaves(n).join(' ') === '● Implementação 4 de 9 tarefas ›')
    expect(stepRow?.props?.width).toBe('100%')
    const [left, right] = (stepRow?.children ?? []) as Drawn[]
    expect(left?.props).toMatchObject({ flexGrow: 1, flexShrink: 1, minWidth: 0 })
    expect(right?.props?.flexShrink).toBe(0)
    expect(leaves(right).join(' ')).toBe('4 de 9 tarefas ›')
    const label = nodes(left).find(n => n.type === 'Button' && n.props?.key === 'step:implementation')
    expect(label).toBeDefined()
    await ui.unmount()
  }
})

test('AC-12 looks-like-app-panel: a vscode render follows the desktop layout, with no rule element and the same lines', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.rows = THREE_CHILDREN()
  await start($)
  await settle(w)
  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const vscode = await $.ui.mount({ ...PANE, surface: 'vscode' })
  expect(nodes(await vscode.drawn()).filter(n => n.type === 'Box' && n.props?.height === 1 && (n.children ?? []).length === 0), 'vscode draws no rule element').toEqual([])
  expect(await lines(vscode)).toEqual(await lines(desktop))
  await desktop.unmount()
  await vscode.unmount()
})

test('AC-12 looks-like-app-panel: one divider per section boundary on the terminal; on the desktop no rule element, and each section heading after the first has a top margin', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.rows = THREE_CHILDREN()
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = await lines(ui)
    all.forEach((l, i) => expect(l === '─' && all[i + 1] === '─', `${surface} two rules at ${i}`).toBe(false))
    const rows = nodes(await ui.drawn()).filter(n => n.type === 'Box' && typeof n.props?.key === 'string' && n.props.key.startsWith('row:'))
    const rules = rows.filter(n => n.props?.height === 1 && (n.children ?? []).filter(isNode).every(c => c.type === 'Text') && /^─+$/.test(leaves(n).join('')))
    const headings = rows.filter(n => ['Passos', 'Pendências', 'Documentos', 'Sessões desta change'].some(h => leaves(n)[0] === h || leaves(n).join(' ').startsWith(`${h} `) || leaves(n).join(' ') === h))
    expect(headings.length, surface).toBe(4)
    if (surface === 'terminal') {
      expect(rules.length).toBeGreaterThan(3)
      for (const rule of rules) expect(rule.props).toMatchObject({ height: 1, overflow: 'hidden' })
    } else {
      expect(rules, 'desktop rules').toEqual([])
      expect(nodes(await ui.drawn()).filter(n => n.type === 'Box' && n.props?.height === 1 && n.props?.backgroundColor !== undefined && (n.children ?? []).length === 0).filter(n => n.props?.flexGrow !== 1 && typeof n.props?.width !== 'string')).toEqual([])
      for (const h of headings) expect(h.props?.marginTop, leaves(h).join(' ')).toBe(1)
      expect(all.filter(l => l === '─').length).toBeGreaterThan(3)
    }
    await ui.unmount()
  }
})

test('AC-19 now-box, AC-14 flow-steps-you-are-here, AC-20 pending-list: the Agora box is tinted with no outline, the pill is the accent, the current step row is tinted and the glyphs carry the mock\'s colours', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.rows = THREE_CHILDREN()
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = nodes(await ui.drawn())
    const now = all.find(n => n.type === 'Box' && n.props?.backgroundColor === MOCK_COLORS.nowBg)
    expect(now, `${surface} Agora box`).toBeDefined()
    expect(now?.props?.borderStyle).toBeUndefined()
    const pill = all.find(n => n.type === 'Text' && n.props?.backgroundColor === MOCK_COLORS.accent)
    expect(pill?.props?.color).toBe('#FFFFFF')
    expect(leaves(pill).join('')).toBe(' Claude age ')
    const tinted = all.filter(n => n.type === 'Box' && n.props?.backgroundColor === MOCK_COLORS.stepBg)
    expect(tinted.map(n => leaves(n).join(' '))).toEqual(['● Implementação 4 de 9 tarefas ›'])
    const glyph = (ch: string, within: Drawn) => nodes(within).find(n => n.type === 'Text' && leaves(n).join('') === ch)?.props?.color
    expect(glyph('●', tinted[0] as Drawn)).toBe(MOCK_COLORS.accent)
    expect(nodes(tinted[0]).some(n => n.props?.weight === 'semibold' && leaves(n).join('') === 'Implementação')).toBe(true)
    const rowOf = (name: string) => all.find(n => n.type === 'Box' && typeof n.props?.key === 'string' && n.props.key.startsWith('row:') && leaves(n).join(' ').includes(name)) as Drawn
    expect(glyph('✓', rowOf('Requisitos'))).toBe(MOCK_COLORS.done)
    expect(glyph('○', rowOf('Revisão'))).toBe(MOCK_COLORS.pending)
    expect(glyph('◐', rowOf('Fourth thing'))).toBe(MOCK_COLORS.amber)
    await ui.unmount()
  }
})

test('AC-20 pending-list: an owner-run task reads its id and a short title without the marker clause, and a gate reads Gate: and its short label, never a raw command or checkbox', () => {
  const tasks = readTasks(
    [
      '## 5. Live check',
      '',
      '- [ ] 5.1 Owner-run, by the conducting session (no implementer, no child session): load the 0.2.0 pack from plugins/panel. Then open the pane with a change conducted.',
      '- [ ] 5.9 Gate: `"$HOME/Library/Application Support/Claude/claude-code/2.1.321/x/claude.app/Contents/MacOS/claude" plugin test plugins/panel`',
      '- [ ] 5.2 Aba Configurações nos 3 models: cada grupo aberto, uma alteração salva.',
      '',
    ].join('\n'),
  )
  const [owner, gate, plain] = tasks.sections[0]?.tasks ?? []
  expect(owner).toMatchObject({ id: '5.1', title: 'load the 0.2.0 pack from plugins/panel', sentence: 'Then open the pane with a change conducted', tag: 'owner' })
  expect(gate).toMatchObject({ id: '5.9', title: 'Gate: test panel (app)', sentence: '', tag: 'gate' })
  expect(plain).toMatchObject({ title: 'Aba Configurações nos 3 models', sentence: 'cada grupo aberto, uma alteração salva' })
  for (const t of [owner, gate, plain]) expect(`${t?.title} ${t?.sentence}`).not.toMatch(/\[ \]|\$\(|\$HOME|Owner-run/)
})

const BUNDLED = '"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"'

test('AC-20 pending-list: the real 5.1, 5.2 and 5.9 of this change read as phrases, never `with` or a raw shell', () => {
  const tasks = readTasks(
    [
      '## 5. Live check, owner-run',
      '',
      '- [ ] 5.1 Owner-run, by the conducting session (no implementer, no child session): load the 0.2.0 pack from `plugins/panel` of this worktree into the session that conducts',
      '  `panel-conduct-view`, in place of the installed 0.1.0.',
      '- [ ] 5.2 Owner-run, by the conducting session (no implementer, no child session): with',
      '  `/conduct panel-conduct-view` running and its phase sessions present:',
      '  - read `mcp__devkit-panel__status` (or the owner\'s `/devkit-panel status`): the change on top',
      '    with its next step, who acts, the phases;',
      '  - the owner presses a child session, `Continuar aqui`, a step.',
      `- [ ] 5.9 Gate: \`${BUNDLED} plugin test plugins/panel\` green at the head that was loaded (AC-13 live-check). Owner-run, by the conducting session (no implementer, no child session): it is ticked only once 5.2's record is written.`,
      '',
    ].join('\n'),
  )
  const [one, two, nine] = tasks.sections[0]?.tasks ?? []
  expect(one?.title).toBe('load the 0.2.0 pack from plugins/panel …')
  expect(two?.title).toBe('read mcp__devkit-panel__status')
  expect(two?.title.split(' ').length).toBeGreaterThanOrEqual(2)
  expect(two?.title).not.toBe('with')
  expect(nine).toMatchObject({ title: 'Gate: test panel (app)', sentence: '', tag: 'gate' })
})

test('AC-4 delivery-items: the version-agnostic bundled-binary form and the absolute-path form of a gate command both read test panel (app); the npm binary reads (npm)', () => {
  expect(commandLabel(`${BUNDLED} plugin test plugins/panel`)).toBe('test panel (app)')
  expect(commandLabel(`${BUNDLED} plugin validate .`)).toBe('validate . (app)')
  expect(commandLabel('"$HOME/Library/Application Support/Claude/claude-code/2.1.321/x/claude.app/Contents/MacOS/claude" plugin test plugins/panel')).toBe('test panel (app)')
  expect(commandLabel('"$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate .')).toBe('validate . (npm)')
  const gate39 = `${BUNDLED} plugin test plugins/panel && ${BUNDLED} plugin validate . && "$HOME/.nvm/versions/node/v22.22.0/bin/claude" plugin validate . && node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check`
  expect(gate39.split(/\s+&&\s+/).length).toBe(6)
  const task = readTasks(`## 3. Gate\n\n- [ ] 3.9 Gate: \`${gate39}\` green (AC-10).\n`).sections[0]?.tasks[0]
  expect(task?.title).toBe('Gate: test panel (app)')
  expect(task?.sentence).toBe('validate . (app), validate . (npm), guard suite, check.py, gen-catalog.py --check')
  expect(`${task?.title} ${task?.sentence}`).not.toMatch(/\$\(|\$HOME/)
})

test('AC-12 looks-like-app-panel, AC-21 step-detail: at 24, 38, 80 and 140 columns the bar is one row of two Boxes with no glyph and no rule truncates or counts glyphs to a width, on desktop and terminal', async ($, on) => {
  const w = await detailWorld($, on, FULL_TASKS)
  for (const surface of SURFACES) {
    for (const bodyColumns of [24, 38, 80, 140]) {
      const where = `${surface} ${bodyColumns}`
      const props = { ...PANE.props, bodyColumns }
      const main = await $.ui.mount({ ...PANE, surface, props })
      await main.press({ key: 'step:implementation' })
      const ui = await $.ui.mount({ ...DETAIL_PANE, surface, props })
      const all = nodes(await ui.drawn())
      const bars = all.filter(n => n.type === 'Box' && n.props?.height === 1 && (n.children ?? []).some(c => isNode(c) && typeof c.props?.width === 'string' && /%$/.test(c.props.width)))
      expect(bars.length, where).toBe(1)
      expect(bars[0]?.props, where).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap', height: 1 })
      expect((bars[0]?.children ?? []).length, where).toBe(2)
      const [filled, rest] = (bars[0]?.children ?? []) as Drawn[]
      expect(filled?.props, where).toMatchObject({ width: '59%', height: 1, flexShrink: 0, backgroundColor: '#2F7D4F' })
      expect(rest?.props, where).toMatchObject({ flexGrow: 1, height: 1, backgroundColor: '#E7E5E0' })
      expect(all.filter(n => n.type === 'Text' && /[━─]/.test(leaves(n).join(''))).every(n => surface === 'terminal' && n.props?.wrap === 'wrap'), where).toBe(true)
      expect(all.some(n => n.type === 'Text' && /…$/.test(leaves(n).join('')) && /^[─━]/.test(leaves(n).join(''))), where).toBe(false)
      if (surface === 'desktop') expect(all.filter(n => n.type === 'Text' && /^─/.test(leaves(n).join(''))), where).toEqual([])
      await ui.unmount()
      await main.unmount()
    }
  }
  expect(w.forbidden).toEqual([])
})

test('AC-18 owner-run-actor, AC-21 step-detail: the Faltam row of an owner-run section, its gate included, reads você; the others read Claude; in English you', async ($, on) => {
  const w = await detailWorld($, on, FULL_TASKS)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:implementation' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const missing = (await lines(ui)).filter(l => l.startsWith('◐ '))
  const owner = missing.find(l => /owner-run/.test(l))
  expect(owner).toMatch(/ · você ›$/)
  expect(missing.filter(l => !/owner-run/.test(l)).every(l => / · Claude ›$/.test(l))).toBe(true)
  expect(w.forbidden).toEqual([])
  await ui.unmount()
  await main.unmount()
})

test('AC-18 owner-run-actor: in English an owner-run section reads you', { options: { language: 'en' } }, async ($, on) => {
  await detailWorld($, on, FULL_TASKS)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'step:implementation' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  expect((await lines(ui)).find(l => /owner-run/.test(l))).toMatch(/ · you ›$/)
  await ui.unmount()
  await main.unmount()
})

test('AC-15 summary-and-documents: the document pane draws its tabs as chips, the section index as one wrapping row, the title with its metadata chips, and the footer on one row', async ($, on) => {
  const w = await detailWorld($, on)
  w.files.set(`${FOLDER}/proposal.md`, '---\nstatus: draft\ntags: [device, feature]\n---\n# Configurações do equipamento\n\n## Why\n\nbody\n\n## What\n\nmore\n')
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'doc:proposal.md' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const all = nodes(await ui.drawn())
  const active = all.find(n => n.type === 'Text' && n.props?.backgroundColor === MOCK_COLORS.chipOn)
  expect([leaves(active).join(''), active?.props?.color]).toEqual([' Proposta ', '#FFFFFF'])
  const others = all.filter(n => n.type === 'Text' && n.props?.backgroundColor === MOCK_COLORS.chipBg && n.props?.size !== 'caption')
  expect(others.map(n => leaves(n).join('').trim())).toEqual(['Requisitos', 'Design', 'Tarefas', 'Prontidão', 'Aprovação'])
  const tabs = all.find(n => n.type === 'Box' && n.props?.flexWrap === 'wrap' && n.props?.key === 'row:0')
  expect(tabs).toBeDefined()
  const index = all.find(n => n.type === 'Box' && n.props?.flexWrap === 'wrap' && nodes(n).some(c => c.type === 'Button' && c.props?.key === 'index:0'))
  expect((index?.children ?? []).filter(isNode).map(c => c.props?.key)).toEqual(['index:0', 'index:1'])
  expect(leaves(index)).toEqual(['Why', 'What'])
  const title = all.find(n => n.type === 'Text' && n.props?.size === 'heading')
  expect(leaves(title).join('')).toBe('Configurações do equipamento')
  const chips = all.filter(n => n.type === 'Text' && n.props?.backgroundColor === MOCK_COLORS.chipBg && n.props?.size === 'caption')
  expect(chips.map(n => leaves(n).join('').trim())).toEqual(['draft', 'device', 'feature'])
  const footer = all.find(n => n.type === 'Box' && n.props?.key === 'row:footer')
  expect(footer?.props?.justifyContent).toBe('space-between')
  expect(leaves(footer).join(' ')).toBe('Abrir no editor ↗ Esc fecha')
  await ui.unmount()
  await main.unmount()
})

test('AC-16 detail-pane: the pending callout is tinted amber with no outline, and its title and line carry their own ink', async ($, on) => {
  const w = await detailWorld($, on, FULL_TASKS)
  const main = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await main.press({ key: 'pending:4.1' })
  const ui = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  const callout = nodes(await ui.drawn()).find(n => n.type === 'Box' && n.props?.backgroundColor === MOCK_COLORS.warnBg)
  expect(callout).toBeDefined()
  expect(callout?.props?.borderStyle).toBeUndefined()
  expect(nodes(callout).filter(n => n.type === 'Text').map(n => n.props?.color)).toEqual(['#7A4D05', '#3D3B37'])
  expect(w.forbidden).toEqual([])
  await ui.unmount()
  await main.unmount()
})

// ---------------------------------------------------------------- read-only, end to end (design D13)

test('AC-11 read-only-kept: session start, every trigger, every button, a child press, both band states, the status tool and the detail pane call only list_sessions and open_session_in, and submit and send nothing', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
  w.rows = [childRow('panel-conduct-view-p2', { isRunning: true })]
  await start($)
  await settle(w)
  w.panes = ['devkit-panel']
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await turn($)
  await w.clock.advance(REFRESH_MS)
  await ui.press({ key: 'refresh' })
  await settle(w)
  for (const key of ['conduct:panel-conduct-view', CHILD.key, 'toggle:in-progress', 'toggle:archived', 'pending:2.2', 'step:implementation', 'doc:design.md', 'error:none']) await ui.press({ key }).catch(() => undefined)
  const detail = await $.ui.mount({ ...DETAIL_PANE, surface: 'desktop' })
  for (const key of ['index:0', 'tab:tasks.md', 'detail:full', 'detail:copy', 'conduct:panel-conduct-view', 'detail:close']) await detail.press({ key }).catch(() => undefined)
  await band.press({ key: 'band:pane' })
  await $.tool.call({ tool: 'mcp__devkit-panel__status' })
  await command($, 'status')
  await settle(w)
  await detail.unmount()
  await band.unmount()
  await ui.unmount()
  w.messages = []
  await turn($)
  await settle(w)
  const names = new Set(w.calls.map(c => String(c.tool)).filter(t => t !== 'mcp__devkit-panel__status'))
  expect([...names].every(n => n === LIST || n === OPEN)).toBe(true)
  expect(w.submits).toEqual([])
  expect(w.forbidden).toEqual([])
})

// ---------------------------------------------------------------- the band under the engine, /devkit-panel (design D11)

test('the band passes to the engine outside a devkit project', async ($, on) => {
  const w = world(on, { devkit: false })
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await texts(ui)).toEqual(['engine'])
    expect(await ui.find({ key: 'band:pane' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the band passes to the engine under a survey, and before any refresh has landed', async ($, on) => {
  const w = world(on)
  const held = gate()
  w.hold = argv => (argv[0] === 'git' ? held.promise : undefined)
  await start($)
  await settle(w)
  for (const surface of SURFACES) {
    const before = await $.ui.mount({ ...BAND, surface })
    expect(await texts(before)).toEqual(['engine'])
    await before.unmount()
  }
  held.release()
  w.hold = undefined
  await settle(w)
  for (const surface of SURFACES) {
    const survey = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
    expect(await texts(survey)).toEqual(['engine'])
    await survey.unmount()
    const band = await $.ui.mount({ ...BAND, surface })
    expect((await band.find({ type: 'Text', text: /devkit/ }))?.text).toMatch(/^devkit · /)
    await band.unmount()
  }
})

test('/devkit-panel toggles the pane with one of three answers; /devkit-panel status answers the pane as text, with via', async ($, on) => {
  const w = flowWorld(on, MID_IMPLEMENTATION)
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
  await settle(w)
  const text = textLines((await command($, 'status')).text ?? '')
  expect(text[0]).toBe('devkit')
  expect(text.slice(text.indexOf(CAPTION), text.indexOf(CAPTION) + 2)).toEqual([CAPTION, 'panel-conduct-view'])
  expect(text[text.indexOf(CAPTION) + 2]).toMatch(/^The devkit pane shows .*…$/)
  expect(text).toContain('via: command')
  expect(text).toContain('● Implementação 4 de 9 tarefas ›')
  expect(text.at(-1)).toBe('Atualizado há 0 s')
  expect(w.submits).toEqual([])
})

test('/devkit-panel status outside a devkit project is the one line', async ($, on) => {
  const w = world(on, { devkit: false })
  await start($)
  await settle(w)
  expect(await command($, ' status ')).toMatchObject({ text: 'Não é um projeto OpenSpec devkit.' })
  expect(w.runs).toEqual([])
})

test('the mcp__devkit-panel__status tool answers the pane as text after a refresh: the conducted change with its children, via children', async ($, on) => {
  const w = world(on)
  w.messages = [chat('user', 'summary')]
  w.rows = [childRow('panel-conduct-view-p1', { isArchived: true }), childRow('panel-conduct-view-p2', { isRunning: true })]
  await start($)
  await settle(w)
  const before = gitRuns(w).length
  const answer = await $.tool.call({ tool: 'mcp__devkit-panel__status' })
  expect(gitRuns(w)).toHaveLength(before + 1)
  const text = textLines(String(answer.result))
  expect(text).toContain('panel-conduct-view')
  expect(text).toContain('via: children')
  const at = text.findIndex(l => l.startsWith('Sessões desta change'))
  expect(text.slice(at, at + 4)).toEqual(['Sessões desta change 2', '● Fase 2 · The pane, the band, the buttons… executando ›', '▾ 1 arquivadas', '✓ Fase 1 · Loading in both CLIs, and the d… arquivada ›'])
  expect(w.submits).toEqual([])
  expect(w.opens).toEqual([])
})
