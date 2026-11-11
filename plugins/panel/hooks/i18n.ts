// Every string the pane, band, toasts, command answers and fill texts use, in
// pt-BR and en (design D10). The module's code and comments stay English.

import type { PluginOptions } from 'claude-code'

export type Lang = 'pt-BR' | 'en'

export type UiText = {
  labels: { conduct: string; ship: string; approve: string; answer: string; refresh: string; open: string; close: string }
  /** The four owner texts, exactly as filled into the prompt box (design D8). */
  fill: {
    conduct: (id: string, withId: boolean) => string
    ship: (id: string) => string
    approve: (id: string) => string
    answer: (id: string) => string
  }
  pane: {
    title: string
    notDevkit: string
    noChecker: string
    refreshing: string
    updated: (seconds: number) => string
    error: (line: string) => string
    round: (n: number, title: string, done: number, total: number) => string
    noRound: string
    counts: (dispatch: number, owner: number, github: number, stopped: number) => string
    /** The row's deliver line: `met` of the report's `total` items. */
    deliver: (summary: string, met: number, total: number, next: string) => string
    sessions: string
    others: (n: number) => string
    archived: (n: number) => string
    permission: (tool: string) => string
    /** The error line of a refused or failed `list_sessions` call (design D7). */
    listError: (reason: string) => string
  }
  band: {
    /** The one dim line above the prompt (design D9). */
    line: (n: number, title: string, done: number, total: number, dispatch: number, owner: number, github: number, stopped: number) => string
    noRound: string
  }
  /** What `/devkit-panel` answers after toggling the pane. */
  command: { opened: string; closed: string; waiting: string }
  toast: { paneFailed: string }
}

const PT_BR: UiText = {
  labels: { conduct: 'Conduzir', ship: 'Entregar', approve: 'Aprovar', answer: 'Responder', refresh: 'Atualizar', open: 'Abrir', close: 'Fechar' },
  fill: {
    conduct: (id, withId) => (withId ? `/conduct ${id}` : '/conduct'),
    ship: id => `/ship-change ${id}`,
    approve: id => `Aprovo o plano de ${id}`,
    answer: id => `Approve proposal 1 of ${id}`,
  },
  pane: {
    title: 'devkit',
    notDevkit: 'Não é um projeto OpenSpec devkit.',
    noChecker: 'Sem checker: instale devkit-openspec@devkit --scope project.',
    refreshing: 'atualizando...',
    updated: s => `atualizado há ${s} s`,
    error: line => `conduct-check: ${line}`,
    round: (n, title, done, total) => `Rodada ${n}: ${title} · ${done}/${total}`,
    noRound: 'Sem rodada no roadmap.',
    counts: (d, o, g, s) => `dispatch ${d} · owner ${o} · github ${g} · parados ${s}`,
    deliver: (summary, met, total, next) => `deliver: ${summary} · ${met}/${total} ok · próximo: ${next}`,
    sessions: 'sessões',
    others: n => `Outras mudanças (${n})`,
    archived: n => `Arquivadas (${n})`,
    permission: tool => `permita ${tool} para ver as sessões filhas`,
    listError: reason => `list_sessions: ${reason}`,
  },
  band: {
    line: (n, title, done, total, d, o, g, s) => `devkit · rodada ${n} ${title} · ${done}/${total} · dispatch ${d} · owner ${o} · github ${g} · parados ${s}`,
    noRound: 'devkit · sem rodada no roadmap',
  },
  command: { opened: 'painel devkit aberto', closed: 'painel devkit fechado', waiting: 'painel devkit aguardando espaço' },
  toast: { paneFailed: 'O painel devkit não pôde abrir.' },
}

const EN: UiText = {
  labels: { conduct: 'Conduct', ship: 'Ship', approve: 'Approve', answer: 'Answer', refresh: 'Refresh', open: 'Open', close: 'Close' },
  fill: {
    conduct: (id, withId) => (withId ? `/conduct ${id}` : '/conduct'),
    ship: id => `/ship-change ${id}`,
    approve: id => `I approve the plan of ${id}`,
    answer: id => `Approve proposal 1 of ${id}`,
  },
  pane: {
    title: 'devkit',
    notDevkit: 'Not an OpenSpec devkit project.',
    noChecker: 'No checker: install devkit-openspec@devkit --scope project.',
    refreshing: 'refreshing...',
    updated: s => `updated ${s} s ago`,
    error: line => `conduct-check: ${line}`,
    round: (n, title, done, total) => `Round ${n}: ${title} · ${done}/${total}`,
    noRound: 'No roadmap round.',
    counts: (d, o, g, s) => `dispatch ${d} · owner ${o} · github ${g} · stopped ${s}`,
    deliver: (summary, met, total, next) => `deliver: ${summary} · ${met}/${total} met · next: ${next}`,
    sessions: 'sessions',
    others: n => `Other changes (${n})`,
    archived: n => `Archived (${n})`,
    permission: tool => `allow ${tool} to see the child sessions`,
    listError: reason => `list_sessions: ${reason}`,
  },
  band: {
    line: (n, title, done, total, d, o, g, s) => `devkit · round ${n} ${title} · ${done}/${total} · dispatch ${d} · owner ${o} · github ${g} · stopped ${s}`,
    noRound: 'devkit · no roadmap round',
  },
  command: { opened: 'devkit panel opened', closed: 'devkit panel closed', waiting: 'devkit panel waiting for room' },
  toast: { paneFailed: 'The devkit panel could not open.' },
}

/** The strings of one language. */
export const uiText = (lang: Lang): UiText => (lang === 'en' ? EN : PT_BR)

/** `options.language` of the manifest's `userConfig`; `pt-BR` when absent or unknown. */
export const langOf = (options: PluginOptions): Lang => (options.language === 'en' ? 'en' : 'pt-BR')
