// node scripts/test-suite.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs
// roadmap-coordinator, part 2 of 3 (suite-speed D-11; the others are roadmap-loop.test.mjs and roadmap-loop-upfront.test.mjs): the skill and the setting, the documents (phase 5), the followups, the roadmap on CompozyOS and the first half of the upfront sessions. What the three parts share is in roadmap-loop-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { tmpFolder } from './test-tmp.mjs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import {
  gitRepo, put, commitAll, git, readCounter, fakeCompozy, cleanEnvLoop as cleanEnv, agentAct, grillAct, endAct, ownerAct, world, OFFLINE, FLAGS,
  roadmapText, projectWith, cmd, doRun, doNext, doStatus, jsonOf, runFileOf, stateOf, putRun, events, addOpen,
} from './test-fixtures.mjs';
import * as guardModule from './guard.mjs';
import { nextAction, render, MESSAGES, HOOKS_DIR } from './change-loop.mjs';
import * as changeLoopModule from './change-loop.mjs';
import * as loopModule from './roadmap-loop.mjs';
import { limitOf, gateOf, decideRoadmap, boardOf } from './roadmap-loop.mjs';
import {
  HERE, sessionAct, githubAct, blockedAct, archivedAct, FLYING, say, changesOf, LOOP_FILE, picture, LK_SESSION, lkSandbox, lkTyped, lkPlain,
  lkSkillBody, lkAssistant, lkResult, lkMarker, lkTranscript, lkRun, lkStopInput, lkAgentInput, BRIEF, PLANNER_TYPE, UP_TO_READINESS, lkProject,
  LK_ENV, lkOpts, withTmp, recordOf, nothingRecorded, stopOf, agentOf, lkHook, lkEdit, lkBash, skillMd, sessionSkillMd, sectionOf, deadPid,
  lockFileOf, AT, START_FIELDS, sessionWorld, UP_SESSION, UP_TICKET, upStarted, upTickets, upEntry, upInput, entryOf, labelOf, upGitEnv, sd, implAct,
  upChange, approve, doSessionNext, upBase, sessionNextOf, upStopInput, AT2, JOB, gateLine, upPushed, pushesOf, PUSH_OPTS,
} from './roadmap-loop-fixtures.mjs';

// ---------------------------------------------------------------- the skill and the setting (design D-13, D-6)
const SK_LANG = '--lang ${user_config.language}';
const SK_LIMIT = '--load-limit ${user_config.load_limit}';
const SK_MACHINES = "--machines '${user_config.machines}'";

