// devkit-panel: a read-only pane over the devkit checkers (design D3: the change this
// session conducts; D4: the changes in progress; D5: one refresh at a time and what it
// costs; D9: the child sessions; D11: the band, `/devkit-panel` and the `status` tool).
// Nothing here submits a prompt, starts a session, writes a file or keeps anything
// outside `$.state`.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { ChangeEntry, ChangeRow, Conducted, DeliverReport, DetailSubject, PanelView, SessionRow } from '../types'
import { conductArgs, conductedId } from './conducted'
import type { Msg } from './conducted'
import { langOf, uiText } from './i18n'
import type { UiText } from './i18n'
import { buildDetail, buildItems, detailTitle, foldedNow, renderBand, renderDetail, renderPane, renderText, withDefaults } from './pane'
import type { Ctx, DetailCtx } from './pane'
import type { OwnerButton } from './commands'
import { summaryOf } from './detail'
import { candidates, checkerVersionOk, isDevkitProject, locateChecker, parseWorktrees, projectAbove } from './project'
import type { CheckerLocation, Worktree } from './project'
import { READ_VERSION, checkerError, isRateLimited, newerVersion, parseDeliver, parseRound } from './report'
import type { CheckerRun } from './report'
import { LIST, LIST_INPUT, OPEN, callAppTool, isListed, mayList, ownChildren, parseSessionRows } from './sessions'
import { countTasks, readTasks } from './steps'

const PANE = 'devkit-panel'
/** The detail pane: one id, retitled by every press (design D20). */
const DETAIL = 'devkit-panel-detail'
const TIMEOUT_MS = 60_000
const GIT_TIMEOUT_MS = 10_000
const REFRESH_MS = 60_000
/** A change that is not the conducted one is asked about again after this long, on a light trigger with the pane open (design D5). */
const FRESH_MS = 5 * 60_000
/** A rate-limited `gh` pauses the checks for a quarter of GitHub's hourly window (design D5). */
const BACKOFF_MS = 15 * 60_000
const MAX_PARALLEL = 3

const EMPTY: PanelView = { kind: 'not-devkit', changes: {}, progress: {}, inProgress: [], sessions: [], canOpen: false }

// Change the tag when the view's fields change: it declines what an earlier version stored.
const view = atom({ plugin: 'devkit-panel', key: 'view' } as const, EMPTY, { shape: 'view-4' })
const isRefreshing = atom({ plugin: 'devkit-panel', key: 'isRefreshing' } as const, false)
/** The fold marks the owner set: `true` is folded; a key with no mark takes its default (design D7). */
const collapsed = atom({ plugin: 'devkit-panel', key: 'collapsed' } as const, {} as Record<string, boolean>)
/** The owner button whose text sits in the prompt box (design D10). */
const filled = atom({ plugin: 'devkit-panel', key: 'filled' } as const, null as { key: string; text: string } | null)
/** What the detail pane shows and its marks (design D20): the fold of its full text, and how the last `Copiar` went. */
type DetailState = { subject: DetailSubject; full: boolean; copied: boolean; copyFailed?: boolean }
const detail = atom({ plugin: 'devkit-panel', key: 'detail' } as const, null as DetailState | null, { shape: 'detail-1' })

/** Session start, the pane opening and `Refresh` are full; the timer and the end of a turn are light (design D5). */
type Trigger = 'full' | 'light'

/** The refresh in flight, if any, and the one full run queued behind a light one. Reset by a reload. */
let inFlight: { promise: Promise<void>; trigger: Trigger } | undefined
let queuedFull: Promise<void> | undefined

/** A checker run, or why it could not run (a timeout, `node` missing). */
type Ran = { run: CheckerRun } | { failed: string }

/** The one line of a rejection: the error's message, or the value as text. */
const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const runProcess = async ($: EngineInterface, argv: readonly string[], cwd: string, timeoutMs: number, env?: Record<string, string>): Promise<Ran> => {
  try {
    return { run: await $.process.run(argv, { cwd, ...(env === undefined ? {} : { env }), timeoutMs }) }
  } catch (error) {
    return { failed: reasonOf(error) }
  }
}

