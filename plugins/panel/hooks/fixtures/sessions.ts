// `list_sessions` rows of a conducting session (design D3, D9), as the app words them: `name`, `startedBy`, `isArchived`.
// The shape is read from the tool's description in the desktop app 4.23118.0 (`app.asar`); the ids are made up.
// The current session (`local_conductor`) is left out of its own list, so its children's `startedBy` names an id no row carries.

import type { SessionRow } from '../../types'

const CONDUCTOR = 'local_conductor'

const child = (name: string, extra: Partial<SessionRow> = {}): SessionRow => ({
  sessionId: `local_${name}`,
  name,
  title: `${name}`,
  cwd: `/w/.claude/worktrees/${name}`,
  isRunning: false,
  isArchived: false,
  startedBy: CONDUCTOR,
  lastActivityAt: '2026-11-11T10:00:00.000Z',
  ...extra,
})

/** The conducting session's id, as its children's `startedBy`. */
export const CONDUCTOR_ID = CONDUCTOR

/** A child of the conducting session. */
export const childRow = child

/** The family seen from the conducting session: two phases of one change, the first archived, the second running. */
export const FAMILY_FROM_PARENT: SessionRow[] = [
  child('panel-conduct-view-p1', { isArchived: true, lastActivityAt: '2026-11-11T09:00:00.000Z' }),
  child('panel-conduct-view-p2', { isRunning: true }),
]

/** The same family seen from the child `panel-conduct-view-p2`: its parent is in the list, and it started no one. */
export const FAMILY_FROM_CHILD: SessionRow[] = [
  { sessionId: CONDUCTOR, name: 'conductor', title: 'conductor', cwd: '/w', isRunning: true, isArchived: false },
  child('panel-conduct-view-p1', { isArchived: true }),
]
