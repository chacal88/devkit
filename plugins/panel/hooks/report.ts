// Parsing of the checkers' JSON (design D5): tolerant of missing fields, unknown
// values kept as text, nothing computed about the flow. Pure.

import type { ChangeRow, DeliverItem, DeliverReport, RoundReport } from '../types'

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

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
const bool = (value: unknown): boolean => value === true
const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
const objects = (value: unknown): Json[] => (Array.isArray(value) ? value.map(asObject).filter((v): v is Json => v !== undefined) : [])

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

/** `conduct-check --json` (version 2) from its stdout; undefined when the text is not a report. */
export const parseRound = (stdout: string): RoundReport | undefined => {
  const r = parseJson(stdout)
  if (r === undefined || str(r.error) !== undefined) return undefined
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

const STATUSES: readonly DeliverItem['status'][] = ['met', 'open', 'blocked']

const parseItem = (i: Json): DeliverItem => {
  const status = str(i.status)
  return {
    id: num(i.id) ?? 0,
    name: str(i.name) ?? '',
    status: STATUSES.find(s => s === status) ?? 'open',
    ...(str(i.reason) !== undefined ? { reason: str(i.reason) } : {}),
  }
}

/** `deliver-check <id> --json` (version 1) from its stdout; undefined when the text is not a report. */
export const parseDeliver = (stdout: string): DeliverReport | undefined => {
  const r = parseJson(stdout)
  if (r === undefined || str(r.error) !== undefined) return undefined
  const next = asObject(r.next) ?? {}
  const approval = asObject(r.approval)
  return {
    change: str(r.change) ?? '',
    summary: str(r.summary) ?? '',
    met: num(r.met) ?? 0,
    items: objects(r.items).map(parseItem),
    next: { ...next, step: str(next.step) ?? '' },
    ...(approval !== undefined ? { approval: { ok: bool(approval.ok) } } : {}),
  }
}

/** The one error line of a failed run: exit 3's JSON `error`, else stderr's first line, else the exit code. */
export const checkerError = (run: CheckerRun): string => {
  const fromJson = str(parseJson(run.stdout)?.error)
  if (fromJson !== undefined && fromJson !== '') return fromJson
  const line = run.stderr.split('\n').map(l => l.trim()).find(l => l !== '')
  return line ?? `exit ${run.exitCode}`
}
