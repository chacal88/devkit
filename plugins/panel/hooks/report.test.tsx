import type { FsEntry } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { CHANGE_OPTION_STDERR, CHANGE_OPTION_STDOUT } from './fixtures/change-option'
import { DELIVER_STDOUT } from './fixtures/deliver'
import { ROUND_STDOUT } from './fixtures/round'
import { changeFolders, isDevkitProject, locateChecker } from './project'
import type { PanelFs } from './project'
import { READ_VERSION, checkerError, newerVersion, parseDeliver, parseRound } from './report'
import { buttonsFor, isDeliveryStep } from './commands'
import { langOf, uiText } from './i18n'
import { LIST, childrenOf, mayList, parseSessionRows, sessionState } from './sessions'
import type { ChangeRow, PanelView } from '../types'

// ---------------------------------------------------------------- report.ts (design D5)

test('the version-2 fixture parses into the round and one row per change, with sessionPrefix', () => {
  const report = parseRound(ROUND_STDOUT)
  expect(report?.version).toBe(2)
  expect(report?.round).toEqual({ n: 5, title: 'Round 5: trailer fix, one change at a time', done: 0, total: 2 })
  expect(report?.changes.map(c => c.id)).toEqual(['commit-and-pr-trailer', 'conventions-trailer'])
  const first = report?.changes[0]
  expect(first?.sessionPrefix).toBe('commit-and-pr-traile-p')
  expect(first?.next).toMatchObject({ step: 'gate', actor: 'gate', phase: 1 })
  expect(first?.state).toBe('ready to run: gate')
  expect(first?.worktree).toBe('/w/.claude/worktrees/commit-and-pr-trailer')
  expect(first?.deliver).toEqual({ summary: 'in progress: item 1', met: 1, next: 'gate' })
  expect(report?.changes[1]?.deliver).toBeNull()
  expect(report?.changes[1]?.state).toBe('waiting on commit-and-pr-trailer')
  expect(report?.dispatch).toEqual(['commit-and-pr-trailer'])
  expect(report?.end).toBe(false)
})

test('a session row carries the session descriptor', () => {
  const report = parseRound(
    JSON.stringify({
      version: 2,
      changes: [
        {
          id: 'x',
          next: { step: 'implement', actor: 'session', phase: 2 },
          state: 'ready to run: implement',
          sessionPrefix: 'x-p',
          session: { title: 'x: phase 2', name: 'x-p2', cwd: '/w/.claude/worktrees/x', phase: 2, brief: 'b', background: 'c' },
        },
      ],
    }),
  )
  expect(report?.changes[0]?.session).toEqual({ name: 'x-p2', title: 'x: phase 2', phase: 2 })
})

test('the round parser tolerates missing fields and refuses what is not a report', () => {
  const bare = parseRound('{"version":2}')
  expect(bare).toMatchObject({ version: 2, changes: [], dispatch: [], owner: [], github: [], stopped: [], busy: [], end: false, roadmapDone: false })
  expect(parseRound('{"version":2,"changes":[{"id":"a"}]}')?.changes[0]).toMatchObject({ id: 'a', state: '', next: { step: '', actor: '' } })
  expect(parseRound('not json')).toBeUndefined()
  expect(parseRound('')).toBeUndefined()
  expect(parseRound('[1,2]')).toBeUndefined()
  expect(parseRound(CHANGE_OPTION_STDOUT)).toBeUndefined()
})

