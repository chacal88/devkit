// The owner buttons' texts (design D8): pure, pinned by tests. A press fills the
// prompt box with the text; nothing is ever sent.

import type { ChangeRow, PanelView } from '../types'
import type { UiText } from './i18n'

/** One owner button: its element key, its label and the exact text it fills. */
export type OwnerButton = { key: string; label: string; text: string }

const DELIVERY_STEPS: readonly string[] = [
  'implement',
  'gate',
  'commit',
  'verify',
  'open-pr',
  'push',
  'enable-auto-merge',
  'edit-pr-body',
  'retro',
  'tick-roadmap',
  'apply-proposals',
  'stop-retro-answers',
  'stop-plan-approval',
]

/** A step `ship-change` carries: `implement` onward, `fix-*`, `wait-*` and `archive*` included (`archived` is the end, not a step). */
export const isDeliveryStep = (step: string): boolean =>
  DELIVERY_STEPS.includes(step) || step.startsWith('fix-') || step.startsWith('wait-') || (step.startsWith('archive') && step !== 'archived')

const CREATE_STEPS: readonly string[] = ['create', 'new-change']
const APPROVE_STEPS: readonly string[] = ['stop-plan-approval', 'approve']

/** A row the checker has not found: its change has no folder yet, so `--change <id>` on it is the create path, not a probe. */
export const isCreateStep = (step: string): boolean => CREATE_STEPS.includes(step)

/**
 * The buttons of one change row, in order: Conduct, Ship, Approve, Answer, each with its filled text.
 * Conduct is the same on every row: `/conduct <id>` when the checker accepts `--change` (on a change not yet
 * created, that is the create path of `/conduct <id>`, devkit-openspec 0.10.0), `/conduct` otherwise.
 */
export const buttonsFor = (row: ChangeRow, view: Pick<PanelView, 'changeOption'>, text: UiText): OwnerButton[] => {
  const { id } = row
  const step = row.next.step
  const buttons: OwnerButton[] = [{ key: `conduct:${id}`, label: text.labels.conduct, text: text.fill.conduct(id, view.changeOption === 'yes') }]
  if (isDeliveryStep(step)) buttons.push({ key: `ship:${id}`, label: text.labels.ship, text: text.fill.ship(id) })
  if (APPROVE_STEPS.includes(step)) buttons.push({ key: `approve:${id}`, label: text.labels.approve, text: text.fill.approve(id) })
  if (step === 'stop-retro-answers') buttons.push({ key: `answer:${id}`, label: text.labels.answer, text: text.fill.answer(id) })
  return buttons
}
