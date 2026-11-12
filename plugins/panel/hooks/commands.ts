// The owner buttons' texts (design D24): pure, pinned by tests. A press fills the
// prompt box with the text; nothing is ever sent.

import type { ChangeRow } from '../types'
import type { UiText } from './i18n'

/** One owner button: its element key, its label and the exact text it fills. */
export type OwnerButton = { key: string; label: string; text: string }

const APPROVE_STEPS: readonly string[] = ['stop-plan-approval', 'approve']

/** `Conduzir`: `/conduct <id>`, on every other open change (and its detail). On a change not yet created that is the create path. */
export const conductButton = (id: string, text: UiText): OwnerButton => ({ key: `conduct:${id}`, label: text.labels.conduct, text: text.fill.conduct(id) })

/**
 * The buttons of the conducted change's `Agora` box, in order: `Continuar aqui` (always, `/conduct <id>`), then `Aprovar plano`
 * on `approve` and `stop-plan-approval`, or `Responder retro` on `stop-retro-answers`. There is no Ship button (design D24).
 */
export const nowButtons = (row: ChangeRow, text: UiText): OwnerButton[] => {
  const { id } = row
  const step = row.next.step
  const buttons: OwnerButton[] = [{ key: `conduct:${id}`, label: text.labels.continueHere, text: text.fill.conduct(id) }]
  if (APPROVE_STEPS.includes(step)) buttons.push({ key: `approve:${id}`, label: text.labels.approve, text: text.fill.approve(id) })
  if (step === 'stop-retro-answers') buttons.push({ key: `answer:${id}`, label: text.labels.answer, text: text.fill.answer(id) })
  return buttons
}
