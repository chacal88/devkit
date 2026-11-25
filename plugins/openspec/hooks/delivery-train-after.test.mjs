// delivery-train: reviewed changes leave together on a delivery train (ADR 0022), part 2 of 2 (suite-speed D-11; the other part is delivery-train.test.mjs).
// Tests of `depart --update`, the command line, the lock record and the verb, the documents, devkit-reviews on a train, what follows the train's merge and the real run. Run by
// `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/delivery-train-after.test.mjs`.
// Every scenario runs on real Git in a temporary folder; the env blanks every variable a pull-request run on CI sets. Every test name starts `delivery-train `. What the two parts share is in delivery-train-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import { put, commitAll } from './test-fixtures.mjs';
import * as guard from './guard.mjs';
import * as deliver from './deliver-check.mjs';
import * as release from './release-merge.mjs';
import { MESSAGES, render } from './change-loop.mjs';
import {
  GIT_ENV, git, SUITE, block, trunkAuto, configRepo, startRun, optedIn, GREEN, PENDING, PARTS, recordText, prove, project, addChange, headOf,
  launchTrain, boardedOf, SPEC, train, perform, depEnv, departIn, nextIn, roadmapOfIds, RELEASE_BASE, bumpFiles, gitOf, showOn, addArchive,
  SUITE_COUNTER, countRuns, recordOn, noScratch, liveTrain, trainLoopFile, endOf, projectConfig,
} from './delivery-train-fixtures.mjs';

// ---------------------------------------------------------------- P9 depart --update

test('delivery-train P9 depart --update: the base merged into the train, the suite once more, the record rewritten, one commit; then the push', () => {
  const counter = SUITE_COUNTER();
  const p = project({ train: `echo run >> ${counter}`, files: RELEASE_BASE });
  addChange(p, 'alpha', { files: bumpFiles('0.7.0', 'alpha') });
  const out = departIn(p);
  assert.equal(out.code, 0, JSON.stringify(out.out));
  assert.equal(perform(p, nextIn(p).action).status, 0); // push
  assert.equal(perform(p, nextIn(p).action).status, 0); // open the pull request
  const number = p.sim.prs().find((pr) => pr.head === 'train/1').number;
  p.t.commitOrigin(bumpFiles('0.7.0', 'base moves'), 'an unboarded change merged');
  p.sim.setPr(number, { mergeStateStatus: 'BEHIND' });
  const behind = nextIn(p);
  assert.equal(behind.action.step, 'update-train');
  const before = gitOf(p, 'rev-parse', 'train/1');

  const r = departIn(p, { update: true });
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.equal(countRuns(counter), 2, 'the suite ran once more');
  const head = gitOf(p, 'rev-parse', 'train/1');
  assert.deepEqual(gitOf(p, 'rev-list', '--parents', '-n', '1', 'train/1~1').split(' ').slice(1), [before, gitOf(p, 'rev-parse', 'origin/main')], 'the base merged into the train');
  assert.equal(gitOf(p, 'rev-list', '--count', '--first-parent', `${before}..${head}`), '2', 'the merge and one commit for the record');
  assert.equal(gitOf(p, 'log', '-1', '--format=%s', 'train/1'), 'chore(train): record train 1 after merging main');
  const record = recordOn(p, 'train/1', 1);
  assert.deepEqual([record.result, record.ranAt, record.baseSha], ['passed', gitOf(p, 'rev-parse', 'train/1~1'), gitOf(p, 'rev-parse', 'origin/main')]);
  assert.equal(JSON.parse(showOn(p, 'train/1', 'plugins/a/.claude-plugin/plugin.json')).version, '0.8.0', 'the train\'s release renumbered above the base\'s');
  const runs = [...showOn(p, 'train/1', 'openspec/trains/1.md').matchAll(/^\| (\d) \|[^|]*\| `[0-9a-f]{40}` \| (\w+) \|$/gm)].map((m) => [m[1], m[2]]);
  assert.deepEqual(runs, [['1', 'passed'], ['2', 'passed']]);
  assert.equal(nextIn(p).action.step, 'push-train', 'what the update made is pushed by the session');
  noScratch(p);
});

test('delivery-train P9 depart --update: a suite that fails after the base merged is recorded as failed and ends blocked naming the base', () => {
  const p = project({ train: 'if test -e src/from-the-base.txt; then echo base-broke-it; exit 1; fi' });
  addChange(p, 'alpha');
  assert.equal(departIn(p).code, 0);
  assert.equal(perform(p, nextIn(p).action).status, 0);
  assert.equal(perform(p, nextIn(p).action).status, 0);
  p.t.commitOrigin({ 'src/from-the-base.txt': 'x\n' }, 'the base changes');
  const r = departIn(p, { update: true });
  assert.deepEqual([r.code, r.out.result], [2, 'blocked']);
  assert.equal(r.out.reply, render('en', 'train-blocked', { error: r.out.error }));
  assert.match(r.out.error, /after merging main/);
  assert.match(r.out.error, /base-broke-it/);
  const record = recordOn(p, 'train/1', 1);
  assert.equal(record.result, 'failed');
  assert.equal(showOn(p, 'train/1', 'openspec/trains/1.md').includes('## Runs'), true);
  noScratch(p);
});

test('delivery-train P9 depart --update: with no open train there is nothing to update', () => {
  const p = project();
  addChange(p, 'alpha');
  const r = departIn(p, { update: true });
  assert.deepEqual([r.code, r.out.result], [2, 'blocked']);
  assert.match(r.out.error, /no open train/);
});

// ---------------------------------------------------------------- P9 the command line: main and wait

test('delivery-train P9 main: next prints the action as JSON with its exit code, and an unknown subcommand is a usage error', () => {
  const p = project();
  addChange(p, 'alpha');
  const r = train.main(['next', '--lang', 'en'], { cwd: p.t.main, env: depEnv(p) });
  assert.equal(r.code, 0);
  const action = JSON.parse(r.stdout);
  assert.deepEqual([action.version, action.kind, action.step], [1, 'session', 'depart']);
  const idle = project();
  const waiting = train.main(['next', '--lang', 'en'], { cwd: idle.t.main, env: depEnv(idle) });
  assert.equal(waiting.code, 1);
  assert.equal(JSON.parse(waiting.stdout).end.why, 'train-nothing');
  const bad = train.main(['teleport', '--lang', 'en'], { cwd: p.t.main, env: depEnv(p) });
  assert.equal(bad.code, 3);
  assert.equal(JSON.parse(bad.stdout).version, 1);
  assert.equal(train.main(['next', '--lang', 'en', '--bogus'], { cwd: p.t.main, env: depEnv(p) }).code, 3);
});

test('delivery-train P9 main: depart prints its result and the exit code of the departure', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  const r = train.main(['depart', '--lang', 'en'], { cwd: p.t.main, env: depEnv(p), tmp: p.scratch });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual([JSON.parse(r.stdout).n, JSON.parse(r.stdout).result], [1, 'passed']);
  const again = train.main(['depart', '--lang', 'en'], { cwd: p.t.main, env: depEnv(p), tmp: p.scratch });
  assert.equal(again.code, 2, 'train 1 is not pushed yet, so it is under way: a second departure is refused');
  assert.equal(JSON.parse(again.stdout).result, 'blocked');
  assert.match(JSON.parse(again.stdout).error, /train 1/);
  assert.equal(gitOf(p, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/train'), 'train/1');
});

test('delivery-train P9 wait: polls next and prints the action once it differs from the first', async () => {
  const p = project({ model: 'trunk' });
  addChange(p, 'alpha');
  const { number } = liveTrain(p);
  p.sim.setChecks(number, PENDING);
  const sleeps = [];
  const sleep = async (seconds) => { sleeps.push(seconds); if (sleeps.length === 2) p.sim.setChecks(number, GREEN); };
  const r = await train.runCommand(['wait', '--lang', 'en'], { cwd: p.t.main, env: { ...depEnv(p), DEVKIT_POLL_SECONDS: '7' }, sleep });
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).end.why, 'train-ready');
  assert.deepEqual(sleeps, [7, 7]);
  const idle = project();
  const now = await train.runCommand(['wait', '--lang', 'en'], { cwd: idle.t.main, env: depEnv(idle), sleep: () => assert.fail('an end that is not a wait on GitHub returns at once') });
  assert.equal(JSON.parse(now.stdout).end.why, 'train-nothing');
});

// ---------------------------------------------------------------- P12 the lock record, P13 the verb

const tLine = (extra) => JSON.stringify({ parentUuid: null, isSidechain: false, userType: 'external', cwd: '/scratch', sessionId: 's-1', version: '2.1.326', uuid: 'u-1', timestamp: '2026-11-21T10:00:00.000Z', ...extra });
const typedLine = (args) => tLine({ type: 'user', message: { role: 'user', content: `<command-message>devkit</command-message>\n<command-name>/devkit</command-name>\n<command-args>${args}</command-args>` } });
const printedLine = (text) => tLine({ type: 'user', message: { role: 'user', content: [{ tool_use_id: 't-1', type: 'tool_result', content: text, is_error: false }] }, toolUseResult: { stdout: text, stderr: '', interrupted: false, isImage: false, noOutputExpected: false } });
function transcriptOf(...lines) {
  const file = join(tmpFolder('devkit-train-transcript-'), 's-1.jsonl');
  writeFileSync(file, `${lines.join('\n')}\n`);
  return { transcript_path: file };
}