test('the deliver fixture parses into its 8 items with ids, the summary, met and the next step', () => {
  const report = parseDeliver(DELIVER_STDOUT)
  expect(report?.change).toBe('devkit-panel')
  expect(report?.items.map(i => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  expect(report?.items[0]).toMatchObject({ id: 1, name: 'tasks', status: 'open' })
  expect(report?.items[0]?.reason).toMatch(/^unticked tasks: 1\.1/)
  expect(report?.items[2]).toMatchObject({ id: 3, name: 'findings', status: 'met' })
  expect(report?.met).toBe(1)
  expect(report?.summary).toBe('in progress: item 1')
  expect(report?.next.step).toBe('implement')
  expect(report?.approval?.ok).toBe(true)
  expect(parseDeliver('{"version":1}')).toMatchObject({ change: '', items: [], met: 0, summary: '', next: { step: '' } })
  expect(parseDeliver('nope')).toBeUndefined()
})

test('a report whose JSON version is newer than the one read is refused by the parser and named by one error line (design D5)', () => {
  expect(READ_VERSION).toEqual({ round: 2, deliver: 1 })
  const round3 = JSON.stringify({ ...(JSON.parse(ROUND_STDOUT) as Record<string, unknown>), version: 3 })
  expect(parseRound(round3)).toBeUndefined()
  expect(newerVersion(round3, READ_VERSION.round)).toBe('JSON version 3 is newer than the 2 this panel reads')
  expect(newerVersion(ROUND_STDOUT, READ_VERSION.round)).toBeUndefined()
  expect(parseDeliver('{"version":2,"change":"x"}')).toBeUndefined()
  expect(newerVersion('{"version":2,"change":"x"}', READ_VERSION.deliver)).toBe('JSON version 2 is newer than the 1 this panel reads')
  expect(parseDeliver(DELIVER_STDOUT)).toBeDefined()
  // an older or absent version is read as it is (additive changes are tolerated); a non-report has no version
  expect(newerVersion('{"version":1}', READ_VERSION.round)).toBeUndefined()
  expect(parseRound('{"changes":[]}')).toBeDefined()
  expect(newerVersion('{}', 2)).toBeUndefined()
  expect(newerVersion('nope', 2)).toBeUndefined()
})

test('a checker error is the JSON error of exit 3, else the first stderr line, else the exit code', () => {
  expect(checkerError({ exitCode: 3, stdout: CHANGE_OPTION_STDOUT, stderr: CHANGE_OPTION_STDERR })).toMatch(/^unknown option --change/)
  expect(checkerError({ exitCode: 1, stdout: '', stderr: 'conduct-check: git fetch origin main\nmore' })).toBe('conduct-check: git fetch origin main')
  expect(checkerError({ exitCode: 2, stdout: 'garbage', stderr: '  \n' })).toBe('exit 2')
})

// ---------------------------------------------------------------- project.ts (design D3, D4)

test('a project opts in with a top-level schema of devkit or devkit-lite, as guard.mjs reads it', () => {
  expect(isDevkitProject('schema: devkit\nship:\n  devkit: merge\n')).toBe(true)
  expect(isDevkitProject('# comment\nschema: "devkit-lite"\n')).toBe(true)
  expect(isDevkitProject("schema: 'devkit'")).toBe(true)
  expect(isDevkitProject('schema: spec-driven\n')).toBe(false)
  expect(isDevkitProject('# schema: devkit\nrules: []\n')).toBe(false)
  expect(isDevkitProject('  schema: devkit\n')).toBe(false)
  expect(isDevkitProject('')).toBe(false)
})

/** An in-memory disk: files by path, directories by path (a trailing name list). The panel reads text only, so `read` is its text overload. */
const disk = (files: Record<string, string>, dirs: Record<string, string[]> = {}): PanelFs => {
  const read = async (path: string): Promise<string> => {
    const text = files[path]
    if (text === undefined) throw new Error(`no such file: ${path}`)
    return text
  }
  const list = async (path: string): Promise<FsEntry[]> => {
    const names = dirs[path]
    if (names === undefined) throw new Error(`no such directory: ${path}`)
    return names.map(name => ({ name, kind: name.includes('.') ? 'file' : 'dir', size: 0, mtimeMs: 0, isLink: false }))
  }
  return { exists: async path => path in files || path in dirs, read: read as PanelFs['read'], list: list as PanelFs['list'] }
}

const MARKET = JSON.stringify({ name: 'devkit', plugins: [{ name: 'devkit-core' }, { name: 'devkit-openspec', source: './plugins/openspec' }] })
const INSTALLED = JSON.stringify({
  version: 2,
  plugins: {
    'devkit-openspec@devkit': [
      { scope: 'user', installPath: '/h/.claude/plugins/cache/devkit/devkit-openspec/0.8.0', version: '0.8.0' },
      { scope: 'project', projectPath: '/elsewhere', installPath: '/h/.claude/plugins/cache/devkit/devkit-openspec/0.7.0', version: '0.7.0' },
      { scope: 'project', projectPath: '/w', installPath: '/h/.claude/plugins/cache/devkit/devkit-openspec/0.9.1', version: '0.9.1' },
    ],
  },
})
const home = { get: async (name: string) => (name === 'HOME' ? '/h' : undefined) }

test("the repository's own hooks come first: a marketplace naming devkit-openspec", async () => {
  const fs = disk({ '/w/.claude-plugin/marketplace.json': MARKET, '/h/.claude/plugins/installed_plugins.json': INSTALLED })
  expect(await locateChecker({ fs, env: home }, '/w')).toEqual({ dir: '/w/plugins/openspec/hooks', label: 'repo' })
  const other = disk({ '/w/.claude-plugin/marketplace.json': JSON.stringify({ plugins: [{ name: 'other' }] }) })
  expect(await locateChecker({ fs: other, env: home }, '/w')).toBeUndefined()
})

test('then the installed pack at project scope, the root or the project above its worktree', async () => {
  const fs = disk({ '/h/.claude/plugins/installed_plugins.json': INSTALLED })
  expect(await locateChecker({ fs, env: home }, '/w')).toEqual({ dir: '/h/.claude/plugins/cache/devkit/devkit-openspec/0.9.1/hooks', label: 'devkit-openspec 0.9.1' })
  expect(await locateChecker({ fs, env: home }, '/w/.claude/worktrees/devkit-panel')).toEqual({
    dir: '/h/.claude/plugins/cache/devkit/devkit-openspec/0.9.1/hooks',
    label: 'devkit-openspec 0.9.1',
  })
})

test('then the user scope, else no checker', async () => {
  const fs = disk({ '/h/.claude/plugins/installed_plugins.json': INSTALLED })
  expect(await locateChecker({ fs, env: home }, '/other')).toEqual({ dir: '/h/.claude/plugins/cache/devkit/devkit-openspec/0.8.0/hooks', label: 'devkit-openspec 0.8.0' })
  const none = disk({ '/h/.claude/plugins/installed_plugins.json': JSON.stringify({ version: 2, plugins: {} }) })
  expect(await locateChecker({ fs: none, env: home }, '/w')).toBeUndefined()
  expect(await locateChecker({ fs: disk({}), env: home }, '/w')).toBeUndefined()
  const broken = disk({ '/h/.claude/plugins/installed_plugins.json': '{ not json' })
  expect(await locateChecker({ fs: broken, env: home }, '/w')).toBeUndefined()
})

test('the change folders: others exclude archive and the round ids, archived newest first', async () => {
  const fs = disk(
    {},
    {
      '/w/openspec/changes': ['archive', 'devkit-panel', 'commit-and-pr-trailer', 'README.md', 'zeta'],
      '/w/openspec/changes/archive': ['2026-11-08-ship-modes', '2026-11-10-conduct-sessions', '2026-11-09-auto-merge'],
    },
  )
  expect(await changeFolders({ fs }, '/w', ['commit-and-pr-trailer', 'conventions-trailer'])).toEqual({
    others: ['devkit-panel', 'zeta'],
    archived: ['2026-11-10-conduct-sessions', '2026-11-09-auto-merge', '2026-11-08-ship-modes'],
  })
  expect(await changeFolders({ fs: disk({}) }, '/w', [])).toEqual({ others: [], archived: [] })
})

// ---------------------------------------------------------------- sessions.ts (design D7)

const row = (name: string, extra: Record<string, unknown> = {}) => ({
  sessionId: `local_${name}`,
  name,
  title: `${name}: phase 1`,
  cwd: `/w/.claude/worktrees/${name}`,
  isRunning: false,
  isArchived: false,
  startedBy: 'local_me',
  lastActivityAt: '2026-11-10T10:00:00.000Z',
  ...extra,
})

test('the session rows are read defensively: a row without sessionId is dropped, bad text is no row', () => {
  const rows = parseSessionRows(JSON.stringify([row('a-p1', { isRunning: true }), { title: 'no id', cwd: '/w' }, row('b-p1', { name: undefined, title: 7 })]))
  expect(rows).toHaveLength(2)
  expect(rows[0]).toEqual({
    sessionId: 'local_a-p1',
    name: 'a-p1',
    title: 'a-p1: phase 1',
    cwd: '/w/.claude/worktrees/a-p1',
    isRunning: true,
    isArchived: false,
    startedBy: 'local_me',
    lastActivityAt: '2026-11-10T10:00:00.000Z',
  })
  expect(rows[1]).toMatchObject({ sessionId: 'local_b-p1', title: 'local_b-p1', isRunning: false })
  expect(rows[1]?.name).toBeUndefined()
  expect(parseSessionRows(JSON.stringify(row('one')))).toHaveLength(1)
  expect(parseSessionRows('not json')).toEqual([])
  expect(parseSessionRows(undefined)).toEqual([])
  expect(parseSessionRows('')).toEqual([])
})

test('children are the rows named <prefix><n>: add-x and add-x-pagination never cross', () => {
  const rows = parseSessionRows(
    JSON.stringify([row('add-x-p1'), row('add-x-p12'), row('add-x-pagination-p1'), row('add-x-p1a'), row('add-x-p'), row('other-p1'), row('x', { name: undefined })]),
  )
  expect(childrenOf(rows, 'add-x-p').map(r => r.name)).toEqual(['add-x-p1', 'add-x-p12'])
  expect(childrenOf(rows, 'add-x-pagination-p').map(r => r.name)).toEqual(['add-x-pagination-p1'])
  expect(childrenOf(rows, undefined)).toEqual([])
  const odd = parseSessionRows(JSON.stringify([row('a.b+p1'), row('aXbbp1')]))
  expect(childrenOf(odd, 'a.b+p').map(r => r.name)).toEqual(['a.b+p1'])
})

test('a child is running, archived or idle', () => {
  expect(sessionState(parseSessionRows(JSON.stringify(row('a', { isRunning: true })))[0]!)).toBe('running')
  expect(sessionState(parseSessionRows(JSON.stringify(row('a', { isArchived: true })))[0]!)).toBe('archived')
  expect(sessionState(parseSessionRows(JSON.stringify(row('a')))[0]!)).toBe('idle')
})

/** A `$.tool` that lists the given tools and answers the check with `decision`; it records the check's argument. */
const toolNoun = (names: string[], decision: 'allow' | 'ask' | 'deny' | 'throw') => {
  const checks: unknown[] = []
  const tool = {
    list: async () => names.map(name => ({ name, description: '', mcp: true })),
    check: async (args: unknown) => {
      checks.push(args)
      if (decision === 'throw') throw new Error('no check')
      return { decision }
    },
  }
  return { tool, checks }
}

test('the session list may be read only when the tool is listed and the check answers allow, asked with { tool, input }', async () => {
  const allowed = toolNoun([LIST, 'Bash'], 'allow')
  expect(await mayList(allowed)).toBe(true)
  expect(allowed.checks).toEqual([{ tool: LIST, input: { linked: true, limit: 100 } }])
  const asked = toolNoun([LIST], 'ask')
  expect(await mayList(asked)).toBe(false)
  expect(await mayList(toolNoun([LIST], 'deny'))).toBe(false)
  expect(await mayList(toolNoun([LIST], 'throw'))).toBe(false)
  const unlisted = toolNoun(['Bash'], 'allow')
  expect(await mayList(unlisted)).toBe(false)
  expect(unlisted.checks).toEqual([])
})

// ---------------------------------------------------------------- commands.ts (design D8)

const view = (changeOption: 'unknown' | 'yes' | 'no'): PanelView => ({ kind: 'report', others: [], archived: [], delivers: {}, sessions: {}, changeOption })
const change = (step: string, actor = 'main'): ChangeRow => ({ id: 'add-x', next: { step, actor }, state: '' })
const texts = (buttons: { key: string; label: string; text: string }[]) => buttons.map(b => [b.key, b.text])

test('a delivery step is implement onward, never create, approve or the owner merge', () => {
  for (const step of ['implement', 'fix-tests', 'fix-review', 'gate', 'commit', 'verify', 'open-pr', 'push', 'wait-checks', 'wait-dependencies', 'enable-auto-merge', 'edit-pr-body', 'retro', 'archive', 'archive-pr', 'archive-pr-ready', 'tick-roadmap', 'apply-proposals', 'stop-retro-answers', 'stop-plan-approval']) {
    expect(isDeliveryStep(step), step).toBe(true)
  }
  for (const step of ['create', 'new-change', 'approve', 'ready', 'answer', 'grill', 'plan', 'readiness', 'stop-review-deadlock', 'archived', '']) {
    expect(isDeliveryStep(step), step).toBe(false)
  }
})

test('every button text per step, in both languages', () => {
  for (const lang of ['pt-BR', 'en'] as const) {
    const text = uiText(lang)
    const approve = lang === 'en' ? 'I approve the plan of add-x' : 'Aprovo o plano de add-x'
    expect(texts(buttonsFor(change('gate', 'gate'), view('no'), text))).toEqual([['conduct:add-x', '/conduct'], ['ship:add-x', '/ship-change add-x']])
    expect(texts(buttonsFor(change('gate', 'gate'), view('yes'), text))).toEqual([['conduct:add-x', '/conduct add-x'], ['ship:add-x', '/ship-change add-x']])
    expect(texts(buttonsFor(change('implement', 'session'), view('unknown'), text))).toEqual([['conduct:add-x', '/conduct'], ['ship:add-x', '/ship-change add-x']])
    expect(texts(buttonsFor(change('stop-plan-approval', 'owner'), view('yes'), text))).toEqual([
      ['conduct:add-x', '/conduct add-x'],
      ['ship:add-x', '/ship-change add-x'],
      ['approve:add-x', approve],
    ])
    expect(texts(buttonsFor(change('approve', 'owner'), view('no'), text))).toEqual([['conduct:add-x', '/conduct'], ['approve:add-x', approve]])
    // a creation row has only Conduct, with the id like every other row: `/conduct <id>` on a missing change is the create path (design D8)
    expect(texts(buttonsFor(change('create', 'main'), view('yes'), text))).toEqual([['conduct:add-x', '/conduct add-x']])
    expect(texts(buttonsFor(change('new-change', 'main'), view('yes'), text))).toEqual([['conduct:add-x', '/conduct add-x']])
    expect(texts(buttonsFor(change('create', 'main'), view('no'), text))).toEqual([['conduct:add-x', '/conduct']])
    expect(texts(buttonsFor(change('new-change', 'main'), view('no'), text))).toEqual([['conduct:add-x', '/conduct']])
    expect(texts(buttonsFor(change('new-change', 'main'), view('unknown'), text))).toEqual([['conduct:add-x', '/conduct']])
    expect(texts(buttonsFor(change('stop-retro-answers', 'owner'), view('no'), text))).toEqual([
      ['conduct:add-x', '/conduct'],
      ['ship:add-x', '/ship-change add-x'],
      ['answer:add-x', 'Approve proposal 1 of add-x'],
    ])
    expect(texts(buttonsFor(change('ready', 'owner'), view('no'), text))).toEqual([['conduct:add-x', '/conduct']])
    expect(texts(buttonsFor(change('archived', 'none'), view('no'), text))).toEqual([['conduct:add-x', '/conduct']])
    const labels = buttonsFor(change('stop-plan-approval', 'owner'), view('no'), text).map(b => b.label)
    expect(labels).toEqual([text.labels.conduct, text.labels.ship, text.labels.approve])
  }
  expect(uiText('en').labels.conduct).toBe('Conduct')
  expect(uiText('pt-BR').labels.conduct).toBe('Conduzir')
  expect(langOf({ language: 'en' })).toBe('en')
  expect(langOf({ language: 'pt-BR' })).toBe('pt-BR')
  expect(langOf({})).toBe('pt-BR')
  expect(langOf({ language: 'fr' })).toBe('pt-BR')
})

// ---------------------------------------------------------------- i18n.ts (design D10)

/** Every leaf of a text object as a dotted path, a function counted as a leaf. */
const keysOf = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .flatMap(([key, child]) => keysOf(child, prefix === '' ? key : `${prefix}.${key}`))
}

test('uiText: pt-BR and en carry the same keys, the pane, band, toast, command and fill texts included', () => {
  const keys = keysOf(uiText('pt-BR'))
  expect(keys).toEqual(keysOf(uiText('en')))
  for (const key of ['band.line', 'band.noRound', 'command.opened', 'command.closed', 'command.waiting', 'toast.paneFailed', 'labels.open', 'labels.close', 'pane.title']) {
    expect(keys, key).toContain(key)
  }
  expect(uiText('en').band.line(5, 'trailer fix', 0, 2, 1, 0, 0, 0)).toBe('devkit · round 5 trailer fix · 0/2 · dispatch 1 · owner 0 · github 0 · stopped 0')
  expect(uiText('pt-BR').band.line(5, 'trailer fix', 0, 2, 1, 0, 0, 0)).toBe('devkit · rodada 5 trailer fix · 0/2 · dispatch 1 · owner 0 · github 0 · parados 0')
  expect(uiText('en').command).toEqual({ opened: 'devkit panel opened', closed: 'devkit panel closed', waiting: 'devkit panel waiting for room' })
  expect(uiText('pt-BR').command).toEqual({ opened: 'painel devkit aberto', closed: 'painel devkit fechado', waiting: 'painel devkit aguardando espaço' })
  // the deliver line counts the report's items, not a fixed eight
  expect(uiText('en').pane.deliver('in progress: item 1', 1, 3, 'gate')).toBe('deliver: in progress: item 1 · 1/3 met · next: gate')
  expect(uiText('pt-BR').pane.deliver('in progress: item 1', 1, 3, 'gate')).toBe('deliver: in progress: item 1 · 1/3 ok · próximo: gate')
  expect(uiText('en').pane.listError('refused')).toBe('list_sessions: refused')
  expect(uiText('pt-BR').pane.listError('refused')).toBe('list_sessions: refused')
})

test('the four fill texts match design D8 in each language', () => {
  for (const lang of ['pt-BR', 'en'] as const) {
    const { fill } = uiText(lang)
    expect(fill.conduct('add-x', true)).toBe('/conduct add-x')
    expect(fill.conduct('add-x', false)).toBe('/conduct')
    expect(fill.ship('add-x')).toBe('/ship-change add-x')
    expect(fill.answer('add-x')).toBe('Approve proposal 1 of add-x')
  }
  expect(uiText('pt-BR').fill.approve('add-x')).toBe('Aprovo o plano de add-x')
  expect(uiText('en').fill.approve('add-x')).toBe('I approve the plan of add-x')
})
