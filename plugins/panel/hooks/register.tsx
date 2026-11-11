// devkit-panel: a read-only pane over the devkit checkers (design D6: one
// refresh at a time; D4: which checker runs; D7: the child sessions; D8: the
// owner buttons fill the prompt and never send; D9: the band, `/devkit-panel`
// and the `status` tool). Nothing here submits a prompt, starts a session,
// writes a file or keeps anything outside `$.state`.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DeliverReport, PanelView, RoundReport, SessionRow } from '../types'
import { isCreateStep } from './commands'
import { langOf, uiText } from './i18n'
import type { UiText } from './i18n'
import { renderBand, renderLines, renderPane, renderText } from './pane'
import { changeFolders, isDevkitProject, locateChecker } from './project'
import type { CheckerLocation } from './project'
import { READ_VERSION, checkerError, newerVersion, parseDeliver, parseRound } from './report'
import type { CheckerRun } from './report'
import { LIST, LIST_INPUT, childrenOf, mayList, parseSessionRows } from './sessions'

const PANE = 'devkit-panel'
const TIMEOUT_MS = 60_000
const REFRESH_MS = 60_000

const EMPTY: PanelView = { kind: 'not-devkit', others: [], archived: [], delivers: {}, sessions: {}, changeOption: 'unknown' }

// Change the tag when the view's fields change: it declines what an earlier version stored.
const view = atom({ plugin: 'devkit-panel', key: 'view' } as const, EMPTY, { shape: 'view-2' })
const collapsed = atom({ plugin: 'devkit-panel', key: 'collapsed' } as const, {})
const isRefreshing = atom({ plugin: 'devkit-panel', key: 'isRefreshing' } as const, false)

/** The refresh in flight, if any: a trigger during it is folded into it (AC-6). Reset by a reload. */
let inFlight: Promise<void> | undefined

/** A checker run, or why it could not run (a timeout, `node` missing). */
type Ran = { run: CheckerRun } | { failed: string }

/** The one line of a rejection: the error's message, or the value as text. */
const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const runChecker = async ($: EngineInterface, argv: readonly string[], cwd: string): Promise<Ran> => {
  try {
    return { run: await $.process.run(argv, { cwd, env: { DEVKIT_HOST: 'app' }, timeoutMs: TIMEOUT_MS }) }
  } catch (error) {
    return { failed: reasonOf(error) }
  }
}

const checkerScript = (checker: CheckerLocation, name: string): string => `${checker.dir}/${name}.mjs`

/** `conduct-check --json` in the root: the report, or the one error line (design D4; D5 for a newer JSON version). */
const roundReport = async ($: EngineInterface, checker: CheckerLocation, root: string): Promise<{ report: RoundReport } | { error: string }> => {
  const ran = await runChecker($, ['node', checkerScript(checker, 'conduct-check'), '--json'], root)
  if ('failed' in ran) return { error: ran.failed }
  const newer = newerVersion(ran.run.stdout, READ_VERSION.round)
  if (newer !== undefined) return { error: newer }
  const report = ran.run.exitCode === 0 ? parseRound(ran.run.stdout) : undefined
  return report === undefined ? { error: checkerError(ran.run) } : { report }
}

/** `deliver-check <id> --json` in the row's worktree when it exists, else the root; the report whatever the exit, or the error line. */
const deliverReport = async ($: EngineInterface, checker: CheckerLocation, root: string, id: string, worktree: string | undefined): Promise<DeliverReport | { error: string }> => {
  const cwd = worktree !== undefined && (await $.fs.exists(worktree)) ? worktree : root
  const ran = await runChecker($, ['node', checkerScript(checker, 'deliver-check'), id, '--json'], cwd)
  if ('failed' in ran) return { error: ran.failed }
  const newer = newerVersion(ran.run.stdout, READ_VERSION.deliver)
  if (newer !== undefined) return { error: newer }
  return parseDeliver(ran.run.stdout) ?? { error: checkerError(ran.run) }
}

/** The `--change <id>` probe (design D8): `yes` on exit 0, else `no` (the wording of the checker's error is not a contract). */
const probeChangeOption = async ($: EngineInterface, checker: CheckerLocation, root: string, id: string): Promise<'yes' | 'no'> => {
  const ran = await runChecker($, ['node', checkerScript(checker, 'conduct-check'), '--json', '--change', id], root)
  return 'run' in ran && ran.run.exitCode === 0 ? 'yes' : 'no'
}

