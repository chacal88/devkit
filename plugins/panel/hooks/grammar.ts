// The grammar the panel shares with the openspec checkers, as one small home that `scripts/check.py` (check_panel_parity)
// compares with the checkers' own literals: change `SECTION_RE`, `TASK_RE`, `CHANGE_ID_RE` or `NOT_IDS` here or there alone and
// that check fails. Pure.

// the same two expressions as deliver-check.mjs#parseTasks and #readPhases (design D27)
export const SECTION_RE = /^##\s+(\d+)\.\s*(.*)$/
export const TASK_RE = /^\s*[-*]\s+\[([ xX])\]\s+(\S+)\s*(.*)$/

// the checker's own `--change` rule, conduct-check.mjs (design D3): one change id
export const CHANGE_ID_RE = /^[A-Za-z0-9][\w.-]*$/
export const NOT_IDS: readonly string[] = ['.', '..', 'archive']

/** Whether `value` is a change id by the checker's `--change` rule. */
export const isChangeId = (value: string): boolean => CHANGE_ID_RE.test(value) && !NOT_IDS.includes(value)

// the marker a phase heading carries when the owner runs it (design D25); the panel's own, not the checker's
export const OWNER_RUN_RE = /\bowner-run\b/