test('delivery-train P12: a typed /devkit train keeps a roadmap run and a typed /devkit change after it still ends it', () => {
  const run = (...lines) => guard.roadmapRunOf(transcriptOf(...lines));
  assert.equal(run(typedLine('roadmap 2'), printedLine('devkit-roadmap: 2\n{}'), typedLine('train'))?.command, 'roadmap 2');
  assert.equal(run(typedLine('roadmap 2'), typedLine('train'), printedLine('devkit-roadmap: 2\n{}'))?.command, 'roadmap 2', 'train between the command and its line');
  assert.equal(run(typedLine('train'), printedLine('devkit-roadmap: 2\n{}')), null, 'it starts no run');
  assert.equal(run(typedLine('roadmap 2'), printedLine('devkit-roadmap: 2\n{}'), typedLine('train'), typedLine('change x')), null, 'change after it ends the run (neg)');
  assert.equal(run(typedLine('roadmap 2'), printedLine('devkit-roadmap: 2\n{}'), typedLine('trains')), null, 'another word starting with train ends it (neg)');
  assert.equal(guard.runOf(transcriptOf(typedLine('change x'), printedLine('devkit-run: feat\n{}'), typedLine('train'))), null, 'a change run is ended by it');
});

test('delivery-train P13: /devkit train starts the verb, with text after it is refused, and a refused train setting stops it', () => {
  const root = configRepo(optedIn(trunkAuto(`"${SUITE}"`)));
  for (const lang of ['en', 'pt-BR']) {
    const ok = startRun(root, 'train', lang);
    assert.deepEqual([ok.code, ok.body.mode, ok.body.verb, ok.body.reply], [0, 'train', 'train', undefined], lang);
    const args = startRun(root, 'train now', lang);
    assert.deepEqual([args.body.mode, args.body.reply], ['train-args', render(lang, 'train-args')], lang);
    const off = startRun(configRepo(optedIn('devkit:\n  language: en\n')), 'train', lang);
    assert.equal(off.body.mode, 'train', 'with no train key the verb still starts: the departure script answers train-off');
  }
  const two = configRepo(optedIn(block('    model: two-prs\n    base: main\n    test_branch: develop\n', `    train: "${SUITE}"\n`)));
  assert.equal(startRun(two, 'train').body.mode, 'setting-unknown');
  assert.equal(startRun(two, 'train').body.reply, render('en', 'train-model'));
  assert.equal(startRun(configRepo(null), 'train').body.mode, 'not-set-up');
  assert.match(render('en', 'train-args'), /\/devkit train/);
});

test('delivery-train P13: the reply to an unknown verb names /devkit train, in order, in both languages', () => {
  assert.match(render('en', 'verb-unknown'), /So far \/devkit change, \/devkit roadmap, \/devkit status, \/devkit project and \/devkit train exist/);
  assert.match(render('en', 'verb-unknown'), /or \/devkit train to send the boarded changes on one train\.$/);
  assert.match(render('pt-BR', 'verb-unknown'), /^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit project e \/devkit train/);
  assert.match(render('pt-BR', 'verb-unknown'), /\/devkit train para mandar as changes embarcadas em um trem só\.$/);
  const unknown = startRun(configRepo(optedIn(trunkAuto(`"${SUITE}"`))), 'teleport');
  assert.equal(unknown.body.mode, 'unknown-verb');
});

test('delivery-train loop: the new train replies exist in both languages, each with its own text', () => {
  for (const key of ['train-off', 'train-running', 'train-nothing', 'train-blocked', 'train-base-red', 'train-checks', 'train-auto-merge-on', 'train-ready', 'train-delivered', 'train-args']) {
    assert.ok(MESSAGES.en[key] && MESSAGES['pt-BR'][key], key);
    assert.notEqual(MESSAGES.en[key], MESSAGES['pt-BR'][key], key);
  }
});

// ---------------------------------------------------------------- P10 the documents follow

const here = dirname(fileURLToPath(import.meta.url));
const repoFile = (...parts) => readFileSync(join(here, '..', '..', '..', ...parts), 'utf8');
const sliceOf = (text, from, to) => text.slice(text.indexOf(from), to ? text.indexOf(to, text.indexOf(from) + from.length) : undefined);

