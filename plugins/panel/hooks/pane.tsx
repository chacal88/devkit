// The pane as lines (design D12): `renderLines` is the one view model the pane,
// the band-less `status` command and the tool draw from. `renderPane` draws it
// as a tree with the old mod's palette, `renderText` as plain lines, and
// `renderBand` draws the one line above the prompt (design D9).

import type { BoxProps, ButtonProps, ElementConstructor, RenderElement, TextProps } from 'claude-code'

import type { ChangeRow, DeliverItem, PanelView, RoundReport, SessionRow } from '../types'
import { buttonsFor } from './commands'
import type { OwnerButton } from './commands'
import type { UiText } from './i18n'
import { sessionState } from './sessions'

/** The hue of a state: a change row's pill, a deliver item's mark. */
export type Status = 'done' | 'running' | 'blocked' | 'pending'

/** One run of a line: its text, and how the pane draws it (plain when nothing is said). */
export type Segment = { text: string; tone?: 'dim' | 'strong' | 'warning' | 'link'; pill?: Status; mark?: Status }

export type LineKind = 'header' | 'error' | 'round' | 'change' | 'deliver' | 'item' | 'sessions' | 'group' | 'name' | 'permission' | 'notice'

/** One line of the pane: its runs; what it folds (`toggle:<id>`); its owner buttons. The header carries the Refresh button. */
export type PaneLine = { kind: LineKind; segments: Segment[]; fold?: { id: string; isCollapsed: boolean }; buttons?: OwnerButton[] }

/** The elements a render hook resolves for the pane and the band; the mobile surface has the same three. */
export type PaneElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
}

/** The closures the hooks module hands the pane: each reaches `$`. */
export type PaneActions = {
  refresh: () => void
  toggle: (id: string) => void
  fill: (text: string) => void
}

/** Hex, the old mod's palette: the same hues on every surface. */
export const STATUS_HEX: Record<Status, string> = { done: '#4CAF7D', running: '#D97757', blocked: '#D14343', pending: '#B4B2A9' }
/** Pills: a soft tint behind a darker word of the same hue. */
export const PILL: Record<Status, { bg: string; fg: string }> = {
  running: { bg: '#FAECE7', fg: '#993C1D' },
  done: { bg: '#EAF3DE', fg: '#27500A' },
  pending: { bg: '#F1EFE8', fg: '#5F5E5A' },
  blocked: { bg: '#FCEBEB', fg: '#A32D2D' },
}
/** Actions read as links. */
export const LINK = '#2F6FD6'

const INDENT = '    '
const MARKS: Record<DeliverItem['status'], string> = { met: '+', open: 'o', blocked: 'x' }
const ITEM_STATUS: Record<DeliverItem['status'], Status> = { met: 'done', open: 'pending', blocked: 'blocked' }
const ELLIPSIS = '…'

/** The hue of a change's `state` as `conduct-check` words it (design D12). */
export const stateStatus = (state: string): Status => {
  if (state.startsWith('blocked')) return 'blocked'
  if (state === 'archived' || state.startsWith('done')) return 'done'
  if (state.startsWith('running') || state.startsWith('ready to run')) return 'running'
  return 'pending'
}

const fold = (isCollapsed: boolean): string => (isCollapsed ? '>' : 'v')
const isCollapsed = (collapsed: Record<string, boolean>, key: string): boolean => collapsed[key] ?? true

/** The whole line as text: its runs joined. */
export const lineText = (line: PaneLine): string => line.segments.map(s => s.text).join('')

