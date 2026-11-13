// Every string the pane, the detail pane, the band, toasts, command answers and fill texts use, in
// pt-BR and en (design D12, D24). The pt-BR texts are the approved mock's. The module's code and
// comments stay English.

import type { PluginOptions } from 'claude-code'

export type Lang = 'pt-BR' | 'en'

/** The ten steps of the flow, in order (design D22). */
export type StepKey = 'requirements' | 'plan' | 'readiness' | 'approval' | 'implementation' | 'proofs' | 'review' | 'pr' | 'merge' | 'retro'

export const STEP_KEYS: readonly StepKey[] = ['requirements', 'plan', 'readiness', 'approval', 'implementation', 'proofs', 'review', 'pr', 'merge', 'retro']

/** The words of a short list (design D21), by key so the lists stay pure. */
export type WordKey = 'open' | 'noProof' | 'missing' | 'stale' | 'rejected' | 'failing' | 'running' | 'ownerWeighs'

export const WORD_KEYS: readonly WordKey[] = ['open', 'noProof', 'missing', 'stale', 'rejected', 'failing', 'running', 'ownerWeighs']

/** Who a task waits on (design D27): the owner, Claude or a gate. */
export type TagKey = 'owner' | 'claude' | 'gate'

export type UiText = {
  labels: {
    refresh: string
    conduct: string
    continueHere: string
    approve: string
    answer: string
    open: string
    close: string
    copy: string
    copied: string
    /** The mark that closes the detail pane. */
    closeMark: string
    openInEditor: string
    seeFile: (file: string) => string
  }
  /** The three owner texts, exactly as filled into the prompt box (design D24). */
  fill: {
    conduct: (id: string) => string
    approve: (id: string) => string
    answer: (id: string) => string
  }
  pane: {
    title: string
    notDevkit: string
    noChecker: string
    oldChecker: string
    error: (line: string) => string
    /** The error line of a refused or failed `list_sessions` call (design D7). */
    listError: (reason: string) => string
    permission: (tool: string) => string
    /** `via: command | children`, the signal that found the conducted change (design D3). */
    via: (via: string) => string
    /** The rate-limit line: checks are paused until `hh:mm`. */
    rateLimit: (until: string) => string
    /** The shared-prefix line, naming the other ids. */
    sharedPrefix: (ids: string) => string
    /** Shown under the sessions when `open_session_in` is not listed. */
    openFromSidebar: string
    /** Screen 1's top caption, the repository line and the `Agora` box. */
    caption: string
    repoLine: (repo: string, branch: string) => string
    now: string
    /** Who acts, as the pill and the band's phrase (`você age`). */
    pill: (actor: string) => string
    /** Who acts, as a noun (`você`). */
    actor: (actor: string) => string
    nowLeft: (k: number) => string
    /** What is left, in the band (`faltam 9`). */
    bandLeft: (k: number) => string
    nowThen: (steps: string) => string
    hint: (id: string) => string
    steps: string
    stepsCount: (k: number) => string
    stepName: (key: StepKey) => string
    /** The facts on the right of a step (design D12). */
    fact: {
      criteria: (n: number) => string
      sections: (n: number) => string
      approved: string
      toRevise: string
      blocked: string
      tasks: (k: number, n: number) => string
      round: (n: number) => string
      proven: (k: number, n: number) => string
      pr: (n: number, checks: string) => string
      /** `18 set` / `Sep 18` from a month 1 to 12 and a day. */
      date: (month: number, day: number) => string
    }
    /** The step's short label (at most four words); the raw id when the table lacks it. `phase` fills the `n` of a phase step. */
    step: (step: string, phase?: number) => string
    /** `Implementar a fase 2: <title>` and `Gate da fase 2`. */
    implementTitle: (n: number, title: string) => string
    gateTitle: (n: number) => string
    pending: string
    tag: (key: TagKey) => string
    more: (n: number) => string
    documents: string
    /** The name of a change file as a link or a tab. */
    docName: (file: string) => string
    sessions: string
    sessionPhase: (n: number, title: string) => string
    childState: (state: string) => string
    archivedCount: (n: number) => string
    otherChanges: string
    otherChangesHint: string
    /** Screen 3. */
    emptyTitle: string
    emptySentence: string
    openIn: (repo: string) => string
    planReady: (n: number) => string
    tasksProgress: (k: number, n: number) => string
    showMore: (n: number) => string
    /** The footer: the age and the seconds to the next tick (none with the pane closed). */
    footer: (ageSeconds: number, nextSeconds: number | undefined) => string
    /** The footer during a rate-limit back-off: the pause replaces `next in`. */
    footerPaused: (ageSeconds: number, until: string) => string
    footerRefreshing: string
    /** The short name of one of `deliver-check`'s eight items; the raw name when unknown. */
    item: (name: string) => string
    itemStatus: (status: string) => string
    checks: (status: string) => string
    pr: (n: number) => string
    noPr: string
    word: (key: WordKey, n?: number) => string
    count: (n: number) => string
    nothingPending: string
    noLongerOpen: string
    conductMeaning: string
  }
  detail: {
    pendingTitle: string
    pendingSubtitle: (id: string, k: number, n: number) => string
    allWait: (who: string) => string
    kPending: (k: number) => string
    whoActs: (actor: string) => string
    section: (n: number, title: string) => string
    fullText: string
    fullTextShort: string
    escBack: string
    escClose: string
    /** Screen 5. */
    sections: string
    fileMissing: string
    cut: string
    /** Screen 6. */
    tasksOf: (k: number, n: number) => string
    percent: (p: number) => string
    missing: string
    sectionsTasks: (k: number, m: number) => string
    done: string
    sectionsCount: (k: number) => string
    noApproval: string
    stepDone: string
    copyUnavailable: string
    subtitle: (id: string, fact: string) => string
    noRows: string
  }
  band: {
    /** The one dim line above the prompt when no change is conducted (design D11). */
    count: (n: number) => string
    none: string
  }
  /** What `/devkit-panel` answers after toggling the pane. */
  command: { opened: string; closed: string; waiting: string }
  toast: { paneFailed: string; filled: string; openDenied: (tool: string) => string; openSidebar: string }
}

