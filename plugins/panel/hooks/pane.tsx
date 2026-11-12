// The pane as rows (design D8, D12, D22 to D27): `buildItems` is the one view model the pane, the `status` command
// and the `status` tool draw from. `renderPane` maps it to the mod's elements, `renderText` joins it as plain lines with
// every fold open, and `renderBand` draws the one line above the prompt (design D11). `buildDetail` and `renderDetail`
// are the detail pane's (design D20). Text colours are theme keys; the mock's tints and glyph colours are its hex values (design D8);
// every glyph is one cell wide.

import type { BoxProps, ButtonProps, CodeProps, ElementConstructor, LinkProps, MarkdownProps, RenderElement, RenderSurface, TextProps } from 'claude-code'

import type { ChangeEntry, ChangeRow, DeliverItem, DeliverReport, DetailSubject, PanelView, TaskSections } from '../types'
import { conductButton, nowButtons } from './commands'
import type { OwnerButton } from './commands'
import { capLines, itemLines, itemSummary } from './detail'
import type { ItemLine } from './detail'
import { STEP_KEYS } from './i18n'
import type { StepKey, UiText } from './i18n'
import { actorOf, checksStatus } from './report'
import type { ChecksStatus } from './report'
import { childrenOf, phaseOf, sessionState } from './sessions'
import type { SessionState } from './sessions'
import { STEP_ITEMS, countTasks, flowSteps, progressOf, shortTitle } from './steps'
import type { Flow } from './steps'

/** The elements a render hook resolves for the pane, the detail pane and the band; the mobile surface has the same six. */
export type PaneElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Link: ElementConstructor<LinkProps>
  Code: ElementConstructor<CodeProps>
  Markdown: ElementConstructor<MarkdownProps>
}

/** The closures the hooks module hands the pane: each reaches `$`. */
export type PaneActions = {
  refresh: () => void
  /** Folds or unfolds the group or row named by the fold key. */
  toggle: (key: string) => void
  /** Fills an owner button's text into the prompt box. */
  fill: (button: OwnerButton) => void
  /** Shows a child session, on the owner's press only (design D9). */
  open: (sessionId: string) => void
  /** Opens the detail pane on a subject, on the owner's press only (design D20). */
  detail: (subject: DetailSubject) => void
}

/** The closures of the detail pane: a press in it changes its subject or its marks in place, or closes it. */
export type DetailActions = {
  subject: (subject: DetailSubject) => void
  close: () => void
  fold: () => void
  copy: (text: string, surface: RenderSurface) => void
  scroll: (key: string) => void
  fill: (button: OwnerButton) => void
}

type Glyph = { char: string; color: string }
type Label = {
  text: string
  strong?: boolean
  dim?: boolean
  size?: 'caption' | 'heading'
  fold?: { key: string; open: boolean; chevron?: boolean }
  link?: string
  open?: string
  /** A press that opens the detail pane on this subject, under this element key. */
  subject?: { key: string; subject: DetailSubject }
}
type Right = { text: string; glyph?: Glyph; color?: string; pill?: boolean }

/** The mock's colours (`mock/Main.dc.html`, light mode): the tints behind text carry their own ink so a dark theme stays readable. */
const MOCK = {
  ink: '#1A1A19',
  body: '#3D3B37',
  dim: '#6B6965',
  accent: '#B0502C',
  done: '#2F7D4F',
  amber: '#A16207',
  pending: '#A8A49C',
  nowBg: '#F6F5F2',
  stepBg: '#FBF1EC',
  warnBg: '#FBF4E6',
  warnInk: '#7A4D05',
  chipBg: '#F2F1ED',
  chipOn: '#1A1A19',
  white: '#FFFFFF',
  rule: '#E7E5E0',
} as const

const PANE_COLOR: Record<string, string> = { claude: MOCK.accent, warning: MOCK.amber, success: MOCK.done, inactive: MOCK.pending }

/** The colour a glyph or a tag has in the pane: the mock's hex for the four status keys, the theme key otherwise. */
const paneColor = (key: string): string => PANE_COLOR[key] ?? key

/** One row of the pane. A `rule` is a divider; `text` a wrapped line; `row` a left side, a right side and buttons; `actions` buttons and a hint. */
export type Item =
  | { kind: 'rule' }
  | { kind: 'header'; label: string }
  | { kind: 'text'; indent: number; text: string; tone?: 'dim' | 'warning'; strong?: boolean; size?: 'caption' | 'heading'; boxed?: boolean; subject?: { key: string; subject: DetailSubject } }
  | { kind: 'row'; indent: number; glyph?: Glyph; label?: Label; secondary?: string; right?: Right; buttons?: OwnerButton[]; boxed?: boolean; heading?: boolean; tint?: boolean }
  | { kind: 'actions'; indent: number; buttons: OwnerButton[]; hint?: string; boxed?: boolean }
  | { kind: 'docs'; docs: { file: string; label: string }[] }

/** What the builder needs besides the view: the time, the folds, the filled mark and the width. */
export type Ctx = {
  now: number
  isRefreshing: boolean
  collapsed: Record<string, boolean>
  filled: { key: string; text: string } | null
  columns: number
  /** The text form: every fold open, the `via` line, no show-more button. */
  isText: boolean
  /** Whether the pane is open: the next tick is only drawn then. */
  isPaneUp: boolean
  /** The surface the pane is drawn on: a rule is a clipped run of `─` on the terminal and an unclipped one elsewhere. */
  surface?: 'terminal' | 'desktop' | 'mobile'
}

const ELLIPSIS = '…'
const ROWS_SHOWN = 6
const PENDING_SHOWN = 6
const SOLO = '─'

const GLYPH = {
  claude: { char: '●', color: 'claude' },
  owner: { char: '◐', color: 'warning' },
  github: { char: '◐', color: 'suggestion' },
  stopped: { char: '✕', color: 'error' },
  waiting: { char: '○', color: 'inactive' },
  met: { char: '✓', color: 'success' },
  partial: { char: '◐', color: 'warning' },
  archived: { char: '✓', color: 'subtle' },
  unreadable: { char: '!', color: 'warning' },
} as const satisfies Record<string, Glyph>

const pad = (n: number): string => String(n).padStart(2, '0')

/** `hh:mm` of an epoch time, in the machine's zone. */
export const clockTime = (ms: number): string => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The glyph of who acts (design D8); a stopped actor or a blocked state is stopped, `none` is nobody. */
const actorGlyph = (actor: string, state = ''): Glyph => {
  if (state.startsWith('blocked')) return GLYPH.stopped
  switch (actor) {
    case 'session':
    case 'subagent':
    case 'review':
    case 'gate':
    case 'main':
      return GLYPH.claude
    case 'owner':
      return GLYPH.owner
    case 'github':
      return GLYPH.github
    case 'stop':
      return GLYPH.stopped
    default:
      return GLYPH.waiting
  }
}

/** The glyph of a change by who acts; a change the checker could not read is stopped. */
const changeGlyph = (entry: ChangeEntry | undefined): Glyph => (entry?.row === undefined ? GLYPH.stopped : actorGlyph(entry.row.next.actor, entry.row.state))

const itemGlyph = (status: string): Glyph => (status === 'met' ? GLYPH.met : status === 'blocked' ? GLYPH.stopped : GLYPH.waiting)

const childGlyph = (state: SessionState): Glyph => (state === 'running' ? GLYPH.claude : state === 'archived' ? GLYPH.archived : GLYPH.waiting)

const checksGlyph = (status: ChecksStatus): Glyph =>
  status === 'green' ? GLYPH.met : status === 'red' ? GLYPH.stopped : status === 'running' ? GLYPH.claude : GLYPH.unreadable

const stepGlyph = (status: Flow['steps'][number]['status'], isError: boolean): Glyph =>
  isError ? GLYPH.stopped : status === 'done' ? GLYPH.met : status === 'partial' ? GLYPH.partial : status === 'current' ? GLYPH.claude : GLYPH.waiting

/** Whether a fold is folded now: the owner's mark, else the default (design D7); the text form has every fold open. */
const isFolded = (ctx: Ctx, key: string, isConducted: boolean): boolean => {
  if (ctx.isText) return false
  const mark = ctx.collapsed[key]
  if (mark !== undefined) return mark
  if (key === 'in-progress') return isConducted
  return true
}

/** The default of a fold key, for the toggle handler. */
export const foldedNow = (collapsed: Record<string, boolean>, key: string, isConducted: boolean): boolean =>
  isFolded({ now: 0, isRefreshing: false, collapsed, filled: null, columns: 0, isText: false, isPaneUp: true }, key, isConducted)

