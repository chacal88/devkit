// Which change this session conducts (design D3): the newest conduct invocation of the transcript (signal 1), else this
// session's own child sessions matched to the stored session prefixes of the changes in progress (signal 2). Pure.

import type { SessionMessage, ToolUseSummary } from 'claude-code'

import type { ChangeEntry, Conducted, SessionRow } from '../types'
import { childrenOf } from './sessions'

/** The part of the engine's `SessionMessage` this reads: who wrote it, its text, and the tools an assistant message used. */
export type Msg = Pick<SessionMessage, 'role' | 'text'> & { toolUses: readonly Pick<ToolUseSummary, 'tool' | 'input'>[] }

// the checker's own `--change` rule (conduct-check.mjs): one change id
const CHANGE_ID_RE = /^[A-Za-z0-9][\w.-]*$/
const NOT_IDS = new Set(['.', '..', 'archive'])
// what a sentence or a quoting leaves around an id the owner typed
const EDGE_NOISE_RE = /^["'`.,;:!?\s]+|["'`.,;:!?\s]+$/g

/** Whether `value` is a change id by the checker's `--change` rule. */
export const isChangeId = (value: string): boolean => CHANGE_ID_RE.test(value) && !NOT_IDS.has(value)
// `/conduct` or `/<plugin>:conduct`
const COMMAND = String.raw`\/(?:[^\s:<>/]+:)?conduct`
const TAGGED_RE = new RegExp(String.raw`<command-name>${COMMAND}<\/command-name>`)
const ARGS_RE = /<command-args>([\s\S]*?)<\/command-args>/
const PLAIN_RE = new RegExp(String.raw`^${COMMAND}(?:[ \t]+(.*))?$`)
const SKILL_RE = /(^|:)conduct$/

/** The ARGS of the conduct invocation a message holds, in any of the three forms; undefined when it holds none. */
const invocationArgs = (message: Msg): string | undefined => {
  if (message.role === 'user') {
    if (TAGGED_RE.test(message.text)) return (ARGS_RE.exec(message.text)?.[1] ?? '').trim()
    const first = message.text.split('\n')[0]?.trim() ?? ''
    const plain = PLAIN_RE.exec(first)
    return plain === null ? undefined : (plain[1] ?? '').trim()
  }
  for (const use of message.toolUses) {
    if (use.tool !== 'Skill') continue
    const skill = use.input.skill
    if (typeof skill !== 'string' || !SKILL_RE.test(skill)) continue
    const args = use.input.args
    return typeof args === 'string' ? args.trim() : ''
  }
  return undefined
}

/**
 * The change id of the newest conduct invocation (oldest first in `messages`), when its ARGS is one id, read like the conduct skill does (sentence punctuation and quotes around it trimmed). `round <n>`,
 * an empty ARGS and anything else give none, and an older invocation is never used: the owner has moved on.
 */
export const conductArgs = (messages: readonly Msg[]): string | undefined => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const args = message === undefined ? undefined : invocationArgs(message)
    if (args !== undefined) {
      const id = args.replace(EDGE_NOISE_RE, '')
      return isChangeId(id) ? id : undefined
    }
  }
  return undefined
}

const prefixOf = (entry: ChangeEntry | undefined): string | undefined => entry?.row?.sessionPrefix

/** Every `sessionPrefix` that the stored rows of two or more candidates carry: its children cannot be told apart. */
export const ambiguousPrefixes = (entries: readonly ChangeEntry[]): string[] => {
  const seen = new Map<string, number>()
  for (const entry of entries) {
    const prefix = prefixOf(entry)
    if (prefix !== undefined && prefix !== '') seen.set(prefix, (seen.get(prefix) ?? 0) + 1)
  }
  return [...seen].filter(([, count]) => count > 1).map(([prefix]) => prefix)
}

/** Running first, then the most recent activity. */
const byActivity = (a: SessionRow, b: SessionRow): number => {
  if (a.isRunning !== b.isRunning) return a.isRunning ? -1 : 1
  return (b.lastActivityAt ?? '') < (a.lastActivityAt ?? '') ? -1 : (b.lastActivityAt ?? '') > (a.lastActivityAt ?? '') ? 1 : 0
}

/**
 * The conducted change in the D3 order. `args` is signal 1's id (from `conductArgs`); `ownChildren` the session's own
 * children; `entries` the stored entries of the candidates; `previous` the last view's conducted change.
 *
 * - Signal 1: the id, with `sharedWith` when its stored prefix is ambiguous; none when its entry is an archived change.
 * - Signal 2: the most recently active own child whose name is `<prefix><n>` for the stored, non-ambiguous prefix of a
 *   change in progress.
 * - Otherwise the previous children-found id is kept, only when a fetch failed in this run (`fetchFailed`) and the id is
 *   still a candidate.
 */
export const conductedId = (
  args: string | undefined,
  ownChildren: readonly SessionRow[],
  entries: Readonly<Record<string, ChangeEntry>>,
  previous: Pick<Conducted, 'id' | 'via'> | undefined,
  fetchFailed = false,
): Pick<Conducted, 'id' | 'via' | 'sharedWith'> | undefined => {
  const all = Object.values(entries)
  const ambiguous = new Set(ambiguousPrefixes(all))
  if (args !== undefined) {
    const own = entries[args]
    if (own?.dropped === 'archived') return undefined
    const prefix = prefixOf(own)
    const sharedWith = prefix !== undefined && ambiguous.has(prefix) ? all.filter(e => e.id !== args && prefixOf(e) === prefix).map(e => e.id) : []
    return { id: args, via: 'command', ...(sharedWith.length > 0 ? { sharedWith } : {}) }
  }
  const usable = all.filter(e => e.dropped === undefined && prefixOf(e) !== undefined && !ambiguous.has(prefixOf(e) ?? ''))
  for (const child of [...ownChildren].sort(byActivity)) {
    const match = usable.find(e => childrenOf([child], prefixOf(e)).length > 0)
    if (match !== undefined) return { id: match.id, via: 'children' }
  }
  const kept = previous !== undefined && previous.via === 'children' ? entries[previous.id] : undefined
  if (fetchFailed && previous !== undefined && kept !== undefined && kept.dropped === undefined) return { id: previous.id, via: 'children' }
  return undefined
}
