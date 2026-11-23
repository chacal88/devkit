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
// --why <code> --lang <l>` (the correction of the script, D-4), `wait --change <id> --lang <l> [--interval <s>]`
// (waits on GitHub with no limit, D-7) and `accept-decisions <id> --lang <l>` (sets the proposed decision records the change
// lists to accepted, after the owner's current approval; stage-roles D-4). Only `open`, `script` and `accept-decisions` write;
// `start` and `next` do not. `next` and `wait` print
// `devkit-end: <id> <state>` after the run line when the action is an end, and `reply` does so for the keys that end a run.
//
// It also holds the decisions of the three locks that `guard.mjs` calls as modes (D-8): `stopDecision` (the session does not
// end its turn while a stage is ready), `subagentStopDecision` (a stage agent does not stop before its file is delivered) and
// `agentDecision` (in a run, work goes only to the script's roles). Each returns { decision, why, change, reason } and fails
// open. The two stop locks refuse once per unchanged state: they record the progress key of the state refused in
// `<os.tmpdir()>/devkit-stop/<session_id>[-<agent_id>].json` and let the same key through the next time.
// No dependencies.

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { findRoot, optedIn, schemaFile, runOf, changeSchemaAt, isChangeId, readRoadmap, readValue, isDecisionRecord } from './guard.mjs';
import { collectFlow, computeFlow, fingerprint, inSentence, makeOpenspec, readFlow, classificationFlags, plainValue, readTestSettings } from './flow-check.mjs';
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

// { driver, language, unknown: [{ setting, value, accepted }] } from the `devkit:` block of openspec/config.yaml.
// No block, no file or a missing key gives the defaults (`claude`, `en`); other keys of the block are ignored, except the
// tests' coverage target, whose bad value is listed in `unknown` after the two above (flow-check's `readTestSettings`).
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
  unknown.push(...readTestSettings(root).unknown);
  return { driver, language, unknown };
}

// The person's language: `en`, and `pt-BR` for anything else (an unsubstituted placeholder included).
export const normalizeLang = (value) => (value === 'en' ? 'en' : 'pt-BR');

// The display name of the files' language, as the brief says it.
export const filesLanguageName = (tag) => ({ en: 'English', 'pt-BR': 'Brazilian Portuguese' })[tag] ?? tag;

// ---------------------------------------------------------------- the message table (D-9)