/** The short label of each step of `conduct-check`'s `actorOf` (design D12): `[pt-BR, en]`, `{n}` is the phase. */
const STEPS: Record<string, readonly [string, string]> = {
  implement: ['implementar fase {n}', 'implement phase {n}'],
  'fix-review': ['corrigir a revisão', 'fix the review'],
  'fix-defect': ['corrigir o defeito', 'fix the defect'],
  'fix-checks': ['corrigir o CI', 'fix the checks'],
  'apply-proposals': ['aplicar propostas', 'apply proposals'],
  'resolve-release-conflict': ['resolver conflito', 'resolve conflict'],
  commit: ['commit', 'commit'],
  'open-pr': ['abrir o PR', 'open the PR'],
  push: ['push', 'push'],
  'open-archive-pr': ['abrir PR final', 'open archive PR'],
  'push-rebased': ['push do rebase', 'push the rebase'],
  verify: ['verificar', 'verify'],
  retro: ['retro', 'retro'],
  plan: ['planejar', 'plan'],
  'revise-plan': ['revisar o plano', 'revise the plan'],
  readiness: ['prontidão do plano', 'plan readiness'],
  audit: ['auditar o plano', 'audit the plan'],
  review: ['revisão', 'review'],
  gate: ['gate da fase {n}', 'gate of phase {n}'],
  'edit-pr-body': ['editar corpo do PR', 'edit the PR body'],
  'enable-auto-merge': ['ativar auto-merge', 'enable auto-merge'],
  'disable-auto-merge': ['desativar auto-merge', 'disable auto-merge'],
  'update-branch': ['atualizar branch', 'update the branch'],
  archive: ['arquivar', 'archive'],
  'tick-roadmap': ['marcar o roadmap', 'tick the roadmap'],
  answer: ['responder ao PR', 'answer the PR'],
  worktree: ['criar worktree', 'create worktree'],
  rebase: ['rebase', 'rebase'],
  'stop-retro-answers': ['responder a retro', 'answer the retro'],
  'stop-plan-approval': ['aprovar o plano', 'approve the plan'],
  create: ['criar a mudança', 'create the change'],
  'new-change': ['nova mudança', 'new change'],
  grill: ['entrevista', 'grill'],
  approve: ['aprovar o plano', 'approve the plan'],
  ready: ['pronto para merge', 'ready to merge'],
  'archive-pr-ready': ['merge do arquivo', 'merge archive PR'],
  'stop-review-deadlock': ['impasse na revisão', 'review deadlock'],
  'stop-readiness-blocked': ['prontidão bloqueada', 'readiness blocked'],
  'stop-audit-unverifiable': ['auditoria inverificável', 'audit unverifiable'],
  'wait-checks': ['aguardando CI', 'waiting for CI'],
  'wait-merge': ['aguardando merge', 'waiting for merge'],
  'stop-plan-mode': ['modo plano', 'plan mode'],
  'stop-branch': ['branch errada', 'wrong branch'],
  'stop-merge-setup': ['configurar o merge', 'merge setup'],
  'stop-archive': ['arquivo bloqueado', 'archive blocked'],
  blocked: ['bloqueada', 'blocked'],
  'stop-not-approved': ['plano não aprovado', 'plan not approved'],
  archived: ['arquivada', 'archived'],
  'wait-dependencies': ['aguardando dependências', 'waiting on dependencies'],
}

