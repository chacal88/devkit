// node scripts/test-suite.mjs plugins/openspec/hooks/change-loop.test.mjs
// change-coordinator, part 1 of 3 (suite-speed D-11; the other parts are change-loop-compozy.test.mjs and change-loop-remote.test.mjs): the loop, its commands and its locks (phase 1: settings, replies and the decision; phase 2: start, open, script, wait; phase 3: the locks). What the three parts share is in change-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, realpathSync, rmSync, utimesSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { spawnSync, spawn } from 'node:child_process';
import {
  gitRepo, put, commitAll, git, sandbox, readCounter, roundRepo, SET_LOOP as SET, cleanEnvLoop as cleanEnv, FLOWS, stageOf, nextOf, endOf, reportOf,
  rowOf, run, PLAN_FILES, head, planChange, SESSION, stored, commandText, typedLine, toolResultLine, runLine, assistantLine, transcriptOf, stopInput,
  MERGE_CONFIG, MERGE_FILES, presetMerge,
} from './test-fixtures.mjs';
import { shipConfig, collectState, buildReport, approvalState } from './deliver-check.mjs';
import { actorOf } from './conduct-check.mjs';
import { TEXT, fingerprint, collectFlow, computeFlow } from './flow-check.mjs';
import * as guardModule from './guard.mjs';
import * as changeLoopModule from './change-loop.mjs';
import {
  readDevkitSettings, normalizeLang, MESSAGES, render, exitCodeOf, ROW_STEPS, main, HOOKS_DIR, LoopUsageError, runCommand, PACKS, nextAction, waitLoop,

} from './change-loop.mjs';
import {
  HERE, LOOP, TDD, COMMIT, PLANNER, read, configRepo, shape, says, build, next, parsed, check, deliveredChange, startRun, body, titleEn, whereNext,
  snapshot, addChange, devkitRepo, openRun, freshProject, wtOf, WAIT, waited, GUARD, runOf, plainLine, skillBodyLine, runTranscript, hook, subInput,
  PLAN_UP_TO_TASKS, editInput, bashInput, liteChange, approvedChange, agentInput, readRepo, IDENT, prJson, buildRep, PMV_SHA, PMV_ERRORS, pmvRec, pmvFacts,
  gitShim, staleBase, implementingChange, PR_CONFIG, RELEASE, SKILL_FILE,

} from './change-loop-fixtures.mjs';

// The same git identity the whole file had when it was one file (see IDENT in change-loop-fixtures.mjs).
for (const [k, v] of Object.entries(IDENT)) process.env[k] ??= v;

const READINESS = 'devkit-core:plan-readiness-reviewer';
const VERIFIER = 'devkit-core:pr-verifier';

// ---------------------------------------------------------------- settings (D-9)

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
  version: 1, state: 'github', machine: 'avel', taken: 1, entry: 'avel', field: 'folder', fix: 'compozy daemon start', run: 'looprun-1',
  branch: 'develop', base: 'master', default: 'main', installed: '2.46.0', minimum: '2.50.0', key: 'PROJ-482', name: 'In Review', choices: 'move it to "In Review"; only comment; no',
  spent: 2100000, cap: 2000000, tag: 'v1.3.0', at: 'd4e5f60', sha: 'a1b2c3d', models: 'opus 3210, sonnet 1105', tokens: 4315, from: 'haiku', to: 'sonnet',
  file: '/work/repo/.claude/worktrees/add-csv-export/openspec/changes/add-csv-export/.openspec.yaml', decision: 'the dependency upgrade',
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
  assert.equal(render('pt-BR', 'blocked', { id: 'x', why: 'ceiling', stage: 'Revisão do plano', attempt: 3 }), 'A change x parou: a etapa Revisão do plano chegou ao limite de falhas seguidas (3). Nada mais roda até isso ser resolvido.');
});

// ---------------------------------------------------------------- the decision, synthetic (D-5)

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
  const next = nextOf(FLOWS.devkit, 'proposal', 'fix-after-failure', { failed: 'readiness', attempt: 1, failures: 1, ceiling: 3 });
  const a = run({ rep: { next, stages: { readiness: { state: 'failed', reasonCode: 'header-failed' } } } });
  assert.deepEqual([a.kind, a.agent, a.stage], ['agent', PLANNER, 'proposal']);
  assert.match(a.brief, /readiness failed at attempt 1 \(failures in a row: 1 of 3\): revise the plan from its findings/);
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

