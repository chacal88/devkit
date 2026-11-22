// node --test --test-name-pattern="^change-loop" plugins/openspec/hooks/change-loop.test.mjs
// change-coordinator: the loop, its commands and its locks (phase 1: settings, replies and the decision; phase 2: start, open, script, wait; phase 3: the locks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync, utimesSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { gitRepo, put, commitAll, git, openspecStub } from './deliver-check.test.mjs';
import { roundRepo } from './conduct-check.test.mjs';
import { shipConfig, collectState, buildReport, approvalState } from './deliver-check.mjs';
import { actorOf } from './conduct-check.mjs';
import { TEXT } from './flow-check.mjs';
import * as guardModule from './guard.mjs';
import * as changeLoopModule from './change-loop.mjs';
import {
  readDevkitSettings, normalizeLang, MESSAGES, render, decide, exitCodeOf, ROW_STEPS, main, HOOKS_DIR, LoopUsageError,
  runCommand, waitLoop, PACKS, withLockFile, openChange,
} from './change-loop.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS = join(HERE, '..', 'schemas');
const LOOP = join(HERE, 'change-loop.mjs');

// Every env a test of this file builds blanks the branch variables together (CONTRIBUTING.md, testing rules).
const SET = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const cleanEnv = { ...process.env, ...SET };

const TDD = 'devkit-core:tdd-implementer';
const COMMIT = 'devkit-core:commit-and-pr';
const PLANNER = 'devkit-core:change-planner';
const READINESS = 'devkit-core:plan-readiness-reviewer';
const VERIFIER = 'devkit-core:pr-verifier';

const FLOWS = Object.fromEntries(['devkit', 'devkit-lite'].map((s) => [s, JSON.parse(readFileSync(join(SCHEMAS, s, 'flow.json'), 'utf8'))]));
const read = (f) => readFileSync(join(HERE, f), 'utf8');

// ---------------------------------------------------------------- settings (D-9)

