import type { FsEntry } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { CHANGE_STDOUT, DELIVERY, MID_IMPLEMENTATION, MISSING_EXIT, MISSING_STDERR, MISSING_STDOUT, PLANNING } from './fixtures/change'
import type { FlowFixture } from './fixtures/change'
import { DELIVER_STDOUT } from './fixtures/deliver'
import { DELIVER_OPEN_STDOUT } from './fixtures/deliver-open'
import { PROPOSAL_TEXT } from './fixtures/proposal'
import { TASKS_PHASES, TASKS_TEXT } from './fixtures/tasks'
import { COMMAND_TAGS_MESSAGE, chat, commandTags, plainCommand, skillToolUse } from './fixtures/messages'
import { FAMILY_FROM_CHILD, FAMILY_FROM_PARENT, childRow } from './fixtures/sessions'
import { WORKTREES_STDOUT } from './fixtures/worktrees'
import { ambiguousPrefixes, conductArgs, conductedId } from './conducted'
import { isChangeId } from './grammar'
import { conductButton, nowButtons } from './commands'
import { capLines, commandLabel, itemLines, itemSummary, summaryOf } from './detail'
import { ITEM_NAMES, STEP_IDS, STEP_KEYS, WORD_KEYS, langOf, uiText } from './i18n'
import { checkerVersionOk, candidates, isDevkitProject, locateChecker, parseWorktrees } from './project'
import type { PanelFs } from './project'
import { READ_VERSION, actorOf, checkerError, checksStatus, isRateLimited, newerVersion, parseDeliver, parseRound, phaseProgress } from './report'
import { NOT_IN_TABLE, flowSteps, progressOf, readTasks, stepKeyOf } from './steps'
import { LIST, LIST_INPUT, OPEN, callAppTool, childrenOf, mayList, ownChildren, parseSessionRows, phaseOf, sessionState } from './sessions'
import type { ChangeEntry, ChangeRow, DeliverReport, PanelView } from '../types'
import { bandLine, buildDetail, buildItems, renderText } from './pane'

// ---------------------------------------------------------------- report.ts (design D5, D7)

test('the --change fixture parses into one row with its step, actor, worktree and sessionPrefix', () => {
  const report = parseRound(CHANGE_STDOUT)
  expect(report?.version).toBe(2)
  expect(report?.round).toBeUndefined()
  expect(report?.changes.map(c => c.id)).toEqual(['panel-conduct-view'])
  const row = report?.changes[0]
  expect(row?.sessionPrefix).toBe('panel-conduct-view-p')
  expect(row?.next).toMatchObject({ step: 'implement', actor: 'session', phase: 1 })
  expect(row?.state).toBe('ready to run: implement')
  expect(row?.worktree).toBe('/w/.claude/worktrees/panel-conduct-view-404c57')
  expect(row?.deliver).toEqual({ summary: 'in progress: item 1', met: 1, next: 'implement' })
  expect(row?.session).toEqual({ name: 'panel-conduct-view-p1', title: 'panel-conduct-view: phase 1', phase: 1 })
})

test('the round parser tolerates missing fields and refuses what is not a report', () => {
  const bare = parseRound('{"version":2}')
  expect(bare).toMatchObject({ version: 2, changes: [], dispatch: [], owner: [], github: [], stopped: [], busy: [], end: false, roadmapDone: false })
  expect(parseRound('{"version":2,"changes":[{"id":"a"}]}')?.changes[0]).toMatchObject({ id: 'a', state: '', next: { step: '', actor: '' } })
  expect(parseRound('not json')).toBeUndefined()
  expect(parseRound('')).toBeUndefined()
  expect(parseRound('[1,2]')).toBeUndefined()
  expect(parseRound(MISSING_STDOUT)).toBeUndefined()
})