const notice = (text: string): Item => ({ kind: 'text', indent: 0, text, tone: 'dim' })

const fold = (ctx: Ctx, key: string, isConducted: boolean, chevron = true): NonNullable<Label['fold']> => ({ key, open: !isFolded(ctx, key, isConducted), chevron })

/**
 * A stored view of an earlier shape (a build whose `conducted` had no `docs`, no `progress`...) read with defaults, never a crash
 * (design D7: the `view-4` tag declines an older store; this covers a store the engine handed over anyway).
 */
export const withDefaults = (view: PanelView): PanelView => ({
  ...view,
  changes: view.changes ?? {},
  progress: view.progress ?? {},
  inProgress: view.inProgress ?? [],
  sessions: view.sessions ?? [],
  ...(view.conducted === undefined ? {} : { conducted: { ...view.conducted, docs: view.conducted.docs ?? [], folder: view.conducted.folder ?? '' } }),
})

/** What the conducted change draws from: its row, reports, tasks, files and the ten steps (design D22, D25). */
export type Model = {
  id: string
  entry: ChangeEntry | undefined
  row: ChangeRow | undefined
  deliver: DeliverReport | undefined
  deliverError: string | undefined
  tasks: TaskSections | undefined
  files: ReadonlySet<string>
  flow: Flow | undefined
  actor: string
}

/** The conducted change's model; undefined with none conducted. */
export const modelOf = (stored: PanelView, text: UiText): Model | undefined => {
  const view = withDefaults(stored)
  const conducted = view.conducted
  if (conducted === undefined) return undefined
  const entry = view.changes[conducted.id]
  const row = entry?.row
  const report = conducted.deliver
  const deliver = report !== undefined && !('error' in report) ? report : undefined
  const deliverError = report !== undefined && 'error' in report ? report.error : undefined
  const files = new Set(conducted.docs.map(d => d.file))
  const flow = row === undefined ? undefined : flowSteps(row, report, conducted.tasks, files, text, conducted.approvedOn)
  return { id: conducted.id, entry, row, deliver, deliverError, tasks: conducted.tasks, files, flow, actor: row === undefined ? 'none' : actorOf(row, report) }
}

/** One of the error lines under the header: its detail key and its full line. */
type ErrorLine = { key: string; line: string }

const errorLines = (view: PanelView, model: Model | undefined, text: UiText): ErrorLine[] => {
  const out: ErrorLine[] = []
  if (view.error !== undefined) out.push({ key: 'view', line: text.pane.error(view.error) })
  if (model?.entry?.error !== undefined) out.push({ key: 'change', line: model.entry.error })
  if (model?.deliverError !== undefined) out.push({ key: 'deliver', line: `deliver-check: ${model.deliverError}` })
  if (view.listError !== undefined) out.push({ key: 'list', line: text.pane.listError(view.listError) })
  return out
}

/** The full text behind an error line's key, for the detail pane; undefined when it is gone. */
export const errorText = (view: PanelView, key: string, text: UiText): string | undefined =>
  errorLines(view, modelOf(view, text), text).find(e => e.key === key)?.line

/** The pending rows (design D8 item 6, D27): the open tasks, else the current step's pending things. */
type PendingRow = { id?: string; title: string; tag: string }

const pendingRows = (model: Model, text: UiText): PendingRow[] => {
  const open = (model.tasks?.sections ?? []).flatMap(s => s.tasks.filter(t => !t.done).map((t): PendingRow => ({ id: t.id, title: t.title, tag: text.pane.tag(t.tag) })))
  if (open.length > 0) return open
  return stepPendingLines(model).map(l => ({ title: l.label, tag: l.word === undefined ? '' : text.pane.word(l.word) }))
}

/** The current step's pending things: its items' short lists (design D21). */
const stepPendingLines = (model: Model): ItemLine[] => {
  const key = model.flow?.steps.find(s => s.status === 'current')?.key
  if (key === undefined) return []
  return STEP_ITEMS[key].flatMap(id => {
    const item = model.deliver?.items.find(i => i.id === id)
    return item === undefined ? [] : itemLines(item, id === 1 ? (key === 'implementation' ? 'tasks' : 'proofs') : undefined)
  })
}

const stepName = (key: StepKey, text: UiText): string => text.pane.stepName(key)

const repoName = (view: PanelView): string => view.repo ?? ''

/** The change block and the `Agora` box (design D8 items 3 and 4). */
const changeItems = (view: PanelView, model: Model, text: UiText, ctx: Ctx): Item[] => {
  const conducted = view.conducted
  const items: Item[] = [
    { kind: 'text', indent: 0, text: text.pane.caption, tone: 'dim', size: 'caption' },
    { kind: 'text', indent: 0, text: model.id, strong: true, size: 'heading' },
  ]
  if (conducted?.summary !== undefined) items.push({ kind: 'text', indent: 0, text: conducted.summary })
  const branch = model.row?.branch
  if (branch !== undefined) items.push({ kind: 'text', indent: 0, text: text.pane.repoLine(repoName(view), branch), tone: 'dim', size: 'caption' })
  if (ctx.isText && conducted !== undefined) items.push({ kind: 'text', indent: 0, text: text.pane.via(conducted.via), tone: 'dim' })
  const { row, flow } = model
  if (row === undefined || flow === undefined) return items
  const buttons = nowButtons(row, text)
  const isFilled = buttons.some(b => ctx.filled?.key === b.key)
  items.push(
    { kind: 'row', indent: 0, boxed: true, label: { text: text.pane.now, dim: true, size: 'caption' }, right: { text: text.pane.pill(model.actor), pill: true } },
    { kind: 'text', indent: 0, boxed: true, text: flow.now.title, strong: true },
  )
  if (flow.now.left !== undefined) items.push({ kind: 'text', indent: 0, boxed: true, text: flow.now.left, tone: 'dim', size: 'caption' })
  if (flow.now.then !== '') items.push({ kind: 'text', indent: 0, boxed: true, text: flow.now.then, tone: 'dim', size: 'caption' })
  items.push({ kind: 'actions', indent: 0, boxed: true, buttons, hint: isFilled ? text.toast.filled : text.pane.hint(model.id) })
  return items
}

/** `Passos`: ten rows with their glyph, name and fact (design D8 item 5, D22). */
const stepItems = (model: Model, text: UiText): Item[] => {
  const flow = model.flow
  if (flow === undefined) return []
  const items: Item[] = [{ kind: 'row', indent: 0, heading: true, label: { text: text.pane.steps, strong: true }, right: { text: text.pane.stepsCount(flow.done) } }]
  for (const step of flow.steps) {
    const fact = [step.fact, step.label].filter((p): p is string => p !== undefined && p !== '').join(' · ')
    items.push({
      kind: 'row',
      indent: 0,
      ...(step.status === 'current' ? { tint: true } : {}),
      glyph: stepGlyph(step.status, step.isError === true),
      label: { text: stepName(step.key, text), strong: step.status === 'current', dim: step.status === 'pending', subject: { key: `step:${step.key}`, subject: { kind: 'step', key: step.key } } },
      ...(fact !== '' || step.hasMore === true ? { right: { text: `${fact}${step.hasMore === true ? ' ›' : ''}`.trim() } } : {}),
    })
  }
  return items
}

/** `Pendências` (design D8 item 6): at most six rows then `+N`, each a press that opens the pending detail. */
const pendingItems = (model: Model, text: UiText, ctx: Ctx): Item[] => {
  const rows = pendingRows(model, text)
  if (rows.length === 0) return []
  const shown = ctx.isText ? rows : rows.slice(0, PENDING_SHOWN)
  const items: Item[] = [{ kind: 'row', indent: 0, heading: true, label: { text: text.pane.pending, strong: true }, right: { text: String(rows.length) } }]
  shown.forEach((row, i) => {
    items.push({
      kind: 'row',
      indent: 0,
      glyph: GLYPH.partial,
      label: { text: [row.id, row.title].filter(p => p !== undefined).join(' '), subject: { key: `pending:${row.id ?? i}`, subject: { kind: 'pending' } } },
      ...(row.tag !== '' ? { right: { text: row.tag, color: 'warning' } } : {}),
    })
  })
  if (rows.length > shown.length) items.push({ kind: 'text', indent: 0, text: text.pane.more(rows.length - shown.length), tone: 'dim', size: 'caption' })
  return items
}

const DOC_LINKS: readonly string[] = ['proposal.md', 'design.md', 'tasks.md', 'specs', 'evidence.md']