/** The steps that have a short label. */
export const STEP_IDS: readonly string[] = Object.keys(STEPS)

/** The names of `deliver-check`'s eight items, in item order. */
export const ITEM_NAMES: readonly string[] = ['tasks', 'reviews', 'findings', 'acceptance', 'pr', 'checks', 'conversation', 'body']

const ITEMS: Record<string, readonly [string, string]> = {
  tasks: ['tarefas', 'tasks'],
  reviews: ['revisões', 'reviews'],
  findings: ['achados', 'findings'],
  acceptance: ['aceitação', 'acceptance'],
  pr: ['PR', 'PR'],
  checks: ['CI', 'checks'],
  conversation: ['conversa', 'conversation'],
  body: ['corpo do PR', 'PR body'],
}

/** The ten step names, `[pt-BR, en]`, by step key (design D12). */
const STEP_NAMES: Record<StepKey, readonly [string, string]> = {
  requirements: ['Requisitos', 'Requirements'],
  plan: ['Plano', 'Plan'],
  readiness: ['Prontidão', 'Readiness'],
  approval: ['Sua aprovação', 'Your approval'],
  implementation: ['Implementação', 'Implementation'],
  proofs: ['Provas', 'Proofs'],
  review: ['Revisão', 'Review'],
  pr: ['PR e checks', 'PR and checks'],
  merge: ['Merge', 'Merge'],
  retro: ['Retro e arquivo', 'Retro and archive'],
}

/** The change files the pane can show: the link or tab name, `[pt-BR, en]`. */
const DOCS: Record<string, readonly [string, string]> = {
  'requirements.md': ['Requisitos', 'Requirements'],
  'proposal.md': ['Proposta', 'Proposal'],
  'design.md': ['Design', 'Design'],
  'tasks.md': ['Tarefas', 'Tasks'],
  specs: ['Specs', 'Specs'],
  'readiness.md': ['Prontidão', 'Readiness'],
  'approval.md': ['Aprovação', 'Approval'],
  'evidence.md': ['Provas', 'Proofs'],
  'retro.md': ['Retro', 'Retro'],
}

