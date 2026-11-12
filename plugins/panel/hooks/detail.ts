// Short lists and command labels (design D21) and the change's summary (design D23): pure, pinned by tests.
// A delivery item's reason is never drawn as the paragraph the checker wrote; the steps' details, the pending
// list and the Now box use these.

import type { DeliverItem } from '../types'
import type { UiText, WordKey } from './i18n'

const ELLIPSIS = '…'

/** `s` cut to `columns` cells, an ellipsis closing a cut text. */
export const clip = (s: string, columns: number): string => (s.length <= columns ? s : `${s.slice(0, Math.max(0, columns - 1))}${ELLIPSIS}`)

const LABEL_CELLS = 28
const MAX_LINES = 8

/** One pending thing of an item: what it is, and the word that says its state (none for a clause of a reason). */
export type ItemLine = { label: string; word?: WordKey }

/** The words of a command, a double-quoted part kept whole and without its quotes. */
const words = (command: string): string[] => (command.match(/"[^"]*"|\S+/g) ?? []).map(w => w.replace(/^"|"$/g, ''))

const baseName = (path: string): string => path.split('/').filter(p => p !== '').pop() ?? path

const TEST_FILE_RE = /\.test\.(?:mjs|js|ts)$/

// the version-agnostic form of the bundled binary: `"$(for c in "$HOME/.../claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"`
const BUNDLED_FORM_RE = /"\$\(for c in [^;]*;\s*do[^;]*;\s*done;\s*echo "\$c"\)"/g

/**
 * The short label of a gate command: `test panel (app)`, `validate . (npm)`, `guard suite`, `check.py`,
 * `gen-catalog.py --check`; no `$HOME` path reaches the pane through it.
 */
export const commandLabel = (command: string): string => {
  const parts = words(command.replace(BUNDLED_FORM_RE, '"/claude-code/claude"'))
  const first = parts[0] ?? ''
  if (baseName(first) === 'claude') {
    const at = parts.indexOf('plugin')
    const sub = parts[at + 1]
    const target = parts[at + 2]
    if (at !== -1 && sub !== undefined && target !== undefined) return `${sub} ${baseName(target)} (${first.includes('/claude-code/') ? 'app' : 'npm'})`
  }
  if (first === 'node') {
    if (parts[1] === '--test' && parts[2] !== undefined) return `${baseName(parts[2]).replace(TEST_FILE_RE, '')} suite`
    if (parts[1] !== undefined) return [baseName(parts[1]).replace(/\.m?js$/, ''), ...parts.slice(2)].join(' ')
  }
  if (first === 'python3' && parts[1] !== undefined) return [baseName(parts[1]), ...parts.slice(2)].join(' ')
  if (parts.includes('tsc')) return 'tsc'
  return clip([baseName(first), ...(parts[1] === undefined ? [] : [parts[1]])].join(' '), LABEL_CELLS)
}

const reasonLines = (item: DeliverItem): ItemLine[] =>
  (item.reason ?? '')
    .split(';')
    .map(clause => clause.trim())
    .filter(clause => clause !== '')
    .map(label => ({ label }))

const evidenceLine = (evidence: string | undefined): ItemLine[] =>
  evidence === 'missing' ? [{ label: 'evidence.md', word: 'missing' }] : evidence === 'stale' ? [{ label: 'evidence.md', word: 'stale' }] : []

const tagged = (labels: readonly string[] | undefined, word: WordKey): ItemLine[] => (labels ?? []).map(label => ({ label, word }))

/**
 * One line per pending thing of an item, read from its `details` (design D21). Item 1 has two parts so that no line shows in two
 * steps: `tasks` (the unticked ids) and `proofs` (the evidence file, then each gate without a passing row); without a part, both.
 * An item with no `details` of its own kind splits its reason on `;`.
 */
export const itemLines = (item: DeliverItem, part?: 'tasks' | 'proofs'): ItemLine[] => {
  if (item.status === 'met') return []
  const d = item.details
  if (item.id === 1 && d !== undefined) {
    const tasks = tagged(d.unticked, 'open')
    const proofs = [...evidenceLine(d.evidence), ...(d.missingGates ?? []).map((command): ItemLine => ({ label: commandLabel(command), word: 'noProof' }))]
    return part === 'tasks' ? tasks : part === 'proofs' ? proofs : [...tasks, ...proofs]
  }
  if (item.id === 2 && d !== undefined && (d.missing !== undefined || d.rejected !== undefined || d.stale !== undefined)) {
    return [...tagged(d.missing, 'missing'), ...tagged(d.rejected, 'rejected'), ...tagged(d.stale, 'stale')]
  }
  if (item.id === 4 && d !== undefined && d.ids !== undefined) {
    return [...evidenceLine(d.evidence), ...tagged(d.missing, 'noProof'), ...tagged(d.defects, 'failing'), ...tagged(d.noProof, 'ownerWeighs')]
  }
  if (item.id === 6 && d !== undefined && (d.failing !== undefined || d.pending !== undefined)) {
    return [...(d.failing ?? []).map((f): ItemLine => ({ label: f.name, word: 'failing' })), ...tagged(d.pending, 'running')]
  }
  return reasonLines(item)
}

/** The first eight lines and how many more there are (design D21: `+N`, the full text one press away). */
export const capLines = <T>(lines: readonly T[], max = MAX_LINES): { lines: T[]; more: number } => ({ lines: lines.slice(0, max), more: Math.max(0, lines.length - max) })

/** The count per word joined by ` · ` (`3 abertas · 10 sem prova`); the one line's label for a single line; empty for none. */
export const itemSummary = (lines: readonly ItemLine[], text: UiText): string => {
  if (lines.length === 0) return ''
  const [only] = lines
  if (lines.length === 1 && only !== undefined) return only.label
  const counts = new Map<WordKey, number>()
  let bare = 0
  for (const line of lines) {
    if (line.word === undefined) bare += 1
    else counts.set(line.word, (counts.get(line.word) ?? 0) + 1)
  }
  const parts = [...counts].map(([word, n]) => `${n} ${text.pane.word(word, n)}`)
  if (bare > 0) parts.push(text.pane.count(bare))
  return parts.join(' · ')
}

const SUMMARY_CELLS = 200
const SUMMARY_LINE_RE = /^Summary:\s*(.+)$/

/**
 * The change's summary from `proposal.md` (design D23): the first `Summary:` line before the first `## ` heading; else the first
 * sentence of the `## Why` section (wrapped lines joined, up to the first `. ` or the paragraph's end); else none. Cut to 200.
 */
export const summaryOf = (proposal: string): string | undefined => {
  const lines = proposal.split(/\r?\n/)
  const firstHeading = lines.findIndex(l => l.startsWith('## '))
  const head = firstHeading === -1 ? lines : lines.slice(0, firstHeading)
  for (const line of head) {
    const found = SUMMARY_LINE_RE.exec(line)?.[1]?.trim()
    if (found !== undefined && found !== '') return clip(found, SUMMARY_CELLS)
  }
  const why = lines.findIndex(l => /^##\s+Why\s*$/.test(l))
  if (why === -1) return undefined
  const paragraph: string[] = []
  for (const line of lines.slice(why + 1)) {
    if (line.startsWith('## ')) break
    if (line.trim() === '') {
      if (paragraph.length > 0) break
      continue
    }
    paragraph.push(line.trim())
  }
  const text = paragraph.join(' ')
  if (text === '') return undefined
  const end = text.indexOf('. ')
  return clip(end === -1 ? text : text.slice(0, end + 1), SUMMARY_CELLS)
}
