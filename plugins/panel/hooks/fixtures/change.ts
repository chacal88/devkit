// Captured 2026-11-11 in the devkit repository: `DEVKIT_HOST=app node plugins/openspec/hooks/conduct-check.mjs --json --change panel-conduct-view`
// (devkit-openspec 0.12.0, at the `implement` step of phase 1, exit code 0). Trimmed: `notes`, `text` and `base` of the row and the
// session's `brief` and `background` dropped, the repository re-rooted at `/w` (the tests' project root).

import { DELIVER_OPEN_STDOUT } from './deliver-open'

/** The report as written to stdout. */
export const CHANGE_STDOUT = "{\n \"version\": 2,\n \"base\": \"main\",\n \"mode\": \"change\",\n \"change\": \"panel-conduct-view\",\n \"round\": null,\n \"startedAt\": null,\n \"skipped\": [],\n \"roadmapDone\": false,\n \"changes\": [\n  {\n   \"id\": \"panel-conduct-view\",\n   \"round\": null,\n   \"after\": [],\n   \"schema\": \"devkit\",\n   \"worktree\": \"/w/.claude/worktrees/panel-conduct-view-404c57\",\n   \"branch\": \"panel-conduct-view\",\n   \"next\": {\n    \"step\": \"implement\",\n    \"reason\": \"phase 1 has unticked tasks: 1.1, 1.2, 1.3, 1.4, 1.5\",\n    \"phase\": 1,\n    \"actor\": \"session\",\n    \"agent\": \"devkit-core:tdd-implementer\"\n   },\n   \"state\": \"ready to run: implement\",\n   \"deliver\": {\n    \"summary\": \"in progress: item 1\",\n    \"met\": 1,\n    \"next\": {\n     \"step\": \"implement\",\n     \"reason\": \"phase 1 has unticked tasks: 1.1, 1.2, 1.3, 1.4, 1.5\",\n     \"phase\": 1\n    }\n   },\n   \"unfinished\": null,\n   \"sessionPrefix\": \"panel-conduct-view-p\",\n   \"session\": {\n    \"title\": \"panel-conduct-view: phase 1\",\n    \"name\": \"panel-conduct-view-p1\",\n    \"cwd\": \"/w/.claude/worktrees/panel-conduct-view-404c57\",\n    \"branch\": \"panel-conduct-view\",\n    \"phase\": 1\n   }\n  }\n ],\n \"dispatch\": [\n  \"panel-conduct-view\"\n ],\n \"owner\": [],\n \"github\": [],\n \"stopped\": [],\n \"busy\": [],\n \"end\": false\n}"

/** The exit code of a run that found the change. */
export const CHANGE_EXIT = 0

// Captured 2026-11-11 in the devkit repository: `DEVKIT_HOST=app node plugins/openspec/hooks/conduct-check.mjs --json --change nosuch-thing`
// (devkit-openspec 0.12.0, exit code 3: no worktree, branch or folder of that name), whole.

/** The JSON error line on stdout. */
export const MISSING_STDOUT = "{\"version\":2,\"error\":\"no change nosuch-thing: no worktree, no branch nosuch-thing, no openspec/changes/nosuch-thing/ on origin/main and no archived folder; create it with `openspec new change nosuch-thing --schema <devkit|devkit-lite>` on a branch named nosuch-thing\"}"
/** The same message on stderr. */
export const MISSING_STDERR = "conduct-check: no change nosuch-thing: no worktree, no branch nosuch-thing, no openspec/changes/nosuch-thing/ on origin/main and no archived folder; create it with `openspec new change nosuch-thing --schema <devkit|devkit-lite>` on a branch named nosuch-thing"
/** The exit code of a change the checker does not know. */
export const MISSING_EXIT = 3

// The three rows below are derived from the captured report above and from `deliver-open.ts`, so that the steps, the Now box and the
// pane can be read at three points of the flow. Each says what was changed. They are built (not captured): the repository has no
// change at these points to capture, and the live check (phase 5) reads the real ones.