/** The words of a short list, `[singular pt, plural pt, en]` (design D21). */
const WORDS: Record<WordKey, readonly [string, string, string]> = {
  open: ['aberta', 'abertas', 'open'],
  noProof: ['sem prova', 'sem prova', 'no proof'],
  missing: ['ausente', 'ausentes', 'missing'],
  stale: ['desatualizada', 'desatualizadas', 'stale'],
  rejected: ['rejeitada', 'rejeitadas', 'rejected'],
  failing: ['falhou', 'falharam', 'failing'],
  running: ['rodando', 'rodando', 'running'],
  ownerWeighs: ['o dono decide', 'o dono decide', 'owner weighs'],
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const stepLabel = (step: string, phase: number | undefined, at: 0 | 1): string => {
  const label = STEPS[step]?.[at]
  if (label === undefined) return step
  return (phase === undefined ? label.replace(' {n}', '') : label.replace('{n}', String(phase))).trim()
}

const itemName = (name: string, at: 0 | 1): string => ITEMS[name]?.[at] ?? name

// who acts, by the checker's `actor` (design D8, D25): `stop` is a stopped change, none is nobody
const ACTORS_PT: Record<string, string> = { owner: 'você', stop: 'parada', session: 'Claude', subagent: 'Claude', review: 'Claude', gate: 'Claude', main: 'Claude', github: 'GitHub', none: 'esperando' }
const ACTORS_EN: Record<string, string> = { owner: 'you', stop: 'stopped', session: 'Claude', subagent: 'Claude', review: 'Claude', gate: 'Claude', main: 'Claude', github: 'GitHub', none: 'waiting' }
const PILLS_PT: Record<string, string> = { owner: 'você age', stop: 'parada', session: 'Claude age', subagent: 'Claude age', review: 'Claude age', gate: 'Claude age', main: 'Claude age', github: 'GitHub age', none: 'esperando' }
const PILLS_EN: Record<string, string> = { owner: 'you act', stop: 'stopped', session: 'Claude acts', subagent: 'Claude acts', review: 'Claude acts', gate: 'Claude acts', main: 'Claude acts', github: 'GitHub acts', none: 'waiting' }

const PT_BR: UiText = {
  labels: {
    refresh: '↻ Atualizar',
    conduct: 'Conduzir',
    continueHere: 'Continuar aqui',
    approve: 'Aprovar plano',
    answer: 'Responder retro',
    open: 'Abrir painel',
    close: 'Fechar painel',
    copy: 'Copiar',
    copied: '✓ Copiado',
    closeMark: '✕',
    openInEditor: 'Abrir no editor ↗',
    seeFile: file => `Ver ${file}`,
  },
  fill: {
    conduct: id => `/conduct ${id}`,
    approve: id => `Aprovo o plano de ${id}`,
    answer: id => `Approve proposal 1 of ${id}`,
  },
  pane: {
    title: 'devkit',
    notDevkit: 'Não é um projeto OpenSpec devkit.',
    noChecker: 'Sem checker: instale devkit-openspec@devkit --scope project.',
    oldChecker: 'requer devkit-openspec 0.10.0 ou mais novo',
    error: line => `conduct-check: ${line}`,
    listError: reason => `list_sessions: ${reason}`,
    permission: tool => `permita ${tool} para ver as sessões filhas`,
    via: via => `via: ${via}`,
    rateLimit: until => `limite do GitHub: checagens pausadas até ${until}`,
    sharedPrefix: ids => `nomes de sessão compartilhados com ${ids}`,
    openFromSidebar: 'abra pela barra lateral',
    caption: 'Esta conversa conduz',
    repoLine: (repo, branch) => `${repo} · branch ${branch}`,
    now: 'Agora',
    pill: actor => PILLS_PT[actor] ?? actor,
    actor: actor => ACTORS_PT[actor] ?? actor,
    nowLeft: k => (k === 1 ? 'Falta 1 tarefa nesta fase.' : `Faltam ${k} tarefas nesta fase.`),
    bandLeft: k => `faltam ${k}`,
    nowThen: steps => `Depois: ${steps}.`,
    hint: id => `põe /conduct ${id} na caixa`,
    steps: 'Passos',
    stepsCount: k => `${k} de 10`,
    stepName: key => STEP_NAMES[key][0],
    fact: {
      criteria: n => `${n} ${n === 1 ? 'critério' : 'critérios'}`,
      sections: n => `${n} ${n === 1 ? 'seção' : 'seções'}`,
      approved: 'aprovada',
      toRevise: 'a revisar',
      blocked: 'bloqueada',
      tasks: (k, n) => `${k} de ${n} tarefas`,
      round: n => `rodada ${n}`,
      proven: (k, n) => `${k} de ${n} critérios`,
      pr: (n, checks) => `PR #${n} · ${checks}`,
      date: (month, day) => `${day} ${MONTHS_PT[month - 1] ?? ''}`.trim(),
    },
    step: (step, phase) => stepLabel(step, phase, 0),
    implementTitle: (n, title) => `Implementar a fase ${n}: ${title}`,
    gateTitle: n => `Gate da fase ${n}`,
    pending: 'Pendências',
    tag: key => ({ owner: 'você', claude: 'Claude', gate: 'gate' })[key],
    more: n => `+${n}`,
    documents: 'Documentos',
    docName: file => DOCS[file]?.[0] ?? file,
    sessions: 'Sessões desta change',
    sessionPhase: (n, title) => (title === '' ? `Fase ${n}` : `Fase ${n} · ${title}`),
    childState: state => ({ running: 'executando', idle: 'ociosa', archived: 'arquivada' })[state] ?? state,
    archivedCount: n => `${n} arquivadas`,
    otherChanges: 'Outras changes abertas',
    otherChangesHint: 'independentes desta conversa; nenhuma precisa terminar antes',
    emptyTitle: 'Nenhuma change nesta conversa',
    emptySentence: 'Escolha uma abaixo para conduzir aqui. O botão põe o comando na caixa de texto; você aperta Enter.',
    openIn: repo => `Changes abertas em ${repo}`,
    planReady: n => `plano pronto · 0 de ${n}`,
    tasksProgress: (k, n) => `${k} de ${n} tarefas`,
    showMore: n => `mostrar mais (${n})`,
    footer: (age, next) => `Atualizado há ${age} s${next === undefined ? '' : ` · próxima em ${next} s`}`,
    footerPaused: (age, until) => `Atualizado há ${age} s · pausado até ${until}`,
    footerRefreshing: 'atualizando...',
    item: name => itemName(name, 0),
    itemStatus: status => ({ met: 'ok', open: 'aberto', blocked: 'bloqueado' })[status] ?? status,
    checks: status => ({ green: 'verde', red: 'vermelho', running: 'rodando', unreadable: 'ilegível' })[status] ?? status,
    pr: n => `PR #${n} ↗`,
    noPr: 'sem PR ainda',
    word: (key, n) => WORDS[key][n !== undefined && n !== 1 ? 1 : 0],
    count: n => `${n} pendências`,
    nothingPending: 'nada pendente',
    noLongerOpen: 'não está mais aberta',
    conductMeaning: 'planeja e executa aqui, com sessões filhas',
  },
  detail: {
    pendingTitle: 'Pendências',
    pendingSubtitle: (id, k, n) => `${id} · ${k} de ${n} tarefas`,
    allWait: who => `Todas esperam ${who}`,
    kPending: k => `${k} pendências`,
    whoActs: actor => `Quem age: ${actor}.`,
    section: (n, title) => `Seção ${n} · ${title}`,
    fullText: '› Texto completo das tarefas',
    fullTextShort: '› Texto completo',
    escBack: 'Esc fecha e volta ao painel',
    escClose: 'Esc fecha',
    sections: 'Seções',
    fileMissing: 'arquivo não encontrado',
    cut: 'texto cortado: abra no editor para ler o resto',
    tasksOf: (k, n) => `${k} de ${n} tarefas`,
    percent: p => `${p}%`,
    missing: 'Faltam',
    sectionsTasks: (k, m) => `${k} ${k === 1 ? 'seção' : 'seções'} · ${m} ${m === 1 ? 'tarefa' : 'tarefas'}`,
    done: 'Feitas',
    sectionsCount: k => `${k} ${k === 1 ? 'seção' : 'seções'}`,
    noApproval: 'sem aprovação ainda',
    stepDone: 'feito',
    copyUnavailable: 'copiar não está disponível aqui; selecione o texto acima',
    subtitle: (id, fact) => (fact === '' ? id : `${id} · ${fact}`),
    noRows: 'nada pendente',
  },
  band: {
    count: n => `devkit · ${n} ${n === 1 ? 'change aberta' : 'changes abertas'}`,
    none: 'devkit · nenhuma change aberta',
  },
  command: { opened: 'painel devkit aberto', closed: 'painel devkit fechado', waiting: 'painel devkit aguardando espaço' },
  toast: {
    paneFailed: 'O painel devkit não pôde abrir.',
    filled: 'clique na caixa de texto e aperte Enter',
    openDenied: tool => `permita ${tool} para abrir a sessão`,
    openSidebar: 'abra pela barra lateral',
  },
}

const EN: UiText = {
  labels: {
    refresh: '↻ Refresh',
    conduct: 'Conduct',
    continueHere: 'Continue here',
    approve: 'Approve plan',
    answer: 'Answer retro',
    open: 'Open panel',
    close: 'Close panel',
    copy: 'Copy',
    copied: '✓ Copied',
    closeMark: '✕',
    openInEditor: 'Open in editor ↗',
    seeFile: file => `See ${file}`,
  },
  fill: {
    conduct: id => `/conduct ${id}`,
    approve: id => `I approve the plan of ${id}`,
    answer: id => `Approve proposal 1 of ${id}`,
  },
  pane: {
    title: 'devkit',
    notDevkit: 'Not an OpenSpec devkit project.',
    noChecker: 'No checker: install devkit-openspec@devkit --scope project.',
    oldChecker: 'needs devkit-openspec 0.10.0 or newer',
    error: line => `conduct-check: ${line}`,
    listError: reason => `list_sessions: ${reason}`,
    permission: tool => `allow ${tool} to see the child sessions`,
    via: via => `via: ${via}`,
    rateLimit: until => `GitHub rate limit: checks paused until ${until}`,
    sharedPrefix: ids => `shared session names with ${ids}`,
    openFromSidebar: 'open it from the sidebar',
    caption: 'This conversation conducts',
    repoLine: (repo, branch) => `${repo} · branch ${branch}`,
    now: 'Now',
    pill: actor => PILLS_EN[actor] ?? actor,
    actor: actor => ACTORS_EN[actor] ?? actor,
    nowLeft: k => (k === 1 ? '1 task left in this phase.' : `${k} tasks left in this phase.`),
    bandLeft: k => `${k} left`,
    nowThen: steps => `Then: ${steps}.`,
    hint: id => `puts /conduct ${id} in the box`,
    steps: 'Steps',
    stepsCount: k => `${k} of 10`,
    stepName: key => STEP_NAMES[key][1],
    fact: {
      criteria: n => `${n} ${n === 1 ? 'criterion' : 'criteria'}`,
      sections: n => `${n} ${n === 1 ? 'section' : 'sections'}`,
      approved: 'approved',
      toRevise: 'to revise',
      blocked: 'blocked',
      tasks: (k, n) => `${k} of ${n} tasks`,
      round: n => `round ${n}`,
      proven: (k, n) => `${k} of ${n} criteria`,
      pr: (n, checks) => `PR #${n} · ${checks}`,
      date: (month, day) => `${MONTHS_EN[month - 1] ?? ''} ${day}`.trim(),
    },
    step: (step, phase) => stepLabel(step, phase, 1),
    implementTitle: (n, title) => `Implement phase ${n}: ${title}`,
    gateTitle: n => `Gate of phase ${n}`,
    pending: 'Pending',
    tag: key => ({ owner: 'you', claude: 'Claude', gate: 'gate' })[key],
    more: n => `+${n}`,
    documents: 'Documents',
    docName: file => DOCS[file]?.[1] ?? file,
    sessions: 'Sessions of this change',
    sessionPhase: (n, title) => (title === '' ? `Phase ${n}` : `Phase ${n} · ${title}`),
    childState: state => ({ running: 'running', idle: 'idle', archived: 'archived' })[state] ?? state,
    archivedCount: n => `${n} archived`,
    otherChanges: 'Other open changes',
    otherChangesHint: 'independent of this conversation; none has to finish first',
    emptyTitle: 'No change in this conversation',
    emptySentence: 'Pick one below to conduct here. The button puts the command in the text box; you press Enter.',
    openIn: repo => `Open changes in ${repo}`,
    planReady: n => `plan ready · 0 of ${n}`,
    tasksProgress: (k, n) => `${k} of ${n} tasks`,
    showMore: n => `show more (${n})`,
    footer: (age, next) => `Updated ${age} s ago${next === undefined ? '' : ` · next in ${next} s`}`,
    footerPaused: (age, until) => `Updated ${age} s ago · paused until ${until}`,
    footerRefreshing: 'refreshing...',
    item: name => itemName(name, 1),
    itemStatus: status => status,
    checks: status => status,
    pr: n => `PR #${n} ↗`,
    noPr: 'no PR yet',
    word: key => WORDS[key][2],
    count: n => `${n} pending`,
    nothingPending: 'nothing pending',
    noLongerOpen: 'no longer open',
    conductMeaning: 'plans and runs it here, with child sessions',
  },
  detail: {
    pendingTitle: 'Pending',
    pendingSubtitle: (id, k, n) => `${id} · ${k} of ${n} tasks`,
    allWait: who => `All wait on ${who}`,
    kPending: k => `${k} pending`,
    whoActs: actor => `Who acts: ${actor}.`,
    section: (n, title) => `Section ${n} · ${title}`,
    fullText: '› Full text of the tasks',
    fullTextShort: '› Full text',
    escBack: 'Esc closes and returns to the panel',
    escClose: 'Esc closes',
    sections: 'Sections',
    fileMissing: 'file not found',
    cut: 'text cut: open it in the editor to read the rest',
    tasksOf: (k, n) => `${k} of ${n} tasks`,
    percent: p => `${p}%`,
    missing: 'Missing',
    sectionsTasks: (k, m) => `${k} ${k === 1 ? 'section' : 'sections'} · ${m} ${m === 1 ? 'task' : 'tasks'}`,
    done: 'Done',
    sectionsCount: k => `${k} ${k === 1 ? 'section' : 'sections'}`,
    noApproval: 'no approval yet',
    stepDone: 'done',
    copyUnavailable: 'copying is not available here; select the text above',
    subtitle: (id, fact) => (fact === '' ? id : `${id} · ${fact}`),
    noRows: 'nothing pending',
  },
  band: {
    count: n => `devkit · ${n} open ${n === 1 ? 'change' : 'changes'}`,
    none: 'devkit · no open change',
  },
  command: { opened: 'devkit panel opened', closed: 'devkit panel closed', waiting: 'devkit panel waiting for room' },
  toast: {
    paneFailed: 'The devkit panel could not open.',
    filled: 'click the prompt box and press Enter',
    openDenied: tool => `allow ${tool} to open the session`,
    openSidebar: 'open it from the sidebar',
  },
}

/** The strings of one language. */
export const uiText = (lang: Lang): UiText => (lang === 'en' ? EN : PT_BR)

/** `options.language` of the manifest's `userConfig`; `pt-BR` when absent or unknown. */
export const langOf = (options: PluginOptions): Lang => (options.language === 'en' ? 'en' : 'pt-BR')
