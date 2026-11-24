// change-loop: the decision core of `/devkit change` (design change-coordinator D-5, D-9).
//
// Given a change, it asks the stage checker (flow-check) which stage the change is in and, from the
// implementation on, the delivery checker (deliver-check, through conduct-check's `deliveryRow`) which step
// inside that stage comes next, and answers with ONE action or ONE end for the session to carry out. It reads
// files, git and (through gh) GitHub, writes nothing but the commands above, calls no AI, never calls Jira, and runs nothing when imported.
//
// Subcommands: `next --change <id> --lang <l> [--after <progressKey>]` (prints `devkit-run: <id>`, then the JSON
// action; exit 0 an action or archived, 1 waiting, 2 blocked, 3 a usage or preflight error),
// `reply <key> --lang <l> [--param name=value]... [--stdin <name>]` (renders one message of the table; with `--stdin` the parameter <name> is the standard input, one final line break removed),
// `start --lang <l>` (the request on standard input: what `/devkit` does with it, D-3), `open <id> --script <s>
// --why <code> [--task <KEY>] --lang <l>` (creates the worktree, the change and its requirements file, D-4; with `--task` the
// standard input is the Jira task the session read, as JSON, and the request section records its key), `script <id> <s>
// --why <code> --lang <l>` (the correction of the script, D-4), `wait --change <id> --lang <l> [--interval <s>]`
// (waits on GitHub with no limit, D-7), `accept-decisions <id> --lang <l>` (sets the proposed decision records the change
// lists to accepted, after the owner's current approval; stage-roles D-4), `merge-check <id> --lang <l>` (runs `openspec validate <id> --type change --strict`
// once for the merge of the base the branch holds and records the result; post-merge-validate D-3), `flow <id> --lang <l>` (moves the change to the
// installed version of its script's flow, only when the owner asks; change-version-pin D-7), `write-back ask <id> --lang <l>`
// (the pull request and the task's transitions as JSON on standard input: whether to ask about writing the link on the Jira
// task, and the question) and `write-back answer <id> --choice <comment|no|transition:<id>> --lang <l>` (what the session may
// then write to Jira, jira-entry D-7). Only `open`, `script`, `accept-decisions`, `flow`, `merge-check` and `write-back` write, the last two only
// their record in the git common directory; `start` and `next` do not. The CompozyOS driver (compozy-driver D-1, D-3, D-4) adds `compozy-start <id>`, `next --view compozy`, `confirm --view <json>`
// and the record steps `record-approval`, `record-mockup`, `record-answer`, `run-gate`, `run-step` and `compozy-retry`, which write the run record (`<git common dir>/devkit-compozy/<id>.json`). `next` and `wait` print
// `devkit-end: <id> <state>` after the run line when the action is an end, and `reply` does so for the keys that end a run.
//
// It also holds the decisions of the three locks that `guard.mjs` calls as modes (D-8): `stopDecision` (the session does not
// end its turn while a stage is ready), `subagentStopDecision` (a stage agent does not stop before its file is delivered) and
// `agentDecision` (in a run, work goes only to the script's roles). Each returns { decision, why, change, reason } and fails
// open. The two stop locks refuse once per unchanged state: they record the progress key of the state refused in
// `<os.tmpdir()>/devkit-stop/<session_id>[-<agent_id>].json` and let the same key through the next time.
// With a token budget set (`budget:` in the `devkit:` block), `next` counts the session's spend and holds a hand-off at the cap:
// the action becomes an end waiting for the owner (change-budget).
// Every action at a stage carries the `model` of its stage (stage-models), and `next` hands a stage whose subagent returned
// `Outcome: failure` once more on the next model up, or ends the run blocked: the retry is read from the session's subagent
// transcripts on a `next` called with `--after` (the call after a stage agent returns); a `next` with no `--after` reads none.
// No dependencies.

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { hostname, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { findRoot, optedIn, schemaFile, runOf, changeFlow, changeSchemaAt, readFlow, readPin, sessionTranscript, spentOf, handOffKey, handOffsOf, typedSince, isChangeId, readRoadmap, readValue, isDecisionRecord, parseStageHeader, parseDevkitBlock, deliverySettings, budgetValue, releaseTagSetting, trainSetting, SPEND_MESSAGES } from './guard.mjs';
import { collectFlow, computeFlow, fingerprint, inSentence, makeOpenspec, classificationFlags, readTestSettings } from './flow-check.mjs';
import { collectState, buildReport, locateChange, approvalState, makeGh } from './deliver-check.mjs';
import { deliveryRow, listWorktrees } from './conduct-check.mjs';
import { emptyRun, readRun, runFilePath } from './run-file.mjs';
import { readiness, liveRuns, startRun, CHANGE_LOOP } from './compozy-driver.mjs';
import { TASK_KEY, parseTaskRef, taskIdPrefix, recordedTask, taskFromJson, quoteLines, taskRequest, commentText, writeBackInput, writeBackChoices } from './jira-task.mjs';

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
export const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

// The token budget a `budget:` value gives (change-budget D-1) is read by `guard.mjs#budgetValue`; every caller keeps importing it from here.
export { budgetValue };
const BUDGET_ACCEPTED = '1, 2, 3, …';
const RELEASE_TAG_ACCEPTED = 'a path from the repository root to a JSON file, such as package.json';

// ---------------------------------------------------------------- the model of each stage (stage-models D-1)

// The stages that have a model, in flow order: the stage ids of the `devkit` and `devkit-lite` scripts but `open`, which are the
// `stage` field of every action `next` prints (the archive steps are steps of the retro stage).
export const MODEL_STAGES = Object.freeze([
  'requirements', 'mockup', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness', 'approval',
  'implementation', 'unit-tests', 'e2e-tests', 'evidence', 'review', 'delivery', 'retro',
]);

// The built-in model of each stage (ADR 0023 decision 1); no default is a 1M variant, which is an explicit opt-in.
export const DEFAULT_MODELS = Object.freeze({
  requirements: 'opus', mockup: 'sonnet', decisions: 'opus', proposal: 'opus', specs: 'opus', design: 'opus', tasks: 'opus',
  readiness: 'sonnet', approval: 'sonnet', implementation: 'sonnet', 'unit-tests': 'haiku', 'e2e-tests': 'sonnet',
  evidence: 'sonnet', review: 'sonnet', delivery: 'haiku', retro: 'sonnet',
});

// The stages a change session performs itself, not through a stage subagent, in flow order (ADR 0023 decision 4): the grill, the
// owner's approval, the review round, the delivery steps and the retro. Only the step-down floor reads this list.
export const SESSION_RUN_STAGES = Object.freeze(['requirements', 'approval', 'review', 'delivery', 'retro']);

// The values a model can take, cheapest first; `haiku` has no 1M variant.
export const MODEL_VALUES = Object.freeze(['haiku', 'sonnet', 'sonnet[1m]', 'opus', 'opus[1m]']);

// The place of a value in that order, -1 for anything else.
export const modelRank = (value) => MODEL_VALUES.indexOf(value);
// True when both values are known and `a` is the cheaper one.
export const cheaper = (a, b) => modelRank(a) >= 0 && modelRank(b) >= 0 && modelRank(a) < modelRank(b);
// The strongest known value of a list, null when none is known.
export const strongest = (values) => values.filter((v) => modelRank(v) >= 0).reduce((top, v) => (top === null || modelRank(v) > modelRank(top) ? v : top), null);
// A value without its 1M suffix: the family an Agent call names.
export const familyOf = (value) => String(value).replace(/\[1m\]$/, '');
// The next family up, keeping the 1M suffix; null on Opus.
export const oneUp = (value) => ({ haiku: 'sonnet', sonnet: 'opus', 'sonnet[1m]': 'opus[1m]' })[value] ?? null;

// The text of a settings file; a missing file is '' and any other read error a LoopUsageError.
function settingsText(file, label) {
  try { return readFileSync(file, 'utf8'); } catch (e) {
    if (e?.code === 'ENOENT') return '';
    throw new LoopUsageError(`${label} cannot be read (${e?.code ?? e})`);
  }
}

// { driver, language, unknown: [{ setting, value, accepted }] } from the `devkit:` block of openspec/config.yaml, plus
// `delivery: { model, base, testBranch }` when a delivery model is set and `missing: [{ setting }]` when two pull requests
// are chosen without a name (delivery-models D-1), and `train: { suite, problem }` only when the delivery train is set or refused
// (delivery-train D-1). No block, no file or a missing key gives the defaults (`claude`, `en`);
// other keys of the block are ignored, except an invalid `budget`, the `models:` table's problems (`modelProblems`) and the tests'
// coverage target, whose bad values are listed in `unknown` after the two above (flow-check's `readTestSettings`), then an invalid
// `release_tag` (release-tags D-1); a valid one sets `releaseTag`, the path of the JSON file the release is read from, and only then.
export function readDevkitSettings(root) {
  const block = parseDevkitBlock(settingsText(join(root, 'openspec', 'config.yaml'), 'openspec/config.yaml'));
  const driver = block.driver || 'claude';
  const language = block.language || 'en';
  const unknown = [];
  if (!DRIVERS.includes(driver)) unknown.push({ setting: 'driver', value: driver, accepted: DRIVERS.join(', ') });
  if (!LANGUAGE_TAG.test(language)) unknown.push({ setting: 'language', value: language, accepted: 'a language tag such as en or pt-BR' });
  const budget = budgetValue(block.budget);
  if (budget?.invalid !== undefined) unknown.push({ setting: 'budget', value: budget.invalid, accepted: BUDGET_ACCEPTED });
  unknown.push(...modelProblems(block.models));
  unknown.push(...readTestSettings(root).unknown);
  const releaseTag = releaseTagSetting(block);
  if (releaseTag.problem) unknown.push({ setting: releaseTag.problem.setting, value: releaseTag.problem.value, accepted: RELEASE_TAG_ACCEPTED });
  const settings = { driver, language, unknown };
  if (releaseTag.file) settings.releaseTag = releaseTag.file;
  const { model, base, testBranch, problems } = deliverySettings(block);
  if (model) settings.delivery = { model, base, testBranch };
  const train = trainSetting(block);
  if (train.suite !== null || train.problem !== null) settings.train = train;
  const missing = [];
  for (const p of problems) {
    if (p.kind === 'missing') missing.push({ setting: p.setting });
    else unknown.push({ setting: p.setting, value: p.value, accepted: DELIVERY_ACCEPTED[p.setting] });
  }
  if (missing.length) settings.missing = missing;
  if (train.problem?.kind === 'unknown') unknown.push({ setting: train.problem.setting, value: train.problem.value, accepted: DELIVERY_ACCEPTED[train.problem.setting] });
  return settings;
}

const DELIVERY_ACCEPTED = { 'delivery-model': 'two-prs, trunk, trunk-auto', 'delivery-test-branch': 'a branch other than the base', 'delivery-train': 'a command whose quotes are closed' };

// The token cap of the change in `dir`: { cap, from: 'change' | 'project', file } (the file is always the change's own
// `.openspec.yaml`, where the owner raises it), or null. The change's value wins over the project's, which is the one in
// `root`'s openspec/config.yaml. An invalid value in either file is a LoopRefusal with the settings reply.
export function budgetOf(root, dir, lang) {
  const file = join(dir, '.openspec.yaml');
  const mine = budgetValue(parseDevkitBlock(settingsText(file, '.openspec.yaml')).budget);
  const project = budgetValue(parseDevkitBlock(settingsText(join(root, 'openspec', 'config.yaml'), 'openspec/config.yaml')).budget);
  const bad = mine?.invalid !== undefined ? mine : project?.invalid !== undefined ? project : null;
  if (bad) throw new LoopRefusal('setting-unknown', render(lang, 'setting-unknown', { setting: 'budget', value: bad.invalid, accepted: BUDGET_ACCEPTED }));
  if (mine) return { cap: mine.cap, from: 'change', file };
  if (project) return { cap: project.cap, from: 'project', file };
  return null;
}

// The problems of a parsed `models:` table, in map order (stage-models D-2): a key that is no stage of the table (the inline value
// of `models: <value>` for the key ''), and a non-empty value that is no model. An unknown stage gives its own problem only.
export function modelProblems(map) {
  const problems = [];
  for (const [stage, value] of map ?? []) {
    if (!MODEL_STAGES.includes(stage)) problems.push({ setting: 'model-stage', value: stage === '' ? value : stage, accepted: MODEL_STAGES.join(', ') });
    else if (value !== undefined && !MODEL_VALUES.includes(value)) problems.push({ setting: 'model-value', value: `${stage}: ${value}`, accepted: MODEL_VALUES.join(', ') });
  }
  return problems;
}

// The model of every stage of the change in `dir`, a plain object over MODEL_STAGES (stage-models D-2): the change's non-empty
// value, else the project's, else the default. With `strict` (the change's own loop) the first problem of the change's table, else
// of the project's, is a LoopRefusal with the settings reply; without it a table with a problem is ignored whole, so a typing error
// in one change stops no lock and no other change.
export function modelsOf(root, dir, { strict = false, lang = 'en' } = {}) {
  const read = (file, label) => parseDevkitBlock(settingsText(file, label)).models;
  const tables = [read(join(dir, '.openspec.yaml'), '.openspec.yaml'), read(join(root, 'openspec', 'config.yaml'), 'openspec/config.yaml')].map((map) => ({ map, problems: modelProblems(map) }));
  if (strict) {
    const bad = tables.find((t) => t.problems.length)?.problems[0];
    if (bad) throw new LoopRefusal('setting-unknown', render(lang, 'setting-unknown', bad));
  }
  const usable = tables.filter((t) => !t.problems.length).map((t) => t.map);
  return Object.fromEntries(MODEL_STAGES.map((stage) => [stage, usable.map((map) => map.get(stage)).find((v) => v) ?? DEFAULT_MODELS[stage]]));
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
    'verb-unknown': 'So far /devkit change, /devkit roadmap, /devkit status, /devkit setup, /devkit project and /devkit train exist: type /devkit change and what you want done, /devkit roadmap to run the roadmap, /devkit status to see where everything is, /devkit setup to set this project up or update its setup, /devkit project and a name to plan a new project or slice, or /devkit train to send the boarded changes on one train.',
    'not-set-up': 'This project is not set up for devkit yet: type /devkit setup first. Nothing was run.',
    'setup-no-repo': '/devkit setup runs inside a git repository: open the project\'s folder, or create its repository there first. Nothing was run.',
    'setting-unknown': 'The project\'s devkit settings have an unknown {setting}, "{value}"; use one of: {accepted}. Nothing was run.',
    'setting-missing': 'The project\'s devkit settings choose two pull requests but do not name the {setting}. Nothing was run.',
    'train-model': 'The project\'s devkit settings set a delivery train, but the delivery model is two-prs: the train runs only with trunk or trunk-auto, because two-prs delivers each change through pull requests of its own. Nothing was run.',
    'train-no-model': 'The project\'s devkit settings set a delivery train but choose no delivery model: the train runs only with the delivery model trunk or trunk-auto. Nothing was run.',
    'test-branch-missing': 'This project delivers with two pull requests, but its test branch {branch} does not exist on the remote: create it there, then call /devkit change again. Nothing was created.',
    'base-not-default': 'This project delivers to {base}, but the repository\'s default branch is {default}: they must be the same branch. Nothing was created.',
    'name-test-suffix': '{id} cannot be a change name here: a name ending in -{branch} is kept for the support branches.',
    'driver-not-built': 'This project is set to run on {driver}, which is not built yet (round {round}). Nothing was run.',
    'driver-no-project': '/devkit project does not run on CompozyOS yet; nothing was run.',
    'compozy-started': '{id} runs in CompozyOS now: follow it and answer its questions there, at {url}.',
    'compozy-started-no-url': '{id} runs in CompozyOS now (run {run}): follow it and answer its questions there.',
    'compozy-running': '{id} already runs in CompozyOS (run {run}): follow it and answer its questions there.',
    'compozy-not-installed': 'CompozyOS is not installed on this machine, so nothing was run: install it with {fix}, then call /devkit again.',
    'compozy-stopped': 'CompozyOS is not running, so nothing was run: start it with {fix}, then call /devkit again.',
    'compozy-workspace': 'This project is not a CompozyOS workspace yet, so nothing was run: register it with {fix}, then call /devkit again.',
    'compozy-kit-missing': 'The devkit kit is not installed in CompozyOS for this project, so nothing was run: type /devkit setup and answer yes to the kit, then call /devkit again.',
    'compozy-roadmap-started': 'The roadmap runs in CompozyOS with up to {places} changes at once: {url}.',
    'compozy-requests': '{n} questions wait for you in CompozyOS.',
    'nothing-to-resume': 'There is no unfinished change to continue: type /devkit change and what you want done.',
    choose: 'There are {n} unfinished changes: {list}. Which one should I continue?',
    'ask-unfinished': 'Before starting: {list} is unfinished. Should I continue it, or start your new request?',
    'ask-unfinished-many': 'Before starting: {list} are unfinished. Should I continue one of them, or start your new request?',
    opened: 'I opened the change {id} on the {script}, because {why}. Next come a few questions about your request; to use the {other} instead, say so before the plan is written.',
    'task-no-connector': 'This session has no Jira connector, so I cannot read {key}. Nothing was opened: type /devkit change and what you want done, in your own words.',
    'task-unreadable': 'I could not read the task {key} in Jira: it was not found, or this account cannot see it. Nothing was opened: type /devkit change and what you want done, in your own words.',
    'task-taken': 'The task {key} already has the unfinished change {id}: type /devkit change {key} to continue it. Nothing was opened.',
    'opened-task': 'I read the task {key} and opened the change {id} on the {script}, because {why}. Next come a few questions on what the task leaves open; to use the {other} instead, say so before the plan is written.',
    'write-back-ask': 'Pull request #{number} of {id} is open. Should I write its link on the task {key}? Answer one of: {choices}. Nothing is written to {key} until you answer, and the delivery goes on meanwhile.',
    'choice.transition': 'move it to "{name}"',
    'choice.comment': 'only comment',
    'choice.no': 'no',
    'write-back-commented': 'I wrote the link of pull request #{number} on {key}.',
    'write-back-moved': 'I wrote the link of pull request #{number} on {key} and moved it to "{name}".',
    'write-back-none': 'Nothing was written to {key}.',
    'write-back-late': 'The change {id} is already archived, so nothing was written to {key}.',
    'write-back-unknown': 'That is not one of the choices {key} had when I asked. Answer one of: {choices}.',
    'write-back-failed': 'Jira did not accept the write on {key} ({error}). Nothing more is tried; you can add the link to the task by hand.',
    'name-taken': 'A change named {id} already exists; I will choose another name.',
    claimed: '{id} is already open on {machine}: I opened nothing here. Continue it there, or choose another name.',
    'claimed-elsewhere': '{id} is already open on another machine: I opened nothing here. Continue it there, or choose another name.',
    'opened-on': 'I opened the change {id} for {machine}, on the {script}, because {why}. Its questions come in its own session there.',
    'name-invalid': '{id} cannot be a change name: use lowercase letters, digits and dashes.',
    resumed: 'Continuing the change {id}: {where}.',
    'script-switched': 'The change {id} moves to the {script}, because {why}.',
    'script-locked': 'The plan of {id} is already written, so its script stays as it is.',
    'flow-newer': 'It follows version {version} of its script\'s flow; version {installed} is installed, and it moves to it only if you ask me.',
    'flow-moved': 'The change {id} now follows version {installed} of its script\'s flow; it followed version {version}.',
    'flow-ahead': 'The change {id} follows version {version} of its script\'s flow, newer than the installed version {installed}: update devkit in this project before moving it.',
    'waiting-approval': 'The plan of {id} is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.',
    'waiting-approval-again': 'The plan of {id} changed after your approval, so it needs your approval again.',
    'waiting-mockup': 'The mock-up of {id} is drawn. Look at it and tell me whether you approve it or what to change; I go on as soon as you answer.',
    'waiting-retro': 'The retro of {id} has proposals for you: approve or reject each one, and I archive the change.',
    'waiting-merge': 'Pull request #{number} of {id} is ready: in this project, merging it is up to you.',
    'waiting-archive-merge': 'The archive pull request #{number} of {id} is ready: in this project, merging it is up to you.',
    'waiting-merge-test-branch': 'Pull request #{number} of {id} to {branch} is ready: in this project, merging it is up to you. The pull request to {base} waits for it.',
    'waiting-merge-base': 'Pull request #{number} of {id} to {base} is ready: in this project, merging it is up to you.',
    'waiting-archive-merges': 'The archive pull requests of {id} are ready: {list}. In this project, merging them is up to you.',
    'waiting-train': '{id} is boarded: it leaves with the next train, which /devkit train departs.',
    'train-off': 'This project has no delivery train: devkit.delivery.train in its devkit settings switches it on. Nothing was created.',
    'train-running': 'A train is departing now, so no second one starts. When no departure is running (a session ended in the middle of one), delete the lock file ({where}) or wait: after six hours a new departure takes it over.',
    'train-nothing': 'Nothing is boarded: no change or archive is waiting for a train. Nothing was created.',
    'train-blocked': 'The train stopped: {error}. Nothing more runs until this is sorted out.',
    'train-base-red': 'The suite fails on {base} itself, so no train departs and no change was taken off: fix {base} first.',
    'train-checks': 'Train {n} (pull request #{number}) is waiting on GitHub for its checks. I keep waiting and go on by myself when they finish.',
    'train-auto-merge-on': 'Auto-merge is on for pull request #{number} of train {n}: GitHub merges it once its checks pass.',
    'train-ready': 'Pull request #{number} of train {n} is ready: in this project, merging it is up to you, with a merge commit.',
    'train-delivered': 'Train {n} merged in pull request #{number}: its changes are delivered, and what it left behind is tidied now.',
    'train-args': '/devkit train takes nothing after it: type /devkit train alone. Nothing was started.',
    'waiting-review-dispute': 'The code review of {id} still disagrees after its second round: the disputed points need your decision.',
    'waiting-by-hand': 'This project delivers each change by hand: {id} stops here, and the session writes no code for it.',
    'waiting-unrun-stage': '{Stage} of {id} has an unfinished file that no role of this version can finish: tell me its result, or remove it.',
    'waiting-pr-decision': 'A comment on the pull request of {id} asks for a decision only you can take: {url}.',
    'waiting-place': '{id} waits for a free place on {machine} ({taken} of {places} taken): it goes on when one frees, and the roadmap session tells it.',
    'waiting-budget': 'The change {id} reached its token budget: {spent} tokens spent, and the cap is {cap}. To go on, raise budget in the devkit block of {file}, then type /devkit change again.',
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
    'roadmap-session-opened': '{id} is open in a session of its own; its grill is asked here.',
    'roadmap-check-refused': 'The app refused the periodic check of this run: it goes on without one.',
    'roadmap-check-idle': '{id} has a place but its session is not watching: type any message in it.',
    'roadmap-check-stopped-waits': '{n} wait loops of the run were stopped: their changes no longer need them.',
    'roadmap-check-session-archived': 'The session of {id} was archived.',
    'roadmap-check-archive-later': 'The session of {id} is not archived yet: it is still working or waits for your approval; I try again later.',
    'push-failed': 'The branch of {id} could not be pushed: {error}. I try again at a later decision.',
    'roadmap-session-started-on': 'Started {id} on {machine}, in a session of its own.',
    'roadmap-waits-turn-on': '{id} is open for {machine} and starts in a session of its own there at your next message: the app starts a session only on a turn you typed.',
    'roadmap-woken': 'A place freed on {machine}: I told {id} to go on.',
    'roadmap-machine-silent': '{machine} does not answer: no new change goes there, and its changes keep their places.',
    'roadmap-waits-refused': '{id} could not start in a session of its own: the app refused it. It starts at your next message.',
    'session-held-owner': '{id}: {gate} is asked in the roadmap session; this session goes on as soon as it is answered.',
    'session-held-place': '{id} waits for a place: {places} changes are building.',
    'session-held-load': '{id} waits: the processor is at {load}% (limit {limit}%).',
    'session-held-after': '{id} waits for {after} to be archived before its plan.',
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
    'gate.train': 'the departure of the next train',
    'gate.decision': 'a decision only you can take',
    'gate.dispute': 'your decision on the disputed review points',
    'gate.stage': 'your result for an unfinished file',
    'gate.by-hand': 'your delivery by hand',
    'gate.budget': 'a higher token budget',
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
    'queue.held-place': 'open, waits for a place',
    'queue.held-load': 'open, held by the load',
    'queue.held-after': 'open, waits for {after}',
    'queue.no-machine': 'ready, no machine can take it now (this one is loaded, the others do not answer)',
    'machines-unreadable': 'The machines setting is not a list I can read. Write it as [{"host": "avel", "folder": "/home/me/repo", "places": 2}]. Nothing was started.',
    'machine-incomplete': 'The machine {entry} in the machines setting has no valid {field}. Nothing was started.',
    'machine-duplicate': 'The machine {entry} appears twice in the machines setting. Nothing was started.',
    'checkout-failed': 'I could not make the folder of {id} on {machine}: {error}.',
    'status-count-machines': 'Roadmap: {open} open · {queue} in the queue · {archived} archived',
    'status-machines': 'Machines',
    'status-claims-unreadable': 'GitHub could not be read: changes open on other machines are not shown.',
    'machine.row': '{taken} of {places} places taken · {open} open',
    'machine.this': '{name} (this one)',
    'machine.no-answer': 'no answer',
    'machine.unknown': 'another machine',
    'remote.open': 'open on {machine}',
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
    'blocked-why.ceiling': '{stage} reached its limit of failures in a row ({failures})',
    'blocked-why.no-progress': '{stage} came back with nothing changed',
    'blocked-why.no-place': 'it waits for a free place on {machine} ({taken} of {places} taken)',
    'blocked-why.not-delivered': '{stage} ended without delivering its result',
    'blocked-why.github-unreadable': 'GitHub cannot be read ({error})',
    'blocked-why.gh-too-old': 'the installed gh ({installed}) cannot read the pull request checks, which need version {minimum} or newer: update gh, then call /devkit {verb} {id} again',
    'blocked-why.pr-closed': 'pull request #{number} was closed without merging',
    'blocked-why.previous-script': 'it began under the previous script; finish it with /ship-change {id}',
    'blocked-why.not-opened': 'its folder is incomplete',
    'blocked-why.tests-red': 'the tests of phase {phase} failed',
    'blocked-why.role-failed': '{stage} could not finish its work',
    'blocked-why.wrong-branch': 'its folder is on a branch with another name',
    'blocked-why.merge-setup': 'the repository is not prepared for automatic merging yet, which the GitHub step of /devkit setup does',
    'blocked-why.archive-failed': 'a step of the archive failed',
    'blocked-why.tag-elsewhere': 'the tag {tag} is already on the remote at {at}, not at the merge commit {sha}; the run never moves a tag, so you settle it',
    'blocked-why.plan-not-approved': 'its plan review is not approved',
    'blocked-why.pr-problem': 'the pull request has a problem the session cannot fix alone',
    'blocked-why.unknown-step': 'the next step is one this version does not know',
    'blocked-why.unreadable': 'the change cannot be read ({error})',
    'blocked-why.cannot-open': 'it could not be opened ({error})',
    'blocked-why.cannot-check-out': 'its folder could not be made on {machine} ({error})',
    'gh-version-unknown': 'unknown version',
    'blocked-why.cannot-accept': 'the decision records could not be marked accepted ({error})',
    'blocked-why.merge-defect': 'the merge of the base at {sha} left the plan failing its check {attempt} times in a row; fix the plan by hand, then resume',
    'blocked-why.merge-check-failed': 'the check of the plan after the merge of the base could not run ({error})',
    'blocked-why.open-failed': 'the run could not open it; start it again from Claude Code with its request, /devkit change <request>',
    'blocked-why.base-conflict': 'the default branch could not be merged into it: {error}',
    'what.checks': 'the checks of the pull request',
    'what.merge': 'the merge of the pull request',
    'what.archive-merge': 'the merge of the archive pull request',
    'what.train': 'the pull request of its train',
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
    'setting.delivery-model': 'delivery model',
    'setting.delivery-base': 'base branch',
    'setting.delivery-test-branch': 'test branch',
    'setting.delivery-train': 'delivery train',
    'setting.budget': 'budget',
    'setting.model-stage': 'stage named in the model table',
    'setting.model-value': 'model of a stage',
    'setting.coverage-target': 'coverage target',
    'setting.release-tag': 'release file',
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
    'design-pack-missing': 'The project flow needs the devkit-design pack in this project: type /devkit setup and enable the devkit-design pack, then call /devkit project again. Nothing was run.',
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
    'slice-machine': 'Machine: {machine}',
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
    'blocked-why.merge-setup-missing': 'the repository is not prepared for automatic merging yet ({list}), which the GitHub step of /devkit setup does',
    'blocked-why.branch-conflict': 'pull request #{number} conflicts with {base}: resolve the conflict on the slice\'s branch, then call /devkit project {id} again',
    'blocked-why.archive-refused': 'the slice cannot be archived yet: {list} not settled',
    'blocked-why.undeclared-stage': 'the flow asked for {stage}, which this project script does not declare',
    ...SPEND_MESSAGES.en,
  },
  'pt-BR': {
    'verb-not-built': '/devkit {verb} ainda não existe: chega na rodada {round}. Nada foi feito.',
    'verb-unknown': 'Por enquanto existem /devkit change, /devkit roadmap, /devkit status, /devkit setup, /devkit project e /devkit train: digite /devkit change e o que você quer fazer, /devkit roadmap para rodar o roadmap, /devkit status para ver onde está tudo, /devkit setup para preparar este projeto ou atualizar a preparação, /devkit project e um nome para planejar um projeto ou uma fatia nova, ou /devkit train para mandar as changes embarcadas em um trem só.',
    'not-set-up': 'Este projeto ainda não está preparado para o devkit: digite /devkit setup primeiro. Nada foi executado.',
    'setup-no-repo': '/devkit setup roda dentro de um repositório git: abra a pasta do projeto, ou crie o repositório dele ali primeiro. Nada foi executado.',
    'setting-unknown': 'As configurações devkit do projeto têm {setting} desconhecido, "{value}"; use um de: {accepted}. Nada foi executado.',
    'setting-missing': 'As configurações devkit do projeto escolhem dois pull requests mas não dizem {setting}. Nada foi executado.',
    'train-model': 'As configurações devkit do projeto definem um trem de entrega, mas o modelo de entrega é two-prs: o trem só roda com trunk ou trunk-auto, porque two-prs entrega cada mudança em pull requests próprios. Nada foi executado.',
    'train-no-model': 'As configurações devkit do projeto definem um trem de entrega mas não escolhem um modelo de entrega: o trem só roda com o modelo de entrega trunk ou trunk-auto. Nada foi executado.',
    'test-branch-missing': 'Este projeto entrega com dois pull requests, mas a branch de teste {branch} não existe no remoto: crie-a lá e chame /devkit change de novo. Nada foi criado.',
    'base-not-default': 'Este projeto entrega em {base}, mas a branch padrão do repositório é {default}: elas precisam ser a mesma. Nada foi criado.',
    'name-test-suffix': '{id} não pode ser nome de change aqui: um nome terminado em -{branch} é reservado às branches de apoio.',
    'driver-not-built': 'Este projeto está configurado para rodar em {driver}, que ainda não existe (rodada {round}). Nada foi executado.',
    'driver-no-project': '/devkit project ainda não roda no CompozyOS; nada foi executado.',
    'compozy-started': '{id} roda agora no CompozyOS: acompanhe e responda às perguntas dela lá, em {url}.',
    'compozy-started-no-url': '{id} roda agora no CompozyOS (execução {run}): acompanhe e responda às perguntas dela lá.',
    'compozy-running': '{id} já roda no CompozyOS (execução {run}): acompanhe e responda às perguntas dela lá.',
    'compozy-not-installed': 'O CompozyOS não está instalado nesta máquina, então nada foi executado: instale com {fix} e chame /devkit de novo.',
    'compozy-stopped': 'O CompozyOS não está rodando, então nada foi executado: inicie com {fix} e chame /devkit de novo.',
    'compozy-workspace': 'Este projeto ainda não é um workspace do CompozyOS, então nada foi executado: registre com {fix} e chame /devkit de novo.',
    'compozy-kit-missing': 'O kit do devkit não está instalado no CompozyOS para este projeto, então nada foi executado: digite /devkit setup, responda sim ao kit e chame /devkit de novo.',
    'compozy-roadmap-started': 'O roadmap roda no CompozyOS com até {places} changes ao mesmo tempo: {url}.',
    'compozy-requests': '{n} perguntas esperam você no CompozyOS.',
    'nothing-to-resume': 'Não há change por terminar: digite /devkit change e o que você quer fazer.',
    choose: 'Há {n} changes por terminar: {list}. Qual delas eu continuo?',
    'ask-unfinished': 'Antes de começar: {list} está por terminar. Continuo essa change ou começo o seu novo pedido?',
    'ask-unfinished-many': 'Antes de começar: {list} estão por terminar. Continuo uma delas ou começo o seu novo pedido?',
    opened: 'Abri a change {id} no {script}, porque {why}. Agora vêm algumas perguntas sobre o seu pedido; para usar o {other}, é só dizer antes de o plano ser escrito.',
    'task-no-connector': 'Esta sessão não tem um conector do Jira, então não consigo ler {key}. Nada foi aberto: digite /devkit change e o que você quer fazer, com as suas palavras.',
    'task-unreadable': 'Não consegui ler a tarefa {key} no Jira: ela não foi encontrada, ou esta conta não a enxerga. Nada foi aberto: digite /devkit change e o que você quer fazer, com as suas palavras.',
    'task-taken': 'A tarefa {key} já tem a change não terminada {id}: digite /devkit change {key} para continuá-la. Nada foi aberto.',
    'opened-task': 'Li a tarefa {key} e abri a change {id} no {script}, porque {why}. Agora vêm algumas perguntas sobre o que a tarefa deixa em aberto; para usar o {other}, é só dizer antes de o plano ser escrito.',
    'write-back-ask': 'O pull request #{number} de {id} está aberto. Devo escrever o link dele na tarefa {key}? Responda uma destas: {choices}. Nada é escrito em {key} até você responder, e a entrega segue enquanto isso.',
    'choice.transition': 'mover para "{name}"',
    'choice.comment': 'só comentar',
    'choice.no': 'não',
    'write-back-commented': 'Escrevi o link do pull request #{number} em {key}.',
    'write-back-moved': 'Escrevi o link do pull request #{number} em {key} e movi a tarefa para "{name}".',
    'write-back-none': 'Nada foi escrito em {key}.',
    'write-back-late': 'A change {id} já foi arquivada, então nada foi escrito em {key}.',
    'write-back-unknown': 'Essa não é uma das opções que {key} tinha quando perguntei. Responda uma destas: {choices}.',
    'write-back-failed': 'O Jira não aceitou a escrita em {key} ({error}). Nada mais é tentado; você pode colocar o link na tarefa à mão.',
    'name-taken': 'Já existe uma change chamada {id}; vou escolher outro nome.',
    claimed: '{id} já está aberta em {machine}: não abri nada aqui. Continue lá, ou escolha outro nome.',
    'claimed-elsewhere': '{id} já está aberta em outra máquina: não abri nada aqui. Continue lá, ou escolha outro nome.',
    'opened-on': 'Abri a change {id} para {machine}, no {script}, porque {why}. As perguntas vêm na sessão dela lá.',
    'name-invalid': '{id} não serve como nome de change: use letras minúsculas, números e hífens.',
    resumed: 'Continuando a change {id}: {where}.',
    'script-switched': 'A change {id} passa para o {script}, porque {why}.',
    'script-locked': 'O plano de {id} já foi escrito, então o roteiro fica como está.',
    'flow-newer': 'Ela segue a versão {version} do fluxo do roteiro; a versão {installed} está instalada, e só muda para ela se você me pedir.',
    'flow-moved': 'A change {id} agora segue a versão {installed} do fluxo do roteiro; antes seguia a versão {version}.',
    'flow-ahead': 'A change {id} segue a versão {version} do fluxo do roteiro, mais nova que a versão instalada {installed}: atualize o devkit neste projeto antes de mudá-la.',
    'waiting-approval': 'O plano de {id} está escrito e revisado. Leia e me diga se aprova; eu sigo assim que você responder.',
    'waiting-approval-again': 'O plano de {id} mudou depois da sua aprovação, então precisa ser aprovado de novo.',
    'waiting-mockup': 'O mock-up de {id} está desenhado. Veja e me diga se aprova ou o que mudar; eu sigo assim que você responder.',
    'waiting-retro': 'A retro de {id} tem propostas para você: aprove ou recuse cada uma, e eu arquivo a change.',
    'waiting-merge': 'O pull request #{number} de {id} está pronto: neste projeto, o merge é com você.',
    'waiting-archive-merge': 'O pull request de arquivo #{number} de {id} está pronto: neste projeto, o merge é com você.',
    'waiting-merge-test-branch': 'O pull request #{number} de {id} para {branch} está pronto: neste projeto, o merge é com você. O pull request para {base} espera por ele.',
    'waiting-merge-base': 'O pull request #{number} de {id} para {base} está pronto: neste projeto, o merge é com você.',
    'waiting-archive-merges': 'Os pull requests de arquivo de {id} estão prontos: {list}. Neste projeto, o merge deles é com você.',
    'waiting-train': '{id} está embarcada: ela sai com o próximo trem, que o /devkit train despacha.',
    'train-off': 'Este projeto não tem trem de entrega: devkit.delivery.train nas configurações devkit do projeto o liga. Nada foi criado.',
    'train-running': 'Um trem está saindo agora, então um segundo não começa. Se nenhuma saída estiver rodando (uma sessão acabou no meio de uma), apague o arquivo de trava ({where}) ou espere: depois de seis horas uma nova saída assume a trava.',
    'train-nothing': 'Não há nada embarcado: nenhuma change nem arquivamento espera por um trem. Nada foi criado.',
    'train-blocked': 'O trem parou: {error}. Nada mais roda até isso ser resolvido.',
    'train-base-red': 'A suíte falha em {base} sozinha, então nenhum trem sai e nenhuma change foi tirada: conserte {base} primeiro.',
    'train-checks': 'O trem {n} (pull request #{number}) espera o GitHub terminar as verificações. Continuo esperando e sigo sozinho quando terminarem.',
    'train-auto-merge-on': 'O merge automático está ligado no pull request #{number} do trem {n}: o GitHub faz o merge assim que as verificações passarem.',
    'train-ready': 'O pull request #{number} do trem {n} está pronto: neste projeto, fazer o merge é com você, com um commit de merge.',
    'train-delivered': 'O trem {n} entrou no pull request #{number}: as changes dele estão entregues, e o que ele deixou para trás está sendo arrumado agora.',
    'train-args': '/devkit train não aceita nada depois dele: digite /devkit train sozinho. Nada foi iniciado.',
    'waiting-review-dispute': 'A revisão de código de {id} ainda discorda depois da segunda rodada: os pontos em disputa precisam da sua decisão.',
    'waiting-by-hand': 'Este projeto entrega cada change à mão: {id} para aqui, e a sessão não escreve código para ela.',
    'waiting-unrun-stage': '{Stage} de {id} tem um arquivo inacabado que nenhum papel desta versão consegue terminar: diga o resultado ou remova o arquivo.',
    'waiting-pr-decision': 'Um comentário no pull request de {id} pede uma decisão que só você pode tomar: {url}.',
    'waiting-place': '{id} espera um lugar livre em {machine} ({taken} de {places} ocupados): segue quando um liberar, e a sessão do roadmap avisa.',
    'waiting-budget': 'A change {id} atingiu o orçamento de tokens: {spent} tokens gastos, e o limite é {cap}. Para seguir, aumente budget no bloco devkit de {file} e digite /devkit change de novo.',
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
    'roadmap-session-opened': '{id} está aberta numa sessão própria; o grill dela é feito aqui.',
    'roadmap-check-refused': 'O app recusou a verificação periódica desta rodada: ela segue sem uma.',
    'roadmap-check-idle': '{id} tem uma vaga, mas a sessão dela não está vigiando: escreva qualquer mensagem nela.',
    'roadmap-check-stopped-waits': '{n} esperas da rodada foram paradas: as changes delas não precisam mais delas.',
    'roadmap-check-session-archived': 'A sessão de {id} foi arquivada.',
    'roadmap-check-archive-later': 'A sessão de {id} ainda não foi arquivada: ela ainda trabalha ou espera a sua aprovação; tento de novo depois.',
    'push-failed': 'Não foi possível enviar o branch de {id}: {error}. Tento de novo numa próxima decisão.',
    'roadmap-session-started-on': 'Comecei {id} em {machine}, numa sessão própria.',
    'roadmap-waits-turn-on': '{id} está aberta para {machine} e começa numa sessão própria lá na sua próxima mensagem: o app só abre sessão num turno que você digitou.',
    'roadmap-woken': 'Liberou um lugar em {machine}: avisei {id} para seguir.',
    'roadmap-machine-silent': '{machine} não responde: nenhuma change nova vai para lá, e as changes dela mantêm os lugares.',
    'roadmap-waits-refused': '{id} não pôde começar numa sessão própria: o app recusou. Ela começa na sua próxima mensagem.',
    'session-held-owner': '{id}: {gate} é perguntada na sessão do roadmap; esta sessão segue assim que for respondida.',
    'session-held-place': '{id} espera uma vaga: {places} changes estão em construção.',
    'session-held-load': '{id} espera: o processador está em {load}% (limite {limit}%).',
    'session-held-after': '{id} espera {after} ser arquivada antes do plano.',
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
    'gate.train': 'a saída do próximo trem',
    'gate.decision': 'uma decisão que só você pode tomar',
    'gate.dispute': 'a sua decisão sobre os pontos em disputa da revisão',
    'gate.stage': 'o resultado de um arquivo inacabado',
    'gate.by-hand': 'a sua entrega à mão',
    'gate.budget': 'um orçamento de tokens maior',
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
    'queue.held-place': 'aberta, espera uma vaga',
    'queue.held-load': 'aberta, segurada pela carga',
    'queue.held-after': 'aberta, espera {after}',
    'queue.no-machine': 'pronta, nenhuma máquina pode recebê-la agora (esta está carregada, as outras não respondem)',
    'machines-unreadable': 'A configuração de máquinas não é uma lista que eu consiga ler. Escreva assim: [{"host": "avel", "folder": "/home/eu/repo", "places": 2}]. Nada foi iniciado.',
    'machine-incomplete': 'A máquina {entry} na configuração de máquinas não tem {field} válido. Nada foi iniciado.',
    'machine-duplicate': 'A máquina {entry} aparece duas vezes na configuração de máquinas. Nada foi iniciado.',
    'checkout-failed': 'Não consegui criar a pasta de {id} em {machine}: {error}.',
    'status-count-machines': 'Roadmap: {open} abertas · {queue} na fila · {archived} arquivadas',
    'status-machines': 'Máquinas',
    'status-claims-unreadable': 'Não consegui ler o GitHub: as changes abertas em outras máquinas não aparecem.',
    'machine.row': '{taken} de {places} lugares ocupados · {open} abertas',
    'machine.this': '{name} (esta)',
    'machine.no-answer': 'sem resposta',
    'machine.unknown': 'outra máquina',
    'remote.open': 'aberta em {machine}',
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
    'blocked-why.ceiling': '{stage} chegou ao limite de falhas seguidas ({failures})',
    'blocked-why.no-progress': '{stage} voltou sem nada ter mudado',
    'blocked-why.no-place': 'espera um lugar livre em {machine} ({taken} de {places} ocupados)',
    'blocked-why.not-delivered': '{stage} terminou sem entregar o resultado',
    'blocked-why.github-unreadable': 'não foi possível ler o GitHub ({error})',
    'blocked-why.gh-too-old': 'o gh instalado ({installed}) não consegue ler os checks do pull request, que exigem a versão {minimum} ou mais nova: atualize o gh e chame /devkit {verb} {id} de novo',
    'blocked-why.pr-closed': 'o pull request #{number} foi fechado sem merge',
    'blocked-why.previous-script': 'ela começou no roteiro anterior; termine-a com /ship-change {id}',
    'blocked-why.not-opened': 'a pasta dela está incompleta',
    'blocked-why.tests-red': 'os testes da fase {phase} falharam',
    'blocked-why.role-failed': '{stage} não conseguiu terminar o trabalho',
    'blocked-why.wrong-branch': 'a pasta dela está num branch com outro nome',
    'blocked-why.merge-setup': 'o repositório ainda não está preparado para o merge automático, que a etapa do GitHub de /devkit setup prepara',
    'blocked-why.archive-failed': 'um passo do arquivamento falhou',
    'blocked-why.tag-elsewhere': 'a tag {tag} já está no remoto em {at}, não no commit do merge {sha}; a execução nunca move uma tag, então quem resolve é você',
    'blocked-why.plan-not-approved': 'a revisão do plano dela não está aprovada',
    'blocked-why.pr-problem': 'o pull request tem um problema que a sessão não resolve sozinha',
    'blocked-why.unknown-step': 'o próximo passo é um que esta versão não conhece',
    'blocked-why.unreadable': 'não foi possível ler a change ({error})',
    'blocked-why.cannot-open': 'não foi possível abrir ({error})',
    'blocked-why.cannot-check-out': 'a pasta dela não pôde ser criada em {machine} ({error})',
    'gh-version-unknown': 'versão desconhecida',
    'blocked-why.cannot-accept': 'não foi possível marcar os registros de decisão como aceitos ({error})',
    'blocked-why.merge-defect': 'o merge da base em {sha} deixou o plano falhando na verificação {attempt} vezes seguidas; corrija o plano à mão e retome',
    'blocked-why.merge-check-failed': 'a verificação do plano após o merge da base não pôde rodar ({error})',
    'blocked-why.open-failed': 'a execução não conseguiu abri-la; comece de novo pelo Claude Code com o pedido dela, /devkit change <pedido>',
    'blocked-why.base-conflict': 'não foi possível mesclar o branch padrão nela: {error}',
    'what.checks': 'os checks do pull request',
    'what.merge': 'o merge do pull request',
    'what.archive-merge': 'o merge do pull request de arquivo',
    'what.train': 'o pull request do trem dela',
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
    'setting.delivery-model': 'modelo de entrega',
    'setting.delivery-base': 'a branch base',
    'setting.delivery-test-branch': 'a branch de teste',
    'setting.delivery-train': 'trem de entrega',
    'setting.budget': 'budget',
    'setting.model-stage': 'etapa citada na tabela de modelos',
    'setting.model-value': 'modelo de uma etapa',
    'setting.coverage-target': 'meta de cobertura',
    'setting.release-tag': 'arquivo da versão',
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
    'design-pack-missing': 'O fluxo de projeto precisa do pacote devkit-design neste projeto: digite /devkit setup, ative o pacote devkit-design e chame /devkit project de novo. Nada foi executado.',
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
    'slice-machine': 'Máquina: {machine}',
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
    'blocked-why.merge-setup-missing': 'o repositório ainda não está preparado para o merge automático ({list}), que a etapa do GitHub de /devkit setup prepara',
    'blocked-why.branch-conflict': 'o pull request #{number} tem conflito com {base}: resolva o conflito no branch da fatia e chame /devkit project {id} de novo',
    'blocked-why.archive-refused': 'a fatia ainda não pode ser arquivada: {list} não resolvidas',
    'blocked-why.undeclared-stage': 'o fluxo pediu {stage}, que este roteiro de projeto não declara',
    ...SPEND_MESSAGES['pt-BR'],
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
    if (name === 'failures') return String(params.failures ?? need('attempt'));
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
  'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand', 'waiting-mockup': 'mockup', 'waiting-budget': 'budget',
  'waiting-merge-test-branch': 'merge', 'waiting-merge-base': 'merge', 'waiting-archive-merges': 'merge', 'waiting-train': 'train',
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

// What a new coordinating session keeps of the run file: what outlives the session that started it (D-1, D-9; `placed` is the changes opened for another machine, remote-worker D-8).
export const OUTLIVES = ['startedSessions', 'tickets', 'occupied', 'placed', 'queued', 'waits'];

// The run file's shape and its reading live in run-file.mjs (remote-worker D-9); this module and its callers read them from here.
export { emptyRun, readRun, runFilePath };

// ---------------------------------------------------------------- the stage icon (roadmap-coordinator-followups D-5)

// The icon of the stage an action is in, for the title of a change session: ❓ requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery,
// 📦 retro and archive, ⏳ a change waiting for a free place. An archived end is the archive's; a stage the table does not name, or none, has no icon.
// The icon of a change session that waits (for a place, the load or a dependency), in place of its stage's (roadmap-sessions-upfront D-11).
export const WAIT_ICON = '⏳';
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
  if (action?.kind === 'end' && action.end?.why === 'no-place') return '⏳';
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

// The reasons of a change session that is held (a state `running`): the message key of each one's phrase (roadmap-sessions-upfront D-11).
export const HELD_TEXT = { 'held-place': 'queue.held-place', 'held-load': 'queue.held-load', 'held-after': 'queue.held-after' };

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
    queued: run.queued?.[id] ?? null,
    occupied: Boolean(run.occupied?.[id]),
    waitsFor: run.waitsFor?.[id] ?? null,
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

// S9: the reason a running change session is held for, from the facts: the queue entry (the load, else a place) of a change with no place, else a
// dependency not archived; null when it is not held.
function heldReason(facts) {
  if (facts.queued && !facts.occupied) return facts.queued.why === 'load' ? 'held-load' : 'held-place';
  return facts.waitsFor ? 'held-after' : null;
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
    if (sessionMode && done.state === 'running' && (!done.reason || done.reason.code === 'ready')) { // S9: held for a place, the load or a dependency
      const held = heldReason(facts);
      if (held) done = { state: 'running', reason: { code: held, text: render(l, HELD_TEXT[held], { after: facts.waitsFor }) } };
    }
  }
  const { state, reason } = done;
  const icon = stage === (action?.stage ?? null) ? stageIcon(action) : stageIcon({ stage });
  const held = state === 'running' && Object.hasOwn(HELD_TEXT, reason?.code ?? '');
  // A change waiting for a free place on its machine (remote-worker AC-10) is not stopped: its stage icon is the ⏳, and no ⛔ goes before it.
  const stateIcon = held ? WAIT_ICON : reason?.code === 'no-place' ? null : STATE_ICON[state] ?? null;
  let title;
  if (state === 'archived') title = sessionTitle('📦', id);
  else if (held) title = sessionTitle(WAIT_ICON, id);
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

// The steps that wait on the pull request of a delivery train (delivery-train D-2).
const TRAIN_WAITS = ['on-train', 'wait-train'];

// The brief of `rejoin-train` (delivery-train D-7): the change left a train; its own cycle merges the base and fixes what the record says.
const rejoinBrief = (detail) => `train ${detail.train} took this change off (${detail.why === 'red' ? 'the suite failed with it' : 'it conflicts with the train'}): `
  + `merge origin/${detail.base} into the branch with \`node release-merge.mjs --base ${detail.base}\` when only release files conflict, else with \`git merge origin/${detail.base}\`, `
  + `and ${detail.why === 'red' ? 'fix the failure below' : `resolve ${(detail.paths ?? []).join(', ')}`}, test first; the record says ${JSON.stringify({ why: detail.why, paths: detail.paths, failure: detail.failure })}`;

const detailOf = (next) => {
  const { actor, agent, askable, blockedState, ...rest } = next; // eslint-disable-line no-unused-vars
  return rest;
};

// How each step of the delivery checker (and the override of conduct-check) is handled: the stage it belongs to
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
  'rejoin-train': handOff('implementation', 'tdd-implementer'),
  'renumber-adr': handOff('implementation', 'tdd-implementer'),
  commit: handOff('delivery', 'commit-and-pr'),
  'open-pr': handOff('delivery', 'commit-and-pr'),
  push: handOff('delivery', 'commit-and-pr'),
  'open-archive-pr': handOff('delivery', 'commit-and-pr'),
  'open-prs': handOff('delivery', 'commit-and-pr'),
  'open-test-pr': handOff('delivery', 'commit-and-pr'),
  'push-support': handOff('delivery', 'commit-and-pr'),
  'move-test-pr': handOff('delivery', 'commit-and-pr'),
  'open-test-archive-pr': handOff('delivery', 'commit-and-pr'),
  'resolve-support-conflict': handOff('implementation', 'tdd-implementer'),
  'fix-resolution': handOff('implementation', 'tdd-implementer'),
  verify: handOff('evidence', 'pr-verifier'),
  review: session('review'),
  'rerun-checks': session('delivery'),
  'checkout-support': session('delivery'),
  'merge-into-support': session('delivery'),
  'review-resolution': session('review'),
  gate: session('implementation'),
  'edit-pr-body': session('delivery'),
  'enable-auto-merge': session('delivery'),
  'disable-auto-merge': session('delivery'),
  'update-branch': session('delivery'),
  answer: session('delivery'),
  retro: session('retro'),
  archive: session('retro'),
  'tick-roadmap': session('retro'),
  'rejoin-archive': session('delivery'),
  'close-boarded-pr': session('delivery'),
  'tag-release': session('delivery'),
  'wait-checks': { end: 'github' },
  'wait-merge': { end: 'github' },
  'on-train': { end: 'github' },
  'wait-train': { end: 'github' },
  boarded: { end: 'owner' },
  ready: { end: 'owner' },
  'archive-pr-ready': { end: 'owner' },
  'archive-prs-ready': { end: 'owner' },
  'ready-test-branch': { end: 'owner' },
  'ready-base': { end: 'owner' },
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
// The steps before which the loop checks the plan after a merge of the base (post-merge-validate D-4): the evidence and the review, and
// every delivery step that pushes or waits on the change's pull requests. Not the implementation rows, `commit`, `disable-auto-merge`,
// the support-branch session rows, the ends that are blocked or archived, nor anything on the archive branch.
const CHECK_BEFORE = ['verify', 'review', 'push', 'open-pr', 'open-prs', 'open-test-pr', 'push-support', 'move-test-pr',
  'edit-pr-body', 'enable-auto-merge', 'update-branch', 'rerun-checks', 'wait-checks', 'wait-merge', 'ready',
  'ready-test-branch', 'ready-base'];
const AGENT_STEPS = ROW_STEPS.filter((s) => ROWS[s].role);
const BLOCKED_STEP = { 'stop-branch': 'wrong-branch', 'stop-merge-setup': 'merge-setup', 'stop-archive': 'archive-failed', 'stop-not-approved': 'plan-not-approved', blocked: 'pr-problem' };
const OWNER_STEP = {
  ready: 'waiting-merge', 'archive-pr-ready': 'waiting-archive-merge', 'archive-prs-ready': 'waiting-archive-merges', 'stop-review-deadlock': 'waiting-review-dispute',
  'ready-test-branch': 'waiting-merge-test-branch', 'ready-base': 'waiting-merge-base', boarded: 'waiting-train',
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

// ---------------------------------------------------------------- the triage's source check (roadmap-sessions-upfront D-4)

const TRIAGE_HEADING = /^### Answered by triage[ \t]*$/;
const SECTION_END = /^#{1,3}[ \t]/;
const FENCE = /^(`{3,}|~{3,})/;
const ITEM = /^(?:[-*+]|\d+[.)])[ \t]+(.*)$/;

// The one reader of the section `### Answered by triage` of a requirements file (D-4, review round 1 architecture F2): null when no line outside a fenced
// block is that heading (a heading with words after it, or at another level or indentation, is none), else the section's items, each as its text with the
// marker removed and its indented lines joined by a space; an empty section gives []. The section runs to the next heading of level 1 to 3 or to the end of
// the file; a line inside a fenced block (three or more backticks or tildes) is no heading and no item, an unclosed fence running to the end; an item
// continues over its indented lines up to a blank or an unindented one (precedent: `classificationFlags` reads the grill's classification line the same way).
export function triageSection(text) {
  const items = [];
  let inSection = false;
  let fence = null;
  let open = null;
  const close = () => { if (open) items.push(open); open = null; };
  for (const line of String(text).split('\n')) {
    const mark = FENCE.exec(line.trimStart())?.[1];
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length && line.trim() === mark) fence = null;
      continue;
    }
    if (mark) { close(); fence = mark; continue; }
    if (!inSection) {
      inSection = TRIAGE_HEADING.test(line);
      continue;
    }
    if (SECTION_END.test(line)) break;
    const item = ITEM.exec(line);
    if (item) { close(); open = item[1].trim(); continue; }
    if (open !== null && /^[ \t]+\S/.test(line)) { open = `${open} ${line.trim()}`; continue; }
    close();
  }
  close();
  return inSection ? items : null;
}

// True when the text holds the triage section (`triageSection` is not null): the loop and the periodic check ask the same reader.
export const hasTriageSection = (text) => triageSection(text) !== null;

// The items of the triage section that name no `(source: `; [] when there is no section or it is empty.
export function triageUnsourced(text) {
  return (triageSection(text) ?? []).filter((i) => !i.includes('(source: '));
}

// `triageUnsourced` over the change's requirements.md; [] when there is none or it cannot be read.
function triageUnsourcedOf(dir) {
  try { return triageUnsourced(readFileSync(join(dir, 'requirements.md'), 'utf8')); } catch { return []; }
}

// facts: { ctx: { id, script, root, branch, lang, filesLanguage }, flow, report (flow-check's), after, fingerprint,
// approval (deliver-check's approvalState), tests (flow-check's readTestSettings), decisions (`decisionRecords`'s result),
// hasProposal, flags (the grill's classification), archiving, row
// (conduct-check's deliveryRow result, `{ error }` when it threw, null when not read), mergeCheck ({ base, merge, record }: the merge of the
// base the branch holds and the record of its check, `readMergeCheck`'s result; null when no merge is to be checked), place (the place facts of D-9, { machine, places,
// taken, held }, null when the change records no places), budget ({ cap, file, spent } with `spent`
// null when it could not be read; null or absent when no cap applies), models (the model of each stage, `modelsOf`'s result: every
// action at a stage with a row carries its `model`; absent, none does), handOffs (the session's stage subagents of the current run,
// `handOffsOf`'s result: a hand-off whose newest run failed is handed once more a model up; null or absent when none was read) }.
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
    const model = s ? facts.models?.[id] : undefined; // the stage's model (stage-models D-3): none for a stage with no row, or when no table is given
    return { stage: s ? id : null, stageTitle: s ? s.title[lang] : null, role: s?.role ?? null, skills: s?.skills ?? [], ...(model ? { model } : {}) };
  };
  const finish = (state, why, key, params, stageId, detail) => ({
    ...base, kind: 'end', ...stageFields(stageId), end: { state, why }, params: { id: ctx.id, ...params }, ...(detail ? { detail } : {}), reply: say(key, params),
  });
  const blocked = (why, params = {}, stageId = null, detail) => finish('blocked', why, 'blocked', { why, ...params }, stageId, detail);
  const waiting = (state, key, stageId, params = {}, detail) => finish(state, key, key, params, stageId, detail);

  const key = (stage, step) => `${stage}/${step ?? stage}@${facts.fingerprint}`;
  // A hand-off whose detail names a worktree and a branch (the support branch's) works there, not in the task worktree.
  const brief = (stage, what, detail) => {
    const root = detail?.root && detail?.branch ? detail.root : ctx.root;
    const branch = detail?.root && detail?.branch ? detail.branch : ctx.branch;
    return `Change ${ctx.id} (${ctx.script} script), stage ${stage}: ${what}. Work only in ${root} on branch ${branch}; `
      + `every file path is absolute under it; start every Bash command with cd ${root} && ; do not fetch. `
      + `Write the change's files in ${filesLanguageName(ctx.filesLanguage)}.`;
  };

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
  // The token budget (change-budget D-4): at or above the cap, a hand-off or a session step becomes an end waiting for the owner,
  // after `guard`, so a no-progress or not-delivered end still comes first. A spend that could not be read holds nothing.
  const hold = (action) => {
    const b = facts.budget;
    if (!b || b.spent === null || b.spent < b.cap || (action.kind !== 'agent' && action.kind !== 'session')) return action;
    return waiting('waiting-for-owner', 'waiting-budget', action.stage, { spent: b.spent, cap: b.cap, file: b.file },
      { held: { kind: action.kind, stage: action.stage, step: action.step ?? null, agent: action.agent ?? null } });
  };
  // The agent of a delivery hand-off is the checker's row's (`conduct-check`'s actorOf owns the fact); the role's map only
  // when the row names none, and for the plan stages, which have no row.
  const agent = (stage, role, step, what, detail, named) => {
    const id = named ?? AGENT[role];
    const action = {
      ...base, kind: 'agent', ...stageFields(stage), agent: id, ...(step ? { step } : {}), ...(detail ? { detail } : {}),
      brief: withAttribution(id, brief(stage, what, detail)), progressKey: key(stage, step),
    };
    const again = retried(action);
    return again ? hold(again) : hold(guard(action));
  };
  // The retry (stage-models D-5), before `guard` so the progress key the session passes after a failure gives the retry and not a
  // no-progress end: null when the newest run of this brief did not fail; the same hand-off a model up, marked, after one failure
  // that was not on Opus; else the end blocked, after a second failure in a row or a failure on Opus.
  const retried = (action) => {
    const handKey = handOffKey(action.brief);
    const runs = handKey === null ? [] : (facts.handOffs ?? []).filter((r) => r.key === handKey);
    let failures = 0;
    while (failures < runs.length && runs[runs.length - 1 - failures].failed) failures += 1;
    if (failures === 0) return null;
    const from = runs[runs.length - 1].family ?? (action.model ? familyOf(action.model) : null);
    const up = oneUp(from);
    if (failures === 1 && up !== null) return { ...action, model: action.model?.endsWith('[1m]') ? `${up}[1m]` : up, retry: { failedOn: from, attempt: 2 } };
    return blocked('role-failed', { stage: titleOf(action.stage) }, action.stage);
  };
  const sessionAction = (stage, step, detail, extra = {}) => hold(guard({
    ...base, kind: 'session', ...stageFields(stage), step, ...(detail ? { detail } : {}), ...extra, progressKey: key(stage, step),
  }));

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
    // The grill names the helpers of the requirements stage of the flow the change follows: the triage is offered only to a change whose flow lists it (design D-17).
    const helpers = stageById('requirements')?.helpers ?? [];
    if (n?.stage === 'requirements' || (e?.state === 'waiting-for-owner' && e.stage === 'requirements')) {
      return { ...base, kind: 'grill', ...stageFields('requirements'), helpers, progressKey: key('requirements') };
    }
    // A triage answer with no source goes back to the grill, which asks the owner that question (design D-4).
    const unsourced = facts.unsourced ?? [];
    if (unsourced.length && report.stages.find((x) => x.id === 'requirements')?.state === 'passed') {
      return { ...base, kind: 'grill', ...stageFields('requirements'), helpers, progressKey: key('requirements'), detail: { unsourced } };
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
        const failures = n.params.failures ?? attempt;
        return agent(n.stage, s.role, null, `${failed} failed at attempt ${attempt} (failures in a row: ${failures} of ${ceiling}): revise the plan from its findings`);
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
      const failures = n.params.failures ?? attempt;
      const file = stageById(failed)?.file ?? null;
      return agent('implementation', 'tdd-implementer', 'fix-tests', `${failed} failed at attempt ${attempt} (failures in a row: ${failures} of ${ceiling}): fix the code from ${file}, test first, within the approved tasks`, { failed, file });
    }
    return null;
  }

  // P9 and B0: a blocked end of the stage checker, in plain words.
  function blockedEnd(e) {
    if (githubSilent(e)) return waiting('waiting-on-github', 'waiting-github', e.stage, { what: 'silent' }, { error: e.params?.error ?? '' });
    const why = BLOCKED_OF[e.reasonCode] ?? 'role-failed';
    const stageId = e.params?.stage ?? e.stage;
    const params = { stage: titleOf(stageId), attempt: e.params?.attempt, failures: e.params?.failures, error: e.params?.error ?? '', number: e.params?.number };
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
    // D-9: a change that records its places takes one before its first implementation step.
    const place = facts.place;
    if (place && !place.taken && spec.stage === 'implementation') {
      if (place.held >= place.places) return finish('blocked', 'no-place', 'waiting-place', { machine: place.machine, taken: place.held, places: place.places }, 'implementation');
      return sessionAction('implementation', 'take-place', { command: ['node', join(HOOKS_DIR, 'change-loop.mjs'), 'place', ctx.id, '--lang', lang] });
    }
    // post-merge-validate D-4: after a merge of the base the plan is checked before the evidence and before any push or wait. A red check
    // goes to the planner with no stage attempt spent (the loop's own count of reds, `reds`, ends it); a check that could not run ends it.
    const mc = facts.mergeCheck;
    if (mc?.merge && CHECK_BEFORE.includes(step) && !facts.archiving && stageById('evidence')) {
      const rec = mc.record?.merge === mc.merge ? mc.record : null;
      if (rec?.result !== 'green') {
        const ceiling = flow.ceilings?.default ?? 3;
        if (rec?.result === 'cannot-run' && facts.after === key('evidence', 'merge-check')) {
          return blocked('merge-check-failed', { error: rec.error }, 'evidence');
        }
        if (rec?.result === 'red' && rec.fingerprint === facts.fingerprint) {
          if (rec.reds >= ceiling) return blocked('merge-defect', { sha: rec.merge.slice(0, 7), attempt: rec.reds }, 'evidence');
          const what = `merge defect: the merge of origin/${mc.base} at ${rec.merge.slice(0, 7)} left \`openspec validate ${ctx.id} --type change --strict\` failing (red check ${rec.reds} of ${ceiling}). Its errors:\n${rec.errors}\n`
            + `Fix only what the errors name, in this change's plan files under openspec/changes/${ctx.id}/ (proposal.md, design.md, tasks.md, specs/): where the base changed a requirement that a delta modifies, copy the base's requirement text and every one of its scenarios into the delta verbatim, then apply the change's own edits to it again. `
            + `Leave every stage header line and every task checkbox exactly as they are, change no file outside openspec/changes/${ctx.id}/, and finish when \`openspec validate ${ctx.id} --type change --strict\` passes`;
          return agent('specs', 'change-planner', 'merge-defect', what, { base: mc.base, merge: mc.merge, reds: rec.reds, ceiling, errors: rec.errors });
        }
        return sessionAction('evidence', 'merge-check', { command: ['node', join(HOOKS_DIR, 'change-loop.mjs'), 'merge-check', ctx.id, '--lang', lang], merge: mc.merge, base: mc.base });
      }
    }
    const detail = detailOf(row.next);
    if (spec.role) return agent(spec.stage, spec.role, step, step === 'rejoin-train' ? rejoinBrief(detail) : `step ${step} ${JSON.stringify(detail)}`, detail, row.next.agent);
    if (spec.session) return sessionAction(spec.stage, step, detail);
    // A tag on the remote at another commit is the owner's to settle; every other stop of the archive stays `archive-failed`.
    if (step === 'stop-archive' && row.next.archiveStep === 'tag-release' && row.next.at) {
      return blocked('tag-elsewhere', { tag: row.next.tag, at: String(row.next.at).slice(0, 7), sha: String(row.next.sha).slice(0, 7) }, currentId);
    }
    switch (spec.end) {
      case 'github': return waiting('waiting-on-github', 'waiting-github', currentId, { what: step === 'wait-checks' ? 'checks' : TRAIN_WAITS.includes(step) ? 'train' : facts.archiving ? 'archive-merge' : 'merge' });
      case 'blocked': return blocked(BLOCKED_STEP[step], {}, currentId);
      case 'archived': return finish('archived', 'archived', 'archived', {}, currentId);
      default: break;
    }
    if (step === 'stop-plan-approval') {
      const again = facts.approval?.status === 'APPROVED' && Boolean(facts.approval.recorded);
      return waiting('waiting-for-owner', again ? 'waiting-approval-again' : 'waiting-approval', currentId, {}, { readiness: facts.approval?.readiness ?? row.next.readiness ?? null });
    }
    const number = row.next.number ?? row.delivered?.next?.number;
    const named = Object.fromEntries(['branch', 'base', 'list'].filter((k) => row.next[k] !== undefined).map((k) => [k, row.next[k]]));
    return waiting('waiting-for-owner', OWNER_STEP[step], currentId, number === undefined ? named : { number, ...named });
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

// The newest merge commit on the first-parent line of HEAD that `ref` (origin/<base>) does not hold, or `null` (post-merge-validate D-1).
// Every merge on the branch's own line counts whatever its second parent: a local merge of the base, the one release-merge commits and
// GitHub's "update branch" that `git pull --ff-only` brings in. Once the pull request is merged into `ref`, its merges are reachable from it.
export function baseMergeOf(root, ref) {
  if (!tryGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return null;
  return tryGit(root, ['rev-list', '--first-parent', '--merges', '-n', '1', 'HEAD', `^${ref}`]) || null;
}

// The checkout of change `id`: a worktree on its archive branch, else one on its own branch, else the checkout the loop is
// called from when that checkout holds the change's active folder and the main checkout holds no folder of it (state-skips-unlocated
// D-5), else the main checkout.
export function locate(start, id) {
  const worktrees = listWorktrees(start);
  const own = worktrees.find((w) => w.branch === `chore/archive-${id}`) ?? worktrees.find((w) => w.branch === id);
  if (own) return { root: realpathSync(own.path), branch: own.branch };
  const root = mainRoot(start);
  const here = realpathSync(start);
  if (here !== realpathSync(root) && locateChange(here, id)?.archived === false && !locateChange(root, id)) {
    return { root: here, branch: tryGit(here, ['symbolic-ref', '--short', '-q', 'HEAD']) };
  }
  return { root, branch: tryGit(root, ['symbolic-ref', '--short', '-q', 'HEAD']) };
}

// The stages of the plan part a change does not write before its dependencies are archived: the others are the owner's or come after.
export const PLAN_NOT_HELD = ['requirements', 'approval'];

// The part of `stage` in the flow the change at `found` follows (its pin); null when the flow cannot be read or does not hold it.
export function partOfStage(found, id, stage) {
  if (typeof stage !== 'string') return null;
  try {
    const dir = locateChange(found.root, id)?.dir ?? join(found.root, 'openspec', 'changes', id);
    return changeFlow(found.root, dir).flow?.stages.find((s) => s.id === stage)?.part ?? null;
  } catch { return null; }
}

// Whether the action is a stage of the plan part that waits for the change's dependencies (the one reader of `sessionFacts`, the board and the state command).
export function isPlanStage(start, id, action) {
  if (!(action?.kind === 'agent' || action?.kind === 'session') || PLAN_NOT_HELD.includes(action.stage)) return false;
  try { return partOfStage(locate(start, id), id, action.stage) === 'plan'; } catch { return false; }
}

// The next action of change `id`, read from the files, git and GitHub of its checkout. Errors (an unknown change, an
// unreadable setting, no openspec CLI) are thrown; a delivery checker that throws becomes the `unreadable` end.
export function nextAction(cwd, id, { env = process.env, lang = 'pt-BR', after = null, openspec, gh, claims, budget = false, strictModels = false, retry = false, handOffs } = {}) {
  const clean = cleanOf(env);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = locate(start, id);
  const settings = readDevkitSettings(found.root);
  const filesLanguage = settings.unknown.some((u) => u.setting === 'language') ? 'en' : settings.language;
  const dir = locateChange(found.root, id)?.dir ?? join(found.root, 'openspec', 'changes', id);
  // The model of each stage: refused when it is bad in the change's own loop (`next`), ignored when bad everywhere else (stage-models D-2).
  const models = modelsOf(found.root, dir, { strict: strictModels, lang: normalizeLang(lang) });
  // The token budget is read only when the caller asks (`next`, and `session-next` of a change session): the locks, `wait` and the roadmap never count (change-budget D-4).
  let budgetFact = null;
  if (budget) {
    const cap = budgetOf(found.root, dir, normalizeLang(lang));
    if (cap) {
      const path = sessionTranscript(env);
      budgetFact = { cap: cap.cap, file: cap.file, spent: path ? spentOf(path, id)?.spent ?? null : null };
    }
  }
  // The stage hand-offs of the current run, read only when the caller hands a list or asks to retry (`next`): a lock, `wait` and the
  // board read none (stage-models D-5).
  let handOffsFact = null;
  if (handOffs) handOffsFact = handOffs;
  else if (retry) {
    const path = sessionTranscript(env);
    if (path) handOffsFact = handOffsOf(path, typedSince(path));
  }
  const run = openspec ?? makeOpenspec(found.root, clean);
  const { facts, flow } = collectFlow(found.root, id, { env: clean, openspec: run, ...(gh ? { gh } : {}) });
  const report = computeFlow(facts, flow, {});
  const archiving = found.branch === `chore/archive-${id}`;
  let row = null;
  let deliveredPr = null;
  const baseBranch = defaultBase(found.root);
  if (inDelivery(report, flow, archiving)) {
    try {
      const ghRun = gh ?? makeGh(found.root, clean);
      const state = collectState(found.root, id, { env: clean, gh: ghRun });
      const delivered = buildReport(state, clean);
      deliveredPr = delivered.pr ?? null;
      row = deliveryRow({ ref: `origin/${baseBranch}`, base: baseBranch }, { id, worktree: found.root }, { state, report: delivered });
    } catch (e) {
      row = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  // The merge of the base the branch holds and the record of its check (post-merge-validate D-5): read only in the delivery part.
  const mergeCheck = row && row.error === undefined && !archiving && flow?.stages.some((s) => s.id === 'evidence')
    ? { base: baseBranch, merge: baseMergeOf(found.root, `origin/${baseBranch}`), record: readMergeCheck(mergeCheckFile(found.root, id), id) }
    : null;
  const place = row && row.error === undefined && !archiving && ROWS[row.next?.step]?.stage === 'implementation'
    ? placeFacts(found, id, dir, { env: clean, gh, claims }) : null;
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
    unsourced: triageUnsourcedOf(dir),
    archiving,
    row,
    mergeCheck,
    place,
    budget: budgetFact,
    models,
    handOffs: handOffsFact,
  });
  // The icon of the action's stage, its state and the change session's title for it (change-state D-1, D-5); the title only when the state has one.
  action.icon = stageIcon(action);
  action.state = changeState(action, null, { lang });
  if (action.state.title !== null) action.sessionTitle = action.state.title;
  // The Jira task the change records, and the write-back question the developer is still owed (jira-entry D-6).
  const task = recordedTask(readRequirements({ root: found.root, id }));
  if (task) {
    action.task = task;
    // A blocked end and the budget end ask nothing: the owner has to act first (jira-entry D-6, change-budget D-4).
    const stopped = action.kind === 'end' && (action.end.state === 'blocked' || action.end.why === 'waiting-budget');
    if (deliveredPr && !archiving && !stopped && !writeBackAsked(readWriteBack(writeBackFile(found.root, id)), task.key, deliveredPr.number)) {
      action.writeBack = { key: task.key, link: task.link, number: deliveredPr.number, url: deliveredPr.url };
    }
  }
  return action;
}

// The place facts of change `id` (D-9): its machine and places from its claim (`run` is the run file's number), whether it holds
// its place (its branch on `origin` holds approval.md) and, when it does not, how many other changes of its machine do.
// null when the claim records no places, and for a `run` claim of a change session on the run's ticket (a run with a session per change whose
// ticket for `id` a session claimed): that change's one gate is `sessionNext`'s, over the run file's `occupied` (roadmap-sessions-upfront D-18), so
// the two gates never both apply. `claims` is a `remoteClaims` result a caller already read.
function placeFacts(found, id, dir, { env, gh, claims }) {
  const file = join(dir, '.openspec.yaml');
  if (!existsSync(file)) return null;
  const { machine, places } = parseClaim(readFileSync(file, 'utf8'));
  if (!machine || places === null) return null;
  const run = places === 'run' ? readRun(runFilePath(found.root)) : null;
  if (run?.changeSessions && run.tickets[id]?.claimedBy) return null;
  const total = run ? run.places : places;
  if (gitPasses(found.root, ['cat-file', '-e', `refs/remotes/origin/${id}:openspec/changes/${id}/approval.md`])) return { machine, places: total, taken: true, held: null };
  const read = claims ?? remoteClaims(found.root, { env, gh });
  const held = [...read.claims.values()].filter((c) => c.id !== id && c.machine === machine && c.placed === true).length;
  return { machine, places: total, taken: false, held };
}

// ---------------------------------------------------------------- the write-back record (jira-entry D-7)

// The record of the write-back question of change `id`: one file in the git common directory, never in the worktree.
export function writeBackFile(root, id) {
  const common = tryGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']) || join(root, '.git');
  return join(common, 'devkit', 'write-back', `${id}.json`);
}

// The record, `null` when there is none, `{ corrupt: true }` when it cannot be read: a damaged record asks and writes nothing.
export function readWriteBack(file) {
  if (!existsSync(file)) return null;
  try {
    const record = JSON.parse(readFileSync(file, 'utf8'));
    return record?.version === 1 ? record : { corrupt: true };
  } catch { return { corrupt: true }; }
}

// "Asked" for a task and a pull request: the record is damaged, or it names that key and that number.
const writeBackAsked = (record, key, number) => Boolean(record) && (record.corrupt === true || (record.key === key && record.number === number));

// The record is written to a temporary file in its folder and then renamed, so it is never half written.
function saveWriteBack(file, record) {
  mkdirSync(dirname(file), { recursive: true });
  const part = `${file}.${process.pid}.tmp`;
  writeFileSync(part, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(part, file);
}

// ---------------------------------------------------------------- the merge-check record (post-merge-validate D-2)

// The record of the check of change `id` after a merge of the base: one file in the git common directory, never in the worktree.
export function mergeCheckFile(root, id) {
  const common = tryGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']) || join(root, '.git');
  return join(common, 'devkit', 'merge-check', `${id}.json`);
}

const MERGE_CHECK_RESULTS = ['green', 'red', 'cannot-run'];

// The record, or `null` when it is missing, empty, truncated, not JSON or not whole: the loop then offers the check again, so a
// damaged file can never read as green.
export function readMergeCheck(file, id) {
  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
  if (!isObject(record) || record.version !== 1 || record.change !== id) return null;
  if (typeof record.merge !== 'string' || !/^[0-9a-f]{40}$/.test(record.merge)) return null;
  if (!MERGE_CHECK_RESULTS.includes(record.result)) return null;
  if (!Number.isInteger(record.reds) || record.reds < 0) return null;
  if (typeof record.fingerprint !== 'string') return null;
  return record;
}

// The red checks of `merge` since its last green: red adds one to the earlier record's count when that record is for the same
// merge, else starts at 1; green resets to 0; a check that could not run keeps the count of the same merge, else 0.
const redsAfter = (previous, merge, result) => {
  const same = previous?.merge === merge ? previous.reds : 0;
  if (result === 'green') return 0;
  return result === 'red' ? same + 1 : same;
};

const MERGE_CHECK_ERRORS_MAX = 4000;

// What `openspec validate <id> --type change --strict --json` answered, as { result, errors, error }: green only when the CLI says the change is
// valid and exits 0; red when it says it is not, with one line per issue; anything else could not be run (post-merge-validate D-3).
function mergeCheckResult(r, id) {
  const cannot = (error) => ({ result: 'cannot-run', errors: null, error });
  if (r.refused) return cannot(r.refused);
  if (r.missing) return cannot('the openspec CLI is not installed or not on PATH');
  if (r.timedOut) return cannot('openspec validate timed out');
  let body = null;
  try { body = JSON.parse(r.stdout); } catch { /* not JSON */ }
  const item = Array.isArray(body?.items) ? body.items.find((i) => i?.id === id) : undefined;
  if (item?.valid === true && r.status === 0) return { result: 'green', errors: null, error: null };
  if (item?.valid === false) {
    const lines = (Array.isArray(item.issues) ? item.issues : []).map((i) => `- ${i?.level} ${i?.path}: ${i?.message}`).join('\n');
    const errors = lines.length > MERGE_CHECK_ERRORS_MAX ? `${lines.slice(0, MERGE_CHECK_ERRORS_MAX - 1)}…` : lines;
    return { result: 'red', errors, error: null };
  }
  const firstLine = (text) => (text ?? '').trim().split('\n')[0];
  return cannot(body?.status?.[0]?.message ?? (firstLine(r.stderr) || firstLine(r.stdout) || `exit ${r.status}`));
}

// `merge-check <id>`: runs `openspec validate <id> --type change --strict` once for the merge of the base the branch holds and records the result in the
// git common directory (`--type change`, so a canonical spec of the same name is no ambiguity). Writes nothing in the worktree and no stage header. A red or a failed check still exits 0: the session runs `next`.
export function mergeCheck(cwd, id, { env = process.env, openspec } = {}) {
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const root = locate(start, id).root;
  if (!locateChange(root, id)) throw new LoopUsageError(`unknown change ${id}`);
  const base = defaultBase(root);
  const merge = baseMergeOf(root, `origin/${base}`);
  if (!merge) return { version: 1, change: id, base, merge: null, result: 'none' };
  const taken = fingerprint(root, tryGit(root, ['rev-parse', 'HEAD']));
  const run = openspec ?? makeOpenspec(root, cleanOf(env));
  const { result, errors, error } = mergeCheckResult(run(['validate', id, '--type', 'change', '--strict', '--json']), id);
  const file = mergeCheckFile(root, id);
  const reds = redsAfter(readMergeCheck(file, id), merge, result);
  saveWriteBack(file, { version: 1, change: id, merge, result, reds, fingerprint: taken, errors, error, at: new Date().toISOString() });
  return { version: 1, change: id, base, merge, result, reds, errors, error };
}

// The change `id` and the task it records, for `write-back`: an unknown change, or one that records no task, is a usage error.
function taskChangeOf(cwd, id, env) {
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = locate(start, id);
  if (!locateChange(found.root, id)) throw new LoopUsageError(`no change ${id} found`);
  const task = recordedTask(readRequirements({ root: found.root, id }));
  if (!task) throw new LoopUsageError(`the change ${id} records no Jira task`);
  return { start, found, task, archived: found.branch === `chore/archive-${id}` };
}

// `write-back ask <id>`: whether to ask the developer about writing the pull request's link on the task, and the question.
// Records that it asked, so it asks once per task and pull request number (a recreated pull request asks again). Writes only that record.
export function writeBackAsk(cwd, id, { input, lang = 'pt-BR', env = process.env, gh } = {}) {
  const l = normalizeLang(lang);
  const { start, found, task, archived } = taskChangeOf(cwd, id, env);
  const read = writeBackInput(input);
  if (read.error) throw new LoopUsageError(read.error);
  const out = (extra) => ({ version: 1, change: id, key: task.key, ...extra });
  if (archived || archivedOnDefault(start, { env, gh }).has(id)) return out({ ask: false, why: 'archived' });
  const file = writeBackFile(found.root, id);
  if (writeBackAsked(readWriteBack(file), task.key, read.number)) return out({ ask: false, why: 'asked' });
  saveWriteBack(file, { version: 1, change: id, key: task.key, number: read.number, url: read.url, askedAt: new Date().toISOString(), transitions: read.transitions, answer: null });
  const choices = writeBackChoices(read.transitions).map((c) => ({ choice: c.choice, label: render(l, `choice.${c.kind}`, { name: c.name }) }));
  return out({ ask: true, question: render(l, 'write-back-ask', { id, key: task.key, number: read.number, choices: choices.map((c) => c.label).join('; ') }), choices });
}

// ---------------------------------------------------------------- the decision records (design stage-roles D-4)

const STATUS_LINE = /^(\s*[-*]?\s*\**Status\**\s*:\s*\**\s*)(\S+)(.*)$/im;
const BULLETED_STATUS = /^([ \t]*[-*][ \t]+)Status[ \t]*:[ \t]*$/i; // the bullet and its indent, when the status line is a plain bulleted `- Status:` one
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
    const lead = BULLETED_STATUS.exec(prefix)?.[1] ?? prefix; // a bulleted `- Status:` line gets a bulleted `- Accepted by:` line, not a second Status label
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const next = `${text.slice(0, match.index + cut)}${prefix}${acceptedLike(match[2])}${match[3]}${eol}${lead}${by}${text.slice(match.index + match[0].length)}`;
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
// In `two-prs` (D-10) an id counts only once the test branch holds it archived too, read the same way from its own branch.
export function archivedDates(start, { env = process.env, gh } = {}) {
  const main = realpathSync(mainRoot(start));
  const run = gh ?? makeGh(main, cleanOf(env));
  const folder = 'openspec/changes/archive';
  // The ids of one branch: GitHub's listing, the remote-tracking and the local branch; the working tree only for the main checkout's own.
  const datesOn = (branch, withTree) => {
    const ids = new Map();
    const addNames = (names) => { for (const name of names) { const m = ARCHIVED.exec(name); if (m && !(ids.get(m[2]) >= m[1])) ids.set(m[2], m[1]); } };
    try {
      const got = run(['api', `repos/{owner}/{repo}/contents/${folder}?ref=${branch}`]);
      const listing = got.status === 0 ? JSON.parse(got.stdout) : [];
      if (Array.isArray(listing)) addNames(listing.map((e) => String(e?.name ?? '')));
    } catch { /* GitHub could not be read: the other sources answer */ }
    for (const ref of [`refs/remotes/origin/${branch}`, `refs/heads/${branch}`]) addNames(tryGit(main, ['ls-tree', '--name-only', `${ref}:${folder}`]).split('\n'));
    const dir = join(main, folder);
    if (withTree && existsSync(dir)) addNames(readdirSync(dir));
    return ids;
  };
  const ids = datesOn(defaultBase(main), true);
  const delivery = readDevkitSettings(main).delivery;
  if (delivery?.model !== 'two-prs' || !delivery.testBranch) return ids;
  const onTest = datesOn(delivery.testBranch, false);
  return new Map([...ids].filter(([id]) => onTest.has(id)));
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
// archive (a new change that reuses the id). A slice of `/devkit project` is left out unless `slices` is true, and the checkout of
// a delivery train (`train/<n>`) is never a change's place.
export function unfinished(start, { env = process.env, gh, slices = false } = {}) {
  const archived = archivedDates(start, { env, gh });
  const found = new Map();
  const note = (id, c, rank, reused = false) => { if ((!archived.has(id) || reused) && (!found.has(id) || found.get(id).rank < rank)) found.set(id, { id, root: c.root, branch: c.branch, rank }); };
  const delivery = readDevkitSettings(realpathSync(mainRoot(start))).delivery;
  const testSuffix = delivery?.model === 'two-prs' && delivery.testBranch ? `-${delivery.testBranch}` : null;
  for (const c of checkoutsOf(start)) {
    // The checkout of a delivery train holds the folder of every change it carries, none of them unfinished there (delivery-train D-2).
    if (/^train\/\d+$/.test(c.branch)) continue;
    const archive = /^chore\/archive-(.+)$/.exec(c.branch);
    // The test branch's archive branch (`chore/archive-<id>-<test>`) is the archive of <id> too, behind the base's own.
    if (archive && testSuffix && archive[1].endsWith(testSuffix)) note(archive[1].slice(0, -testSuffix.length), c, 2.5);
    else if (archive) note(archive[1], c, 3);
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

// The blocked stand-in of change `id` when some checkout holds its folder but the checkout `locate` reads it in does not
// (state-skips-unlocated D-2); null when the loop can place it, or when no checkout holds it.
export function unplacedAction(start, id) {
  const found = locate(start, id);
  if (found.branch === `chore/archive-${id}` || locateChange(found.root, id)) return null;
  const holder = knownChange(start, id);
  if (!holder) return null;
  return { kind: 'end', change: id, script: null, root: holder.root, branch: holder.branch, stage: null, stageTitle: null,
    end: { state: 'blocked', why: 'wrong-branch' }, params: { id } };
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
  const changeSessions = run.changeSessions === true;
  const named = namedByRun(run);
  const ids = id !== null ? [id] : [...new Set([...unfinished(start, { env, gh }).map((u) => u.id), ...named])].sort((a, b) => a.localeCompare(b));
  let archived = null;
  let days = null; // archivedDates(start, ...), read at most once per command, only when an id is unplaced
  const archivedStandIn = (cid) => ({ kind: 'end', change: cid, script: null, root: null, branch: null, stage: null, stageTitle: null, end: { state: 'archived', why: 'archived' }, params: { id: cid } });
  const openTitle = () => {
    try { return readFlow(start, 'devkit')?.stages.find((s) => s.id === 'open')?.title[l] ?? 'open'; } catch { return 'open'; }
  };
  return ids.map((cid) => {
    let action;
    const unplaced = unplacedAction(start, cid);
    if (unplaced && (days ??= archivedDates(start, { env, gh })).has(cid) && !createdAfter(unplaced.root, cid, days.get(cid))) action = archivedStandIn(cid);
    else if (unplaced) action = unplaced;
    else if (knownChange(start, cid)) action = nextAction(start, cid, { env, lang: l, openspec, gh });
    else if ((archived ??= archivedOnDefault(start, { env, gh })).has(cid)) action = archivedStandIn(cid);
    else if (named.has(cid)) action = { kind: 'none', change: cid, script: null, root: null, branch: null, stage: 'open', stageTitle: openTitle() };
    else throw new LoopUsageError(`no change named ${cid}`);
    const line = changeSessions && roadmapIds.has(cid) ? (readRoadmap(mainRoot(start)) ?? []).flatMap((round) => round.items).find((item) => item.id === cid) : null;
    const dependency = line && line.after.length > 0 && isPlanStage(start, cid, action) ? line.after.find((d) => !(archived ??= archivedOnDefault(start, { env, gh })).has(d)) ?? null : null;
    const facts = runFactsOf(dependency ? { ...run, waitsFor: { [cid]: dependency } } : run, cid, { onRoadmap: roadmapIds.has(cid) });
    return { change: cid, ...changeState(action, facts, { lang: l }), script: action.script, root: action.root, branch: action.branch };
  });
}

// ---------------------------------------------------------------- start (D-3)

// The text of the change's `requirements.md` in its checkout; empty when it cannot be read.
function readRequirements(u) {
  const dir = locateChange(u.root, u.id)?.dir;
  try { return dir ? readFileSync(join(dir, 'requirements.md'), 'utf8') : ''; } catch { return ''; }
}

const VERB_ROUND = { help: 23 };
export const DRIVER_ROUND = { script: 22 };
// The drivers that run: the only source of the setup's driver question (project-setup D-2).
export const BUILT_DRIVERS = DRIVERS.filter((d) => !DRIVER_ROUND[d]);

// The verb is the first word, lower-cased; the text is the rest, trimmed.
export function parseStart(input) {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(String(input ?? '').trim());
  return m ? { verb: m[1].toLowerCase(), text: (m[2] ?? '').trim() } : { verb: '', text: '' };
}

// Rows S3 to S5 (and O3): the project is set up, its settings are known and its driver is built; else the reply of
// the row that stops it. The verb matters for one cell: `/devkit project` does not run on the compozy driver (compozy-driver D-1).
export function projectGate(start, settings, verb) {
  if (!start || !optedIn(start)) return { mode: 'not-set-up', key: 'not-set-up', params: {} };
  const unknown = settings.unknown[0];
  if (unknown) return { mode: 'setting-unknown', key: 'setting-unknown', params: { setting: unknown.setting, value: unknown.value, accepted: unknown.accepted } };
  const missing = settings.missing?.[0];
  if (missing) return { mode: 'setting-missing', key: 'setting-missing', params: { setting: missing.setting } };
  const refused = settings.train?.problem;
  if (refused) return { mode: 'setting-unknown', key: refused.model === 'two-prs' ? 'train-model' : 'train-no-model', params: {} };
  if (DRIVER_ROUND[settings.driver]) return { mode: 'driver-not-built', key: 'driver-not-built', params: { driver: settings.driver, round: DRIVER_ROUND[settings.driver] } };
  if (settings.driver === 'compozy' && verb === 'project') return { mode: 'driver-no-project', key: 'driver-no-project', params: {} };
  return null;
}

export const filesLanguageOf = (settings) => (settings.unknown.some((u) => u.setting === 'language') ? 'en' : settings.language);

// { version, installed } when the change follows an older flow than the one installed in `root`, else null; an error reads as null
// (the resume reply stays as it was).
function flowNotice(root, id) {
  try {
    const { version, installed } = changeFlow(root, locateChange(root, id)?.dir ?? join(root, 'openspec', 'changes', id));
    return typeof version === 'number' && typeof installed === 'number' && installed > version ? { version, installed } : null;
  } catch { return null; }
}

// What `/devkit change` does with the request: { version, mode, verb, text, change, unfinished, task, settings, reply }.
// `task` is { key, link, idPrefix } when the text is a Jira key or link (jira-entry D-2), else null. Read-only: it creates
// and runs nothing.
export function startMode(cwd, input, { lang = 'pt-BR', env = process.env, openspec, gh } = {}) {
  const l = normalizeLang(lang);
  const { verb, text } = parseStart(input);
  const start = findRoot(cwd);
  const settings = start ? readDevkitSettings(start) : { driver: 'claude', language: 'en', unknown: [] }; // S0 when unreadable
  const ref = verb === 'change' ? parseTaskRef(text) : null;
  const task = ref ? { ...ref, idPrefix: taskIdPrefix(ref.key) } : null;
  const out = (mode, extra = {}) => ({
    version: 1, mode, verb, text, change: null, unfinished: [], task,
    settings: { driver: settings.driver, filesLanguage: filesLanguageOf(settings), personLanguage: l }, ...extra,
  });
  const say = (key, params = {}) => render(l, key, params);
  if (VERB_ROUND[verb]) return out('not-built', { reply: say('verb-not-built', { verb, round: VERB_ROUND[verb] }) });
  // `/devkit setup` runs whatever the settings hold, since the step is what repairs them; it only needs a repository (project-setup D-1).
  if (verb === 'setup') {
    const root = start ?? (tryGit(cwd ?? process.cwd(), ['rev-parse', '--show-toplevel']) || null);
    return root ? out('setup', { root, reply: null }) : out('setup-no-repo', { reply: say('setup-no-repo') });
  }
  if (!['change', 'roadmap', 'status', 'project', 'train'].includes(verb)) return out('unknown-verb', { reply: say('verb-unknown') });
  const gate = projectGate(start, settings, verb);
  if (gate) return out(gate.mode, { reply: say(gate.key, gate.params) });
  if (verb === 'train' && text) return out('train-args', { reply: say('train-args') }); // nothing follows the verb (delivery-train D-5)
  if (verb !== 'change') return out(verb); // the skill calls roadmap-loop.mjs, project-loop.mjs or train-loop.mjs for these (roadmap-coordinator D-3, project-phases D-4, delivery-train D-5)

  const read = { lang: l, env, openspec, gh };
  const list = unfinished(start, { env, gh }).map((u) => {
    let where = null;
    try { where = whereOf(u, u.id, read); } catch (e) { if (!(e instanceof LoopUsageError)) throw e; }
    return { id: u.id, root: u.root, where };
  });
  const resume = (id, where, root) => {
    const newer = flowNotice(root, id);
    const reply = say('resumed', { id, where });
    return out('resume', { change: id, unfinished: list, reply: newer ? `${reply}\n${say('flow-newer', newer)}` : reply });
  };
  const listed = list.map((u) => (u.where ? `${u.id} (${u.where})` : u.id)).join('; ');
  const askFirst = () => out('ask-unfinished', { unfinished: list, reply: say(list.length === 1 ? 'ask-unfinished' : 'ask-unfinished-many', { list: listed }) });
  if (task) {
    const own = list.find((u) => recordedTask(readRequirements(u))?.key === task.key);
    if (own) return resume(own.id, own.where ?? whereOf({ root: own.root, branch: '' }, own.id, read), own.root);
    if (list.length) return askFirst();
    return out('task', { reply: null });
  }
  if (/^\S+$/.test(text)) {
    const known = knownChange(start, text);
    const knownDir = known ? locateChange(known.root, text)?.dir : null;
    if (knownDir && isSliceDir(knownDir)) return out('is-slice', { change: text, reply: say('is-slice', { id: text }) });
    if (known) return resume(text, list.find((u) => u.id === text)?.where ?? whereOf(known, text, read), known.root);
  }
  if (text === '') {
    if (list.length === 1) return resume(list[0].id, list[0].where ?? whereOf({ root: list[0].root, branch: '' }, list[0].id, read), list[0].root);
    if (list.length > 1) return out('choose', { unfinished: list, reply: say('choose', { n: list.length, list: listed }) });
    return out('nothing', { reply: say('nothing-to-resume') });
  }
  if (list.length) return askFirst();
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

// `body` placed under `## Request` of the schema's requirements template (header left pending): a quoted request, or a task's
// key line and quoted parts.
function withRequest(template, body) {
  if (!/## Request\n[\s\S]*?\n## /.test(template)) throw new LoopUsageError('the requirements template has no "## Request" section');
  return template.replace(/(## Request\n)[\s\S]*?(\n## )/, (_, open, close) => `${open}\n${body}\n${close}`);
}

// Every local reason an id is taken (O2): a change folder (active or archived) in any checkout, a local branch, an archive
// branch or the worktree folder. The remote branch is read by `refuseRemote`, which tells a claim from a taken name.
function nameTaken(start, main, id) {
  if (checkoutsOf(start).some((c) => locateChange(c.root, id))) return true;
  for (const ref of [`refs/heads/${id}`, `refs/heads/chore/archive-${id}`]) {
    if (tryGit(main, ['rev-parse', '--verify', '--quiet', ref])) return true;
  }
  return existsSync(join(main, '.claude', 'worktrees', id));
}

// ---------------------------------------------------------------- the claim (remote-worker D-1 to D-3)

export const MACHINE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const PLACES_VALUE = /^(?:run|[1-9]\d?)$/;
const CLAIM_MACHINE = /^x-devkit-machine:[ \t]*["']?([A-Za-z0-9][A-Za-z0-9._-]{0,63})["']?[ \t]*\r?$/m;
const CLAIM_PLACES = /^x-devkit-places:[ \t]*["']?(run|[1-9]\d?)["']?[ \t]*\r?$/m;
export const CLAIM_GH_BRANCHES = 4;
export const CLAIM_DEADLINE_MS = 10_000;
const CLAIM_GH_TIMEOUT_MS = 4000;
const LS_REMOTE_TIMEOUT_MS = 15_000;

// This machine's name in a claim: the hostname up to its first dot, anything outside the allowed characters made a dash.
export function thisMachine() {
  const name = hostname().split('.')[0].replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 64);
  return MACHINE_NAME.test(name) ? name : 'machine';
}

// The two claim keys of a change's `.openspec.yaml`; a value that does not match is absent.
export function parseClaim(text) {
  const machine = CLAIM_MACHINE.exec(String(text ?? ''))?.[1] ?? null;
  const raw = CLAIM_PLACES.exec(String(text ?? ''))?.[1] ?? null;
  return { machine, places: raw === null || raw === 'run' ? raw : Number(raw) };
}

const gitPasses = (root, args) => {
  try { execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' }); return true; } catch { return false; }
};

// The claim of change `id` held by `ref` (after a fetch, from local objects only): null when the ref has no folder of it.
export function claimOfRef(main, ref, id) {
  const folder = `openspec/changes/${id}`;
  if (!gitPasses(main, ['cat-file', '-e', `${ref}:${folder}`])) return null;
  const { machine, places } = parseClaim(tryGit(main, ['show', `${ref}:${folder}/.openspec.yaml`]));
  return { id, machine, places, placed: gitPasses(main, ['cat-file', '-e', `${ref}:${folder}/approval.md`]) };
}

// Which changes are open on `origin`, without writing anything: { readable, origin, claims: Map<id, claim> } (`origin` false: there is none to read). A branch whose
// remote-tracking ref is current is read locally; at most CLAIM_GH_BRANCHES others go through `gh` (two calls each, each with
// its own timeout, none after CLAIM_DEADLINE_MS); a branch not read, or whose `gh` call failed, reads with no machine.
export function remoteClaims(start, { env = process.env, gh, ids } = {}) {
  const main = realpathSync(mainRoot(start));
  if (!gitPasses(main, ['remote', 'get-url', 'origin'])) return { readable: false, origin: false, claims: new Map() };
  const none = { readable: false, origin: true, claims: new Map() };
  let listing;
  try {
    listing = execFileSync('git', ['-C', main, 'ls-remote', '--heads', 'origin'], { encoding: 'utf8', timeout: LS_REMOTE_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch { return none; }
  const began = Date.now();
  const run = gh ?? makeGh(main, cleanOf(env));
  const ghCall = (args) => run(args, { timeout: CLAIM_GH_TIMEOUT_MS });
  const wanted = ids === undefined ? null : new Set(ids);
  const defaultName = defaultBase(main);
  const archived = archivedOnDefault(start, { env, gh: ghCall });
  const claims = new Map();
  let read = 0;
  for (const line of listing.split('\n')) {
    const [sha, ref] = line.split('\t');
    const name = ref?.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : null;
    if (!name || archived.has(name)) continue;
    if (wanted ? !wanted.has(name) : (name === defaultName || !NAME.test(name))) continue;
    const tracking = `refs/remotes/origin/${name}`;
    if (tryGit(main, ['rev-parse', '--verify', '--quiet', tracking]) === sha) {
      const claim = claimOfRef(main, tracking, name);
      if (claim) claims.set(name, claim);
      continue;
    }
    const unread = { id: name, machine: null, places: null, placed: null };
    if (read >= CLAIM_GH_BRANCHES || Date.now() - began >= CLAIM_DEADLINE_MS) { claims.set(name, unread); continue; }
    read++;
    const got = claimThroughGh(ghCall, name, sha);
    if (got !== 'absent') claims.set(name, got ?? unread);
  }
  return { readable: true, origin: true, claims };
}

// One branch's claim through GitHub: the folder's listing, then its `.openspec.yaml`. null when a call fails (read as
// unknown), 'absent' when the branch holds no folder of the change.
function claimThroughGh(ghCall, name, sha) {
  const route = `repos/{owner}/{repo}/contents/openspec/changes/${name}`;
  const folder = ghCall(['api', `${route}?ref=${sha}`]);
  if (folder.status !== 0) return /404|not found/i.test(folder.stderr) ? 'absent' : null;
  try {
    const names = JSON.parse(folder.stdout).map((e) => String(e?.name ?? ''));
    const claim = { id: name, machine: null, places: null, placed: names.includes('approval.md') };
    const yaml = ghCall(['api', `${route}/.openspec.yaml?ref=${sha}`]);
    if (yaml.status !== 0) return null;
    return { ...claim, ...parseClaim(Buffer.from(String(JSON.parse(yaml.stdout).content ?? ''), 'base64').toString('utf8')) };
  } catch { return null; }
}

// The refusal for an id whose branch is on `origin` (D-1 step 2): a claim names its machine, a branch with no change folder
// is a taken name.
function refuseRemote(main, id, refuse) {
  const claim = claimOfRef(main, `refs/remotes/origin/${id}`, id);
  if (!claim) return refuse('name-taken', { id });
  return claim.machine ? refuse('claimed', { id, machine: claim.machine }) : refuse('claimed-elsewhere', { id });
}

// The clean-up of a half-made open (O5): each step is tried on its own, and none of their errors replaces the original one.
function removeLocalOpen(main, worktree, id) {
  for (const cleanup of [
    () => gitRun(main, ['worktree', 'remove', '--force', worktree]),
    () => rmSync(worktree, { recursive: true, force: true }),
    () => gitRun(main, ['worktree', 'prune']),
    () => gitRun(main, ['branch', '-D', id]),
  ]) {
    try { cleanup(); } catch { /* best effort */ }
  }
}

// A push the remote refused because the branch already exists: the lost race of two machines opening one id.
class ClaimRace extends LoopUsageError {}
const PUSH_RACE = /stale info|already exists|fetch first/i;

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
// requirements file; refusals are LoopRefusal (exit 3, nothing created). With `task` (a Jira key) the standard input is the
// task as JSON, and the request section records the key and quotes the task's title, description and criteria field.
export function openChange(cwd, id, { script, why, request, task: taskKey, lang = 'pt-BR', env = process.env, openspec, gh, lockSleep, machine, places, remote = false, beforePush } = {}) {
  const l = normalizeLang(lang);
  const refuse = (key, params = {}) => new LoopRefusal(key, render(l, key, params));
  if (!NAME.test(id) || id === 'archive') throw refuse('name-invalid', { id });
  if (!SCRIPTS.includes(script)) throw new LoopUsageError(`open needs --script ${SCRIPTS.join(' or ')}`);
  if (!WHY_CODES.includes(why)) throw new LoopUsageError(`open needs --why with one of: ${WHY_CODES.join(', ')}`);
  const text = String(request ?? '').trim();
  if (!text) throw new LoopUsageError('open needs the request on standard input');
  if (machine !== undefined && !MACHINE_NAME.test(String(machine))) throw new LoopUsageError(`--machine needs 1 to 64 letters, digits, dots, underscores or dashes, starting with a letter or a digit, not ${machine}`);
  if (places !== undefined && !PLACES_VALUE.test(String(places))) throw new LoopUsageError(`--places needs a whole number from 1 to 99 or run, not ${places}`);
  if (remote && machine === undefined) throw new LoopUsageError('--remote needs --machine');
  let task = null;
  if (taskKey !== undefined) {
    if (!TASK_KEY.test(taskKey)) throw new LoopUsageError('open --task needs a Jira key');
    const read = taskFromJson(text, taskKey);
    if (read.error) throw new LoopUsageError(read.error);
    task = read.task;
    const prefix = `${taskIdPrefix(taskKey)}-`;
    if (!id.startsWith(prefix)) throw new LoopUsageError(`a change opened from ${taskKey} needs an id that starts with ${prefix}`);
  }
  const start = findRoot(cwd);
  const settings = start ? readDevkitSettings(start) : { driver: 'claude', language: 'en', unknown: [] };
  const gate = projectGate(start, settings, 'change');
  if (gate) throw refuse(gate.key, gate.params);
  // The key's own unfinished change is looked for inside the open lock, so two openings for one key at once open one change.
  const check = task ? () => {
    const taken = unfinished(start, { env, gh }).find((u) => recordedTask(readRequirements(u))?.key === taskKey);
    if (taken) throw refuse('task-taken', { key: taskKey, id: taken.id });
  } : undefined;
  const requestBody = task ? taskRequest(task) : quoteLines(text);

  // The change's own first file: its request, as a quote in the schema's requirements template.
  const prepare = (folder, worktree) => {
    const schema = schemaFile(worktree, script);
    const template = schema ? join(dirname(schema), 'templates', 'requirements.md') : null;
    if (!template || !existsSync(template)) throw new LoopUsageError(`the ${script} schema has no requirements template`);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'requirements.md'), withRequest(readFileSync(template, 'utf8'), requestBody));
  };
  const claim = { machine: machine ?? thisMachine(), places: places === undefined ? null : String(places) };
  const { worktree, base } = openCheckout(cwd, id, { script, lang: l, env, openspec, prepare, lockSleep, claim, remote, beforePush, check });
  const reply = remote ? render(l, 'opened-on', { id, machine: claim.machine, script, why }) : render(l, task ? 'opened-task' : 'opened', { id, script, other: otherScript(script), why, key: taskKey });
  return { version: 1, change: id, script, worktree, branch: id, base, ...(task ? { task: { key: task.key, link: task.url } } : {}), reply };
}

// The open steps every script shares (project-phases D-5): the open lock, the fetch, the id check, the worktree from the default
// branch, `openspec new change <id> --schema <script>`, `prepare(folder, worktree)` for the script's own first file, and the
// clean-up of a half-made open. The caller has checked the name and the project gate; its optional `check()` runs under the
// lock, right after the fetch, and a refusal it throws creates nothing. Returns { worktree, base }; a refusal
// is a LoopRefusal (exit 3, nothing created).
export function openCheckout(cwd, id, { script, lang = 'pt-BR', env = process.env, openspec, prepare, lockSleep, claim = null, remote = false, beforePush, check } = {}) {
  const l = normalizeLang(lang);
  const refuse = (key, params = {}) => new LoopRefusal(key, render(l, key, params));
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const main = mainRoot(start);
  return withOpenLock(main, () => openUnderLock({ start, main, id, script, prepare, refuse, openspec, env, claim, remote, beforePush, check }), lockSleep);
}

// The ref a new change `id` starts from in a repository with an `origin`: `origin/<default branch>`, and with the two-prs model
// `origin/<delivery base>` once the model's refusals pass (each throws `refuse(key, params)`, nothing created). `open` and
// `compozy-start` both call it, so the refusals known before anything is made are one rule.
function deliveryBase(main, id, refuse) {
  const delivery = readDevkitSettings(main).delivery;
  if (delivery?.model !== 'two-prs') return `origin/${defaultBase(main)}`;
  const { base: configured, testBranch } = delivery;
  if (defaultBase(main) !== configured) throw refuse('base-not-default', { base: configured, default: defaultBase(main) });
  if (!tryGit(main, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${testBranch}`])) throw refuse('test-branch-missing', { branch: testBranch });
  if (id.endsWith(`-${testBranch}`)) throw refuse('name-test-suffix', { id, branch: testBranch });
  return `origin/${configured}`;
}

// What `open` does while it holds the lock (D-1): the fetch, the local reasons and the remote claim, the worktree, the change
// and the script's first file, then, with an `origin` and a claim, the commit and the push that only creates the branch.
function openUnderLock({ start, main, id, script, prepare, refuse, openspec, env, claim, remote, beforePush, check }) {
  const hasOrigin = gitRun(main, ['remote']).split('\n').includes('origin');
  if (hasOrigin) gitRun(main, ['fetch', 'origin', '--prune', '--quiet']);
  check?.(); // the caller's own refusal, before the name checks, with the lock held and the origin as the fetch left it
  if (nameTaken(start, main, id)) throw refuse('name-taken', { id });
  if (hasOrigin && tryGit(main, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${id}`])) throw refuseRemote(main, id, refuse);

  let base = 'HEAD';
  if (hasOrigin) {
    base = deliveryBase(main, id, refuse);
    if (!tryGit(main, ['rev-parse', '--verify', '--quiet', `refs/remotes/${base}`])) throw new LoopUsageError(`${base} does not exist: nothing to start the change from`);
  }
  const worktree = join(main, '.claude', 'worktrees', id);
  gitRun(main, ['worktree', 'add', '-q', '-b', id, worktree, base]);
  try {
    const created = (openspec ?? makeOpenspec(worktree, cleanOf(env)))(['new', 'change', id, '--schema', script]);
    if (created.status !== 0) throw new LoopUsageError(`openspec new change failed: ${(created.stderr || created.stdout).trim()}`);
    // The claim keys go in before the pin, so the pin stays the last lines of the file whether or not the change is claimed.
    if (hasOrigin && claim) writeClaimKeys(join(worktree, 'openspec', 'changes', id), claim);
    recordPin(worktree, join(worktree, 'openspec', 'changes', id), script);
    prepare?.(join(worktree, 'openspec', 'changes', id), worktree);
    if (hasOrigin && claim) claimOnOrigin({ worktree, id, beforePush });
  } catch (e) {
    // O5: leave nothing half made: the worktree, its folder if still there (and its registration, which git keeps while the
    // branch is "used by" it), then the branch this call just created.
    removeLocalOpen(main, worktree, id);
    if (e instanceof ClaimRace) {
      // The lost race: another machine's push came first. Name its claim from a fresh read of the branch.
      tryGit(main, ['fetch', '-q', 'origin', `+refs/heads/${id}:refs/remotes/origin/${id}`]);
      throw refuseRemote(main, id, refuse);
    }
    throw e;
  }
  if (hasOrigin && claim && remote) {
    removeLocalOpen(main, worktree, id);
    return { worktree: null, base };
  }
  return { worktree, base };
}

// D-1 step 4: the claim keys in the change's `.openspec.yaml`, ...
function writeClaimKeys(dir, claim) {
  const file = join(dir, '.openspec.yaml');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const keys = `x-devkit-machine: ${claim.machine}\n${claim.places ? `x-devkit-places: ${claim.places}\n` : ''}`;
  writeFileSync(file, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${keys}`);
}

// ... the commit, and the push that only creates the branch. A push refused because the branch exists is the lost race
// (ClaimRace); any other failure is the original error.
function claimOnOrigin({ worktree, id, beforePush }) {
  gitRun(worktree, ['add', '--', `openspec/changes/${id}`]);
  gitRun(worktree, ['commit', '-q', '-m', `chore(openspec): open ${id}`]);
  beforePush?.();
  try {
    gitRun(worktree, ['push', '-q', `--force-with-lease=refs/heads/${id}:`, 'origin', `${id}:refs/heads/${id}`]);
  } catch (e) {
    throw PUSH_RACE.test(String(e?.message)) ? new ClaimRace(e.message) : e;
  }
}

// `place <id>` (D-9): takes the place of change `id` on its machine, under one lock shared by every checkout of the clone.
// Fetches, commits the plan files of the change folder, counts from the remote-tracking branches the places its machine holds,
// and pushes only when one is free. { code: 0 taken | 2 no free place, body }; a failure is a LoopUsageError.
const PLACE_LOCK = { stepMs: 200, waitMs: 60_000, staleMs: 10 * 60_000 };

export function placeChange(cwd, id, { env = process.env, gh } = {}) {
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = locate(start, id);
  const dir = locateChange(found.root, id)?.dir;
  if (!dir || found.branch !== id) throw new LoopUsageError(`place needs the change ${id} in its own worktree`);
  const file = join(dir, '.openspec.yaml');
  const { machine, places } = parseClaim(existsSync(file) ? readFileSync(file, 'utf8') : '');
  if (!machine || places === null) throw new LoopUsageError(`the change ${id} records no machine and places: nothing to take`);
  const main = realpathSync(mainRoot(start));
  if (!gitPasses(main, ['remote', 'get-url', 'origin'])) throw new LoopUsageError('place needs an origin remote');
  const total = places === 'run' ? readRun(runFilePath(found.root)).places : places;
  const common = tryGit(main, ['rev-parse', '--path-format=absolute', '--git-common-dir']) || join(main, '.git');
  return withLockFile({
    ...PLACE_LOCK, lock: join(common, 'devkit-place.lock'),
    holder: `${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`,
    timeout: () => new LoopUsageError('another place call holds the lock for too long'),
  }, () => {
    gitRun(found.root, ['fetch', 'origin', '--prune', '--quiet']);
    if (gitRun(found.root, ['status', '--porcelain', '--', `openspec/changes/${id}`]).trim()) {
      gitRun(found.root, ['add', '--', `openspec/changes/${id}`]);
      gitRun(found.root, ['commit', '-q', '-m', `chore(openspec): plan of ${id}`]);
    }
    const archived = archivedOnDefault(start, { env, gh });
    const heldBy = gitRun(main, ['for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin']).split('\n')
      .filter((name) => name !== id && NAME.test(name) && !archived.has(name));
    const held = heldBy.filter((name) => { const c = claimOfRef(main, `refs/remotes/origin/${name}`, name); return c?.machine === machine && c.placed; }).length;
    const own = claimOfRef(main, `refs/remotes/origin/${id}`, id)?.placed === true;
    const body = (taken) => ({ version: 1, change: id, taken, machine, held, places: total });
    if (!own && held >= total) return { code: 2, body: body(false) };
    gitRun(found.root, ['push', '-q', 'origin', `${id}:refs/heads/${id}`]);
    return { code: 0, body: body(true) };
  });
}

// ---------------------------------------------------------------- the pin (change-version-pin D-1)

// The `version` of this pack's `plugin.json` (`<pluginDir>/.claude-plugin/plugin.json`), or null when the file is missing, is
// not JSON or has no string `version`.
export function packVersion(pluginDir = join(HOOKS_DIR, '..')) {
  try {
    const { version } = JSON.parse(readFileSync(join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8'));
    return typeof version === 'string' ? version : null;
  } catch { return null; }
}

const PIN_KEYS = [['devkit', 'x-devkit-version'], ['flow', 'x-devkit-flow']];

// The only writer of the pin in a change's `.openspec.yaml`: for each key, a value replaces the first line of the key (later
// lines of it are dropped) or is appended; null drops every line of the key. Every other line stays byte for byte.
export function writePin(dir, pin) {
  const file = join(dir, '.openspec.yaml');
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const lines = text === '' ? [] : text.split('\n');
  let closed = lines.at(-1) === ''; // the text ended with a newline
  if (closed) lines.pop();
  for (const [field, key] of PIN_KEYS) {
    const at = lines.flatMap((l, i) => (l.startsWith(`${key}:`) ? [i] : []));
    if (pin[field] === null || pin[field] === undefined) {
      for (const i of at.reverse()) lines.splice(i, 1);
    } else if (at.length === 0) {
      lines.push(`${key}: ${pin[field]}`);
      closed = true;
    } else {
      lines[at[0]] = `${key}: ${pin[field]}`;
      for (const i of at.slice(1).reverse()) lines.splice(i, 1);
    }
  }
  writeFileSync(file, lines.length && closed ? `${lines.join('\n')}\n` : lines.join('\n'));
}

// Records the flow the installed `script` declares, and this pack's version, as the change's pin.
function recordPin(root, dir, script) {
  writePin(dir, { devkit: packVersion(), flow: readFlow(root, script)?.version ?? null });
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
  recordPin(found.root, located.dir, script);
  return { code: 0, body: { ...body, script, reply: render(l, 'script-switched', { id, script, why }) } };
}

// `flow <id>`: moves a change to the installed version of its script's flow, only when it is asked (change-version-pin D-7).
// { code, body }. It reads the pin and the installed flow itself, not `changeFlow`, so a change whose kept file is missing
// can still be moved.
export function moveFlow(cwd, id, { lang = 'pt-BR' } = {}) {
  const l = normalizeLang(lang);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = locate(start, id);
  const located = locateChange(found.root, id);
  if (!located || located.archived) throw new LoopUsageError(`no active change named ${id}`);
  const schema = changeSchemaAt(found.root, located.dir);
  const installed = readFlow(found.root, schema)?.version;
  if (installed === undefined) throw new LoopUsageError(`the ${schema} script has no installed flow.json`);
  const version = readPin(located.dir).flow ?? 1;
  const body = { version: 1, change: id, script: schema, flow: installed };
  if (version === installed) return { code: 0, body };
  if (version > installed) return { code: 2, body: { ...body, reply: render(l, 'flow-ahead', { id, version, installed }) } };
  recordPin(found.root, located.dir, schema);
  return { code: 0, body: { ...body, reply: render(l, 'flow-moved', { id, version, installed }) } };
}

// ---------------------------------------------------------------- wait (D-7)

const isWait = (a) => a.kind === 'end' && a.end.state === 'waiting-on-github';
// What makes two decisions the same wait. A held decision (a change session waiting for a place, the load, a dependency or the owner) is the same
// while its reason is: its words carry numbers (the load) that move at every poll.
const decisionKey = (a) => JSON.stringify([a.kind, a.end?.state ?? null, a.end?.why ?? null, a.agent ?? null, a.step ?? null,
  a.kind === 'held' ? [a.held?.why ?? null, a.held?.gate ?? null, a.held?.after ?? null] : (a.reply ?? null)]);
const isUnreadable = (a) => a.kind === 'end' && (a.end.why === 'github-unreadable' || (a.end.state === 'waiting-on-github' && a.params?.what === 'silent'));

// Polls `poll()` (the decision `next` gives) every `interval` seconds while it stays the same wait on GitHub, with no
// limit of its own, and returns the first decision that is anything else (the first decision itself when it is not a
// wait). A poll that throws, that says GitHub cannot be read or that is a wait on GitHub with no answer (`what` silent) is a failed read, retried; `maxFailures` in a row return blocked,
// `github-unreadable`. Holds no state but the first decision.
export async function waitLoop({ poll, sleep, interval, id, lang, maxFailures = 3, waiting = isWait, failWhy = 'github-unreadable' }) {
  const first = await poll();
  if (!waiting(first)) return first;
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
        end: { state: 'blocked', why: failWhy }, reply: render(lang, 'blocked', { id, why: failWhy, error: message }),
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
  const flow0 = changeFlow(found.root, locateChange(found.root, change)?.dir ?? join(found.root, 'openspec', 'changes', change)).flow;
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
    'spec-reviewer', 'finding-verifier', 'screen-designer', 'adr-author', 'test-runner', 'e2e-tester', 'requirements-triage'].map((r) => [r, 'devkit-core'])),
  'openspec-validator': 'devkit-openspec',
  'change-coordinator': 'devkit-openspec',
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
  const { flow, schema } = changeFlow(found.root, locateChange(found.root, change)?.dir ?? join(found.root, 'openspec', 'changes', change));
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

// ---------------------------------------------------------------- the CompozyOS driver (compozy-driver D-1, D-3, D-4)

// The run record: `<git common dir>/devkit-compozy/<id>.json`, outside every working tree. It is bookkeeping: losing it costs one
// repeated stage (or one repeated command, or the mock-up facts of one approval), never a wrong gate.
const emptyRecord = () => ({ version: 1, handed: null, failed: null, answers: { grill: [], approvalNotes: null, retro: null, mockup: null } });
const str = (v) => (typeof v === 'string' ? v : '');

export function runRecordPath(start, id) {
  const common = tryGit(start, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (!common) throw new LoopUsageError(`${start} is not inside a git repository`);
  return join(common, 'devkit-compozy', `${id}.json`);
}

// The record as it is; an empty, cut short or non-JSON file is an empty record, and a field of the wrong type is dropped.
export function readRunRecord(file) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { return emptyRecord(); }
  if (!isObject(parsed)) return emptyRecord();
  const out = emptyRecord();
  if (isObject(parsed.handed) && str(parsed.handed.key)) out.handed = { key: parsed.handed.key, at: str(parsed.handed.at) };
  if (isObject(parsed.failed) && str(parsed.failed.key)) out.failed = { key: parsed.failed.key, reply: str(parsed.failed.reply), at: str(parsed.failed.at) };
  const answers = isObject(parsed.answers) ? parsed.answers : {};
  if (Array.isArray(answers.grill)) {
    out.answers.grill = answers.grill.filter((g) => isObject(g) && str(g.answer)).map((g) => ({ question: str(g.question), answer: g.answer, at: str(g.at) }));
  }
  for (const key of ['approvalNotes', 'retro', 'mockup']) if (str(answers[key])) out.answers[key] = answers[key];
  return out;
}

// Reads the record under its lock, gives it to `change` and writes what that returns atomically (a temp file, then a rename).
export function updateRunRecord(file, change) {
  mkdirSync(dirname(file), { recursive: true });
  return withLockFile({
    lock: `${file}.lock`, stepMs: 50, waitMs: 10_000, staleMs: 60_000,
    timeout: () => new LoopUsageError('another call holds the run record for too long'),
  }, () => {
    const next = change(readRunRecord(file));
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(temp, file);
    return next;
  });
}

// The pure answer-recording step of `record-answer`: a copy of `record` with the answer set (approval, retro) or appended (grill).
export function applyAnswer(record, gate, { answer, question = '', at }) {
  const next = structuredClone(record);
  if (gate === 'grill') next.answers.grill.push({ question, answer, at });
  else if (gate === 'approval') next.answers.approvalNotes = answer;
  else next.answers.retro = answer;
  return next;
}

// ---- the view (D-3)

// The hand-off steps are the ones `ROWS` gives a role (`AGENT_STEPS`); each has a `ship-change` row for its dispatch sentence, except
// the steps the `devkit` skill's Loop describes instead (`SKILL_LOOP_STEPS`).
const SKILL_LOOP_STEPS = ['resolve-release-conflict', 'renumber-adr'];
const SHIP_ROW_STEPS = AGENT_STEPS.filter((step) => !SKILL_LOOP_STEPS.includes(step));
const COMMAND_STEPS = ['switch-script', 'accept-decisions', 'take-place', 'merge-check'];
// The kinds whose progress key a confirmed view records as handed; any other kind clears it.
export const HANDED_KINDS = ['agent', 'coordinator', 'review', 'gate', 'command', 'open'];
const VIEW_FIELDS = ['version', 'kind', 'change', 'root', 'stage', 'stage_title', 'agent', 'step', 'brief', 'progress_key', 'question', 'reply'];
const WORDS_MAX = 200;

// { view, uses }: the action of `decide` as the loop reads it (the fourteen kinds of D-3), and what recorded fact the view was built from
// (`failure`, `mockup`, `notes`, `retro`, or null), which `confirm` clears once the view is confirmed. Pure.
export function buildView(action, record, { lang = 'pt-BR', dir } = {}) {
  const l = normalizeLang(lang);
  const id = action.change;
  const say = (key, params = {}) => render(l, key, { id, ...params });
  const stage = action.stage ?? '';
  const end = action.kind === 'end' ? action.end : null;
  // A step whose detail names a worktree and a branch (the support branch's) runs there, not in the task worktree, as `decide`'s brief says.
  const there = action.detail?.root && action.detail?.branch;
  const root = there ? action.detail.root : action.root;
  const branch = there ? action.detail.branch : action.branch;
  const make = (over, uses = null) => ({
    view: {
      version: 1, kind: '', change: id, root: root ?? '', stage, stage_title: action.stageTitle ?? '', agent: '', step: action.step ?? '',
      brief: '', progress_key: action.progressKey ?? (end ? `end/${end.state}/${end.why}/${stage}` : ''), question: '', reply: action.reply ?? '', ...over,
    },
    uses,
  });
  // The brief frame of `decide`: the change, the checkout, the files' language.
  const frame = (forStage, what) => `Change ${id}${action.script ? ` (${action.script} script)` : ''}, stage ${forStage}: ${what}. Work only in ${root}`
    + `${branch ? ` on branch ${branch}` : ''}; every file path is absolute under it; start every Bash command with cd ${root} && ; do not fetch. `
    + `Write the change's files in ${filesLanguageName(action.filesLanguage)}.`;
  const planDir = dir ?? join(action.root ?? '', 'openspec', 'changes', id);
  const coordinator = (brief, over = {}, uses = null) => make({ kind: 'coordinator', agent: 'change-coordinator', brief, ...over }, uses);

  const failed = record.failed;
  if (failed && (failed.key === record.handed?.key || failed.key === action.progressKey)) {
    return make({ kind: 'blocked', progress_key: `end/blocked/step-failed/${stage}`, question: failed.reply }, 'failure');
  }
  if (record.answers.mockup) {
    return coordinator(frame('mockup', `the owner approved the mock-up (\`${record.answers.mockup}\`): append to requirements.md, under \`## What the mock-up revealed\`, each fact the mock-up `
      + 'settled that the requirements did not hold, as the `ship-change` `stop-mockup-approval` row says (none: say so in one line); change nothing else'), { progress_key: `mockup-facts/${id}` }, 'mockup');
  }

  if (action.kind === 'open') {
    if (record.handed?.key === `open/${id}`) return make({ kind: 'blocked', progress_key: 'end/blocked/open-failed/open', question: say('blocked', { why: 'open-failed' }) });
    return make({
      kind: 'open', agent: 'change-coordinator',
      brief: frame('open', 'open the change: choose the script by the rule of the `devkit` skill\'s "A new change" and run `change-loop open` with the request; with an empty request, open nothing and return `failure`'),
    });
  }
  if (action.kind === 'agent') {
    const dispatch = SHIP_ROW_STEPS.includes(action.step) ? ` Then add the dispatch sentence of the \`ship-change\` row of step \`${action.step}\`.`
      : SKILL_LOOP_STEPS.includes(action.step) ? ` Then add the dispatch sentence of the \`devkit\` skill's Loop bullet \`${action.step}\`.` : '';
    return make({ kind: 'agent', agent: String(action.agent).split(':').pop(), brief: `${action.brief}${dispatch}` });
  }
  if (action.kind === 'session') {
    if (action.step === 'review' || action.step === 'review-resolution') return make({ kind: 'review', question: say('blocked', { why: 'role-failed', stage: action.stageTitle ?? '' }) });
    if (action.step === 'gate') return make({ kind: 'gate', question: say('blocked', { why: 'tests-red', phase: action.detail?.phase ?? '' }) });
    if (COMMAND_STEPS.includes(action.step)) return make({ kind: 'command' });
    return coordinator(frame(stage, `carry out step ${action.step} as the \`ship-change\` row of that name says, with this \`next\` object: ${JSON.stringify(action.detail ?? {})}`));
  }
  if (action.kind === 'grill') {
    const answers = record.answers.grill;
    const person = filesLanguageName(l);
    const what = answers.length === 0
      ? `run the first turn of the requirements grill (skill requirements-grill): read requirements.md and return the first question in ${person}`
      : `run the next turn of the requirements grill (skill requirements-grill): write these answers of the owner into requirements.md, ${answers.map((a, i) => `${i + 1}. ${a.question ? `question: ${a.question}; ` : ''}answer: ${a.answer}`).join(' | ')}; `
        + `then return the next question in ${person}, or an empty question once the owner answered the last one and you set the stage header to passed`;
    return make({ kind: 'grill', agent: 'change-coordinator', brief: frame('requirements', what) });
  }
  if (end?.state === 'waiting-for-owner') {
    const why = end.why;
    if (why === 'waiting-mockup') {
      return make({ kind: 'mockup', question: `${action.reply}\n${join(action.root, action.detail?.file ?? '')}\n${join(action.root, action.detail?.folder ?? '')}` });
    }
    if (why === 'waiting-approval' || why === 'waiting-approval-again') {
      if (record.answers.approvalNotes) {
        return make({ kind: 'agent', agent: 'change-planner', brief: frame('approval', `the owner did not approve the plan and asked: \`${record.answers.approvalNotes}\`; revise the plan`) }, 'notes');
      }
      return make({ kind: 'approval', question: `${action.reply}\n${planDir}/` });
    }
    if (why === 'waiting-retro') {
      if (record.answers.retro) {
        return coordinator(frame('retro', `record these answers of the owner as the \`ship-change\` \`stop-retro-answers\` row says: \`${record.answers.retro}\``), {}, 'retro');
      }
      return make({ kind: 'retro-answers', question: `${action.reply}\n${join(planDir, 'retro.md')}` });
    }
    return make({ kind: 'owner', question: action.reply });
  }
  if (end?.state === 'waiting-on-github') return make({ kind: 'github' });
  if (end?.state === 'archived') return make({ kind: 'archived' });
  return make({ kind: 'blocked', question: action.reply ?? '' });
}

export const compozyView = (action, record, ctx) => buildView(action, record, ctx).view;

// The record after a view was confirmed: the handed key (set for the six kinds of HANDED_KINDS, else cleared), the answer or failure
// the view was built from cleared, and the grill answers cleared once the requirements stage has passed. Pure.
export function afterConfirm(record, { view, uses }, action, at) {
  const next = structuredClone(record);
  next.handed = HANDED_KINDS.includes(view.kind) ? { key: view.progress_key, at } : null;
  if (uses === 'notes') next.answers.approvalNotes = null;
  if (uses === 'retro') next.answers.retro = null;
  if (uses === 'mockup') next.answers.mockup = null;
  if (uses !== 'failure') next.failed = null;
  if (action.kind !== 'grill' && action.kind !== 'open' && action.stage && action.stage !== 'requirements') next.answers.grill = [];
  return next;
}

// What the loop reads for change `id`: { action, view, uses, record, file, start }. A change no checkout holds is the `open` action
// of the run (it opens the change itself); any other is `nextAction`, given the key the record holds as handed as `--after`, so that
// K1 and K2 catch a turn that changed nothing. `guard: false` gives no `--after`: the view of a record step is the one the checker gives
// for the step about to run, whose own key `confirm` has just recorded as handed and which has not changed anything yet.
export function compozyState(cwd, id, { env = process.env, lang = 'pt-BR', openspec, gh, guard = true } = {}) {
  if (!NAME.test(id) || id === 'archive') throw new LoopUsageError(`${id} cannot be a change name`);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const l = normalizeLang(lang);
  const file = runRecordPath(start, id);
  const record = readRunRecord(file);
  let action;
  let dir;
  if (knownChange(start, id)) {
    action = nextAction(cwd, id, { env, lang: l, after: guard ? record.handed?.key ?? null : null, openspec, gh });
    dir = locateChange(action.root, id)?.dir;
  } else {
    const main = mainRoot(start);
    action = {
      version: 1, kind: 'open', change: id, script: null, root: main, branch: tryGit(main, ['symbolic-ref', '--short', '-q', 'HEAD']),
      filesLanguage: filesLanguageOf(readDevkitSettings(main)), stage: 'open', stageTitle: '', progressKey: `open/${id}`,
    };
  }
  return { start, file, record, action, lang: l, id, ...buildView(action, record, { lang: l, dir }) };
}

const sameView = (given, view) => isObject(given) && Object.keys(given).length === VIEW_FIELDS.length && VIEW_FIELDS.every((f) => given[f] === view[f]);
const now = () => new Date().toISOString();
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// The owner's words as one line of at most 200 characters, with no backtick (the forms wrap them in quotes or backticks).
const wordsOf = (value) => {
  const words = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, WORDS_MAX).replace(/`/g, "'");
  if (!words) throw new LoopUsageError('the owner\'s words are empty');
  return words;
};

// ---- compozy-start (D-1)

export const READINESS_KEY = { 'not-installed': 'compozy-not-installed', 'daemon-stopped': 'compozy-stopped', 'workspace-unknown': 'compozy-workspace', 'kit-missing': 'compozy-kit-missing' };

// `compozy-start <id>`: rows C1 to C8. { code, body }; a refusal is code 3 with its mode and reply, nothing started.
export function compozyStart(cwd, id, { request = '', lang = 'pt-BR', env = process.env } = {}) {
  const l = normalizeLang(lang);
  const stop = (mode, reply) => ({ code: 3, body: { version: 1, mode, change: id, runId: null, url: null, reply } });
  const done = (mode, runId, url, reply) => ({ code: 0, body: { version: 1, mode, change: id, runId, url, reply } });
  if (!NAME.test(id) || id === 'archive') return stop('name-invalid', render(l, 'name-invalid', { id })); // C1
  const start = findRoot(cwd);
  const settings = start ? readDevkitSettings(start) : { driver: 'claude', language: 'en', unknown: [] };
  const gate = projectGate(start, settings, 'change');
  if (gate) return stop(gate.mode, render(l, gate.key, gate.params)); // C2
  const main = mainRoot(start);
  const ready = readiness(main, { env });
  if (!ready.ok) return stop('compozy-unavailable', render(l, READINESS_KEY[ready.reason], { fix: ready.fix })); // C3
  const running = liveRuns(main, CHANGE_LOOP, { env }).find((r) => r.inputs?.change_id === id);
  if (running) return done('compozy-running', running.runId, null, render(l, 'compozy-running', { id, run: running.runId })); // C4
  const words = String(request ?? '').trim();
  const begin = () => {
    const { runId, url } = startRun(main, CHANGE_LOOP, { change_id: id, request: words, lang: l }, { env });
    return done('compozy-started', runId, url, url ? render(l, 'compozy-started', { id, url }) : render(l, 'compozy-started-no-url', { id, run: runId }));
  };
  if (knownChange(start, id)) return begin(); // C5, an empty request
  if (words === '') throw new LoopUsageError('compozy-start needs the request on standard input for a new change'); // C6
  if (nameTaken(start, main, id)) return stop('name-taken', render(l, 'name-taken', { id })); // C7
  // The refusals `open` makes from the delivery model are known now: the run would only fail late, with `open-failed`, after the owner waited.
  if (gitRun(main, ['remote']).split('\n').includes('origin')) {
    tryGit(main, ['fetch', 'origin', '--prune', '--quiet']); // as `open` does, so a test branch pushed a minute ago is seen; a failed fetch leaves the refs as they are
    try { deliveryBase(main, id, (key, params = {}) => new LoopRefusal(key, render(l, key, params))); } catch (e) {
      if (e instanceof LoopRefusal) return stop(e.message, e.reply);
      throw e;
    }
  }
  return begin(); // C8
}

// ---- the record steps (D-4)

const refusal = (what) => new LoopUsageError(`${what}: nothing was written or run`);
const changeFolder = (action, id) => locateChange(action.root, id)?.dir ?? join(action.root, 'openspec', 'changes', id);
const headOf = (root) => tryGit(root, ['rev-parse', 'HEAD']) || 'none';

// The text of approval.md in the form of the `stop-plan-approval` row of `ship-change`.
export function approvalText({ id, attempt, commit, readiness: hash, date, words }) {
  return `<!-- devkit-stage approval result=passed attempt=${attempt} commit=${commit} -->\n# Plan approval: ${id}\n\n- Status: APPROVED\n- Readiness: ${hash}\n- Date: ${date}\n- Owner's words: "\`${words}\`"\n`;
}

// The text of mockup.md after the owner's answer, in the form of the `stop-mockup-approval` row: `approve` or `changes`.
export function mockupText({ text: current, header, decision, date, commit, words }) {
  const lineEnd = current.indexOf('\n');
  const body = `${(lineEnd === -1 ? '' : current.slice(lineEnd + 1)).replace(/\s*$/, '')}\n`;
  if (decision === 'approve') {
    return `<!-- devkit-stage mockup result=passed attempt=${header.attempt} commit=${commit} -->\n${body}\n## Owner's approval\n\n- Date: ${date}\n- Owner's words: "${words}"\n`;
  }
  return `<!-- devkit-stage mockup result=failed attempt=${header.attempt} commit=${commit} -->\n${body}\n## Owner's notes (attempt ${header.attempt})\n\n${words}\n`;
}

const stateFor = (cwd, id, kind, ctx) => {
  const st = compozyState(cwd, id, { ...ctx, guard: false });
  if (st.view.kind !== kind) throw refusal(`the run does not ask for the ${kind} now (it asks for ${st.view.kind || 'nothing'})`);
  return st;
};

export function recordApproval(cwd, id, { words, lang, env, openspec, gh } = {}) {
  const st = stateFor(cwd, id, 'approval', { env, lang, openspec, gh });
  const dir = changeFolder(st.action, id);
  const hash = approvalState(dir).readiness;
  if (!hash) throw refusal('the plan has no readiness.md to approve');
  const file = join(dir, 'approval.md');
  const earlier = existsSync(file) ? parseStageHeader(readFileSync(file, 'utf8')) : null;
  const attempt = earlier && !earlier.malformed ? earlier.attempt + 1 : 1;
  writeFileSync(file, approvalText({ id, attempt, commit: headOf(st.action.root), readiness: hash, date: today(), words: wordsOf(words) }));
  return { version: 1, change: id, recorded: 'approval', attempt };
}

export function recordMockup(cwd, id, { decision, words, lang, env, openspec, gh } = {}) {
  if (decision !== 'approve' && decision !== 'changes') throw new LoopUsageError('record-mockup needs --decision approve or changes');
  const st = stateFor(cwd, id, 'mockup', { env, lang, openspec, gh });
  const file = join(changeFolder(st.action, id), 'mockup.md');
  let current;
  try { current = readFileSync(file, 'utf8'); } catch { throw refusal('mockup.md cannot be read'); }
  const header = parseStageHeader(current);
  if (!header || header.malformed || header.stage !== 'mockup') throw refusal('mockup.md has no valid mockup stage header');
  const owner = wordsOf(words);
  writeFileSync(file, mockupText({ text: current, header, decision, date: today(), commit: headOf(st.action.root), words: owner }));
  if (decision === 'approve') updateRunRecord(st.file, (record) => ({ ...record, answers: { ...record.answers, mockup: owner } }));
  return { version: 1, change: id, recorded: 'mockup', decision };
}

const GATE_VIEW = { grill: 'grill', approval: 'approval', retro: 'retro-answers' };

export function recordAnswer(cwd, id, { gate, answer, question, lang, env, openspec, gh } = {}) {
  if (!Object.hasOwn(GATE_VIEW, gate)) throw new LoopUsageError(`record-answer needs --gate ${Object.keys(GATE_VIEW).join(', ')}`);
  if (!String(answer ?? '').trim()) throw new LoopUsageError('record-answer needs --answer');
  const st = stateFor(cwd, id, GATE_VIEW[gate], { env, lang, openspec, gh });
  updateRunRecord(st.file, (record) => applyAnswer(record, gate, { answer: String(answer), question: String(question ?? ''), at: now() }));
  return { version: 1, change: id, recorded: gate };
}

// Ticks the gate task `task` of tasks.md: `- [ ] <task> ...` becomes `- [x] <task> ...`.
function tickTask(file, task) {
  const escaped = task.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^(\\s*[-*]\\s+\\[) (\\]\\s+${escaped}\\s)`, 'm');
  const body = readFileSync(file, 'utf8');
  if (!pattern.test(body)) throw new LoopUsageError(`tasks.md has no open task ${task}`);
  writeFileSync(file, body.replace(pattern, '$1x$2'));
}

// { code, body }: 0 when every `&&` part of the gate is green (the task is ticked), 1 at the first red part (nothing ticked).
export function runGate(cwd, id, { lang, env, openspec, gh } = {}) {
  const st = stateFor(cwd, id, 'gate', { env, lang, openspec, gh });
  const { command, task } = st.action.detail;
  for (const part of String(command).split(/\s+&&\s+/)) {
    const r = spawnSync('/bin/sh', ['-c', part], { cwd: st.action.root, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) {
      const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-20).join('\n');
      return { code: 1, body: { version: 1, change: id, task, green: false, failed: part, output: tail } };
    }
  }
  tickTask(join(changeFolder(st.action, id), 'tasks.md'), task);
  return { code: 0, body: { version: 1, change: id, task, green: true } };
}

// Runs the argv the checker built, in `cwd`, no shell: { ok: true } on exit 0, else { ok: false, reply } with the `reply` field of its
// JSON output when it prints one, else the blocked reply with why role-failed.
export function runViewCommand(command, { cwd, lang, id, stageTitle, env = process.env }) {
  const r = spawnSync(command[0], command.slice(1), { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (!r.error && r.status === 0) return { ok: true, reply: '' };
  let reply = '';
  try { const out = JSON.parse(r.stdout); if (typeof out?.reply === 'string') reply = out.reply; } catch { /* no JSON: the generic reply */ }
  return { ok: false, reply: reply || render(lang, 'blocked', { id, why: 'role-failed', stage: stageTitle ?? '' }) };
}

export function runStepCommand(cwd, id, { lang, env, openspec, gh } = {}) {
  const st = stateFor(cwd, id, 'command', { env, lang, openspec, gh });
  const result = runViewCommand(st.action.detail.command, { cwd: st.action.root, lang: st.lang, id, stageTitle: st.action.stageTitle, env: env ?? process.env });
  if (result.ok) {
    updateRunRecord(st.file, (record) => ({ ...record, failed: null }));
    return { code: 0, body: { version: 1, change: id, step: st.action.step, ok: true } };
  }
  updateRunRecord(st.file, (record) => ({ ...record, failed: { key: st.view.progress_key, reply: result.reply, at: now() } }));
  return { code: 1, body: { version: 1, change: id, step: st.action.step, ok: false, reply: result.reply } };
}

export function compozyRetry(cwd, id) {
  if (!NAME.test(id) || id === 'archive') throw new LoopUsageError(`${id} cannot be a change name`);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  updateRunRecord(runRecordPath(start, id), (record) => ({ ...record, handed: null, failed: null }));
  return { version: 1, change: id, retried: true };
}

// ---------------------------------------------------------------- the command line (D-5)

const USAGE = 'usage: change-loop.mjs next --change <id> --lang <pt-BR|en> [--after <progress-key>] | reply <key> --lang <l> [--param name=value]... [--stdin <name>] '
  + '| start --lang <l> (the request on standard input) | open <id> --script <devkit|devkit-lite> --why <code> [--task <KEY>] --lang <l> [--machine <name>] [--places <n|run>] [--remote] (the request on standard input, or with --task the task as JSON) '
  + '| write-back ask <id> --lang <l> (the pull request as JSON on standard input) | write-back answer <id> --choice <comment|no|transition:<id>> --lang <l> | script <id> <devkit|devkit-lite> --why <code> --lang <l> | place <id> --lang <l> | accept-decisions <id> --lang <l> | merge-check <id> --lang <l> | flow <id> --lang <l> | wait --change <id> --lang <l> [--interval <seconds>] | state [--change <id>] --lang <l> '
  + '| next --change <id> --lang <l> --view compozy | compozy-start <id> --lang <l> (the request on standard input) | confirm --change <id> --lang <l> --view <json> '
  + '| record-approval --change <id> --words <text> --lang <l> | record-mockup --change <id> --decision <approve|changes> --words <text> --lang <l> '
  + '| record-answer --change <id> --gate <grill|approval|retro> --answer <text> [--question <text>] --lang <l> | run-gate --change <id> --lang <l> '
  + '| run-step --change <id> --lang <l> | compozy-retry --change <id>';

function parseArgs(argv, { values = [], multi = [], flags = [] } = {}) {
  const opts = { positional: [], params: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (flags.includes(a)) opts[a.slice(2)] = true;
    else if (values.includes(a) || multi.includes(a)) {
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
export const loopOutput = (id, action) => `devkit-run: ${id}\n${action.kind === 'end' ? `devkit-end: ${id} ${action.end.state}\n` : ''}${json(action)}`;

// The keys the session renders itself that end the run, and the state each one records.
const END_OF_KEY = { blocked: 'blocked', 'waiting-pr-decision': 'waiting-for-owner' };

function runNext(args, { env, cwd, openspec, gh }) {
  const opts = parseArgs(args, { values: ['--change', '--lang', '--after', '--view'] });
  if (!opts.change || opts.positional.length) throw new LoopUsageError(USAGE);
  if (opts.view !== undefined) {
    // The CompozyOS view (D-3): the object alone, no `devkit-run:` line; the handed key of the run record is the `--after`.
    if (opts.view !== 'compozy') throw new LoopUsageError(`--view needs compozy; ${USAGE}`);
    return { code: 0, stdout: json(compozyState(cwd, opts.change, { env, lang: opts.lang, openspec, gh }).view), stderr: '' };
  }
  const action = nextAction(cwd, opts.change, { env, lang: opts.lang, after: opts.after ?? null, openspec, gh, budget: true, strictModels: true, retry: opts.after !== undefined });
  return { code: exitCodeOf(action), stdout: loopOutput(opts.change, action), stderr: '' };
}

function runState(args, { env, cwd, openspec, gh }) {
  const opts = parseArgs(args, { values: ['--change', '--lang'] });
  if (opts.positional.length) throw new LoopUsageError(USAGE);
  const changes = stateEntries(cwd, { id: opts.change ?? null, lang: opts.lang, env, openspec, gh });
  return { code: 0, stdout: json({ version: 1, changes }), stderr: '' };
}

// The text a heredoc hands over: the input without its one final line break, `\r\n` or else `\n`.
const withoutFinalBreak = (text) => (text.endsWith('\r\n') ? text.slice(0, -2) : text.endsWith('\n') ? text.slice(0, -1) : text);

// `--stdin <name>`: the parameter `name` is read from standard input, so a text with quotes, `$` or line breaks never
// goes through the command line (jira-entry-followups D-5).
function runReply(args, { stdin = '' } = {}) {
  const opts = parseArgs(args, { values: ['--lang', '--stdin'], multi: ['--param'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const params = {};
  for (const p of opts.params) {
    const eq = p.indexOf('=');
    if (eq < 1) throw new LoopUsageError(`--param needs name=value, got ${p}`);
    params[p.slice(0, eq)] = p.slice(eq + 1);
  }
  if (opts.stdin !== undefined) {
    if (!/^[a-z][a-zA-Z]*$/.test(opts.stdin)) throw new LoopUsageError('--stdin needs a parameter name of letters, starting with a lower-case one');
    if (Object.hasOwn(params, opts.stdin)) throw new LoopUsageError(`--param ${opts.stdin} and --stdin ${opts.stdin} name the same parameter`);
    const value = withoutFinalBreak(stdin);
    if (value === '') throw new LoopUsageError(`reply --stdin ${opts.stdin} needs the text on standard input`);
    params[opts.stdin] = value;
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

function runCompozyStart(args, { env, cwd, stdin }) {
  const opts = parseArgs(args, { values: ['--lang'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const { code, body } = compozyStart(cwd, opts.positional[0], { request: stdin, lang: opts.lang, env });
  return { code, stdout: json(body), stderr: '' };
}

// `--change <id> [--lang <l>] <the options of the step>`: the shared parse of the confirm and record steps.
function changeOptions(args, values) {
  const opts = parseArgs(args, { values: ['--change', '--lang', ...values] });
  if (!opts.change || opts.positional.length) throw new LoopUsageError(USAGE);
  return opts;
}

function runConfirm(args, { env, cwd, openspec, gh }) {
  const opts = changeOptions(args, ['--view']);
  if (opts.view === undefined) throw new LoopUsageError(USAGE);
  const st = compozyState(cwd, opts.change, { env, lang: opts.lang, openspec, gh });
  let given = null;
  try { given = JSON.parse(opts.view); } catch { /* an unparsable view differs from the current one */ }
  if (!sameView(given, st.view)) return { code: 1, stdout: json(st.view), stderr: '' };
  updateRunRecord(st.file, (record) => afterConfirm(record, st, st.action, now()));
  return { code: 0, stdout: json(st.view), stderr: '' };
}

function runRecord(sub, args, { env, cwd, openspec, gh }) {
  const common = { env, openspec, gh };
  if (sub === 'record-approval') {
    const opts = changeOptions(args, ['--words']);
    if (opts.words === undefined) throw new LoopUsageError(USAGE);
    return { code: 0, stdout: json(recordApproval(cwd, opts.change, { ...common, words: opts.words, lang: opts.lang })), stderr: '' };
  }
  if (sub === 'record-mockup') {
    const opts = changeOptions(args, ['--decision', '--words']);
    if (opts.words === undefined || opts.decision === undefined) throw new LoopUsageError(USAGE);
    return { code: 0, stdout: json(recordMockup(cwd, opts.change, { ...common, decision: opts.decision, words: opts.words, lang: opts.lang })), stderr: '' };
  }
  if (sub === 'record-answer') {
    const opts = changeOptions(args, ['--gate', '--answer', '--question']);
    if (opts.gate === undefined || opts.answer === undefined) throw new LoopUsageError(USAGE);
    return { code: 0, stdout: json(recordAnswer(cwd, opts.change, { ...common, gate: opts.gate, answer: opts.answer, question: opts.question, lang: opts.lang })), stderr: '' };
  }
  if (sub === 'run-gate') {
    const opts = changeOptions(args, []);
    const { code, body } = runGate(cwd, opts.change, { ...common, lang: opts.lang });
    return { code, stdout: json(body), stderr: '' };
  }
  if (sub === 'run-step') {
    const opts = changeOptions(args, []);
    const { code, body } = runStepCommand(cwd, opts.change, { ...common, lang: opts.lang });
    return { code, stdout: json(body), stderr: '' };
  }
  return { code: 0, stdout: json(compozyRetry(cwd, changeOptions(args, []).change)), stderr: '' }; // compozy-retry
}

const RECORD_STEPS = ['record-approval', 'record-mockup', 'record-answer', 'run-gate', 'run-step', 'compozy-retry'];

function runOpen(args, { env, cwd, stdin, openspec, gh }) {
  const opts = parseArgs(args, { values: ['--script', '--why', '--task', '--lang', '--machine', '--places'], flags: ['--remote'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const result = openChange(cwd, opts.positional[0], { script: opts.script, why: opts.why, request: stdin, task: opts.task, lang: opts.lang, env, openspec, gh, machine: opts.machine, places: opts.places, remote: opts.remote === true });
  return { code: 0, stdout: `devkit-run: ${result.change}\n${json(result)}`, stderr: '' };
}

const WRITE_BACK_CHOICE = /^(?:comment|no|transition:\S+)$/;

// `write-back answer <id> --choice <c>`: what the session may write to Jira for the developer's answer. The answer is recorded
// before the session writes, so a repeated call never comments twice. Writes only that record.
export function writeBackAnswer(cwd, id, { choice, lang = 'pt-BR', env = process.env, gh } = {}) {
  const l = normalizeLang(lang);
  const { start, found, task } = taskChangeOf(cwd, id, env);
  if (!WRITE_BACK_CHOICE.test(String(choice ?? ''))) throw new LoopUsageError('write-back answer needs --choice comment, no or transition:<id>');
  const file = writeBackFile(found.root, id);
  const record = readWriteBack(file);
  const none = (why, key = 'write-back-none', params = {}) => ({ version: 1, change: id, key: task.key, write: false, why, reply: render(l, key, { id, key: task.key, ...params }) });
  if (!record || record.corrupt || record.key !== task.key) return none('not-asked');
  if (record.answer) return none('answered');
  const answer = (written) => saveWriteBack(file, { ...record, answer: { choice, at: new Date().toISOString(), written } });
  if (archivedOnDefault(start, { env, gh }).has(id)) { answer(false); return none('archived', 'write-back-late'); }
  if (choice === 'no') { answer(false); return none('no'); }
  const transition = choice === 'comment' ? null : record.transitions.find((t) => `transition:${t.id}` === choice) ?? null;
  if (choice !== 'comment' && !transition) {
    const labels = writeBackChoices(record.transitions).map((c) => render(l, `choice.${c.kind}`, { name: c.name }));
    return none('unknown-choice', 'write-back-unknown', { choices: labels.join('; ') });
  }
  answer(true);
  const comment = commentText(filesLanguageOf(readDevkitSettings(found.root)), { url: record.url, id });
  const reply = render(l, transition ? 'write-back-moved' : 'write-back-commented', { key: task.key, number: record.number, name: transition?.name });
  return { version: 1, change: id, key: task.key, write: true, comment, transition: transition ? { id: transition.id, name: transition.name } : null, reply };
}

function runWriteBack(args, { env, cwd, stdin, gh }) {
  const [sub, ...rest] = args;
  if (sub === 'ask') {
    const opts = parseArgs(rest, { values: ['--lang'] });
    if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
    return { code: 0, stdout: json(writeBackAsk(cwd, opts.positional[0], { input: stdin, lang: opts.lang, env, gh })), stderr: '' };
  }
  if (sub === 'answer') {
    const opts = parseArgs(rest, { values: ['--choice', '--lang'] });
    if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
    return { code: 0, stdout: json(writeBackAnswer(cwd, opts.positional[0], { choice: opts.choice, lang: opts.lang, env, gh })), stderr: '' };
  }
  throw new LoopUsageError(USAGE);
}

function runPlace(args, { env, cwd, gh }) {
  const opts = parseArgs(args, { values: ['--lang'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const { code, body } = placeChange(cwd, opts.positional[0], { env, gh });
  return { code, stdout: json(body), stderr: '' };
}

function runScript(args, { cwd }) {
  const opts = parseArgs(args, { values: ['--why', '--lang'] });
  if (opts.positional.length !== 2) throw new LoopUsageError(USAGE);
  const { code, body } = switchScript(cwd, opts.positional[0], opts.positional[1], { why: opts.why, lang: opts.lang });
  return { code, stdout: json(body), stderr: '' };
}

function runFlow(args, { cwd }) {
  const opts = parseArgs(args, { values: ['--lang'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  const { code, body } = moveFlow(cwd, opts.positional[0], { lang: opts.lang });
  return { code, stdout: json(body), stderr: '' };
}

function runMergeCheck(args, { env, cwd, openspec }) {
  const opts = parseArgs(args, { values: ['--lang'] });
  if (opts.positional.length !== 1) throw new LoopUsageError(USAGE);
  return { code: 0, stdout: json(mergeCheck(cwd, opts.positional[0], { env, openspec })), stderr: '' };
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
    if (sub === 'reply') return runReply(rest, { stdin });
    if (sub === 'state') return runState(rest, { env, cwd, openspec, gh });
    if (sub === 'start') return runStart(rest, { env, cwd, stdin, openspec, gh });
    if (sub === 'open') return runOpen(rest, { env, cwd, stdin, openspec, gh });
    if (sub === 'write-back') return runWriteBack(rest, { env, cwd, stdin, gh });
    if (sub === 'script') return runScript(rest, { cwd });
    if (sub === 'place') return runPlace(rest, { env, cwd, gh });
    if (sub === 'accept-decisions') return runAccept(rest, { cwd });
    if (sub === 'compozy-start') return runCompozyStart(rest, { env, cwd, stdin });
    if (sub === 'confirm') return runConfirm(rest, { env, cwd, openspec, gh });
    if (RECORD_STEPS.includes(sub)) return runRecord(sub, rest, { env, cwd, openspec, gh });
    if (sub === 'flow') return runFlow(rest, { cwd });
    if (sub === 'merge-check') return runMergeCheck(rest, { env, cwd, openspec });
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
  runCommand(argv, { stdin: ['start', 'open', 'write-back', 'compozy-start'].includes(argv[0]) || (argv[0] === 'reply' && argv.includes('--stdin')) ? readStdin() : '' }).then((r) => {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exitCode = r.code;
  });
}
