// The devkit-panel contract: the view the pane draws and the `$.state` values
// the pack keeps for the session (design D5, D11). Parsed tolerantly from the
// checkers' JSON: every field optional, unknown values kept as text.

/** `conduct-check --json` (version 2): the round and one row per conducted change. */
export type RoundReport = {
  version: number
  base?: string
  round?: { n: number; title: string; done: number; total: number }
  roadmapDone: boolean
  changes: ChangeRow[]
  dispatch: string[]
  owner: string[]
  github: string[]
  stopped: string[]
  busy: string[]
  end: boolean
}

/** One change of the round as `conduct-check` reports it. */
export type ChangeRow = {
  id: string
  round?: number
  after?: string
  text?: string
  schema?: string
  worktree?: string
  branch?: string
  sessionPrefix?: string
  next: { step: string; actor: string; reason?: string; askable?: boolean; phase?: number }
  state: string
  deliver?: { summary: string; met: number; next: string } | null
  session?: { name: string; title: string; phase: number }
}

/** One of the eight items of `deliver-check <id> --json`. */
export type DeliverItem = {
  id: number
  name: string
  status: 'met' | 'open' | 'blocked'
  reason?: string
}

/** `deliver-check <id> --json` (version 1), the part the pane draws. */
export type DeliverReport = {
  change: string
  summary: string
  met: number
  items: DeliverItem[]
  next: { step: string; [k: string]: unknown }
  approval?: { ok: boolean }
}

/** One row of the app's `list_sessions`, read defensively (the shape is the app's). */
export type SessionRow = {
  sessionId: string
  name?: string
  title: string
  cwd: string
  isRunning: boolean
  isArchived: boolean
  startedBy?: string
  lastActivityAt?: string
}

/** The view the pane, the band and the `status` text draw from. */
export type PanelView = {
  kind: 'not-devkit' | 'no-checker' | 'report'
  /** `repo`, or `devkit-openspec <version>` (design D4). */
  checker?: string
  report?: RoundReport
  reportAt?: number
  error?: string
  /** Folder names under `openspec/changes/` not in the round, and under `archive/`, newest first. */
  others: string[]
  archived: string[]
  /** `deliver-check` reports by change id, for the expanded rows. */
  delivers: Record<string, DeliverReport | { error: string }>
  /** The linked child sessions by change id. */
  sessions: Record<string, SessionRow[]>
  /** The tool to allow, when `list_sessions` is not allowed. */
  permission?: string
  /** The `--change` probe (design D8). */
  changeOption: 'unknown' | 'yes' | 'no'
}

declare module 'claude-code' {
  interface PluginState {
    'devkit-panel': {
      view: Shaped<PanelView>
      /** By change id, and `others` / `archived` for the groups; absent = collapsed. */
      collapsed: Record<string, boolean>
      isRefreshing: boolean
    }
  }
}