/** `Documentos` (design D8 item 7, D23): the five links, each only when its file exists. */
const documentItems = (view: PanelView, text: UiText): Item[] => {
  const present = (view.conducted?.docs ?? []).filter(d => DOC_LINKS.includes(d.file))
  if (present.length === 0) return []
  return [
    { kind: 'row', indent: 0, heading: true, label: { text: text.pane.documents, strong: true } },
    { kind: 'docs', docs: DOC_LINKS.filter(f => present.some(d => d.file === f)).map(file => ({ file, label: text.pane.docName(file) })) },
  ]
}

/** `Sessões desta change` (design D8 item 8, D9): the live children, the archived ones folded into one row. */
const sessionItems = (view: PanelView, model: Model, text: UiText, ctx: Ctx): Item[] => {
  const conducted = view.conducted
  const prefix = model.row?.sessionPrefix
  const shared = conducted?.sharedWith
  const children = shared !== undefined ? [] : childrenOf(view.sessions, prefix).sort((a, b) => (phaseOf(a.name, prefix) ?? 0) - (phaseOf(b.name, prefix) ?? 0))
  const items: Item[] = [{ kind: 'row', indent: 0, heading: true, label: { text: text.pane.sessions, strong: true }, right: { text: shared !== undefined ? '—' : String(children.length) } }]
  if (view.permission !== undefined) items.push({ kind: 'text', indent: 0, text: text.pane.permission(view.permission), tone: 'dim' })
  if (shared !== undefined) {
    items.push({ kind: 'text', indent: 0, text: text.pane.sharedPrefix(shared.join(', ')), tone: 'dim' })
    return items
  }
  const phaseTitle = (n: number): string => model.tasks?.sections.find(s => s.n === n)?.short ?? shortTitle(model.deliver?.phases.find(p => p.n === n)?.title ?? '')
  const childRow = (child: (typeof children)[number], state: SessionState): Item => {
    const n = phaseOf(child.name, prefix) ?? 0
    const name = text.pane.sessionPhase(n, phaseTitle(n))
    return {
      kind: 'row',
      indent: 0,
      glyph: childGlyph(state),
      label: { text: name, ...(view.canOpen ? { open: child.sessionId } : {}) },
      right: { text: `${text.pane.childState(state)}${view.canOpen ? ' ›' : ''}` },
    }
  }
  const live = children.filter(c => sessionState(c) !== 'archived')
  const archived = children.filter(c => sessionState(c) === 'archived')
  for (const child of live) items.push(childRow(child, sessionState(child)))
  if (archived.length > 0) {
    const group = fold(ctx, 'archived', true)
    items.push({ kind: 'row', indent: 0, label: { text: text.pane.archivedCount(archived.length), dim: true, fold: group } })
    if (group.open) for (const child of archived) items.push(childRow(child, 'archived'))
  }
  if (!view.canOpen && children.length > 0) items.push({ kind: 'text', indent: 0, text: text.pane.openFromSidebar, tone: 'dim' })
  return items
}

/** The rows of the open changes (design D8 items 9, screen 3): id, its progress under it, `Conduzir`; six rows then `mostrar mais`. */
const changeRows = (view: PanelView, text: UiText, ctx: Ctx): Item[] => {
  const items: Item[] = []
  const more = !isFolded(ctx, 'more', true)
  const shown = more || ctx.isText ? view.inProgress : view.inProgress.slice(0, ROWS_SHOWN)
  for (const id of shown) {
    const entry = view.changes[id]
    const button = conductButton(id, text)
    const tasks = view.progress[id]
    const progress = entry?.row === undefined ? '' : progressText(entry.row, tasks, text)
    items.push({
      kind: 'row',
      indent: 0,
      glyph: changeGlyph(entry),
      label: { text: id, subject: { key: `change:${id}`, subject: { kind: 'change', id } } },
      buttons: [button],
    })
    if (progress !== '') items.push({ kind: 'text', indent: 1, text: progress, tone: 'dim', size: 'caption' })
    if (ctx.filled?.key === button.key) items.push({ kind: 'text', indent: 1, text: text.toast.filled, tone: 'dim', size: 'caption' })
    if (entry?.error !== undefined) items.push({ kind: 'text', indent: 1, text: `! ${entry.error}`, tone: 'warning', size: 'caption' })
  }
  if (!more && !ctx.isText && view.inProgress.length > ROWS_SHOWN) {
    items.push({ kind: 'row', indent: 0, label: { text: text.pane.showMore(view.inProgress.length - ROWS_SHOWN), fold: { key: 'more', open: false, chevron: false } } })
  }
  return items
}

/** The progress phrase of another change (design D27) from its stored count: `k de n tarefas`, `plano pronto · 0 de n`, or its step label. */
export const progressText = (row: ChangeRow, count: { done: number; total: number } | undefined, text: UiText): string => {
  if (count === undefined || count.total === 0) return text.pane.step(row.next.step, row.next.phase)
  // the same rule as `progressOf`, from the stored count (the tasks themselves are not kept)
  return progressOf(row, { sections: [{ n: 1, title: '', short: '', tasks: Array.from({ length: count.total }, (_, i) => ({ id: String(i), done: i < count.done, isGate: false, title: '', sentence: '', text: '', tag: 'claude' as const })) }] }, text)
}

/** `Outras changes abertas` (design D8 item 9): one chevron row with the count, folded while a change is conducted. */
const otherItems = (view: PanelView, text: UiText, ctx: Ctx): Item[] => {
  const group = fold(ctx, 'in-progress', true)
  const items: Item[] = [{ kind: 'row', indent: 0, heading: true, label: { text: text.pane.otherChanges, dim: true, fold: group }, right: { text: String(view.inProgress.length) } }]
  if (group.open) items.push({ kind: 'text', indent: 0, text: text.pane.otherChangesHint, tone: 'dim', size: 'caption' }, ...changeRows(view, text, ctx))
  return items
}

/** The footer: the age and the next tick while the pane is open (or the pause) (design D8 item 10). */
const footerText = (view: PanelView, text: UiText, ctx: Ctx): string => {
  if (ctx.isRefreshing) return text.pane.footerRefreshing
  const age = view.refreshedAt === undefined ? 0 : Math.max(0, Math.round((ctx.now - view.refreshedAt) / 1000))
  if (view.backoffUntil !== undefined && view.backoffUntil > ctx.now) return text.pane.footerPaused(age, clockTime(view.backoffUntil))
  const next = ctx.isPaneUp && view.nextAt !== undefined ? Math.max(0, Math.round((view.nextAt - ctx.now) / 1000)) : undefined
  return text.pane.footer(age, next)
}

/** The pane's rows for a view (design D8): screen 1 with a conducted change, screen 3 without one. */
export const buildItems = (stored: PanelView, text: UiText, ctx: Ctx): Item[] => {
  const view = withDefaults(stored)
  if (view.kind === 'not-devkit') return [notice(text.pane.notDevkit)]
  if (view.kind === 'no-checker') return [notice(text.pane.noChecker)]
  if (view.kind === 'old-checker') return [notice(text.pane.oldChecker)]
  const model = modelOf(view, text)
  const items: Item[] = [{ kind: 'header', label: text.pane.title }]
  for (const e of errorLines(view, model, text)) items.push({ kind: 'text', indent: 0, text: `! ${e.line}`, tone: 'warning', size: 'caption', subject: { key: `error:${e.key}`, subject: { kind: 'error', key: e.key } } })
  if (model === undefined && view.permission !== undefined) items.push(notice(text.pane.permission(view.permission)))
  if (view.backoffUntil !== undefined && view.backoffUntil > ctx.now) items.push({ kind: 'text', indent: 0, text: `! ${text.pane.rateLimit(clockTime(view.backoffUntil))}`, tone: 'warning', size: 'caption' })
  items.push({ kind: 'rule' })
  if (model !== undefined) {
    items.push(...changeItems(view, model, text, ctx))
    // a conducted id the checker does not know is its id and the checker's line, and nothing else
    const sections = model.row === undefined ? [] : [stepItems(model, text), pendingItems(model, text, ctx), documentItems(view, text), sessionItems(view, model, text, ctx)]
    for (const section of sections.filter(s => s.length > 0)) items.push({ kind: 'rule' }, ...section)
    items.push({ kind: 'rule' }, ...otherItems(view, text, ctx))
  } else {
    items.push(
      { kind: 'text', indent: 0, text: text.pane.emptyTitle, strong: true, size: 'heading' },
      { kind: 'text', indent: 0, text: text.pane.emptySentence, tone: 'dim' },
      { kind: 'row', indent: 0, heading: true, label: { text: text.pane.openIn(repoName(view)), strong: true }, right: { text: String(view.inProgress.length) } },
      ...changeRows(view, text, ctx),
    )
  }
  items.push({ kind: 'rule' }, { kind: 'text', indent: 0, text: footerText(view, text, ctx), tone: 'dim', size: 'caption' })
  return items
}