// The same keys in both languages. A key holds a message, or a parameter text of its own family:
// `script.*`, `why.*` (opened, script-switched), `blocked-why.*`, `what.*`, `where.*`, `driver.*`, `setting.*`.
export const MESSAGES = {
  en: {
    'verb-not-built': '/devkit {verb} is not built yet: it arrives in round {round}. Nothing was done.',
    'verb-unknown': 'So far /devkit change, /devkit roadmap, /devkit status and /devkit project exist: type /devkit change and what you want done, /devkit roadmap to run the roadmap, /devkit status to see where everything is, or /devkit project and a name to plan a new project or slice.',
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
    'waiting-mockup': 'The mock-up of {id} is drawn. Look at it and tell me whether you approve it or what to change; I go on as soon as you answer.',
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
    'roadmap-invalid': '/devkit roadmap takes a whole number from 1 up, or stop: "{word}" is neither. Nothing was started.',
    'roadmap-none': 'This project has no roadmap yet. Should I write a draft with its unfinished changes, for you to review? Nothing starts now.',
    'roadmap-drafted': 'I wrote a draft roadmap with {list}, not committed. Review it, deliver it as this project does, then call /devkit roadmap again.',
    'roadmap-drafted-empty': 'I wrote a draft roadmap with no change in it, not committed: add one line per change, deliver it, then call /devkit roadmap again.',
    'roadmap-drafted-left': 'Left out, because they began under the previous script: {list}.',
    'roadmap-draft-declined': 'Nothing was created.',
    'roadmap-places': 'The run now takes up to {places} changes at once ({open} open).',
    'roadmap-started': 'Started {id} ({open} of {places} under way).',
    'roadmap-resumed': 'Resumed {id}, which was already open: {where} ({open} of {places} under way).',
    'roadmap-session-started': 'Started {id} in a session of its own ({open} of {places} under way).',
    'roadmap-waits-turn': '{id} is ready and starts in a session of its own at your next message: the app starts a session only on a turn you typed.',
    'roadmap-waits-refused': '{id} could not start in a session of its own: the app refused it. It starts at your next message.',
    'roadmap-held': '{id} is ready to start, but the machine is loaded (processor at {load}%, limit {limit}%): I hold the start until it eases. Tell me to start anyway and it starts now.',
    'roadmap-gate': '{id} waits for {gate}.',
    'roadmap-gate-others': '{id} waits for {gate}. The others go on.',
    'roadmap-archived': '{id} was archived.',
    'roadmap-blocked': '{id} stopped: {why}. The changes after it wait.',
    'roadmap-blocked-others': '{id} stopped: {why}. The others go on, and the changes after it wait.',
    'roadmap-skipped': '{id} began under the previous script, so the roadmap leaves it alone; the changes after it wait.',
    'roadmap-stopping': 'Stopping: nothing new starts, and each change finishes the stage it is in.',
    'roadmap-stayed': '{id}: {where}.',
    'roadmap-ended-done': 'Every change of the roadmap is archived. The run is over.',
    'roadmap-ended-stopped': 'The run stopped. Call /devkit roadmap to go on from where each change stayed.',
    'roadmap-ended-stuck': 'Nothing more can start or run on its own. Each open change needs: {list}.',
    'need.owner': '{id}, {gate}',
    'need.blocked': '{id}, a fix: {why}',
    'need.after': '{id}, {after} archived first',
    'gate.grill': 'your answers about its request',
    'gate.mockup': 'your approval of the mock-up',
    'gate.approval': 'your approval of the plan',
    'gate.retro': 'your answers to its retro',
    'gate.merge': 'your merge of its pull request',
    'gate.decision': 'a decision only you can take',
    'gate.dispute': 'your decision on the disputed review points',
    'gate.stage': 'your result for an unfinished file',
    'gate.by-hand': 'your delivery by hand',
    'status-count': 'Roadmap: {open} open of {places} · {queue} in the queue · {archived} archived',
    'status-held': 'Starts held: processor at {load}% (limit {limit}%)',
    'status-owner': 'Waiting for you',
    'status-running': 'Under way',
    'status-blocked': 'Blocked',
    'status-queue': 'In the queue',
    'status-outside': 'Outside the roadmap (the roadmap does not touch them)',
    'queue.ready': 'ready to start',
    'queue.place': 'ready, waits for a place',
    'queue.load': 'ready, held by the load',
    'queue.after': 'waits for {after}',
    'queue.turn': 'ready: starts in a session of its own at your next message',
    'outside.previous': 'began under the previous script',
    'outside.ticked': 'ticked on the roadmap but not archived',
    'outside.unticked': 'archived, its line not ticked yet',
    'outside.other': 'not on the roadmap: {where}',
    'running.stage': '{title}',
    'running.phase': '{title}, phase {phase} of {phases}',
    'running.github': 'waiting on GitHub ({what})',
    'running.no-session': 'no session of its own yet: it starts at your next message',
    'running.ready': 'ready, waiting for someone to continue',
    'status-no-roadmap': 'This project has no roadmap. Unfinished changes:',
    'status-nothing': 'This project has no roadmap and no unfinished change.',
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
    'blocked-why.gh-too-old': 'the installed gh ({installed}) cannot read the pull request checks, which need version {minimum} or newer: update gh, then call /devkit {verb} {id} again',
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
    'blocked-why.cannot-open': 'it could not be opened ({error})',
    'gh-version-unknown': 'unknown version',
    'blocked-why.cannot-accept': 'the decision records could not be marked accepted ({error})',
    'what.checks': 'the checks of the pull request',
    'what.merge': 'the merge of the pull request',
    'what.archive-merge': 'the merge of the archive pull request',
    'what.silent': 'GitHub did not answer',
    'where.next': 'next is {stage}',
    'where.owner': 'waiting for you at {stage}',
    'where.github': 'waiting on GitHub',
    'where.finishing': 'finishing {stage}',
    'where.blocked': 'stopped at {stage}',
    'where.previous': 'begun under the previous script',
    'where.archiving': 'being archived',
    'where.archived': 'archived',
    'driver.compozy': 'CompozyOS',
    'driver.script': 'a command-line script',
    'setting.driver': 'driver',
    'setting.language': 'language of the files',
    'setting.coverage-target': 'coverage target',
    'project-opened': 'I opened the slice {id} in its own worktree. We start with the business: I ask one question at a time, and each phase ends with your approval.',
    'project-resumed': 'Continuing the slice {id}: {where}.',
    'project-choose': '{n} slices are unfinished: {list}. Which one should I continue?',
    'project-name-needed': 'Type /devkit project and the name of the project or slice to plan, for example /devkit project billing.',
    'project-done-already': 'The slice {id} is already delivered. Choose another name.',
    'project-folder-exists': 'The default branch already has a design folder named {id}. Choose another name.',
    'project-not-found': 'No slice named {id} was found in this project.',
    'project-unreadable': 'I could not read that request. Type /devkit project and the name of the slice to plan, or /devkit project alone to continue.',
    'is-slice': '{id} is a slice of a project: /devkit project {id} continues it.',
    'is-change': '{id} is a change: /devkit change {id} continues it.',
    'design-pack-missing': 'The project flow needs the devkit-design pack in this project: run /openspec-setup with the devkit-design pack, then call /devkit project again. Nothing was run.',
    'phase-approval': '{Stage} of {id} is written. Do you approve it, or what should change?',
    'rounds-approval': 'These are the rounds and changes I would add to the roadmap: {list}. Do you approve them, or what should change?',
    'rounds-invalid': 'The proposed rounds cannot go on the roadmap yet: {list}.',
    'rounds-not-approved': 'Nothing was written to the roadmap: you have not approved the rounds yet.',
    'rounds-missing': 'The roadmap stage of {id} holds no rounds to check.',
    'rounds-ok': 'The rounds can go on the roadmap: {list}.',
    'rounds-already': 'The rounds of {id} are already on the roadmap; nothing was written.',
    'archived-slice': 'The slice {id} is archived on its branch; its pull request comes next.',
    'verdict-unusable': 'The ADR review of {id} cannot be recorded yet: {why}.',
    'project-plan-mode': 'The slice {id} is ready on its branch. In this project you open its pull request and merge it.',
    'project-pr-mode': 'Pull request #{number} of the slice {id} is ready: in this project, merging it is up to you.',
    'project-waiting-github': '{id} is waiting on GitHub ({what}). I keep waiting with no time limit and go on by myself when GitHub answers; calling /devkit project again is safe.',
    'project-delivered': 'The slice {id} is delivered and its rounds are on the roadmap: /devkit roadmap runs them.',
    'project-delivered-no-rounds': 'The slice {id} is delivered. It added no change to the roadmap.',
    'slice-title': 'Slice {id}',
    'slice-passed': 'passed',
    'slice-na': 'not applicable',
    'slice-ready': 'ready',
    'slice-blocked': 'blocked',
    'slice-next-review': 'next: the ADR review',
    'slice-next-pr': 'next: the pull request',
    'slice-pr': 'pull request #{number}: {state}',
    'slice-delivered': 'delivered',
    'state.github': 'waits on GitHub',
    'state.owner': 'waits for you',
    'state.blocked': 'is blocked',
    'where.slice-pr': 'its pull request #{number} {state}',
    'where.slice-archived': 'its pull request comes next',
    'why.no-verdict-file': 'its verdict file is missing',
    'why.no-verdict': 'the verdict file holds no verdict',
    'why.no-commit': 'the verdict does not say which commit it judged',
    'why.other-commit': 'the verdict is for another commit than the current one',
    'why.uncommitted': 'the verdict was written with changes that were not committed',
    'blocked-why.checks-failing': 'checks failing on the pull request: {list}',
    'blocked-why.merge-setup-missing': 'the repository is not prepared for automatic merging yet ({list}), which /openspec-setup does',
    'blocked-why.branch-conflict': 'pull request #{number} conflicts with {base}: resolve the conflict on the slice\'s branch, then call /devkit project {id} again',
    'blocked-why.archive-refused': 'the slice cannot be archived yet: {list} not settled',
    'blocked-why.undeclared-stage': 'the flow asked for {stage}, which this project script does not declare',
  },
  'pt-BR': {
    'verb-not-built': '/devkit {verb} ainda não existe: chega na rodada {round}. Nada foi feito.',
    'verb-unknown': 'Por enquanto existem /devkit change, /devkit roadmap, /devkit status e /devkit project: digite /devkit change e o que você quer fazer, /devkit roadmap para rodar o roadmap, /devkit status para ver onde está tudo, ou /devkit project e um nome para planejar um projeto ou uma fatia nova.',
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
    'waiting-mockup': 'O mock-up de {id} está desenhado. Veja e me diga se aprova ou o que mudar; eu sigo assim que você responder.',
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
    'roadmap-invalid': '/devkit roadmap aceita um número inteiro a partir de 1, ou stop: "{word}" não é nenhum dos dois. Nada foi começado.',
    'roadmap-none': 'Este projeto ainda não tem roadmap. Escrevo um rascunho com as changes por terminar, para você revisar? Nada começa agora.',
    'roadmap-drafted': 'Escrevi um rascunho de roadmap com {list}, sem commit. Revise, entregue como este projeto entrega e chame /devkit roadmap de novo.',
    'roadmap-drafted-empty': 'Escrevi um rascunho de roadmap sem nenhuma change, sem commit: acrescente uma linha por change, entregue e chame /devkit roadmap de novo.',
    'roadmap-drafted-left': 'Deixei de fora, porque começaram no roteiro anterior: {list}.',
    'roadmap-draft-declined': 'Nada foi criado.',
    'roadmap-places': 'A rodada agora vai até {places} changes ao mesmo tempo ({open} abertas).',
    'roadmap-started': 'Comecei {id} ({open} de {places} em andamento).',
    'roadmap-resumed': 'Retomei {id}, que já estava aberta: {where} ({open} de {places} em andamento).',
    'roadmap-session-started': 'Comecei {id} numa sessão própria ({open} de {places} em andamento).',
    'roadmap-waits-turn': '{id} está pronta e começa numa sessão própria na sua próxima mensagem: o app só abre sessão num turno que você digitou.',
    'roadmap-waits-refused': '{id} não pôde começar numa sessão própria: o app recusou. Ela começa na sua próxima mensagem.',
    'roadmap-held': '{id} está pronta para começar, mas a máquina está carregada (processador em {load}%, limite {limit}%): seguro o começo até aliviar. Se quiser começar mesmo assim, é só dizer.',
    'roadmap-gate': '{id} espera {gate}.',
    'roadmap-gate-others': '{id} espera {gate}. As outras seguem.',
    'roadmap-archived': '{id} foi arquivada.',
    'roadmap-blocked': '{id} parou: {why}. As que dependem dela esperam.',
    'roadmap-blocked-others': '{id} parou: {why}. As outras seguem, e as que dependem dela esperam.',
    'roadmap-skipped': '{id} começou no roteiro anterior, então o roadmap não mexe nela; as que dependem dela esperam.',
    'roadmap-stopping': 'Parando: nada novo começa, e cada change termina a etapa em que está.',
    'roadmap-stayed': '{id}: {where}.',
    'roadmap-ended-done': 'Todas as changes do roadmap estão arquivadas. A rodada terminou.',
    'roadmap-ended-stopped': 'A rodada parou. Chame /devkit roadmap para seguir de onde cada change ficou.',
    'roadmap-ended-stuck': 'Nada mais pode começar ou rodar sozinho. Cada change aberta precisa de: {list}.',
    'need.owner': '{id}, {gate}',
    'need.blocked': '{id}, uma correção: {why}',
    'need.after': '{id}, que {after} seja arquivada antes',
    'gate.grill': 'as suas respostas sobre o pedido',
    'gate.mockup': 'a sua aprovação do mock-up',
    'gate.approval': 'a sua aprovação do plano',
    'gate.retro': 'as suas respostas à retro',
    'gate.merge': 'o seu merge do pull request',
    'gate.decision': 'uma decisão que só você pode tomar',
    'gate.dispute': 'a sua decisão sobre os pontos em disputa da revisão',
    'gate.stage': 'o resultado de um arquivo inacabado',
    'gate.by-hand': 'a sua entrega à mão',
    'status-count': 'Roadmap: {open} abertas de {places} · {queue} na fila · {archived} arquivadas',
    'status-held': 'Começos segurados: processador em {load}% (limite {limit}%)',
    'status-owner': 'Esperando você',
    'status-running': 'Em andamento',
    'status-blocked': 'Travadas',
    'status-queue': 'Na fila',
    'status-outside': 'Fora do roadmap (o roadmap não toca)',
    'queue.ready': 'pronta para começar',
    'queue.place': 'pronta, espera vaga',
    'queue.load': 'pronta, segurada pela carga',
    'queue.after': 'espera {after}',
    'queue.turn': 'pronta: começa numa sessão própria na sua próxima mensagem',
    'outside.previous': 'começada no roteiro anterior',
    'outside.ticked': 'marcada no roadmap, mas não arquivada',
    'outside.unticked': 'arquivada, falta marcar a linha',
    'outside.other': 'fora do roadmap: {where}',
    'running.stage': '{title}',
    'running.phase': '{title}, fase {phase} de {phases}',
    'running.github': 'esperando o GitHub ({what})',
    'running.no-session': 'ainda sem sessão própria: começa na sua próxima mensagem',
    'running.ready': 'pronta, esperando alguém continuar',
    'status-no-roadmap': 'Este projeto não tem roadmap. Changes por terminar:',
    'status-nothing': 'Este projeto não tem roadmap nem change por terminar.',
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
    'blocked-why.gh-too-old': 'o gh instalado ({installed}) não consegue ler os checks do pull request, que exigem a versão {minimum} ou mais nova: atualize o gh e chame /devkit {verb} {id} de novo',
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
    'blocked-why.cannot-open': 'não foi possível abrir ({error})',
    'gh-version-unknown': 'versão desconhecida',
    'blocked-why.cannot-accept': 'não foi possível marcar os registros de decisão como aceitos ({error})',
    'what.checks': 'os checks do pull request',
    'what.merge': 'o merge do pull request',
    'what.archive-merge': 'o merge do pull request de arquivo',
    'what.silent': 'o GitHub não respondeu',
    'where.next': 'a próxima é {stage}',
    'where.owner': 'esperando você {inStage}',
    'where.github': 'esperando o GitHub',
    'where.finishing': 'terminando {stage}',
    'where.blocked': 'parada {inStage}',
    'where.previous': 'começada no roteiro anterior',
    'where.archiving': 'sendo arquivada',
    'where.archived': 'arquivada',
    'driver.compozy': 'CompozyOS',
    'driver.script': 'um script de linha de comando',
    'setting.driver': 'driver',
    'setting.language': 'idioma dos arquivos',
    'setting.coverage-target': 'meta de cobertura',
    'project-opened': 'Abri a fatia {id} no próprio worktree. Começamos pelo negócio: faço uma pergunta de cada vez, e cada fase termina com a sua aprovação.',
    'project-resumed': 'Continuando a fatia {id}: {where}.',
    'project-choose': '{n} fatias estão por terminar: {list}. Qual delas eu continuo?',
    'project-name-needed': 'Digite /devkit project e o nome do projeto ou da fatia a planejar, por exemplo /devkit project billing.',
    'project-done-already': 'A fatia {id} já foi entregue. Escolha outro nome.',
    'project-folder-exists': 'O branch padrão já tem uma pasta de design chamada {id}. Escolha outro nome.',
    'project-not-found': 'Nenhuma fatia chamada {id} foi encontrada neste projeto.',
    'project-unreadable': 'Não consegui ler esse pedido. Digite /devkit project e o nome da fatia a planejar, ou só /devkit project para continuar.',
    'is-slice': '{id} é uma fatia de projeto: /devkit project {id} continua.',
    'is-change': '{id} é uma change: /devkit change {id} continua.',
    'design-pack-missing': 'O fluxo de projeto precisa do pacote devkit-design neste projeto: rode /openspec-setup com o pacote devkit-design e chame /devkit project de novo. Nada foi executado.',
    'phase-approval': '{Stage} de {id} está escrita. Você aprova, ou o que deve mudar?',
    'rounds-approval': 'Estas são as rodadas e changes que eu acrescentaria ao roadmap: {list}. Você aprova, ou o que deve mudar?',
    'rounds-invalid': 'As rodadas propostas ainda não podem entrar no roadmap: {list}.',
    'rounds-not-approved': 'Nada foi escrito no roadmap: você ainda não aprovou as rodadas.',
    'rounds-missing': 'A etapa de roadmap de {id} não tem rodadas para conferir.',
    'rounds-ok': 'As rodadas podem entrar no roadmap: {list}.',
    'rounds-already': 'As rodadas de {id} já estão no roadmap; nada foi escrito.',
    'archived-slice': 'A fatia {id} está arquivada no branch dela; o pull request vem a seguir.',
    'verdict-unusable': 'A revisão dos ADRs de {id} ainda não pode ser registrada: {why}.',
    'project-plan-mode': 'A fatia {id} está pronta no branch dela. Neste projeto, você abre o pull request e faz o merge.',
    'project-pr-mode': 'O pull request #{number} da fatia {id} está pronto: neste projeto, o merge é com você.',
    'project-waiting-github': '{id} está esperando o GitHub ({what}). Eu continuo esperando, sem limite de tempo, e sigo sozinho quando o GitHub responder; chamar /devkit project de novo é seguro.',
    'project-delivered': 'A fatia {id} foi entregue e as rodadas dela estão no roadmap: /devkit roadmap as executa.',
    'project-delivered-no-rounds': 'A fatia {id} foi entregue. Ela não acrescentou nenhuma change ao roadmap.',
    'slice-title': 'Fatia {id}',
    'slice-passed': 'passou',
    'slice-na': 'não se aplica',
    'slice-ready': 'pronta',
    'slice-blocked': 'bloqueada',
    'slice-next-review': 'próximo: a revisão dos ADRs',
    'slice-next-pr': 'próximo: o pull request',
    'slice-pr': 'o pull request #{number} {state}',
    'slice-delivered': 'entregue',
    'state.github': 'espera o GitHub',
    'state.owner': 'espera você',
    'state.blocked': 'está travado',
    'where.slice-pr': 'o pull request #{number} dela {state}',
    'where.slice-archived': 'o pull request dela vem a seguir',
    'why.no-verdict-file': 'o arquivo do veredito não existe',
    'why.no-verdict': 'o arquivo do veredito não traz um veredito',
    'why.no-commit': 'o veredito não diz qual commit ele julgou',
    'why.other-commit': 'o veredito é de outro commit que não o atual',
    'why.uncommitted': 'o veredito foi escrito com alterações que não estavam commitadas',
    'blocked-why.checks-failing': 'checks falhando no pull request: {list}',
    'blocked-why.merge-setup-missing': 'o repositório ainda não está preparado para o merge automático ({list}), que /openspec-setup prepara',
    'blocked-why.branch-conflict': 'o pull request #{number} tem conflito com {base}: resolva o conflito no branch da fatia e chame /devkit project {id} de novo',
    'blocked-why.archive-refused': 'a fatia ainda não pode ser arquivada: {list} não resolvidas',
    'blocked-why.undeclared-stage': 'o fluxo pediu {stage}, que este roteiro de projeto não declara',
  },
};