/** The text of a tool's answer: `text` when the engine filled it, else a string `result`. */
const answerText = (answer: { text?: string; result?: unknown }): string | undefined =>
  typeof answer.text === 'string' ? answer.text : typeof answer.result === 'string' ? answer.result : undefined

/**
 * The linked child sessions by change id (design D7): read only when `mayList` allows (else the tool
 * to allow); a call the engine refuses (`{ deny }`), fails (`{ isError }`) or rejects is the error line.
 */
const loadSessions = async ($: EngineInterface, changes: readonly RoundReport['changes'][number][]): Promise<Pick<PanelView, 'sessions' | 'permission' | 'listError'>> => {
  if (!(await mayList($))) return { sessions: {}, permission: LIST }
  let answer: Awaited<ReturnType<EngineInterface['tool']['call']>>
  try {
    answer = await $.tool.call({ tool: LIST, ...LIST_INPUT })
  } catch (error) {
    return { sessions: {}, listError: reasonOf(error) }
  }
  if (answer.deny !== undefined) return { sessions: {}, listError: answer.deny }
  if (answer.isError === true) return { sessions: {}, listError: answerText(answer) ?? 'error' }
  const rows = parseSessionRows(answerText(answer))
  const sessions: Record<string, SessionRow[]> = {}
  for (const change of changes) sessions[change.id] = childrenOf(rows, change.sessionPrefix)
  return { sessions }
}

const isDevkitRoot = async ($: EngineInterface, root: string): Promise<boolean> => {
  const config = `${root}/openspec/config.yaml`
  return (await $.fs.exists(config)) && isDevkitProject(await $.fs.read(config))
}

/** One whole refresh (design D6): the root and opt-in, the round, the probe, the folders, the sessions, the expanded rows' delivers. */
const load = async ($: EngineInterface): Promise<void> => {
  const previous = await read($, view)
  const root = await $.session.root()
  if (!(await isDevkitRoot($, root))) {
    await update($, view, () => ({ ...EMPTY, changeOption: previous.changeOption }))
    return
  }
  const checker = await locateChecker($, root)
  if (checker === undefined) {
    await update($, view, () => ({ ...EMPTY, kind: 'no-checker', changeOption: previous.changeOption }))
    return
  }
  const round = await roundReport($, checker, root)
  const report = 'report' in round ? round.report : previous.kind === 'report' ? previous.report : undefined
  const reportAt = 'report' in round ? await $.clock.now() : previous.reportAt
  const changes = report?.changes ?? []
  // the probe needs a change the checker has found: single-change mode exits 3 on a change with no folder, which would read as `no`
  const probeId = changes.find(c => !isCreateStep(c.next.step))?.id
  const changeOption = previous.changeOption === 'unknown' && probeId !== undefined ? await probeChangeOption($, checker, root, probeId) : previous.changeOption
  const folders = await changeFolders($, root, changes.map(c => c.id))
  const sessions = await loadSessions($, changes)
  const open = await read($, collapsed)
  const delivers: PanelView['delivers'] = {}
  for (const change of changes) {
    if (open[change.id] === false) delivers[change.id] = await deliverReport($, checker, root, change.id, change.worktree)
  }
  const next: Omit<PanelView, 'delivers'> = {
    kind: 'report',
    checker: checker.label,
    ...(report !== undefined ? { report } : {}),
    ...(reportAt !== undefined ? { reportAt } : {}),
    ...('error' in round ? { error: round.error } : {}),
    ...folders,
    ...sessions,
    changeOption,
  }
  // a merge, not a replacement: a row the owner expanded during the run wrote its own deliver report meanwhile
  const stillOpen = await read($, collapsed)
  await update($, view, current => {
    const kept: PanelView['delivers'] = {}
    for (const [id, cached] of Object.entries(current.delivers)) {
      if (stillOpen[id] === false && delivers[id] === undefined) kept[id] = cached
    }
    return { ...next, delivers: { ...kept, ...delivers } }
  })
}

/** Refreshes the view, one run at a time: a trigger during a run gets that run's promise (AC-6). */
const refresh = ($: EngineInterface): Promise<void> => {
  if (inFlight !== undefined) return inFlight
  const run = (async () => {
    await update($, isRefreshing, () => true)
    try {
      await load($)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await update($, view, current => ({ ...current, error: message }))
    } finally {
      await update($, isRefreshing, () => false)
    }
  })()
  inFlight = run
  const free = (): void => {
    if (inFlight === run) inFlight = undefined
  }
  run.then(free, free)
  return run
}