const labelText = (label: Label): string => (label.fold === undefined || label.fold.chevron === false ? label.text : `${label.fold.open ? '▾' : '›'} ${label.text}`)

/** One row as the line it draws: its pieces in document order, one space between. */
const lineOf = (item: Item, columns: number): string => {
  switch (item.kind) {
    case 'rule':
      return SOLO.repeat(columns)
    case 'header':
      return item.label
    case 'text':
      return `${'  '.repeat(item.indent)}${item.text}`
    case 'actions':
      return `${'  '.repeat(item.indent)}${[...item.buttons.map(b => b.label), item.hint].filter((p): p is string => p !== undefined).join(' ')}`
    case 'docs':
      return item.docs.map(d => d.label).join(' ')
    case 'row': {
      const pieces = [item.glyph?.char, item.label === undefined ? undefined : labelText(item.label), item.secondary, item.right?.glyph?.char, item.right?.text, ...(item.buttons ?? []).map(b => b.label)]
      return `${'  '.repeat(item.indent)}${pieces.filter((p): p is string => p !== undefined && p !== '').join(' ')}`
    }
  }
}

/** `s` cut to `columns` cells, an ellipsis closing a cut line. */
export const cut = (s: string, columns: number): string => (s.length <= columns ? s : `${s.slice(0, Math.max(0, columns - 1))}${ELLIPSIS}`)

/** The pane as plain text for the `status` command and tool: every fold open, plus `via`; no line is longer than `columns` (design D11, D26). */
export const renderText = (view: PanelView, text: UiText, now: number, isRefreshing: boolean, columns = 100): string => {
  const ctx: Ctx = { now, isRefreshing, collapsed: {}, filled: null, columns, isText: true, isPaneUp: false }
  return buildItems(view, text, ctx).map(item => (item.kind === 'rule' ? SOLO.repeat(columns) : cut(lineOf(item, columns), columns))).join('\n')
}

/** The band's glyph and dim line (design D11), the line cut to `columns`: the conducted change, else the count in progress, else none. */
export const bandParts = (stored: PanelView, text: UiText, columns: number): { glyph?: Glyph; line: string } => {
  const view = withDefaults(stored)
  const model = modelOf(view, text)
  if (model === undefined) return { line: cut(view.inProgress.length > 0 ? text.band.count(view.inProgress.length) : text.band.none, columns) }
  const flow = model.flow
  const current = flow?.steps.find(s => s.status === 'current')
  const step = current === undefined ? '' : [stepName(current.key, text).toLowerCase(), current.fact].filter((p): p is string => p !== undefined && p !== '').join(', ')
  const glyph = model.row === undefined ? GLYPH.stopped : actorGlyph(model.actor, model.row.state)
  const line = [model.id, step, flow?.left, model.row === undefined ? undefined : text.pane.pill(model.actor)].filter((p): p is string => p !== undefined && p !== '').join(' · ')
  return { glyph, line: cut(line, Math.max(1, columns - 2)) }
}

/** The band's line as text: its glyph, then the dim line. */
export const bandLine = (view: PanelView, text: UiText, columns: number): string => {
  const { glyph, line } = bandParts(view, text, columns)
  return glyph === undefined ? line : `${glyph.char} ${line}`
}

type Rendered = RenderElement

/**
 * One divider between two sections on the terminal (design D26): `columns` cells of `─` in a one-row clipped Box (a cell is exact
 * there, and the clip means a stale count never wraps or shows `…`). A graphical surface draws no divider element: its one-row Box
 * is a full text row tall and does not clip, so sections are separated by a top margin on the row that follows (`hasRule`).
 */
const ruleEl = ({ Box, Text }: Pick<PaneElements, 'Box' | 'Text'>, key: string, columns: number): RenderElement => (
  <Box key={key} flexDirection="row" height={1} overflow="hidden" flexShrink={0}>
    <Text dimColor wrap="wrap">
      {SOLO.repeat(columns)}
    </Text>
  </Box>
)

/** Whether a surface draws the divider glyph rule: the terminal does; a graphical surface separates sections by spacing alone. */
const hasRule = (surface: Ctx['surface']): boolean => surface === undefined || surface === 'terminal'

/** The pane as a tree, laid out to the pane's own width (design D8): one keyed row Box per item, the `Agora` rows inside one tinted Box. */
export const renderPane = ({ Box, Text, Button, Link }: PaneElements, items: readonly Item[], text: UiText, ctx: Ctx, actions: PaneActions): RenderElement => {
  const columns = ctx.columns
  const filledKey = ctx.filled?.key
  const buttonEl = (b: OwnerButton) => <Button key={b.key} label={b.key === filledKey ? `✓ ${b.label}` : b.label} onPress={() => actions.fill(b)} />
  const textProps = (o: { tone?: 'dim' | 'warning'; strong?: boolean; size?: 'caption' | 'heading' }): TextProps => ({
    ...(o.tone === 'dim' ? { dimColor: true } : o.tone === 'warning' ? { color: paneColor('warning') } : {}),
    ...(o.strong === true ? { weight: 'semibold' as const } : {}),
    ...(o.size !== undefined ? { size: o.size } : {}),
  })
  /** A Text on a tint: its own ink, never the theme's (a dark theme's light text would vanish on the tint). */
  const inkProps = (o: { tone?: 'dim' | 'warning'; strong?: boolean; size?: 'caption' | 'heading' }): TextProps => ({
    color: o.strong === true ? MOCK.ink : o.tone === 'dim' ? MOCK.body : MOCK.ink,
    ...(o.strong === true ? { weight: 'semibold' as const } : {}),
    ...(o.size !== undefined ? { size: o.size } : {}),
  })
  const labelEl = (label: Label, ink: string | undefined) => {
    const toggle = label.fold
    if (toggle !== undefined) return <Button key={`toggle:${toggle.key}`} plain dimColor={label.dim === true} label={labelText(label)} onPress={() => actions.toggle(toggle.key)} />
    if (label.open !== undefined) {
      const id = label.open
      return <Button key={`open:${id}`} plain label={label.text} onPress={() => actions.open(id)} />
    }
    const press = label.subject
    if (press !== undefined) {
      const name = label.strong === true ? <Text weight="semibold" {...(ink === undefined ? {} : { color: ink })}>{label.text}</Text> : ink === undefined ? label.text : <Text color={ink}>{label.text}</Text>
      return (
        <Button key={press.key} plain dimColor={label.dim === true} onPress={() => actions.detail(press.subject)}>
          {name}
        </Button>
      )
    }
    if (label.link !== undefined) return <Link href={label.link} label={label.text} />
    return (
      <Text wrap="truncate-end" {...textProps({ strong: label.strong, ...(label.dim === true ? { tone: 'dim' as const } : {}), ...(label.size !== undefined ? { size: label.size } : {}) })} {...(ink === undefined ? {} : { color: label.dim === true ? MOCK.dim : ink })}>
        {label.text}
      </Text>
    )
  }
  const rightEl = (right: Right, isOnTint: boolean) => {
    if (right.pill === true) {
      return (
        <Text size="caption" backgroundColor={MOCK.accent} color={MOCK.white}>
          {` ${right.text} `}
        </Text>
      )
    }
    return (
      <Box flexDirection="row" columnGap={1} flexShrink={0}>
        {right.glyph !== undefined && <Text color={paneColor(right.glyph.color)}>{right.glyph.char}</Text>}
        <Text size="caption" {...(right.color !== undefined ? { color: paneColor(right.color) } : isOnTint ? { color: MOCK.dim } : { dimColor: true })}>
          {right.text}
        </Text>
      </Box>
    )
  }
  const render = (item: Item, i: number, spaced = false): Rendered => {
    const key = `row:${i}`
    const lead = spaced ? { marginTop: 1 } : {}
    switch (item.kind) {
      case 'rule':
        return ruleEl({ Box, Text }, key, columns)
      case 'header':
        return (
          <Box key={key} flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={1} width="100%" minWidth={0} {...lead}>
            <Box flexGrow={1} flexShrink={1} minWidth={0}>
              <Text weight="semibold" wrap="truncate-end">
                {item.label}
              </Text>
            </Box>
            <Box flexShrink={0}>
              <Button key="refresh" plain dimColor label={text.labels.refresh} onPress={actions.refresh} />
            </Box>
          </Box>
        )
      case 'text': {
        const press = item.subject
        const isOnTint = item.boxed === true
        return (
          <Box key={key} flexDirection="row" width="100%" minWidth={0} paddingLeft={item.indent * 2} {...lead}>
            {press === undefined ? (
              <Text wrap="wrap" {...(isOnTint ? inkProps(item) : textProps(item))}>
                {item.text}
              </Text>
            ) : (
              <Button key={press.key} plain label={item.text} onPress={() => actions.detail(press.subject)} />
            )}
          </Box>
        )
      }
      case 'docs':
        return (
          <Box key={key} flexDirection="row" flexWrap="wrap" columnGap={2} width="100%" minWidth={0} {...lead}>
            {item.docs.map(d => (
              <Button key={`doc:${d.file}`} plain label={d.label} onPress={() => actions.detail({ kind: 'doc', file: d.file })} />
            ))}
          </Box>
        )
      case 'actions':
        return (
          <Box key={key} flexDirection="row" columnGap={1} flexWrap="wrap" alignItems="center" paddingLeft={item.indent * 2} paddingTop={item.boxed === true ? 1 : 0} width="100%" minWidth={0}>
            {item.buttons.map(buttonEl)}
            {item.hint !== undefined && (
              <Text size="caption" wrap="wrap" {...(item.boxed === true ? { color: MOCK.dim } : { dimColor: true })}>
                {item.hint}
              </Text>
            )}
          </Box>
        )
      case 'row': {
        const isTint = item.tint === true
        const isOnTint = isTint || item.boxed === true
        const ink = isTint ? MOCK.ink : item.boxed === true ? MOCK.ink : undefined
        return (
          <Box
            key={key}
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            columnGap={1}
            width="100%"
            minWidth={0}
            paddingLeft={item.indent * 2}
            {...(item.heading === true && !spaced ? { paddingTop: 1 } : {})}
            {...lead}
            {...(isTint ? { backgroundColor: MOCK.stepBg, paddingX: 1, marginX: -1, width: '100%' } : {})}
          >
            <Box flexDirection="row" columnGap={1} flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
              {item.glyph !== undefined && <Text color={paneColor(item.glyph.color)}>{item.glyph.char}</Text>}
              {item.label !== undefined && labelEl(item.label, ink)}
              {item.secondary !== undefined && (
                <Text dimColor wrap="truncate-end">
                  {item.secondary}
                </Text>
              )}
            </Box>
            <Box flexDirection="row" columnGap={1} flexShrink={0}>
              {item.right !== undefined && rightEl(item.right, isOnTint)}
              {item.buttons?.map(buttonEl)}
            </Box>
          </Box>
        )
      }
    }
  }
  // the rows of the `Agora` box are one tinted Box (the mock's #F6F5F2, no outline); every other row is a keyed row of the column
  const out: Rendered[] = []
  let boxed: Rendered[] = []
  const flush = (at: number): void => {
    if (boxed.length === 0) return
    out.push(
      <Box key={`box:${at}`} flexDirection="column" backgroundColor={MOCK.nowBg} paddingX={1} paddingY={1} rowGap={0} width="100%" minWidth={0}>
        {boxed}
      </Box>,
    )
    boxed = []
  }
  let spaced = false
  items.forEach((item, i) => {
    if (item.kind === 'rule' && !hasRule(ctx.surface)) {
      spaced = true
      return
    }
    const isBoxed = item.kind !== 'rule' && item.kind !== 'header' && item.kind !== 'docs' && item.boxed === true
    if (isBoxed) {
      boxed.push(render(item, i))
      spaced = false
      return
    }
    flush(i)
    out.push(render(item, i, spaced))
    spaced = false
  })
  flush(items.length)
  return (
    <Box flexDirection="column" width="100%" minWidth={0} paddingX={1} rowGap={0}>
      {out}
    </Box>
  )
}

