// Parsing of the checkers' JSON (design D5): tolerant of missing fields, unknown
// values kept as text, nothing computed about the flow. Pure.

import type { ChangeRow, DeliverItem, DeliverReport, Phase, RoundReport } from '../types'

type Json = Record<string, unknown>

/** The exit, stdout and stderr of a checker run, as `$.process.run` answers them. */
export type CheckerRun = { exitCode: number; stdout: string; stderr: string }

const asObject = (value: unknown): Json | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : undefined

const parseJson = (text: string): Json | undefined => {
  try {
    return asObject(JSON.parse(text))
  } catch {
    return undefined
  }
}

/**
 * The checkers' JSON versions this panel reads: `conduct-check --json` 2, `deliver-check --json` 1.
 * The docs define `version` as the breaking-change signal (it moves only when a field is removed
 * or changes meaning), so a newer report is not drawn; an older or absent one is read as it is.
 */
export const READ_VERSION = { round: 2, deliver: 1 } as const

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
const bool = (value: unknown): boolean => value === true
const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
const objects = (value: unknown): Json[] => (Array.isArray(value) ? value.map(asObject).filter((v): v is Json => v !== undefined) : [])

const isNewer = (r: Json, read: number): boolean => (num(r.version) ?? 0) > read

/** The error line of a report whose `version` is newer than the one this panel reads; undefined when it is readable or not a report. */
export const newerVersion = (stdout: string, read: number): string | undefined => {
  const r = parseJson(stdout)
  return r !== undefined && isNewer(r, read) ? `JSON version ${num(r.version)} is newer than the ${read} this panel reads` : undefined
}

const parseRound_ = (round: unknown): RoundReport['round'] => {
  const r = asObject(round)
  if (r === undefined) return undefined
  return { n: num(r.n) ?? 0, title: str(r.title) ?? '', done: num(r.done) ?? 0, total: num(r.total) ?? 0 }
}

const parseNext = (next: unknown): ChangeRow['next'] => {
  const n = asObject(next) ?? {}
  return {
    step: str(n.step) ?? '',
    actor: str(n.actor) ?? '',
    ...(str(n.reason) !== undefined ? { reason: str(n.reason) } : {}),
    ...(typeof n.askable === 'boolean' ? { askable: n.askable } : {}),
    ...(num(n.phase) !== undefined ? { phase: num(n.phase) } : {}),
    ...(num(n.item) !== undefined ? { item: num(n.item) } : {}),
    ...(num(n.round) !== undefined ? { round: num(n.round) } : {}),
  }
}

const parseDeliverSummary = (deliver: unknown): ChangeRow['deliver'] => {
  if (deliver === null) return null
  const d = asObject(deliver)
  if (d === undefined) return undefined
  const next = asObject(d.next)
  return { summary: str(d.summary) ?? '', met: num(d.met) ?? 0, next: str(next?.step) ?? str(d.next) ?? '' }
}

const parseSession = (session: unknown): ChangeRow['session'] => {
  const s = asObject(session)
  if (s === undefined) return undefined
  return { name: str(s.name) ?? '', title: str(s.title) ?? '', phase: num(s.phase) ?? 0 }
}

const parseChange = (c: Json): ChangeRow => {
  const deliver = parseDeliverSummary(c.deliver)
  const session = parseSession(c.session)
  return {
    id: str(c.id) ?? '',
    ...(num(c.round) !== undefined ? { round: num(c.round) } : {}),
    ...(str(c.after) !== undefined ? { after: str(c.after) } : Array.isArray(c.after) && c.after.length > 0 ? { after: ids(c.after).join(', ') } : {}),
    ...(str(c.text) !== undefined ? { text: str(c.text) } : {}),
    ...(str(c.schema) !== undefined ? { schema: str(c.schema) } : {}),
    ...(str(c.worktree) !== undefined ? { worktree: str(c.worktree) } : {}),
    ...(str(c.branch) !== undefined ? { branch: str(c.branch) } : {}),
    ...(str(c.sessionPrefix) !== undefined ? { sessionPrefix: str(c.sessionPrefix) } : {}),
    next: parseNext(c.next),
    state: str(c.state) ?? '',
    ...(deliver !== undefined ? { deliver } : {}),
    ...(session !== undefined ? { session } : {}),
  }
}

/** `conduct-check --json` (version 2) from its stdout; undefined when the text is not a report or its version is newer. */
export const parseRound = (stdout: string): RoundReport | undefined => {
  const r = parseJson(stdout)
  if (r === undefined || str(r.error) !== undefined || isNewer(r, READ_VERSION.round)) return undefined
  const round = parseRound_(r.round)
  return {
    version: num(r.version) ?? 0,
    ...(str(r.base) !== undefined ? { base: str(r.base) } : {}),
    ...(round !== undefined ? { round } : {}),
    roadmapDone: bool(r.roadmapDone),
    changes: objects(r.changes).map(parseChange),
    dispatch: ids(r.dispatch),
    owner: ids(r.owner),
    github: ids(r.github),
    stopped: ids(r.stopped),
    busy: ids(r.busy),
    end: bool(r.end),
  }
}

/** The item of `deliver-check` that reports the pull request's checks. */
const CHECKS_ITEM = 6

const STATUSES: readonly DeliverItem['status'][] = ['met', 'open', 'blocked']

