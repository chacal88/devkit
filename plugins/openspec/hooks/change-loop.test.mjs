// node --test --test-name-pattern="^change-loop" plugins/openspec/hooks/change-loop.test.mjs
// change-coordinator: the loop, its commands and its locks (phase 1: settings, replies and the decision; phase 2: start, open, script, wait; phase 3: the locks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync, utimesSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { hostname } from 'node:os';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { gitRepo, put, commitAll, git, openspecStub } from './deliver-check.test.mjs';
import { roundRepo } from './conduct-check.test.mjs';
import { shipConfig, collectState, buildReport, approvalState } from './deliver-check.mjs';
import { actorOf } from './conduct-check.mjs';
import { pinsIn } from './release-merge.mjs';
import { TEXT } from './flow-check.mjs';
import * as guardModule from './guard.mjs';
import * as changeLoopModule from './change-loop.mjs';
import {
  readDevkitSettings, normalizeLang, MESSAGES, render, decide, exitCodeOf, ROW_STEPS, main, HOOKS_DIR, LoopUsageError,
  runCommand, waitLoop, PACKS, withLockFile, openChange, nextAction,
} from './change-loop.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS = join(HERE, '..', 'schemas');
const LOOP = join(HERE, 'change-loop.mjs');

// Every env a test of this file builds blanks the branch variables together (CONTRIBUTING.md, testing rules).
const SET = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', CLAUDE_CODE_SESSION_ID: '' };
export const cleanEnv = { ...process.env, ...SET };

const TDD = 'devkit-core:tdd-implementer';
const COMMIT = 'devkit-core:commit-and-pr';
const PLANNER = 'devkit-core:change-planner';
const READINESS = 'devkit-core:plan-readiness-reviewer';
const VERIFIER = 'devkit-core:pr-verifier';

export const FLOWS = Object.fromEntries(['devkit', 'devkit-lite'].map((s) => [s, JSON.parse(readFileSync(join(SCHEMAS, s, 'flow.json'), 'utf8'))]));
const read = (f) => readFileSync(join(HERE, f), 'utf8');

// ---------------------------------------------------------------- settings (D-9)

function configRepo(text) {
  const root = tmpFolder('devkit-change-loop-cfg-');
  mkdirSync(join(root, 'openspec'), { recursive: true });
  if (text !== null) writeFileSync(join(root, 'openspec', 'config.yaml'), text);
  return root;
}

test('change-loop settings: no block gives en and claude', () => {
  for (const text of ['schema: devkit\n', 'schema: devkit\ndevkit:\n', 'schema: devkit\ndevkit:\n  driver:\n', null]) {
    assert.deepEqual(readDevkitSettings(configRepo(text)), { driver: 'claude', language: 'en', unknown: [] }, JSON.stringify(text));
  }
});

test('change-loop settings: a block with both keys, quoted and with a comment', () => {
  const plain = readDevkitSettings(configRepo('schema: devkit\ndevkit:\n  language: pt-BR\n  driver: compozy\n'));
  assert.deepEqual(plain, { driver: 'compozy', language: 'pt-BR', unknown: [] });
  const dressed = readDevkitSettings(configRepo('schema: devkit\ndevkit:   # the settings\n  language: "en-GB"   # the files\n  driver: \'script\'  # who runs it\nship:\n  devkit: pr\n'));
  assert.deepEqual(dressed, { driver: 'script', language: 'en-GB', unknown: [] });
});

test('change-loop settings: an unknown driver and a value that is not a language tag are flagged', () => {
  const s = readDevkitSettings(configRepo('devkit:\n  language: "not a tag"\n  driver: robot\n'));
  assert.deepEqual(s.unknown.map((u) => [u.setting, u.value]), [['driver', 'robot'], ['language', 'not a tag']]);
  assert.match(s.unknown.find((u) => u.setting === 'driver').accepted, /claude.*compozy.*script/);
  assert.deepEqual(readDevkitSettings(configRepo('devkit:\n  language: english\n')).unknown.map((u) => u.setting), ['language']);
});

test('change-loop settings: other keys of the block and keys of other blocks are ignored', () => {
  const s = readDevkitSettings(configRepo('devkit:\n  mockups: always\n  driver: claude\nship:\n  language: fr\n  driver: robot\n'));
  assert.deepEqual(s, { driver: 'claude', language: 'en', unknown: [] });
});

test('change-loop settings: shipConfig of deliver-check gives the same with and without the block', () => {
  const base = 'schema: devkit\nship:\n  devkit: pr\nmerge_method: squash\n';
  const withBlock = `${base}devkit:\n  language: pt-BR\n  driver: claude\n`;
  assert.deepEqual(shipConfig(configRepo(withBlock), 'devkit'), shipConfig(configRepo(base), 'devkit'));
  assert.equal(shipConfig(configRepo(withBlock), 'devkit').ship, 'pr');
});

// ---------------------------------------------------------------- replies (D-9)

const SAMPLE = {
  id: 'add-csv-export', n: 2, list: 'add-csv-export', verb: 'roadmap', round: 18, value: 'fr', accepted: 'claude, compozy, script',
  number: 12, url: 'https://github.com/o/r/pull/12', error: 'timeout', attempt: 3, phase: 2, where: 'the next step', stage: 'Code review',
  places: 3, open: 2, load: 92, limit: 80, queue: 5, archived: 9, word: 'many', after: 'add-csv-import', gate: 'approval', phases: 4,
  version: 1, state: 'github', machine: 'avel', taken: 1, entry: 'avel', field: 'folder',
  branch: 'develop', base: 'master', default: 'main', installed: '2.46.0', minimum: '2.50.0', key: 'PROJ-482', name: 'In Review', choices: 'move it to "In Review"; only comment; no',
  spent: 2100000, cap: 2000000, tag: 'v1.3.0', at: 'd4e5f60', sha: 'a1b2c3d', models: 'opus 3210, sonnet 1105', tokens: 4315, from: 'haiku', to: 'sonnet',
  file: '/work/repo/.claude/worktrees/add-csv-export/openspec/changes/add-csv-export/.openspec.yaml',
};
// The one reply that names a file: the budget stop names the change's settings file, where the owner raises the cap.
const NAMES_ITS_FILE = ['waiting-budget'];
const STAGE_SAMPLE = { en: 'Code review', 'pt-BR': 'Revisão de código' };
const tokensOf = (template) => [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
const codes = (lang, prefix) => Object.keys(MESSAGES[lang]).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));

// The keys whose `{why}` is a blocked reason (`blocked-why.` codes); written out here so the test pins the list of `render`.
const BLOCKED_WHY_KEYS = ['blocked', 'roadmap-blocked', 'roadmap-blocked-others', 'need.blocked'];

// Every combination the table can render: a key, and for a parameter that names a code, each code of its family.
function renderings(lang) {
  const out = [];
  for (const [key, template] of Object.entries(MESSAGES[lang])) {
    const base = { ...SAMPLE, stage: STAGE_SAMPLE[lang], title: STAGE_SAMPLE[lang], script: 'devkit', other: 'devkit-lite', setting: 'driver', driver: 'compozy', what: 'checks', why: 'small' };
    const tokens = tokensOf(template);
    const family = tokens.includes('why') ? (BLOCKED_WHY_KEYS.includes(key) ? codes(lang, 'blocked-why.') : codes(lang, 'why.'))
      : tokens.includes('what') ? codes(lang, 'what.')
        : tokens.includes('driver') ? codes(lang, 'driver.')
          : tokens.includes('setting') ? codes(lang, 'setting.')
            : tokens.includes('gate') ? codes(lang, 'gate.')
              : tokens.includes('script') ? codes(lang, 'script.') : [null];
    const slot = ['why', 'what', 'driver', 'setting', 'gate', 'script'].find((t) => tokens.includes(t));
    for (const code of family) out.push({ key, text: render(lang, key, slot && code ? { ...base, [slot]: code } : base) });
  }
  return out;
}

const hyphenated = (names) => names.filter((n) => n.includes('-'));
const wordRe = (name) => new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);

test('change-loop replies: no internal term in either language', () => {
  const ids = Object.values(FLOWS).flatMap((f) => f.stages.flatMap((s) => [s.id, s.role, ...(s.helpers ?? [])]));
  const deliverSteps = [...read('deliver-check.mjs').matchAll(/\bstep\('([a-z][a-z-]*)'/g)].map((m) => m[1]);
  // One-word ids, steps and reason codes (review, retro, archived) are English words the owner uses and stay allowed.
  const refusedIds = [...new Set([...hyphenated(ids), ...hyphenated(deliverSteps), ...hyphenated(Object.keys(TEXT.en))])];
  const refusedWords = ['flow-check', 'deliver-check', 'conduct-check', 'change-loop', 'roadmap-loop', 'load_limit', 'devkit-core', 'devkit-openspec', 'devkit-lite', 'subagent', 'progressKey', 'reasonCode', 'onFail'];
  assert.ok(refusedIds.length > 20 && refusedIds.includes('code-quality-reviewer') && refusedIds.includes('stop-branch') && refusedIds.includes('no-progress'));
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES['pt-BR']).sort(), 'the same keys in both languages');
  // Parameter texts the design table gives identically in both languages (a product name and a word that is the same).
  const EXEMPT_EQUAL = ['driver.compozy', 'setting.driver', 'roadmap-stayed', 'need.owner', 'running.stage', 'setting.budget'];
  for (const lang of ['en', 'pt-BR']) {
    for (const { key, text } of renderings(lang)) {
      assert.ok(typeof text === 'string' && text.length > 0 && !/undefined|NaN|\[object|\{\w+\}/.test(text), `${lang} ${key}: ${text}`);
      assert.ok(!text.includes('`'), `${lang} ${key} has a backtick: ${text}`);
      if (!NAMES_ITS_FILE.includes(key)) assert.ok(!/[\w.-]+\.(md|json|mjs|js|ts|ya?ml)\b/.test(text), `${lang} ${key} names a file: ${text}`);
      assert.ok(!/\b[a-z][\w-]*=\S/i.test(text), `${lang} ${key} has a name=value shape: ${text}`);
      for (const name of [...refusedIds, ...refusedWords]) assert.ok(!wordRe(name).test(text), `${lang} ${key} holds ${name}: ${text}`);
      assert.ok(!/(^|\s)--[a-z]/i.test(text), `${lang} ${key} holds an option: ${text}`);
      assert.ok(!/(^|\s)\?(\s|$)/.test(text), `${lang} ${key} holds a lone ?: ${text}`);
    }
  }
  // The usage error's reply (exit 3 of main on an unknown option, a missing change) is one more message of the table.
  for (const lang of ['en', 'pt-BR']) {
    for (const argv of [['next', '--lang', lang, '--bogus'], ['next', '--lang', lang], ['open', '--lang', lang, '--script', 'devkit'], ['reply', 'no-such-key', '--lang', lang], ['teleport', '--lang', lang]]) {
      const r = main(argv, { cwd: tmpRoot(), env: cleanEnv });
      const { reply, error } = JSON.parse(r.stdout);
      assert.equal(r.code, 3, argv.join(' '));
      assert.equal(reply, MESSAGES[lang]['request-unreadable'], `${lang}: ${argv.join(' ')}`);
      assert.ok(!/(^|\s)--[a-z]/i.test(reply) && !/(^|\s)\?(\s|$)/.test(reply) && !/change-loop|\.mjs/.test(reply), reply);
      assert.ok(error.length > 0, 'the raw message stays in the error field');
    }
  }
  assert.ok(MESSAGES.en['request-unreadable'] && MESSAGES['pt-BR']['request-unreadable'], 'the key is in both languages');
  // The two checks above refuse what the old reply held: an option and a lone question mark.
  assert.ok(/(^|\s)--[a-z]/i.test('stopped (unknown option --bogus; usage: change-loop.mjs next --change x)'));
  assert.ok(/(^|\s)\?(\s|$)/.test('The change ? stopped'));
  for (const key of Object.keys(MESSAGES.en)) {
    if (EXEMPT_EQUAL.includes(key)) continue;
    assert.notEqual(MESSAGES.en[key], MESSAGES['pt-BR'][key], `${key} is translated`);
  }
});

test('jira-entry AC-3 the replies for no connector and an unreadable task name the key, ask for text and hold no internal term, in both languages', () => {
  for (const key of ['task-no-connector', 'task-unreadable']) {
    const said = {};
    for (const lang of ['en', 'pt-BR']) {
      const r = main(['reply', key, '--lang', lang, '--param', 'key=PROJ-482'], { env: cleanEnv });
      assert.equal(r.code, 0, `${lang} ${key}: ${r.stderr}`);
      assert.match(r.stdout, /PROJ-482/, `${lang} ${key} names the key`);
      assert.match(r.stdout, /\/devkit change/, `${lang} ${key} asks for text`);
      assert.doesNotMatch(r.stdout, /devkit-end:/, `${lang} ${key} ends no run`);
      assert.doesNotMatch(r.stdout, /change-loop|\.mjs|connector tool|getJiraIssue/, `${lang} ${key} holds no internal term`);
      said[lang] = r.stdout;
    }
    assert.notEqual(said.en, said['pt-BR'], `${key} is translated`);
  }
});

test('change-loop replies: an unset or unknown language is Brazilian Portuguese, en stays English', () => {
  for (const v of [undefined, '', '${user_config.language}', 'fr', 'EN']) assert.equal(normalizeLang(v), 'pt-BR', String(v));
  assert.equal(normalizeLang('en'), 'en');
  assert.equal(normalizeLang('pt-BR'), 'pt-BR');
  assert.equal(render('en', 'nothing-to-resume', {}), 'There is no unfinished change to continue: type /devkit change and what you want done.');
  assert.match(render('pt-BR', 'nothing-to-resume', {}), /^Não há change por terminar/);
});

test('change-loop replies: a stage reads as a noun phrase in each language', () => {
  assert.equal(render('en', 'where.next', { stage: 'Plan readiness' }), 'next is the plan readiness');
  assert.equal(render('en', 'where.next', { stage: 'E2E tests' }), 'next is the E2E tests');
  assert.equal(render('pt-BR', 'where.next', { stage: 'Revisão do plano' }), 'a próxima é a etapa Revisão do plano');
  assert.equal(render('en', 'waiting-unrun-stage', { id: 'x', stage: 'Screen mock-up' }), 'The screen mock-up of x has an unfinished file that no role of this version can finish: tell me its result, or remove it.');
  assert.equal(render('pt-BR', 'blocked', { id: 'x', why: 'ceiling', stage: 'Revisão do plano', attempt: 3 }), 'A change x parou: a etapa Revisão do plano falhou 3 vezes, que é o limite. Nada mais roda até isso ser resolvido.');
});

// ---------------------------------------------------------------- the decision, synthetic (D-5)

const CTX = (over = {}) => ({ id: 'feat', script: 'devkit', root: '/w/feat', branch: 'feat', lang: 'en', filesLanguage: 'en', ...over });
const stageOf = (flow, id) => flow.stages.find((s) => s.id === id);
const stagesOf = (flow, over = {}) => flow.stages.map((s, i) => ({ n: i + 1, id: s.id, title: s.title.en, state: 'passed', reasonCode: 'passed', params: {}, ...over[s.id] }));
export const nextOf = (flow, stage, reasonCode, params = {}) => {
  const s = stageOf(flow, stage);
  return { n: flow.stages.indexOf(s) + 1, stage, role: s.role, skills: s.skills ?? [], reasonCode, params, reason: 'x', progressKey: `${stage}@abc123` };
};
export const endOf = (state, stage, reasonCode, params = {}) => ({ state, stage, reasonCode, params, reason: 'x' });
export const reportOf = (flow, { next = null, end = null, stages = {}, script = 'current', schema = 'devkit' } = {}) => (
  { version: 1, change: 'feat', schema, script, head: 'h', stages: stagesOf(flow, stages), next, end, previous: null });
const APPROVAL = { status: null, recorded: null, readiness: 'sha256:abcdef012345', ok: false };
export const rowOf = (step, extra = {}) => ({ next: { step, reason: 'r', actor: 'x', ...extra }, state: 's', delivered: {} });

export function run(over = {}) {
  const flow = over.flow ?? FLOWS.devkit;
  return decide({
    ctx: CTX(over.ctx), flow, report: over.report ?? reportOf(flow, over.rep), after: null, fingerprint: 'abc123', approval: APPROVAL,
    hasProposal: false, flags: [], archiving: false, row: null, ...over.facts,
  });
}
const shape = (a) => [a.kind, a.agent ?? a.step ?? a.end?.state, a.end?.why ?? null, exitCodeOf(a)];
const says = (key, params = {}, lang = 'en') => render(lang, key, { id: 'feat', ...params });

test('change-loop decide: P1 a folder that was never opened ends blocked', () => {
  const a = run({ rep: { next: nextOf(FLOWS.devkit, 'open', 'no-file', { file: '.openspec.yaml' }), stages: { open: { state: 'pending', reasonCode: 'no-file' } } } });
  assert.deepEqual(shape(a), ['end', 'blocked', 'not-opened', 2]);
  assert.equal(a.reply, says('blocked', { why: 'not-opened' }));
  assert.equal(a.version, 1);
  assert.deepEqual([a.change, a.script, a.root, a.branch, a.filesLanguage], ['feat', 'devkit', '/w/feat', 'feat', 'en']);
});

test('change-loop decide: P2 the requirements, whatever the reason, and a wait for the owner there, are the grill', () => {
  for (const [rep, label] of [
    [{ next: nextOf(FLOWS.devkit, 'requirements', 'no-file') }, 'no file'],
    [{ next: nextOf(FLOWS.devkit, 'requirements', 'not-judged') }, 'not judged'],
    [{ end: endOf('waiting-for-owner', 'requirements', 'owner-pending') }, 'waiting for the owner'],
  ]) {
    const a = run({ rep });
    assert.deepEqual([a.kind, a.stage, a.role, exitCodeOf(a)], ['grill', 'requirements', 'change-coordinator', 0], label);
    assert.deepEqual(a.skills, ['requirements-grill']);
    assert.equal(a.agent, undefined);
  }
});

test('change-loop decide: P3 a flag found by the grill on the short script switches to the full one', () => {
  const lite = FLOWS['devkit-lite'];
  const facts = (flags, hasProposal = false) => ({ flags, hasProposal });
  const rep = { flow: lite, ctx: { script: 'devkit-lite' }, rep: { schema: 'devkit-lite', next: nextOf(lite, 'proposal', 'no-file') } };
  const a = run({ ...rep, flow: lite, report: reportOf(lite, rep.rep), facts: facts(['ui', 'architecture']) });
  assert.deepEqual([a.kind, a.step, exitCodeOf(a)], ['session', 'switch-script', 0]);
  assert.deepEqual(a.detail.command.slice(0, 1), ['node']);
  assert.ok(a.detail.command[1].endsWith('change-loop.mjs') && a.detail.command[1].startsWith(HOOKS_DIR));
  assert.deepEqual(a.detail.command.slice(2), ['script', 'feat', 'devkit', '--why', 'architecture', '--lang', 'en']);
  assert.equal(a.reply, says('script-switched', { script: 'devkit', why: 'architecture' }));
  // No flag, a proposal already written, or the full script: the plan stage goes to the planner as usual.
  for (const f of [facts([]), facts(['ui'], true), facts(['other'])]) {
    assert.equal(run({ ...rep, flow: lite, report: reportOf(lite, rep.rep), facts: f }).agent, PLANNER);
  }
  assert.equal(run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file') }, facts: facts(['ui']) }).agent, PLANNER, 'the full script has nothing to switch to');
});

test('change-loop decide: P4 a plan stage with a missing, unjudged or stale file goes to the role the declaration names', () => {
  const cases = [
    ['proposal', 'no-file', PLANNER], ['specs', 'no-header', PLANNER], ['design', 'bad-header', PLANNER], ['tasks', 'header-other-stage', PLANNER],
    ['proposal', 'not-judged', PLANNER], ['tasks', 'stale-plan', PLANNER], ['proposal', 'rerun-after-fix', PLANNER],
    ['readiness', 'no-file', READINESS], ['readiness', 'not-judged', READINESS], ['readiness', 'stale-plan', READINESS],
  ];
  for (const [stage, reason, agent] of cases) {
    const a = run({ rep: { next: nextOf(FLOWS.devkit, stage, reason), stages: { [stage]: { state: 'pending', reasonCode: reason } } } });
    assert.deepEqual([a.kind, a.agent, a.stage, exitCodeOf(a)], ['agent', agent, stage, 0], `${stage} ${reason}`);
    assert.equal(a.role, stageOf(FLOWS.devkit, stage).role);
    assert.equal(a.progressKey, `${stage}/${stage}@abc123`);
    assert.equal(a.stageTitle, stageOf(FLOWS.devkit, stage).title.en);
  }
});

test('change-loop decide: P5 a stage offered because the readiness failed goes to the planner, naming the failure', () => {
  const next = nextOf(FLOWS.devkit, 'proposal', 'fix-after-failure', { failed: 'readiness', attempt: 1, ceiling: 3 });
  const a = run({ rep: { next, stages: { readiness: { state: 'failed', reasonCode: 'header-failed' } } } });
  assert.deepEqual([a.kind, a.agent, a.stage], ['agent', PLANNER, 'proposal']);
  assert.match(a.brief, /readiness failed at attempt 1 of 3: revise the plan from its findings/);
});

test('change-loop decide: P6 the approval awaited ends waiting for the owner with the readiness hash', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') } });
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-approval', 1]);
  assert.equal(a.reply, says('waiting-approval'));
  assert.equal(a.detail.readiness, 'sha256:abcdef012345');
  assert.equal(a.stage, 'approval');
});

test('change-loop decide: P7 an approval gone stale is asked again', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'approval', 'approval-stale') } });
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-approval-again', 1]);
  assert.equal(a.reply, says('waiting-approval-again'));
  assert.equal(a.detail.readiness, 'sha256:abcdef012345');
});

test('change-loop decide: P8 a stage no shipped role can finish waits for the owner', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'mockup', 'unshipped-role-pending', { stage: 'mockup' }) } });
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-unrun-stage', 1]);
  assert.equal(a.reply, says('waiting-unrun-stage', { stage: 'Screen mock-up' }));
});

test('change-loop decide: P9 a ceiling and the other blocked ends of the plan', () => {
  const ceiling = run({ rep: { end: endOf('blocked', 'readiness', 'ceiling-reached', { stage: 'readiness', attempt: 3, ceiling: 3 }) } });
  assert.deepEqual(shape(ceiling), ['end', 'blocked', 'ceiling', 2]);
  assert.equal(ceiling.reply, says('blocked', { why: 'ceiling', stage: 'Plan readiness', attempt: 3 }));
  const pt = run({ ctx: { lang: 'pt-BR' }, rep: { end: endOf('blocked', 'readiness', 'ceiling-reached', { stage: 'readiness', attempt: 3, ceiling: 3 }) } });
  assert.equal(pt.reply, says('blocked', { why: 'ceiling', stage: 'Revisão do plano', attempt: 3 }, 'pt-BR'));
  assert.equal(pt.stageTitle, 'Revisão do plano');
  const other = run({ rep: { end: endOf('blocked', 'proposal', 'no-progress', { stage: 'proposal' }) } });
  assert.equal(other.end.why, 'no-progress');
});

test('change-loop decide: P10 a change begun under the previous script ends blocked', () => {
  const rep = { ...reportOf(FLOWS.devkit, {}), script: 'previous', stages: [], previous: { finishedBy: 'ship-change' } };
  const a = run({ report: rep });
  assert.deepEqual(shape(a), ['end', 'blocked', 'previous-script', 2]);
  assert.equal(a.reply, says('blocked', { why: 'previous-script' }));
  assert.match(a.reply, /\/ship-change feat/);
  assert.equal(a.stage, null);
});

test('change-loop decide: A0 an archived change with no archive branch ends archived and reads nothing more', () => {
  const rep = { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] };
  const a = run({ report: rep });
  assert.deepEqual(shape(a), ['end', 'archived', 'archived', 0]);
  assert.equal(a.reply, says('archived'));
});

test('change-loop decide: B0 the blocked ends of the stage checker win over the delivery step', () => {
  const cases = [
    ['ceiling-reached', { stage: 'review', attempt: 3, ceiling: 3 }, 'ceiling'],
    ['no-progress', { stage: 'review' }, 'no-progress'],
    ['pr-closed', { number: 12 }, 'pr-closed'],
  ];
  for (const [reason, params, why] of cases) {
    const a = run({ rep: { end: endOf('blocked', 'delivery', reason, params) }, facts: { row: rowOf('implement', { phase: 1 }) } });
    assert.deepEqual(shape(a), ['end', 'blocked', why, 2], reason);
    if (why === 'pr-closed') assert.equal(a.reply, says('blocked', { why, number: 12 }));
  }
});

// ---- gh-version: a gh older than 2.50.0 ends with its own reason (AC-2, AC-5)

const OLD_GH_END = (installed = '2.46.0', ctx) => run({ ctx, rep: { end: endOf('blocked', 'delivery', 'gh-too-old', { installed, minimum: '2.50.0' }) }, facts: { row: rowOf('implement', { phase: 1 }) } });

test('gh-version 12: a blocked gh-too-old names both versions and the way out in either language (AC-2, AC-5)', () => {
  const a = OLD_GH_END();
  assert.deepEqual(shape(a), ['end', 'blocked', 'gh-too-old', 2]);
  assert.deepEqual([a.params.installed, a.params.minimum, a.params.verb], ['2.46.0', '2.50.0', 'change']);
  for (const [lang, update, unreadable] of [['en', 'update gh', /GitHub cannot be read/], ['pt-BR', 'atualize o gh', /não foi possível ler o GitHub/]]) {
    const reply = OLD_GH_END('2.46.0', { lang }).reply;
    for (const part of ['2.46.0', '2.50.0', update, '/devkit change feat']) assert.ok(reply.includes(part), `${lang}: ${reply}`);
    assert.doesNotMatch(reply, unreadable);
  }
  const unknown = OLD_GH_END(null);
  assert.ok(unknown.reply.includes('unknown version'), unknown.reply);
  assert.ok(OLD_GH_END(null, { lang: 'pt-BR' }).reply.includes('versão desconhecida'));
  for (const lang of ['en', 'pt-BR']) {
    const line = render(lang, 'roadmap-blocked', a.params);
    assert.ok(line.includes('2.46.0') && line.includes('2.50.0'), `${lang}: ${line}`);
  }
});

test('gh-version 13: next over a delivered change with an old gh exits 2 with the own reason (AC-2)', () => {
  const { t, gh, env } = deliveredChange();
  gh.set('pr-checks', { exit: 1, stderr: 'unknown flag: --json\n\nUsage:  gh pr checks [<number> | <url> | <branch>] [flags]\n' });
  gh.set('version', { stdout: 'gh version 2.46.0 (2024-03-18)\n' });
  const r = next(t.main, [], env);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  const { action } = parsed(r);
  assert.equal(action.end.why, 'gh-too-old');
  assert.equal(action.reply, render('en', 'blocked', { id: 'feat', why: 'gh-too-old', installed: '2.46.0', minimum: '2.50.0', verb: 'change' }));
});

test('gh-version 14: waitLoop ends at once on a gh-too-old poll', async () => {
  const old = OLD_GH_END();
  const r = await waited([WAIT, old]);
  assert.deepEqual(r.action, old);
  assert.equal(r.polls, 2);
});

// The current stage of a build-to-archive decision: the flow-check report only has to be in a build part.
const buildRep = (over = {}) => ({ next: nextOf(FLOWS.devkit, 'delivery', 'not-pushed', { number: 12 }), ...over });
const build = (row, facts = {}, ctx = {}) => run({ rep: buildRep(), facts: { row, ...facts }, ctx });

test('change-loop decide: B1 implementation and fixes go to the implementer', () => {
  for (const step of ['implement', 'fix-review', 'fix-defect', 'fix-checks', 'apply-proposals']) {
    const a = build(rowOf(step, { phase: 2, reviewers: ['code-quality-reviewer'] }));
    assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role, exitCodeOf(a)], ['agent', TDD, step, 'implementation', 'tdd-implementer', 0], step);
    assert.equal(a.detail.phase, 2);
    assert.equal(a.detail.actor, undefined, 'the checker-internal actor is not part of the detail');
    assert.ok(a.brief.includes(`step ${step}`) && a.brief.includes('"phase":2'), step);
    assert.equal(a.progressKey, `implementation/${step}@abc123`);
  }
});

test('change-loop decide: B1a a conflict only in release files goes to the implementer with the command and the paths', () => {
  const command = ['node', '/hooks/release-merge.mjs', '--base', 'main', '--json'];
  const a = build(rowOf('resolve-release-conflict', { number: 12, paths: ['.claude-plugin/marketplace.json', 'CHANGELOG.md'], base: 'main', command }));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', TDD, 'resolve-release-conflict', 'implementation']);
  assert.deepEqual(a.detail.command, command);
  assert.deepEqual(a.detail.paths, ['.claude-plugin/marketplace.json', 'CHANGELOG.md']);
});

test('change-loop decide: B1a a conflict elsewhere ends blocked, a clean merge in merge mode is the session step update-branch', () => {
  const elsewhere = build(rowOf('blocked', { item: 5, reason: 'item 5 (conflict in README.md)' }));
  assert.deepEqual(shape(elsewhere), ['end', 'blocked', 'pr-problem', 2]);
  assert.equal(elsewhere.reply, says('blocked', { why: 'pr-problem' }));
  const clean = build(rowOf('update-branch', { number: 12 }));
  assert.deepEqual([clean.kind, clean.step, exitCodeOf(clean)], ['session', 'update-branch', 0]);
  assert.equal(clean.detail.number, 12);
});

test('change-loop decide: B2 commits and pull requests go to the commit agent', () => {
  for (const step of ['commit', 'open-pr', 'push', 'open-archive-pr']) {
    const a = build(rowOf(step, { paths: ['src/a.ts'] }));
    assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', COMMIT, step, 'delivery', 'commit-and-pr'], step);
    assert.deepEqual(a.skills, ['commit-message-guidelines']);
  }
});

test('release-merge-conflict 14: a push row with a plain command goes to the commit agent', () => {
  const command = ['git', 'push', 'origin', 'feat'];
  const a = build(rowOf('push', { number: 12, branch: 'feat', command }));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', COMMIT, 'push', 'delivery']);
  assert.deepEqual(a.detail.command, command);
});

test('change-loop decide: B3 the demonstration goes to the verifier', () => {
  const a = build(rowOf('verify'));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', VERIFIER, 'verify', 'evidence', 'pr-verifier']);
});

test('change-loop decide: B4 the code review is a session step', () => {
  const a = build(rowOf('review', { reviewers: ['code-quality-reviewer'], round: 1 }));
  assert.deepEqual([a.kind, a.step, a.stage, a.role, a.agent, exitCodeOf(a)], ['session', 'review', 'review', 'review-bench', undefined, 0]);
  assert.deepEqual(a.skills, ['review-change']);
  assert.equal(a.detail.round, 1);
});

test('change-loop decide: B5 a phase gate is a session step with its command and task', () => {
  const a = build(rowOf('gate', { phase: 2, task: '2.3', command: 'node --test x' }));
  assert.deepEqual([a.kind, a.step, a.detail.command, a.detail.task, a.detail.phase], ['session', 'gate', 'node --test x', '2.3', 2]);
});

test('change-loop decide: B6 the pull request and archive steps of the session', () => {
  for (const step of ['edit-pr-body', 'enable-auto-merge', 'disable-auto-merge', 'update-branch', 'answer', 'retro', 'archive', 'tick-roadmap']) {
    const a = build(rowOf(step, { url: 'https://github.com/o/r/pull/12' }));
    assert.deepEqual([a.kind, a.step, a.agent, exitCodeOf(a)], ['session', step, undefined, 0], step);
    assert.equal(a.progressKey, `${a.stage}/${step}@abc123`);
  }
  assert.equal(build(rowOf('answer', { url: 'https://github.com/o/r/pull/12' })).detail.url, 'https://github.com/o/r/pull/12');
  assert.equal(build(rowOf('retro')).stage, 'retro');
});

test('change-loop decide: B7 pending checks end waiting on GitHub', () => {
  const a = build(rowOf('wait-checks', { pending: ['build'] }));
  assert.deepEqual(shape(a), ['end', 'waiting-on-github', 'waiting-github', 1]);
  assert.equal(a.reply, says('waiting-github', { what: 'checks' }));
  assert.match(a.reply, /no time limit/);
});

test('change-loop decide: B8 a merge on GitHub, or the archive pull request\'s merge, ends waiting on GitHub', () => {
  const merge = build(rowOf('wait-merge', { number: 12, waitingFor: 'GitHub to merge' }));
  assert.deepEqual(shape(merge), ['end', 'waiting-on-github', 'waiting-github', 1]);
  assert.equal(merge.reply, says('waiting-github', { what: 'merge' }));
  const archive = build(rowOf('wait-merge', { number: 13 }), { archiving: true }, { branch: 'chore/archive-feat' });
  assert.equal(archive.reply, says('waiting-github', { what: 'archive-merge' }));
});

test('change-loop decide: B9 a pull request ready is the owner\'s to merge', () => {
  const ready = build(rowOf('ready', { number: 12 }));
  assert.deepEqual(shape(ready), ['end', 'waiting-for-owner', 'waiting-merge', 1]);
  assert.equal(ready.reply, says('waiting-merge', { number: 12 }));
  const archive = build(rowOf('archive-pr-ready', { number: 13 }));
  assert.equal(archive.end.why, 'waiting-archive-merge');
  assert.equal(archive.reply, says('waiting-archive-merge', { number: 13 }));
});

test('change-loop decide: B10 a review deadlock waits for the owner', () => {
  const a = build(rowOf('stop-review-deadlock', { reviewers: ['code-quality-reviewer'] }));
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-review-dispute', 1]);
  assert.equal(a.reply, says('waiting-review-dispute'));
});

test('change-loop decide: B11 the retro answers wait for the owner', () => {
  const a = build(rowOf('stop-retro-answers', { proposals: [] }));
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-retro', 1]);
  assert.equal(a.reply, says('waiting-retro'));
});

test('change-loop decide: B12 the plan approval at the delivery checker waits for the owner, with the hash', () => {
  const first = build(rowOf('stop-plan-approval', { readiness: 'sha256:abcdef012345' }));
  assert.deepEqual(shape(first), ['end', 'waiting-for-owner', 'waiting-approval', 1]);
  assert.equal(first.detail.readiness, 'sha256:abcdef012345');
  const again = build(rowOf('stop-plan-approval', { readiness: 'sha256:abcdef012345' }), { approval: { status: 'APPROVED', recorded: 'sha256:111111111111', readiness: 'sha256:abcdef012345', ok: false } });
  assert.deepEqual(shape(again), ['end', 'waiting-for-owner', 'waiting-approval-again', 1]);
  assert.equal(again.reply, says('waiting-approval-again'));
});

test('change-loop decide: B13 a project that delivers by hand waits for the owner', () => {
  const a = build(rowOf('stop-plan-mode', { schema: 'devkit' }));
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-by-hand', 1]);
  assert.equal(a.reply, says('waiting-by-hand'));
});

test('change-loop decide: B14 the stops of the delivery checker end blocked with the matching reason', () => {
  const rows = [['stop-branch', 'wrong-branch'], ['stop-merge-setup', 'merge-setup'], ['stop-archive', 'archive-failed'], ['stop-not-approved', 'plan-not-approved'], ['blocked', 'pr-problem']];
  for (const [step, why] of rows) {
    const a = build(rowOf(step));
    assert.deepEqual(shape(a), ['end', 'blocked', why, 2], step);
    assert.equal(a.reply, says('blocked', { why }));
  }
});

test('change-loop decide: B15 an archived change at the delivery checker ends archived', () => {
  const rep = { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] };
  const a = run({ report: rep, facts: { archiving: true, row: rowOf('archived') } });
  assert.deepEqual(shape(a), ['end', 'archived', 'archived', 0]);
});

test('change-loop decide: B16 a step with no row ends blocked as unknown', () => {
  const a = build(rowOf('teleport'));
  assert.deepEqual(shape(a), ['end', 'blocked', 'unknown-step', 2]);
  assert.equal(a.reply, says('blocked', { why: 'unknown-step' }));
});

test('change-loop decide: B17 a delivery checker that throws ends blocked and exits 3', () => {
  const a = build({ error: 'merge_method: bogus is not one of squash, merge, rebase' });
  assert.deepEqual(shape(a), ['end', 'blocked', 'unreadable', 3]);
  assert.match(a.reply, /bogus/);
});

test('change-loop decide: the B rows are exactly the steps the checkers can return', () => {
  const stepsIn = (source) => new Set([...source.matchAll(/\bstep\('([a-z][a-z-]*)'/g)].map((m) => m[1]));
  const conduct = read('conduct-check.mjs');
  const overrides = conduct.slice(conduct.indexOf('the overrides (design D9)'), conduct.indexOf('function deliveryRow('));
  assert.ok(overrides.length > 500, 'the overrides section was found');
  const returnable = new Set([...stepsIn(read('deliver-check.mjs')), ...stepsIn(overrides)]);
  for (const name of ['resolve-release-conflict', 'update-branch', 'blocked']) assert.ok(returnable.has(name), `the scan sees ${name}`);
  assert.equal(returnable.has('push-rebased'), false, 'the rebase push is gone');
  assert.doesNotMatch(overrides, /--force/);
  assert.ok(returnable.size > 30, `the scan found ${returnable.size} steps`);
  const rows = new Set(ROW_STEPS);
  assert.deepEqual([...returnable].filter((s) => !rows.has(s)), [], 'a returnable step with no row');
  assert.deepEqual([...rows].filter((s) => !returnable.has(s)), [], 'a row naming a step no checker returns');
});

test('change-loop decide: the agent of a delivery hand-off is the one the checker\'s row names, and the loop\'s own map only when the row names none', () => {
  for (const step of ['implement', 'commit', 'verify', 'resolve-release-conflict', 'push']) {
    const named = build(rowOf(step, { agent: 'devkit-core:named-by-the-row', paths: [] }));
    assert.equal(named.kind, 'agent', step);
    assert.equal(named.agent, 'devkit-core:named-by-the-row', `${step}: from the row`);
    assert.equal(named.detail.agent, undefined, 'the agent is not part of the detail');
    const unnamed = build(rowOf(step, { paths: [] }));
    assert.equal(unnamed.agent, actorOf(step).agent, `${step}: the loop's map says what the checker says when the row names none`);
  }
});

test('change-loop decide: the loop\'s step agents match conduct-check\'s actorOf', () => {
  // `retro` is the one step actorOf gives to an agent (general-purpose) that the loop runs in the session (B6, D-8).
  const stated = { retro: 'general-purpose' };
  let handedOff = 0;
  for (const step of ROW_STEPS) {
    const a = build(rowOf(step, { phase: 1, number: 12, paths: [], branch: 'develop', base: 'main', list: '#12 to main' })); // branch, base and list: the owner ends of two-prs name them
    const checker = actorOf(step).agent;
    if (a.kind === 'agent') {
      handedOff += 1;
      assert.equal(a.agent, checker, `${step}: the loop hands it to ${a.agent}, the checker to ${checker}`);
    } else if (checker) {
      assert.equal(stated[step], checker, `${step}: the checker names an agent the loop runs in the session`);
      assert.equal(a.kind, 'session', step);
    }
  }
  assert.ok(handedOff >= 11, `the loop hands ${handedOff} steps to an agent`);
});

test('change-loop decide: K1 the same action back with nothing changed ends blocked', () => {
  const next = nextOf(FLOWS.devkit, 'proposal', 'no-file');
  const stages = { proposal: { state: 'pending', reasonCode: 'no-file' } };
  const a = run({ rep: { next, stages }, facts: { after: 'proposal/proposal@abc123' } });
  assert.deepEqual(shape(a), ['end', 'blocked', 'no-progress', 2]);
  assert.equal(a.reply, says('blocked', { why: 'no-progress', stage: 'Proposal' }));
  const moved = run({ rep: { next, stages }, facts: { after: 'proposal/proposal@zzz999' } });
  assert.equal(moved.kind === 'end' ? moved.end.why : moved.kind, 'not-delivered', 'a changed tree with the file still missing is K2, not K1');
  // A build step answers to the same rule, keyed on the step.
  assert.equal(build(rowOf('implement', { phase: 1 }), { after: 'implementation/implement@abc123' }).end.why, 'no-progress');
  assert.equal(build(rowOf('implement', { phase: 1 }), { after: 'implementation/implement@old' }).kind, 'agent');
});

test('change-loop decide: K2 a stage handed to its agent that is still missing or pending ends blocked as not delivered', () => {
  for (const reason of ['no-file', 'not-judged', 'no-header', 'bad-header', 'header-other-stage']) {
    const rep = { next: nextOf(FLOWS.devkit, 'tasks', reason), stages: { tasks: { state: 'pending', reasonCode: reason } } };
    const a = run({ rep, facts: { after: 'tasks/tasks@before' } });
    assert.deepEqual(shape(a), ['end', 'blocked', 'not-delivered', 2], reason);
    assert.equal(a.reply, says('blocked', { why: 'not-delivered', stage: 'Tasks' }));
  }
  // Another stage, a stale file (it was delivered once) and a stage with no agent are not K2.
  const stale = { next: nextOf(FLOWS.devkit, 'tasks', 'stale-plan'), stages: { tasks: { state: 'stale', reasonCode: 'stale-plan' } } };
  assert.equal(run({ rep: stale, facts: { after: 'tasks/tasks@before' } }).kind, 'agent');
  const other = { next: nextOf(FLOWS.devkit, 'tasks', 'no-file'), stages: { tasks: { state: 'pending', reasonCode: 'no-file' } } };
  assert.equal(run({ rep: other, facts: { after: 'specs/specs@before' } }).kind, 'agent');
});

test('change-loop replies: the owner\'s settings, English files and replies in Portuguese', () => {
  const ctx = { lang: 'pt-BR', filesLanguage: 'en' };
  const agent = run({ ctx, rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file') } });
  assert.equal(agent.filesLanguage, 'en');
  assert.match(agent.brief, /Write the change's files in English\./);
  const wait = run({ ctx, rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') } });
  assert.equal(wait.reply, 'O plano de feat está escrito e revisado. Leia e me diga se aprova; eu sigo assim que você responder.');
  const grillPt = run({ ctx: { ...ctx, filesLanguage: 'pt-BR' }, rep: { next: nextOf(FLOWS.devkit, 'tasks', 'no-file') } });
  assert.match(grillPt.brief, /Write the change's files in Brazilian Portuguese\./);
  const tagged = run({ ctx: { ...ctx, filesLanguage: 'es' }, rep: { next: nextOf(FLOWS.devkit, 'tasks', 'no-file') } });
  assert.match(tagged.brief, /files in es\./);
});

test('change-loop brief: names the role, the change and the stage and holds no skill text', () => {
  const root = join(HERE, '..', '..', 'core', 'skills');
  const skillLines = (skills) => skills.flatMap((s) => readFileSync(join(root, s, 'SKILL.md'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l.length >= 25));
  const briefs = [
    ['readiness', run({ rep: { next: nextOf(FLOWS.devkit, 'readiness', 'no-file') } })],
    ['proposal', run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file') } })],
    ['implementation', build(rowOf('implement', { phase: 1 }))],
    ['delivery', build(rowOf('commit', { paths: [] }))],
  ];
  for (const [stage, a] of briefs) {
    assert.ok(a.brief.startsWith('Change feat (devkit script), stage '), a.brief);
    assert.ok(a.brief.includes(`stage ${stage}`), a.brief);
    assert.ok(a.brief.includes('Work only in /w/feat on branch feat;') && a.brief.includes('start every Bash command with cd /w/feat &&'), a.brief);
    assert.ok(a.brief.includes('do not fetch.'), a.brief);
    const base = a.agent === COMMIT ? a.brief.slice(0, -changeLoopModule.ATTRIBUTION_ASK.length) : a.brief;
    assert.ok(base.endsWith("Write the change's files in English."), a.brief);
    if (a.agent === COMMIT) assert.ok(a.brief.endsWith(changeLoopModule.ATTRIBUTION_ASK), 'the commit agent\'s brief ends with the attribution request');
    assert.equal(a.agent.endsWith(a.role), true, 'the agent is the role\'s agent');
    const lines = skillLines(stageOf(FLOWS.devkit, stage).skills ?? []);
    assert.equal(lines.length > 0 || stage === 'proposal', true, `the skills of ${stage} were read`);
    assert.deepEqual(lines.filter((l) => a.brief.includes(l)), [], `the brief of ${stage} holds a skill line`);
  }
  assert.match(briefs[0][1].brief, /review the plan/);
  assert.match(briefs[1][1].brief, /write the plan files the script still lacks, from proposal on, each from `openspec instructions <artifact> --change feat`/);
  const stale = run({ rep: { next: nextOf(FLOWS.devkit, 'tasks', 'stale-plan') } });
  assert.match(stale.brief, /tasks is out of date: bring it up to date/);
});

// ---------------------------------------------------------------- reply (the endings the session decides)

test('change-loop reply: renders a key in both languages and an unknown key exits 3', () => {
  const en = main(['reply', 'waiting-merge', '--lang', 'en', '--param', 'id=add-csv-export', '--param', 'number=12'], { env: cleanEnv });
  assert.deepEqual([en.code, en.stdout], [0, 'Pull request #12 of add-csv-export is ready: in this project, merging it is up to you.\n']);
  const pt = main(['reply', 'blocked', '--lang', 'pt-BR', '--param', 'id=x', '--param', 'why=tests-red', '--param', 'phase=2'], { env: cleanEnv });
  assert.deepEqual([pt.code, pt.stdout], [0, 'devkit-end: x blocked\nA change x parou: os testes da fase 2 falharam. Nada mais roda até isso ser resolvido.\n'], 'a key that ends the run starts with its end line');
  const odd = main(['reply', 'waiting-merge', '--lang', '${user_config.language}', '--param', 'id=x', '--param', 'number=1'], { env: cleanEnv });
  assert.match(odd.stdout, /^O pull request #1 de x está pronto/);
  const unknown = main(['reply', 'no-such-key', '--lang', 'en'], { env: cleanEnv });
  assert.equal(unknown.code, 3);
  assert.match(unknown.stderr, /no-such-key/);
  assert.equal(main(['reply', 'waiting-merge', '--lang', 'en', '--param', 'id=x'], { env: cleanEnv }).code, 3, 'a missing parameter is a usage error');
  assert.equal(main(['reply'], { env: cleanEnv }).code, 3);
  assert.equal(main(['teleport'], { env: cleanEnv }).code, 3);
  assert.throws(() => render('en', 'waiting-merge', { id: 'x' }), LoopUsageError);
});

test('change-loop reply: the keys that end the run print the end line first, every other key the reply alone', () => {
  const blocked = main(['reply', 'blocked', '--lang', 'en', '--param', 'id=feat', '--param', 'why=role-failed', '--param', 'stage=Code review'], { env: cleanEnv });
  assert.equal(blocked.stdout, `devkit-end: feat blocked\n${render('en', 'blocked', { id: 'feat', why: 'role-failed', stage: 'Code review' })}\n`);
  const decision = main(['reply', 'waiting-pr-decision', '--lang', 'pt-BR', '--param', 'id=feat', '--param', 'url=https://github.com/o/r/pull/1'], { env: cleanEnv });
  assert.equal(decision.stdout, `devkit-end: feat waiting-for-owner\n${render('pt-BR', 'waiting-pr-decision', { id: 'feat', url: 'https://github.com/o/r/pull/1' })}\n`);
  for (const [key, params] of [['waiting-merge', ['id=feat', 'number=3']], ['script-locked', ['id=feat']], ['nothing-to-resume', []]]) {
    const r = main(['reply', key, '--lang', 'en', ...params.flatMap((p) => ['--param', p])], { env: cleanEnv });
    assert.doesNotMatch(r.stdout, /devkit-(run|end):/, key);
  }
  // The other commands print no end line unless the action is an end: open, start, a stage hand-off.
  assert.doesNotMatch(startRun(devkitRepo(), 'roadmap').stdout, /devkit-end:/);
  assert.doesNotMatch(next(planChange({ have: ['requirements', 'decisions'] })).stdout, /devkit-end:/, 'a stage hand-off is not an end');
});

test('change-loop next and wait: an end prints devkit-end as the second line, after the run line, with the end\'s state', async () => {
  const waiting = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'] });
  const n = next(waiting);
  assert.equal(n.code, 1);
  assert.deepEqual(n.stdout.split('\n').slice(0, 2), ['devkit-run: feat', 'devkit-end: feat waiting-for-owner']);
  assert.equal(parsed(n).action.end.state, 'waiting-for-owner');
  const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  assert.deepEqual(next(archived).stdout.split('\n').slice(0, 2), ['devkit-run: feat', 'devkit-end: feat archived']);
  const ceiling = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } });
  assert.deepEqual(next(ceiling).stdout.split('\n').slice(0, 2), ['devkit-run: feat', 'devkit-end: feat blocked']);
  const w = await runCommand(['wait', '--change', 'feat', '--lang', 'en'], { cwd: waiting, env: cleanEnv, sleep: async () => {} });
  assert.equal(w.stdout, n.stdout, 'wait prints the end exactly as next does');
  const { t, env } = deliveredChange();
  assert.deepEqual(next(t.main, [], env).stdout.split('\n').slice(0, 2), ['devkit-run: feat', 'devkit-end: feat waiting-on-github']);
});

test('change-loop reply: the script runs from its file and prints nothing when imported', () => {
  const r = spawnSync(process.execPath, [LOOP, 'reply', 'waiting-approval', '--lang', 'en', '--param', 'id=x'], { env: cleanEnv, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'The plan of x is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.\n');
  assert.equal(spawnSync(process.execPath, [LOOP, 'next'], { env: cleanEnv, encoding: 'utf8' }).status, 3);
});

// ---------------------------------------------------------------- next, on real repositories (D-5)

const head = (stage, c0, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${c0} -->\n`;
// Invariant (T-7, loop, change-loop.test.mjs): a fixture change opened at the grill stands right before its proposal, so the planner is its next role:
// the decisions stage comes first and is part of what the grill leaves behind.
const PLAN_FILES = { requirements: 'requirements.md', decisions: 'decisions.md', proposal: 'proposal.md', specs: 'specs/s/spec.md', design: 'design.md', tasks: 'tasks.md', readiness: 'readiness.md', approval: 'approval.md' };

// A committed `devkit` change `feat` in the main checkout with the plan files of `have` written as passed (`results` and
// `attempts` per stage), the ship mode plan (no ship key). `headerless` writes no header line.
export function planChange({ have, results = {}, attempts = {}, headerless = false } = {}) {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const files = { '.openspec.yaml': 'schema: devkit\n' };
  for (const stage of have) {
    const body = stage === 'readiness' ? '# Readiness\n\n- Status: APPROVED\n' : stage === 'tasks' ? '# Tasks\n\n- [ ] 1.1 a\n' : `# ${stage}\n`;
    files[PLAN_FILES[stage]] = `${headerless ? '' : head(stage, c0, results[stage] ?? 'passed', attempts[stage] ?? 1)}${body}`;
  }
  put(root, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/feat/${f}`, b])));
  commitAll(root, 'change files');
  return root;
}
const next = (cwd, extra = [], env = cleanEnv, opts = {}) => main(['next', '--change', 'feat', '--lang', 'en', ...extra], { cwd, env, ...opts });
// The marker lines come first (`devkit-run:`, then `devkit-end:` on an end); the JSON action follows them.
export const actionOf = (stdout) => JSON.parse(stdout.split('\n').filter((l) => !/^devkit-(run|end): /.test(l)).join('\n'));
const parsed = (r) => ({ first: r.stdout.split('\n')[0], action: actionOf(r.stdout) });

test('change-loop next: the approval awaited exits 1 and carries the readiness hash', () => {
  const root = planChange({ have: ['requirements', 'proposal', 'specs', 'design', 'tasks', 'readiness'] });
  const r = next(root);
  assert.equal(r.code, 1, r.stderr);
  const { first, action } = parsed(r);
  assert.equal(first, 'devkit-run: feat');
  const hash = `sha256:${createHash('sha256').update(readFileSync(join(root, 'openspec', 'changes', 'feat', 'readiness.md'))).digest('hex').slice(0, 12)}`;
  assert.deepEqual([action.kind, action.end.state, action.end.why, action.detail.readiness, action.stage], ['end', 'waiting-for-owner', 'waiting-approval', hash, 'approval']);
  assert.equal(action.reply, render('en', 'waiting-approval', { id: 'feat' }));
  assert.deepEqual([action.change, action.script, action.filesLanguage, action.branch], ['feat', 'devkit', 'en', 'main']);
});

test('change-loop next: a readiness failed at its ceiling exits 2', () => {
  const root = planChange({ have: ['requirements', 'proposal', 'specs', 'design', 'tasks', 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } });
  const r = next(root);
  assert.equal(r.code, 2, r.stderr);
  const { first, action } = parsed(r);
  assert.equal(first, 'devkit-run: feat');
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'ceiling']);
  assert.equal(action.reply, render('en', 'blocked', { id: 'feat', why: 'ceiling', stage: 'Plan readiness', attempt: 3 }));
});

test('change-loop next: an archived change exits 0 and reads no GitHub', () => {
  const root = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const asked = [];
  const spy = (what) => (args) => { asked.push(`${what} ${args[0]}`); return { status: 1, stdout: '', stderr: '' }; };
  const r = next(root, [], cleanEnv, { openspec: spy('openspec'), gh: spy('gh') });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(asked, [], 'neither OpenSpec nor GitHub was asked');
  const { first, action } = parsed(r);
  assert.equal(first, 'devkit-run: feat');
  assert.deepEqual([action.end.state, action.end.why, action.script], ['archived', 'archived', 'devkit']);
  assert.equal(action.reply, render('en', 'archived', { id: 'feat' }));
});

test('change-loop next: a change with no stage header exits 2 as begun under the previous script', () => {
  const root = planChange({ have: ['requirements', 'proposal'], headerless: true });
  const r = next(root);
  assert.equal(r.code, 2, r.stderr);
  const { first, action } = parsed(r);
  assert.equal(first, 'devkit-run: feat');
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'previous-script']);
  assert.match(action.reply, /\/ship-change feat/);
});

test('change-loop next: a plan stage is handed to its agent, and its key ends the run when nothing changed', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const r = next(root);
  assert.equal(r.code, 0, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.agent, action.stage, action.role], ['agent', PLANNER, 'proposal', 'change-planner']);
  assert.match(action.progressKey, /^proposal\/proposal@[0-9a-f]{12}$/);
  assert.ok(action.brief.includes(`Work only in ${action.root} on branch main;`));
  const again = next(root, ['--after', action.progressKey]);
  assert.equal(again.code, 2);
  assert.deepEqual([parsed(again).action.end.state, parsed(again).action.end.why], ['blocked', 'no-progress']);
  const moved = next(root, ['--after', action.progressKey.replace(/@.*/, '@000000000000')]);
  assert.equal(parsed(moved).action.end.why, 'not-delivered', 'the tree changed and the file is still missing');
});

test('change-loop next: an unknown change, an unknown option and a missing change exit 3 with no run line', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  for (const argv of [['next', '--change', 'nope', '--lang', 'en'], ['next', '--lang', 'en'], ['next', '--change', 'feat', '--lang', 'en', '--bogus']]) {
    const r = main(argv, { cwd: root, env: cleanEnv });
    assert.equal(r.code, 3, argv.join(' '));
    const body = JSON.parse(r.stdout);
    assert.equal(body.version, 1);
    assert.ok(body.error.length > 0);
    assert.equal(body.reply, render('en', 'request-unreadable'), argv.join(' '));
    assert.doesNotMatch(body.reply, /change-loop|--|\?/, 'no script name, option or placeholder');
  }
  assert.equal(main(['next', '--change', 'feat', '--lang', 'en'], { cwd: tmpRoot(), env: cleanEnv }).code, 3, 'no openspec folder above');
});

// ---- from the implementation on, over a real repository and a fake gh

const PROPOSAL = '# Proposal\n\n## Why\n\nx\n\n## Acceptance criteria\n\n- AC-1: a thing\n';
const PR_BODY = (id) => `${id}\n- AC-1\nopenspec/changes/${id}/evidence.md\n`;
const prJson = (id, over = {}) => ({
  number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: '', baseRefName: 'main', mergeable: 'MERGEABLE',
  body: PR_BODY(id), autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over,
});
const check = (name, bucket) => ({ name, state: bucket.toUpperCase(), bucket, link: `https://ci/${name}` });
const NO_TALK = { data: { viewer: { login: 'me' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } };
const PR_CONFIG = 'schema: devkit-lite\nship:\n  devkit-lite: pr\n  devkit: pr\n';
const RELEASE = { 'CHANGELOG.md': '# c\n', '.claude-plugin/marketplace.json': '{"v":1}\n', 'README.md': 'r\n' };

// A `devkit-lite` change `feat` in a worktree (a bare origin, a clone), every stage up to the code review passed at the
// code commit, the reviews and the evidence current, its pull request open with `checks`. `conflicts` are the files both
// the branch and origin/main edit (the same shape as conflictRepo in conduct-check.test.mjs, which is private to that file).
function deliveredChange({ checks = [check('build', 'pending')], conflicts = [], mergeable = 'MERGEABLE', requirements = '# Requirements\n' } = {}) {
  const t = roundRepo({ roadmap: '# Roadmap\n\n## Round 1: x\n- [ ] feat\n', config: PR_CONFIG, files: RELEASE });
  const wt = t.addWt('feat');
  const dir = (f) => `openspec/changes/feat/${f}`;
  const own = Object.fromEntries(conflicts.map((f) => [f, `feat edits ${f}\n`]));
  put(wt, {
    [dir('.openspec.yaml')]: 'schema: devkit-lite\n',
    [dir('proposal.md')]: PROPOSAL, [dir('requirements.md')]: requirements, [dir('specs/s/spec.md')]: '# Spec\n',
    [dir('tasks.md')]: '# Tasks\n\n## 1. First\n- [x] 1.1 code\n',
    'src/feat.ts': 'code\n', ...own,
  });
  const sha = commitAll(wt, 'code');
  const review = `Verdict: approved\nCommit: ${sha}\n\n# Review\n`;
  const withHead = (stage, body) => `${head(stage, sha)}${body}`;
  put(wt, {
    [dir('reviews/code-quality-reviewer.md')]: review, [dir('reviews/test-coverage-reviewer.md')]: review,
    [dir('evidence.md')]: withHead('evidence', `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n`),
    [dir('review.md')]: withHead('review', 'Consensus: PASS (round 1/2)\n\n# Review\n'),
    [dir('proposal.md')]: withHead('proposal', PROPOSAL), [dir('requirements.md')]: withHead('requirements', requirements),
    [dir('specs/s/spec.md')]: withHead('specs', '# Spec\n'), [dir('tasks.md')]: withHead('tasks', '# Tasks\n\n## 1. First\n- [x] 1.1 code\n'),
  });
  commitAll(wt, 'reviews, evidence and stage headers');
  if (conflicts.length) t.commitOrigin(Object.fromEntries(conflicts.map((f) => [f, `origin edits ${f}\n`])), 'origin edits');
  const gh = t.ghAt(wt);
  gh.set('pr-view', { stdout: prJson('feat', { headRefOid: git(wt, 'rev-parse', 'HEAD'), mergeable }) });
  gh.set('pr-checks', { stdout: checks });
  gh.set('api-graphql', { stdout: NO_TALK });
  return { t, wt, gh, env: { ...gh.env, ...SET } };
}

test('change-loop next: checks pending on the pull request exit 1 as waiting on GitHub', () => {
  const { t, env } = deliveredChange();
  const r = next(t.main, [], env);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  const { first, action } = parsed(r);
  assert.equal(first, 'devkit-run: feat');
  assert.deepEqual([action.end.state, action.end.why, action.script, action.root.endsWith('/feat')], ['waiting-on-github', 'waiting-github', 'devkit-lite', true]);
  assert.equal(action.reply, render('en', 'waiting-github', { id: 'feat', what: 'checks' }));
  assert.equal(next(t.main, [], env, {}).stdout, r.stdout, 'the same files give the same answer');
});

test('change-loop next: DEVKIT_BRANCH in the caller\'s environment does not stop the loop with stop-branch', () => {
  const { t, wt, gh, env } = deliveredChange();
  const leaked = { ...env, DEVKIT_BRANCH: 'other', DEVKIT_CHANGE: 'other', GITHUB_HEAD_REF: 'other', GITHUB_BASE_REF: 'other', DEVKIT_BYPASS: '1' };
  // The fixture can tell the two apart: the delivery checker alone, in that environment, stops on the branch.
  const direct = buildReport(collectState(wt, 'feat', { env: leaked, gh: undefined }), leaked);
  assert.equal(direct.next.step, 'stop-branch');
  const r = next(t.main, [], leaked);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.equal(parsed(r).action.end.why, 'waiting-github');
  assert.notEqual(parsed(r).action.end.why, 'wrong-branch');
  assert.ok(gh.calls().length > 0, 'GitHub was read through the cleaned environment');
});

test('change-loop next: a pull request conflicting only in release files hands resolve-release-conflict to the implementer', () => {
  const { t, env } = deliveredChange({ conflicts: ['CHANGELOG.md', '.claude-plugin/marketplace.json'], mergeable: 'CONFLICTING', checks: [check('build', 'pass')] });
  const r = next(t.main, [], env);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const { first, action } = parsed(r);
  assert.equal(first, 'devkit-run: feat');
  assert.deepEqual([action.kind, action.agent, action.step, action.stage], ['agent', TDD, 'resolve-release-conflict', 'implementation']);
  assert.deepEqual(action.detail.paths, ['.claude-plugin/marketplace.json', 'CHANGELOG.md']);
  assert.equal(action.detail.base, 'main');
  assert.match(action.detail.command[1], /release-merge\.mjs$/);
  assert.ok(action.brief.includes('resolve-release-conflict'));
});

test('change-loop next: a pull request conflicting in another file ends blocked as a pull request problem', () => {
  const { t, env } = deliveredChange({ conflicts: ['CHANGELOG.md', 'README.md'], mergeable: 'CONFLICTING', checks: [check('build', 'pass')] });
  const r = next(t.main, [], env);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.deepEqual([parsed(r).action.end.state, parsed(r).action.end.why], ['blocked', 'pr-problem']);
});

test('change-loop next: the change is found in its worktree whatever the working directory, and the brief points at it', () => {
  const { t, wt, env } = deliveredChange({ checks: [check('build', 'pass')], mergeable: 'MERGEABLE' });
  const fromMain = next(t.main, [], env);
  const fromWorktree = next(wt, [], env);
  assert.equal(fromMain.stdout, fromWorktree.stdout);
  const action = parsed(fromMain).action;
  assert.equal(action.root, wt);
  assert.equal(action.branch, 'feat');
  assert.equal(existsSync(join(wt, 'openspec', 'changes', 'feat')), true);
  assert.equal(action.end.state, 'waiting-for-owner', 'in pr mode a green pull request is the owner\'s to merge');
  assert.equal(action.end.why, 'waiting-merge');
  assert.equal(action.reply, render('en', 'waiting-merge', { id: 'feat', number: 12 }));
});

// ================================================================ phase 2: start, open, script and wait

const startRun = (cwd, text, { lang = 'en', args = [], env = cleanEnv } = {}) => main(['start', '--lang', lang, ...args], { cwd, env, stdin: text });
const body = (r) => JSON.parse(r.stdout);
const titleEn = (stage, flow = FLOWS.devkit) => stageOf(flow, stage).title.en;
const whereNext = (stage) => render('en', 'where.next', { stage: titleEn(stage) });
const sh = (cwd, args, input = '') => spawnSync(process.execPath, [LOOP, ...args], { cwd, env: cleanEnv, input, encoding: 'utf8' });

// What a command that "creates nothing" must leave as it was: the branches, the worktrees and the change folders.
function snapshot(root) {
  const changes = join(root, 'openspec', 'changes');
  return JSON.stringify({
    branches: git(root, 'branch', '--list', '--all'),
    worktrees: git(root, 'worktree', 'list', '--porcelain'),
    folders: existsSync(changes) ? readdirSync(changes).sort() : [],
    wtDir: existsSync(join(root, '.claude', 'worktrees')) ? readdirSync(join(root, '.claude', 'worktrees')).sort() : [],
  });
}

// A committed change `id` of the plan stages in `have`, written as passed, in a checkout (no GitHub involved). With `flow` it records
// `x-devkit-flow: <flow>`, as a change opened with that flow does (the tests of D-13 T-23 to T-25 give 2, the installed version); with none it
// follows flow 1.
function addChange(root, id, have = ['requirements', 'decisions'], { commit = true, flow = null } = {}) {
  const c0 = git(root, 'rev-parse', 'HEAD');
  const files = { '.openspec.yaml': `schema: devkit\n${flow === null ? '' : `x-devkit-flow: ${flow}\n`}` };
  for (const stage of have) files[PLAN_FILES[stage]] = `${head(stage, c0)}# ${stage}\n`;
  put(root, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/${id}/${f}`, b])));
  if (commit) commitAll(root, `change ${id}`);
}
const devkitRepo = (config = 'schema: devkit\n') => gitRepo({ config });

test('change-loop start: S0 a usage error exits 3 and creates nothing', () => {
  const root = devkitRepo();
  const before = snapshot(root);
  const bogus = startRun(root, 'change add x', { args: ['--bogus'] });
  assert.equal(bogus.code, 3);
  const b = body(bogus);
  assert.equal(b.version, 1);
  assert.ok(b.error.length > 0);
  assert.equal(b.reply, render('en', 'request-unreadable'));
  assert.match(b.error, /unknown option --bogus/, 'the raw message stays in the error field');
  assert.equal(main(['start'], { cwd: root, env: cleanEnv, stdin: 'change x' }).code, 0, 'no --lang is not an error: the language is Brazilian Portuguese');
  // An unreadable openspec/config.yaml (a directory in its place) is a usage error even for a verb of a later round.
  const broken = tmpFolder('devkit-change-loop-broken-');
  mkdirSync(join(broken, 'openspec', 'changes'), { recursive: true });
  mkdirSync(join(broken, 'openspec', 'config.yaml'));
  for (const text of ['change add x', 'roadmap']) assert.equal(startRun(broken, text).code, 3, text);
  assert.equal(snapshot(root), before);
});

test('change-loop start: S1 a verb of a later round says its round and creates nothing', () => {
  const root = devkitRepo();
  const before = snapshot(root);
  for (const [verb, round] of [['help', 23]]) {
    const r = startRun(root, `${verb.toUpperCase()} now please`);
    assert.equal(r.code, 0, verb);
    const b = body(r);
    assert.deepEqual([b.mode, b.verb, b.text, b.change], ['not-built', verb, 'now please', null], verb);
    assert.equal(b.reply, render('en', 'verb-not-built', { verb, round }));
  }
  const bare = tmpFolder('devkit-change-loop-bare-');
  assert.equal(body(startRun(bare, 'help')).mode, 'not-built', 'the verb is read before the project is');
  assert.equal(snapshot(root), before);
});

test('change-loop start: S2 no verb or an unknown verb names the commands that exist', () => {
  const root = devkitRepo();
  for (const text of ['', '   \n', 'frobnicate the thing', 'add a csv export']) {
    const b = body(startRun(root, text));
    assert.equal(b.mode, 'unknown-verb', JSON.stringify(text));
    assert.equal(b.reply, render('en', 'verb-unknown'));
  }
  assert.match(body(startRun(root, '', { lang: 'pt-BR' })).reply, /^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit project e \/devkit train/);
  assert.match(render('en', 'verb-unknown'), /\/devkit change.*\/devkit roadmap.*\/devkit status.*\/devkit project/);
  assert.equal(body(startRun(root, '', { lang: '${user_config.language}' })).reply, render('pt-BR', 'verb-unknown'));
});

test('change-loop start: S3 a folder with no openspec, or another schema, is not set up', () => {
  const bare = tmpFolder('devkit-change-loop-bare-');
  const other = gitRepo({ config: 'schema: spec-driven\n' });
  const none = gitRepo({ config: null });
  for (const cwd of [bare, other, none]) {
    const before = existsSync(join(cwd, 'openspec')) ? snapshot(cwd) : null;
    const r = startRun(cwd, 'change add an export');
    assert.equal(r.code, 0);
    const b = body(r);
    assert.equal(b.mode, 'not-set-up', cwd);
    assert.equal(b.reply, render('en', 'not-set-up'));
    assert.match(b.reply, /openspec-setup/);
    if (before) assert.equal(snapshot(cwd), before);
  }
});

test('change-loop start: S4 an unknown driver or a language that is not a tag names the setting', () => {
  for (const [block, setting, value] of [['driver: robot', 'driver', 'robot'], ['language: "not a tag"', 'language', 'not a tag']]) {
    const root = devkitRepo(`schema: devkit\ndevkit:\n  ${block}\n`);
    const b = body(startRun(root, 'change add an export'));
    assert.equal(b.mode, 'setting-unknown');
    const accepted = readDevkitSettings(root).unknown[0].accepted;
    assert.equal(b.reply, render('en', 'setting-unknown', { setting, value, accepted }));
    assert.ok(b.reply.includes(value) && b.reply.includes(accepted));
  }
  const both = devkitRepo('schema: devkit\ndevkit:\n  driver: compozy\n  language: "no tag"\n');
  assert.equal(body(startRun(both, 'change x')).mode, 'setting-unknown', 'S4 comes before S5');
});

test('change-loop start: S5 the compozy and script drivers are not built and run nothing', () => {
  for (const [driver, round] of [['compozy', 21], ['script', 22]]) {
    const root = devkitRepo(`schema: devkit\ndevkit:\n  driver: ${driver}\n`);
    addChange(root, 'feat');
    const before = snapshot(root);
    const b = body(startRun(root, 'change add an export'));
    assert.equal(b.mode, 'driver-not-built', driver);
    assert.equal(b.reply, render('en', 'driver-not-built', { driver, round }));
    assert.equal(snapshot(root), before);
  }
  const claude = devkitRepo('schema: devkit\ndevkit:\n  driver: claude\n');
  assert.equal(body(startRun(claude, 'change add an export')).mode, 'new', 'claude runs');
  assert.equal(body(startRun(devkitRepo(), 'change add an export')).mode, 'new', 'no block runs as claude');
});

// Invariant (T-23, D-13): the resume reply names the change and says where it stopped, and nothing else; layer: startMode (the resume); suite: change-loop.
// The change records flow 2, as an open with this release does: with no pin it follows flow 1 under the installed flow 2 and the reply gains the newer-flow line.
test('change-loop start: S6 one token naming a change resumes it and says where it stopped', () => {
  const root = devkitRepo();
  addChange(root, 'feat', undefined, { flow: 2 });
  addChange(root, 'other', ['requirements', 'proposal']);
  put(root, { 'openspec/changes/archive/2026-11-19-old/.openspec.yaml': 'schema: devkit\nx-devkit-flow: 2\n' });
  commitAll(root, 'archived old');
  const r = startRun(root, 'change feat');
  assert.equal(r.code, 0);
  const b = body(r);
  assert.deepEqual([b.mode, b.verb, b.text, b.change], ['resume', 'change', 'feat', 'feat']);
  assert.equal(b.reply, render('en', 'resumed', { id: 'feat', where: whereNext('proposal') }));
  assert.deepEqual(b.unfinished.map((u) => [u.id, u.root]), [['feat', realpathSync(root)], ['other', realpathSync(root)]]);
  const old = body(startRun(root, 'change old'));
  assert.deepEqual([old.mode, old.change], ['resume', 'old'], 'an archived change resumes too');
  assert.equal(old.reply, render('en', 'resumed', { id: 'old', where: render('en', 'where.archived') }));
  assert.equal(body(startRun(root, 'change old', { lang: 'pt-BR' })).reply, render('pt-BR', 'resumed', { id: 'old', where: render('pt-BR', 'where.archived') }));
  const spaced = body(startRun(root, '  CHANGE   feat  \n'));
  assert.deepEqual([spaced.mode, spaced.change], ['resume', 'feat']);
  assert.equal(body(startRun(root, 'change two words')).mode, 'ask-unfinished', 'two tokens are a request, not an id');
  // Through the form the skill uses: a quoted heredoc on standard input.
  const viaSkill = spawnSync('/bin/sh', ['-c', `${JSON.stringify(process.execPath)} ${JSON.stringify(LOOP)} start --lang en <<'DEVKIT_ARGS'\nchange feat\nDEVKIT_ARGS\n`], { cwd: root, env: cleanEnv, encoding: 'utf8' });
  assert.equal(viaSkill.status, 0, viaSkill.stderr);
  assert.deepEqual([JSON.parse(viaSkill.stdout).mode, JSON.parse(viaSkill.stdout).change], ['resume', 'feat']);
});

// (T-23, D-13: the change records flow 2.)
test('change-loop start: S6 a change that lives only in a worktree resumes there', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  const wt = t.addWt('wt-change');
  addChange(wt, 'wt-change', ['requirements', 'decisions'], { commit: false, flow: 2 });
  const b = body(startRun(t.main, 'change wt-change'));
  assert.deepEqual([b.mode, b.change], ['resume', 'wt-change']);
  assert.equal(b.unfinished[0].root, wt);
  assert.equal(b.reply, render('en', 'resumed', { id: 'wt-change', where: whereNext('proposal') }));
});

// (T-23, D-13: the change records flow 2.)
test('change-loop start: S7 no text and one unfinished change resumes it', () => {
  const root = devkitRepo();
  addChange(root, 'feat', ['requirements', 'proposal', 'specs', 'design', 'tasks', 'readiness'], { flow: 2 });
  put(root, { 'openspec/changes/archive/2026-11-19-old/.openspec.yaml': 'schema: devkit\n' });
  const b = body(startRun(root, 'change'));
  assert.deepEqual([b.mode, b.change, b.text], ['resume', 'feat', '']);
  assert.equal(b.reply, render('en', 'resumed', { id: 'feat', where: render('en', 'where.owner', { stage: titleEn('approval') }) }));
  assert.deepEqual(b.unfinished.map((u) => u.id), ['feat'], 'an archived change is not unfinished');
  assert.deepEqual(b.settings, { driver: 'claude', filesLanguage: 'en', personLanguage: 'en' });
});

test('change-loop start: S8 no text and several unfinished changes lists each with where it stopped', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.main, 'feat');
  const wt = t.addWt('arch', { branch: 'chore/archive-arch' });
  put(wt, { 'openspec/changes/archive/2026-11-20-arch/.openspec.yaml': 'schema: devkit\n' });
  const before = snapshot(t.main);
  const b = body(startRun(t.main, 'change'));
  assert.deepEqual([b.mode, b.change], ['choose', null]);
  const list = `arch (${render('en', 'where.archiving')}); feat (${whereNext('proposal')})`;
  assert.equal(b.reply, render('en', 'choose', { n: 2, list }));
  assert.deepEqual(b.unfinished.map((u) => [u.id, u.where]), [['arch', render('en', 'where.archiving')], ['feat', whereNext('proposal')]]);
  assert.equal(snapshot(t.main), before);
});

test('change-loop start: S9 no text and nothing unfinished says there is nothing to continue', () => {
  const root = devkitRepo();
  put(root, { 'openspec/changes/archive/2026-11-19-old/.openspec.yaml': 'schema: devkit\n' });
  const b = body(startRun(root, 'change'));
  assert.deepEqual([b.mode, b.change, b.unfinished], ['nothing', null, []]);
  assert.equal(b.reply, render('en', 'nothing-to-resume'));
  assert.match(body(startRun(root, 'change', { lang: 'pt-BR' })).reply, /^Não há change por terminar/);
});

test('change-loop start: S10 a new request while a change is unfinished asks first and creates nothing', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.main, 'feat');
  const before = snapshot(t.main);
  const one = body(startRun(t.main, 'change add a csv export'));
  assert.deepEqual([one.mode, one.change, one.text], ['ask-unfinished', null, 'add a csv export']);
  assert.equal(one.reply, render('en', 'ask-unfinished', { list: `feat (${whereNext('proposal')})` }));
  assert.equal(snapshot(t.main), before);
  const wt = t.addWt('arch', { branch: 'chore/archive-arch' });
  put(wt, { 'openspec/changes/archive/2026-11-20-arch/.openspec.yaml': 'schema: devkit\n' });
  const before2 = snapshot(t.main);
  const many = body(startRun(t.main, 'change add a csv export'));
  assert.equal(many.mode, 'ask-unfinished');
  assert.equal(many.reply, render('en', 'ask-unfinished-many', { list: `arch (${render('en', 'where.archiving')}); feat (${whereNext('proposal')})` }));
  assert.deepEqual(many.unfinished.map((u) => u.id), ['arch', 'feat']);
  assert.equal(snapshot(t.main), before2, 'nothing was created: branches, worktrees and folders are as they were');
  assert.equal(body(startRun(t.main, 'change refactor-it')).mode, 'ask-unfinished', 'one token that names no change is a request');
});

test('change-loop start: S11 a request with no unfinished change is new and carries no reply', () => {
  const root = devkitRepo('schema: devkit\ndevkit:\n  language: pt-BR\n  driver: claude\n');
  const b = body(startRun(root, 'change add a csv export', { lang: '${user_config.language}' }));
  assert.deepEqual([b.mode, b.verb, b.text, b.change, b.unfinished, b.version], ['new', 'change', 'add a csv export', null, [], 1]);
  assert.equal('reply' in b, false);
  assert.deepEqual(b.settings, { driver: 'claude', filesLanguage: 'pt-BR', personLanguage: 'pt-BR' });
  assert.deepEqual(body(startRun(devkitRepo(), 'change refactor', { lang: 'en' })).settings, { driver: 'claude', filesLanguage: 'en', personLanguage: 'en' });
});

test('change-loop start: S11 a request with quotes, backticks and a command substitution is read as text through the quoted heredoc', () => {
  const root = devkitRepo();
  const request = 'fix $(touch PWNED) `touch PWNED2` "double" \'single\' ; echo $HOME\nand a second line';
  const script = `${JSON.stringify(process.execPath)} ${JSON.stringify(LOOP)} start --lang en <<'DEVKIT_ARGS'\nchange ${request}\nDEVKIT_ARGS\n`;
  const r = spawnSync('/bin/sh', ['-c', script], { cwd: root, env: cleanEnv, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const b = JSON.parse(r.stdout);
  assert.deepEqual([b.mode, b.text], ['new', request]);
  assert.deepEqual([existsSync(join(root, 'PWNED')), existsSync(join(root, 'PWNED2'))], [false, false]);
});

// ---------------------------------------------------------------- open (D-4)

const openRun = (cwd, id, { script = 'devkit', why = 'doubt', request = 'Add a CSV export\nwith two lines\n', lang = 'en', env = cleanEnv, args } = {}) => (
  main(['open', id, ...(args ?? ['--script', script, '--why', why]), '--lang', lang], { cwd, env, stdin: request }));
const freshProject = (config = 'schema: devkit\n') => roundRepo({ roadmap: '# Roadmap\n', config });
const wtOf = (t, id) => join(t.main, '.claude', 'worktrees', id);

test('change-loop open: O1 an id that cannot be a change name creates nothing', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  for (const id of ['Bad', 'a', 'x--y', 'archive', 'a'.repeat(49), '-x', 'has space', 'a_b', '../x', 'ab-', 'a-', 'x-y-', 'a--b-c', '-']) {
    const r = openRun(t.main, id);
    assert.equal(r.code, 3, id);
    assert.equal(r.stdout.startsWith('devkit-run:'), false);
    const b = body(r);
    assert.equal(b.reply, render('en', 'name-invalid', { id }), id);
  }
  assert.equal(openRun(t.main, 'ab').code, 0, 'two characters is the shortest valid id');
  assert.equal(openRun(t.main, 'a-b-1').code, 0, 'words and digits joined by single dashes');
  assert.equal(openRun(t.main, 'a'.repeat(48)).code, 0, '48 characters is the longest');
  assert.notEqual(snapshot(t.main), before);
});

test('change-loop open: O2 an id already in use creates nothing and says the name is taken', () => {
  const cases = {
    'an active folder': (t) => put(t.main, { 'openspec/changes/taken-x/.openspec.yaml': 'schema: devkit\n' }),
    'an archived folder': (t) => put(t.main, { 'openspec/changes/archive/2026-01-01-taken-x/.openspec.yaml': 'schema: devkit\n' }),
    'a folder in another worktree': (t) => put(t.addWt('elsewhere'), { 'openspec/changes/taken-x/.openspec.yaml': 'schema: devkit\n' }),
    'a local branch': (t) => git(t.main, 'branch', 'taken-x'),
    'an archive branch': (t) => git(t.main, 'branch', 'chore/archive-taken-x'),
    'a remote branch': (t) => git(t.main, 'push', '-q', 'origin', 'HEAD:refs/heads/taken-x'),
    'a worktree folder': (t) => mkdirSync(wtOf(t, 'taken-x'), { recursive: true }),
  };
  for (const [label, arrange] of Object.entries(cases)) {
    const t = freshProject();
    arrange(t);
    const before = snapshot(t.main);
    const r = openRun(t.main, 'taken-x');
    assert.equal(r.code, 3, label);
    assert.equal(body(r).reply, render('en', 'name-taken', { id: 'taken-x' }), label);
    assert.equal(snapshot(t.main), before, label);
    assert.equal(existsSync(join(wtOf(t, 'taken-x'), 'openspec')), false, label);
  }
});

test('change-loop open: O3 refuses in a project not set up or with an unknown or unbuilt driver', () => {
  const cases = [
    ['schema: spec-driven\n', 'not-set-up'],
    ['schema: devkit\ndevkit:\n  driver: robot\n', 'setting-unknown'],
    ['schema: devkit\ndevkit:\n  language: "no tag"\n', 'setting-unknown'],
    ['schema: devkit\ndevkit:\n  driver: compozy\n', 'driver-not-built'],
    ['schema: devkit\ndevkit:\n  driver: script\n', 'driver-not-built'],
  ];
  for (const [config, mode] of cases) {
    const t = freshProject(config);
    const before = snapshot(t.main);
    const r = openRun(t.main, 'new-thing');
    assert.equal(r.code, 3, config);
    assert.equal(r.stdout.startsWith('devkit-run:'), false);
    const asked = body(startRun(t.main, 'change add a thing'));
    assert.equal(asked.mode, mode, config);
    assert.equal(body(r).reply, asked.reply, 'the reply is the one the typed command gives');
    assert.equal(snapshot(t.main), before, config);
  }
  const bare = tmpFolder('devkit-change-loop-bare-');
  assert.equal(openRun(bare, 'new-thing').code, 3);
});

test('change-loop open: O4 starts from origin/<default> after a fetch', () => {
  const t = freshProject();
  const other = tmpFolder('devkit-change-loop-other-');
  const clone = join(other, 'clone');
  git(other, 'clone', '-q', t.originDir, clone);
  put(clone, { 'NEWS.md': 'news\n' });
  const sha = commitAll(clone, 'news on origin');
  git(clone, 'push', '-q', 'origin', 'main');
  const mainHead = git(t.main, 'rev-parse', 'HEAD');
  assert.notEqual(mainHead, sha);

  const r = openRun(t.main, 'add-csv-export', { request: 'Add a CSV export\nwith two lines\n', script: 'devkit-lite', why: 'small' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const [first, ...rest] = r.stdout.split('\n');
  assert.equal(first, 'devkit-run: add-csv-export');
  const b = JSON.parse(rest.join('\n'));
  const wt = wtOf(t, 'add-csv-export');
  assert.deepEqual([b.version, b.change, b.script, b.branch, b.base], [1, 'add-csv-export', 'devkit-lite', 'add-csv-export', 'origin/main']);
  assert.equal(realpathSync(b.worktree), realpathSync(wt));
  assert.equal(b.reply, render('en', 'opened', { id: 'add-csv-export', script: 'devkit-lite', other: 'devkit', why: 'small' }));
  assert.match(b.reply, /add-csv-export/);
  assert.match(b.reply, /short script/);
  assert.match(b.reply, /small change that is easy to undo/);

  assert.equal(git(wt, 'rev-parse', 'HEAD~1'), sha, 'the branch starts from the fetched origin/main, the claim on top');
  assert.equal(git(wt, 'log', '-1', '--format=%s'), 'chore(openspec): open add-csv-export');
  assert.equal(git(t.main, 'ls-remote', 'origin', 'refs/heads/add-csv-export').split('\t')[0], git(wt, 'rev-parse', 'HEAD'), 'the claim is on origin');
  assert.equal(git(wt, 'symbolic-ref', '--short', 'HEAD'), 'add-csv-export');
  assert.equal(git(t.main, 'rev-parse', 'HEAD'), mainHead, 'the main checkout is untouched');
  assert.match(git(t.main, 'worktree', 'list', '--porcelain'), /branch refs\/heads\/add-csv-export/);
  const dir = join(wt, 'openspec', 'changes', 'add-csv-export');
  assert.match(readFileSync(join(dir, '.openspec.yaml'), 'utf8'), /^schema: devkit-lite$/m);
  const requirements = readFileSync(join(dir, 'requirements.md'), 'utf8');
  assert.equal(requirements.split('\n')[0], '<!-- devkit-stage requirements result=pending attempt=1 commit=none -->');
  assert.match(requirements, /## Request\n\n> Add a CSV export\n> with two lines\n\n## Assumptions/);

  // A change killed before its first question resumes at the grill with the request on disk (AC-3).
  const again = sh(t.main, ['next', '--change', 'add-csv-export', '--lang', 'en']);
  const action = JSON.parse(again.stdout.split('\n').slice(1).join('\n'));
  assert.deepEqual([action.kind, action.stage, action.root], ['grill', 'requirements', realpathSync(wt)]);
  assert.equal(body(startRun(t.main, 'change add-csv-export')).mode, 'resume');

  const pt = openRun(t.main, 'outro-pedido', { lang: 'pt-BR', script: 'devkit', why: 'ui' });
  assert.equal(pt.code, 0, pt.stderr);
  assert.equal(JSON.parse(pt.stdout.split('\n').slice(1).join('\n')).reply, render('pt-BR', 'opened', { id: 'outro-pedido', script: 'devkit', other: 'devkit-lite', why: 'ui' }));
});

test('change-loop open: O4 with no remote starts from HEAD', () => {
  const root = devkitRepo();
  put(root, { 'a.txt': 'x\n' });
  const sha = commitAll(root, 'second');
  assert.equal(git(root, 'remote'), '');
  const r = openRun(root, 'local-only', { script: 'devkit' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const b = JSON.parse(r.stdout.split('\n').slice(1).join('\n'));
  assert.equal(b.base, 'HEAD');
  assert.equal(git(join(root, '.claude', 'worktrees', 'local-only'), 'rev-parse', 'HEAD'), sha);
  assert.ok(existsSync(join(root, '.claude', 'worktrees', 'local-only', 'openspec', 'changes', 'local-only', 'requirements.md')));
});

// O5: a step after `git worktree add` fails. Nothing is left (the same snapshot), the reply is the usage-error one with the
// raw cause in `error`, and the same id opens once the cause is fixed.
const TEMPLATE = 'openspec/schemas/devkit/templates/requirements.md';
const failedOpen = (t, runner) => main(['open', 'half-made', '--script', 'devkit', '--why', 'doubt', '--lang', 'en'], { cwd: t.main, env: cleanEnv, stdin: 'Add a thing', openspec: runner });
const exploded = () => ({ status: 1, stdout: '', stderr: 'openspec exploded' });

test('change-loop open: O5 an OpenSpec command that fails leaves nothing behind and the same id opens afterwards', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  const r = failedOpen(t, exploded);
  assert.equal(r.code, 3, r.stdout);
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  const b = body(r);
  assert.match(b.error, /openspec new change failed: openspec exploded/);
  assert.equal(b.reply, render('en', 'request-unreadable'));
  assert.equal(snapshot(t.main), before, 'no worktree, no folder, no branch');
  assert.equal(git(t.main, 'branch', '--list', 'half-made'), '');
  assert.equal(existsSync(wtOf(t, 'half-made')), false);
  const again = openRun(t.main, 'half-made');
  assert.equal(again.code, 0, again.stdout + again.stderr);
  assert.ok(existsSync(join(wtOf(t, 'half-made'), 'openspec', 'changes', 'half-made', 'requirements.md')));
});

test('change-loop open: O5 a requirements template that is missing or has no request section leaves nothing behind and the same id opens afterwards', () => {
  const breakers = {
    'a template with no request section': (t) => t.commitOrigin({ [TEMPLATE]: '<!-- devkit-stage requirements result=pending attempt=1 commit=none -->\n# Requirements\n\n## Assumptions\n\n- \n' }, 'break the template'),
    'a schema with no requirements template': (t) => { rmSync(join(t.main, TEMPLATE)); const sha = commitAll(t.main, 'drop the template'); git(t.main, 'push', '-q', 'origin', 'main'); return sha; },
  };
  for (const [label, breakIt] of Object.entries(breakers)) {
    const t = freshProject();
    const good = readFileSync(join(t.main, TEMPLATE), 'utf8');
    breakIt(t);
    const before = snapshot(t.main);
    const r = failedOpen(t, undefined);
    assert.equal(r.code, 3, `${label}: ${r.stdout}`);
    assert.match(body(r).error, /requirements template/, label);
    assert.equal(body(r).reply, render('en', 'request-unreadable'), label);
    assert.equal(snapshot(t.main), before, `${label}: nothing is left`);
    assert.equal(git(t.main, 'branch', '--list', 'half-made'), '', label);
    t.commitOrigin({ [TEMPLATE]: good }, 'fix the template');
    const again = failedOpen(t, undefined);
    assert.equal(again.code, 0, `${label}: the same id opens once the cause is fixed: ${again.stdout}${again.stderr}`);
  }
});

test('change-loop open: O5 each cleanup step is tried on its own: a worktree removal that fails does not leave the branch behind', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  // The runner breaks the worktree (its .git file is gone) and fails: `git worktree remove` then cannot succeed, and the
  // folder and the registration are left for the next steps.
  const vanish = () => { rmSync(join(wtOf(t, 'half-made'), '.git')); return exploded(); };
  const r = failedOpen(t, vanish);
  assert.equal(r.code, 3, r.stdout);
  assert.match(body(r).error, /openspec exploded/, 'the original error is kept, not the cleanup\'s');
  assert.equal(git(t.main, 'branch', '--list', 'half-made'), '', 'the branch is gone although the first step failed');
  assert.equal(snapshot(t.main), before);
  assert.equal(openRun(t.main, 'half-made').code, 0, 'the same id opens afterwards');
});

test('change-loop open: a missing request, an unknown script or an unknown reason is a usage error and creates nothing', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  for (const r of [
    openRun(t.main, 'new-thing', { request: '  \n' }),
    openRun(t.main, 'new-thing', { script: 'spec-driven' }),
    openRun(t.main, 'new-thing', { why: 'because' }),
    openRun(t.main, 'new-thing', { args: ['--why', 'small'] }),
    openRun(t.main, 'new-thing', { args: ['--script', 'devkit'] }),
  ]) assert.equal(r.code, 3, r.stdout);
  assert.equal(snapshot(t.main), before);
  assert.equal(openRun(t.main, 'new-thing').code, 0, 'the same call with all three given opens the change');
});

// roadmap-coordinator D-10: two `open` calls at once take turns on one lock in the git common directory.
const openChild = (cwd, id) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [LOOP, 'open', id, '--script', 'devkit', '--why', 'doubt', '--lang', 'en'], { cwd, env: cleanEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
  child.stdin.end('Add a thing\n');
});

test('change-loop open: two opens at once for two ids both open their change, and for one id open it once', async () => {
  const t = freshProject();
  const two = await Promise.all([openChild(t.main, 'first-change'), openChild(t.main, 'second-change')]);
  assert.deepEqual(two.map((r) => r.code), [0, 0], two.map((r) => r.stdout).join('\n'));
  for (const id of ['first-change', 'second-change']) assert.ok(existsSync(join(wtOf(t, id), 'openspec', 'changes', id, 'requirements.md')), id);
  assert.equal(git(t.main, 'worktree', 'list').split('\n').length, 3);
  assert.equal(existsSync(join(t.main, '.git', 'devkit-open.lock')), false, 'the lock is removed');

  const same = await Promise.all([openChild(t.main, 'same-change'), openChild(t.main, 'same-change')]);
  assert.deepEqual(same.map((r) => r.code).sort(), [0, 3], same.map((r) => r.stdout).join('\n'));
  const refused = same.find((r) => r.code === 3);
  assert.equal(JSON.parse(refused.stdout).reply, render('en', 'name-taken', { id: 'same-change' }), 'the loser is told the name is taken');
  assert.equal(git(t.main, 'worktree', 'list').split('\n').length, 4, 'one worktree for the id');
  assert.equal(git(t.main, 'branch', '--list', 'same-change').split('\n').length, 1);
  assert.equal(existsSync(join(t.main, '.git', 'devkit-open.lock')), false);
});

test('change-loop open: a lock held by another call is waited for, and one older than ten minutes is taken over', async () => {
  const t = freshProject();
  const lock = join(t.main, '.git', 'devkit-open.lock');
  writeFileSync(lock, `${JSON.stringify({ pid: 1, at: new Date().toISOString() })}\n`);
  const waiting = openChild(t.main, 'waits-for-lock');
  let done = false;
  waiting.then(() => { done = true; });
  await new Promise((resolve) => { setTimeout(resolve, 900); });
  assert.equal(done, false, 'the call waits while the lock is held');
  rmSync(lock);
  const r = await waiting;
  assert.equal(r.code, 0, r.stdout);
  assert.equal(existsSync(lock), false);

  writeFileSync(lock, '');
  const old = new Date(Date.now() - 11 * 60_000);
  utimesSync(lock, old, old);
  const taken = openRun(t.main, 'takes-over');
  assert.equal(taken.code, 0, taken.stdout);
  assert.equal(existsSync(lock), false);
});

// ---------------------------------------------------------------- script (D-4)

const scriptRun = (cwd, id, script, why, lang = 'en') => main(['script', id, script, ...(why ? ['--why', why] : []), '--lang', lang], { cwd, env: cleanEnv });
const schemaOf = (checkout, id) => /^schema:\s*(\S+)/m.exec(readFileSync(join(checkout, 'openspec', 'changes', id, '.openspec.yaml'), 'utf8'))[1];
function opened(script) {
  const t = freshProject();
  const r = openRun(t.main, 'feat-x', { script, why: 'small' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  return { t, wt: wtOf(t, 'feat-x') };
}

test('change-loop script: C1 before any proposal the schema line is rewritten and the reply says why', () => {
  const { t, wt } = opened('devkit-lite');
  assert.equal(schemaOf(wt, 'feat-x'), 'devkit-lite');
  const r = scriptRun(t.main, 'feat-x', 'devkit', 'ui');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(body(r).reply, render('en', 'script-switched', { id: 'feat-x', script: 'devkit', why: 'ui' }));
  assert.equal(schemaOf(wt, 'feat-x'), 'devkit');
  assert.equal(body(scriptRun(t.main, 'feat-x', 'devkit-lite', 'small', 'pt-BR')).reply, render('pt-BR', 'script-switched', { id: 'feat-x', script: 'devkit-lite', why: 'small' }), 'the owner can switch back');
});

test('change-loop script: C2 once the proposal exists nothing changes and the reply says the plan is written', () => {
  const { t, wt } = opened('devkit-lite');
  put(wt, { 'openspec/changes/feat-x/proposal.md': '# Proposal\n' });
  const before = readFileSync(join(wt, 'openspec', 'changes', 'feat-x', '.openspec.yaml'), 'utf8');
  const r = scriptRun(t.main, 'feat-x', 'devkit', 'ui');
  assert.equal(r.code, 2);
  assert.equal(body(r).reply, render('en', 'script-locked', { id: 'feat-x' }));
  assert.equal(readFileSync(join(wt, 'openspec', 'changes', 'feat-x', '.openspec.yaml'), 'utf8'), before);
});

test('change-loop script: C3 the script already in use changes nothing and gives no reply', () => {
  const { t, wt } = opened('devkit');
  const file = join(wt, 'openspec', 'changes', 'feat-x', '.openspec.yaml');
  const before = readFileSync(file, 'utf8');
  const r = scriptRun(t.main, 'feat-x', 'devkit');
  assert.equal(r.code, 0);
  assert.equal('reply' in body(r), false);
  assert.equal(readFileSync(file, 'utf8'), before);
  for (const bad of [['feat-x', 'spec-driven'], ['nope', 'devkit'], ['feat-x']]) assert.equal(scriptRun(t.main, ...bad).code, 3, bad.join(' '));
});

test('change-loop script: the P3 trigger hands the switch to the session and its command moves the change to the full script', () => {
  const root = gitRepo({ config: 'schema: devkit-lite\n' });
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit-lite\n',
    'openspec/changes/feat/requirements.md': `${head('requirements', c0)}# Requirements\n\nClassification: kind=feature flags=[ui]\n`,
  });
  commitAll(root, 'requirements passed');
  const a = parsed(next(root)).action;
  assert.deepEqual([a.kind, a.step, a.script], ['session', 'switch-script', 'devkit-lite']);
  assert.equal(a.reply, render('en', 'script-switched', { id: 'feat', script: 'devkit', why: 'ui' }));
  const [cmd, ...args] = a.detail.command;
  const ran = spawnSync(cmd, args, { cwd: root, env: cleanEnv, encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  assert.equal(schemaOf(root, 'feat'), 'devkit');
  const after = parsed(next(root)).action;
  assert.equal(after.script, 'devkit');
  assert.notEqual(after.step, 'switch-script');
});

// ---------------------------------------------------------------- resuming (D-6)

test('change-loop resume: the same files give the same action before and after a kill', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const before = sh(root, ['next', '--change', 'feat', '--lang', 'en']);
  assert.equal(before.status, 0, before.stderr);
  // The session is killed here; a new one types /devkit change with no text on the untouched files.
  const start = sh(root, ['start', '--lang', 'en'], 'change\n');
  assert.equal(start.status, 0, start.stderr);
  const b = JSON.parse(start.stdout);
  assert.deepEqual([b.mode, b.change], ['resume', 'feat']);
  const after = sh(root, ['next', '--change', b.change, '--lang', 'en']);
  assert.equal(after.stdout, before.stdout, 'the same action');
  assert.equal(after.status, before.status);
});

test('change-loop next: a blocked change called again ends blocked again', () => {
  const root = planChange({ have: ['requirements', 'proposal', 'specs', 'design', 'tasks', 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } });
  const first = next(root);
  const second = next(root);
  assert.equal(first.code, 2);
  assert.equal(second.code, 2);
  assert.equal(second.stdout, first.stdout);
  assert.deepEqual([parsed(second).action.end.state, parsed(second).action.end.why], ['blocked', 'ceiling']);
});

// ---------------------------------------------------------------- wait (D-7)

const WAIT = build(rowOf('wait-checks', { pending: ['build'] }));
const WAIT_MERGE = build(rowOf('wait-merge', { number: 12 }));
const GH_DOWN = run({ rep: { end: endOf('blocked', 'delivery', 'gh-error', { error: 'HTTP 502' }) } });

// waitLoop over a scripted sequence of decisions (an Error is a poll that throws), with a sleep that only counts.
async function waited(items, { interval = 60 } = {}) {
  const sleeps = [];
  let polls = 0;
  const poll = async () => {
    if (polls >= items.length) throw new Error('polled past the script');
    const item = items[polls++];
    if (item instanceof Error) throw item;
    return item;
  };
  const action = await waitLoop({ poll, sleep: async (s) => { sleeps.push(s); }, interval, id: 'feat', lang: 'en' });
  return { action, sleeps, polls };
}
const endsWith = async (label, wanted) => {
  const r = await waited([WAIT, WAIT, wanted]);
  assert.deepEqual(r.action, wanted, label);
  assert.equal(r.polls, 3, 'it stops polling at the new decision');
  assert.deepEqual(r.sleeps, [60, 60]);
  return r.action;
};

test('change-loop wait: W1 nothing new keeps polling with no limit of its own', async () => {
  const changed = build(rowOf('enable-auto-merge', { number: 12 }));
  const r = await waited([...Array(51).fill(WAIT), changed]);
  assert.deepEqual(r.action, changed);
  assert.equal(r.polls, 52, 'fifty unchanged polls did not end it');
  assert.equal(r.sleeps.length, 51);
  assert.ok(r.sleeps.every((s) => s === 60), 'the interval is the one asked for');
});

test('change-loop wait: W2 the checks pass in merge mode, it ends with enable-auto-merge', async () => {
  const a = await endsWith('W2', build(rowOf('enable-auto-merge', { number: 12 })));
  assert.deepEqual([a.kind, a.step], ['session', 'enable-auto-merge']);
});

test('change-loop wait: W3 the checks pass in pr mode, it ends with the owner to merge', async () => {
  const a = await endsWith('W3', build(rowOf('ready', { number: 12 })));
  assert.deepEqual([a.end.state, a.end.why], ['waiting-for-owner', 'waiting-merge']);
});

test('change-loop wait: W4 a check fails, it ends with the fix for the implementer', async () => {
  const a = await endsWith('W4', build(rowOf('fix-checks', { checks: ['build'] })));
  assert.deepEqual([a.kind, a.agent, a.step], ['agent', TDD, 'fix-checks']);
});

test('change-loop wait: W5 the pull request merges, it ends with the retro', async () => {
  const a = await endsWith('W5', build(rowOf('retro')));
  assert.deepEqual([a.kind, a.step], ['session', 'retro']);
});

test('change-loop wait: W6 the archive pull request merges, it ends archived', async () => {
  const archived = run({ report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } });
  const r = await waited([WAIT_MERGE, WAIT_MERGE, archived]);
  assert.deepEqual([r.action.end.state, r.action.end.why], ['archived', 'archived']);
  assert.equal(r.polls, 3);
});

test('change-loop wait: W7 the pull request is closed, it ends blocked naming the pull request', async () => {
  const closed = run({ rep: { end: endOf('blocked', 'delivery', 'pr-closed', { number: 12 }) } });
  const a = await endsWith('W7', closed);
  assert.deepEqual([a.end.state, a.end.why], ['blocked', 'pr-closed']);
  assert.match(a.reply, /#12/);
});

test('change-loop wait: W8 two failed reads keep waiting, three in a row end blocked quoting the error', async () => {
  const down = new Error('HTTP 502');
  const changed = build(rowOf('enable-auto-merge', { number: 12 }));
  const kept = await waited([WAIT, down, GH_DOWN, WAIT, changed]);
  assert.deepEqual(kept.action, changed, 'two failures then a success keeps waiting');
  const reset = await waited([WAIT, down, down, WAIT, down, down, changed]);
  assert.deepEqual(reset.action, changed, 'a success starts the count again');
  const out = await waited([WAIT, down, GH_DOWN, down]);
  assert.deepEqual([out.action.kind, out.action.end.state, out.action.end.why, out.action.change], ['end', 'blocked', 'github-unreadable', 'feat']);
  assert.equal(out.action.reply, render('en', 'blocked', { id: 'feat', why: 'github-unreadable', error: 'HTTP 502' }));
  assert.equal(out.polls, 4, 'it stopped at the third failure in a row');
  const viaAction = await waited([WAIT, GH_DOWN, GH_DOWN, GH_DOWN]);
  assert.deepEqual(viaAction.action.end, { state: 'blocked', why: 'github-unreadable' });
  assert.match(viaAction.action.reply, /HTTP 502/);
});

test('change-loop wait: W9 a comment asks something, it ends with the answer step', async () => {
  const a = await endsWith('W9', build(rowOf('answer', { number: 12 })));
  assert.deepEqual([a.kind, a.step], ['session', 'answer']);
});

test('change-loop wait: a different wait is a different decision, and a first decision that is not a wait ends at once', async () => {
  const swapped = await waited([WAIT, WAIT_MERGE]);
  assert.deepEqual(swapped.action, WAIT_MERGE);
  const now = await waited([build(rowOf('commit', { paths: [] }))]);
  assert.deepEqual([now.action.kind, now.sleeps, now.polls], ['agent', [], 1]);
});

test('change-loop wait: the CLI exits at once with the next action when the change is not waiting', async () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const sleeps = [];
  const r = await runCommand(['wait', '--change', 'feat', '--lang', 'en'], { cwd: root, env: cleanEnv, sleep: async (s) => { sleeps.push(s); } });
  const direct = next(root);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, direct.stdout, 'printed exactly as next prints it');
  assert.equal(r.stdout.split('\n')[0], 'devkit-run: feat');
  assert.deepEqual(sleeps, []);
  const spawned = sh(root, ['wait', '--change', 'feat', '--lang', 'en']);
  assert.deepEqual([spawned.status, spawned.stdout], [0, direct.stdout], 'from its file, with no sleep and no GitHub');
  for (const argv of [['wait', '--lang', 'en'], ['wait', '--change', 'feat', '--interval', '4'], ['wait', '--change', 'feat', '--interval', 'soon'], ['wait', '--change', 'nope']]) {
    assert.equal((await runCommand(argv, { cwd: root, env: cleanEnv })).code, 3, argv.join(' '));
  }
});

test('change-loop wait: the CLI polls through the fake gh and ends when the checks pass (W1, W3)', async () => {
  const { t, gh, env } = deliveredChange();
  const sleeps = [];
  const sleep = async (s) => {
    sleeps.push(s);
    if (sleeps.length === 2) gh.set('pr-checks', { stdout: [check('build', 'pass')] }); // GitHub answers during the second wait
  };
  const r = await runCommand(['wait', '--change', 'feat', '--lang', 'en', '--interval', '5'], { cwd: t.main, env, sleep });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const { first, action } = parsed(r);
  assert.equal(first, 'devkit-run: feat');
  assert.deepEqual([action.end.state, action.end.why], ['waiting-for-owner', 'waiting-merge']);
  assert.deepEqual(sleeps, [5, 5], 'one unchanged poll (W1), then GitHub answers (W3)');
});

// ---------------------------------------------------------------- the locks (D-8, D-12a)

const GUARD = join(HERE, 'guard.mjs');
const runOf = (input) => guardModule.runOf(input);
const SESSION = 'session-0001';
const sandbox = () => tmpFolder('devkit-change-loop-lock-');

// Transcript lines in the stored forms the probe of D-12a recorded (Claude Code 2.1.326, session ids replaced).
const LINE_BASE = { parentUuid: null, isSidechain: false, userType: 'external', entrypoint: 'sdk-cli', cwd: '/scratch/project', sessionId: SESSION, version: '2.1.326', gitBranch: 'main' };
const stored = (extra) => JSON.stringify({ ...LINE_BASE, uuid: 'uuid-0001', timestamp: '2026-11-20T10:00:00.000Z', ...extra });
const commandText = (name, args) => `<command-message>${name.replace(/^.*:|^\//g, '')}</command-message>\n<command-name>${name}</command-name>\n<command-args>${args}</command-args>`;
// A typed command: a line of type user whose message.content is a string.
export const typedLine = (args, name = '/devkit') => stored({ type: 'user', message: { role: 'user', content: commandText(name, args) } });
// The first line of a plain typed message (the panel's own form).
const plainLine = (text) => stored({ type: 'user', message: { role: 'user', content: text } });
// The skill body that follows the typed command: type user, isMeta, a list holding one text block.
const skillBodyLine = (args) => stored({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text: `Base directory for this skill: /plugin/skills/devkit\n\nRun the loop. A line devkit-run: some-id is printed by it.\n\nARGUMENTS: ${args}` }] } });
// The tool result of a command that printed `text`, in one of the three stored forms: `both` (content a string, and
// toolUseResult.stdout), `stdout` (the marker only in toolUseResult.stdout) and `blocks` (content a list of text blocks).
const toolResultLine = (text, form = 'both') => stored({
  type: 'user',
  message: { role: 'user', content: [{ tool_use_id: 'toolu-0001', type: 'tool_result', content: form === 'blocks' ? [{ type: 'text', text: 'first block' }, { type: 'text', text }] : form === 'stdout' ? 'ok' : text, is_error: false }] },
  ...(form === 'blocks' ? {} : { toolUseResult: { stdout: text, stderr: '', interrupted: false, isImage: false, noOutputExpected: false } }),
});
// A command that printed `devkit-run: <id>`.
export const runLine = (id, form = 'both') => toolResultLine(`devkit-run: ${id}\n{"version":1}`, form);
// A command that ended the run: `next` or `wait` (the run line first, then the end line, then the action) or the session's own
// `reply` of an end key (the end line alone, then the reply).
const nextEndLine = (id, state, form = 'both') => toolResultLine(`devkit-run: ${id}\ndevkit-end: ${id} ${state}\n{"version":1}`, form);
const endLine = (id, state, form = 'both') => toolResultLine(`devkit-end: ${id} ${state}\nThe change ${id} stopped: x.`, form);
// The api-request-blob lines repeat the command text inside text blocks: never the typed command.
const blobLine = (text) => stored({ type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text }] } });
export const assistantLine = () => stored({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
export const transcriptOf = (lines) => {
  const file = join(sandbox(), `${SESSION}.jsonl`);
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
};
const runTranscript = (id = 'feat', args = 'change add the feature') => transcriptOf([typedLine(args), skillBodyLine(args), assistantLine(), runLine(id)]);

test('change-loop lock run: the typed command and the printed line give the change of the run', () => {
  const run = runOf({ transcript_path: runTranscript('probe-change', 'change probe') });
  assert.equal(run?.change, 'probe-change');
});

test('change-loop lock run: the plugin-scoped command with its arguments is a run too', () => {
  const file = transcriptOf([typedLine('change add the feature', '/devkit-openspec:devkit'), runLine('feat')]);
  assert.equal(runOf({ transcript_path: file })?.change, 'feat');
});

test('change-loop lock run: a first line /devkit change in plain text is a run too', () => {
  const file = transcriptOf([plainLine('/devkit change add the feature\nsecond line'), runLine('feat')]);
  assert.equal(runOf({ transcript_path: file })?.change, 'feat');
});

test('change-loop lock run: no devkit-run line after the command is no run', () => {
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), skillBodyLine('change x'), assistantLine()]) }), null);
  assert.equal(runOf({ transcript_path: transcriptOf([runLine('feat'), typedLine('change x')]) }), null, 'a line before the command is not after it');
});

test('change-loop lock run: two lines, the later wins', () => {
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('first'), assistantLine(), runLine('second')]) })?.change, 'second');
});

test('change-loop lock run: a newer typed command of another name ends the run, and a newer /devkit change starts another', () => {
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat'), typedLine('', '/clear')]) }), null);
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat'), plainLine('/review the plan')]) }), null);
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat'), typedLine('change y')]) }), null, 'the new command has no line yet');
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat'), typedLine('change y'), runLine('other')]) })?.change, 'other');
});

test('change-loop lock run: an owner message that is not a slash command leaves the run under way, a /devkit with another verb is no run', () => {
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat'), plainLine('yes, go on'), plainLine('/Users/me/notes.txt is the file')]) })?.change, 'feat');
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('status'), runLine('feat')]) }), null);
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine(''), runLine('feat')]) }), null);
});

test('change-loop lock run: api-request-blob lines and the skill body are not the typed command nor the run line', () => {
  const text = commandText('/devkit', 'change probe');
  assert.equal(runOf({ transcript_path: transcriptOf([blobLine(text), runLine('feat')]) }), null, 'a blob is not a typed command');
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('', '/clear'), blobLine(text), runLine('feat')]) }), null, 'a blob after another command does not start a run');
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat'), blobLine('devkit-run: other\n'), skillBodyLine('change x')]) })?.change, 'feat', 'a blob and the skill body hold no run line');
});

test('change-loop lock run: no transcript, an unreadable one or a broken line is no run, and never throws', () => {
  assert.equal(runOf({}), null);
  assert.equal(runOf({ transcript_path: join(sandbox(), 'missing.jsonl') }), null);
  assert.equal(runOf({ transcript_path: sandbox() }), null, 'a folder');
  assert.equal(runOf({ transcript_path: transcriptOf(['{not json', typedLine('change x'), '{"type":"user", broken', runLine('feat')]) })?.change, 'feat');
});

test('change-loop lock run: one scan of the transcript yields the typed commands and the tool results in order, and no more', () => {
  const file = transcriptOf([typedLine('change x'), skillBodyLine('change x'), blobLine('/devkit change y'), assistantLine(), runLine('feat', 'blocks'), runLine('other', 'stdout'), typedLine('status')]);
  const events = guardModule.transcriptEvents({ transcript_path: file });
  assert.deepEqual(events.map((e) => (e.typed ? `typed:${e.typed.name} ${e.typed.args}` : 'results')), ['typed:devkit change x', 'results', 'results', 'typed:devkit status']);
  assert.match(events[1].texts.join('\n'), /devkit-run: feat/);
  assert.match(events[2].stdout, /devkit-run: other/);
});

test('change-loop lock run: an unreadable transcript scans to null and never throws', () => {
  assert.equal(guardModule.transcriptEvents({ transcript_path: join(sandbox(), 'missing.jsonl') }), null);
  assert.equal(guardModule.transcriptEvents({}), null);
  assert.equal(guardModule.transcriptEvents(null), null);
});

test('change-loop lock run: both readers interpret events already scanned, without reading the file again', () => {
  const file = transcriptOf([typedLine('change x'), runLine('feat')]);
  const events = guardModule.transcriptEvents({ transcript_path: file });
  const gone = { transcript_path: join(sandbox(), 'missing.jsonl') };
  assert.equal(guardModule.runOf(gone, events)?.change, 'feat');
  assert.equal(guardModule.roadmapRunOf(gone, events), null);
});

test('change-loop lock run: the marker is found in each stored form of a tool result (string, stdout only, list of text blocks)', () => {
  for (const form of ['both', 'stdout', 'blocks']) {
    assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat', form)]) })?.change, 'feat', form);
    assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), runLine('feat'), endLine('feat', 'blocked', form)]) })?.ended, 'blocked', `${form}: an end the session declared`);
    assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), nextEndLine('feat', 'waiting-for-owner', form)]) })?.ended, 'waiting-for-owner', `${form}: an end the loop printed`);
  }
});

test('change-loop lock run: the run\'s last recorded action is an end while the newest marker is an end line', () => {
  const ended = (lines) => runOf({ transcript_path: transcriptOf([typedLine('change x'), ...lines]) });
  assert.equal(ended([runLine('feat')])?.ended, null, 'a run line alone');
  assert.deepEqual(ended([nextEndLine('feat', 'blocked')]), { change: 'feat', command: 'change x', ended: 'blocked' }, 'the run line and the end line of one output');
  assert.equal(ended([runLine('feat'), assistantLine(), endLine('feat', 'blocked')])?.ended, 'blocked', 'the session\'s own declaration');
  for (const state of ['archived', 'waiting-for-owner', 'waiting-on-github', 'blocked']) assert.equal(ended([nextEndLine('feat', state)])?.ended, state, state);
  assert.equal(ended([nextEndLine('feat', 'blocked'), runLine('feat')])?.ended, null, 'a new action after an end');
  assert.equal(ended([nextEndLine('feat', 'blocked'), runLine('feat'), endLine('feat', 'waiting-on-github')])?.ended, 'waiting-on-github', 'the newest marker wins');
  assert.equal(ended([endLine('feat', 'blocked')]), null, 'an end line alone is not a run');
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), nextEndLine('feat', 'blocked'), typedLine('change y')]) }), null, 'a newer typed command ends the run');
  assert.equal(runOf({ transcript_path: transcriptOf([typedLine('change x'), nextEndLine('feat', 'blocked'), typedLine('change y'), runLine('other')]) })?.ended, null, 'and the new run starts with no end');
  assert.equal(ended([runLine('feat'), blobLine('devkit-end: feat blocked\n'), skillBodyLine('change x')])?.ended, null, 'a blob and the skill body hold no end line');
  assert.equal(ended([runLine('feat'), toolResultLine('see devkit-end: feat blocked in the text\nnot at the start')])?.ended, null, 'only a line that starts with the marker counts');
});

// ---- the modes, as subprocesses of guard.mjs

function hook(mode, input, env = {}) {
  const r = spawnSync(process.execPath, [GUARD, mode], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...SET, ...env } });
  return { code: r.status, err: r.stderr, out: r.stdout };
}
export const stopInput = (root, transcript, extra = {}) => ({ session_id: SESSION, transcript_path: transcript, cwd: root, stop_hook_active: false, background_tasks: [], ...extra });
const subInput = (root, transcript, role, extra = {}) => stopInput(root, transcript, { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001', agent_transcript_path: join(sandbox(), 'agent.jsonl'), ...extra });
const PLAN_UP_TO_TASKS = ['requirements', 'proposal', 'specs', 'design', 'tasks'];

test('change-loop lock stop: T1 no run in the session lets the stop through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  for (const transcript of [transcriptOf([assistantLine()]), transcriptOf([typedLine('change x'), assistantLine()]), transcriptOf([typedLine('change x'), runLine('feat'), typedLine('', '/clear')]), undefined]) {
    const r = hook('stop', stopInput(root, transcript), { TMPDIR: tmp });
    assert.equal(r.code, 0, r.err);
  }
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false, 'nothing recorded');
});

// A preload that appends one line to COUNT_FILE for every readFileSync of the file named by WATCH_FILE.
export const readCounter = () => {
  const dir = sandbox();
  const preload = join(dir, 'count-reads.mjs');
  writeFileSync(preload, [
    "import fs, { appendFileSync } from 'node:fs';",
    "import { syncBuiltinESMExports } from 'node:module';",
    'const real = fs.readFileSync;',
    'fs.readFileSync = (file, ...rest) => { if (String(file) === process.env.WATCH_FILE) appendFileSync(process.env.COUNT_FILE, "read\\n"); return real(file, ...rest); };',
    'syncBuiltinESMExports();',
  ].join('\n'));
  const count = join(dir, 'reads.log');
  return {
    env: (watch) => ({ NODE_OPTIONS: `--import=${preload}`, WATCH_FILE: watch, COUNT_FILE: count }),
    reads: () => (existsSync(count) ? readFileSync(count, 'utf8').split('\n').filter(Boolean).length : 0),
  };
};

test('change-loop lock: a hook call in a change run reads the transcript once on every lock, and decides as before', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  for (const [mode, input, code] of [
    ['stop', (t) => stopInput(root, t), 2],
    ['subagent-stop', (t) => subInput(root, t, 'change-planner'), 2],
    ['agent', (t) => stopInput(root, t, { tool_input: { subagent_type: 'general-purpose' } }), 2],
  ]) {
    const transcript = runTranscript();
    const spy = readCounter();
    const r = hook(mode, input(transcript), { TMPDIR: sandbox(), ...spy.env(transcript) });
    assert.equal(r.code, code, `${mode}: ${r.err}`);
    assert.equal(spy.reads(), 1, `${mode}: the transcript is read once`);
  }
});

test('change-loop lock stop: T2 a background task running lets the stop through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tasks = [{ id: 'byxlntme1', type: 'shell', status: 'running', description: 'Wait 30 seconds in background', command: 'sleep 30' }];
  const r = hook('stop', stopInput(root, runTranscript(), { background_tasks: tasks }), { TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
});

test('change-loop lock stop: T2 background_tasks given as an object lets the stop through, an empty one does not', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const task = { id: 'byxlntme1', type: 'shell', status: 'running', description: 'Wait 30 seconds in background', command: 'sleep 30' };
  assert.equal(hook('stop', stopInput(root, runTranscript(), { background_tasks: { byxlntme1: task } }), { TMPDIR: sandbox() }).code, 0);
  assert.equal(hook('stop', stopInput(root, runTranscript(), { background_tasks: {} }), { TMPDIR: sandbox() }).code, 2, 'an empty object is no task');
});

test('change-loop lock stop: T3 an end state of the loop lets the stop through', () => {
  const approval = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'] });
  const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const ceiling = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } });
  for (const [name, root] of [['waiting for the owner', approval], ['archived', archived], ['blocked', ceiling]]) {
    const r = hook('stop', stopInput(root, runTranscript()), { TMPDIR: sandbox() });
    assert.equal(r.code, 0, `${name}: ${r.err}`);
  }
});

test('change-loop lock stop: T3a an end the session declared or the loop printed lets the stop through at the first attempt, until a later run line', () => {
  // The state is a ready planner stage: with no end recorded the first stop is refused (T5); the end is all that differs.
  const root = planChange({ have: ['requirements', 'decisions'] });
  const stop = (lines, tmp = sandbox()) => hook('stop', stopInput(root, transcriptOf([typedLine('change x'), ...lines])), { TMPDIR: tmp });
  assert.equal(stop([runLine('feat')]).code, 2, 'no end recorded: refused');
  const cases = {
    'a stage agent returned a failure and the session declared the run blocked': [runLine('feat'), assistantLine(), endLine('feat', 'blocked')],
    'a phase gate ran red and the session declared the run blocked': [runLine('feat'), endLine('feat', 'blocked', 'blocks')],
    'a pull-request decision was left to the owner': [runLine('feat'), endLine('feat', 'waiting-for-owner', 'stdout')],
    'the loop ended the run for no progress or a stage not delivered (next --after)': [nextEndLine('feat', 'blocked')],
  };
  for (const [label, lines] of Object.entries(cases)) {
    const tmp = sandbox();
    const r = stop(lines, tmp);
    assert.equal(r.code, 0, `${label}: ${r.err}`);
    assert.equal(existsSync(join(tmp, 'devkit-stop')), false, `${label}: nothing was refused, nothing recorded`);
  }
  const again = sandbox();
  assert.equal(stop([nextEndLine('feat', 'blocked'), runLine('feat')], again).code, 2, 'the owner went on: a later run line, the stage is ready again');
  assert.equal(stop([nextEndLine('feat', 'blocked'), runLine('feat')], again).code, 0, 'and the same state a second time is let through (T6)');
});

test('change-loop lock stop: T3a reads a real no-progress end of next --after, the other locks still refuse after an end', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const first = next(root);
  const key = parsed(first).action.progressKey;
  const stuck = next(root, ['--after', key]);
  assert.equal(parsed(stuck).action.end.why, 'no-progress');
  assert.match(stuck.stdout, /^devkit-run: feat\ndevkit-end: feat blocked\n/);
  const transcript = transcriptOf([typedLine('change x'), toolResultLine(stuck.stdout)]);
  assert.equal(hook('stop', stopInput(root, transcript), { TMPDIR: sandbox() }).code, 0, 'the stop is let through');
  // Only the stop lock reads the end: a run that ended is still a run for the edit and the hand-off locks.
  const lite = liteChange();
  const edit = hook('edit', editInput(lite, 'src/a.ts', transcript));
  assert.equal(edit.code, 2, edit.err);
  assert.match(edit.err, LOCK_TEXT);
  assert.equal(hook('agent', agentInput(lite, transcript, 'general-purpose')).code, 2);
});

test('change-loop lock stop: T4 the grill, waiting for the owner, lets the stop through', () => {
  const root = planChange({ have: [] });
  const r = hook('stop', stopInput(root, runTranscript()), { TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
});

test('change-loop lock stop: T5 a stage ready is refused once, naming the change, the stage and the command, and the key is recorded', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  const r = hook('stop', stopInput(root, runTranscript()), { TMPDIR: tmp, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' });
  assert.equal(r.code, 2, r.err);
  assert.match(r.err, /the change feat has the stage proposal ready \(devkit-core:change-planner\)/);
  assert.ok(r.err.includes(`node ${HOOKS_DIR}/change-loop.mjs next --change feat --lang en`), r.err);
  const action = JSON.parse(next(root).stdout.split('\n').slice(1).join('\n'));
  assert.deepEqual(JSON.parse(readFileSync(join(tmp, 'devkit-stop', `${SESSION}.json`), 'utf8')), { key: action.progressKey });
  // The person's language comes from the plugin's user setting: pt-BR when it is unset or is anything else.
  const pt = hook('stop', stopInput(root, runTranscript()), { TMPDIR: sandbox() });
  assert.ok(pt.err.includes(`next --change feat --lang pt-BR`), pt.err);
});

test('change-loop lock stop: T5 a stage ready of a delivery step names the step', () => {
  const { t, env } = deliveredChange({ checks: [check('build', 'fail')] });
  const r = hook('stop', stopInput(t.main, runTranscript()), { ...env, TMPDIR: sandbox() });
  assert.equal(r.code, 2, r.err);
  assert.match(r.err, /the change feat has the stage implementation ready \(devkit-core:tdd-implementer\)/);
});

test('change-loop lock stop: T6 the same state a second time is let through, a changed state is refused again', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  const transcript = runTranscript();
  assert.equal(hook('stop', stopInput(root, transcript), { TMPDIR: tmp }).code, 2);
  assert.equal(hook('stop', stopInput(root, transcript), { TMPDIR: tmp }).code, 0, 'unchanged state');
  put(root, { 'notes.txt': 'something changed\n' });
  assert.equal(hook('stop', stopInput(root, transcript), { TMPDIR: tmp }).code, 2, 'changed state');
  writeFileSync(join(tmp, 'devkit-stop', `${SESSION}.json`), JSON.stringify({ key: 'proposal/proposal@000000000000' }));
  assert.equal(hook('stop', stopInput(root, transcript), { TMPDIR: tmp }).code, 2, 'another recorded key');
  assert.equal(hook('stop', stopInput(root, transcript, { session_id: 'session-0002' }), { TMPDIR: tmp }).code, 2, 'the record is per session');
});

test('change-loop lock stop: T7 an unreadable transcript or a checker error lets the stop through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  assert.equal(hook('stop', stopInput(root, join(sandbox(), 'gone.jsonl')), { TMPDIR: tmp }).code, 0);
  assert.equal(hook('stop', stopInput(root, runTranscript('nope')), { TMPDIR: tmp }).code, 0, 'a change the checker does not know');
  assert.equal(hook('stop', stopInput(root, runTranscript()), { TMPDIR: tmp, PATH: '/nonexistent' }).code, 0, 'no openspec CLI');
  const r = spawnSync(process.execPath, [GUARD, 'stop'], { input: 'not json', encoding: 'utf8', env: { ...process.env, ...SET, TMPDIR: tmp } });
  assert.equal(r.status, 0);
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false, 'nothing was refused, nothing recorded');
});

test('change-loop lock subagent-stop: U1 no run lets the stop through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const r = hook('subagent-stop', subInput(root, transcriptOf([assistantLine()]), 'change-planner'), { TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
});

test('change-loop lock subagent-stop: U2 a role with no stage file lets the stop through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  for (const role of ['code-quality-reviewer', 'tdd-implementer', 'commit-and-pr', 'codebase-researcher', 'general-purpose']) {
    const r = hook('subagent-stop', subInput(root, runTranscript(), role), { TMPDIR: sandbox() });
    assert.equal(r.code, 0, `${role}: ${r.err}`);
  }
});

test('change-loop lock subagent-stop: U3 the next stage belongs to another role lets the stop through', () => {
  const root = planChange({ have: PLAN_UP_TO_TASKS });
  const r = hook('subagent-stop', subInput(root, runTranscript(), 'change-planner'), { TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
  const delivered = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'] });
  assert.equal(hook('subagent-stop', subInput(delivered, runTranscript(), 'plan-readiness-reviewer'), { TMPDIR: sandbox() }).code, 0, 'the stage is delivered');
});

test('change-loop lock subagent-stop: U4 the stage file does not exist, refused naming the file', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  const r = hook('subagent-stop', subInput(root, runTranscript(), 'change-planner'), { TMPDIR: tmp });
  assert.equal(r.code, 2, r.err);
  assert.match(r.err, /proposal\.md of stage proposal does not exist: write it, with its stage header, before you stop/);
  assert.ok(existsSync(join(tmp, 'devkit-stop', `${SESSION}-agent-0001.json`)), 'the record of a subagent carries its id');
});

test('change-loop lock subagent-stop: U5 a pending or headerless stage file is refused naming the file', () => {
  const pending = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'], results: { readiness: 'pending' } });
  const a = hook('subagent-stop', subInput(pending, runTranscript(), 'plan-readiness-reviewer'), { TMPDIR: sandbox() });
  assert.equal(a.code, 2, a.err);
  assert.match(a.err, /readiness\.md of stage readiness still says result=pending \(or has no valid header\): set its header before you stop/);
  const headerless = planChange({ have: ['requirements', 'proposal'] });
  put(headerless, { 'openspec/changes/feat/specs/s/spec.md': '# Spec without a header\n' });
  commitAll(headerless, 'a spec with no header');
  const b = hook('subagent-stop', subInput(headerless, runTranscript(), 'change-planner'), { TMPDIR: sandbox() });
  assert.equal(b.code, 2, b.err);
  assert.match(b.err, /still says result=pending/);
});

test('change-loop lock subagent-stop: U6 the same state a second time is let through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  const transcript = runTranscript();
  assert.equal(hook('subagent-stop', subInput(root, transcript, 'change-planner'), { TMPDIR: tmp }).code, 2);
  assert.equal(hook('subagent-stop', subInput(root, transcript, 'change-planner'), { TMPDIR: tmp }).code, 0);
  assert.equal(hook('subagent-stop', subInput(root, transcript, 'change-planner', { agent_id: 'agent-0002' }), { TMPDIR: tmp }).code, 2, 'the record is per agent');
  // The coordinator's next loop call then ends the run blocked (K2).
  const key = JSON.parse(readFileSync(join(tmp, 'devkit-stop', `${SESSION}-agent-0001.json`), 'utf8')).key;
  assert.match(key, /^proposal\/no-file@[0-9a-f]{12}$/);
});

test('change-loop lock subagent-stop: U7 an error lets the stop through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  assert.equal(hook('subagent-stop', subInput(root, join(sandbox(), 'gone.jsonl'), 'change-planner'), { TMPDIR: tmp }).code, 0);
  assert.equal(hook('subagent-stop', subInput(root, runTranscript('nope'), 'change-planner'), { TMPDIR: tmp }).code, 0);
  put(root, { 'openspec/schemas/devkit/flow.json': '{ not json' });
  assert.equal(hook('subagent-stop', subInput(root, runTranscript(), 'change-planner'), { TMPDIR: tmp }).code, 0, 'a malformed flow.json');
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false);
});

// ---- the real topology: the change in its own worktree, the hook's cwd the main checkout (the layout `open` creates)

// The main checkout (its default schema `devkit`) with no folder for `feat`, and a worktree on branch `feat` holding the
// change's files, committed there. Returns { main, wt }.
function worktreeChange({ schema = 'devkit', have = ['requirements', 'decisions'] } = {}) {
  const main = gitRepo({ config: 'schema: devkit\n' });
  const wt = join(tmpFolder('devkit-change-loop-wtlayout-'), 'feat');
  git(main, 'worktree', 'add', '-q', '-b', 'feat', wt);
  const c0 = git(wt, 'rev-parse', 'HEAD');
  put(wt, { 'openspec/changes/feat/.openspec.yaml': `schema: ${schema}\n`, ...Object.fromEntries(have.map((stage) => [`openspec/changes/feat/${PLAN_FILES[stage]}`, `${head(stage, c0)}# ${stage}\n`])) });
  commitAll(wt, 'change files');
  assert.equal(existsSync(join(main, 'openspec', 'changes', 'feat')), false, 'the main checkout has no folder for the change');
  return { main, wt };
}

test('change-loop lock subagent-stop: a change in its own worktree, the session in the main checkout', () => {
  const { main, wt } = worktreeChange({ have: ['requirements', 'decisions'] });
  const r = hook('subagent-stop', subInput(main, runTranscript(), 'change-planner'), { TMPDIR: sandbox() });
  assert.equal(r.code, 2, r.err);
  assert.match(r.err, /proposal\.md of stage proposal does not exist: write it, with its stage header, before you stop/);
  // The same state read from the worktree itself agrees, and once the file is delivered the stop is let through.
  assert.equal(hook('subagent-stop', subInput(wt, runTranscript(), 'change-planner'), { TMPDIR: sandbox() }).code, 2);
  put(wt, { 'openspec/changes/feat/proposal.md': `${head('proposal', git(wt, 'rev-parse', 'HEAD'))}# proposal\n`, 'openspec/changes/feat/specs/s/spec.md': `${head('specs', git(wt, 'rev-parse', 'HEAD'))}# s\n` });
  commitAll(wt, 'proposal and specs');
  const delivered = hook('subagent-stop', subInput(main, runTranscript(), 'change-planner'), { TMPDIR: sandbox() });
  assert.equal(delivered.code, 2, 'the next stage (design) is still the planner\'s and its file is missing');
  assert.match(delivered.err, /design\.md of stage design does not exist/);
});

test('change-loop lock agent: a change in its own worktree, the session in the main checkout', () => {
  // The change is on the short script, the main checkout's project default is the full one: the roles come from the worktree's script.
  const { main } = worktreeChange({ schema: 'devkit-lite', have: ['requirements'] });
  const transcript = runTranscript();
  assert.equal(hook('agent', agentInput(main, transcript, 'devkit-core:change-planner')).code, 0, 'a role of the script is allowed');
  const general = hook('agent', agentInput(main, transcript, 'general-purpose'));
  assert.equal(general.code, 2, general.err);
  assert.match(general.err, /roles of the devkit-lite script/);
  const full = hook('agent', agentInput(main, transcript, 'devkit-core:plan-readiness-reviewer'));
  assert.equal(full.code, 2, 'a role of the full script only: read from the worktree\'s script, not the main checkout\'s');
  assert.match(full.err, /roles of the devkit-lite script/);
});

// ---- the edit lock

const editInput = (root, file, transcript, role) => ({
  cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, file) }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});
const bashInput = (root, command, transcript, role) => ({
  cwd: root, tool_name: 'Bash', tool_input: { command }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});
const liteChange = () => gitRepo({ config: 'schema: devkit-lite\n', changes: { feat: { '.openspec.yaml': 'schema: devkit-lite\n' } } });
const approvedChange = () => planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'] });
const LOCK_TEXT = /in a \/devkit change run this session writes no product code; the implementation is handed to tdd-implementer by the loop/;

test('change-loop lock edit: in a run the session\'s edit of product code is refused by Write and by a shell redirect, on both scripts', () => {
  const transcript = runTranscript();
  for (const [name, root] of [['devkit-lite', liteChange()], ['devkit with readiness approved', approvedChange()]]) {
    const w = hook('edit', editInput(root, 'src/a.ts', transcript));
    assert.equal(w.code, 2, `${name}: ${w.err}`);
    assert.match(w.err, LOCK_TEXT);
    const b = hook('bash', bashInput(root, 'echo x > src/a.ts', transcript));
    assert.equal(b.code, 2, `${name}: ${b.err}`);
    assert.match(b.err, LOCK_TEXT);
    const s = hook('bash', bashInput(root, "sed -i '' 's/a/b/' src/a.ts", transcript));
    assert.equal(s.code, 2, name);
  }
});

test('change-loop lock edit: planning files and approval.md follow the existing rules in a run', () => {
  const transcript = runTranscript();
  for (const root of [liteChange(), approvedChange()]) {
    assert.equal(hook('edit', editInput(root, 'openspec/changes/feat/tasks.md', transcript)).code, 0);
    assert.equal(hook('edit', editInput(root, 'openspec/changes/feat/approval.md', transcript)).code, 0, 'the main session writes approval.md');
    assert.equal(hook('edit', editInput(root, '.claude/settings.json', transcript)).code, 0);
    assert.equal(hook('bash', bashInput(root, 'echo x > openspec/changes/feat/tasks.md', transcript)).code, 0);
    const readiness = hook('edit', editInput(root, 'openspec/changes/feat/readiness.md', transcript));
    assert.equal(readiness.code, 2, 'readiness.md stays the reviewer\'s');
    assert.doesNotMatch(readiness.err, LOCK_TEXT);
  }
  assert.equal(hook('edit', editInput(liteChange(), 'openspec/changes/feat/approval.md', transcript, 'tdd-implementer')).code, 2, 'a subagent still may not write approval.md');
});

test('change-loop lock edit: with no run the edit follows the existing rules as today', () => {
  const lite = liteChange();
  for (const transcript of [undefined, transcriptOf([assistantLine()]), transcriptOf([typedLine('change x'), assistantLine()]), transcriptOf([typedLine('change x'), runLine('feat'), typedLine('', '/clear')]), join(sandbox(), 'gone.jsonl')]) {
    assert.equal(hook('edit', editInput(lite, 'src/a.ts', transcript)).code, 0);
    assert.equal(hook('bash', bashInput(lite, 'echo x > src/a.ts', transcript)).code, 0);
  }
  const closed = hook('edit', editInput(approvedChange(), 'src/a.ts', undefined));
  assert.equal(closed.code, 2);
  assert.doesNotMatch(closed.err, LOCK_TEXT, 'the existing reason, not the lock\'s');
});

test('change-loop lock edit: the implementer on the approved devkit change passes in a run, and every subagent follows the existing rules', () => {
  const transcript = runTranscript();
  const root = approvedChange();
  assert.equal(hook('edit', editInput(root, 'src/a.ts', transcript, 'tdd-implementer')).code, 0);
  assert.equal(hook('bash', bashInput(root, 'echo x > src/a.ts', transcript, 'tdd-implementer')).code, 0);
  assert.equal(hook('edit', editInput(liteChange(), 'src/a.ts', transcript, 'tdd-implementer')).code, 0);
  const other = hook('edit', editInput(root, 'src/a.ts', transcript, 'change-planner'));
  assert.equal(other.code, 2);
  assert.doesNotMatch(other.err, LOCK_TEXT, 'the existing rule decides for a subagent');
});

// ---- the hand-off lock

const agentInput = (root, transcript, subagentType, extra = {}) => ({
  cwd: root, tool_name: 'Agent', tool_input: { subagent_type: subagentType, prompt: 'do it' }, transcript_path: transcript, ...extra,
});

test('change-loop lock agent: H1 a subagent\'s own hand-off is allowed', () => {
  const r = hook('agent', agentInput(liteChange(), runTranscript(), 'general-purpose', { agent_type: 'devkit-core:plan-readiness-reviewer', agent_id: 'agent-0001' }));
  assert.equal(r.code, 0, r.err);
});

test('change-loop lock agent: H2 no run allows any agent', () => {
  const root = liteChange();
  for (const transcript of [undefined, transcriptOf([assistantLine()]), transcriptOf([typedLine('change x'), assistantLine()])]) {
    assert.equal(hook('agent', agentInput(root, transcript, 'general-purpose')).code, 0);
  }
});

test('change-loop lock agent: H3 a role or a helper of the script is allowed, the owner, the coordinator and the review bench are not agents', () => {
  const transcript = runTranscript();
  const full = approvedChange();
  for (const root of [liteChange(), full]) {
    const types = ['devkit-core:change-planner', 'devkit-core:tdd-implementer', 'devkit-core:pr-verifier', 'devkit-core:commit-and-pr',
      'devkit-core:code-quality-reviewer', 'devkit-openspec:openspec-validator', 'devkit-core:codebase-researcher', 'change-planner', 'openspec-validator'];
    if (root === full) types.push('devkit-core:plan-readiness-reviewer', 'devkit-core:plan-reality-auditor');
    for (const type of types) {
      const r = hook('agent', agentInput(root, transcript, type));
      assert.equal(r.code, 0, `${type}: ${r.err}`);
    }
    for (const type of ['devkit-core:change-coordinator', 'owner', 'devkit-core:review-bench']) assert.equal(hook('agent', agentInput(root, transcript, type)).code, 2, type);
    assert.equal(hook('agent', agentInput(root, transcript, 'devkit-core:plan-readiness-reviewer')).code, root === full ? 0 : 2, 'a role of the full script only');
  }
});

test('change-loop lock agent: H4 any other agent is refused naming the script and the roles', () => {
  const transcript = runTranscript();
  for (const [script, root] of [['devkit-lite', liteChange()], ['devkit', approvedChange()]]) {
    for (const type of ['general-purpose', 'Explore', 'other-plugin:fixer', 'other-plugin:change-planner', 'other:tdd-implementer', 'devkit-openspec:change-planner', 'devkit-core:openspec-validator', 'devkit-core:devkit-core:change-planner']) {
      const r = hook('agent', agentInput(root, transcript, type));
      assert.equal(r.code, 2, `${type}: ${r.err}`);
      assert.match(r.err, new RegExp(`in a /devkit change run this session hands work only to the roles of the ${script} script: .*change-planner.*tdd-implementer.*; ${type.replace('/', '\\/')} is not one of them`));
      assert.doesNotMatch(r.err, /\b(owner|review-bench)\b/, 'the list holds agents only');
    }
  }
});

test('change-loop lock agent: H5 an error lets the hand-off through', () => {
  const root = liteChange();
  put(root, { 'openspec/schemas/devkit-lite/flow.json': '{ not json' });
  assert.equal(hook('agent', agentInput(root, runTranscript(), 'general-purpose')).code, 0, 'a malformed flow.json');
  assert.equal(hook('agent', agentInput(liteChange(), join(sandbox(), 'gone.jsonl'), 'general-purpose')).code, 0, 'an unreadable transcript');
});

test('change-loop lock agent: H4a no agent type, or an empty one, is refused naming the script and the roles', () => {
  const transcript = runTranscript();
  for (const [script, root] of [['devkit-lite', liteChange()], ['devkit', approvedChange()]]) {
    for (const input of [
      { cwd: root, tool_name: 'Agent', tool_input: { prompt: 'do it' }, transcript_path: transcript },
      { cwd: root, tool_name: 'Agent', tool_input: {}, transcript_path: transcript },
      { cwd: root, tool_name: 'Agent', transcript_path: transcript },
      agentInput(root, transcript, ''),
      agentInput(root, transcript, undefined),
      agentInput(root, transcript, null),
    ]) {
      const r = hook('agent', input);
      assert.equal(r.code, 2, `${JSON.stringify(input.tool_input)}: ${r.err}`);
      assert.match(r.err, new RegExp(`in a /devkit change run this session hands work only to the roles of the ${script} script: .*change-planner.*tdd-implementer.*; name one of them as subagent_type`));
    }
  }
  assert.equal(hook('agent', { cwd: liteChange(), tool_name: 'Agent', tool_input: {}, transcript_path: transcriptOf([assistantLine()]) }).code, 0, 'outside a run an absent type is allowed (H2)');
  assert.equal(hook('agent', { cwd: liteChange(), tool_name: 'Agent', tool_input: {}, transcript_path: transcript, agent_type: 'devkit-core:plan-readiness-reviewer', agent_id: 'agent-0001' }).code, 0, 'a subagent may call any agent (H1)');
});

test('change-loop lock agent: the accepted packs are the ones docs/roles.md names', () => {
  // docs/roles.md: "## <role>" then "- Played today by: The agent `<pack>:<role>`" for a role or helper that ships an agent.
  const named = {};
  let role = null;
  for (const line of readRepo('docs', 'roles.md').split('\n')) {
    const h = /^## ([\w-]+)$/.exec(line);
    if (h) role = h[1];
    const m = /^- Played today by: The agent `([\w-]+):([\w-]+)`/.exec(line);
    if (m && role) {
      assert.equal(m[2], role, `${role}: the agent is named like its role`);
      named[role] = m[1];
    }
  }
  assert.ok(Object.keys(named).length >= 14 && named['openspec-validator'] === 'devkit-openspec', 'the scan found the roles');
  const inFlow = new Set(Object.values(FLOWS).flatMap((f) => f.stages.flatMap((st) => [st.role, ...(st.helpers ?? [])])));
  for (const r of inFlow) {
    if (named[r]) assert.equal(PACKS[r], named[r], `${r} is played by ${named[r]}:${r} and PACKS holds ${PACKS[r]}`);
    else assert.equal(PACKS[r], undefined, `${r} ships no agent, PACKS holds ${PACKS[r]}`);
  }
  for (const [r, pack] of Object.entries(PACKS)) assert.equal(named[r], pack, `PACKS holds ${pack}:${r}, docs/roles.md names ${named[r] ?? 'nothing'}`);
  for (const r of Object.keys(PACKS)) assert.ok(inFlow.has(r), `${r} is a role or helper of a script`);
});

// ---- the log, hooks.json, bypass and opt-in

test('change-loop lock log: one JSON line per decision with DEVKIT_HOOK_LOG, none without', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  const log = join(sandbox(), 'hooks.jsonl');
  const transcript = runTranscript();
  hook('stop', stopInput(root, transcript), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
  hook('stop', stopInput(root, transcript), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
  hook('subagent-stop', subInput(root, transcript, 'change-planner'), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
  hook('agent', agentInput(root, transcript, 'general-purpose'), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 4);
  const records = lines.map((l) => JSON.parse(l));
  for (const [i, l] of lines.entries()) {
    assert.deepEqual(Object.keys(records[i]), ['at', 'mode', 'session', 'agentType', 'change', 'decision', 'why']);
    assert.ok(!/\s/.test(l.replace(/"[^"]*"/g, '')), 'no spaces between tokens');
  }
  assert.match(lines[0], /"mode":"stop",.*"decision":"refuse"/);
  assert.deepEqual(records.map((r) => [r.mode, r.decision]), [['stop', 'refuse'], ['stop', 'allow'], ['subagent-stop', 'refuse'], ['agent', 'refuse']]);
  assert.deepEqual([records[0].session, records[0].change, records[0].agentType], [SESSION, 'feat', null]);
  assert.equal(records[2].agentType, 'devkit-core:change-planner');
  assert.ok(records.every((r) => typeof r.why === 'string' && r.why.length > 0 && !Number.isNaN(Date.parse(r.at))));
  const quiet = sandbox();
  hook('stop', stopInput(root, transcript), { TMPDIR: quiet });
  assert.deepEqual(readdirSync(quiet), ['devkit-stop'], 'no file but the refusal record');
  assert.equal(readFileSync(log, 'utf8').split('\n').filter(Boolean).length, 4, 'the log is not touched without the variable');
});

test('change-loop lock: the module header names the lock decisions and their refusal record, and the command line banner sits on its code', () => {
  const lines = read('change-loop.mjs').split('\n');
  const header = lines.slice(0, 30).join('\n');
  for (const name of ['stopDecision', 'subagentStopDecision', 'agentDecision', 'devkit-stop', 'devkit-end:']) assert.ok(header.includes(name), `the header names ${name}`);
  const banners = lines.map((l, i) => [l, i]).filter(([l]) => l.startsWith('// ------'));
  for (const [i, [banner, at]] of banners.entries()) {
    const following = lines.slice(at + 1, banners[i + 1]?.[1] ?? lines.length).filter((l) => l.trim() !== '');
    assert.ok(following.length > 0, `the banner ${banner.slice(-30)} is followed by code, not by another banner`);
  }
  assert.ok(banners.some(([l]) => l.includes('the command line')), 'the command line banner exists');
});

test('change-loop lock hooks.json: Stop, SubagentStop without a matcher and PreToolUse Agent and Skill call guard.mjs', () => {
  const hooks = JSON.parse(read('hooks.json'));
  const cmd = (mode) => `node "\${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" ${mode}`;
  assert.deepEqual(hooks.hooks.Stop, [{ hooks: [{ type: 'command', command: cmd('stop'), timeout: 60 }] }]);
  assert.deepEqual(hooks.hooks.SubagentStop, [{ hooks: [{ type: 'command', command: cmd('subagent-stop'), timeout: 60 }] }]);
  assert.equal(hooks.hooks.SubagentStop[0].matcher, undefined);
  assert.deepEqual(hooks.hooks.PreToolUse.map((e) => e.matcher), ['Edit|Write|MultiEdit|NotebookEdit', 'Bash', 'Agent', 'Skill']);
  assert.deepEqual(hooks.hooks.PreToolUse[2].hooks, [{ type: 'command', command: cmd('agent'), timeout: 10 }]);
  assert.deepEqual(hooks.hooks.PreToolUse[3].hooks, [{ type: 'command', command: cmd('skill'), timeout: 10 }]);
  assert.deepEqual(hooks.hooks.SessionStart[0].hooks.map((h) => h.command), [cmd('session')]);
  assert.match(hooks.description, /stop/i);
  assert.match(read('guard.mjs').split('\n').slice(0, 13).join('\n'), /guard\.mjs stop[\s\S]*guard\.mjs subagent-stop[\s\S]*guard\.mjs agent[\s\S]*guard\.mjs skill/, 'the header comment lists the four modes');
});

test('change-loop lock: bypass and a project not opted in refuse nothing', () => {
  const transcript = runTranscript();
  const root = planChange({ have: ['requirements', 'decisions'] });
  const lite = liteChange();
  const tmp = sandbox();
  const log = join(sandbox(), 'hooks.jsonl');
  const calls = (r, l) => [
    hook('stop', stopInput(r, transcript), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log, ...l }),
    hook('subagent-stop', subInput(r, transcript, 'change-planner'), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log, ...l }),
    hook('edit', editInput(r, 'src/a.ts', transcript), l),
    hook('bash', bashInput(r, 'echo x > src/a.ts', transcript), l),
    hook('agent', agentInput(r, transcript, 'general-purpose'), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log, ...l }),
  ];
  for (const r of [root, lite]) for (const out of calls(r, { DEVKIT_BYPASS: '1' })) assert.equal(out.code, 0, out.err);
  const plain = gitRepo({ config: 'schema: spec-driven\n', changes: { feat: { 'proposal.md': '# p\n' } } });
  for (const out of calls(plain, {})) assert.equal(out.code, 0, out.err);
  assert.equal(existsSync(log), false, 'nothing logged for either');
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false);
});

// ---------------------------------------------------------------- the command, the wiring (phase 4: D-3, D-9, D-10)

const REPO_ROOT = join(HERE, '..', '..', '..');
const readRepo = (...p) => readFileSync(join(REPO_ROOT, ...p), 'utf8');
const frontmatterOf = (text) => text.split('\n').slice(1, text.split('\n').indexOf('---', 1));

// The `skills:` list of an agent file's frontmatter, with any `<plugin>:` prefix removed.
function agentSkills(text) {
  const lines = frontmatterOf(text);
  const at = lines.findIndex((l) => l === 'skills:');
  if (at < 0) return [];
  const out = [];
  for (const l of lines.slice(at + 1)) {
    const m = /^\s+-\s+(\S+)\s*$/.exec(l);
    if (!m) break;
    out.push(m[1].replace(/^[\w-]+:/, ''));
  }
  return out.sort();
}

test('change-loop skills: every shipped stage agent declares its stage\'s skills', () => {
  const agentFile = new Map();
  for (const plugin of readdirSync(join(REPO_ROOT, 'plugins'))) {
    const dir = join(REPO_ROOT, 'plugins', plugin, 'agents');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.md')) agentFile.set(f.slice(0, -3), join(dir, f));
  }
  const want = new Map(); // role -> sorted skills, equal in every script that has the role
  const unshipped = new Set();
  for (const [script, flow] of Object.entries(FLOWS)) {
    const perRole = new Map();
    for (const st of flow.stages) {
      if (st.shipped === false) { unshipped.add(st.role); continue; }
      perRole.set(st.role, new Set([...(perRole.get(st.role) ?? []), ...st.skills]));
    }
    for (const [role, set] of perRole) {
      const skills = [...set].sort();
      if (want.has(role)) assert.deepEqual(want.get(role), skills, `the two scripts agree on the skills of ${role} (${script})`);
      want.set(role, skills);
    }
  }
  for (const role of unshipped) assert.ok(!agentFile.has(role), `${role} is marked shipped: false but has an agent file: flip shipped and wire its skills`);
  const bare = [...want.keys()].filter((r) => !agentFile.has(r)).sort();
  assert.deepEqual(bare, ['change-coordinator', 'owner', 'review-bench']);
  for (const [role, skills] of want) {
    if (!agentFile.has(role)) continue;
    assert.deepEqual(agentSkills(readFileSync(agentFile.get(role), 'utf8')), skills, `${role} declares the skills of its stage`);
  }
  assert.deepEqual(want.get('tdd-implementer'), ['systematic-debugging', 'test-driven-development']);
  assert.deepEqual(want.get('change-planner'), []);
});

test('change-loop settings: devkit-openspec has the language user setting', () => {
  const plugin = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json'));
  const lang = plugin.userConfig?.language;
  assert.ok(lang, 'userConfig.language exists');
  assert.equal(lang.type, 'string');
  assert.equal(lang.default, 'pt-BR');
  assert.ok(!('options' in lang), 'no options key (it needs Claude Code v2.1.271+)');
  assert.equal(typeof lang.title, 'string');
  assert.match(lang.description, /pt-BR or en/);
  const panel = JSON.parse(readRepo('plugins', 'panel', '.claude-plugin', 'plugin.json')).userConfig.language;
  assert.equal(lang.type, panel.type);
  assert.equal(lang.default, panel.default);
});

const SKILL_FILE = join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
const skillText = () => readFileSync(SKILL_FILE, 'utf8');
const LANG_FLAG = '--lang ${user_config.language}';
const section = (md, from, to) => {
  const a = md.indexOf(from);
  assert.ok(a >= 0, `section ${from}`);
  const b = to ? md.indexOf(to, a + from.length) : md.length;
  return md.slice(a, b < 0 ? md.length : b);
};

test('change-loop skill: the frontmatter', () => {
  const md = skillText();
  const fm = frontmatterOf(md);
  assert.ok(fm.includes('name: devkit'));
  assert.ok(fm.includes('disable-model-invocation: true'));
  assert.ok(fm.some((l) => l.startsWith('argument-hint: ') && l.includes('change')));
  const desc = fm.find((l) => l.startsWith('description:'));
  assert.match(desc, /\bUse when\b/);
  assert.match(desc, /\/devkit change/);
});

test('change-loop skill: every change-loop command and the readout carry the person\'s language', () => {
  const md = skillText();
  const calls = md.split('\n').filter((l) => /change-loop\.mjs (start|open|script|flow|wait|next|reply)\b/.test(l));
  for (const sub of ['start', 'open', 'script', 'flow', 'wait', 'next', 'reply']) {
    assert.ok(calls.some((l) => l.includes(`change-loop.mjs ${sub}`)), `the body runs ${sub}`);
  }
  for (const l of calls) assert.ok(l.includes(LANG_FLAG), `--lang on: ${l}`);
  const readouts = md.split('\n').filter((l) => /flow-check\.mjs/.test(l));
  assert.ok(readouts.length >= 1, 'the readout when the owner asks where the change stands');
  for (const l of readouts) assert.ok(l.includes(LANG_FLAG), `--lang on: ${l}`);
  assert.doesNotMatch(md, /--lang (pt-BR|en)\b/);
});

test('change-loop skill: start and open read the request through a quoted heredoc with the terminator rule', () => {
  const md = skillText();
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.includes('change-loop.mjs start'));
  assert.ok(lines[start].endsWith("<<'DEVKIT_ARGS'"), 'start opens a quoted heredoc');
  assert.equal(lines[start + 1], '$ARGUMENTS');
  assert.equal(lines[start + 2], 'DEVKIT_ARGS');
  const open = lines.findIndex((l) => l.includes('change-loop.mjs open'));
  assert.ok(lines[open].endsWith("<<'DEVKIT_ARGS'"), 'open opens a quoted heredoc');
  assert.equal(lines[open + 2], 'DEVKIT_ARGS');
  assert.doesNotMatch(md, /<<\s*[A-Z_]+\b(?!')/, 'no unquoted heredoc');
  assert.match(md, /line of the request equals `DEVKIT_ARGS`/);
  assert.match(md, /`DEVKIT_ARGS_` followed by digits that no line of the request holds/);
});

test('change-loop skill: the release-conflict sentence', () => {
  const md = skillText();
  assert.ok(md.includes('`resolve-release-conflict`'));
  assert.ok(md.includes('Run `detail.command` in the worktree, then the project\'s test command; report the JSON and the result; change nothing else.'));
  assert.match(md, /`Outcome: failure` goes back to `next`, as for any agent/);
});

test('change-loop skill: the script rule and its correction', () => {
  const md = skillText();
  assert.ok(md.includes('`devkit-lite` only for a small change that is easy to undo and touches no screen, no boundary between parts of the project and no contract other parts rely on; `devkit` otherwise and whenever in doubt'));
  for (const code of ['small', 'doubt', 'architecture', 'contract', 'ui', 'capability', 'risk']) assert.ok(md.includes(`\`${code}\``), code);
  assert.match(md, /does not ask/);
  assert.match(md, /change-loop\.mjs script <id> <devkit\|devkit-lite> --why <code>/);
  assert.match(md, /`name-taken`/);
});

test('change-loop skill: the approval and the retro answers are written only from the owner\'s own message', () => {
  const md = skillText();
  assert.match(md, /Plan approval and retro answers are written only from the owner's own message/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Write `approval\.md` or a retro answer except from the owner's own message/);
  assert.match(never, /Write `readiness\.md`, `evidence\.md` or `reviews\/`/);
});

test('change-loop skill: one stage per hand-off, in the foreground, never a subagent for a whole change, never choosing the order', () => {
  const md = skillText();
  const loop = section(md, '## Loop', '## Owner gates');
  assert.match(loop, /one Agent call/);
  assert.match(loop, /in the foreground/);
  assert.match(loop, /the call's `subagent_type` set to the action's `agent` field/);
  assert.match(loop, /`--after`/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Dispatch a subagent for a whole change/);
  assert.match(never, /Choose the order of the stages or run two stages at once/);
  assert.match(never, /Edit product code in this session/);
  assert.match(never, /Bypass a hook or a gate/);
});

test('change-loop skill: an end the session declares goes through reply, and the marker lines are never shown (F1)', () => {
  const md = skillText();
  const loop = section(md, '## Loop', '## Owner gates');
  assert.match(loop, /a second line `devkit-end: <id> <state>` follows/);
  assert.match(loop, /never show one to the owner/);
  assert.match(loop, /An end the session declares itself \(a red gate, a pull-request decision left to the owner\) goes through `reply`/);
  assert.match(loop, /only the lines after it are shown to the owner/);
  for (const key of ['reply blocked --param id=<id> --param why=tests-red', 'reply waiting-pr-decision --param id=<id>']) assert.ok(loop.includes(key), key);
  assert.ok(!loop.includes('why=role-failed'), 'a failed agent is the loop\'s end, not the session\'s');
  assert.doesNotMatch(loop, /\bsay `node/, 'the declared ends are run, not said');
});

test('change-loop skill: the review sentence points at the ship-change review row, and verify comes before review', () => {
  const loop = section(skillText(), '## Loop', '## Owner gates');
  const review = loop.split('\n').find((l) => l.startsWith('- `review`'));
  assert.ok(review, 'a review item');
  assert.match(review, /`ship-change` `review` row/);
  assert.match(review, /Workflow tool/);
  assert.match(review, /`agents` path/);
  assert.match(review, /declared lost/);
  const order = loop.split('\n').find((l) => l.includes('`verify`') && l.includes('`review`'));
  assert.ok(order && order.indexOf('`verify`') < order.indexOf('`review`'), 'verify before review');
});

test('change-loop skill: the wait is started in the background on a GitHub wait', () => {
  const md = skillText();
  const wait = section(md, '## Waiting on GitHub', '## Never');
  assert.match(wait, /Bash tool's background option/);
  assert.ok(wait.includes(`change-loop.mjs wait --change <id> ${LANG_FLAG}`));
  assert.match(wait, /no time limit/);
  assert.match(wait, /`waiting-github`|waiting on GitHub/);
  assert.match(wait, /then runs `next`/);
});

test('change-loop skill: the grill paragraph names the stage header and requirements', () => {
  const grill = skillText().split('\n').find((l) => l.startsWith('- `grill`'));
  assert.ok(grill, 'a grill item');
  assert.ok(grill.includes('<!-- devkit-stage'));
  assert.ok(grill.includes('requirements'));
  assert.match(grill, /requirements-grill/);
  assert.match(grill, /result=passed/);
});

test('change-loop skill: the sections of D-3 to D-9 and the modes of start', () => {
  const md = skillText();
  const heads = md.split('\n').filter((l) => l.startsWith('## '));
  assert.deepEqual(heads, ['## Settings', '## Start', '## A new change', '## Loop', '## Owner gates', '## Waiting on GitHub', '## Train', '## Roadmap', '## Status', '## Project', '## Never']);
  for (const mode of ['not-built', 'unknown-verb', 'not-set-up', 'setting-unknown', 'driver-not-built', 'nothing', 'choose', 'ask-unfinished', 'resume', 'new', 'roadmap', 'status', 'project', 'is-slice', 'train', 'train-args']) {
    assert.ok(md.includes(`\`${mode}\``), `mode ${mode}`);
  }
  assert.match(md, /AskUserQuestion/);
  // Invariant: the change part of the skill names no retired machinery and no schedule. Layer: skill text. Suite: change-loop.
  // The session-start tool is named by the Roadmap section now (ADR 0014), and so is the roadmap run's one periodic check (ADR 0021); ADR 0006's wake-up stays retired.
  const roadmapAt = md.indexOf('## Roadmap');
  assert.doesNotMatch(md.slice(0, roadmapAt), /conduct-check|CronCreate|wake_when_done/);
  assert.doesNotMatch(md.slice(roadmapAt), /conduct-check|wake_when_done/);
});

test('change-loop skill: every reply not yet shown ends the turn, in order, before anything else (AC-1)', () => {
  const md = skillText();
  const settings = section(md, '## Settings', '## Start');
  assert.match(settings, /Only the last message of a turn reaches the owner/);
  assert.match(settings, /every `reply` the script printed in this turn that the owner has not been shown is part of the message that ends the turn, in order, before anything else/);
  assert.match(settings, /opens a change ends with the opening reply and then the grill's first question/);
  assert.match(settings, /`resume` reply and a `switch-script` reply likewise/);
  assert.doesNotMatch(md, /say `reply`, then enter the Loop/i);
  const resume = md.split('\n').find((l) => l.startsWith('- `resume`'));
  assert.ok(resume && /keep `reply` for the message that ends the turn/.test(resume), 'resume keeps its reply');
  const fresh = section(md, '## A new change', '## Loop');
  assert.match(fresh, /Keep `reply` for the message that ends the turn, then enter the Loop with the id/);
  const sw = md.split('\n').find((l) => l.startsWith('- `session`'));
  assert.ok(sw && /keeps `reply` for the message that ends the turn/.test(sw), 'switch-script keeps its reply');
});

test('change-loop skill: what the session writes itself follows the message table\'s rule (AC-11)', () => {
  const md = skillText();
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Show the owner an internal term/);
  for (const term of ['progress key', 'agent or role id', 'reason code', 'step name of a checker']) assert.ok(never.includes(term), term);
  assert.match(never, /`stageTitle`/);
  assert.match(never, /call `\/devkit change` again/);
  assert.match(never, /file name the owner needs in order to act/);
});

// ---------------------------------------------------------------- /conduct retired, the documents and ADR 0011 (phase 6: D-11, D-13, D-16)

function repoFiles() {
  const out = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(out.status, 0, out.stderr);
  return out.stdout.split('\0').filter((f) => f && existsSync(join(REPO_ROOT, f)));
}

test('change-loop retire: /conduct is not shipped and nothing points at it', () => {
  assert.equal(existsSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'conduct')), false, 'the conduct skill folder is gone');
  assert.ok(existsSync(SKILL_FILE), 'the devkit skill exists');
  for (const f of ['docs/catalog.md', 'plugins/openspec/README.md']) assert.doesNotMatch(readRepo(f), /skills\/conduct\//, `${f} links no skills/conduct/`);
  const guard = readRepo('plugins', 'openspec', 'hooks', 'guard.mjs');
  const sessionText = guard.split('\n').filter((l) => l.includes('/devkit change') || /\/conduct\b(?!-)/.test(l));
  assert.ok(sessionText.some((l) => l.includes('/devkit change') && l.includes('runs a change from your request to its archive')), 'the session text names /devkit change');
  assert.ok(!sessionText.some((l) => /\/conduct\b(?!-)/.test(l) && !l.includes('/devkit change')), 'the session text does not name /conduct');
  const records = [/^CHANGELOG\.md$/, /^openspec\/changes\//, /^openspec\/roadmap\.md$/, /^docs\/adr\//, /^docs\/coordination-design\.md$/,
    /^plugins\/panel\/hooks\/fixtures\//, /^plugins\/panel\/hooks\/[\w.-]+\.test\.tsx?$/, /^plugins\/openspec\/hooks\/change-loop\.test\.mjs$/];
  const stray = [];
  for (const f of repoFiles()) {
    if (records.some((r) => r.test(f))) continue;
    let text;
    try { text = readFileSync(join(REPO_ROOT, f), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    text.split('\n').forEach((line, i) => {
      if (/\/(?:[\w-]+:)?conduct\b(?!-check)/.test(line) && !line.includes('/devkit change')) stray.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(stray, [], 'every line naming /conduct names /devkit change as well');
});

// Every pin of `text` that is not `v<version>`.
const pinMismatches = (text, version) => pinsIn(text).filter((p) => p !== `v${version}`);

test('release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest', () => {
  const version = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')).version;
  const flow = readRepo('docs', 'openspec-flow.md');
  const changed = flow.replace(/<commit sha of v[0-9.]+>/, '<commit sha of v9.9.9>');
  assert.notEqual(changed, flow, 'the doc has a pin to change');
  assert.deepEqual(pinMismatches(changed, version), ['v9.9.9']);
  assert.deepEqual(pinMismatches('', version), []);
  assert.deepEqual(pinsIn(''), []);
});

test('release-merge-conflict 16: the flow doc and the skill describe the release step as a merge and a plain push', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  for (const text of ['**Release-file conflicts: `release-merge.mjs`.**', 'git merge --no-ff --no-commit origin/<base>', 'git push origin <branch>']) assert.ok(flow.includes(text), text);
  for (const re of [/push-rebased/, /release-rebase\.mjs/, /force-with-lease/]) assert.doesNotMatch(flow, re);
  const skill = skillText();
  assert.ok(skill.includes('The command merges `origin/<base>` into the branch and commits the merge with the release renumbered above the base\'s; then the loop hands `verify`, `review` and a plain `push` (`open-archive-pr` on an archive branch) with `detail.command` `git push origin <branch>`, never a force push.'));
  for (const re of [/push-rebased/, /rebase/, /--force/]) assert.doesNotMatch(skill, re);
  assert.ok(readRepo('plugins', 'openspec', 'README.md').includes('(hooks/release-merge.mjs)'));
});

test('change-loop docs: the design records the answers', () => {
  const design = readRepo('docs', 'coordination-design.md');
  const part = (from, to) => { const a = design.indexOf(from); assert.ok(a >= 0, from); const b = design.indexOf(to, a + from.length); return design.slice(a, b < 0 ? design.length : b); };
  const open = part('## Open points', '## What stays shipped');
  for (const gone of [/Which rules of ADR 0007/, /The configuration's field names/, /How the change coordinator waits on GitHub/, /How the two roles called `tech-lead`/]) {
    assert.doesNotMatch(open, gone, `${gone} left Open points`);
  }
  assert.match(open, /Whether the review stage keeps the Workflow path/, 'the Workflow point stays');
  const two = part('## 2. Two coordinators', '## 3. ');
  assert.match(two, /Decided by the owner on 2026-11-20 \(round 15 grill, question 2\)/);
  assert.match(two, /Decided on 2026-11-20 \(A-7\)/);
  assert.match(part('## 8. ', '## 9. '), /Decided by `change-coordinator` on 2026-11-20 \(A-8\)/);
  assert.match(part('## 10. ', '## 11. '), /Decided by the owner on 2026-11-20 \(round 15 grill, question 1\)/);

  const adr = readRepo('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md');
  assert.match(adr, /^- Status: (proposed|accepted)$/m);
  assert.match(adr, /^- Amends: ADR 0010 /m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0011 has ${h}`);
  }
  const adr10 = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md');
  const ctx10 = adr10.slice(adr10.indexOf('## Context'), adr10.indexOf('ADR 0001 let devkit coordinate'));
  assert.match(ctx10, /Note \(change-coordinator, \d{4}-\d{2}-\d{2}\)[\s\S]*ADR 0011/);
  for (const f of ['0005-parallel-steps-and-a-session-wake-up.md', '0006-phases-as-child-sessions.md', '0007-one-change-on-request.md', '0008-reviews-as-a-workflow.md', '0009-compozy-loop-as-a-second-driver.md']) {
    assert.match(readRepo('docs', 'adr', f), /Note \(change-coordinator, \d{4}-\d{2}-\d{2}\):[^\n]*(\n[^\n]+)*?\/devkit change/, `${f} names /devkit change`);
  }
  const adr8 = readRepo('docs', 'adr', '0008-reviews-as-a-workflow.md');
  const ctx8 = adr8.slice(adr8.indexOf('## Context'), adr8.indexOf('Note (ADR 0010'));
  assert.match(ctx8, /Note \(change-coordinator, \d{4}-\d{2}-\d{2}\): `\/conduct` was retired in round 15; one change now runs with `\/devkit change` \(ADR 0010\), whose review step is the `ship-change` `review` row, unchanged\./, 'ADR 0008 has the dated Note before its existing one');
  assert.match(adr8, /^- Status: accepted$/m, 'its status does not change');
  const adrs = readRepo('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0011/, 'the ADRs line names 0011');
  const flow = readRepo('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').includes('## The change coordinator: `/devkit change`'), 'the flow doc has the section');
  // Invariant: the CI snippet pins the current release (docs, change-loop.test.mjs); stage-models moves it to 0.35.0 (release 0.39.0), above delivery-train's 0.34.0 (release 0.38.0), which moved it above roadmap-sessions-upfront's 0.33.0 (release 0.37.0); 0.33.0 went to roadmap-sessions-upfront, 0.32.0 to remote-worker (release 0.36.0); 0.31.0 went to change-version-pin (release 0.35.0), 0.30.1 went to the retro of release-tags (release 0.34.1), 0.30.0 to release-tags (release 0.34.0), 0.29.0 went to release-merge-conflict (release 0.33.0), 0.28.2 to change-state-retro-fixes (release 0.32.2), 0.28.1 to the retro of change-budget, 0.28.0 to delivery-models, 0.27.1 to the earlier retro fixes, 0.27.0 to gh-version-check, 0.26.1 to review-openspec-fix, 0.26.0 to jira-entry, 0.25.0 to change-budget, 0.24.0 to change-state, 0.23.0 to commit-attribution, 0.22.1 to test-fixture-cleanup and 0.22.0 to stage-roles.
  assert.match(flow, /v0\.35\.0/, 'the CI snippet pins the current release (stage-models: 0.35.0)');
  assert.doesNotMatch(flow, /v0\.34\.0/, 'no pin left on main\'s release before it (delivery-train)');
  assert.doesNotMatch(flow, /v0\.33\.0/, 'no pin left on the release before that (roadmap-sessions-upfront)');
  assert.doesNotMatch(flow, /v0\.32\.0/, 'no pin left on the release before that (remote-worker)');
  assert.doesNotMatch(flow, /v0\.31\.0/, 'no pin left on the release before that (change-version-pin)');
  assert.doesNotMatch(flow, /v0\.30\.1/, 'no pin left on main\'s release before it (retro of release-tags)');
  assert.doesNotMatch(flow, /v0\.30\.0/, 'no pin left on the release before that (release-tags)');
  assert.doesNotMatch(flow, /v0\.29\.0/, 'no pin left on main\'s release before it (release-merge-conflict)');
  assert.doesNotMatch(flow, /v0\.28\.2/, 'no pin left on main\'s release before it (change-state-retro-fixes)');
  assert.doesNotMatch(flow, /v0\.28\.1/, 'no pin left on the release before that (retro of change-budget)');
  assert.doesNotMatch(flow, /v0\.28\.0/, 'no pin left on the release before that (delivery-models)');
  assert.doesNotMatch(flow, /v0\.27\.1/, 'no pin left on the release before that (earlier retro fixes)');
  assert.doesNotMatch(flow, /v0\.27\.0/, 'no pin left on the previous release (gh-version-check)');
  assert.doesNotMatch(flow, /v0\.26\.1/, 'no pin left on the previous release (review-openspec-fix)');
  assert.doesNotMatch(flow, /v0\.26\.0/, 'no pin left on the previous release (jira-entry)');
  assert.doesNotMatch(flow, /v0\.25\.0/, 'no pin left on the previous release (change-budget)');
  assert.doesNotMatch(flow, /v0\.24\.0/, 'no pin left on the previous release (change-state)');
  assert.doesNotMatch(flow, /v0\.23\.0/, 'no pin left on the previous release (commit-attribution)');
  assert.doesNotMatch(flow, /v0\.22\.1/, 'no pin left on the previous release (test-fixture-cleanup)');
  assert.doesNotMatch(flow, /v0\.22\.0/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.21\.2/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.21\.1/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.21\.0/, 'no pin left on the previous release');
  const staleV20 = flow.split('\n').filter((l) => /v0\.20\.0/.test(l) && !/v0\.20\.0` or later/.test(l));
  assert.deepEqual(staleV20, [], 'no pin left on the previous release; only the slice-merge floor ("v0.20.0 or later") names it');
  assert.match(flow, /moves this pin to `v0\.20\.0` or later first/, 'the slice-merge floor (project-phases) is kept');
  const version = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')).version;
  assert.ok(pinsIn(flow).length >= 3, 'the CI snippet holds its pins');
  assert.deepEqual(pinMismatches(flow, version), [], 'every CI pin names the devkit-openspec version of its manifest');
  assert.match(flow, /prints `devkit-run: <id>`, then `devkit-end: <id> <state>` when the action is an end/, 'the loop paragraph names the end marker');
  assert.match(flow, /an end the run already recorded/, 'the stop lock reads a recorded end');
  assert.match(flow, /refuses a hand-off with no agent type, to a general-purpose agent, to another plugin's agent even when it is named like a role/, 'the hand-off rule');
  assert.match(flow, /a usage error included[^\n]*keeps its raw message in the JSON's `error` field/, 'the usage-error reply');
  const road = readRepo('openspec', 'roadmap.md').split('\n').find((l) => /^- \[[ x]\] review-writer-prompt/.test(l));
  assert.match(road, /touches only tests/);
  assert.match(road, /fenced example/);
});

// ---- field-fixes 6: the project's OpenSpec CLI (D-1)

function pinnedLoop(version) {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const marker = join(tmpFolder('devkit-change-loop-marker-'), `seen-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
  const pathDir = openspecStub(tmpFolder('devkit-loop-pathcli-'), { version: '2.1.0', label: 'path', marker });
  openspecStub(join(root, 'node_modules', '.bin'), { version, label: 'pinned', marker });
  const env = { ...cleanEnv, PATH: `${pathDir}:${process.env.PATH}` };
  return { root, marker, env };
}
const seenBy = (marker) => (existsSync(marker) ? readFileSync(marker, 'utf8') : '');

test('field-fixes 6 change-loop: next with a pinned 1.16.0 exits 3 with the message in error, and the PATH CLI never runs', () => {
  const w = pinnedLoop('1.16.0');
  const r = next(w.root, [], w.env);
  assert.equal(r.code, 3, r.stderr);
  const body = JSON.parse(r.stdout);
  assert.match(body.error, /1\.16\.0/);
  assert.match(body.error, /2\.x/);
  assert.ok(body.error.includes(join(w.root, 'node_modules', '.bin', 'openspec')), body.error);
  assert.equal(seenBy(w.marker), '');
});

test('field-fixes 6 change-loop: next with a pinned 2.x is answered by the pinned CLI', () => {
  const w = pinnedLoop('2.0.0');
  next(w.root, [], w.env);
  assert.match(seenBy(w.marker), /^pinned status --change feat/m);
  assert.doesNotMatch(seenBy(w.marker), /^path /m);
});

// ---- field-fixes 1: a change archived on the default branch is not unfinished (D-3)

// A gh that lists `names` as the archived folders of the default branch, or fails (`fail`), and nothing else.
const archiveGh = (names, { fail = false } = {}) => (args) => (
  !fail && args[0] === 'api' && /contents\/openspec\/changes\/archive\?ref=/.test(args[1])
    ? { status: 0, stdout: JSON.stringify(names.map((name) => ({ name }))), stderr: '', missing: false, timedOut: false }
    : { status: 1, stdout: '', stderr: 'gh: not reachable', missing: false, timedOut: false });
const listedBy = (cwd, gh) => body(main(['start', '--lang', 'en'], { cwd, env: cleanEnv, stdin: 'change add a thing', gh })).unfinished.map((u) => u.id);
const archivedFolder = (date, id, flow = null) => ({ [`openspec/changes/archive/${date}-${id}/.openspec.yaml`]: `schema: devkit\n${flow === null ? '' : `x-devkit-flow: ${flow}\n`}` });

// The default branch on origin gains the archived folder of `id` while the main checkout stays where it was.
function archiveOnOrigin(t, id) {
  const pusher = t.addWt('pusher');
  put(pusher, archivedFolder('2026-11-20', id));
  commitAll(pusher, `archive ${id}`);
  git(pusher, 'push', '-q', 'origin', 'HEAD:main');
  git(t.main, 'fetch', '-q', 'origin');
}

test('field-fixes 1 archived: an old worktree on another branch that holds the active folder does not list the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false });
  assert.deepEqual(listedBy(t.main, archiveGh([])), ['foo'], 'listed while GitHub does not show it archived');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), []);
});

test('field-fixes 1 archived: an old worktree on the change\'s own branch does not list the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('bar'), 'bar', ['requirements'], { commit: false });
  assert.deepEqual(listedBy(t.main, archiveGh([])), ['bar']);
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-bar'])), []);
});

// An active folder whose `.openspec.yaml` records the day it was created, as `openspec new change` writes it.
const withCreated = (wt, id, created) => put(wt, { [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\ncreated: ${created}\n` });

test('field-fixes 1 archived: a new change that reuses an archived id, created after the archive, stays listed', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  const own = t.addWt('foo');
  addChange(own, 'foo', ['requirements'], { commit: false });
  withCreated(own, 'foo', '2026-11-21');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), ['foo'], 'created the day after the archive: a new change');
  withCreated(own, 'foo', '2026-11-10');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), [], 'created before the archive: the stale copy');
  withCreated(own, 'foo', '2026-11-20');
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), [], 'created the day of the archive: the stale copy');
});

test('field-fixes 1 archived: an archive branch whose pull request merged does not list the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  put(t.addWt('foo', { branch: 'chore/archive-foo' }), archivedFolder('2026-11-20', 'foo'));
  assert.deepEqual(listedBy(t.main, archiveGh([])), ['foo']);
  assert.deepEqual(listedBy(t.main, archiveGh(['2026-11-20-foo'])), []);
});

test('field-fixes 1 archived: an archive pull request not merged yet stays listed as being archived', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  put(t.addWt('baz', { branch: 'chore/archive-baz' }), archivedFolder('2026-11-20', 'baz'));
  const b = body(main(['start', '--lang', 'en'], { cwd: t.main, env: cleanEnv, stdin: 'change add a thing', gh: archiveGh(['2026-11-20-other']) }));
  assert.deepEqual(b.unfinished.map((u) => [u.id, u.where]), [['baz', render('en', 'where.archiving')]]);
});

test('field-fixes 1 archived: a main checkout whose default branch is behind still sees the remote one archive the change', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false });
  archiveOnOrigin(t, 'foo');
  assert.equal(existsSync(join(t.main, 'openspec', 'changes', 'archive', '2026-11-20-foo')), false, 'the main checkout is behind');
  assert.deepEqual(listedBy(t.main, archiveGh([])), []);
});

test('field-fixes 1 archived: a failing gh falls back to the remote-tracking default branch', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false });
  archiveOnOrigin(t, 'foo');
  assert.deepEqual(listedBy(t.main, archiveGh([], { fail: true })), []);
});

// Invariant (T-24, D-13): resuming an archived change by its id ends archived; layer: startMode (the resume); suite: change-loop. The archived change records
// flow 2, as one opened with this release does (with no pin its reply gains the newer-flow line).
test('field-fixes 1 archived: resuming an archived change by its id still ends archived', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false, flow: 2 });
  put(t.main, archivedFolder('2026-11-20', 'foo', 2));
  commitAll(t.main, 'archive foo');
  const b = body(main(['start', '--lang', 'en'], { cwd: t.main, env: cleanEnv, stdin: 'change foo', gh: archiveGh(['2026-11-20-foo']) }));
  assert.deepEqual([b.mode, b.change], ['resume', 'foo']);
  assert.equal(b.reply, render('en', 'resumed', { id: 'foo', where: render('en', 'where.archived') }));
  assert.deepEqual(b.unfinished, []);
});

// ---- field-fixes 2: a change begun under the previous script ends blocked, never at the grill (D-2)

test('field-fixes 2 change-loop: next on a headerless plan with a later headed evidence.md ends blocked, previous-script', () => {
  const root = planChange({ have: ['proposal', 'design', 'tasks'], headerless: true });
  put(root, { 'openspec/changes/feat/evidence.md': `${head('evidence', git(root, 'rev-parse', 'HEAD'))}# Evidence\n` });
  commitAll(root, 'evidence');
  const r = next(root);
  assert.equal(r.code, 2, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'previous-script']);
  assert.notEqual(action.kind, 'grill');
});

test('field-fixes 2 change-loop: next on the old devkit-lite form with no requirements.md ends blocked, previous-script', () => {
  const root = gitRepo({ config: 'schema: devkit-lite\n' });
  put(root, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit-lite\n',
    'openspec/changes/feat/proposal.md': '# Proposal\n',
    'openspec/changes/feat/tasks.md': '# Tasks\n\n- [ ] 1.1 a\n',
    'openspec/changes/feat/evidence.md': `${head('evidence', 'none')}# Evidence\n`,
  });
  commitAll(root, 'old lite form');
  const r = next(root);
  assert.equal(r.code, 2, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.end.state, action.end.why], ['blocked', 'previous-script']);
  assert.notEqual(action.kind, 'grill');
});

// roadmap-coordinator: the request is read even when the writer of the pipe is slow (the read of an empty pipe waits, it does not give up).
const lateChild = (script, args, cwd, text, delayMs) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], { cwd, env: cleanEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
  setTimeout(() => child.stdin.end(text), delayMs);
});

test('change-loop start: a request written to the pipe after a delay is still read', async () => {
  const root = devkitRepo();
  const late = await lateChild(LOOP, ['start', '--lang', 'en'], root, 'change add a thing', 400);
  assert.equal(late.code, 0, late.stdout);
  assert.deepEqual(JSON.parse(late.stdout), JSON.parse(startRun(root, 'change add a thing').stdout), 'the same answer as for a request there from the start');
});

const lockDir = () => tmpFolder('devkit-lockfile-');

test('change-loop withLockFile: holds the lock while the work runs, stores the holder text, removes the lock after', () => {
  const lock = join(lockDir(), 'x.lock');
  const seen = withLockFile({ lock, stepMs: 1, waitMs: 5, staleMs: 1000, holder: 'me\n', timeout: () => new Error('late'), sleep: () => {} }, () => readFileSync(lock, 'utf8'));
  assert.equal(seen, 'me\n');
  assert.equal(existsSync(lock), false);
});

test('change-loop withLockFile: a held lock is waited for with the injected sleep, then the caller\'s error is thrown', () => {
  const lock = join(lockDir(), 'x.lock');
  writeFileSync(lock, 'other');
  const sleeps = [];
  class Late extends Error {}
  assert.throws(() => withLockFile({ lock, stepMs: 10, waitMs: 30, staleMs: 60_000, timeout: () => new Late('late'), sleep: (ms) => sleeps.push(ms) }, () => 'never'), Late);
  assert.deepEqual(sleeps, [10, 10, 10]);
  assert.equal(readFileSync(lock, 'utf8'), 'other', 'the other holder\'s lock is left alone');
});

test('change-loop withLockFile: a lock older than staleMs is taken over', () => {
  const lock = join(lockDir(), 'x.lock');
  writeFileSync(lock, 'old');
  const past = new Date(Date.now() - 5000);
  utimesSync(lock, past, past);
  assert.equal(withLockFile({ lock, stepMs: 1, waitMs: 5, staleMs: 1000, timeout: () => new Error('late'), sleep: () => {} }, () => 'ran'), 'ran');
  assert.equal(existsSync(lock), false);
});

// ---------------------------------------------------------------- stage-roles: the four agents, the skills, the verifier and the roles page

// { name, description, model, tools: [..], skills: [..], body } of an agent or skill file.
function assetOf(rel) {
  const text = readRepo(...rel.split('/'));
  const lines = frontmatterOf(text);
  const field = (k) => lines.find((l) => l.startsWith(`${k}:`))?.slice(k.length + 1).trim();
  return { name: field('name'), description: field('description'), model: field('model'), tools: (field('tools') ?? '').split(',').map((x) => x.trim()).filter(Boolean), skills: agentSkills(text), text, body: text.split('\n').slice(lines.length + 2).join('\n') };
}
const neverOf = (text) => (text.split('\n## Never\n')[1] ?? '').split('\n## ')[0];

const NEW_AGENTS = {
  'screen-designer': { model: 'sonnet', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'], skills: ['screen-mockup'], outcome: 'Outcome: drawn | failure — <summary>', stage: 'mockup',
    never: [/product code/i, /image/i, /result=passed/] },
  'adr-author': { model: 'opus', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'], skills: ['adr-authoring'], outcome: 'Outcome: proposed <n> | none-needed | failure — <summary>', stage: 'decisions',
    never: [/accepted record/i, /outside the ADR folder/i, /accepted/i] },
  'test-runner': { model: 'sonnet', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write'], skills: ['systematic-debugging', 'test-and-coverage'], outcome: 'Outcome: green | red | failure — <summary>', stage: 'unit-tests',
    never: [/unit-tests\.md/, /\| tail/, /\|\| true/] },
  'e2e-tester': { model: 'sonnet', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'], skills: ['e2e-testing'], outcome: 'Outcome: green | red | failure — <summary>', stage: 'e2e-tests',
    never: [/product file/i, /test files of the change's diff/i, /weaken/i] },
};

for (const [role, want] of Object.entries(NEW_AGENTS)) {
  test(`stage-roles roles agent ${role}: frontmatter names its model, tools and skills`, () => {
    const a = assetOf(`plugins/core/agents/${role}.md`);
    assert.equal(a.name, role);
    assert.equal(a.model, want.model);
    assert.deepEqual(a.tools, want.tools);
    assert.deepEqual(a.skills, want.skills);
    assert.match(a.description, /\bUse when\b/);
  });

  test(`stage-roles roles agent ${role}: it returns its Outcome line and starts from the stage header rule`, () => {
    const a = assetOf(`plugins/core/agents/${role}.md`);
    assert.ok(a.text.includes(want.outcome), `${role} returns "${want.outcome}"`);
    assert.match(a.text, new RegExp(`<!-- devkit-stage ${want.stage} result=`));
    for (const h of ['## Receives', '## Method', '## Delivers', '## Returns', '## Never']) assert.ok(a.text.includes(h), `${role} has ${h}`);
  });

  test(`stage-roles roles agent ${role}: its Never list holds its limits`, () => {
    const never = neverOf(assetOf(`plugins/core/agents/${role}.md`).text);
    assert.ok(never.length > 0, `${role} has a Never list`);
    for (const re of want.never) assert.match(never, re, `${role} never: ${re}`);
  });
}

test('stage-roles roles agent: the test runner and the screen designer reserve failure for a job they could not do', () => {
  for (const role of ['test-runner', 'e2e-tester']) assert.match(assetOf(`plugins/core/agents/${role}.md`).text, /could not do the job|cannot start|missing input/i, role);
  assert.match(assetOf('plugins/core/agents/e2e-tester.md').text, /result=failed/, 'a red run is carried by the header');
});

test('stage-roles roles agent: the ADR author says what it does when the project\'s folder is not one it may write', () => {
  for (const f of ['plugins/core/agents/adr-author.md', 'plugins/core/skills/adr-authoring/SKILL.md']) {
    const text = assetOf(f).text;
    assert.match(text, /adr, adrs or decisions|`adr`, `adrs` or `decisions`/, `${f} names the three folders`);
    assert.match(text, /Outcome: failure/, `${f} fails naming the folder`);
    assert.match(text, /docs\/adr\//, `${f} creates docs/adr/ when the project has none`);
  }
});

const NEW_SKILLS = {
  'screen-mockup': [/mock\//, /lorem ipsum/i, /real example/i, /owner's notes/i, /self-contained/i],
  'adr-authoring': [/hard to reverse/i, /Status: proposed|status line/i, /Context, Decision, Consequences/, /amend|supersed/i, /not-applicable/],
  'e2e-testing': [/acceptance criteri/i, /declared command|declared E2E command/i, /criterion id/i, /not the diff's tests|without reading/i],
};
for (const [skill, pins] of Object.entries(NEW_SKILLS)) {
  test(`stage-roles roles skill ${skill}: its description says when to use it and its body holds the method`, () => {
    const a = assetOf(`plugins/core/skills/${skill}/SKILL.md`);
    assert.equal(a.name, skill);
    assert.match(a.description, /\bUse when\b/);
    for (const re of pins) assert.match(a.body, re, `${skill}: ${re}`);
  });
}

test('stage-roles roles verifier: pr-verifier records text, takes no screenshot and posts no pull-request comment', () => {
  const a = assetOf('plugins/core/agents/pr-verifier.md');
  assert.doesNotMatch(a.text.replace('Take a screenshot, keep an image or post a pull-request comment', ''), /screenshot/i, 'only the Never line names it');
  assert.doesNotMatch(a.description, /screenshot|comment on the PR/i);
  assert.doesNotMatch(a.text, /gh pr comment/);
  assert.match(a.text, /exercise each changed screen locally \(or on the PR's preview\) and record in text what it showed: the visible text, the state, the console errors/);
  assert.match(a.text, /Take a screenshot, keep an image or post a pull-request comment/);
  assert.doesNotMatch(a.body.split('## Returns')[1] ?? '', /PR comment/);
  assert.match(a.text, /what was done and what was observed/);
});

test('stage-roles roles planner: change-planner leaves the records to the ADR author', () => {
  assert.ok(assetOf('plugins/core/agents/change-planner.md').text.includes('On a script with a `decisions` stage, the records are the adr-author\'s: cite `decisions.md`; a decision found while planning that needs a record `decisions.md` lacks is an escalation, not a draft.'));
});

test('stage-roles roles reviewer: code-quality-reviewer asks for observed screen text, not a screenshot', () => {
  const text = assetOf('plugins/core/agents/code-quality-reviewer.md').text;
  assert.match(text, /observed screen text/);
  assert.doesNotMatch(text, /screenshot/i);
});

// The "## <role>" section of docs/roles.md as { Does, Delivers, Never, Stages, 'Played today by' }.
function roleSection(role) {
  const lines = readRepo('docs', 'roles.md').split('\n');
  const from = lines.indexOf(`## ${role}`);
  assert.ok(from >= 0, `docs/roles.md has "## ${role}"`);
  const out = {};
  for (const l of lines.slice(from + 1)) {
    if (l.startsWith('## ')) break;
    const m = /^- ([\w ]+): (.*)$/.exec(l);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

test('stage-roles roles page: the four roles are played by their agents', () => {
  for (const role of Object.keys(NEW_AGENTS)) assert.equal(roleSection(role)['Played today by'], `The agent \`devkit-core:${role}\`.`, role);
});

test('stage-roles roles page: the screen designer works only when the grill flags ui, delivers the mock/ files and the stage is devkit only', () => {
  const s = roleSection('screen-designer');
  assert.match(s.Does, /only when the grill flags `ui`/);
  assert.match(s.Delivers, /mock\//);
  assert.match(s.Stages, /`mockup`.*`devkit` only/);
});

test('stage-roles roles page: the test runner and the E2E tester do the work the design says', () => {
  assert.match(roleSection('test-runner').Does, /^Runs the whole unit suite and the coverage command the project declares and records the result/);
  assert.match(roleSection('e2e-tester').Does, /^Writes the E2E tests from the acceptance criteria, apart from the implementer, runs them and records the result/);
});

test('stage-roles roles page: the verifier delivers its evidence as text, with no image', () => {
  assert.match(roleSection('pr-verifier').Delivers, /as text, with no image/);
});

// ---------------------------------------------------------------- stage-roles: the loop (design D-4, D-5; tasks 2.1 to 2.4)

const SCREEN = 'devkit-core:screen-designer';
const ADR_AUTHOR = 'devkit-core:adr-author';
const TEST_RUNNER = 'devkit-core:test-runner';
const E2E_TESTER = 'devkit-core:e2e-tester';
const TESTS = { unit: 'npm test', e2e: 'npm run e2e', coverage: { command: 'npm run cov', target: 80 } };
const planNext = (stage, reasonCode, params = {}) => ({ rep: { next: nextOf(FLOWS.devkit, stage, reasonCode, params), stages: { [stage]: { state: 'pending', reasonCode } } } });

test('stage-roles loop: the mock-up and the decisions are handed to their own roles, each naming its instructions', () => {
  for (const [stage, agent, role] of [['mockup', SCREEN, 'screen-designer'], ['decisions', ADR_AUTHOR, 'adr-author']]) {
    const a = run(planNext(stage, 'no-file'));
    assert.deepEqual([a.kind, a.agent, a.stage, a.role, exitCodeOf(a)], ['agent', agent, stage, role, 0], stage);
    assert.ok(a.brief.includes(`openspec instructions ${stage} --change feat`), a.brief);
    assert.doesNotMatch(a.brief, /write the plan files the script still lacks/, 'the planner text is the planner\'s alone');
    assert.equal(a.progressKey, `${stage}/${stage}@abc123`);
  }
});

test('stage-roles loop: a stale mock-up or decisions file is brought up to date by its own role', () => {
  for (const [stage, agent] of [['mockup', SCREEN], ['decisions', ADR_AUTHOR]]) {
    for (const reason of ['stale-plan', 'rerun-after-fix']) {
      const a = run(planNext(stage, reason, { by: 'requirements', stage }));
      assert.equal(a.agent, agent, `${stage} ${reason}`);
      assert.match(a.brief, new RegExp(`${stage} is out of date: bring it up to date`));
    }
  }
});

test('stage-roles loop: the planner and the readiness reviewer keep their own texts', () => {
  assert.match(run(planNext('proposal', 'no-file')).brief, /write the plan files the script still lacks, from proposal on/);
  assert.match(run(planNext('readiness', 'no-file')).brief, /review the plan/);
});

test('stage-roles loop: waiting-mockup the drawn mock-up ends waiting for the owner, naming its folder and file', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'mockup', 'owner-pending'), stages: { mockup: { state: 'pending', reasonCode: 'not-judged' } } } });
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-mockup', 1]);
  assert.equal(a.reply, says('waiting-mockup'));
  assert.deepEqual([a.stage, a.role], ['mockup', 'screen-designer']);
  assert.deepEqual(a.detail, { file: 'openspec/changes/feat/mockup.md', folder: 'openspec/changes/feat/mock/' });
  assert.ok(a.reply.includes('feat'), 'it names the change');
});

test('stage-roles loop: waiting-mockup is said in both languages without an internal term', () => {
  for (const lang of ['en', 'pt-BR']) {
    for (const key of ['waiting-mockup', 'gate.mockup', 'blocked-why.cannot-accept', 'setting.coverage-target']) {
      assert.ok(MESSAGES[lang][key], `${lang} has ${key}`);
    }
    const text = render(lang, 'waiting-mockup', { id: 'feat' });
    assert.ok(text.includes('feat') && !/mockup|\.md|screen-designer/.test(text), text);
  }
  assert.equal(render('en', 'gate.mockup'), 'your approval of the mock-up');
  assert.equal(render('pt-BR', 'gate.mockup'), 'a sua aprovação do mock-up');
  assert.match(render('en', 'blocked', { id: 'feat', why: 'cannot-accept', error: 'no approval' }), /decision records could not be marked accepted \(no approval\)/);
  assert.match(render('pt-BR', 'blocked', { id: 'feat', why: 'cannot-accept', error: 'sem aprovação' }), /registros de decisão como aceitos \(sem aprovação\)/);
  assert.equal(render('en', 'setting-unknown', { setting: 'coverage-target', value: '80%', accepted: 'x' }).includes('coverage target'), true);
  assert.equal(render('pt-BR', 'setting-unknown', { setting: 'coverage-target', value: '80%', accepted: 'x' }).includes('meta de cobertura'), true);
});

test('stage-roles loop: owner-changes the owner asked for changes, the mock-up goes back to its designer naming the next attempt', () => {
  const a = run({ rep: { next: nextOf(FLOWS.devkit, 'mockup', 'owner-changes', { stage: 'mockup', attempt: 1 }), stages: { mockup: { state: 'failed', reasonCode: 'changes-asked' } } } });
  assert.deepEqual([a.kind, a.agent, a.stage, exitCodeOf(a)], ['agent', SCREEN, 'mockup', 0]);
  assert.match(a.brief, /the owner asked for changes at attempt 1: redraw from the owner's notes in mockup\.md as attempt 2/);
  const third = run({ rep: { next: nextOf(FLOWS.devkit, 'mockup', 'owner-changes', { stage: 'mockup', attempt: 3 }), stages: { mockup: { state: 'failed', reasonCode: 'changes-asked' } } } });
  assert.match(third.brief, /attempt 3: redraw .* as attempt 4/);
});

test('stage-roles loop: the unit tests are handed to the test runner whatever step the delivery checker would give, with the declared commands', () => {
  for (const reason of ['no-file', 'stale-code', 'rerun-after-fix', 'not-judged']) {
    for (const step of ['commit', 'implement', 'verify', 'wait-checks']) {
      const a = run({ rep: { next: nextOf(FLOWS.devkit, 'unit-tests', reason, { stage: 'unit-tests' }) }, facts: { row: rowOf(step), tests: TESTS } });
      assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', TEST_RUNNER, 'unit-tests', 'unit-tests', 'test-runner'], `${reason} ${step}`);
      assert.deepEqual(a.detail, { unit: 'npm test', coverage: { command: 'npm run cov', target: 80 } });
      if (['no-file', 'not-judged'].includes(reason)) assert.ok(a.brief.includes('openspec instructions unit-tests --change feat'), a.brief);
      assert.equal(a.progressKey, 'unit-tests/unit-tests@abc123');
    }
  }
  const stale = run({ rep: { next: nextOf(FLOWS.devkit, 'unit-tests', 'stale-code', { why: 'x' }) }, facts: { row: rowOf('commit'), tests: TESTS } });
  assert.match(stale.brief, /the work changed since the last run: run it again/);
  const none = run({ rep: { next: nextOf(FLOWS.devkit, 'unit-tests', 'no-file') }, facts: { row: null, tests: { ...TESTS, coverage: { command: null, target: null } } } });
  assert.deepEqual(none.detail, { unit: 'npm test', coverage: { command: null, target: null } }, 'no row is read for a test stage, and no coverage is declared');
});

test('stage-roles loop: the E2E tests are handed to the E2E tester with the declared command', () => {
  const a = run({ rep: { next: nextOf(FLOWS.devkit, 'e2e-tests', 'no-file') }, facts: { row: rowOf('commit'), tests: TESTS } });
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', E2E_TESTER, 'e2e-tests', 'e2e-tests', 'e2e-tester']);
  assert.deepEqual(a.detail, { e2e: 'npm run e2e' });
  assert.ok(a.brief.includes('openspec instructions e2e-tests --change feat'));
});

test('stage-roles loop: fix-tests a red test stage goes back to the implementer, naming the failed stage and its file', () => {
  for (const [failed, file] of [['unit-tests', 'unit-tests.md'], ['e2e-tests', 'e2e-tests.md']]) {
    const a = run({ rep: { next: nextOf(FLOWS.devkit, 'implementation', 'fix-after-failure', { failed, attempt: 2, ceiling: 3 }) }, facts: { row: rowOf('commit'), tests: TESTS } });
    assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role, exitCodeOf(a)], ['agent', TDD, 'fix-tests', 'implementation', 'tdd-implementer', 0], failed);
    assert.deepEqual(a.detail, { failed, file });
    assert.match(a.brief, new RegExp(`${failed} failed at attempt 2 of 3: fix the code from ${file}, test first, within the approved tasks`));
    assert.equal(a.progressKey, 'implementation/fix-tests@abc123');
  }
});

test('stage-roles loop: fix-tests is not the step for an evidence or a review failure, which follow the delivery checker\'s row', () => {
  for (const failed of ['evidence', 'review']) {
    const a = run({ rep: { next: nextOf(FLOWS.devkit, 'implementation', 'fix-after-failure', { failed, attempt: 1, ceiling: 3 }) }, facts: { row: rowOf('fix-review'), tests: TESTS } });
    assert.equal(a.step, 'fix-review', failed);
  }
  const rows = ROW_STEPS;
  assert.ok(!rows.includes('fix-tests') && !rows.includes('unit-tests') && !rows.includes('e2e-tests'), 'neither step is a row of the delivery checker');
});

test('stage-roles loop: the loop\'s own hand-offs of the test stages carry a role the packs know', () => {
  for (const role of ['screen-designer', 'adr-author', 'test-runner', 'e2e-tester']) assert.equal(PACKS[role], 'devkit-core', role);
});

// The plan of change `feat` approved (a current approval.md), with the records `adrs` written in the repository.
const ADR_FOLDER = 'docs/adr';
const adrRecord = (status, extra = '') => `# ADR 9: x\n\n${status}\n\n## Context\n\nc\n${extra}`;
function adrChange({ approval = 'current', records = {}, listed = Object.keys(records), extra = {}, date = '2026-11-22' } = {}) {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const dir = 'openspec/changes/feat';
  const files = {
    [`${dir}/.openspec.yaml`]: 'schema: devkit\n',
    [`${dir}/readiness.md`]: '# Readiness\n\n- Status: APPROVED\n',
    [`${dir}/decisions.md`]: `<!-- devkit-stage decisions result=passed attempt=1 commit=none -->\n# Decisions\n\n${listed.map((p) => `- ADR: \`${p}\` — a record`).join('\n')}\n`,
    ...Object.fromEntries(Object.entries(records).map(([p, body]) => [p, body])),
    ...extra,
  };
  put(root, files);
  if (approval !== 'none') {
    const hash = approval === 'current' ? approvalState(join(root, dir)).readiness : 'sha256:000000000000';
    put(root, { [`${dir}/approval.md`]: `<!-- devkit-stage approval result=passed attempt=1 commit=none -->\n# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${hash}\n- Date: ${date}\n- Owner's words: "go"\n` });
  }
  return root;
}
const accept = (root, extra = []) => main(['accept-decisions', 'feat', '--lang', 'en', ...extra], { cwd: root, env: cleanEnv });
const treeOf = (root) => {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      if (e.isDirectory()) walk(join(d, e.name)); else out[join(d, e.name).slice(root.length)] = readFileSync(join(d, e.name), 'utf8');
    }
  };
  walk(root);
  return JSON.stringify(out);
};
const refused = (root, why) => {
  const before = treeOf(root);
  const r = accept(root);
  assert.equal(r.code, 3, `${why}: ${r.stdout}`);
  const b = JSON.parse(r.stdout);
  assert.equal(b.version, 1);
  assert.equal(b.reply, render('en', 'blocked', { id: 'feat', why: 'cannot-accept', error: b.error }), why);
  assert.equal(treeOf(root), before, `${why}: a refusal changes no file`);
  return b;
};

test('stage-roles loop: accept-decisions sets every proposed record accepted with the approval\'s date, and says what it did', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/0001-a.md`]: adrRecord('Status: proposed'), [`${ADR_FOLDER}/0002-b.md`]: adrRecord('- Status: Proposed') } });
  const r = accept(root);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, change: 'feat', accepted: [`${ADR_FOLDER}/0001-a.md`, `${ADR_FOLDER}/0002-b.md`], already: [] });
  const by = 'Accepted by: the owner, on 2026-11-22, in the approval of the plan of change feat (openspec/changes/feat/approval.md)';
  assert.match(readFileSync(join(root, ADR_FOLDER, '0001-a.md'), 'utf8'), new RegExp(`\\nStatus: accepted\\nStatus: ${by.replace(/[()/.]/g, '\\$&')}\\n`));
  assert.match(readFileSync(join(root, ADR_FOLDER, '0002-b.md'), 'utf8'), new RegExp(`\\n- Status: Accepted\\n- ${by.replace(/[()/.]/g, '\\$&')}\\n`));
});

test('stage-roles loop: accept-decisions keeps the letter case and the prefix of the status line', () => {
  const root = adrChange({ records: {
    [`${ADR_FOLDER}/a.md`]: adrRecord('Status: PROPOSED'),
    [`${ADR_FOLDER}/b.md`]: adrRecord('  * **Status:** Proposed — pending'),
    [`${ADR_FOLDER}/c.md`]: adrRecord('  - Status: PROPOSED'),
    [`${ADR_FOLDER}/d.md`]: adrRecord('* Status: proposed'),
  } });
  assert.equal(accept(root).code, 0);
  const a = readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8');
  assert.match(a, /\nStatus: ACCEPTED\nStatus: Accepted by: the owner, on 2026-11-22/);
  const b = readFileSync(join(root, ADR_FOLDER, 'b.md'), 'utf8');
  assert.match(b, /\n {2}\* \*\*Status:\*\* Accepted — pending\n {2}\* \*\*Status:\*\* Accepted by: the owner, on 2026-11-22/);
  const c = readFileSync(join(root, ADR_FOLDER, 'c.md'), 'utf8');
  assert.match(c, /\n {2}- Status: ACCEPTED\n {2}- Accepted by: the owner, on 2026-11-22/, 'a bulleted Status line gets a bulleted Accepted by line, not a second Status label');
  assert.doesNotMatch(c, /Status: Accepted by/);
  const d = readFileSync(join(root, ADR_FOLDER, 'd.md'), 'utf8');
  assert.match(d, /\n\* Status: accepted\n\* Accepted by: the owner, on 2026-11-22/);
});

test('stage-roles loop: accept-decisions leaves an accepted record alone and lists it as already accepted', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: accepted'), [`${ADR_FOLDER}/b.md`]: adrRecord('Status: proposed') } });
  const before = readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8');
  const r = accept(root);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, change: 'feat', accepted: [`${ADR_FOLDER}/b.md`], already: [`${ADR_FOLDER}/a.md`] });
  assert.equal(readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8'), before);
  const again = accept(root);
  assert.deepEqual(JSON.parse(again.stdout).accepted, [], 'a second run has nothing left');
  assert.equal(readFileSync(join(root, ADR_FOLDER, 'b.md'), 'utf8').match(/Accepted by/g).length, 1, 'the line is written once');
});

test('stage-roles loop: accept-decisions with no listed record succeeds and writes nothing', () => {
  const root = adrChange({ records: {}, listed: [] });
  const before = treeOf(root);
  const r = accept(root);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, change: 'feat', accepted: [], already: [] });
  assert.equal(treeOf(root), before);
});

test('stage-roles loop: accept-decisions refuses while the approval is missing, naming it, and changes nothing', () => {
  const root = adrChange({ approval: 'none', records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') } });
  assert.match(refused(root, 'no approval').error, /approval/);
  assert.match(readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8'), /Status: proposed/);
});

test('stage-roles loop: accept-decisions refuses an approval of an earlier readiness', () => {
  const root = adrChange({ approval: 'earlier', records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') } });
  assert.match(refused(root, 'earlier approval').error, /approval/);
});

test('stage-roles loop: accept-decisions refuses a path outside the repository, an absolute one and a file that does not exist', () => {
  const rec = { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') };
  assert.match(refused(adrChange({ records: rec, listed: [`${ADR_FOLDER}/a.md`, '../outside/adr/x.md'] }), 'outside').error, /outside\/adr\/x\.md/);
  assert.match(refused(adrChange({ records: rec, listed: [`${ADR_FOLDER}/a.md`, '/etc/adr/x.md'] }), 'absolute').error, /\/etc\/adr\/x\.md/);
  assert.match(refused(adrChange({ records: rec, listed: [`${ADR_FOLDER}/a.md`, `${ADR_FOLDER}/missing.md`] }), 'missing').error, /missing\.md/);
});

test('stage-roles loop: accept-decisions refuses a listed record that is a symlink to a file outside the repository, and leaves the target alone', () => {
  const outside = tmpFolder('devkit-adr-outside-');
  const target = join(outside, 'x.md');
  writeFileSync(target, adrRecord('Status: proposed'));
  const root = adrChange({ records: {}, listed: [`${ADR_FOLDER}/x.md`] });
  mkdirSync(join(root, ADR_FOLDER), { recursive: true });
  symlinkSync(target, join(root, ADR_FOLDER, 'x.md'));
  const before = readFileSync(target, 'utf8');
  const r = accept(root);
  assert.equal(r.code, 3, r.stdout);
  assert.match(JSON.parse(r.stdout).error, /docs\/adr\/x\.md/);
  assert.equal(readFileSync(target, 'utf8'), before, 'the file outside the repository is not rewritten');
  rmSync(outside, { recursive: true, force: true });
});

test('stage-roles loop: accept-decisions refuses a file that is not Markdown and a folder that is not an ADR folder', () => {
  assert.match(refused(adrChange({ records: { [`${ADR_FOLDER}/a.txt`]: adrRecord('Status: proposed') } }), 'not md').error, /a\.txt/);
  assert.match(refused(adrChange({ records: { 'src/a.md': adrRecord('Status: proposed') } }), 'no adr folder').error, /src\/a\.md/);
  for (const folder of ['adrs', 'decisions', 'ADR']) {
    const root = adrChange({ records: { [`docs/${folder}/a.md`]: adrRecord('Status: proposed') } });
    assert.equal(accept(root).code, 0, folder);
  }
});

test('stage-roles loop: accept-decisions refuses a record with no status line or a status that is neither proposed nor accepted', () => {
  assert.match(refused(adrChange({ records: { [`${ADR_FOLDER}/a.md`]: '# ADR\n\nno status here\n' } }), 'no status').error, /a\.md/);
  assert.match(refused(adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: superseded') } }), 'superseded').error, /a\.md/);
});

test('stage-roles loop: accept-decisions with a good record and a bad one changes neither (every check runs before a write)', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed'), [`${ADR_FOLDER}/b.md`]: adrRecord('Status: superseded') } });
  refused(root, 'mixed good and bad');
  assert.match(readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8'), /Status: proposed\n/);
});

test('stage-roles loop: accept-decisions names itself in the usage line and needs a change id', () => {
  const r = main(['accept-decisions', '--lang', 'en'], { cwd: tmpFolder('devkit-loop-nocwd-'), env: cleanEnv });
  assert.equal(r.code, 3);
  assert.match(JSON.parse(r.stdout).error, /accept-decisions <id>/);
  assert.match(read('change-loop.mjs'), /accept-decisions <id> --lang/);
});

const APPROVED = { status: 'APPROVED', recorded: 'sha256:abcdef012345', readiness: 'sha256:abcdef012345', ok: true };
const DEC = (over = {}) => ({ listed: [`${ADR_FOLDER}/a.md`], proposed: [`${ADR_FOLDER}/a.md`], unreadable: [], ...over });
const afterApproval = (facts) => run({ rep: { next: nextOf(FLOWS.devkit, 'implementation', 'tasks-pending', { count: 1, ids: ['1.1'] }) }, facts: { row: rowOf('implement'), approval: APPROVED, decisions: DEC(), ...facts } });

test('stage-roles loop: the accept-decisions step comes with a current approval and a proposed record, carrying its command', () => {
  const a = afterApproval({});
  assert.deepEqual([a.kind, a.step, a.stage, exitCodeOf(a)], ['session', 'accept-decisions', 'approval', 0]);
  assert.deepEqual(a.detail.command, ['node', join(HOOKS_DIR, 'change-loop.mjs'), 'accept-decisions', 'feat', '--lang', 'en']);
  assert.deepEqual(a.detail.records, [`${ADR_FOLDER}/a.md`]);
  assert.equal(a.progressKey, 'approval/accept-decisions@abc123');
});

test('stage-roles loop: the accept-decisions step is also taken for a record the loop could not read, so the command can refuse it by name', () => {
  const a = afterApproval({ decisions: DEC({ proposed: [], unreadable: [{ path: `${ADR_FOLDER}/b.md`, why: 'no status line' }] }) });
  assert.equal(a.step, 'accept-decisions');
  assert.deepEqual(a.detail.records, [`${ADR_FOLDER}/b.md`]);
});

test('stage-roles loop: no accept-decisions step while the approval is not current, with nothing proposed, or with no records', () => {
  for (const [label, facts] of [
    ['no approval', { approval: { ...APPROVED, ok: false, status: null, recorded: null } }],
    ['an earlier approval', { approval: { ...APPROVED, ok: false, recorded: 'sha256:111111111111' } }],
    ['every record accepted', { decisions: DEC({ proposed: [] }) }],
    ['no record listed', { decisions: DEC({ listed: [], proposed: [] }) }],
    ['no facts of the records', { decisions: undefined }],
  ]) {
    assert.equal(afterApproval(facts).step, 'implement', label);
  }
});

test('stage-roles loop: no accept-decisions step on the archive branch, even with a current approval and a proposed record', () => {
  const a = afterApproval({ archiving: true });
  assert.notEqual(a.step, 'accept-decisions');
  assert.equal(a.detail?.command, undefined);
});

test('stage-roles loop: after accept-decisions the next call offers the implementation (a record accepted is no longer proposed)', () => {
  const root = adrChange({ records: { [`${ADR_FOLDER}/a.md`]: adrRecord('Status: proposed') } });
  const before = next(root);
  const a1 = actionOf(before.stdout);
  assert.equal(a1.step, 'accept-decisions', before.stdout);
  assert.equal(accept(root).code, 0);
  const a2 = actionOf(next(root).stdout);
  assert.notEqual(a2.step, 'accept-decisions');
});

test('stage-roles loop: setting-unknown a coverage target that is not a whole number from 0 to 100 stops the command like any unknown setting', () => {
  for (const target of ['80%', '101', 'high', '-1']) {
    const root = devkitRepo(`schema: devkit\ndevkit:\n  tests:\n    unit: "npm test"\n    coverage:\n      command: "npm run cov"\n      target: ${target}\n`);
    const s = readDevkitSettings(root);
    assert.deepEqual(s.unknown.map((u) => [u.setting, u.value]), [['coverage-target', target]], target);
    const b = body(startRun(root, 'change add an export'));
    assert.equal(b.mode, 'setting-unknown', target);
    assert.equal(b.reply, render('en', 'setting-unknown', { setting: 'coverage-target', value: target, accepted: 'a whole number from 0 to 100' }));
    assert.ok(b.reply.includes('coverage target'));
  }
  const good = devkitRepo('schema: devkit\ndevkit:\n  tests:\n    coverage:\n      target: 80\n  driver: claude\n');
  assert.deepEqual(readDevkitSettings(good), { driver: 'claude', language: 'en', unknown: [] });
});

test('stage-roles loop: the nested test keys do not disturb the driver and the language', () => {
  const s = readDevkitSettings(configRepo('devkit:\n  language: pt-BR\n  tests:\n    unit: "npm test"\n    e2e: "npm run e2e"\n  driver: claude\n'));
  assert.deepEqual(s, { driver: 'claude', language: 'pt-BR', unknown: [] });
});

test('stage-roles loop: a screen designer that stops before redrawing is refused once, like any stage agent that has not delivered', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, {
    'openspec/changes/feat/requirements.md': `${head('requirements', c0)}# requirements\n\nClassification: devkit; flags=[ui]\n`,
    'openspec/changes/feat/mockup.md': `${head('mockup', c0, 'failed', 1)}# Mock-up\n`,
  });
  commitAll(root, 'the owner asked for changes');
  const tmp = sandbox();
  const first = hook('subagent-stop', subInput(root, runTranscript(), 'screen-designer'), { TMPDIR: tmp });
  assert.equal(first.code, 2, first.err);
  assert.match(first.err, /mockup\.md/);
  assert.equal(hook('subagent-stop', subInput(root, runTranscript(), 'screen-designer'), { TMPDIR: tmp }).code, 0, 'the same state a second time is let through');
});

test('stage-roles loop: the loop hands a mock-up of a change with a screen to its designer, read from the files', () => {
  const root = planChange({ have: ['requirements'] });
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, { 'openspec/changes/feat/requirements.md': `${head('requirements', c0)}# requirements\n\nClassification: devkit; flags=[ui]\n` });
  commitAll(root, 'a screen');
  const a = actionOf(next(root).stdout);
  assert.deepEqual([a.kind, a.agent, a.stage], ['agent', SCREEN, 'mockup']);
  const plain = planChange({ have: ['requirements'] });
  const b = actionOf(next(plain).stdout);
  assert.deepEqual([b.kind, b.agent, b.stage], ['agent', ADR_AUTHOR, 'decisions'], 'no ui flag: no mock-up, the decisions come first');
});

// ---------------------------------------------------------------- stage-roles docs (phase 4: D-9, D-12)

test('stage-roles docs: the design page marks stages 3, 4, 9, 10 and 11 of its table built in round 16', () => {
  const rows = readRepo('docs', 'coordination-design.md').split('\n');
  for (const n of [3, 4, 9, 10, 11]) {
    const row = rows.find((l) => l.startsWith(`| ${n} | `));
    assert.ok(row, `row ${n} of the stage table exists`);
    assert.match(row, /\(built, round 16\)/, `row ${n} says built, round 16`);
    assert.doesNotMatch(row, /\(new\)/, `row ${n} no longer says new`);
  }
  assert.match(rows.find((l) => l.startsWith('| 8 | ')), /`tdd-implementer`/, 'the other rows are untouched');
});

test('stage-roles docs: the design page records the test settings among the configuration field names', () => {
  const design = readRepo('docs', 'coordination-design.md');
  const a = design.indexOf("**The configuration's field names.");
  const b = design.indexOf('**The header', a);
  const part = design.slice(a, b).replace(/\s+/g, ' ');
  assert.match(part, /Decided by `stage-roles` on 2026-11-21: `devkit\.tests\.unit`, `devkit\.tests\.coverage\.command`, `devkit\.tests\.coverage\.target`, `devkit\.tests\.e2e`/);
  assert.match(design, /coverage:\s*\n\s+command:/, 'the example configuration gains the coverage lines');
  assert.match(design, /screen-designer[^\n]*\bdraws\b|\bdraws\b[^\n]*screen-designer/, 'the mock-up paragraph says the screen designer draws it');
  assert.match(design.slice(design.indexOf('Tense:'), design.indexOf('Tense:') + 2400), /stage-roles/, 'the Tense paragraph lists what exists since stage-roles');
});

test('stage-roles docs: ADR 0016 has its headings, its status and the owner\'s approval of the plan', () => {
  const adr = readRepo('docs', 'adr', '0016-stage-roles-write-their-own-files.md');
  assert.equal(adr.split('\n')[0], '# ADR 0016: Stage roles write their own files, and a stage that does not apply may leave none');
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0016 has ${h}`);
  }
  assert.match(adr, /^- Status: accepted$/m);
  assert.match(adr, /^- Change: stage-roles$/m);
  assert.match(adr, /^- Amends: ADR 0010 \(0010-openspec-as-the-harness\.md\)[^\n]*ADR 0011 \(0011-the-change-coordinator-is-the-owners-session\.md\), decision 3$/m);
  // The change folder moves to openspec/changes/archive/<date>-stage-roles/ when the change is archived.
  const changesDir = join(REPO_ROOT, 'openspec', 'changes');
  const archived = existsSync(join(changesDir, 'archive')) ? readdirSync(join(changesDir, 'archive')).filter((d) => /^\d{4}-\d{2}-\d{2}-stage-roles$/.test(d)).sort() : [];
  const approvalPath = existsSync(join(changesDir, 'stage-roles', 'approval.md')) ? join(changesDir, 'stage-roles', 'approval.md') : join(changesDir, 'archive', archived[archived.length - 1] ?? '', 'approval.md');
  const approval = readFileSync(approvalPath, 'utf8');
  const date = approval.match(/^- Date: (\d{4}-\d{2}-\d{2})$/m)?.[1];
  const words = approval.match(/^- Owner's words: "(.+)"$/m)?.[1];
  assert.ok(date && words, 'approval.md has its date and the owner\'s words');
  assert.match(adr, new RegExp(`^- Accepted by: the owner, on ${date}, in the message that approved the plan of the change: \`${words}\`; recorded in \`openspec/changes/stage-roles/approval\\.md\`$`, 'm'));
});

test('stage-roles docs: ADR 0010 and ADR 0011 name ADR 0016 in a header line and a dated Note', () => {
  const line = '- Amended by ADR 0016 (0016-stage-roles-write-their-own-files.md)';
  for (const f of ['0010-openspec-as-the-harness.md', '0011-the-change-coordinator-is-the-owners-session.md']) {
    const adr = readRepo('docs', 'adr', f);
    assert.ok(adr.split('\n').slice(0, 8).includes(line), `${f} has the Amended by line in its header`);
    assert.match(adr, /^- Status: accepted$/m, `${f} stays accepted`);
    assert.match(adr, /Note \(stage-roles, 2026-11-21\):[^\n]*(\n[^\n]+)*?\[ADR 0016\]\(0016-stage-roles-write-their-own-files\.md\)/, `${f} has the dated Note linking ADR 0016`);
  }
  const flat10 = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md').replace(/\s+/g, ' ');
  assert.match(flat10, /Note \(stage-roles, 2026-11-21\): the roles of D-4 stages 3, 4, 9 and 10 ship and stage 11 is recorded as text\./);
  assert.match(flat10, /\(decision 1, round 16\)\. Decisions 1 to 8 are otherwise unchanged\./);
  assert.match(readRepo('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md'), /decision 2's refusal of the session's product edits is unchanged/);
  const adrs = readRepo('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0016 stage roles write their own files, amends 0010 and 0011/, 'the ADRs line of config.yaml names 0016');
});

// The roadmap line of stage-roles as commit 2300f84 had it, before the carried items moved. It is a
// literal, not a `git show`, because CI checks out with depth 1 and the history is not there.
const STAGE_ROLES_LINE_AT_2300F84 = "- [ ] stage-roles (after: change-coordinator) — the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11) Carried from the change-coordinator retro for its grill, as the first real use of /devkit change: a declared end for a pause the owner asks for and for a decision outside the script's gates; the end marker's id compared with the run's change; the skill's resolve-release-conflict item naming the declared end; the loop's fallback agent map tied to the pack table; a dated Note on ADR 0011 for the stop lock after a recorded end; the person's language checked with the installed plugin when it was never set; the unlimited wait on GitHub proved in real use; whether a change that creates the project's first spec may run on the short script; and whether the short script gains the owner's plan approval. Carried from the coordinator-field-fixes retro: a declared step for a review round the owner authorizes after the limit (the round script accepts a third round and the loop leaves `blocked` without a header set by hand); a plan file revised after the implementation started makes the readiness review and the approval stale; and the review's open nits of that change (the archive sources worded as a fallback chain in the change-coordination spec while the code takes their union, exit 1 of `github-setup` for a blocked state stated in a scenario, a test for an unreadable `.openspec.yaml`). Carried from the roadmap-coordinator retro, the first whole change run with /devkit change: a declared step for a small fix after a red gate, in place of a run that ends blocked; a way for a task to say that the conducting session does it, so the loop does not hand it to the implementer; how the wait on GitHub lives with a host that has its own pull-request monitor and forbids polling, so that the session still goes on alone when the checks pass; and the verifier allowed to write its runs' output under the change's `proof/` folder.";

test('stage-roles docs: the roadmap line of stage-roles keeps its text, and every carried item moved to coordinator-loop-fixes', () => {
  const itemOf = (rounds, id) => rounds.flatMap((r) => r.items).find((i) => i.id === id);
  const before = itemOf(guardModule.parseRoadmap(`## Round 16: the new stage roles\n${STAGE_ROLES_LINE_AT_2300F84}\n`), 'stage-roles');
  const rounds = guardModule.parseRoadmap(readRepo('openspec', 'roadmap.md'));
  const stage = itemOf(rounds, 'stage-roles');
  const fixes = itemOf(rounds, 'coordinator-loop-fixes');
  assert.ok(before && stage && fixes, 'both lines exist');
  const cut = before.text.indexOf(' Carried from');
  assert.ok(cut > 0, 'the line as it was at 2300f84 holds the carried text');
  const carried = before.text.slice(cut).trim();
  assert.equal(stage.text, before.text.slice(0, cut), 'the stage-roles line keeps the text before the carried items');
  assert.doesNotMatch(stage.text + stage.notes, /Carried from/, 'the stage-roles line holds none of them');
  assert.deepEqual(stage.after, ['change-coordinator']);
  assert.deepEqual(fixes.after, ['stage-roles']);
  const sentences = carried.split(/(?<=\.)\s+(?=[A-Z])/).map((s) => s.trim());
  assert.ok(sentences.length >= 3, 'the carried text has its sentences');
  for (const s of sentences) assert.ok(fixes.text.includes(s), `coordinator-loop-fixes holds: ${s.slice(0, 60)}`);
  assert.ok(fixes.text.includes(carried), 'the carried text is copied verbatim');
  const round = rounds.find((r) => r.items.includes(fixes));
  assert.equal(round.title, 'Round 16b: the coordinator loop fixes');
  assert.equal(rounds[rounds.indexOf(round) - 1].items.includes(stage), true, 'round 16b follows the round of stage-roles');
});

// ================================================================ roadmap-coordinator-followups: phase 1 (the lock of open, the single read)

test('followups AC-10 open lock: open on a held open lock fails with its own message and creates nothing', () => {
  const t = freshProject();
  const lock = join(t.main, '.git', 'devkit-open.lock');
  writeFileSync(lock, `${JSON.stringify({ pid: 1, at: new Date().toISOString() })}\n`);
  const before = snapshot(t.main);
  const sleeps = [];
  assert.throws(
    () => openChange(t.main, 'held-open', { script: 'devkit', why: 'doubt', request: 'Add a thing', lang: 'en', env: cleanEnv, lockSleep: (ms) => { sleeps.push(ms); } }),
    (e) => e instanceof LoopUsageError && /another open call holds the lock for too long/.test(e.message),
  );
  assert.ok(sleeps.length > 0, 'the wait went through the injected sleep');
  assert.equal(sleeps.reduce((a, b) => a + b, 0), 60_000, 'the whole wait of the open lock, without sleeping for real');
  assert.equal(existsSync(lock), true, 'the other holder\'s lock is untouched');
  rmSync(lock);
  assert.deepEqual(snapshot(t.main), before, 'nothing was created');
});

test('followups AC-10 guard: an edit and a shell write in a change run read the transcript once', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  for (const [mode, input] of [
    ['edit', (t) => editInput(root, 'src/a.ts', t)],
    ['bash', (t) => bashInput(root, 'echo x > src/a.ts', t)],
  ]) {
    const transcript = runTranscript();
    const spy = readCounter();
    const r = hook(mode, input(transcript), { TMPDIR: sandbox(), ...spy.env(transcript) });
    assert.equal(r.code, 2, `${mode}: ${r.err}`);
    assert.equal(spy.reads(), 1, `${mode}: the transcript is read once`);
  }
});

// ================================================================ roadmap-coordinator-followups, phase 3: a started session, the stage icon

// The first message of a session another session started, in the app's form (this change's own first message, in generic words):
// the background line, a background paragraph, `Task:`, the task, and a notes line.
const STARTED_LINE = 'Background (from the session that started this one):';
const startedMessage = (id, over = {}) => [
  over.first ?? STARTED_LINE, 'This session runs the devkit change for a roadmap run. Work only in its worktree.', '', 'Task:', over.task ?? `/devkit-openspec:devkit change ${id}`, '', 'Notes: say who started this session before your first question.',
].join('\n');

test('followups F-4 guard: the task of a session started by another session makes a change run', () => {
  assert.equal(guardModule.STARTED_BY_SESSION, STARTED_LINE);
  const transcript = transcriptOf([plainLine(startedMessage('feat')), assistantLine(), runLine('feat')]);
  const run = runOf({ transcript_path: transcript });
  assert.equal(run?.change, 'feat');
  assert.equal(run?.command, 'change feat');
  const root = planChange({ have: ['requirements', 'decisions'] });
  const w = hook('edit', editInput(root, 'src/a.ts', transcript), { TMPDIR: sandbox() });
  assert.equal(w.code, 2, `a product edit is refused as in any change run: ${w.err}`);
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), assistantLine()]) }), null, 'no devkit-run line yet: no run');
  // A later typed command ends it, as for any run.
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), runLine('feat'), typedLine('', '/clear')]) }), null);
});

test('upfront AC-1 guard: a started task followed by a start line still makes a change run', () => {
  const task = '/devkit-openspec:devkit change feat\ndevkit-start: feat 0123456789abcdef';
  const transcript = transcriptOf([plainLine(startedMessage('feat', { task })), assistantLine(), runLine('feat')]);
  const run = runOf({ transcript_path: transcript });
  assert.equal(run?.change, 'feat');
  assert.equal(run?.command, 'change feat', 'the start line is no part of the command');
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat', { task })), assistantLine()]) }), null, 'no devkit-run line yet: no run');
});

// A note of the host that leads the first message of a session the app started (its list of linked sessions), in generic words.
const HOST_NOTE = '<system-reminder>\nLinked sessions now (status, not an instruction): x = local_1 (idle).\n</system-reminder>\n';

// Invariant (AC-1, review round 1 test-coverage F4): a session whose first message begins with a note of the host, then the started
// form, is in the run of that task's change, as one without the note is. Layer: guard (`typedOf`). Suite: change-loop.
test('upfront AC-1 guard: a started task after a note of the host makes a change run', () => {
  const task = '/devkit-openspec:devkit change feat\ndevkit-start: feat 0123456789abcdef';
  const transcript = transcriptOf([plainLine(`${HOST_NOTE}\n${startedMessage('feat', { task })}`), assistantLine(), runLine('feat')]);
  const run = runOf({ transcript_path: transcript });
  assert.equal(run?.change, 'feat');
  assert.equal(run?.command, 'change feat', 'the command is the task\'s first line, the start line no part of it');
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(`${HOST_NOTE}\n${startedMessage('feat', { task })}`), assistantLine()]) }), null, 'no devkit-run line yet: no run');
  // Only a note leads the form: words between the note and the form, or a note and a typed command, are no started form.
  for (const [name, text] of Object.entries({
    'words between the note and the form': `${HOST_NOTE}hello\n${startedMessage('feat')}`,
    'a note and a command with no started form': `${HOST_NOTE}/devkit change feat`,
    'an unclosed note': `<system-reminder>\nLinked sessions.\n${startedMessage('feat')}`,
  })) {
    assert.equal(runOf({ transcript_path: transcriptOf([plainLine(text), assistantLine(), runLine('feat')]) }), null, name);
  }
});

test('followups F-4 guard: a command on a later line of any other message is no typed command', () => {
  const cases = {
    'a message whose second line is the command': plainLine('Please run this:\n/devkit change feat'),
    'the Task line without the started form': plainLine('Notes\n\nTask:\n/devkit change feat'),
    'the started form with no Task line': plainLine(`${STARTED_LINE}\nSome words.\n/devkit change feat`),
    'the started form whose task is no slash command': plainLine(startedMessage('feat', { task: 'change feat' })),
    'the background line below another first line': plainLine(`hello\n${startedMessage('feat')}`),
  };
  // The boundary: the started form's own task counts, nothing else on a later line does.
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), assistantLine(), runLine('feat')]) })?.change, 'feat', 'the started form');
  for (const [name, line] of Object.entries(cases)) {
    assert.equal(runOf({ transcript_path: transcriptOf([line, assistantLine(), runLine('feat')]) }), null, name);
  }
});

const STAGE_ICONS = {
  open: '❓', requirements: '❓', mockup: '📝', decisions: '📝', proposal: '📝', specs: '📝', design: '📝', tasks: '📝', readiness: '📝', approval: '📝',
  implementation: '🛠️', 'unit-tests': '🛠️', 'e2e-tests': '🛠️', evidence: '🔍', review: '🔍', delivery: '🚀', retro: '📦',
};

test('followups AC-14 icon: every stage of both scripts has its icon, and an archived end is the archive\'s', () => {
  for (const [script, flow] of Object.entries(FLOWS)) {
    for (const stage of flow.stages) {
      assert.ok(STAGE_ICONS[stage.id], `${script}: the table names ${stage.id}`);
      assert.equal(changeLoopModule.stageIcon({ stage: stage.id }), STAGE_ICONS[stage.id], `${script}: ${stage.id}`);
    }
  }
  assert.deepEqual([...new Set(Object.values(STAGE_ICONS))].sort(), ['❓', '📝', '📦', '🔍', '🚀', '🛠️'].sort(), 'the six icons');
  assert.equal(changeLoopModule.stageIcon({ kind: 'end', stage: 'delivery', end: { state: 'archived', why: 'archived' } }), '📦');
  assert.equal(changeLoopModule.stageIcon({ kind: 'end', stage: 'delivery', end: { state: 'waiting-on-github', why: 'waiting-github' } }), '🚀');
  for (const unknown of [{ stage: 'nope' }, { stage: null }, {}, undefined]) assert.equal(changeLoopModule.stageIcon(unknown), null, JSON.stringify(unknown));
});

test('followups AC-14 next: every action of change-loop next carries the icon of its stage and its session title', () => {
  const seen = [];
  const wanted = ['🙋 ❓ feat', '📝 feat', '📝 feat', '📝 feat', '🙋 📝 feat'];
  for (const [i, have] of [[], ['requirements'], ['requirements', 'proposal'], PLAN_UP_TO_TASKS, [...PLAN_UP_TO_TASKS, 'readiness']].entries()) {
    const { action } = parsed(next(planChange({ have })));
    seen.push(action);
    assert.equal(action.icon, changeLoopModule.stageIcon(action), `${action.stage}: the icon`);
    assert.equal(action.icon, STAGE_ICONS[action.stage], `${action.stage}: the table's icon`);
    assert.equal(action.sessionTitle, action.state.title, `${action.stage}: the title is the state's`);
    assert.equal(action.sessionTitle, wanted[i], `${action.stage}: the title`);
  }
  assert.ok(seen.some((a) => a.icon === '❓') && seen.some((a) => a.icon === '📝'), 'the grill and the plan stages');
  const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const done = parsed(next(archived, [], cleanEnv, { openspec: () => ({ status: 1, stdout: '', stderr: '' }), gh: () => ({ status: 1, stdout: '', stderr: '' }) })).action;
  assert.deepEqual([done.icon, done.sessionTitle], ['📦', '📦 feat'], 'an archived end');
  // An action with no stage has no icon; its title is the state's alone.
  const previous = parsed(next(planChange({ have: ['requirements', 'proposal'], headerless: true }))).action;
  assert.equal(previous.icon, null);
  assert.equal(previous.sessionTitle, '⛔ feat');
});

test('followups AC-14 title: sessionTitle is the icon and the id, cut under 60 code points', () => {
  assert.equal(changeLoopModule.sessionTitle('📝', 'a'), '📝 a');
  const long = changeLoopModule.sessionTitle('🛠️', 'x'.repeat(70));
  assert.equal([...long].length, 59, 'a 70-character id is cut to 59 code points');
  assert.ok(long.startsWith('🛠️ xxx'));
  const exact = changeLoopModule.sessionTitle('📝', 'x'.repeat(57));
  assert.equal([...exact].length, 59);
  assert.equal(exact, `📝 ${'x'.repeat(57)}`, 'under 60 stays whole');
  assert.equal([...changeLoopModule.sessionTitle('📝', 'x'.repeat(58))].length, 59, 'at 60 it is cut');
});

// ================================================================ roadmap-sessions-upfront, phase 2: the wait loop of a change session (design D-6)

test('upfront AC-9 waitLoop: a given predicate keeps waiting while it holds and failWhy names the end', async () => {
  const held = (why, reply) => ({ version: 1, change: 'feat', script: 'devkit', root: '/w', branch: 'feat', filesLanguage: 'en', kind: 'held', held: { why }, stage: 'implementation', reply, progressKey: `held/${why}` });
  const done = { version: 1, change: 'feat', kind: 'agent', stage: 'implementation', progressKey: 'implementation/implement@abc' };
  const waiting = (a) => a.kind === 'held';
  // A held decision that only changes its words (the load moves every poll) keeps the wait; a new reason or a new action ends it.
  const sleeps = [];
  let polls = 0;
  const script = [held('load', 'load 91%'), held('load', 'load 88%'), held('load', 'load 85%'), done];
  const kept = await waitLoop({ poll: async () => script[polls++], sleep: async (s) => { sleeps.push(s); }, interval: 60, id: 'feat', lang: 'en', waiting });
  assert.deepEqual(kept, done);
  assert.equal(polls, 4);
  assert.deepEqual(sleeps, [60, 60, 60]);
  const changed = [held('place', 'a'), held('place', 'b'), held('load', 'c')];
  let n = 0;
  const reason = await waitLoop({ poll: async () => changed[n++], sleep: async () => {}, interval: 60, id: 'feat', lang: 'en', waiting });
  assert.equal(reason.held.why, 'load', 'a new reason to wait ends the wait');
  // A first decision that is not a wait comes back at once.
  assert.deepEqual(await waitLoop({ poll: async () => done, sleep: async () => { throw new Error('slept'); }, interval: 60, id: 'feat', lang: 'en', waiting }), done);
  // Three failed polls in a row end it blocked with the reason the caller names; the default stays the GitHub one.
  const failing = async () => { throw new Error('boom'); };
  const calls = [];
  const first = async () => { calls.push('first'); return held('place', 'a'); };
  let k = 0;
  const poll = async () => (k++ === 0 ? first() : failing());
  const blocked = await waitLoop({ poll, sleep: async () => {}, interval: 60, id: 'feat', lang: 'en', waiting, failWhy: 'unreadable' });
  assert.deepEqual([blocked.kind, blocked.end.state, blocked.end.why], ['end', 'blocked', 'unreadable']);
  assert.match(blocked.reply, /boom/);
  let j = 0;
  const gh = await waitLoop({ poll: async () => (j++ === 0 ? WAIT : failing()), sleep: async () => {}, interval: 60, id: 'feat', lang: 'en' });
  assert.equal(gh.end.why, 'github-unreadable', 'the default end is the GitHub one');
});

// ================================================================ roadmap-sessions-upfront, phase 3: a lone change schedules nothing (design D-9, AC-16)

test('upfront AC-16 next: no action of a change run asks for a schedule', () => {
  const actions = [
    run({ rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file') } }),
    run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } } }),
    run({ rep: { end: endOf('waiting-for-owner', 'requirements', 'owner-pending') } }),
    build(rowOf('implement', { phase: 1 })),
    build(rowOf('review', { reviewers: ['code-quality-reviewer'], round: 1 })),
    build(rowOf('retro')),
    build(rowOf('wait-checks', { pending: ['build'] })),
    build(rowOf('wait-merge', { number: 12 })),
    run({ report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } }),
    run({ rep: { end: endOf('blocked', 'delivery', 'pr-closed', { number: 12 }) }, facts: { row: rowOf('implement', { phase: 1 }) } }),
  ];
  assert.ok(new Set(actions.map((a) => a.kind)).size >= 4, 'the fixtures cover every kind of action');
  for (const a of actions) {
    assert.ok(!['schedule-check', 'delete-check', 'push', 'triage', 'archive-session', 'stop-own-tasks'].includes(a.kind), a.kind);
    assert.doesNotMatch(JSON.stringify(a), /schedule-check|CronCreate|CronDelete|wake_when_done|"cron"|"recurring"/, a.kind);
  }
});

// ================================================================ roadmap-sessions-upfront, phase 4: the triage and the drift (design D-4, D-10, AC-5, AC-6, AC-11)

const triageUnsourced = (text) => changeLoopModule.triageUnsourced(text);
const TRIAGE_HEAD = '### Answered by triage';
const SRC = '(source: `docs/adr/0013-x.md:12`)';

// Invariant (AC-6, change-loop, change-loop): the requirements stage passed with a triage answer that names no source goes
// back to its grill, which names the question; a file whose triage answers all name theirs leaves the plan going.
test('upfront AC-6 triage: an answer under the triage heading with no source sends the change back to its grill naming it', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const file = join(root, 'openspec', 'changes', 'feat', 'requirements.md');
  const header = readFileSync(file, 'utf8').split('\n')[0];
  const write = (body) => { put(root, { 'openspec/changes/feat/requirements.md': `${header}\n# requirements\n\n${body}\n` }); commitAll(root, 'triage answers'); };
  write(`${TRIAGE_HEAD}\n\n1. [scope] May it use a cron? → yes\n2. [edges] Is it atomic? → yes ${SRC}\n`);
  const r = next(root);
  assert.equal(r.code, 0, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.stage, action.role], ['grill', 'requirements', 'change-coordinator']);
  assert.deepEqual(action.detail, { unsourced: ['[scope] May it use a cron? → yes'] }, 'only the question with no source, named');
  write(`${TRIAGE_HEAD}\n\n1. [edges] Is it atomic? → yes ${SRC}\n`);
  const sourced = parsed(next(root)).action;
  assert.deepEqual([sourced.kind, sourced.agent], ['agent', PLANNER], 'every answer names its source: the plan goes on');
});

test('upfront AC-6 triage: decide gives the grill only in the plan part, only when the requirements stage passed and only for a non-empty list', () => {
  const rep = { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } };
  const grill = run({ rep, facts: { unsourced: ['q'] } });
  assert.deepEqual([grill.kind, grill.stage, grill.detail, exitCodeOf(grill)], ['grill', 'requirements', { unsourced: ['q'] }, 0]);
  assert.equal(grill.progressKey, `requirements/requirements@abc123`);
  assert.equal(run({ rep, facts: { unsourced: [] } }).kind, 'agent', 'an empty list');
  assert.equal(run({ rep, facts: {} }).kind, 'agent', 'no list');
  const inBuild = build(rowOf('implement', { phase: 1 }), { unsourced: ['q'] });
  assert.deepEqual([inBuild.kind, inBuild.step], ['agent', 'implement'], 'from the implementation on the list is not read');
  const notPassed = run({ rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file'), stages: { requirements: { state: 'pending', reasonCode: 'no-file' } } }, facts: { unsourced: ['q'] } });
  assert.deepEqual([notPassed.kind, notPassed.detail], ['grill', undefined], 'a grill that was already due carries no list');
});

test('upfront AC-6 triage: the heading\'s end, an unclosed fence, an item over indented lines, no heading and an empty section', () => {
  // the section runs to the next heading of level 1 to 3, or to the end of the file
  assert.deepEqual(triageUnsourced(`# R\n\n${TRIAGE_HEAD}\n\n1. a\n2. b ${SRC}\n\n## Next\n\n3. c\n`), ['a'], 'a level 2 heading ends it');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n- a\n\n# Top\n- b\n`), ['a'], 'a level 1 heading ends it');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n- a\n\n### Other\n- b\n`), ['a'], 'a level 3 heading ends it');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n- a\n\n#### Detail\n- b\n`), ['a', 'b'], 'a level 4 heading does not');
  assert.deepEqual(triageUnsourced(`## Before\n- x\n\n${TRIAGE_HEAD}\n- a`), ['a'], 'the heading last in the file, with no newline: read to the end; items before it are not read');
  // bullets and numbers both are items
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n* a\n+ b\n3) c\n4. d\n`), ['a', 'b', 'c', 'd']);
  // fenced lines are not answers, with backticks or tildes, three or more
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\`\`\`\n1. in fence\n\`\`\`\n2. out\n`), ['out']);
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n~~~~\n1. in fence\n~~~~\n2. out\n`), ['out']);
  // an unclosed fence skips to the end
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n1. before\n\`\`\`\n2. in fence\n## Next\n3. still in fence\n`), ['before']);
  // an item continues over its indented lines: a source there counts, and the item is named whole
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n1. a question\n   answered here ${SRC}\n2. other\n   and more\n3. last ${SRC}\n`), ['other and more']);
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n1. a\n\n   after a blank line\n`), ['a'], 'a blank line ends the item');
  // text that is no item is no answer
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\nplain prose with no marker\n`), []);
  // no heading, another heading, a heading of another level, an empty section
  assert.deepEqual(triageUnsourced('# R\n\n1. a\n- b\n'), [], 'no heading');
  assert.deepEqual(triageUnsourced('### Answered by the owner\n\n1. a\n'), [], 'another heading');
  assert.deepEqual(triageUnsourced('## Answered by triage\n\n1. a\n'), [], 'the heading is level 3');
  assert.deepEqual(triageUnsourced(`${TRIAGE_HEAD}\n\n## Next\n1. a\n`), [], 'an empty section');
  assert.deepEqual(triageUnsourced(''), []);
  assert.deepEqual(triageUnsourced(`    ${TRIAGE_HEAD}\n1. a\n`), [], 'an indented heading is no heading');
});

// Invariant (AC-6, review round 1 architecture F2): one reader decides whether a requirements file holds the triage section and what its items are,
// for the loop and for the periodic check alike. Layer: triageSection and hasTriageSection. Suite: change-loop.
test('upfront AC-6 triage: triageSection and hasTriageSection read the one section, a fenced or suffixed heading being none', () => {
  const { triageSection, hasTriageSection } = changeLoopModule;
  assert.deepEqual(triageSection(`# R\n\n${TRIAGE_HEAD}\n\n1. a\n2. b ${SRC}\n\n## Next\n\n3. c\n`), ['a', `b ${SRC}`], 'every item of the section, sourced or not');
  assert.deepEqual(triageSection(`${TRIAGE_HEAD}\n\n## Next\n1. a\n`), [], 'an empty section is a section');
  assert.deepEqual(triageSection(`${TRIAGE_HEAD}\n1. a question\n   answered ${SRC}\n`), [`a question answered ${SRC}`], 'an item over its indented lines');
  assert.deepEqual(triageSection(`\`\`\`\nfenced\n\`\`\`\n${TRIAGE_HEAD}\n1. a\n`), ['a'], 'a heading after a closed fence is found');
  for (const [name, text] of Object.entries({
    'no heading': '# R\n\n1. a\n',
    'a heading inside a backtick fence': `\`\`\`md\n${TRIAGE_HEAD}\n1. a ${SRC}\n\`\`\`\n`,
    'a heading inside a tilde fence': `~~~\n${TRIAGE_HEAD}\n1. a\n~~~\n`,
    'a heading inside an unclosed fence': `\`\`\`\n${TRIAGE_HEAD}\n1. a\n`,
    'a heading with words after it': `${TRIAGE_HEAD} (draft)\n\n1. a ${SRC}\n`,
    'a heading of level 2': '## Answered by triage\n\n1. a\n',
    'an indented heading': `    ${TRIAGE_HEAD}\n1. a\n`,
    'another heading': '### Answered by the owner\n\n1. a\n',
    'an empty file': '',
  })) {
    assert.equal(triageSection(text), null, name);
    assert.equal(hasTriageSection(text), false, name);
    assert.deepEqual(triageUnsourced(text), [], `${name}: nothing unsourced either`);
  }
  assert.equal(hasTriageSection(`${TRIAGE_HEAD}\n`), true, 'the plain heading alone');
  assert.equal(hasTriageSection(`${TRIAGE_HEAD}  \t\n`), true, 'trailing blanks are allowed');
  const text = `${TRIAGE_HEAD}\n1. a\n2. b ${SRC}\n`;
  assert.deepEqual(triageUnsourced(text), triageSection(text).filter((item) => !item.includes('(source: ')), 'the loop\'s list is the section\'s items with no source');
});

test('upfront AC-5 triage: the agent file has the name, a description that says when, the tools Read, Glob and Grep only, and the Never rules', () => {
  const a = assetOf('plugins/core/agents/requirements-triage.md');
  assert.equal(a.name, 'requirements-triage');
  assert.match(a.description, /\bUse when\b/);
  assert.match(a.description, /requirements-grill/);
  assert.deepEqual(a.tools, ['Read', 'Glob', 'Grep']);
  assert.equal(a.model, 'sonnet');
  for (const h of ['## Receives', '## Method', '## Returns', '## Never']) assert.ok(a.text.includes(h), h);
  assert.ok(a.text.includes('answered: <answer> (source: `<path>[:<line>]`)'), 'the answered form');
  assert.ok(a.text.includes('owner: <why nothing written settles it>'), 'the owner form');
  const never = neverOf(a.text);
  for (const re of [/write or edit any file/i, /own judgement/i, /plan approval/i, /retro answer/i]) assert.match(never, re, String(re));
});

test('upfront AC-5 triage: requirements-triage is a helper of the requirements stage of both scripts, in both schema copies, and PACKS ships it in devkit-core', () => {
  for (const dir of ['plugins/openspec/schemas', 'openspec/schemas']) {
    for (const script of ['devkit', 'devkit-lite']) {
      const flow = JSON.parse(readRepo(...dir.split('/'), script, 'flow.json'));
      const stage = flow.stages.find((s) => s.id === 'requirements');
      assert.deepEqual(stage.helpers, ['codebase-researcher', 'requirements-triage'], `${dir}/${script}`);
    }
  }
  for (const script of ['devkit', 'devkit-lite']) assert.ok(scriptAgentsOf(FLOWS[script]).includes('requirements-triage'), script);
  assert.equal(PACKS['requirements-triage'], 'devkit-core');
  assert.match(readRepo('docs', 'roles.md'), /## requirements-triage\n[\s\S]*?- Played today by: The agent `devkit-core:requirements-triage`/);
});
const scriptAgentsOf = (flow) => changeLoopModule.scriptAgents(flow);

// The change `feat` of `root` records `x-devkit-flow: <pin>` (none for null), as a change opened with that flow does; committed.
function pinFeat(root, pin) {
  const file = join(root, 'openspec', 'changes', 'feat', '.openspec.yaml');
  put(root, { 'openspec/changes/feat/.openspec.yaml': `${readFileSync(file, 'utf8')}${pin === null ? '' : `x-devkit-flow: ${pin}\n`}` });
  commitAll(root, `feat follows flow ${pin}`);
  return root;
}

// Invariant (T-18, D-13: a change run may hand the triage to a change whose flow lists it, with no prefix or devkit-core's). Layer: the `agent` lock, H3.
// Suite: change-loop. Its scratch changes record flow 2, as an open with this release does; with no pin they follow flow 1, which does not list the triage (D-17).
test('upfront AC-5 triage: a change run may hand devkit-core:requirements-triage', () => {
  const transcript = runTranscript();
  for (const root of [pinFeat(liteChange(), 2), pinFeat(approvedChange(), 2)]) {
    for (const type of ['devkit-core:requirements-triage', 'requirements-triage']) {
      const r = hook('agent', agentInput(root, transcript, type));
      assert.equal(r.code, 0, `${type}: ${r.err}`);
    }
    assert.equal(hook('agent', agentInput(root, transcript, 'devkit-openspec:requirements-triage')).code, 2, 'another pack\'s prefix is refused');
  }
});

// ---- phase 8: the triage ships as flow version 2 of devkit and devkit-lite (design D-17, AC-5)

const FLOW_DIRS = [['plugins', 'openspec', 'schemas'], ['openspec', 'schemas']];
const TRIAGE_SCRIPTS = ['devkit', 'devkit-lite'];
const digestOfFile = (...p) => `sha256:${createHash('sha256').update(readFileSync(join(REPO_ROOT, ...p))).digest('hex')}`;
const helpersOf = (flow) => flow.stages.find((s) => s.id === 'requirements').helpers;

// Invariant (AC-5, D-17): the triage is a helper of the grill from flow version 2 of both scripts, in both schema copies, and the kept
// flows/2.json is the installed flow.json byte for byte. Layer: the flow files. Suite: change-loop.
test('upfront AC-5 flow: version 2 of devkit and devkit-lite names requirements-triage among the grill\'s helpers in both copies, and flows/2.json is flow.json', () => {
  for (const dir of FLOW_DIRS) {
    for (const script of TRIAGE_SCRIPTS) {
      const where = `${dir[0]}/${script}`;
      const text = readRepo(...dir, script, 'flow.json');
      const flow = JSON.parse(text);
      assert.equal(flow.version, 2, `${where}: flow.json is version 2`);
      assert.deepEqual(helpersOf(flow), ['codebase-researcher', 'requirements-triage'], `${where}: the grill's helpers`);
      assert.ok(existsSync(join(REPO_ROOT, ...dir, script, 'flows', '2.json')), `${where}: flows/2.json exists`);
      assert.equal(readRepo(...dir, script, 'flows', '2.json'), text, `${where}: flows/2.json is flow.json`);
    }
  }
});

// Invariant (AC-5, D-17 x change-version-pin D-2): a released version never changes: flows/1.json of both scripts is version 1 as released,
// with no triage, and devkit-project, whose content did not change, stays at version 1. Layer: the flow files and the released digests. Suite: change-loop.
test('upfront AC-5 flow: flows/1.json of devkit and devkit-lite is released version 1, without requirements-triage, and devkit-project stays at version 1', () => {
  const released = JSON.parse(readRepo('scripts', 'released-flows.json'));
  for (const dir of FLOW_DIRS) {
    for (const script of TRIAGE_SCRIPTS) {
      const where = `${dir[0]}/${script}`;
      const one = JSON.parse(readRepo(...dir, script, 'flows', '1.json'));
      assert.equal(one.version, 1, `${where}: flows/1.json is version 1`);
      assert.deepEqual(helpersOf(one), ['codebase-researcher'], `${where}: version 1 has no triage`);
      assert.equal(digestOfFile(...dir, script, 'flows', '1.json'), released[script]['1'], `${where}: the digest of version 1 is the released one`);
    }
    const project = JSON.parse(readRepo(...dir, 'devkit-project', 'flow.json'));
    assert.equal(project.version, 1, `${dir[0]}/devkit-project: flow.json stays at version 1`);
    assert.equal(existsSync(join(REPO_ROOT, ...dir, 'devkit-project', 'flows', '2.json')), false, `${dir[0]}/devkit-project: no flows/2.json`);
  }
  assert.deepEqual(Object.keys(released['devkit-project']), ['1'], 'devkit-project records version 1 only');
});

// Invariant (AC-5, D-17 x change-version-pin D-8): scripts/released-flows.json records the digest of each released version, the one
// scripts/check.py#flow_digest computes. Layer: the released digests. Suite: change-loop.
test('upfront AC-5 flow: released-flows.json records the digest of flows/2.json of devkit and devkit-lite', () => {
  const released = JSON.parse(readRepo('scripts', 'released-flows.json'));
  for (const script of TRIAGE_SCRIPTS) {
    assert.ok(existsSync(join(REPO_ROOT, 'plugins', 'openspec', 'schemas', script, 'flows', '2.json')), `${script}: flows/2.json exists`);
    const digest = digestOfFile('plugins', 'openspec', 'schemas', script, 'flows', '2.json');
    assert.match(digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(released[script]['2'], digest, `${script}: the recorded digest of version 2`);
    assert.equal(digestOfFile('openspec', 'schemas', script, 'flows', '2.json'), digest, `${script}: the openspec/schemas copy is the same bytes`);
  }
});

// A project with the tree's schemas and one `devkit` change per pin of `pins` ({ id: flow | null }); `files` of `(id, c0)` are written
// into each change's folder before the one commit. Returns the root.
function pinnedProject(pins, files = () => ({})) {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD');
  for (const [id, pin] of Object.entries(pins)) {
    put(root, {
      [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\n${pin === null ? '' : `x-devkit-flow: ${pin}\n`}`,
      ...Object.fromEntries(Object.entries(files(id, c0)).map(([f, b]) => [`openspec/changes/${id}/${f}`, b])),
    });
  }
  commitAll(root, 'changes');
  return root;
}
const actionOfChange = (root, id) => {
  const r = main(['next', '--change', id, '--lang', 'en'], { cwd: root, env: cleanEnv });
  assert.equal(r.code, 0, `${id}: ${r.stdout}${r.stderr}`);
  return actionOf(r.stdout);
};
const PINS = { none: null, one: 1, two: 2 };
const WITH_TRIAGE = ['codebase-researcher', 'requirements-triage'];
const WITHOUT_TRIAGE = ['codebase-researcher'];

// Invariant (AC-5, D-17): the grill action names the helpers of the requirements stage of the flow the change follows, so the triage is
// offered to a change on flow 2 only: none with no pin or on flow 1, until `flow <id>` moves it. The grill sent back by an unsourced triage
// answer says the same, and no other action carries `helpers`. Layer: decide (planPart) through next. Suite: change-loop.
test('upfront AC-5 triage: the grill of a change on flow 1 names no triage helper and that of a change on flow 2 names it', () => {
  const root = pinnedProject(PINS);
  for (const [id, expected] of [['none', WITHOUT_TRIAGE], ['one', WITHOUT_TRIAGE], ['two', WITH_TRIAGE]]) {
    const action = actionOfChange(root, id);
    assert.deepEqual([action.kind, action.stage], ['grill', 'requirements'], id);
    assert.deepEqual(action.helpers, expected, `${id}: the helpers of its flow's grill`);
  }
  // a change on flow 1 moved by the owner's command follows flow 2 and gets the triage
  const moved = main(['flow', 'one', '--lang', 'en'], { cwd: root, env: cleanEnv });
  assert.equal(moved.code, 0, moved.stdout + moved.stderr);
  assert.deepEqual(actionOfChange(root, 'one').helpers, WITH_TRIAGE, 'the moved change');
  assert.deepEqual(actionOfChange(root, 'none').helpers, WITHOUT_TRIAGE, 'a change nobody moved');
  // the grill sent back by a triage answer with no source carries the helpers of its flow too, and only grill actions carry them
  const unsourced = pinnedProject(PINS, (id, c0) => ({
    'requirements.md': `${head('requirements', c0)}# Requirements\n\n${TRIAGE_HEAD}\n\n1. [scope] May it use a cron? → yes\n`,
  }));
  for (const [id, expected] of [['none', WITHOUT_TRIAGE], ['one', WITHOUT_TRIAGE], ['two', WITH_TRIAGE]]) {
    const action = actionOfChange(unsourced, id);
    assert.deepEqual([action.kind, action.detail], ['grill', { unsourced: ['[scope] May it use a cron? → yes'] }], id);
    assert.deepEqual(action.helpers, expected, `${id}: the grill sent back`);
  }
  const sourced = pinnedProject({ two: 2 }, (id, c0) => ({ 'requirements.md': `${head('requirements', c0)}# Requirements\n` }));
  const agentAction = actionOfChange(sourced, 'two');
  assert.deepEqual([agentAction.kind, 'helpers' in agentAction], ['agent', false], 'an agent action has no helpers key');
});

// Invariant (AC-5, D-17): the change run's hand-off lock reads the roles of the flow the change follows: the triage is a role of a change on
// flow 2 and not of one on flow 1 (or with no pin), which gets the label not-a-role; the grill's other helper stays one. Layer: the agent lock, H3,
// through a real guard.mjs agent process. Suite: change-loop.
test('upfront AC-5 lock agent: a change run on flow 1 refuses devkit-core:requirements-triage as not-a-role, and one on flow 2 allows it', () => {
  const transcript = runTranscript();
  const tmp = sandbox();
  const log = join(sandbox(), 'hooks.jsonl');
  const call = (root, type) => hook('agent', agentInput(root, transcript, type), { TMPDIR: tmp, DEVKIT_HOOK_LOG: log });
  for (const make of [liteChange, approvedChange]) {
    for (const pin of [null, 1]) {
      const root = pinFeat(make(), pin);
      for (const type of ['devkit-core:requirements-triage', 'requirements-triage']) {
        const r = call(root, type);
        assert.equal(r.code, 2, `${type} on flow ${pin ?? 'none'}: ${r.err}`);
        assert.match(r.err, /is not one of them/);
        assert.doesNotMatch(r.err.split(';')[0], /requirements-triage/, 'the roles the refusal lists do not include the triage');
      }
      assert.equal(call(root, 'devkit-core:codebase-researcher').code, 0, `the grill's other helper stays allowed on flow ${pin ?? 'none'}`);
    }
    const two = pinFeat(make(), 2);
    for (const type of ['devkit-core:requirements-triage', 'requirements-triage']) {
      const r = call(two, type);
      assert.equal(r.code, 0, `${type} on flow 2: ${r.err}`);
    }
  }
  const records = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual([...new Set(records.filter((r) => r.decision === 'refuse').map((r) => r.why))], ['not-a-role'], 'every refusal is labelled not-a-role');
  assert.equal(records.filter((r) => r.decision === 'refuse').length, 8);
});

// Invariant (AC-5, D-17): the skills hand the drafted questions to the triage only when the loop's grill action names it in `helpers`, each
// naming where it reads the permission, and ask the owner every question otherwise. Layer: skill text. Suite: change-loop.
test('upfront AC-5 skill: the grill skill and the devkit skill hand the triage only when the grill action\'s helpers name it', () => {
  const grill = readRepo('plugins', 'core', 'skills', 'requirements-grill', 'SKILL.md');
  const step = grill.slice(grill.indexOf('### 2b. Triage first'), grill.indexOf('### 3. Grill on the four axes')).replace(/\s+/g, ' ');
  const devkit = readRepo('plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
  const item = devkit.split('\n').find((l) => l.startsWith('- `grill`:')).replace(/\s+/g, ' ');
  const triageItem = devkit.split('\n').find((l) => l.startsWith('- `triage`:')).replace(/\s+/g, ' ');
  for (const [name, text] of [['step 2b of the grill skill', step], ['the grill item of the devkit skill', item]]) {
    assert.match(text, /`helpers`[^.]*`requirements-triage`/, `${name}: the helpers name the triage`);
    assert.ok(text.includes('every question goes to the owner, one at a time'), `${name}: with no permission the owner is asked every question`);
    assert.ok(text.includes('`ask.action`'), `${name}: the coordinating session reads ask.action`);
    assert.match(text, /`next` \(or `session-next`\)/, `${name}: the action a lone change or a change session reads`);
  }
  assert.match(step, /`triage` action[^.]*only for a grill whose `helpers` name/, 'step 2b: the check\'s triage action carries no helpers and is given only for a grill that names them');
  assert.match(triageItem, /`helpers`/, 'the triage item says the check gives it only for a grill whose helpers name the triage');
});

test('upfront AC-11 next: a requirements file set back to pending after the proposal gives the grill', () => {
  const root = planChange({ have: ['requirements', 'decisions', 'proposal'], results: { requirements: 'pending' }, attempts: { requirements: 2 } });
  const r = next(root);
  assert.equal(r.code, 0, r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.stage, action.role], ['grill', 'requirements', 'change-coordinator']);
});

test('upfront AC-11 delivery: renumber-adr is a hand-off of the implementer, with the files in its detail', () => {
  assert.ok(ROW_STEPS.includes('renumber-adr'));
  const files = [{ from: 'docs/adr/0016-a.md', to: 'docs/adr/0018-a.md', number: '0018' }];
  const a = build(rowOf('renumber-adr', { files, agent: TDD }));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role, exitCodeOf(a)], ['agent', TDD, 'renumber-adr', 'implementation', 'tdd-implementer', 0]);
  assert.deepEqual(a.detail.files, files);
  assert.equal(a.progressKey, 'implementation/renumber-adr@abc123');
});

// ---------------------------------------------------------------- remote-worker: the claim at open (phase 1)

// The claim commits, so the tests carry an identity of their own, as deliver-check.test.mjs does for its helpers.
const IDENT = { GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid', GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid' };
for (const [k, v] of Object.entries(IDENT)) process.env[k] ??= v;

// The "other machine": a second clone of the same bare remote.
function otherClone(t) {
  const dir = tmpFolder('devkit-change-loop-machine-');
  const clone = join(dir, 'clone');
  git(dir, 'clone', '-q', t.originDir, clone);
  mkdirSync(join(clone, 'openspec', 'changes', 'archive'), { recursive: true }); // git keeps no empty folder: the project's change folder
  return realpathSync(clone);
}
const openOn = (cwd, id, machine, extra = {}) => openChange(cwd, id, { script: 'devkit', why: 'doubt', request: 'Add a thing\n', lang: 'en', env: cleanEnv, machine, ...extra });
const claimOnOrigin = (t, id) => git(t.main, 'ls-remote', 'origin', `refs/heads/${id}`).split('\t')[0];
const localHostname = () => hostname().split('.')[0].replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 64) || 'machine';
const yamlOf = (wt, id) => readFileSync(join(wt, 'openspec', 'changes', id, '.openspec.yaml'), 'utf8');
// What an open that is refused leaves: nothing local (the remote-tracking refs may have moved with the fetch).
const localLeft = (t, id) => ({
  folders: existsSync(join(t.main, 'openspec', 'changes', id)) || existsSync(join(wtOf(t, id), 'openspec')),
  wt: existsSync(wtOf(t, id)),
  branch: git(t.main, 'branch', '--list', id),
  worktrees: git(t.main, 'worktree', 'list', '--porcelain'),
});
const refusal = (e) => e?.name === 'LoopRefusal';

test('remote AC-1 open: a branch on origin with a claim refuses the open, naming its machine, and creates nothing', () => {
  const t = freshProject();
  const clone = otherClone(t);
  openOn(clone, 'shared-thing', 'avel');
  git(t.main, 'fetch', '-q', 'origin');
  const before = localLeft(t, 'shared-thing');
  const snap = snapshot(t.main);
  const r = openRun(t.main, 'shared-thing');
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  assert.equal(body(r).reply, render('en', 'claimed', { id: 'shared-thing', machine: 'avel' }));
  assert.match(body(r).reply, /avel/);
  assert.equal(snapshot(t.main), snap, 'nothing was created: branches, worktrees and folders are as they were');
  assert.deepEqual(localLeft(t, 'shared-thing'), before);
  assert.equal(git(t.main, 'branch', '--list', 'shared-thing'), '', 'no refs/heads/shared-thing');
  assert.equal(body(openRun(t.main, 'shared-thing', { lang: 'pt-BR' })).reply, render('pt-BR', 'claimed', { id: 'shared-thing', machine: 'avel' }));
});

test('remote AC-1 open: a claim with no machine says another machine', () => {
  const t = freshProject();
  const clone = otherClone(t);
  git(clone, 'checkout', '-q', '-b', 'old-claim');
  put(clone, { 'openspec/changes/old-claim/.openspec.yaml': 'schema: devkit\n', 'openspec/changes/old-claim/requirements.md': 'x\n' });
  commitAll(clone, 'a branch from before the claim');
  git(clone, 'push', '-q', 'origin', 'old-claim');
  git(t.main, 'fetch', '-q', 'origin');
  const snap = snapshot(t.main);
  const r = openRun(t.main, 'old-claim');
  assert.equal(r.code, 3, r.stdout + r.stderr);
  assert.equal(body(r).reply, render('en', 'claimed-elsewhere', { id: 'old-claim' }));
  assert.match(body(r).reply, /another machine/);
  assert.equal(snapshot(t.main), snap);
  assert.equal(git(t.main, 'branch', '--list', 'old-claim'), '');
});

test('remote AC-2 open: the claim on origin holds requirements.md and the machine, with machines unset', () => {
  const t = freshProject();
  const r = openRun(t.main, 'claim-me', { script: 'devkit-lite', why: 'small' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const wt = wtOf(t, 'claim-me');
  const sha = claimOnOrigin(t, 'claim-me');
  assert.match(sha, /^[0-9a-f]{40}$/, 'origin has the branch');
  assert.equal(git(wt, 'rev-parse', 'HEAD'), sha, 'the local branch is the claim');
  assert.equal(git(wt, 'log', '-1', '--format=%s'), 'chore(openspec): open claim-me');
  const files = git(wt, 'show', '--name-only', '--format=', 'HEAD').split('\n');
  assert.ok(files.includes('openspec/changes/claim-me/requirements.md'), files.join());
  assert.ok(files.includes('openspec/changes/claim-me/.openspec.yaml'), files.join());
  assert.match(git(t.main, 'show', `${sha}:openspec/changes/claim-me/.openspec.yaml`), new RegExp(`^x-devkit-machine: ${localHostname()}$`, 'm'));
  assert.equal(/x-devkit-places/.test(yamlOf(wt, 'claim-me')), false, 'no places without a roadmap run');
  assert.match(yamlOf(wt, 'claim-me'), /^schema: devkit-lite$/m);
  assert.equal(git(wt, 'status', '--porcelain'), '', 'the claim left nothing uncommitted');
});

test('remote AC-2 open: a remote open claims for that machine and leaves no local worktree or branch', () => {
  const t = freshProject();
  const r = openRun(t.main, 'for-avel', { args: ['--script', 'devkit', '--why', 'doubt', '--machine', 'avel', '--places', '2', '--remote'] });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const b = JSON.parse(r.stdout.split('\n').slice(1).join('\n'));
  assert.equal(b.worktree, null);
  assert.equal(b.reply, render('en', 'opened-on', { id: 'for-avel', machine: 'avel', script: 'devkit', why: 'doubt' }));
  const sha = claimOnOrigin(t, 'for-avel');
  assert.match(sha, /^[0-9a-f]{40}$/);
  const yaml = git(t.main, 'show', `${sha}:openspec/changes/for-avel/.openspec.yaml`);
  assert.match(yaml, /^x-devkit-machine: avel$/m);
  assert.match(yaml, /^x-devkit-places: 2$/m);
  assert.equal(git(t.main, 'show', `${sha}:openspec/changes/for-avel/requirements.md`).includes('> Add a CSV export'), true);
  assert.equal(git(t.main, 'branch', '--list', 'for-avel'), '');
  assert.equal(existsSync(wtOf(t, 'for-avel')), false);
  assert.equal(git(t.main, 'worktree', 'list', '--porcelain').includes('for-avel'), false);
  assert.equal(existsSync(join(t.main, 'openspec', 'changes', 'for-avel')), false);
});

test('remote AC-2 open: a machine name or a places value that is not valid is a usage error and creates nothing', () => {
  const t = freshProject();
  const base = ['--script', 'devkit', '--why', 'doubt'];
  const cases = {
    'a name starting with a dash': ['--machine', '-avel'],
    'a name with a space': ['--machine', 'my mac'],
    'a name of 65 characters': ['--machine', 'a'.repeat(65)],
    'places 0': ['--machine', 'avel', '--places', '0'],
    'places 100': ['--machine', 'avel', '--places', '100'],
    'places 1.5': ['--machine', 'avel', '--places', '1.5'],
    'places a word': ['--machine', 'avel', '--places', 'two'],
    'a remote open with no machine': ['--remote'],
  };
  const snap = snapshot(t.main);
  for (const [label, extra] of Object.entries(cases)) {
    const r = openRun(t.main, 'bad-claim', { args: [...base, ...extra] });
    assert.equal(r.code, 3, `${label}: ${r.stdout}`);
    assert.equal(r.stdout.startsWith('devkit-run:'), false, label);
    assert.equal(body(r).reply, render('en', 'request-unreadable'), label);
    assert.equal(snapshot(t.main), snap, `${label}: no worktree, folder or branch`);
    assert.equal(claimOnOrigin(t, 'bad-claim'), '', `${label}: nothing pushed`);
  }
  assert.equal(openRun(t.main, 'good-claim', { args: [...base, '--machine', 'a'.repeat(64), '--places', 'run'] }).code, 0, '64 characters and places run are valid');
});

test('remote AC-3 open: the clone that pushes second is refused and leaves nothing', () => {
  const t = freshProject();
  const clone = otherClone(t);
  let winner;
  let refused = null;
  try { openOn(t.main, 'race-id', 'mac', { beforePush: () => { winner = openOn(clone, 'race-id', 'avel'); } }); } catch (e) { refused = e; }
  assert.ok(winner, 'the other clone opened between the check and the push');
  assert.ok(refusal(refused), `the second push is refused: ${refused}`);
  assert.equal(refused.reply, render('en', 'claimed', { id: 'race-id', machine: 'avel' }));
  assert.equal(claimOnOrigin(t, 'race-id'), git(winner.worktree, 'rev-parse', 'HEAD'), 'origin holds the winner\'s claim');
  const left = localLeft(t, 'race-id');
  assert.deepEqual([left.folders, left.wt, left.branch, left.worktrees.includes('race-id')], [false, false, '', false], 'nothing is left here');
});

const openChildOn = (cwd, id, machine) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [LOOP, 'open', id, '--script', 'devkit', '--why', 'doubt', '--lang', 'en', '--machine', machine], { cwd, env: { ...cleanEnv, ...IDENT }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
  child.stdin.end('Add a thing\n');
});

test('remote AC-3 open: two clones opening one id at once, exactly one wins', async () => {
  const t = freshProject();
  const clone = otherClone(t);
  const [a, b] = await Promise.all([openChildOn(t.main, 'same-moment', 'mac'), openChildOn(clone, 'same-moment', 'avel')]);
  assert.deepEqual([a.code, b.code].sort(), [0, 3], `${a.stdout}\n${b.stdout}`);
  const [win, lose, winRoot, loseRoot, winName, loseName] = a.code === 0 ? [a, b, t.main, clone, 'mac', 'avel'] : [b, a, clone, t.main, 'avel', 'mac'];
  assert.equal(JSON.parse(lose.stdout).reply, render('en', 'claimed', { id: 'same-moment', machine: winName }), loseName);
  const sha = claimOnOrigin(t, 'same-moment');
  assert.equal(git(join(winRoot, '.claude', 'worktrees', 'same-moment'), 'rev-parse', 'HEAD'), sha, 'origin holds the winner\'s commit');
  assert.equal(win.code, 0);
  assert.equal(existsSync(join(loseRoot, '.claude', 'worktrees', 'same-moment')), false);
  assert.equal(existsSync(join(loseRoot, 'openspec', 'changes', 'same-moment')), false);
  assert.equal(git(loseRoot, 'branch', '--list', 'same-moment'), '');
});

test('remote AC-4 open: with no origin nothing is committed or pushed', () => {
  const root = devkitRepo();
  const before = git(root, 'rev-parse', 'HEAD');
  assert.equal(git(root, 'remote'), '');
  const r = openRun(root, 'no-origin', { script: 'devkit' });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const wt = join(root, '.claude', 'worktrees', 'no-origin');
  assert.equal(git(wt, 'rev-parse', 'HEAD'), before, 'no commit was made');
  assert.equal(git(wt, 'rev-list', '--count', 'HEAD'), git(root, 'rev-list', '--count', 'main'));
  assert.match(git(wt, 'status', '--porcelain'), /openspec\/changes/, 'the folder is left uncommitted, as before');
  assert.equal(/x-devkit-(machine|places)/.test(yamlOf(wt, 'no-origin')), false);
  assert.ok(existsSync(join(wt, 'openspec', 'changes', 'no-origin', 'requirements.md')));
  const named = openRun(root, 'no-origin-named', { args: ['--script', 'devkit', '--why', 'doubt', '--machine', 'avel', '--places', '2'] });
  assert.equal(named.code, 0, named.stdout + named.stderr);
  const namedWt = join(root, '.claude', 'worktrees', 'no-origin-named');
  assert.equal(git(namedWt, 'rev-parse', 'HEAD'), before, 'a machine name with no origin commits nothing either');
  assert.equal(/x-devkit-(machine|places)/.test(yamlOf(namedWt, 'no-origin-named')), false, 'and writes no claim key');
});

test('remote locks claims: the claims of a stale clone cost at most 8 gh calls, and none for the default branch', () => {
  const t = freshProject();
  const clone = otherClone(t);
  const ids = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  for (const id of ids) openOn(clone, id, 'avel');
  put(clone, { 'NEWS.md': 'news\n' });
  commitAll(clone, 'news on origin');
  git(clone, 'push', '-q', 'origin', 'main');
  const mainSha = git(clone, 'rev-parse', 'HEAD');
  assert.equal(git(t.main, 'ls-remote', '--heads', 'origin').split('\n').length, 7, 'six claims and main are on origin');
  assert.equal(git(t.main, 'branch', '--list', '--remotes', 'origin/c*'), '', 'this clone has not fetched them');

  const calls = [];
  const gh = (args, opts = {}) => {
    const route = args[1] ?? '';
    calls.push({ route, opts });
    if (/changes\/c\d\?/.test(route)) return { status: 0, stdout: JSON.stringify([{ name: '.openspec.yaml' }, { name: 'requirements.md' }]), stderr: '' };
    if (/changes\/c\d\/\.openspec\.yaml/.test(route)) return { status: 0, stdout: JSON.stringify({ encoding: 'base64', content: Buffer.from('schema: devkit\nx-devkit-machine: avel\n').toString('base64') }), stderr: '' };
    return { status: 1, stdout: '', stderr: 'not found' };
  };
  const result = changeLoopModule.remoteClaims(t.main, { env: cleanEnv, gh });
  assert.equal(result.readable, true);
  const claimCalls = calls.filter((c) => /changes\/c\d/.test(c.route));
  assert.ok(claimCalls.length >= 1 && claimCalls.length <= 8, `${claimCalls.length} gh calls`);
  assert.equal(calls.some((c) => c.route.includes(mainSha) || /changes\/main/.test(c.route)), false, 'the default branch is never read through gh');
  assert.ok(claimCalls.every((c) => c.opts.timeout === 4000), 'every call has its own timeout');
  assert.deepEqual([...result.claims.keys()].sort(), ids);
  assert.deepEqual(ids.slice(0, 4).map((id) => result.claims.get(id).machine), ['avel', 'avel', 'avel', 'avel'], 'the first four are read');
  assert.deepEqual(ids.slice(4).map((id) => result.claims.get(id).machine), [null, null], 'a branch the budget left unread reads as no claim');
});

test('remote locks claims: a listing with approval.md and a .openspec.yaml with places reads as placed with machine and places', () => {
  const t = freshProject();
  const clone = otherClone(t);
  openOn(clone, 'p1', 'avel');
  openOn(clone, 'p2', 'avel');
  openOn(clone, 'p3', 'avel');
  const yamls = {
    p1: 'schema: devkit\nx-devkit-machine: avel\nx-devkit-places: 2\n',
    p2: 'schema: devkit\nx-devkit-machine: avel\nx-devkit-places: run\n',
    p3: 'schema: devkit\nx-devkit-machine: avel\n',
  };
  const listing = { p1: ['.openspec.yaml', 'approval.md'], p2: ['.openspec.yaml', 'approval.md'], p3: ['.openspec.yaml', 'requirements.md'] };
  const gh = (args) => {
    const route = args[1] ?? '';
    const id = /changes\/(p\d)/.exec(route)?.[1];
    if (!id) return { status: 1, stdout: '', stderr: 'not found' };
    if (/\.openspec\.yaml/.test(route)) return { status: 0, stdout: JSON.stringify({ encoding: 'base64', content: Buffer.from(yamls[id]).toString('base64') }), stderr: '' };
    return { status: 0, stdout: JSON.stringify(listing[id].map((name) => ({ name }))), stderr: '' };
  };
  const result = changeLoopModule.remoteClaims(t.main, { env: cleanEnv, gh });
  assert.equal(result.readable, true);
  const read = (id) => { const c = result.claims.get(id); return [c.machine, c.places, c.placed]; };
  assert.deepEqual(read('p1'), ['avel', 2, true], 'an approval.md in the folder is a placed change, and a number of places is a number');
  assert.deepEqual(read('p2'), ['avel', 'run', true], 'places run stays run');
  assert.deepEqual(read('p3'), ['avel', null, false], 'no approval.md is unplaced, and no places key is null');
});

// ---------------------------------------------------------------- remote-worker: the place on the change's side (phase 2)

const PLACE_CONFIG = 'schema: devkit\nship:\n  devkit: pr\n';
const hash12 = (text) => `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;

// A change `mine` claimed for machine `avel` with `places` (the open writes the claim), its plan stages passed and
// approval.md written in its worktree, nothing of it committed after the claim.
function placedChange({ places = '1', run = null, id = 'mine', project = null } = {}) {
  const t = project ?? roundRepo({ roadmap: '# Roadmap\n', config: PLACE_CONFIG });
  if (run) {
    const file = join(git(t.main, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'devkit', 'roadmap-run.json');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(run)}\n`);
  }
  openOn(t.main, id, 'avel', { places: places ?? undefined }); // places null: a change that records none
  const wt = wtOf(t, id);
  const c0 = git(wt, 'rev-parse', 'HEAD');
  const dir = `openspec/changes/${id}`;
  const readiness = `${head('readiness', c0)}# Readiness\n\n- Status: APPROVED\n`;
  const files = {
    requirements: '# Requirements\n', proposal: PROPOSAL, specs: '# Spec\n', design: '# Design\n', tasks: '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n',
  };
  put(wt, {
    [`${dir}/requirements.md`]: `${head('requirements', c0)}${files.requirements}`,
    [`${dir}/proposal.md`]: `${head('proposal', c0)}${files.proposal}`,
    [`${dir}/specs/s/spec.md`]: `${head('specs', c0)}${files.specs}`,
    [`${dir}/design.md`]: `${head('design', c0)}${files.design}`,
    [`${dir}/tasks.md`]: `${head('tasks', c0)}${files.tasks}`,
    [`${dir}/readiness.md`]: readiness,
    [`${dir}/approval.md`]: `${head('approval', c0)}# Approval\n\n- Status: APPROVED\n- Readiness: ${hash12(readiness)}\n`,
  });
  return { t, wt, id, env: { ...t.ghAt(wt).env, ...SET } };
}

// Another change of machine `avel`, opened and pushed from a second clone; `approved` also pushes its approval.md.
function otherChangeOnAvel(t, id, { approved, machine = 'avel', places = '1' }) {
  const clone = otherClone(t);
  openOn(clone, id, machine, { places });
  if (approved) {
    const wt = join(clone, '.claude', 'worktrees', id);
    put(wt, { [`openspec/changes/${id}/approval.md`]: `# Approval\n\n- Status: APPROVED\n` });
    commitAll(wt, 'plan');
    git(wt, 'push', '-q', 'origin', id);
  }
  return clone;
}
const nextIn = (f, extra = []) => main(['next', '--change', f.id, '--lang', 'en', ...extra], { cwd: f.wt, env: f.env });

const fetchOrigin = (t) => git(t.main, 'fetch', '-q', '--prune', 'origin');
const placeIn = (f, id = f.id) => main(['place', id, '--lang', 'en'], { cwd: wtOf(f.t, id), env: f.env });
const placeBody = (r) => JSON.parse(r.stdout);
const actionIn = (f) => parsed(nextIn(f)).action;

test('remote AC-10 next: with no free place the change ends waiting for a place, icon ⏳', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const r = nextIn(f);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /^devkit-run: mine\ndevkit-end: mine blocked\n/);
  const a = actionIn(f);
  assert.deepEqual([a.kind, a.end.state, a.end.why, a.stage], ['end', 'blocked', 'no-place', 'implementation']);
  assert.deepEqual(a.params, { id: 'mine', machine: 'avel', taken: 1, places: 1 });
  assert.equal(a.reply, render('en', 'waiting-place', { id: 'mine', machine: 'avel', taken: 1, places: 1 }));
  assert.match(a.reply, /waits for a free place on avel/);
  assert.equal(a.icon, '⏳');
  assert.equal(a.sessionTitle, '⏳ mine');
  assert.equal('step' in a, false, 'no implementation step is handed');
  assert.equal(render('en', 'blocked', { id: 'mine', why: 'no-place', machine: 'avel', taken: 1, places: 1 }).includes('waits for a free place on avel (1 of 1 taken)'), true);
  assert.equal(parsed(main(['next', '--change', 'mine', '--lang', 'pt-BR'], { cwd: f.wt, env: f.env })).action.reply, render('pt-BR', 'waiting-place', { id: 'mine', machine: 'avel', taken: 1, places: 1 }));
  assert.equal(git(f.t.main, 'show', `origin/mine:openspec/changes/mine/.openspec.yaml`).includes('x-devkit-places: 1'), true);
});

test('remote AC-10 next: a change held by no approval, or by another machine, takes no place', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'idle', { approved: false });
  otherChangeOnAvel(f.t, 'elsewhere', { approved: true, machine: 'mac' });
  fetchOrigin(f.t);
  const a = actionIn(f);
  assert.deepEqual([a.kind, a.step, a.detail.command.slice(2)], ['session', 'take-place', ['place', 'mine', '--lang', 'en']]);
});

test('remote AC-10 next: a free place gives take-place, and after it the implementation step', () => {
  const f = placedChange({ places: '2' });
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const first = actionIn(f);
  assert.deepEqual([first.kind, first.step, first.stage, first.icon], ['session', 'take-place', 'implementation', '🛠️']);
  assert.deepEqual(first.detail.command, ['node', LOOP, 'place', 'mine', '--lang', 'en']);
  assert.match(first.progressKey, /^implementation\/take-place@/);
  const placed = placeIn(f);
  assert.equal(placed.code, 0, placed.stdout + placed.stderr);
  assert.deepEqual(placeBody(placed), { version: 1, change: 'mine', taken: true, machine: 'avel', held: 1, places: 2 });
  assert.equal(git(f.wt, 'status', '--porcelain', '--', 'openspec/changes/mine'), '', 'the plan was committed');
  assert.equal(git(f.wt, 'log', '-1', '--format=%s'), 'chore(openspec): plan of mine');
  assert.equal(git(f.t.main, 'ls-remote', 'origin', 'refs/heads/mine').split('\t')[0], git(f.wt, 'rev-parse', 'HEAD'), 'origin holds the plan');
  assert.match(git(f.t.main, 'show', 'origin/mine:openspec/changes/mine/approval.md'), /Status: APPROVED/);
  const after = actionIn(f);
  assert.deepEqual([after.kind, after.step], ['agent', 'implement'], 'the place is taken: the first implementation step');
  const again = placeIn(f);
  assert.equal(again.code, 0, 'a second run of the step keeps the place');
  assert.equal(placeBody(again).taken, true);
});

test('remote AC-10 next: the places of a run come from the run file', () => {
  const one = placedChange({ places: 'run', run: { version: 1, places: 1 } });
  otherChangeOnAvel(one.t, 'busy', { approved: true });
  fetchOrigin(one.t);
  assert.equal(actionIn(one).end?.why, 'no-place', 'run file with 1 place, 1 held');
  assert.deepEqual(actionIn(one).params, { id: 'mine', machine: 'avel', taken: 1, places: 1 });
  const two = placedChange({ places: 'run', run: { version: 1, places: 2 } });
  otherChangeOnAvel(two.t, 'busy', { approved: true });
  fetchOrigin(two.t);
  assert.equal(actionIn(two).step, 'take-place', 'run file with 2 places, 1 held');
});

test('remote AC-10 next: the grill and the plan never wait for a place', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  assert.equal(actionIn(f).end?.why, 'no-place', 'with its plan approved this change waits');
  rmSync(join(f.wt, 'openspec', 'changes', 'mine', 'approval.md'));
  const a = actionIn(f);
  assert.equal(a.end?.why === 'no-place' || a.step === 'take-place', false, JSON.stringify(a));
  assert.equal(a.kind === 'end' ? a.end.state : a.kind, 'waiting-for-owner', 'a plan waiting for its approval is what it was');
});

test('remote AC-10 next: a change without x-devkit-places never waits', () => {
  const f = placedChange({ places: null });
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  assert.equal(/x-devkit-places/.test(yamlOf(f.wt, 'mine')), false);
  const free = actionIn(f);
  assert.deepEqual([free.kind, free.step], ['agent', 'implement'], 'no place is checked');
  const file = join(f.wt, 'openspec', 'changes', 'mine', '.openspec.yaml');
  writeFileSync(file, `${readFileSync(file, 'utf8')}x-devkit-places: 1\n`);
  assert.equal(actionIn(f).end?.why, 'no-place', 'with the key the same change waits');
});

test('remote AC-10 next: a place already taken is not checked again', () => {
  const f = placedChange();
  assert.equal(placeIn(f).code, 0);
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const a = actionIn(f);
  assert.deepEqual([a.kind, a.step], ['agent', 'implement']);
});

const placeChild = (f, id) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [LOOP, 'place', id, '--lang', 'en'], { cwd: wtOf(f.t, id), env: { ...f.env, ...IDENT }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.on('error', reject);
  child.on('exit', (code) => resolve({ code, stdout }));
});

test('remote AC-10 place: two changes of one machine at once, one takes the place', async () => {
  const f = placedChange({ id: 'first-one' });
  placedChange({ id: 'second-one', project: f.t });
  const [a, b] = await Promise.all([placeChild(f, 'first-one'), placeChild(f, 'second-one')]);
  assert.deepEqual([a.code, b.code].sort(), [0, 2], `${a.stdout}\n${b.stdout}`);
  const [win, lose, winId, loseId] = a.code === 0 ? [a, b, 'first-one', 'second-one'] : [b, a, 'second-one', 'first-one'];
  assert.equal(JSON.parse(win.stdout).taken, true);
  assert.deepEqual([JSON.parse(lose.stdout).taken, JSON.parse(lose.stdout).held], [false, 1]);
  git(f.t.main, 'fetch', '-q', 'origin');
  assert.match(git(f.t.main, 'show', `origin/${winId}:openspec/changes/${winId}/approval.md`), /APPROVED/);
  assert.throws(() => git(f.t.main, 'cat-file', '-e', `origin/${loseId}:openspec/changes/${loseId}/approval.md`), 'the other change\'s plan is not on origin');
});

test('remote AC-11 place: a wake that comes too early leaves the change waiting', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true }); // pushed after this clone's last fetch: its view is stale
  const early = placeIn(f);
  assert.equal(early.code, 2, early.stdout + early.stderr);
  assert.deepEqual(placeBody(early), { version: 1, change: 'mine', taken: false, machine: 'avel', held: 1, places: 1 });
  const onOrigin = git(f.t.main, 'ls-remote', 'origin', 'refs/heads/mine').split('\t')[0];
  assert.notEqual(onOrigin, git(f.wt, 'rev-parse', 'HEAD'), 'the plan was not pushed: the place is not taken');
  const a = actionIn(f);
  assert.deepEqual([a.end?.state, a.end?.why, a.params?.taken], ['blocked', 'no-place', 1]);
  assert.equal('step' in a, false);
});

test('remote AC-10 stop: the blocked end no-place lets a /devkit change run stop', () => {
  const f = placedChange();
  otherChangeOnAvel(f.t, 'busy', { approved: true });
  fetchOrigin(f.t);
  const transcript = transcriptOf([typedLine('change mine'), skillBodyLine('change mine'), assistantLine(), runLine('mine')]);
  const r = hook('stop', stopInput(f.wt, transcript), { ...f.env, TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
  const free = placedChange({ id: 'free-one' });
  const ready = hook('stop', stopInput(free.wt, transcriptOf([typedLine('change free-one'), skillBodyLine('change free-one'), assistantLine(), runLine('free-one')])), { ...free.env, TMPDIR: sandbox() });
  assert.equal(ready.code, 2, 'a ready take-place step is refused once, like any step');
  assert.match(ready.err, /take-place/);
});

// ================================================================ jira-entry: the entry (start and open)

const TASK_LINK = 'https://acme.atlassian.net/browse/PROJ-482';
const BOARD_LINK = 'https://acme.atlassian.net/jira/software/projects/PROJ/boards/1?selectedIssue=PROJ-482';
const TASK_OF_482 = { key: 'PROJ-482', link: null, idPrefix: 'proj-482' };

// A committed change `id` whose requirements record the Jira key on the first line of its request section.
function addTaskChange(root, id, line = `Jira: PROJ-482 ${TASK_LINK}`, { flow = null } = {}) {
  const c0 = git(root, 'rev-parse', 'HEAD');
  put(root, {
    [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\n${flow === null ? '' : `x-devkit-flow: ${flow}\n`}`,
    [`openspec/changes/${id}/requirements.md`]: `${head('requirements', c0)}# Requirements\n\n## Request\n\n${line}\n\nTitle:\n\n> Login times out after 30 seconds\n\n## Assumptions\n\n- \n`,
    [`openspec/changes/${id}/${PLAN_FILES.decisions}`]: `${head('decisions', c0)}# decisions\n`, // the stage-roles decisions stage comes before the proposal
  });
  commitAll(root, `change ${id}`);
}

test('jira-entry AC-1 start answers task for a key in a project with no unfinished change, and creates nothing', () => {
  const root = devkitRepo();
  const before = snapshot(root);
  const b = body(startRun(root, 'change PROJ-482'));
  assert.deepEqual([b.mode, b.verb, b.text, b.change, b.unfinished, b.reply, b.version], ['task', 'change', 'PROJ-482', null, [], null, 1]);
  assert.deepEqual(b.task, TASK_OF_482);
  assert.equal(snapshot(root), before);
});

test('jira-entry AC-2 start answers the same task for a browse link and a board link', () => {
  const root = devkitRepo();
  for (const link of [TASK_LINK, `${TASK_LINK}?atlOrigin=abc`, BOARD_LINK]) {
    const b = body(startRun(root, `change ${link}`));
    assert.equal(b.mode, 'task', link);
    assert.deepEqual(b.task, { key: 'PROJ-482', link, idPrefix: 'proj-482' }, link);
  }
});

// Invariant (T-25, D-13): a Jira key or its link resumes the unfinished change that records it and says where it stopped; layer: startMode; suite: change-loop.
// The change records flow 2, as an open with this release does.
test('jira-entry AC-5 start resumes the unfinished change that records the key, for the key and for its link', () => {
  const t = freshProject();
  addTaskChange(t.main, 'proj-482-login-timeout', undefined, { flow: 2 });
  addChange(t.main, 'other');
  for (const typed of ['PROJ-482', TASK_LINK, BOARD_LINK]) {
    const b = body(startRun(t.main, `change ${typed}`));
    assert.deepEqual([b.mode, b.change], ['resume', 'proj-482-login-timeout'], typed);
    assert.equal(b.reply, render('en', 'resumed', { id: 'proj-482-login-timeout', where: whereNext('proposal') }), typed);
  }
});

test('jira-entry AC-5 start asks about other unfinished changes before a task, and carries the task', () => {
  const t = freshProject();
  addChange(t.main, 'other');
  const before = snapshot(t.main);
  const b = body(startRun(t.main, 'change PROJ-482'));
  assert.deepEqual([b.mode, b.change], ['ask-unfinished', null]);
  assert.deepEqual(b.task, TASK_OF_482);
  assert.deepEqual(b.unfinished.map((u) => u.id), ['other']);
  assert.equal(b.reply, render('en', 'ask-unfinished', { list: `other (${whereNext('proposal')})` }));
  assert.equal(snapshot(t.main), before);
});

test('jira-entry AC-5 a key whose only change is archived reads as a new task', () => {
  const root = devkitRepo();
  put(root, {
    'openspec/changes/archive/2026-11-22-feat/.openspec.yaml': 'schema: devkit\n',
    'openspec/changes/archive/2026-11-22-feat/requirements.md': `# Requirements\n\n## Request\n\nJira: PROJ-482 ${TASK_LINK}\n`,
  });
  const b = body(startRun(root, 'change PROJ-482'));
  assert.deepEqual([b.mode, b.unfinished], ['task', []]);
  assert.deepEqual(b.task, TASK_OF_482);
});

test('jira-entry AC-8 start answers free text, a lower-case key, a change id and no text as before, with task null', () => {
  const root = devkitRepo();
  for (const [text, mode] of [['add a csv export', 'new'], ['proj-482', 'new'], ['PROJ-482 and more words', 'new'], ['see https://example.com/x', 'new'], ['', 'nothing']]) {
    const b = body(startRun(root, `change ${text}`.trim()));
    assert.deepEqual([b.mode, b.task], [mode, null], text);
  }
  const t = freshProject();
  addChange(t.main, 'feat');
  const b = body(startRun(t.main, 'change feat'));
  assert.deepEqual([b.mode, b.change, b.task], ['resume', 'feat', null]);
  assert.equal(body(startRun(t.main, 'roadmap PROJ-482')).task, null, 'only the change verb reads a task');
});

const FAKE_TASK = {
  key: 'PROJ-482', url: TASK_LINK, title: 'Login times out after 30 seconds',
  description: 'Users see a blank page.\n\n## Not a heading\nJira: OTHER-1', acceptanceCriteria: 'Login answers within 5 seconds',
};
const taskOpen = (cwd, id, task = FAKE_TASK, { key = 'PROJ-482', raw } = {}) => main(
  ['open', id, '--script', 'devkit', '--why', 'doubt', '--task', key, '--lang', 'en'], { cwd, env: cleanEnv, stdin: raw ?? JSON.stringify(task) });
const requestSection = (t, id) => /## Request\n([\s\S]*?)\n## /.exec(readFileSync(join(wtOf(t, id), 'openspec', 'changes', id, 'requirements.md'), 'utf8'))[1];

test('jira-entry AC-1 open --task writes the key line and the three quoted parts under Request, and nothing else of the task', () => {
  const t = freshProject();
  const noise = { comments: ['secret comment text'], subtasks: [{ key: 'PROJ-483', summary: 'secret subtask text' }], issuelinks: ['secret link text'] };
  const r = taskOpen(t.main, 'proj-482-login-timeout', { ...FAKE_TASK, ...noise });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const [first, ...rest] = r.stdout.split('\n');
  assert.equal(first, 'devkit-run: proj-482-login-timeout');
  const b = JSON.parse(rest.join('\n'));
  assert.deepEqual(b.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.equal(b.reply, render('en', 'opened-task', { key: 'PROJ-482', id: 'proj-482-login-timeout', script: 'devkit', other: 'devkit-lite', why: 'doubt' }));
  assert.equal(requestSection(t, 'proj-482-login-timeout'), [
    '', `Jira: PROJ-482 ${TASK_LINK}`, '', 'Title:', '', '> Login times out after 30 seconds', '', 'Description:', '',
    '> Users see a blank page.', '>', '> ## Not a heading', '> Jira: OTHER-1', '', 'Acceptance criteria field:', '', '> Login answers within 5 seconds', '',
  ].join('\n'));
  const file = readFileSync(join(wtOf(t, 'proj-482-login-timeout'), 'openspec', 'changes', 'proj-482-login-timeout', 'requirements.md'), 'utf8');
  assert.doesNotMatch(file, /secret/);
  assert.equal(body(startRun(t.main, 'change PROJ-482')).mode, 'resume', 'the key now resumes the change');
});

test('jira-entry AC-1 open --task without an acceptance-criteria field writes the key line, the title and the description', () => {
  const t = freshProject();
  const { acceptanceCriteria: _dropped, ...noField } = FAKE_TASK;
  assert.equal(taskOpen(t.main, 'proj-482-login', noField).code, 0);
  const section = requestSection(t, 'proj-482-login');
  assert.match(section, /^\nJira: PROJ-482 /);
  assert.match(section, /Title:\n\n> Login times out/);
  assert.match(section, /Description:\n\n> Users see/);
  assert.doesNotMatch(section, /Acceptance criteria field/);
});

test('jira-entry AC-1 open --task refuses an id that does not start with the key, and creates nothing', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  for (const id of ['login-timeout', 'proj-48-login', 'proj-4820-login']) {
    const r = taskOpen(t.main, id);
    assert.equal(r.code, 3, id);
    assert.match(body(r).error, /proj-482-/, id);
    assert.equal(r.stdout.startsWith('devkit-run:'), false);
    assert.equal(snapshot(t.main), before, id);
  }
});

test('jira-entry AC-3 open --task refuses a task answer it cannot read, and creates nothing', () => {
  const t = freshProject();
  const before = snapshot(t.main);
  const answers = {
    empty: '', 'cut short': '{"key":"PROJ-482","title":"Log', 'another key': JSON.stringify({ ...FAKE_TASK, key: 'PROJ-1' }),
    'no title': JSON.stringify({ ...FAKE_TASK, title: undefined }), 'not an object': '["PROJ-482"]',
  };
  for (const [label, raw] of Object.entries(answers)) {
    const r = taskOpen(t.main, 'proj-482-login', FAKE_TASK, { raw });
    assert.equal(r.code, 3, label);
    assert.doesNotMatch(body(r).error, /unknown option/, label);
    assert.match(body(r).error, /task|standard input/, label);
    assert.equal(r.stdout.startsWith('devkit-run:'), false, label);
    assert.equal(snapshot(t.main), before, label);
  }
  assert.match(body(taskOpen(t.main, 'proj-482-login', FAKE_TASK, { key: 'proj-482' })).error, /needs a Jira key/, 'a key that is not a key');
  assert.equal(snapshot(t.main), before);
});

test('jira-entry AC-5 open --task refuses a second change for a key whose change is unfinished', () => {
  const t = freshProject();
  assert.equal(taskOpen(t.main, 'proj-482-login-timeout').code, 0);
  const before = snapshot(t.main);
  const r = taskOpen(t.main, 'proj-482-second-try');
  assert.equal(r.code, 3);
  assert.equal(body(r).reply, render('en', 'task-taken', { key: 'PROJ-482', id: 'proj-482-login-timeout' }));
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  assert.equal(snapshot(t.main), before);
});

test('jira-entry AC-8 open without --task writes the request byte for byte as before', () => {
  const t = freshProject();
  assert.equal(openRun(t.main, 'plain-request', { request: 'Add a CSV export\nwith two lines\n' }).code, 0);
  assert.equal(requestSection(t, 'plain-request'), '\n> Add a CSV export\n> with two lines\n');
  const b = JSON.parse(openRun(t.main, 'plain-two', { request: 'one' }).stdout.split('\n').slice(1).join('\n'));
  assert.equal('task' in b, false);
  assert.equal(b.reply, render('en', 'opened', { id: 'plain-two', script: 'devkit', other: 'devkit-lite', why: 'doubt' }));
});

// ================================================================ jira-entry: the write-back (next)

const TASK_REQUIREMENTS = `# Requirements\n\n## Request\n\nJira: PROJ-482 ${TASK_LINK}\n\nTitle:\n\n> Login times out after 30 seconds\n\n## Assumptions\n\n- \n`;
const recordFile = (t, id = 'feat') => join(t.main, '.git', 'devkit', 'write-back', `${id}.json`);
const asked = (t, over = {}, id = 'feat') => {
  mkdirSync(dirname(recordFile(t, id)), { recursive: true });
  writeFileSync(recordFile(t, id), JSON.stringify({ version: 1, change: id, key: 'PROJ-482', number: 12, url: 'https://github.com/o/r/pull/12', askedAt: '2026-11-22T00:00:00Z', transitions: [], answer: null, ...over }));
};

test('jira-entry AC-4 next hands the grill of a task change with the task\'s key and link', () => {
  const t = freshProject();
  assert.equal(taskOpen(t.main, 'proj-482-login-timeout').code, 0);
  const r = main(['next', '--change', 'proj-482-login-timeout', '--lang', 'en'], { cwd: t.main, env: cleanEnv });
  const a = actionOf(r.stdout);
  assert.deepEqual([a.kind, a.stage], ['grill', 'requirements']);
  assert.deepEqual(a.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.equal('writeBack' in a, false);
});

test('jira-entry AC-6 next carries writeBack once the pull request exists, for a change that records a task', () => {
  const { t, env } = deliveredChange({ requirements: TASK_REQUIREMENTS });
  const a = parsed(next(t.main, [], env)).action;
  assert.deepEqual(a.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.deepEqual(a.writeBack, { key: 'PROJ-482', link: TASK_LINK, number: 12, url: 'https://github.com/o/r/pull/12' });
});

test('jira-entry AC-6 next carries no writeBack after the question was asked, for a change with no task, for a corrupt record, and on the archive branch', () => {
  const plain = deliveredChange();
  const none = parsed(next(plain.t.main, [], plain.env)).action;
  assert.equal('task' in none, false);
  assert.equal('writeBack' in none, false);

  const { t, wt, env } = deliveredChange({ requirements: TASK_REQUIREMENTS });
  assert.ok(parsed(next(t.main, [], env)).action.writeBack, 'before the question');
  asked(t);
  assert.equal('writeBack' in parsed(next(t.main, [], env)).action, false, 'asked for this pull request');
  asked(t, { number: 9 });
  assert.ok(parsed(next(t.main, [], env)).action.writeBack, 'another pull request asks again');
  writeFileSync(recordFile(t), '{ not json');
  const corrupt = parsed(next(t.main, [], env)).action;
  assert.deepEqual(corrupt.task, { key: 'PROJ-482', link: TASK_LINK });
  assert.equal('writeBack' in corrupt, false, 'a damaged record asks nothing');
  rmSync(recordFile(t));
  git(wt, 'branch', '-m', 'chore/archive-feat');
  assert.equal('writeBack' in parsed(next(t.main, [], env)).action, false, 'not on the archive branch');
});

test('jira-entry AC-6 next carries the task but no writeBack on a budget end held at the pull request', () => {
  const { t, wt, env } = deliveredChange({ checks: [check('build', 'fail')], requirements: TASK_REQUIREMENTS });
  const open = parsed(next(t.main, [], env)).action;
  assert.notEqual(open.kind, 'end', 'under no cap the failing checks hand a step');
  assert.ok(open.writeBack, 'the question is pending before the stop');
  writeFileSync(join(wt, 'openspec', 'changes', 'feat', '.openspec.yaml'), 'schema: devkit-lite\ndevkit:\n  budget: 1000\n');
  const capped = { ...budgetEnv(sandbox(), 'sess-budget', [typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: 5000 })]) };
  const stopped = parsed(next(t.main, [], { ...env, CLAUDE_CONFIG_DIR: capped.CLAUDE_CONFIG_DIR, CLAUDE_CODE_SESSION_ID: capped.CLAUDE_CODE_SESSION_ID })).action;
  assert.equal(stopped.end?.why, 'waiting-budget', 'the cap holds the step');
  assert.deepEqual(stopped.task, { key: 'PROJ-482', link: TASK_LINK }, 'the task still attaches');
  assert.equal('writeBack' in stopped, false, 'a budget-stopped end asks nothing');
});

test('jira-entry AC-6 a pending question changes no decision', async () => {
  const withTask = deliveredChange({ requirements: TASK_REQUIREMENTS });
  const without = deliveredChange();
  const A = parsed(next(withTask.t.main, [], withTask.env)).action;
  const B = parsed(next(without.t.main, [], without.env)).action;
  assert.ok(A.writeBack, 'the question is pending');
  for (const k of ['kind', 'end', 'step', 'agent', 'reply']) assert.deepEqual(A[k], B[k], k);
  // The wait ends on the same decision and sleeps the same number of times: the pending question is not part of its key.
  const waitOf = async (c) => {
    let sleeps = 0;
    const sleep = async () => { sleeps++; c.gh.set('pr-checks', { stdout: [check('build', 'pass')] }); };
    const poll = async () => nextAction(c.t.main, 'feat', { env: c.env, lang: 'en', gh: c.t.ghFor(c.wt) });
    const action = await waitLoop({ poll, sleep, interval: 5, id: 'feat', lang: 'en' });
    return { sleeps, end: action.end, reply: action.reply };
  };
  assert.deepEqual(await waitOf(withTask), await waitOf(without));
});

// ---- write-back ask

const PR_URL = 'https://github.com/o/r/pull/12';
const TRANSITIONS = [{ id: '31', name: 'In Review' }, { id: '41', name: 'Done' }];
const taskDelivery = () => deliveredChange({ requirements: TASK_REQUIREMENTS });
const writeBack = (c, sub, args, { stdin = '', lang = 'en', id = 'feat' } = {}) => main(
  ['write-back', sub, id, ...args, '--lang', lang], { cwd: c.t.main, env: c.env, gh: c.t.ghFor(c.wt), stdin });
const askBack = (c, input = { number: 12, url: PR_URL, transitions: TRANSITIONS }, opts = {}) => writeBack(c, 'ask', [], { stdin: JSON.stringify(input), ...opts });
const answerBack = (c, choice, opts = {}) => writeBack(c, 'answer', ['--choice', choice], opts);
const archiveOnMain = (c, id = 'feat') => mkdirSync(join(c.t.main, 'openspec', 'changes', 'archive', `2026-11-22-${id}`), { recursive: true });

test('jira-entry AC-6 write-back ask lists the transitions, only comment and no, records the question, and answers ask false the second time', () => {
  const c = taskDelivery();
  const r = askBack(c);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.startsWith('{'), true, 'no devkit-run or devkit-end line');
  const b = body(r);
  const labels = ['move it to "In Review"', 'move it to "Done"', 'only comment', 'no'];
  assert.deepEqual([b.version, b.change, b.key, b.ask], [1, 'feat', 'PROJ-482', true]);
  assert.deepEqual(b.choices, [
    { choice: 'transition:31', label: labels[0] }, { choice: 'transition:41', label: labels[1] },
    { choice: 'comment', label: labels[2] }, { choice: 'no', label: labels[3] },
  ]);
  assert.equal(b.question, render('en', 'write-back-ask', { id: 'feat', key: 'PROJ-482', number: 12, choices: labels.join('; ') }));
  const record = JSON.parse(readFileSync(recordFile(c.t), 'utf8'));
  assert.deepEqual([record.version, record.change, record.key, record.number, record.url, record.transitions, record.answer], [1, 'feat', 'PROJ-482', 12, PR_URL, TRANSITIONS, null]);
  assert.deepEqual(body(askBack(c)), { version: 1, change: 'feat', key: 'PROJ-482', ask: false, why: 'asked' });
  assert.equal('writeBack' in parsed(next(c.t.main, [], c.env)).action, false, 'next asks nothing once asked');
  assert.match(body(askBack(taskDelivery(), undefined, { lang: 'pt-BR' })).question, /Devo escrever o link/, 'the question is in the person\'s language');
});

test('jira-entry AC-6 write-back ask with no transitions offers only comment and no', () => {
  const c = taskDelivery();
  for (const input of [{ number: 12, url: PR_URL, transitions: [] }, { number: 12, url: PR_URL }]) {
    rmSync(recordFile(c.t), { force: true });
    assert.deepEqual(body(askBack(c, input)).choices.map((x) => x.choice), ['comment', 'no']);
  }
});

test('jira-entry AC-6 write-back ask refuses a change with no task and malformed input with exit 3', () => {
  const plain = deliveredChange();
  assert.equal(askBack(plain).code, 3, 'no task');
  assert.match(body(askBack(plain)).error, /records no Jira task/);
  assert.equal(existsSync(recordFile(plain.t)), false);
  const c = taskDelivery();
  for (const raw of ['', '{ cut', '[]', JSON.stringify({ number: 0, url: PR_URL }), JSON.stringify({ number: 12, url: 'ftp://x' }), JSON.stringify({ number: 12, url: PR_URL, transitions: [{ id: '1' }] })]) {
    const r = writeBack(c, 'ask', [], { stdin: raw });
    assert.equal(r.code, 3, raw);
    assert.equal(body(r).version, 1);
    assert.equal(r.stdout.startsWith('devkit-'), false);
  }
  assert.equal(existsSync(recordFile(c.t)), false, 'nothing recorded');
  assert.equal(askBack(c, undefined, { id: 'nope' }).code, 3, 'an unknown change');
  assert.match(body(askBack(c, undefined, { id: 'nope' })).error, /no change nope/);
});

test('jira-entry AC-6 write-back ask on an archived change asks nothing', () => {
  const c = taskDelivery();
  archiveOnMain(c);
  assert.deepEqual(body(askBack(c)), { version: 1, change: 'feat', key: 'PROJ-482', ask: false, why: 'archived' });
  assert.equal(existsSync(recordFile(c.t)), false);
  const d = taskDelivery();
  git(d.wt, 'branch', '-m', 'chore/archive-feat');
  assert.equal(body(askBack(d)).why, 'archived', 'on the archive branch');
});

// ---- write-back answer

const answerOf = (c) => JSON.parse(readFileSync(recordFile(c.t), 'utf8')).answer;
const COMMENT_EN = `devkit opened the pull request ${PR_URL} for this task (change feat).`;

test('jira-entry AC-7 write-back answer with a transition gives one comment and that transition', () => {
  const c = taskDelivery();
  askBack(c);
  const r = answerBack(c, 'transition:31');
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.startsWith('{'), true);
  assert.deepEqual(body(r), {
    version: 1, change: 'feat', key: 'PROJ-482', write: true, comment: COMMENT_EN, transition: { id: '31', name: 'In Review' },
    reply: render('en', 'write-back-moved', { key: 'PROJ-482', number: 12, name: 'In Review' }),
  });
  assert.deepEqual([answerOf(c).choice, answerOf(c).written], ['transition:31', true]);
  assert.match(answerOf(c).at, /^\d{4}-\d{2}-\d{2}T/);
});

test('jira-entry AC-7 write-back answer only comment gives the comment and no transition', () => {
  const c = taskDelivery();
  askBack(c);
  assert.deepEqual(body(answerBack(c, 'comment')), {
    version: 1, change: 'feat', key: 'PROJ-482', write: true, comment: COMMENT_EN, transition: null,
    reply: render('en', 'write-back-commented', { key: 'PROJ-482', number: 12 }),
  });
  assert.equal(answerOf(c).written, true);
});

test('jira-entry AC-7 write-back answer no, a second answer, and an answer before the question write nothing', () => {
  const c = taskDelivery();
  const none = (why) => ({ version: 1, change: 'feat', key: 'PROJ-482', write: false, why, reply: render('en', 'write-back-none', { key: 'PROJ-482' }) });
  assert.deepEqual(body(answerBack(c, 'comment')), none('not-asked'));
  assert.equal(existsSync(recordFile(c.t)), false, 'an answer before the question records nothing');
  askBack(c);
  assert.deepEqual(body(answerBack(c, 'no')), none('no'));
  assert.deepEqual([answerOf(c).choice, answerOf(c).written], ['no', false]);
  assert.deepEqual(body(answerBack(c, 'comment')), none('answered'));
  assert.equal(answerOf(c).choice, 'no', 'the first answer stands');
  writeFileSync(recordFile(c.t), '{ not json');
  assert.deepEqual(body(answerBack(c, 'comment')), none('not-asked'), 'a damaged record writes nothing');
  asked(c.t, { key: 'OTHER-9' });
  assert.deepEqual(body(answerBack(c, 'comment')), none('not-asked'), 'a record of another key');
});

test('jira-entry AC-7 write-back answer after the archive writes nothing', () => {
  const c = taskDelivery();
  askBack(c);
  archiveOnMain(c);
  assert.deepEqual(body(answerBack(c, 'comment')), {
    version: 1, change: 'feat', key: 'PROJ-482', write: false, why: 'archived', reply: render('en', 'write-back-late', { id: 'feat', key: 'PROJ-482' }),
  });
  assert.deepEqual([answerOf(c).choice, answerOf(c).written], ['comment', false]);
});

test('jira-entry AC-7 write-back answer with a transition not offered writes nothing and lists the choices again', () => {
  const c = taskDelivery();
  askBack(c);
  const r = answerBack(c, 'transition:99');
  assert.equal(r.code, 0);
  const labels = 'move it to "In Review"; move it to "Done"; only comment; no';
  assert.deepEqual(body(r), {
    version: 1, change: 'feat', key: 'PROJ-482', write: false, why: 'unknown-choice', reply: render('en', 'write-back-unknown', { key: 'PROJ-482', choices: labels }),
  });
  assert.equal(answerOf(c), null, 'nothing recorded');
  assert.equal(body(answerBack(c, 'transition:41')).write, true, 'a valid answer can follow');
  const bad = answerBack(taskDelivery(), 'maybe');
  assert.equal(bad.code, 3, 'a choice outside the form is a usage error');
});

test('jira-entry AC-7 the comment names the link and the change in the files language', () => {
  const en = taskDelivery();
  askBack(en);
  assert.equal(body(answerBack(en, 'comment')).comment, COMMENT_EN);
  const pt = taskDelivery();
  const config = join(pt.wt, 'openspec', 'config.yaml');
  writeFileSync(config, `${readFileSync(config, 'utf8')}devkit:\n  language: pt-BR\n`);
  askBack(pt);
  const b = body(answerBack(pt, 'comment', { lang: 'en' }));
  assert.equal(b.comment, `o devkit abriu o pull request ${PR_URL} para esta tarefa (change feat).`);
  assert.match(b.reply, /I wrote the link/, 'the reply stays in the person\'s language');
});

// ---- jira-entry 4.1: the skill's side of the Jira entry (D-3, D-5, D-7)

test("jira-entry AC-1 skill: the task mode, the connector's read, open --task and the two replies that open nothing", () => {
  const md = skillText();
  assert.ok(md.includes('`task`'), 'the task mode of start');
  const start = section(md, '## Start', '## A new change');
  assert.match(start, /- `task`: .*### A Jira task/, 'the task mode points at the subsection');
  assert.match(start, /`ask-unfinished`[^\n]*"start the new request"[^\n]*`task` is not null[^\n]*### A Jira task/, 'ask-unfinished sends a task to the subsection');
  const jira = section(md, '### A Jira task', '## Loop');
  assert.match(jira, /ToolSearch/);
  assert.match(jira, /jira issue/);
  for (const tool of ['getJiraIssue', 'getTransitionsForJiraIssue', 'addCommentToJiraIssue', 'transitionJiraIssue', 'getAccessibleAtlassianResources']) {
    assert.ok(jira.includes(tool), `names ${tool}`);
  }
  assert.match(jira, /change-loop\.mjs reply task-no-connector --param key=<KEY> --lang \$\{user_config\.language\}/);
  assert.match(jira, /change-loop\.mjs reply task-unreadable --param key=<KEY> --lang \$\{user_config\.language\}/);
  for (const field of ['`key`', '`url`', '`title`', '`description`', '`acceptanceCriteria`']) assert.ok(jira.includes(field), `the JSON holds ${field}`);
  assert.match(jira, /Nothing else of the task goes in/);
  assert.match(jira, /task\.idPrefix/);
  assert.match(jira, /change-loop\.mjs open <id> --script <s> --why <code> --task <KEY> --lang \$\{user_config\.language\}/);
  assert.match(jira, /<<'DEVKIT_ARGS'/);
  assert.match(jira, /`name-taken`/);
  assert.match(jira, /`task-taken`/);
  const calls = md.split('\n').filter((l) => /change-loop\.mjs (open|reply|write-back)\b/.test(l) && l.includes('<KEY>'));
  for (const l of calls) assert.ok(l.includes(LANG_FLAG), `--lang on: ${l}`);
});

test('jira-entry AC-4 skill: the grill of a task leaves the request section as it is', () => {
  const grill = skillText().split('\n').find((l) => l.startsWith('- `grill`'));
  assert.ok(grill, 'a grill item');
  assert.match(grill, /carries `task`/);
  assert.match(grill, /paragraph on a request copied from a task/);
  assert.match(grill, /leave `## Request`[^.]*exactly as it is/);
});

test('jira-entry AC-6 skill: the write-back question is asked once, in plain text, never with AskUserQuestion, and holds nothing', () => {
  const md = skillText();
  const wb = section(md, '### Writing back to the task', '## Owner gates');
  assert.match(wb, /carries `writeBack`/);
  assert.match(wb, /change-loop\.mjs write-back ask <id> --lang \$\{user_config\.language\}/);
  assert.match(wb, /<<'DEVKIT_ARGS'/);
  assert.match(wb, /"transitions"/);
  assert.match(wb, /plain text, never with AskUserQuestion/);
  assert.match(wb, /hold the turn/);
  assert.match(wb, /`ask: true`/);
  assert.match(md.slice(md.indexOf('## Owner gates')), /write-back question is not a gate and blocks nothing/);
});

test("jira-entry AC-7 skill: Jira is written only through write-back answer on the owner's own message, and a failed write is said and not retried", () => {
  const md = skillText();
  const wb = section(md, '### Writing back to the task', '## Owner gates');
  assert.match(wb, /Only the owner's own typed message answers/);
  assert.match(wb, /change-loop\.mjs write-back answer <id> --choice <choice> --lang \$\{user_config\.language\}/);
  assert.match(wb, /`write: true`/);
  assert.match(wb, /`write: false`/);
  assert.match(wb, /reply write-back-failed --param key=<KEY> --param error="<message>"/);
  assert.match(wb, /not retried/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Write to Jira except from `write-back answer` on the owner's own message/);
  assert.match(never, /Ask the write-back question with AskUserQuestion/);
  assert.match(never, /Copy a comment, subtask, linked task or attachment of a task into the change/);
  assert.match(never, /Keep a Jira token or a Jira setting in the project/);
});

test('jira-entry AC-4 grill skill: a request copied from a task is asked only what it leaves open', () => {
  const md = readRepo('plugins', 'core', 'skills', 'requirements-grill', 'SKILL.md');
  const step3 = section(md, '### 3. Grill on the four axes', '### 4. ');
  const para = step3.split('\n').find((l) => l.startsWith('**A request copied from a task.**'));
  assert.ok(para, 'the paragraph ends step 3');
  assert.match(para, /`Jira: <KEY>`/);
  assert.match(para, /\(answered by the task\)/);
  assert.match(para, /one question that confirms/);
  assert.match(para, /never edit the request section/);
});

test('jira-entry docs: the flow document, the design document and ADR 0010 record the Jira entry', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').some((l) => l.startsWith('- `/devkit change <Jira key or link>`:')), 'the forms list has the Jira form');
  const para = flow.split('\n').find((l) => l.startsWith('**A Jira task.**'));
  assert.ok(para, 'the paragraph A Jira task');
  assert.match(para, /Atlassian connector/);
  assert.match(para, /makes no call and keeps no token/);
  assert.match(para, /`requirements\.md`/);
  assert.match(para, /resum/);
  assert.match(para, /git common directory/);
  assert.match(flow, /`project` is built and only `help` is not/);
  assert.doesNotMatch(flow, /`project` and `help` are (still )?not built/);

  const design = readRepo('docs', 'coordination-design.md');
  const part = (from, to) => { const a = design.indexOf(from); assert.ok(a >= 0, from); const b = design.indexOf(to, a + from.length); return design.slice(a, b < 0 ? design.length : b); };
  assert.match(design, /\| `\/devkit change PROJ-482` \| one task, read from Jira by its key or link \| 20 \(built\) \|/);
  assert.match(part('## 1. ', '## 2. '), /Built by `jira-entry` on 2026-11-22: /);
  assert.match(part('## 8. ', '## 9. '), /Decided by `jira-entry` on 2026-11-22: the task source needs no field; the key or link typed names it\./);
  assert.doesNotMatch(design, /source: jira/);
  assert.match(part('## 13. ', '## 14. '), /Jira can be read on each platform \(the follow-up `jira-entry-live`, round 20b\)\./);

  const adr = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md');
  const ctx = adr.slice(adr.indexOf('## Context'), adr.indexOf('ADR 0001 let devkit coordinate'));
  assert.match(ctx, /Note \(jira-entry, 2026-11-22\): round 20 adds no task-source setting/);
  assert.ok(ctx.indexOf('Note (project-phases') < ctx.indexOf('Note (jira-entry'), 'after the project-phases Note');
  assert.match(adr, /^- Status: accepted$/m, 'its status does not change');
});

test('jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry', () => {
  const text = readRepo('openspec', 'roadmap.md');
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.startsWith('## Round 20b: live proof of the Jira entry'));
  assert.ok(at > lines.findIndex((l) => l.startsWith('## Round 20: the Jira entry')), 'the block follows round 20');
  const line = lines.find((l) => l.startsWith('- [ ] jira-entry-live (after: jira-entry)'));
  assert.ok(line, 'the unticked live-proof line');
  assert.match(line, /disposable test task the owner names/);
  const rounds = guardModule.readRoadmap(REPO_ROOT);
  const round = rounds.find((r) => r.title.startsWith('Round 20b'));
  assert.ok(round, 'readRoadmap reads the round');
  assert.deepEqual(round.items.map((i) => ({ id: i.id, done: i.done, after: i.after })), [{ id: 'jira-entry-live', done: false, after: ['jira-entry'] }]);
});

// ---------------------------------------------------------------- the token budget (change-budget)

// A model message line with a usage object; `sidechain` marks a subagent's own line.
const usageLine = ({ id = null, input = 0, output = 0, cacheWrite = 0, cacheRead = 0, at = '2026-11-20T10:00:00.000Z', sidechain = false } = {}) => stored({
  type: 'assistant',
  timestamp: at,
  isSidechain: sidechain,
  message: { role: 'assistant', ...(id ? { id } : {}), content: [{ type: 'text', text: 'working' }], usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead } },
});
const at = (minute) => `2026-11-20T10:${String(minute).padStart(2, '0')}:00.000Z`;
// The env of a test that reads a transcript: a config folder with `projects/p/<id>.jsonl` written.
const budgetEnv = (dir, id, lines = [assistantLine()]) => {
  mkdirSync(join(dir, 'projects', 'p'), { recursive: true });
  writeFileSync(join(dir, 'projects', 'p', `${id}.jsonl`), `${lines.join('\n')}\n`);
  return { ...cleanEnv, CLAUDE_CONFIG_DIR: dir, CLAUDE_CODE_SESSION_ID: id };
};
// A session transcript with `lines`, and subagent files `{ name: lines }` beside it.
const spendTranscript = (lines, subagents = {}) => {
  const file = transcriptOf(lines);
  const folder = join(dirname(file), SESSION, 'subagents');
  if (Object.keys(subagents).length) mkdirSync(folder, { recursive: true });
  for (const [name, content] of Object.entries(subagents)) writeFileSync(join(folder, name), `${content.join('\n')}\n`);
  return file;
};
const spent = (file, change = 'feat') => guardModule.spentOf(file, change);

test('change-budget AC-9 sessionTranscript finds the session file under CLAUDE_CONFIG_DIR', () => {
  const dir = sandbox();
  const env = budgetEnv(dir, 'sess-1');
  assert.equal(guardModule.sessionTranscript(env), join(dir, 'projects', 'p', 'sess-1.jsonl'));
});

test('change-budget AC-9 sessionTranscript falls back to HOME/.claude', () => {
  const home = sandbox();
  const env = { ...budgetEnv(join(home, '.claude'), 'sess-2'), CLAUDE_CONFIG_DIR: '', HOME: home };
  assert.equal(guardModule.sessionTranscript(env), join(home, '.claude', 'projects', 'p', 'sess-2.jsonl'));
});

test('change-budget AC-9 sessionTranscript is null with no id, an unsafe id, no file or no projects folder', () => {
  const dir = sandbox();
  const env = budgetEnv(dir, 'sess-3');
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: '' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: undefined }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: '../sess-3' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: 'a/b' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CODE_SESSION_ID: 'other' }), null);
  assert.equal(guardModule.sessionTranscript({ ...env, CLAUDE_CONFIG_DIR: sandbox() }), null);
});

test('change-budget AC-7 the fixture of the spec counts exactly 7525', () => {
  const model = (id) => usageLine({ id, input: 10, output: 200, cacheWrite: 3000, cacheRead: 50000, at: at(5) });
  const file = spendTranscript(
    [typedLine('change feat'), skillBodyLine('change feat'), runLine('feat'), model('m1'), model('m2')],
    { 'agent-a.jsonl': [usageLine({ id: 's1', input: 5, output: 100, cacheWrite: 1000, at: at(6), sidechain: true })] },
  );
  const r = spent(file);
  assert.equal(r.spent, 7525);
  assert.equal(typeof r.since, 'string');
});

test('change-budget AC-7 lines before the first run line do not count and the first run line wins', () => {
  const file = spendTranscript([
    typedLine('change feat'), usageLine({ id: 'old', input: 1000 }), toolResultLine(`devkit-run: feat\n{}`),
    usageLine({ id: 'a', input: 10, at: at(1) }), toolResultLine(`devkit-run: feat\n{}`), usageLine({ id: 'b', input: 20, at: at(2) }),
  ]);
  assert.equal(spent(file).spent, 30);
});

test('change-budget AC-7 another change run line starts no count', () => {
  const file = spendTranscript([typedLine('change other'), runLine('other'), usageLine({ id: 'a', input: 10 })]);
  assert.deepEqual(spent(file), { spent: 0, since: null });
});

test('change-budget AC-7 a message on several lines counts once and a line with no id counts each time', () => {
  const file = spendTranscript([
    typedLine('change feat'), runLine('feat'),
    usageLine({ id: 'm', input: 10 }), usageLine({ id: 'm', input: 10 }), usageLine({ id: 'm', input: 10 }),
    usageLine({ input: 7 }), usageLine({ input: 7 }),
  ]);
  assert.equal(spent(file).spent, 24);
});

test('change-budget AC-7 a subagent started before the run line does not count', () => {
  // the run line carries the stored default timestamp (10:00); the subagent starts at 09:59 and records a message at 10:20
  const file = spendTranscript(
    [typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: 1, at: at(10) })],
    {
      'agent-early.jsonl': [usageLine({ id: 'e', input: 500, at: '2026-11-20T09:59:00.000Z', sidechain: true }), usageLine({ id: 'e2', input: 500, at: at(20), sidechain: true })],
      'agent-late.jsonl': [usageLine({ id: 'l', input: 70, at: at(15), sidechain: true })],
    },
  );
  assert.equal(spent(file).spent, 71);
});

test('change-budget AC-7 a subagent file with no timestamp does not count', () => {
  const noStamp = JSON.stringify({ type: 'assistant', isSidechain: true, message: { id: 'n', usage: { input_tokens: 900 } } });
  const file = spendTranscript([typedLine('change feat'), runLine('feat')], { 'agent-none.jsonl': [noStamp] });
  assert.equal(spent(file).spent, 0);
});

test('change-budget AC-7 a sidechain model line of the session transcript counts', () => {
  const file = spendTranscript([typedLine('change feat'), runLine('feat'), usageLine({ id: 's', input: 40, sidechain: true })]);
  assert.equal(spent(file).spent, 40);
});

test('change-budget AC-7 a missing or non-number usage field counts 0', () => {
  const odd = stored({ type: 'assistant', message: { id: 'odd', usage: { input_tokens: 'x', output_tokens: -4, cache_creation_input_tokens: null } } });
  const half = stored({ type: 'assistant', message: { id: 'half', usage: { output_tokens: 6 } } });
  const file = spendTranscript([typedLine('change feat'), runLine('feat'), odd, half]);
  assert.equal(spent(file).spent, 6);
});

test('change-budget AC-9 an unreadable session transcript gives null, an unreadable subagent adds nothing', () => {
  assert.equal(spent(join(sandbox(), 'missing.jsonl')), null);
  const file = spendTranscript([typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: 3 })]);
  const folder = join(dirname(file), SESSION, 'subagents');
  mkdirSync(join(folder, 'agent-dir.jsonl'), { recursive: true });
  assert.equal(spent(file).spent, 3);
});

test('change-budget AC-4 the scan without the option returns the same events as before (kept)', () => {
  const file = transcriptOf([typedLine('change feat'), usageLine({ id: 'a', input: 5 }), runLine('feat')]);
  const events = guardModule.transcriptEvents({ transcript_path: file });
  assert.equal(events.length, 2);
  for (const event of events) {
    assert.equal('at' in event, false);
    assert.equal('start' in event, false);
    assert.equal('usage' in event, false);
  }
});

// ---- the setting (D-1)

const CHANGE_FILE = (dir) => join(dir, '.openspec.yaml');
// A project root holding `config` as its openspec/config.yaml, and a change folder (outside it) holding `change` as its .openspec.yaml.
const budgetFiles = (config, change = null) => {
  const root = configRepo(config);
  const dir = tmpFolder('devkit-change-budget-dir-');
  if (change !== null) writeFileSync(CHANGE_FILE(dir), change);
  return { root, dir };
};
const capOf = (config, change = null, lang = 'en') => {
  const { root, dir } = budgetFiles(config, change);
  return changeLoopModule.budgetOf(root, dir, lang);
};
const block = (...lines) => `schema: devkit\ndevkit:\n${lines.map((l) => `  ${l}\n`).join('')}`;

test('change-budget AC-5 the project budget applies when the change sets none', () => {
  const { root, dir } = budgetFiles(block('budget: 2000000'), 'schema: devkit\n');
  assert.deepEqual(changeLoopModule.budgetOf(root, dir, 'en'), { cap: 2000000, from: 'project', file: CHANGE_FILE(dir) });
  assert.deepEqual(readDevkitSettings(root), { driver: 'claude', language: 'en', unknown: [] }, 'the settings keep their shape');
  const noFile = budgetFiles(block('budget: 2000000'));
  assert.equal(changeLoopModule.budgetOf(noFile.root, noFile.dir, 'en').cap, 2000000, 'a change with no .openspec.yaml at all');
});

test('change-budget AC-5 the change block wins for that change only', () => {
  const project = block('budget: 2000000');
  const a = budgetFiles(project, block('budget: 500000'));
  const b = budgetFiles(project, 'schema: devkit\n');
  const capA = changeLoopModule.budgetOf(a.root, a.dir, 'en');
  assert.deepEqual([capA.cap, capA.from, capA.file], [500000, 'change', CHANGE_FILE(a.dir)]);
  assert.deepEqual([changeLoopModule.budgetOf(b.root, b.dir, 'en').cap, changeLoopModule.budgetOf(b.root, b.dir, 'en').from], [2000000, 'project']);
});

test('change-budget AC-4 no key, or an empty value, in either file is no cap', () => {
  assert.equal(capOf('schema: devkit\n'), null);
  assert.equal(capOf('schema: devkit\n', 'schema: devkit\n'), null);
  assert.equal(capOf(block('budget:'), block('budget:')), null);
  assert.equal(capOf(block('budget:   # none'), null), null);
  assert.equal(capOf(block('budget: ""'), null), null);
  assert.equal(capOf(block('driver: claude'), block('language: en')), null);
});

test('change-budget AC-4 an empty value in the change falls through to the project value', () => {
  const cap = capOf(block('budget: 300'), block('budget:'));
  assert.deepEqual([cap.cap, cap.from], [300, 'project']);
});

test('change-budget AC-5 a top-level budget of .openspec.yaml is not read', () => {
  assert.equal(capOf('schema: devkit\n', 'schema: devkit\nbudget: 100\n'), null);
  assert.equal(capOf(block('budget: 700'), 'schema: devkit\nbudget: 100\n').cap, 700);
  assert.equal(capOf('schema: devkit\nbudget: 100\n', null), null, 'nor one of openspec/config.yaml');
});

test('change-budget AC-5 a quoted value, a comment and an unclosed quote read the number', () => {
  for (const line of ['budget: "2000000"  # two million', 'budget: 2000000   # two million', "budget: '2000000'", 'budget: "2000000', 'budget: 007']) {
    const cap = capOf(block(line));
    assert.equal(cap.cap, line.endsWith('007') ? 7 : 2000000, line);
  }
});

test('change-budget AC-4 other keys of the change block are not read (kept)', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/changes/feat/.openspec.yaml': block('driver: robot', 'language: "not a tag"') });
  commitAll(root, 'odd keys');
  const r = next(root);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(parsed(r).action.agent, PLANNER);
});

test('change-budget AC-8 budgetValue refuses everything but a whole number above zero', () => {
  const fn = changeLoopModule.budgetValue;
  for (const bad of ['abc', '0', '-5', '1.5', '2e6', '2_000_000', '9007199254740993', ' 5x']) assert.deepEqual(fn(bad), { invalid: bad }, bad);
  assert.equal(fn(undefined), null);
  assert.equal(fn(''), null);
  assert.deepEqual(fn('2000000'), { cap: 2000000 });
  assert.deepEqual(fn('007'), { cap: 7 });
});

test('change-budget AC-8 an invalid project budget makes start answer setting-unknown and open create nothing', () => {
  for (const value of ['abc', '0', '-5', '1.5', '2e6', '2_000_000']) {
    const config = `schema: devkit\ndevkit:\n  budget: ${value}\n`;
    const root = devkitRepo(config);
    const before = snapshot(root);
    const b = body(startRun(root, 'change add an export'));
    assert.equal(b.mode, 'setting-unknown', value);
    assert.equal(b.reply, render('en', 'setting-unknown', { setting: 'budget', value, accepted: '1, 2, 3, …' }), value);
    assert.equal(snapshot(root), before, value);
    const t = freshProject(config);
    const beforeOpen = snapshot(t.main);
    const r = openRun(t.main, 'new-thing');
    assert.equal(r.code, 3, value);
    assert.equal(body(r).reply, b.reply, 'the reply is the one the typed command gives');
    assert.equal(snapshot(t.main), beforeOpen, value);
  }
});

test('change-budget AC-8 an invalid change budget makes next exit 3 with the settings reply and no hand-off', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/changes/feat/.openspec.yaml': block('budget: 0') });
  commitAll(root, 'zero budget');
  const r = next(root);
  assert.equal(r.code, 3, r.stderr);
  assert.equal(r.stdout.startsWith('devkit-run:'), false);
  const out = body(r);
  assert.equal(out.reply, render('en', 'setting-unknown', { setting: 'budget', value: '0', accepted: '1, 2, 3, …' }));
  assert.equal('kind' in out, false, 'no hand-off');
});

test('change-budget AC-8 an invalid project budget makes next exit 3 even under a valid change value', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/config.yaml': block('budget: abc'), 'openspec/changes/feat/.openspec.yaml': block('budget: 500') });
  commitAll(root, 'bad project budget');
  const r = next(root);
  assert.equal(r.code, 3, r.stderr);
  assert.equal(body(r).reply, render('en', 'setting-unknown', { setting: 'budget', value: 'abc', accepted: '1, 2, 3, …' }));
});

test('change-budget AC-8 the settings reply names budget and the value in both languages', () => {
  for (const lang of ['en', 'pt-BR']) {
    const reply = render(lang, 'setting-unknown', { setting: 'budget', value: '2e6', accepted: '1, 2, 3, …' });
    assert.ok(reply.includes('budget') && reply.includes('2e6') && reply.includes('1, 2, 3'), `${lang}: ${reply}`);
    assert.throws(() => capOf(block('budget: 2e6'), null, lang), (e) => e.name === 'LoopRefusal' && e.reply === reply, lang);
  }
});

test('release-tags 1: /devkit change refuses a release_tag that is not a path to a JSON file', () => {
  const accepted = 'a path from the repository root to a JSON file, such as package.json';
  for (const value of ['/abs.json', '../x.json', 'x.yaml', '[a.json]', 'a b.json']) {
    const config = `schema: devkit\ndevkit:\n  release_tag: ${value}\n`;
    for (const [lang, name] of [['en', 'release file'], ['pt-BR', 'arquivo da versão']]) {
      const root = devkitRepo(config);
      const before = snapshot(root);
      const b = body(startRun(root, 'change add an export', { lang }));
      assert.equal(b.mode, 'setting-unknown', `${lang} ${value}`);
      assert.equal(b.reply, render(lang, 'setting-unknown', { setting: 'release-tag', value, accepted }), `${lang} ${value}`);
      assert.ok(b.reply.includes(name) && b.reply.includes(value), `${lang}: ${b.reply}`);
      assert.equal(snapshot(root), before, `${lang} ${value}`);
      const t = freshProject(config);
      const beforeOpen = snapshot(t.main);
      const r = openRun(t.main, 'new-thing', { lang });
      assert.equal(r.code, 3, `${lang} ${value}`);
      assert.equal(body(r).reply, b.reply, 'the reply is the one the typed command gives');
      assert.equal(snapshot(t.main), beforeOpen, `${lang} ${value}`);
    }
  }
});

// ---- the decision (D-4)

const AT_PLAN = () => ({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } } });
const BUDGET_FILE = '/w/feat/openspec/changes/feat/.openspec.yaml';
const withBudget = (spent, cap = 2000000) => ({ budget: { cap, file: BUDGET_FILE, spent } });

test('change-budget AC-1 at the cap an agent hand-off becomes the budget end', () => {
  const held = run(AT_PLAN());
  assert.equal(held.kind, 'agent');
  const a = run({ ...AT_PLAN(), facts: withBudget(2000000) });
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-budget', 1]);
  assert.deepEqual(a.params, { id: 'feat', spent: 2000000, cap: 2000000, file: BUDGET_FILE });
  assert.deepEqual(a.detail.held, { kind: 'agent', stage: 'proposal', step: null, agent: PLANNER });
  assert.equal(a.stage, 'proposal');
  assert.equal(a.reply, says('waiting-budget', { spent: 2000000, cap: 2000000, file: BUDGET_FILE }));
});

test('change-budget AC-1 above the cap a session step becomes the budget end', () => {
  const lite = FLOWS['devkit-lite'];
  const rep = { schema: 'devkit-lite', next: nextOf(lite, 'proposal', 'no-file') };
  const over = { flow: lite, ctx: { script: 'devkit-lite' }, report: reportOf(lite, rep), facts: { flags: ['ui'], ...withBudget(2100000) } };
  const a = run(over);
  assert.deepEqual(shape(a), ['end', 'waiting-for-owner', 'waiting-budget', 1]);
  assert.deepEqual([a.detail.held.kind, a.detail.held.step], ['session', 'switch-script']);
  assert.equal(a.params.spent, 2100000);
});

test('change-budget AC-3 under the cap the action is the one given with no budget (kept)', () => {
  const plain = run(AT_PLAN());
  assert.deepEqual(run({ ...AT_PLAN(), facts: withBudget(1999999) }), plain);
  assert.deepEqual(run({ ...AT_PLAN(), facts: { budget: null } }), plain);
});

test('change-budget AC-9 a spend of null holds nothing (kept)', () => {
  assert.deepEqual(run({ ...AT_PLAN(), facts: withBudget(null) }), run(AT_PLAN()));
});

test('change-budget AC-1 the grill and the ends are not held (kept)', () => {
  const over = withBudget(9000000);
  const grill = run({ rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file') }, facts: over });
  assert.equal(grill.kind, 'grill');
  const approval = run({ rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') }, facts: over });
  assert.equal(approval.end.state, 'waiting-for-owner');
  assert.notEqual(approval.end.why, 'waiting-budget');
  const blockedEnd = run({ rep: { next: nextOf(FLOWS.devkit, 'open', 'no-file', { file: '.openspec.yaml' }), stages: { open: { state: 'pending', reasonCode: 'no-file' } } }, facts: over });
  assert.equal(blockedEnd.end.why, 'not-opened');
  const archived = run({ rep: { end: endOf('archived', null, 'archived') }, facts: over });
  assert.equal(archived.end.state, 'archived');
});

test('change-budget AC-1 a no-progress end wins over the budget (kept)', () => {
  const stuck = run({ ...AT_PLAN(), facts: { after: 'proposal/proposal@abc123', ...withBudget(9000000) } });
  assert.deepEqual([stuck.end.state, stuck.end.why], ['blocked', 'no-progress']);
});

// ---- next (D-4, D-5)

// A `feat` change at its plan stage with a cap, and a session transcript of `spent` tokens after its run line.
function cappedRun({ cap, spent, project = null, lines = null } = {}) {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const files = { 'openspec/changes/feat/.openspec.yaml': cap === null ? 'schema: devkit\n' : block(`budget: ${cap}`) };
  if (project !== null) files['openspec/config.yaml'] = block(`budget: ${project}`);
  put(root, files);
  commitAll(root, 'budget');
  const env = budgetEnv(sandbox(), 'sess-budget', lines ?? [typedLine('change feat'), runLine('feat'), usageLine({ id: 'a', input: spent })]);
  return { root, env, file: join(root, 'openspec', 'changes', 'feat', '.openspec.yaml') };
}

test('change-budget AC-1 next at the cap prints the run line and the end line and exits 1', () => {
  const t = cappedRun({ cap: 1000, spent: 1000 });
  const r = next(t.root, [], t.env);
  assert.equal(r.code, 1, r.stderr);
  const lines = r.stdout.split('\n');
  assert.deepEqual(lines.slice(0, 2), ['devkit-run: feat', 'devkit-end: feat waiting-for-owner']);
  const action = actionOf(r.stdout);
  assert.deepEqual([action.end.state, action.end.why, action.stage], ['waiting-for-owner', 'waiting-budget', 'proposal']);
  assert.deepEqual([action.params.spent, action.params.cap, action.params.file], [1000, 1000, t.file]);
});

test('change-budget AC-2 the reply says the spend, the cap, the file, budget and /devkit change in both languages', () => {
  const t = cappedRun({ cap: 1000, spent: 1200 });
  for (const lang of ['en', 'pt-BR']) {
    const r = main(['next', '--change', 'feat', '--lang', lang], { cwd: t.root, env: t.env });
    const { reply } = actionOf(r.stdout);
    assert.equal(reply, render(lang, 'waiting-budget', { id: 'feat', spent: 1200, cap: 1000, file: actionOf(r.stdout).params.file }), lang);
    for (const part of ['feat', '1200', '1000', actionOf(r.stdout).params.file, 'budget', '/devkit change']) assert.ok(reply.includes(part), `${lang} names ${part}: ${reply}`);
  }
  assert.ok(actionOf(next(t.root, [], t.env).stdout).params.file.endsWith('/openspec/changes/feat/.openspec.yaml'));
  assert.match(MESSAGES['pt-BR']['waiting-budget'], /orçamento/);
});

test('change-budget AC-6 a raised cap in the change file gives back the held hand-off', () => {
  const t = cappedRun({ cap: 1000, spent: 1500 });
  const held = actionOf(next(t.root, [], t.env).stdout).detail.held;
  put(t.root, { 'openspec/changes/feat/.openspec.yaml': block('budget: 5000') });
  const r = next(t.root, [], t.env);
  assert.equal(r.code, 0, r.stderr);
  const action = actionOf(r.stdout);
  assert.deepEqual([action.kind, action.agent, action.stage], [held.kind, held.agent, held.stage]);
});

test('change-budget AC-6 an unchanged cap stops again', () => {
  const t = cappedRun({ cap: 1000, spent: 1500 });
  for (let i = 0; i < 2; i += 1) {
    const r = next(t.root, [], t.env);
    assert.deepEqual([r.code, actionOf(r.stdout).end.why], [1, 'waiting-budget']);
  }
});

test('change-budget AC-4 with no budget next prints the same output with and without a session transcript, and reads none (kept)', () => {
  const t = cappedRun({ cap: null, spent: 5000000 });
  const spy = readCounter();
  const transcript = join(t.env.CLAUDE_CONFIG_DIR, 'projects', 'p', 'sess-budget.jsonl');
  const run = (env) => spawnSync(process.execPath, [LOOP, 'next', '--change', 'feat', '--lang', 'en'], { cwd: t.root, env, encoding: 'utf8' });
  const withTranscript = run({ ...t.env, ...spy.env(transcript) });
  const without = run(cleanEnv);
  assert.equal(withTranscript.status, 0, withTranscript.stderr);
  assert.equal(withTranscript.stdout, without.stdout);
  assert.equal(spy.reads(), 0, 'the transcript was not read');
});

test('change-budget AC-9 with a cap and no session id, or a folder for the transcript, next hands the stage (kept)', () => {
  const t = cappedRun({ cap: 1, spent: 999 });
  const noId = next(t.root, [], { ...t.env, CLAUDE_CODE_SESSION_ID: '' });
  assert.deepEqual([noId.code, actionOf(noId.stdout).kind], [0, 'agent']);
  const dir = sandbox();
  const env = budgetEnv(dir, 'sess-dir');
  rmSync(join(dir, 'projects', 'p', 'sess-dir.jsonl'));
  mkdirSync(join(dir, 'projects', 'p', 'sess-dir.jsonl'));
  const asDir = next(t.root, [], env);
  assert.deepEqual([asDir.code, actionOf(asDir.stdout).kind], [0, 'agent']);
});

test('change-budget AC-5 next on two changes uses each one cap', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  put(root, { 'openspec/config.yaml': block('budget: 2000000'), 'openspec/changes/feat/.openspec.yaml': block('budget: 500'), 'openspec/changes/other/.openspec.yaml': 'schema: devkit\n', 'openspec/changes/other/requirements.md': '# requirements\n' });
  commitAll(root, 'two changes');
  const env = budgetEnv(sandbox(), 'sess-two', [typedLine('change feat'), runLine('feat'), runLine('other'), usageLine({ id: 'a', input: 1000 })]);
  const feat = main(['next', '--change', 'feat', '--lang', 'en'], { cwd: root, env });
  assert.equal(actionOf(feat.stdout).end?.why, 'waiting-budget', 'feat has the cap of 500');
  const other = main(['next', '--change', 'other', '--lang', 'en'], { cwd: root, env });
  assert.notEqual(actionOf(other.stdout).end?.why, 'waiting-budget', 'other keeps the project cap of 2000000');
});

test('change-budget AC-1 nextAction without the option applies no cap (kept)', () => {
  const t = cappedRun({ cap: 1, spent: 999 });
  const action = changeLoopModule.nextAction(t.root, 'feat', { env: t.env, lang: 'en' });
  assert.equal(action.kind, 'agent');
});

test('change-budget AC-1 the stop hook lets the turn end at the first attempt on the budget output', () => {
  const t = cappedRun({ cap: 1000, spent: 1000 });
  const r = next(t.root, [], t.env);
  assert.equal(r.code, 1, r.stderr);
  const transcript = transcriptOf([typedLine('change feat'), toolResultLine(r.stdout)]);
  const stop = hook('stop', stopInput(t.root, transcript), { TMPDIR: sandbox() });
  assert.equal(stop.code, 0, stop.err);
});

// ---- the docs (D-10)

test('change-budget AC-10 docs/openspec-flow.md describes the budget', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  const at = flow.indexOf('**The token budget.**');
  assert.ok(at >= 0, 'the paragraph exists');
  const part = flow.slice(at, flow.indexOf('\n\n', flow.indexOf('\n\n', at) + 2));
  const whole = flow.slice(at, at + 4000);
  assert.match(part, /`budget:`/);
  assert.match(whole, /devkit:` block of `openspec\/config\.yaml`/);
  assert.match(whole, /\.openspec\.yaml/);
  assert.match(whole, /input_tokens/);
  assert.match(whole, /output_tokens/);
  assert.match(whole, /cache_creation_input_tokens/);
  assert.match(whole, /cache_read_input_tokens/);
  assert.match(whole, /waiting for the owner|waits for the owner/);
  assert.match(whole, /`\/devkit change` again/);
  assert.match(flow, /\*\*The settings\.\*\*/);
});

// ---------------------------------------------------------------- change-state: phase 1, the state, the GitHub rule and the title (design D-1, D-2, D-4, D-5)

const { changeState, runFactsOf, githubSilent, sessionTitle: titleOf, STATE_ICON } = changeLoopModule;
const stateOf = (action, facts = null, opts = {}) => changeState(action, facts, { lang: 'en', ...opts });
const planStage = (over = {}) => run({ ...over, rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } } });
const grillOf = (over = {}) => run({ ...over, rep: { next: nextOf(FLOWS.devkit, 'requirements', 'no-file') } });
const approvalEnd = (over = {}) => run({ ...over, rep: { end: endOf('waiting-for-owner', 'approval', 'owner-pending') } });
const silentEnd = (code = 'gh-error', over = {}) => run({ ...over, rep: { end: endOf('blocked', 'delivery', code, { error: 'HTTP 502' }) }, facts: { row: rowOf('implement', { phase: 1 }) } });
const ceilingEnd = (over = {}) => run({ ...over, rep: { end: endOf('blocked', 'readiness', 'ceiling-reached', { stage: 'readiness', attempt: 3, ceiling: 3 }) } });
// An end the stage checker could not give today: handwritten, so the table of the gates is tested on its own.
const ownerEnd = (why) => ({ version: 1, change: 'feat', kind: 'end', stage: 'approval', stageTitle: 'Owner\'s approval', end: { state: 'waiting-for-owner', why }, params: { id: 'feat' } });

test('change-state AC-3 state: an agent and a session step are running with no reason', () => {
  const session = build(rowOf('enable-auto-merge', { number: 12 }));
  assert.equal(session.kind, 'session');
  for (const [label, action] of [['an agent', planStage()], ['a session step', session]]) {
    const s = stateOf(action);
    assert.deepEqual([s.state, s.reason, s.stateIcon], ['running', null, null], label);
    assert.deepEqual([s.stage, s.stageTitle], [action.stage, action.stageTitle], `${label}: the stage is the action's`);
  }
});

test('change-state AC-3 state: the grill waits for the owner with the reason grill', () => {
  const s = stateOf(grillOf());
  assert.equal(s.state, 'waiting-for-owner');
  assert.deepEqual(s.reason, { code: 'grill', text: 'your answers about its request' });
  assert.deepEqual([s.stage, s.stageIcon, s.stateIcon], ['requirements', '❓', '🙋']);
});

test('change-state AC-3 state: each end waiting for the owner keeps its why as the reason, with its gate phrase', async (t) => {
  const gates = {
    'waiting-approval': 'approval', 'waiting-approval-again': 'approval', 'waiting-retro': 'retro', 'waiting-merge': 'merge', 'waiting-archive-merge': 'merge',
    'waiting-review-dispute': 'dispute', 'waiting-unrun-stage': 'stage', 'waiting-by-hand': 'by-hand', 'waiting-pr-decision': 'decision',
  };
  for (const [why, gate] of Object.entries(gates)) {
    await t.test(why, () => {
      const s = stateOf(ownerEnd(why));
      assert.equal(s.state, 'waiting-for-owner');
      assert.deepEqual(s.reason, { code: why, text: MESSAGES.en[`gate.${gate}`] });
    });
  }
  // The same end as decide gives it.
  assert.deepEqual(stateOf(approvalEnd()).reason, { code: 'waiting-approval', text: 'your approval of the plan' });
});

test('change-state AC-3 state: an unknown wait for the owner throws', () => {
  assert.throws(() => stateOf(ownerEnd('waiting-nothing-we-know')), LoopUsageError);
});

test('change-state AC-3 state: each wait on GitHub takes what it waits for as the reason', async (t) => {
  const cases = {
    checks: [build(rowOf('wait-checks', { pending: ['build'] })), 'the checks of the pull request'],
    merge: [build(rowOf('wait-merge', { number: 12 })), 'the merge of the pull request'],
    'archive-merge': [build(rowOf('wait-merge', { number: 12 }), { archiving: true }), 'the merge of the archive pull request'],
    silent: [silentEnd(), 'GitHub did not answer'],
  };
  for (const [what, [action, text]] of Object.entries(cases)) {
    await t.test(what, () => {
      const s = stateOf(action);
      assert.equal(s.state, 'waiting-on-github');
      assert.deepEqual(s.reason, { code: what, text });
      assert.equal(s.stateIcon, '⏳');
    });
  }
});

test('change-state AC-3 state: each blocked reason decide gives is the reason, with its phrase and details', async (t) => {
  const notDelivered = run({
    facts: { after: 'proposal/proposal@000000000000' },
    rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file'), stages: { proposal: { state: 'pending', reasonCode: 'no-file' } } },
  });
  const cases = {
    ceiling: ceilingEnd(),
    'no-progress': run({ rep: { end: endOf('blocked', 'proposal', 'no-progress', { stage: 'proposal' }) } }),
    'not-delivered': notDelivered,
    'pr-closed': run({ rep: { end: endOf('blocked', 'delivery', 'pr-closed', { number: 12 }) } }),
    'previous-script': run({ report: { ...reportOf(FLOWS.devkit, {}), script: 'previous', stages: [], previous: { finishedBy: 'ship-change' } } }),
    'not-opened': run({ rep: { next: nextOf(FLOWS.devkit, 'open', 'no-file', { file: '.openspec.yaml' }), stages: { open: { state: 'pending', reasonCode: 'no-file' } } } }),
    'wrong-branch': build(rowOf('stop-branch')),
    'merge-setup': build(rowOf('stop-merge-setup')),
    'archive-failed': build(rowOf('stop-archive')),
    'tag-elsewhere': build(rowOf('stop-archive', { archiveStep: 'tag-release', tag: 'v1.3.0', at: 'd4e5f60abc', sha: 'a1b2c3dabc', number: 12 })),
    'plan-not-approved': build(rowOf('stop-not-approved')),
    'pr-problem': build(rowOf('blocked')),
    'unknown-step': run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'something-new') } }),
    unreadable: run({ rep: buildRep(), facts: { row: { error: 'boom' } } }),
  };
  for (const [why, action] of Object.entries(cases)) {
    await t.test(why, () => {
      assert.equal(action.end.why, why, 'the fixture is the end decide gives');
      const s = stateOf(action);
      assert.equal(s.state, 'blocked');
      assert.equal(s.reason.code, why);
      assert.ok(action.reply.includes(s.reason.text), `the phrase "${s.reason.text}" is the one inside the reply`);
      assert.equal(s.stateIcon, '⛔');
    });
  }
  assert.equal(stateOf(cases.ceiling).reason.text, 'the plan readiness failed 3 times, which is its limit');
  assert.equal(stateOf(cases['pr-closed']).reason.text, 'pull request #12 was closed without merging');
  assert.equal(stateOf(cases.unreadable).reason.text, 'the change cannot be read (boom)');
});

test('change-state AC-3 state: the drawn mock-up waits for the owner with its gate phrase, as an end and as a declared wait', () => {
  const a = run({ rep: { end: endOf('waiting-for-owner', 'mockup', 'owner-pending'), stages: { mockup: { state: 'pending', reasonCode: 'not-judged' } } } });
  assert.equal(a.end.why, 'waiting-mockup', 'the fixture is the end decide gives');
  const s = stateOf(a);
  assert.equal(s.state, 'waiting-for-owner');
  assert.deepEqual(s.reason, { code: 'waiting-mockup', text: 'your approval of the mock-up' });
  assert.deepEqual([s.stage, s.stageIcon, s.stateIcon, s.title], ['mockup', '📝', '🙋', '🙋 📝 feat']);
  assert.equal(changeLoopModule.gateOf(a), 'mockup');
  const facts = { sessionMode: true, started: true, inflight: null, declared: { state: 'waiting-for-owner', why: 'waiting-mockup', params: {} }, waits: false };
  assert.deepEqual(stateOf(a, facts).reason, { code: 'waiting-mockup', text: 'your approval of the mock-up' });
});

test('change-budget AC-1 state: the budget end waits for the owner with its gate phrase, as an end and as a declared wait', () => {
  const a = run({ ...AT_PLAN(), facts: withBudget(2000000) });
  assert.equal(a.end.why, 'waiting-budget', 'the fixture is the end decide gives');
  const s = stateOf(a);
  assert.equal(s.state, 'waiting-for-owner');
  assert.deepEqual(s.reason, { code: 'waiting-budget', text: 'a higher token budget' });
  assert.equal(s.stateIcon, '🙋');
  assert.equal(changeLoopModule.gateOf(a), 'budget');
  const facts = { sessionMode: true, started: true, inflight: null, declared: { state: 'waiting-for-owner', why: 'waiting-budget', params: {} }, waits: false };
  assert.deepEqual(stateOf(a, facts).reason, { code: 'waiting-budget', text: 'a higher token budget' });
  assert.equal(stateOf(a, facts, { lang: 'pt-BR' }).reason.text, 'um orçamento de tokens maior');
});

test('change-state AC-3 state: a stage role of the decisions stage has its icon', () => {
  assert.equal(stateOf({ kind: 'agent', change: 'feat', stage: 'decisions' }).title, '📝 feat');
  assert.equal(stateOf({ kind: 'agent', change: 'feat', stage: 'mockup' }).title, '📝 feat');
});

test('change-state AC-3 state: a blocked end the stage roles added keeps its why with a filled phrase in both languages', async (t) => {
  const params = { error: 'boom', list: 'build', base: 'main', number: 7, stage: 'proposal' };
  for (const why of ['cannot-accept', 'checks-failing', 'merge-setup-missing', 'branch-conflict', 'archive-refused', 'undeclared-stage']) {
    await t.test(why, () => {
      for (const lang of ['en', 'pt-BR']) {
        const s = changeState({ kind: 'end', change: 'feat', stage: 'delivery', end: { state: 'blocked', why }, params }, null, { lang });
        assert.equal(s.state, 'blocked');
        assert.equal(s.reason.code, why);
        assert.ok(s.reason.text && !/[{}]/.test(s.reason.text), `${lang}: ${s.reason.text}`);
      }
    });
  }
});

test('change-state AC-3 state: an archived end has no reason', () => {
  const archived = run({ report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } });
  const s = stateOf(archived);
  assert.deepEqual([s.state, s.reason, s.stage, s.stageIcon, s.stateIcon], ['archived', null, null, '📦', '📦']);
});

test('change-state AC-3 state: the phrase is in the person\'s language and the code is not', () => {
  const cases = { owner: approvalEnd(), blocked: ceilingEnd(), github: build(rowOf('wait-checks', { pending: ['build'] })) };
  for (const [label, action] of Object.entries(cases)) {
    const en = stateOf(action);
    const pt = changeState(action, null, { lang: 'pt-BR' });
    assert.equal(pt.reason.code, en.reason.code, `${label}: the code is the same`);
    assert.notEqual(pt.reason.text, en.reason.text, `${label}: the phrase is not`);
  }
  assert.equal(changeState(cases.owner, null, { lang: 'pt-BR' }).reason.text, MESSAGES['pt-BR']['gate.approval']);
  assert.equal(changeState(cases.github, null, { lang: 'pt-BR' }).reason.text, MESSAGES['pt-BR']['what.checks']);
  assert.equal(changeState(cases.owner, null, { lang: 'fr' }).reason.text, MESSAGES['pt-BR']['gate.approval'], 'an unknown language is pt-BR, as everywhere');
});

test('change-state AC-4 facts: runFactsOf reads each field of the run file', async (t) => {
  const file = (over = {}) => ({ changeSessions: true, startedSessions: {}, inflight: {}, declared: {}, announced: {}, starting: [], ...over });
  await t.test('sessionMode needs the run\'s mode and the roadmap line', () => {
    assert.equal(runFactsOf(file(), 'a', { onRoadmap: true }).sessionMode, true);
    assert.equal(runFactsOf(file(), 'a', { onRoadmap: false }).sessionMode, false, 'no roadmap line');
    assert.equal(runFactsOf(file({ changeSessions: false }), 'a', { onRoadmap: true }).sessionMode, false, 'no session per change');
  });
  await t.test('started is a record of the run file or the key session-start of this call', () => {
    assert.equal(runFactsOf(file({ startedSessions: { a: { at: null } } }), 'a', {}).started, true);
    assert.equal(runFactsOf(file({ after: { a: 'session-start' } }), 'a', {}).started, true);
    assert.equal(runFactsOf(file({ startedSessions: { b: { at: null } }, after: { a: 'implementation/x@1', b: 'session-start' } }), 'a', {}).started, false);
  });
  await t.test('inflight is the stage under way, cleared by a key of `after`', () => {
    const under = { kind: 'agent', stage: 'design', agentType: 'x', at: 't' };
    assert.deepEqual(runFactsOf(file({ inflight: { a: under } }), 'a', {}).inflight, under);
    assert.equal(runFactsOf(file({ inflight: { a: under }, after: { a: 'design/design@1' } }), 'a', {}).inflight, null);
    assert.equal(runFactsOf(file({ inflight: { b: under } }), 'a', {}).inflight, null);
  });
  await t.test('declared is the end the session declared, or null', () => {
    const d = { state: 'blocked', why: 'pr-problem', params: {} };
    assert.deepEqual(runFactsOf(file({ declared: { a: d } }), 'a', {}).declared, d);
    assert.equal(runFactsOf(file({ declared: { b: d } }), 'a', {}).declared, null);
  });
  await t.test('waits is starting or an announced wait for a turn or a place, and nothing else', () => {
    assert.equal(runFactsOf(file({ starting: ['a'] }), 'a', {}).waits, true);
    assert.equal(runFactsOf(file({ announced: { a: 'waits-turn' } }), 'a', {}).waits, true);
    assert.equal(runFactsOf(file({ announced: { a: 'waits-refused' } }), 'a', {}).waits, true);
    assert.equal(runFactsOf(file({ announced: { a: 'archived' } }), 'a', {}).waits, false);
    assert.equal(runFactsOf(file(), 'a', {}).waits, false);
  });
});

test('change-state AC-4 state: S1 to S8 each give their state', async (t) => {
  const F = (over = {}) => ({ sessionMode: false, started: false, inflight: null, declared: null, waits: false, ...over });
  const plan = planStage();
  const owner = approvalEnd();
  const standIn = { kind: 'none', change: 'x', stage: 'open', stageTitle: 'Open the change' };
  const reasonOf = (s) => (s.reason ? s.reason.code : null);
  await t.test('S1 a session per change and a declared end: the declared end', () => {
    const blockedEnd = { state: 'blocked', why: 'ceiling', params: { stage: 'Plan readiness', attempt: 3 } };
    const s = stateOf(plan, F({ sessionMode: true, started: true, declared: blockedEnd, inflight: { kind: 'agent', stage: 'design' } }));
    assert.deepEqual([s.state, reasonOf(s), s.reason.text, s.stage], ['blocked', 'ceiling', 'the plan readiness failed 3 times, which is its limit', 'proposal']);
    const waits = stateOf(null, F({ sessionMode: true, declared: { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: {} } }), { id: 'x' });
    assert.deepEqual([waits.state, reasonOf(waits), waits.reason.text, waits.stage], ['waiting-for-owner', 'waiting-pr-decision', 'a decision only you can take', null]);
    const named = stateOf(null, F({ sessionMode: true, declared: { state: 'waiting-for-owner', why: 'waiting-pr-decision', params: { gate: 'merge' } } }), { id: 'x' });
    assert.equal(named.reason.text, 'your merge of its pull request', 'the declared gate wins');
    assert.equal(waits.title, '🙋 x', 'the id of the options is the title\'s when there is no action');
  });
  await t.test('S2 a session of its own: the action says', () => {
    const running = stateOf(plan, F({ sessionMode: true, started: true }));
    assert.deepEqual([running.state, running.reason, running.stage], ['running', null, 'proposal']);
    assert.equal(stateOf(owner, F({ sessionMode: true, started: true })).state, 'waiting-for-owner');
    const none = stateOf(null, F({ sessionMode: true, started: true }), { id: 'x' });
    assert.deepEqual([none.state, none.reason, none.stage, none.title], ['running', null, null, null]);
  });
  await t.test('S3 a session per change and no session of its own yet: running, ready', () => {
    const s = stateOf(plan, F({ sessionMode: true }));
    assert.deepEqual([s.state, s.reason, s.stage, s.title], ['running', { code: 'ready', text: 'ready, waiting for someone to continue' }, 'proposal', '📝 feat']);
    assert.equal(stateOf(owner, F({ sessionMode: true })).reason.code, 'ready', 'whatever the action says');
  });
  await t.test('S4 a stage waiting on GitHub in flight: waiting on GitHub, what from the action, the run, then the merge', () => {
    assert.deepEqual(stateOf(null, F({ inflight: { kind: 'wait', what: 'checks' } }), { id: 'x' }).reason, { code: 'checks', text: 'the checks of the pull request' });
    assert.equal(stateOf(silentEnd(), F({ inflight: { kind: 'agent', stage: 'delivery' } })).reason.code, 'silent', 'an action that waits on GitHub wins');
    assert.equal(stateOf(null, F({ inflight: { kind: 'wait' } }), { id: 'x' }).reason.code, 'merge');
    assert.equal(stateOf(plan, F({ inflight: { kind: 'wait', what: 'checks' } })).state, 'waiting-on-github', 'the in-flight wait wins over the action');
  });
  await t.test('S5 a stage in flight: running, the action\'s stage or the one in flight', () => {
    const own = stateOf(plan, F({ inflight: { kind: 'agent', stage: 'design' } }));
    assert.deepEqual([own.state, own.reason, own.stage, own.stageTitle], ['running', null, 'proposal', plan.stageTitle]);
    const none = stateOf(null, F({ inflight: { kind: 'agent', stage: 'design' } }), { id: 'x' });
    assert.deepEqual([none.state, none.reason, none.stage, none.stageTitle, none.stageIcon], ['running', null, 'design', 'design', '📝']);
    assert.equal(stateOf(owner, F({ inflight: { kind: 'agent', stage: 'design' } })).state, 'running', 'in flight wins over a wait for the owner');
  });
  await t.test('S6 a declared end outside a session per change: the declared end', () => {
    const s = stateOf(plan, F({ declared: { state: 'blocked', why: 'pr-problem', params: {} } }));
    assert.deepEqual([s.state, reasonOf(s), s.stage], ['blocked', 'pr-problem', 'proposal']);
  });
  await t.test('S7 a start that waits for a place, a stand-in or no action: running, ready', () => {
    assert.equal(reasonOf(stateOf(plan, F({ waits: true }))), 'ready');
    const stand = stateOf(standIn, F());
    assert.deepEqual([stand.state, reasonOf(stand), stand.stage, stand.stageIcon, stand.title], ['running', 'ready', 'open', '❓', '❓ x']);
    assert.equal(reasonOf(stateOf(null, F(), { id: 'x' })), 'ready');
  });
  await t.test('S8 otherwise: the action says', () => {
    assert.equal(stateOf(owner, F()).state, 'waiting-for-owner');
    const s = stateOf(plan, F());
    assert.deepEqual([s.state, s.reason], ['running', null]);
  });
  await t.test('outside a roadmap run the state is the action\'s, with no ready', () => {
    assert.deepEqual([stateOf(plan).state, stateOf(plan).reason], ['running', null]);
    assert.deepEqual([stateOf(null, null, { id: 'x' }).state, stateOf(null, null, { id: 'x' }).reason], ['running', null]);
  });
});

test('change-state AC-5 decide: the pull request that cannot be read is a wait on GitHub, GitHub did not answer', () => {
  const a = silentEnd('gh-error');
  assert.deepEqual(shape(a), ['end', 'waiting-on-github', 'waiting-github', 1]);
  assert.equal(a.params.what, 'silent');
  assert.equal(a.detail.error, 'HTTP 502');
  assert.equal(a.reply, says('waiting-github', { what: 'silent' }));
  assert.match(a.reply, /GitHub did not answer/);
  // The plan part reads the same end the same way.
  const plan = run({ rep: { end: endOf('blocked', 'proposal', 'gh-error', { error: 'HTTP 502' }) } });
  assert.deepEqual(shape(plan), ['end', 'waiting-on-github', 'waiting-github', 1]);
});

test('change-state AC-5 decide: checks that cannot be read are a wait on GitHub, GitHub did not answer', () => {
  const a = silentEnd('checks-unreadable');
  assert.deepEqual(shape(a), ['end', 'waiting-on-github', 'waiting-github', 1]);
  assert.equal(a.params.what, 'silent');
  assert.equal(a.detail.error, 'HTTP 502');
  assert.equal(a.reply, says('waiting-github', { what: 'silent' }));
});

test('change-state AC-5 decide: a ceiling and a closed pull request still block', () => {
  const ceiling = run({ rep: { end: endOf('blocked', 'delivery', 'ceiling-reached', { stage: 'review', attempt: 3, ceiling: 3 }) }, facts: { row: rowOf('implement', { phase: 1 }) } });
  assert.deepEqual(shape(ceiling), ['end', 'blocked', 'ceiling', 2]);
  const closed = run({ rep: { end: endOf('blocked', 'delivery', 'pr-closed', { number: 12 }) }, facts: { row: rowOf('implement', { phase: 1 }) } });
  assert.deepEqual(shape(closed), ['end', 'blocked', 'pr-closed', 2]);
});

test('change-state AC-5 githubSilent: true only for the two GitHub ends of the stage checker', async (t) => {
  const cases = [
    ['gh-error', endOf('blocked', 'delivery', 'gh-error', { error: 'x' }), true],
    ['checks-unreadable', endOf('blocked', 'delivery', 'checks-unreadable', { error: 'x' }), true],
    ['pr-closed', endOf('blocked', 'delivery', 'pr-closed', { number: 1 }), false],
    ['ceiling-reached', endOf('blocked', 'delivery', 'ceiling-reached', {}), false],
    ['a waiting end with the same code', endOf('waiting-on-github', 'delivery', 'gh-error', {}), false],
    ['null', null, false],
  ];
  for (const [label, end, wanted] of cases) await t.test(label, () => assert.equal(githubSilent(end), wanted));
});

test('change-state AC-5 where: whereOf says waiting on GitHub when GitHub did not answer', () => {
  const { wt, gh, env } = deliveredChange();
  const found = { root: wt, branch: 'feat' };
  assert.equal(changeLoopModule.whereOf(found, 'feat', { lang: 'en', env }), 'waiting on GitHub', 'the checks are pending');
  gh.set('pr-view', { exit: 1, stderr: 'HTTP 502: bad gateway\n' });
  assert.equal(changeLoopModule.whereOf(found, 'feat', { lang: 'en', env }), 'waiting on GitHub', 'GitHub did not answer');
});

const silentAction = () => silentEnd('gh-error');

test('change-state AC-5 wait: a silent wait counts as a failed read and three end blocked quoting the error', async () => {
  const silent = silentAction();
  assert.equal(silent.end.state, 'waiting-on-github', 'the fixture is a wait');
  const out = await waited([WAIT, silent, silent, silent]);
  assert.deepEqual([out.action.kind, out.action.end, out.action.change], ['end', { state: 'blocked', why: 'github-unreadable' }, 'feat']);
  assert.equal(out.action.reply, render('en', 'blocked', { id: 'feat', why: 'github-unreadable', error: 'HTTP 502' }));
  assert.equal(out.polls, 4, 'it stopped at the third failed read in a row');
  const kept = await waited([WAIT, silent, silent, WAIT, silent, silent, build(rowOf('enable-auto-merge', { number: 12 }))]);
  assert.equal(kept.action.step, 'enable-auto-merge', 'two in a row, then an answer, keeps waiting');
});

test('change-state AC-5 wait: a first decision that is silent waits, and GitHub answering ends the wait with the new decision', async () => {
  const silent = silentAction();
  assert.equal(silent.end.state, 'waiting-on-github', 'the fixture is a wait');
  const answered = await waited([silent, WAIT]);
  assert.deepEqual(answered.action, WAIT);
  assert.equal(answered.polls, 2);
  const changed = build(rowOf('enable-auto-merge', { number: 12 }));
  const later = await waited([silent, silent, changed]);
  assert.deepEqual(later.action, changed);
  assert.equal(later.polls, 3);
});

test('change-state AC-5 wait: the blocked form project-loop gives still counts as a failed read', async () => {
  const unreadable = {
    version: 1, change: 'feat', script: 'devkit', root: '/w/feat', branch: 'feat', filesLanguage: 'en', kind: 'end', stage: 'delivery', stageTitle: 'Delivery', role: null, skills: [],
    end: { state: 'blocked', why: 'github-unreadable' }, params: { id: 'feat', why: 'github-unreadable', error: 'HTTP 502' },
    reply: render('en', 'blocked', { id: 'feat', why: 'github-unreadable', error: 'HTTP 502' }),
  };
  const out = await waited([WAIT, unreadable, unreadable, unreadable]);
  assert.deepEqual(out.action.end, { state: 'blocked', why: 'github-unreadable' });
  assert.equal(out.polls, 4);
});

test('change-state AC-7 title: a running change is its stage icon and its id', () => {
  assert.equal(stateOf(planStage()).title, '📝 feat');
  assert.equal(stateOf(build(rowOf('enable-auto-merge', { number: 12 }))).title, '🚀 feat');
  assert.equal(stateOf({ kind: 'agent', change: 'feat', stage: 'nope' }).title, null, 'no stage icon, no title');
});

test('change-state AC-7 title: waiting for the owner is 🙋, a space, the stage icon and the id', () => {
  assert.equal(stateOf(grillOf()).title, '🙋 ❓ feat');
  assert.equal(stateOf(approvalEnd()).title, '🙋 📝 feat');
  assert.equal(titleOf('📝', 'a', '🙋'), '🙋 📝 a', 'the third argument is the state icon');
  assert.equal(titleOf('📝', 'a'), '📝 a', 'the two-argument form is unchanged');
});

test('change-state AC-7 title: waiting on GitHub is ⏳ and the stage icon', () => {
  assert.equal(stateOf(build(rowOf('wait-checks', { pending: ['build'] }))).title, '⏳ 🚀 feat');
  assert.equal(stateOf(silentEnd()).title, '⏳ 🚀 feat');
});

test('change-state AC-7 title: blocked is ⛔ and the stage icon, or ⛔ alone with no stage', () => {
  const atCode = run({ rep: { end: endOf('blocked', 'implementation', 'ceiling-reached', { stage: 'implementation', attempt: 3, ceiling: 3 }) } });
  assert.equal(stateOf(atCode).title, '⛔ 🛠️ feat');
  const previous = run({ report: { ...reportOf(FLOWS.devkit, {}), script: 'previous', stages: [], previous: { finishedBy: 'ship-change' } } });
  assert.equal(stateOf(previous).title, '⛔ feat');
});

test('change-state AC-7 title: archived is 📦 and the id alone', () => {
  const archived = run({ report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } });
  assert.equal(stateOf(archived).title, '📦 feat');
  assert.deepEqual(STATE_ICON, { 'waiting-for-owner': '🙋', 'waiting-on-github': '⏳', blocked: '⛔', archived: '📦' });
});

test('change-state AC-7 title: every form of a 70-character id is cut to 59 code points', async (t) => {
  const ctx = { id: 'x'.repeat(70) };
  const forms = {
    running: [planStage({ ctx }), '📝 xxx'],
    owner: [grillOf({ ctx }), '🙋 ❓ xxx'],
    github: [run({ ctx, rep: buildRep(), facts: { row: rowOf('wait-checks', { pending: ['build'] }) } }), '⏳ 🚀 xxx'],
    blocked: [ceilingEnd({ ctx }), '⛔ 📝 xxx'],
    archived: [run({ ctx, report: { ...reportOf(FLOWS.devkit, { end: endOf('archived', null, 'archived') }), stages: [] } }), '📦 xxx'],
  };
  for (const [label, [action, prefix]] of Object.entries(forms)) {
    await t.test(label, () => {
      assert.equal(action.change, ctx.id);
      const title = stateOf(action).title;
      assert.ok(title.startsWith(prefix), `${label}: ${title}`);
      assert.equal([...title].length, 59, label);
    });
  }
});

test('change-state AC-7 next: every action carries its state and its sessionTitle is the state\'s title', () => {
  const read = (root, extra = [], env = cleanEnv, opts = {}) => parsed(next(root, extra, env, opts)).action;
  const archivedRoot = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const none = () => ({ status: 1, stdout: '', stderr: '' });
  const cases = [
    ['the grill', read(planChange({ have: [] })), 'waiting-for-owner', '🙋 ❓ feat'],
    ['a plan stage', read(planChange({ have: ['requirements'] })), 'running', '📝 feat'],
    ['the approval', read(planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'] })), 'waiting-for-owner', '🙋 📝 feat'],
    ['the previous script', read(planChange({ have: ['requirements', 'proposal'], headerless: true })), 'blocked', '⛔ feat'],
    ['archived', read(archivedRoot, [], cleanEnv, { openspec: none, gh: none }), 'archived', '📦 feat'],
  ];
  for (const [label, action, state, title] of cases) {
    assert.equal(action.state.state, state, `${label}: the state`);
    assert.equal(action.state.title, title, `${label}: the title`);
    assert.equal(action.sessionTitle, title, `${label}: sessionTitle is the state's title`);
    assert.equal(action.icon, changeLoopModule.stageIcon(action), `${label}: the icon stays`);
  }
});

// ---------------------------------------------------------------- change-state: phase 2, the state command (design D-3, D-9)

const stateCmd = (cwd, extra = [], env = cleanEnv, opts = {}) => main(['state', '--lang', 'en', ...extra], { cwd, env, ...opts });
const entriesOfRun = (r) => { assert.equal(r.code, 0, r.stdout + r.stderr); return JSON.parse(r.stdout).changes; };
const entryOf = (r) => { const list = entriesOfRun(r); assert.equal(list.length, 1); return list[0]; };
const noGh = () => ({ status: 1, stdout: '', stderr: 'offline' });
const answeringGh = () => ({ status: 0, stdout: '[]', stderr: '' });
const writeRunFile = (cwd, patch) => {
  const file = changeLoopModule.runFilePath(cwd);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ version: 1, places: 1, ...patch }));
};
const roadmapOfIds = (...ids) => `# Roadmap\n\n## Round 1: x\n${ids.map((id) => `- [ ] ${id}`).join('\n')}\n`;
const withRoadmap = (root, ...ids) => { put(root, { 'openspec/roadmap.md': roadmapOfIds(...ids) }); commitAll(root, 'roadmap'); return root; };
const noMarker = /devkit-(run|end):/;

test('change-state AC-1 command: one change prints its state, reason, stage and title in the person\'s language', () => {
  const root = approvedChange();
  const r = stateCmd(root, ['--change', 'feat']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, `${JSON.stringify({ version: 1, changes: [{
    change: 'feat', state: 'waiting-for-owner', reason: { code: 'waiting-approval', text: 'your approval of the plan' },
    stage: 'approval', stageTitle: 'Owner\'s approval', phase: null, stageIcon: '📝', stateIcon: '🙋', title: '🙋 📝 feat',
    script: 'devkit', root: realpathSync(root), branch: 'main',
  }] }, null, 2)}\n`);
  const pt = entryOf(stateCmd(root, ['--change', 'feat'], cleanEnv, {}) && main(['state', '--change', 'feat', '--lang', 'pt-BR'], { cwd: root, env: cleanEnv }));
  assert.deepEqual([pt.state, pt.reason.code, pt.stage, pt.stateIcon, pt.title], ['waiting-for-owner', 'waiting-approval', 'approval', '🙋', '🙋 📝 feat']);
  assert.equal(pt.reason.text, render('pt-BR', 'gate.approval'));
  assert.equal(pt.stageTitle, stageOf(FLOWS.devkit, 'approval').title['pt-BR']);
  assert.notEqual(pt.reason.text, 'your approval of the plan');
});

test('change-state AC-1 command: the output holds no run marker', () => {
  const blocked = planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } });
  const waiting = approvedChange();
  for (const [label, root, state] of [['blocked', blocked, 'blocked'], ['waiting', waiting, 'waiting-for-owner']]) {
    const r = stateCmd(root, ['--change', 'feat']);
    assert.equal(entryOf(r).state, state, label);
    assert.doesNotMatch(r.stdout, noMarker, label);
    assert.doesNotMatch(r.stderr, noMarker, label);
    assert.doesNotMatch(stateCmd(root).stdout, noMarker, `${label}, every change`);
  }
});

test('change-state AC-1 command: nothing is written', () => {
  const root = withRoadmap(approvedChange(), 'feat');
  const snapshot = (cwd) => ({ status: git(cwd, 'status', '--porcelain'), worktrees: git(cwd, 'worktree', 'list'), run: existsSync(changeLoopModule.runFilePath(cwd)) ? readFileSync(changeLoopModule.runFilePath(cwd), 'utf8') : null });
  assert.equal(snapshot(root).run, null, 'the fixture has no run file');
  const before = snapshot(root);
  entriesOfRun(stateCmd(root));
  entriesOfRun(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual(snapshot(root), before, 'no run file is created');
  writeRunFile(root, { changeSessions: true, declared: { feat: { state: 'blocked', why: 'tests-red', params: { phase: 1 } } } });
  const withRun = snapshot(root);
  assert.ok(withRun.run.includes('tests-red'));
  entriesOfRun(stateCmd(root));
  assert.deepEqual(snapshot(root), withRun, 'the run file, the tree and the worktrees are the same');
});

test('change-state AC-1 command: an unknown change exits 3 with the plain reply', () => {
  const root = approvedChange();
  const r = stateCmd(root, ['--change', 'nope']);
  assert.equal(r.code, 3);
  const out = JSON.parse(r.stdout);
  assert.equal(out.reply, render('en', 'request-unreadable'));
  assert.match(out.error, /no change named nope/);
  assert.equal(out.changes, undefined, 'no state is printed');
  assert.doesNotMatch(out.reply, /nope/);
});

test('change-state AC-1 command: an unknown option and a stray word exit 3 with the plain reply', () => {
  const root = approvedChange();
  const cases = [[['--bogus'], /unknown option --bogus/], [['--change', 'feat', '--bogus', 'x'], /unknown option --bogus/], [['feat'], /\bstate\b/], [['--change', 'feat', 'extra'], /\bstate\b/]];
  for (const [extra, error] of cases) {
    const r = stateCmd(root, extra);
    assert.equal(r.code, 3, extra.join(' '));
    const out = JSON.parse(r.stdout);
    assert.equal(out.reply, render('en', 'request-unreadable'), extra.join(' '));
    assert.match(out.error, error, extra.join(' '));
    assert.equal(out.changes, undefined, extra.join(' '));
  }
});

// ---------------------------------------------------------------- change-state AC-2: every change in play

const OPEN = { '.openspec.yaml': 'schema: devkit\n' };

test('change-state AC-2 command: every open change and every change the run file lists, each once, in id order', () => {
  const t = roundRepo({ roadmap: roadmapOfIds('a', 'b', 'c', 'd', 'e', 'f'), config: 'schema: devkit\n', changes: { b: OPEN, a: OPEN } });
  const wt = t.addWt('c');
  put(wt, { 'openspec/changes/c/.openspec.yaml': 'schema: devkit\n' });
  writeRunFile(t.main, {
    starting: ['d'], declared: { e: { state: 'blocked', why: 'cannot-open', params: { error: 'x' } } }, announced: { f: 'waits-turn' },
    inflight: { d: { kind: 'agent', stage: 'open', at: '2026-11-21T10:00:00.000Z' } },
  });
  const list = entriesOfRun(stateCmd(t.main, [], cleanEnv, { gh: noGh }));
  assert.deepEqual(list.map((e) => e.change), ['a', 'b', 'c', 'd', 'e', 'f']);
  const byId = Object.fromEntries(list.map((e) => [e.change, e]));
  assert.equal(byId.c.root, wt, 'c is read in its own worktree');
  assert.deepEqual([byId.e.state, byId.e.reason.code], ['blocked', 'cannot-open']);
  for (const id of ['d', 'f']) assert.deepEqual([byId[id].state, byId[id].script, byId[id].root, byId[id].branch], ['running', null, null, null], id);
});

test('change-state AC-2 command: a slice, a change archived on the default branch and one the run file announced archived are not listed', () => {
  const t = roundRepo({
    roadmap: roadmapOfIds('a'), config: 'schema: devkit\n',
    changes: { a: OPEN, slice: { '.openspec.yaml': 'schema: devkit-project\n' }, 'archive/2026-11-19-done': { '.openspec.yaml': 'schema: devkit\n' } },
  });
  writeRunFile(t.main, { announced: { gone: 'archived' } });
  const list = entriesOfRun(stateCmd(t.main, [], cleanEnv, { gh: noGh }));
  assert.deepEqual(list.map((e) => e.change), ['a']);
});

test('change-state AC-2 command: nothing in play prints an empty list', () => {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const r = stateCmd(root, [], cleanEnv, { gh: noGh });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { version: 1, changes: [] });
  assert.equal(existsSync(changeLoopModule.runFilePath(root)), false);
});

// ---------------------------------------------------------------- change-state AC-3, AC-5: the command against next

const NEXT_ONLY = ['change', 'script', 'root', 'branch'];
const lessIdentity = (entry) => Object.fromEntries(Object.entries(entry).filter(([k]) => !NEXT_ONLY.includes(k)));
const silentDelivery = () => {
  const d = deliveredChange();
  d.gh.set('pr-view', { exit: 1, stderr: 'HTTP 502: bad gateway\n' });
  return d;
};

test('change-state AC-3 cli: next and state give the same state for the same files and GitHub answers', async (t) => {
  const none = () => ({ status: 1, stdout: '', stderr: '' });
  const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const pending = deliveredChange();
  const silent = silentDelivery();
  const cases = [
    ['a plan stage handed out', planChange({ have: ['requirements'] }), cleanEnv, {}, 'running'],
    ['the grill', planChange({ have: [] }), cleanEnv, {}, 'waiting-for-owner'],
    ['the approval', approvedChange(), cleanEnv, {}, 'waiting-for-owner'],
    ['a ceiling', planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'], results: { readiness: 'failed' }, attempts: { readiness: 3 } }), cleanEnv, {}, 'blocked'],
    ['archived', archived, cleanEnv, { openspec: none, gh: none }, 'archived'],
    ['checks pending', pending.t.main, pending.env, {}, 'waiting-on-github'],
    ['GitHub silent', silent.t.main, silent.env, {}, 'waiting-on-github'],
  ];
  for (const [label, root, env, opts, state] of cases) {
    await t.test(label, () => {
      const fromNext = parsed(next(root, [], env, opts)).action;
      const entry = entryOf(stateCmd(root, ['--change', 'feat'], env, opts));
      assert.equal(entry.state, state);
      assert.deepEqual(lessIdentity(entry), fromNext.state, 'the same state, reason, stage and title');
      assert.equal(entry.change, 'feat');
    });
  }
});

test('change-state AC-5 delivery: with GitHub silent a change at its delivery prints waiting on GitHub', () => {
  const { t, env } = silentDelivery();
  const r = next(t.main, [], env);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  const entry = entryOf(stateCmd(t.main, ['--change', 'feat'], env));
  assert.deepEqual([entry.state, entry.reason.code, entry.reason.text, entry.title], ['waiting-on-github', 'silent', 'GitHub did not answer', '⏳ 🚀 feat']);
});

test('change-state AC-5 plan: with GitHub silent the grill, a plan stage and the approval keep their state', async (t) => {
  const cases = [['the grill', () => planChange({ have: [] })], ['a plan stage', () => planChange({ have: ['requirements'] })], ['the approval', approvedChange]];
  for (const [label, make] of cases) {
    await t.test(label, () => {
      const root = make();
      const answering = { env: cleanEnv, gh: answeringGh };
      const silent = { env: cleanEnv, gh: noGh };
      const nextSilent = parsed(next(root, [], silent.env, { gh: silent.gh })).action;
      const nextAnswering = parsed(next(root, [], answering.env, { gh: answering.gh })).action;
      assert.deepEqual(nextSilent.state, nextAnswering.state, 'next');
      const fromSilent = entryOf(stateCmd(root, ['--change', 'feat'], silent.env, { gh: silent.gh }));
      const fromAnswering = entryOf(stateCmd(root, ['--change', 'feat'], answering.env, { gh: answering.gh }));
      assert.deepEqual(fromSilent, fromAnswering, 'the command');
      assert.notEqual(fromSilent.state, 'waiting-on-github');
      assert.deepEqual(lessIdentity(fromSilent), nextSilent.state);
    });
  }
});

test('change-state AC-5 build: with GitHub silent the implementation and the code review keep the loop\'s action', async (t) => {
  const breakGh = (d) => { for (const call of ['pr-view', 'pr-checks', 'api-graphql']) d.gh.set(call, { exit: 1, stderr: 'HTTP 502: bad gateway\n' }); };
  const cases = [
    ['the implementation', (d) => { put(d.wt, { 'openspec/changes/feat/tasks.md': '# Tasks\n\n## 1. First\n- [ ] 1.1 code\n' }); commitAll(d.wt, 'a task left'); }],
    ['the code review', (d) => { put(d.wt, { 'openspec/changes/feat/reviews/code-quality-reviewer.md': 'Verdict: rejected\nCommit: 0000000\n' }); commitAll(d.wt, 'a review stale'); }],
  ];
  for (const [label, change] of cases) {
    await t.test(label, () => {
      const d = deliveredChange();
      change(d);
      breakGh(d);
      const action = parsed(next(d.t.main, [], d.env)).action;
      const entry = entryOf(stateCmd(d.t.main, ['--change', 'feat'], d.env));
      assert.deepEqual(lessIdentity(entry), action.state, `${label}: ${action.stage} ${action.kind}`);
    });
  }
});

// ---------------------------------------------------------------- change-state AC-4: the run file through the command

test('change-state AC-4 command: a roadmap change with no session of its own is running, ready', () => {
  const root = withRoadmap(approvedChange(), 'feat');
  writeRunFile(root, { changeSessions: true });
  const e = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([e.state, e.reason, e.stage, e.title], ['running', { code: 'ready', text: 'ready, waiting for someone to continue' }, 'approval', '📝 feat']);
  writeRunFile(root, { changeSessions: true, startedSessions: { feat: { at: null } } });
  const own = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([own.state, own.reason.code, own.title], ['waiting-for-owner', 'waiting-approval', '🙋 📝 feat'], 'with its session the state is the loop\'s');
});

test('change-state AC-4 command: a start that waits for a place is running, ready, at the opening', () => {
  const root = withRoadmap(gitRepo({ config: 'schema: devkit\n' }), 'x');
  for (const patch of [{ starting: ['x'] }, { announced: { x: 'waits-turn' } }, { announced: { x: 'waits-refused' } }]) {
    writeRunFile(root, patch);
    const e = entryOf(stateCmd(root, ['--change', 'x'], cleanEnv, { gh: noGh }));
    assert.deepEqual([e.state, e.reason.code, e.stage, e.stageTitle, e.stageIcon, e.title, e.script, e.root, e.branch], ['running', 'ready', 'open', 'Open the change', '❓', '❓ x', null, null, null], JSON.stringify(patch));
    const pt = entryOf(main(['state', '--change', 'x', '--lang', 'pt-BR'], { cwd: root, env: cleanEnv, gh: noGh }));
    assert.equal(pt.stageTitle, stageOf(FLOWS.devkit, 'open').title['pt-BR']);
  }
});

test('change-state AC-4 command: no run file gives the loop\'s plain state', () => {
  const root = withRoadmap(planChange({ have: ['requirements'] }), 'feat');
  assert.equal(existsSync(changeLoopModule.runFilePath(root)), false);
  const e = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([e.state, e.reason, e.stage, e.title], ['running', null, 'decisions', '📝 feat']); // the stage after requirements in the devkit script since stage-roles
});

test('change-state AC-4 command: a change off the roadmap gets no ready reason in a session-per-change run', () => {
  const root = withRoadmap(approvedChange(), 'other');
  writeRunFile(root, { changeSessions: true });
  const e = entryOf(stateCmd(root, ['--change', 'feat']));
  assert.deepEqual([e.state, e.reason.code, e.title], ['waiting-for-owner', 'waiting-approval', '🙋 📝 feat']);
});

test('change-state ADR 0017: the documents follow', () => {
  const name = '0017-a-change-state-is-derived-in-one-place.md';
  const adr = readRepo('docs', 'adr', name);
  assert.equal(adr.split('\n')[0], '# ADR 0017: A change\'s state is derived in one place, and a stopped change\'s session title shows it');
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0017 has ${h}`);
  }
  assert.match(adr, /^- Status: accepted$/m);
  assert.match(adr, /^- Change: change-state$/m);
  assert.match(adr, /^- Amends: ADR 0014 \(0014-each-roadmap-change-runs-in-a-session-of-its-own\.md\), decision 3, the title of a change session$/m);
  // The change folder moves to openspec/changes/archive/<date>-change-state/ when the change is archived.
  const changesDir = join(REPO_ROOT, 'openspec', 'changes');
  const archived = existsSync(join(changesDir, 'archive')) ? readdirSync(join(changesDir, 'archive')).filter((d) => /^\d{4}-\d{2}-\d{2}-change-state$/.test(d)).sort() : [];
  const approvalPath = existsSync(join(changesDir, 'change-state', 'approval.md')) ? join(changesDir, 'change-state', 'approval.md') : join(changesDir, 'archive', archived[archived.length - 1] ?? '', 'approval.md');
  const approval = readFileSync(approvalPath, 'utf8');
  const date = approval.match(/^- Date: (\d{4}-\d{2}-\d{2})$/m)?.[1];
  const words = approval.match(/^- Owner's words: "(.+)"$/m)?.[1].replaceAll('`', '');
  assert.ok(date && words, 'approval.md has its date and the owner\'s words');
  assert.match(adr, new RegExp(`^- Accepted by: the owner, on ${date}, in the message that approved the plan of the change: \`${words}\`; recorded in \`openspec/changes/change-state/approval\\.md\`$`, 'm'));
  for (const icon of ['🙋', '⏳', '⛔', '📦']) assert.ok(adr.includes(icon), `ADR 0017 names ${icon}`);
  const link = `[ADR 0017](${name})`;
  const adr14 = readRepo('docs', 'adr', '0014-each-roadmap-change-runs-in-a-session-of-its-own.md');
  assert.ok(adr14.split('\n').slice(0, 8).includes(`- Amended by ADR 0017 (${name})`), 'ADR 0014 has the Amended by line in its header');
  const adr10 = readRepo('docs', 'adr', '0010-openspec-as-the-harness.md');
  for (const t of [adr14, adr10]) {
    assert.match(t, /Note \(change-state, 2026-11-22\):/);
    assert.ok(t.includes(link), 'the Note links ADR 0017');
  }
  const adrs = readRepo('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0017 a change's state is derived in one place and a stopped change's title shows it, amends 0014/);
  const flow = readRepo('docs', 'openspec-flow.md');
  const a = flow.indexOf("**A change's state.**");
  assert.ok(a > flow.indexOf('**Waiting on GitHub.**'), 'the paragraph follows "Waiting on GitHub"');
  const part = flow.slice(a, flow.indexOf('\n\n', a)).replace(/\s+/g, ' ');
  assert.ok(part.includes('ADR 0017'), 'the paragraph cites ADR 0017');
  assert.doesNotMatch(flow, /\(ready, waits for a place\)/);
});

// ================================================================ commit-attribution (D-7, T1 to T20)

const ASK = () => changeLoopModule.ATTRIBUTION_ASK;
const LANGUAGE_SENTENCE = "Write the change's files in English.";
const COMMIT_ROWS = {
  commit: { paths: [] },
  'open-pr': { number: 12 },
  push: { number: 12 },
  'open-archive-pr': { branch: 'chore/archive-feat', title: 't' },
  'push after a release merge': { number: 12, branch: 'feat', command: ['git', 'push', 'origin', 'feat'] },
};

for (const [n, step] of [[1, 'commit'], [2, 'open-pr'], [3, 'push'], [4, 'open-archive-pr'], [5, 'push after a release merge']]) {
  test(`commit-attribution AC-1 T${n} the ${step} hand-off to the commit agent ends with the attribution request once`, () => {
    const a = build(rowOf(step === 'push after a release merge' ? 'push' : step, COMMIT_ROWS[step]));
    assert.equal(a.agent, COMMIT);
    assert.doesNotMatch(JSON.stringify(a), /--force|push-rebased/, 'a plain push, never a rewrite');
    assert.ok(ASK().length > 0, 'the request is exported');
    assert.ok(a.brief.endsWith(ASK()), a.brief);
    assert.equal(a.brief.split(ASK()).length - 1, 1, 'the request is there once');
    assert.ok(a.brief.slice(0, -ASK().length).endsWith(LANGUAGE_SENTENCE), a.brief);
  });
}

const NO_REQUEST = [
  [6, 'implement', () => build(rowOf('implement', { phase: 1 }))],
  [7, 'resolve-release-conflict', () => build(rowOf('resolve-release-conflict', { number: 12, paths: ['CHANGELOG.md'], base: 'main', command: ['git', 'merge', 'origin/main'] }))],
  [8, 'verify', () => build(rowOf('verify'))],
  [9, 'proposal', () => run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'no-file') } })],
  [10, 'readiness', () => run({ rep: { next: nextOf(FLOWS.devkit, 'readiness', 'no-file') } })],
];
for (const [n, label, make] of NO_REQUEST) {
  test(`commit-attribution AC-1 T${n} the ${label} hand-off does not carry the attribution request`, () => {
    const a = make();
    assert.equal(a.kind, 'agent');
    assert.ok(ASK().length > 0, 'the request is exported');
    assert.ok(!a.brief.includes(ASK()), a.brief);
    assert.ok(a.brief.endsWith(LANGUAGE_SENTENCE), a.brief);
  });
}

test('commit-attribution AC-1 T11 a commit step handed to another agent carries no request', () => {
  const a = build(rowOf('commit', { agent: TDD, paths: [] }));
  assert.equal(a.agent, TDD);
  assert.ok(ASK().length > 0, 'the request is exported');
  assert.ok(!a.brief.includes(ASK()), a.brief);
});

test('commit-attribution AC-1 T12 withAttribution appends the request for the commit agent', () => {
  assert.equal(changeLoopModule.withAttribution(changeLoopModule.COMMIT_AGENT, 'x'), `x${ASK()}`);
});

test('commit-attribution AC-1 T13 withAttribution leaves another agent\'s text as it is', () => {
  assert.equal(changeLoopModule.withAttribution('devkit-core:tdd-implementer', 'x'), 'x');
});

test('commit-attribution AC-1 T14 withAttribution leaves a text with no agent as it is', () => {
  assert.equal(changeLoopModule.withAttribution(undefined, 'x'), 'x');
});

test('commit-attribution AC-1 T15 the request names the header, the labels, none and verbatim, and no line of its own', () => {
  const ask = ASK();
  assert.ok(ask.includes(changeLoopModule.ATTRIBUTION_HEADER), 'the header');
  for (const part of ['`Commit trailer: <line>`', '`PR footer: <line>`', '`Attribution (from the caller): none`', 'verbatim']) assert.ok(ask.includes(part), part);
  assert.doesNotMatch(ask, /Claude|Sonnet|Opus|Haiku|noreply|@|🤖/);
});

const devkitLine = (start) => skillText().split('\n').find((l) => l.startsWith(start)) ?? '';
const BLOCK_SENTENCE = "the attribution block of the `ship-change` skill's Attribution section";
for (const [n, label, start] of [
  [16, 'Loop agent item', '- `agent`: one Agent call'],
  [17, 'Loop agent item (the plain push after a release merge)', '- `agent`: one Agent call'],
  [18, 'roadmap agent item', '   - `agent`: hand every one'],
  [19, 'project agent item', '   - `agent`: as the Loop of the change sections says'],
]) {
  test(`commit-attribution AC-1 T${n} the ${label} of the devkit skill names the block for the commit agent`, () => {
    const line = devkitLine(start);
    assert.ok(line.length > 0, `the line starting ${start}`);
    assert.ok(line.includes('devkit-core:commit-and-pr'), line);
    assert.ok(line.includes(BLOCK_SENTENCE), line);
  });
}

test('commit-attribution AC-1 T20 the request, the ship-change skill and the agent share one block format', () => {
  const ship = readFileSync(join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md'), 'utf8');
  const shipSection = section(ship, '## Attribution', '\n## Loop');
  const agentMd = readFileSync(join(REPO_ROOT, 'plugins', 'core', 'agents', 'commit-and-pr.md'), 'utf8');
  const receives = section(agentMd, '## Receives', '## Preconditions');
  for (const part of [changeLoopModule.ATTRIBUTION_HEADER, 'Commit trailer:', 'PR footer:', 'Attribution (from the caller): none']) {
    assert.ok(ASK().includes(part), `the request: ${part}`);
    assert.ok(shipSection.includes(part), `the ship-change section: ${part}`);
    assert.ok(receives.includes(part), `the agent's Receives: ${part}`);
  }
});

// ---------------------------------------------------------------- roadmap-sessions-upfront, phase 5: the held state through changeState (design D-6, D-11)

const heldFacts = (over = {}) => ({ sessionMode: true, started: true, inflight: null, declared: null, waits: false, queued: null, occupied: false, waitsFor: null, ...over });
const AT_HELD = '2026-11-21T10:00:00.000Z';

test('upfront AC-10 facts: runFactsOf reads the change\'s queue entry, its place and its waitsFor, and no other change\'s', () => {
  const file = (over = {}) => ({
    changeSessions: true, startedSessions: {}, inflight: {}, declared: {}, announced: {}, starting: [],
    queued: { a: { at: AT_HELD, why: 'load' }, b: { at: AT_HELD, why: 'place' } }, occupied: { c: { at: AT_HELD } }, waitsFor: { a: 'x', b: 'y' }, ...over,
  });
  const a = runFactsOf(file(), 'a', { onRoadmap: true });
  assert.deepEqual([a.queued, a.occupied, a.waitsFor], [{ at: AT_HELD, why: 'load' }, false, 'x']);
  const c = runFactsOf(file(), 'c', { onRoadmap: true });
  assert.deepEqual([c.queued, c.occupied, c.waitsFor], [null, true, null]);
  const none = runFactsOf(file(), 'd', { onRoadmap: true });
  assert.deepEqual([none.queued, none.occupied, none.waitsFor], [null, false, null], 'another change\'s entries are not this one\'s');
  const bare = runFactsOf({ changeSessions: true }, 'a', { onRoadmap: true });
  assert.deepEqual([bare.queued, bare.occupied, bare.waitsFor], [null, false, null], 'a run file with none of the three fields');
});

test('upfront AC-10 state: a running change queued for a place reads held-place with its board words and the title ⏳ <id>', () => {
  const action = build(rowOf('implement', { phase: 1 }), {}, {});
  assert.deepEqual([action.kind, action.stage], ['agent', 'implementation']);
  for (const lang of ['en', 'pt-BR']) {
    const s = changeState(action, heldFacts({ queued: { at: AT_HELD, why: 'place' } }), { lang });
    assert.deepEqual([s.state, s.reason.code, s.reason.text], ['running', 'held-place', MESSAGES[lang]['queue.held-place']], lang);
    assert.deepEqual([s.stateIcon, s.stageIcon, s.title], ['⏳', '🛠️', '⏳ feat'], lang);
  }
  assert.equal(MESSAGES.en['queue.held-place'], 'open, waits for a place');
  assert.equal(MESSAGES['pt-BR']['queue.held-place'], 'aberta, espera uma vaga');
  assert.deepEqual(changeLoopModule.HELD_TEXT, { 'held-place': 'queue.held-place', 'held-load': 'queue.held-load', 'held-after': 'queue.held-after' });
  assert.equal(changeLoopModule.WAIT_ICON, '⏳');
});

test('upfront AC-10 state: a running change queued by the load reads held-load', () => {
  for (const lang of ['en', 'pt-BR']) {
    const s = changeState(planStage(), heldFacts({ queued: { at: AT_HELD, why: 'load' } }), { lang });
    assert.deepEqual([s.state, s.reason.code, s.reason.text, s.title, s.stageIcon], ['running', 'held-load', MESSAGES[lang]['queue.held-load'], '⏳ feat', '📝'], lang);
  }
  assert.equal(MESSAGES.en['queue.held-load'], 'open, held by the load');
});

test('upfront AC-10 state: a plan stage whose dependency is not archived reads held-after naming it', () => {
  for (const lang of ['en', 'pt-BR']) {
    const s = changeState(planStage(), heldFacts({ waitsFor: 'dep' }), { lang });
    assert.deepEqual([s.state, s.reason.code, s.reason.text, s.title], ['running', 'held-after', render(lang, 'queue.held-after', { after: 'dep' }), '⏳ feat'], lang);
  }
  assert.equal(stateOf(planStage(), heldFacts({ waitsFor: 'dep' })).reason.text, 'open, waits for dep');
  const ready = stateOf(planStage(), heldFacts({ started: false, waitsFor: 'dep' }));
  assert.equal(ready.reason.code, 'held-after', 'a held reason replaces ready, as the board placed those rows');
  const queuedFirst = stateOf(planStage(), heldFacts({ queued: { at: AT_HELD, why: 'place' }, waitsFor: 'dep' }));
  assert.equal(queuedFirst.reason.code, 'held-place', 'the queue entry is read before the dependency');
});

test('upfront AC-10 state: a change that holds a place, or has no queue entry and no waitsFor, gets no held reason', () => {
  const occupied = stateOf(planStage(), heldFacts({ queued: { at: AT_HELD, why: 'place' }, occupied: true }));
  assert.deepEqual([occupied.state, occupied.reason, occupied.stateIcon, occupied.title], ['running', null, null, '📝 feat'], 'a place held');
  const plain = stateOf(planStage(), heldFacts());
  assert.deepEqual([plain.state, plain.reason, plain.title], ['running', null, '📝 feat']);
  const ready = stateOf(planStage(), heldFacts({ started: false }));
  assert.equal(ready.reason.code, 'ready', 'no entry: ready stays');
});

test('upfront AC-10 state: a change waiting for the owner, blocked or waiting on GitHub keeps its state and title over a queue entry or a waitsFor', () => {
  const held = { queued: { at: AT_HELD, why: 'place' }, waitsFor: 'dep' };
  const owner = stateOf(approvalEnd(), heldFacts(held));
  assert.deepEqual([owner.state, owner.reason.code, owner.title], ['waiting-for-owner', 'waiting-approval', '🙋 📝 feat']);
  const blocked = stateOf(ceilingEnd(), heldFacts(held));
  assert.deepEqual([blocked.state, blocked.reason.code, blocked.title], ['blocked', 'ceiling', '⛔ 📝 feat']);
  const github = stateOf(build(rowOf('wait-checks', { pending: ['build'] })), heldFacts(held));
  assert.deepEqual([github.state, github.title], ['waiting-on-github', '⏳ 🚀 feat'], 'the GitHub wait keeps its stage icon beside ⏳');
  const grill = stateOf(grillOf(), heldFacts(held));
  assert.deepEqual([grill.state, grill.title], ['waiting-for-owner', '🙋 ❓ feat']);
});

test('upfront AC-10 state: outside a run with a session per change a queue entry or a waitsFor gives no held reason', () => {
  const entries = { queued: { at: AT_HELD, why: 'place' }, waitsFor: 'dep' };
  const noSessions = stateOf(planStage(), heldFacts({ ...entries, sessionMode: false, started: false }));
  assert.deepEqual([noSessions.state, noSessions.reason, noSessions.title], ['running', null, '📝 feat']);
  assert.deepEqual(stateOf(planStage(), null).reason, null, 'no facts at all');
  const file = { changeSessions: false, startedSessions: {}, inflight: {}, declared: {}, announced: {}, starting: [], ...entries, queued: { feat: entries.queued }, waitsFor: { feat: 'dep' } };
  const facts = runFactsOf(file, 'feat', { onRoadmap: true });
  assert.equal(stateOf(planStage(), facts).reason, null, 'a run file without the mode');
});

test('upfront AC-10 state: a held title of a 70-character id is cut to 59 code points', () => {
  const ctx = { id: 'x'.repeat(70) };
  for (const facts of [heldFacts({ queued: { at: AT_HELD, why: 'place' } }), heldFacts({ queued: { at: AT_HELD, why: 'load' } }), heldFacts({ waitsFor: 'dep' })]) {
    const s = stateOf(planStage({ ctx }), facts);
    assert.equal(s.reason?.code?.startsWith('held-'), true, 'a held reason');
    const title = s.title;
    assert.ok(title.startsWith('⏳ xxx'), title);
    assert.equal([...title].length, 59);
  }
});
