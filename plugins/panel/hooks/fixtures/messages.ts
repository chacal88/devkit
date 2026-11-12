// The three forms of a conduct invocation in `$.session.messages()` (design D3). `COMMAND_TAGS_MESSAGE` is the row of the
// 2026-11-11 transcript of the session that conducted `release-rebase-pin` (a typed `/devkit-openspec:conduct <id>`), quoted
// as stored; the other two are the forms the design accepts, written to the same `{ role, text, toolUses }` shape the
// engine's `SessionMessage` has. Neither was seen in a real transcript yet: the live check records which form appears.

import type { SessionMessage } from 'claude-code'

/** A user message as stored for a typed slash command: the command and its arguments in tags. */
export const commandTags = (args: string, command = 'devkit-openspec:conduct'): SessionMessage => ({
  role: 'user',
  text: `<command-message>${command}</command-message>\n<command-name>/${command}</command-name>\n<command-args>${args}</command-args>`,
  toolUses: [],
})

/** The row quoted in design Context. */
export const COMMAND_TAGS_MESSAGE: SessionMessage = commandTags('release-rebase-pin')

/** A user message whose first line is the plain command. */
export const plainCommand = (line: string): SessionMessage => ({ role: 'user', text: line, toolUses: [] })

/** An assistant message that ran the skill through the `Skill` tool. */
export const skillToolUse = (args: string, skill = 'devkit-openspec:conduct'): SessionMessage => ({
  role: 'assistant',
  text: 'Running the conduct skill.',
  toolUses: [{ tool_use_id: 'toolu_1', tool: 'Skill', input: { skill, args } }],
})

/** A message that is not an invocation. */
export const chat = (role: 'user' | 'assistant', text: string): SessionMessage => ({ role, text, toolUses: [] })