const rowLines = (row: ChangeRow, view: PanelView, collapsed: Record<string, boolean>, text: UiText): PaneLine[] => {
  const folded = isCollapsed(collapsed, row.id)
  const head: PaneLine = {
    kind: 'change',
    segments: [
      { text: `${fold(folded)} `, tone: 'link' },
      { text: row.id, tone: 'strong' },
      { text: ' · ' },
      { text: row.state, pill: stateStatus(row.state) },
      { text: ` · ${row.next.step} · ${row.next.actor}`, tone: 'dim' },
    ],
    fold: { id: row.id, isCollapsed: folded },
    buttons: buttonsFor(row, view, text),
  }
  if (folded) return [head]
  const lines = [head]
  const deliver = view.delivers[row.id]
  if (deliver !== undefined) {
    if ('error' in deliver) lines.push({ kind: 'deliver', segments: [{ text: `${INDENT}deliver: ${deliver.error}`, tone: 'warning' }] })
    else {
      lines.push({ kind: 'deliver', segments: [{ text: `${INDENT}${text.pane.deliver(deliver.summary, deliver.met, deliver.next.step)}`, tone: 'dim' }] })
      for (const item of deliver.items) {
        const reason = item.reason !== undefined && item.reason !== '' ? ` · ${item.reason}` : ''
        lines.push({
          kind: 'item',
          segments: [{ text: `${INDENT}${item.id} ` }, { text: MARKS[item.status], mark: ITEM_STATUS[item.status] }, { text: ` ${item.name}` }, { text: reason, tone: 'dim' }],
        })
      }
    }
  }
  const children = view.sessions[row.id] ?? []
  if (children.length > 0) {
    lines.push({
      kind: 'sessions',
      segments: [{ text: `${INDENT}${text.pane.sessions}: `, tone: 'dim' }, { text: children.map((s: SessionRow) => `${s.name ?? s.sessionId} · ${sessionState(s)}`).join(', ') }],
    })
  }
  return lines
}

const groupLines = (key: 'others' | 'archived', names: readonly string[], collapsed: Record<string, boolean>, label: string): PaneLine[] => {
  const folded = isCollapsed(collapsed, key)
  const head: PaneLine = {
    kind: 'group',
    segments: [{ text: `${fold(folded)} `, tone: 'link' }, { text: label, tone: 'strong' }, { text: folded && names.length > 0 ? ` · ${names.join(', ')}` : '', tone: 'dim' }],
    fold: { id: key, isCollapsed: folded },
  }
  return folded ? [head] : [head, ...names.map((name): PaneLine => ({ kind: 'name', segments: [{ text: `${INDENT}${name}` }] }))]
}

/** The pane's lines for a view, at `now` (the age of the report), with `refreshing...` while a run is in flight. */
export const renderLines = (view: PanelView, collapsed: Record<string, boolean>, text: UiText, now: number, isRefreshing: boolean): PaneLine[] => {
  if (view.kind === 'not-devkit') return [{ kind: 'notice', segments: [{ text: text.pane.notDevkit }] }]
  if (view.kind === 'no-checker') return [{ kind: 'notice', segments: [{ text: text.pane.noChecker }] }]
  const age = isRefreshing ? text.pane.refreshing : text.pane.updated(view.reportAt === undefined ? 0 : Math.max(0, Math.round((now - view.reportAt) / 1000)))
  const lines: PaneLine[] = [{ kind: 'header', segments: [{ text: text.pane.title, tone: 'strong' }, { text: ` · ${view.checker ?? ''} · ${age}`, tone: 'dim' }] }]
  if (view.error !== undefined) lines.push({ kind: 'error', segments: [{ text: `! ${text.pane.error(view.error)}`, tone: 'warning' }] })
  const report = view.report
  if (report !== undefined) {
    const round = report.round === undefined ? text.pane.noRound : text.pane.round(report.round.n, report.round.title, report.round.done, report.round.total)
    lines.push({
      kind: 'round',
      segments: [{ text: round, tone: 'strong' }, { text: ` · ${text.pane.counts(report.dispatch.length, report.owner.length, report.github.length, report.stopped.length)}`, tone: 'dim' }],
    })
    for (const row of report.changes) lines.push(...rowLines(row, view, collapsed, text))
  }
  lines.push(...groupLines('others', view.others, collapsed, text.pane.others(view.others.length)))
  lines.push(...groupLines('archived', view.archived, collapsed, text.pane.archived(view.archived.length)))
  if (view.permission !== undefined) lines.push({ kind: 'permission', segments: [{ text: text.pane.permission(view.permission), tone: 'warning' }] })
  return lines
}

