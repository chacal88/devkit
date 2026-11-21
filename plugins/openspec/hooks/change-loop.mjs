// change-loop: the decision core of `/devkit change` (design change-coordinator D-5, D-9).
//
// Given a change, it asks the stage checker (flow-check) which stage the change is in and, from the
// implementation on, the delivery checker (deliver-check, through conduct-check's `deliveryRow`) which step
// inside that stage comes next, and answers with ONE action or ONE end for the session to carry out. It reads
// files, git and (through gh) GitHub, writes nothing, calls no AI, and runs nothing when imported.
//
// Subcommands: `next --change <id> --lang <l> [--after <progressKey>]` (prints `devkit-run: <id>`, then the JSON
// action; exit 0 an action or archived, 1 waiting, 2 blocked, 3 a usage or preflight error),
// `reply <key> --lang <l> [--param name=value]...` (renders one message of the table),
// `start --lang <l>` (the request on standard input: what `/devkit` does with it, D-3), `open <id> --script <s>
// --why <code> --lang <l>` (creates the worktree, the change and its requirements file, D-4), `script <id> <s>
// --why <code> --lang <l>` (the correction of the script, D-4) and `wait --change <id> --lang <l> [--interval <s>]`
// (waits on GitHub with no limit, D-7). Only `open` and `script` write; `start` and `next` do not. `next` and `wait` print
// `devkit-end: <id> <state>` after the run line when the action is an end, and `reply` does so for the keys that end a run.
//
// It also holds the decisions of the three locks that `guard.mjs` calls as modes (D-8): `stopDecision` (the session does not
// end its turn while a stage is ready), `subagentStopDecision` (a stage agent does not stop before its file is delivered) and
// `agentDecision` (in a run, work goes only to the script's roles). Each returns { decision, why, change, reason } and fails
// open. The two stop locks refuse once per unchanged state: they record the progress key of the state refused in
// `<os.tmpdir()>/devkit-stop/<session_id>[-<agent_id>].json` and let the same key through the next time.
// No dependencies.

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { findRoot, optedIn, schemaFile, runOf, changeSchemaAt } from './guard.mjs';
import { collectFlow, computeFlow, fingerprint, inSentence, makeOpenspec, readFlow } from './flow-check.mjs';
import { collectState, buildReport, locateChange, approvalState, makeGh } from './deliver-check.mjs';
import { deliveryRow, listWorktrees } from './conduct-check.mjs';

export const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));

export class LoopUsageError extends Error {
  constructor(message) { super(message); this.name = 'LoopUsageError'; }
}

// A refusal with its own plain reply (a name that cannot be used, a project not set up): exit 3, nothing created.
export class LoopRefusal extends LoopUsageError {
  constructor(key, reply) { super(key); this.name = 'LoopRefusal'; this.reply = reply; }
}

// ---------------------------------------------------------------- the settings (D-9)

export const DRIVERS = ['claude', 'compozy', 'script'];
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