test('loop-evidence 15: a commit row with no paths goes to the commit agent, as one with paths does', () => {
  const none = build(rowOf('commit', { paths: [] }));
  const some = build(rowOf('commit', { paths: ['src/a.ts'] }));
  for (const a of [none, some]) {
    assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', COMMIT, 'commit', 'delivery', 'commit-and-pr']);
    assert.deepEqual(a.skills, ['commit-message-guidelines']);
  }
  assert.deepEqual(none.detail.paths, []);
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
const sh = (cwd, args, input = '') => spawnSync(process.execPath, [LOOP, ...args], { cwd, env: cleanEnv, input, encoding: 'utf8' });

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

// Invariant: an unbuilt driver runs nothing. Layer: projectGate (through startMode). Suite: guard. compozy-driver (ADR 0017) built the
// compozy driver, so it moves to the `change-loop compozy ...` tests below; the script driver (round 22) stays unbuilt.
test('change-loop start: S5 the script driver is not built and runs nothing', () => {
  for (const [driver, round] of [['script', 22]]) {
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

// Invariant: `open` refuses where `/devkit change` refuses. Layer: openChange (through projectGate). Suite: guard. The compozy driver is
// built (ADR 0017): its run opens changes with this very command, so it leaves the refusals; the last assertion is its new row.
test('change-loop open: O3 refuses in a project not set up or with an unknown or unbuilt driver', () => {
  const cases = [
    ['schema: spec-driven\n', 'not-set-up'],
    ['schema: devkit\ndevkit:\n  driver: robot\n', 'setting-unknown'],
    ['schema: devkit\ndevkit:\n  language: "no tag"\n', 'setting-unknown'],
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
  const compozy = freshProject('schema: devkit\ndevkit:\n  driver: compozy\n');
  const made = openRun(compozy.main, 'new-thing');
  assert.equal(made.code, 0, made.stdout + made.stderr);
  assert.equal(existsSync(join(wtOf(compozy, 'new-thing'), 'openspec', 'changes', 'new-thing', 'requirements.md')), true, 'open creates the change on compozy');
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
const WAIT_MERGE = build(rowOf('wait-merge', { number: 12 }));
const GH_DOWN = run({ rep: { end: endOf('blocked', 'delivery', 'gh-error', { error: 'HTTP 502' }) } });
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
// A command that ended the run: `next` or `wait` (the run line first, then the end line, then the action) or the session's own
// `reply` of an end key (the end line alone, then the reply).
const nextEndLine = (id, state, form = 'both') => toolResultLine(`devkit-run: ${id}\ndevkit-end: ${id} ${state}\n{"version":1}`, form);
const endLine = (id, state, form = 'both') => toolResultLine(`devkit-end: ${id} ${state}\nThe change ${id} stopped: x.`, form);
// The api-request-blob lines repeat the command text inside text blocks: never the typed command.
const blobLine = (text) => stored({ type: 'api-request-blob', message: { role: 'user', content: [{ type: 'text', text }] } });

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

test('change-loop lock stop: T1 no run in the session lets the stop through', () => {
  const root = planChange({ have: ['requirements', 'decisions'] });
  const tmp = sandbox();
  for (const transcript of [transcriptOf([assistantLine()]), transcriptOf([typedLine('change x'), assistantLine()]), transcriptOf([typedLine('change x'), runLine('feat'), typedLine('', '/clear')]), undefined]) {
    const r = hook('stop', stopInput(root, transcript), { TMPDIR: tmp });
    assert.equal(r.code, 0, r.err);
  }
  assert.equal(existsSync(join(tmp, 'devkit-stop')), false, 'nothing recorded');
});

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

test('change-loop lock agent: change-coordinator is refused with either pack prefix', () => {
  // Invariant: the coordinator is the session itself in a Claude run, so its CompozyOS agent opens nothing to a Claude run.
  // Layer: the hand-off lock (`handOffFor`, `NOT_AGENTS`); suite: the guard suite.
  const transcript = runTranscript();
  for (const root of [liteChange(), approvedChange()]) {
    for (const type of ['devkit-openspec:change-coordinator', 'devkit-core:change-coordinator', 'change-coordinator']) {
      const r = hook('agent', agentInput(root, transcript, type));
      assert.equal(r.code, 2, `${type}: ${r.err}`);
    }
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

// ================================================================ fresh-base-check: the loop fetches the base before it judges

const refsOf = (root) => git(root, 'for-each-ref', '--format=%(refname) %(objectname)');
const fetchHeadOf = (root) => git(root, 'rev-parse', '--path-format=absolute', '--git-path', 'FETCH_HEAD');
const MISSING = (t) => join(t.originDir, 'no-such-folder');

// Merge mode, a pull request that conflicts in two release files, the clone's origin/main one commit behind the remote.
function staleMergeFixture() {
  const d = deliveredChange({
    config: MERGE_CONFIG, files: { ...RELEASE, ...MERGE_FILES }, conflicts: ['CHANGELOG.md', '.claude-plugin/marketplace.json'],
    mergeable: 'CONFLICTING', checks: [check('build', 'pass')],
  });
  presetMerge(d.gh);
  return { ...d, ...staleBase(d.t) };
}
// What `nextAction` decides with no record of fetched bases, as `state` and the locks call it.
const localAction = (d, extra = {}) => nextAction(d.t.main, 'feat', { env: d.env, lang: 'en', ...extra });

test('fresh-base-check 1: next fetches the base before it judges, and a call with no record judges from the stale copy', () => {
  const d = staleMergeFixture();
  const local = localAction(d);
  assert.deepEqual([local.kind, local.step], ['session', 'update-branch']);
  assert.match(local.detail.reason, /merges cleanly/);
  assert.equal(git(d.t.main, 'rev-parse', 'origin/main'), d.stale, 'no fetch record, no fetch');
  const r = next(d.t.main, [], d.env);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.agent, action.step], ['agent', TDD, 'resolve-release-conflict']);
  assert.deepEqual(action.baseFetch, { ok: true, base: 'main' });
  assert.equal('reply' in action, false, 'a good fetch says nothing');
  assert.equal(git(d.t.main, 'rev-parse', 'origin/main'), d.remote);
});

test('fresh-base-check 2: a fetch that fails decides from the local copy, records it and says it in one line, in both languages', () => {
  const d = staleMergeFixture();
  git(d.t.main, 'remote', 'set-url', 'origin', MISSING(d.t));
  const local = localAction(d);
  const r = next(d.t.main, [], d.env);
  const { action } = parsed(r);
  assert.deepEqual([action.kind, action.step, r.code], [local.kind, local.step, exitCodeOf(local)]);
  assert.equal(action.step, 'update-branch');
  assert.equal(action.baseFetch.ok, false);
  assert.equal(action.baseFetch.base, 'main');
  assert.match(action.baseFetch.error, /^[^\n]+$/);
  assert.equal(action.reply, render('en', 'base-unfetched', { base: 'main' }));
  assert.equal(git(d.t.main, 'rev-parse', 'origin/main'), d.stale);
  const pt = parsed(main(['next', '--change', 'feat', '--lang', 'pt-BR'], { cwd: d.t.main, env: d.env })).action;
  assert.equal(pt.reply, render('pt-BR', 'base-unfetched', { base: 'main' }));
  assert.match(pt.reply, /Não foi possível/);
});

test('fresh-base-check 3: a fetch that outlives its timeout fails with a plain line and writes nothing', () => {
  const { t } = deliveredChange();
  const before = git(t.main, 'rev-parse', 'origin/main');
  const shim = gitShim();
  const started = Date.now();
  const got = changeLoopModule.refreshBase(t.main, 'main', { env: shim.env(cleanEnv, { sleep: 30 }), memo: changeLoopModule.baseFetches(), timeoutMs: 1000 });
  assert.ok(Date.now() - started < 10_000, 'the timeout stopped it');
  assert.deepEqual([got.ok, got.base, got.error], [false, 'main', 'timed out after 1 s']);
  assert.equal(git(t.main, 'rev-parse', 'origin/main'), before);
});

test('fresh-base-check 4: a ref that is locked fails the fetch, and the action is the local copy\'s', () => {
  const d = staleMergeFixture();
  const lock = join(git(d.t.main, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'refs', 'remotes', 'origin', 'main.lock');
  const local = localAction(d);
  writeFileSync(lock, '');
  try {
    const { action } = parsed(next(d.t.main, [], d.env));
    assert.equal(action.baseFetch.ok, false);
    assert.match(action.baseFetch.error, /lock|already exists/i, 'git words a locked ref by version');
    assert.deepEqual([action.kind, action.step], [local.kind, local.step]);
    assert.equal(git(d.t.main, 'rev-parse', 'origin/main'), d.stale);
  } finally { rmSync(lock, { force: true }); }
});

test('fresh-base-check 5: the fetch writes the one ref and nothing else', () => {
  const { t, wt, env } = deliveredChange();
  t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves');
  const { remote } = staleBase(t);
  const second = join(tmpFolder('devkit-other-'), 'second');
  git(dirname(second), 'clone', '-q', t.originDir, second);
  git(second, 'checkout', '-q', '-b', 'other');
  put(second, { 'o.txt': 'x\n' });
  commitAll(second, 'other work');
  git(second, 'push', '-q', 'origin', 'other');
  git(second, 'tag', 'v9');
  git(second, 'push', '-q', 'origin', 'v9');
  for (const root of [t.main, wt]) rmSync(fetchHeadOf(root), { force: true });
  const snapshot = (root) => [git(root, 'status', '--porcelain'), git(root, 'ls-files', '-s')];
  const before = { refs: refsOf(t.main), main: snapshot(t.main), wt: snapshot(wt) };
  const r = next(t.main, [], env);
  assert.equal(parsed(r).action.baseFetch.ok, true, r.stdout + r.stderr);
  const after = refsOf(t.main);
  // origin/HEAD is a symbolic ref to origin/main: it reads as the commit origin/main holds, and stays a symbolic ref to it.
  const without = (text) => text.split('\n').filter((l) => !/^refs\/remotes\/origin\/(main|HEAD) /.test(l));
  assert.deepEqual(without(after), without(before.refs), 'only origin/main moved');
  assert.equal(git(t.main, 'symbolic-ref', 'refs/remotes/origin/HEAD'), 'refs/remotes/origin/main');
  assert.ok(after.split('\n').includes(`refs/remotes/origin/main ${remote}`));
  assert.doesNotMatch(after, /refs\/tags\/v9|refs\/remotes\/origin\/other/);
  assert.deepEqual([snapshot(t.main), snapshot(wt)], [before.main, before.wt]);
  for (const root of [t.main, wt]) assert.equal(existsSync(fetchHeadOf(root)), false, `no FETCH_HEAD in ${root}`);
  git(wt, 'fetch', '-q', 'origin');
  assert.equal(existsSync(fetchHeadOf(wt)), true, 'self-check: a plain fetch does write FETCH_HEAD');
});

test('fresh-base-check 6: a wait fetches the base at every poll', async () => {
  const { t, gh, env } = deliveredChange();
  const shim = gitShim();
  const sleeps = [];
  const sleep = async (s) => {
    sleeps.push(s);
    if (sleeps.length === 2) gh.set('pr-checks', { stdout: [check('build', 'pass')] });
  };
  const r = await runCommand(['wait', '--change', 'feat', '--lang', 'en', '--interval', '5'], { cwd: t.main, env: shim.env(env), sleep });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(parsed(r).action.end.why, 'waiting-merge');
  assert.equal(shim.fetches().length, 3, 'three polls, three fetches');
});

test('fresh-base-check 7: state, the stop lock and a call with no record never fetch', () => {
  const d = staleMergeFixture();
  const shim = gitShim();
  const env = shim.env(d.env);
  const state = main(['state', '--change', 'feat', '--lang', 'en'], { cwd: d.t.main, env });
  assert.equal(state.code, 0, state.stderr);
  const entries = changeLoopModule.stateEntries(d.t.main, { id: 'feat', lang: 'en', env });
  assert.equal(entries.length, 1);
  const tmp = sandbox();
  const before = process.env.TMPDIR;
  process.env.TMPDIR = tmp;
  let stop;
  try {
    stop = changeLoopModule.stopDecision(stopInput(d.t.main, runTranscript()), { env });
  } finally {
    if (before === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = before;
    rmSync(tmp, { recursive: true, force: true });
  }
  assert.notEqual(stop.why, 'no-run', 'the lock read the change');
  assert.deepEqual(shim.fetches(), []);
  assert.equal(git(d.t.main, 'rev-parse', 'origin/main'), d.stale);
});

test('fresh-base-check 8: a record of fetched bases lets one call fetch a base once, and each next call fetches again', () => {
  const { t, env: base } = deliveredChange();
  const shim = gitShim();
  const env = shim.env(base);
  const memo = changeLoopModule.baseFetches();
  nextAction(t.main, 'feat', { env, lang: 'en', fetchBase: memo });
  nextAction(t.main, 'feat', { env, lang: 'en', fetchBase: memo });
  assert.equal(shim.fetches().length, 1, 'two calls sharing one record fetch once');
  shim.clear();
  next(t.main, [], env);
  next(t.main, [], env);
  assert.equal(shim.fetches().length, 2, 'each next call has its own record');
});

test('fresh-base-check 9: the two checkers never fetch, and their headers say so', () => {
  const d = staleMergeFixture();
  const shim = gitShim();
  const env = shim.env(d.env);
  spawnSync(process.execPath, [join(HERE, 'conduct-check.mjs'), '--json', '--change', 'feat'], { cwd: d.t.main, env, encoding: 'utf8' });
  spawnSync(process.execPath, [join(HERE, 'deliver-check.mjs'), 'feat', '--json'], { cwd: d.wt, env, encoding: 'utf8' });
  assert.deepEqual(shim.fetches(), []);
  assert.equal(git(d.t.main, 'rev-parse', 'origin/main'), d.stale);
  for (const file of ['conduct-check.mjs', 'deliver-check.mjs']) {
    assert.match(read(file).split('\n').slice(0, 6).join('\n'), /never fetches|or fetches/, `${file} says it does not fetch`);
  }
  spawnSync('git', ['-C', d.t.main, 'fetch', '-q', 'origin'], { env });
  assert.equal(shim.fetches().length, 1, 'self-check: a fetch through the shim is logged');
});

test('fresh-base-check 10: a wait that only gains the failed-fetch line goes on waiting', async () => {
  const wait = { kind: 'end', end: { state: 'waiting-on-github', why: 'waiting-github' }, reply: 'it waits' };
  const unfetched = { ...wait, reply: 'it waits\nthe base was not fetched', baseFetch: { ok: false, base: 'main', error: 'x' } };
  const done = { kind: 'session', step: 'update-branch', reply: null };
  const polls = [wait, unfetched, done];
  let n = 0;
  const got = await waitLoop({ poll: async () => polls[n++], sleep: async () => {}, interval: 5, id: 'feat', lang: 'en' });
  assert.equal(got, done);
  assert.equal(n, 3);
});

test('fresh-base-check 19: a wait whose fetch really fails keeps waiting, and ends on the real change of decision', async () => {
  const { t, gh, env } = deliveredChange();
  const sleeps = [];
  const sleep = async (s) => {
    sleeps.push(s);
    if (sleeps.length === 1) git(t.main, 'remote', 'set-url', 'origin', MISSING(t));
    if (sleeps.length === 2) gh.set('pr-checks', { stdout: [check('build', 'pass')] });
  };
  const r = await runCommand(['wait', '--change', 'feat', '--lang', 'en', '--interval', '5'], { cwd: t.main, env, sleep });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const { action } = parsed(r);
  assert.equal(sleeps.length, 2, 'the poll that only gained the failed-fetch line did not end the wait');
  assert.equal(action.end.why, 'waiting-merge');
  assert.equal(action.baseFetch.ok, false);
  assert.ok(action.reply.endsWith(`\n${render('en', 'base-unfetched', { base: 'main' })}`));
});

test('fresh-base-check 19b: a reply that is only the failed-fetch line is no new decision either', async () => {
  const d = staleMergeFixture();
  const origin = git(d.t.main, 'remote', 'get-url', 'origin');
  const seen = [];
  // The first poll judges from the local copy (no fetch); the second fetches and fails; the third fetches and moves the base.
  const poll = async () => {
    if (seen.length === 1) git(d.t.main, 'remote', 'set-url', 'origin', MISSING(d.t));
    if (seen.length === 2) git(d.t.main, 'remote', 'set-url', 'origin', origin);
    const a = nextAction(d.t.main, 'feat', { env: d.env, lang: 'en', ...(seen.length === 0 ? {} : { fetchBase: changeLoopModule.baseFetches() }) });
    seen.push(a);
    return a;
  };
  const got = await waitLoop({ poll, sleep: async () => {}, interval: 5, id: 'feat', lang: 'en', waiting: () => true });
  assert.equal(seen[0].reply ?? null, null, 'the local action has no reply');
  assert.deepEqual([seen[1].baseFetch.ok, seen[1].reply], [false, render('en', 'base-unfetched', { base: 'main' })], 'the failed fetch is the whole reply');
  assert.equal(seen.length, 3, 'the poll that only gained the line did not end the wait');
  assert.deepEqual([got.kind, got.step], ['agent', 'resolve-release-conflict']);
});

test('fresh-base-check 20: a failed fetch appends its line to a reply the local action already has', () => {
  const d = deliveredChange();
  const local = localAction(d);
  assert.equal(local.kind, 'end');
  assert.equal(typeof local.reply, 'string');
  assert.notEqual(local.reply, '', 'the local action has a reply of its own');
  git(d.t.main, 'remote', 'set-url', 'origin', MISSING(d.t));
  const r = next(d.t.main, [], d.env);
  const { action } = parsed(r);
  assert.equal(action.baseFetch.ok, false);
  assert.equal(action.reply, `${local.reply}\n${render('en', 'base-unfetched', { base: 'main' })}`);
  assert.deepEqual([action.kind, action.end.why, r.code], [local.kind, local.end.why, exitCodeOf(local)]);
});

test('fresh-base-check 16: a repository with no remote fetches nothing and decides as it did', () => {
  const d = deliveredChange();
  git(d.t.main, 'remote', 'remove', 'origin');
  const shim = gitShim();
  const env = shim.env(d.env);
  const local = nextAction(d.wt, 'feat', { env: d.env, lang: 'en' });
  const r = next(d.t.main, [], env);
  const { action } = parsed(r);
  assert.deepEqual(shim.fetches(), []);
  assert.equal('baseFetch' in action, false);
  assert.deepEqual([action.kind, action.step, action.reply, r.code], [local.kind, local.step, local.reply, exitCodeOf(local)]);
  const memo = changeLoopModule.baseFetches();
  assert.equal(changeLoopModule.refreshBase(d.t.main, 'main', { env, memo }), null);
  assert.equal(changeLoopModule.refreshBase(d.t.main, 'main', { env, memo }), null, 'the null is memoized');
  assert.deepEqual(shim.fetches(), []);
});

test('fresh-base-check 17: a change before its delivery fetches nothing', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n\n## Round 1: x\n- [ ] plan\n- [ ] impl\n', config: PR_CONFIG, files: RELEASE });
  const plan = t.addWt('plan');
  const c0 = git(plan, 'rev-parse', 'HEAD');
  put(plan, { 'openspec/changes/plan/.openspec.yaml': 'schema: devkit-lite\n', 'openspec/changes/plan/requirements.md': `${head('requirements', c0)}# Requirements\n` });
  commitAll(plan, 'requirements');
  t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves');
  const { stale } = staleBase(t);
  const shim = gitShim();
  const env = shim.env(cleanEnv);
  const planned = main(['next', '--change', 'plan', '--lang', 'en'], { cwd: t.main, env, gh: t.ghFor(plan) });
  assert.notEqual(planned.code, 3, planned.stderr);
  assert.equal('baseFetch' in parsed(planned).action, false);
  assert.deepEqual(shim.fetches(), []);
  assert.equal(git(t.main, 'rev-parse', 'origin/main'), stale);
  const impl = implementingChange(t, 'impl');
  const building = main(['next', '--change', 'impl', '--lang', 'en'], { cwd: t.main, env, gh: t.ghFor(impl) });
  assert.notEqual(building.code, 3, building.stderr);
  assert.equal(shim.fetches().length, 1, 'self-check: a change in its delivery part does fetch');
});

test('fresh-base-check 11: the docs and the skills state the rule of the fetch', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  const texts = [
    'Before it asks the delivery checker, `next` fetches the default branch from `origin` into `origin/<base>` (`git fetch --no-tags --quiet --no-write-fetch-head origin +refs/heads/<base>:refs/remotes/origin/<base>`, at most 15 seconds, once per call), so the release-conflict, staleness and archive steps are judged from the base as the remote has it; the fetch writes that one ref. A fetch that fails stops nothing: the action is decided from the local copy, records `baseFetch: { ok: false, base, error }`, and its reply ends with one line saying so. A successful one records `baseFetch: { ok: true, base }`. `state` and the locks never fetch.',
    'each poll fetches the base first, as `next` does, and a failed fetch alone is no new decision;',
    'and never fetches: the loops of `/devkit change` and `/devkit roadmap` fetch the base before they ask it, and a run by hand needs `git fetch origin --prune --quiet` first',
    'and `deliver-check` never fetches (the loop of `/devkit change` fetches `origin/<base>` before it asks, but the archive state is still read from GitHub)',
    '`run`, `next` and `wait` fetch the base once per call (and at each poll of a wait) before they decide a change in delivery, as the change loop\'s `next` does; `status`, `status --json`, `draft` and the locks never fetch.',
  ];
  for (const text of texts) assert.ok(flow.includes(text), `docs/openspec-flow.md: ${text.slice(0, 60)}`);
  assert.doesNotMatch(flow, /never fetches \(run/);
  const ship = readRepo('plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md');
  const row = ship.split('\n').find((l) => l.startsWith('| `update-branch`'));
  assert.ok(row?.includes('`deliver-check` never fetches; under `/devkit change` the loop fetched `origin/<base>` just before it handed this step.'), 'the update-branch row');
  assert.match(row, /gh pr update-branch <next\.number>/);
  const skill = readFileSync(SKILL_FILE, 'utf8');
  const loop = skill.slice(skill.indexOf('\n## Loop\n'), skill.indexOf('\n## Owner gates\n'));
  assert.ok(loop.includes('An action whose `baseFetch.ok` is false ends its `reply` with one line saying the step was decided from this machine\'s copy of the base: keep that line for the message that ends the turn, whatever the action\'s kind.'), 'the Loop section');
});

// stage-ceiling-consecutive (AC-6, the loops): the ceiling and the fix briefs say the failures in a row.
test('stage-ceiling-consecutive AC-6 loop: a report with no failures falls back to the attempt in the plan brief', () => {
  const plan = run({ rep: { next: nextOf(FLOWS.devkit, 'proposal', 'fix-after-failure', { failed: 'readiness', attempt: 2, ceiling: 3 }) } });
  assert.ok(plan.brief.includes('readiness failed at attempt 2 (failures in a row: 2 of 3): revise the plan from its findings'), plan.brief);
});
test('stage-ceiling-consecutive AC-6 loop: the ceiling reply says the failures in a row, in both languages', () => {
  const ended = (lang, params) => run({ ctx: { lang }, rep: { end: endOf('blocked', 'evidence', 'ceiling-reached', { stage: 'evidence', ceiling: 3, ...params }) } });
  const full = { attempt: 5, failures: 3 };
  assert.equal(ended('en', full).reply, 'The change feat stopped: the demonstration reached its limit of failures in a row (3). Nothing more runs until this is sorted out.');
  assert.equal(ended('pt-BR', full).reply, 'A change feat parou: a etapa Demonstração chegou ao limite de falhas seguidas (3). Nada mais roda até isso ser resolvido.');
  // Params that carry no `failures` (an end recorded before this release) render the attempt.
  assert.equal(ended('en', { attempt: 4 }).reply, 'The change feat stopped: the demonstration reached its limit of failures in a row (4). Nothing more runs until this is sorted out.');
  assert.equal(ended('pt-BR', { attempt: 4 }).reply, 'A change feat parou: a etapa Demonstração chegou ao limite de falhas seguidas (4). Nada mais roda até isso ser resolvido.');
});

// ---------------------------------------------------------------- post-merge-validate, phase 1 (D-1 to D-3)

// Invariant: after a merge of the base the loop checks the plan with `openspec validate <id> --type change --strict`; the pieces are the sha of
// the merge (baseMergeOf), the record of the check (readMergeCheck) and the command that writes it (merge-check). Layer: the loop's
// own commands. Suite: this file. Every merge is made in a temporary repository; none reads this repository's history.

// The export of `change-loop.mjs` a phase-1 test reaches, as a function, or a failure that names it.
const pmvExport = (name) => {
  assert.equal(typeof changeLoopModule[name], 'function', `change-loop.mjs exports ${name}`);
  return changeLoopModule[name];
};

const PMV_ROADMAP = '# Roadmap\n\n## Round 1: x\n- [ ] feat\n';
const PMV_SCENARIO = (name) => `#### Scenario: ${name}\n- **WHEN** the thing runs\n- **THEN** it works\n`;
// The canonical spec `openspec/specs/cap/spec.md` with one requirement and the scenarios named.
const pmvSpec = (...scenarios) => `# cap Specification\n\n## Purpose\nThe capability holds a thing that works, so the change has something to modify.\n\n## Requirements\n\n### Requirement: Thing works\nThe system SHALL make the thing work.\n\n${scenarios.map(PMV_SCENARIO).join('\n')}`;
// The change's delta: MODIFIES that requirement and carries the scenarios named.
const pmvDelta = (...scenarios) => `## MODIFIED Requirements\n\n### Requirement: Thing works\nThe system SHALL make the thing work, differently.\n\n${scenarios.map(PMV_SCENARIO).join('\n')}`;
const PMV_PROPOSAL = '# Proposal\n\n## Why\n\nThe thing needs to work in a new way, which this sentence explains at enough length.\n\n## What Changes\n\n- The thing works differently.\n';
const pmvHeader = (stage, commit) => `<!-- devkit-stage ${stage} result=passed attempt=1 commit=${commit} -->\n`;

// A bare origin, a clone and a worktree `feat` whose change modifies the requirement of `openspec/specs/cap/spec.md` and keeps its
// one scenario, every plan file with a passed stage header, all committed on the branch `feat`.
function pmvRepo({ spec = 'cap' } = {}) {
  const t = roundRepo({ roadmap: PMV_ROADMAP, config: 'schema: devkit-lite\n', files: { [`openspec/specs/${spec}/spec.md`]: pmvSpec('First') } });
  const wt = t.addWt('feat');
  const base = git(wt, 'rev-parse', 'HEAD');
  const dir = (f) => `openspec/changes/feat/${f}`;
  put(wt, {
    [dir('.openspec.yaml')]: 'schema: devkit-lite\n',
    [dir('proposal.md')]: `${pmvHeader('proposal', base)}${PMV_PROPOSAL}`,
    [dir(`specs/${spec}/spec.md`)]: `${pmvHeader('specs', base)}${pmvDelta('First')}`,
    [dir('tasks.md')]: `${pmvHeader('tasks', base)}# Tasks\n\n## 1. First\n- [x] 1.1 code\n`,
    'src/feat.txt': 'code\n',
  });
  commitAll(wt, 'the change');
  return { t, wt };
}

// Origin gets `files`, then the worktree merges it with a merge commit; returns the merge's sha.
function pmvMerge({ t, wt }, files, message = 'origin moves') {
  t.commitOrigin(files, message);
  git(wt, 'merge', '-q', '--no-ff', '--no-edit', 'origin/main');
  return git(wt, 'rev-parse', 'HEAD');
}

const pmvRecordFile = (wt, id = 'feat') => join(git(wt, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'devkit', 'merge-check', `${id}.json`);
const pmvRecord = (wt, id = 'feat') => (existsSync(pmvRecordFile(wt, id)) ? JSON.parse(readFileSync(pmvRecordFile(wt, id), 'utf8')) : null);
const pmvCheck = (wt, extra = {}, id = 'feat') => {
  const r = main(['merge-check', id, '--lang', 'en'], { cwd: wt, env: cleanEnv, ...extra });
  return { r, body: r.stdout.trim().startsWith('{') ? JSON.parse(r.stdout) : null };
};
// Every `devkit-stage` line of the change folder, by file.
const pmvHeaderLines = (wt, id = 'feat') => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  return walk(join(wt, 'openspec', 'changes', id)).sort().map((f) => [f, readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('devkit-stage'))]);
};

test('post-merge-validate 1: baseMergeOf gives the newest merge on the branch that origin/<base> does not hold, else null', () => {
  const baseMergeOf = pmvExport('baseMergeOf');
  const bare = gitRepo();
  assert.equal(baseMergeOf(bare, 'origin/main'), null, 'no origin/main at all');

  const r = pmvRepo();
  assert.equal(baseMergeOf(r.wt, 'origin/main'), null, 'no merge on the branch');
  const first = pmvMerge(r, { 'docs/a.txt': 'a\n' });
  assert.equal(baseMergeOf(r.wt, 'origin/main'), first, 'one merge');
  put(r.wt, { 'src/more.txt': 'more\n' });
  commitAll(r.wt, 'a plain commit after the merge');
  assert.equal(baseMergeOf(r.wt, 'origin/main'), first, 'a plain commit after it: still the merge');
  const second = pmvMerge(r, { 'docs/b.txt': 'b\n' });
  assert.notEqual(second, first);
  assert.equal(baseMergeOf(r.wt, 'origin/main'), second, 'two merges: the newer');

  git(r.wt, 'push', '-q', 'origin', 'HEAD:main');
  assert.equal(baseMergeOf(r.wt, 'origin/main'), null, 'the branch merged into origin/main: its merges are reachable from it');
});

test('post-merge-validate 1: baseMergeOf sees a merge made in another clone and brought by git pull --ff-only', () => {
  const baseMergeOf = pmvExport('baseMergeOf');
  const r = pmvRepo();
  git(r.wt, 'push', '-q', 'origin', 'feat');
  r.t.commitOrigin({ 'docs/a.txt': 'a\n' }, 'origin moves');
  const other = join(tmpFolder('devkit-pmv-other-'), 'clone');
  git(r.t.main, 'clone', '-q', r.t.originDir, other);
  git(other, 'checkout', '-q', 'feat');
  git(other, 'merge', '-q', '--no-ff', '--no-edit', 'origin/main');
  git(other, 'push', '-q', 'origin', 'feat');
  git(r.wt, 'pull', '-q', '--ff-only', 'origin', 'feat');
  assert.equal(baseMergeOf(r.wt, 'origin/main'), git(r.wt, 'rev-parse', 'HEAD'));
});

test('post-merge-validate 1: mergeCheckFile is in the git common directory and readMergeCheck takes only a whole record of the change', () => {
  const mergeCheckFile = pmvExport('mergeCheckFile');
  const readMergeCheck = pmvExport('readMergeCheck');
  const r = pmvRepo();
  assert.equal(mergeCheckFile(r.wt, 'feat'), pmvRecordFile(r.wt, 'feat'));
  assert.ok(!mergeCheckFile(r.wt, 'feat').startsWith(r.wt), 'never in the worktree');

  const dir = tmpFolder('devkit-pmv-record-');
  const whole = { version: 1, change: 'feat', merge: 'a1b2c3d4'.repeat(5), result: 'red', reds: 2, fingerprint: 'abc123def456', errors: '- ERROR x', error: null, at: '2026-11-23T10:00:00.000Z' };
  const write = (name, body) => { const f = join(dir, name); writeFileSync(f, typeof body === 'string' ? body : JSON.stringify(body)); return f; };
  const bad = {
    empty: '', truncated: '{"version":1,', 'not JSON': 'not json at all', 'an array': '[]',
    'version 2': { ...whole, version: 2 }, 'another change': { ...whole, change: 'other' }, 'a short sha': { ...whole, merge: 'a1b2c3d' },
    'a sha that is not hex': { ...whole, merge: 'z'.repeat(40) }, 'an unknown result': { ...whole, result: 'maybe' },
    'reds -1': { ...whole, reds: -1 }, 'reds 1.5': { ...whole, reds: 1.5 }, 'reds a string': { ...whole, reds: '1' },
    'no fingerprint': { ...whole, fingerprint: undefined },
  };
  assert.equal(readMergeCheck(join(dir, 'missing.json'), 'feat'), null, 'missing');
  for (const [name, body] of Object.entries(bad)) assert.equal(readMergeCheck(write(`${name.replace(/\W/g, '-')}.json`, body), 'feat'), null, name);
  assert.deepEqual(readMergeCheck(write('whole.json', whole), 'feat'), whole);
  for (const result of ['green', 'red', 'cannot-run']) assert.equal(readMergeCheck(write(`${result}.json`, { ...whole, result }), 'feat')?.result, result, result);
});

test('post-merge-validate 1: the command on a valid change after a merge answers green, records it and changes no file', () => {
  const r = pmvRepo();
  const merge = pmvMerge(r, { 'docs/a.txt': 'a\n' });
  const headers = pmvHeaderLines(r.wt);
  const before = git(r.wt, 'status', '--porcelain');
  const { r: out, body } = pmvCheck(r.wt);
  assert.equal(out.code, 0, out.stdout + out.stderr);
  assert.deepEqual([body.version, body.change, body.base, body.merge, body.result, body.reds], [1, 'feat', 'main', merge, 'green', 0]);
  const record = pmvRecord(r.wt);
  assert.deepEqual([record.version, record.change, record.merge, record.result, record.reds], [1, 'feat', merge, 'green', 0]);
  assert.equal(record.fingerprint, fingerprint(r.wt, git(r.wt, 'rev-parse', 'HEAD')), 'the record holds the fingerprint taken before the CLI ran');
  assert.equal(git(r.wt, 'status', '--porcelain'), before, 'nothing in the worktree changed');
  assert.deepEqual(pmvHeaderLines(r.wt), headers, 'every stage header line is as it was');
});

test('post-merge-validate 1: a merge that brings a scenario the delta drops is red, counted by merge, and green once the delta carries it', () => {
  const r = pmvRepo();
  pmvMerge(r, { 'docs/a.txt': 'a\n' });
  assert.equal(pmvCheck(r.wt).body.result, 'green', 'the fixture validates after a merge that changes nothing of the spec');

  const merge = pmvMerge(r, { 'openspec/specs/cap/spec.md': pmvSpec('First', 'Second added on main') }, 'main adds a scenario');
  assert.equal(git(r.wt, 'diff', '--name-only', 'HEAD^1', 'HEAD').split('\n').filter((f) => f.startsWith('openspec/changes/feat/')).length, 0, 'the merge touches nothing of the change');
  const headers = pmvHeaderLines(r.wt);
  const first = pmvCheck(r.wt);
  assert.equal(first.r.code, 0, 'a red check still exits 0: the session runs next either way');
  assert.deepEqual([first.body.merge, first.body.result, first.body.reds], [merge, 'red', 1]);
  assert.match(first.body.errors, /Thing works/);
  assert.match(first.body.errors, /Second added on main/);
  assert.equal(pmvRecord(r.wt).reds, 1);
  assert.deepEqual([pmvCheck(r.wt).body.result, pmvRecord(r.wt).reds], ['red', 2], 'the same merge again: counted on');
  assert.deepEqual(pmvHeaderLines(r.wt), headers, 'a red check touches no stage header');

  put(r.wt, { 'openspec/changes/feat/specs/cap/spec.md': `${pmvHeader('specs', merge)}${pmvDelta('First', 'Second added on main')}` });
  const fixed = pmvCheck(r.wt);
  assert.deepEqual([fixed.body.result, fixed.body.reds], ['green', 0]);
  assert.deepEqual([pmvRecord(r.wt).result, pmvRecord(r.wt).reds], ['green', 0]);
});

test('post-merge-validate 1: a change that shares its name with a canonical spec is checked as the change: green, or red on a bad delta, never cannot-run', () => {
  const r = pmvRepo({ spec: 'feat' });
  pmvMerge(r, { 'docs/a.txt': 'a\n' });
  const green = pmvCheck(r.wt);
  assert.equal(green.r.code, 0, green.r.stdout + green.r.stderr);
  assert.deepEqual([green.body.result, green.body.error], ['green', null], 'the CLI is told the id names a change');

  pmvMerge(r, { 'openspec/specs/feat/spec.md': pmvSpec('First', 'Second added on main') }, 'main adds a scenario');
  const red = pmvCheck(r.wt);
  assert.deepEqual([red.body.result, red.body.error], ['red', null]);
  assert.match(red.body.errors, /Second added on main/);
});

// An `openspec` program that prints `body` and exits with `status`, in a folder of its own to put first on PATH.
function pmvOpenspecStub(body, status = 1) {
  const dir = tmpFolder('devkit-pmv-stub-');
  const file = join(dir, 'openspec');
  writeFileSync(file, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 2.0.0; exit 0; fi\ncat <<'END'\n${body}\nEND\nexit ${status}\n`);
  chmodSync(file, 0o755);
  return dir;
}

test('post-merge-validate 1: a red with more issues than fit is cut at 4000 characters of errors, ending in an ellipsis', () => {
  const r = pmvRepo();
  const merge = pmvMerge(r, { 'docs/a.txt': 'a\n' });
  const issues = Array.from({ length: 200 }, (_, i) => ({ level: 'ERROR', path: `specs/cap/spec.md#${i}`, message: `issue number ${i} is described at some length` }));
  const stdout = JSON.stringify({ items: [{ id: 'feat', type: 'change', valid: false, issues }] });
  const { r: out, body } = pmvCheck(r.wt, { openspec: () => ({ status: 1, stdout, stderr: '', missing: false, timedOut: false }) });
  assert.equal(out.code, 0, out.stdout + out.stderr);
  assert.deepEqual([body.merge, body.result], [merge, 'red']);
  assert.equal(body.errors.length, 4000);
  assert.ok(body.errors.endsWith('…'));
  assert.ok(body.errors.startsWith('- ERROR specs/cap/spec.md#0: issue number 0'));
  assert.equal(pmvRecord(r.wt).errors, body.errors, 'the record holds the cut text');
});

test('post-merge-validate 1: a check that cannot run is cannot-run with its cause, never green, and keeps the count of reds', () => {
  const r = pmvRepo();
  const merge = pmvMerge(r, { 'openspec/specs/cap/spec.md': pmvSpec('First', 'Second added on main') });
  const cannot = (extra, expectError) => {
    const { r: out, body } = pmvCheck(r.wt, extra);
    assert.equal(out.code, 0, out.stdout + out.stderr);
    assert.equal(body.result, 'cannot-run');
    assert.equal(body.merge, merge);
    assert.match(body.error, expectError);
    assert.equal(pmvRecord(r.wt).result, 'cannot-run', 'the record never reads green');
    return body;
  };

  // No openspec program on PATH: an empty folder (not node's own, which may hold the CLI); the command runs in process.execPath.
  const empty = tmpFolder('devkit-pmv-nopath-');
  assert.match(cannot({ env: { ...cleanEnv, PATH: empty } }, /openspec CLI/).error, /not installed or not on PATH/);
  const unknown = pmvOpenspecStub('{"status":[{"severity":"error","code":"unknown_item","message":"Unknown item \'feat\'."}]}');
  assert.match(cannot({ env: { ...cleanEnv, PATH: `${unknown}:${cleanEnv.PATH}` } }, /Unknown item 'feat'/).error, /^Unknown item/);
  const noJson = pmvOpenspecStub('this is not json');
  cannot({ env: { ...cleanEnv, PATH: `${noJson}:${cleanEnv.PATH}` } }, /this is not json/);
  assert.equal(cannot({ openspec: () => ({ status: null, stdout: '', stderr: '', missing: false, timedOut: true }) }, /timed out/).error, 'openspec validate timed out');
  cannot({ openspec: () => ({ status: null, stdout: '', stderr: '', missing: false, timedOut: false, refused: 'the pinned CLI is not installed' }) }, /the pinned CLI is not installed/);
  const validButFailed = JSON.stringify({ items: [{ id: 'feat', type: 'change', valid: true, issues: [] }] });
  cannot({ openspec: () => ({ status: 1, stdout: validButFailed, stderr: '', missing: false, timedOut: false }) }, /exit 1|valid/);

  // A red, then a check that cannot run, then a red again on the same merge: the count goes on from the earlier one.
  const red = pmvCheck(r.wt).body;
  assert.deepEqual([red.result, red.reds], ['red', 1]);
  const stuck = cannot({ openspec: () => ({ status: null, stdout: '', stderr: '', missing: false, timedOut: true }) }, /timed out/);
  assert.equal(stuck.reds, 1, 'cannot-run keeps the reds of the same merge');
  assert.equal(pmvRecord(r.wt).reds, 1);
  assert.deepEqual([pmvCheck(r.wt).body.reds], [2], 'a later red counts on from the earlier one');
});

test('post-merge-validate 1: the command with no merge says none and writes nothing; an unknown change or a missing id exits 3', () => {
  const r = pmvRepo();
  const none = pmvCheck(r.wt);
  assert.equal(none.r.code, 0, none.r.stdout + none.r.stderr);
  assert.deepEqual([none.body.version, none.body.change, none.body.base, none.body.merge, none.body.result], [1, 'feat', 'main', null, 'none']);
  assert.equal(existsSync(pmvRecordFile(r.wt)), false, 'no record');

  pmvMerge(r, { 'docs/a.txt': 'a\n' });
  const unknown = pmvCheck(r.wt, {}, 'nope');
  assert.equal(unknown.r.code, 3);
  assert.match(unknown.body.error, /unknown change nope/);
  assert.equal(existsSync(pmvRecordFile(r.wt, 'nope')), false, 'no record for an unknown change');
  const missing = main(['merge-check', '--lang', 'en'], { cwd: r.wt, env: cleanEnv });
  assert.equal(missing.code, 3);
  assert.match(JSON.parse(missing.stdout).error, /merge-check <id> --lang/, 'the usage names the command');
  assert.match(read('change-loop.mjs'), /`?merge-check <id> --lang <l>`?/, 'the header comment of change-loop.mjs names it');
});

// ---------------------------------------------------------------- post-merge-validate, phase 2 (D-4 to D-7)

// Invariant: after a merge of the base, `decide` offers the `merge-check` step before every step that pushes or waits on the pull
// request, hands a red result to the planner with no stage attempt spent, and ends blocked after three reds or a check that cannot
// run. Layer: the loop's decision (`decide`, `nextAction`). Suite: this file.

const PMV_SHA7 = PMV_SHA.slice(0, 7);
const PMV_CHECK_BEFORE = ['verify', 'review', 'push', 'open-pr', 'open-prs', 'open-test-pr', 'push-support', 'move-test-pr', 'edit-pr-body',
  'enable-auto-merge', 'update-branch', 'rerun-checks', 'wait-checks', 'wait-merge', 'ready', 'ready-test-branch', 'ready-base'];
const PMV_COMMAND = ['node', join(HOOKS_DIR, 'change-loop.mjs'), 'merge-check', 'feat', '--lang', 'en'];

test('post-merge-validate 2: with a merge and no record every step that pushes or waits on the pull request gets the merge-check step', () => {
  for (const step of PMV_CHECK_BEFORE) {
    const a = build(rowOf(step), pmvFacts());
    assert.deepEqual([a.kind, a.step, a.stage, exitCodeOf(a)], ['session', 'merge-check', 'evidence', 0], step);
    assert.deepEqual(a.detail.command, PMV_COMMAND, step);
    assert.equal(a.detail.merge, PMV_SHA);
    assert.equal(a.detail.base, 'main');
    assert.equal(a.progressKey, 'evidence/merge-check@abc123');
  }
});

test('post-merge-validate 2: a step outside the list, the archive branch, no merge and a flow without evidence get no merge-check step', () => {
  const same = (row, facts, label, over = {}) => {
    const withCheck = run({ rep: buildRep(), ...over, facts: { row, ...facts } });
    const without = run({ rep: buildRep(), ...over, facts: { row, ...(facts.archiving ? { archiving: true } : {}) } });
    assert.notEqual(withCheck.step, 'merge-check', label);
    assert.deepEqual(withCheck, without, label);
  };
  for (const step of ['implement', 'fix-review', 'resolve-release-conflict', 'gate', 'commit', 'disable-auto-merge', 'blocked', 'stop-archive']) {
    same(rowOf(step), pmvFacts(), step);
  }
  same(rowOf('verify'), pmvFacts(null, { archiving: true }), 'archiving');
  same(rowOf('verify'), { mergeCheck: { base: 'main', merge: null, record: null } }, 'no merge');
  same(rowOf('verify'), { mergeCheck: null }, 'no fact');
  const noEvidence = { ...FLOWS.devkit, stages: FLOWS.devkit.stages.filter((s) => s.id !== 'evidence') };
  same(rowOf('push'), pmvFacts(), 'a flow without an evidence stage', { flow: noEvidence, rep: { next: nextOf(noEvidence, 'delivery', 'not-pushed', { number: 12 }) } });
});

test('post-merge-validate 2: a green record of the merge gives the action without the check; a green record of another merge does not', () => {
  const green = pmvRec({ result: 'green', reds: 0, errors: null });
  const a = build(rowOf('verify'), pmvFacts(green));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage], ['agent', VERIFIER, 'verify', 'evidence']);
  assert.deepEqual(a, build(rowOf('verify'), { mergeCheck: null }));
  const other = build(rowOf('verify'), pmvFacts({ ...green, merge: '0123456789'.repeat(4) }));
  assert.deepEqual([other.kind, other.step], ['session', 'merge-check']);
});

test('post-merge-validate 2: a red record of the same files goes to the planner as a merge defect; other files offer the check again', () => {
  const a = build(rowOf('verify'), pmvFacts(pmvRec()));
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role, exitCodeOf(a)], ['agent', PLANNER, 'merge-defect', 'specs', 'change-planner', 0]);
  for (const part of ['merge defect', 'origin/main', PMV_SHA7, PMV_ERRORS, 'Leave every stage header line', 'openspec validate feat --type change --strict', 'red check 1 of 3']) {
    assert.ok(a.brief.includes(part), `the brief holds: ${part}`);
  }
  assert.deepEqual([a.detail.base, a.detail.merge, a.detail.reds, a.detail.ceiling, a.detail.errors], ['main', PMV_SHA, 1, 3, PMV_ERRORS]);
  const changed = build(rowOf('verify'), pmvFacts(pmvRec({ fingerprint: 'fff999' })));
  assert.deepEqual([changed.kind, changed.step], ['session', 'merge-check'], 'the planner changed files: check again');
  const again = build(rowOf('verify'), { ...pmvFacts(pmvRec()), after: a.progressKey });
  assert.deepEqual([again.end.state, again.end.why], ['blocked', 'no-progress'], 'a planner that changed nothing');
});

test('post-merge-validate 2: three reds in a row on one merge end blocked, the ceiling is the flow default, the evidence stage is not read', () => {
  assert.equal(build(rowOf('verify'), pmvFacts(pmvRec({ reds: 2 }))).agent, PLANNER);
  const stopped = build(rowOf('verify'), pmvFacts(pmvRec({ reds: 3 })));
  assert.deepEqual([stopped.kind, stopped.end.state, stopped.end.why, stopped.stage, exitCodeOf(stopped)], ['end', 'blocked', 'merge-defect', 'evidence', 2]);
  assert.ok(stopped.reply.includes(PMV_SHA7) && stopped.reply.includes('3'), stopped.reply);
  assert.equal(stopped.reply, says('blocked', { why: 'merge-defect', sha: PMV_SHA7, attempt: 3 }));
  const moved = build(rowOf('verify'), pmvFacts(pmvRec({ reds: 3, fingerprint: 'fff999' })));
  assert.deepEqual([moved.kind, moved.step], ['session', 'merge-check'], 'at the ceiling, files that changed since the red offer the check again');

  const two = { ...FLOWS.devkit, ceilings: { ...FLOWS.devkit.ceilings, default: 2 } };
  assert.equal(run({ flow: two, rep: buildRep(), facts: { row: rowOf('verify'), ...pmvFacts(pmvRec({ reds: 1 })) } }).agent, PLANNER);
  const lower = run({ flow: two, rep: buildRep(), facts: { row: rowOf('verify'), ...pmvFacts(pmvRec({ reds: 2 })) } });
  assert.deepEqual([lower.end?.state, lower.end?.why], ['blocked', 'merge-defect'], 'a default ceiling of 2 stops at 2 reds');

  const spent = { evidence: { state: 'failed', reasonCode: 'header-failed', params: { attempt: 3, ceiling: 3 } } };
  const read = run({ rep: buildRep({ stages: spent }), facts: { row: rowOf('verify'), ...pmvFacts(pmvRec({ reds: 1 })) } });
  assert.equal(read.agent, PLANNER, 'the stage attempts of the evidence do not count the reds');
  assert.equal(read.detail.ceiling, 3);
});

test('post-merge-validate 2: a check that could not run ends blocked after its step, and is offered again on a fresh call', () => {
  const cannot = pmvRec({ result: 'cannot-run', reds: 0, errors: null, error: 'openspec validate timed out' });
  const stopped = build(rowOf('verify'), { ...pmvFacts(cannot), after: 'evidence/merge-check@abc123' });
  assert.deepEqual([stopped.end.state, stopped.end.why, stopped.stage, exitCodeOf(stopped)], ['blocked', 'merge-check-failed', 'evidence', 2]);
  assert.ok(stopped.reply.includes('openspec validate timed out'), stopped.reply);
  assert.equal(stopped.reply, says('blocked', { why: 'merge-check-failed', error: 'openspec validate timed out' }));
  const fresh = build(rowOf('verify'), pmvFacts(cannot));
  assert.deepEqual([fresh.kind, fresh.step], ['session', 'merge-check']);
});

// A `devkit-lite` change with one merge of the base that adds a scenario to the requirement the delta modifies: T-4's repository,
// built on `deliveredChange` so that the delivery checker, the fake gh and the pull request are real.
function pmvDelivered(extra = {}) {
  const proposal = `${PMV_PROPOSAL}\n## Acceptance criteria\n\n- AC-1: a thing\n`;
  const d = deliveredChange({ files: { 'openspec/specs/s/spec.md': pmvSpec('First') }, delta: { spec: pmvDelta('First'), proposal }, ...extra });
  return { ...d, proposal };
}
// The merge itself; the fake gh reads the new head, as GitHub would after a push.
// The commit on origin holds the spec alone: `commitOrigin` stages everything, the worktree's own folder included, and a merge that
// brings a path outside openspec/ makes the evidence stale, which is not what this test is about.
function pmvMergeDelivered(d, spec = pmvSpec('First', 'Second added on main')) {
  const file = 'openspec/specs/s/spec.md';
  put(d.t.main, { [file]: spec });
  git(d.t.main, 'add', '--', file);
  git(d.t.main, 'commit', '-q', '-m', 'main adds a scenario', '--', file);
  git(d.t.main, 'push', '-q', 'origin', 'main');
  git(d.wt, 'merge', '-q', '--no-ff', '--no-edit', 'origin/main');
  return pmvHead(d);
}
function pmvHead(d) {
  const sha = git(d.wt, 'rev-parse', 'HEAD');
  d.gh.set('pr-view', { stdout: prJson('feat', { headRefOid: sha }) });
  return sha;
}
const pmvStageLines = (wt) => pmvHeaderLines(wt).map(([f, lines]) => [f.slice(wt.length), lines]);

test('post-merge-validate 2: next end to end offers the check, hands the red to the planner, spends no header, and goes on once the delta is fixed', () => {
  const baseline = deliveredChange();
  const wanted = parsed(next(baseline.t.main, [], baseline.env)).action;
  assert.equal(wanted.end.why, 'waiting-github', 'the change without a merge waits on the checks');

  const d = pmvDelivered();
  const merge = pmvMergeDelivered(d);
  const headers = pmvStageLines(d.wt);
  const first = next(d.t.main, [], d.env);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  const offered = parsed(first).action;
  assert.deepEqual([offered.kind, offered.step, offered.stage, offered.detail.merge], ['session', 'merge-check', 'evidence', merge]);
  assert.deepEqual(offered.detail.command.slice(2, 4), ['merge-check', 'feat']);

  const red = main(['merge-check', 'feat', '--lang', 'en'], { cwd: d.wt, env: d.env });
  assert.equal(JSON.parse(red.stdout).result, 'red', red.stdout + red.stderr);
  const second = next(d.t.main, ['--after', offered.progressKey], d.env);
  assert.equal(second.code, 0, second.stdout + second.stderr);
  const handed = parsed(second).action;
  assert.deepEqual([handed.kind, handed.agent, handed.step, handed.stage], ['agent', PLANNER, 'merge-defect', 'specs']);
  assert.ok(handed.brief.includes('merge defect') && handed.brief.includes('Second added on main'), handed.brief);
  assert.equal(handed.brief.split('openspec validate feat --type change --strict').length - 1, 2, `the brief names the check with --type change both times: ${handed.brief}`);

  // The planner's fix: the delta carries both scenarios, committed on the branch.
  const header = readFileSync(join(d.wt, 'openspec/changes/feat/specs/s/spec.md'), 'utf8').split('\n')[0];
  put(d.wt, { 'openspec/changes/feat/specs/s/spec.md': `${header}\n${pmvDelta('First', 'Second added on main')}` });
  commitAll(d.wt, 'the planner copies the scenario');
  pmvHead(d);
  assert.deepEqual(pmvStageLines(d.wt).map(([f, l]) => [f, l]), headers, 'every devkit-stage line of the change folder is as it was');
  const third = parsed(next(d.t.main, ['--after', handed.progressKey], d.env)).action;
  assert.deepEqual([third.kind, third.step], ['session', 'merge-check'], 'the files changed: the check runs again');
  const green = main(['merge-check', 'feat', '--lang', 'en'], { cwd: d.wt, env: d.env });
  assert.equal(JSON.parse(green.stdout).result, 'green', green.stdout + green.stderr);
  const done = parsed(next(d.t.main, ['--after', third.progressKey], d.env)).action;
  assert.deepEqual([done.kind, done.end?.why], [wanted.kind, wanted.end.why], 'the action the change gives with no merge in its history');
  assert.deepEqual(pmvStageLines(d.wt), headers);
});

test('post-merge-validate 2: next end to end, a check that cannot run ends blocked naming the CLI; with no CLI at all next exits 3', () => {
  const d = pmvDelivered();
  pmvMergeDelivered(d);
  const offered = parsed(next(d.t.main, [], d.env)).action;
  assert.equal(offered.step, 'merge-check');
  // An empty PATH for the command: the folder of the fake gh is kept only to read the pull request with it later.
  const none = tmpFolder('devkit-pmv-nocli-');
  const ran = main(['merge-check', 'feat', '--lang', 'en'], { cwd: d.wt, env: { ...d.env, PATH: none } });
  const body = JSON.parse(ran.stdout);
  assert.deepEqual([body.result, ran.code], ['cannot-run', 0]);
  assert.match(body.error, /openspec CLI/);
  const stopped = next(d.t.main, ['--after', offered.progressKey], d.env);
  assert.equal(stopped.code, 2, stopped.stdout + stopped.stderr);
  const end = parsed(stopped).action;
  assert.deepEqual([end.end.state, end.end.why], ['blocked', 'merge-check-failed']);
  assert.match(end.reply, /openspec CLI/);
  assert.notEqual(end.kind, 'session');

  const noCli = next(d.t.main, [], { ...d.env, PATH: none });
  assert.equal(noCli.code, 3, noCli.stdout + noCli.stderr);
  assert.match(JSON.parse(noCli.stdout).error, /openspec/i);
});

// A `devkit` change with a ticked task, an APPROVED readiness and a current approval, then `edit` (a plan file) rewritten 10 s after readiness.md.
function pmvApprovedChange(edit) {
  const root = planChange({ have: ['requirements', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness'] });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const dir = join(root, 'openspec', 'changes', 'feat');
  const hash = approvalState(dir).readiness;
  put(root, {
    'openspec/changes/feat/tasks.md': `${head('tasks', c0)}# Tasks\n\n- [x] 1.1 a\n`,
    'openspec/changes/feat/approval.md': `${head('approval', c0)}# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${hash}\n- Date: 2026-11-09\n`,
  });
  const at = (file, seconds) => { const d = new Date(seconds * 1000); utimesSync(file, d, d); };
  const t0 = Math.floor(Date.now() / 1000) - 600;
  for (const f of readdirSync(dir, { recursive: true })) if (/\.md$/.test(f)) at(join(dir, f), t0);
  at(join(dir, 'approval.md'), t0 + 1);
  put(root, { [`openspec/changes/feat/${edit}`]: `${head(edit === 'design.md' ? 'design' : 'specs', c0)}# edited after the readiness\n` });
  at(join(dir, edit), t0 + 10);
  return { root, dir };
}

test('post-merge-validate 2: a plan edit made as a merge-defect fix leaves the plan gate where an ordinary design edit does', () => {
  const entries = (c) => {
    const { facts, flow } = collectFlow(c.root, 'feat', { env: cleanEnv });
    const report = computeFlow(facts, flow, {});
    return ['readiness', 'approval'].map((id) => { const e = report.stages.find((s) => s.id === id); return [id, e.state, e.reasonCode]; });
  };
  const fix = pmvApprovedChange('specs/s/spec.md');
  const ordinary = pmvApprovedChange('design.md');
  assert.deepEqual(entries(fix), entries(ordinary));
  assert.deepEqual(entries(fix), [['readiness', 'passed', 'passed'], ['approval', 'passed', 'passed']]);
  assert.equal(approvalState(fix.dir).ok, true);
  assert.equal(approvalState(ordinary.dir).ok, true);
});

// ---------------------------------------------------------------- post-merge-validate, phase 3: skill, documents, roadmap (AC-10)

test('post-merge-validate 3: the devkit skill names the merge-check step among the session steps, run whatever its exit code', () => {
  const md = readRepo('plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
  const loop = md.slice(md.indexOf('## Loop'), md.indexOf('## Owner gates'));
  const session = loop.split('\n').find((l) => l.startsWith('- `session`')) ?? '';
  assert.match(session, /A `merge-check` step runs `detail\.command` the same way, then `next`, whatever its exit code/);
  assert.match(session, /a failed check goes to the planner as a merge defect/);
});

test('post-merge-validate 3: the flow document names the merge-check step, its two Troubleshooting rows and no longer asks the session to run the check by hand', () => {
  const flow = readRepo('docs', 'openspec-flow.md');
  assert.ok(flow.includes('the loop has the session run `merge-check`'), 'the loop paragraph');
  assert.ok(flow.includes('<git common dir>/devkit/merge-check/<id>.json'), 'the record is named');
  assert.ok(flow.includes('`/devkit change` ends blocked: the plan fails its check after the merge of the base N times in a row'), 'the merge-defect row');
  assert.ok(flow.includes('`/devkit change` ends blocked: the check of the plan after the merge of the base could not run'), 'the cannot-run row');
  assert.ok(!flow.includes('before the evidence, run `openspec validate <id> --strict`;'), 'the by-hand sentence is gone');
  assert.ok(flow.includes('the loop runs `openspec validate <id> --type change --strict` before the evidence'), 'the rewritten sentence');
  const readme = readRepo('plugins', 'openspec', 'README.md').split('\n').find((l) => l.startsWith('| [`hooks/change-loop.mjs`]')) ?? '';
  assert.match(readme, /`merge-check`/);
  assert.match(readme, /with `merge-check`, its record in the git common directory/);
});

test('post-merge-validate 3: the roadmap line names the merge check and the sibling that counts evidence attempts', () => {
  const line = readRepo('openspec', 'roadmap.md').split('\n').find((l) => /^- \[[ x]\] post-merge-validate/.test(l)) ?? '';
  assert.match(line, /^- \[[ x]\] post-merge-validate/);
  assert.match(line, /runs `openspec validate <id> --type change --strict` before the evidence/);
  assert.match(line, /sends a failure to the planner as a merge defect/);
  assert.match(line, /evidence-attempts-by-failure/);
});

