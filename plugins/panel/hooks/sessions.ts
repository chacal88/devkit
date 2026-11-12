// The linked child sessions, read only and never through a dialog (design D7), and the one call that shows one (design D9).

import type { EngineInterface } from 'claude-code'

import type { SessionRow } from '../types'

/** The app's session list: read only. */
export const LIST = 'mcp__ccd_session_mgmt__list_sessions'

/** The app's layout call: shows a child session beside this one, on the owner's press only. */
export const OPEN = 'mcp__ccd_window__open_session_in'

/** The list's arguments: the linked family with its archived children, up to 100. */
export const LIST_INPUT = { linked: true, include_archived: true, limit: 100 } as const

export type SessionState = 'running' | 'idle' | 'archived'

/** The app's `list_sessions` rows, read defensively: the shape is the app's, not ours. A row without `sessionId` is dropped. */
export const parseSessionRows = (text: string | undefined): SessionRow[] => {
  if (text === undefined || text.trim() === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows.flatMap((row): SessionRow[] => {
    if (typeof row !== 'object' || row === null) return []
    const r = row as Record<string, unknown>
    if (typeof r.sessionId !== 'string') return []
    return [
      {
        sessionId: r.sessionId,
        ...(typeof r.name === 'string' ? { name: r.name } : {}),
        title: typeof r.title === 'string' ? r.title : r.sessionId,
        cwd: typeof r.cwd === 'string' ? r.cwd : '',
        isRunning: r.isRunning === true,
        isArchived: r.isArchived === true,
        ...(typeof r.startedBy === 'string' ? { startedBy: r.startedBy } : {}),
        ...(typeof r.lastActivityAt === 'string' ? { lastActivityAt: r.lastActivityAt } : {}),
      },
    ]
  })
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The rows named `<prefix><n>` (`^<prefix>[0-9]+$`, the prefix escaped); none without a prefix. */
export const childrenOf = (rows: readonly SessionRow[], prefix: string | undefined): SessionRow[] => {
  if (prefix === undefined || prefix === '') return []
  const re = new RegExp(`^${escapeRegExp(prefix)}[0-9]+$`)
  return rows.filter(row => row.name !== undefined && re.test(row.name))
}

/** `running` when the app says so, `archived` when archived, else `idle`. */
export const sessionState = (row: SessionRow): SessionState => (row.isRunning ? 'running' : row.isArchived ? 'archived' : 'idle')

/**
 * The rows that are this session's own children (design D3): `startedBy` is set and is not the `sessionId` of a
 * row of the family. The app leaves the current session out of the list, so its id is the one `startedBy` no row
 * carries; a sibling of a child session, and the parent's own parent, stay out.
 */
export const ownChildren = (rows: readonly SessionRow[]): SessionRow[] => {
  const known = new Set(rows.map(row => row.sessionId))
  return rows.filter(row => row.startedBy !== undefined && !known.has(row.startedBy))
}

/** The phase number of a child: the digits after `prefix` in its name; undefined for any other name. */
export const phaseOf = (name: string | undefined, prefix: string | undefined): number | undefined => {
  if (name === undefined || prefix === undefined || prefix === '') return undefined
  const match = new RegExp(`^${escapeRegExp(prefix)}([0-9]+)$`).exec(name)
  return match?.[1] === undefined ? undefined : Number(match[1])
}

/** Thrown when a call asks for an app tool this panel does not make. */
export class UnsupportedAppToolError extends Error {
  constructor(readonly tool: string) {
    super(`${tool} is not an app tool this panel calls`)
    this.name = 'UnsupportedAppToolError'
  }
}

/**
 * The one helper every app tool call goes through (design D13): it accepts `list_sessions` and `open_session_in`
 * and nothing else, so a third tool cannot be called by mistake.
 */
export async function callAppTool($: { tool: Pick<EngineInterface['tool'], 'call'> }, name: typeof LIST | typeof OPEN, input: Record<string, unknown>) {
  if (name !== LIST && name !== OPEN) throw new UnsupportedAppToolError(String(name))
  return $.tool.call({ tool: name, ...input })
}

/** Whether the tool is listed (a name check: no dialog, no call). */
export async function isListed($: { tool: Pick<PanelTool, 'list'> }, name: string): Promise<boolean> {
  try {
    return (await $.tool.list()).some(t => t.name === name)
  } catch {
    return false
  }
}

/** The part of `$.tool` the permission check reads. */
export type PanelTool = Pick<EngineInterface['tool'], 'list' | 'check'>

/**
 * Whether the list may be read now: the tool is listed and `tool.check` answers `allow` for
 * `{ tool, input }`. The check opens no dialog, so a timer never asks the owner; the panel never
 * writes a permission rule.
 */
export async function mayList($: { tool: PanelTool }): Promise<boolean> {
  try {
    if (!(await $.tool.list()).some(t => t.name === LIST)) return false
    const verdict = await $.tool.check({ tool: LIST, input: LIST_INPUT })
    return verdict.decision === 'allow'
  } catch {
    return false
  }
}