/** Folds or unfolds a row or group; unfolding a change row runs its deliver check at once when none is cached. */
const toggle = async ($: EngineInterface, id: string): Promise<void> => {
  const next = await update($, collapsed, current => ({ ...current, [id]: !(current[id] ?? true) }))
  if (next[id] !== false) return
  const current = await read($, view)
  if (current.kind !== 'report' || current.delivers[id] !== undefined) return
  const row = current.report?.changes.find(c => c.id === id)
  if (row === undefined) return
  const root = await $.session.root()
  const checker = await locateChecker($, root)
  if (checker === undefined) return
  const result = await deliverReport($, checker, root, id, row.worktree)
  await update($, view, v => ({ ...v, delivers: { ...v.delivers, [id]: result } }))
}

/** Puts an owner text in the prompt box; toasts it where no box could take it (design D8). Never sends. */
const fill = async ($: EngineInterface, text: string): Promise<void> => {
  const filled = await $.prompt.fill({ text, mode: 'replace' })
  if (!filled.isFilled) $.ui.toast(text)
}

const isPaneUp = async ($: EngineInterface): Promise<boolean> => (await $.ui.panes()).some(pane => pane.id === PANE)

/** The timer's tick: a refresh only while the pane is open. */
const tick = async ($: EngineInterface): Promise<void> => {
  if (await isPaneUp($)) await refresh($)
}

/** `/devkit-panel` and the band's button: close the pane when it is up, else open it (first, so it shows `refreshing...`) and refresh. */
const togglePane = async ($: EngineInterface, text: UiText): Promise<'opened' | 'closed' | 'waiting'> => {
  if (await isPaneUp($)) {
    await $.ui.close({ id: PANE })
    return 'closed'
  }
  const opened = await $.ui.open({ id: PANE, title: text.pane.title })
  void refresh($)
  return opened.isPlaced ? 'opened' : 'waiting'
}

/** The pane as plain lines, for the `status` command and tool: the same view the pane draws. */
const statusText = async ($: EngineInterface, text: UiText): Promise<string> => {
  const [current, folds, busy, now] = await Promise.all([read($, view), read($, collapsed), read($, isRefreshing), $.clock.now()])
  return renderText(current, folds, text, now, busy)
}

export const register: Register = (on, options) => {
  const text = uiText(langOf(options))

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'devkit-panel', description: 'Toggle the devkit panel (status: print it as text)', argumentHint: '[status]' })
    await $.tool.register({
      name: 'status',
      description: 'The devkit panel as text: the round, every change with its next step and state, the child sessions. Read-only.',
    })
    $.clock.every(REFRESH_MS, () => {
      void tick($)
    })
    // a hot reload resets `inFlight` but keeps the state: nothing is in flight now
    await update($, isRefreshing, () => false)
    void refresh($)
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) void refresh($)
    return next(e)
  })

  // `/devkit-panel` toggles the pane; `/devkit-panel status` prints it. A hook that fails hands the command on.
  on('command.run', { command: 'devkit-panel' }, async ($, e) => {
    if (e.args.trim() === 'status') return { text: await statusText($, text) }
    return { text: text.command[await togglePane($, text)] }
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // the model's (and a headless owner's) view: the same text, after a refresh. A hook that fails names itself.
  on('tool.call', { tool: 'mcp__devkit-panel__status' }, async $ => {
    await refresh($)
    return { result: await statusText($, text) }
  }).catch(($, e, next) => (next.called ? undefined : { deny: `${$.plugin.name}: status failed: ${next.error.message ?? next.error.kind}` }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const [current, folds, busy, now] = await Promise.all([read($, view), read($, collapsed), read($, isRefreshing), $.clock.now()])
    const lines = renderLines(current, folds, text, now, busy)
    const actions = {
      refresh: () => void refresh($),
      toggle: (id: string) => void toggle($, id),
      fill: (owner: string) => void fill($, owner),
    }
    return renderPane({ Box, Text, Button }, lines, text, actions, e.props.bodyColumns)
  })

  // the band: the engine's under a survey, outside a devkit project or before any report (design D9)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const current = await read($, view)
    if (current.kind !== 'report' || current.report === undefined) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const onToggle = (): void => {
      void togglePane($, text).catch(() => $.ui.toast(text.toast.paneFailed))
    }
    return renderBand({ Box, Text, Button }, current.report, await isPaneUp($), text, e.props.bodyColumns, onToggle)
  })
}