const runChecker = ($: EngineInterface, argv: readonly string[], cwd: string): Promise<Ran> => runProcess($, argv, cwd, TIMEOUT_MS, { DEVKIT_HOST: 'app' })

const checkerScript = (checker: CheckerLocation, name: string): string => `${checker.dir}/${name}.mjs`

/** A change to ask the checker about: its id, and where the id came from. */
type Candidate = { id: string; source: ChangeEntry['source'] }

/** What one `conduct-check --change` run made of an entry, and whether it hit a rate limit (design D5). */
type Fetched = { entry: ChangeEntry; limited: boolean }

/**
 * `conduct-check --json --change <id>` in the root (design D4): exit 0 is a row, or a dropped entry for an archived
 * change; exit 3 on a branch-only candidate is a dropped entry (not a change); any other failure sets the entry's
 * `error` and keeps its last good row, so its `sessionPrefix` stays readable for D3.
 */
const fetchEntry = async ($: EngineInterface, checker: CheckerLocation, root: string, candidate: Candidate, prior: ChangeEntry | undefined, now: number): Promise<Fetched> => {
  const base = { id: candidate.id, source: candidate.source, checkedAt: now }
  const kept = prior?.row !== undefined ? { row: prior.row } : {}
  const failed = (error: string): Fetched => ({ entry: { ...base, ...kept, error }, limited: isRateLimited(error) })
  const ran = await runChecker($, ['node', checkerScript(checker, 'conduct-check'), '--json', '--change', candidate.id], root)
  if ('failed' in ran) return failed(ran.failed)
  const newer = newerVersion(ran.run.stdout, READ_VERSION.round)
  if (newer !== undefined) return failed(newer)
  const report = ran.run.exitCode === 0 ? parseRound(ran.run.stdout) : undefined
  const row: ChangeRow | undefined = report?.changes.find(c => c.id === candidate.id) ?? report?.changes[0]
  if (row !== undefined) return { entry: { ...base, row, ...(row.next.step === 'archived' ? { dropped: 'archived' as const } : {}) }, limited: false }
  const error = checkerError(ran.run)
  const limited = isRateLimited(error) || isRateLimited(ran.run.stderr)
  if (ran.run.exitCode === 3 && candidate.source === 'branch' && !limited) return { entry: { ...base, dropped: 'not-a-change' }, limited: false }
  return { entry: { ...base, ...kept, error }, limited }
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

/** Whether a deliver report, or its error line, says `gh` is rate limited (an item's reason, design D5). */
const deliverLimited = (report: DeliverReport | { error: string }): boolean =>
  'error' in report ? isRateLimited(report.error) : report.items.some(i => i.reason !== undefined && isRateLimited(i.reason))

/** The text of a tool's answer: `text` when the engine filled it, else a string `result`. */
const answerText = (answer: { text?: string; result?: unknown }): string | undefined =>
  typeof answer.text === 'string' ? answer.text : typeof answer.result === 'string' ? answer.result : undefined

type Family = { rows: SessionRow[]; canOpen: boolean; permission?: string; listError?: string }

/**
 * The linked family (design D3, D9): read only when `mayList` allows (else the tool to allow); a call the engine
 * refuses (`{ deny }`), fails (`{ isError }`) or rejects is the error line. `canOpen` is a name check on `open_session_in`.
 */
const loadFamily = async ($: EngineInterface): Promise<Family> => {
  const canOpen = await isListed($, OPEN)
  if (!(await mayList($))) return { rows: [], canOpen, permission: LIST }
  let answer: Awaited<ReturnType<typeof callAppTool>>
  try {
    answer = await callAppTool($, LIST, LIST_INPUT)
  } catch (error) {
    return { rows: [], canOpen, listError: reasonOf(error) }
  }
  if (answer.deny !== undefined) return { rows: [], canOpen, listError: answer.deny }
  if (answer.isError === true) return { rows: [], canOpen, listError: answerText(answer) ?? 'error' }
  return { rows: parseSessionRows(answerText(answer)), canOpen }
}

const isDevkitRoot = async ($: EngineInterface, root: string): Promise<boolean> => {
  const config = `${root}/openspec/config.yaml`
  return (await $.fs.exists(config)) && isDevkitProject(await $.fs.read(config))
}

/** This session's transcript, or nothing when it cannot be read. */
const transcript = async ($: EngineInterface): Promise<readonly Msg[]> => {
  try {
    return await $.session.messages()
  } catch {
    return []
  }
}

/** `git worktree list --porcelain` in the root (design D4): the checkouts, or none and the error line. */
const listWorktrees = async ($: EngineInterface, root: string): Promise<{ worktrees: Worktree[]; error?: string }> => {
  const ran = await runProcess($, ['git', '-C', root, 'worktree', 'list', '--porcelain'], root, GIT_TIMEOUT_MS)
  if ('failed' in ran) return { worktrees: [], error: `git worktree list: ${ran.failed}` }
  if (ran.run.exitCode !== 0) return { worktrees: [], error: `git worktree list: ${checkerError(ran.run)}` }
  return { worktrees: parseWorktrees(ran.run.stdout) }
}

/** Runs `fn` over `items`, at most `size` at once; the answers in the items' order. */
const pool = async <T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = []
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const at = next++
      out[at] = await fn(items[at] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

/** Who acts first: the owner, stopped, Claude, GitHub, then waiting (design D4). */
const ACTOR_ORDER: readonly (readonly string[])[] = [['owner'], ['stop'], ['session', 'subagent', 'review', 'gate', 'main'], ['github']]
const groupOf = (entry: ChangeEntry): number => {
  if (entry.row === undefined) return 1
  const at = ACTOR_ORDER.findIndex(group => group.includes(entry.row?.next.actor ?? ''))
  return at === -1 ? ACTOR_ORDER.length : at
}

/** The changes in progress, ordered by who acts, then by id; dropped entries and the conducted id are out. */
const inProgressOf = (entries: Record<string, ChangeEntry>, ids: readonly string[], conducted: string | undefined): string[] =>
  ids
    .map(id => entries[id])
    .filter((entry): entry is ChangeEntry => entry !== undefined && entry.dropped === undefined && entry.id !== conducted)
    .sort((a, b) => groupOf(a) - groupOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(entry => entry.id)

/** The change folder's facts the pane draws (design D23, D27): read-only, no checker run. */
type FolderFacts = { docs: Conducted['docs']; summary?: string; approvedOn?: string; tasks?: ReturnType<typeof readTasks> }

/** The files the pane can show, in the tab order (design D23); `specs` stands for the folder of every `specs/<capability>/spec.md`. */
const DOC_FILES = ['requirements.md', 'proposal.md', 'design.md', 'tasks.md', 'specs', 'readiness.md', 'approval.md', 'evidence.md', 'retro.md'] as const
const APPROVAL_DATE_RE = /^\s*[-*]?\s*Date:\s*(\d{4}-\d{2}-\d{2})/m

/** A file's text, or nothing when it cannot be read. */
const readText = async ($: EngineInterface, path: string): Promise<string | undefined> => {
  try {
    return await $.fs.read(path)
  } catch {
    return undefined
  }
}

/** `<worktree>/openspec/changes/<id>` when that worktree exists, else `<root>/openspec/changes/<id>` (design D23). */
const folderOf = async ($: EngineInterface, root: string, id: string, worktree: string | undefined): Promise<string> =>
  worktree !== undefined && (await $.fs.exists(worktree)) ? `${worktree}/openspec/changes/${id}` : `${root}/openspec/changes/${id}`

/** The conducted change's documents that exist, its summary, the approval date and its tasks (design D23): one existence check per file, one list of `specs/`, three reads. */
const readFolder = async ($: EngineInterface, folder: string): Promise<FolderFacts> => {
  const docs: Conducted['docs'] = []
  for (const file of DOC_FILES) {
    if (file === 'specs') {
      try {
        if ((await $.fs.list(`${folder}/specs`)).some(entry => entry.kind === 'dir')) docs.push({ file, path: `${folder}/specs` })
      } catch {
        // no specs folder: no Specs link
      }
    } else if (await $.fs.exists(`${folder}/${file}`)) {
      docs.push({ file, path: `${folder}/${file}` })
    }
  }
  const has = (file: string): boolean => docs.some(d => d.file === file)
  const proposal = has('proposal.md') ? await readText($, `${folder}/proposal.md`) : undefined
  const approval = has('approval.md') ? await readText($, `${folder}/approval.md`) : undefined
  const tasks = has('tasks.md') ? await readText($, `${folder}/tasks.md`) : undefined
  const summary = proposal === undefined ? undefined : summaryOf(proposal)
  const approvedOn = approval === undefined ? undefined : APPROVAL_DATE_RE.exec(approval)?.[1]
  return { docs, ...(summary !== undefined ? { summary } : {}), ...(approvedOn !== undefined ? { approvedOn } : {}), ...(tasks !== undefined ? { tasks: readTasks(tasks) } : {}) }
}

/** The tasks' progress of the changes in progress, from the folder each came from (design D27). */
const readProgress = async ($: EngineInterface, root: string, entries: Record<string, ChangeEntry>, ids: readonly string[]): Promise<PanelView['progress']> => {
  const out: PanelView['progress'] = {}
  for (const id of ids) {
    const row = entries[id]?.row
    if (row === undefined) continue
    const text = await readText($, `${await folderOf($, root, id, row.worktree)}/tasks.md`)
    if (text === undefined) continue
    const { done, total } = countTasks(readTasks(text))
    out[id] = { done, total }
  }
  return out
}

/**
 * One whole refresh (design D3 to D5): the root and opt-in, the checker and its version, `git worktree list`, the
 * candidates, the transcript and `list_sessions`; the candidates with no stored entry; the conducted change; its two
 * checkers; the other changes (every one on a full trigger, the stale ones on a light trigger with the pane open).
 */
const load = async ($: EngineInterface, trigger: Trigger): Promise<void> => {
  const previous = await read($, view)
  const root = await $.session.root()
  if (!(await isDevkitRoot($, root))) {
    await update($, view, () => EMPTY)
    return
  }
  const checker = await locateChecker($, root)
  if (checker === undefined) {
    await update($, view, (): PanelView => ({ ...EMPTY, kind: 'no-checker' }))
    return
  }
  if (checkerVersionOk(checker.label) === 'old-checker') {
    await update($, view, (): PanelView => ({ ...EMPTY, kind: 'old-checker', checker: checker.label }))
    return
  }
  const before = previous.kind === 'report' ? withDefaults(previous) : undefined
  const started = await $.clock.now()
  const isBackoff = (before?.backoffUntil ?? 0) > started
  const paneUp = await isPaneUp($)

  const { worktrees, error } = await listWorktrees($, root)
  const candidateList: Candidate[] = await candidates($, root, worktrees)
  const args = conductArgs(await transcript($))
  if (args !== undefined && !candidateList.some(c => c.id === args)) candidateList.push({ id: args, source: 'command' })
  const family = await loadFamily($)

  const entries: Record<string, ChangeEntry> = {}
  for (const c of candidateList) {
    const stored = before?.changes[c.id]
    if (stored !== undefined) entries[c.id] = stored
  }
  const fetched = new Set<string>()
  let isFetchFailed = false
  let isLimited = false
  const fetchOne = async (c: Candidate): Promise<void> => {
    const result = await fetchEntry($, checker, root, c, entries[c.id], await $.clock.now())
    entries[c.id] = result.entry
    fetched.add(c.id)
    if (result.entry.error !== undefined) isFetchFailed = true
    if (result.limited) isLimited = true
  }

  // a candidate with no stored entry is asked once, on any trigger, so the children can find its change
  if (!isBackoff) await pool(candidateList.filter(c => entries[c.id] === undefined), MAX_PARALLEL, fetchOne)

  const found = conductedId(args, ownChildren(family.rows), entries, before?.conducted, isFetchFailed || family.listError !== undefined)
  let conducted: Conducted | undefined
  if (found !== undefined) {
    const candidate = candidateList.find(c => c.id === found.id)
    const runsNow = !(isBackoff && trigger === 'light')
    let deliver: Conducted['deliver'] = before?.conducted?.id === found.id ? before.conducted.deliver : undefined
    if (runsNow) {
      if (candidate !== undefined && !fetched.has(found.id)) await fetchOne(candidate)
      const row = entries[found.id]?.row
      if (row !== undefined) {
        deliver = await deliverReport($, checker, root, found.id, row.worktree)
        if (deliverLimited(deliver)) isLimited = true
      }
    }
    const folder = await folderOf($, root, found.id, entries[found.id]?.row?.worktree)
    conducted = entries[found.id]?.dropped === 'archived' ? undefined : { ...found, ...(deliver !== undefined ? { deliver } : {}), folder, ...(await readFolder($, folder)) }
  }

  // the other changes: not during a back-off, every one on a full trigger, the stale ones with the pane open on a light one
  if (!isBackoff) {
    const others = candidateList.filter(c => !fetched.has(c.id) && c.id !== found?.id)
    const due = trigger === 'full' ? others : paneUp ? others.filter(c => entries[c.id]?.dropped === undefined && started - (entries[c.id]?.checkedAt ?? 0) >= FRESH_MS) : []
    await pool(due, MAX_PARALLEL, fetchOne)
  }

  const finished = await $.clock.now()
  const inProgress = inProgressOf(entries, candidateList.map(c => c.id), conducted?.id)
  const progress = await readProgress($, root, entries, inProgress)
  const repo = (worktrees[0]?.path ?? projectAbove(root)).split('/').filter(p => p !== '').pop() ?? ''
  const backoffUntil = isLimited ? finished + BACKOFF_MS : isBackoff ? before?.backoffUntil : undefined
  await update($, view, (): PanelView => ({
    kind: 'report',
    checker: checker.label,
    repo,
    ...(conducted !== undefined ? { conducted } : {}),
    changes: entries,
    progress,
    inProgress,
    sessions: family.rows,
    canOpen: family.canOpen,
    ...(family.permission !== undefined ? { permission: family.permission } : {}),
    ...(family.listError !== undefined ? { listError: family.listError } : {}),
    ...(error !== undefined ? { error } : {}),
    refreshedAt: finished,
    nextAt: finished + REFRESH_MS,
    ...(backoffUntil !== undefined ? { backoffUntil } : {}),
  }))
}

/** Clears the filled mark when the prompt box no longer holds the filled text: the owner cleared or edited it (design D10). */
const clearFilledIfChanged = async ($: EngineInterface): Promise<void> => {
  const mark = await read($, filled)
  if (mark === null) return
  try {
    if ((await $.prompt.read()).text !== mark.text) await update($, filled, () => null)
  } catch {
    // a prompt that cannot be read keeps the mark until the next turn ends
  }
}

/** Runs one refresh now: the in-flight flag around `load`, a failure kept as the view's error line. */
const runRefresh = async ($: EngineInterface, trigger: Trigger): Promise<void> => {
  await update($, isRefreshing, () => true)
  try {
    await load($, trigger)
    await clearFilledIfChanged($)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await update($, view, current => ({ ...current, error: message }))
  } finally {
    await update($, isRefreshing, () => false)
  }
}

/**
 * Refreshes the view, one run at a time (design D5): a trigger during a run gets that run's promise, except that a full
 * trigger during a light run queues one full run behind it.
 */
const refresh = ($: EngineInterface, trigger: Trigger): Promise<void> => {
  if (inFlight !== undefined) {
    if (trigger === 'light' || inFlight.trigger === 'full') return inFlight.promise
    if (queuedFull === undefined) {
      const after = inFlight.promise
      const queued = after.then(() => runAs($, 'full'), () => runAs($, 'full'))
      queuedFull = queued
      const clear = (): void => {
        if (queuedFull === queued) queuedFull = undefined
      }
      queued.then(clear, clear)
    }
    return queuedFull
  }
  return runAs($, trigger)
}

/** Starts a run as the one in flight. */
const runAs = ($: EngineInterface, trigger: Trigger): Promise<void> => {
  const promise = runRefresh($, trigger)
  const mine = { promise, trigger }
  inFlight = mine
  const free = (): void => {
    if (inFlight === mine) inFlight = undefined
  }
  promise.then(free, free)
  return promise
}

const isPaneUp = async ($: EngineInterface): Promise<boolean> => (await $.ui.panes()).some(pane => pane.id === PANE)

/** The timer's tick: a light refresh, only while the pane is open. */
const tick = async ($: EngineInterface): Promise<void> => {
  if (await isPaneUp($)) await refresh($, 'light')
}

/** `/devkit-panel` and the band's button: close the pane when it is up, else open it (first, so it shows `refreshing...`) and refresh. */
const togglePane = async ($: EngineInterface, text: UiText): Promise<'opened' | 'closed' | 'waiting'> => {
  if (await isPaneUp($)) {
    await $.ui.close({ id: PANE })
    await closeDetail($)
    return 'closed'
  }
  const opened = await $.ui.open({ id: PANE, title: text.pane.title })
  void refresh($, 'full')
  return opened.isPlaced ? 'opened' : 'waiting'
}

/** The pane as plain lines, for the `status` command and tool: the same view the pane draws, with `via`. */
const statusText = async ($: EngineInterface, text: UiText, columns?: number): Promise<string> => {
  const [current, busy, now] = await Promise.all([read($, view), read($, isRefreshing), $.clock.now()])
  return renderText(current, text, now, busy, columns)
}

/** Folds or unfolds a group or row: the owner's mark replaces the default (design D7). */
const toggleFold = async ($: EngineInterface, key: string): Promise<void> => {
  const current = await read($, view)
  const isConducted = current.conducted !== undefined
  await update($, collapsed, marks => ({ ...marks, [key]: !foldedNow(marks, key, isConducted) }))
}

/** Whether the prompt box holds exactly this text; a box that cannot be read does not. */
const standsInPrompt = async ($: EngineInterface, text: string): Promise<boolean> => {
  try {
    return (await $.prompt.read()).text === text
  } catch {
    return false
  }
}

/**
 * Puts an owner text in the prompt box and marks the button (design D10). Never sends: `prompt.fill` with `replace`. Where no
 * box could take it, the command itself is toasted and no mark is set. A press inside the detail pane closes it first: a pane
 * opened with `holdToasts` holds every toast while it is shown.
 */
const fill = async ($: EngineInterface, text: UiText, button: OwnerButton, isFromDetail = false): Promise<void> => {
  // an Enter that lands on the pressed button (the keys stay on the pane) must not fill or toast twice
  const mark = await read($, filled)
  if (mark !== null && mark.key === button.key && (await standsInPrompt($, mark.text))) return
  const placed = await $.prompt.fill({ text: button.text, mode: 'replace' })
  if (!placed.isFilled) {
    if (isFromDetail) await closeDetail($)
    $.ui.toast(button.text)
    return
  }
  await update($, filled, () => ({ key: button.key, text: button.text }))
  if (isFromDetail) await closeDetail($)
  $.ui.toast(text.toast.filled)
}

// ---------------------------------------------------------------- the detail pane (design D20)

/** Whether one of this plugin's panes is open. */
const isUp = async ($: EngineInterface, id: string): Promise<boolean> => (await $.ui.panes()).some(pane => pane.id === id)

/** Closes the detail pane when it is open; its `ui.close` observer clears the subject. */
const closeDetail = async ($: EngineInterface): Promise<void> => {
  if (await isUp($, DETAIL)) await $.ui.close({ id: DETAIL })
  else await update($, detail, () => null)
}

/**
 * Opens the detail pane on a subject, or changes its subject in place, on the owner's press only (design D20): the same id, retitled
 * by the open. Where no surface places it, the pane is closed again, the subject cleared and the row's one line is toasted.
 */
const openDetail = async ($: EngineInterface, text: UiText, subject: DetailSubject): Promise<void> => {
  const current = await read($, view)
  await update($, detail, () => ({ subject, full: false, copied: false }))
  const opened = await $.ui.open({ id: DETAIL, title: detailTitle(current, subject, text), focus: true, closeOnEscape: true, holdToasts: true })
  if (opened.isPlaced) return
  await $.ui.close({ id: DETAIL })
  await update($, detail, () => null)
  const summary = buildDetail(current, subject, text, { full: false, copied: false, copyFailed: false, docText: undefined, columns: 80 })
  $.ui.toast([summary.title, summary.subtitle].filter(p => p !== '').join(' · '))
}

/** A document's text for the detail pane: one file, or every `specs/<capability>/spec.md` under a `## <capability>` heading; undefined when unreadable. */
const readDoc = async ($: EngineInterface, current: PanelView, file: string): Promise<string | undefined> => {
  const doc = current.conducted?.docs.find(d => d.file === file)
  if (doc === undefined) return undefined
  if (file !== 'specs') return readText($, doc.path)
  try {
    const dirs = (await $.fs.list(doc.path)).filter(entry => entry.kind === 'dir').map(entry => entry.name).sort()
    const parts: string[] = []
    for (const name of dirs) parts.push(`## ${name}\n\n${(await readText($, `${doc.path}/${name}/spec.md`)) ?? ''}`)
    return parts.join('\n\n')
  } catch {
    return undefined
  }
}

/** The fold of the detail's full text. */
const toggleFull = async ($: EngineInterface): Promise<void> => {
  await update($, detail, state => (state === null ? state : { ...state, full: !state.full }))
}

/** `Copiar`: the text goes to the clipboard of the surface the press came from; the label reads the answer (design D20). */
const copyText = async ($: EngineInterface, textToCopy: string, surface: RenderSurface): Promise<void> => {
  const answer = await $.ui.copy({ text: textToCopy, surface })
  await update($, detail, state => (state === null ? state : { ...state, copied: answer.isCopied, copyFailed: !answer.isCopied }))
}

/** A section index press: the pane's own scroll moves to the section (design D20, screen 5). */
const scrollTo = async ($: EngineInterface, key: string): Promise<void> => {
  await $.ui.scroll({ to: { key }, in: DETAIL, block: 'start' })
}

/**
 * Shows a child session beside this one, on the owner's press only (design D9): `open_session_in` with `split`, once more with
 * `window` when the app answers an error. The tool unlisted is the sidebar toast and no call; a `deny` check is a toast and no call.
 */
const openChild = async ($: EngineInterface, text: UiText, sessionId: string): Promise<void> => {
  if (!(await isListed($, OPEN))) {
    $.ui.toast(text.toast.openSidebar)
    return
  }
  try {
    const verdict = await $.tool.check({ tool: OPEN, input: { session_id: sessionId, target: 'split' } })
    if (verdict.decision === 'deny') {
      $.ui.toast(text.toast.openDenied(OPEN))
      return
    }
    let answer = await callAppTool($, OPEN, { session_id: sessionId, target: 'split' })
    if (answer.deny === undefined && answer.isError === true) answer = await callAppTool($, OPEN, { session_id: sessionId, target: 'window' })
    if (answer.deny !== undefined) $.ui.toast(answer.deny)
    else if (answer.isError === true) $.ui.toast(answerText(answer) ?? 'error')
  } catch (error) {
    $.ui.toast(reasonOf(error))
  }
}

export const register: Register = (on, options) => {
  const text = uiText(langOf(options))

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'devkit-panel', description: 'Toggle the devkit panel (status: print it as text)', argumentHint: '[status]' })
    await $.tool.register({
      name: 'status',
      description: 'The devkit panel as text: the change this session conducts with its next step and child sessions, and the other changes in progress. Read-only.',
    })
    $.clock.every(REFRESH_MS, () => {
      void tick($)
    })
    // a hot reload resets `inFlight` but keeps the state: nothing is in flight now
    await update($, isRefreshing, () => false)
    void refresh($, 'full')
    return next(e)
  })

  // the end of a main-loop turn: the owner pressed Enter, so the filled mark goes, and the light refresh
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, filled, () => null)
      void refresh($, 'light')
    }
    return next(e)
  })

  // `/devkit-panel` toggles the pane; `/devkit-panel status` prints it. A hook that fails hands the command on.
  on('command.run', { command: 'devkit-panel' }, async ($, e) => {
    if (e.args.trim() === 'status') return { text: await statusText($, text, e.presentation.columns) }
    return { text: text.command[await togglePane($, text)] }
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // the model's (and a headless owner's) view: the same text, after a refresh. A hook that fails names itself.
  on('tool.call', { tool: 'mcp__devkit-panel__status' }, async $ => {
    await refresh($, 'light')
    return { result: await statusText($, text) }
  }).catch(($, e, next) => (next.called ? undefined : { deny: `${$.plugin.name}: status failed: ${next.error.message ?? next.error.kind}` }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link, Code, Markdown } = $.ui.resolve(e)
    const [current, busy, marks, mark, now] = await Promise.all([read($, view), read($, isRefreshing), read($, collapsed), read($, filled), $.clock.now()])
    const ctx: Ctx = { now, isRefreshing: busy, collapsed: marks, filled: mark, columns: e.props.bodyColumns, isText: false, isPaneUp: true, surface: e.surface }
    const actions = {
      refresh: () => void refresh($, 'full'),
      toggle: (key: string) => void toggleFold($, key),
      fill: (button: OwnerButton) => void fill($, text, button),
      open: (sessionId: string) => void openChild($, text, sessionId),
      detail: (subject: DetailSubject) => void openDetail($, text, subject),
    }
    return renderPane({ Box, Text, Button, Link, Code, Markdown }, buildItems(current, text, ctx), text, ctx, actions)
  })

  // the detail pane (design D20): built from the current view and the subject, so a refresh redraws it with fresh data
  on('ui.render', { component: 'Pane', requestId: DETAIL }, async ($, e) => {
    const { Box, Text, Button, Link, Code, Markdown } = $.ui.resolve(e)
    const [current, state] = await Promise.all([read($, view), read($, detail)])
    const subject: DetailSubject = state?.subject ?? { kind: 'pending' }
    const ctx: DetailCtx = {
      full: state?.full ?? false,
      copied: state?.copied ?? false,
      copyFailed: state?.copyFailed ?? false,
      docText: subject.kind === 'doc' ? await readDoc($, current, subject.file) : undefined,
      columns: e.props.bodyColumns,
      surface: e.surface,
    }
    const actions = {
      subject: (next: DetailSubject) => void openDetail($, text, next),
      close: () => void closeDetail($),
      fold: () => void toggleFull($),
      copy: (textToCopy: string, surface: RenderSurface) => void copyText($, textToCopy, surface).catch(() => undefined),
      scroll: (key: string) => void scrollTo($, key).catch(() => undefined),
      fill: (button: OwnerButton) => void fill($, text, button, true),
    }
    return renderDetail({ Box, Text, Button, Link, Code, Markdown }, buildDetail(current, subject, text, ctx), text, ctx, actions)
  })

  // the owner closed the detail pane (Escape, its mark or `✕`): the subject goes, and the close is never refused
  on('ui.close', { id: DETAIL }, async ($, e, next) => {
    await update($, detail, () => null)
    return next(e)
  })

  // the band: the engine's under a survey, outside a devkit project or before any refresh (design D11)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const current = await read($, view)
    if (current.kind !== 'report' || current.refreshedAt === undefined) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const onToggle = (): void => {
      void togglePane($, text).catch(() => $.ui.toast(text.toast.paneFailed))
    }
    return renderBand({ Box, Text, Button }, current, await isPaneUp($), text, e.props.bodyColumns, onToggle)
  })
}