// The value of a `key: value` line: quoted or not, with an optional trailing `# comment`.
function plainValue(raw) {
  const text = raw.replace(/\r$/, '').trim();
  const quote = text[0];
  if (quote === '"' || quote === "'") {
    const end = text.indexOf(quote, 1);
    return end === -1 ? text.slice(1) : text.slice(1, end);
  }
  return text.replace(/(^|\s)#.*$/, '').trim();
}

// { driver, language, unknown: [{ setting, value, accepted }] } from the `devkit:` block of openspec/config.yaml.
// No block, no file or a missing key gives the defaults (`claude`, `en`); other keys of the block are ignored.
export function readDevkitSettings(root) {
  let text = '';
  try { text = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8'); } catch (e) {
    if (e?.code !== 'ENOENT') throw new LoopUsageError(`openspec/config.yaml cannot be read (${e?.code ?? e})`);
  }
  const found = {};
  let inBlock = false;
  for (const line of text.split('\n')) {
    if (/^devkit:\s*(#.*)?\r?$/.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)) { inBlock = false; continue; }
    const m = /^\s+([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (m) found[m[1]] = plainValue(m[2]);
  }
  const driver = found.driver || 'claude';
  const language = found.language || 'en';
  const unknown = [];
  if (!DRIVERS.includes(driver)) unknown.push({ setting: 'driver', value: driver, accepted: DRIVERS.join(', ') });
  if (!LANGUAGE_TAG.test(language)) unknown.push({ setting: 'language', value: language, accepted: 'a language tag such as en or pt-BR' });
  return { driver, language, unknown };
}

// The person's language: `en`, and `pt-BR` for anything else (an unsubstituted placeholder included).
export const normalizeLang = (value) => (value === 'en' ? 'en' : 'pt-BR');

// The display name of the files' language, as the brief says it.
const filesLanguageName = (tag) => ({ en: 'English', 'pt-BR': 'Brazilian Portuguese' })[tag] ?? tag;

// ---------------------------------------------------------------- the message table (D-9)

// The same keys in both languages. A key holds a message, or a parameter text of its own family:
// `script.*`, `why.*` (opened, script-switched), `blocked-why.*`, `what.*`, `where.*`, `driver.*`, `setting.*`.
export const MESSAGES = {
  en: {
    'verb-not-built': '/devkit {verb} is not built yet: it arrives in round {round}. Nothing was done.',
    'verb-unknown': 'So far only /devkit change exists: type /devkit change and what you want done.',
    'not-set-up': 'This project is not set up for devkit yet: run /openspec-setup first. Nothing was run.',
    'setting-unknown': 'The project\'s devkit settings have an unknown {setting}, "{value}"; use one of: {accepted}. Nothing was run.',
    'driver-not-built': 'This project is set to run on {driver}, which is not built yet (round {round}). Nothing was run.',
    'nothing-to-resume': 'There is no unfinished change to continue: type /devkit change and what you want done.',
    choose: 'There are {n} unfinished changes: {list}. Which one should I continue?',
    'ask-unfinished': 'Before starting: {list} is unfinished. Should I continue it, or start your new request?',
    'ask-unfinished-many': 'Before starting: {list} are unfinished. Should I continue one of them, or start your new request?',
    opened: 'I opened the change {id} on the {script}, because {why}. Next come a few questions about your request; to use the {other} instead, say so before the plan is written.',
    'name-taken': 'A change named {id} already exists; I will choose another name.',
    'name-invalid': '{id} cannot be a change name: use lowercase letters, digits and dashes.',
    resumed: 'Continuing the change {id}: {where}.',
    'script-switched': 'The change {id} moves to the {script}, because {why}.',
    'script-locked': 'The plan of {id} is already written, so its script stays as it is.',
    'waiting-approval': 'The plan of {id} is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.',
    'waiting-approval-again': 'The plan of {id} changed after your approval, so it needs your approval again.',
    'waiting-retro': 'The retro of {id} has proposals for you: approve or reject each one, and I archive the change.',
    'waiting-merge': 'Pull request #{number} of {id} is ready: in this project, merging it is up to you.',
    'waiting-archive-merge': 'The archive pull request #{number} of {id} is ready: in this project, merging it is up to you.',
    'waiting-review-dispute': 'The code review of {id} still disagrees after its second round: the disputed points need your decision.',
    'waiting-by-hand': 'This project delivers each change by hand: {id} stops here, and the session writes no code for it.',
    'waiting-unrun-stage': '{Stage} of {id} has an unfinished file that no role of this version can finish: tell me its result, or remove it.',
    'waiting-pr-decision': 'A comment on the pull request of {id} asks for a decision only you can take: {url}.',
    'waiting-github': '{id} is waiting on GitHub ({what}). I keep waiting with no time limit and go on by myself when GitHub answers; calling /devkit change again is safe.',
    archived: 'The change {id} is archived: merged, with its retro. Nothing is left to do.',
    blocked: 'The change {id} stopped: {why}. Nothing more runs until this is sorted out.',
    'request-unreadable': 'I could not read that request. Type /devkit change and what you want done, or /devkit change alone to continue.',
    'script.devkit': 'full script',
    'script.devkit-lite': 'short script',
    'why.small': 'it is a small change that is easy to undo',
    'why.doubt': 'it is not clearly small, and the full script is the safe choice',
    'why.architecture': 'it changes how parts of the project fit together',
    'why.contract': 'it changes something other parts rely on',
    'why.ui': 'it changes a screen',
    'why.capability': 'it adds something the project cannot do today',
    'why.risk': 'it touches access, money or personal data, or is hard to undo',
    'blocked-why.ceiling': '{stage} failed {attempt} times, which is its limit',
    'blocked-why.no-progress': '{stage} came back with nothing changed',
    'blocked-why.not-delivered': '{stage} ended without delivering its result',
    'blocked-why.github-unreadable': 'GitHub cannot be read ({error})',
    'blocked-why.pr-closed': 'pull request #{number} was closed without merging',
    'blocked-why.previous-script': 'it began under the previous script; finish it with /ship-change {id}',
    'blocked-why.not-opened': 'its folder is incomplete',
    'blocked-why.tests-red': 'the tests of phase {phase} failed',
    'blocked-why.role-failed': '{stage} could not finish its work',
    'blocked-why.wrong-branch': 'its folder is on a branch with another name',
    'blocked-why.merge-setup': 'the repository is not prepared for automatic merging yet, which /openspec-setup does',
    'blocked-why.archive-failed': 'a step of the archive failed',
    'blocked-why.plan-not-approved': 'its plan review is not approved',
    'blocked-why.pr-problem': 'the pull request has a problem the session cannot fix alone',
    'blocked-why.unknown-step': 'the next step is one this version does not know',
    'blocked-why.unreadable': 'the change cannot be read ({error})',
    'what.checks': 'the checks of the pull request',
    'what.merge': 'the merge of the pull request',
    'what.archive-merge': 'the merge of the archive pull request',
    'where.next': 'next is {stage}',
    'where.owner': 'waiting for you at {stage}',
    'where.github': 'waiting on GitHub',
    'where.blocked': 'stopped at {stage}',
    'where.previous': 'begun under the previous script',
    'where.archiving': 'being archived',
    'where.archived': 'archived',
    'driver.compozy': 'CompozyOS',
    'driver.script': 'a command-line script',
    'setting.driver': 'driver',
    'setting.language': 'language of the files',
  },
  'pt-BR': {
    'verb-not-built': '/devkit {verb} ainda não existe: chega na rodada {round}. Nada foi feito.',
    'verb-unknown': 'Por enquanto só existe /devkit change: digite /devkit change e o que você quer fazer.',
    'not-set-up': 'Este projeto ainda não está preparado para o devkit: rode /openspec-setup primeiro. Nada foi executado.',
    'setting-unknown': 'As configurações devkit do projeto têm {setting} desconhecido, "{value}"; use um de: {accepted}. Nada foi executado.',
    'driver-not-built': 'Este projeto está configurado para rodar em {driver}, que ainda não existe (rodada {round}). Nada foi executado.',
    'nothing-to-resume': 'Não há change por terminar: digite /devkit change e o que você quer fazer.',
    choose: 'Há {n} changes por terminar: {list}. Qual delas eu continuo?',
    'ask-unfinished': 'Antes de começar: {list} está por terminar. Continuo essa change ou começo o seu novo pedido?',
    'ask-unfinished-many': 'Antes de começar: {list} estão por terminar. Continuo uma delas ou começo o seu novo pedido?',
    opened: 'Abri a change {id} no {script}, porque {why}. Agora vêm algumas perguntas sobre o seu pedido; para usar o {other}, é só dizer antes de o plano ser escrito.',
    'name-taken': 'Já existe uma change chamada {id}; vou escolher outro nome.',
    'name-invalid': '{id} não serve como nome de change: use letras minúsculas, números e hífens.',
    resumed: 'Continuando a change {id}: {where}.',
    'script-switched': 'A change {id} passa para o {script}, porque {why}.',
    'script-locked': 'O plano de {id} já foi escrito, então o roteiro fica como está.',
    'waiting-approval': 'O plano de {id} está escrito e revisado. Leia e me diga se aprova; eu sigo assim que você responder.',
    'waiting-approval-again': 'O plano de {id} mudou depois da sua aprovação, então precisa ser aprovado de novo.',
    'waiting-retro': 'A retro de {id} tem propostas para você: aprove ou recuse cada uma, e eu arquivo a change.',
    'waiting-merge': 'O pull request #{number} de {id} está pronto: neste projeto, o merge é com você.',
    'waiting-archive-merge': 'O pull request de arquivo #{number} de {id} está pronto: neste projeto, o merge é com você.',
    'waiting-review-dispute': 'A revisão de código de {id} ainda discorda depois da segunda rodada: os pontos em disputa precisam da sua decisão.',
    'waiting-by-hand': 'Este projeto entrega cada change à mão: {id} para aqui, e a sessão não escreve código para ela.',
    'waiting-unrun-stage': '{Stage} de {id} tem um arquivo inacabado que nenhum papel desta versão consegue terminar: diga o resultado ou remova o arquivo.',
    'waiting-pr-decision': 'Um comentário no pull request de {id} pede uma decisão que só você pode tomar: {url}.',
    'waiting-github': '{id} está esperando o GitHub ({what}). Eu continuo esperando, sem limite de tempo, e sigo sozinho quando o GitHub responder; chamar /devkit change de novo é seguro.',
    archived: 'A change {id} está arquivada: mesclada, com a retro. Não resta nada a fazer.',
    blocked: 'A change {id} parou: {why}. Nada mais roda até isso ser resolvido.',
    'request-unreadable': 'Não consegui ler esse pedido. Digite /devkit change e o que você quer fazer, ou só /devkit change para continuar.',
    'script.devkit': 'roteiro completo',
    'script.devkit-lite': 'roteiro curto',
    'why.small': 'é uma mudança pequena e fácil de desfazer',
    'why.doubt': 'não é claramente pequena, e o roteiro completo é a escolha segura',
    'why.architecture': 'muda como as partes do projeto se encaixam',
    'why.contract': 'muda algo de que outras partes dependem',
    'why.ui': 'muda uma tela',
    'why.capability': 'acrescenta algo que o projeto não faz hoje',
    'why.risk': 'mexe com acesso, dinheiro ou dados pessoais, ou é difícil de desfazer',
    'blocked-why.ceiling': '{stage} falhou {attempt} vezes, que é o limite',
    'blocked-why.no-progress': '{stage} voltou sem nada ter mudado',
    'blocked-why.not-delivered': '{stage} terminou sem entregar o resultado',
    'blocked-why.github-unreadable': 'não foi possível ler o GitHub ({error})',
    'blocked-why.pr-closed': 'o pull request #{number} foi fechado sem merge',
    'blocked-why.previous-script': 'ela começou no roteiro anterior; termine-a com /ship-change {id}',
    'blocked-why.not-opened': 'a pasta dela está incompleta',
    'blocked-why.tests-red': 'os testes da fase {phase} falharam',
    'blocked-why.role-failed': '{stage} não conseguiu terminar o trabalho',
    'blocked-why.wrong-branch': 'a pasta dela está num branch com outro nome',
    'blocked-why.merge-setup': 'o repositório ainda não está preparado para o merge automático, que /openspec-setup prepara',
    'blocked-why.archive-failed': 'um passo do arquivamento falhou',
    'blocked-why.plan-not-approved': 'a revisão do plano dela não está aprovada',
    'blocked-why.pr-problem': 'o pull request tem um problema que a sessão não resolve sozinha',
    'blocked-why.unknown-step': 'o próximo passo é um que esta versão não conhece',
    'blocked-why.unreadable': 'não foi possível ler a change ({error})',
    'what.checks': 'os checks do pull request',
    'what.merge': 'o merge do pull request',
    'what.archive-merge': 'o merge do pull request de arquivo',
    'where.next': 'a próxima é {stage}',
    'where.owner': 'esperando você em {stage}',
    'where.github': 'esperando o GitHub',
    'where.blocked': 'parada em {stage}',
    'where.previous': 'começada no roteiro anterior',
    'where.archiving': 'sendo arquivada',
    'where.archived': 'arquivada',
    'driver.compozy': 'CompozyOS',
    'driver.script': 'um script de linha de comando',
    'setting.driver': 'driver',
    'setting.language': 'idioma dos arquivos',
  },
};

// A stage as a noun phrase inside a sentence: en `the` + the title in sentence case, pt-BR `a etapa` + the title.
const stagePhrase = (lang, title) => (lang === 'en' ? `the ${inSentence(title)}` : `a etapa ${title}`);
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const FAMILY = { script: 'script.', other: 'script.', what: 'what.', driver: 'driver.', setting: 'setting.' };

// One message, in the person's language, its `{name}` parameters filled. A code parameter (`script`, `other`, `why`,
// `what`, `driver`, `setting`) is looked up in its family of the same table; `stage` is the stage's title in the
// person's language. An unknown key or a missing parameter is a LoopUsageError.
export function render(lang, key, params = {}) {
  const l = normalizeLang(lang);
  const template = MESSAGES[l][key];
  if (template === undefined) throw new LoopUsageError(`unknown reply key ${key}`);
  const need = (name) => {
    if (params[name] === undefined || params[name] === null) throw new LoopUsageError(`reply ${key} needs the parameter ${name}`);
    return String(params[name]);
  };
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    if (name === 'stage') return stagePhrase(l, need('stage'));
    if (name === 'Stage') return capital(stagePhrase(l, need('stage')));
    if (name === 'why') return render(l, `${key === 'blocked' ? 'blocked-why' : 'why'}.${need('why')}`, params);
    if (FAMILY[name]) return render(l, `${FAMILY[name]}${need(name)}`, params);
    return need(name);
  });
}

// ---------------------------------------------------------------- the decision (D-5), pure

const AGENT = {
  'change-planner': 'devkit-core:change-planner',
  'plan-readiness-reviewer': 'devkit-core:plan-readiness-reviewer',
  'tdd-implementer': 'devkit-core:tdd-implementer',
  'pr-verifier': 'devkit-core:pr-verifier',
  'commit-and-pr': 'devkit-core:commit-and-pr',
};
const BUILD_PARTS = ['build', 'after', 'delivery', 'close'];
const PLAN_REASONS = ['no-file', 'no-header', 'bad-header', 'header-other-stage', 'not-judged', 'stale-plan', 'rerun-after-fix'];
const NOT_DELIVERED = ['no-file', 'not-judged', 'no-header', 'bad-header', 'header-other-stage'];
const SWITCH_FLAGS = ['architecture', 'contract', 'ui'];
const BLOCKED_OF = { 'ceiling-reached': 'ceiling', 'no-progress': 'no-progress', 'gh-error': 'github-unreadable', 'checks-unreadable': 'github-unreadable', 'pr-closed': 'pr-closed' };

// True when the step inside the stage comes from the delivery checker: the current stage is in the build-to-archive
// part, or the change is archived while its archive pull request may still be open.
export function inDelivery(report, flow, archiving) {
  if (report?.script === 'previous') return false;
  if (report?.end?.state === 'blocked') return false;
  if (report?.end?.state === 'archived') return Boolean(archiving);
  const current = report?.next?.stage ?? report?.end?.stage ?? null;
  const part = flow?.stages.find((s) => s.id === current)?.part;
  return BUILD_PARTS.includes(part);
}

const detailOf = (next) => {
  const { actor, agent, askable, blockedState, ...rest } = next; // eslint-disable-line no-unused-vars
  return rest;
};

// How each step of the delivery checker (and the two overrides of conduct-check) is handled: the stage it belongs to
// and, for a hand-off, the role (its agent comes from the checker's row, `AGENT` below only as the fallback); `end` rows
// build their own end.
const handOff = (stage, role) => ({ stage, role });
const session = (stage) => ({ stage, session: true });
const ROWS = {
  implement: handOff('implementation', 'tdd-implementer'),
  'fix-review': handOff('implementation', 'tdd-implementer'),
  'fix-defect': handOff('implementation', 'tdd-implementer'),
  'fix-checks': handOff('implementation', 'tdd-implementer'),
  'apply-proposals': handOff('implementation', 'tdd-implementer'),
  'resolve-release-conflict': handOff('implementation', 'tdd-implementer'),
  commit: handOff('delivery', 'commit-and-pr'),
  'open-pr': handOff('delivery', 'commit-and-pr'),
  push: handOff('delivery', 'commit-and-pr'),
  'open-archive-pr': handOff('delivery', 'commit-and-pr'),
  'push-rebased': handOff('delivery', 'commit-and-pr'),
  verify: handOff('evidence', 'pr-verifier'),
  review: session('review'),
  gate: session('implementation'),
  'edit-pr-body': session('delivery'),
  'enable-auto-merge': session('delivery'),
  'disable-auto-merge': session('delivery'),
  'update-branch': session('delivery'),
  answer: session('delivery'),
  retro: session('retro'),
  archive: session('retro'),
  'tick-roadmap': session('retro'),
  'wait-checks': { end: 'github' },
  'wait-merge': { end: 'github' },
  ready: { end: 'owner' },
  'archive-pr-ready': { end: 'owner' },
  'stop-review-deadlock': { end: 'owner' },
  'stop-retro-answers': { end: 'owner' },
  'stop-plan-approval': { end: 'owner' },
  'stop-plan-mode': { end: 'owner' },
  'stop-branch': { end: 'blocked' },
  'stop-merge-setup': { end: 'blocked' },
  'stop-archive': { end: 'blocked' },
  'stop-not-approved': { end: 'blocked' },
  blocked: { end: 'blocked' },
  archived: { end: 'archived' },
};
export const ROW_STEPS = Object.keys(ROWS);
const AGENT_STEPS = ROW_STEPS.filter((s) => ROWS[s].role);
const BLOCKED_STEP = { 'stop-branch': 'wrong-branch', 'stop-merge-setup': 'merge-setup', 'stop-archive': 'archive-failed', 'stop-not-approved': 'plan-not-approved', blocked: 'pr-problem' };
const OWNER_STEP = {
  ready: 'waiting-merge', 'archive-pr-ready': 'waiting-archive-merge', 'stop-review-deadlock': 'waiting-review-dispute',
  'stop-retro-answers': 'waiting-retro', 'stop-plan-mode': 'waiting-by-hand',
};

// The exit code of an action: 0 an action or archived, 1 a wait, 2 blocked, 3 the change cannot be read.
export function exitCodeOf(action) {
  if (action.kind !== 'end') return 0;
  const { state, why } = action.end;
  if (state === 'archived') return 0;
  if (state === 'blocked') return why === 'unreadable' ? 3 : 2;
  return 1;
}

// facts: { ctx: { id, script, root, branch, lang, filesLanguage }, flow, report (flow-check's), after, fingerprint,
// approval (deliver-check's approvalState), hasProposal, flags (the grill's classification), archiving, row
// (conduct-check's deliveryRow result, `{ error }` when it threw, null when not read) }.
// Returns the action of the design's JSON; pure.
export function decide(facts) {
  const { ctx, flow, report } = facts;
  const lang = normalizeLang(ctx.lang);
  const say = (key, params = {}) => render(lang, key, { id: ctx.id, ...params });
  const stageById = (id) => flow?.stages.find((s) => s.id === id) ?? null;
  const titleOf = (id) => stageById(id)?.title[lang] ?? id;
  const base = { version: 1, change: ctx.id, script: ctx.script, root: ctx.root, branch: ctx.branch, filesLanguage: ctx.filesLanguage };
  const stageFields = (id) => {
    const s = stageById(id);
    return { stage: s ? id : null, stageTitle: s ? s.title[lang] : null, role: s?.role ?? null, skills: s?.skills ?? [] };
  };
  const finish = (state, why, key, params, stageId, detail) => ({
    ...base, kind: 'end', ...stageFields(stageId), end: { state, why }, ...(detail ? { detail } : {}), reply: say(key, params),
  });
  const blocked = (why, params = {}, stageId = null, detail) => finish('blocked', why, 'blocked', { why, ...params }, stageId, detail);
  const waiting = (state, key, stageId, params = {}, detail) => finish(state, key, key, params, stageId, detail);

  const key = (stage, step) => `${stage}/${step ?? stage}@${facts.fingerprint}`;
  const brief = (stage, what) => `Change ${ctx.id} (${ctx.script} script), stage ${stage}: ${what}. Work only in ${ctx.root} on branch ${ctx.branch}; `
    + `every file path is absolute under it; start every Bash command with cd ${ctx.root} && ; do not fetch. `
    + `Write the change's files in ${filesLanguageName(ctx.filesLanguage)}.`;

  // K1 and K2: the loop does not repeat a stage that made no progress, nor one its agent did not deliver.
  const guard = (action) => {
    const after = facts.after;
    if (!after) return action;
    if (after === action.progressKey) return blocked('no-progress', { stage: titleOf(action.stage) }, action.stage);
    const m = /^([^/]+)\/([^@]*)@/.exec(after);
    const s = stageById(action.stage);
    if (m && m[1] === action.stage && (m[2] === action.stage || AGENT_STEPS.includes(m[2])) && s?.source === 'artifact' && AGENT[s.role]) {
      const entry = report.stages.find((x) => x.id === action.stage);
      if (entry?.state === 'pending' && NOT_DELIVERED.includes(entry.reasonCode)) return blocked('not-delivered', { stage: titleOf(action.stage) }, action.stage);
    }
    return action;
  };
  // The agent of a delivery hand-off is the checker's row's (`conduct-check`'s actorOf owns the fact); the role's map only
  // when the row names none, and for the plan stages, which have no row.
  const agent = (stage, role, step, what, detail, named) => guard({
    ...base, kind: 'agent', ...stageFields(stage), agent: named ?? AGENT[role], ...(step ? { step } : {}), ...(detail ? { detail } : {}),
    brief: brief(stage, what), progressKey: key(stage, step),
  });
  const sessionAction = (stage, step, detail, extra = {}) => guard({
    ...base, kind: 'session', ...stageFields(stage), step, ...(detail ? { detail } : {}), ...extra, progressKey: key(stage, step),
  });

  if (report.script === 'previous') return blocked('previous-script');
  const currentId = report.next?.stage ?? report.end?.stage ?? null;
  const endState = report.end?.state;
  if (endState === 'archived' && !facts.archiving) return finish('archived', 'archived', 'archived', {}, null);

  if (!inDelivery(report, flow, facts.archiving)) return planPart();
  return buildPart();

  // -------- the open and plan parts: P1 to P9
  function planPart() {
    const n = report.next;
    const e = report.end;
    if (n?.stage === 'open') return blocked('not-opened', {}, 'open');
    if (n?.stage === 'requirements' || (e?.state === 'waiting-for-owner' && e.stage === 'requirements')) {
      return { ...base, kind: 'grill', ...stageFields('requirements'), progressKey: key('requirements') };
    }
    if (n) {
      const s = stageById(n.stage);
      const requirements = report.stages.find((x) => x.id === 'requirements');
      const flags = SWITCH_FLAGS.filter((f) => (facts.flags ?? []).includes(f));
      if (n.stage === 'proposal' && ctx.script === 'devkit-lite' && requirements?.state === 'passed' && !facts.hasProposal && flags.length) {
        const command = ['node', join(HOOKS_DIR, 'change-loop.mjs'), 'script', ctx.id, 'devkit', '--why', flags[0], '--lang', lang];
        return sessionAction('proposal', 'switch-script', { command }, { reply: say('script-switched', { script: 'devkit', why: flags[0] }) });
      }
      if (n.reasonCode === 'fix-after-failure') {
        const { failed, attempt, ceiling } = n.params;
        return agent(n.stage, s.role, null, `${failed} failed at attempt ${attempt} of ${ceiling}: revise the plan from its findings`);
      }
      if (PLAN_REASONS.includes(n.reasonCode) && s && AGENT[s.role]) {
        const what = ['stale-plan', 'rerun-after-fix'].includes(n.reasonCode) ? `${n.stage} is out of date: bring it up to date`
          : s.role === 'plan-readiness-reviewer' ? 'review the plan'
            : `write the plan files the script still lacks, from ${n.stage} on, each from \`openspec instructions <artifact> --change ${ctx.id}\``;
        return agent(n.stage, s.role, null, what);
      }
      return blocked('unknown-step', {}, n.stage);
    }
    if (e.state === 'waiting-for-owner' && e.stage === 'approval' && e.reasonCode === 'owner-pending') return waiting('waiting-for-owner', 'waiting-approval', 'approval', {}, { readiness: facts.approval?.readiness ?? null });
    if (e.state === 'waiting-for-owner' && e.stage === 'approval' && e.reasonCode === 'approval-stale') return waiting('waiting-for-owner', 'waiting-approval-again', 'approval', {}, { readiness: facts.approval?.readiness ?? null });
    if (e.state === 'waiting-for-owner' && e.reasonCode === 'unshipped-role-pending') return waiting('waiting-for-owner', 'waiting-unrun-stage', e.stage, { stage: titleOf(e.stage) });
    if (e.state === 'blocked') return blockedEnd(e);
    return blocked('unknown-step', {}, e.stage);
  }

  // P9 and B0: a blocked end of the stage checker, in plain words.
  function blockedEnd(e) {
    const why = BLOCKED_OF[e.reasonCode] ?? 'role-failed';
    const stageId = e.params?.stage ?? e.stage;
    return blocked(why, { stage: titleOf(stageId), attempt: e.params?.attempt, error: e.params?.error ?? '', number: e.params?.number }, e.stage);
  }

  // -------- from the implementation to the archive: B0 to B17
  function buildPart() {
    if (endState === 'blocked') return blockedEnd(report.end);
    const row = facts.row;
    if (!row) return blocked('unknown-step', {}, currentId);
    if (row.error !== undefined) return blocked('unreadable', { error: row.error }, currentId);
    const step = row.next.step;
    const spec = ROWS[step];
    if (!spec) return blocked('unknown-step', {}, currentId);
    const detail = detailOf(row.next);
    if (spec.role) return agent(spec.stage, spec.role, step, `step ${step} ${JSON.stringify(detail)}`, detail, row.next.agent);
    if (spec.session) return sessionAction(spec.stage, step, detail);
    switch (spec.end) {
      case 'github': return waiting('waiting-on-github', 'waiting-github', currentId, { what: step === 'wait-checks' ? 'checks' : facts.archiving ? 'archive-merge' : 'merge' });
      case 'blocked': return blocked(BLOCKED_STEP[step], {}, currentId);
      case 'archived': return finish('archived', 'archived', 'archived', {}, currentId);
      default: break;
    }
    if (step === 'stop-plan-approval') {
      const again = facts.approval?.status === 'APPROVED' && Boolean(facts.approval.recorded);
      return waiting('waiting-for-owner', again ? 'waiting-approval-again' : 'waiting-approval', currentId, {}, { readiness: facts.approval?.readiness ?? row.next.readiness ?? null });
    }
    const number = row.next.number ?? row.delivered?.next?.number;
    return waiting('waiting-for-owner', OWNER_STEP[step], currentId, number === undefined ? {} : { number });
  }
}

// ---------------------------------------------------------------- reading the change (D-5)

// Environment the delivery checkers must not see: conduct-check's cleanOf (the same names).
const CLEAN_KEYS = ['DEVKIT_CHANGE', 'DEVKIT_BRANCH', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF', 'DEVKIT_BYPASS'];
function cleanOf(env) {
  const clean = { ...env };
  for (const k of CLEAN_KEYS) delete clean[k];
  return clean;
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}
const tryGit = (root, args) => { try { return git(root, args).trim(); } catch { return ''; } };

// The main checkout: the parent of the shared git directory.
const mainRoot = (root) => {
  const common = tryGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return common ? dirname(common) : root;
};

// The default branch the change's pull request targets: origin/HEAD, else main, else master.
function defaultBase(root) {
  const head = tryGit(root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD']).replace(/^origin\//, '');
  if (head) return head;
  for (const b of ['main', 'master']) {
    if (tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${b}`]) || tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${b}`])) return b;
  }
  return 'main';
}

// The checkout of change `id`: a worktree on its archive branch, else one on its own branch, else the main checkout.
export function locate(start, id) {
  const worktrees = listWorktrees(start);
  const own = worktrees.find((w) => w.branch === `chore/archive-${id}`) ?? worktrees.find((w) => w.branch === id);
  if (own) return { root: realpathSync(own.path), branch: own.branch };
  const root = mainRoot(start);
  return { root, branch: tryGit(root, ['symbolic-ref', '--short', '-q', 'HEAD']) };
}

// The flags of the grill's `Classification: ... flags=[..]` line in requirements.md.
function classificationFlags(dir) {
  const file = join(dir, 'requirements.md');
  if (!existsSync(file)) return [];
  const m = /^.*Classification:.*flags=\[([^\]]*)\]/m.exec(readFileSync(file, 'utf8'));
  return m ? m[1].split(',').map((f) => f.trim().toLowerCase()).filter(Boolean) : [];
}

// The next action of change `id`, read from the files, git and GitHub of its checkout. Errors (an unknown change, an
// unreadable setting, no openspec CLI) are thrown; a delivery checker that throws becomes the `unreadable` end.
export function nextAction(cwd, id, { env = process.env, lang = 'pt-BR', after = null, openspec, gh } = {}) {
  const clean = cleanOf(env);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = locate(start, id);
  const settings = readDevkitSettings(found.root);
  const filesLanguage = settings.unknown.some((u) => u.setting === 'language') ? 'en' : settings.language;
  const run = openspec ?? makeOpenspec(found.root, clean);
  const { facts, flow } = collectFlow(found.root, id, { env: clean, openspec: run, ...(gh ? { gh } : {}) });
  const report = computeFlow(facts, flow, {});
  const archiving = found.branch === `chore/archive-${id}`;
  const dir = locateChange(found.root, id)?.dir ?? join(found.root, 'openspec', 'changes', id);
  let row = null;
  if (inDelivery(report, flow, archiving)) {
    try {
      const ghRun = gh ?? makeGh(found.root, clean);
      const state = collectState(found.root, id, { env: clean, gh: ghRun });
      const delivered = buildReport(state, clean);
      const baseBranch = defaultBase(found.root);
      row = deliveryRow({ ref: `origin/${baseBranch}`, base: baseBranch }, { id, worktree: found.root }, { state, report: delivered });
    } catch (e) {
      row = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return decide({
    ctx: { id, script: facts.schema ?? report.schema ?? 'devkit', root: found.root, branch: found.branch, lang: normalizeLang(lang), filesLanguage },
    flow,
    report,
    after,
    fingerprint: facts.fingerprint ?? fingerprint(found.root, facts.head ?? null),
    approval: approvalState(dir),
    hasProposal: existsSync(join(dir, 'proposal.md')),
    flags: classificationFlags(dir),
    archiving,
    row,
  });
}

// ---------------------------------------------------------------- checkouts and unfinished work (D-3, D-6)

// Every checkout of the repository, the main one included: [{ root (real path), branch }].
function checkoutsOf(start) {
  const seen = new Set();
  const out = [];
  const add = (path, branch) => {
    let real;
    try { real = realpathSync(path); } catch { return; }
    if (seen.has(real)) return;
    seen.add(real);
    out.push({ root: real, branch });
  };
  for (const w of listWorktrees(start)) add(w.path, w.branch);
  const main = mainRoot(start);
  add(main, tryGit(main, ['symbolic-ref', '--short', '-q', 'HEAD']));
  return out;
}

function activeIds(root) {
  const dir = join(root, 'openspec', 'changes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n !== 'archive' && !n.startsWith('.') && statSync(join(dir, n)).isDirectory());
}

// The ids archived on the default branch (D-3): the union of every source that can be read, since an archived folder
// never leaves the default branch. GitHub's default branch, the remote-tracking one, the local one and the main
// checkout's working tree; a source that cannot be read adds nothing.
const ARCHIVED = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
// Each archived id with the latest day an archived folder of it carries (an id can be archived more than once).
function archivedDates(start, { env = process.env, gh } = {}) {
  const main = realpathSync(mainRoot(start));
  const base = defaultBase(main);
  const ids = new Map();
  const addNames = (names) => { for (const name of names) { const m = ARCHIVED.exec(name); if (m && !(ids.get(m[2]) >= m[1])) ids.set(m[2], m[1]); } };
  const folder = 'openspec/changes/archive';
  try {
    const run = (gh ?? makeGh(main, cleanOf(env)))(['api', `repos/{owner}/{repo}/contents/${folder}?ref=${base}`]);
    const listing = run.status === 0 ? JSON.parse(run.stdout) : [];
    if (Array.isArray(listing)) addNames(listing.map((e) => String(e?.name ?? '')));
  } catch { /* GitHub could not be read: the other sources answer */ }
  for (const ref of [`refs/remotes/origin/${base}`, `refs/heads/${base}`]) addNames(tryGit(main, ['ls-tree', '--name-only', `${ref}:${folder}`]).split('\n'));
  const dir = join(main, folder);
  if (existsSync(dir)) addNames(readdirSync(dir));
  return ids;
}
export const archivedOnDefault = (start, opts) => new Set(archivedDates(start, opts).keys());

// True when the active folder of `id` in `root` records a creation day later than the archive day: a new change that
// reuses an archived id, not the stale copy of the archived one. A folder that records no day is the stale copy.
function createdAfter(root, id, archivedDay) {
  try {
    const m = /^created:\s*['"]?(\d{4}-\d{2}-\d{2})/m.exec(readFileSync(join(root, 'openspec', 'changes', id, '.openspec.yaml'), 'utf8'));
    return Boolean(m) && m[1] > archivedDay;
  } catch { return false; }
}

// The unfinished changes (D-3): an active folder in the main checkout or any worktree, or a worktree on
// `chore/archive-<id>` (its archive pull request is not merged yet). Each once; a worktree on the archive branch wins,
// then one on the change's own branch, then any other checkout. A change archived on the default branch is never
// unfinished, whatever old checkout still holds its folder or its branch, unless that folder was created after the
// archive (a new change that reuses the id).
export function unfinished(start, { env = process.env, gh } = {}) {
  const archived = archivedDates(start, { env, gh });
  const found = new Map();
  const note = (id, c, rank, reused = false) => { if ((!archived.has(id) || reused) && (!found.has(id) || found.get(id).rank < rank)) found.set(id, { id, root: c.root, branch: c.branch, rank }); };
  for (const c of checkoutsOf(start)) {
    const archive = /^chore\/archive-(.+)$/.exec(c.branch);
    if (archive) note(archive[1], c, 3);
    for (const id of activeIds(c.root)) note(id, c, c.branch === id ? 2 : 1, archived.has(id) && createdAfter(c.root, id, archived.get(id)));
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, root, branch }) => ({ id, root, branch }));
}

// The checkout holding change `id` as a folder, active or archived, in the main checkout or any worktree; null when none.
function knownChange(start, id) {
  const own = locate(start, id);
  const candidates = [{ root: own.root, branch: own.branch }, ...checkoutsOf(start)];
  for (const c of candidates) if (locateChange(c.root, id)) return c;
  const archive = checkoutsOf(start).find((c) => c.branch === `chore/archive-${id}`);
  return archive ?? null;
}

// Where the change stopped, in one phrase of the person's language, from the stage checker's report in its checkout
// (the next stage's title, or the end state with its stage's title). Throws LoopUsageError when it cannot be read.
export function whereOf(found, id, { lang = 'pt-BR', env = process.env, openspec, gh } = {}) {
  const l = normalizeLang(lang);
  const clean = cleanOf(env);
  let flow;
  let report;
  try {
    const read = collectFlow(found.root, id, { env: clean, openspec: openspec ?? makeOpenspec(found.root, clean), ...(gh ? { gh } : {}) });
    flow = read.flow;
    report = computeFlow(read.facts, flow, {});
  } catch (e) {
    throw new LoopUsageError(`${id} cannot be read in ${found.root}: ${e instanceof Error ? e.message : e}`);
  }
  const title = (stage) => flow?.stages.find((s) => s.id === stage)?.title[l] ?? stage ?? id;
  if (report.script === 'previous') return render(l, 'where.previous');
  const e = report.end;
  if (e?.state === 'archived') return render(l, found.branch === `chore/archive-${id}` ? 'where.archiving' : 'where.archived');
  if (report.next) return render(l, 'where.next', { stage: title(report.next.stage) });
  if (e?.state === 'waiting-for-owner') return render(l, 'where.owner', { stage: title(e.stage) });
  if (e?.state === 'waiting-on-github') return render(l, 'where.github');
  return render(l, 'where.blocked', { stage: title(e?.stage) });
}

// ---------------------------------------------------------------- start (D-3)

const VERB_ROUND = { roadmap: 18, status: 18, project: 19, help: 23 };
const DRIVER_ROUND = { compozy: 21, script: 22 };

// The verb is the first word, lower-cased; the text is the rest, trimmed.
export function parseStart(input) {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(String(input ?? '').trim());
  return m ? { verb: m[1].toLowerCase(), text: (m[2] ?? '').trim() } : { verb: '', text: '' };
}

// Rows S3 to S5 (and O3): the project is set up, its settings are known and its driver is built; else the reply of
// the row that stops it.
function projectGate(start, settings) {
  if (!start || !optedIn(start)) return { mode: 'not-set-up', key: 'not-set-up', params: {} };
  const unknown = settings.unknown[0];
  if (unknown) return { mode: 'setting-unknown', key: 'setting-unknown', params: { setting: unknown.setting, value: unknown.value, accepted: unknown.accepted } };
  if (DRIVER_ROUND[settings.driver]) return { mode: 'driver-not-built', key: 'driver-not-built', params: { driver: settings.driver, round: DRIVER_ROUND[settings.driver] } };
  return null;
}

const filesLanguageOf = (settings) => (settings.unknown.some((u) => u.setting === 'language') ? 'en' : settings.language);

// What `/devkit change` does with the request: { version, mode, verb, text, change, unfinished, settings, reply }.
// Read-only: it creates and runs nothing.
export function startMode(cwd, input, { lang = 'pt-BR', env = process.env, openspec, gh } = {}) {
  const l = normalizeLang(lang);
  const { verb, text } = parseStart(input);
  const start = findRoot(cwd);
  const settings = start ? readDevkitSettings(start) : { driver: 'claude', language: 'en', unknown: [] }; // S0 when unreadable
  const out = (mode, extra = {}) => ({
    version: 1, mode, verb, text, change: null, unfinished: [],
    settings: { driver: settings.driver, filesLanguage: filesLanguageOf(settings), personLanguage: l }, ...extra,
  });
  const say = (key, params = {}) => render(l, key, params);
  if (VERB_ROUND[verb]) return out('not-built', { reply: say('verb-not-built', { verb, round: VERB_ROUND[verb] }) });
  if (verb !== 'change') return out('unknown-verb', { reply: say('verb-unknown') });
  const gate = projectGate(start, settings);
  if (gate) return out(gate.mode, { reply: say(gate.key, gate.params) });

  const read = { lang: l, env, openspec, gh };
  const list = unfinished(start, { env, gh }).map((u) => {
    let where = null;
    try { where = whereOf(u, u.id, read); } catch (e) { if (!(e instanceof LoopUsageError)) throw e; }
    return { id: u.id, root: u.root, where };
  });
  const resume = (id, where) => out('resume', { change: id, unfinished: list, reply: say('resumed', { id, where }) });
  if (/^\S+$/.test(text)) {
    const known = knownChange(start, text);
    if (known) return resume(text, list.find((u) => u.id === text)?.where ?? whereOf(known, text, read));
  }
  const listed = list.map((u) => (u.where ? `${u.id} (${u.where})` : u.id)).join('; ');
  if (text === '') {
    if (list.length === 1) return resume(list[0].id, list[0].where ?? whereOf({ root: list[0].root, branch: '' }, list[0].id, read));
    if (list.length > 1) return out('choose', { unfinished: list, reply: say('choose', { n: list.length, list: listed }) });
    return out('nothing', { reply: say('nothing-to-resume') });
  }
  if (list.length) return out('ask-unfinished', { unfinished: list, reply: say(list.length === 1 ? 'ask-unfinished' : 'ask-unfinished-many', { list: listed }) });
  return out('new');
}

// ---------------------------------------------------------------- open and script (D-4)

const SCRIPTS = ['devkit', 'devkit-lite'];
const WHY_CODES = ['small', 'doubt', 'architecture', 'contract', 'ui', 'capability', 'risk'];
// O1: 2 to 48 characters, lowercase letters and digits in words joined by single dashes (no dash first or last, no two in a row).
const NAME = /^(?=.{2,48}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const otherScript = (script) => SCRIPTS.find((s) => s !== script);

function gitRun(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch (e) {
    throw new LoopUsageError(`git ${args[0]} failed: ${String(e?.stderr || e?.message || e).trim()}`);
  }
}

// The request as a Markdown quote under `## Request` of the schema's requirements template (header left pending).
function requirementsFor(template, request) {
  const quoted = request.split('\n').map((line) => (line.trim() === '' ? '>' : `> ${line.replace(/\s+$/, '')}`)).join('\n');
  if (!/## Request\n[\s\S]*?\n## /.test(template)) throw new LoopUsageError('the requirements template has no "## Request" section');
  return template.replace(/(## Request\n)[\s\S]*?(\n## )/, (_, open, close) => `${open}\n${quoted}\n${close}`);
}

// Every reason an id is taken (O2): a change folder (active or archived) in any checkout, a local branch, an archive
// branch, a remote branch or the worktree folder.
function nameTaken(start, main, id) {
  if (checkoutsOf(start).some((c) => locateChange(c.root, id))) return true;
  for (const ref of [`refs/heads/${id}`, `refs/heads/chore/archive-${id}`, `refs/remotes/origin/${id}`]) {
    if (tryGit(main, ['rev-parse', '--verify', '--quiet', ref])) return true;
  }
  return existsSync(join(main, '.claude', 'worktrees', id));
}

// `open <id> --script <s> --why <code>`, the request on standard input. Creates the worktree, the change and its
// requirements file; refusals are LoopRefusal (exit 3, nothing created).
export function openChange(cwd, id, { script, why, request, lang = 'pt-BR', env = process.env, openspec } = {}) {
  const l = normalizeLang(lang);
  const refuse = (key, params = {}) => new LoopRefusal(key, render(l, key, params));
  if (!NAME.test(id) || id === 'archive') throw refuse('name-invalid', { id });
  if (!SCRIPTS.includes(script)) throw new LoopUsageError(`open needs --script ${SCRIPTS.join(' or ')}`);
  if (!WHY_CODES.includes(why)) throw new LoopUsageError(`open needs --why with one of: ${WHY_CODES.join(', ')}`);
  const text = String(request ?? '').trim();
  if (!text) throw new LoopUsageError('open needs the request on standard input');
  const start = findRoot(cwd);
  const settings = start ? readDevkitSettings(start) : { driver: 'claude', language: 'en', unknown: [] };
  const gate = projectGate(start, settings);
  if (gate) throw refuse(gate.key, gate.params);

  const main = mainRoot(start);
  const hasOrigin = gitRun(main, ['remote']).split('\n').includes('origin');
  if (hasOrigin) gitRun(main, ['fetch', 'origin', '--prune', '--quiet']);
  if (nameTaken(start, main, id)) throw refuse('name-taken', { id });

  let base = 'HEAD';
  if (hasOrigin) {
    base = `origin/${defaultBase(main)}`;
    if (!tryGit(main, ['rev-parse', '--verify', '--quiet', `refs/remotes/${base}`])) throw new LoopUsageError(`${base} does not exist: nothing to start the change from`);
  }
  const worktree = join(main, '.claude', 'worktrees', id);
  gitRun(main, ['worktree', 'add', '-q', '-b', id, worktree, base]);
  try {
    const created = (openspec ?? makeOpenspec(worktree, cleanOf(env)))(['new', 'change', id, '--schema', script]);
    if (created.status !== 0) throw new LoopUsageError(`openspec new change failed: ${(created.stderr || created.stdout).trim()}`);
    const schema = schemaFile(worktree, script);
    const template = schema ? join(dirname(schema), 'templates', 'requirements.md') : null;
    if (!template || !existsSync(template)) throw new LoopUsageError(`the ${script} schema has no requirements template`);
    mkdirSync(join(worktree, 'openspec', 'changes', id), { recursive: true });
    writeFileSync(join(worktree, 'openspec', 'changes', id, 'requirements.md'), requirementsFor(readFileSync(template, 'utf8'), text));
  } catch (e) {
    // O5: leave nothing half made. Each step is tried on its own (a failed one does not skip the next) and none of their
    // errors replaces the original one: the worktree, its folder if still there (and its registration, which git keeps
    // while the branch is "used by" it), then the branch this call just created.
    for (const cleanup of [
      () => gitRun(main, ['worktree', 'remove', '--force', worktree]),
      () => rmSync(worktree, { recursive: true, force: true }),
      () => gitRun(main, ['worktree', 'prune']),
      () => gitRun(main, ['branch', '-D', id]),
    ]) {
      try { cleanup(); } catch { /* best effort: the original error is the one reported */ }
    }
    throw e;
  }
  return { version: 1, change: id, script, worktree, branch: id, base, reply: render(l, 'opened', { id, script, other: otherScript(script), why }) };
}

// `script <id> <script> --why <code>`: the correction of the script until the proposal is written (C1 to C3).
// { code, body }.
export function switchScript(cwd, id, script, { why, lang = 'pt-BR' } = {}) {
  const l = normalizeLang(lang);
  if (!SCRIPTS.includes(script)) throw new LoopUsageError(`script needs ${SCRIPTS.join(' or ')}, not ${script}`);
  if (why !== undefined && !WHY_CODES.includes(why)) throw new LoopUsageError(`--why needs one of: ${WHY_CODES.join(', ')}`);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = locate(start, id);
  const located = locateChange(found.root, id);
  if (!located || located.archived) throw new LoopUsageError(`no active change named ${id}`);
  const file = join(located.dir, '.openspec.yaml');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const current = /^schema:[ \t]*(\S+)/m.exec(text)?.[1];
  if (!current) throw new LoopUsageError(`${id}'s .openspec.yaml names no schema`);
  const body = { version: 1, change: id, script: current };
  if (existsSync(join(located.dir, 'proposal.md'))) return { code: 2, body: { ...body, reply: render(l, 'script-locked', { id }) } }; // C2
  if (current === script) return { code: 0, body }; // C3
  if (why === undefined) throw new LoopUsageError('script needs --why to switch');
  writeFileSync(file, text.replace(/^schema:[ \t]*\S+/m, `schema: ${script}`)); // C1
  return { code: 0, body: { ...body, script, reply: render(l, 'script-switched', { id, script, why }) } };
}

// ---------------------------------------------------------------- wait (D-7)

const isWait = (a) => a.kind === 'end' && a.end.state === 'waiting-on-github';
const decisionKey = (a) => JSON.stringify([a.kind, a.end?.state ?? null, a.end?.why ?? null, a.agent ?? null, a.step ?? null, a.reply ?? null]);
const isUnreadable = (a) => a.kind === 'end' && a.end.why === 'github-unreadable';

// Polls `poll()` (the decision `next` gives) every `interval` seconds while it stays the same wait on GitHub, with no
// limit of its own, and returns the first decision that is anything else (the first decision itself when it is not a
// wait). A poll that throws, or that says GitHub cannot be read, is retried; `maxFailures` in a row return blocked,
// `github-unreadable`. Holds no state but the first decision.
export async function waitLoop({ poll, sleep, interval, id, lang, maxFailures = 3 }) {
  const first = await poll();
  if (!isWait(first)) return first;
  const wanted = decisionKey(first);
  let failures = 0;
  for (;;) {
    await sleep(interval);
    let action = null;
    let error = null;
    try { action = await poll(); } catch (e) { error = e; }
    if (error || isUnreadable(action)) {
      failures += 1;
      if (failures < maxFailures) continue;
      if (action) return action;
      const { version, change, script, root, branch, filesLanguage, stage, stageTitle, role, skills } = first;
      const message = error instanceof Error ? error.message : String(error);
      return {
        version, change: change ?? id, script, root, branch, filesLanguage, kind: 'end', stage, stageTitle, role, skills,
        end: { state: 'blocked', why: 'github-unreadable' }, reply: render(lang, 'blocked', { id, why: 'github-unreadable', error: message }),
      };
    }
    failures = 0;
    if (decisionKey(action) !== wanted) return action;
  }
}

// ---------------------------------------------------------------- the locks (D-8)

const allow = (why, change = null) => ({ decision: 'allow', why, change });

// The refusal record of a session (`<session_id>.json`) or of a subagent (`<session_id>-<agent_id>.json`) under
// `<os.tmpdir()>/devkit-stop/`: the progress key of the state last refused.
const safeName = (value) => String(value ?? 'session').replace(/[^\w.-]/g, '_').slice(0, 120) || 'session';
const recordFile = (input) => join(tmpdir(), 'devkit-stop', `${safeName(input.session_id)}${input.agent_id ? `-${safeName(input.agent_id)}` : ''}.json`);
function recordedKey(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')).key ?? null; } catch { return null; }
}

// Refuses once for a state: the same key as the record is let through; a refusal that cannot be recorded would repeat
// forever, so it is let through too (the caller's catch).
function refuseOnce(input, key, why, change, reason) {
  const file = recordFile(input);
  if (recordedKey(file) === key) return allow('same-state', change);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ key })}\n`);
  return { decision: 'refuse', why, change, reason };
}

const hasTasks = (tasks) => (Array.isArray(tasks) ? tasks.length > 0 : Boolean(tasks) && typeof tasks === 'object' && Object.keys(tasks).length > 0);

// `guard.mjs stop` (T1 to T7): the session in a run does not end its turn while the loop has a stage ready.
export function stopDecision(input, { env = process.env } = {}) {
  let change = null;
  try {
    const run = runOf(input);
    if (!run) return allow('no-run');
    change = run.change;
    if (hasTasks(input.background_tasks)) return allow('background-task', change);
    if (run.ended) return allow('end-recorded', change); // T3a: the run's last recorded action is an end
    const lang = normalizeLang(env.CLAUDE_PLUGIN_OPTION_LANGUAGE);
    const action = nextAction(input.cwd ?? process.cwd(), change, { env, lang });
    if (action.kind === 'end') return allow('end', change);
    if (action.kind === 'grill') return allow('grill', change);
    if (action.kind !== 'agent' && action.kind !== 'session') return allow('no-stage', change);
    const who = action.kind === 'agent' ? action.agent : action.step;
    const reason = `the change ${change} has the stage ${action.stage ?? action.step} ready (${who}); run it, or end the run as blocked and say why. `
      + `The next action comes from: node ${HOOKS_DIR}/change-loop.mjs next --change ${change} --lang ${lang}`;
    return refuseOnce(input, String(action.progressKey), 'stage-ready', change, reason);
  } catch { return allow('error', change); }
}

// The stage file a role writes, and what flow-check says of the change, for the subagent lock.
const roleOf = (agentType) => String(agentType || '').split(':').pop();
const UNDELIVERED = ['no-header', 'bad-header', 'header-other-stage', 'not-judged'];

// `guard.mjs subagent-stop` (U1 to U7): a stage agent does not stop before its stage file is delivered.
export function subagentStopDecision(input, { env = process.env } = {}) {
  let change = null;
  try {
    const run = runOf(input);
    if (!run) return allow('no-run');
    change = run.change;
    const role = roleOf(input.agent_type);
    const start = findRoot(input.cwd ?? process.cwd());
    if (!start) return allow('no-project', change);
    const found = locate(start, change);
    const clean = cleanOf(env);
    const flow0 = readFlow(found.root, changeSchemaAt(found.root, locateChange(found.root, change)?.dir ?? join(found.root, 'openspec', 'changes', change)));
    if (!flow0 || !flow0.stages.some((s) => s.source === 'artifact' && s.role === role)) return allow('no-stage-file', change);
    const { facts, flow } = collectFlow(found.root, change, { env: clean, openspec: makeOpenspec(found.root, clean) });
    const report = computeFlow(facts, flow, {});
    const next = report.next;
    const stage = next && flow.stages.find((s) => s.id === next.stage);
    if (!stage || stage.source !== 'artifact' || stage.role !== role) return allow('delivered', change);
    const key = `${stage.id}/${next.reasonCode}@${facts.fingerprint ?? ''}`;
    if (next.reasonCode === 'no-file') {
      return refuseOnce(input, key, 'no-file', change, `${stage.file} of stage ${stage.id} does not exist: write it, with its stage header, before you stop`);
    }
    if (UNDELIVERED.includes(next.reasonCode)) {
      return refuseOnce(input, key, next.reasonCode, change, `${stage.file} of stage ${stage.id} still says result=pending (or has no valid header): set its header before you stop`);
    }
    return allow('not-pending', change);
  } catch { return allow('error', change); }
}

// The agents a run may hand work to: the roles and helpers of the script's stages, but not the owner, the coordinator
// itself or the review bench (a skill, not an agent).
const NOT_AGENTS = ['owner', 'change-coordinator', 'review-bench'];
function scriptAgents(flow) {
  return [...new Set(flow.stages.flatMap((s) => [s.role, ...(s.helpers ?? [])]))].filter((r) => !NOT_AGENTS.includes(r));
}

// The devkit pack that ships the agent of each role and helper that has one (`<pack>:<role>`), as docs/roles.md names
// them in its "Played today by" lines; a test holds the two together. A role with no agent (`shipped: false`) has none.
export const PACKS = {
  ...Object.fromEntries(['change-planner', 'plan-readiness-reviewer', 'tdd-implementer', 'pr-verifier', 'commit-and-pr', 'codebase-researcher',
    'plan-reality-auditor', 'adr-reviewer', 'code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer', 'security-reviewer',
    'spec-reviewer', 'finding-verifier'].map((r) => [r, 'devkit-core'])),
  'openspec-validator': 'devkit-openspec',
};

// `guard.mjs agent` (H1 to H5): in a run the session hands work only to the roles of the change's script, named with no
// prefix or with the prefix of the pack that ships that role's agent; no agent type is a general-purpose agent: refused.
export function agentDecision(input) {
  let change = null;
  try {
    if (input.agent_type) return allow('subagent');
    const run = runOf(input);
    if (!run) return allow('no-run');
    change = run.change;
    const start = findRoot(input.cwd ?? process.cwd());
    if (!start) return allow('no-project', change);
    const found = locate(start, change);
    const schema = changeSchemaAt(found.root, locateChange(found.root, change)?.dir ?? join(found.root, 'openspec', 'changes', change));
    const flow = readFlow(found.root, schema);
    if (!flow) return allow('no-script', change);
    const roles = scriptAgents(flow);
    const type = input.tool_input?.subagent_type;
    if (typeof type !== 'string' || !type.trim()) {
      return {
        decision: 'refuse', why: 'no-type', change,
        reason: `in a /devkit change run this session hands work only to the roles of the ${schema} script: ${roles.join(', ')}; name one of them as subagent_type`,
      };
    }
    const colon = type.indexOf(':');
    const pack = colon === -1 ? null : type.slice(0, colon);
    const role = colon === -1 ? type : type.slice(colon + 1);
    if (roles.includes(role) && (pack === null || PACKS[role] === pack)) return allow('script-role', change);
    return {
      decision: 'refuse', why: 'not-a-role', change,
      reason: `in a /devkit change run this session hands work only to the roles of the ${schema} script: ${roles.join(', ')}; ${type} is not one of them`,
    };
  } catch { return allow('error', change); }
}

// ---------------------------------------------------------------- the command line (D-5)

const USAGE = 'usage: change-loop.mjs next --change <id> --lang <pt-BR|en> [--after <progress-key>] | reply <key> --lang <l> [--param name=value]... '
  + '| start --lang <l> (the request on standard input) | open <id> --script <devkit|devkit-lite> --why <code> --lang <l> (the request on standard input) '
  + '| script <id> <devkit|devkit-lite> --why <code> --lang <l> | wait --change <id> --lang <l> [--interval <seconds>]';

function parseArgs(argv, { values = [], multi = [] } = {}) {
  const opts = { positional: [], params: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (values.includes(a) || multi.includes(a)) {
      const v = argv[++i];
      if (v === undefined) throw new LoopUsageError(`${a} needs a value; ${USAGE}`);
      if (multi.includes(a)) opts.params.push(v); else opts[a.slice(2)] = v;
    } else if (a.startsWith('--')) throw new LoopUsageError(`unknown option ${a}; ${USAGE}`);
    else opts.positional.push(a);
  }
  return opts;
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

// What `next` and `wait` print: `devkit-run: <id>`, then `devkit-end: <id> <state>` when the action is an end (the record
// the stop lock reads, D-2), then the JSON action.
const loopOutput = (id, action) => `devkit-run: ${id}\n${action.kind === 'end' ? `devkit-end: ${id} ${action.end.state}\n` : ''}${json(action)}`;

// The keys the session renders itself that end the run, and the state each one records.
const END_OF_KEY = { blocked: 'blocked', 'waiting-pr-decision': 'waiting-for-owner' };

function runNext(args, { env, cwd, openspec, gh }) {
  const opts = parseArgs(args, { values: ['--change', '--lang', '--after'] });
  if (!opts.change || opts.positional.length) throw new LoopUsageError(USAGE);
  const action = nextAction(cwd, opts.change, { env, lang: opts.lang, after: opts.after ?? null, openspec, gh });
  return { code: exitCodeOf(action), stdout: loopOutput(opts.change, action), stderr: '' };
}

function runReply(args) {
  const opts = parseArgs(args, { values: ['--lang'], multi: ['--param'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const params = {};
  for (const p of opts.params) {
    const eq = p.indexOf('=');
    if (eq < 1) throw new LoopUsageError(`--param needs name=value, got ${p}`);
    params[p.slice(0, eq)] = p.slice(eq + 1);
  }
  const text = `${render(opts.lang, opts.positional[0], params)}\n`;
  const state = END_OF_KEY[opts.positional[0]];
  return { code: 0, stdout: state ? `devkit-end: ${params.id} ${state}\n${text}` : text, stderr: '' };
}

function runStart(args, { env, cwd, stdin, openspec, gh }) {
  const opts = parseArgs(args, { values: ['--lang'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  return { code: 0, stdout: json(startMode(cwd, stdin, { lang: opts.lang, env, openspec, gh })), stderr: '' };
}

function runOpen(args, { env, cwd, stdin, openspec }) {
  const opts = parseArgs(args, { values: ['--script', '--why', '--lang'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const result = openChange(cwd, opts.positional[0], { script: opts.script, why: opts.why, request: stdin, lang: opts.lang, env, openspec });
  return { code: 0, stdout: `devkit-run: ${result.change}\n${json(result)}`, stderr: '' };
}

function runScript(args, { cwd }) {
  const opts = parseArgs(args, { values: ['--why', '--lang'] });
  if (opts.positional.length !== 2) throw new LoopUsageError(USAGE);
  const { code, body } = switchScript(cwd, opts.positional[0], opts.positional[1], { why: opts.why, lang: opts.lang });
  return { code, stdout: json(body), stderr: '' };
}

const MIN_INTERVAL = 5;
const DEFAULT_INTERVAL = 60;
const realSleep = (seconds) => new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });

async function runWait(args, { env, cwd, openspec, gh, sleep = realSleep }) {
  const opts = parseArgs(args, { values: ['--change', '--lang', '--interval'] });
  if (!opts.change || opts.positional.length) throw new LoopUsageError(USAGE);
  const interval = opts.interval === undefined ? DEFAULT_INTERVAL : Number(opts.interval);
  if (!Number.isFinite(interval) || interval < MIN_INTERVAL) throw new LoopUsageError(`--interval needs a number of seconds, at least ${MIN_INTERVAL}`);
  const lang = normalizeLang(opts.lang);
  const poll = async () => nextAction(cwd, opts.change, { env, lang, openspec, gh });
  const action = await waitLoop({ poll, sleep, interval, id: opts.change, lang });
  return { code: 0, stdout: loopOutput(opts.change, action), stderr: '' };
}

// The usage-error form of every subcommand: exit 3 with `{ version: 1, error, reply }`, nothing created or run.
function failure(argv, e) {
  const message = e instanceof Error ? e.message : String(e);
  const lang = argv.indexOf('--lang') === -1 ? undefined : argv[argv.indexOf('--lang') + 1];
  const reply = e instanceof LoopRefusal ? e.reply : render(lang, 'request-unreadable'); // the raw message stays in `error`, never shown
  return { code: 3, stdout: `${JSON.stringify({ version: 1, error: message, reply })}\n`, stderr: `change-loop: ${message}\n` };
}

// Runs the command: { code, stdout, stderr }. 3 for a usage or preflight error, with `{ version: 1, error, reply }`.
// `wait` sleeps, so it runs through `runCommand`.
export function main(argv, { env = process.env, cwd = process.cwd(), openspec, gh, stdin = '' } = {}) {
  try {
    const [sub, ...rest] = argv;
    if (sub === 'next') return runNext(rest, { env, cwd, openspec, gh });
    if (sub === 'reply') return runReply(rest);
    if (sub === 'start') return runStart(rest, { env, cwd, stdin, openspec, gh });
    if (sub === 'open') return runOpen(rest, { env, cwd, stdin, openspec });
    if (sub === 'script') return runScript(rest, { cwd });
    throw new LoopUsageError(USAGE);
  } catch (e) {
    return failure(argv, e);
  }
}

// `main`, and `wait` too: the one entry point of the command line.
export async function runCommand(argv, opts = {}) {
  if (argv[0] !== 'wait') return main(argv, opts);
  try {
    return await runWait(argv.slice(1), { env: opts.env ?? process.env, cwd: opts.cwd ?? process.cwd(), openspec: opts.openspec, gh: opts.gh, sleep: opts.sleep });
  } catch (e) {
    return failure(argv, e);
  }
}

// The request on standard input, for `start` and `open` (empty when there is none to read).
function readStdin() {
  if (process.stdin.isTTY) return '';
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  const argv = process.argv.slice(2);
  runCommand(argv, { stdin: ['start', 'open'].includes(argv[0]) ? readStdin() : '' }).then((r) => {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exitCode = r.code;
  });
}