// A stage as a noun phrase inside a sentence: en `the` + the title in sentence case, pt-BR `a etapa` + the title.
export const stagePhrase = (lang, title) => (lang === 'en' ? `the ${inSentence(title)}` : `a etapa ${title}`);
// The same phrase after `at` (en) or `em` (pt-BR, which contracts `em a` to `na`).
const inStagePhrase = (lang, title) => (lang === 'en' ? `at ${stagePhrase(lang, title)}` : `na etapa ${title}`);
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const FAMILY = { script: 'script.', other: 'script.', what: 'what.', driver: 'driver.', setting: 'setting.', gate: 'gate.', state: 'state.' };
// The keys whose `{why}` is a blocked reason (`blocked-why.` codes); any other key's `{why}` is a `why.` code.
const BLOCKED_WHY_KEYS = ['blocked', 'roadmap-blocked', 'roadmap-blocked-others', 'need.blocked'];

// One message, in the person's language, its `{name}` parameters filled. A code parameter (`script`, `other`, `why`,
// `what`, `driver`, `setting`, `gate`) is looked up in its family of the same table; `stage` is the stage's title in the
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
    if (name === 'inStage') return inStagePhrase(l, need('stage'));
    if (name === 'Stage') return capital(stagePhrase(l, need('stage')));
    if (name === 'why') return render(l, `${BLOCKED_WHY_KEYS.includes(key) ? 'blocked-why' : 'why'}.${need('why')}`, params);
    if (FAMILY[name]) return render(l, `${FAMILY[name]}${need(name)}`, params);
    return need(name);
  });
}

// ---------------------------------------------------------------- the run file and the gates (change-state D-2)
// Moved from roadmap-loop.mjs unchanged: the state of a change reads the run file's facts and the gate of each owner wait.

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The gate code of each end that waits for the owner: every `waiting-` key of the message table but `waiting-github`.
export const GATE_OF_WHY = {
  'waiting-approval': 'approval', 'waiting-approval-again': 'approval', 'waiting-retro': 'retro', 'waiting-merge': 'merge',
  'waiting-archive-merge': 'merge', 'waiting-pr-decision': 'decision', 'waiting-review-dispute': 'dispute',
  'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand', 'waiting-mockup': 'mockup',
};