test('roadmap-loop skill: every roadmap-loop command carries the person\'s language and the load limit', () => {
  const md = skillMd();
  const calls = md.split('\n').filter((l) => /roadmap-loop\.mjs (run|next|status|draft|reply|wait|hold)\b/.test(l));
  for (const sub of ['run', 'next', 'status', 'draft', 'reply', 'wait', 'hold']) assert.ok(calls.some((l) => l.includes(`roadmap-loop.mjs ${sub}`)), `the body runs ${sub}`);
  for (const l of calls) {
    assert.ok(l.includes(SK_LANG), `--lang on: ${l}`);
    assert.ok(l.includes(SK_LIMIT), `--load-limit on: ${l}`);
  }
  assert.doesNotMatch(md, /--lang (pt-BR|en)\b/);
  assert.doesNotMatch(md, /--load-limit \d/, 'the limit is the setting, never a number');
  const lines = md.split('\n');
  const run = lines.findIndex((l) => l.includes('roadmap-loop.mjs run'));
  assert.ok(lines[run].includes('--session ${CLAUDE_SESSION_ID}'), 'run carries the session id');
  assert.ok(lines[run].endsWith("<<'DEVKIT_ARGS'"), 'run reads the word through a quoted heredoc');
  assert.equal(lines[run + 1], '$ARGUMENTS');
  assert.equal(lines[run + 2], 'DEVKIT_ARGS');
  assert.doesNotMatch(md, /<<\s*[A-Z_]+\b(?!')/, 'no unquoted heredoc');
});

test('roadmap-loop skill: the frontmatter and the start modes name the roadmap and the status', () => {
  const md = skillMd();
  const fm = md.split('---')[1];
  assert.match(fm, /^argument-hint: "change \[<request> \| <change-id> \| <Jira key or link>\] \| roadmap \[<n> \| stop\] \| status \| train \| project \[<name>\]"$/m);
  const desc = /^description: (.*)$/m.exec(fm)[1];
  assert.match(desc, /\/devkit roadmap \[<n>\] runs the roadmap's ready changes, several at once, and \/devkit status shows where everything is/);
  assert.match(desc, /Use when the owner types \/devkit.*\/devkit roadmap.*\/devkit status/);
  const start = sectionOf(md, '## Start', '## A new change');
  assert.match(start, /- `roadmap`: the Roadmap section/);
  assert.match(start, /- `status`: the Status section/);
});

test('roadmap-loop skill: background hand-offs, one change per question, and the message that ends a turn', () => {
  const md = skillMd();
  // Invariant: where the host cannot start sessions, the coordinator hands each stage in the background, asks one change at a time and ends a
  // turn with its message. Layer: skill text. Suite: roadmap-loop. The opening paragraph and step 1 plus the part of today's steps 2 to 5.
  const roadmap = sectionOf(md, '## Roadmap', '### A session per change') + sectionOf(md, '### Every change in this session', '## Status');
  // The stages of every change are handed in the background, in one message; the starts and the session steps one at a time.
  assert.match(roadmap, /hand every one to its agent in one message, each as an Agent call with `run_in_background: true`/);
  assert.match(roadmap, /`subagent_type` set to the action's `agent` field and the prompt `brief` exactly as given/);
  assert.match(roadmap, /open the changes one after the other, never two at once/);
  assert.match(roadmap, /`session`: only then, one at a time/);
  assert.match(roadmap, /`wait`: start `node <skill-dir>\/\.\.\/\.\.\/hooks\/roadmap-loop\.mjs wait --change <id>[^`]*` with the Bash tool's background option/);
  assert.match(roadmap, /`hold`: start `node <skill-dir>\/\.\.\/\.\.\/hooks\/roadmap-loop\.mjs hold[^`]*` with the Bash tool's background option/);
  assert.ok(roadmap.includes('--after <id>=<progressKey of its action>'), 'a returned subagent passes the key of its action');
  assert.match(roadmap, /when a wait or a hold ends, run the same call with no `--after`/);
  assert.match(roadmap, /`Outcome: failure` is reported like its success, with `--after <id>=<progressKey of its action>`/);
  assert.ok(!roadmap.includes('why=role-failed'), 'a failed agent is the loop\'s end, not the session\'s');
  // One change per question; the answer belongs to that change only.
  assert.match(roadmap, /The owner is asked one change at a time\. `ask` names the change at the head of the owner's queue/);
  assert.match(roadmap, /naming that change in the question \(the grill's questions included/);
  assert.match(roadmap, /The answer is for that change only: record it as `## Owner gates` says/);
  // The message that ends a turn: the events, the plain lines, the end reply, and last the question, asked again after other events.
  const message = roadmap.split('\n').find((l) => l.startsWith('5. The message that ends a turn'));
  assert.ok(message, 'an item for the message that ends a turn');
  const at = (text) => { const i = message.indexOf(text); assert.ok(i >= 0, text); return i; };
  assert.ok(at('every `lines` entry') < at('the plain lines a call printed') && at('the plain lines a call printed') < at('the `end.reply`') && at('the `end.reply`') < at('last the `ask` question'));
  assert.match(message, /asked again when other events came after it/);
  assert.match(roadmap, /`run` with `stop` prints the rows of the changes that stay[^.]*\.[^.]*may repeat them: show them once/);
  // The run line is a record for the lock, never shown.
  assert.match(roadmap, /The first line printed is `devkit-roadmap: <n>` \(or `stop`\); it is the record the locks read: never show it/);
  // The Never list holds the roadmap rules.
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /In a roadmap run: hand two stages of one change at once, start a change `next` did not return, dispatch a subagent for a whole change, write the run file by hand, ask the owner about two changes in one question/);
  assert.match(sectionOf(md, '## Status', '## Never'), /show its output exactly as it is/);
});

test('roadmap-loop setting: the load_limit user setting', () => {
  const plugin = JSON.parse(readFileSync(join(HERE, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.deepEqual(Object.keys(plugin.userConfig), ['language', 'load_limit', 'machines']);
  const { load_limit: limit, language } = plugin.userConfig;
  assert.deepEqual(language, { type: 'string', title: 'Language', description: 'Language of the /devkit replies and of the stage readout: pt-BR or en', default: 'pt-BR' });
  assert.equal(limit.type, 'string');
  assert.equal(limit.default, '80');
  assert.ok(typeof limit.title === 'string' && limit.title.length > 0, 'a title');
  assert.match(limit.description, /whole number/);
  assert.equal(limitOf(limit.default), 80, 'the default reads as the default limit');
  assert.deepEqual(plugin.userConfig.machines, {
    type: 'string', title: 'Machines',
    description: 'Other machines /devkit roadmap may open changes on, as a JSON list: [{"host": "<the app\'s SSH connection name>", "folder": "<the repository folder there>", "places": <how many changes may implement there at once>}]. Empty runs every change on this machine',
    default: '[]',
  });
  assert.deepEqual(loopModule.parseMachines(plugin.userConfig.machines.default), { machines: [] }, 'the default reads as unset');
  const used = new Set([...skillMd().matchAll(/\$\{user_config\.(\w+)\}/g)].map((m) => m[1]));
  for (const key of used) assert.ok(key in plugin.userConfig, `the skill uses ${key}, which the plugin declares`);
  assert.ok(used.has('load_limit'));
});

test('roadmap-loop skill: every hand-off of a roadmap run starts with the change\'s brief line, and an unfilled setting is used silently', () => {
  const roadmap = sectionOf(skillMd(), '## Roadmap', '## Status');
  assert.match(roadmap, /every hand-off, the reviewers and verifiers of a review round included, starts with the line of the change's brief that names the change and its script \(`Change <id> \(<script> script\), stage \.\.\.`\)/);
  assert.match(roadmap, /a setting that arrives unfilled is used at its default without a word to the owner/);
});

// ---------------------------------------------------------------- the documents (phase 5: design D-14, D-15, D-16)

// Invariant (AC-16): the design, ADR 0013, the two Notes, the config, the flow page, the role document and both READMEs
// say what the roadmap coordinator is. Layer: the documents. Suite: this file.
test('roadmap-loop docs: the documents follow', () => {
  const REPO = join(HERE, '..', '..', '..');
  const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');
  const part = (md, from, to) => { const a = md.indexOf(from); assert.ok(a >= 0, from); const b = md.indexOf(to, a + from.length); return md.slice(a, b < 0 ? md.length : b); };
  const design = read('docs', 'coordination-design.md');
  assert.match(design, /Built in round 18\s+\(`roadmap-coordinator`\)/, 'section 2 says built');
  assert.doesNotMatch(design, /To be built in round 18/);
  assert.match(design, /Decided by\s+`roadmap-coordinator` on 2026-11-2\d \(A-6, grill questions 8 and 9\)/, 'the load is decided');
  assert.doesNotMatch(design, /How it measures load is open/);
  assert.match(design, /roadmap coordinator \(built, round 18\)/, 'stage 0 is built');
  assert.match(part(design, '## 10. ', '## 11. '), /each stage runs as a subagent in the\s+background/, 'section 10 names the background stages');
  assert.doesNotMatch(design, /each change has its change coordinator as a subagent/);
  assert.match(part(design, '## 13. ', '## Open points'), /Many background subagent ends in a row over whole changes \(not proved by round 19, whose phases run in the session; the first `\/devkit roadmap` run that carries several changes to their ends records it\)/);
  const open = part(design, '## Open points', '## What stays shipped');
  assert.doesNotMatch(open, /How the roadmap coordinator measures load/, 'the load point left Open points');
  assert.match(open, /how the load is measured/, 'the sentence names the load among the answered ones');
  const adr = read('docs', 'adr', '0013-the-roadmap-coordinator-is-the-owners-session.md');
  assert.match(adr, /^- Status: (proposed|accepted)$/m);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0013 has ${h}`);
  }
  const link = '[ADR 0013](0013-the-roadmap-coordinator-is-the-owners-session.md)';
  const adr10 = read('docs', 'adr', '0010-openspec-as-the-harness.md');
  const adr11 = read('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md');
  for (const t of [adr10, adr11]) {
    assert.match(t, /Note \(roadmap-coordinator, \d{4}-\d{2}-\d{2}\):/);
    assert.ok(t.includes(link), 'the Note links ADR 0013');
  }
  if (/^- Status: accepted$/m.test(adr)) {
    for (const t of [adr10, adr11]) assert.match(t, /^- Amended by ADR 0013 \(0013-the-roadmap-coordinator-is-the-owners-session\.md\)$/m);
    assert.match(adr, /^- Accepted by: /m);
  }
  const adrs = read('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0013/, 'the ADRs line names 0013');
  const flow = read('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').includes('## The roadmap coordinator: `/devkit roadmap` and `/devkit status`'), 'the flow page has the section');
  assert.match(read('docs', 'roles.md'), /^## roadmap-coordinator$/m);
  for (const f of [['plugins', 'openspec', 'README.md'], ['README.md']]) {
    const md = read(...f);
    assert.match(md, /\/devkit roadmap/, `${f.join('/')} names /devkit roadmap`);
    assert.match(md, /\/devkit status/, `${f.join('/')} names /devkit status`);
  }
});

test('roadmap-loop run: a word written to the pipe after a delay is still read', async () => {
  const root = projectWith(roadmapText('[ ] a'));
  const late = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [LOOP_FILE, 'run', ...FLAGS, '--session', 'S1'], { cwd: root, env: cleanEnv, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stdout }));
    setTimeout(() => child.stdin.end('many'), 400);
  });
  assert.deepEqual([late.code, late.stdout], [0, `${render('en', 'roadmap-invalid', { word: 'many' })}\n`]);
});

test('stage-roles loop: gateOf names the mock-up approval as its own gate, said in both languages', () => {
  const act = endAct('x', 'waiting-for-owner', 'waiting-mockup', {}, { stage: 'mockup', stageTitle: 'Screen mock-up' });
  assert.equal(gateOf(act), 'mockup');
  for (const lang of ['en', 'pt-BR']) assert.ok(MESSAGES[lang]['gate.mockup'], `${lang} has gate.mockup`);
});

// ================================================================ roadmap-coordinator-followups: phase 1 (the run file and its locks)

const BAD_IDS = ['__proto__', '../x', '-a'];
const heldRoot = (over = {}) => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { session: 'S1', places: 1, ...over });
  return root;
};

test('followups AC-4 next: an --after id that is not a change id exits 3 and writes nothing', () => {
  for (const id of BAD_IDS) {
    const root = heldRoot();
    addOpen(root, 'a');
    const raw = readFileSync(runFileOf(root), 'utf8');
    const r = doNext(root, ['--after', `${id}=proposal`]);
    assert.equal(r.code, 3, `${id}: ${r.stdout}`);
    assert.ok(r.stderr.includes(JSON.stringify(id)), `${id}: the message names the id: ${r.stderr}`);
    assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${id}: the run file's bytes are unchanged`);
  }
});

test('followups AC-4 reply: an end declared for an id that is not a change id exits 3 and records nothing', () => {
  for (const id of BAD_IDS) {
    for (const extra of [['blocked', '--param', 'why=cannot-open', '--param', 'error=taken'], ['waiting-pr-decision', '--param', 'url=https://example.test/pr/1']]) {
      const root = heldRoot();
      const raw = readFileSync(runFileOf(root), 'utf8');
      const r = cmd(root, ['reply', extra[0], ...FLAGS, '--param', `id=${id}`, ...extra.slice(1)]);
      assert.equal(r.code, 3, `${id} ${extra[0]}: ${r.stdout}`);
      assert.ok(r.stderr.includes(JSON.stringify(id)), `${id}: ${r.stderr}`);
      assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${id} ${extra[0]}: nothing recorded`);
    }
  }
});

test('followups AC-4 wait: a --change that is not a change id exits 3 and marks nothing in flight', async () => {
  for (const id of BAD_IDS) {
    const root = heldRoot();
    const raw = readFileSync(runFileOf(root), 'utf8');
    const marked = [];
    const r = await loopModule.runCommand(['wait', '--change', id, ...FLAGS, '--interval', '5'], {
      cwd: root, env: cleanEnv, gh: OFFLINE, sleep: async () => { marked.push(stateOf(root).inflight); },
    });
    assert.equal(r.code, 3, `${id}: ${r.stdout}`);
    assert.ok(r.stderr.includes(JSON.stringify(id)), `${id}: ${r.stderr}`);
    assert.deepEqual(marked, [], `${id}: it never waited`);
    assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${id}: marks nothing in flight`);
  }
});

test('followups AC-5 run file: a write that fails leaves no temporary file and throws', () => {
  const root = heldRoot();
  const file = join(root, 'scratch-run', 'roadmap-run.json');
  mkdirSync(file, { recursive: true }); // the path of the run file is a directory: the rename fails
  assert.throws(() => loopModule.updateRun(file, (run) => run));
  assert.deepEqual(readdirSync(dirname(file)).filter((name) => name.endsWith('.tmp')), [], 'no temporary file is left');
  assert.equal(existsSync(join(dirname(file), 'roadmap-run.lock')), false, 'the lock is released');
});

test('followups AC-6 lock: the run file\'s wait is at most half the agent hook\'s timeout', () => {
  const hooks = JSON.parse(readFileSync(join(HERE, 'hooks.json'), 'utf8')).hooks;
  const entry = hooks.PreToolUse.find((h) => h.matcher === 'Agent');
  const timeout = entry.hooks[0].timeout;
  assert.ok(Number.isInteger(timeout) && timeout > 0, 'the agent hook has a timeout');
  assert.ok(loopModule.LOCK.waitMs <= (timeout * 1000) / 2, `${loopModule.LOCK.waitMs} ms is more than half of ${timeout} s`);
});

test('followups AC-6 lock agent: a hand-off while the run file is locked is let through within the hook\'s time and logged run-file-busy', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1 });
  writeFileSync(lockFileOf(root), ''); // another call holds the run file: a fresh lock
  const log = join(lkSandbox(), 'hooks.jsonl');
  const started = Date.now();
  const r = lkHook('agent', lkAgentInput(root, lkRun(1), PLANNER_TYPE, BRIEF('a')), { TMPDIR: lkSandbox(), DEVKIT_HOOK_LOG: log, CLAUDE_PLUGIN_OPTION_LANGUAGE: 'en' });
  const took = Date.now() - started;
  assert.equal(r.code, 0, r.err);
  assert.ok(took < 10_000, `answered in ${took} ms`);
  const records = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(records.map((x) => [x.mode, x.decision, x.why, x.change]), [['agent', 'allow', 'run-file-busy', 'a']]);
  assert.deepEqual(stateOf(root).inflight, {}, 'the stage is not marked in flight');
});

test('followups AC-7 next: a hold whose process ended asks for a new hold while loaded, and starts below the limit', () => {
  const dead = { pid: deadPid(), at: '2026-11-21T10:00:00.000Z' };
  for (const [name, holding] of [['an object with a dead pid', dead], ['the boolean of 0.18.0', true]]) {
    const root = heldRoot({ held: true, holding });
    const loaded = jsonOf(doNext(root, [], { load: 95 }).stdout);
    assert.deepEqual(loaded.actions.map((x) => [x.change, x.kind]), [['a', 'hold']], `${name}: a new watch is asked for`);
    const below = jsonOf(doNext(root, [], { load: 40 }).stdout);
    assert.deepEqual(below.actions.map((x) => [x.change, x.kind]), [['a', 'start']], `${name}: the held change starts`);
  }
  const alive = heldRoot({ held: true, holding: { pid: process.pid, at: '2026-11-21T10:00:00.000Z' } });
  assert.deepEqual(jsonOf(doNext(alive, [], { load: 95 }).stdout).actions, [], 'a watch still running: no second watch');
});

test('followups AC-7 hold: a killed hold process leaves a mark the next next does not trust', async () => {
  const root = heldRoot();
  const child = spawn(process.execPath, [LOOP_FILE, 'hold', '--lang', 'en', '--load-limit', '1', '--interval', '5'], { cwd: root, env: cleanEnv, stdio: 'ignore' });
  const ended = new Promise((resolve) => { child.on('exit', resolve); });
  try {
    let named = false;
    for (let i = 0; i < 80 && !named; i++) {
      await new Promise((resolve) => { setTimeout(resolve, 50); });
      named = stateOf(root).holding?.pid === child.pid;
    }
    assert.ok(named, 'the run file names the pid of the hold');
  } finally {
    child.kill('SIGKILL');
    await ended;
  }
  assert.equal(stateOf(root).holding?.pid, child.pid, 'a killed process cleared nothing');
  assert.deepEqual(jsonOf(doNext(root, [], { load: 95 }).stdout).actions.map((x) => x.kind), ['hold']);
  assert.deepEqual(jsonOf(doNext(root, [], { load: 40 }).stdout).actions.map((x) => x.kind), ['start']);
});

test('followups AC-7 lock stop: a held start whose watch process ended is refused once, naming the watch to start', () => {
  const lkRoot = (holding) => { const root = lkProject(['[ ] a'], {}); putRun(root, { places: 1, held: true, holding }); return root; };
  for (const [name, holding] of [['a dead pid', { pid: deadPid(), at: '2026-11-21T10:00:00.000Z' }], ['the boolean of 0.18.0', true]]) {
    const root = lkRoot(holding);
    withTmp(() => {
      const opts = { opts: { load: () => 95 } };
      const first = stopOf(root, lkRun(1), opts).d;
      assert.deepEqual([first.decision, first.change], ['refuse', 'a'], name);
      assert.match(first.reason, /watch it with hold/, name);
    });
  }
  const alive = lkRoot({ pid: process.pid, at: '2026-11-21T10:00:00.000Z' });
  assert.equal(stopOf(alive, lkRun(1), { opts: { load: () => 95 } }).d.decision, 'allow', 'a watch still running lets the stop through');
});

test('followups AC-10 run: run without --session exits 3 and writes no run file', () => {
  const root = projectWith(roadmapText('[ ] a'));
  const r = cmd(root, ['run', ...FLAGS], { stdin: '2' });
  assert.equal(r.code, 3, r.stdout);
  assert.match(r.stderr, /run needs --session/);
  assert.equal(existsSync(runFileOf(root)), false, 'no run file');
});

test('followups AC-10 lock: updateRun on a held lock throws RunFileBusy after its wait, without sleeping for real', () => {
  const root = heldRoot();
  const lock = lockFileOf(root);
  writeFileSync(lock, '');
  const sleeps = [];
  assert.throws(() => loopModule.updateRun(runFileOf(root), (run) => run, { sleep: (ms) => { sleeps.push(ms); } }), loopModule.RunFileBusy);
  assert.equal(sleeps.reduce((a, b) => a + b, 0), loopModule.LOCK.waitMs, 'the sleeps add up to the wait');
  assert.equal(existsSync(lock), true, 'the other holder\'s lock is untouched');
});

test('followups AC-10 lock: next on a held run file lock exits 3 and leaves the file as it was', () => {
  const root = heldRoot();
  addOpen(root, 'a');
  writeFileSync(lockFileOf(root), '');
  const raw = readFileSync(runFileOf(root), 'utf8');
  const sleeps = [];
  const r = doNext(root, [], { lockSleep: (ms) => { sleeps.push(ms); } });
  assert.equal(r.code, 3, r.stdout);
  assert.match(r.stderr, /the run file is locked by another call/);
  assert.equal(sleeps.reduce((a, b) => a + b, 0), loopModule.LOCK.waitMs, 'it waited through the injected sleep');
  assert.equal(readFileSync(runFileOf(root), 'utf8'), raw);
});

test('followups AC-10 draft: an unknown files\' language writes the draft in English', () => {
  const root = gitRepo({ config: 'schema: devkit\ndevkit:\n  language: fr\n' });
  put(root, { 'openspec/changes/one/.openspec.yaml': 'schema: devkit\n' });
  commitAll(root, 'one');
  const r = cmd(root, ['draft', '--lang', 'pt-BR', '--load-limit', '80']);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.stdout, `${render('pt-BR', 'roadmap-drafted', { list: 'one' })}\n`, 'the reply is in the person\'s language');
  assert.equal(readFileSync(join(root, 'openspec', 'roadmap.md'), 'utf8'), '# Roadmap\n\n## Round 1: unfinished changes\n\n- [ ] one\n');
});

test('followups AC-10 guard: an edit and a shell write in a roadmap run read the transcript once', () => {
  const root = lkProject(['[ ] a'], { a: { have: UP_TO_READINESS } });
  for (const [mode, input] of [
    ['edit', (t) => lkEdit(root, 'src/a.ts', t)],
    ['bash', (t) => lkBash(root, 'echo x > src/a.ts', t)],
  ]) {
    const transcript = lkRun(2);
    const spy = readCounter();
    const r = lkHook(mode, input(transcript), { TMPDIR: lkSandbox(), ...spy.env(transcript) });
    assert.equal(r.code, 2, `${mode}: ${r.err}`);
    assert.equal(spy.reads(), 1, `${mode}: the transcript is read once`);
  }
});

// ================================================================ roadmap-coordinator-followups, phase 2: the arguments, start anyway, the board

test('followups F-1 run: the arguments as typed start the run on the first call', () => {
  const roadmap = roadmapText('[ ] a', '[ ] b', '[ ] c');
  for (const [typed, marker, places] of [['roadmap 2', 'devkit-roadmap: 2', 2], ['Roadmap 3', 'devkit-roadmap: 3', 3], ['roadmap', 'devkit-roadmap: 1', 1], ['roadmap\n', 'devkit-roadmap: 1', 1], ['2', 'devkit-roadmap: 2', 2]]) {
    const root = projectWith(roadmap);
    const r = doRun(root, typed);
    assert.equal(r.code, 0, `${typed}: ${r.stdout}`);
    assert.equal(r.stdout.split('\n')[0], marker, typed);
    assert.equal(stateOf(root).places, places, typed);
  }
  // `roadmap many` is answered by name, nothing written.
  const many = projectWith(roadmap);
  const refused = doRun(many, 'roadmap many');
  assert.deepEqual([refused.code, refused.stdout], [0, `${render('en', 'roadmap-invalid', { word: 'many' })}\n`]);
  assert.equal(existsSync(runFileOf(many)), false);
  // `roadmap roadmap` drops one word only: the second is the invalid word.
  assert.equal(doRun(projectWith(roadmap), 'roadmap roadmap').stdout, `${render('en', 'roadmap-invalid', { word: 'roadmap' })}\n`);
  // `ROADMAP stop` after a run stops it.
  const run = projectWith(roadmap);
  doRun(run, 'roadmap 2');
  const stopped = doRun(run, 'ROADMAP stop');
  assert.equal(stopped.stdout.split('\n')[0], 'devkit-roadmap: stop');
  assert.equal(stateOf(run).stopping, true);
  // The parser itself.
  assert.deepEqual(loopModule.parseRunInput('roadmap 2'), { kind: 'places', places: 2 });
  assert.deepEqual(loopModule.parseRunInput('roadmap'), { kind: 'places', places: 1 });
  assert.deepEqual(loopModule.parseRunInput('ROADMAP stop'), { kind: 'stop' });
  assert.deepEqual(loopModule.parseRunInput('roadmap many'), { kind: 'invalid', word: 'many' });
  assert.deepEqual(loopModule.parseRunInput('2'), { kind: 'places', places: 2 });
  assert.deepEqual(loopModule.parseRunInput(undefined), { kind: 'places', places: 1 });
});

test('followups F-2 decide: start anyway starts the held changes once', () => {
  const lines = ['[ ] a', '[ ] b'];
  const held = decideRoadmap(world({ lines, places: 2, load: 95, limit: 80 }));
  assert.deepEqual(changesOf(held), [['a', 'hold']]);
  const anyway = decideRoadmap(world({ lines, places: 2, load: 95, limit: 80, startAnyway: true }));
  assert.deepEqual(changesOf(anyway), [['a', 'start'], ['b', 'start']], 'both held changes start whatever the load');
  assert.deepEqual(anyway.lines, [], 'no hold line is shown');
  assert.equal(anyway.state.held, false, 'the next hold is said again');
  assert.deepEqual(anyway.state.starting, ['a', 'b']);
  // Only the places that are free: the rest stays in the queue.
  assert.deepEqual(changesOf(decideRoadmap(world({ lines: [...lines, '[ ] c'], places: 2, load: 95, limit: 80, startAnyway: true }))), [['a', 'start'], ['b', 'start']]);
  // A start never goes past the stop.
  assert.deepEqual(changesOf(decideRoadmap(world({ lines, places: 2, load: 95, limit: 80, startAnyway: true, stopping: true }))), []);
});

test('followups AC-8 next: start anyway starts what is held now, and a change ready later is held and said again', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  putRun(root, { places: 3, placed: {} });
  const before = Object.keys(stateOf(root)).sort();
  const first = doNext(root, ['--start-anyway'], { load: 95 });
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(jsonOf(first.stdout).actions.map((x) => [x.change, x.kind]), [['a', 'start'], ['b', 'start']]);
  assert.ok(!events(first.stdout).some((l) => l.includes('machine is loaded')), 'no line about the hold');
  // Invariant: a --start-anyway on a run without a session per change keeps no permission in the run file. Layer: the roadmap-loop start-anyway. Suite: roadmap-loop.
  const UPFRONT = ['tickets', 'occupied', 'queued', 'anyway', 'waits', 'cron', 'check']; // the fields of roadmap-sessions-upfront, written empty by every run
  assert.deepEqual(Object.keys(stateOf(root)).filter((k) => k !== 'updatedAt' && !UPFRONT.includes(k)).sort(), before, 'the run file gains no field but the time of its write and the empty fields of ADR 0021');
  assert.deepEqual(stateOf(root).anyway, [], 'nothing keeps the permission');
  // Later in the same run: a and b are open, c is ready, a place is free, the load is still high, and the call has no flag.
  addOpen(root, 'a');
  addOpen(root, 'b');
  writeFileSync(join(root, 'openspec', 'roadmap.md'), roadmapText('[ ] a', '[ ] b', '[ ] c'));
  const later = doNext(root, [], { load: 95 });
  assert.ok(jsonOf(later.stdout).actions.some((x) => x.change === 'c' && x.kind === 'hold'), 'c is held');
  assert.ok(events(later.stdout).includes(`▸ ${render('en', 'roadmap-held', { id: 'c', load: 95, limit: 80 })}`), 'its hold line is shown again');
  // The hold line ends with the start-anyway sentence, in both languages.
  assert.match(render('en', 'roadmap-held', { id: 'c', load: 95, limit: 80 }), /Tell me to start anyway and it starts now\.$/);
  assert.match(render('pt-BR', 'roadmap-held', { id: 'c', load: 95, limit: 80 }), /Se quiser começar mesmo assim, é só dizer\.$/);
  // Only `next` takes the flag.
  assert.equal(cmd(root, ['status', ...FLAGS, '--start-anyway']).code, 3);
});

test('followups AC-1 status: a ready line waits for a place only when the places are taken', () => {
  const lines = ['[ ] d', '[ ] a', '[ ] b', '[ ] c'];
  const text = boardOf(world({ lines, places: 3, load: 10, actions: { d: agentAct('d') } }));
  assert.match(text, /a {3}ready to start\n/);
  assert.match(text, /b {3}ready to start\n/);
  assert.match(text, /c {3}ready, waits for a place$/);
  assert.doesNotMatch(text, /Starts held|held by the load/);
  const pt = boardOf(world({ lang: 'pt-BR', lines, places: 3, load: 10, actions: { d: agentAct('d') } }));
  assert.match(pt, /a {3}pronta para começar\n/);
  assert.match(pt, /c {3}pronta, espera vaga$/);
  // Every place taken: waits for a place whatever the load.
  for (const load of [10, 95]) assert.match(boardOf(world({ lines: ['[ ] d', '[ ] a'], places: 1, load, actions: { d: agentAct('d') } })), /a {3}ready, waits for a place$/, `load ${load}`);
  // A free place and a loaded machine: the load holds both.
  const loaded = boardOf(world({ lines: ['[ ] a', '[ ] b'], places: 2, load: 92 }));
  assert.match(loaded, /Starts held/);
  assert.match(loaded, /a {3}ready, held by the load\n/);
  assert.match(loaded, /b {3}ready, held by the load$/);
});

test('followups AC-2 decide: a gate or blocked line says the others go on only when another change is under way', () => {
  const ceiling = (id) => blockedAct(id, 'ceiling', { stage: 'Plan readiness', attempt: 3 });
  const gateLine = (r) => r.lines.find((l) => /waits for|espera/.test(l));
  const blockedLine = (r) => r.lines.find((l) => /stopped|parou/.test(l));
  const announced = { a: 'started', b: 'started' };
  const alone = decideRoadmap(world({ lines: ['[ ] a'], actions: { a: ownerAct('a') }, announced }));
  assert.equal(gateLine(alone), say('roadmap-gate', { id: 'a', gate: 'approval' }));
  assert.doesNotMatch(gateLine(alone), /others go on/);
  const aloneBlocked = decideRoadmap(world({ lines: ['[ ] a'], actions: { a: ceiling('a') }, announced }));
  assert.equal(blockedLine(aloneBlocked), say('roadmap-blocked', { id: 'a', why: 'ceiling', stage: 'Plan readiness', attempt: 3 }));
  assert.doesNotMatch(blockedLine(aloneBlocked), /others go on/);
  assert.match(blockedLine(aloneBlocked), /The changes after it wait\.$/);
  // Another change under way: a stage handed, a stage in flight, a wait on GitHub, a start.
  const others = [
    ['a stage handed', { lines: ['[ ] a', '[ ] b'], actions: (own) => ({ a: own, b: agentAct('b') }) }],
    ['a stage in flight', { lines: ['[ ] a', '[ ] b'], actions: (own) => ({ a: own, b: agentAct('b') }), inflight: { b: FLYING } }],
    ['a wait', { lines: ['[ ] a', '[ ] b'], actions: (own) => ({ a: own, b: githubAct('b') }) }],
    ['a start', { lines: ['[ ] a', '[ ] b'], places: 2, actions: (own) => ({ a: own }) }],
  ];
  for (const [name, { actions, ...rest }] of others) {
    const gate = decideRoadmap(world({ ...rest, actions: actions(ownerAct('a')), announced }));
    assert.equal(gateLine(gate), say('roadmap-gate-others', { id: 'a', gate: 'approval' }), name);
    assert.match(gateLine(gate), /The others go on\.$/, name);
    const blocked = decideRoadmap(world({ ...rest, actions: actions(ceiling('a')), announced }));
    assert.equal(blockedLine(blocked), say('roadmap-blocked-others', { id: 'a', why: 'ceiling', stage: 'Plan readiness', attempt: 3 }), name);
    assert.match(blockedLine(blocked), /The others go on, and the changes after it wait\.$/, name);
    assert.equal(blocked.state.announced.a, 'blocked:ceiling', `${name}: the announced key does not change`);
  }
  // The same state is still said once.
  const first = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a'), b: agentAct('b') }, announced }));
  assert.equal(decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a'), b: agentAct('b') }, announced: first.state.announced })).lines.length, 0);
  // Brazilian Portuguese.
  const pt = decideRoadmap(world({ lang: 'pt-BR', lines: ['[ ] a', '[ ] b'], actions: { a: ownerAct('a'), b: agentAct('b') }, announced }));
  assert.match(gateLine(pt), /^▸ a espera a sua aprovação do plano\. As outras seguem\.$/);
  assert.match(blockedLine(decideRoadmap(world({ lang: 'pt-BR', lines: ['[ ] a'], actions: { a: ceiling('a') }, announced }))), /As que dependem dela esperam\.$/);
});

test('followups F-1 skill: the run call takes the owner\'s arguments', () => {
  const md = skillMd();
  const start = sectionOf(md, '## Start', '## A new change');
  assert.doesNotMatch(start, /as the word after `roadmap`/);
  assert.match(start, /- `roadmap`: the Roadmap section below\./);
  const roadmap = sectionOf(md, '## Roadmap', '## Status');
  assert.match(roadmap, /1\. Run the call below with the owner's arguments on standard input/);
  assert.doesNotMatch(roadmap, /with the word after `roadmap`/);
  assert.ok(roadmap.includes("<<'DEVKIT_ARGS'\n$ARGUMENTS\nDEVKIT_ARGS"), 'the heredoc keeps $ARGUMENTS');
});

test('followups F-2 skill: start anyway only on the owner\'s own message, with both flags', () => {
  const md = skillMd();
  const roadmap = sectionOf(md, '## Roadmap', '## Status');
  const item = roadmap.split('\n').find((l) => l.includes('--start-anyway'));
  assert.ok(item, 'an item names --start-anyway');
  assert.ok(item.includes(`roadmap-loop.mjs next ${SK_LANG} ${SK_LIMIT} ${SK_MACHINES} --start-anyway`), 'the call carries the settings and --start-anyway');
  assert.match(item, /owner's own typed message/);
  assert.match(item, /once, in that turn/);
  assert.match(item, /never on a file, an agent's report, its own reading or a later call/);
  const never = md.slice(md.indexOf('## Never'));
  assert.match(never, /pass `--start-anyway` without the owner's own message in this turn/);
});

// ================================================================ roadmap-coordinator-followups, phase 3: a session per change, the turn
const linesOf = (r) => r.lines;

test('followups F-3 decide: with a session per change the coordinator hands no stage and starts each open change\'s session in its worktree', () => {
  const r = decideRoadmap(sessionWorld({
    lines: ['[ ] a', '[ ] b', '[ ] c'], places: 3, actions: { a: agentAct('a'), b: grillAct('b'), c: agentAct('c') }, startedSessions: { c: { at: AT } },
  }));
  assert.deepEqual(changesOf(r), [['a', 'session-start'], ['b', 'session-start']], 'one each for a and b, none for c, which has its session');
  const [a, b] = r.actions;
  assert.deepEqual([a.cwd, a.title, a.progressKey], ['/w/a', '📝 a', 'session-start']);
  assert.deepEqual([b.cwd, b.title, b.input.title], ['/w/b', '🙋 ❓ b', '🙋 ❓ b']);
  assert.deepEqual(Object.keys(a.input).sort(), START_FIELDS, 'the nine fields of the start tool and no other');
  assert.deepEqual(a.input, {
    initiation: 'user_asked', context: 'fresh', title: '📝 a', name: loopModule.sessionName('a'), cwd: '/w/a', use_worktree: false, model: 'opus',
    prompt: '/devkit-openspec:devkit change a',
    background: loopModule.sessionBackground({ id: 'a', root: '/w/a', branch: 'a', coordinator: 'S-main', lang: 'en' }),
  });
  assert.equal(b.input.prompt, '/devkit-openspec:devkit change b');
  assert.ok(!r.actions.some((x) => ['agent', 'session', 'wait'].includes(x.kind)), 'no stage, step or wait is handed');
  // Invariant: the coordinating session hands no stage and gives each start its exact input. Layer: decideRoadmap. Suite: roadmap-loop.
  // The grill of a change is asked here (roadmap-sessions-upfront D-3, D-13 T-1), so `ask` is b's grill and not null.
  assert.deepEqual([r.ask.change, r.ask.kind, r.ask.gate], ['b', 'grill', 'grill'], 'b\'s grill is asked in this session');
  assert.deepEqual(linesOf(r), [], 'no gate line and no started line');
  assert.deepEqual(r.state.sessionsStarted, []);
  // The same facts without the mode keep the stages here, as before.
  const plainRun = decideRoadmap(world({ lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: agentAct('a'), b: grillAct('b') } }));
  assert.deepEqual(changesOf(plainRun), [['a', 'agent']]);
  assert.equal(plainRun.ask.change, 'b');
});

test('followups AC-13 name: sessionName gives the start\'s name, [a-z0-9-] and at most 24 characters', () => {
  assert.equal(loopModule.sessionName('roadmap-coordinator-followups'), 'roadmap-coordinator-foll');
  assert.equal(loopModule.sessionName('A_b.c'), 'a-b-c');
  assert.equal(loopModule.sessionName('___'), 'change');
  assert.equal(loopModule.sessionName('x'.repeat(40)), 'x'.repeat(24));
  assert.equal(loopModule.sessionName('abcdefghijklmnopqrstuvw-xyz'), 'abcdefghijklmnopqrstuvw', 'a dash left at the cut is removed');
  for (const id of ['a', 'roadmap-coordinator-followups', 'A_b.c', '9.x', 'x'.repeat(60)]) assert.match(loopModule.sessionName(id), /^[a-z0-9]([a-z0-9-]{0,22}[a-z0-9])?$/, id);
});

test('followups AC-13 run: --change-sessions is recorded, and a run without it keeps the stages in the session', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const plainRun = doRun(root, 'roadmap');
  assert.deepEqual([stateOf(root).changeSessions, stateOf(root).turn], [false, 'typed']);
  assert.deepEqual(jsonOf(plainRun.stdout).actions, [], 'the grill is asked here, nothing is handed');
  assert.equal(jsonOf(plainRun.stdout).ask.change, 'a');
  const sessions = doRun(root, 'roadmap', { extra: ['--change-sessions'] });
  assert.equal(sessions.code, 0, sessions.stdout);
  assert.equal(stateOf(root).changeSessions, true);
  const j = jsonOf(sessions.stdout);
  assert.deepEqual(j.actions.map((x) => [x.change, x.kind]), [['a', 'session-start']]);
  // Invariant: the mode is recorded by `run` and a later run without it goes back. Layer: run command. Suite: roadmap-loop.
  // a's grill is asked in this session in a run with a session per change (roadmap-sessions-upfront D-13 T-2): `ask` is no longer null.
  assert.deepEqual([j.ask.change, j.ask.kind], ['a', 'grill']);
  assert.equal(j.actions[0].cwd, realpathSync(root));
  // A stop leaves the mode as it was, and a later run without the flag goes back to the stages in the session.
  doRun(root, 'stop');
  assert.equal(stateOf(root).changeSessions, true);
  doRun(root, 'roadmap');
  assert.equal(stateOf(root).changeSessions, false);
});

test('followups AC-13 run: a run from another session keeps the started change sessions and gives them no second session, and --fresh forgets them', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { session: 'S1', places: 1, changeSessions: true, startedSessions: { a: { at: AT } }, turn: 'typed', announced: { a: 'session' } });
  const other = doRun(root, 'roadmap', { session: 'S2', extra: ['--change-sessions'] });
  assert.equal(other.code, 0, other.stdout);
  assert.equal(stateOf(root).session, 'S2');
  assert.deepEqual(stateOf(root).startedSessions, { a: { at: AT } }, 'kept');
  // Invariant: a new coordinating session keeps only what outlives it. Layer: run command. Suite: roadmap-loop (D-13 T-13): the run's own decision announces a's grill gate.
  assert.deepEqual(stateOf(root).announced, { a: 'gate:grill' }, 'everything else starts empty');
  assert.deepEqual(jsonOf(other.stdout).actions, [], 'a is not given a second session');
  const fresh = doRun(root, 'roadmap', { session: 'S2', extra: ['--change-sessions', '--fresh'] });
  assert.deepEqual(stateOf(root).startedSessions, {}, '--fresh forgets them');
  assert.deepEqual(jsonOf(fresh.stdout).actions.map((x) => [x.change, x.kind]), [['a', 'session-start']]);
});

test('followups AC-13 next: a reported session start is recorded once, said once and never started again, and a change no longer open leaves the record', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  addOpen(root, 'a');
  putRun(root, { places: 2, changeSessions: true, turn: 'typed', startedSessions: { gone: { at: AT } } });
  const first = doNext(root, ['--turn', 'typed', '--after', 'a=session-start']);
  assert.equal(first.code, 0, first.stdout);
  // Invariant: a reported session start is recorded once, said once and never started again. Layer: next command. Suite: roadmap-loop (D-13 T-12): the line has no count, and a's grill gate is said here.
  assert.deepEqual(events(first.stdout).slice(0, 2), [say('roadmap-session-opened', { id: 'a' }), say('roadmap-gate', { id: 'a', gate: 'grill' })], events(first.stdout).join('|'));
  assert.equal(typeof stateOf(root).startedSessions.a.at, 'string');
  assert.equal('gone' in stateOf(root).startedSessions, false, 'a change that is not an open line leaves the record');
  assert.deepEqual(jsonOf(first.stdout).actions.map((x) => [x.change, x.kind]), [['b', 'start']], 'only the ready line starts; a gets no second session');
  const again = doNext(root, ['--turn', 'typed']);
  assert.deepEqual(events(again.stdout), [], 'said once');
  assert.ok(!jsonOf(again.stdout).actions.some((x) => x.change === 'a'));
  assert.deepEqual(Object.keys(stateOf(root).startedSessions), ['a']);
});

test('followups AC-13 decide: a change in its own session counts as under way for the end of the run, and a stop ends the run with each change staying in its session', () => {
  const facts = (over = {}) => sessionWorld({ lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: null, b: null }, startedSessions: { a: { at: AT }, b: { at: AT } }, announced: { a: 'session', b: 'session' }, wheres: { a: 'plan', b: 'code' }, ...over });
  const running = decideRoadmap(facts());
  assert.deepEqual([running.end, running.actions, running.open], [null, [], ['a', 'b']]);
  const stopped = decideRoadmap(facts({ stopping: true }));
  assert.equal(stopped.end.why, 'stopped');
  assert.equal(stopped.end.reply, [render('en', 'roadmap-ended-stopped'), render('en', 'roadmap-stayed', { id: 'a', where: 'plan' }), render('en', 'roadmap-stayed', { id: 'b', where: 'code' })].join('\n'));
  assert.deepEqual(stopped.actions, [], 'no session is started');
});

test('followups AC-13 decide: a change archived in its session frees its place, and on the event turn its report starts, the next ready line gets its line and waits for the owner\'s next message', () => {
  const facts = (turn, announced = { a: 'session' }) => sessionWorld({ lines: ['[ ] a', '[ ] c'], archived: ['a'], places: 1, turn, announced, startedSessions: { a: { at: AT } } });
  const event = decideRoadmap(facts('event'));
  assert.deepEqual(event.lines, [say('roadmap-archived', { id: 'a' }), say('roadmap-waits-turn', { id: 'c' })]);
  assert.deepEqual(event.actions, [], 'c is not opened on that turn');
  assert.deepEqual(event.state.starting, []);
  assert.equal(event.end, null, 'a change waiting for the owner\'s next message is not the end of the run');
  assert.deepEqual(decideRoadmap(facts('event', event.state.announced)).lines, [], 'said once');
  const typed = decideRoadmap(facts('typed', event.state.announced));
  assert.deepEqual(changesOf(typed), [['c', 'start']], 'the owner\'s next message starts it');
  assert.deepEqual(typed.state.starting, ['c']);
});

test('followups AC-13 background: the brief names the change, its worktree and branch, the coordinating session, the person\'s language, the title rule and the archive line, and has at least 80 characters', () => {
  const text = loopModule.sessionBackground({ id: 'a-change', root: '/w/a-change', branch: 'a-change-branch', coordinator: 'S-main', lang: 'pt-BR' });
  for (const part of ['`a-change`', '/w/a-change', 'a-change-branch', 'S-main', 'pt-BR', '`sessionTitle`', 'devkit roadmap: a-change archived', 'a session of its own', 'who started this session',
    'devkit-openspec:devkit-session', 'with no message from the owner', 'asked in the session that started this one']) {
    assert.ok(text.includes(part), `names ${part}`);
  }
  assert.ok(text.length >= 80);
  assert.ok(loopModule.sessionBackground({ id: 'x', root: '/', branch: 'x', coordinator: null, lang: 'en' }).length >= 80, 'also for the smallest input');
});

test('followups AC-13 lock agent: in a run with a session per change every hand-off of the coordinating session is refused and nothing is marked under way', () => {
  const root = lkProject(['[ ] a'], { a: {} });
  putRun(root, { places: 1, changeSessions: true });
  const transcript = lkRun(1);
  const d = agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF('a')));
  assert.deepEqual([d.decision, d.why, d.change], ['refuse', 'own-sessions', 'a']);
  assert.match(d.reason, /each change runs in a session of its own: its stages are handed in that session, not here/);
  assert.deepEqual(stateOf(root).inflight, {}, 'nothing is marked under way');
  assert.equal(agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, 'do it')).why, 'own-sessions', 'with no brief too');
  const sub = agentOf({ ...lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF('a')), agent_type: PLANNER_TYPE });
  assert.deepEqual([sub.decision, sub.why], ['allow', 'subagent'], 'a subagent\'s own hand-off is let through');
  putRun(root, { places: 1 });
  assert.equal(agentOf(lkAgentInput(root, transcript, PLANNER_TYPE, BRIEF('a'))).decision, 'allow', 'without the mode the hand-off is allowed as before');
});