function configRepo(text) {
  const root = mkdtempSync(join(tmpdir(), 'change-loop-cfg-'));
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
  base: 'main', state: 'github',
};
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
  const EXEMPT_EQUAL = ['driver.compozy', 'setting.driver', 'roadmap-stayed', 'need.owner', 'running.stage'];
  for (const lang of ['en', 'pt-BR']) {
    for (const { key, text } of renderings(lang)) {
      assert.ok(typeof text === 'string' && text.length > 0 && !/undefined|NaN|\[object|\{\w+\}/.test(text), `${lang} ${key}: ${text}`);
      assert.ok(!text.includes('`'), `${lang} ${key} has a backtick: ${text}`);
      assert.ok(!/[\w.-]+\.(md|json|mjs|js|ts|ya?ml)\b/.test(text), `${lang} ${key} names a file: ${text}`);
      assert.ok(!/\b[a-z][\w-]*=\S/i.test(text), `${lang} ${key} has a name=value shape: ${text}`);
      for (const name of [...refusedIds, ...refusedWords]) assert.ok(!wordRe(name).test(text), `${lang} ${key} holds ${name}: ${text}`);
      assert.ok(!/(^|\s)--[a-z]/i.test(text), `${lang} ${key} holds an option: ${text}`);
      assert.ok(!/(^|\s)\?(\s|$)/.test(text), `${lang} ${key} holds a lone ?: ${text}`);
    }
  }
  // The usage error's reply (exit 3 of main on an unknown option, a missing change) is one more message of the table.
  for (const lang of ['en', 'pt-BR']) {
    for (const argv of [['next', '--lang', lang, '--bogus'], ['next', '--lang', lang], ['open', '--lang', lang, '--script', 'devkit'], ['reply', 'no-such-key', '--lang', lang], ['teleport', '--lang', lang]]) {
      const r = main(argv, { cwd: tmpdir(), env: cleanEnv });
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
const nextOf = (flow, stage, reasonCode, params = {}) => {
  const s = stageOf(flow, stage);
  return { n: flow.stages.indexOf(s) + 1, stage, role: s.role, skills: s.skills ?? [], reasonCode, params, reason: 'x', progressKey: `${stage}@abc123` };
};
const endOf = (state, stage, reasonCode, params = {}) => ({ state, stage, reasonCode, params, reason: 'x' });
const reportOf = (flow, { next = null, end = null, stages = {}, script = 'current', schema = 'devkit' } = {}) => (
  { version: 1, change: 'feat', schema, script, head: 'h', stages: stagesOf(flow, stages), next, end, previous: null });
const APPROVAL = { status: null, recorded: null, readiness: 'sha256:abcdef012345', ok: false };
const rowOf = (step, extra = {}) => ({ next: { step, reason: 'r', actor: 'x', ...extra }, state: 's', delivered: {} });

function run(over = {}) {
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
    ['gh-error', { error: 'HTTP 502' }, 'github-unreadable'],
    ['checks-unreadable', { error: 'HTTP 502' }, 'github-unreadable'],
    ['pr-closed', { number: 12 }, 'pr-closed'],
  ];
  for (const [reason, params, why] of cases) {
    const a = run({ rep: { end: endOf('blocked', 'delivery', reason, params) }, facts: { row: rowOf('implement', { phase: 1 }) } });
    assert.deepEqual(shape(a), ['end', 'blocked', why, 2], reason);
    if (why === 'pr-closed') assert.equal(a.reply, says('blocked', { why, number: 12 }));
    if (why === 'github-unreadable') assert.equal(a.reply, says('blocked', { why, error: 'HTTP 502' }));
  }
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
  const command = ['node', '/hooks/release-rebase.mjs', '--base', 'main', '--json'];
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

test('change-loop decide: B2a a branch the loop rebased goes to the commit agent with the old head', () => {
  const command = ['git', 'push', '--force-with-lease=feat:abc', 'origin', 'feat'];
  const a = build(rowOf('push-rebased', { number: 12, oldHead: 'abc', branch: 'feat', paths: ['CHANGELOG.md'], command }));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', COMMIT, 'push-rebased', 'delivery']);
  assert.deepEqual([a.detail.oldHead, a.detail.branch, a.detail.paths, a.detail.command], ['abc', 'feat', ['CHANGELOG.md'], command]);
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
  for (const name of ['push-rebased', 'resolve-release-conflict', 'update-branch', 'blocked']) assert.ok(returnable.has(name), `the scan sees ${name}`);
  assert.ok(returnable.size > 30, `the scan found ${returnable.size} steps`);
  const rows = new Set(ROW_STEPS);
  assert.deepEqual([...returnable].filter((s) => !rows.has(s)), [], 'a returnable step with no row');
  assert.deepEqual([...rows].filter((s) => !returnable.has(s)), [], 'a row naming a step no checker returns');
});

test('change-loop decide: the agent of a delivery hand-off is the one the checker\'s row names, and the loop\'s own map only when the row names none', () => {
  for (const step of ['implement', 'commit', 'verify', 'resolve-release-conflict', 'push-rebased']) {
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
    const a = build(rowOf(step, { phase: 1, number: 12, paths: [] }));
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
    assert.ok(a.brief.includes('do not fetch.') && a.brief.endsWith("Write the change's files in English."), a.brief);
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
function planChange({ have, results = {}, attempts = {}, headerless = false } = {}) {
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
const actionOf = (stdout) => JSON.parse(stdout.split('\n').filter((l) => !/^devkit-(run|end): /.test(l)).join('\n'));
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
  assert.equal(main(['next', '--change', 'feat', '--lang', 'en'], { cwd: tmpdir(), env: cleanEnv }).code, 3, 'no openspec folder above');
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
function deliveredChange({ checks = [check('build', 'pending')], conflicts = [], mergeable = 'MERGEABLE' } = {}) {
  const t = roundRepo({ roadmap: '# Roadmap\n\n## Round 1: x\n- [ ] feat\n', config: PR_CONFIG, files: RELEASE });
  const wt = t.addWt('feat');
  const dir = (f) => `openspec/changes/feat/${f}`;
  const own = Object.fromEntries(conflicts.map((f) => [f, `feat edits ${f}\n`]));
  put(wt, {
    [dir('.openspec.yaml')]: 'schema: devkit-lite\n',
    [dir('proposal.md')]: PROPOSAL, [dir('requirements.md')]: '# Requirements\n', [dir('specs/s/spec.md')]: '# Spec\n',
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
    [dir('proposal.md')]: withHead('proposal', PROPOSAL), [dir('requirements.md')]: withHead('requirements', '# Requirements\n'),
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
  assert.match(action.detail.command[1], /release-rebase\.mjs$/);
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

// A committed change `id` of the plan stages in `have`, written as passed, in a checkout (no GitHub involved).
function addChange(root, id, have = ['requirements', 'decisions'], { commit = true } = {}) {
  const c0 = git(root, 'rev-parse', 'HEAD');
  const files = { '.openspec.yaml': 'schema: devkit\n' };
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
  const broken = mkdtempSync(join(tmpdir(), 'change-loop-broken-'));
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
  const bare = mkdtempSync(join(tmpdir(), 'change-loop-bare-'));
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
  assert.match(body(startRun(root, '', { lang: 'pt-BR' })).reply, /^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status e \/devkit project/);
  assert.match(render('en', 'verb-unknown'), /\/devkit change.*\/devkit roadmap.*\/devkit status.*\/devkit project/);
  assert.equal(body(startRun(root, '', { lang: '${user_config.language}' })).reply, render('pt-BR', 'verb-unknown'));
});

test('change-loop start: S3 a folder with no openspec, or another schema, is not set up', () => {
  const bare = mkdtempSync(join(tmpdir(), 'change-loop-bare-'));
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

test('change-loop start: S6 one token naming a change resumes it and says where it stopped', () => {
  const root = devkitRepo();
  addChange(root, 'feat');
  addChange(root, 'other', ['requirements', 'proposal']);
  put(root, { 'openspec/changes/archive/2026-11-19-old/.openspec.yaml': 'schema: devkit\n' });
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

test('change-loop start: S6 a change that lives only in a worktree resumes there', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  const wt = t.addWt('wt-change');
  addChange(wt, 'wt-change', ['requirements', 'decisions'], { commit: false });
  const b = body(startRun(t.main, 'change wt-change'));
  assert.deepEqual([b.mode, b.change], ['resume', 'wt-change']);
  assert.equal(b.unfinished[0].root, wt);
  assert.equal(b.reply, render('en', 'resumed', { id: 'wt-change', where: whereNext('proposal') }));
});

test('change-loop start: S7 no text and one unfinished change resumes it', () => {
  const root = devkitRepo();
  addChange(root, 'feat', ['requirements', 'proposal', 'specs', 'design', 'tasks', 'readiness']);
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
  const bare = mkdtempSync(join(tmpdir(), 'change-loop-bare-'));
  assert.equal(openRun(bare, 'new-thing').code, 3);
});

test('change-loop open: O4 starts from origin/<default> after a fetch', () => {
  const t = freshProject();
  const other = mkdtempSync(join(tmpdir(), 'change-loop-other-'));
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

  assert.equal(git(wt, 'rev-parse', 'HEAD'), sha, 'the branch starts from the fetched origin/main');
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
const sandbox = () => mkdtempSync(join(tmpdir(), 'change-loop-lock-'));

// Transcript lines in the stored forms the probe of D-12a recorded (Claude Code 2.1.326, session ids replaced).
const LINE_BASE = { parentUuid: null, isSidechain: false, userType: 'external', entrypoint: 'sdk-cli', cwd: '/scratch/project', sessionId: SESSION, version: '2.1.326', gitBranch: 'main' };
const stored = (extra) => JSON.stringify({ ...LINE_BASE, uuid: 'uuid-0001', timestamp: '2026-11-20T10:00:00.000Z', ...extra });
const commandText = (name, args) => `<command-message>${name.replace(/^.*:|^\//g, '')}</command-message>\n<command-name>${name}</command-name>\n<command-args>${args}</command-args>`;
// A typed command: a line of type user whose message.content is a string.
const typedLine = (args, name = '/devkit') => stored({ type: 'user', message: { role: 'user', content: commandText(name, args) } });
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
const runLine = (id, form = 'both') => toolResultLine(`devkit-run: ${id}\n{"version":1}`, form);
// A command that ended the run: `next` or `wait` (the run line first, then the end line, then the action) or the session's own
// `reply` of an end key (the end line alone, then the reply).
const nextEndLine = (id, state, form = 'both') => toolResultLine(`devkit-run: ${id}\ndevkit-end: ${id} ${state}\n{"version":1}`, form);
const endLine = (id, state, form = 'both') => toolResultLine(`devkit-end: ${id} ${state}\nThe change ${id} stopped: x.`, form);
// The api-request-blob lines repeat the command text inside text blocks: never the typed command.
const blobLine = (text) => stored({ type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text }] } });
const assistantLine = () => stored({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
const transcriptOf = (lines) => {
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
const stopInput = (root, transcript, extra = {}) => ({ session_id: SESSION, transcript_path: transcript, cwd: root, stop_hook_active: false, background_tasks: [], ...extra });
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
  const wt = join(mkdtempSync(join(tmpdir(), 'change-loop-wtlayout-')), 'feat');
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

test('change-loop lock hooks.json: Stop, SubagentStop without a matcher and PreToolUse Agent call guard.mjs', () => {
  const hooks = JSON.parse(read('hooks.json'));
  const cmd = (mode) => `node "\${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" ${mode}`;
  assert.deepEqual(hooks.hooks.Stop, [{ hooks: [{ type: 'command', command: cmd('stop'), timeout: 60 }] }]);
  assert.deepEqual(hooks.hooks.SubagentStop, [{ hooks: [{ type: 'command', command: cmd('subagent-stop'), timeout: 60 }] }]);
  assert.equal(hooks.hooks.SubagentStop[0].matcher, undefined);
  assert.deepEqual(hooks.hooks.PreToolUse.map((e) => e.matcher), ['Edit|Write|MultiEdit|NotebookEdit', 'Bash', 'Agent']);
  assert.deepEqual(hooks.hooks.PreToolUse[2].hooks, [{ type: 'command', command: cmd('agent'), timeout: 10 }]);
  assert.deepEqual(hooks.hooks.SessionStart[0].hooks.map((h) => h.command), [cmd('session')]);
  assert.match(hooks.description, /stop/i);
  assert.match(read('guard.mjs').split('\n').slice(0, 12).join('\n'), /guard\.mjs stop[\s\S]*guard\.mjs subagent-stop[\s\S]*guard\.mjs agent/, 'the header comment lists the three modes');
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
  const calls = md.split('\n').filter((l) => /change-loop\.mjs (start|open|script|wait|next|reply)\b/.test(l));
  for (const sub of ['start', 'open', 'script', 'wait', 'next', 'reply']) {
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

test('change-loop skill: the two override sentences of the release conflict and the rebased branch', () => {
  const md = skillText();
  assert.ok(md.includes('`resolve-release-conflict`'));
  assert.ok(md.includes('Run `detail.command` in the worktree, then the project\'s test command; report the JSON and the result; change nothing else.'));
  assert.match(md, /`Outcome: failure` ends the run blocked/);
  assert.ok(md.includes('`push-rebased`'));
  assert.ok(md.includes('The branch was rewritten by a rebase. Commit these files by name if any, then push with `git push --force-with-lease=<branch>:<oldHead> origin <branch>`. No PR edit.'));
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
  assert.match(loop, /An end the session declares itself \(an agent's failure, a red gate, a pull-request decision left to the owner\) goes through `reply`/);
  assert.match(loop, /only the lines after it are shown to the owner/);
  for (const key of ['reply blocked --param id=<id> --param why=role-failed', 'reply blocked --param id=<id> --param why=tests-red', 'reply waiting-pr-decision --param id=<id>']) assert.ok(loop.includes(key), key);
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
  assert.deepEqual(heads, ['## Settings', '## Start', '## A new change', '## Loop', '## Owner gates', '## Waiting on GitHub', '## Roadmap', '## Status', '## Project', '## Never']);
  for (const mode of ['not-built', 'unknown-verb', 'not-set-up', 'setting-unknown', 'driver-not-built', 'nothing', 'choose', 'ask-unfinished', 'resume', 'new', 'roadmap', 'status', 'project', 'is-slice']) {
    assert.ok(md.includes(`\`${mode}\``), `mode ${mode}`);
  }
  assert.match(md, /AskUserQuestion/);
  // Invariant: the skill keeps its sections and start modes and names no retired machinery. Layer: skill text. Suite: change-loop.
  // The session-start tool is named by the Roadmap section now (ADR 0014); ADR 0006's wake-up stays retired.
  assert.doesNotMatch(md, /conduct-check|CronCreate|wake_when_done/);
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
  // Invariant: the CI snippet pins the current release (docs, change-loop.test.mjs); stage-roles moves it to 0.22.0 (release 0.26.0).
  assert.match(flow, /v0\.22\.0/, 'the CI snippet pins the current release (stage-roles: 0.22.0)');
  assert.doesNotMatch(flow, /v0\.21\.0/, 'no pin left on the previous release');
  const staleV20 = flow.split('\n').filter((l) => /v0\.20\.0/.test(l) && !/v0\.20\.0` or later/.test(l));
  assert.deepEqual(staleV20, [], 'no pin left on the previous release; only the slice-merge floor ("v0.20.0 or later") names it');
  assert.match(flow, /moves this pin to `v0\.20\.0` or later first/, 'the slice-merge floor (project-phases) is kept');
  assert.doesNotMatch(flow, /v0\.19\.1/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.19\.0/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.18\.0/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.18\.1/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.17\.1/, 'no pin left on the previous release');
  assert.doesNotMatch(flow, /v0\.16\.0/, 'no pin left on the previous release');
  assert.match(flow, /prints `devkit-run: <id>`, then `devkit-end: <id> <state>` when the action is an end/, 'the loop paragraph names the end marker');
  assert.match(flow, /an end the run already recorded/, 'the stop lock reads a recorded end');
  assert.match(flow, /refuses a hand-off with no agent type, to a general-purpose agent, to another plugin's agent even when it is named like a role/, 'the hand-off rule');
  assert.match(flow, /a usage error included[^\n]*keeps its raw message in the JSON's `error` field/, 'the usage-error reply');
  assert.doesNotMatch(flow, /v0\.15\.1/);
  const road = readRepo('openspec', 'roadmap.md').split('\n').find((l) => /^- \[[ x]\] review-writer-prompt/.test(l));
  assert.match(road, /touches only tests/);
  assert.match(road, /fenced example/);
});

// ---- field-fixes 6: the project's OpenSpec CLI (D-1)

function pinnedLoop(version) {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const marker = join(root, '..', `seen-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
  const pathDir = openspecStub(mkdtempSync(join(tmpdir(), 'loop-pathcli-')), { version: '2.1.0', label: 'path', marker });
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
const archivedFolder = (date, id) => ({ [`openspec/changes/archive/${date}-${id}/.openspec.yaml`]: 'schema: devkit\n' });

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

test('field-fixes 1 archived: resuming an archived change by its id still ends archived', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: 'schema: devkit\n' });
  addChange(t.addWt('old-wt'), 'foo', ['requirements'], { commit: false });
  put(t.main, archivedFolder('2026-11-20', 'foo'));
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

const lockDir = () => mkdtempSync(join(tmpdir(), 'devkit-lockfile-'));

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
  assert.match(readFileSync(join(root, ADR_FOLDER, '0002-b.md'), 'utf8'), new RegExp(`\\n- Status: Accepted\\n- Status: ${by.replace(/[()/.]/g, '\\$&')}\\n`));
});

test('stage-roles loop: accept-decisions keeps the letter case and the prefix of the status line', () => {
  const root = adrChange({ records: {
    [`${ADR_FOLDER}/a.md`]: adrRecord('Status: PROPOSED'),
    [`${ADR_FOLDER}/b.md`]: adrRecord('  * **Status:** Proposed — pending'),
  } });
  assert.equal(accept(root).code, 0);
  const a = readFileSync(join(root, ADR_FOLDER, 'a.md'), 'utf8');
  assert.match(a, /\nStatus: ACCEPTED\nStatus: Accepted by: the owner, on 2026-11-22/);
  const b = readFileSync(join(root, ADR_FOLDER, 'b.md'), 'utf8');
  assert.match(b, /\n {2}\* \*\*Status:\*\* Accepted — pending\n {2}\* \*\*Status:\*\* Accepted by: the owner, on 2026-11-22/);
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
  const outside = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'adr-outside-'));
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
  const r = main(['accept-decisions', '--lang', 'en'], { cwd: tmpdir(), env: cleanEnv });
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
  const approval = readRepo('openspec', 'changes', 'stage-roles', 'approval.md');
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

test('stage-roles docs: the roadmap line of stage-roles keeps its text, and every carried item moved to coordinator-loop-fixes', () => {
  const old = spawnSync('git', ['show', '2300f84:openspec/roadmap.md'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.equal(old.status, 0, old.stderr);
  const itemOf = (rounds, id) => rounds.flatMap((r) => r.items).find((i) => i.id === id);
  const before = itemOf(guardModule.parseRoadmap(old.stdout), 'stage-roles');
  const rounds = guardModule.parseRoadmap(readRepo('openspec', 'roadmap.md'));
  const stage = itemOf(rounds, 'stage-roles');
  const fixes = itemOf(rounds, 'coordinator-loop-fixes');
  assert.ok(before && stage && fixes, 'both lines exist');
  const cut = before.text.indexOf(' Carried from');
  assert.ok(cut > 0, 'the line at 2300f84 holds the carried text');
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
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
  const w = hook('edit', editInput(root, 'src/a.ts', transcript), { TMPDIR: sandbox() });
  assert.equal(w.code, 2, `a product edit is refused as in any change run: ${w.err}`);
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), assistantLine()]) }), null, 'no devkit-run line yet: no run');
  // A later typed command ends it, as for any run.
  assert.equal(runOf({ transcript_path: transcriptOf([plainLine(startedMessage('feat')), runLine('feat'), typedLine('', '/clear')]) }), null);
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
  for (const have of [[], ['requirements'], ['requirements', 'proposal'], PLAN_UP_TO_TASKS, [...PLAN_UP_TO_TASKS, 'readiness']]) {
    const { action } = parsed(next(planChange({ have })));
    seen.push(action);
    assert.equal(action.icon, changeLoopModule.stageIcon(action), `${action.stage}: the icon`);
    assert.equal(action.icon, STAGE_ICONS[action.stage], `${action.stage}: the table's icon`);
    assert.equal(action.sessionTitle, `${action.icon} feat`, `${action.stage}: the title`);
  }
  assert.ok(seen.some((a) => a.icon === '❓') && seen.some((a) => a.icon === '📝'), 'the grill and the plan stages');
  const archived = gitRepo({ config: 'schema: devkit\n', changes: { 'archive/2026-11-19-feat': { '.openspec.yaml': 'schema: devkit\n' } } });
  const done = parsed(next(archived, [], cleanEnv, { openspec: () => ({ status: 1, stdout: '', stderr: '' }), gh: () => ({ status: 1, stdout: '', stderr: '' }) })).action;
  assert.deepEqual([done.icon, done.sessionTitle], ['📦', '📦 feat'], 'an archived end');
  // An action with no stage has no icon and no title.
  const previous = parsed(next(planChange({ have: ['requirements', 'proposal'], headerless: true }))).action;
  assert.equal(previous.icon, null);
  assert.equal('sessionTitle' in previous, false);
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