// The gate the owner is asked for by an action: the grill, or an end waiting for the owner. Any other action, or a wait
// the table does not know, is a LoopUsageError, so a new owner wait added later fails a test instead of printing a wrong phrase.
export function gateOf(action) {
  if (action?.kind === 'grill') return 'grill';
  const why = action?.kind === 'end' && action.end?.state === 'waiting-for-owner' ? action.end.why : undefined;
  const code = why === undefined ? undefined : GATE_OF_WHY[why];
  if (!code) throw new LoopUsageError(`no gate for the action ${action?.kind ?? 'none'} ${action?.end?.why ?? ''}`.trim());
  return code;
}

// One run's bookkeeping and nothing the files, the repository or GitHub can say.
export const emptyRun = () => ({
  version: 1, session: null, places: 1, stopping: false, asking: null, inflight: {}, declared: {}, announced: {}, starting: [],
  held: false, holding: null, changeSessions: false, startedSessions: {}, turn: null, updatedAt: null,
});

// `<common git directory>/devkit/roadmap-run.json`: every checkout of the clone and every session see the same file, and no commit holds it.
export function runFilePath(cwd) {
  let common;
  try {
    common = execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { throw new LoopUsageError(`${cwd} is not inside a git repository`); }
  return join(common, 'devkit', 'roadmap-run.json');
}

// The file as it is; a missing or broken one is an empty run with one place, and a field of the wrong type is dropped.
export function readRun(file) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { return emptyRun(); }
  if (!isObject(parsed)) return emptyRun();
  const run = emptyRun();
  if (Number.isInteger(parsed.places) && parsed.places >= 1) run.places = parsed.places;
  if (typeof parsed.session === 'string') run.session = parsed.session;
  if (typeof parsed.asking === 'string') run.asking = parsed.asking;
  if (typeof parsed.updatedAt === 'string') run.updatedAt = parsed.updatedAt;
  for (const key of ['stopping', 'held', 'changeSessions']) if (typeof parsed[key] === 'boolean') run[key] = parsed[key];
  if (parsed.turn === 'typed' || parsed.turn === 'event') run.turn = parsed.turn;
  // The change sessions the run started (D-3): { <change id>: { at } }; a key that is no change id is dropped.
  if (isObject(parsed.startedSessions)) {
    for (const [id, entry] of Object.entries(parsed.startedSessions)) {
      if (isChangeId(id) && isObject(entry)) run.startedSessions[id] = { at: typeof entry.at === 'string' ? entry.at : null };
    }
  }
  // The watch of the load: { pid, at } (D-7); the boolean of 0.18.0, or anything else, is no watch.
  if (isObject(parsed.holding) && Number.isInteger(parsed.holding.pid) && parsed.holding.pid > 0) {
    run.holding = { pid: parsed.holding.pid, at: typeof parsed.holding.at === 'string' ? parsed.holding.at : null };
  }
  for (const key of ['inflight', 'declared', 'announced']) if (isObject(parsed[key])) run[key] = parsed[key];
  if (Array.isArray(parsed.starting)) run.starting = parsed.starting.filter((id) => typeof id === 'string');
  return run;
}

// ---------------------------------------------------------------- the stage icon (roadmap-coordinator-followups D-5)

// The icon of the stage an action is in, for the title of a change session: ❓ requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery,
// 📦 retro and archive. An archived end is the archive's; a stage the table does not name, or none, has no icon.
const STAGE_ICON = {
  open: '❓', requirements: '❓',
  mockup: '📝', decisions: '📝', proposal: '📝', specs: '📝', design: '📝', tasks: '📝', readiness: '📝', approval: '📝',
  implementation: '🛠️', 'unit-tests': '🛠️', 'e2e-tests': '🛠️',
  evidence: '🔍', review: '🔍',
  delivery: '🚀',
  retro: '📦',
};
export function stageIcon(action) {
  if (action?.kind === 'end' && action.end?.state === 'archived') return '📦';
  const stage = action?.stage;
  return typeof stage === 'string' && Object.hasOwn(STAGE_ICON, stage) ? STAGE_ICON[stage] : null;
}

// A change session's title: the state icon (when there is one), the stage icon and the change id, cut to 59 code points when it
// has 60 or more (the start tool's title is under 60).
export function sessionTitle(icon, id, stateIcon = null) {
  const code = [...[stateIcon, icon, id].filter(Boolean).join(' ')];
  return code.length >= 60 ? code.slice(0, 59).join('') : code.join('');
}

// ---------------------------------------------------------------- the state of a change (change-state D-1, D-2, D-5)

export const STATE_ICON = { 'waiting-for-owner': '🙋', 'waiting-on-github': '⏳', blocked: '⛔', archived: '📦' };

// What the run file says about one change, for `changeState`: `run` is `readRun`'s result or the facts of the board (the same
// fields and an `after`); `onRoadmap` says the id is a line of the roadmap.
export function runFactsOf(run, id, { onRoadmap = false } = {}) {
  const after = run.after ?? {};
  const announced = run.announced?.[id];
  return {
    sessionMode: run.changeSessions === true && onRoadmap === true,
    started: Boolean(run.startedSessions?.[id]) || after[id] === 'session-start',
    inflight: Object.hasOwn(after, id) ? null : run.inflight?.[id] ?? null,
    declared: run.declared?.[id] ?? null,
    waits: Boolean(run.starting?.includes(id)) || announced === 'waits-turn' || announced === 'waits-refused',
  };
}

const READY = (lang) => ({ code: 'ready', text: render(lang, 'running.ready') });
const blockedReason = (lang, why, params, id) => ({ code: why, text: render(lang, `blocked-why.${why}`, { ...params, id, why }) });

// The end an owner wait or a blocked end of the action gives, or what the session declared.
function endOfAction(action, lang, id) {
  if (action?.kind === 'grill') return { state: 'waiting-for-owner', reason: { code: 'grill', text: render(lang, 'gate.grill') } };
  if (action?.kind !== 'end') return { state: 'running', reason: null };
  const { state, why } = action.end;
  if (state === 'archived') return { state, reason: null };
  if (state === 'waiting-for-owner') return { state, reason: { code: why, text: render(lang, `gate.${gateOf(action)}`) } };
  if (state === 'waiting-on-github') return { state, reason: { code: action.params.what, text: render(lang, `what.${action.params.what}`) } };
  return { state: 'blocked', reason: blockedReason(lang, why, action.params, id) };
}

function declaredEnd(declared, lang, id) {
  if (declared.state === 'waiting-for-owner') {
    const gate = declared.params?.gate ?? GATE_OF_WHY[declared.why];
    if (!gate) throw new LoopUsageError(`the declared wait of ${id} names no gate`);
    return { state: 'waiting-for-owner', reason: { code: declared.why, text: render(lang, `gate.${gate}`) } };
  }
  return { state: 'blocked', reason: blockedReason(lang, declared.why, declared.params, id) };
}

// The one place a change's state is derived (D-1). `action` is what `decide` gave (or null, or the stand-in of a change the run
// file lists with no folder); `facts` is `runFactsOf`'s result, or null outside a roadmap run; `id` names the change when there is
// no action. Pure.
export function changeState(action, facts = null, { lang, id: given = null } = {}) {
  const l = normalizeLang(lang);
  const id = action?.change ?? given;
  let stage = action?.stage ?? null;
  let stageTitle = action?.stageTitle ?? null;
  let done = endOfAction(action, l, id);
  if (facts) { // S1 to S8, first match wins
    const { sessionMode, started, inflight, declared } = facts;
    const githubWait = action?.kind === 'end' && action.end.state === 'waiting-on-github';
    if (sessionMode && declared) done = declaredEnd(declared, l, id);
    else if (sessionMode && started) done = action ? done : { state: 'running', reason: null };
    else if (sessionMode) done = { state: 'running', reason: READY(l) };
    else if (inflight && (inflight.kind === 'wait' || githubWait)) {
      const what = action?.params?.what ?? inflight.what ?? 'merge';
      done = { state: 'waiting-on-github', reason: { code: what, text: render(l, `what.${what}`) } };
    } else if (inflight) {
      done = { state: 'running', reason: null };
      stage = action?.stage ?? inflight.stage ?? null;
      stageTitle = action?.stageTitle ?? inflight.stage ?? null;
    } else if (declared) done = declaredEnd(declared, l, id);
    else if (facts.waits || !action || action.kind === 'none') done = { state: 'running', reason: READY(l) };
  }
  const { state, reason } = done;
  const icon = stage === (action?.stage ?? null) ? stageIcon(action) : stageIcon({ stage });
  const stateIcon = STATE_ICON[state] ?? null;
  let title;
  if (state === 'archived') title = sessionTitle('📦', id);
  else if (state === 'running') title = icon ? sessionTitle(icon, id) : null;
  else title = icon ? sessionTitle(icon, id, stateIcon) : sessionTitle(stateIcon, id);
  const phase = typeof action?.detail?.phase === 'number' ? action.detail.phase : null;
  return { state, reason, stage, stageTitle, phase, stageIcon: icon, stateIcon, title };
}