/** The band above the prompt: the actor glyph, the one dim line and the button that opens or closes the pane (design D11). */
export const renderBand = ({ Box, Text, Button }: Pick<PaneElements, 'Box' | 'Text' | 'Button'>, view: PanelView, isPaneUp: boolean, text: UiText, columns: number, togglePane: () => void): RenderElement => {
  const label = isPaneUp ? text.labels.close : text.labels.open
  const { glyph, line } = bandParts(view, text, Math.max(8, columns - label.length - 1))
  return (
    <Box flexDirection="row" justifyContent="space-between" columnGap={1} width={columns} minWidth={0}>
      <Box flexDirection="row" columnGap={1} flexShrink={1} minWidth={0}>
        {glyph !== undefined && <Text color={glyph.color}>{glyph.char}</Text>}
        <Text dimColor wrap="truncate-end">
          {line}
        </Text>
      </Box>
      <Button key="band:pane" plain dimColor label={label} onPress={togglePane} />
    </Box>
  )
}

// ---------------------------------------------------------------- the detail pane (design D20, D22)

/** One block of the detail pane's body. */
export type Block =
  | { kind: 'rule' }
  | { kind: 'callout'; strong: string; line: string }
  | { kind: 'head'; text: string; right?: string }
  | { kind: 'row'; glyph?: Glyph; text: string; strong?: boolean; dim?: boolean; right?: string; rightColor?: string; indent?: number; press?: { key: string; subject: DetailSubject } }
  | { kind: 'text'; text: string; dim?: boolean; indent?: number }
  | { kind: 'link'; label: string; href: string }
  | { kind: 'file'; file: string; label: string }
  | { kind: 'fold'; label: string; open: boolean; copyText?: string }
  | { kind: 'code'; source: string }
  | { kind: 'tabs'; tabs: { file: string; label: string; active: boolean }[] }
  | { kind: 'index'; heading: string; entries: string[] }
  | { kind: 'doctitle'; title: string; chips: string[] }
  | { kind: 'markdown'; key: string; text: string }
  | { kind: 'bar'; done: number; total: number }
  | { kind: 'button'; button: OwnerButton }

/** The detail pane as data: its frame (title, subtitle, footer) and its body blocks. */
export type DetailModel = { title: string; subtitle: string; blocks: Block[]; footer: { file?: string; href?: string; label?: string; hint: string } }

/** What the detail pane needs besides the view: the marks, the file the document subject reads and the width. */
export type DetailCtx = { full: boolean; copied: boolean; copyFailed: boolean; docText: string | undefined; columns: number; surface?: Ctx['surface'] }

// a section whose heading carries `owner-run` is the owner's, gates included (design D25)
const OWNER_RUN_SECTION_RE = /\bowner-run\b/i
const MARKDOWN_CELLS = 90_000
const SECTION_RE = /^## /m

/** A document's name: the tab and the title. */
const docTitle = (file: string, text: UiText): string => text.pane.docName(file)

const factOf = (model: Model | undefined, key: StepKey): string => model?.flow?.steps.find(s => s.key === key)?.fact ?? ''

/** The detail pane's title for a subject (design D20). */
export const detailTitle = (view: PanelView, subject: DetailSubject, text: UiText): string => {
  switch (subject.kind) {
    case 'pending':
      return text.detail.pendingTitle
    case 'step':
      return STEP_KEYS.includes(subject.key as StepKey) ? stepName(subject.key as StepKey, text) : subject.key
    case 'doc':
      return docTitle(subject.file, text)
    case 'change':
      return subject.id
    case 'error':
      return errorText(view, subject.key, text)?.split(':')[0] ?? subject.key
  }
}

/** The item blocks of a delivery item (design D22, "Step details"): its head row, then its short list (eight, then `+N`). */
const itemBlocks = (item: DeliverItem, part: 'tasks' | 'proofs' | undefined, text: UiText): Block[] => {
  const lines = itemLines(item, part)
  const summary = itemSummary(lines, text)
  const blocks: Block[] = [{ kind: 'row', glyph: itemGlyph(item.status), text: text.pane.item(item.name), right: text.pane.itemStatus(item.status) }]
  if (summary !== '' && lines.length > 1) blocks.push({ kind: 'text', text: summary, dim: true, indent: 1 })
  const { lines: shown, more } = capLines(lines)
  for (const line of shown) blocks.push({ kind: 'row', indent: 1, text: line.label, right: line.word === undefined ? undefined : text.pane.word(line.word), dim: true })
  if (more > 0) blocks.push({ kind: 'text', text: text.pane.more(more), dim: true, indent: 1 })
  return blocks
}