test('the deliver fixture parses into its 8 items with ids, the summary, met, the next step, no PR and 4 phases', () => {
  const report = parseDeliver(DELIVER_STDOUT)
  expect(report?.change).toBe('panel-conduct-view')
  expect(report?.items.map(i => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  expect(report?.items[0]).toMatchObject({ id: 1, name: 'tasks', status: 'open' })
  expect(report?.items[0]?.reason).toMatch(/^unticked tasks: 1\.1/)
  expect(report?.items[2]).toMatchObject({ id: 3, name: 'findings', status: 'met' })
  expect(report?.met).toBe(1)
  expect(report?.summary).toBe('in progress: item 1')
  expect(report?.next.step).toBe('implement')
  expect(report?.approval?.ok).toBe(true)
  expect(report?.pr).toBeNull()
  expect(report?.phases.map(p => [p.n, p.gate?.id, p.gate?.done, p.open.length > 0])).toEqual([
    [1, '1.9', false, true],
    [2, '2.9', false, true],
    [3, '3.9', false, true],
    [4, '4.9', false, true],
  ])
  expect(parseDeliver('{"version":1}')).toMatchObject({ change: '', items: [], met: 0, summary: '', next: { step: '' }, pr: null, phases: [] })
  expect(parseDeliver('nope')).toBeUndefined()
})

/** The deliver fixture with a pull request, the phases `done` as given and item 6 as given. */
const deliverWith = (changes: { pr?: unknown; phases?: unknown; item6?: Record<string, unknown> }): DeliverReport => {
  const base = JSON.parse(DELIVER_STDOUT) as { pr: unknown; phases: unknown; items: Record<string, unknown>[] }
  const items = base.items.map(i => (i.id === 6 && changes.item6 !== undefined ? { ...i, ...changes.item6 } : i))
  const report = parseDeliver(JSON.stringify({ ...base, pr: changes.pr ?? base.pr, phases: changes.phases ?? base.phases, items }))
  if (report === undefined) throw new Error('fixture did not parse')
  return report
}

test('AC-2 phase-progress: the current phase, the total and the finished phases come from phases', () => {
  const phase = (n: number, open: string[], done: boolean | null) => ({ n, title: `phase ${n}`, open, gate: done === null ? null : { id: `${n}.9`, done } })
  const report = (phases: unknown[]) => phaseProgress(deliverWith({ phases }).phases)
  expect(report([phase(1, [], true), phase(2, ['2.1'], false), phase(3, ['3.1'], false)])).toEqual({ current: 2, total: 3, finished: [1] })
  // a gate that is done does not finish a phase that still has an open task, nor an open gate a phase with every task ticked
  expect(report([phase(1, ['1.2'], true), phase(2, [], false)])).toEqual({ current: 1, total: 2, finished: [] })
  expect(report([phase(1, [], true), phase(2, [], true)])).toEqual({ current: 2, total: 2, finished: [1, 2] })
  expect(report([phase(1, [], null)])).toEqual({ current: 1, total: 1, finished: [] })
  expect(report([])).toBeUndefined()
  expect(phaseProgress(parseDeliver(DELIVER_STDOUT)?.phases ?? [])).toEqual({ current: 1, total: 4, finished: [] })
})

test('AC-3 pr-and-checks: pr is null or { number, url }; item 6 maps to green, red, running or unreadable from its status and details', () => {
  expect(deliverWith({}).pr).toBeNull()
  expect(deliverWith({ pr: { number: 31, url: 'https://github.com/o/r/pull/31', state: 'OPEN' } }).pr).toEqual({ number: 31, url: 'https://github.com/o/r/pull/31' })
  expect(parseDeliver('{"version":1,"pr":{"number":"x"}}')?.pr).toBeNull()
  const checks = (item6: Record<string, unknown>) => checksStatus(deliverWith({ item6 }))
  expect(checks({ status: 'met', details: { required: true, failing: [], pending: [] } })).toBe('green')
  expect(checks({ status: 'open', details: { failing: [{ name: 'build', link: 'https://x/1' }], pending: ['lint'] } })).toBe('red')
  expect(checks({ status: 'open', details: { failing: [], pending: ['lint'] } })).toBe('running')
  // open with neither a failing nor a pending entry, a blocked item and a missing details are unreadable
  expect(checks({ status: 'open', details: { failing: [], pending: [] } })).toBe('unreadable')
  expect(checks({ status: 'open', details: {} })).toBe('unreadable')
  expect(checks({ status: 'blocked', reason: 'gh: not logged in', details: { failing: [], pending: [] } })).toBe('unreadable')
  expect(checksStatus(parseDeliver('{"version":1,"items":[{"id":1,"name":"tasks","status":"met"}]}')!)).toBeUndefined()
  expect(deliverWith({ item6: { details: { failing: [{ name: 'build', link: 'l' }], pending: ['lint', 7] } } }).items[5]?.details).toEqual({ failing: [{ name: 'build' }], pending: ['lint'] })
})

test('a report whose JSON version is newer than the one read is refused by the parser and named by one error line (design D5)', () => {
  expect(READ_VERSION).toEqual({ round: 2, deliver: 1 })
  const round3 = JSON.stringify({ ...(JSON.parse(CHANGE_STDOUT) as Record<string, unknown>), version: 3 })
  expect(parseRound(round3)).toBeUndefined()
  expect(newerVersion(round3, READ_VERSION.round)).toBe('JSON version 3 is newer than the 2 this panel reads')
  expect(newerVersion(CHANGE_STDOUT, READ_VERSION.round)).toBeUndefined()
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
  expect(checkerError({ exitCode: MISSING_EXIT, stdout: MISSING_STDOUT, stderr: MISSING_STDERR })).toMatch(/^no change nosuch-thing:/)
  expect(checkerError({ exitCode: 1, stdout: '', stderr: 'conduct-check: git fetch origin main\nmore' })).toBe('conduct-check: git fetch origin main')
  expect(checkerError({ exitCode: 2, stdout: 'garbage', stderr: '  \n' })).toBe('exit 2')
})

test('D5: a rate-limit line is any of the checker lines GitHub and gh word that way', () => {
  for (const line of ['API rate limit exceeded for user ID 1', 'You have exceeded a secondary rate limit', 'GraphQL: rate limited', 'Rate Limit hit']) {
    expect(isRateLimited(line), line).toBe(true)
  }
  for (const line of ['no change x: no worktree', 'exit 1', '']) expect(isRateLimited(line), line).toBe(false)
})

test('langOf maps en to en, and anything else (fr, empty, absent) to pt-BR', () => {
  expect(langOf({ language: 'en' })).toBe('en')
  expect(langOf({ language: 'fr' })).toBe('pt-BR')
  expect(langOf({ language: '' })).toBe('pt-BR')
  expect(langOf({})).toBe('pt-BR')
  expect(langOf({ language: 'pt-BR' })).toBe('pt-BR')
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

/** The conduct skill's no-argument wording (`plugins/openspec/skills/conduct/SKILL.md`, step "No argument"), as of devkit-openspec 0.12.0. */
const SKILL_NO_ARGUMENT =
  'list the open change ids (the folders under `openspec/changes/` in the current checkout and in every path of `git worktree list`, minus `archive`, plus the worktree branches that are change ids, deduplicated)'

test('the worktree listing fixture parses into paths and branches; a detached head has no branch', () => {
  const trees = parseWorktrees(WORKTREES_STDOUT)
  expect(trees[0]).toEqual({ path: '/w', branch: 'main' })
  expect(trees.map(t => t.path)).toHaveLength(7)
  expect(trees.find(t => t.path.endsWith('panel-conduct-view-404c57'))).toEqual({ path: '/w/.claude/worktrees/panel-conduct-view-404c57', branch: 'panel-conduct-view' })
  expect(trees.map(t => t.branch)).toContain('chore/archive-review-workflow')
  expect(parseWorktrees('worktree /w\nHEAD abc\nbranch refs/heads/main\n\nworktree /w/d\nHEAD def\ndetached\n\nworktree /w/b\nbare\n')).toEqual([
    { path: '/w', branch: 'main' },
    { path: '/w/d' },
    { path: '/w/b' },
  ])
  expect(parseWorktrees('')).toEqual([])
})

/** A disk where every worktree of the fixture has its own `openspec/changes`. */
const changesDisk = (byPath: Record<string, string[]>): PanelFs =>
  disk({}, Object.fromEntries(Object.entries(byPath).map(([path, names]) => [`${path}/openspec/changes`, names])))

test('AC-6 other-changes-collapsed: the candidates follow the conduct skill: folders of every worktree minus archive, plus branches that are change ids, deduplicated', async () => {
  expect(SKILL_NO_ARGUMENT).toContain('the folders under `openspec/changes/` in the current checkout and in every path of `git worktree list`')
  expect(SKILL_NO_ARGUMENT).toContain('minus `archive`')
  expect(SKILL_NO_ARGUMENT).toContain('plus the worktree branches that are change ids, deduplicated')
  const fs = changesDisk({
    '/w': ['archive', 'devkit-panel', 'README.md'],
    '/w/.claude/worktrees/commit-and-pr-trailer': ['archive', 'commit-and-pr-trailer', 'devkit-panel'],
    '/w/.claude/worktrees/panel-conduct-view-404c57': ['archive', 'panel-conduct-view'],
  })
  const found = await candidates({ fs }, '/w', parseWorktrees(WORKTREES_STDOUT))
  // a folder wins over the same branch; the main checkout's branch (main), claude/<name> style and chore/... branches are not candidates
  expect(found).toEqual([
    { id: 'devkit-panel', source: 'folder' },
    { id: 'commit-and-pr-trailer', source: 'folder' },
    { id: 'panel-conduct-view', source: 'folder' },
    { id: 'conventions-trailer', source: 'branch' },
    { id: 'getting-started-roadmap', source: 'branch' },
  ])
  expect(found.map(c => c.id)).not.toContain('main')
  expect(found.map(c => c.id)).not.toContain('archive')
})

test('AC-6 other-changes-collapsed: an id with an archived folder is not open, whatever its source; the date prefix must match exactly', async () => {
  const trees = parseWorktrees(
    ['worktree /w', 'branch refs/heads/main', '', 'worktree /w/a', 'branch refs/heads/conduct-rounds', '', 'worktree /w/b', 'branch refs/heads/add-x', '', 'worktree /w/c', 'branch refs/heads/only-own', ''].join('\n'),
  )
  const fs = disk({}, {
    '/w/openspec/changes': ['archive', 'old-folder'],
    '/w/openspec/changes/archive': ['2026-11-10-conduct-rounds', '2026-11-10-add-x-pagination', '2026-10-01-old-folder'],
    '/w/c/openspec/changes/archive': ['2026-11-11-only-own'],
  })
  const found = await candidates({ fs }, '/w', trees)
  expect(found).toEqual([{ id: 'add-x', source: 'branch' }])
})

test('AC-6 other-changes-collapsed: claude/<name>, a detached head and the main checkout branch are not candidates; with no listing the root alone is used', async () => {
  const trees = parseWorktrees(
    ['worktree /w', 'branch refs/heads/trunk', '', 'worktree /w/a', 'branch refs/heads/claude/serene-owl', '', 'worktree /w/b', 'detached', '', 'worktree /w/c', 'branch refs/heads/add-x.v2', '', 'worktree /w/d', 'branch refs/heads/_hidden', ''].join('\n'),
  )
  const found = await candidates({ fs: changesDisk({}) }, '/w', trees)
  expect(found).toEqual([{ id: 'add-x.v2', source: 'branch' }])
  const alone = await candidates({ fs: changesDisk({ '/w': ['archive', 'only-here'] }) }, '/w', [])
  expect(alone).toEqual([{ id: 'only-here', source: 'folder' }])
  // an unreadable folder is no candidate, not an error
  expect(await candidates({ fs: disk({}) }, '/w', [])).toEqual([])
})

test('AC-6 other-changes-collapsed: the checker version gate: repo and an unreadable label are ok, below 0.10.0 is old-checker', () => {
  expect(checkerVersionOk('devkit-openspec 0.9.1')).toBe('old-checker')
  expect(checkerVersionOk('devkit-openspec 0.9.12')).toBe('old-checker')
  expect(checkerVersionOk('devkit-openspec 0.10.0')).toBe('ok')
  expect(checkerVersionOk('devkit-openspec 0.12.0')).toBe('ok')
  expect(checkerVersionOk('devkit-openspec 1.0.0')).toBe('ok')
  expect(checkerVersionOk('repo')).toBe('ok')
  expect(checkerVersionOk('devkit-openspec')).toBe('ok')
  expect(checkerVersionOk('devkit-openspec next')).toBe('ok')
  expect(checkerVersionOk('')).toBe('ok')
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
  expect(allowed.checks).toEqual([{ tool: LIST, input: { linked: true, include_archived: true, limit: 100 } }])
  const asked = toolNoun([LIST], 'ask')
  expect(await mayList(asked)).toBe(false)
  expect(await mayList(toolNoun([LIST], 'deny'))).toBe(false)
  expect(await mayList(toolNoun([LIST], 'throw'))).toBe(false)
  const unlisted = toolNoun(['Bash'], 'allow')
  expect(await mayList(unlisted)).toBe(false)
  expect(unlisted.checks).toEqual([])
})

test('D9: the list is asked for the linked family with the archived children, up to 100', () => {
  expect(LIST_INPUT).toEqual({ linked: true, include_archived: true, limit: 100 })
})

test('AC-5 child-sessions-with-icons: a family seen from the conducting session gives its children as own children; seen from a child it gives none', () => {
  expect(ownChildren(FAMILY_FROM_PARENT).map(r => r.name)).toEqual(['panel-conduct-view-p1', 'panel-conduct-view-p2'])
  // from the child p2: the parent is in the list and the sibling p1 was started by it, so nothing was started by a session this one does not list
  expect(ownChildren(FAMILY_FROM_CHILD)).toEqual([])
  // rows without startedBy give none
  expect(ownChildren(FAMILY_FROM_PARENT.map(({ startedBy: _startedBy, ...rest }) => rest))).toEqual([])
  expect(ownChildren([])).toEqual([])
})

test('the phase of a child is the number after its prefix, none for any other name', () => {
  expect(phaseOf('panel-conduct-view-p2', 'panel-conduct-view-p')).toBe(2)
  expect(phaseOf('panel-conduct-view-p12', 'panel-conduct-view-p')).toBe(12)
  expect(phaseOf('panel-conduct-view-pagination-p2', 'panel-conduct-view-p')).toBeUndefined()
  expect(phaseOf('panel-conduct-view-p', 'panel-conduct-view-p')).toBeUndefined()
  expect(phaseOf(undefined, 'x-p')).toBeUndefined()
  expect(phaseOf('x-p1', undefined)).toBeUndefined()
})

test('D13: one helper makes every app tool call and accepts only list_sessions and open_session_in', async () => {
  const calls: unknown[] = []
  const $ = { tool: { call: async (args: unknown) => (calls.push(args), { result: 'ok', text: 'ok' }) } }
  await callAppTool($ as never, LIST, LIST_INPUT)
  await callAppTool($ as never, OPEN, { session_id: 'local_x', target: 'split' })
  expect(calls).toEqual([
    { tool: LIST, linked: true, include_archived: true, limit: 100 },
    { tool: OPEN, session_id: 'local_x', target: 'split' },
  ])
  expect(OPEN).toBe('mcp__ccd_window__open_session_in')
  for (const other of ['mcp__ccd_session_mgmt__start_session', 'mcp__ccd_session_mgmt__send_message', 'Bash']) {
    await expect(callAppTool($ as never, other as typeof LIST, {})).rejects.toThrow(/not an app tool this panel calls/)
  }
  expect(calls).toHaveLength(2)
})

// ---------------------------------------------------------------- conducted.ts (design D3)

test('AC-1 conducted-change-on-top: the three forms of /conduct <id> give the id, newest first', () => {
  expect(conductArgs([chat('user', 'hello'), COMMAND_TAGS_MESSAGE, chat('assistant', 'on it')])).toBe('release-rebase-pin')
  expect(conductArgs([commandTags('add-x', 'conduct')])).toBe('add-x')
  expect(conductArgs([plainCommand('/conduct add-x')])).toBe('add-x')
  expect(conductArgs([plainCommand('/devkit-openspec:conduct add-x\nand some more text')])).toBe('add-x')
  expect(conductArgs([chat('user', 'please conduct add-x'), skillToolUse('add-x')])).toBe('add-x')
  expect(conductArgs([skillToolUse('add-x', 'conduct')])).toBe('add-x')
  // the newest invocation wins
  expect(conductArgs([commandTags('old-one'), chat('assistant', 'ok'), plainCommand('/conduct newer-one')])).toBe('newer-one')
})

test('AC-1 conducted-change-on-top: a trailing sentence period (or other punctuation, quotes, backticks) is trimmed in each of the three forms', () => {
  expect(conductArgs([commandTags('panel-conduct-view.')])).toBe('panel-conduct-view')
  expect(conductArgs([plainCommand('/conduct panel-conduct-view.')])).toBe('panel-conduct-view')
  expect(conductArgs([skillToolUse('panel-conduct-view.')])).toBe('panel-conduct-view')
  expect(conductArgs([commandTags('panel-conduct-view!!')])).toBe('panel-conduct-view')
  expect(conductArgs([commandTags('"panel-conduct-view"')])).toBe('panel-conduct-view')
  expect(conductArgs([commandTags('`panel-conduct-view`,')])).toBe('panel-conduct-view')
  expect(conductArgs([plainCommand('/conduct "add-x";')])).toBe('add-x')
  // the checker's own --change rule: signal 1 still finds a change such as add-x.v2
  expect(conductArgs([plainCommand('/conduct add-x.v2.')])).toBe('add-x.v2')
  expect(conductArgs([commandTags('Add-X')])).toBe('Add-X')
  for (const ok of ['add-x2', 'Add-X', 'add_x', 'v1.2', 'add-x.v2', 'x-']) expect(isChangeId(ok)).toBe(true)
  for (const bad of ['a/b', 'a b', '-x', 'archive', '.', '..', '']) expect(isChangeId(bad)).toBe(false)
})

test('AC-1 conducted-change-on-top: an ARGS that is no change id after trimming gives no signal 1, so the own children decide', () => {
  for (const args of ['panel conduct view', '../panel-conduct-view', 'a/b', '-x', 'archive', '..', '...', '"']) {
    expect(conductArgs([commandTags(args)])).toBeUndefined()
  }
  const entries = { 'add-x': { id: 'add-x', row: { sessionPrefix: 'add-x-p' } } } as unknown as Parameters<typeof conductedId>[2]
  const signal1 = conductArgs([commandTags('Add X please')])
  expect(conductedId(signal1, [childRow('add-x-p1')], entries, undefined)).toEqual({ id: 'add-x', via: 'children' })
})

test('AC-1 conducted-change-on-top: round 5, empty ARGS, many ids and an older single id behind a newer round give none', () => {
  expect(conductArgs([commandTags('round 5')])).toBeUndefined()
  expect(conductArgs([plainCommand('/conduct round 5')])).toBeUndefined()
  expect(conductArgs([skillToolUse('round 5')])).toBeUndefined()
  expect(conductArgs([commandTags('')])).toBeUndefined()
  expect(conductArgs([plainCommand('/conduct')])).toBeUndefined()
  expect(conductArgs([plainCommand('/conduct a b')])).toBeUndefined()
  expect(conductArgs([commandTags('older-id'), chat('assistant', 'ok'), commandTags('round 5')])).toBeUndefined()
  // not an invocation: another command, a conduct word inside text, another skill
  expect(conductArgs([plainCommand('/conducted add-x'), plainCommand('please run /conduct add-x'), skillToolUse('add-x', 'devkit-core:ship-change'), chat('user', 'hi')])).toBeUndefined()
  expect(conductArgs([])).toBeUndefined()
})

const entry = (id: string, prefix: string | undefined, extra: Partial<ChangeEntry> = {}): ChangeEntry => ({
  id,
  checkedAt: 1,
  source: 'folder',
  ...(prefix === undefined ? {} : { row: { id, next: { step: 'implement', actor: 'session' }, state: 'ready to run: implement', sessionPrefix: prefix } satisfies ChangeRow }),
  ...extra,
})
const byId = (...entries: ChangeEntry[]): Record<string, ChangeEntry> => Object.fromEntries(entries.map(e => [e.id, e]))

test('AC-5 child-sessions-with-icons: a prefix the stored rows of two candidates carry is ambiguous', () => {
  const entries = byId(entry('checkout-discount-codes-a', 'checkout-discount-co-p'), entry('checkout-discount-codes-b', 'checkout-discount-co-p'), entry('add-x', 'add-x-p'), entry('add-x-pagination', 'add-x-pagination-p'), entry('no-row', undefined))
  expect(ambiguousPrefixes(Object.values(entries))).toEqual(['checkout-discount-co-p'])
  expect(ambiguousPrefixes([])).toEqual([])
})

test('AC-5 child-sessions-with-icons: the conducted change follows the D3 order; children match the stored prefixes only', () => {
  const entries = byId(entry('add-x', 'add-x-p'), entry('add-x-pagination', 'add-x-pagination-p'), entry('other', 'other-p'))
  const kids = (...names: string[]) => names.map(n => childRow(n))
  // signal 1 wins over children
  expect(conductedId('other', kids('add-x-p2'), entries, undefined)).toEqual({ id: 'other', via: 'command' })
  // signal 2: the own child decides; add-x and add-x-pagination never cross
  expect(conductedId(undefined, kids('add-x-p2'), entries, undefined)).toEqual({ id: 'add-x', via: 'children' })
  expect(conductedId(undefined, kids('add-x-pagination-p1'), entries, undefined)).toEqual({ id: 'add-x-pagination', via: 'children' })
  expect(conductedId(undefined, kids('stranger-p1', 'add-x-p1x'), entries, undefined)).toBeUndefined()
  expect(conductedId(undefined, [], entries, undefined)).toBeUndefined()
  // the running child beats the more recent idle one; then the most recent activity
  const running = [childRow('other-p1', { lastActivityAt: '2026-11-11T12:00:00.000Z' }), childRow('add-x-p1', { isRunning: true, lastActivityAt: '2026-11-11T08:00:00.000Z' })]
  expect(conductedId(undefined, running, entries, undefined)?.id).toBe('add-x')
  const idle = [childRow('other-p1', { lastActivityAt: '2026-11-11T08:00:00.000Z' }), childRow('add-x-p1', { lastActivityAt: '2026-11-11T12:00:00.000Z' })]
  expect(conductedId(undefined, idle, entries, undefined)?.id).toBe('add-x')
})

test('AC-5 child-sessions-with-icons: two ids sharing a 20-character prefix never claim each other\'s children; signal 1 keeps its id with sharedWith', () => {
  const entries = byId(entry('checkout-discount-codes-a', 'checkout-discount-co-p'), entry('checkout-discount-codes-b', 'checkout-discount-co-p'))
  const kids = [childRow('checkout-discount-co-p2')]
  // a round 5 transcript: neither is found through children
  expect(conductedId(undefined, kids, entries, undefined)).toBeUndefined()
  // /conduct <a>: a is conducted, with b as the one sharing the prefix; b is never conducted
  expect(conductedId('checkout-discount-codes-a', kids, entries, undefined)).toEqual({ id: 'checkout-discount-codes-a', via: 'command', sharedWith: ['checkout-discount-codes-b'] })
  expect(conductedId('checkout-discount-codes-b', kids, entries, undefined)).toEqual({ id: 'checkout-discount-codes-b', via: 'command', sharedWith: ['checkout-discount-codes-a'] })
})

test('AC-5 child-sessions-with-icons: a stored entry with an error and a last good row still matches; one with no row takes no part', () => {
  const failed = byId(entry('add-x', 'add-x-p', { error: 'timed out' }), entry('norow', undefined, { error: 'exit 3' }))
  expect(conductedId(undefined, [childRow('add-x-p1')], failed, undefined)).toEqual({ id: 'add-x', via: 'children' })
  expect(conductedId(undefined, [childRow('norow-p1')], failed, undefined)).toBeUndefined()
  // a dropped entry (an archived change) takes no part in signal 2, and a signal-1 archived id is no longer conducted
  const dropped = byId(entry('add-x', 'add-x-p', { dropped: 'archived' }))
  expect(conductedId(undefined, [childRow('add-x-p1')], dropped, undefined)).toBeUndefined()
  expect(conductedId('add-x', [childRow('add-x-p1')], dropped, undefined)).toBeUndefined()
})

test('AC-5 child-sessions-with-icons: the previous children-found id is kept only when a fetch failed in this run and it is still a candidate', () => {
  const entries = byId(entry('add-x', undefined, { error: 'timed out' }), entry('other', 'other-p'))
  const previous = { id: 'add-x', via: 'children' } as const
  expect(conductedId(undefined, [], entries, previous, true)).toEqual({ id: 'add-x', via: 'children' })
  expect(conductedId(undefined, [], entries, previous, false)).toBeUndefined()
  expect(conductedId(undefined, [], entries, previous)).toBeUndefined()
  // never a command-found id, never a change that is gone, never over a signal
  expect(conductedId(undefined, [], entries, { id: 'add-x', via: 'command' }, true)).toBeUndefined()
  expect(conductedId(undefined, [], entries, { id: 'gone', via: 'children' }, true)).toBeUndefined()
  expect(conductedId(undefined, [childRow('other-p1')], entries, previous, true)).toEqual({ id: 'other', via: 'children' })
  expect(conductedId('other', [], entries, previous, true)).toEqual({ id: 'other', via: 'command' })
})

// ---------------------------------------------------------------- commands.ts (design D24)

const change = (step: string, actor = 'main'): ChangeRow => ({ id: 'add-x', next: { step, actor }, state: '' })
const texts = (buttons: { key: string; label: string; text: string }[]) => buttons.map(b => [b.key, b.text])

test('AC-8 buttons-visibly-fill: Continue here is always /conduct <id>; Approve plan and Answer retro come on their steps only; there is no Ship button', () => {
  for (const lang of ['pt-BR', 'en'] as const) {
    const text = uiText(lang)
    const approve = lang === 'en' ? 'I approve the plan of add-x' : 'Aprovo o plano de add-x'
    expect(texts(nowButtons(change('gate', 'gate'), text))).toEqual([['conduct:add-x', '/conduct add-x']])
    expect(texts(nowButtons(change('implement', 'session'), text))).toEqual([['conduct:add-x', '/conduct add-x']])
    expect(texts(nowButtons(change('stop-plan-approval', 'owner'), text))).toEqual([['conduct:add-x', '/conduct add-x'], ['approve:add-x', approve]])
    expect(texts(nowButtons(change('approve', 'owner'), text))).toEqual([['conduct:add-x', '/conduct add-x'], ['approve:add-x', approve]])
    // a creation row has only Continue: `/conduct <id>` on a missing change is the create path
    expect(texts(nowButtons(change('create', 'main'), text))).toEqual([['conduct:add-x', '/conduct add-x']])
    expect(texts(nowButtons(change('stop-retro-answers', 'owner'), text))).toEqual([['conduct:add-x', '/conduct add-x'], ['answer:add-x', 'Approve proposal 1 of add-x']])
    expect(texts(nowButtons(change('ready', 'owner'), text))).toEqual([['conduct:add-x', '/conduct add-x']])
    expect(nowButtons(change('stop-plan-approval', 'owner'), text).map(b => b.label)).toEqual([text.labels.continueHere, text.labels.approve])
    expect(texts([conductButton('add-x', text)])).toEqual([['conduct:add-x', '/conduct add-x']])
    expect(conductButton('add-x', text).label).toBe(text.labels.conduct)
  }
  expect(uiText('pt-BR').labels.continueHere).toBe('Continuar aqui')
  expect(uiText('pt-BR').labels.conduct).toBe('Conduzir')
  expect(uiText('en').labels.conduct).toBe('Conduct')
})

// ---------------------------------------------------------------- i18n.ts (design D12)

/** Every leaf of a text object as a dotted path, a function counted as a leaf. */
const keysOf = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .flatMap(([key, child]) => keysOf(child, prefix === '' ? key : `${prefix}.${key}`))
}

test('uiText: pt-BR and en carry the same keys, the pane, detail, band, toast, command and fill texts included', () => {
  const keys = keysOf(uiText('pt-BR'))
  expect(keys).toEqual(keysOf(uiText('en')))
  for (const key of ['band.count', 'band.none', 'command.opened', 'command.closed', 'command.waiting', 'toast.paneFailed', 'labels.open', 'labels.close', 'pane.title', 'pane.oldChecker', 'pane.rateLimit', 'pane.sharedPrefix', 'pane.step', 'pane.item', 'pane.footer', 'pane.footerPaused', 'toast.filled', 'toast.openDenied', 'toast.openSidebar', 'detail.escBack', 'labels.copied']) {
    expect(keys, key).toContain(key)
  }
  // the 0.2.0 texts the approved mock replaces are gone
  for (const gone of ['pane.conducted', 'pane.noConducted', 'pane.inProgress', 'pane.delivery', 'labels.ship', 'labels.filled', 'fill.ship', 'pane.phase']) expect(keys, gone).not.toContain(gone)
  expect(uiText('en').command).toEqual({ opened: 'devkit panel opened', closed: 'devkit panel closed', waiting: 'devkit panel waiting for room' })
  expect(uiText('pt-BR').command).toEqual({ opened: 'painel devkit aberto', closed: 'painel devkit fechado', waiting: 'painel devkit aguardando espaço' })
  expect(uiText('en').pane.oldChecker).toBe('needs devkit-openspec 0.10.0 or newer')
  expect(uiText('pt-BR').pane.oldChecker).toBe('requer devkit-openspec 0.10.0 ou mais novo')
  expect(uiText('en').pane.rateLimit('14:05')).toBe('GitHub rate limit: checks paused until 14:05')
  expect(uiText('pt-BR').pane.rateLimit('14:05')).toBe('limite do GitHub: checagens pausadas até 14:05')
  expect(uiText('en').pane.sharedPrefix('b')).toBe('shared session names with b')
  expect(uiText('pt-BR').pane.sharedPrefix('b')).toBe('nomes de sessão compartilhados com b')
  expect(uiText('en').pane.listError('refused')).toBe('list_sessions: refused')
  expect(uiText('en').pane.openFromSidebar).toBe('open it from the sidebar')
  expect(uiText('pt-BR').pane.openFromSidebar).toBe('abra pela barra lateral')
})

test('the three fill texts match design D24 in each language: Conduct is always /conduct <id>', () => {
  for (const lang of ['pt-BR', 'en'] as const) {
    const { fill } = uiText(lang)
    expect(fill.conduct('add-x')).toBe('/conduct add-x')
    expect(fill.answer('add-x')).toBe('Approve proposal 1 of add-x')
  }
  expect(uiText('pt-BR').fill.approve('add-x')).toBe('Aprovo o plano de add-x')
  expect(uiText('en').fill.approve('add-x')).toBe('I approve the plan of add-x')
})

test('AC-17 sections-say-what-they-are: every text of design D12 is written as the table says, in pt-BR and en', () => {
  const pt = uiText('pt-BR')
  const en = uiText('en')
  // 1 · header, caption, repository line, now box, pill, lines, buttons, hint
  expect([pt.labels.refresh, en.labels.refresh]).toEqual(['↻ Atualizar', '↻ Refresh'])
  expect([pt.pane.title, en.pane.title]).toEqual(['devkit', 'devkit'])
  expect([pt.pane.caption, en.pane.caption]).toEqual(['Esta conversa conduz', 'This conversation conducts'])
  expect([pt.pane.repoLine('psim', 'x'), en.pane.repoLine('psim', 'x')]).toEqual(['psim · branch x', 'psim · branch x'])
  expect([pt.pane.now, en.pane.now]).toEqual(['Agora', 'Now'])
  expect(['owner', 'session', 'github', 'stop', 'none'].map(a => pt.pane.pill(a))).toEqual(['você age', 'Claude age', 'GitHub age', 'parada', 'esperando'])
  expect(['owner', 'session', 'github', 'stop', 'none'].map(a => en.pane.pill(a))).toEqual(['you act', 'Claude acts', 'GitHub acts', 'stopped', 'waiting'])
  expect([pt.pane.nowLeft(4), en.pane.nowLeft(4)]).toEqual(['Faltam 4 tarefas nesta fase.', '4 tasks left in this phase.'])
  expect([pt.pane.nowThen('revisão, provas'), en.pane.nowThen('review, proofs')]).toEqual(['Depois: revisão, provas.', 'Then: review, proofs.'])
  expect([pt.labels.continueHere, pt.labels.approve, pt.labels.answer, pt.labels.conduct]).toEqual(['Continuar aqui', 'Aprovar plano', 'Responder retro', 'Conduzir'])
  expect([en.labels.continueHere, en.labels.approve, en.labels.answer, en.labels.conduct]).toEqual(['Continue here', 'Approve plan', 'Answer retro', 'Conduct'])
  expect([pt.pane.hint('x'), en.pane.hint('x')]).toEqual(['põe /conduct x na caixa', 'puts /conduct x in the box'])
  // 1 · steps, names, facts
  expect([pt.pane.steps, pt.pane.stepsCount(4), en.pane.steps, en.pane.stepsCount(4)]).toEqual(['Passos', '4 de 10', 'Steps', '4 of 10'])
  expect(STEP_KEYS.map(k => pt.pane.stepName(k))).toEqual(['Requisitos', 'Plano', 'Prontidão', 'Sua aprovação', 'Implementação', 'Revisão', 'Provas', 'PR e checks', 'Merge', 'Retro e arquivo'])
  expect(STEP_KEYS.map(k => en.pane.stepName(k))).toEqual(['Requirements', 'Plan', 'Readiness', 'Your approval', 'Implementation', 'Review', 'Proofs', 'PR and checks', 'Merge', 'Retro and archive'])
  expect([pt.pane.fact.criteria(3), pt.pane.fact.sections(16), pt.pane.fact.approved, pt.pane.fact.toRevise, pt.pane.fact.blocked, pt.pane.fact.tasks(103, 107), pt.pane.fact.round(2), pt.pane.fact.proven(3, 21), pt.pane.fact.pr(31, 'verde')]).toEqual([
    '3 critérios', '16 seções', 'aprovada', 'a revisar', 'bloqueada', '103 de 107 tarefas', 'rodada 2', '3 de 21 critérios', 'PR #31 · verde',
  ])
  expect([en.pane.fact.criteria(3), en.pane.fact.sections(16), en.pane.fact.approved, en.pane.fact.toRevise, en.pane.fact.blocked, en.pane.fact.tasks(103, 107), en.pane.fact.round(2), en.pane.fact.proven(3, 21), en.pane.fact.pr(31, 'green')]).toEqual([
    '3 criteria', '16 sections', 'approved', 'to revise', 'blocked', '103 of 107 tasks', 'round 2', '3 of 21 criteria', 'PR #31 · green',
  ])
  expect([pt.pane.fact.date(9, 18), en.pane.fact.date(9, 18)]).toEqual(['18 set', 'Sep 18'])
  expect(Array.from({ length: 12 }, (_, i) => pt.pane.fact.date(i + 1, 1).split(' ')[1])).toEqual(['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'])
  expect(Array.from({ length: 12 }, (_, i) => en.pane.fact.date(i + 1, 1).split(' ')[0])).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
  // 1 · pending, documents, sessions, other changes, footer
  expect([pt.pane.pending, pt.pane.tag('owner'), pt.pane.tag('claude'), pt.pane.tag('gate'), pt.pane.more(3)]).toEqual(['Pendências', 'você', 'Claude', 'gate', '+3'])
  expect([en.pane.pending, en.pane.tag('owner'), en.pane.tag('claude'), en.pane.tag('gate'), en.pane.more(3)]).toEqual(['Pending', 'you', 'Claude', 'gate', '+3'])
  expect([pt.pane.documents, ...['proposal.md', 'design.md', 'tasks.md', 'specs', 'evidence.md'].map(f => pt.pane.docName(f))]).toEqual(['Documentos', 'Proposta', 'Design', 'Tarefas', 'Specs', 'Provas'])
  expect([en.pane.documents, ...['proposal.md', 'design.md', 'tasks.md', 'specs', 'evidence.md'].map(f => en.pane.docName(f))]).toEqual(['Documents', 'Proposal', 'Design', 'Tasks', 'Specs', 'Proofs'])
  expect(['requirements.md', 'proposal.md', 'design.md', 'tasks.md', 'specs', 'readiness.md', 'approval.md', 'evidence.md'].map(f => pt.pane.docName(f))).toEqual(['Requisitos', 'Proposta', 'Design', 'Tarefas', 'Specs', 'Prontidão', 'Aprovação', 'Provas'])
  expect(['requirements.md', 'proposal.md', 'design.md', 'tasks.md', 'specs', 'readiness.md', 'approval.md', 'evidence.md'].map(f => en.pane.docName(f))).toEqual(['Requirements', 'Proposal', 'Design', 'Tasks', 'Specs', 'Readiness', 'Approval', 'Proofs'])
  expect([pt.pane.sessions, pt.pane.sessionPhase(2, 'x'), pt.pane.childState('running'), pt.pane.childState('idle'), pt.pane.archivedCount(14), pt.pane.otherChanges]).toEqual(['Sessões desta change', 'Fase 2 · x', 'executando', 'ociosa', '14 arquivadas', 'Outras changes abertas'])
  expect([en.pane.sessions, en.pane.sessionPhase(2, 'x'), en.pane.childState('running'), en.pane.childState('idle'), en.pane.archivedCount(14), en.pane.otherChanges]).toEqual(['Sessions of this change', 'Phase 2 · x', 'running', 'idle', '14 archived', 'Other open changes'])
  expect([pt.pane.otherChangesHint, en.pane.otherChangesHint]).toEqual(['independentes desta conversa; nenhuma precisa terminar antes', 'independent of this conversation; none has to finish first'])
  expect([pt.pane.footer(6, 54), pt.pane.footerRefreshing, pt.pane.footerPaused(6, '14:05')]).toEqual(['Atualizado há 6 s · próxima em 54 s', 'atualizando...', 'Atualizado há 6 s · pausado até 14:05'])
  expect([en.pane.footer(6, 54), en.pane.footerRefreshing, en.pane.footerPaused(6, '14:05')]).toEqual(['Updated 6 s ago · next in 54 s', 'refreshing...', 'Updated 6 s ago · paused until 14:05'])
  // 2 · pending detail
  expect([pt.detail.pendingTitle, pt.detail.pendingSubtitle('x', 4, 107), pt.detail.allWait('você'), pt.detail.kPending(3), pt.detail.whoActs('você'), pt.detail.section(11, 't'), pt.detail.fullText, pt.labels.copy, pt.labels.copied, pt.detail.escBack]).toEqual([
    'Pendências', 'x · 4 de 107 tarefas', 'Todas esperam você', '3 pendências', 'Quem age: você.', 'Seção 11 · t', '› Texto completo das tarefas', 'Copiar', '✓ Copiado', 'Esc fecha e volta ao painel',
  ])
  expect([en.detail.pendingTitle, en.detail.pendingSubtitle('x', 4, 107), en.detail.allWait('you'), en.detail.kPending(3), en.detail.whoActs('you'), en.detail.section(11, 't'), en.detail.fullText, en.labels.copy, en.labels.copied, en.detail.escBack]).toEqual([
    'Pending', 'x · 4 of 107 tasks', 'All wait on you', '3 pending', 'Who acts: you.', 'Section 11 · t', '› Full text of the tasks', 'Copy', '✓ Copied', 'Esc closes and returns to the panel',
  ])
  // 3 · empty
  expect([pt.pane.emptyTitle, pt.pane.emptySentence, pt.pane.openIn('psim'), pt.pane.planReady(25), pt.pane.showMore(3)]).toEqual([
    'Nenhuma change nesta conversa', 'Escolha uma abaixo para conduzir aqui. O botão põe o comando na caixa de texto; você aperta Enter.', 'Changes abertas em psim', 'plano pronto · 0 de 25', 'mostrar mais (3)',
  ])
  expect([en.pane.emptyTitle, en.pane.emptySentence, en.pane.openIn('psim'), en.pane.planReady(25), en.pane.showMore(3)]).toEqual([
    'No change in this conversation', 'Pick one below to conduct here. The button puts the command in the text box; you press Enter.', 'Open changes in psim', 'plan ready · 0 of 25', 'show more (3)',
  ])
  // 4 · band
  expect([pt.labels.open, pt.labels.close, pt.band.count(3), pt.band.none]).toEqual(['Abrir painel', 'Fechar painel', 'devkit · 3 changes abertas', 'devkit · nenhuma change aberta'])
  expect([en.labels.open, en.labels.close, en.band.count(3), en.band.none]).toEqual(['Open panel', 'Close panel', 'devkit · 3 open changes', 'devkit · no open change'])
  // 5 · document, 6 · step
  expect([pt.detail.sections, pt.labels.openInEditor, pt.detail.escClose]).toEqual(['Seções', 'Abrir no editor ↗', 'Esc fecha'])
  expect([en.detail.sections, en.labels.openInEditor, en.detail.escClose]).toEqual(['Sections', 'Open in editor ↗', 'Esc closes'])
  expect([pt.detail.tasksOf(103, 107), pt.detail.percent(96), pt.detail.missing, pt.detail.sectionsTasks(2, 4), pt.detail.done, pt.detail.sectionsCount(14), pt.labels.seeFile('tarefas.md')]).toEqual(['103 de 107 tarefas', '96%', 'Faltam', '2 seções · 4 tarefas', 'Feitas', '14 seções', 'Ver tarefas.md'])
  expect([en.detail.tasksOf(103, 107), en.detail.percent(96), en.detail.missing, en.detail.sectionsTasks(2, 4), en.detail.done, en.detail.sectionsCount(14), en.labels.seeFile('tasks.md')]).toEqual(['103 of 107 tasks', '96%', 'Missing', '2 sections · 4 tasks', 'Done', '14 sections', 'See tasks.md'])
  // filled, short-list words, details, kept texts
  expect([pt.toast.filled, en.toast.filled]).toEqual(['clique na caixa de texto e aperte Enter', 'click the prompt box and press Enter'])
  expect(WORD_KEYS.map(k => pt.pane.word(k))).toEqual(['aberta', 'sem prova', 'ausente', 'desatualizada', 'rejeitada', 'falhou', 'rodando', 'o dono decide'])
  expect(WORD_KEYS.map(k => en.pane.word(k))).toEqual(['open', 'no proof', 'missing', 'stale', 'rejected', 'failing', 'running', 'owner weighs'])
  expect([pt.pane.nothingPending, pt.pane.noLongerOpen, pt.pane.conductMeaning]).toEqual(['nada pendente', 'não está mais aberta', 'planeja e executa aqui, com sessões filhas'])
  expect([en.pane.nothingPending, en.pane.noLongerOpen, en.pane.conductMeaning]).toEqual(['nothing pending', 'no longer open', 'plans and runs it here, with child sessions'])
  expect([pt.detail.noApproval, pt.pane.noPr, pt.detail.stepDone, pt.detail.fullTextShort, pt.labels.seeFile('design.md')]).toEqual(['sem aprovação ainda', 'sem PR ainda', 'feito', '› Texto completo', 'Ver design.md'])
  expect([en.detail.noApproval, en.pane.noPr, en.detail.stepDone, en.detail.fullTextShort, en.labels.seeFile('design.md')]).toEqual(['no approval yet', 'no PR yet', 'done', '› Full text', 'See design.md'])
  expect([pt.pane.permission('t'), en.pane.permission('t')]).toEqual(['permita t para ver as sessões filhas', 'allow t to see the child sessions'])
})

test('AC-17 sections-say-what-they-are: every button label and step name is at most four words, in both languages', () => {
  for (const lang of ['pt-BR', 'en'] as const) {
    const text = uiText(lang)
    const labels = [text.labels.continueHere, text.labels.approve, text.labels.answer, text.labels.conduct, text.labels.copy, text.labels.open, text.labels.close, text.labels.refresh, ...STEP_KEYS.map(k => text.pane.stepName(k))]
    for (const label of labels) expect(label.trim().split(/\s+/).length, `${lang}: ${label}`).toBeLessThanOrEqual(4)
  }
})

/** Every step `conduct-check`'s `actorOf` names (plugins/openspec/hooks/conduct-check.mjs), plus the two steps that end a row. */
const ACTOR_STEPS = [
  'implement', 'fix-review', 'fix-defect', 'fix-checks', 'apply-proposals', 'resolve-release-conflict', 'commit', 'open-pr', 'push', 'open-archive-pr',
  'push-rebased', 'verify', 'retro', 'plan', 'revise-plan', 'readiness', 'audit', 'review', 'gate', 'edit-pr-body', 'enable-auto-merge', 'disable-auto-merge',
  'update-branch', 'archive', 'tick-roadmap', 'answer', 'worktree', 'rebase', 'stop-retro-answers', 'stop-plan-approval', 'create', 'new-change', 'grill',
  'approve', 'ready', 'archive-pr-ready', 'stop-review-deadlock', 'stop-readiness-blocked', 'stop-audit-unverifiable', 'wait-checks', 'wait-merge',
  'stop-plan-mode', 'stop-branch', 'stop-merge-setup', 'stop-archive', 'blocked', 'stop-not-approved', 'archived', 'wait-dependencies',
]

test('2.1: every step of actorOf has a short label of at most four words in both languages; an unknown step falls back to its id', () => {
  for (const step of ACTOR_STEPS) expect(STEP_IDS, step).toContain(step)
  for (const lang of ['pt-BR', 'en'] as const) {
    const text = uiText(lang)
    for (const step of STEP_IDS) {
      const label = text.pane.step(step, 2)
      expect(label.trim().split(/\s+/).length, `${lang} ${step}: ${label}`).toBeLessThanOrEqual(4)
      expect(label, `${lang} ${step}`).not.toBe('')
    }
    expect(text.pane.step('brand-new-step', 2)).toBe('brand-new-step')
  }
  expect(uiText('en').pane.step('implement', 2)).toBe('implement phase 2')
  expect(uiText('pt-BR').pane.step('implement', 2)).toBe('implementar fase 2')
  expect(uiText('en').pane.step('gate', 3)).toBe('gate of phase 3')
  expect(uiText('pt-BR').pane.step('gate', 3)).toBe('gate da fase 3')
  expect(uiText('en').pane.step('stop-plan-approval')).toBe('approve the plan')
  expect(uiText('pt-BR').pane.step('wait-checks')).toBe('aguardando CI')
  expect(uiText('en').pane.step('implement')).toBe('implement phase')
})

test('2.1: the eight delivery item names are written in both languages', () => {
  expect(ITEM_NAMES).toEqual(['tasks', 'reviews', 'findings', 'acceptance', 'pr', 'checks', 'conversation', 'body'])
  for (const lang of ['pt-BR', 'en'] as const) for (const name of ITEM_NAMES) expect(uiText(lang).pane.item(name), `${lang} ${name}`).not.toBe('')
  expect(uiText('en').pane.item('mystery')).toBe('mystery')
  expect(uiText('en').pane.actor('owner')).toBe('you')
  expect(uiText('pt-BR').pane.actor('owner')).toBe('você')
})

// ---------------------------------------------------------------- detail.ts (design D21, D23)

const openItems = () => parseDeliver(DELIVER_OPEN_STDOUT)?.items ?? []
const itemById = (id: number) => {
  const found = openItems().find(i => i.id === id)
  if (found === undefined) throw new Error(`the fixture has no item ${id}`)
  return found
}
const pt = uiText('pt-BR')
const en = uiText('en')

test('AC-4 delivery-items: the gate commands of the captured report give short labels and no label holds $HOME', () => {
  const gates = itemById(1).details?.missingGates ?? []
  expect(gates).toHaveLength(8)
  expect(gates.map(commandLabel)).toEqual([
    'test panel (app)',
    'validate panel (app)',
    'validate panel (npm)',
    'validate . (npm)',
    'validate . (app)',
    'guard suite',
    'check.py',
    'gen-catalog.py --check',
  ])
  for (const gate of gates) expect(commandLabel(gate)).not.toContain('HOME')
  // the other shapes of D21
  expect(commandLabel('node plugins/openspec/hooks/deliver-check.mjs panel-conduct-view --json')).toBe('deliver-check panel-conduct-view --json')
  expect(commandLabel('python3 scripts/check.py')).toBe('check.py')
  expect(commandLabel('npx -y -p typescript@5.6.3 tsc -p /x/tsconfig.json')).toBe('tsc')
  expect(commandLabel('node --test plugins/openspec/hooks/guard.test.mjs')).toBe('guard suite')
})

test('AC-4 delivery-items: an unknown command keeps its first word and the next, cut to 28 cells', () => {
  expect(commandLabel('/usr/local/bin/make test')).toBe('make test')
  const label = commandLabel('./scripts/a-very-long-script-name-indeed another-very-long-argument')
  expect(label.length).toBeLessThanOrEqual(28)
  expect(label.endsWith('…')).toBe(true)
})

test('AC-4 delivery-items: item 1 has two parts that share no line: the tasks part is its unticked ids, the proofs part the evidence state and each gate without a proof', () => {
  const item = itemById(1)
  const tasks = itemLines(item, 'tasks')
  expect(tasks).toEqual(['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '5.1', '5.2', '5.9'].map(label => ({ label, word: 'open' })))
  const proofs = itemLines(item, 'proofs')
  expect(proofs).toHaveLength(9)
  expect(proofs[0]).toEqual({ label: 'evidence.md', word: 'missing' })
  expect(proofs.slice(1).every(l => l.word === 'noProof')).toBe(true)
  expect(proofs.slice(1).map(l => l.label)).toContain('test panel (app)')
  const labels = new Set(proofs.map(l => l.label))
  for (const line of tasks) expect(labels.has(line.label)).toBe(false)
  // without a part: both, tasks first
  expect(itemLines(item)).toHaveLength(21)
  expect(itemLines(item)[0]?.label).toBe('4.1')
  // the text in each language
  expect(pt.pane.word('open')).toBe('aberta')
  expect(en.pane.word('noProof')).toBe('no proof')
})

test('AC-4 delivery-items: a stale evidence file reads stale; a current one adds no line', () => {
  const base = { id: 1, name: 'tasks', status: 'open' as const }
  expect(itemLines({ ...base, details: { unticked: [], missingGates: [], evidence: 'stale' } }, 'proofs')).toEqual([{ label: 'evidence.md', word: 'stale' }])
  expect(itemLines({ ...base, details: { unticked: [], missingGates: [], evidence: 'current' } }, 'proofs')).toEqual([])
})

test('AC-4 delivery-items: the cap is eight lines, then +N; the summary counts per word', () => {
  const capped = capLines(itemLines(itemById(1), 'tasks'))
  expect(capped.lines).toHaveLength(8)
  expect(capped.more).toBe(4)
  expect(capLines(itemLines(itemById(1), 'proofs'))).toMatchObject({ more: 1 })
  expect(capLines([{ label: 'a' }]).more).toBe(0)
  expect(itemSummary(itemLines(itemById(1), 'tasks'), pt)).toBe('12 abertas')
  expect(itemSummary(itemLines(itemById(1), 'proofs'), pt)).toBe('1 ausente · 8 sem prova')
  expect(itemSummary(itemLines(itemById(1), 'proofs'), en)).toBe('1 missing · 8 no proof')
  expect(itemSummary([{ label: 'review-x', word: 'missing' }], pt)).toBe('review-x')
  expect(itemSummary([], pt)).toBe('')
  expect(itemSummary([{ label: 'a' }, { label: 'b' }], pt)).toBe('2 pendências')
})

test('AC-4 delivery-items: item 2 reads its reviewers, item 4 its criteria, item 6 its checks', () => {
  expect(itemLines(itemById(2))).toEqual([
    { label: 'code-quality-reviewer', word: 'missing' },
    { label: 'test-coverage-reviewer', word: 'missing' },
  ])
  const two = { id: 2, name: 'reviews', status: 'open' as const, details: { missing: ['a'], rejected: ['b'], stale: ['c'] } }
  expect(itemLines(two)).toEqual([{ label: 'a', word: 'missing' }, { label: 'b', word: 'rejected' }, { label: 'c', word: 'stale' }])
  const four = itemLines(itemById(4))
  expect(four[0]).toEqual({ label: 'evidence.md', word: 'missing' })
  expect(four).toHaveLength(22)
  const accept = { id: 4, name: 'acceptance', status: 'open' as const, details: { ids: ['AC-1', 'AC-2', 'AC-3'], missing: ['AC-1'], defects: ['AC-2'], noProof: ['AC-3'], evidence: 'current' } }
  expect(itemLines(accept)).toEqual([{ label: 'AC-1', word: 'noProof' }, { label: 'AC-2', word: 'failing' }, { label: 'AC-3', word: 'ownerWeighs' }])
  const checks = { id: 6, name: 'checks', status: 'open' as const, details: { failing: [{ name: 'build' }], pending: ['lint'] } }
  expect(itemLines(checks)).toEqual([{ label: 'build', word: 'failing' }, { label: 'lint', word: 'running' }])
})

test('AC-4 delivery-items: an item without details, or of another number, splits its reason on "; "', () => {
  const reason = { id: 5, name: 'pr', status: 'open' as const, reason: 'no pull request for this branch yet' }
  expect(itemLines(reason)).toEqual([{ label: 'no pull request for this branch yet' }])
  const many = { id: 7, name: 'conversation', status: 'open' as const, reason: 'a; b ; c' }
  expect(itemLines(many)).toEqual([{ label: 'a' }, { label: 'b' }, { label: 'c' }])
  expect(itemLines({ id: 7, name: 'conversation', status: 'met' })).toEqual([])
  // item 2 with no details at all falls back to its reason
  expect(itemLines({ id: 2, name: 'reviews', status: 'open', reason: 'missing x; stale y' })).toEqual([{ label: 'missing x' }, { label: 'stale y' }])
})

test('AC-4 delivery-items: the report parser reads details of every item, each field only with its expected type', () => {
  const report = parseDeliver(JSON.stringify({ version: 1, change: 'x', items: [{ id: 2, name: 'reviews', status: 'open', details: { missing: ['a', 3], rejected: 'no', stale: [], failing: [{ name: 'b' }, { x: 1 }], pending: ['c'], evidence: 7 } }] }))
  expect(report?.items[0]?.details).toEqual({ missing: ['a'], rejected: [], stale: [], failing: [{ name: 'b' }], pending: ['c'] })
})

test('AC-15 summary-and-documents: the summary is the Summary: line, else the first sentence of ## Why, else none, cut to 200 characters', () => {
  expect(summaryOf(PROPOSAL_TEXT)).toBe("The devkit pane shows the change this conversation conducts (what it is, where it stands in the flow, what is pending, its documents) and the other open changes, as the owner's approved mock draws it.")
  const why = '# Proposal\n\nChange: x\n\n## Why\n\nThe operator sees the settings\nof each device. A second sentence follows.\n\nAnother paragraph.\n\n## What Changes\n\n- a\n'
  expect(summaryOf(why)).toBe('The operator sees the settings of each device.')
  expect(summaryOf('# Proposal\n\n## Why\n\nOne sentence only\n\n## What Changes\n')).toBe('One sentence only')
  expect(summaryOf('# Proposal\n\nNothing here\n')).toBeUndefined()
  expect(summaryOf('')).toBeUndefined()
  // a Summary: after the first ## heading is not the summary line
  expect(summaryOf('# P\n\n## Why\n\nFirst. Second.\n\n## More\n\nSummary: late\n')).toBe('First.')
  const long = `Summary: ${'x'.repeat(300)}\n`
  expect(summaryOf(long)).toHaveLength(200)
})

// ---------------------------------------------------------------- steps.ts: readTasks (design D27)

test('AC-20 pending-list: the open ids and section titles of readTasks on tasks.md equal what deliver-check reports for the same file', () => {
  const read = readTasks(TASKS_TEXT)
  expect(read.sections.map(s => s.n)).toEqual(TASKS_PHASES.map(p => p.n))
  for (const phase of TASKS_PHASES) {
    const section = read.sections.find(s => s.n === phase.n)
    expect(section?.tasks.filter(t => !t.isGate && !t.done).map(t => t.id), `phase ${phase.n}`).toEqual(phase.open)
    const gate = section?.tasks.find(t => t.isGate)
    expect(gate === undefined ? null : { id: gate.id, done: gate.done }, `gate ${phase.n}`).toEqual(phase.gate)
    // the title is the heading's text, the checker's own reading
    expect(section?.title).toBe(phase.title)
  }
})

test('AC-20 pending-list: short titles are at most 40 cells and hold no backtick; a section short title drops its trailing parenthesis and is at most 32 cells', () => {
  const read = readTasks(TASKS_TEXT)
  const tasks = read.sections.flatMap(s => s.tasks)
  expect(tasks.length).toBeGreaterThan(25)
  for (const task of tasks) {
    expect(task.title.length, task.id).toBeLessThanOrEqual(40)
    expect(task.title, task.id).not.toContain('`')
    expect(task.title, task.id).not.toBe('')
  }
  for (const section of read.sections) {
    expect(section.short.length).toBeLessThanOrEqual(32)
    expect(section.short).not.toContain('(')
  }
  expect(read.sections.find(s => s.n === 4)?.short).toBe('The approved mock: what the cha…')
  expect(tasks.find(t => t.id === '4.5')?.title).toBe('The change\'s folder in the refresh')
  expect(tasks.find(t => t.id === '4.9')?.title).toBe('Gate: test panel (app)')
  expect(tasks.find(t => t.id === '4.9')?.isGate).toBe(true)
  // a task's text is its line and the lines under it, as written
  const task = tasks.find(t => t.id === '4.5')
  expect(task?.text.startsWith('- [ ] 4.5 The change')).toBe(true)
  expect(task?.text).toContain('summaryOf(proposalText)')
  expect(task?.text.endsWith('\n')).toBe(false)
  expect(task?.sentence.length).toBeLessThanOrEqual(120)
  expect(task?.sentence).not.toBe('')
  // the gate's title is its first command label, its sentence the other labels
  expect(tasks.find(t => t.id === '4.9')?.sentence).toContain('validate panel')
})

test('AC-20 pending-list: an owner-run task or section is tagged owner, a gate gate, the rest claude', () => {
  const tasks = readTasks(TASKS_TEXT).sections.flatMap(s => s.tasks)
  expect(tasks.find(t => t.id === '5.1')?.tag).toBe('owner')
  expect(tasks.find(t => t.id === '5.9')?.tag).toBe('gate')
  expect(tasks.find(t => t.id === '4.1')?.tag).toBe('claude')
  expect(pt.pane.tag('owner')).toBe('você')
  expect(readTasks('## 1. Plain\n\n- [ ] 1.1 Do it (owner-run, by hand)\n- [ ] 1.2 Other\n').sections[0]?.tasks.map(t => t.tag)).toEqual(['owner', 'claude'])
  // a file with no numbered section reads as one phase 1, as the checker does
  expect(readTasks('- [ ] 1.1 Loose\n').sections.map(s => s.n)).toEqual([1])
  expect(readTasks('').sections).toEqual([])
})

test('AC-2 phase-progress: the progress phrase of another change reads k de n tarefas, plano pronto · 0 de n, or the step label without a tasks.md', () => {
  const body = '## 1. A\n\n- [x] 1.1 One\n- [ ] 1.2 Two\n- [ ] 1.3 Three\n'
  const fresh = '## 1. A\n\n- [ ] 1.1 One\n- [ ] 1.2 Two\n'
  const row = (step: string, phase?: number): ChangeRow => ({ id: 'x', next: { step, actor: 'session', ...(phase !== undefined ? { phase } : {}) }, state: '' })
  expect(progressOf(row('implement', 1), readTasks(body), pt)).toBe('1 de 3 tarefas')
  expect(progressOf(row('wait-checks'), readTasks(body), pt)).toBe('1 de 3 tarefas · aguardando CI')
  expect(progressOf(row('stop-plan-approval'), readTasks(fresh), pt)).toBe('plano pronto · 0 de 2')
  expect(progressOf(row('implement', 1), readTasks(fresh), en)).toBe('plan ready · 0 of 2')
  expect(progressOf(row('readiness'), readTasks(fresh), pt)).toBe('0 de 2 tarefas · prontidão do plano')
  expect(progressOf(row('wait-dependencies'), undefined, pt)).toBe('aguardando dependências')
  expect(progressOf(row('brand-new'), undefined, pt)).toBe('brand-new')
})

// ---------------------------------------------------------------- steps.ts: the ten steps (design D22, D25)

const flowOf = (fx: FlowFixture, lang = pt) => {
  const row = parseRound(fx.rowStdout)?.changes[0]
  const deliver = parseDeliver(fx.deliverStdout)
  if (row === undefined || deliver === undefined) throw new Error('the fixture does not parse')
  return { row, deliver, flow: flowSteps(row, deliver, readTasks(fx.tasks), new Set(fx.files), lang, fx.approvedOn) }
}
const statusOf = (flow: ReturnType<typeof flowSteps>) => flow.steps.map(s => s.status)

test('AC-14 flow-steps-you-are-here: the planning row has Requirements and Plan done, Readiness current and the rest pending', () => {
  const { flow } = flowOf(PLANNING)
  expect(flow.steps.map(s => s.key)).toEqual(STEP_KEYS)
  expect(statusOf(flow)).toEqual(['done', 'done', 'current', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'])
  expect(flow.done).toBe(2)
  expect(flow.steps[1]?.fact).toBe('3 seções')
  expect(flow.steps[3]?.fact).toBeUndefined()
  expect(flow.steps[4]?.fact).toBeUndefined()
})

test('AC-14 flow-steps-you-are-here: the mid-implementation row has Requirements to Your approval done and Implementation current with k de n tarefas', () => {
  const { flow } = flowOf(MID_IMPLEMENTATION)
  expect(statusOf(flow)).toEqual(['done', 'done', 'done', 'done', 'current', 'pending', 'pending', 'pending', 'pending', 'pending'])
  expect(flow.done).toBe(4)
  const implementation = flow.steps[4]
  expect(implementation?.fact).toBe('4 de 9 tarefas')
  expect(implementation?.hasMore).toBe(true)
  expect(flow.steps[2]?.fact).toBe('aprovada')
  expect(flow.steps[3]?.fact).toBe('18 set')
  expect(flowOf(MID_IMPLEMENTATION, en).flow.steps[3]?.fact).toBe('Sep 18')
  expect(implementation?.items).toEqual([1])
})

test('AC-14 flow-steps-you-are-here, AC-3 pr-and-checks: the delivery row has Implementation to Proofs done and PR and checks current with PR #n and its checks word', () => {
  const { flow } = flowOf(DELIVERY)
  expect(statusOf(flow)).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'done', 'current', 'pending', 'pending'])
  const pr = flow.steps[7]
  expect(pr?.fact).toContain('PR #31 · rodando')
  expect(pr?.items).toEqual([5, 6, 7, 8])
  expect(flow.steps[6]?.fact).toBe('2 de 2 critérios')
  expect(flowOf(DELIVERY, en).flow.steps[7]?.fact).toContain('PR #31 · running')
})

test('AC-14 flow-steps-you-are-here: Implementation with an unticked task and Proofs with an unproven criterion are partly done once the flow is past them', () => {
  const { row, deliver } = flowOf(DELIVERY)
  const open = readTasks('## 1. A\n\n- [x] 1.1 One\n- [ ] 1.2 Two\n')
  expect(statusOf(flowSteps(row, deliver, open, new Set(DELIVERY.files), pt))[4]).toBe('partial')
  const unproven = { ...deliver, items: deliver.items.map(i => (i.id === 4 ? { ...i, details: { ids: ['AC-1', 'AC-2'], missing: ['AC-2'], evidence: 'current' } } : i)) }
  const steps = flowSteps(row, unproven, readTasks(DELIVERY.tasks), new Set(DELIVERY.files), pt).steps
  expect(steps[6]?.status).toBe('partial')
  expect(steps[6]?.fact).toBe('1 de 2 critérios')
})

test('AC-14 flow-steps-you-are-here: fix-review makes Review current; blocked with item 6 makes PR and checks current; fix-defect makes Proofs current', () => {
  const { row, deliver } = flowOf(DELIVERY)
  const files = new Set(DELIVERY.files)
  const tasks = readTasks(DELIVERY.tasks)
  const at = (r: ChangeRow, d = deliver) => flowSteps(r, d, tasks, files, pt).steps.findIndex(s => s.status === 'current')
  expect(at({ ...row, next: { ...row.next, step: 'fix-review' } })).toBe(5)
  expect(at({ ...row, next: { ...row.next, step: 'fix-defect' } })).toBe(6)
  expect(at({ ...row, next: { ...row.next, step: 'blocked', item: 6 } })).toBe(7)
  expect(at({ ...row, next: { ...row.next, step: 'blocked', item: 2 } })).toBe(5)
  expect(at({ ...row, next: { ...row.next, step: 'blocked', item: 4 } })).toBe(6)
  const blocked = flowSteps({ ...row, next: { ...row.next, step: 'blocked', item: 6 } }, deliver, tasks, files, pt)
  expect(blocked.steps[7]?.isError).toBe(true)
  expect(blocked.now.title).toBe('blocked')
})

test('AC-14 flow-steps-you-are-here: a change with no tasks.md has Implementation pending and no fact; stop-merge-setup falls back to the facts', () => {
  const { row, deliver } = flowOf(PLANNING)
  const none = flowSteps(row, deliver, undefined, new Set(['requirements.md', 'proposal.md']), pt)
  expect(none.steps[4]?.status).toBe('pending')
  expect(none.steps[4]?.fact).toBeUndefined()
  // stop-merge-setup is not in the table: the first step the facts leave unfinished is current, flagged
  const delivery = flowOf(DELIVERY)
  const stopped = flowSteps({ ...delivery.row, next: { ...delivery.row.next, step: 'stop-merge-setup' } }, delivery.deliver, readTasks(DELIVERY.tasks), new Set(DELIVERY.files), pt)
  const current = stopped.steps.findIndex(s => s.status === 'current')
  expect(stopped.steps[current]?.isError).toBe(true)
  expect(stopped.now.title).toBe('stop-merge-setup')
  // the planning steps by the files present
  const early = flowSteps({ ...row, next: { ...row.next, step: 'stop-branch' } }, undefined, undefined, new Set(['requirements.md']), pt)
  expect(early.steps.findIndex(s => s.status === 'current')).toBe(1)
})

test('AC-14 flow-steps-you-are-here: every step id of the i18n step table is placed, in a step of the ladder or in the short list of the not-in-the-table rule', () => {
  for (const step of STEP_IDS) {
    const placed = stepKeyOf(step) !== undefined || NOT_IN_TABLE.includes(step)
    expect(placed, step).toBe(true)
  }
  expect(NOT_IN_TABLE.slice().sort()).toEqual(['blocked', 'stop-branch', 'stop-merge-setup', 'stop-plan-mode'])
  expect(stepKeyOf('archive-pr-ready')).toBe('retro')
  expect(stepKeyOf('wait-dependencies')).toBe('implementation')
  expect(stepKeyOf('resolve-release-conflict')).toBe('pr')
  expect(stepKeyOf('brand-new-step')).toBeUndefined()
})

test('AC-14 flow-steps-you-are-here: each row is given its files as a literal set: Your approval reads 18 set / Sep 18 for the Date, aprovada / approved with no readable date, nothing without the file', () => {
  const { row, deliver } = flowOf(MID_IMPLEMENTATION)
  const tasks = readTasks(MID_IMPLEMENTATION.tasks)
  const all = new Set(MID_IMPLEMENTATION.files)
  const factOf = (files: Set<string>, date: string | undefined, text = pt) => flowSteps(row, deliver, tasks, files, text, date).steps[3]?.fact
  expect(factOf(all, '2026-09-18')).toBe('18 set')
  expect(factOf(all, '2026-09-18', en)).toBe('Sep 18')
  expect(factOf(all, undefined)).toBe('aprovada')
  expect(factOf(all, 'sometime')).toBe('aprovada')
  expect(factOf(all, undefined, en)).toBe('approved')
  expect(factOf(new Set(PLAN_ONLY), undefined)).toBeUndefined()
})
const PLAN_ONLY = ['requirements.md', 'proposal.md', 'design.md', 'tasks.md']

test('AC-19 now-box: the Now lines of implement are Implementar a fase n: <title>, Faltam k tarefas nesta fase. and Depois: the next three steps', () => {
  const { flow } = flowOf(MID_IMPLEMENTATION)
  expect(flow.now.title).toBe('Implementar a fase 2: The pane')
  expect(flow.now.left).toBe('Faltam 2 tarefas nesta fase.')
  expect(flow.now.then).toBe('Depois: revisão, provas, PR e checks.')
  const english = flowOf(MID_IMPLEMENTATION, en).flow.now
  expect(english.title).toBe('Implement phase 2: The pane')
  expect(english.left).toBe('2 tasks left in this phase.')
  expect(english.then).toBe('Then: review, proofs, PR and checks.')
  // a gate, and a delivery step: the items' summary
  const { row, deliver } = flowOf(MID_IMPLEMENTATION)
  const gate = flowSteps({ ...row, next: { ...row.next, step: 'gate' } }, deliver, readTasks(MID_IMPLEMENTATION.tasks), new Set(MID_IMPLEMENTATION.files), pt)
  expect(gate.now.title).toBe('Gate da fase 2')
  const delivery = flowOf(DELIVERY).flow.now
  expect(delivery.title).toBe('Aguardando CI')
  expect(delivery.left).toBe('build')
  expect(delivery.then).toBe('Depois: merge, retro e arquivo.')
  // nothing after the last step: no Depois line
  const { row: r2, deliver: d2 } = flowOf(DELIVERY)
  expect(flowSteps({ ...r2, next: { ...r2.next, step: 'archive' } }, d2, readTasks(DELIVERY.tasks), new Set(DELIVERY.files), pt).now.then).toBe('')
})

test('AC-18 owner-run-actor: a phase whose title holds owner-run gives the owner on implement and on gate; one without it keeps the checker\'s actor', () => {
  const { row, deliver } = flowOf(MID_IMPLEMENTATION)
  expect(actorOf(row, deliver)).toBe('session')
  const ownerRun = { ...deliver, phases: deliver.phases.map(p => (p.n === 2 ? { ...p, title: 'Live check, owner-run (AC-12)' } : p)) }
  expect(actorOf(row, ownerRun)).toBe('owner')
  expect(actorOf({ ...row, next: { ...row.next, step: 'gate', actor: 'gate' } }, ownerRun)).toBe('owner')
  // another step of the same phase, another phase, no report, and a word that only contains the marker
  expect(actorOf({ ...row, next: { ...row.next, step: 'review', actor: 'review' } }, ownerRun)).toBe('review')
  expect(actorOf({ ...row, next: { ...row.next, phase: 3 } }, ownerRun)).toBe('session')
  expect(actorOf(row, undefined)).toBe('session')
  expect(actorOf(row, { error: 'x' })).toBe('session')
  const lookalike = { ...deliver, phases: deliver.phases.map(p => (p.n === 2 ? { ...p, title: 'not-owner-runner' } : p)) }
  expect(actorOf(row, lookalike)).toBe('session')
})

// ---------------------------------------------------------------- a stored view of the previous shape (design D7)

test('D7 view-4: a stored view-3-shaped value (no docs, tasks, folder or progress on conducted) draws the pane, the text form and the band without throwing', () => {
  const old = {
    kind: 'report',
    checker: 'repo',
    conducted: { id: 'x', via: 'command', deliver: { error: 'old' } },
    changes: { x: { id: 'x', checkedAt: 1, source: 'folder', row: { id: 'x', next: { step: 'implement', actor: 'session', phase: 1 }, state: '', branch: 'x' } } },
    inProgress: ['y'],
    sessions: [],
    canOpen: false,
    refreshedAt: 1,
  } as unknown as PanelView
  const ctx = { now: 1000, isRefreshing: false, collapsed: {}, filled: null, columns: 80, isText: false, isPaneUp: true }
  for (const text of [pt, en]) {
    expect(() => buildItems(old, text, ctx)).not.toThrow()
    expect(() => renderText(old, text, 1000, false, 80)).not.toThrow()
    expect(() => bandLine(old, text, 80)).not.toThrow()
    expect(() => buildDetail(old, { kind: 'doc', file: 'design.md' }, text, { full: false, copied: false, copyFailed: false, docText: undefined, columns: 80 })).not.toThrow()
    expect(() => buildDetail(old, { kind: 'pending' }, text, { full: false, copied: false, copyFailed: false, docText: undefined, columns: 80 })).not.toThrow()
  }
  const noConducted = { kind: 'report', changes: {}, sessions: [], canOpen: false } as unknown as PanelView
  expect(() => buildItems(noConducted, pt, ctx)).not.toThrow()
  expect(() => bandLine(noConducted, pt, 80)).not.toThrow()
})