// ---------------------------------------------------------------- the decision (D-5), pure

// commit-attribution D-1: the loop cannot read the session's attribution lines (the host gives them to the session),
// so every hand-off to the commit agent ends with this request and the session appends its own lines (the ship-change
// skill's Attribution section). Keyed on the agent the action names, so any step handed to that agent carries it.
export const COMMIT_AGENT = 'devkit-core:commit-and-pr';
export const ATTRIBUTION_HEADER = 'Attribution (from the caller):';
export const ATTRIBUTION_ASK = ' Attribution: the session handing this off appends below this brief, verbatim, the lines it ends its own commit messages and pull-request descriptions with, as the block `Attribution (from the caller):` with one `Commit trailer: <line>` per commit line and one `PR footer: <line>` per pull-request line, or the line `Attribution (from the caller): none` when it ends them with none.';
export const withAttribution = (agent, text) => (agent === COMMIT_AGENT ? `${text}${ATTRIBUTION_ASK}` : text);

const AGENT = {
  'change-planner': 'devkit-core:change-planner',
  'plan-readiness-reviewer': 'devkit-core:plan-readiness-reviewer',
  'tdd-implementer': 'devkit-core:tdd-implementer',
  'pr-verifier': 'devkit-core:pr-verifier',
  'commit-and-pr': COMMIT_AGENT,
  'screen-designer': 'devkit-core:screen-designer',
  'adr-author': 'devkit-core:adr-author',
  'test-runner': 'devkit-core:test-runner',
  'e2e-tester': 'devkit-core:e2e-tester',
};
const BUILD_PARTS = ['build', 'after', 'delivery', 'close'];
const TEST_STAGES = ['unit-tests', 'e2e-tests'];
const PLAN_REASONS = ['no-file', 'no-header', 'bad-header', 'header-other-stage', 'not-judged', 'stale-plan', 'rerun-after-fix'];
const NOT_DELIVERED = ['no-file', 'not-judged', 'no-header', 'bad-header', 'header-other-stage'];
const SWITCH_FLAGS = ['architecture', 'contract', 'ui'];
const BLOCKED_OF = { 'ceiling-reached': 'ceiling', 'no-progress': 'no-progress', 'gh-too-old': 'gh-too-old', 'pr-closed': 'pr-closed' };

// True for the two blocked ends of the stage checker that mean GitHub did not answer (change-state D-4): they are a wait on GitHub, not a stop.
export const githubSilent = (end) => end?.state === 'blocked' && (end.reasonCode === 'gh-error' || end.reasonCode === 'checks-unreadable');

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
// approval (deliver-check's approvalState), tests (flow-check's readTestSettings), decisions (`decisionRecords`'s result),
// hasProposal, flags (the grill's classification), archiving, row
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
    ...base, kind: 'end', ...stageFields(stageId), end: { state, why }, params: { id: ctx.id, ...params }, ...(detail ? { detail } : {}), reply: say(key, params),
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
  const agent = (stage, role, step, what, detail, named) => {
    const id = named ?? AGENT[role];
    return guard({
      ...base, kind: 'agent', ...stageFields(stage), agent: id, ...(step ? { step } : {}), ...(detail ? { detail } : {}),
      brief: withAttribution(id, brief(stage, what)), progressKey: key(stage, step),
    });
  };
  const sessionAction = (stage, step, detail, extra = {}) => guard({
    ...base, kind: 'session', ...stageFields(stage), step, ...(detail ? { detail } : {}), ...extra, progressKey: key(stage, step),
  });

  if (report.script === 'previous') return blocked('previous-script');
  const currentId = report.next?.stage ?? report.end?.stage ?? null;
  const endState = report.end?.state;
  if (endState === 'archived' && !facts.archiving) return finish('archived', 'archived', 'archived', {}, null);

  // The owner's plan approval accepts the records `decisions.md` lists: the session runs the command that marks them.
  const open = facts.decisions;
  if (facts.approval?.ok && !facts.archiving && (open?.proposed?.length || open?.unreadable?.length)) {
    const command = ['node', join(HOOKS_DIR, 'change-loop.mjs'), 'accept-decisions', ctx.id, '--lang', lang];
    return sessionAction('approval', 'accept-decisions', { command, records: [...open.proposed, ...open.unreadable.map((u) => u.path)] });
  }

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
      if (n.reasonCode === 'owner-changes') {
        const attempt = n.params.attempt;
        return agent(n.stage, s.role, null, `the owner asked for changes at attempt ${attempt}: redraw from the owner's notes in ${s.file} as attempt ${attempt + 1}`);
      }
      if (n.reasonCode === 'fix-after-failure') {
        const { failed, attempt, ceiling } = n.params;
        return agent(n.stage, s.role, null, `${failed} failed at attempt ${attempt} of ${ceiling}: revise the plan from its findings`);
      }
      if (PLAN_REASONS.includes(n.reasonCode) && s && AGENT[s.role]) {
        const stale = ['stale-plan', 'rerun-after-fix'].includes(n.reasonCode);
        const what = stale ? `${n.stage} is out of date: bring it up to date`
          : s.role === 'plan-readiness-reviewer' ? 'review the plan'
            : s.role === 'change-planner' ? `write the plan files the script still lacks, from ${n.stage} on, each from \`openspec instructions <artifact> --change ${ctx.id}\``
              : `write ${s.file} from \`openspec instructions ${n.stage} --change ${ctx.id}\``;
        return agent(n.stage, s.role, null, what);
      }
      return blocked('unknown-step', {}, n.stage);
    }
    if (e.state === 'waiting-for-owner' && e.stage === 'approval' && e.reasonCode === 'owner-pending') return waiting('waiting-for-owner', 'waiting-approval', 'approval', {}, { readiness: facts.approval?.readiness ?? null });
    if (e.state === 'waiting-for-owner' && e.stage === 'approval' && e.reasonCode === 'approval-stale') return waiting('waiting-for-owner', 'waiting-approval-again', 'approval', {}, { readiness: facts.approval?.readiness ?? null });
    if (e.state === 'waiting-for-owner' && e.stage === 'mockup' && e.reasonCode === 'owner-pending') {
      return waiting('waiting-for-owner', 'waiting-mockup', 'mockup', {}, { file: `openspec/changes/${ctx.id}/mockup.md`, folder: `openspec/changes/${ctx.id}/mock/` });
    }
    if (e.state === 'waiting-for-owner' && e.reasonCode === 'unshipped-role-pending') return waiting('waiting-for-owner', 'waiting-unrun-stage', e.stage, { stage: titleOf(e.stage) });
    if (e.state === 'blocked') return blockedEnd(e);
    return blocked('unknown-step', {}, e.stage);
  }

  // The unit tests and the E2E tests, which the delivery checker does not know, come from the stage checker alone: the stage
  // goes to its role whatever step the delivery row would give, and a red one sends the implementer back with `fix-tests`.
  function testStageStep() {
    const n = report.next;
    if (!n) return null;
    const tests = facts.tests ?? {};
    if (TEST_STAGES.includes(n.stage)) {
      const detail = n.stage === 'unit-tests'
        ? { unit: tests.unit ?? null, coverage: { command: tests.coverage?.command ?? null, target: tests.coverage?.target ?? null } }
        : { e2e: tests.e2e ?? null };
      const again = ['stale-code', 'rerun-after-fix'].includes(n.reasonCode);
      const what = again ? 'the work changed since the last run: run it again' : `run the ${n.stage} stage from \`openspec instructions ${n.stage} --change ${ctx.id}\``;
      return agent(n.stage, stageById(n.stage).role, n.stage, what, detail);
    }
    if (n.stage === 'implementation' && n.reasonCode === 'fix-after-failure' && TEST_STAGES.includes(n.params?.failed)) {
      const { failed, attempt, ceiling } = n.params;
      const file = stageById(failed)?.file ?? null;
      return agent('implementation', 'tdd-implementer', 'fix-tests', `${failed} failed at attempt ${attempt} of ${ceiling}: fix the code from ${file}, test first, within the approved tasks`, { failed, file });
    }
    return null;
  }

  // P9 and B0: a blocked end of the stage checker, in plain words.
  function blockedEnd(e) {
    if (githubSilent(e)) return waiting('waiting-on-github', 'waiting-github', e.stage, { what: 'silent' }, { error: e.params?.error ?? '' });
    const why = BLOCKED_OF[e.reasonCode] ?? 'role-failed';
    const stageId = e.params?.stage ?? e.stage;
    const params = { stage: titleOf(stageId), attempt: e.params?.attempt, error: e.params?.error ?? '', number: e.params?.number };
    if (why === 'gh-too-old') Object.assign(params, { installed: e.params?.installed ?? render(lang, 'gh-version-unknown'), minimum: e.params?.minimum, verb: 'change' });
    return blocked(why, params, e.stage);
  }

  // -------- from the implementation to the archive: B0 to B17
  function buildPart() {
    if (endState === 'blocked') return blockedEnd(report.end);
    const testStage = testStageStep();
    if (testStage) return testStage;
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
export function cleanOf(env) {
  const clean = { ...env };
  for (const k of CLEAN_KEYS) delete clean[k];
  return clean;
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}
export const tryGit = (root, args) => { try { return git(root, args).trim(); } catch { return ''; } };

// The main checkout: the parent of the shared git directory.
export const mainRoot = (root) => {
  const common = tryGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  return common ? dirname(common) : root;
};

// The default branch the change's pull request targets: origin/HEAD, else main, else master.
export function defaultBase(root) {
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
  const action = decide({
    ctx: { id, script: facts.schema ?? report.schema ?? 'devkit', root: found.root, branch: found.branch, lang: normalizeLang(lang), filesLanguage },
    flow,
    report,
    after,
    fingerprint: facts.fingerprint ?? fingerprint(found.root, facts.head ?? null),
    approval: approvalState(dir),
    tests: readTestSettings(found.root),
    decisions: decisionRecords(found.root, dir),
    hasProposal: existsSync(join(dir, 'proposal.md')),
    flags: classificationFlags(dir),
    archiving,
    row,
  });
  // The icon of the action's stage, its state and the change session's title for it (change-state D-1, D-5); the title only when the state has one.
  action.icon = stageIcon(action);
  action.state = changeState(action, null, { lang });
  if (action.state.title !== null) action.sessionTitle = action.state.title;
  return action;
}

// ---------------------------------------------------------------- the decision records (design stage-roles D-4)

const STATUS_LINE = /^(\s*[-*]?\s*\**Status\**\s*:\s*\**\s*)(\S+)(.*)$/im;
const ADR_LINES = /^[ \t]*(?:[-*][ \t]+)?ADR:[ \t]*`([^`\n]+)`/gm;

// One record `decisions.md` lists, read from `root`: { path, ok: true, rel, text, status, match } or { path, ok: false, why }.
function readRecord(root, path) {
  const bad = (why) => ({ path, ok: false, why });
  if (isAbsolute(path)) return bad('the path is absolute');
  const abs = resolve(root, path);
  const rel = relative(root, abs);
  const outside = (r) => r === '..' || r.startsWith('..' + sep) || isAbsolute(r);
  if (outside(rel)) return bad('the file is outside the repository');
  let text;
  try {
    // A symlink inside the repository may point out of it: the real path is the one that must stay inside.
    if (outside(relative(realpathSync(root), realpathSync(abs)))) return bad('the file is outside the repository');
    if (!statSync(abs).isFile()) return bad('it is not a file');
    text = readFileSync(abs, 'utf8');
  } catch { return bad('the file does not exist'); }
  if (!isDecisionRecord(rel)) return bad('it is not a Markdown file in a folder named adr, adrs or decisions');
  const match = STATUS_LINE.exec(text);
  if (!match) return bad('it has no status line');
  const status = match[2].toLowerCase();
  if (status !== 'proposed' && status !== 'accepted') return bad(`its status is ${match[2]}, not proposed or accepted`);
  return { path, ok: true, rel, text, status, match };
}

// The records the change's `decisions.md` lists (`- ADR: \`<path>\``): { listed, proposed, unreadable: [{ path, why }] }.
export function decisionRecords(root, dir) {
  const file = join(dir, 'decisions.md');
  const out = { listed: [], proposed: [], unreadable: [] };
  if (!existsSync(file)) return out;
  const paths = [...new Set([...readFileSync(file, 'utf8').matchAll(ADR_LINES)].map((m) => m[1].trim()))];
  for (const path of paths) {
    out.listed.push(path);
    const record = readRecord(root, path);
    if (!record.ok) out.unreadable.push({ path, why: record.why });
    else if (record.status === 'proposed') out.proposed.push(path);
  }
  return out;
}