test('followups AC-13 lock stop: a change session to start on a typed turn is refused once, and every change in its own session lets the stop through', () => {
  const root = lkProject(['[ ] a', '[ ] b'], { a: {}, b: {} });
  putRun(root, { places: 2, changeSessions: true, turn: 'typed', startedSessions: { a: { at: AT } } });
  const transcript = lkRun(2);
  withTmp(() => {
    const first = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([first.decision, first.why, first.change], ['refuse', 'stage-ready', 'b']);
    assert.match(first.reason, /the change b has no session of its own yet: start it/);
    assert.deepEqual(loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts()).why, 'same-state', 'once');
  });
  putRun(root, { places: 2, changeSessions: true, turn: 'typed', startedSessions: { a: { at: AT }, b: { at: AT } } });
  withTmp((tmp) => {
    const d = loopModule.roadmapStopDecision(lkStopInput(root, transcript), lkOpts());
    assert.deepEqual([d.decision, d.why], ['allow', 'nothing-ready'], 'every change in its own session');
    nothingRecorded(tmp);
  });
});

test('followups AC-15 decide: on a turn nobody typed a start and a session start become one line each, said once, and on the owner\'s next turn they start', () => {
  const facts = (turn, announced = {}) => sessionWorld({ lines: ['[ ] a', '[ ] b'], places: 3, turn, announced, actions: { a: grillAct('a') } });
  const typed = decideRoadmap(facts('typed'));
  assert.deepEqual(changesOf(typed), [['a', 'session-start'], ['b', 'start']]);
  assert.equal(typed.state.turn, 'typed');
  const event = decideRoadmap(facts('event'));
  assert.deepEqual(event.actions, [], 'neither is carried out');
  assert.deepEqual(event.lines, [say('roadmap-waits-turn', { id: 'a' }), say('roadmap-waits-turn', { id: 'b' })]);
  assert.deepEqual([event.state.turn, event.state.starting, event.state.announced], ['event', [], { a: 'waits-turn', b: 'waits-turn' }], 'a withheld start is not recorded as handed');
  assert.deepEqual(decideRoadmap(facts('event', event.state.announced)).lines, [], 'said once');
  const next = decideRoadmap(facts('typed', event.state.announced));
  assert.deepEqual(changesOf(next), [['a', 'session-start'], ['b', 'start']], 'the owner\'s next turn starts them');
  assert.deepEqual(next.lines, []);
  assert.match(say('roadmap-waits-turn', { id: 'a' }, 'pt-BR'), /^▸ a está pronta e começa numa sessão própria na sua próxima mensagem: o app só abre sessão num turno que você digitou\.$/);
  // In a run that keeps the stages in this session, the turn changes nothing.
  assert.deepEqual(changesOf(decideRoadmap(world({ lines: ['[ ] a'], places: 1, turn: 'event' }))), [['a', 'start']]);
});

test('followups AC-15 decide: the load eases on a turn nobody typed and the held change waits for the owner\'s next message with its line', () => {
  // Invariant: a start in session mode happens only on a typed turn and never without a line. Layer: decideRoadmap. Suite: roadmap-loop.
  // In a run with a session per change the load holds a place, not an opening (roadmap-sessions-upfront D-2, D-13 T-4): no `hold` action, the pending line is
  // withheld with its line on the turn nobody typed, and started on the typed one whatever the load.
  const facts = (over) => sessionWorld({ lines: ['[ ] a'], places: 1, turn: 'event', ...over });
  const loaded = decideRoadmap(facts({ load: 95, limit: 80 }));
  assert.deepEqual(loaded.actions, [], 'no hold action: the load holds no opening');
  assert.deepEqual(loaded.lines, [say('roadmap-waits-turn', { id: 'a' })]);
  const eased = decideRoadmap(facts({ load: 40, limit: 80, held: true, holding: false }));
  assert.deepEqual(eased.actions, []);
  assert.deepEqual(eased.lines, [say('roadmap-waits-turn', { id: 'a' })]);
  assert.equal(eased.state.held, false);
  assert.match(eased.lines[0], /the app starts a session only on a turn you typed/);
  assert.deepEqual(changesOf(decideRoadmap(facts({ load: 40, limit: 80, held: true, holding: false, turn: 'typed' }))), [['a', 'start']], 'the owner\'s message starts it');
  assert.deepEqual(changesOf(decideRoadmap(facts({ load: 95, limit: 80, turn: 'typed' }))), [['a', 'start']], 'and the load does not hold it');
});

test('followups AC-15 next: a refused session start gives its line, records the turn as event and asks for no other start on that turn', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  addOpen(root, 'a');
  putRun(root, { places: 2, changeSessions: true, turn: 'typed' });
  const r = doNext(root, ['--turn', 'typed', '--after', 'a=session-refused']);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(events(r.stdout), [say('roadmap-waits-refused', { id: 'a' }), say('roadmap-waits-turn', { id: 'b' })]);
  assert.deepEqual(jsonOf(r.stdout).actions, [], 'no session start and no start on that turn');
  const state = stateOf(root);
  assert.deepEqual([state.turn, state.announced.a, state.announced.b, state.startedSessions], ['event', 'waits-refused', 'waits-turn', {}]);
  assert.deepEqual(events(doNext(root, ['--turn', 'event']).stdout), [], 'said once');
  assert.match(say('roadmap-waits-refused', { id: 'a' }, 'pt-BR'), /^▸ a não pôde começar numa sessão própria: o app recusou\. Ela começa na sua próxima mensagem\.$/);
});

test('followups AC-15 next: a start that gave no session id is reported as session-refused, the line shows once and the change starts on the owner\'s next typed turn', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  putRun(root, { places: 1, changeSessions: true, turn: 'typed' });
  // The key is the outcome of the call, never its text: the skill reports every result but a session id.
  const skill = readFileSync(new URL('../skills/devkit/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('when the call returns anything but a session id (a refusal of any wording, an error or a missing tool)'), 'the skill keys the refusal on the outcome of the call');
  const refused = doNext(root, ['--turn', 'event', '--after', 'a=session-refused']);
  assert.equal(refused.code, 0, refused.stdout);
  assert.deepEqual(events(refused.stdout), [say('roadmap-waits-refused', { id: 'a' })]);
  assert.deepEqual(jsonOf(refused.stdout).actions, [], 'nothing starts on the refused turn');
  assert.equal(stateOf(root).announced.a, 'waits-refused');
  const again = doNext(root, ['--turn', 'event']);
  assert.deepEqual([events(again.stdout), jsonOf(again.stdout).actions], [[], []], 'said once, still waiting for a typed turn');
  const typed = doNext(root, ['--turn', 'typed']);
  assert.equal(typed.code, 0, typed.stdout);
  assert.deepEqual(changesOf(jsonOf(typed.stdout)), [['a', 'session-start']], 'the owner\'s typed message starts it');
});

test('followups AC-15 next: --turn takes typed or event, refuses any other word (message and an empty word included) with exit 3 and the run file\'s bytes unchanged, and no --turn reads as event', () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { places: 1, changeSessions: true, turn: 'typed' });
  const raw = readFileSync(runFileOf(root), 'utf8');
  for (const word of ['message', '', 'Typed', 'both']) {
    const r = doNext(root, ['--turn', word]);
    assert.equal(r.code, 3, `${JSON.stringify(word)}: ${r.stdout}`);
    assert.ok(r.stderr.includes(`--turn takes typed or event: got ${word}`), r.stderr);
    assert.equal(readFileSync(runFileOf(root), 'utf8'), raw, `${JSON.stringify(word)}: the run file's bytes are unchanged`);
  }
  const none = doNext(root);
  assert.equal(none.code, 0, none.stdout);
  assert.deepEqual(jsonOf(none.stdout).actions, [], 'no start without a typed turn');
  assert.deepEqual(events(none.stdout), [say('roadmap-waits-turn', { id: 'a' })]);
  assert.equal(stateOf(root).turn, 'event');
  const typed = doNext(root, ['--turn', 'typed']);
  assert.deepEqual(jsonOf(typed.stdout).actions.map((x) => [x.change, x.kind]), [['a', 'start']]);
  assert.equal(stateOf(root).turn, 'typed');
});

test('followups AC-15 decide: every withheld start has its line in the same decision or an announced one', () => {
  const table = {
    'two ready lines': { lines: ['[ ] a', '[ ] b'], places: 2 },
    'a ready line and an open change at its grill': { lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: grillAct('a') } },
    'open changes at a stage, a gate, a wait and blocked': {
      lines: ['[ ] a', '[ ] b', '[ ] c', '[ ] d', '[ ] e'], places: 5,
      actions: { a: agentAct('a'), b: ownerAct('b'), c: githubAct('c'), d: blockedAct('d', 'ceiling', { stage: 'Plan readiness', attempt: 3 }) },
    },
    'a change in flight from an earlier run': { lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: agentAct('a') }, inflight: { a: FLYING } },
    'a start held by the load, then eased': { lines: ['[ ] a'], places: 1, load: 30, held: true },
  };
  for (const [name, spec] of Object.entries(table)) {
    const typed = decideRoadmap(sessionWorld({ ...spec, turn: 'typed' }));
    const withheld = typed.actions.filter((x) => x.kind === 'start' || x.kind === 'session-start').map((x) => x.change);
    assert.ok(withheld.length > 0, `${name}: the typed turn starts something`);
    const event = decideRoadmap(sessionWorld({ ...spec, turn: 'event' }));
    assert.deepEqual(event.actions.filter((x) => x.kind === 'start' || x.kind === 'session-start'), [], `${name}: nothing starts on a turn nobody typed`);
    for (const id of withheld) {
      assert.ok(event.lines.some((l) => l.includes(` ${id} `) && /next message/.test(l)) && event.state.announced[id] === 'waits-turn', `${name}: ${id} has its line`);
      const again = decideRoadmap(sessionWorld({ ...spec, turn: 'event', announced: event.state.announced }));
      assert.deepEqual(again.lines.filter((l) => /next message/.test(l)), [], `${name}: said once, the state was announced`);
      assert.equal(again.state.announced[id], 'waits-turn', `${name}: ${id} stays announced`);
    }
  }
});