test('delivery-train docs: the documents follow', () => {
  const flow = repoFile('docs', 'openspec-flow.md');
  assert.match(flow, /devkit\.delivery\.train/);
  assert.match(flow, /\/devkit train/);
  assert.match(flow, /openspec\/trains\//);
  const ci = sliceOf(flow, '## CI', '## Customizing');
  assert.match(ci, /reads `devkit\.delivery` from the default branch, and applies rules only in `two-prs`/, 'the sentence of delivery-models stays as it is');
  for (const [what, re] of [['the train mode', /a pull request from `train\/<n>` is judged by its record/], ['the record it reads', /`openspec\/trains\/<n>\.md`/], ['containment', /ancestor of the train/], ['the train\'s own commits', /release files, the CI pin, `openspec\/roadmap\.md` and the record/], ['the boarded entries', /scratch worktree at its own head/], ['the train parts', /skips the gate parts the train proves/]]) assert.match(ci, re, `the CI section names ${what}`);
  const section = sliceOf(flow, '### The delivery train', '\n## CI');
  for (const [what, re] of [
    ['the verb', /`\/devkit train`/], ['the script', /`train-loop\.mjs`/], ['the departure', /`train\/<n>`/], ['the record', /`openspec\/trains\/<n>\.md`/],
    ['the red train', /bisect/i], ['the join rules', /`release-merge\.mjs --merge <rev>`/], ['the train\'s pull request', /merge commit/], ['the leavers', /left/],
  ]) assert.match(section, re, `the subsection names ${what}`);

  const skill = repoFile('plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
  const heads = skill.split('\n').filter((l) => l.startsWith('## '));
  assert.ok(heads.includes('## Train'), 'the devkit skill has a Train section');
  assert.equal(heads.indexOf('## Train'), heads.indexOf('## Waiting on GitHub') + 1, 'it sits right after Waiting on GitHub');
  const train = sliceOf(skill, '## Train', '## Roadmap');
  for (const re of [/train-loop\.mjs next/, /depart/, /update-train/, /background/, /`end`/, /wait/]) assert.match(train, re, String(re));
  assert.match(skill, /argument-hint: "change \[<request> \| <change-id> \| <Jira key or link>\] \| roadmap \[<n> \| stop\] \| status \| train \| project \[<name>\]"/);
  assert.match(skill, /\/devkit train departs the boarded changes of a project with a delivery train, together on one train\./);
  for (const mode of ['train', 'train-args']) assert.ok(sliceOf(skill, '## Start', '## A new change').includes(`\`${mode}\``), `the start mode ${mode}`);

  const ship = repoFile('plugins', 'openspec', 'skills', 'ship-change', 'SKILL.md');
  for (const step of ['boarded', 'on-train', 'wait-train', 'rejoin-train', 'close-boarded-pr', 'rejoin-archive']) {
    assert.equal(ship.split('\n').filter((l) => l.startsWith(`| \`${step}\` |`)).length, 1, `ship-change has one row for ${step}`);
  }
});

// ---------------------------------------------------------------- 4: devkit-reviews on a train (P11, AC-6, AC-9)

const reviewsCli = join(here, 'deliver-check.mjs');
// `deliver-check.mjs --ci` as a pull-request run on CI starts it, in `cwd`, with a TMPDIR of the test's own: a scratch
// worktree the check makes must be gone when it returns, in the folder and in the repository's list.
function ciIn(cwd, { head, base = 'main', json = false, cli = reviewsCli, env = {} } = {}) {
  const tmp = tmpFolder('devkit-train-ci-tmp-');
  const r = spawnSync(process.execPath, [cli, '--ci', ...(json ? ['--json'] : [])], { cwd, encoding: 'utf8', env: { ...GIT_ENV, TMPDIR: tmp, GITHUB_HEAD_REF: head, GITHUB_BASE_REF: base, ...env } });
  assert.deepEqual(readdirSync(tmp), [], 'the check removes every scratch worktree it makes');
  assert.deepEqual(git(cwd, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ') && l.includes(tmp)), [], 'no scratch worktree stays registered');
  return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}

const entryOf = (p, e) => {
  const x = typeof e === 'string' ? { id: e } : e;
  const kind = x.kind ?? 'change';
  const own = kind === 'archive' ? p.archives[x.id] : p.changes[x.id];
  return { kind, id: x.id, number: own.number, head: x.head ?? git(own.wt, 'rev-parse', 'HEAD') };
};

// A train built by hand, the way the departure builds one: cut from origin/main, one merge commit per entry, then the record
// (committed, so the head the suite "ran at" is the last join). `record` overrides what the record says; `branch` names the
// branch (a train's by default).
function handTrain(p, n, ids, { branch = `train/${n}`, record = {}, writeRecord = true } = {}) {
  const wt = join(tmpFolder('devkit-train-hand-'), 'w');
  git(p.t.main, 'worktree', 'add', '-q', '-b', branch, wt, 'origin/main');
  const boarded = ids.map((e) => entryOf(p, e));
  for (const b of boarded) git(wt, 'merge', '--no-ff', '-q', '-m', `chore(train): join ${b.id}`, b.head);
  const ranAt = git(wt, 'rev-parse', 'HEAD');
  if (writeRecord) {
    put(wt, { [`openspec/trains/${n}.md`]: recordText({ n, baseSha: git(wt, 'rev-parse', 'origin/main'), ranAt, boarded, ...record }) });
    commitAll(wt, `chore(train): record train ${n}`);
  }
  return { wt, boarded, ranAt, branch };
}
const ciOf = (t, opts = {}) => ciIn(t.wt, { head: t.branch, ...opts });
const trainLines = (r) => r.out.split('\n');

const GAMMA_DELTA_ROADMAP = '# Roadmap\n\n## Round 1\n- [ ] gamma\n- [ ] keep\n- [ ] delta\n';
const RETRO_OPEN = '# Retro: x\n\n## Proposed updates\n\n### Tighten `docs/x.md` (docs)\n\n- Why: because\n';

test('delivery-train P11: a whole train passes with one result line per boarded entry, and the check makes no GitHub call', () => {
  const p = project({ train: 'true', roadmap: GAMMA_DELTA_ROADMAP });
  addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
  addChange(p, 'beta', { at: '2026-11-23T10:10:00Z' });
  addArchive(p, 'gamma', { at: '2026-11-23T10:05:00Z' });
  const out = departIn(p);
  assert.equal(out.code, 0, JSON.stringify(out.out));
  const r = ciIn(out.out.worktree, { head: 'train/1' });
  assert.equal(r.code, 0, r.out + r.err);
  const lines = trainLines(r);
  assert.match(lines[0], /^devkit-reviews: train 1 /);
  for (const [kind, id] of [['change', 'alpha'], ['archive', 'gamma'], ['change', 'beta']]) {
    assert.equal(lines.filter((l) => l.includes(` ${kind} ${id} `) && /pass$/.test(l)).length, 1, `one pass line for ${id}: ${r.out}`);
  }
  assert.equal(lines.at(-2), 'pass');
  const j = ciIn(out.out.worktree, { head: 'train/1', json: true }).json();
  assert.deepEqual([j.version, j.mode, j.pass, j.train.n], [1, 'ci', true, 1]);
  assert.deepEqual(j.train.boarded.map((b) => [b.kind, b.id, b.pass]), [['change', 'alpha', true], ['archive', 'gamma', true], ['change', 'beta', true]]);
});

test('delivery-train AC-6: devkit-reviews judges each boarded change at its own head, its containment, the train\'s own commits and the record', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  addChange(p, 'beta');
  const clean = handTrain(p, 1, ['alpha', 'beta']);
  const ok = ciOf(clean);
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.equal(trainLines(ok).filter((l) => /^ {2}change (alpha|beta) /.test(l) && /pass$/.test(l)).length, 2);

  // a stale review at a boarded head: a product commit after the reviews, listed as beta's head
  const wt = p.changes.beta.wt;
  put(wt, { 'src/beta.txt': 'changed after the reviews\n' });
  commitAll(wt, 'product commit after the reviews');
  git(wt, 'push', '-q', 'origin', 'beta');
  const stale = ciOf(handTrain(p, 2, ['alpha', 'beta']));
  assert.equal(stale.code, 1, stale.out);
  assert.match(stale.out, /beta[^\n]*stale code-quality-reviewer/);
  assert.doesNotMatch(trainLines(stale).filter((l) => /alpha/.test(l)).join('\n'), /fail/, 'alpha still passes');
  assert.match(stale.out.trim().split('\n').at(-1), /^fail: .*beta/);

  // a head the train does not hold: the record lists alpha at a head pushed after the departure
  const loose = handTrain(p, 3, ['alpha']);
  const fresh = p.changes.alpha.wt;
  put(fresh, { 'openspec/changes/alpha/notes.md': 'a note\n' });
  const later = commitAll(fresh, 'a note after the departure');
  git(fresh, 'push', '-q', 'origin', 'alpha');
  put(loose.wt, { 'openspec/trains/3.md': recordText({ n: 3, baseSha: git(loose.wt, 'rev-parse', 'origin/main'), ranAt: loose.ranAt, boarded: [{ kind: 'change', id: 'alpha', number: p.changes.alpha.number, head: later }] }) });
  commitAll(loose.wt, 'chore(train): record train 3 at the later head');
  const missing = ciOf(loose);
  assert.equal(missing.code, 1, missing.out);
  assert.match(missing.out, new RegExp(`alpha[^\\n]*${later.slice(0, 7)}[^\\n]*not in the train`));
  assert.doesNotMatch(missing.out, /stale/, 'the later head is judged as it stands, and its evidence is current');

  // a commit of the train's own that no boarded head holds and that edits a product path
  const own = handTrain(p, 4, ['alpha']);
  put(own.wt, { 'plugins/x/hooks/a.mjs': 'export {};\n' });
  const sha = commitAll(own.wt, 'a product fix pushed onto the train');
  const product = ciOf(own);
  assert.equal(product.code, 1, product.out);
  assert.match(product.out, new RegExp(`${sha.slice(0, 7)}[^\\n]*plugins/x/hooks/a\\.mjs`));

  // no record at all
  const bare = ciOf(handTrain(p, 5, ['alpha'], { writeRecord: false }));
  assert.equal(bare.code, 1, bare.out);
  assert.match(bare.out, /openspec\/trains\/5\.md is missing[^\n]*the departure writes it: \/devkit train/);
});

// Twelve lines whose first and last differ, so a branch and the base edit one file without a conflict.
const sharedLines = (first = 'line 1', last = 'line 12') => `${Array.from({ length: 12 }, (_, i) => (i === 0 ? first : i === 11 ? last : `line ${i + 1}`)).join('\n')}\n`;

test('delivery-train own-files AC-8: a boarded change is judged by the own-files rule of its own pull request, so its head that merged only unrelated base files stays current', () => {
  const p = project({ train: 'true', files: { 'src/shared.txt': sharedLines() } });
  addChange(p, 'alpha');
  addChange(p, 'beta', { files: { 'src/shared.txt': sharedLines('beta 1') } });
  const mergeBase = (id) => {
    const wt = p.changes[id].wt;
    git(wt, 'merge', '--no-ff', '-q', '-m', `merge main into ${id}`, 'origin/main');
    git(wt, 'push', '-q', 'origin', id);
    return git(wt, 'rev-parse', 'HEAD');
  };
  // main moves from a scratch worktree: the main checkout holds the change worktrees, which `git add -A` would commit
  const onMain = (files, message) => {
    const wt = join(tmpFolder('devkit-train-main-'), 'w');
    git(p.t.main, 'worktree', 'add', '-q', '--detach', wt, 'origin/main');
    put(wt, files);
    commitAll(wt, message);
    git(wt, 'push', '-q', 'origin', 'HEAD:main');
    git(p.t.main, 'worktree', 'remove', '--force', wt);
  };
  onMain({ 'src/unrelated.txt': 'brought by the base\n' }, 'an unrelated file on main');
  mergeBase('alpha');
  onMain({ 'src/shared.txt': sharedLines('line 1', 'main 12') }, 'a file beta changed, on main');
  const betaMerge = mergeBase('beta');

  const r = ciOf(handTrain(p, 1, ['alpha', 'beta']));
  assert.equal(r.code, 1, r.out + r.err);
  const alpha = trainLines(r).filter((l) => /^ {2}change alpha /.test(l));
  assert.equal(alpha.length, 1, r.out);
  assert.match(alpha[0], /pass$/, 'alpha merged only an unrelated base file and stays current');
  assert.doesNotMatch(r.out, /alpha[^\n]*stale/);
  const beta = trainLines(r).filter((l) => /^ {2}change beta /.test(l));
  assert.equal(beta.length, 1, r.out);
  assert.match(beta[0], new RegExp(`stale code-quality-reviewer \\([0-9a-f]{7} is behind ${betaMerge.slice(0, 7)}, which touches src/shared\\.txt\\)`), 'beta merged a base commit that touches its own file');
});

test('delivery-train P11: a record that is unreadable, red or older than the head fails, and a release file after it does not hide behind failure 4', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  const unclosed = handTrain(p, 1, ['alpha']);
  put(unclosed.wt, { 'openspec/trains/1.md': `${recordText({ n: 1, boarded: [entryOf(p, 'alpha')] })}\n\`\`\`text\nnever closed\n` });
  commitAll(unclosed.wt, 'a record with an unclosed fence');
  const a = ciOf(unclosed);
  assert.equal(a.code, 1, a.out);
  assert.match(a.out, /cannot be read[^\n]*fenced block/);

  const red = handTrain(p, 2, ['alpha'], { record: { result: 'failed' } });
  const b = ciOf(red);
  assert.equal(b.code, 1, b.out);
  assert.match(b.out, /train record did not pass \(result failed\)/);

  const old = handTrain(p, 3, ['alpha']);
  put(old.wt, { 'CHANGELOG.md': '# Changelog\n' });
  const release = commitAll(old.wt, 'a release file after the run');
  const c = ciOf(old);
  assert.equal(c.code, 1, c.out);
  assert.match(c.out, /train record is not current at the pull request's head/);
  assert.doesNotMatch(c.out, new RegExp(`${release.slice(0, 7)} \\(a release file after the run\\) changes`), 'a release file is a path the train may change');

  const later = handTrain(p, 4, ['alpha']);
  put(later.wt, { 'src/after.txt': 'after the run\n' });
  commitAll(later.wt, 'a product commit after the run');
  const d = ciOf(later);
  assert.equal(d.code, 1, d.out);
  assert.match(d.out, /train record is not current at the pull request's head/);
});

test('delivery-train P11: the renumbering of the joins is the train\'s own work and passes failure 4', () => {
  const p = project({ train: 'true', files: RELEASE_BASE });
  addChange(p, 'alpha', { files: bumpFiles('0.7.0', 'alpha') });
  addChange(p, 'beta', { files: bumpFiles('0.7.0', 'beta') });
  const out = departIn(p);
  assert.equal(out.code, 0, JSON.stringify(out.out));
  const r = ciIn(out.out.worktree, { head: 'train/1' });
  assert.equal(r.code, 0, `the renumbering of the joins is the train's own work: ${r.out}${r.err}`);
});

test('delivery-train P11: a boarded archive is judged as an archive pull request, and an unanswered proposal fails naming its folder', () => {
  const p = project({ train: 'true', roadmap: GAMMA_DELTA_ROADMAP });
  addArchive(p, 'gamma', { retro: RETRO_OPEN });
  addArchive(p, 'delta');
  const r = ciOf(handTrain(p, 1, [{ kind: 'archive', id: 'gamma' }, { kind: 'archive', id: 'delta' }]));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-gamma[^\n]*unanswered proposals: 1/);
  assert.doesNotMatch(trainLines(r).filter((l) => /delta/.test(l)).join('\n'), /fail/, 'the other archive passes');
});

test('delivery-train AC-9: two archives board together, no archive branch is updated, each folder is judged in the train\'s check', () => {
  const p = project({ train: 'true', roadmap: GAMMA_DELTA_ROADMAP });
  addArchive(p, 'gamma');
  addArchive(p, 'delta');
  const before = ['gamma', 'delta'].map((id) => git(p.archives[id].wt, 'rev-parse', 'HEAD'));
  const out = departIn(p);
  assert.equal(out.code, 0, JSON.stringify(out.out));
  assert.deepEqual(out.out.boarded.map((b) => [b.kind, b.id]), [['archive', 'gamma'], ['archive', 'delta']]);
  assert.deepEqual(['gamma', 'delta'].map((id) => git(p.archives[id].wt, 'rev-parse', 'HEAD')), before, 'no archive branch moved');
  const r = ciIn(out.out.worktree, { head: 'train/1' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(trainLines(r).filter((l) => /^ {2}archive (gamma|delta) /.test(l) && /pass$/.test(l)).length, 2, r.out);
  // a boarded archive whose file check fails (a file no approved proposal names) fails the train
  const wt = p.archives.gamma.wt;
  put(wt, { 'docs/unnamed.md': 'a file no proposal names\n' });
  commitAll(wt, 'an unnamed file in the archive');
  const bad = ciOf(handTrain(p, 2, [{ kind: 'archive', id: 'gamma' }]));
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /files no approved proposal names: docs\/unnamed\.md/);
});

// ---- release-at-merge: the numbering of a noted change's ADR is the train's own work (D-5, D-7)

const NOTED_TRAIN = `${projectConfig('trunk-auto', 'true')}  release_tag: plugins/a/.claude-plugin/plugin.json\n`;
const notedFiles = (id) => ({
  [`openspec/changes/${id}/release.md`]: `packs:\n- a: minor\n\n## ${id}\n\n- **a**: ${id}\n`,
  [`openspec/changes/${id}/decisions.md`]: `# Decisions\n\n- ADR: \`docs/adr/${id}.md\`\n`,
  [`docs/adr/${id}.md`]: `# ADR [${id}]: ${id}\n`,
  [`docs/${id}.md`]: `See ADR [${id}].\n`,
});
// A train cut from origin/main by hand whose one join numbers `id`'s ADR 0001 and rewrites its citation, as the join does; with
// `sentence` the join also rewords the cited sentence. Then the record, at the join.
function numberingTrain(p, n, id, { sentence = false } = {}) {
  const wt = join(tmpFolder('devkit-train-hand-'), 'w');
  const branch = `train/${n}`;
  git(p.t.main, 'worktree', 'add', '-q', '-b', branch, wt, 'origin/main');
  const boarded = [entryOf(p, id)];
  git(wt, 'merge', '--no-ff', '--no-commit', '-q', boarded[0].head);
  git(wt, 'mv', `docs/adr/${id}.md`, `docs/adr/0001-${id}.md`);
  put(wt, { [`docs/adr/0001-${id}.md`]: `# ADR 0001: ${id}\n`, [`docs/${id}.md`]: sentence ? 'See ADR 0001, reworded on the train.\n' : 'See ADR 0001.\n' });
  git(wt, 'add', '-A');
  git(wt, 'commit', '-q', '-m', `chore(train): join ${boarded[0].head.slice(0, 7)} and renumber its release above the train`);
  const ranAt = git(wt, 'rev-parse', 'HEAD');
  put(wt, { [`openspec/trains/${n}.md`]: recordText({ n, baseSha: git(wt, 'rev-parse', 'origin/main'), ranAt, boarded }) });
  commitAll(wt, `chore(train): record train ${n}`);
  return { wt, boarded, ranAt, branch };
}

test('release-note AC-3 trainCheck: a join that numbers an ADR passes the train\'s own-commit rule, and one that also edits a sentence fails naming the join and the file', () => {
  const p = project({ train: 'true', config: NOTED_TRAIN, files: RELEASE_BASE });
  addChange(p, 'alpha', { files: notedFiles('alpha') });
  const ok = ciOf(numberingTrain(p, 1, 'alpha'));
  assert.equal(ok.code, 0, ok.out + ok.err);
  const edited = numberingTrain(p, 2, 'alpha', { sentence: true });
  const bad = ciOf(edited);
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, new RegExp(`${edited.ranAt.slice(0, 7)} \\(chore\\(train\\): join [0-9a-f]{7} and renumber its release above the train\\) changes docs/alpha\\.md:`));
  assert.doesNotMatch(bad.out, /changes [^\n]*docs\/adr\/0001-alpha\.md/, 'the numbered record itself is the numbering');
});

// Review round 1 (test-coverage F3): in a consumer project the join writes the file devkit.release_tag names, which is no release file of
// the devkit packs; the train's own-commit rule must take it as the numbering.
const appPkg = (v) => `${JSON.stringify({ name: 'app', version: v }, null, 2)}\n`;
test('release-note AC-3 trainCheck: a consumer\'s join that writes the release file passes', () => {
  const config = `${projectConfig('trunk-auto', 'true')}  release_tag: package.json\n`;
  const p = project({ train: 'true', config, files: { 'package.json': appPkg('1.4.0'), 'CHANGELOG.md': '# Changelog\n\n## 1.4.0 — old\n\n- x\n' } });
  addChange(p, 'alpha', { files: { 'openspec/changes/alpha/release.md': 'packs: []\nrelease: minor\n\n## alpha\n\nalpha\n' } });
  const out = departIn(p);
  assert.equal(out.code, 0, JSON.stringify(out.out));
  assert.deepEqual(out.out.boarded.map((b) => b.id), ['alpha']);
  const wt = out.out.worktree;
  assert.equal(readFileSync(join(wt, 'package.json'), 'utf8'), appPkg('1.5.0'), 'the join wrote the release file');
  assert.equal(readFileSync(join(wt, 'CHANGELOG.md'), 'utf8'), '# Changelog\n\n## 1.5.0 — alpha\n\nalpha\n\n## 1.4.0 — old\n\n- x\n');
  const r = ciIn(wt, { head: 'train/1' });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(trainLines(r).filter((l) => l.startsWith('  change alpha ') && /pass$/.test(l)).length, 1, r.out);
});

test('release-note AC-5 departure: two noted changes depart on one train, numbered in boarding order, and both boarded heads stay current at their own heads', () => {
  const p = project({ train: 'true', config: NOTED_TRAIN, files: RELEASE_BASE });
  addChange(p, 'alpha', { files: notedFiles('alpha'), at: '2026-11-23T10:00:00Z' });
  addChange(p, 'beta', { files: notedFiles('beta'), at: '2026-11-23T10:10:00Z' });
  const heads = ['alpha', 'beta'].map((id) => headOf(p, id));
  const out = departIn(p);
  assert.equal(out.code, 0, JSON.stringify(out.out));
  assert.deepEqual(out.out.boarded.map((b) => b.id), ['alpha', 'beta']);
  assert.deepEqual(out.out.left, []);
  const wt = out.out.worktree;
  assert.equal(JSON.parse(readFileSync(join(wt, 'plugins/a/.claude-plugin/plugin.json'), 'utf8')).version, '0.8.0');
  assert.equal(readFileSync(join(wt, 'docs/adr/0001-alpha.md'), 'utf8'), '# ADR 0001: alpha\n');
  assert.equal(readFileSync(join(wt, 'docs/adr/0002-beta.md'), 'utf8'), '# ADR 0002: beta\n');
  assert.equal(readFileSync(join(wt, 'docs/beta.md'), 'utf8'), 'See ADR 0002.\n');
  const r = ciIn(wt, { head: 'train/1' });
  assert.equal(r.code, 0, r.out + r.err);
  for (const id of ['alpha', 'beta']) assert.equal(trainLines(r).filter((l) => l.startsWith(`  change ${id} `) && /pass$/.test(l)).length, 1, `${id} passes at its own head: ${r.out}`);
  assert.deepEqual(['alpha', 'beta'].map((id) => headOf(p, id)), heads, 'no boarded branch moved');
});

test('delivery-train P11: TRAIN_PIN_FILE is the pin file release-merge rewrites', () => {
  assert.equal(deliver.TRAIN_PIN_FILE, release.PIN_FILE);
  assert.equal(deliver.TRAIN_PIN_FILE, 'docs/openspec-flow.md');
});

test('delivery-train P11: --ci on a train pull request loads and judges from a folder holding only the three downloaded files', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  const t = handTrain(p, 1, ['alpha']);
  const dir = tmpFolder('devkit-train-three-');
  for (const f of ['guard.mjs', 'deliver-check.mjs', 'merge-setup.mjs']) writeFileSync(join(dir, f), readFileSync(join(here, f)));
  const r = ciOf(t, { cli: join(dir, 'deliver-check.mjs') });
  assert.equal(r.code, 0, r.out + r.err);
  assert.deepEqual(readdirSync(dir).sort(), ['deliver-check.mjs', 'guard.mjs', 'merge-setup.mjs']);
});

// The train parts on a change's own pull request: item 1 skips the gate parts the train proves, as the local reader does.
const GATE_SUITE_TASKS = `# Tasks\n\n## 1. Phase\n\n- [x] 1.1 code\n- [x] 1.2 Gate: \`${SUITE}\`\n`;

test('delivery-train P11: a change\'s own pull request in a train project passes item 1 with no row for a train part, and says so', () => {
  const p = project({ train: SUITE });
  const a = addChange(p, 'alpha', { tasks: GATE_SUITE_TASKS });
  const r = ciIn(a.wt, { head: 'alpha', json: true });
  assert.equal(r.code, 0, r.out + r.err);
  const j = r.json();
  assert.deepEqual(j.items[0].details.trainParts, PARTS);
  assert.match(j.items[0].reason, /2 proven by the train/);
});

test('delivery-train P11: without the key the same pull request fails on item 1 naming the part', () => {
  const p = project({ train: null });
  const a = addChange(p, 'alpha', { tasks: GATE_SUITE_TASKS });
  const r = ciIn(a.wt, { head: 'alpha' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no passing row in evidence\.md for `python3 scripts\/check\.py`/);
});

test('delivery-train P11: a gate part the key does not name still needs its row', () => {
  const p = project({ train: PARTS[0] });
  const a = addChange(p, 'alpha', { tasks: GATE_SUITE_TASKS });
  const r = ciIn(a.wt, { head: 'alpha' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no passing row in evidence\.md for `python3 scripts\/check\.py`/);
  assert.doesNotMatch(r.out, /no passing row in evidence\.md for `node --test/);
});

test('delivery-train P11: a pull request that touches several changes passes the train parts to each', () => {
  const p = project({ train: SUITE });
  addChange(p, 'alpha', { tasks: GATE_SUITE_TASKS });
  addChange(p, 'beta', { tasks: GATE_SUITE_TASKS });
  const both = handTrain(p, 1, ['alpha', 'beta'], { branch: 'both', writeRecord: false });
  prove(both.wt, 'alpha');
  prove(both.wt, 'beta'); // the joined product files make each change's evidence stale; one pull request proves both again
  const r = ciIn(both.wt, { head: 'both', json: true });
  assert.equal(r.code, 0, r.out + r.err);
  assert.deepEqual(r.json().changes.map((c) => [c.change, c.items[0].details.trainParts]), [['alpha', PARTS], ['beta', PARTS]]);
});

test('delivery-train P11: a refused train key on the default branch is a usage error, exit 3, for a change\'s pull request and a train\'s', () => {
  const p = project({ model: null, train: 'true' });
  const a = addChange(p, 'alpha');
  const own = ciIn(a.wt, { head: 'alpha' });
  assert.equal(own.code, 3, own.out + own.err);
  assert.match(own.err, /devkit\.delivery\.train: needs devkit\.delivery\.model trunk or trunk-auto/);
  const train = ciOf(handTrain(p, 1, ['alpha']));
  assert.equal(train.code, 3, train.out + train.err);
});

test('delivery-train P11: a project with no train key judges a change exactly as before, with no trainParts in its report', () => {
  const p = project({ train: null });
  const a = addChange(p, 'alpha');
  const r = ciIn(a.wt, { head: 'alpha', json: true });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal('trainParts' in r.json().items[0].details, false);
});

// ================================================================ phase 5: after the train merges

// A real train of `alpha` and `beta`: the departure, the push and the pull request of the session steps, green checks; `number` is
// the train's pull request. Nothing has merged yet.
function bothOnTrain(model = 'trunk-auto') {
  const p = project({ model, train: 'true' });
  addChange(p, 'alpha');
  addChange(p, 'beta');
  const r = departIn(p);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  for (const step of ['push-train', 'open-train-pr']) {
    const action = nextIn(p).action;
    assert.equal(action.step, step);
    assert.equal(perform(p, action).status, 0, step);
  }
  const number = p.sim.prs().find((pr) => pr.head === `train/${r.out.n}`).number;
  p.sim.setChecks(number, GREEN);
  return { p, number, n: r.out.n };
}

// The train's pull request merges with its merge commit; GitHub marks `alpha`'s pull request merged and leaves `beta`'s open. The
// stub reads a pull request's files when it merges it, so the ones GitHub marks merged go first and the train's merge is the newest.
function mergeTrain({ p, number }, { markMerged = ['alpha'] } = {}) {
  for (const id of markMerged) p.sim.merge(p.changes[id].number);
  p.sim.merge(number);
  git(p.t.main, 'fetch', '-q', 'origin');
  for (const c of Object.values(p.changes)) git(c.wt, 'fetch', '-q', 'origin');
  return p.sim.pr(number).mergeCommit;
}

const commentOf = (n, trainNumber, mergeCommit) => `Delivered by train ${n} in #${trainNumber} (merge commit ${mergeCommit.slice(0, 7)}).`;
// The two calls of the skill's row: the comment, then the close.
const closeAsSkill = (p, id, next) => {
  const gh = p.sim.gh(p.changes[id].wt);
  assert.equal(gh(['pr', 'comment', String(next.number), '--body', next.comment]).status, 0);
  assert.equal(gh(['pr', 'close', String(next.number)]).status, 0);
};

test('delivery-train P3 isOwnPr: a train/<n> head is never a change\'s own pull request, whatever files it changes', () => {
  const files = ['openspec/changes/alpha/tasks.md', 'src/alpha.txt'];
  assert.equal(deliver.isOwnPr('alpha', { headRefName: 'train/4' }, files), false);
  assert.equal(deliver.isOwnPr('alpha', { headRefName: 'train/12' }, files), false);
  assert.equal(deliver.isOwnPr('alpha', { headRefName: 'alpha' }, files), true, 'neg: an ordinary head');
  assert.equal(deliver.isOwnPr('alpha', { headRefName: 'train/alpha' }, files), true, 'neg: a head that only starts with train/');
  assert.equal(deliver.isOwnPr('alpha', { headRefName: 'feat/train/4' }, files), true, 'neg: train/<n> is the whole head');
});

test('delivery-train P3 delivered: looked up from the default branch, the train\'s merged pull request is not the change\'s own', () => {
  const ride = bothOnTrain();
  const { p } = ride;
  mergeTrain(ride, { markMerged: ['alpha'] });
  const found = deliver.findChangePr(p.sim.gh(p.t.main), p.t.main, 'alpha', { ship: 'merge', branch: 'main', env: p.env, mergeFields: true });
  assert.equal(found.pr?.number, p.changes.alpha.number, JSON.stringify(found));
  const beta = deliver.findChangePr(p.sim.gh(p.t.main), p.t.main, 'beta', { ship: 'merge', branch: 'main', env: p.env, mergeFields: true });
  assert.deepEqual([beta.none, beta.pr], [true, undefined], 'beta has no merged pull request of its own, and the train is not one');
});

test('delivery-train P3 delivered: a pull request GitHub marked merged is delivered by its train and nothing is posted on it', () => {
  const ride = bothOnTrain();
  const { p, n, number } = ride;
  const mergeCommit = mergeTrain(ride);
  const state = p.state('alpha');
  assert.deepEqual(state.carriedBy, { n, number, mergeCommit });
  const next = deliver.nextStep(state);
  assert.equal(next.step, 'retro');
  assert.equal(state.pr.state, 'MERGED');
  assert.deepEqual(p.sim.writes().filter((c) => c[1] === 'comment' || c[1] === 'close'), []);
});

test('delivery-train P3 delivered: a pull request GitHub left open at the head the train carried is delivered, and the next step closes it with the comment', () => {
  const ride = bothOnTrain();
  const { p, n, number } = ride;
  const mergeCommit = mergeTrain(ride);
  const state = p.state('beta');
  assert.equal(state.pr.state, 'OPEN');
  assert.deepEqual(state.carriedBy, { n, number, mergeCommit });
  const next = deliver.nextStep(state);
  const comment = commentOf(n, number, mergeCommit);
  assert.deepEqual([next.step, next.number, next.train, next.trainNumber, next.comment], ['close-boarded-pr', p.changes.beta.number, n, number, comment]);
  closeAsSkill(p, 'beta', next);
  assert.equal(p.sim.pr(p.changes.beta.number).state, 'CLOSED');
  assert.deepEqual(p.sim.pr(p.changes.beta.number).comments, [comment]);
  const after = p.state('beta');
  assert.equal(after.pr.state, 'CLOSED');
  assert.equal(deliver.nextStep(after).step, 'retro', 'closed, the change goes on to its retro');
});

test('delivery-train P3 delivered: a head the train did not carry is not delivered by it', () => {
  const ride = bothOnTrain();
  const { p } = ride;
  mergeTrain(ride);
  const beta = p.changes.beta;
  put(beta.wt, { 'src/beta.txt': 'changed after the train\n' });
  commitAll(beta.wt, 'code after the train');
  git(beta.wt, 'push', '-q', 'origin', 'beta');
  const state = p.state('beta');
  assert.equal(state.carriedBy, undefined);
  assert.equal(state.archive, undefined, 'not the post-merge phase');
  assert.notEqual(deliver.nextStep(state).step, 'close-boarded-pr');
});

test('delivery-train P3 delivered: a train that merged but left the tasks unticked on the default branch delivers nothing', () => {
  const p = project();
  addChange(p, 'feat');
  launchTrain(p, 4, { boarded: [boardedOf(p, 'feat')] }, { merged: true });
  const state = p.state('feat');
  assert.equal(state.carriedBy, undefined, 'the change\'s tasks are not on the default branch');
  assert.equal(state.archive, undefined);
  assert.equal(deliver.nextStep(state).step, 'boarded');
});

test('delivery-train P3 delivered: without the key a merged pull request alone delivers, as before, and nothing is read from a train', () => {
  const p = project({ train: null });
  addChange(p, 'feat');
  p.sim.merge(p.changes.feat.number);
  git(p.changes.feat.wt, 'fetch', '-q', 'origin');
  const state = p.state('feat');
  assert.equal('carriedBy' in state, false);
  assert.equal(deliver.nextStep(state).step, 'retro');
  assert.equal(p.sim.calls().some((c) => c.join(' ').includes('headRefName,headRefOid,mergedAt,mergeCommit')), false, 'no train list');
});

test('delivery-train P4 trainFacts: the merged train carries the change with its pull request and merge commit', () => {
  const ride = bothOnTrain();
  const { p, n, number } = ride;
  const mergeCommit = mergeTrain(ride);
  const facts = deliver.trainFacts(p.sim.gh(p.changes.beta.wt), p.changes.beta.wt, 'beta', { suite: 'true', prHead: headOf(p, 'beta'), kind: 'change' });
  assert.deepEqual([facts.carried, facts.onTrain, facts.left], [{ n, number, mergeCommit }, null, null]);
});

test('delivery-train AC-10: after the merge every boarded change is delivered, merged or closed with a comment; trunk-auto enables auto-merge with --merge, trunk waits for the owner', () => {
  for (const model of ['trunk-auto', 'trunk']) {
    const ride = bothOnTrain(model);
    const { p, n, number } = ride;
    const trainHead = git(p.t.main, 'ls-remote', 'origin', `refs/heads/train/${n}`).split('\t')[0];
    if (model === 'trunk-auto') {
      const enable = nextIn(p);
      assert.deepEqual([enable.action.step, enable.action.detail.command.slice(0, 7)], ['enable-auto-merge', ['gh', 'pr', 'merge', String(number), '--auto', '--merge', '--match-head-commit']], model);
      assert.equal(perform(p, enable.action).status, 0);
      assert.ok(p.sim.calls().some((c) => c.join(' ') === `pr merge ${number} --auto --merge --match-head-commit ${trainHead}`), model);
      assert.deepEqual(endOf(nextIn(p)), [1, 'end', 'waiting-on-github', 'train-auto-merge-on']);
    } else {
      assert.deepEqual(endOf(nextIn(p)), [1, 'end', 'waiting-for-owner', 'train-ready'], model);
      assert.equal(p.sim.calls().some((c) => c.includes('--auto')), false, 'trunk never enables auto-merge');
    }
    // GitHub marks alpha merged; the train's merge is the stub's auto-merge in trunk-auto and the owner's step in trunk
    p.sim.merge(p.changes.alpha.number);
    if (model === 'trunk-auto') p.sim.merge(number);
    else assert.equal(p.sim.gh(p.t.main)(['pr', 'merge', String(number), '--merge']).status, 0, 'the owner\'s merge');
    const mergeCommit = p.sim.pr(number).mergeCommit;
    assert.equal(p.sim.pr(number).state, 'MERGED', model);
    git(p.t.main, 'fetch', '-q', 'origin');
    for (const c of Object.values(p.changes)) git(c.wt, 'fetch', '-q', 'origin');

    // alpha: GitHub marked it merged, delivered, nothing posted
    assert.equal(p.next('alpha').step, 'retro', model);
    assert.deepEqual(p.sim.writes().filter((c) => c[1] === 'comment' || c[1] === 'close'), [], model);
    // beta: still open, delivered by the train, closed with the comment before its retro
    const close = p.next('beta');
    const comment = commentOf(n, number, mergeCommit);
    assert.deepEqual([close.step, close.comment], ['close-boarded-pr', comment], model);
    closeAsSkill(p, 'beta', close);
    assert.equal(p.next('beta').step, 'retro', model);
    assert.deepEqual(p.sim.writes().filter((c) => c[1] === 'comment' || c[1] === 'close').map((c) => [c[1], c[2]]), [['comment', String(p.changes.beta.number)], ['close', String(p.changes.beta.number)]], model);
    // the train's own run finds it closed and goes on to clean up
    assert.equal(nextIn(p).action.step, 'clean-train', model);
    // auto-merge was never enabled on a boarded change's own pull request
    const autos = p.sim.calls().filter((c) => c[0] === 'pr' && c[1] === 'merge' && c.includes('--auto'));
    assert.deepEqual(autos.map((c) => c[2]), model === 'trunk-auto' ? [String(number)] : [], model);
  }
});

test('delivery-train docs: pr-verifier leaves the parts the train proves to the train, and a change that edits the key runs every part', () => {
  const agent = repoFile('plugins', 'core', 'agents', 'pr-verifier.md');
  assert.match(agent, /`devkit\.delivery\.train`/, 'it names the key');
  assert.match(agent, /default branch/, 'it reads the key from the default branch\'s settings');
  assert.match(agent, /a gate part equal to a part of that command is not run/, 'the rule');
  assert.ok(agent.includes('| <gate> | \\`<part>\\` | train: proven by the train record |'), 'the row, written as the gates row is, ends in a cell that starts with train:');
  assert.match(agent, /adds, edits or removes the key runs every part/, 'a change that edits the key runs every part');
  assert.doesNotMatch(agent, /gh pr comment/);
});

test('delivery-train docs: the post-merge section and CONTRIBUTING say what a merged train delivers and how a release rides it', () => {
  const flow = repoFile('docs', 'openspec-flow.md');
  const post = sliceOf(flow, '### After the merge: the archive steps', '## Shipping a change: ship modes');
  for (const [what, re] of [
    ['delivered by a train', /delivered by a train/i],
    ['the record that delivers it', /record of a merged train/],
    ['the head it must list', /at the head of its own pull request/],
    ['the close step', /`close-boarded-pr`/],
    ['the comment', /Delivered by train <n> in #<train pull request> \(merge commit <sha7>\)/],
    ['a train head is never the change\'s own', /head `train\/<n>` is never a change's own pull request/],
    ['the archives on the train', /archive of a delivered change boards the next train/],
  ]) assert.match(post, re, `the post-merge section names ${what}`);

  const contributing = repoFile('CONTRIBUTING.md');
  for (const [what, re] of [
    ['the merge during review', /a boarded change never merges the base for a sibling/],
    ['the numbers on the train', /takes its release numbers on the train/],
    ['the tag of the train', /tagged `v<the train's version>` on the train's merge commit/],
    ['no tag for the boarded versions', /the intermediate versions of the boarded changes get no tag/],
  ]) assert.match(contributing, re, `CONTRIBUTING names ${what}`);
});

// ================================================================ phase 6: the real run (AC-12)

// The real command lines of the delivery, spawned the way the coordinating session spawns them, from fresh scratch
// repositories (a bare origin, a main checkout, worktrees): `change-loop.mjs start` with `train` on standard input, then
// `train-loop.mjs next` and the command of each action in turn, with the stub `gh` of `simGitHub` first on PATH. What GitHub
// does between two commands (it runs the checks, it merges the train's pull request) is the stub's: the test says so in the
// transcript. Nothing is imported from the scripts here: every call crosses a process boundary.
//
// When DEVKIT_REAL_RUN_FILE names a file, the transcript of the four cases is written there as Markdown: that is how
// `openspec/changes/delivery-train/proof/real-run.md` is made (task 6.8).
const changeLoopFile = join(here, 'change-loop.mjs');
const deliverCheckFile = join(here, 'deliver-check.mjs');
const REAL_RUN_FILE = process.env.DEVKIT_REAL_RUN_FILE ?? '';

// The env of a session's commands: a session does not run under the test runner, so the variable that makes a nested
// `node --test` behave as a child of this one (and report green without running its files) is dropped.
const sessionEnv = (p) => { const { NODE_TEST_CONTEXT, ...env } = depEnv(p); return env; };

// A session on the scratch project `p`: `run` spawns a command line in a folder and records it; `github` records what the
// stub does in the place of GitHub.
function sessionOf(p) {
  const log = [];
  const shown = (text) => String(text ?? '')
    .split(p.scratch).join('<scratch>').split(p.t.main).join('<repo>').split(p.t.originDir).join('<origin>').split(p.sim.dir).join('<github-stub>').split(here).join('<hooks>');
  const run = (argv, { cwd = p.t.main, input } = {}) => {
    const r = spawnSync(argv[0], argv.slice(1), { cwd, env: sessionEnv(p), input, encoding: 'utf8' });
    log.push({ kind: 'command', cwd: shown(cwd), command: shown(argv.join(' ')), input, status: r.status, stdout: shown(r.stdout), stderr: shown(r.stderr) });
    return r;
  };
  const github = (what) => log.push({ kind: 'github', what });
  // `train-loop.mjs next`, the way a session asks for its next action, then the action's command when it is one.
  const next = (after = null) => {
    const r = run(['node', trainLoopFile, 'next', '--lang', 'en', ...(after ? ['--after', after] : [])]);
    return { code: r.status, action: JSON.parse(r.stdout) };
  };
  // Asks and performs until an action ends the run; `react[step]` is what GitHub does after the session performed `step`.
  const ride = (react = {}) => {
    const steps = [];
    let after = null;
    for (let i = 0; i < 25; i++) {
      const { code, action } = next(after);
      if (action.kind === 'end') return { code, action, steps };
      const done = run(action.detail.command);
      steps.push(action.step);
      assert.equal(done.status, 0, `${action.step}: ${done.stderr}`);
      react[action.step]?.(action);
      after = action.progressKey;
    }
    throw new Error(`the run did not end: ${steps.join(', ')}`);
  };
  // The next step of a change (or an archive) as its own delivery loop gives it, spawned in its worktree.
  const stepOf = (id, wt) => {
    const r = run(['node', deliverCheckFile, id, '--json'], { cwd: wt });
    return JSON.parse(r.stdout).next;
  };
  return { log, run, github, next, ride, stepOf };
}

const transcripts = [];
function recordCase(no, model, title, ends, log) {
  const lines = [`## Case ${no}: ${title}`, '', `Model: \`${model}\`.`, '', `Ends with: ${ends}`, ''];
  for (const e of log) {
    if (e.kind === 'github') { lines.push(`> The stub \`gh\` stands in for GitHub: ${e.what}`, ''); continue; }
    lines.push(`$ cd ${e.cwd} && ${e.command}${e.input === undefined ? '' : `   # standard input: ${JSON.stringify(e.input)}`}`, '', `exit code ${e.status}`, '');
    const out = e.stdout.trim();
    if (out) lines.push('```text', out.length > 3000 ? `${out.slice(0, 3000)}\n... (${out.length - 3000} more characters)` : out, '```', '');
    if (e.stderr.trim()) lines.push('stderr:', '', '```text', e.stderr.trim().slice(0, 1000), '```', '');
  }
  transcripts.push(lines.join('\n'));
}

const callsOf = (p) => p.sim.calls().map((c) => c.join(' '));
// GitHub merges `train`'s pull request with a merge commit and marks the pull requests of `marked` merged; the others stay open.
function githubMerges(p, s, trainNumber, marked) {
  for (const id of marked) p.sim.merge(p.changes[id].number);
  p.sim.merge(trainNumber);
  s.github(`pull requests ${[...marked.map((id) => p.changes[id].number), trainNumber].map((n) => `#${n}`).join(', ')} are merged (the train's with a merge commit, ${marked.length} of the boarded ones marked merged); the other boarded pull requests stay open`);
  git(p.t.main, 'fetch', '-q', 'origin');
  for (const c of [...Object.values(p.changes), ...Object.values(p.archives)]) git(c.wt, 'fetch', '-q', 'origin');
}
const trainPrOf = (p) => p.sim.prs().find((pr) => /^train\/\d+$/.test(pr.head));

// The part every case shares: the session types `/devkit train`, the loop departs, pushes and opens the train's pull request.
function startAndDepart(p, s, react = {}) {
  const start = s.run(['node', changeLoopFile, 'start', '--lang', 'en'], { input: 'train' });
  const body = JSON.parse(start.stdout);
  assert.deepEqual([start.status, body.mode, body.verb], [0, 'train', 'train'], start.stdout);
  return s.ride(react);
}

const conductFile = join(here, 'conduct-check.mjs');

// The row of change `id` as the conducting session reads it, spawned from the main checkout.
function conductRow(s, id) {
  const r = s.run(['node', conductFile, '--change', id, '--json']);
  return JSON.parse(r.stdout).changes.find((c) => c.id === id);
}

const TEST_OF = (id) => `import { test } from 'node:test';\ntest('${id}', () => {});\n`;
const SHARED_TEST = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { existsSync } from 'node:fs';\n"
  + "test('alpha and beta never ship together', () => {\n  assert.ok(!(existsSync('test/alpha.test.mjs') && existsSync('test/beta.test.mjs')), 'alpha and beta clash');\n});\n";
const TEST_SUITE = 'node --test test/*.test.mjs';
const SHARED = 'line 1\nline 2\nline 3\n';

test('delivery-train AC-12: the real run', () => {
  const scratches = [];
  // Every case's departure TMPDIR is its own and must be empty when the case ends: nothing is left behind.
  const finish = (p) => { scratches.push(p.scratch); assert.deepEqual(readdirSync(p.scratch), [], 'the run leaves nothing in its TMPDIR'); };
  const checksPass = (p, s) => () => { p.sim.setChecks(trainPrOf(p).number, GREEN); s.github('the checks of the train\'s pull request pass (`check`, `devkit-reviews`)'); };

  // Case 1: trunk-auto. Two changes and an archive board, depart, push, open the train's pull request, auto-merge, the merge.
  {
    const p = project({ model: 'trunk-auto', train: 'true', roadmap: roadmapOfIds('gamma'), files: RELEASE_BASE });
    const alpha = addChange(p, 'alpha', { files: bumpFiles('0.7.0', 'alpha'), at: '2026-11-23T10:00:00Z' });
    const beta = addChange(p, 'beta', { files: bumpFiles('0.7.0', 'beta'), at: '2026-11-23T10:10:00Z' });
    const gamma = addArchive(p, 'gamma', { at: '2026-11-23T10:05:00Z' });
    const s = sessionOf(p);
    const end = startAndDepart(p, s, { 'open-train-pr': checksPass(p, s) });
    assert.deepEqual(end.steps, ['depart', 'push-train', 'open-train-pr', 'enable-auto-merge']);
    assert.deepEqual([end.code, end.action.end.state, end.action.end.why], [1, 'waiting-on-github', 'train-auto-merge-on']);
    const number = trainPrOf(p).number;
    const head = git(p.t.main, 'ls-remote', 'origin', 'refs/heads/train/1').split('\t')[0];
    assert.ok(callsOf(p).includes(`pr merge ${number} --auto --merge --match-head-commit ${head}`), 'auto-merge is enabled on the train with the merge method merge, pinned to the train head');
    assert.equal(JSON.parse(git(p.t.main, 'show', `train/1:plugins/a/.claude-plugin/plugin.json`)).version, '0.8.0', 'the release is renumbered on the train only');
    assert.equal(JSON.parse(git(p.t.main, 'show', 'origin/beta:plugins/a/.claude-plugin/plugin.json')).version, '0.7.0');
    githubMerges(p, s, number, ['alpha']);
    const after = s.ride();
    assert.deepEqual(after.steps, ['close-boarded-pr', 'close-boarded-pr', 'clean-train', 'clean-train']);
    assert.deepEqual([after.code, after.action.end.why], [1, 'train-nothing']);
    assert.equal(p.sim.pr(beta.number).state, 'CLOSED', 'the pull request GitHub left open is closed with the comment');
    assert.equal(p.sim.pr(gamma.number).state, 'CLOSED');
    assert.ok(callsOf(p).some((c) => c.startsWith(`pr close ${beta.number} --comment Delivered by train 1 in #${number} (merge commit `)), 'with the comment that says which train delivered it');
    assert.deepEqual([s.stepOf('alpha', alpha.wt).step, s.stepOf('beta', beta.wt).step, s.stepOf('gamma', gamma.wt).step], ['retro', 'retro', 'archived']);
    assert.equal(callsOf(p).filter((c) => c.startsWith('pr merge') && c.includes('--auto')).length, 1, 'auto-merge is enabled once, on the train, and never on a boarded change\'s own pull request');
    assert.equal(gitOf(p, 'for-each-ref', 'refs/heads/train'), '', 'the train branch and its worktree are gone');
    recordCase(1, 'trunk-auto', 'two changes and the archive of a third board, the train merges by auto-merge', 'the train\'s pull request merged by auto-merge (`gh pr merge <n> --auto --merge --match-head-commit <head>`), `beta`\'s pull request and the archive\'s closed with the comment, `alpha` and `beta` at their retro and the archive of `gamma` archived.', s.log);
    finish(p);
  }

  // Case 2: trunk. The same boarding; the checks run, the owner's step merges, no auto-merge is ever enabled.
  {
    const p = project({ model: 'trunk', train: 'true' });
    const alpha = addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
    const beta = addChange(p, 'beta', { at: '2026-11-23T10:10:00Z' });
    const s = sessionOf(p);
    const pending = startAndDepart(p, s, { 'open-train-pr': () => { p.sim.setChecks(trainPrOf(p).number, PENDING); s.github('the checks of the train\'s pull request are running (`check` pending)'); } });
    assert.deepEqual(pending.steps, ['depart', 'push-train', 'open-train-pr']);
    assert.deepEqual([pending.code, pending.action.end.state, pending.action.end.why], [1, 'waiting-on-github', 'train-checks']);
    const number = trainPrOf(p).number;
    p.sim.setChecks(number, GREEN);
    s.github('the checks of the train\'s pull request pass (`check`, `devkit-reviews`)');
    const ready = s.ride();
    assert.deepEqual(ready.steps, []);
    assert.deepEqual([ready.code, ready.action.end.state, ready.action.end.why], [1, 'waiting-for-owner', 'train-ready']);
    p.sim.merge(alpha.number);
    s.github(`pull request #${alpha.number} is marked merged; #${beta.number} stays open`);
    const owner = s.run(['gh', 'pr', 'merge', String(number), '--merge']);
    assert.equal(owner.status, 0, owner.stderr);
    assert.equal(p.sim.pr(number).state, 'MERGED', 'the owner\'s step merged the train');
    git(p.t.main, 'fetch', '-q', 'origin');
    for (const c of Object.values(p.changes)) git(c.wt, 'fetch', '-q', 'origin');
    const after = s.ride();
    assert.deepEqual(after.steps, ['close-boarded-pr', 'clean-train', 'clean-train']);
    assert.deepEqual([s.stepOf('alpha', alpha.wt).step, s.stepOf('beta', beta.wt).step], ['retro', 'retro']);
    assert.deepEqual(callsOf(p).filter((c) => c.includes('--auto')), [], 'no auto-merge call was ever made, on any pull request');
    recordCase(2, 'trunk', 'two changes board, the owner merges the train', 'the train\'s pull request merged by the owner\'s step (`gh pr merge <n> --merge`), no `--auto` call on any pull request, `alpha` and `beta` at their retro.', s.log);
    finish(p);
  }

  // Case 3: trunk-auto. Two changes that pass alone and fail together: the later leaves red, the rest departs after one more run.
  {
    const p = project({ model: 'trunk-auto', train: TEST_SUITE, files: { 'test/shared.test.mjs': SHARED_TEST } });
    const alpha = addChange(p, 'alpha', { files: { 'test/alpha.test.mjs': TEST_OF('alpha') }, at: '2026-11-23T10:00:00Z' });
    const beta = addChange(p, 'beta', { files: { 'test/beta.test.mjs': TEST_OF('beta') }, at: '2026-11-23T10:10:00Z' });
    const s = sessionOf(p);
    const end = startAndDepart(p, s, { 'open-train-pr': checksPass(p, s) });
    assert.deepEqual(end.steps, ['depart', 'push-train', 'open-train-pr', 'enable-auto-merge']);
    const departure = JSON.parse(s.log.find((e) => e.kind === 'command' && e.command.includes(' depart ')).stdout);
    assert.deepEqual([departure.boarded.map((b) => b.id), departure.left.map((l) => [l.id, l.why])], [['alpha'], [['beta', 'red']]]);
    assert.equal(departure.runs, 3, 'the full train (red), the prefix of alpha (green), then the train without beta (green)');
    const record = deliver.parseTrainRecord(git(p.t.main, 'show', 'train/1:openspec/trains/1.md'));
    assert.deepEqual([record.result, record.left.map((l) => [l.id, l.why])], ['passed', [['beta', 'red']]]);
    assert.match(record.left[0].failure, /alpha and beta clash/, 'the record carries the failure of the suite that ran');
    assert.deepEqual(s.stepOf('beta', beta.wt).step, 'wait-train', 'while the train is open, beta waits on GitHub for it');
    githubMerges(p, s, trainPrOf(p).number, ['alpha']);
    const after = s.ride();
    assert.deepEqual(after.steps, ['clean-train', 'clean-train']);
    const rejoin = s.stepOf('beta', beta.wt);
    assert.equal(rejoin.step, 'rejoin-train', 'once the train merged, beta goes back to its own cycle');
    assert.match(JSON.stringify(rejoin), /alpha and beta clash/, 'with the failure attached');
    assert.deepEqual(rejoin.paths, [], 'a red change has no path to resolve');
    assert.equal(s.stepOf('alpha', alpha.wt).step, 'retro');
    assert.equal(p.sim.pr(beta.number).state, 'OPEN', 'beta\'s pull request is not closed: it did not ride');
    recordCase(3, 'trunk-auto', 'two changes pass alone and fail together, the later one leaves red', 'the train (`alpha` alone) merged by auto-merge after the bisection; `beta` at `wait-train` while the train was open and at `rejoin-train`, with the failure attached, once it merged.', s.log);
    finish(p);
  }

  // Case 4: trunk-auto. beta conflicts with alpha in a product file; the archives of gamma and delta edit the same canonical spec.
  {
    const p = project({ model: 'trunk-auto', train: 'true', roadmap: roadmapOfIds('gamma', 'delta'), files: { 'src/shared.txt': SHARED, [SPEC]: '# spec\n\nline 1\nline 2\nline 3\n' } });
    const alpha = addChange(p, 'alpha', { files: { 'src/shared.txt': 'line 1\nalpha line 2\nline 3\n' }, at: '2026-11-23T10:00:00Z' });
    const beta = addChange(p, 'beta', { files: { 'src/shared.txt': 'line 1\nbeta line 2\nline 3\n' }, at: '2026-11-23T10:05:00Z' });
    const delta = (id) => ({ [`openspec/changes/${id}/specs/change-coordination/spec.md`]: `## ADDED Requirements\n\n### Requirement: ${id}\n`, });
    const gamma = addArchive(p, 'gamma', { at: '2026-11-23T10:10:00Z', changeFiles: delta('gamma'), files: { [SPEC]: '# spec\n\nline 1\ngamma line 2\nline 3\n' } });
    const deltaArchive = addArchive(p, 'delta', { at: '2026-11-23T10:15:00Z', changeFiles: delta('delta'), files: { [SPEC]: '# spec\n\nline 1\ndelta line 2\nline 3\n' } });
    const s = sessionOf(p);
    const end = startAndDepart(p, s, { 'open-train-pr': checksPass(p, s) });
    assert.deepEqual(end.steps, ['depart', 'push-train', 'open-train-pr', 'enable-auto-merge']);
    const departure = JSON.parse(s.log.find((e) => e.kind === 'command' && e.command.includes(' depart ')).stdout);
    assert.deepEqual(departure.boarded.map((b) => `${b.kind}:${b.id}`), ['change:alpha', 'archive:gamma']);
    assert.deepEqual(departure.left.map((l) => [l.kind, l.id, l.why]), [['change', 'beta', 'conflict'], ['archive', 'delta', 'conflict']]);
    assert.equal(departure.left[0].detail, '`src/shared.txt`');
    assert.ok(departure.left[1].detail.includes(`\`${SPEC}\``), `the archive leaves with the spec's path: ${departure.left[1].detail}`);
    githubMerges(p, s, trainPrOf(p).number, ['alpha']);
    const after = s.ride();
    assert.deepEqual(after.steps, ['close-boarded-pr', 'clean-train', 'clean-train']);
    const rejoin = s.stepOf('beta', beta.wt);
    assert.equal(rejoin.step, 'rejoin-train');
    assert.deepEqual(rejoin.paths, ['src/shared.txt'], 'a conflicting change gets the path to resolve');
    const stop = conductRow(s, 'delta').next;
    assert.deepEqual([stop.step, stop.archiveStep], ['stop-archive', 'train-left']);
    assert.ok(stop.reason.includes(SPEC), stop.reason);
    assert.equal(s.stepOf('gamma', gamma.wt).step, 'archived');
    assert.equal(p.sim.pr(deltaArchive.number).state, 'OPEN', 'the archive of delta did not ride and stays open for its own cycle');
    assert.equal(s.stepOf('alpha', alpha.wt).step, 'retro');
    recordCase(4, 'trunk-auto', 'a product conflict and two archives of one spec: beta and the archive of delta leave with their paths', 'the train (`alpha` and the archive of `gamma`) merged by auto-merge; `beta` at `rejoin-train` naming `src/shared.txt`; the archive of `delta` at `stop-archive` (`train-left`) naming the spec path.', s.log);
    finish(p);
  }

  if (REAL_RUN_FILE) writeFileSync(REAL_RUN_FILE, `# Real run of delivery-train\n\n${transcripts.join('\n')}\n`);
  assert.equal(scratches.length, 4, 'four cases, each from a fresh scratch repository and a TMPDIR of its own');
});