// The status value in the letter case it had: PROPOSED to ACCEPTED, Proposed to Accepted, proposed to accepted.
const acceptedLike = (value) => (value === value.toUpperCase() ? 'ACCEPTED' : value[0] === value[0].toUpperCase() ? 'Accepted' : 'accepted');

// `accept-decisions <id>`: sets every proposed record `decisions.md` lists to accepted, after the owner's current approval. Every
// check runs before the first write; a refusal (exit 3) changes no file.
export function acceptDecisions(cwd, id, { lang = 'pt-BR' } = {}) {
  const l = normalizeLang(lang);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const root = locate(start, id).root;
  const located = locateChange(root, id);
  if (!located) throw new LoopUsageError(`unknown change ${id}`);
  const refuse = (error) => new LoopRefusal(error, render(l, 'blocked', { id, why: 'cannot-accept', error }));
  const approval = approvalState(located.dir);
  if (!approval.ok) throw refuse(approval.status === 'APPROVED' && approval.recorded ? 'approval.md is for an earlier readiness.md' : 'the plan has no current recorded approval (approval.md)');
  const approvalFile = join(located.dir, 'approval.md');
  const date = readValue(approvalFile, 'Date');
  if (!date) throw refuse('approval.md has no Date line');
  const { listed } = decisionRecords(root, located.dir);
  const records = listed.map((path) => readRecord(root, path));
  const unusable = records.find((r) => !r.ok);
  if (unusable) throw refuse(`${unusable.path}: ${unusable.why}`);
  const by = `Accepted by: the owner, on ${date}, in the approval of the plan of change ${id} (${relative(root, approvalFile).split('\\').join('/')})`;
  const writes = [];
  for (const r of records.filter((x) => x.status === 'proposed')) {
    const { match, text } = r;
    const cut = match[1].lastIndexOf('\n') + 1; // the pattern's leading `\s*` may span blank lines: the prefix is the status line's own
    const prefix = match[1].slice(cut);
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const next = `${text.slice(0, match.index + cut)}${prefix}${acceptedLike(match[2])}${match[3]}${eol}${prefix}${by}${text.slice(match.index + match[0].length)}`;
    writes.push([join(root, r.rel), next]);
  }
  for (const [file, body] of writes) writeFileSync(file, body);
  return {
    version: 1, change: id,
    accepted: records.filter((r) => r.status === 'proposed').map((r) => r.path),
    already: records.filter((r) => r.status === 'accepted').map((r) => r.path),
  };
}

// ---------------------------------------------------------------- checkouts and unfinished work (D-3, D-6)