test('followups AC-15 lock stop: after a decision on a turn nobody typed the stop is let through', () => {
  const root = lkProject(['[ ] c'], {});
  putRun(root, { places: 1, changeSessions: true, turn: 'event' });
  withTmp((tmp) => {
    const d = loopModule.roadmapStopDecision(lkStopInput(root, lkRun(1)), lkOpts());
    assert.deepEqual([d.decision, d.why], ['allow', 'nothing-ready'], 'c waits for the owner\'s next message');
    nothingRecorded(tmp);
  });
  putRun(root, { places: 1, changeSessions: true, turn: 'typed' });
  withTmp(() => {
    const d = loopModule.roadmapStopDecision(lkStopInput(root, lkRun(1)), lkOpts());
    assert.deepEqual([d.decision, d.change], ['refuse', 'c'], 'on a typed turn it is ready');
    assert.match(d.reason, /the change c is ready to start: open it/);
  });
});

test('followups AC-15 status: a line left for the owner\'s next message reads so in the queue, and an open change with no session says it starts at the next message', () => {
  const lines = ['[ ] a', '[ ] b', '[ ] c', '[ ] d', '[ ] e'];
  const text = boardOf(sessionWorld({
    lines, places: 5, announced: { a: 'waits-turn', b: 'waits-refused' },
    actions: { c: agentAct('c'), d: ownerAct('d'), e: agentAct('e') }, startedSessions: { d: { at: AT }, e: { at: AT } },
  }));
  assert.match(text, /a {3}ready: starts in a session of its own at your next message\n/);
  assert.match(text, /b {3}ready: starts in a session of its own at your next message(\n|$)/);
  assert.match(text, /c {3}no session of its own yet: it starts at your next message\n/);
  assert.match(text, /Waiting for you\n {2}d {3}your approval of the plan/, 'an own change at its gate shows its gate');
  assert.match(text, /e {3}Proposal/, 'an own change under way shows its stage');
  const pt = boardOf(sessionWorld({ lang: 'pt-BR', lines: ['[ ] a', '[ ] c'], places: 3, announced: { a: 'waits-turn' }, actions: { c: agentAct('c') } }));
  assert.match(pt, /a {3}pronta: começa numa sessão própria na sua próxima mensagem(\n|$)/);
  assert.match(pt, /c {3}ainda sem sessão própria: começa na sua próxima mensagem/);
  // Without the mode the same announced state changes no row.
  assert.match(boardOf(world({ lines: ['[ ] a'], places: 1, announced: { a: 'waits-turn' } })), /a {3}ready to start/);
});

test('followups AC-13 skill: the session-per-change part names the tools, the list check, the session keys and the turn, and hands nothing', () => {
  const md = skillMd();
  const roadmap = sectionOf(md, '## Roadmap', '## Status');
  const first = roadmap.indexOf('### A session per change');
  const second = roadmap.indexOf('### Every change in this session');
  assert.ok(first > 0 && second > first, 'the two parts, in this order');
  const one = roadmap.slice(roadmap.indexOf('1. Run the call below'), first);
  assert.ok(one.includes('select:mcp__ccd_session__start_session'), 'step 1 loads the start tool before run');
  assert.ok(one.includes('`--change-sessions`'), 'and adds the flag when it loads');
  const part = roadmap.slice(first, second);
  assert.doesNotMatch(part, /^5\. /m, 'no item starting 5.');
  for (const text of [
    'select:mcp__ccd_session_mgmt__list_sessions', 'select:mcp__ccd_session__start_session',
    '`mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }`', '`mcp__ccd_session__start_session` with the action\'s `input` exactly as given',
    '`session-start`', '`session-refused`', '`isArchived`', '`cwd`', 'a `title` ending in the change id', 'one session start at a time',
    'devkit roadmap: <id> archived', 'the session hands no stage but the grill\'s triage, asks the grills, the plan approvals and the retro answers, and starts no wait on GitHub',
  ]) assert.ok(part.includes(text), `the part says ${text}`);
  assert.match(part, /end-of-turn report[^\n]*`event` turn/);
  assert.match(part, /--after <id>=session-start/);
  assert.match(part, /--after <id>=session-refused/);
  // The other part keeps today's steps 2 to 5, word for word.
  const every = roadmap.slice(second);
  assert.ok(every.includes('2. With the JSON of `run` or `next`, carry out its `actions` in this order, all in this turn:'));
  assert.ok(every.includes('5. The message that ends a turn holds, in order:'));
  assert.ok(every.includes('Calling `/devkit roadmap` again at any time is safe'));
  assert.doesNotMatch(md, /wake_when_done/, 'no wake field');
  const wake = part.split('\n').filter((l) => /SendMessage/.test(l));
  assert.equal(wake.length, 1, 'the message tool is named on one line only');
  assert.ok(wake[0].startsWith('- `wake`:') && wake[0].includes('select:SendMessage') && wake[0].includes('the action\'s `message` exactly as given'), 'that line is the wake item');
  assert.doesNotMatch(md.replace(wake[0], ''), /SendMessage/, 'no message tool outside the wake item');
  const never = md.slice(md.indexOf('## Never'));
  assert.ok(never.includes('In a run with a session per change: hand a stage, ask a change\'s other gates or start a wait on GitHub from this session, start a change session `next` did not return, call the session-start tool with any input but the action\'s `input`, start a session for a change on another machine the run did not open, send a `wake` message `next` did not return, switch a session\'s model to one `next` did not return, or switch any session up'));
});

test('followups AC-14 skill: a change session renames its title from the sessionTitle of each next', () => {
  const loop = sectionOf(sessionSkillMd(), '## Loop', '## Never');
  const item = loop.split('\n').find((l) => l.includes('mcp__ccd_session_mgmt__set_session_title') && l.includes('sessionTitle'));
  assert.ok(item, 'a Loop item renames the title');
  for (const text of ['select:mcp__ccd_session_mgmt__set_session_title', '`mcp__ccd_session_mgmt__set_session_title` with `session_id` `"self"` and `title` the action\'s `sessionTitle`', 'main thread']) {
    assert.ok(item.includes(text), `the item says ${text}`);
  }
  assert.match(item, /not retried for the same `sessionTitle`/);
  assert.match(item, /before carrying out the action/);
});

