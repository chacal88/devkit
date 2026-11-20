// node --test --test-name-pattern="^change-loop" plugins/openspec/hooks/change-loop.test.mjs
// change-coordinator: the loop, its commands and its locks (phase 1: settings, replies and the decision; phase 2: start, open, script, wait; phase 3: the locks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitRepo, put, commitAll, git } from './deliver-check.test.mjs';
import { roundRepo } from './conduct-check.test.mjs';
import { shipConfig, collectState, buildReport } from './deliver-check.mjs';
import { TEXT } from './flow-check.mjs';
import * as guardModule from './guard.mjs';
import {
  readDevkitSettings, normalizeLang, MESSAGES, render, decide, exitCodeOf, ROW_STEPS, main, HOOKS_DIR, LoopUsageError,
  runCommand, waitLoop,
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
};
const STAGE_SAMPLE = { en: 'Code review', 'pt-BR': 'Revisão de código' };
const tokensOf = (template) => [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
const codes = (lang, prefix) => Object.keys(MESSAGES[lang]).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));

// Every combination the table can render: a key, and for a parameter that names a code, each code of its family.
function renderings(lang) {
  const out = [];
  for (const [key, template] of Object.entries(MESSAGES[lang])) {
    const base = { ...SAMPLE, stage: STAGE_SAMPLE[lang], script: 'devkit', other: 'devkit-lite', setting: 'driver', driver: 'compozy', what: 'checks', why: 'small' };
    const tokens = tokensOf(template);
    const family = tokens.includes('why') ? (key === 'blocked' ? codes(lang, 'blocked-why.') : codes(lang, 'why.'))
      : tokens.includes('what') ? codes(lang, 'what.')
        : tokens.includes('driver') ? codes(lang, 'driver.')
          : tokens.includes('setting') ? codes(lang, 'setting.')
            : tokens.includes('script') ? codes(lang, 'script.') : [null];
    const slot = ['why', 'what', 'driver', 'setting', 'script'].find((t) => tokens.includes(t));
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
  const refusedWords = ['flow-check', 'deliver-check', 'conduct-check', 'change-loop', 'devkit-core', 'devkit-openspec', 'devkit-lite', 'subagent', 'progressKey', 'reasonCode', 'onFail'];
  assert.ok(refusedIds.length > 20 && refusedIds.includes('code-quality-reviewer') && refusedIds.includes('stop-branch') && refusedIds.includes('no-progress'));
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES['pt-BR']).sort(), 'the same keys in both languages');
  // Parameter texts the design table gives identically in both languages (a product name and a word that is the same).
  const EXEMPT_EQUAL = ['driver.compozy', 'setting.driver'];
  for (const lang of ['en', 'pt-BR']) {
    for (const { key, text } of renderings(lang)) {
      assert.ok(typeof text === 'string' && text.length > 0 && !/undefined|NaN|\[object|\{\w+\}/.test(text), `${lang} ${key}: ${text}`);
      assert.ok(!text.includes('`'), `${lang} ${key} has a backtick: ${text}`);
      assert.ok(!/[\w.-]+\.(md|json|mjs|js|ts|ya?ml)\b/.test(text), `${lang} ${key} names a file: ${text}`);
      assert.ok(!/\b[a-z][\w-]*=\S/i.test(text), `${lang} ${key} has a name=value shape: ${text}`);
      for (const name of [...refusedIds, ...refusedWords]) assert.ok(!wordRe(name).test(text), `${lang} ${key} holds ${name}: ${text}`);
    }
  }
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
  assert.deepEqual([pt.code, pt.stdout], [0, 'A change x parou: os testes da fase 2 falharam. Nada mais roda até isso ser resolvido.\n']);
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

test('change-loop reply: the script runs from its file and prints nothing when imported', () => {
  const r = spawnSync(process.execPath, [LOOP, 'reply', 'waiting-approval', '--lang', 'en', '--param', 'id=x'], { env: cleanEnv, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'The plan of x is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.\n');
  assert.equal(spawnSync(process.execPath, [LOOP, 'next'], { env: cleanEnv, encoding: 'utf8' }).status, 3);
});

// ---------------------------------------------------------------- next, on real repositories (D-5)

const head = (stage, c0, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${c0} -->\n`;
const PLAN_FILES = { requirements: 'requirements.md', proposal: 'proposal.md', specs: 'specs/s/spec.md', design: 'design.md', tasks: 'tasks.md', readiness: 'readiness.md', approval: 'approval.md' };

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
const parsed = (r) => {
  const [first, ...rest] = r.stdout.split('\n');
  return { first, action: JSON.parse(rest.join('\n')) };
};

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
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
  for (const argv of [['next', '--change', 'nope', '--lang', 'en'], ['next', '--lang', 'en'], ['next', '--change', 'feat', '--lang', 'en', '--bogus']]) {
    const r = main(argv, { cwd: root, env: cleanEnv });
    assert.equal(r.code, 3, argv.join(' '));
    const body = JSON.parse(r.stdout);
    assert.equal(body.version, 1);
    assert.ok(body.error.length > 0);
    assert.match(body.reply, /^The change .* stopped/);
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
function addChange(root, id, have = ['requirements'], { commit = true } = {}) {
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
  assert.match(b.reply, /stopped.*cannot be read/);
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
  for (const [verb, round] of [['roadmap', 18], ['status', 18], ['project', 19], ['help', 23]]) {
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

test('change-loop start: S2 no verb or an unknown verb says only change exists', () => {
  const root = devkitRepo();
  for (const text of ['', '   \n', 'frobnicate the thing', 'add a csv export']) {
    const b = body(startRun(root, text));
    assert.equal(b.mode, 'unknown-verb', JSON.stringify(text));
    assert.equal(b.reply, render('en', 'verb-unknown'));
  }
  assert.match(body(startRun(root, '', { lang: 'pt-BR' })).reply, /^Por enquanto só existe \/devkit change/);
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
  addChange(wt, 'wt-change', ['requirements'], { commit: false });
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
  for (const id of ['Bad', 'a', 'x--y', 'archive', 'a'.repeat(49), '-x', 'has space', 'a_b', '../x']) {
    const r = openRun(t.main, id);
    assert.equal(r.code, 3, id);
    assert.equal(r.stdout.startsWith('devkit-run:'), false);
    const b = body(r);
    assert.equal(b.reply, render('en', 'name-invalid', { id }), id);
  }
  assert.equal(openRun(t.main, 'ab').code, 0, 'two characters is the shortest valid id');
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
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
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
// The tool result of a command that printed `devkit-run: <id>`: content a string, and toolUseResult.stdout.
const runLine = (id) => stored({
  type: 'user',
  message: { role: 'user', content: [{ tool_use_id: 'toolu-0001', type: 'tool_result', content: `devkit-run: ${id}\n{"version":1}`, is_error: false }] },
  toolUseResult: { stdout: `devkit-run: ${id}\n{"version":1}`, stderr: '', interrupted: false, isImage: false, noOutputExpected: false },
});
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

// ---- the modes, as subprocesses of guard.mjs

function hook(mode, input, env = {}) {
  const r = spawnSync(process.execPath, [GUARD, mode], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...SET, ...env } });
  return { code: r.status, err: r.stderr, out: r.stdout };
}
const stopInput = (root, transcript, extra = {}) => ({ session_id: SESSION, transcript_path: transcript, cwd: root, stop_hook_active: false, background_tasks: [], ...extra });
const subInput = (root, transcript, role, extra = {}) => stopInput(root, transcript, { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001', agent_transcript_path: join(sandbox(), 'agent.jsonl'), ...extra });
const PLAN_UP_TO_TASKS = ['requirements', 'proposal', 'specs', 'design', 'tasks'];

test('change-loop lock stop: T1 no run in the session lets the stop through', () => {
  const root = planChange({ have: ['requirements'] });
  const tmp = sandbox();
  for (const transcript of [transcriptOf([assistantLine()]), transcriptOf([typedLine('change x'), assistantLine()]), transcriptOf([typedLine('change x'), runLine('feat'), typedLine('', '/clear')]), undefined]) {
    const r = hook('stop', stopInput(root, transcript), { TMPDIR: tmp });
    assert.equal(r.code, 0, r.err);
  }
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false, 'nothing recorded');
});

test('change-loop lock stop: T2 a background task running lets the stop through', () => {
  const root = planChange({ have: ['requirements'] });
  const tasks = [{ id: 'byxlntme1', type: 'shell', status: 'running', description: 'Wait 30 seconds in background', command: 'sleep 30' }];
  const r = hook('stop', stopInput(root, runTranscript(), { background_tasks: tasks }), { TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
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

test('change-loop lock stop: T4 the grill, waiting for the owner, lets the stop through', () => {
  const root = planChange({ have: [] });
  const r = hook('stop', stopInput(root, runTranscript()), { TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
});

test('change-loop lock stop: T5 a stage ready is refused once, naming the change, the stage and the command, and the key is recorded', () => {
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
  const tmp = sandbox();
  assert.equal(hook('stop', stopInput(root, join(sandbox(), 'gone.jsonl')), { TMPDIR: tmp }).code, 0);
  assert.equal(hook('stop', stopInput(root, runTranscript('nope')), { TMPDIR: tmp }).code, 0, 'a change the checker does not know');
  assert.equal(hook('stop', stopInput(root, runTranscript()), { TMPDIR: tmp, PATH: '/nonexistent' }).code, 0, 'no openspec CLI');
  const r = spawnSync(process.execPath, [GUARD, 'stop'], { input: 'not json', encoding: 'utf8', env: { ...process.env, ...SET, TMPDIR: tmp } });
  assert.equal(r.status, 0);
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false, 'nothing was refused, nothing recorded');
});

test('change-loop lock subagent-stop: U1 no run lets the stop through', () => {
  const root = planChange({ have: ['requirements'] });
  const r = hook('subagent-stop', subInput(root, transcriptOf([assistantLine()]), 'change-planner'), { TMPDIR: sandbox() });
  assert.equal(r.code, 0, r.err);
});

test('change-loop lock subagent-stop: U2 a role with no stage file lets the stop through', () => {
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
  const tmp = sandbox();
  assert.equal(hook('subagent-stop', subInput(root, join(sandbox(), 'gone.jsonl'), 'change-planner'), { TMPDIR: tmp }).code, 0);
  assert.equal(hook('subagent-stop', subInput(root, runTranscript('nope'), 'change-planner'), { TMPDIR: tmp }).code, 0);
  put(root, { 'openspec/schemas/devkit/flow.json': '{ not json' });
  assert.equal(hook('subagent-stop', subInput(root, runTranscript(), 'change-planner'), { TMPDIR: tmp }).code, 0, 'a malformed flow.json');
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false);
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
      'devkit-core:code-quality-reviewer', 'devkit-core:openspec-validator', 'devkit-core:codebase-researcher', 'change-planner'];
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
    for (const type of ['general-purpose', 'Explore', 'other-plugin:fixer']) {
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
  assert.equal(hook('agent', { cwd: liteChange(), tool_name: 'Agent', tool_input: {}, transcript_path: runTranscript() }).code, 0, 'no subagent_type');
});

// ---- the log, hooks.json, bypass and opt-in

test('change-loop lock log: one JSON line per decision with DEVKIT_HOOK_LOG, none without', () => {
  const root = planChange({ have: ['requirements'] });
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
  const root = planChange({ have: ['requirements'] });
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
  assert.match(loop, /`subagent_type` is `agent`/);
  assert.match(loop, /`--after`/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /Dispatch a subagent for a whole change/);
  assert.match(never, /Choose the order of the stages or run two stages at once/);
  assert.match(never, /Edit product code in this session/);
  assert.match(never, /Bypass a hook or a gate/);
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
  assert.deepEqual(heads, ['## Settings', '## Start', '## A new change', '## Loop', '## Owner gates', '## Waiting on GitHub', '## Never']);
  for (const mode of ['not-built', 'unknown-verb', 'not-set-up', 'setting-unknown', 'driver-not-built', 'nothing', 'choose', 'ask-unfinished', 'resume', 'new']) {
    assert.ok(md.includes(`\`${mode}\``), `mode ${mode}`);
  }
  assert.match(md, /AskUserQuestion/);
  assert.doesNotMatch(md, /conduct-check|CronCreate|start_session/);
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
  for (const f of ['0005-parallel-steps-and-a-session-wake-up.md', '0006-phases-as-child-sessions.md', '0007-one-change-on-request.md', '0009-compozy-loop-as-a-second-driver.md']) {
    assert.match(readRepo('docs', 'adr', f), /Note \(change-coordinator, \d{4}-\d{2}-\d{2}\):[^\n]*(\n[^\n]+)*?\/devkit change/, `${f} names /devkit change`);
  }
  const adrs = readRepo('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0011/, 'the ADRs line names 0011');
  const flow = readRepo('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').includes('## The change coordinator: `/devkit change`'), 'the flow doc has the section');
  assert.match(flow, /v0\.16\.0/);
  assert.doesNotMatch(flow, /v0\.15\.1/);
  const road = readRepo('openspec', 'roadmap.md').split('\n').find((l) => l.startsWith('- [ ] review-writer-prompt'));
  assert.match(road, /touches only tests/);
  assert.match(road, /fenced example/);
});