// Every checkout of the repository, the main one included: [{ root (real path), branch }].
export function checkoutsOf(start) {
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

// True when the change folder `dir` names the project script in its own metadata file: a slice of `/devkit project`, which
// `/devkit change` and `/devkit roadmap` never list, start or resume (project-phases D-4).
export function isSliceDir(dir) {
  try { return /^schema:[ \t]*["']?devkit-project["']?[ \t]*\r?$/m.test(readFileSync(join(dir, '.openspec.yaml'), 'utf8')); } catch { return false; }
}

export function activeIds(root) {
  const dir = join(root, 'openspec', 'changes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n !== 'archive' && !n.startsWith('.') && statSync(join(dir, n)).isDirectory());
}

// The ids archived on the default branch (D-3): the union of every source that can be read, since an archived folder
// never leaves the default branch. GitHub's default branch, the remote-tracking one, the local one and the main
// checkout's working tree; a source that cannot be read adds nothing.
const ARCHIVED = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
// Each archived id with the latest day an archived folder of it carries (an id can be archived more than once).
export function archivedDates(start, { env = process.env, gh } = {}) {
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
// archive (a new change that reuses the id). A slice of `/devkit project` is left out unless `slices` is true.
export function unfinished(start, { env = process.env, gh, slices = false } = {}) {
  const archived = archivedDates(start, { env, gh });
  const found = new Map();
  const note = (id, c, rank, reused = false) => { if ((!archived.has(id) || reused) && (!found.has(id) || found.get(id).rank < rank)) found.set(id, { id, root: c.root, branch: c.branch, rank }); };
  for (const c of checkoutsOf(start)) {
    const archive = /^chore\/archive-(.+)$/.exec(c.branch);
    if (archive) note(archive[1], c, 3);
    for (const id of activeIds(c.root)) {
      if (!slices && isSliceDir(join(c.root, 'openspec', 'changes', id))) continue;
      note(id, c, c.branch === id ? 2 : 1, archived.has(id) && createdAfter(c.root, id, archived.get(id)));
    }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, root, branch }) => ({ id, root, branch }));
}

// The checkout holding change `id` as a folder, active or archived, in the main checkout or any worktree; null when none.
export function knownChange(start, id) {
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
  if (e?.state === 'waiting-on-github' || githubSilent(e)) return render(l, 'where.github');
  return render(l, 'where.blocked', { stage: title(e?.stage) });
}

// ---------------------------------------------------------------- the state command (change-state D-3)

// The ids the run file names and the state command lists: starts, changes in flight, declared ends, change sessions and starts left for the owner's next message.
const namedByRun = (run) => new Set([
  ...run.starting, ...Object.keys(run.inflight), ...Object.keys(run.declared), ...Object.keys(run.startedSessions),
  ...Object.entries(run.announced).filter(([, what]) => what === 'waits-turn' || what === 'waits-refused').map(([name]) => name),
]);

// The state of each change in play (every unfinished change and every change the run file names, or just `id`), in id order.
// Reads only; calls `nextAction` per change and never `updateRun`.
export function stateEntries(cwd, { id = null, lang, env = process.env, openspec, gh } = {}) {
  const l = normalizeLang(lang);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const run = readRun(runFilePath(start));
  const roadmapIds = new Set((readRoadmap(start) ?? []).flatMap((round) => round.items.map((item) => item.id)));
  const named = namedByRun(run);
  const ids = id !== null ? [id] : [...new Set([...unfinished(start, { env, gh }).map((u) => u.id), ...named])].sort((a, b) => a.localeCompare(b));
  let archived = null;
  const openTitle = () => {
    try { return readFlow(start, 'devkit')?.stages.find((s) => s.id === 'open')?.title[l] ?? 'open'; } catch { return 'open'; }
  };
  return ids.map((cid) => {
    let action;
    if (knownChange(start, cid)) action = nextAction(start, cid, { env, lang: l, openspec, gh });
    else if ((archived ??= archivedOnDefault(start, { env, gh })).has(cid)) {
      action = { kind: 'end', change: cid, script: null, root: null, branch: null, stage: null, stageTitle: null, end: { state: 'archived', why: 'archived' }, params: { id: cid } };
    } else if (named.has(cid)) action = { kind: 'none', change: cid, script: null, root: null, branch: null, stage: 'open', stageTitle: openTitle() };
    else throw new LoopUsageError(`no change named ${cid}`);
    const facts = runFactsOf(run, cid, { onRoadmap: roadmapIds.has(cid) });
    return { change: cid, ...changeState(action, facts, { lang: l }), script: action.script, root: action.root, branch: action.branch };
  });
}

// ---------------------------------------------------------------- start (D-3)

const VERB_ROUND = { help: 23 };
const DRIVER_ROUND = { compozy: 21, script: 22 };

// The verb is the first word, lower-cased; the text is the rest, trimmed.
export function parseStart(input) {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(String(input ?? '').trim());
  return m ? { verb: m[1].toLowerCase(), text: (m[2] ?? '').trim() } : { verb: '', text: '' };
}

// Rows S3 to S5 (and O3): the project is set up, its settings are known and its driver is built; else the reply of
// the row that stops it.
export function projectGate(start, settings) {
  if (!start || !optedIn(start)) return { mode: 'not-set-up', key: 'not-set-up', params: {} };
  const unknown = settings.unknown[0];
  if (unknown) return { mode: 'setting-unknown', key: 'setting-unknown', params: { setting: unknown.setting, value: unknown.value, accepted: unknown.accepted } };
  if (DRIVER_ROUND[settings.driver]) return { mode: 'driver-not-built', key: 'driver-not-built', params: { driver: settings.driver, round: DRIVER_ROUND[settings.driver] } };
  return null;
}

export const filesLanguageOf = (settings) => (settings.unknown.some((u) => u.setting === 'language') ? 'en' : settings.language);

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
  if (!['change', 'roadmap', 'status', 'project'].includes(verb)) return out('unknown-verb', { reply: say('verb-unknown') });
  const gate = projectGate(start, settings);
  if (gate) return out(gate.mode, { reply: say(gate.key, gate.params) });
  if (verb !== 'change') return out(verb); // the skill calls roadmap-loop.mjs or project-loop.mjs for these (roadmap-coordinator D-3, project-phases D-4)

  const read = { lang: l, env, openspec, gh };
  const list = unfinished(start, { env, gh }).map((u) => {
    let where = null;
    try { where = whereOf(u, u.id, read); } catch (e) { if (!(e instanceof LoopUsageError)) throw e; }
    return { id: u.id, root: u.root, where };
  });
  const resume = (id, where) => out('resume', { change: id, unfinished: list, reply: say('resumed', { id, where }) });
  if (/^\S+$/.test(text)) {
    const known = knownChange(start, text);
    const knownDir = known ? locateChange(known.root, text)?.dir : null;
    if (knownDir && isSliceDir(knownDir)) return out('is-slice', { change: text, reply: say('is-slice', { id: text }) });
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
export const NAME = /^(?=.{2,48}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
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

// Waits between tries without a busy loop, so the callers of a lock stay synchronous.
export const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Runs `work` holding the lock file `lock`, created with `wx` (holding `holder` when given), retried every `stepMs` for up to
// `waitMs` (then `timeout()` is thrown), taken over when older than `staleMs`, removed when the work ends. `sleep` is injectable.
// Shared by `open` (below) and the roadmap run file (roadmap-loop.mjs).
export function withLockFile({ lock, stepMs, waitMs, staleMs, holder, timeout, sleep = sleepSync }, work) {
  for (let waited = 0; ;) {
    try {
      const fd = openSync(lock, 'wx');
      try { if (holder !== undefined) writeFileSync(fd, holder); } finally { closeSync(fd); }
      break;
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;
      let age = 0;
      try { age = Date.now() - statSync(lock).mtimeMs; } catch { continue; } // released between the two calls: try again
      if (age > staleMs) { try { unlinkSync(lock); } catch { /* another call took it over first */ } continue; }
      if (waited >= waitMs) throw timeout();
      sleep(stepMs);
      waited += stepMs;
    }
  }
  try { return work(); } finally { try { unlinkSync(lock); } catch { /* already gone */ } }
}

// Two `open` calls at once take turns (roadmap-coordinator D-10): one lock file in the git common directory, 200 ms steps for
// up to 60 s, taken over when older than ten minutes. `openChange` and its callers stay synchronous.
const OPEN_LOCK = { stepMs: 200, waitMs: 60_000, staleMs: 10 * 60_000 };

function withOpenLock(main, work, lockSleep) {
  const common = tryGit(main, ['rev-parse', '--path-format=absolute', '--git-common-dir']) || join(main, '.git');
  return withLockFile({
    ...OPEN_LOCK, lock: join(common, 'devkit-open.lock'),
    holder: `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`,
    timeout: () => new LoopUsageError('another open call holds the lock for too long'),
    sleep: lockSleep,
  }, work);
}

// `open <id> --script <s> --why <code>`, the request on standard input. Creates the worktree, the change and its
// requirements file; refusals are LoopRefusal (exit 3, nothing created).
export function openChange(cwd, id, { script, why, request, lang = 'pt-BR', env = process.env, openspec, lockSleep } = {}) {
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

  // The change's own first file: its request, as a quote in the schema's requirements template.
  const prepare = (folder, worktree) => {
    const schema = schemaFile(worktree, script);
    const template = schema ? join(dirname(schema), 'templates', 'requirements.md') : null;
    if (!template || !existsSync(template)) throw new LoopUsageError(`the ${script} schema has no requirements template`);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'requirements.md'), requirementsFor(readFileSync(template, 'utf8'), text));
  };
  const { worktree, base } = openCheckout(cwd, id, { script, lang: l, env, openspec, prepare, lockSleep });
  return { version: 1, change: id, script, worktree, branch: id, base, reply: render(l, 'opened', { id, script, other: otherScript(script), why }) };
}

// The open steps every script shares (project-phases D-5): the open lock, the fetch, the id check, the worktree from the default
// branch, `openspec new change <id> --schema <script>`, `prepare(folder, worktree)` for the script's own first file, and the
// clean-up of a half-made open. The caller has checked the name and the project gate. Returns { worktree, base }; a refusal
// is a LoopRefusal (exit 3, nothing created).
export function openCheckout(cwd, id, { script, lang = 'pt-BR', env = process.env, openspec, prepare, lockSleep } = {}) {
  const l = normalizeLang(lang);
  const refuse = (key, params = {}) => new LoopRefusal(key, render(l, key, params));
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const main = mainRoot(start);
  return withOpenLock(main, () => openUnderLock({ start, main, id, script, prepare, refuse, openspec, env }), lockSleep);
}

// What `open` does while it holds the lock: the fetch, the id check, the worktree, the change and the script's first file.
function openUnderLock({ start, main, id, script, prepare, refuse, openspec, env }) {
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
    prepare?.(join(worktree, 'openspec', 'changes', id), worktree);
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
  return { worktree, base };
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
const isUnreadable = (a) => a.kind === 'end' && (a.end.why === 'github-unreadable' || (a.end.state === 'waiting-on-github' && a.params?.what === 'silent'));

// Polls `poll()` (the decision `next` gives) every `interval` seconds while it stays the same wait on GitHub, with no
// limit of its own, and returns the first decision that is anything else (the first decision itself when it is not a
// wait). A poll that throws, that says GitHub cannot be read or that is a wait on GitHub with no answer (`what` silent) is a failed read, retried; `maxFailures` in a row return blocked,
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
      if (action?.end.why === 'github-unreadable') return action;
      const { version, change, script, root, branch, filesLanguage, stage, stageTitle, role, skills } = first;
      const message = error ? (error instanceof Error ? error.message : String(error)) : action.detail?.error ?? '';
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

export const allow = (why, change = null) => ({ decision: 'allow', why, change });

// The refusal record of a session (`<session_id>.json`) or of a subagent (`<session_id>-<agent_id>.json`) under
// `<os.tmpdir()>/devkit-stop/`: the progress key of the state last refused.
const safeName = (value) => String(value ?? 'session').replace(/[^\w.-]/g, '_').slice(0, 120) || 'session';
const recordFile = (input) => join(tmpdir(), 'devkit-stop', `${safeName(input.session_id)}${input.agent_id ? `-${safeName(input.agent_id)}` : ''}.json`);
function recordedKey(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')).key ?? null; } catch { return null; }
}

// Refuses once for a state: the same key as the record is let through; a refusal that cannot be recorded would repeat
// forever, so it is let through too (the caller's catch).
export function refuseOnce(input, key, why, change, reason) {
  const file = recordFile(input);
  if (recordedKey(file) === key) return allow('same-state', change);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ key })}\n`);
  return { decision: 'refuse', why, change, reason };
}

const hasTasks = (tasks) => (Array.isArray(tasks) ? tasks.length > 0 : Boolean(tasks) && typeof tasks === 'object' && Object.keys(tasks).length > 0);

// `guard.mjs stop` (T1 to T7): the session in a run does not end its turn while the loop has a stage ready. `events` are the
// transcript's events the guard already scanned (`transcriptEvents`); absent, `runOf` scans the file itself. The same for the two below.
export function stopDecision(input, { env = process.env, events } = {}) {
  let change = null;
  try {
    const run = runOf(input, events);
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
const UNDELIVERED = ['no-header', 'bad-header', 'header-other-stage', 'not-judged', 'owner-changes'];

// `guard.mjs subagent-stop` (U1 to U7): a stage agent does not stop before its stage file is delivered.
export function subagentStopDecision(input, { env = process.env, events } = {}) {
  let change = null;
  try {
    const run = runOf(input, events);
    if (!run) return allow('no-run');
    change = run.change;
    return subagentStopFor(input, change, { env });
  } catch { return allow('error', change); }
}

// U2 to U6 over the change `change`, found by the caller (the change run's reader or the roadmap run's brief). Throws on an
// error: the caller lets the stop through.
export function subagentStopFor(input, change, { env = process.env } = {}) {
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
}

// The agents a run may hand work to: the roles and helpers of the script's stages, but not the owner, the coordinator
// itself or the review bench (a skill, not an agent).
const NOT_AGENTS = ['owner', 'change-coordinator', 'project-coordinator', 'review-bench'];
export function scriptAgents(flow) {
  return [...new Set(flow.stages.flatMap((s) => [s.role, ...(s.helpers ?? [])]))].filter((r) => !NOT_AGENTS.includes(r));
}

// The devkit pack that ships the agent of each role and helper that has one (`<pack>:<role>`), as docs/roles.md names
// them in its "Played today by" lines; a test holds the two together. A role with no agent (`shipped: false`) has none.
export const PACKS = {
  ...Object.fromEntries(['change-planner', 'plan-readiness-reviewer', 'tdd-implementer', 'pr-verifier', 'commit-and-pr', 'codebase-researcher',
    'plan-reality-auditor', 'adr-reviewer', 'code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer', 'security-reviewer',
    'spec-reviewer', 'finding-verifier', 'screen-designer', 'adr-author', 'test-runner', 'e2e-tester'].map((r) => [r, 'devkit-core'])),
  'openspec-validator': 'devkit-openspec',
};

// `guard.mjs agent` (H1 to H5): in a run the session hands work only to the roles of the change's script, named with no
// prefix or with the prefix of the pack that ships that role's agent; no agent type is a general-purpose agent: refused.
export function agentDecision(input, { events } = {}) {
  let change = null;
  try {
    if (input.agent_type) return allow('subagent');
    const run = runOf(input, events);
    if (!run) return allow('no-run');
    change = run.change;
    return handOffFor(input, change);
  } catch { return allow('error', change); }
}

// H3 to H4a over the change `change`, found by the caller; `command` is the run's command as the refusal names it (a roadmap run
// also names the change). Throws on an error: the caller lets the hand-off through.
export function handOffFor(input, change, { command = 'change' } = {}) {
  const start = findRoot(input.cwd ?? process.cwd());
  if (!start) return allow('no-project', change);
  const found = locate(start, change);
  const schema = changeSchemaAt(found.root, locateChange(found.root, change)?.dir ?? join(found.root, 'openspec', 'changes', change));
  const flow = readFlow(found.root, schema);
  if (!flow) return allow('no-script', change);
  const roles = scriptAgents(flow);
  const lead = `in a /devkit ${command} run this session hands work${command === 'change' ? '' : ` for ${change}`} only to the roles of the ${schema} script: ${roles.join(', ')}`;
  const type = input.tool_input?.subagent_type;
  if (typeof type !== 'string' || !type.trim()) return { decision: 'refuse', why: 'no-type', change, reason: `${lead}; name one of them as subagent_type` };
  const colon = type.indexOf(':');
  const pack = colon === -1 ? null : type.slice(0, colon);
  const role = colon === -1 ? type : type.slice(colon + 1);
  if (roles.includes(role) && (pack === null || PACKS[role] === pack)) return allow('script-role', change);
  return { decision: 'refuse', why: 'not-a-role', change, reason: `${lead}; ${type} is not one of them` };
}

// ---------------------------------------------------------------- the command line (D-5)

const USAGE = 'usage: change-loop.mjs next --change <id> --lang <pt-BR|en> [--after <progress-key>] | reply <key> --lang <l> [--param name=value]... '
  + '| start --lang <l> (the request on standard input) | open <id> --script <devkit|devkit-lite> --why <code> --lang <l> (the request on standard input) '
  + '| script <id> <devkit|devkit-lite> --why <code> --lang <l> | accept-decisions <id> --lang <l> | wait --change <id> --lang <l> [--interval <seconds>] | state [--change <id>] --lang <l>';

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

function runState(args, { env, cwd, openspec, gh }) {
  const opts = parseArgs(args, { values: ['--change', '--lang'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const changes = stateEntries(cwd, { id: opts.change ?? null, lang: opts.lang, env, openspec, gh });
  return { code: 0, stdout: json({ version: 1, changes }), stderr: '' };
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

function runAccept(args, { cwd }) {
  const opts = parseArgs(args, { values: ['--lang'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  return { code: 0, stdout: json(acceptDecisions(cwd, opts.positional[0], { lang: opts.lang })), stderr: '' };
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
    if (sub === 'state') return runState(rest, { env, cwd, openspec, gh });
    if (sub === 'start') return runStart(rest, { env, cwd, stdin, openspec, gh });
    if (sub === 'open') return runOpen(rest, { env, cwd, stdin, openspec });
    if (sub === 'script') return runScript(rest, { cwd });
    if (sub === 'accept-decisions') return runAccept(rest, { cwd });
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
// A pipe that is still empty makes the read fail with EAGAIN: wait a little and read again, up to STDIN_WAIT.ms in all.
const STDIN_WAIT = { stepMs: 20, ms: 10_000 };
export function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  const buf = Buffer.alloc(65_536);
  let waited = 0;
  for (;;) {
    let n;
    try {
      n = readSync(0, buf, 0, buf.length, null);
    } catch (e) {
      if (e?.code !== 'EAGAIN') return '';
      if (waited >= STDIN_WAIT.ms) break;
      sleepSync(STDIN_WAIT.stepMs);
      waited += STDIN_WAIT.stepMs;
      continue;
    }
    if (n === 0) break;
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks).toString('utf8');
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