/** One checkbox of a built `tasks.md`: done, its id, its text. */
type Box = readonly [done: boolean, id: string, text: string]

/** A `tasks.md` text of numbered sections (`## <n>. <title>`), each with its checkbox lines. */
const tasksText = (sections: readonly { title: string; boxes: readonly Box[] }[]): string =>
  `# Tasks\n\n${sections.map((s, i) => `## ${i + 1}. ${s.title}\n\n${s.boxes.map(([done, id, text]) => `- [${done ? 'x' : ' '}] ${id} ${text}`).join('\n')}\n`).join('\n')}`

type Json = Record<string, unknown>

/** The captured row with `next`, `state` and the actor overridden, and its deliver summary dropped. */
const rowStdout = (id: string, next: Json, state: string): string => {
  const report = JSON.parse(CHANGE_STDOUT) as { changes: Json[] }
  const row = report.changes[0] ?? {}
  report.changes = [{ ...row, id, next, state, deliver: null }]
  return JSON.stringify(report)
}

/** `deliver-open.ts`'s report with `next`, the PR, the phases and the items given overridden. */
const deliverStdout = (change: Partial<{ next: Json; pr: Json | null; phases: Json[]; items: Record<number, Json> }>): string => {
  const report = JSON.parse(DELIVER_OPEN_STDOUT) as { next: Json; pr: Json | null; phases: Json[]; items: Json[] }
  const items = report.items.map(i => ({ ...i, ...(change.items?.[Number(i.id)] ?? {}) }))
  return JSON.stringify({ ...report, ...(change.next !== undefined ? { next: change.next } : {}), ...(change.pr !== undefined ? { pr: change.pr } : {}), ...(change.phases !== undefined ? { phases: change.phases } : {}), items })
}

/** What one built point of the flow holds: the two checker reports, the `tasks.md` text and the change folder's file names. */
export type FlowFixture = { rowStdout: string; deliverStdout: string; tasks: string; files: string[]; approvedOn?: string }

const PLAN_FILES = ['requirements.md', 'proposal.md', 'design.md', 'tasks.md']
const ALL_FILES = [...PLAN_FILES, 'readiness.md', 'approval.md']

const GATE = (id: string): Box => [false, id, 'Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green']
const done = (b: Box): Box => [true, b[1], b[2]]

/**
 * Planning: the captured row changed to the `readiness` step (actor session, no phase), the plan files present but `readiness.md` and
 * `approval.md` not, three sections with every task unticked, no pull request.
 */
export const PLANNING: FlowFixture = (() => {
  const sections = [
    { title: 'Loading', boxes: [[false, '1.1', 'First thing'], [false, '1.2', 'Second thing'], GATE('1.9')] as const },
    { title: 'The pane', boxes: [[false, '2.1', 'Third thing'], GATE('2.9')] as const },
    { title: 'Release', boxes: [[false, '3.1', 'Fourth thing'], GATE('3.9')] as const },
  ]
  const phases = sections.map((s, i) => ({ n: i + 1, title: s.title, open: s.boxes.filter(b => !b[2].startsWith('Gate:')).map(b => b[1]), gate: { id: s.boxes.at(-1)?.[1] ?? '', done: false } }))
  return {
    rowStdout: rowStdout('panel-conduct-view', { step: 'readiness', reason: 'the plan needs its readiness review', actor: 'session' }, 'ready to run: readiness'),
    deliverStdout: deliverStdout({ next: { step: 'readiness', reason: 'the plan needs its readiness review' }, phases }),
    tasks: tasksText(sections),
    files: PLAN_FILES,
  }
})()

/**
 * Mid-implementation: the captured row changed to `implement` of phase 2 of 3: phase 1 finished (every box and its gate ticked), phase 2 with
 * two tasks open, phase 3 untouched; every plan file present, `approval.md` dated 2026-09-18.
 */
