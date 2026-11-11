// The linked child sessions, read only and never through a dialog (design D7).

import type { EngineInterface } from 'claude-code'

import type { SessionRow } from '../types'

/** The app's session list, the one session tool the panel ever calls. */
export const LIST = 'mcp__ccd_session_mgmt__list_sessions'

/** The list's arguments: the linked sessions, up to 100. */
export const LIST_INPUT = { linked: true, limit: 100 } as const

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