test('followups AC-15 skill: the turn\'s two words, event when in doubt or on another session\'s note, and next first on a typed turn', () => {
  const part = sectionOf(skillMd(), '### A session per change', '### Every change in this session');
  const item = part.split('\n').find((l) => l.includes('--turn <typed|event>'));
  assert.ok(item, 'an item names the turn flag');
  assert.ok(item.includes(`roadmap-loop.mjs next ${SK_LANG} ${SK_LIMIT} ${SK_MACHINES} --turn <typed|event>`), 'with the settings');
  assert.match(item, /`typed` when the turn began with the owner's own message/);
  assert.match(item, /`event` otherwise/);
  assert.match(item, /another session's message or end-of-turn report/);
  assert.match(item, /when in doubt/);
  assert.match(part, /on a turn the owner typed[^\n]*--turn typed` before anything else/);
  assert.match(part, /start anyway: [^\n]*item 4a of the second part[^\n]*`--turn typed`/, 'start anyway is a typed turn');
});

// ================================================================ roadmap-coordinator-followups: phase 4 (the ADRs and the documents)

// Invariant (AC-3): every field the run file holds is named in ADR 0013 decision 4, and every field named there is held.
// Layer: the documents against the run file. Suite: this file.
test('followups AC-3 run file: every field the run file holds is named in ADR 0013 decision 4, and every field named there is held', async () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const run = doRun(root, 'roadmap', { extra: ['--change-sessions'] });
  assert.equal(run.code, 0, run.stdout);
  const next = doNext(root, ['--turn', 'typed', '--after', 'a=session-start']);
  assert.equal(next.code, 0, next.stdout);
  const held = await loopModule.runCommand(['hold', ...FLAGS, '--interval', '5'], { cwd: root, env: cleanEnv, load: () => 1, sleep: async () => {} });
  assert.equal(held.code, 0, held.stdout);
  const keys = Object.keys(stateOf(root)).sort();
  assert.ok(keys.includes('holding') && keys.includes('startedSessions') && keys.includes('turn'), keys.join(','));

  const adr = readFileSync(join(HERE, '..', '..', '..', 'docs', 'adr', '0013-the-roadmap-coordinator-is-the-owners-session.md'), 'utf8');
  const decision = adr.slice(adr.indexOf('## Decision'), adr.indexOf('## Consequences'));
  const start = decision.search(/^4\. /m);
  const end = decision.search(/^5\. /m);
  assert.ok(start >= 0 && end > start, 'decision 4 is item 4 of the Decision');
  const named = [...decision.slice(start, end).matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]).sort();
  assert.deepEqual(named, keys, 'the fields named in decision 4 are the fields the run file holds');
});

// Invariant (AC-13, AC-14, AC-15): ADR 0014 is accepted with its six icons, ADRs 0010, 0011 and 0013 carry its Note and
// header line, and the config names it. Layer: the documents. Suite: this file.
test('followups ADR 0014: the documents follow', () => {
  const REPO = join(HERE, '..', '..', '..');
  const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');
  const name = '0014-each-roadmap-change-runs-in-a-session-of-its-own.md';
  const link = `[ADR 0014](${name})`;
  const adr = read('docs', 'adr', name);
  for (const h of ['## Context', '## Decision', '## Consequences', '### Review trigger', '## Alternatives considered']) {
    assert.ok(adr.split('\n').includes(h), `ADR 0014 has ${h}`);
  }
  assert.match(adr, /^- Status: accepted$/m);
  assert.match(adr, /^- Accepted by: .*approval\.md/m);
  assert.match(adr, /^- Supersedes: ADR 0013 \(0013-the-roadmap-coordinator-is-the-owners-session\.md\)/m);
  assert.match(adr, /^- Amends: ADR 0013, decisions 3 and 4; ADR 0011 \(0011-the-change-coordinator-is-the-owners-session\.md\)/m);
  for (const icon of ['❓ requirements', '📝 plan', '🛠️ code', '🔍 review', '🚀 delivery', '📦 archive']) assert.ok(adr.includes(icon), `ADR 0014 names ${icon}`);
  const amended = `- Amended by ADR 0014 (${name})`;
  const adr13 = read('docs', 'adr', '0013-the-roadmap-coordinator-is-the-owners-session.md');
  const adr11 = read('docs', 'adr', '0011-the-change-coordinator-is-the-owners-session.md');
  const adr10 = read('docs', 'adr', '0010-openspec-as-the-harness.md');
  for (const t of [adr13, adr11]) assert.ok(t.split('\n').includes(amended), 'the header line');
  for (const t of [adr13, adr11, adr10]) {
    assert.match(t, /Note \(roadmap-coordinator-followups, 2026-11-21\):/);
    assert.ok(t.includes(link), 'the Note links ADR 0014');
  }
  const adrs = read('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0014 in the desktop app each change of a roadmap run runs in a session of its own, amends 0011 and 0013/);
  const flow = read('docs', 'openspec-flow.md');
  assert.ok(flow.split('\n').some((l) => l.startsWith('**A session per change.**')), 'the flow page has the paragraph "A session per change."');
  assert.doesNotMatch(flow, /\(ready, waits for a place\)/);
  for (const f of [['README.md'], ['docs', 'roles.md'], ['docs', 'coordination-design.md']]) {
    assert.match(read(...f), /ADR 0014/, `${f.join('/')} cites ADR 0014`);
  }
});

// ---------------------------------------------------------------- the roadmap on CompozyOS (compozy-driver D-7)

const COMPOZY_CONFIG = 'schema: devkit\ndevkit:\n  driver: compozy\n';
const COMPOZY_READY = {
  'workspace info': { stdout: { workspace: { name: 'devkit' } } },
  'loop inspect': { stdout: { name: 'devkit-change' } },
  'loop runs': { stdout: { items: [] } },
  'loop run': { stdout: { run: { run_id: 'looprun-r1' }, web_url: 'http://localhost:2123/loop-runs/looprun-r1' } },
  'loop requests': { stdout: { items: [] } },
};
const czRun = (id, status, change, loop) => ({ run_id: id, status, loop, inputs: change ? { change_id: change } : {} });
const czRuns = (loop, ...runs) => ({ [`loop runs ${loop}`]: { stdout: { items: runs } } });

// A project on the compozy driver with the fake `compozy` answering as a ready CompozyOS and the daemon's socket listening.
async function czProject(t, { lines = ['[ ] a', '[ ] b', '[ ] c'], replies = {}, daemon = true, config = COMPOZY_CONFIG, changes = {}, files = {} } = {}) {
  const root = gitRepo({ config, changes, files: { ...(lines === null ? {} : { 'openspec/roadmap.md': roadmapText(...lines) }), ...files } });
  const k = fakeCompozy({ ...COMPOZY_READY, ...replies });
  if (daemon) await k.daemon(t);
  return { root, k, env: { ...cleanEnv, ...k.env } };
}
const czCmd = (p, argv, { stdin = '', load = 10 } = {}) => cmd(p.root, argv, { stdin, load, env: p.env });
const czStart = (p, word = '', flags = FLAGS) => czCmd(p, ['compozy-start', ...flags], { stdin: word });
const czTick = (p, places, opts = {}) => czCmd(p, ['compozy-tick', '--places', String(places), '--load-limit', '80', '--lang', 'en'], opts);
const czState = (p) => czCmd(p, ['compozy-state', '--lang', 'en']);
const calls = (p, verb) => p.k.argvs().filter((a) => a[0] === 'loop' && a[1] === verb);
const inputsIn = (argv) => Object.fromEntries(argv.flatMap((a, i) => (argv[i - 1] === '--input' ? [[a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]] : [])));
const runIdOf = (argv) => argv[argv.indexOf('--run-id') + 1];
const archive = (root, ...ids) => { put(root, Object.fromEntries(ids.map((id) => [`openspec/changes/archive/2026-11-20-${id}/proposal.md`, `# ${id}\n`]))); commitAll(root, 'archive'); };

test('roadmap-loop compozy start: a number starts the roadmap run with its places, load limit and language', async (t) => {
  const p = await czProject(t);
  const r = czStart(p, '2');
  assert.equal(r.code, 0, r.stdout);
  const started = calls(p, 'run');
  assert.equal(started.length, 1);
  assert.equal(started[0][started[0].indexOf('--name') + 1], 'devkit-roadmap');
  assert.deepEqual(inputsIn(started[0]), { places: '2', load_limit: '80', lang: 'en' });
  assert.equal(r.stdout, `${render('en', 'compozy-roadmap-started', { places: 2, url: 'http://localhost:2123/loop-runs/looprun-r1' })}\n`);
  assert.doesNotMatch(r.stdout, /devkit-roadmap:/, 'no run line: the stop lock never holds the turn');
  // No word is one place, `roadmap 3` is three, and the load limit is read as the Claude driver reads it.
  assert.equal(inputsIn(calls(p, 'run').at(-1)).places, '2');
  const one = await czProject(t);
  czStart(one, '');
  assert.equal(inputsIn(calls(one, 'run')[0]).places, '1');
  const three = await czProject(t);
  czStart(three, 'roadmap 3', ['--lang', 'pt-BR', '--load-limit', '50%']);
  assert.deepEqual(inputsIn(calls(three, 'run')[0]), { places: '3', load_limit: '80', lang: 'pt-BR' });
  const fifty = await czProject(t);
  czStart(fifty, '1', ['--lang', 'en', '--load-limit', '50']);
  assert.equal(inputsIn(calls(fifty, 'run')[0]).load_limit, '50');
});

test('roadmap-loop compozy start: a live roadmap run is cancelled and the paused change runs resumed, before the new run starts', async (t) => {
  const p = await czProject(t, {
    replies: {
      ...czRuns('devkit-roadmap', czRun('rr-1', 'running', null), czRun('rr-0', 'done', null)),
      ...czRuns('devkit-change', czRun('cr-5', 'paused', 'a'), czRun('cr-6', 'running', 'b'), czRun('cr-4', 'done', 'c')),
    },
  });
  const r = czStart(p, '2');
  assert.equal(r.code, 0, r.stdout);
  const order = p.k.argvs().filter((a) => ['cancel', 'resume', 'run'].includes(a[1]));
  assert.deepEqual(order.map((a) => [a[1], a[1] === 'run' ? null : runIdOf(a)]), [['cancel', 'rr-1'], ['resume', 'cr-5'], ['run', null]]);
});

test('roadmap-loop compozy start: stop cancels the roadmap run, pauses the roadmap lines\' change runs and says where each open change stays', async (t) => {
  const p = await czProject(t, {
    lines: ['[ ] a', '[ ] b'],
    changes: { a: { '.openspec.yaml': 'schema: devkit\n' } },
    replies: {
      ...czRuns('devkit-roadmap', czRun('rr-1', 'running', null)),
      ...czRuns('devkit-change', czRun('cr-1', 'running', 'a'), czRun('cr-2', 'watching', 'elsewhere'), czRun('cr-3', 'done', 'b')),
    },
  });
  const r = czStart(p, 'stop');
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(calls(p, 'cancel').map(runIdOf), ['rr-1']);
  assert.deepEqual(calls(p, 'pause').map(runIdOf), ['cr-1'], 'only a live run of a roadmap line');
  assert.equal(calls(p, 'run').length, 0, 'stop starts nothing');
  const lines = r.stdout.trimEnd().split('\n');
  assert.equal(lines[0], render('en', 'roadmap-stopping'));
  assert.match(lines[1], /^a: .+\.$/);
  assert.equal(lines.length, 2, 'one roadmap-stayed line per open change');
  assert.doesNotMatch(r.stdout, /devkit-roadmap:/);
});

test('roadmap-loop compozy start: an invalid word and a project with no roadmap answer as the Claude driver does, asking nothing', async (t) => {
  const p = await czProject(t);
  const bad = czStart(p, 'many');
  assert.deepEqual([bad.code, bad.stdout], [0, `${render('en', 'roadmap-invalid', { word: 'many' })}\n`]);
  const none = await czProject(t, { lines: null });
  const r = czStart(none, '2');
  assert.deepEqual([r.code, r.stdout], [0, `${render('en', 'roadmap-none')}\n`]);
  assert.deepEqual([...p.k.calls(), ...none.k.calls()], [], 'CompozyOS was not asked');
});

test('roadmap-loop compozy start: CompozyOS not ready stops with its own reply and starts nothing', async (t) => {
  const p = await czProject(t, { daemon: false });
  const r = czStart(p, '2');
  assert.equal(r.code, 3);
  assert.match(r.stdout, new RegExp(render('en', 'compozy-stopped', { fix: 'compozy daemon start' }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(calls(p, 'run').length + calls(p, 'cancel').length + calls(p, 'resume').length + calls(p, 'pause').length, 0);
});

test('roadmap-loop compozy tick: free places and ready lines start the lines in roadmap order, up to the free places', async (t) => {
  const p = await czProject(t);
  const r = czTick(p, 2);
  assert.equal(r.code, 0, r.stdout);
  const started = calls(p, 'run');
  assert.deepEqual(started.map((a) => inputsIn(a)), [{ change_id: 'a', request: 'a', lang: 'en' }, { change_id: 'b', request: 'b', lang: 'en' }]);
  assert.ok(started.every((a) => a[a.indexOf('--name') + 1] === 'devkit-change'));
  assert.equal(r.stdout, `${render('en', 'roadmap-started', { id: 'a', open: 1, places: 2 })}\n${render('en', 'roadmap-started', { id: 'b', open: 2, places: 2 })}\n`);
});

test('roadmap-loop compozy tick: an open change fills a place, and with no free place nothing starts', async (t) => {
  const p = await czProject(t, { lines: ['[ ] a', '[ ] b', '[ ] c'] });
  addOpen(p.root, 'a');
  addOpen(p.root, 'b');
  const r = czTick(p, 2);
  assert.equal(r.code, 0);
  assert.equal(calls(p, 'run').length, 0);
  const more = czTick(p, 3);
  assert.deepEqual(calls(p, 'run').map((a) => inputsIn(a).change_id), ['c'], 'a third place is filled by the next ready line');
  assert.equal(more.code, 0);
});

test('roadmap-loop compozy tick: a loaded machine starts none and prints the held line; at the limit it starts', async (t) => {
  const p = await czProject(t);
  const held = czTick(p, 2, { load: 95 });
  assert.equal(held.code, 0);
  assert.equal(calls(p, 'run').length, 0);
  assert.equal(held.stdout, `${render('en', 'roadmap-held', { id: 'a', load: 95, limit: 80 })}\n`);
  const eased = czTick(p, 1, { load: 80 });
  assert.equal(eased.code, 0);
  assert.deepEqual(calls(p, 'run').map((a) => inputsIn(a).change_id), ['a'], 'the limit itself is not loaded');
  const idle = await czProject(t, { lines: ['[ ] a'] });
  addOpen(idle.root, 'a');
  assert.equal(czTick(idle, 1, { load: 99 }).stdout, '', 'nothing ready, so nothing is held');
});

test('roadmap-loop compozy tick: a line whose run is live fills a place even with its folder absent', async (t) => {
  const live = czRuns('devkit-change', czRun('cr-1', 'running', 'a'));
  const p = await czProject(t, { lines: ['[ ] a', '[ ] b'], replies: live });
  czTick(p, 1);
  assert.equal(calls(p, 'run').length, 0, 'a holds the one place');
  const q = await czProject(t, { lines: ['[ ] a', '[ ] b'], replies: live });
  czTick(q, 2);
  assert.deepEqual(calls(q, 'run').map((a) => inputsIn(a).change_id), ['b'], 'a is not started a second time');
});

test('roadmap-loop compozy tick: a line waits for a dependency that is not archived, and starts once it is archived on the default branch', async (t) => {
  const p = await czProject(t, { lines: ['[ ] a', '[ ] b (after: a)'] });
  czTick(p, 2);
  assert.deepEqual(calls(p, 'run').map((a) => inputsIn(a).change_id), ['a'], 'b waits for a');
  const q = await czProject(t, { lines: ['[ ] a', '[ ] b (after: a)'] });
  archive(q.root, 'a');
  czTick(q, 2);
  assert.deepEqual(calls(q, 'run').map((a) => inputsIn(a).change_id), ['b'], 'a is archived: b starts, with Claude Code closed');
});

test('roadmap-loop compozy tick: CompozyOS not reachable exits 3 with the reply and starts nothing', async (t) => {
  const p = await czProject(t, { daemon: false });
  const r = czTick(p, 2);
  assert.equal(r.code, 3);
  assert.match(r.stdout, /CompozyOS is not running/);
  assert.equal(calls(p, 'run').length, 0);
  const gone = await czProject(t, { replies: { 'loop runs': { code: 1, stderr: 'daemon refused\n' } } });
  assert.equal(czTick(gone, 2).code, 3);
});

test('roadmap-loop compozy state: exit 10 when every line is archived', async (t) => {
  const p = await czProject(t, { lines: ['[ ] a', '[ ] b'] });
  archive(p.root, 'a', 'b');
  const before = picture(p.root);
  const r = czState(p);
  assert.equal(r.code, 10, r.stdout);
  assert.equal(picture(p.root), before, 'writes nothing');
  assert.equal(calls(p, 'run').length, 0, 'starts nothing');
});

test('roadmap-loop compozy state: exit 0 while a change run is live or a line can start', async (t) => {
  const live = await czProject(t, { lines: ['[ ] a', '[ ] b (after: a)'], replies: czRuns('devkit-change', czRun('cr-1', 'running', 'a')) });
  assert.equal(czState(live).code, 0, 'a run is live');
  const ready = await czProject(t, { lines: ['[ ] a'] });
  assert.equal(czState(ready).code, 0, 'a ready line can start');
  assert.equal(calls(ready, 'run').length, 0);
});

test('roadmap-loop compozy state: exit 11 when nothing can start and no change run is live, saying what each open change needs', async (t) => {
  const p = await czProject(t, { lines: ['[ ] a', '[ ] b (after: a)'] });
  addOpen(p.root, 'a');
  const r = czState(p);
  assert.equal(r.code, 11, r.stdout);
  assert.match(r.stdout, /^a: .+\.$/m);
  assert.equal(calls(p, 'run').length, 0);
});

test('roadmap-loop compozy state: CompozyOS not reachable exits 3', async (t) => {
  const p = await czProject(t, { daemon: false });
  const r = czState(p);
  assert.equal(r.code, 3);
  assert.match(r.stdout, /CompozyOS is not running/);
});

test('roadmap-loop compozy status: the board and then the pending requests, or the reason CompozyOS cannot be reached', async (t) => {
  const plain = gitRepo({ config: 'schema: devkit\n', files: { 'openspec/roadmap.md': roadmapText('[ ] a', '[ ] b') } });
  const board = doStatus(plain).stdout;
  const ready = await czProject(t, { lines: ['[ ] a', '[ ] b'], replies: { 'loop requests': { stdout: { items: [{ id: 'q1' }, { id: 'q2' }] } } } });
  const withIt = czCmd(ready, ['status', ...FLAGS]);
  assert.equal(withIt.code, 0);
  assert.equal(withIt.stdout, `${board}${render('en', 'compozy-requests', { n: 2 })}\n`);
  const down = await czProject(t, { lines: ['[ ] a', '[ ] b'], daemon: false });
  const without = czCmd(down, ['status', ...FLAGS]);
  assert.equal(without.code, 0);
  assert.ok(without.stdout.startsWith(board));
  assert.match(without.stdout.slice(board.length), /CompozyOS is not running/);
});

test('roadmap-loop compozy status: on the Claude driver the board is unchanged and CompozyOS is never asked', async (t) => {
  const k = fakeCompozy(COMPOZY_READY);
  await k.daemon(t);
  const root = gitRepo({ config: 'schema: devkit\n', files: { 'openspec/roadmap.md': roadmapText('[ ] a') } });
  const r = cmd(root, ['status', ...FLAGS], { env: { ...cleanEnv, ...k.env } });
  assert.equal(r.code, 0);
  assert.doesNotMatch(r.stdout, /CompozyOS/);
  assert.deepEqual(k.calls(), []);
});

// ================================================================ roadmap-sessions-upfront, phase 1: the entry of a started change session (design D-1)
const BY_TYPING = /by typing \/devkit change \S+ in this session$/;

test('upfront AC-1 entry: the run\'s own start of the change is claimed by the first session', () => {
  const e = upEntry();
  const d = entryOf(e);
  assert.deepEqual([d.decision, d.why, d.change], ['allow', 'claimed', 'a']);
  assert.deepEqual(stateOf(e.root).tickets.a, { ticket: UP_TICKET, at: AT, claimedBy: UP_SESSION }, 'the run file records who claimed it');
});

test('upfront AC-1 entry: the session that claimed the ticket is let through again', () => {
  const e = upEntry({ tickets: upTickets('a', { claimedBy: UP_SESSION }) });
  assert.deepEqual(labelOf(entryOf(e)), ['allow', 'same-session']);
  assert.equal(stateOf(e.root).tickets.a.claimedBy, UP_SESSION);
});

test('upfront AC-2 entry: another skill is let through', () => {
  const e = upEntry({ first: 'a message the owner typed' });
  for (const tool_input of [{ skill: 'devkit-openspec:devkit' }, { skill: 'review-change' }, { skill: 'my-devkit-session' }, { skill: 'devkit-session-extra' }, { skill: 7 }, {}]) {
    assert.deepEqual(labelOf(entryOf(e, { tool_input })), ['allow', 'not-entry'], JSON.stringify(tool_input));
  }
  assert.deepEqual(labelOf(loopModule.entryDecision({ session_id: UP_SESSION, cwd: e.root }, { env: cleanEnv })), ['allow', 'not-entry'], 'no tool input');
  // The host's field name for the skill is not documented: any string field that names the entry counts as the entry.
  for (const tool_input of [{ name: 'devkit-openspec:devkit-session' }, { name: 'devkit-session' }, { skill: 'x', other: 'devkit-session' }]) {
    assert.deepEqual(labelOf(entryOf(e, { tool_input })), ['refuse', 'not-started'], JSON.stringify(tool_input));
  }
});

test('upfront AC-2 entry: a session whose first message is typed is refused', () => {
  const cases = {
    'a plain typed message': upEntry({ first: '/devkit change a' }),
    'a typed command': upEntry({ lines: [lkTyped('change a'), lkAssistant()] }),
    'a started form whose task is another command': upEntry({ first: upStarted('a', { task: '/devkit-openspec:devkit roadmap 2' }) }),
    'a started form whose task is no slash command': upEntry({ first: upStarted('a', { task: 'change a' }) }),
    'a started form whose task has no id': upEntry({ first: upStarted('a', { task: '/devkit change' }) }),
    'the background line below another first line': upEntry({ first: `hello\n${upStarted('a')}` }),
    'a transcript with no user line': upEntry({ lines: [lkAssistant()] }),
  };
  for (const [name, e] of Object.entries(cases)) {
    const d = entryOf(e);
    assert.deepEqual(labelOf(d), ['refuse', 'not-started'], name);
    assert.match(d.reason, BY_TYPING, name);
  }
  const later = upEntry({ lines: [lkPlain('first message typed'), lkPlain(upStarted('a')), lkAssistant()] });
  assert.deepEqual(labelOf(entryOf(later)), ['refuse', 'not-started'], 'only the first message counts');
});

test('upfront AC-2 entry: a started session with no start line for its change is refused', () => {
  for (const [name, first] of Object.entries({
    'no start line': upStarted('a', { start: null }),
    'a start line naming another change': upStarted('a', { start: `devkit-start: b ${UP_TICKET}` }),
    'a start line with a short ticket': upStarted('a', { start: 'devkit-start: a 0123' }),
    'a start line with an uppercase ticket': upStarted('a', { start: `devkit-start: a ${UP_TICKET.toUpperCase()}` }),
  })) {
    const e = upEntry({ first });
    const d = entryOf(e);
    assert.deepEqual(labelOf(d), ['refuse', 'no-ticket'], name);
    assert.match(d.reason, /by typing \/devkit change a in this session$/, name);
    assert.equal(stateOf(e.root).tickets.a.claimedBy, null, `${name}: nothing was claimed`);
  }
});

test('upfront AC-2 entry: a ticket the run does not record is refused', () => {
  const cases = {
    'no entry for the change': upEntry({ tickets: {} }),
    'an entry for another change': upEntry({ tickets: upTickets('b') }),
    'another ticket': upEntry({ tickets: upTickets('a', { ticket: 'fedcba9876543210' }) }),
  };
  for (const [name, e] of Object.entries(cases)) {
    const d = entryOf(e);
    assert.deepEqual(labelOf(d), ['refuse', 'ticket-unknown'], name);
    assert.match(d.reason, /by typing \/devkit change a in this session$/, name);
  }
});

test('upfront AC-2 entry: a ticket another session claimed is refused', () => {
  const e = upEntry({ tickets: upTickets('a', { claimedBy: 'another-session' }) });
  const d = entryOf(e);
  assert.deepEqual(labelOf(d), ['refuse', 'ticket-claimed']);
  assert.match(d.reason, /by typing \/devkit change a in this session$/);
  assert.equal(stateOf(e.root).tickets.a.claimedBy, 'another-session', 'the first claim stays');
  const second = upEntry();
  assert.equal(entryOf(second).why, 'claimed');
  assert.deepEqual(labelOf(entryOf(second, { session: 'a-second-session' })), ['refuse', 'ticket-claimed'], 'a replayed ticket in a second session');
});

test('upfront AC-2 entry: an unreadable transcript or run file is refused', () => {
  const good = upEntry();
  const cases = {
    'a transcript that is gone': loopModule.entryDecision(upInput(good.root, join(lkSandbox(), 'gone.jsonl')), { env: cleanEnv }),
    'no run file': entryOf(upEntry({ tickets: null })),
    'a folder outside any project': loopModule.entryDecision(upInput(lkSandbox(), good.transcript), { env: cleanEnv }),
  };
  const broken = upEntry({ tickets: null });
  mkdirSync(dirname(runFileOf(broken.root)), { recursive: true });
  writeFileSync(runFileOf(broken.root), '[]');
  cases['a run file that holds no object'] = entryOf(broken);
  for (const [name, d] of Object.entries(cases)) {
    assert.deepEqual(labelOf(d), ['refuse', 'unreadable'], name);
    assert.match(d.reason, /by typing \/devkit change \S+ in this session$/, name);
  }
});

test('upfront AC-2 guard: guard.mjs skill exits 2 on a refusal, 0 on a claim, 0 under DEVKIT_BYPASS=1, and logs one line under DEVKIT_HOOK_LOG', () => {
  const log = join(lkSandbox(), 'hooks.jsonl');
  const refused = upEntry({ first: '/devkit change a' });
  const r1 = lkHook('skill', upInput(refused.root, refused.transcript), { DEVKIT_HOOK_LOG: log });
  assert.equal(r1.code, 2, r1.err);
  assert.match(r1.err, /^devkit guard: .*by typing \/devkit change <id> in this session/);
  const claimed = upEntry();
  const r2 = lkHook('skill', upInput(claimed.root, claimed.transcript), { DEVKIT_HOOK_LOG: log });
  assert.equal(r2.code, 0, r2.err);
  assert.equal(stateOf(claimed.root).tickets.a.claimedBy, UP_SESSION);
  const gone = lkHook('skill', upInput(claimed.root, join(lkSandbox(), 'gone.jsonl')), { DEVKIT_HOOK_LOG: log });
  assert.equal(gone.code, 2, 'the mode fails closed on a transcript it cannot read');
  const records = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(records.map((r) => [r.mode, r.decision, r.why]), [['skill', 'refuse', 'not-started'], ['skill', 'allow', 'claimed'], ['skill', 'refuse', 'unreadable']]);
  assert.deepEqual(Object.keys(records[0]), ['at', 'mode', 'session', 'agentType', 'change', 'decision', 'why']);
  assert.equal(records[1].session, UP_SESSION);
  assert.equal(records[1].change, 'a');
  const bypass = lkHook('skill', upInput(refused.root, refused.transcript), { DEVKIT_HOOK_LOG: log, DEVKIT_BYPASS: '1' });
  assert.equal(bypass.code, 0, 'DEVKIT_BYPASS=1 exits first');
  assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 3, 'and logs nothing');
  const other = lkHook('skill', upInput(refused.root, refused.transcript, { tool_input: { skill: 'review-change' } }));
  assert.equal(other.code, 0, 'another skill is let through');
});

test('upfront AC-1 ticket: decide gives each session start a fresh ticket recorded before it prints, keeps a claimed one, and withTicket adds the start line', () => {
  const root = projectWith(roadmapText('[ ] a'));
  addOpen(root, 'a');
  const promptOf = (r) => jsonOf(r.stdout).actions.find((x) => x.kind === 'session-start').input.prompt;
  const first = doRun(root, 'roadmap', { extra: ['--change-sessions'] });
  assert.equal(first.code, 0, first.stdout);
  const lines = promptOf(first).split('\n');
  assert.equal(lines.length, 2, 'the task is two lines');
  assert.equal(lines[0], '/devkit-openspec:devkit change a');
  const m = guardModule.START_LINE.exec(lines[1]);
  assert.deepEqual(m?.slice(1, 2), ['a'], lines[1]);
  const t1 = m[2];
  assert.match(t1, /^[0-9a-f]{16}$/);
  const entry = stateOf(root).tickets.a;
  assert.deepEqual([entry.ticket, entry.claimedBy, typeof entry.at], [t1, null, 'string'], 'recorded in the run file before it was printed');
  // An unclaimed ticket of the same change is replaced.
  const second = doNext(root, ['--turn', 'typed']);
  const t2 = guardModule.START_LINE.exec(promptOf(second).split('\n')[1])[2];
  assert.notEqual(t2, t1);
  assert.equal(stateOf(root).tickets.a.ticket, t2);
  // A claimed one is never replaced.
  const claimed = stateOf(root);
  claimed.tickets.a.claimedBy = 'S-claimed';
  writeFileSync(runFileOf(root), JSON.stringify(claimed));
  const third = doNext(root, ['--turn', 'typed']);
  assert.deepEqual(stateOf(root).tickets.a, claimed.tickets.a, 'the entry is as it was');
  assert.equal(stateOf(root).tickets.a.ticket, t2);
  // Invariant: a claimed ticket is never replaced. Layer: next command. Suite: roadmap-loop (D-13 T-14): a claimed ticket is a session of its own, so no session-start is printed.
  assert.equal(jsonOf(third.stdout).actions.some((x) => x.kind === 'session-start'), false, 'no session start for a claimed ticket');
  // The pure parts.
  const action = { change: 'a', kind: 'session-start', input: { prompt: '/devkit-openspec:devkit change a', title: 't' } };
  const tick = loopModule.withTicket(action, UP_TICKET);
  assert.equal(tick.input.prompt, `/devkit-openspec:devkit change a\ndevkit-start: a ${UP_TICKET}`);
  assert.equal(tick.input.title, 't');
  assert.equal(action.input.prompt, '/devkit-openspec:devkit change a', 'the action given is not changed');
  assert.match(loopModule.mintTicket(), /^[0-9a-f]{16}$/);
  assert.notEqual(loopModule.mintTicket(), loopModule.mintTicket());
  const pure = decideRoadmap(sessionWorld({ lines: ['[ ] a'], places: 1, actions: { a: agentAct('a') } }));
  assert.equal(pure.actions[0].input.prompt, '/devkit-openspec:devkit change a', 'decideRoadmap mints nothing: one line');
});

test('upfront AC-1 run file: readRun reads tickets, occupied, queued, anyway, waits, cron and check, and drops a field of the wrong type', () => {
  const root = projectWith(null);
  const write = (obj) => {
    mkdirSync(dirname(runFileOf(root)), { recursive: true });
    writeFileSync(runFileOf(root), JSON.stringify(obj));
    return loopModule.readRun(runFileOf(root));
  };
  const read = (run) => ({ tickets: run.tickets, occupied: run.occupied, queued: run.queued, anyway: run.anyway, waits: run.waits, cron: run.cron, check: run.check });
  assert.deepEqual(read(loopModule.readRun(join(lkSandbox(), 'none.json'))), { tickets: {}, occupied: {}, queued: {}, anyway: [], waits: {}, cron: false, check: null });
  const good = {
    tickets: { a: { ticket: UP_TICKET, at: AT, claimedBy: 'S1' }, b: { ticket: UP_TICKET, at: AT, claimedBy: null } },
    occupied: { a: { at: AT } }, queued: { b: { at: AT, why: 'place' }, c: { at: AT, why: 'load' } }, anyway: ['c'],
    waits: { a: [{ pid: 123, kind: 'github', at: AT, session: 'S1' }, { pid: 124, kind: 'session', at: AT, session: null }] },
    cron: true, check: { id: 'job-1', at: AT },
  };
  assert.deepEqual(read(write(good)), good);
  assert.deepEqual(read(write({ ...good, check: { refused: true, at: AT } })).check, { refused: true, at: AT });
  const bad = {
    tickets: { a: { ticket: 'zzz', at: AT, claimedBy: null }, 'bad id!': { ticket: UP_TICKET, at: AT, claimedBy: null }, c: 'x', d: { ticket: UP_TICKET, at: AT, claimedBy: 5 } },
    occupied: [1], queued: { b: { at: AT }, c: { at: AT, why: 'other' } }, anyway: 'c',
    waits: { a: [{ pid: -1, kind: 'github', at: AT }, { pid: 5, kind: 'other', at: AT }, { pid: 7, kind: 'session', at: AT, session: 'S' }], 'bad id!': [{ pid: 8, kind: 'github', at: AT }], b: 'x' },
    cron: 'yes', check: 'x',
  };
  assert.deepEqual(read(write(bad)), {
    tickets: {}, occupied: {}, queued: {}, anyway: [], waits: { a: [{ pid: 7, kind: 'session', at: AT, session: 'S' }] }, cron: false, check: null,
  });
  assert.deepEqual(write({ anyway: ['a', 3, 'bad id!', 'b'], check: { id: 5, at: AT } }).anyway, ['a', 'b'], 'only change ids stay in anyway');
  assert.equal(write({ check: { id: 5, at: AT } }).check, null);
});

test('upfront AC-1 run file: decide keeps the tickets and started sessions of an archived line, and drops those of a line that left the roadmap', () => {
  const root = projectWith(roadmapText('[ ] a', '[ ] b'));
  put(root, { 'openspec/changes/archive/2026-11-01-a/proposal.md': 'archived\n' });
  addOpen(root, 'b');
  const kept = { ticket: UP_TICKET, at: AT, claimedBy: 'S-a' };
  putRun(root, {
    places: 2, changeSessions: true, turn: 'typed', startedSessions: { a: { at: AT }, gone: { at: AT }, b: { at: AT } },
    tickets: { a: kept, gone: { ...kept, claimedBy: 'S-gone' }, b: { ...kept, claimedBy: 'S-b' } },
  });
  const r = doNext(root, ['--turn', 'typed']);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(Object.keys(stateOf(root).startedSessions).sort(), ['a', 'b'], 'the archived line keeps its session, the line that left the roadmap does not');
  assert.deepEqual(Object.keys(stateOf(root).tickets).sort(), ['a', 'b']);
  assert.deepEqual(stateOf(root).tickets.a, kept);
});

test('upfront AC-1 skill: devkit-session is model-invocable, names its change from the start line, and keeps the title rule and the archive line', () => {
  const md = sessionSkillMd();
  const fm = md.split('---')[1];
  assert.match(fm, /^name: devkit-session$/m);
  assert.doesNotMatch(fm, /disable-model-invocation/, 'the entry is model-invocable: the guard is what holds it');
  const desc = /^description: (.*)$/m.exec(fm)[1];
  assert.match(desc, /^"Runs the change of a session a \/devkit roadmap run started, from its first turn, with no command typed\./);
  assert.match(desc, /first message is the started-session form whose task is \/devkit change <id> followed by a devkit-start line; the devkit guard refuses it anywhere else\."$/);
  for (const h of ['## Settings', '## The change', '## Loop', '## Never']) assert.ok(md.split('\n').includes(h), `has ${h}`);
  const change = sectionOf(md, '## The change', '## Loop');
  assert.match(change, /`devkit-start:` line of this session's first message/);
  assert.match(change, /takes no argument/);
  assert.match(change, /who started it, why and what it does/);
  const loop = sectionOf(md, '## Loop', '## Never');
  const calls = md.split('\n').filter((l) => /roadmap-loop\.mjs (session-next|session-wait|wait)\b/.test(l));
  assert.ok(calls.some((l) => l.includes('roadmap-loop.mjs session-next')), 'the loop runs session-next');
  assert.ok(calls.some((l) => l.includes('roadmap-loop.mjs session-wait')), 'a held change starts session-wait');
  for (const l of calls) {
    assert.ok(l.includes(SK_LANG), `--lang on: ${l}`);
    assert.ok(l.includes(SK_LIMIT), `--load-limit on: ${l}`);
  }
  assert.match(loop, /`--after` and the `progressKey` after every `agent` or `session` action/);
  assert.match(loop, /`merge-base`[^\n]*`detail\.command`/);
  assert.match(loop, /`waiting-on-github`[^\n]*roadmap-loop\.mjs wait /);
  assert.match(loop, /devkit roadmap: <id> archived/, 'the archive line ends the turn that archives the change');
  assert.ok(loop.includes('<skill-dir>/../devkit/SKILL.md'), 'the kinds of action are the devkit skill\'s');
  assert.doesNotMatch(md, /--lang (pt-BR|en)\b/);
  assert.doesNotMatch(md, /--load-limit \d/);
  assert.doesNotMatch(md, /wake_when_done|SendMessage|CronCreate/, 'no message tool and no schedule');
  const never = sectionOf(md, '## Never', '\u0000end');
  for (const text of ['ask the grill', 'the plan approval', 'the retro answers', '`approval.md`', 'create a schedule', 'start a session', 'take a place by hand']) assert.ok(never.includes(text), `Never: ${text}`);
  // The devkit skill stays owner-only and sends such a session to the entry.
  const devkit = skillMd();
  assert.match(devkit.split('---')[1], /^disable-model-invocation: true$/m);
  const item = devkit.split('\n').find((l) => l.startsWith('1a. '));
  assert.ok(item, 'item 1a of the Loop');
  for (const text of ['Background (from the session that started this one):', '`devkit-start:` line', '`skill` field set to `devkit-openspec:devkit-session`', 'in place of this Loop', '/devkit change <id>']) {
    assert.ok(item.includes(text), `item 1a says ${text}`);
  }
  assert.doesNotMatch(item, /set_session_title/, 'the rename moved to the entry skill');
});

// ================================================================ roadmap-sessions-upfront, phase 2: the change session's loop, places and the waiting icon (design D-6 to D-8, D-11)
const retroAct = (id = 'a') => endAct(id, 'waiting-for-owner', 'waiting-retro', {}, { stage: 'retro', stageTitle: 'Retro' });
const GATE_ICON = { grill: '❓', approval: '📝', retro: '📦' };

test('upfront AC-7 session-next: the grill, the plan approval and the retro answers are held for the coordinating session with their stage icon', () => {
  const again = endAct('a', 'waiting-for-owner', 'waiting-approval-again', {}, { stage: 'approval', stageTitle: 'Plan approval' });
  for (const [action, gate] of [[grillAct('a'), 'grill'], [ownerAct('a'), 'approval'], [again, 'approval'], [retroAct('a'), 'retro']]) {
    const r = sd(action);
    const h = r.action;
    const icon = GATE_ICON[gate];
    assert.deepEqual([h.kind, h.held.why, h.held.gate, h.icon, h.sessionTitle, h.progressKey], ['held', 'owner', gate, icon, `🙋 ${icon} a`, 'held/owner'], gate);
    assert.equal(h.reply, render('en', 'session-held-owner', { id: 'a', gate }), gate);
    assert.deepEqual([h.change, h.script, h.root, h.branch, h.filesLanguage, h.stage, h.stageTitle, h.version], ['a', 'devkit', '/w/a', 'a', 'en', action.stage, action.stageTitle, 1], gate);
    assert.equal(h.end, undefined, 'a held action is no end of the change loop');
    assert.deepEqual([r.occupied, r.queued], [{}, {}], 'no place is taken at a gate');
  }
  assert.match(sd(grillAct('a'), { lang: 'pt-BR' }).action.reply, /roadmap|sessão/);
});

test('upfront AC-7 session-next: every other gate stays in the change session', () => {
  const ends = [
    endAct('a', 'waiting-for-owner', 'waiting-merge', { number: 1 }, { stage: 'delivery', stageTitle: 'Delivery' }),
    endAct('a', 'waiting-for-owner', 'waiting-pr-decision', {}, { stage: 'delivery', stageTitle: 'Delivery' }),
    endAct('a', 'waiting-for-owner', 'waiting-review-dispute', {}, { stage: 'review', stageTitle: 'Review' }),
    endAct('a', 'waiting-for-owner', 'waiting-by-hand', {}, { stage: 'implementation', stageTitle: 'Implementation' }),
    endAct('a', 'waiting-for-owner', 'waiting-mockup', {}, { stage: 'mockup', stageTitle: 'Mock-up' }),
  ];
  for (const action of ends) assert.deepEqual(sd(action).action, action, action.end.why);
});

test('upfront AC-7 session-next: the held approval goes on once approval.md is written', () => {
  const root = upChange();
  const held = doSessionNext(root);
  assert.equal(held.code, 0, held.stdout);
  const lines = held.stdout.split('\n');
  assert.equal(lines[0], 'devkit-run: a');
  assert.ok(!lines.some((l) => l.startsWith('devkit-end:')), 'a held action prints no end line');
  const h = jsonOf(held.stdout);
  assert.deepEqual([h.kind, h.held.why, h.held.gate, h.icon], ['held', 'owner', 'approval', '📝']);
  assert.equal(stateOf(root).occupied?.a, undefined, 'a gate takes no place');
  approve(root);
  const next = doSessionNext(root);
  const a = jsonOf(next.stdout);
  assert.deepEqual([a.kind, a.stage, a.icon], ['agent', 'implementation', '🛠️'], 'the approval was written: the change goes on');
  assert.deepEqual(Object.keys(stateOf(root).occupied), ['a'], 'and takes the place');
});

test('upfront AC-8 session-next: a plan stage waits for an unarchived dependency with ⏳', () => {
  for (const stage of ['proposal', 'specs', 'design', 'tasks', 'readiness']) {
    const r = sd(agentAct('a', stage), { waitsFor: 'x' });
    const h = r.action;
    assert.deepEqual([h.kind, h.held.why, h.held.after, h.icon, h.sessionTitle, h.progressKey, h.stage], ['held', 'after', 'x', '⏳', '⏳ a', 'held/after', stage], stage);
    assert.equal(h.reply, render('en', 'session-held-after', { id: 'a', after: 'x' }));
  }
  // Not a plan stage that waits: the grill and the approval are the owner's, the build stages are placed, an end is shown as it is.
  assert.equal(sd(grillAct('a'), { waitsFor: 'x' }).action.held.why, 'owner');
  assert.equal(sd(ownerAct('a'), { waitsFor: 'x' }).action.held.why, 'owner');
  assert.equal(sd(implAct('a'), { waitsFor: 'x' }).action.kind, 'agent', 'a build stage does not wait for a dependency');
  const blocked = endAct('a', 'blocked', 'not-delivered', { why: 'not-delivered', stage: 'Proposal' }, { stage: 'proposal', stageTitle: 'Proposal' });
  assert.deepEqual(sd(blocked, { waitsFor: 'x' }).action, blocked, 'an end is no stage to hold');
  assert.deepEqual(sd(agentAct('a', 'proposal'), { waitsFor: null }).action, agentAct('a', 'proposal'), 'no missing dependency: the stage goes on');
});
const MERGE_BASE = ['merge-base', '--change', 'b', '--lang', 'en'];

test('upfront AC-8 session-next: the roadmap of the main checkout says which dependency is still unarchived', () => {
  const { wt } = upBase({ archive: false });
  const h = sessionNextOf(wt, 'b');
  assert.deepEqual([h.kind, h.held?.why, h.held?.after, h.icon, h.sessionTitle], ['held', 'after', 'a', '⏳', '⏳ b'], JSON.stringify(h));
});

test('upfront AC-8 session-next: once the dependency is archived and not merged, the step merges the default branch', () => {
  const pure = sd(agentAct('b', 'proposal'), { notInHead: true });
  assert.deepEqual([pure.action.kind, pure.action.step, pure.action.stage, pure.action.progressKey], ['session', 'merge-base', 'proposal', 'proposal/merge-base@abc123']);
  assert.deepEqual(pure.action.detail.command, ['node', join(HOOKS_DIR, 'roadmap-loop.mjs'), 'merge-base', '--change', 'b', '--lang', 'en']);
  assert.equal(sd(agentAct('b', 'proposal'), { notInHead: true, lang: 'pt-BR' }).action.detail.command.at(-1), 'pt-BR');
  // None when the plan is begun, when nothing is missing from the tree, when a dependency is still missing (it waits first) and outside the plan.
  assert.equal(sd(agentAct('b', 'proposal'), { notInHead: true, hasProposal: true }).action.kind, 'agent');
  assert.equal(sd(agentAct('b', 'proposal'), { notInHead: false }).action.kind, 'agent');
  assert.equal(sd(agentAct('b', 'proposal'), { notInHead: true, waitsFor: 'a' }).action.held.why, 'after');
  assert.equal(sd(implAct('b'), { notInHead: true }).action.kind, 'agent');
  // In a scratch repository: the step comes, then the merge brings the archive folder and the step goes.
  const { wt } = upBase();
  const step = sessionNextOf(wt, 'b');
  assert.deepEqual([step.kind, step.step, step.stage], ['session', 'merge-base', 'proposal'], JSON.stringify(step));
  const merged = cmd(wt, MERGE_BASE, { env: upGitEnv });
  assert.equal(merged.code, 0, merged.stdout + merged.stderr);
  const after = sessionNextOf(wt, 'b');
  assert.deepEqual([after.kind, after.stage], ['agent', 'proposal'], 'the plan is written from the code of that day');
  // A plan begun is not merged again.
  const begun = upBase();
  put(begun.wt, { 'openspec/changes/b/proposal.md': '# proposal\n' });
  commitAll(begun.wt, 'proposal');
  assert.notEqual(sessionNextOf(begun.wt, 'b').step, 'merge-base');
});

test('upfront AC-8 merge-base: merges origin\'s default branch, and on a conflict aborts and exits 3 with base-conflict', () => {
  const { wt } = upBase();
  const r = cmd(wt, MERGE_BASE, { env: upGitEnv });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.ok(git(wt, 'ls-tree', '-r', '--name-only', 'HEAD').split('\n').includes('openspec/changes/archive/2026-11-01-a/proposal.md'), 'the archive folder is in the branch');
  assert.equal(git(wt, 'status', '--porcelain'), '');
  const clash = upBase({ conflict: true });
  const head = git(clash.wt, 'rev-parse', 'HEAD');
  const c = cmd(clash.wt, MERGE_BASE, { env: upGitEnv });
  assert.equal(c.code, 3, c.stdout);
  const out = JSON.parse(c.stdout);
  assert.equal(out.why, 'base-conflict');
  assert.match(out.reply, /the default branch could not be merged into it/);
  assert.equal(out.version, 1);
  assert.equal(git(clash.wt, 'rev-parse', 'HEAD'), head, 'the branch is as it was');
  assert.equal(git(clash.wt, 'status', '--porcelain'), '', 'the merge was undone');
  assert.throws(() => git(clash.wt, 'rev-parse', '-q', '--verify', 'MERGE_HEAD'), 'no merge is left half done');
  assert.equal(readFileSync(join(clash.wt, 'notes.txt'), 'utf8'), 'b side\n');
  assert.equal(cmd(clash.wt, ['merge-base', '--lang', 'en'], { env: upGitEnv }).code, 3, 'it needs the change');
});

test('upfront AC-9 place: a free place is claimed', () => {
  const r = loopModule.placeDecision({ id: 'a', places: 2, occupied: { b: { at: AT } }, queued: { a: { at: '2026-11-21T09:00:00.000Z', why: 'place' } }, load: 10, limit: 80, anyway: [], now: AT });
  assert.equal(r.claimed, true);
  assert.deepEqual(r.occupied, { b: { at: AT }, a: { at: AT } });
  assert.deepEqual(r.queued, {}, 'it leaves the queue');
  const given = { occupied: {}, queued: {}, anyway: ['a'] };
  loopModule.placeDecision({ id: 'a', places: 1, ...given, load: 10, limit: 80, now: AT });
  assert.deepEqual(given, { occupied: {}, queued: {}, anyway: ['a'] }, 'the facts given are not changed');
});

test('upfront AC-9 place: no free place queues the change with why place', () => {
  const r = loopModule.placeDecision({ id: 'a', places: 1, occupied: { b: { at: AT } }, queued: {}, load: 10, limit: 80, anyway: [], now: AT });
  assert.deepEqual([r.claimed, r.why, r.occupied, r.queued], [false, 'place', { b: { at: AT } }, { a: { at: AT, why: 'place' } }]);
  const again = loopModule.placeDecision({ id: 'a', places: 1, occupied: { b: { at: AT } }, queued: r.queued, load: 10, limit: 80, anyway: [], now: '2026-11-21T11:00:00.000Z' });
  assert.deepEqual(again.queued, { a: { at: AT, why: 'place' } }, 'it keeps the time it first queued');
});

test('upfront AC-9 place: a loaded machine queues it with why load', () => {
  const r = loopModule.placeDecision({ id: 'a', places: 2, occupied: {}, queued: {}, load: 95, limit: 80, anyway: [], now: AT });
  assert.deepEqual([r.claimed, r.why, r.occupied, r.queued], [false, 'load', {}, { a: { at: AT, why: 'load' } }]);
  const edge = loopModule.placeDecision({ id: 'a', places: 2, occupied: {}, queued: {}, load: 80, limit: 80, anyway: [], now: AT });
  assert.equal(edge.claimed, false, 'the limit itself is loaded');
  const both = loopModule.placeDecision({ id: 'a', places: 1, occupied: { b: { at: AT } }, queued: {}, load: 95, limit: 80, anyway: [], now: AT });
  assert.equal(both.why, 'place', 'no place wins over the load');
});

test('upfront AC-9 place: start anyway claims despite the load once', () => {
  const r = loopModule.placeDecision({ id: 'a', places: 2, occupied: {}, queued: { a: { at: AT, why: 'load' } }, load: 95, limit: 80, anyway: ['a', 'c'], now: AT });
  assert.equal(r.claimed, true);
  assert.deepEqual([r.anyway, r.queued, Object.keys(r.occupied)], [['c'], {}, ['a']], 'the permission is used up; another change\'s stays');
  const second = loopModule.placeDecision({ id: 'a', places: 2, occupied: {}, queued: {}, load: 95, limit: 80, anyway: r.anyway, now: AT });
  assert.equal(second.claimed, false, 'held again the next time');
  const full = loopModule.placeDecision({ id: 'a', places: 1, occupied: { b: { at: AT } }, queued: {}, load: 95, limit: 80, anyway: ['a'], now: AT });
  assert.deepEqual([full.claimed, full.why, full.anyway], [false, 'place', ['a']], 'it does not make a place');
});

test('upfront AC-9 place: an earlier queued change goes first', () => {
  const queued = { b: { at: '2026-11-21T09:00:00.000Z', why: 'place' }, c: { at: '2026-11-21T11:00:00.000Z', why: 'place' } };
  const a = loopModule.placeDecision({ id: 'a', places: 2, occupied: { x: { at: AT } }, queued, load: 10, limit: 80, anyway: [], now: AT });
  assert.deepEqual([a.claimed, a.why], [false, 'place'], 'b queued before a and takes the one free place');
  const b = loopModule.placeDecision({ id: 'b', places: 2, occupied: { x: { at: AT } }, queued, load: 10, limit: 80, anyway: [], now: AT });
  assert.equal(b.claimed, true);
  const c = loopModule.placeDecision({ id: 'c', places: 3, occupied: { x: { at: AT } }, queued: { b: queued.b }, load: 10, limit: 80, anyway: [], now: AT });
  assert.equal(c.claimed, true, 'two places free, one change ahead');
  const later = loopModule.placeDecision({ id: 'a', places: 2, occupied: { x: { at: AT } }, queued: { c: queued.c }, load: 10, limit: 80, anyway: [], now: '2026-11-21T10:00:00.000Z' });
  assert.equal(later.claimed, true, 'a change queued later does not go first');
});

test('upfront AC-9 session-next: an implementation step claims a place and the delivery releases it', () => {
  const claimed = sd(implAct('a'));
  assert.deepEqual(claimed.action, implAct('a'), 'the action goes on unchanged');
  assert.deepEqual(claimed.occupied, { a: { at: AT } });
  for (const action of [implAct('a'), agentAct('a', 'unit-tests'), agentAct('a', 'e2e-tests'), agentAct('a', 'evidence'), sessionAct('a', 'review')]) {
    assert.equal(sd(action).action.kind === 'held', false, action.stage);
    assert.deepEqual(Object.keys(sd(action).occupied), ['a'], `${action.stage} holds a place`);
  }
  const kept = sd(implAct('a'), { occupied: { a: { at: '2026-11-21T08:00:00.000Z' }, b: { at: AT } }, places: 1 });
  assert.deepEqual([kept.action.kind, kept.occupied.a.at], ['agent', '2026-11-21T08:00:00.000Z'], 'a change that has its place keeps it and its time');
  const delivery = endAct('a', 'waiting-on-github', 'waiting-github', { what: 'merge' }, { stage: 'delivery', stageTitle: 'Delivery' });
  const released = sd(delivery, { occupied: { a: { at: AT }, b: { at: AT } }, queued: { a: { at: AT, why: 'load' } } });
  assert.deepEqual(released.action, delivery);
  assert.deepEqual([released.occupied, released.queued], [{ b: { at: AT } }, {}], 'the place and the queue entry of a are gone');
  const plan = sd(agentAct('a', 'proposal'), { occupied: { a: { at: AT } } });
  assert.deepEqual(plan.occupied, {}, 'a stage in another part holds no place');
});

test('upfront AC-9 session-next: a blocked change in its implementation keeps its place', () => {
  const blocked = endAct('a', 'blocked', 'tests-red', { why: 'tests-red', phase: 1 }, { stage: 'implementation', stageTitle: 'Implementation' });
  const r = sd(blocked, { occupied: { a: { at: AT } } });
  assert.deepEqual(r.action, blocked);
  assert.deepEqual(r.occupied, { a: { at: AT } });
  const owner = endAct('a', 'waiting-for-owner', 'waiting-by-hand', {}, { stage: 'implementation', stageTitle: 'Implementation' });
  assert.deepEqual(sd(owner, { occupied: { a: { at: AT } } }).occupied, { a: { at: AT } }, 'also at an owner gate there');
  assert.deepEqual(sd(blocked, {}).occupied, {}, 'a blocked change that never had a place takes none');
});

test('upfront AC-9 session-next: the archived end releases the place', () => {
  const r = sd(archivedAct('a'), { occupied: { a: { at: AT }, b: { at: AT } }, queued: { a: { at: AT, why: 'place' } } });
  assert.equal(r.action.end.state, 'archived');
  assert.deepEqual([r.occupied, r.queued], [{ b: { at: AT } }, {}]);
});

test('upfront AC-9 session-next: no free place or a loaded machine holds the change with why place or load', () => {
  const full = sd(implAct('a'), { occupied: { b: { at: AT }, c: { at: AT } }, places: 2 });
  const h = full.action;
  assert.deepEqual([h.kind, h.held.why, h.icon, h.sessionTitle, h.progressKey, h.stage, h.stageTitle], ['held', 'place', '⏳', '⏳ a', 'held/place', 'implementation', 'Implementation']);
  assert.equal(h.reply, render('en', 'session-held-place', { id: 'a', places: 2 }));
  assert.deepEqual(full.queued, { a: { at: AT, why: 'place' } });
  assert.deepEqual(full.occupied, { b: { at: AT }, c: { at: AT } });
  const loaded = sd(implAct('a'), { load: 91, limit: 80 });
  assert.deepEqual([loaded.action.held.why, loaded.action.progressKey], ['load', 'held/load']);
  assert.equal(loaded.action.reply, render('en', 'session-held-load', { id: 'a', load: 91, limit: 80 }));
  assert.deepEqual(loaded.queued, { a: { at: AT, why: 'load' } });
  const anyway = sd(implAct('a'), { load: 91, limit: 80, anyway: ['a'], queued: { a: { at: AT, why: 'load' } } });
  assert.deepEqual([anyway.action.kind, anyway.anyway, anyway.queued], ['agent', [], {}]);
});

// A session transcript the budget reads (change-budget): the run line of `a`, then one assistant turn that spent `input` tokens.
function upBudgetEnv(input) {
  const base = tmpFolder('devkit-upfront-budget-');
  const line = (extra) => JSON.stringify({ parentUuid: null, isSidechain: false, userType: 'external', sessionId: 'sess-up-budget', uuid: 'uuid-0001', timestamp: '2026-11-20T10:00:00.000Z', ...extra });
  const text = 'devkit-run: a\n{"version":1}';
  const lines = [
    line({ type: 'user', message: { role: 'user', content: [{ tool_use_id: 'toolu-0001', type: 'tool_result', content: text, is_error: false }] }, toolUseResult: { stdout: text, stderr: '', interrupted: false, isImage: false, noOutputExpected: false } }),
    line({ type: 'assistant', timestamp: '2026-11-20T10:01:00.000Z', message: { role: 'assistant', id: 'msg-1', content: [{ type: 'text', text: 'working' }], usage: { input_tokens: input, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }),
  ];
  mkdirSync(join(base, 'projects', 'p'), { recursive: true });
  writeFileSync(join(base, 'projects', 'p', 'sess-up-budget.jsonl'), `${lines.join('\n')}\n`);
  return { ...cleanEnv, CLAUDE_CONFIG_DIR: base, CLAUDE_CODE_SESSION_ID: 'sess-up-budget' };
}

test('upfront budget session-next: at the cap a change session\'s session-next prints the budget end and keeps its place', () => {
  const root = upChange({ run: { occupied: { a: { at: AT } } }, files: { 'openspec/changes/a/.openspec.yaml': 'schema: devkit\ndevkit:\n  budget: 1000\n' } });
  approve(root);
  const env = upBudgetEnv(5000);
  const r = doSessionNext(root, [], { env });
  assert.equal(r.code, 1, r.stdout);
  const lines = r.stdout.split('\n');
  assert.deepEqual(lines.slice(0, 2), ['devkit-run: a', 'devkit-end: a waiting-for-owner']);
  assert.equal(jsonOf(r.stdout).end.why, 'waiting-budget');
  assert.deepEqual([stateOf(root).occupied, stateOf(root).queued?.a], [{ a: { at: AT } }, undefined], 'the place is kept and nothing is queued');
  for (const poll of [loopModule.sessionNext(root, 'a', { env, lang: 'en', gh: OFFLINE }), loopModule.sessionNext(root, 'a', { env, lang: 'en', gh: OFFLINE, write: true })]) {
    assert.equal(poll.kind, 'agent', 'the poll of session-wait and the stop lock read no budget');
  }
  const under = doSessionNext(root, [], { env: upBudgetEnv(10) });
  assert.equal(under.code, 0, under.stdout);
  assert.equal(jsonOf(under.stdout).kind, 'agent', 'below the cap the hand-off goes on');
});

test('upfront AC-9 session-next: a change outside a session-mode run gets the change loop\'s action unchanged', () => {
  const asked = (root) => nextAction(root, 'a', { env: cleanEnv, lang: 'en', gh: OFFLINE });
  const plain = upChange({ run: { changeSessions: false } });
  approve(plain);
  assert.deepEqual(jsonOf(doSessionNext(plain).stdout), asked(plain));
  assert.equal(stateOf(plain).occupied, undefined, 'no run file write');
  const unclaimed = upChange({ run: { tickets: upTickets('a', { claimedBy: null }), occupied: { b: { at: AT } } } });
  approve(unclaimed);
  const before = readFileSync(runFileOf(unclaimed), 'utf8');
  assert.deepEqual(jsonOf(doSessionNext(unclaimed).stdout), asked(unclaimed), 'a ticket nobody claimed is no session of its own');
  assert.equal(readFileSync(runFileOf(unclaimed), 'utf8'), before);
  const none = upChange({ run: { tickets: {} } });
  assert.equal(jsonOf(doSessionNext(none).stdout).kind, 'end', 'no ticket at all: the change loop\'s action (the approval, as an end)');
});

test('upfront AC-10 session-next: a held change is titled ⏳ <id> and a claimed one its stage icon again', () => {
  assert.equal(changeLoopModule.WAIT_ICON, '⏳');
  const act = { ...implAct('a'), icon: '🛠️', sessionTitle: '🛠️ a' };
  for (const [name, r] of [['place', sd(act, { occupied: { b: { at: AT } } })], ['load', sd(act, { load: 95 })], ['after', sd({ ...agentAct('a', 'proposal'), icon: '📝', sessionTitle: '📝 a' }, { waitsFor: 'x' })]]) {
    assert.deepEqual([r.action.icon, r.action.sessionTitle], ['⏳', '⏳ a'], name);
  }
  const gate = sd({ ...ownerAct('a'), icon: '📝', sessionTitle: '📝 a' });
  assert.deepEqual([gate.action.icon, gate.action.sessionTitle], ['📝', '🙋 📝 a'], 'an owner gate keeps its stage icon, beside 🙋');
  assert.deepEqual(sd(act).action, act, 'claimed: the action with its own icon and title again');
});

test('upfront AC-1 session-next: prints devkit-run first, so runOf reads a change run', () => {
  const root = upChange();
  approve(root);
  const r = doSessionNext(root);
  assert.equal(r.stdout.split('\n')[0], 'devkit-run: a');
  const run = guardModule.runOf({ transcript_path: lkTranscript([lkPlain(upStarted('a')), lkAssistant(), lkResult(r.stdout)]) });
  assert.equal(run?.change, 'a');
  assert.equal(cmd(root, ['session-next', '--change', 'a', '--lang', 'en']).code, 0, 'no load limit is the default');
  assert.equal(cmd(root, ['session-next', ...FLAGS]).code, 3, 'it needs the change');
  assert.equal(cmd(root, ['session-next', '--change', 'bad id!', ...FLAGS]).code, 3, 'and a change id');
});

test('upfront AC-9 session-wait: exits with the new action when a place frees, records and clears its wait', async () => {
  const root = upChange({ run: { occupied: { b: { at: AT } } } });
  approve(root);
  const seen = [];
  const sleep = async (seconds) => {
    seen.push([seconds, stateOf(root).waits?.a]);
    const run = stateOf(root);
    run.occupied = {};
    writeFileSync(runFileOf(root), JSON.stringify(run));
  };
  const r = await loopModule.runCommand(['session-wait', '--change', 'a', ...FLAGS, '--interval', '5', '--session', 'S-a'], { cwd: root, env: cleanEnv, gh: OFFLINE, load: () => 10, sleep });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.stdout.split('\n')[0], 'devkit-run: a');
  const a = jsonOf(r.stdout);
  assert.deepEqual([a.kind, a.stage], ['agent', 'implementation'], 'the place was freed: the action goes on');
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], 5);
  assert.equal(seen[0][1].length, 1, 'recorded while it waits');
  assert.deepEqual([seen[0][1][0].kind, seen[0][1][0].session, seen[0][1][0].pid], ['session', 'S-a', process.pid]);
  assert.equal(stateOf(root).waits.a, undefined, 'cleared at its end');
  assert.deepEqual(Object.keys(stateOf(root).occupied), ['a']);
  // Also cleared on error: the poll of a repository that cannot be read three times in a row ends blocked, never leaving its record.
  const lone = upChange({ run: { occupied: { b: { at: AT } } } });
  approve(lone);
  const gone = await loopModule.runCommand(['session-wait', '--change', 'a', ...FLAGS, '--session', 'S-a'], { cwd: lone, env: cleanEnv, gh: OFFLINE, load: () => 10, sleep: async () => { throw new Error('stopped'); } }).catch((e) => e);
  assert.ok(gone instanceof Error || gone.code === 3, 'a failing sleep does not leave a wait behind');
  assert.equal(stateOf(lone).waits?.a, undefined);
  const bad = await loopModule.runCommand(['session-wait', '--change', 'a', ...FLAGS, '--interval', '2'], { cwd: lone, env: cleanEnv, gh: OFFLINE, load: () => 10 });
  assert.equal(bad.code, 3, 'the interval has a floor');
});
const stopOf2 = (root, opts) => withTmp((tmp) => ({ tmp, d: loopModule.changeSessionStopDecision(upStopInput(root, opts), { env: LK_ENV, gh: OFFLINE, load: () => 10 }) }));

test('upfront AC-9 lock stop: a claimed change session held for a place may stop', () => {
  const root = upChange({ run: { tickets: upTickets('a', { claimedBy: LK_SESSION }), occupied: { b: { at: AT } } } });
  approve(root);
  const before = readFileSync(runFileOf(root), 'utf8');
  const { tmp, d } = stopOf2(root);
  assert.deepEqual([d.decision, d.why, d.change], ['allow', 'held', 'a']);
  nothingRecorded(tmp);
  assert.equal(readFileSync(runFileOf(root), 'utf8'), before, 'the decision of a stop writes nothing');
  const gate = upChange({ run: { tickets: upTickets('a', { claimedBy: LK_SESSION }) } });
  const g = stopOf2(gate).d;
  assert.deepEqual([g.decision, g.why], ['allow', 'held'], 'held for the owner too');
});

test('upfront AC-9 lock stop: with its place and a stage ready the stop is refused once', () => {
  const root = upChange({ run: { tickets: upTickets('a', { claimedBy: LK_SESSION }), occupied: { a: { at: AT } } } });
  approve(root);
  const before = readFileSync(runFileOf(root), 'utf8');
  const input = upStopInput(root);
  withTmp((tmp) => {
    const first = loopModule.changeSessionStopDecision(input, { env: LK_ENV, gh: OFFLINE, load: () => 10 });
    assert.deepEqual([first.decision, first.why, first.change], ['refuse', 'stage-ready', 'a']);
    const second = loopModule.changeSessionStopDecision(input, { env: LK_ENV, gh: OFFLINE, load: () => 10 });
    assert.equal(second.decision, 'allow', 'once per state');
    assert.ok(recordOf(tmp, `${LK_SESSION}.json`), 'the refusal is recorded as the change loop does');
  });
  assert.equal(readFileSync(runFileOf(root), 'utf8'), before, 'a free place is not claimed by a stop decision');
});

test('upfront AC-9 lock stop: a session that did not claim the ticket is judged as any change run', () => {
  const other = upChange({ run: { tickets: upTickets('a', { claimedBy: 'S-other' }), occupied: { b: { at: AT } } } });
  approve(other);
  const { d } = stopOf2(other);
  assert.deepEqual([d.decision, d.why], ['refuse', 'stage-ready'], 'the change loop\'s lock, whatever the run file says of places');
  const plain = upChange({ run: { changeSessions: false, occupied: { b: { at: AT } } } });
  approve(plain);
  const p = stopOf2(plain).d;
  assert.deepEqual([p.decision, p.why], ['refuse', 'stage-ready'], 'a run with no session per change is the change loop\'s too');
  const nothing = loopModule.changeSessionStopDecision({ session_id: LK_SESSION, cwd: other, transcript_path: join(lkSandbox(), 'gone.jsonl') }, { env: LK_ENV });
  assert.equal(nothing.decision, 'allow', 'a transcript that cannot be read lets the stop through');
});

test('upfront AC-9 messages: the held and base-conflict messages exist in both languages and name no stage or step', () => {
  const params = { id: 'a', gate: 'approval', places: 2, load: 91, limit: 80, after: 'b', error: 'x' };
  for (const lang of ['en', 'pt-BR']) {
    for (const key of ['session-held-owner', 'session-held-place', 'session-held-load', 'session-held-after']) {
      const text = render(lang, key, params);
      assert.ok(text.includes('a') && text.length > 20, `${lang} ${key}`);
      assert.doesNotMatch(text, /session-next|merge-base|progressKey|\.md\b|--/, `${lang} ${key} names no mechanism`);
    }
    assert.match(render(lang, 'blocked', { id: 'a', why: 'base-conflict', error: 'CONFLICT' }), /CONFLICT/);
  }
  assert.equal(render('en', 'session-held-load', params), 'a waits: the processor is at 91% (limit 80%).');
});

// ================================================================ roadmap-sessions-upfront, phase 3: the coordinating session and the periodic check (design D-2, D-3, D-5, D-9, D-11)
const opened = (id) => say('roadmap-session-opened', { id });

test('upfront AC-3 decide: every pending line opens on a typed turn whatever the number, the load and the dependencies, each with its session', () => {
  const lines = ['[ ] a', '[ ] b (after: a)', '[x] t', '[x] z', '[ ] p', '[ ] c'];
  const facts = (over = {}) => sessionWorld({ lines, archived: ['z'], previous: ['p'], places: 1, load: 95, limit: 80, ...over });
  const first = decideRoadmap(facts());
  assert.deepEqual(changesOf(first), [['a', 'start'], ['b', 'start'], ['c', 'start']], 'a ticked, an archived and a previous-script line are not opened');
  assert.ok(!first.actions.some((x) => x.kind === 'hold'), 'the load holds a place, not an opening');
  assert.ok(!first.lines.some((l) => /machine is loaded/.test(l)), 'no held line');
  assert.deepEqual(first.state.starting, ['a', 'b', 'c']);
  const open = decideRoadmap(facts({ actions: { a: grillAct('a'), b: grillAct('b'), c: grillAct('c') } }));
  assert.deepEqual(changesOf(open), [['a', 'session-start'], ['b', 'session-start'], ['c', 'session-start']], 'each opened change gets its session');
  assert.deepEqual(open.actions.map((x) => x.cwd), ['/w/a', '/w/b', '/w/c']);
});

test('upfront AC-3 decide: on a turn nobody typed a pending line not open waits for the owner\'s next message with its line', () => {
  const facts = (over = {}) => sessionWorld({ lines: ['[ ] a', '[ ] b (after: a)', '[ ] c'], places: 1, turn: 'event', ...over });
  const event = decideRoadmap(facts());
  assert.deepEqual(event.actions, []);
  assert.deepEqual(event.lines, ['a', 'b', 'c'].map((id) => say('roadmap-waits-turn', { id })));
  assert.deepEqual([event.state.starting, event.end], [[], null], 'a withheld start is no end of the run');
  assert.deepEqual(decideRoadmap(facts({ announced: event.state.announced })).lines, [], 'said once');
  assert.deepEqual(changesOf(decideRoadmap(facts({ announced: event.state.announced, turn: 'typed' }))), [['a', 'start'], ['b', 'start'], ['c', 'start']], 'the owner\'s next message opens them');
});

test('upfront AC-3 decide: the line of a session just started names no count of places', () => {
  const r = decideRoadmap(sessionWorld({ lines: ['[ ] a'], places: 3, actions: { a: agentAct('a') }, startedSessions: { a: { at: AT } }, after: { a: 'session-start' } }));
  assert.deepEqual(r.lines, [opened('a')]);
  assert.equal(render('en', 'roadmap-session-opened', { id: 'a' }), 'a is open in a session of its own; its grill is asked here.');
  assert.equal(render('pt-BR', 'roadmap-session-opened', { id: 'a' }), 'a está aberta numa sessão própria; o grill dela é feito aqui.');
});

test('upfront AC-3 status: the board lists every opened change, with held-place, held-load and held-after rows', () => {
  const impl = (id) => agentAct(id, 'implementation', { stageTitle: 'Implementation' });
  const text = boardOf(sessionWorld({
    lines: ['[ ] a', '[ ] b', '[ ] c (after: a)', '[ ] d', '[ ] e'], places: 1,
    actions: { a: impl('a'), b: impl('b'), c: agentAct('c'), d: grillAct('d'), e: impl('e') },
    startedSessions: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { at: AT }])),
    occupied: { a: { at: AT } }, queued: { b: { at: AT, why: 'place' }, e: { at: AT2, why: 'load' } }, waitsFor: { c: 'a' },
  }));
  const row = (id, words) => `  ${id.padEnd(4)}${words}`;
  const rows = text.split('\n');
  for (const r of [row('a', 'Implementation'), row('b', 'open, waits for a place'), row('c', 'open, waits for a'), row('d', 'your answers about its request'), row('e', 'open, held by the load')]) {
    assert.ok(rows.includes(r), `${r}\n${text}`);
  }
  const at = (header) => rows.indexOf(header);
  assert.ok(at('Waiting for you') < at(row('d', 'your answers about its request')) && at(row('d', 'your answers about its request')) < at('Under way'), 'd waits for the owner');
  assert.ok(at('In the queue') < at(row('b', 'open, waits for a place')), 'the held ones are in the queue');
  assert.ok(!/Starts held/.test(text), 'a run with a session per change holds no start');
  const pt = boardOf(sessionWorld({ lang: 'pt-BR', lines: ['[ ] b', '[ ] c (after: a)', '[ ] e'], places: 1, actions: { b: agentAct('b'), c: agentAct('c'), e: agentAct('e') }, startedSessions: { b: { at: AT }, c: { at: AT }, e: { at: AT } }, queued: { b: { at: AT, why: 'place' }, e: { at: AT, why: 'load' } }, waitsFor: { c: 'a' } }));
  for (const words of ['aberta, espera uma vaga', 'aberta, espera a', 'aberta, segurada pela carga']) assert.ok(pt.includes(words), `${words}\n${pt}`);
});

test('upfront AC-4 decide: the grills of change sessions are asked in roadmap order, one change at a time, with their gate line', () => {
  const facts = (over = {}) => sessionWorld({ lines: ['[ ] a', '[ ] b'], places: 2, actions: { a: grillAct('a'), b: grillAct('b') }, startedSessions: { a: { at: AT }, b: { at: AT } }, ...over });
  const r = decideRoadmap(facts());
  assert.deepEqual([r.ask.change, r.ask.kind, r.ask.gate, r.ask.action.stage], ['a', 'grill', 'grill', 'requirements']);
  assert.deepEqual(r.actions, [], 'no change session is asked to ask');
  assert.deepEqual(r.lines, [gateLine('a', 'grill'), gateLine('b', 'grill')]);
  assert.equal(r.state.asking, 'a');
  const staying = decideRoadmap(facts({ asking: 'b' }));
  assert.equal(staying.ask.change, 'b', 'the head stays while it waits');
  const others = decideRoadmap(facts({ lines: ['[ ] a', '[ ] b'], actions: { a: agentAct('a'), b: grillAct('b') } }));
  assert.deepEqual([others.ask.change, others.lines], ['b', [gateLine('b', 'grill', true)]], 'another change under way: the others go on');
  assert.equal(decideRoadmap(facts({ stopping: true })).ask, null, 'a stop asks nothing');
});

test('upfront AC-7 decide: a plan approval and the retro answers of a change session are asked here, and a merge left to the owner is not', () => {
  const merge = endAct('c', 'waiting-for-owner', 'waiting-merge', {}, { stage: 'delivery', stageTitle: 'Delivery' });
  const facts = (over = {}) => sessionWorld({
    lines: ['[ ] a', '[ ] b', '[ ] c'], places: 3, actions: { a: ownerAct('a'), b: retroAct('b'), c: merge },
    startedSessions: { a: { at: AT }, b: { at: AT }, c: { at: AT } }, ...over,
  });
  const r = decideRoadmap(facts());
  assert.deepEqual([r.ask.change, r.ask.kind, r.ask.gate], ['a', 'gate', 'approval']);
  assert.equal(r.ask.action.end.why, 'waiting-approval');
  assert.deepEqual(r.lines, [gateLine('a', 'approval', true), gateLine('b', 'retro', true)], 'c\'s merge is no line here, and c goes on in its own session');
  const second = decideRoadmap(facts({ asking: 'b' }));
  assert.deepEqual([second.ask.change, second.ask.gate], ['b', 'retro']);
  const alone = decideRoadmap(facts({ lines: ['[ ] c'], actions: { c: merge } }));
  assert.equal(alone.ask, null, 'a merge is asked in c\'s own session');
  assert.deepEqual(alone.lines, []);
  const again = endAct('a', 'waiting-for-owner', 'waiting-approval-again', {}, { stage: 'approval', stageTitle: 'Plan approval' });
  assert.equal(decideRoadmap(facts({ actions: { a: again, b: retroAct('b'), c: merge } })).ask.gate, 'approval');
});

test('upfront AC-12 next: a passed grill not on origin gives a push, the push commits and pushes requirements.md, and a plan approved gives the push of the plan files', () => {
  const { root, origin } = upPushed();
  const grill = pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS));
  assert.equal(grill.length, 1);
  assert.deepEqual([grill[0].change, grill[0].what, grill[0].progressKey], ['a', 'grill', 'push']);
  assert.ok(grill[0].command[1].endsWith('roadmap-loop.mjs'));
  assert.deepEqual([grill[0].command[0], ...grill[0].command.slice(2)], ['node', 'push', '--change', 'a', '--what', 'grill', '--lang', 'en']);
  const sent = cmd(root, ['push', '--change', 'a', '--what', 'grill', '--lang', 'en'], PUSH_OPTS);
  assert.equal(sent.code, 0, sent.stdout + sent.stderr);
  assert.match(git(origin, 'show', 'a:openspec/changes/a/requirements.md'), /devkit-stage requirements result=passed/, 'the branch on origin holds the passed grill');
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)), [], 'what origin holds is not pushed again');
  // The owner approves the plan: approval.md is written (not committed) and the plan files go with it.
  put(root, { 'openspec/changes/a/approval.md': '<!-- devkit-stage approval result=passed attempt=1 commit=none -->\n# Plan approval: a\n\n- Status: APPROVED\n' });
  const plan = pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS));
  assert.deepEqual(plan.map((a) => [a.change, a.what]), [['a', 'plan']]);
  const sentPlan = cmd(root, ['push', '--change', 'a', '--what', 'plan', '--lang', 'en'], PUSH_OPTS);
  assert.equal(sentPlan.code, 0, sentPlan.stdout + sentPlan.stderr);
  for (const file of ['approval.md', 'proposal.md', 'design.md', 'tasks.md', 'readiness.md', 'requirements.md', 'specs/s/spec.md']) {
    assert.ok(git(origin, 'ls-tree', '-r', '--name-only', 'a').split('\n').includes(`openspec/changes/a/${file}`), `${file} is on origin`);
  }
  assert.equal(git(root, 'status', '--porcelain'), '', 'the push committed the approval');
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)), []);
});