export const MID_IMPLEMENTATION: FlowFixture = (() => {
  const sections = [
    { title: 'Loading', boxes: [done([false, '1.1', 'First thing']), done([false, '1.2', 'Second thing']), done(GATE('1.9'))] },
    { title: 'The pane', boxes: [done([false, '2.1', 'Third thing']), [false, '2.2', 'Fourth thing'], [false, '2.3', 'Fifth thing'], GATE('2.9')] },
    { title: 'Release', boxes: [[false, '3.1', 'Sixth thing'], GATE('3.9')] },
  ] as const
  const phases = [
    { n: 1, title: 'Loading', open: [], gate: { id: '1.9', done: true } },
    { n: 2, title: 'The pane', open: ['2.2', '2.3'], gate: { id: '2.9', done: false } },
    { n: 3, title: 'Release', open: ['3.1'], gate: { id: '3.9', done: false } },
  ]
  return {
    rowStdout: rowStdout('panel-conduct-view', { step: 'implement', reason: 'phase 2 has unticked tasks: 2.2, 2.3', phase: 2, actor: 'session' }, 'ready to run: implement'),
    deliverStdout: deliverStdout({
      next: { step: 'implement', reason: 'phase 2 has unticked tasks: 2.2, 2.3', phase: 2 },
      phases,
      items: { 1: { details: { unticked: ['2.2', '2.3', '3.1'], missingGates: ['python3 scripts/check.py'], evidence: 'missing' } } },
    }),
    tasks: tasksText(sections),
    files: ALL_FILES,
    approvedOn: '2026-09-18',
  }
})()

/**
 * Delivery: the captured row changed to `wait-checks` (actor github) with pull request 31: every task and gate ticked, items 1 to 5 met,
 * items 7 and 8 met, item 6 open with the check `build` pending, the criteria AC-1 and AC-2 proven.
 */
export const DELIVERY: FlowFixture = (() => {
  const sections = [{ title: 'Loading', boxes: [done([false, '1.1', 'First thing']), done(GATE('1.9'))] }, { title: 'Release', boxes: [done([false, '2.1', 'Second thing']), done(GATE('2.9'))] }] as const
  const phases = [
    { n: 1, title: 'Loading', open: [], gate: { id: '1.9', done: true } },
    { n: 2, title: 'Release', open: [], gate: { id: '2.9', done: true } },
  ]
  const met = (id: number, name: string, details: Json): Json => ({ id, name, status: 'met', reason: 'ok', details })
  return {
    rowStdout: rowStdout('panel-conduct-view', { step: 'wait-checks', reason: 'checks are running', actor: 'github' }, 'waiting on checks'),
    deliverStdout: deliverStdout({
      next: { step: 'wait-checks', reason: 'checks are running' },
      pr: { number: 31, url: 'https://github.com/chacal88/devkit/pull/31' },
      phases,
      items: {
        1: met(1, 'tasks', { unticked: [], missingGates: [], evidence: 'current' }),
        2: met(2, 'reviews', { stale: [], rejected: [], missing: [] }),
        3: met(3, 'findings', { fixed: 0, refuted: 0, undisposed: [] }),
        4: met(4, 'acceptance', { ids: ['AC-1', 'AC-2'], proven: ['AC-1', 'AC-2'], missing: [], defects: [], noProof: [], evidence: 'current' }),
        5: met(5, 'pr', { none: false }),
        6: { id: 6, name: 'checks', status: 'open', reason: 'checks pending: build', details: { required: 1, failing: [], pending: ['build'] } },
        7: met(7, 'conversation', {}),
        8: met(8, 'body', {}),
      },
    }),
    tasks: tasksText(sections),
    files: [...ALL_FILES, 'evidence.md'],
    approvedOn: '2026-09-18',
  }
})()