const LIST_FIELDS = ['unticked', 'missingGates', 'missing', 'rejected', 'stale', 'ids', 'proven', 'defects', 'noProof', 'pending'] as const

/** An item's `details`, each field kept only when it has its expected type (a list field present but not a list reads empty). */
const parseDetails = (details: unknown): DeliverItem['details'] => {
  const d = asObject(details)
  if (d === undefined) return undefined
  const lists = Object.fromEntries(LIST_FIELDS.filter(key => key in d).map(key => [key, ids(d[key])]))
  return {
    ...lists,
    ...(typeof d.evidence === 'string' ? { evidence: d.evidence } : {}),
    ...('failing' in d ? { failing: objects(d.failing).flatMap(f => (str(f.name) !== undefined ? [{ name: str(f.name) ?? '' }] : [])) } : {}),
  }
}

const parseItem = (i: Json): DeliverItem => {
  const status = str(i.status)
  const details = parseDetails(i.details)
  return {
    id: num(i.id) ?? 0,
    name: str(i.name) ?? '',
    status: STATUSES.find(s => s === status) ?? 'open',
    ...(str(i.reason) !== undefined ? { reason: str(i.reason) } : {}),
    ...(details !== undefined ? { details } : {}),
  }
}

const parsePr = (pr: unknown): DeliverReport['pr'] => {
  const p = asObject(pr)
  const number = num(p?.number)
  const url = str(p?.url)
  return number !== undefined && url !== undefined ? { number, url } : null
}

const parsePhase = (p: Json): Phase => {
  const gate = asObject(p.gate)
  return {
    n: num(p.n) ?? 0,
    title: str(p.title) ?? '',
    open: ids(p.open),
    gate: gate === undefined ? null : { id: str(gate.id) ?? '', done: bool(gate.done) },
  }
}

/** `deliver-check <id> --json` (version 1) from its stdout; undefined when the text is not a report or its version is newer. */
export const parseDeliver = (stdout: string): DeliverReport | undefined => {
  const r = parseJson(stdout)
  if (r === undefined || str(r.error) !== undefined || isNewer(r, READ_VERSION.deliver)) return undefined
  const next = asObject(r.next) ?? {}
  const approval = asObject(r.approval)
  return {
    change: str(r.change) ?? '',
    summary: str(r.summary) ?? '',
    met: num(r.met) ?? 0,
    items: objects(r.items).map(parseItem),
    next: { ...next, step: str(next.step) ?? '' },
    ...(approval !== undefined ? { approval: { ok: bool(approval.ok) } } : {}),
    pr: parsePr(r.pr),
    phases: objects(r.phases).map(parsePhase),
  }
}

/** How the pull request's checks read (design D8 item 4), from item 6; undefined when the report has no item 6. */
export type ChecksStatus = 'green' | 'red' | 'running' | 'unreadable'

export const checksStatus = (report: DeliverReport): ChecksStatus | undefined => {
  const item = report.items.find(i => i.id === CHECKS_ITEM)
  if (item === undefined) return undefined
  if (item.status === 'met') return 'green'
  if (item.status === 'blocked') return 'unreadable'
  if ((item.details?.failing ?? []).length > 0) return 'red'
  if ((item.details?.pending ?? []).length > 0) return 'running'
  return 'unreadable'
}

/** Where the change is in its phases (design D8 item 3): the current phase, the total and the finished ones. */
export type PhaseProgress = { current: number; total: number; finished: number[] }

/** A phase is finished when its gate is done and it has no open task; the current one is the first unfinished, the last when all are finished. */
export const phaseProgress = (phases: readonly Phase[]): PhaseProgress | undefined => {
  if (phases.length === 0) return undefined
  const finished = phases.filter(p => p.gate?.done === true && p.open.length === 0).map(p => p.n)
  const current = phases.find(p => !finished.includes(p.n))?.n ?? phases[phases.length - 1]?.n ?? 0
  return { current, total: phases.length, finished }
}

/** GitHub's `API rate limit exceeded`, `secondary rate limit` and `gh`'s `GraphQL: rate limited` (design D5). */
export const isRateLimited = (line: string): boolean => /rate limit/i.test(line)

/** The one error line of a failed run: exit 3's JSON `error`, else stderr's first line, else the exit code. */
export const checkerError = (run: CheckerRun): string => {
  const fromJson = str(parseJson(run.stdout)?.error)
  if (fromJson !== undefined && fromJson !== '') return fromJson
  const line = run.stderr.split('\n').map(l => l.trim()).find(l => l !== '')
  return line ?? `exit ${run.exitCode}`
}

const OWNER_RUN_RE = /\bowner-run\b/

/**
 * Who acts on a row (design D25): the checker's `next.actor`, except that on `implement` and `gate` of a phase whose title holds
 * the `owner-run` marker the owner acts, though the checker still reports the session. A reading of data already read.
 */
export const actorOf = (row: ChangeRow, deliver: DeliverReport | { error: string } | undefined): string => {
  const { step, phase, actor } = row.next
  if ((step !== 'implement' && step !== 'gate') || phase === undefined || deliver === undefined || 'error' in deliver) return actor
  const title = deliver.phases.find(p => p.n === phase)?.title ?? ''
  return OWNER_RUN_RE.test(title) ? 'owner' : actor
}