test('upfront AC-12 next: after --after <id>=push the same decision asks no push, and a failed push exits 3 with its reply', () => {
  const { root } = upPushed({ remote: 'missing' });
  assert.equal(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)).length, 1);
  const failed = cmd(root, ['push', '--change', 'a', '--what', 'grill', '--lang', 'en'], PUSH_OPTS);
  assert.equal(failed.code, 3, failed.stdout);
  const j = JSON.parse(failed.stdout);
  assert.match(j.reply, /^The branch of a could not be pushed: .+\. I try again at a later decision\.$/);
  assert.deepEqual(pushesOf(doNext(root, ['--turn', 'typed', '--after', 'a=push'], PUSH_OPTS)), [], 'the decision that follows asks no other push');
  assert.equal(pushesOf(doNext(root, ['--turn', 'typed'], PUSH_OPTS)).length, 1, 'a later decision asks again');
  assert.equal(cmd(root, ['push', '--change', 'a', '--what', 'other', '--lang', 'en'], PUSH_OPTS).code, 3, 'a push names grill or plan');
});

test('upfront AC-13 decide: with cron and no check the decision asks for one, on any turn, and none while stopping or after a refusal', () => {
  const asks = (over) => decideRoadmap(sessionWorld({ lines: ['[ ] a'], places: 1, cron: true, check: null, ...over })).actions.filter((a) => a.kind === 'schedule-check');
  for (const turn of ['typed', 'event']) {
    const [a, ...rest] = asks({ turn });
    assert.deepEqual([rest.length, a.change, a.progressKey], [0, null, 'schedule-check'], turn);
    assert.deepEqual(Object.keys(a.input).sort(), ['cron', 'prompt', 'recurring'], 'no durable field is passed');
    assert.equal(a.input.recurring, true);
    assert.deepEqual(a.input.prompt, loopModule.checkPrompt('en', 80));
  }
  assert.equal(decideRoadmap(world({ lines: ['[ ] a'], places: 1, cron: true, check: null })).actions.filter((a) => a.kind === 'schedule-check').length, 1, 'also in a run that keeps the stages here');
  assert.deepEqual(asks({ stopping: true }), [], 'a stop schedules nothing');
  assert.deepEqual(asks({ check: { refused: true, at: AT } }), [], 'no retry after a refusal');
  assert.deepEqual(asks({ check: JOB }), [], 'one check at most');
  assert.deepEqual(asks({ cron: false }), [], 'a host with no session cron');
  assert.deepEqual(decideRoadmap(world({ lines: ['[x] a'], archived: ['a'], cron: true, check: null })).actions, [], 'a run that ends at once schedules nothing');
});