const rawReasons = (items: readonly DeliverItem[]): string => items.map(i => `${i.name}: ${i.reason ?? ''}`).join('\n')

/** The full text behind a fold: the open tasks' text, else the raw reasons of the step's items. */
const pendingFullText = (model: Model): string => {
  const open = (model.tasks?.sections ?? []).flatMap(s => s.tasks.filter(t => !t.done).map(t => t.text))
  if (open.length > 0) return open.join('\n\n')
  const key = model.flow?.steps.find(s => s.status === 'current')?.key
  return rawReasons(model.deliver?.items.filter(i => key !== undefined && STEP_ITEMS[key].includes(i.id)) ?? [])
}

const pendingBlocks = (model: Model | undefined, section: number | undefined, text: UiText, ctx: DetailCtx): { blocks: Block[]; subtitle: string; copy: string } => {
  if (model === undefined) return { blocks: [{ kind: 'text', text: text.pane.noLongerOpen, dim: true }], subtitle: '', copy: '' }
  const counts = model.tasks === undefined ? undefined : countTasks(model.tasks)
  const subtitle = counts === undefined ? model.id : text.detail.pendingSubtitle(model.id, counts.open, counts.total)
  const sections = (model.tasks?.sections ?? []).filter(s => (section === undefined || s.n === section) && s.tasks.some(t => !t.done))
  const open = sections.flatMap(s => s.tasks.filter(t => !t.done))
  const blocks: Block[] = []
  const flow = model.flow
  const tags = new Set(open.map(t => t.tag))
  const [only] = [...tags]
  const who = only === 'owner' ? text.pane.actor('owner') : only === 'gate' ? text.pane.tag('gate') : text.pane.actor('session')
  if (open.length > 0 || stepPendingLines(model).length > 0) {
    const count = open.length > 0 ? open.length : stepPendingLines(model).length
    blocks.push({
      kind: 'callout',
      strong: open.length > 0 && tags.size === 1 ? text.detail.allWait(who) : text.detail.kPending(count),
      line: `${flow?.now.title ?? ''}${flow === undefined ? '' : '. '}${text.detail.whoActs(text.pane.actor(model.actor))}`.trim(),
    })
  }
  if (open.length > 0) {
    for (const s of sections) {
      const rows = s.tasks.filter(t => !t.done)
      blocks.push({ kind: 'head', text: text.detail.section(s.n, s.short), right: String(rows.length) })
      for (const t of rows) {
        blocks.push({ kind: 'row', glyph: GLYPH.partial, text: [t.id, t.title].join(' ') })
        if (t.sentence !== '') blocks.push({ kind: 'text', text: t.sentence, dim: true, indent: 1 })
      }
    }
  } else {
    const items = (flow?.steps.find(s => s.status === 'current')?.items ?? []).flatMap(id => model.deliver?.items.find(i => i.id === id) ?? [])
    const key = flow?.steps.find(s => s.status === 'current')?.key
    const shown = items.flatMap(item => itemBlocks(item, item.id === 1 ? (key === 'implementation' ? 'tasks' : 'proofs') : undefined, text))
    blocks.push(...(shown.length > 0 ? shown : [{ kind: 'text' as const, text: text.pane.nothingPending, dim: true }]))
  }
  const copy = pendingFullText(model)
  blocks.push({ kind: 'rule' }, { kind: 'fold', label: text.detail.fullText, open: ctx.full, copyText: copy })
  if (ctx.full) blocks.push({ kind: 'code', source: copy })
  return { blocks, subtitle, copy }
}

/** Screen 6, the Implementation step (design D20): the count, the bar, what is missing by section, what is done. */
const implementationBlocks = (model: Model, text: UiText): Block[] => {
  const tasks = model.tasks
  if (tasks === undefined) return [{ kind: 'text', text: text.pane.nothingPending, dim: true }]
  const { done, total } = countTasks(tasks)
  const blocks: Block[] = [
    { kind: 'row', text: text.detail.tasksOf(done, total), strong: true, right: text.detail.percent(total === 0 ? 0 : Math.round((done / total) * 100)) },
    { kind: 'bar', done, total },
  ]
  const missing = tasks.sections.filter(s => s.tasks.some(t => !t.done))
  const finished = tasks.sections.filter(s => s.tasks.length > 0 && s.tasks.every(t => t.done))
  blocks.push({ kind: 'rule' }, { kind: 'head', text: text.detail.missing, right: text.detail.sectionsTasks(missing.length, missing.reduce((n, s) => n + s.tasks.filter(t => !t.done).length, 0)) })
  for (const s of missing) {
    const sectionDone = s.tasks.filter(t => t.done).length
    const open = s.tasks.filter(t => !t.done)
    const tag = open.every(t => t.tag === 'owner') || OWNER_RUN_SECTION_RE.test(s.title) ? text.pane.tag('owner') : open.every(t => t.tag === 'gate') ? text.pane.tag('gate') : text.pane.tag('claude')
    blocks.push({ kind: 'row', glyph: GLYPH.partial, text: `${s.n} ${s.short}`, right: `${sectionDone}/${s.tasks.length} · ${tag} ›`, press: { key: `section:${s.n}`, subject: { kind: 'pending', section: s.n } } })
  }
  blocks.push({ kind: 'rule' }, { kind: 'head', text: text.detail.done, right: text.detail.sectionsCount(finished.length) })
  for (const s of finished) blocks.push({ kind: 'row', glyph: GLYPH.met, text: `${s.n} ${s.short}`, right: `${s.tasks.length}/${s.tasks.length}`, dim: true })
  return blocks
}

const fileBlock = (model: Model, file: string, text: UiText): Block[] => (model.files.has(file) ? [{ kind: 'file', file, label: text.labels.seeFile(file) }] : [])

/** The body of a step other than Implementation (design D22, "Step details"). */
const stepBlocks = (model: Model, key: StepKey, text: UiText, ctx: DetailCtx): Block[] => {
  const { deliver, row, flow } = model
  const step = flow?.steps.find(s => s.key === key)
  const itemsOf = (ids: readonly number[]): DeliverItem[] => ids.flatMap(id => deliver?.items.find(i => i.id === id) ?? [])
  const blocks: Block[] = []
  const reasons = (items: readonly DeliverItem[]): void => {
    blocks.push({ kind: 'fold', label: text.detail.fullTextShort, open: ctx.full })
    if (ctx.full) blocks.push({ kind: 'code', source: rawReasons(items) })
  }
  switch (key) {
    case 'requirements': {
      const ids = itemsOf([4])[0]?.details?.ids ?? []
      const { lines, more } = capLines(ids)
      blocks.push({ kind: 'text', text: text.pane.fact.criteria(ids.length), dim: true }, ...lines.map((id): Block => ({ kind: 'row', text: id })))
      if (more > 0) blocks.push({ kind: 'text', text: text.pane.more(more), dim: true })
      blocks.push(...fileBlock(model, 'requirements.md', text))
      return blocks
    }
    case 'plan':
      for (const file of ['proposal.md', 'design.md', 'tasks.md']) blocks.push({ kind: 'row', glyph: model.files.has(file) ? GLYPH.met : GLYPH.waiting, text: file })
      if (step?.fact !== undefined) blocks.push({ kind: 'text', text: step.fact, dim: true })
      blocks.push(...fileBlock(model, 'design.md', text))
      return blocks
    case 'readiness':
      blocks.push({ kind: 'text', text: step?.fact ?? flow?.now.title ?? '' }, ...fileBlock(model, 'readiness.md', text))
      return blocks
    case 'approval':
      blocks.push({ kind: 'text', text: model.files.has('approval.md') ? (step?.fact ?? text.pane.fact.approved) : text.detail.noApproval }, ...fileBlock(model, 'approval.md', text))
      return blocks
    case 'implementation':
      return implementationBlocks(model, text)
    case 'review': {
      const items = itemsOf(STEP_ITEMS.review)
      const round = row?.next.round ?? (typeof deliver?.next.round === 'number' ? deliver.next.round : undefined)
      if (round !== undefined) blocks.push({ kind: 'text', text: text.pane.fact.round(round), dim: true })
      for (const item of items) blocks.push(...itemBlocks(item, undefined, text))
      reasons(items)
      return blocks
    }
    case 'proofs': {
      const items = itemsOf(STEP_ITEMS.proofs)
      for (const item of items) blocks.push(...itemBlocks(item, item.id === 1 ? 'proofs' : undefined, text))
      blocks.push(...fileBlock(model, 'evidence.md', text))
      reasons(items)
      return blocks
    }
    case 'pr': {
      const items = itemsOf(STEP_ITEMS.pr)
      if (deliver?.pr !== null && deliver?.pr !== undefined) {
        const checks = checksStatus(deliver)
        blocks.push({ kind: 'link', label: text.pane.pr(deliver.pr.number), href: deliver.pr.url })
        if (checks !== undefined) blocks.push({ kind: 'row', glyph: checksGlyph(checks), text: text.pane.checks(checks) })
        for (const item of items) blocks.push(...itemBlocks(item, undefined, text))
      } else {
        blocks.push({ kind: 'text', text: text.pane.noPr, dim: true })
        const five = items.find(i => i.id === 5)
        if (five !== undefined) blocks.push(...itemBlocks(five, undefined, text))
      }
      reasons(items)
      return blocks
    }
    case 'merge':
    case 'retro': {
      const label = row === undefined ? '' : text.pane.step(row.next.step, row.next.phase)
      const isCurrent = step?.status === 'current'
      if (isCurrent && label !== '') blocks.push({ kind: 'row', text: label, strong: true })
      const lines = isCurrent && row?.next.reason !== undefined ? row.next.reason.split(';').map(c => c.trim()).filter(c => c !== '') : []
      if (lines.length > 0) blocks.push(...lines.map((l): Block => ({ kind: 'text', text: l, dim: true })))
      else if (step?.status === 'done') blocks.push({ kind: 'text', text: text.detail.stepDone, dim: true })
      if (key === 'retro') blocks.push(...fileBlock(model, 'retro.md', text))
      return blocks
    }
  }
}

