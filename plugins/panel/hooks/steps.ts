// Reading `tasks.md` (design D27) and placing the change in the flow's ten steps (design D22): pure, pinned by tests.

import type { ChangeRow, DeliverItem, DeliverReport, Task, TaskSection, TaskSections } from '../types'
import { clip, commandLabel, itemLines, itemSummary } from './detail'
import { STEP_KEYS } from './i18n'
import type { StepKey, UiText } from './i18n'
import { checksStatus } from './report'

// ---------------------------------------------------------------- tasks.md (design D27)

// the same two expressions as deliver-check.mjs#parseTasks and #readPhases
const SECTION_RE = /^##\s+(\d+)\.\s*(.*)$/
const TASK_RE = /^\s*[-*]\s+\[([ xX])\]\s+(\S+)\s*(.*)$/
const ANY_HEADING_RE = /^##\s/
const GATE_RE = /^Gate:[^`]*`([^`]+)`/
// the marker a phase heading carries when the owner runs it (design D25); on a task only at its start or right after a parenthesis
const OWNER_RUN_RE = /\bowner-run\b/
const TASK_OWNER_RUN_RE = /(?:^|\()owner-run\b/i

const TITLE_CELLS = 40
const SECTION_CELLS = 32
const SENTENCE_CELLS = 120

const noTicks = (text: string): string => text.replace(/`/g, '')

const firstSentence = (text: string): string => {
  const end = text.indexOf('. ')
  return end === -1 ? text : text.slice(0, end + 1)
}

/** A section's short title: the heading without its trailing parenthesis, at most 32 cells. */
export const shortTitle = (title: string): string => clip(title.replace(/\s*\([^()]*\)\s*$/, '').trim(), SECTION_CELLS)

// the marker clause an owner-run task opens with (`Owner-run, by the conducting session (no implementer): `), dropped from its title
const MARKER_RE = /^owner-run\b[^:(]*(?:\([^)]*\))?\s*:\s*/i
// where a phrase ends: a semicolon, a colon, a sentence stop or a dash
const PHRASE_END_RE = /\s*;\s+|\s*:\s+|\.\s+|\s+[—–]\s+/

/** The first phrase of `text` and what follows it. */
const takePhrase = (text: string): { phrase: string; rest: string } => {
  const found = PHRASE_END_RE.exec(text)
  if (found === null) return { phrase: text.replace(/[.:;]$/, '').trim(), rest: '' }
  return { phrase: text.slice(0, found.index).trim(), rest: text.slice(found.index + found[0].length).trim() }
}

/** A task's short title and sentence (design D27): the marker clause dropped, then the first phrase and the next one. */
const phrasesOf = (description: string): { title: string; sentence: string } => {
  const body = noTicks(description).replace(MARKER_RE, '').replace(/\s*\([^()]*\)/g, '').trim()
  const first = takePhrase(body)
  const next = takePhrase(first.rest)
  return { title: first.phrase, sentence: next.phrase }
}

const buildTask = (id: string, done: boolean, description: string, lines: string[], section: string): Task => {
  const isGate = description.startsWith('Gate:')
  const command = isGate ? GATE_RE.exec(description)?.[1] : undefined
  const under = lines.slice(1).map(l => l.replace(/^\s*[-*]\s+/, '').trim()).filter(l => l !== '')
  const gateLabels = command === undefined ? [] : command.split(/\s+&&\s+/).map(commandLabel)
  const phrases = phrasesOf(description)
  // a first phrase of under three words (`with`) is a fragment: the first bullet under the task names it instead
  const bullet = lines.slice(1).map(l => /^\s*[-*]\s+(.+)$/.exec(l)?.[1]).find(l => l !== undefined)
  const isFragment = !isGate && bullet !== undefined && phrases.title.split(/\s+/).filter(w => w !== '').length < 3
  if (isFragment) phrases.title = takePhrase(noTicks(bullet).replace(/\s*\([^()]*\)/g, '').trim()).phrase
  const title = isGate ? (gateLabels[0] === undefined ? 'Gate' : `Gate: ${gateLabels[0]}`) : phrases.title
  const sentence = isGate ? gateLabels.slice(1).join(', ') : isFragment ? '' : phrases.sentence !== '' ? phrases.sentence : firstSentence(noTicks(under.join(' ')).trim())
  return {
    id,
    done,
    isGate,
    title: clip(title === '' ? id : title, TITLE_CELLS),
    sentence: clip(sentence, SENTENCE_CELLS),
    text: lines.join('\n').trimEnd(),
    tag: isGate ? 'gate' : OWNER_RUN_RE.test(section) || TASK_OWNER_RUN_RE.test(description) ? 'owner' : 'claude',
  }
}

/**
 * The sections and checkbox lines of `tasks.md` as the checker reads them (a checkbox before any numbered heading is section 1; a
 * section with no checkbox is not one), plus each task's short title, sentence, full text and tag.
 */
export const readTasks = (text: string): TaskSections => {
  const sections = new Map<number, TaskSection>()
  const titles = new Map<number, string>()
  let phase = 1
  let open: { id: string; done: boolean; description: string; lines: string[]; phase: number } | undefined
  const close = (): void => {
    if (open === undefined) return
    const title = titles.get(open.phase) ?? ''
    const section = sections.get(open.phase) ?? { n: open.phase, title, short: shortTitle(title), tasks: [] }
    section.tasks.push(buildTask(open.id, open.done, open.description, open.lines, title))
    sections.set(open.phase, section)
    open = undefined
  }
  for (const line of text.split(/\r?\n/)) {
    const heading = SECTION_RE.exec(line)
    if (heading !== null) {
      close()
      phase = Number(heading[1])
      titles.set(phase, (heading[2] ?? '').trim())
      continue
    }
    const task = TASK_RE.exec(line)
    if (task !== null) {
      close()
      open = { id: task[2] ?? '', done: task[1] !== ' ', description: task[3] ?? '', lines: [line], phase }
      continue
    }
    if (ANY_HEADING_RE.test(line)) {
      close()
      continue
    }
    open?.lines.push(line)
  }
  close()
  return { sections: [...sections.values()].sort((a, b) => a.n - b.n).map(s => ({ ...s, title: titles.get(s.n) ?? s.title, short: shortTitle(titles.get(s.n) ?? s.title) })) }
}

/** The checkboxes of a read `tasks.md`: every one, the ticked ones and the open ones (gates included). */
export const countTasks = (tasks: TaskSections): { total: number; done: number; open: number } => {
  const all = tasks.sections.flatMap(s => s.tasks)
  const done = all.filter(t => t.done).length
  return { total: all.length, done, open: all.length - done }
}

// ---------------------------------------------------------------- the ten steps (design D22)

const STEP_OF: Record<StepKey, readonly string[]> = {
  requirements: ['create', 'new-change', 'worktree', 'grill'],
  plan: ['plan', 'revise-plan'],
  readiness: ['readiness', 'stop-readiness-blocked'],
  approval: ['approve', 'stop-plan-approval', 'stop-not-approved'],
  implementation: ['wait-dependencies', 'rebase', 'audit', 'stop-audit-unverifiable', 'implement', 'gate', 'commit'],
  review: ['review', 'fix-review', 'stop-review-deadlock'],
  proofs: ['verify', 'fix-defect'],
  pr: ['open-pr', 'push', 'push-rebased', 'update-branch', 'edit-pr-body', 'answer', 'resolve-release-conflict', 'wait-checks', 'fix-checks'],
  merge: ['ready', 'enable-auto-merge', 'disable-auto-merge', 'wait-merge'],
  retro: ['retro', 'stop-retro-answers', 'apply-proposals', 'open-archive-pr', 'tick-roadmap', 'stop-archive'],
}

/** The step ids `deliver-check` reports before the phases, and that no step of the ladder holds (design D22). */
export const NOT_IN_TABLE: readonly string[] = ['blocked', 'stop-branch', 'stop-plan-mode', 'stop-merge-setup']

/** The ladder step a `next.step` belongs to; none for a step outside the table. */
export const stepKeyOf = (step: string): StepKey | undefined => {
  const found = STEP_KEYS.find(key => STEP_OF[key].includes(step))
  if (found !== undefined) return found
  return step.startsWith('archive') ? 'retro' : undefined
}

/** The delivery items each step shows (design D22); item 1 shows its `tasks` part under Implementation and its `proofs` part under Proofs. */
export const STEP_ITEMS: Record<StepKey, readonly number[]> = {
  requirements: [],
  plan: [],
  readiness: [],
  approval: [],
  implementation: [1],
  review: [2, 3],
  proofs: [1, 4],
  pr: [5, 6, 7, 8],
  merge: [],
  retro: [],
}

/** One of the ten rows of `Passos`. `fact` is the few words on the right; `label` the current step's short label, which follows it; `hasMore` says its detail has a body worth a `›`. */
export type Step = { key: StepKey; status: 'done' | 'partial' | 'current' | 'pending'; fact?: string; label?: string; hasMore?: boolean; isError?: boolean; items: number[] }

/** What the `Agora` box says: the current step in a few words, what is left, and what comes after (an empty string for nothing). */
export type Now = { title: string; left?: string; then: string }

export type Flow = { steps: Step[]; /** The steps that are done. */ done: number; now: Now; /** What is left, for the band. */ left?: string }

const isReport = (deliver: DeliverReport | { error: string } | undefined): deliver is DeliverReport => deliver !== undefined && !('error' in deliver)

const IDX = (key: StepKey): number => STEP_KEYS.indexOf(key)

/** A step's name inside a sentence: its first letter lower case, unless it opens with an acronym (`PR e checks`). */
const lowerFirst = (name: string): string => (/^[A-Z]{2}/.test(name) ? name : `${name.charAt(0).toLowerCase()}${name.slice(1)}`)
const capitalize = (s: string): string => `${s.charAt(0).toUpperCase()}${s.slice(1)}`

const itemOf = (deliver: DeliverReport | undefined, id: number): DeliverItem | undefined => deliver?.items.find(i => i.id === id)

/** The criteria of item 4 not yet proven: those the checker lists as missing, failing or for the owner to weigh. */
const unproven = (item: DeliverItem | undefined): number => {
  const d = item?.details
  if (d === undefined) return 0
  return new Set([...(d.missing ?? []), ...(d.defects ?? []), ...(d.noProof ?? [])]).size
}

type Facts = { row: ChangeRow; deliver?: DeliverReport; tasks?: TaskSections; files: ReadonlySet<string> }

/** Whether the facts alone say a step is finished (design D22, a step id the ladder does not hold). */
const isFinished = (key: StepKey, { deliver, tasks, files }: Facts): boolean => {
  const met = (...ids: number[]): boolean => ids.every(id => itemOf(deliver, id)?.status === 'met')
  switch (key) {
    case 'requirements':
      return files.has('requirements.md')
    case 'plan':
      return files.has('proposal.md') && files.has('design.md') && files.has('tasks.md')
    case 'readiness':
      return files.has('readiness.md')
    case 'approval':
      return files.has('approval.md')
    case 'implementation':
      return tasks !== undefined && countTasks(tasks).total > 0 && countTasks(tasks).open === 0
    case 'review':
      return met(2, 3)
    case 'proofs':
      return met(1, 4)
    case 'pr':
      return met(5, 6, 7, 8)
    default:
      return false
  }
}

/** The step that shows a delivery item (item 1: Implementation while a task is open, else Proofs). */
const stepOfItem = (item: number, tasks: TaskSections | undefined): StepKey => {
  if (item === 1) return tasks !== undefined && countTasks(tasks).open > 0 ? 'implementation' : 'proofs'
  if (item === 2 || item === 3) return 'review'
  if (item === 4) return 'proofs'
  return 'pr'
}

const dateFact = (approvedOn: string | undefined, text: UiText): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(approvedOn ?? '')
  if (m === null) return text.pane.fact.approved
  return text.pane.fact.date(Number(m[2]), Number(m[3]))
}

const numberOf = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/**
 * The ten steps of the flow with "you are here" (design D22), the `Agora` box's lines (design D22) and the band's "what is left".
 * `files` is the set of the change folder's file names present; `approvedOn` is `approval.md`'s `Date:`. Done before the current
 * step, except Implementation with an open task and Proofs with an unproven criterion (partly done); pending after it.
 */
export const flowSteps = (
  row: ChangeRow,
  report: DeliverReport | { error: string } | undefined,
  tasks: TaskSections | undefined,
  files: ReadonlySet<string>,
  text: UiText,
  approvedOn?: string,
): Flow => {
  const deliver = isReport(report) ? report : undefined
  const facts: Facts = { row, ...(deliver !== undefined ? { deliver } : {}), ...(tasks !== undefined ? { tasks } : {}), files }
  const step = row.next.step
  const known = stepKeyOf(step)
  const item = row.next.item ?? numberOf(deliver?.next.item)
  const current = known !== undefined ? IDX(known) : item !== undefined ? IDX(stepOfItem(item, tasks)) : Math.max(0, STEP_KEYS.findIndex(key => !isFinished(key, facts)))
  const isError = known === undefined
  const counts = tasks === undefined ? undefined : countTasks(tasks)
  const phase = row.next.phase ?? numberOf(deliver?.next.phase)

  const fact = (key: StepKey): { text?: string; hasMore?: boolean } => {
    switch (key) {
      case 'requirements': {
        const n = itemOf(deliver, 4)?.details?.ids?.length ?? 0
        return n > 0 ? { text: text.pane.fact.criteria(n) } : {}
      }
      case 'plan':
        return tasks === undefined ? {} : { text: text.pane.fact.sections(tasks.sections.length) }
      case 'readiness':
        return { text: IDX(key) < current ? text.pane.fact.approved : step === 'stop-readiness-blocked' ? text.pane.fact.blocked : text.pane.fact.toRevise }
      case 'approval':
        return files.has('approval.md') ? { text: dateFact(approvedOn, text) } : {}
      case 'implementation':
        return counts !== undefined && counts.total > 0 ? { text: text.pane.fact.tasks(counts.done, counts.total), hasMore: true } : {}
      case 'review': {
        const round = numberOf(row.next.round) ?? numberOf(deliver?.next.round)
        return round !== undefined ? { text: text.pane.fact.round(round) } : {}
      }
      case 'proofs': {
        const four = itemOf(deliver, 4)
        const total = four?.details?.ids?.length ?? 0
        return total > 0 ? { text: text.pane.fact.proven(total - unproven(four), total) } : {}
      }
      case 'pr': {
        if (deliver?.pr === null || deliver?.pr === undefined) return {}
        const status = checksStatus(deliver)
        return { text: status === undefined ? `PR #${deliver.pr.number}` : text.pane.fact.pr(deliver.pr.number, text.pane.checks(status)) }
      }
      default:
        return {}
    }
  }

  const label = text.pane.step(step, phase)
  const steps: Step[] = STEP_KEYS.map((key, i): Step => {
    let status: Step['status'] = i < current ? 'done' : i === current ? 'current' : 'pending'
    if (status === 'done' && key === 'implementation' && counts !== undefined && counts.open > 0) status = 'partial'
    if (status === 'done' && key === 'proofs' && unproven(itemOf(deliver, 4)) > 0) status = 'partial'
    if (key === 'implementation' && tasks === undefined && status !== 'current') status = 'pending'
    const own = status === 'pending' ? {} : fact(key)
    // the current step's fact is followed by the step's short label, but not when it only repeats the step's own name
    const isRepeat = label.toLowerCase().startsWith(text.pane.stepName(key).toLowerCase())
    const showsLabel = status === 'current' && step !== 'implement' && !isError && !isRepeat
    return {
      key,
      status,
      ...(own.text !== undefined && own.text !== '' ? { fact: own.text } : {}),
      ...(showsLabel ? { label } : {}),
      ...(own.hasMore === true ? { hasMore: true } : {}),
      ...(status === 'current' && isError ? { isError: true } : {}),
      items: [...STEP_ITEMS[key]],
    }
  })

  return { steps, done: steps.filter(s => s.status === 'done').length, now: nowOf(row, deliver, tasks, steps, current, isError, phase, text), ...leftOf(steps, current, deliver, counts, text) }
}

/** The open lines of the items a step shows (item 1 only its own part), for the Now box and the band. */
const stepLines = (key: StepKey, deliver: DeliverReport | undefined) =>
  STEP_ITEMS[key].flatMap(id => {
    const found = itemOf(deliver, id)
    return found === undefined ? [] : itemLines(found, id === 1 ? (key === 'implementation' ? 'tasks' : 'proofs') : undefined)
  })

const leftOf = (steps: Step[], current: number, deliver: DeliverReport | undefined, counts: ReturnType<typeof countTasks> | undefined, text: UiText): { left?: string } => {
  const key = steps[current]?.key
  if (key === undefined) return {}
  if (key === 'implementation' && counts !== undefined && counts.open > 0) return { left: text.pane.bandLeft(counts.open) }
  const summary = itemSummary(stepLines(key, deliver), text)
  return summary === '' ? {} : { left: summary }
}

const nowOf = (row: ChangeRow, deliver: DeliverReport | undefined, tasks: TaskSections | undefined, steps: Step[], current: number, isError: boolean, phase: number | undefined, text: UiText): Now => {
  const step = row.next.step
  const key = steps[current]?.key
  const phaseTitle = (): string => {
    const section = tasks?.sections.find(s => s.n === phase)?.short
    return section ?? shortTitle(deliver?.phases.find(p => p.n === phase)?.title ?? '')
  }
  const title = isError
    ? step
    : step === 'implement' && phase !== undefined
      ? text.pane.implementTitle(phase, phaseTitle())
      : step === 'gate' && phase !== undefined
        ? text.pane.gateTitle(phase)
        : capitalize(text.pane.step(step, phase))
  let left: string | undefined
  if (!isError && step === 'implement') {
    const open = deliver?.phases.find(p => p.n === phase)?.open.length ?? tasks?.sections.find(s => s.n === phase)?.tasks.filter(t => !t.isGate && !t.done).length ?? 0
    if (open > 0) left = text.pane.nowLeft(open)
  } else if (key !== undefined) {
    const summary = itemSummary(stepLines(key, deliver), text)
    if (summary !== '') left = summary
  }
  const next = steps
    .slice(current + 1)
    .filter(s => s.status === 'pending')
    .slice(0, 3)
    .map(s => lowerFirst(text.pane.stepName(s.key)))
  return { title, ...(left !== undefined ? { left } : {}), then: next.length === 0 ? '' : text.pane.nowThen(next.join(', ')) }
}

/**
 * The progress phrase of a change that is not the conducted one (design D27): `k de n tarefas`, then ` · <step label>` when the
 * step is not `implement`; `plano pronto · 0 de n` once the plan is at its approval or past it with nothing ticked; the step label
 * alone without a `tasks.md`.
 */
export const progressOf = (row: ChangeRow, tasks: TaskSections | undefined, text: UiText): string => {
  const label = text.pane.step(row.next.step, row.next.phase)
  if (tasks === undefined) return label
  const { done, total } = countTasks(tasks)
  if (total === 0) return label
  const key = stepKeyOf(row.next.step)
  if (done === 0 && key !== undefined && IDX(key) >= IDX('approval')) return text.pane.planReady(total)
  const base = text.pane.tasksProgress(done, total)
  return row.next.step === 'implement' ? base : `${base} · ${label}`
}
