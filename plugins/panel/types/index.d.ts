// The devkit-panel contract: the view the pane draws and the `$.state` values
// the pack keeps for the session (design D5, D11). Parsed tolerantly from the
// checkers' JSON: every field optional, unknown values kept as text.

/** `conduct-check --json` (version 2): the parse target of a `--change <id>` run (one row). */
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
  next: { step: string; actor: string; reason?: string; askable?: boolean; phase?: number; item?: number; round?: number }
  state: string
  deliver?: { summary: string; met: number; next: string } | null
  session?: { name: string; title: string; phase: number }
}

/** What `deliver-check` says about the things an item lacks (design D21); each field is read only when it has the expected type. */
export type DeliverDetails = {
  /** Item 1: the unticked task ids, and the gate commands with no passing row in `evidence.md`. */
  unticked?: string[]
  missingGates?: string[]
  /** Items 1 and 4: `missing`, `stale` or `current`. */
  evidence?: string
  /** Item 2 (reviewers) and item 4 (criteria ids): the ones with no review or no proof. */
  missing?: string[]
  rejected?: string[]
  stale?: string[]
  /** Item 4: every criterion id, the proven ones, the failing ones and the ones the owner weighs. */
  ids?: string[]
  proven?: string[]
  defects?: string[]
  noProof?: string[]
  /** Item 6: the failing and the pending checks. */
  failing?: { name: string }[]
  pending?: string[]
}

/** One of the eight items of `deliver-check <id> --json`. */
export type DeliverItem = {
  id: number
  name: string
  status: 'met' | 'open' | 'blocked'
  reason?: string
  details?: DeliverDetails
}

/** One phase of `deliver-check`'s `phases`: its open tasks and its gate (null when the phase has none). */
export type Phase = {
  n: number
  title: string
  open: string[]
  gate: { id: string; done: boolean } | null
}

/** One checkbox of `tasks.md` (design D27). `tag` is who the task waits on: the owner (an owner-run task or section), a gate, or Claude. */
export type Task = {
  id: string
  done: boolean
  isGate: boolean
  /** Its text after the id up to the first ` (`, `:` or `;`, without backticks, at most 40 cells. */
  title: string
  /** The first sentence of the lines under it (a gate's: its command labels), at most 120 characters. */
  sentence: string
  /** The task line and the lines under it, as written. */
  text: string
  tag: 'owner' | 'claude' | 'gate'
}

/** One numbered section (`## <n>. <title>`) of `tasks.md`: the checker's phase. `short` drops the trailing parenthesis, at most 32 cells. */
export type TaskSection = { n: number; title: string; short: string; tasks: Task[] }

/** `readTasks`' answer (design D27). */
export type TaskSections = { sections: TaskSection[] }

/** `deliver-check <id> --json` (version 1), the part the pane draws. */
export type DeliverReport = {
  change: string
  summary: string
  met: number
  items: DeliverItem[]
  next: { step: string; [k: string]: unknown }
  approval?: { ok: boolean }
  /** The change's pull request, or null before there is one. */
  pr: { number: number; url: string } | null
  phases: Phase[]
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

/** What the checker last said about one change in progress (design D7). `row` is the last good row. */
export type ChangeEntry = {
  id: string
  row?: ChangeRow
  error?: string
  checkedAt: number
  source: 'folder' | 'branch' | 'command'
  dropped?: 'archived' | 'not-a-change'
}

/** The change this session conducts, and which signal found it (design D3). */
export type Conducted = {
  id: string
  via: 'command' | 'children'
  /** The other ids whose stored session prefix is the same: this change's children cannot be told apart. */
  sharedWith?: string[]
  deliver?: DeliverReport | { error: string }
  /** The change's folder: its worktree's `openspec/changes/<id>` when that exists, else the root's (design D23). */
  folder: string
  summary?: string
  /** The change folder's documents that exist, as the link and tab list (`specs` stands for every `specs/<capability>/spec.md`). */
  docs: { file: string; path: string }[]
  /** `approval.md`'s `Date:`, as written. */
  approvedOn?: string
  tasks?: TaskSections
}

/** What the detail pane shows (design D20): the pending list (one section of it), a step, a document, another change, an error line. */
export type DetailSubject =
  | { kind: 'pending'; section?: number }
  | { kind: 'step'; key: string }
  | { kind: 'doc'; file: string }
  | { kind: 'change'; id: string }
  | { kind: 'error'; key: string }

/** The view the pane, the band and the `status` text draw from (design D7). */
export type PanelView = {
  kind: 'not-devkit' | 'no-checker' | 'old-checker' | 'report'
  /** `repo`, or `devkit-openspec <version>` (design D4). */
  checker?: string
  /** The last path segment of the main checkout (design D23). */
  repo?: string
  conducted?: Conducted
  /** The stored entry of every candidate, by change id. */
  changes: Record<string, ChangeEntry>
  /** The tasks' progress of every candidate but the conducted change: `done` of `total` checkboxes (design D27). */
  progress: Record<string, { done: number; total: number }>
  /** The changes in progress, ordered by who acts, the conducted id excluded. */
  inProgress: string[]
  /** The linked family from `list_sessions`. */
  sessions: SessionRow[]
  /** Whether `open_session_in` is listed (a name check, no dialog). */
  canOpen: boolean
  /** The tool to allow, when `list_sessions` is not allowed (the `mayList` path). */
  permission?: string
  /** Why an allowed `list_sessions` call was refused or failed: drawn as an error line, never a silent empty list. */
  listError?: string
  error?: string
  refreshedAt?: number
  nextAt?: number
  /** Until when a rate-limited `gh` pauses the checks (design D5). */
  backoffUntil?: number
}

declare module 'claude-code' {
  interface PluginState {
    'devkit-panel': {
      view: Shaped<PanelView>
      /** Fold keys: `in-progress`, `more`, `archived`; absent = the default. */
      collapsed: Record<string, boolean>
      isRefreshing: boolean
      /** The owner button whose text sits in the prompt box (design D10). */
      filled: { key: string; text: string } | null
      /** The detail pane's subject, with its two marks (design D20); null while the pane is closed. */
      detail: Shaped<{ subject: DetailSubject; full: boolean; copied: boolean; copyFailed?: boolean } | null>
    }
  }
}