/** A document's sections: the `## ` headings of its text, and one markdown chunk per section (design D20, screen 5). */
export const sectionsOf = (source: string): { headings: string[]; chunks: { key: string; text: string }[] } => {
  const cut_ = source.length > MARKDOWN_CELLS ? source.slice(0, MARKDOWN_CELLS) : source
  const parts = cut_.split(SECTION_RE)
  const headings: string[] = []
  const chunks: { key: string; text: string }[] = []
  parts.forEach((part, i) => {
    if (i === 0) {
      if (part.trim() !== '') chunks.push({ key: 'sec:pre', text: part })
      return
    }
    const heading = part.split('\n')[0]?.trim() ?? ''
    headings.push(heading)
    chunks.push({ key: `sec:${i - 1}`, text: `## ${part}` })
  })
  return { headings, chunks }
}

const FRONT_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const CHIPS_SHOWN = 6

/**
 * A document split for the pane (screen 5): its first `# ` heading as the title, the values of a leading front matter as the
 * metadata chips (a list value one chip per item), and the rest as the Markdown body.
 */
export const docParts = (source: string): { title: string | undefined; chips: string[]; body: string } => {
  const front = FRONT_RE.exec(source)
  const chips: string[] = []
  for (const line of (front?.[1] ?? '').split(/\r?\n/)) {
    const value = /^[\w-]+:\s*(.+)$/.exec(line)?.[1]?.trim()
    if (value === undefined || value === '') continue
    for (const item of value.replace(/^\[|\]$/g, '').split(',')) {
      const chip = item.trim().replace(/^["']|["']$/g, '')
      if (chip !== '') chips.push(chip)
    }
  }
  const rest = front === null ? source : source.slice(front[0].length)
  const heading = /^# (.+)$/m.exec(rest)
  const isLeading = heading !== null && rest.slice(0, heading.index).trim() === ''
  const body = isLeading ? rest.slice(heading.index + heading[0].length).replace(/^\r?\n/, '') : rest
  return { title: isLeading ? heading[1]?.trim() : undefined, chips: chips.slice(0, CHIPS_SHOWN), body }
}

const docBlocks = (model: Model, file: string, text: UiText, ctx: DetailCtx): Block[] => {
  const blocks: Block[] = []
  const docs = (modelDocs(model) ?? []).map(f => ({ file: f, label: docTitle(f, text), active: f === file }))
  blocks.push({ kind: 'tabs', tabs: docs })
  if (ctx.docText === undefined) return [...blocks, { kind: 'text', text: text.detail.fileMissing, dim: true }]
  const parts = docParts(ctx.docText)
  const { headings, chunks } = sectionsOf(parts.body)
  if (headings.length > 0) blocks.push({ kind: 'rule' }, { kind: 'index', heading: text.detail.sections, entries: headings })
  if (parts.title !== undefined || parts.chips.length > 0) blocks.push({ kind: 'rule' }, { kind: 'doctitle', title: parts.title ?? docTitle(file, text), chips: parts.chips })
  for (const chunk of chunks) blocks.push({ kind: 'markdown', key: chunk.key, text: chunk.text })
  if (ctx.docText.length > MARKDOWN_CELLS) blocks.push({ kind: 'text', text: text.detail.cut, dim: true })
  return blocks
}

const modelDocs = (model: Model): string[] => ['requirements.md', 'proposal.md', 'design.md', 'tasks.md', 'specs', 'readiness.md', 'approval.md', 'evidence.md', 'retro.md'].filter(f => model.files.has(f))

/** Another open change in the detail pane (design D20): its progress, its step, who acts and its `Conduzir` button. */
const changeBlocks = (view: PanelView, id: string, text: UiText): { blocks: Block[]; subtitle: string } => {
  const entry = view.changes[id]
  if (entry === undefined || entry.dropped !== undefined || !view.inProgress.includes(id)) return { blocks: [{ kind: 'text', text: text.pane.noLongerOpen, dim: true }], subtitle: '' }
  const row = entry.row
  const progress = row === undefined ? '' : progressText(row, view.progress[id], text)
  const blocks: Block[] = []
  if (row !== undefined) {
    blocks.push({ kind: 'row', glyph: actorGlyph(row.next.actor, row.state), text: text.pane.step(row.next.step, row.next.phase), right: text.pane.pill(row.next.actor) })
    if (row.state !== '') blocks.push({ kind: 'text', text: row.state, dim: true, indent: 1 })
  }
  if (entry.error !== undefined) blocks.push({ kind: 'text', text: `! ${entry.error}`, dim: true })
  blocks.push({ kind: 'button', button: conductButton(id, text) }, { kind: 'text', text: text.pane.conductMeaning, dim: true })
  return { blocks, subtitle: progress }
}

/** The detail pane's model for a subject (design D20); a subject that is gone is one dim line. */
export const buildDetail = (stored: PanelView, subject: DetailSubject, text: UiText, ctx: DetailCtx): DetailModel => {
  const view = withDefaults(stored)
  const model = modelOf(view, text)
  const id = model?.id ?? ''
  const gone = (title: string): DetailModel => ({ title, subtitle: '', blocks: [{ kind: 'text', text: text.pane.noLongerOpen, dim: true }], footer: { hint: text.detail.escClose } })
  switch (subject.kind) {
    case 'pending': {
      const out = pendingBlocks(model, subject.section, text, ctx)
      return { title: text.detail.pendingTitle, subtitle: out.subtitle, blocks: out.blocks, footer: { hint: text.detail.escBack } }
    }
    case 'step': {
      if (model === undefined || !STEP_KEYS.includes(subject.key as StepKey)) return gone(subject.key)
      const key = subject.key as StepKey
      const title = stepName(key, text)
      const subtitle = text.detail.subtitle(id, factOf(model, key))
      const footer = key === 'implementation' && model.files.has('tasks.md') ? { file: 'tasks.md', label: text.labels.seeFile('tasks.md'), hint: text.detail.escClose } : { hint: text.detail.escClose }
      return { title, subtitle, blocks: stepBlocks(model, key, text, ctx), footer }
    }
    case 'doc': {
      if (model === undefined || !model.files.has(subject.file)) return gone(docTitle(subject.file, text))
      const doc = view.conducted?.docs.find(d => d.file === subject.file)
      return {
        title: docTitle(subject.file, text),
        subtitle: text.detail.subtitle(id, subject.file === 'specs' ? 'specs/' : subject.file),
        blocks: docBlocks(model, subject.file, text, ctx),
        footer: { href: `file://${doc?.path ?? ''}`, label: text.labels.openInEditor, hint: text.detail.escClose },
      }
    }
    case 'change': {
      const out = changeBlocks(view, subject.id, text)
      return { title: subject.id, subtitle: out.subtitle, blocks: out.blocks, footer: { hint: text.detail.escClose } }
    }
    case 'error': {
      const line = errorText(view, subject.key, text)
      if (line === undefined) return gone(subject.key)
      return { title: line.split(':')[0] ?? line, subtitle: id, blocks: [{ kind: 'code', source: line }], footer: { hint: text.detail.escClose } }
    }
  }
}

/** The detail pane as a tree (design D20): the head with `✕`, the body blocks, the footer. */
export const renderDetail = ({ Box, Text, Button, Link, Code, Markdown }: PaneElements, detail: DetailModel, text: UiText, ctx: DetailCtx, actions: DetailActions): RenderElement => {
  const columns = ctx.columns
  const render = (block: Block, i: number, spaced = false): Rendered => {
    const key = `row:${i}`
    const lead = spaced ? { marginTop: 1 } : {}
    switch (block.kind) {
      case 'rule':
        return ruleEl({ Box, Text }, key, columns)
      case 'callout':
        return (
          <Box key={key} {...lead} flexDirection="column" backgroundColor={MOCK.warnBg} paddingX={1} paddingY={1} rowGap={0} width="100%" minWidth={0}>
            <Text weight="semibold" color={MOCK.warnInk} wrap="wrap">
              {block.strong}
            </Text>
            <Text color={MOCK.body} size="caption" wrap="wrap">
              {block.line}
            </Text>
          </Box>
        )
      case 'head':
        return (
          <Box key={key} flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={1} width="100%" minWidth={0} {...(spaced ? lead : { paddingTop: 1 })}>
            <Box flexGrow={1} flexShrink={1} minWidth={0}>
              <Text weight="semibold" wrap="truncate-end">
                {block.text}
              </Text>
            </Box>
            {block.right !== undefined && (
              <Box flexShrink={0}>
                <Text dimColor size="caption">
                  {block.right}
                </Text>
              </Box>
            )}
          </Box>
        )
      case 'row': {
        const press = block.press
        const name = press === undefined ? <Text wrap="truncate-end" {...(block.dim === true ? { dimColor: true } : {})} {...(block.strong === true ? { weight: 'semibold' as const } : {})}>{block.text}</Text> : <Button key={press.key} plain label={block.text} onPress={() => actions.subject(press.subject)} />
        return (
          <Box key={key} {...lead} flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={1} width="100%" minWidth={0} paddingLeft={(block.indent ?? 0) * 2}>
            <Box flexDirection="row" columnGap={1} flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
              {block.glyph !== undefined && <Text color={paneColor(block.glyph.color)}>{block.glyph.char}</Text>}
              {name}
            </Box>
            {block.right !== undefined && (
              <Box flexShrink={0}>
                <Text size="caption" {...(block.rightColor !== undefined ? { color: paneColor(block.rightColor) } : { dimColor: true })}>
                  {block.right}
                </Text>
              </Box>
            )}
          </Box>
        )
      }
      case 'text':
        return (
          <Box key={key} {...lead} flexDirection="row" width="100%" minWidth={0} paddingLeft={(block.indent ?? 0) * 2}>
            <Text wrap="wrap" {...(block.dim === true ? { dimColor: true, size: 'caption' as const } : {})}>
              {block.text}
            </Text>
          </Box>
        )
      case 'link':
        return (
          <Box key={key} {...lead} flexDirection="row">
            <Link href={block.href} label={block.label} />
          </Box>
        )
      case 'file':
        return (
          <Box key={key} {...lead} flexDirection="row">
            <Button key={`file:${block.file}`} plain label={block.label} onPress={() => actions.subject({ kind: 'doc', file: block.file })} />
          </Box>
        )
      case 'fold':
        return (
          <Box key={key} {...lead} flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={1} minWidth={0}>
            <Button key="detail:full" plain dimColor label={block.open ? block.label.replace('›', '▾') : block.label} onPress={actions.fold} />
            {block.copyText !== undefined && <Button key="detail:copy" label={ctx.copied ? text.labels.copied : text.labels.copy} onPress={press => actions.copy(block.copyText ?? '', press.surface)} />}
          </Box>
        )
      case 'code':
        return (
          <Box key={key} {...lead} flexDirection="column" minWidth={0}>
            <Code source={block.source} />
            {ctx.copyFailed && (
              <Text dimColor size="caption" wrap="wrap">
                {text.detail.copyUnavailable}
              </Text>
            )}
          </Box>
        )
      case 'tabs':
        return (
          <Box key={key} {...lead} flexDirection="row" flexWrap="wrap" columnGap={1} width="100%" minWidth={0}>
            {block.tabs.map(t =>
              t.active ? (
                <Text key={`tab:${t.file}`} backgroundColor={MOCK.chipOn} color={MOCK.white}>
                  {` ${t.label} `}
                </Text>
              ) : (
                <Button key={`tab:${t.file}`} plain onPress={() => actions.subject({ kind: 'doc', file: t.file })}>
                  <Text backgroundColor={MOCK.chipBg} color={MOCK.body}>
                    {` ${t.label} `}
                  </Text>
                </Button>
              ),
            )}
          </Box>
        )
      case 'index':
        return (
          <Box key={key} {...lead} flexDirection="column" width="100%" minWidth={0}>
            <Text dimColor size="caption">
              {block.heading}
            </Text>
            <Box flexDirection="row" flexWrap="wrap" columnGap={2} width="100%" minWidth={0}>
              {block.entries.map((heading, n) => (
                <Button key={`index:${n}`} plain label={heading} onPress={() => actions.scroll(`sec:${n}`)} />
              ))}
            </Box>
          </Box>
        )
      case 'doctitle':
        return (
          <Box key={key} flexDirection="column" rowGap={0} width="100%" minWidth={0} {...(spaced ? lead : { paddingTop: 1 })}>
            <Text weight="semibold" size="heading" wrap="wrap">
              {block.title}
            </Text>
            {block.chips.length > 0 && (
              <Box flexDirection="row" flexWrap="wrap" columnGap={1} width="100%" minWidth={0}>
                {block.chips.map((chip, n) => (
                  <Text key={`chip:${n}`} size="caption" backgroundColor={MOCK.chipBg} color={MOCK.body}>
                    {` ${chip} `}
                  </Text>
                ))}
              </Box>
            )}
          </Box>
        )
      case 'markdown':
        return <Markdown key={block.key} text={block.text} />
      case 'bar': {
        // no glyph run: a filled Box as wide as the share done, then a Box that takes the rest, in a row that never wraps
        const percent = block.total === 0 ? 0 : Math.round((block.done / block.total) * 100)
        return (
          <Box key={key} {...lead} flexDirection="row" flexWrap="nowrap" width="100%" height={1} overflow="hidden" flexShrink={0}>
            <Box width={`${percent}%`} height={1} flexShrink={0} backgroundColor={MOCK.done} />
            <Box flexGrow={1} height={1} backgroundColor={MOCK.rule} />
          </Box>
        )
      }
      case 'button':
        return (
          <Box key={key} {...lead} flexDirection="row">
            <Button key={block.button.key} label={block.button.label} onPress={() => actions.fill(block.button)} />
          </Box>
        )
    }
  }
  const isRuled = hasRule(ctx.surface)
  let spaced = false
  const body: Rendered[] = []
  detail.blocks.forEach((block, i) => {
    if (block.kind === 'rule' && !isRuled) {
      spaced = true
      return
    }
    body.push(render(block, i, spaced))
    spaced = false
  })
  const footer = detail.footer
  return (
    <Box flexDirection="column" width="100%" minWidth={0} paddingX={1} rowGap={0}>
      <Box key="row:head" flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={1} width="100%" minWidth={0}>
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text weight="semibold" wrap="truncate-end">
            {detail.title}
          </Text>
          {detail.subtitle !== '' && (
            <Text dimColor size="caption" wrap="truncate-end">
              {detail.subtitle}
            </Text>
          )}
        </Box>
        <Box flexShrink={0}>
          <Button key="detail:close" plain dimColor label={text.labels.closeMark} onPress={actions.close} />
        </Box>
      </Box>
      {body}
      {footer.href !== undefined && isRuled && ruleEl({ Box, Text }, 'row:footer-rule', columns)}
      <Box key="row:footer" flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={2} flexWrap="wrap" width="100%" minWidth={0} {...(footer.href !== undefined && !isRuled ? { marginTop: 1 } : { paddingTop: 1 })}>
        {footer.file !== undefined && <Button key={`file:${footer.file}`} plain label={footer.label ?? ''} onPress={() => actions.subject({ kind: 'doc', file: footer.file ?? '' })} />}
        {footer.href !== undefined && <Link href={footer.href} label={footer.label ?? footer.href} />}
        <Text dimColor size="caption">
          {footer.hint}
        </Text>
      </Box>
    </Box>
  )
}