/** The same view as plain lines, for the `status` command and tool. */
export const renderText = (view: PanelView, collapsed: Record<string, boolean>, text: UiText, now: number, isRefreshing: boolean): string =>
  renderLines(view, collapsed, text, now, isRefreshing).map(lineText).join('\n')

/** `s` cut to `columns` cells, an ellipsis closing a cut line. */
export const cut = (s: string, columns: number): string => (s.length <= columns ? s : `${s.slice(0, Math.max(0, columns - 1))}${ELLIPSIS}`)

/** The band's one line (design D9), cut to `columns`. */
export const bandLine = (report: RoundReport, text: UiText, columns: number): string => {
  const r = report.round
  const line = r === undefined ? text.band.noRound : text.band.line(r.n, r.title, r.done, r.total, report.dispatch.length, report.owner.length, report.github.length, report.stopped.length)
  return cut(line, columns)
}

/** The pane as a tree, sized to `columns` (design D12): one row per line, its runs styled, its buttons after it. */
export const renderPane = ({ Box, Text, Button }: PaneElements, lines: readonly PaneLine[], text: UiText, actions: PaneActions, columns: number): RenderElement => {
  const style = (s: Segment): TextProps => {
    if (s.pill !== undefined) return { backgroundColor: PILL[s.pill].bg, color: PILL[s.pill].fg }
    if (s.mark !== undefined) return { color: STATUS_HEX[s.mark] }
    if (s.tone === 'dim') return { dimColor: true }
    if (s.tone === 'strong') return { weight: 'semibold' }
    if (s.tone === 'warning') return { color: 'warning' }
    if (s.tone === 'link') return { color: LINK }
    return {}
  }
  // one run is one Text; several are runs inside one Text, so a line reads as one element either way
  const lineElement = (line: PaneLine): RenderElement => {
    const runs = line.segments.filter(s => s.text !== '')
    const [only] = runs
    if (only !== undefined && runs.length === 1) {
      return (
        <Text wrap="truncate-end" {...style(only)}>
          {only.text}
        </Text>
      )
    }
    return (
      <Text wrap="truncate-end">
        {runs.map(s => (
          <Text {...style(s)}>{s.text}</Text>
        ))}
      </Text>
    )
  }
  return (
    <Box flexDirection="column" width={columns} minWidth={0}>
      {lines.map(line => (
        <Box flexDirection="row" gap={1} minWidth={0}>
          {lineElement(line)}
          {line.kind === 'header' && <Button key="refresh" plain dimColor label={text.labels.refresh} onPress={actions.refresh} />}
          {line.fold !== undefined && <Button key={`toggle:${line.fold.id}`} plain dimColor label={line.fold.isCollapsed ? '+' : '-'} onPress={() => actions.toggle(line.fold?.id ?? '')} />}
          {(line.buttons ?? []).map(button => (
            <Button key={button.key} label={button.label} onPress={() => actions.fill(button.text)} />
          ))}
        </Box>
      ))}
    </Box>
  )
}

/** The band above the prompt: the round's one dim line and the button that opens or closes the pane (design D9). */
export const renderBand = ({ Box, Text, Button }: PaneElements, report: RoundReport, isPaneUp: boolean, text: UiText, columns: number, togglePane: () => void): RenderElement => {
  const label = isPaneUp ? text.labels.close : text.labels.open
  return (
    <Box flexDirection="row" justifyContent="space-between" columnGap={1} width={columns} minWidth={0}>
      <Box flexShrink={1} minWidth={0}>
        <Text dimColor wrap="truncate-end">
          {bandLine(report, text, Math.max(8, columns - label.length - 1))}
        </Text>
      </Box>
      <Button key="band:pane" plain dimColor label={label} onPress={togglePane} />
    </Box>
  )
}