test('upfront AC-13 decide: the check\'s cron expression avoids minutes 00 and 30, recurring is true and no durable field is passed', () => {
  const [a] = decideRoadmap(sessionWorld({ lines: ['[ ] a'], places: 1, cron: true, check: null })).actions.filter((x) => x.kind === 'schedule-check');
  const fields = a.input.cron.split(' ');
  assert.equal(fields.length, 5);
  assert.deepEqual(fields.slice(1), ['*', '*', '*', '*']);
  const minutes = fields[0].split(',').map(Number);
  assert.ok(minutes.length >= 2 && minutes.every((m) => Number.isInteger(m) && m >= 0 && m < 60 && m !== 0 && m !== 30), a.input.cron);
  assert.ok(minutes[1] - minutes[0] === 30, 'about every thirty minutes');
  assert.equal(a.input.recurring, true);
  assert.equal('durable' in a.input, false);
  assert.match(a.input.prompt, /^devkit-roadmap-check: /);
  assert.ok(!a.input.prompt.startsWith('/') && !a.input.prompt.includes('\n'), 'one paragraph that is no typed command');
  assert.ok(a.input.prompt.includes(`node ${join(HERE, 'roadmap-loop.mjs')} check --lang en --load-limit 80`));
  assert.match(a.input.prompt, /approve no plan/i);
  assert.ok(loopModule.checkPrompt('pt-BR', 65).includes('check --lang pt-BR --load-limit 65'));
});

test('upfront AC-13 decide: every end and a stop give delete-check when a check is recorded', () => {
  const kinds = (r) => r.actions.map((a) => a.kind);
  const done = decideRoadmap(world({ lines: ['[x] a'], archived: ['a'], check: JOB }));
  assert.equal(done.end.why, 'done');
  assert.deepEqual(kinds(done), ['delete-check', 'stop-own-tasks']);
  assert.deepEqual([done.actions[0].change, done.actions[0].input, done.actions[0].progressKey], [null, { id: 'job-1' }, 'delete-check']);
  const stuck = decideRoadmap(world({ lines: ['[ ] a'], actions: { a: ownerAct('a') }, check: JOB }));
  assert.equal(stuck.end.why, 'stuck');
  assert.deepEqual(kinds(stuck), ['delete-check', 'stop-own-tasks']);
  const stopped = decideRoadmap(world({ lines: ['[ ] a'], actions: { a: ownerAct('a') }, stopping: true, check: JOB }));
  assert.equal(stopped.end.why, 'stopped');
  assert.deepEqual(kinds(stopped), ['delete-check'], 'a stop deletes the check and stops no task of changes that go on');
  const going = decideRoadmap(world({ lines: ['[ ] a'], inflight: { a: FLYING }, stopping: true, check: JOB }));
  assert.equal(going.end, null);
  assert.deepEqual(kinds(going), ['delete-check'], 'a stop asks it before the stage finishes');
  assert.deepEqual(decideRoadmap(world({ lines: ['[x] a'], archived: ['a'] })).actions, [], 'no check recorded, nothing to delete');
  assert.deepEqual(decideRoadmap(world({ lines: ['[x] a'], archived: ['a'], check: { refused: true, at: AT } })).actions, [], 'a refusal recorded no job');
});

test('upfront AC-13 next: --check-id records the check, --check-refused records the refusal with its line, --check-deleted clears it, also for a job already gone', () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { cron: true });
  const asked = doNext(root, ['--turn', 'typed']);
  assert.deepEqual(jsonOf(asked.stdout).actions.map((a) => a.kind), ['start', 'schedule-check']);
  assert.equal(jsonOf(asked.stdout).check, null);
  const created = doNext(root, ['--turn', 'typed', '--check-id', 'job-1']);
  assert.equal(created.code, 0, created.stdout);
  assert.deepEqual([stateOf(root).check.id, typeof stateOf(root).check.at, jsonOf(created.stdout).check], ['job-1', 'string', 'job-1']);
  assert.ok(!jsonOf(created.stdout).actions.some((a) => a.kind === 'schedule-check'));
  const deleted = doNext(root, ['--turn', 'typed', '--check-deleted']);
  assert.equal(stateOf(root).check, null);
  assert.equal(deleted.code, 0);
  assert.equal(doNext(root, ['--turn', 'typed', '--check-deleted']).code, 0, 'a job already gone is no error');
  assert.equal(stateOf(root).check, null);
  const refused = doNext(root, ['--turn', 'typed', '--check-refused']);
  assert.deepEqual([stateOf(root).check.refused, typeof stateOf(root).check.at], [true, 'string']);
  assert.ok(events(refused.stdout).includes(say('roadmap-check-refused')), events(refused.stdout).join('|'));
  assert.ok(!jsonOf(refused.stdout).actions.some((a) => a.kind === 'schedule-check'), 'no retry in that run');
  const later = doNext(root, ['--turn', 'typed']);
  assert.deepEqual([events(later.stdout).filter((l) => l === say('roadmap-check-refused')), jsonOf(later.stdout).actions.some((a) => a.kind === 'schedule-check')], [[], false], 'the line is said once');
  assert.equal(doNext(root, ['--turn', 'typed', '--check-id']).code, 3, '--check-id needs the job id');
});

test('upfront AC-13 next: --check-gone clears a recorded check and the same decision asks for a new one, but not after a refusal', () => {
  const root = projectWith(roadmapText('[ ] a'));
  putRun(root, { cron: true, check: JOB });
  assert.ok(!jsonOf(doNext(root, ['--turn', 'typed']).stdout).actions.some((a) => a.kind === 'schedule-check'));
  const gone = doNext(root, ['--turn', 'typed', '--check-gone']);
  assert.equal(stateOf(root).check, null);
  assert.ok(jsonOf(gone.stdout).actions.some((a) => a.kind === 'schedule-check'), 'the expired check is created again');
  putRun(root, { cron: true, check: { refused: true, at: AT } });
  const kept = doNext(root, ['--turn', 'typed', '--check-gone']);
  assert.deepEqual(stateOf(root).check, { refused: true, at: AT });
  assert.ok(!jsonOf(kept.stdout).actions.some((a) => a.kind === 'schedule-check'));
});

test('upfront AC-13 run: --cron is recorded and asks for the check, and a run from another session asks for its own', () => {
  const root = projectWith(roadmapText('[ ] a'));
  const plain = doRun(root, 'roadmap', { extra: ['--change-sessions'] });
  assert.deepEqual([stateOf(root).cron, jsonOf(plain.stdout).actions.some((a) => a.kind === 'schedule-check')], [false, false]);
  const first = doRun(root, 'roadmap', { extra: ['--change-sessions', '--cron'] });
  assert.equal(first.code, 0, first.stdout);
  assert.equal(stateOf(root).cron, true);
  assert.equal(jsonOf(first.stdout).actions.filter((a) => a.kind === 'schedule-check').length, 1);
  doNext(root, ['--turn', 'typed', '--check-id', 'job-1']);
  const same = doRun(root, 'roadmap', { extra: ['--change-sessions', '--cron'] });
  assert.equal(stateOf(root).check.id, 'job-1', 'the same session keeps its check');
  assert.ok(!jsonOf(same.stdout).actions.some((a) => a.kind === 'schedule-check'));
  const other = doRun(root, 'roadmap', { session: 'S2', extra: ['--change-sessions', '--cron'] });
  assert.equal(stateOf(root).check, null, 'a session cron dies with its session');
  assert.equal(jsonOf(other.stdout).actions.filter((a) => a.kind === 'schedule-check').length, 1);
  doRun(root, 'roadmap stop', { session: 'S2', extra: ['--cron'] });
  assert.equal(stateOf(root).stopping, true);
});

test('upfront AC-13 guard: the check\'s prompt reads as no typed command and the roadmap run goes on', () => {
  const prompt = loopModule.checkPrompt('en', 80);
  const transcript = lkTranscript([lkTyped('roadmap 2'), lkSkillBody('roadmap 2'), lkAssistant(), lkMarker(2), lkPlain(prompt), lkAssistant()]);
  assert.deepEqual(guardModule.roadmapRunOf({ transcript_path: transcript }), { command: 'roadmap 2', stopping: false });
  assert.equal(guardModule.runOf({ transcript_path: transcript }), null, 'it starts no change run either');
});

test('upfront AC-13 messages: the check\'s messages exist in both languages and name no mechanism', () => {
  const params = { id: 'a', n: 2, error: 'x' };
  for (const lang of ['en', 'pt-BR']) {
    for (const key of ['roadmap-check-refused', 'roadmap-check-idle', 'roadmap-check-stopped-waits', 'roadmap-check-session-archived', 'roadmap-check-archive-later', 'push-failed']) {
      const text = render(lang, key, params);
      assert.ok(text.length > 20, `${lang} ${key}`);
      assert.doesNotMatch(text, /roadmap-loop|--|progressKey|CronCreate|\.mjs|\.md\b/, `${lang} ${key} names no mechanism`);
    }
    for (const key of ['queue.held-place', 'queue.held-load', 'queue.held-after']) assert.ok(render(lang, key, { after: 'a' }).length > 8, `${lang} ${key}`);
  }
  assert.equal(render('en', 'roadmap-check-idle', params), 'a has a place but its session is not watching: type any message in it.');
  assert.equal(render('en', 'roadmap-check-stopped-waits', params), '2 wait loops of the run were stopped: their changes no longer need them.');
  assert.equal(render('en', 'roadmap-check-session-archived', params), 'The session of a was archived.');
  assert.equal(render('en', 'roadmap-check-archive-later', params), 'The session of a is not archived yet: it is still working or waits for your approval; I try again later.');
  assert.equal(render('en', 'push-failed', params), 'The branch of a could not be pushed: x. I try again at a later decision.');
});
