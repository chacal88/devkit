// node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs
// run-status-bar, phase 2 (design D-1 to D-12, D-11 B-1 to B-46): the Claude Code status line command. The drawing functions
// (`lineOfChange`, `countsLine`, `columns`, `inputOf`) are tested directly; the choice of line and the process behaviour run the
// real `main` in fixture repositories, its `state` call pointed at a fixture script (`stateCommand`, D-9) that logs each run.
// The `state` command itself is tested in change-state-stages.test.mjs and change-loop-remote-state.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync, realpathSync, symlinkSync, appendFileSync, chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { gitRepo, git, planChange, fakeGh, putRun, runFileOf, SET_LOOP as SET } from './test-fixtures.mjs';
import { tmpFolder } from './test-tmp.mjs';
import { HERE, LOOP } from './change-loop-fixtures.mjs';
import { MESSAGES } from './change-loop.mjs';
import { main, inputOf, lineOfChange, countsLine, columns } from './status-line.mjs';

const BAR = join(HERE, 'status-line.mjs');

// The icons by code point, so no editor can drop the variation selector of the implementation's.
const ICON = { owner: '\u{1F64B}', github: '\u{23F3}', blocked: '\u{26D4}', archived: '\u{1F4E6}', ask: '\u{2753}', plan: '\u{1F4DD}', code: '\u{1F6E0}\u{FE0F}', ship: '\u{1F680}' };

// What the owner approved: every expected line of the mock-up, verbatim from openspec/changes/run-status-bar/mock/ (B-42 to B-44).
// A test reads no git history and the folder moves at archive, so the lines are constants here.
const MOCK_LONE_EN = [
  "🙋 ❓ run-status-bar · Requirements (grill) · ■◆□□□□□□□□□□□□□ · 2 of 15 · your answers about its…",
  "🙋 📝 run-status-bar · Screen mock-up · ■■◆□□□□□□□□□□□□ · 3 of 15 · your approval of the mock-up",
  "🙋 📝 run-status-bar · Owner's approval · ■■■■■■■■■◆□□□□□ · 10 of 15 · your approval of the plan",
  "🛠️ run-status-bar · Implementation · ■■■■■■■■■■◆□□□□ · 11 of 15",
];
const MOCK_LONE_PT = [
  "🙋 ❓ run-status-bar · Requisitos (grill) · ■◆□□□□□□□□□□□□□ · 2 de 15 · as suas respostas sobre o…",
  "🙋 📝 run-status-bar · Mock-up de tela · ■■◆□□□□□□□□□□□□ · 3 de 15 · a sua aprovação do mock-up",
  "🙋 📝 run-status-bar · Aprovação do dono · ■■■■■■■■■◆□□□□□ · 10 de 15 · a sua aprovação do plano",
  "🛠️ run-status-bar · Implementação · ■■■■■■■■■■◆□□□□ · 11 de 15",
];
const MOCK_LONG_ID = "🙋 📝 roadmap-coordinator-followups · Owner's approval · ■■■■■■■■■◆□□□□□ · 10 of 15 · your approval…";
const MOCK_ROADMAP = {
  ten: { en: "10 in play · 10 working · 🙋 0 waiting on the owner · ⛔ 0 blocked", 'pt-BR': "10 em jogo · 10 em andamento · 🙋 0 aguardando o dono · ⛔ 0 bloqueadas" },
  mix: { en: "6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked", 'pt-BR': "6 em jogo · 3 em andamento · 🙋 2 aguardando o dono · ⛔ 1 bloqueada" },
};
const MOCK_NOTHING = "";

// The 15 stages of this change (devkit flow, flags ui and contract), in order, and the strips the mock draws.
const STAGES = ['open', 'requirements', 'mockup', 'decisions', 'proposal', 'specs', 'design', 'tasks', 'readiness', 'approval', 'implementation',
  'evidence', 'review', 'delivery', 'retro'];
const strip = (done) => `${'■'.repeat(done)}◆${'□'.repeat(14 - done)}`;

// One entry of the `state` listing, as the command prints it.
const entry = (over = {}) => ({
  change: 'feat', state: 'running', reason: null, stage: 'implementation', stageTitle: 'Implementation', phase: null, stageIcon: ICON.code,
  stateIcon: null, title: null, script: 'devkit', root: '/nowhere', branch: 'feat', stages: STAGES, ...over,
});
const listing = (...changes) => ({ version: 1, changes });

// The approval moment of a change `feat`, 58 columns before its reason: the base of the cut tests (D-6).
const ASKING = (reasonText, over = {}) => entry({
  state: 'waiting-for-owner', stage: 'approval', stageTitle: "Owner's approval", stageIcon: ICON.plan, stateIcon: ICON.owner,
  reason: reasonText === null ? null : { code: 'waiting-approval', text: reasonText }, ...over,
});
const ASKING_HEAD = `${ICON.owner} ${ICON.plan} feat · Owner's approval · ${strip(9)} · 10 of 15`;

// A fixture script standing for `change-loop.mjs state`: it logs its arguments and folder, then prints `reply` and exits `exit`;
// with `sleep` it writes its pid and waits until it is killed; with `grandchild` it also starts a child of its own (as `state` starts
// `openspec` and `gh`) that writes its pid and waits. Nothing here is the product's.
function stateStub({ reply = '', exit = 0, sleep = false, grandchild = false } = {}) {
  const dir = tmpFolder('devkit-bar-stub-');
  const log = join(dir, 'calls.log');
  const pidFile = join(dir, 'pid');
  const grandchildFile = join(dir, 'grandchild-pid');
  const replyFile = join(dir, 'reply.txt');
  writeFileSync(replyFile, typeof reply === 'string' ? reply : JSON.stringify(reply));
  const script = join(dir, 'state-stub.mjs');
  const child = `writeFileSync(${JSON.stringify(grandchildFile)}, String(process.pid)); setInterval(() => {}, 1000);`;
  const body = sleep
    ? `${grandchild ? `spawn(process.execPath, ['--input-type=module', '-e', ${JSON.stringify(`import { writeFileSync } from 'node:fs'; ${child}`)}], { stdio: 'ignore' });` : ''}`
      + `writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`
    : `process.stdout.write(readFileSync(${JSON.stringify(replyFile)}, 'utf8')); process.exitCode = ${exit};`;
  writeFileSync(script, [
    "import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';",
    "import { spawn } from 'node:child_process';",
    `appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }) + String.fromCharCode(10));`,
    body,
  ].join('\n'));
  return {
    command: [process.execPath, script],
    calls: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
    pid: () => (existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : null),
    grandchildPid: () => (existsSync(grandchildFile) ? Number(readFileSync(grandchildFile, 'utf8')) : null),
  };
}
const argvOf = (stub) => stub.calls().map((c) => c.argv);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const found = check();
    if (found) return found;
    if (Date.now() > end) throw new Error('timed out waiting for a condition');
    await sleep(20);
  }
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// The checkout, its worktrees and the runs of the bar.
const real = realpathSync;
const CHANGE_FOLDER = { feat: { '.openspec.yaml': 'schema: devkit\n' } };
const checkout = ({ changes = CHANGE_FOLDER, config = 'schema: devkit\n' } = {}) => real(gitRepo({ config, changes }));
function worktree(main_, branch, name = branch.replaceAll('/', '-')) {
  const path = join(tmpFolder('devkit-bar-wt-'), name);
  git(main_, 'worktree', 'add', '-q', '-b', branch, path, 'HEAD');
  return real(path);
}
const asInput = (folder, session = null) => ({ ...(session === null ? {} : { session_id: session }), workspace: { current_dir: folder }, cwd: folder });
const bar = (folder, session, stub, { argv = ['--lang', 'en'], ...opts } = {}) => (
  main(argv, { stdin: JSON.stringify(asInput(folder, session)), stateCommand: stub.command, ...opts }));
const COORD = 'S-coordinator';

// The two views that read `state`: the coordinator's session (any folder) and a change's worktree.
const coordinator = () => { const m = checkout(); putRun(m, { session: COORD }); return { folder: m, session: COORD, args: ['state', '--offline', '--lang', 'en'] }; };
const lone = () => { const m = checkout(); return { folder: worktree(m, 'feat'), session: null, args: ['state', '--change', 'feat', '--lang', 'en'] }; };

// ---------------------------------------------------------------- the input (D-2)

// Invariant (B-1, input, status-line.test.mjs): the folder is workspace.current_dir when it is a non-empty string, and it is what `state` runs in.
test('run-status-bar AC-1 input: workspace.current_dir wins over cwd', async (t) => {
  await t.test('inputOf', () => {
    const got = inputOf(JSON.stringify({ session_id: 's-1', workspace: { current_dir: '/a' }, cwd: '/b' }), '/process');
    assert.deepEqual(got, { folder: '/a', session: 's-1' });
  });
  await t.test('main runs state in that folder', async () => {
    const view = lone();
    const stub = stateStub({ reply: listing() });
    const input = { session_id: 's-1', workspace: { current_dir: view.folder }, cwd: tmpFolder('devkit-bar-elsewhere-') };
    await main(['--lang', 'en'], { stdin: JSON.stringify(input), stateCommand: stub.command });
    assert.deepEqual(stub.calls().map((c) => real(c.cwd)), [view.folder]);
  });
});

// Invariant (B-2): cwd is the folder when workspace gives none; and every field must be a non-empty string to count.
test('run-status-bar AC-1 input: cwd is the folder when workspace is missing, empty or no string', async (t) => {
  for (const [label, input] of [
    ['workspace missing', { cwd: '/b' }],
    ['workspace.current_dir empty', { workspace: { current_dir: '' }, cwd: '/b' }],
    ['workspace.current_dir a number', { workspace: { current_dir: 7 }, cwd: '/b' }],
    ['workspace not an object', { workspace: 'x', cwd: '/b' }],
  ]) {
    await t.test(label, () => assert.deepEqual(inputOf(JSON.stringify(input), '/process'), { folder: '/b', session: null }));
  }
  await t.test('a session_id that is empty or no string is no session', () => {
    assert.equal(inputOf(JSON.stringify({ session_id: '', cwd: '/b' }), '/process').session, null);
    assert.equal(inputOf(JSON.stringify({ session_id: 12, cwd: '/b' }), '/process').session, null);
  });
  await t.test('every other field is ignored, the transcript included', () => {
    assert.deepEqual(inputOf(JSON.stringify({ cwd: '/b', transcript_path: '/t.jsonl', model: { id: 'x' }, context_window: {} }), '/process'), { folder: '/b', session: null });
  });
});

// Invariant (B-3 to B-6): an input that cannot be read as an object is "no fields": the process's folder and no session.
const NO_FIELDS = { folder: '/process', session: null };
test('run-status-bar AC-1 input: empty standard input reads as the process folder and no session', () => {
  assert.deepEqual(inputOf('', '/process'), NO_FIELDS);
  assert.deepEqual(inputOf('  \n', '/process'), NO_FIELDS);
  assert.equal(inputOf('', undefined).folder, process.cwd(), 'the default folder is the process\'s own');
});
test('run-status-bar AC-1 input: input that is not JSON reads as no fields', () => {
  assert.deepEqual(inputOf('not json at all', '/process'), NO_FIELDS);
});
test('run-status-bar AC-1 input: an unclosed object reads as no fields, whatever it already shows', () => {
  assert.deepEqual(inputOf('{"session_id":"s-1","cwd":"/b"', '/process'), NO_FIELDS);
});
test('run-status-bar AC-1 input: JSON that is no object reads as no fields', async (t) => {
  for (const text of ['[1,2]', '["cwd"]', '"cwd"', 'null', '7', 'true']) await t.test(text, () => assert.deepEqual(inputOf(text, '/process'), NO_FIELDS));
});

// ---------------------------------------------------------------- the choice of line (D-3)

// Invariant (B-7): the session the run file records prints the counts line, from the main checkout and from a change's worktree,
// and its one call is the offline listing.
test('run-status-bar AC-3 choice: the coordinator session prints the counts line from any of its folders', async (t) => {
  const entries = [entry({ change: 'a' }), entry({ change: 'b', state: 'waiting-for-owner', stateIcon: ICON.owner })];
  const counts = `2 in play · 1 working · ${ICON.owner} 1 waiting on the owner · ${ICON.blocked} 0 blocked`;
  await t.test('the main checkout', async () => {
    const m = checkout();
    putRun(m, { session: COORD });
    const stub = stateStub({ reply: listing(...entries) });
    const r = await bar(m, COORD, stub);
    assert.deepEqual([r.stdout, r.stderr, r.code], [`${counts}\n`, '', 0]);
    assert.deepEqual(argvOf(stub), [['state', '--offline', '--lang', 'en']]);
  });
  await t.test('a change worktree (the coordinator wins over the change)', async () => {
    const m = checkout();
    putRun(m, { session: COORD });
    const stub = stateStub({ reply: listing(...entries) });
    const r = await bar(worktree(m, 'feat'), COORD, stub);
    assert.equal(r.stdout, `${counts}\n`);
    assert.deepEqual(argvOf(stub), [['state', '--offline', '--lang', 'en']]);
  });
});

// Invariant (B-8): the coordinator view needs the recorded session, never a missing one.
test('run-status-bar AC-4 choice: another session id, no session id and no run file print no counts line', async (t) => {
  await t.test('another session id', async () => {
    const m = checkout();
    putRun(m, { session: COORD });
    const stub = stateStub({ reply: listing(entry()) });
    const r = await bar(m, 'S-someone-else', stub);
    assert.deepEqual([r.stdout, r.code, stub.calls().length], ['', 0, 0]);
  });
  await t.test('no session id', async () => {
    const m = checkout();
    putRun(m, { session: COORD });
    const stub = stateStub({ reply: listing(entry()) });
    assert.deepEqual([(await bar(m, null, stub)).stdout, stub.calls().length], ['', 0]);
  });
  await t.test('a run file whose session is null and an input with no session: no session equals no session', async () => {
    const m = checkout();
    putRun(m, { session: null });
    const stub = stateStub({ reply: listing(entry()) });
    assert.deepEqual([(await bar(m, null, stub)).stdout, stub.calls().length], ['', 0]);
  });
  await t.test('no run file', async () => {
    const stub = stateStub({ reply: listing(entry()) });
    assert.deepEqual([(await bar(checkout(), COORD, stub)).stdout, stub.calls().length], ['', 0]);
  });
  await t.test('in a change worktree another session reads the change, not the listing', async () => {
    const m = checkout();
    putRun(m, { session: COORD });
    const stub = stateStub({ reply: listing() });
    await bar(worktree(m, 'feat'), 'S-someone-else', stub);
    assert.deepEqual(argvOf(stub), [['state', '--change', 'feat', '--lang', 'en']]);
  });
});

// Invariant (B-9): a change's worktree on the change's own branch prints that change's line (the mock's implementation moment).
test('run-status-bar AC-1 choice: a change worktree on its branch prints its line', async (t) => {
  await t.test('the line', async () => {
    const view = lone();
    const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
    const r = await bar(view.folder, null, stub);
    assert.deepEqual([r.stdout, r.stderr, r.code], [`${ICON.code} feat · Implementation · ${strip(10)} · 11 of 15\n`, '', 0]);
    assert.deepEqual(argvOf(stub), [view.args]);
  });
  await t.test('the entry\'s root is compared through realpath (a link to the worktree)', async () => {
    const view = lone();
    const link = join(tmpFolder('devkit-bar-link-'), 'wt');
    symlinkSync(view.folder, link);
    const stub = stateStub({ reply: listing(entry({ root: link })) });
    assert.match((await bar(view.folder, null, stub)).stdout, /^.* feat · Implementation · /u);
  });
  await t.test('a subfolder of the worktree is the same checkout', async () => {
    const view = lone();
    const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
    assert.match((await bar(join(view.folder, 'openspec'), null, stub)).stdout, /feat · Implementation/);
  });
});

// Invariant (B-10): the archive branch names its change; the one state call keeps GitHub (design D-4).
test('run-status-bar AC-1 choice: an archive branch reads its change and prints its line, the one call not offline', async () => {
  const m = checkout({ changes: {} });
  const wt = worktree(m, 'chore/archive-feat', 'archive-feat');
  const stub = stateStub({ reply: listing(entry({ root: wt, branch: 'chore/archive-feat', state: 'blocked', stateIcon: ICON.blocked, reason: { code: 'x', text: 'a correction' } })) });
  const r = await bar(wt, null, stub);
  assert.deepEqual(argvOf(stub), [['state', '--change', 'feat', '--lang', 'en']]);
  assert.ok(!argvOf(stub)[0].includes('--offline'));
  assert.equal(r.stdout, `${ICON.blocked} ${ICON.code} feat · Implementation · ${strip(10)} · 11 of 15 · a correction\n`);
});

// Invariant (B-11): where no change is conducted, nothing is printed and `state` is not run.
test('run-status-bar AC-4 choice: a branch with no change folder, a detached HEAD and main print nothing and run no state', async (t) => {
  for (const [label, folderOf] of [
    ['a branch with no change folder', () => worktree(checkout(), 'topic')],
    ['a detached HEAD', () => { const m = checkout(); const wt = worktree(m, 'feat'); git(wt, 'checkout', '-q', '--detach'); return wt; }],
    ['main', () => checkout()],
    ['an archive branch of an unusable id', () => worktree(checkout(), 'chore/archive---x', 'archive-x')],
  ]) {
    await t.test(label, async () => {
      const stub = stateStub({ reply: listing(entry()) });
      const r = await bar(folderOf(), null, stub);
      assert.deepEqual([r.stdout, r.stderr, r.code, stub.calls().length], ['', '', 0, 0]);
    });
  }
});

// Invariant (B-12): the line is drawn only for an entry that names this checkout and this branch.
test('run-status-bar AC-4 choice: an entry with another root or branch prints nothing', async (t) => {
  for (const [label, over] of [
    ['another root', { root: '/somewhere/else' }],
    ['no root', { root: null }],
    ['another branch', { branch: 'other' }],
    ['no branch', { branch: null }],
  ]) {
    await t.test(label, async () => {
      const view = lone();
      const stub = stateStub({ reply: listing(entry({ root: view.folder, ...over })) });
      const r = await bar(view.folder, null, stub);
      assert.deepEqual([r.stdout, r.code, stub.calls().length], ['', 0, 1]);
    });
  }
  await t.test('an archive branch whose entry names the plain branch', async () => {
    const wt = worktree(checkout({ changes: {} }), 'chore/archive-feat', 'archive-feat');
    const stub = stateStub({ reply: listing(entry({ root: wt, branch: 'feat' })) });
    assert.equal((await bar(wt, null, stub)).stdout, '');
  });
  await t.test('no entry for the change', async () => {
    const view = lone();
    const stub = stateStub({ reply: listing(entry({ change: 'other', root: view.folder })) });
    assert.equal((await bar(view.folder, null, stub)).stdout, '');
  });
});

// Invariant (B-13): outside a conducted place the bar is empty and exits 0.
test('run-status-bar AC-4 choice: a folder that is no git checkout, or has no openspec folder, prints nothing and exits 0', async (t) => {
  await t.test('not a git folder', async () => {
    const stub = stateStub({ reply: listing(entry()) });
    const r = await bar(tmpFolder('devkit-bar-nogit-'), null, stub);
    assert.deepEqual([r.stdout, r.code, stub.calls().length], ['', 0, 0]);
  });
  await t.test('not a git folder, and a session id', async () => {
    const stub = stateStub({ reply: listing(entry()) });
    const r = await bar(tmpFolder('devkit-bar-nogit-'), COORD, stub);
    assert.deepEqual([r.stdout, r.code, stub.calls().length], ['', 0, 0]);
  });
  await t.test('a git folder on a branch with no openspec folder', async () => {
    const root = real(tmpFolder('devkit-bar-noopenspec-'));
    git(root, 'init', '-q', '-b', 'feat');
    writeFileSync(join(root, 'README.md'), 'x\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'x');
    const stub = stateStub({ reply: listing(entry()) });
    const r = await bar(root, null, stub);
    assert.deepEqual([r.stdout, r.code, stub.calls().length], ['', 0, 0]);
  });
  await t.test('a folder that does not exist', async () => {
    const stub = stateStub({ reply: listing(entry()) });
    assert.deepEqual([(await bar(join(tmpFolder('devkit-bar-gone-'), 'missing'), null, stub)).stdout, stub.calls().length], ['', 0]);
  });
});

// ---------------------------------------------------------------- the calls (D-3, D-4)

// Invariant (B-14): one refresh makes at most one state call.
test('run-status-bar AC-5 calls: each refresh makes at most one state call', async (t) => {
  for (const [label, make] of [['the coordinator', coordinator], ['a change worktree', lone]]) {
    await t.test(label, async () => {
      const view = make();
      const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
      await bar(view.folder, view.session, stub);
      assert.deepEqual(argvOf(stub), [view.args]);
    });
  }
  await t.test('the coordinator inside a change worktree', async () => {
    const m = checkout();
    putRun(m, { session: COORD });
    const stub = stateStub({ reply: listing(entry()) });
    await bar(worktree(m, 'feat'), COORD, stub);
    assert.equal(stub.calls().length, 1);
  });
  await t.test('a session that conducts nothing makes none', async () => {
    const stub = stateStub({ reply: listing(entry()) });
    await bar(checkout(), 'S-none', stub);
    assert.equal(stub.calls().length, 0);
  });
});

// Invariant (B-15): the call the bar makes at a plan stage reads no GitHub (a logging gh first on PATH), asked of the command and of the whole bar.
test('run-status-bar AC-5 calls: a plan-stage state --change in a real process makes no gh call', async (t) => {
  const planned = () => {
    const root = real(planChange({ have: ['requirements', 'proposal'] }));
    git(root, 'checkout', '-q', '-b', 'feat');
    const gh = fakeGh();
    return { root, gh, env: { ...gh.env, ...SET } };
  };
  await t.test('the state command', () => {
    const p = planned();
    const r = spawnSync(process.execPath, [LOOP, 'state', '--change', 'feat', '--lang', 'en'], { cwd: p.root, env: p.env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(JSON.parse(r.stdout).changes[0].change, 'feat');
    assert.deepEqual(p.gh.calls(), []);
  });
  await t.test('the bar', () => {
    const p = planned();
    const r = spawnSync(process.execPath, [BAR, '--lang', 'en'], { cwd: p.root, env: p.env, input: JSON.stringify({ session_id: 'S-x', cwd: p.root }), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^.+ feat · .+ · \d+ of \d+\n$/u, 'the bar drew the change\'s line from the real state');
    assert.deepEqual(p.gh.calls(), []);
  });
});

// ---------------------------------------------------------------- when state cannot be read (D-9)

// Invariant (B-16 to B-18): whatever `state` does wrong, the bar is empty and exits 0.
const VIEWS = [['the coordinator', coordinator], ['a change worktree', lone]];
test('run-status-bar AC-5 failure: state exits 3 and the bar prints nothing, exit 0', async (t) => {
  for (const [label, make] of VIEWS) {
    await t.test(label, async () => {
      const view = make();
      const stub = stateStub({ reply: JSON.stringify(listing(entry({ root: view.folder }))), exit: 3 });
      const r = await bar(view.folder, view.session, stub);
      assert.deepEqual([r.stdout, r.stderr, r.code, stub.calls().length], ['', '', 0, 1]);
    });
  }
});
test('run-status-bar AC-5 failure: state prints no JSON, or a JSON that is no listing, and the bar prints nothing', async (t) => {
  for (const [what, reply] of [['text', 'no change named x\n'], ['nothing', ''], ['an array', '[]'], ['an object with no changes', '{"version":1}'], ['changes that are no list', '{"version":1,"changes":"x"}']]) {
    for (const [label, make] of VIEWS) {
      await t.test(`${what}, ${label}`, async () => {
        const view = make();
        const r = await bar(view.folder, view.session, stateStub({ reply }));
        assert.deepEqual([r.stdout, r.code], ['', 0]);
      });
    }
  }
});
test('run-status-bar AC-5 failure: a state that passes the bound is killed, the bar prints nothing and exits 0', async (t) => {
  for (const [label, make] of VIEWS) {
    await t.test(label, async () => {
      const view = make();
      const stub = stateStub({ sleep: true });
      const r = await bar(view.folder, view.session, stub, { boundMs: 300 });
      assert.deepEqual([r.stdout, r.code], ['', 0]);
      const pid = stub.pid();
      assert.ok(pid, 'the fixture script ran');
      assert.equal(alive(pid), false, 'its process is gone');
    });
  }
});

// Invariant (B-19): an abort (what SIGTERM, SIGINT and SIGHUP do) ends the child before main returns.
test('run-status-bar AC-5 failure: an abort of the signal ends the state process before main returns', async (t) => {
  for (const [label, make] of VIEWS) {
    await t.test(label, async () => {
      const view = make();
      const stub = stateStub({ sleep: true });
      const abort = new AbortController();
      const started = Date.now();
      const pending = bar(view.folder, view.session, stub, { signal: abort.signal, boundMs: 15_000 });
      const pid = await until(() => stub.pid());
      abort.abort();
      const r = await pending;
      assert.deepEqual([r.stdout, r.code], ['', 0]);
      assert.equal(alive(pid), false, 'the child is gone when main returns');
      assert.ok(Date.now() - started < 10_000, 'the abort ended it, not the bound');
    });
  }
  await t.test('a signal already aborted runs no state at all', async () => {
    const view = lone();
    const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
    const abort = new AbortController();
    abort.abort();
    const r = await bar(view.folder, view.session, stub, { signal: abort.signal });
    assert.deepEqual([r.stdout, r.code], ['', 0]);
  });
});

// Invariant (B-19b, review round 1, code-quality F1): the bound and the abort end the whole process group of the state call, so what
// `state` itself started (`openspec`, `gh`) does not outlive it.
test('run-status-bar AC-5 failure: the bound and an abort also end the processes the state call started', async (t) => {
  for (const [label, make] of VIEWS) {
    await t.test(`${label}, at the bound`, async () => {
      const view = make();
      const stub = stateStub({ sleep: true, grandchild: true });
      const pending = bar(view.folder, view.session, stub, { boundMs: 1500 });
      const [pid, grandchild] = await until(() => stub.pid() && stub.grandchildPid() && [stub.pid(), stub.grandchildPid()]);
      const r = await pending;
      assert.deepEqual([r.stdout, r.code], ['', 0]);
      assert.deepEqual([alive(pid), alive(grandchild)], [false, false], 'the state process and the one it started are gone');
    });
    await t.test(`${label}, at an abort`, async () => {
      const view = make();
      const stub = stateStub({ sleep: true, grandchild: true });
      const abort = new AbortController();
      const pending = bar(view.folder, view.session, stub, { signal: abort.signal, boundMs: 15_000 });
      const [pid, grandchild] = await until(() => stub.pid() && stub.grandchildPid() && [stub.pid(), stub.grandchildPid()]);
      abort.abort();
      const r = await pending;
      assert.deepEqual([r.stdout, r.code], ['', 0]);
      assert.deepEqual([alive(pid), alive(grandchild)], [false, false], 'the state process and the one it started are gone');
    });
  }
});

// Invariant (B-19c, review round 1, test-coverage F1): the real process turns SIGTERM, SIGINT and SIGHUP into an abort, so the real
// `state` it started, and the `openspec` that `state` is waiting on, are gone when it exits. The `openspec` here is a shim first on PATH
// (outside the repository) that records its pid and sleeps; the bar is the real process on the real `state`, nothing injected.
test('run-status-bar AC-5 failure: SIGTERM, SIGINT and SIGHUP end the real bar and the real openspec its state is waiting on', async (t) => {
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    await t.test(signal, async () => {
      const root = real(planChange({ have: ['requirements', 'proposal'] }));
      git(root, 'checkout', '-q', '-b', 'feat');
      const shim = tmpFolder('devkit-bar-shim-');
      const pidFile = join(shim, 'openspec-pid');
      mkdirSync(join(shim, 'bin'));
      writeFileSync(join(shim, 'bin', 'openspec'), `#!/bin/sh\necho $$ > ${JSON.stringify(pidFile)}\nexec sleep 300\n`);
      chmodSync(join(shim, 'bin', 'openspec'), 0o755);
      const env = { ...process.env, ...SET, PATH: `${join(shim, 'bin')}:${process.env.PATH}` };
      const child = spawn(process.execPath, [BAR, '--lang', 'en'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stdin.end(JSON.stringify({ session_id: 'S-x', cwd: root }));
      const closed = new Promise((resolve) => child.on('close', (code, by) => resolve({ code, by })));
      let pid = null;
      try {
        pid = Number(await until(() => (existsSync(pidFile) ? readFileSync(pidFile, 'utf8').trim() : '')));
        assert.equal(alive(pid), true, 'the real state is waiting on the openspec shim');
        const started = Date.now();
        child.kill(signal);
        const ended = await closed;
        assert.deepEqual([ended.code, ended.by, out], [0, null, ''], 'the bar exits 0 and prints nothing');
        assert.ok(Date.now() - started < 10_000, 'the signal ended it, not the bound');
        assert.equal(alive(pid), false, 'the openspec of the state call is gone when the bar has exited');
      } finally {
        // a failing run must not leave the shim, or the `state` waiting on it, behind
        if (pid !== null && alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone already */ } }
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }
    });
  }
});

// ---------------------------------------------------------------- the settings snippet (D-12)

// Invariant (B-47, review round 1, test-coverage F3): the `statusLine` command the README tells the owner to paste, run by `sh -c`
// against a fake plugin cache (named by CLAUDE_CONFIG_DIR, the variable the snippet reads), starts the newest installed copy with the
// language option, and with no copy prints nothing and exits 0. The docs carry the same text.
const SNIPPET_OF = (file) => {
  const block = /```json\n(\{ "statusLine".*\})\n```/.exec(readFileSync(file, 'utf8'));
  assert.ok(block, `${file} holds the statusLine snippet`);
  return JSON.parse(block[1]).statusLine;
};
const README = join(HERE, '..', 'README.md');
const FLOW_DOC = join(HERE, '..', '..', '..', 'docs', 'openspec-flow.md');
function fakeCache(...versions) {
  const config = tmpFolder('devkit-bar-config-');
  for (const version of versions) {
    const hooks = join(config, 'plugins', 'cache', 'devkit', 'devkit-openspec', version, 'hooks');
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'status-line.mjs'), `process.stdout.write(${JSON.stringify(`${version} `)} + process.argv.slice(2).join(' ') + '\\n');\n`);
  }
  return config;
}
const runSnippet = (config) => spawnSync('sh', ['-c', SNIPPET_OF(README).command], {
  cwd: tmpFolder('devkit-bar-snippet-'), encoding: 'utf8', input: '{}', env: { ...process.env, CLAUDE_CONFIG_DIR: config, HOME: tmpFolder('devkit-bar-home-') },
});
test('run-status-bar AC-1 snippet: the README command starts the newest installed copy, and with none prints nothing and exits 0', async (t) => {
  await t.test('the docs carry the same entry as the README', () => assert.deepEqual(SNIPPET_OF(FLOW_DOC), SNIPPET_OF(README)));
  await t.test('it is a command entry', () => assert.equal(SNIPPET_OF(README).type, 'command'));
  await t.test('two versions: 0.10.0 is newer than 0.9.0 (the sort -V case)', () => {
    const r = runSnippet(fakeCache('0.9.0', '0.10.0'));
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, '0.10.0 --lang pt-BR\n', '']);
  });
  await t.test('one version', () => {
    const r = runSnippet(fakeCache('0.40.0'));
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, '0.40.0 --lang pt-BR\n', '']);
  });
  await t.test('no copy of the plugin: nothing on either stream, exit 0', () => {
    const r = runSnippet(tmpFolder('devkit-bar-config-'));
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', '']);
  });
  await t.test('the plugin folder holds no version: nothing, exit 0', () => {
    const config = tmpFolder('devkit-bar-config-');
    mkdirSync(join(config, 'plugins', 'cache', 'devkit', 'devkit-openspec'), { recursive: true });
    const r = runSnippet(config);
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', '']);
  });
  await t.test('with no CLAUDE_CONFIG_DIR the copy is under $HOME/.claude', () => {
    const home = tmpFolder('devkit-bar-home-');
    const hooks = join(home, '.claude', 'plugins', 'cache', 'devkit', 'devkit-openspec', '0.1.0', 'hooks');
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'status-line.mjs'), "process.stdout.write('home copy\\n');\n");
    const { CLAUDE_CONFIG_DIR: _unset, ...env } = process.env;
    const r = spawnSync('sh', ['-c', SNIPPET_OF(README).command], { cwd: home, encoding: 'utf8', input: '{}', env: { ...env, HOME: home } });
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, 'home copy\n', '']);
  });
});

// ---------------------------------------------------------------- the change's line (D-5)

const ofEntry = (over, lang = 'en') => lineOfChange(entry(over), lang);

// Invariant (B-20 to B-25): the icons, the title, the strip, the progress and the reason by state.
test('run-status-bar AC-1 line: running has no state icon and no reason', () => {
  assert.equal(ofEntry({}), `${ICON.code} feat · Implementation · ${strip(10)} · 11 of 15`);
});
test('run-status-bar AC-1 line: waiting-for-owner has the owner icon and the reason', () => {
  assert.equal(lineOfChange(ASKING('your approval of the plan'), 'en'), `${ASKING_HEAD} · your approval of the plan`);
});
test('run-status-bar AC-1 line: waiting-on-github has the hourglass and the reason', () => {
  const line = ofEntry({ state: 'waiting-on-github', stateIcon: ICON.github, stage: 'delivery', stageTitle: 'Delivery', stageIcon: ICON.ship, reason: { code: 'checks', text: 'the checks of its pull request' } });
  assert.equal(line, `${ICON.github} ${ICON.ship} feat · Delivery · ${strip(13)} · 14 of 15 · the checks of its pull request`);
});
test('run-status-bar AC-1 line: blocked has the stop icon and the reason', () => {
  const line = ofEntry({ state: 'blocked', stateIcon: ICON.blocked, reason: { code: 'ceiling', text: 'a correction' } });
  assert.equal(line, `${ICON.blocked} ${ICON.code} feat · Implementation · ${strip(10)} · 11 of 15 · a correction`);
});
test('run-status-bar AC-1 line: archived shows its icon once, no strip and no progress', () => {
  const line = ofEntry({ state: 'archived', stateIcon: ICON.archived, stageIcon: ICON.archived, stage: null, stageTitle: null, stages: null, reason: null });
  assert.equal(line, `${ICON.archived} feat`);
});
test('run-status-bar AC-1 line: a running change with the reason ready, or a held one, shows no reason', async (t) => {
  await t.test('ready', () => assert.equal(ofEntry({ reason: { code: 'ready', text: 'ready, waiting for someone to continue' } }), ofEntry({})));
  await t.test('held for a place', () => assert.equal(ofEntry({ stateIcon: ICON.github, reason: { code: 'held-place', text: 'open, waiting for a place' } }), `${ICON.github} ${ICON.code} feat · Implementation · ${strip(10)} · 11 of 15`));
});

// Invariant (B-26): the strip is positional: done before the current stage, the current one, not yet after it.
test('run-status-bar AC-1 strip: the first stage, a middle one and the last one', async (t) => {
  const at = (stage, title) => ofEntry({ stage, stageTitle: title });
  await t.test('first', () => assert.match(at('open', 'Open'), / · ◆□□□□□□□□□□□□□□ · 1 of 15$/u));
  await t.test('middle', () => assert.match(at('approval', 'Approval'), / · ■■■■■■■■■◆□□□□□ · 10 of 15$/u));
  await t.test('last', () => assert.match(at('retro', 'Retro'), / · ■■■■■■■■■■■■■■◆ · 15 of 15$/u));
});

// Invariant (B-27): no list, or a list without the stage, draws no strip and no progress; the rest of the line stays.
test('run-status-bar AC-1 strip: stages null, and a stage the list does not hold, draw neither strip nor progress', async (t) => {
  await t.test('stages null', () => assert.equal(ofEntry({ stages: null }), `${ICON.code} feat · Implementation`));
  await t.test('a stage outside the list', () => assert.equal(ofEntry({ stage: 'mockup', stages: STAGES.filter((s) => s !== 'mockup') }), `${ICON.code} feat · Implementation`));
  await t.test('an empty list', () => assert.equal(ofEntry({ stages: [] }), `${ICON.code} feat · Implementation`));
  await t.test('no stage title and a reason', () => {
    assert.equal(ofEntry({ stageTitle: null, stages: null, state: 'blocked', stateIcon: ICON.blocked, reason: { code: 'x', text: 'why' } }), `${ICON.blocked} ${ICON.code} feat · why`);
  });
});

// ---------------------------------------------------------------- width and the cut rule (D-6)

// Invariant (B-28): an emoji counts two columns; combining marks and joiners none; the rest one.
test('run-status-bar AC-1 width: columns counts the emoji two and the rest one', async (t) => {
  for (const [text, width] of [[ICON.code, 2], [ICON.owner, 2], ['■', 1], ['…', 1], ['ç', 1], ['', 0], ['e\u{301}', 1], ['a\u{200D}b', 2], ['feat', 4]]) {
    await t.test(JSON.stringify(text), () => assert.equal(columns(text), width));
  }
});

// Invariant (B-29): step 1 of the cut, the reason loses its last words and ends in `…`, keeping its first word.
test('run-status-bar AC-1 cut: step 1 drops the reason\'s last words and ends it in an ellipsis', async (t) => {
  await t.test('words dropped one at a time until the line fits', () => {
    const line = lineOfChange(ASKING('alpha beta gamma delta epsilon zeta eta theta iota'), 'en');
    assert.equal(line, `${ASKING_HEAD} · alpha beta gamma delta epsilon zeta…`);
    assert.equal(columns(line), 97);
  });
  await t.test('the first word is kept when it fits with the ellipsis (exactly 100)', () => {
    const line = lineOfChange(ASKING(`${'x'.repeat(38)} second`), 'en');
    assert.equal(line, `${ASKING_HEAD} · ${'x'.repeat(38)}…`);
    assert.equal(columns(line), 100);
  });
});

// Invariant (B-30): step 2, the reason and its separator go when its first word will not fit.
test('run-status-bar AC-1 cut: step 2 drops the reason with its separator', async (t) => {
  await t.test('a first word that does not fit with the ellipsis', () => assert.equal(lineOfChange(ASKING(`${'x'.repeat(39)} second`), 'en'), ASKING_HEAD));
  await t.test('a reason of one word that is too long', () => assert.equal(lineOfChange(ASKING('y'.repeat(50)), 'en'), ASKING_HEAD));
});

// Invariant (B-31): step 3 cuts the id; the stage title, the strip and the progress are never cut. The numbers are D-6's.
test('run-status-bar AC-1 cut: step 3 cuts the id at its end, keeping at least 20 columns, and never the rest', async (t) => {
  await t.test('a 60-letter id keeps 50 letters and the ellipsis, the line is exactly 100', () => {
    const line = ofEntry({ change: 'a'.repeat(60) });
    assert.equal(line, `${ICON.code} ${'a'.repeat(50)}… · Implementation · ${strip(10)} · 11 of 15`);
    assert.equal(columns(line), 100);
  });
  await t.test('a 60-letter stage title leaves the id its 20 letters; the line, 116 wide, is printed as it is', () => {
    const title = 't'.repeat(60);
    const line = ofEntry({ change: 'b'.repeat(40), stageTitle: title });
    assert.equal(line, `${ICON.code} ${'b'.repeat(20)}… · ${title} · ${strip(10)} · 11 of 15`);
    assert.equal(columns(line), 116);
  });
  await t.test('a 70-letter id with the reason: the reason goes first, then the id', () => {
    const line = lineOfChange(ASKING('your approval of the plan', { change: 'c'.repeat(70) }), 'en');
    assert.ok(columns(line) <= 100);
    assert.ok(line.includes(`${'c'.repeat(20)}`) && line.includes('…'));
    assert.ok(!line.includes('your approval'), 'no reason left');
    assert.ok(line.endsWith(` · Owner's approval · ${strip(9)} · 10 of 15`));
  });
});

// Invariant (B-32): the limit is 100 inclusive.
test('run-status-bar AC-1 cut: a line of exactly 100 columns is not cut', () => {
  const reason = `${'a'.repeat(19)} ${'b'.repeat(19)}`;
  const line = lineOfChange(ASKING(reason), 'en');
  assert.equal(columns(line), 100);
  assert.equal(line, `${ASKING_HEAD} · ${reason}`);
  assert.equal(lineOfChange(ASKING(`${'a'.repeat(19)} ${'b'.repeat(20)}`), 'en'), `${ASKING_HEAD} · ${'a'.repeat(19)}…`, 'one column more is cut');
});

// ---------------------------------------------------------------- the coordinator's counts (D-7)

const several = (n, over) => Array.from({ length: n }, (_, i) => entry({ change: `c${i}`, ...over }));
const WAITING = { state: 'waiting-for-owner', stateIcon: ICON.owner };
const BLOCKED = { state: 'blocked', stateIcon: ICON.blocked };

// Invariant (B-33 to B-35).
test('run-status-bar AC-3 counts: the mix of the criterion', () => {
  const changes = [...several(3, {}), ...several(2, WAITING), ...several(1, BLOCKED)];
  assert.equal(countsLine(changes, 'en'), `6 in play · 3 working · ${ICON.owner} 2 waiting on the owner · ${ICON.blocked} 1 blocked`);
});
test('run-status-bar AC-3 counts: an empty listing prints the four zeros', () => {
  assert.equal(countsLine([], 'en'), `0 in play · 0 working · ${ICON.owner} 0 waiting on the owner · ${ICON.blocked} 0 blocked`);
});
test('run-status-bar AC-3 counts: waiting-on-github and archived count in play only', () => {
  const changes = [...several(2, {}), ...several(1, { state: 'waiting-on-github' }), ...several(1, { state: 'archived' })];
  assert.equal(countsLine(changes, 'en'), `4 in play · 2 working · ${ICON.owner} 0 waiting on the owner · ${ICON.blocked} 0 blocked`);
});
// Invariant (B-36): a listing that fails prints nothing, whatever the way it fails.
test('run-status-bar AC-3 counts: a listing that fails prints nothing', async (t) => {
  const view = coordinator();
  for (const [label, stub] of [
    ['exit 3', stateStub({ reply: JSON.stringify(listing(entry())), exit: 3 })],
    ['text', stateStub({ reply: 'no change named delivery-train\n' })],
    ['changes that are no list', stateStub({ reply: '{"version":1,"changes":{}}' })],
  ]) {
    await t.test(label, async () => {
      const r = await bar(view.folder, view.session, stub);
      assert.deepEqual([r.stdout, r.code], ['', 0]);
    });
  }
});

// ---------------------------------------------------------------- the words (D-8)

// Invariant (B-37): the bar's own words follow the language; the codes, icons, marks and numbers do not.
test('run-status-bar AC-6 language: of/de, the counts words and the singular of blocked follow the language', async (t) => {
  await t.test('of and de, the rest equal', () => {
    const en = lineOfChange(ASKING('x'), 'en');
    const pt = lineOfChange(ASKING('x'), 'pt-BR');
    assert.match(en, / · 10 of 15 · x$/);
    assert.match(pt, / · 10 de 15 · x$/);
    assert.equal(pt.replace(' de 15', ' of 15'), en);
  });
  await t.test('a language that is neither is Brazilian Portuguese, as everywhere', () => assert.match(lineOfChange(ASKING('x'), 'fr'), / · 10 de 15/));
  for (const [blocked, word] of [[0, 'bloqueadas'], [1, 'bloqueada'], [2, 'bloqueadas']]) {
    await t.test(`${blocked} blocked`, () => {
      const changes = [...several(3, {}), ...several(blocked, BLOCKED)];
      assert.equal(countsLine(changes, 'pt-BR'), `${3 + blocked} em jogo · 3 em andamento · ${ICON.owner} 0 aguardando o dono · ${ICON.blocked} ${blocked} ${word}`);
      assert.equal(countsLine(changes, 'en'), `${3 + blocked} in play · 3 working · ${ICON.owner} 0 waiting on the owner · ${ICON.blocked} ${blocked} blocked`);
    });
  }
});
test('run-status-bar AC-6 language: the four new message keys exist in both languages, with the words of the design', () => {
  const words = {
    en: { 'bar.progress': '{n} of {total}', 'bar.counts': `{all} in play · {running} working · ${ICON.owner} {waiting} waiting on the owner · ${ICON.blocked} {blocked} {blockedWord}`, 'bar.blocked-one': 'blocked', 'bar.blocked-other': 'blocked' },
    'pt-BR': { 'bar.progress': '{n} de {total}', 'bar.counts': `{all} em jogo · {running} em andamento · ${ICON.owner} {waiting} aguardando o dono · ${ICON.blocked} {blocked} {blockedWord}`, 'bar.blocked-one': 'bloqueada', 'bar.blocked-other': 'bloqueadas' },
  };
  for (const [lang, table] of Object.entries(words)) for (const [key, text] of Object.entries(table)) assert.equal(MESSAGES[lang][key], text, `${lang} ${key}`);
});

// Invariant (B-37b, review round 1, test-coverage F2): the language the bar normalizes is the one the `state` call gets, in both views,
// so the stage titles and reasons it prints are in the language of the bar's own words.
test('run-status-bar AC-6 language: the language reaches the state call of the coordinator and of a change worktree', async (t) => {
  for (const [given, passed] of [['pt-BR', 'pt-BR'], ['fr', 'pt-BR'], ['en', 'en']]) {
    for (const [label, make] of VIEWS) {
      await t.test(`--lang ${given}, ${label}`, async () => {
        const view = make();
        const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
        const r = await bar(view.folder, view.session, stub, { argv: ['--lang', given] });
        assert.deepEqual(argvOf(stub), [[...view.args.slice(0, -1), passed]]);
        assert.equal(r.code, 0);
        if (label === 'a change worktree') assert.match(r.stdout, passed === 'en' ? / · 11 of 15\n$/ : / · 11 de 15\n$/, 'the line is drawn in the same language');
        else assert.match(r.stdout, passed === 'en' ? /^1 in play · 1 working/ : /^1 em jogo · 1 em andamento/, 'the counts are drawn in the same language');
      });
    }
  }
});

// ---------------------------------------------------------------- no budget (D-2)

// Invariant (B-39): a budget cap in the project and a transcript on the input change nothing: no share, no word about it.
test('run-status-bar AC-2 budget: a cap in the config and a transcript on the input give no percentage and no word about it', async (t) => {
  const transcript = join(tmpFolder('devkit-bar-transcript-'), 'session.jsonl');
  writeFileSync(transcript, `${JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 900_000, output_tokens: 50_000 } } })}\n`);
  for (const lang of ['en', 'pt-BR']) {
    for (const [label, make] of VIEWS) {
      await t.test(`${lang}, ${label}`, async () => {
        const view = make();
        appendFileSync(join(view.folder, 'openspec', 'config.yaml'), 'devkit:\n  budget: 1000000\n');
        const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
        const input = { ...asInput(view.folder, view.session), transcript_path: transcript };
        const r = await main(['--lang', lang], { stdin: JSON.stringify(input), stateCommand: stub.command });
        assert.notEqual(r.stdout, '', 'a line was drawn, so the check below looks at something');
        assert.doesNotMatch(r.stdout, /%|budget|orçamento|orcamento|token/i);
        assert.equal(r.stderr, '');
      });
    }
  }
});

// ---------------------------------------------------------------- read only (D-10)

// What a run of the bar must leave as it was: the checkout's status, the run file and the list of worktrees.
const snapshot = (folder) => JSON.stringify({
  status: git(folder, 'status', '--porcelain', '--untracked-files=all'),
  worktrees: git(folder, 'worktree', 'list', '--porcelain'),
  run: existsSync(runFileOf(folder)) ? readFileSync(runFileOf(folder), 'utf8') : null,
});

// Invariant (B-40): a run in each view changes nothing and prints no loop marker.
test('run-status-bar AC-5 read-only: git status, the run file and the worktree list are as they were, and no loop marker is printed', async (t) => {
  for (const [label, make] of VIEWS) {
    await t.test(label, async () => {
      const view = make();
      putRun(view.folder, { session: COORD });
      const before = snapshot(view.folder);
      const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
      const r = await bar(view.folder, view.session, stub);
      assert.equal(snapshot(view.folder), before);
      assert.doesNotMatch(r.stdout + r.stderr, /devkit-(run|end):/);
      assert.equal(stub.calls().length, 1);
    });
  }
});

// Invariant (B-41): the source holds no write, no other program, no read of a transcript or a cap (D-10).
test('run-status-bar AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap', async (t) => {
  const source = readFileSync(BAR, 'utf8');
  await t.test('the only fs functions are read-only ones', () => {
    const fs = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'node:fs'/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));
    assert.ok(fs.length > 0, 'it imports fs for the folder checks');
    for (const name of fs) assert.ok(['existsSync', 'statSync', 'realpathSync', 'readFileSync'].includes(name), `fs: ${name}`);
    assert.doesNotMatch(source, /from 'node:fs\/promises'|require\(/);
  });
  await t.test('no write call but the two standard streams', () => {
    const bare = source.replaceAll('process.stdout.write(', '').replaceAll('process.stderr.write(', '');
    assert.doesNotMatch(bare, /\b(?:write|append|mkdir|rm|rmdir|unlink|rename|copyFile|truncate|chmod|chown|symlink|link|utimes|createWriteStream|open)\w*\s*\(/);
  });
  await t.test('every spawned program is node, git or the injected state command', () => {
    const calls = [...source.matchAll(/\b(spawn|spawnSync|execFile|execFileSync|exec|execSync|fork)\s*\(\s*([^,)]+)/g)].filter((m) => !/^(?:import|function)/.test(m[0]));
    assert.ok(calls.length >= 2, 'it spawns git and the state command');
    for (const [, fn, first] of calls) {
      assert.ok(['spawn', 'execFileSync'].includes(fn), `no ${fn}`);
      assert.ok(["'git'", 'process.execPath', 'program'].includes(first.trim()), `${fn} of ${first}`);
    }
    assert.doesNotMatch(source, /shell\s*:/);
    assert.doesNotMatch(source, /['"](?:gh|claude|curl|sh|bash)['"]/);
  });
  await t.test('no read of a transcript, a cap or a spent count, and no loop marker', () => {
    assert.doesNotMatch(source, /transcript_path|spentOf|budget/i);
    assert.doesNotMatch(source, /devkit-(?:run|end):/);
  });
});

// ---------------------------------------------------------------- the mock-up (D-12 AC-7)

const MOMENTS = [
  { stage: 'requirements', icon: ICON.ask, code: 'grill', title: { en: 'Requirements (grill)', 'pt-BR': 'Requisitos (grill)' }, text: { en: 'your answers about its request', 'pt-BR': 'as suas respostas sobre o pedido' } },
  { stage: 'mockup', icon: ICON.plan, code: 'waiting-mockup', title: { en: 'Screen mock-up', 'pt-BR': 'Mock-up de tela' }, text: { en: 'your approval of the mock-up', 'pt-BR': 'a sua aprovação do mock-up' } },
  { stage: 'approval', icon: ICON.plan, code: 'waiting-approval', title: { en: "Owner's approval", 'pt-BR': 'Aprovação do dono' }, text: { en: 'your approval of the plan', 'pt-BR': 'a sua aprovação do plano' } },
  { stage: 'implementation', icon: ICON.code, code: null, title: { en: 'Implementation', 'pt-BR': 'Implementação' }, text: null },
];
const momentEntry = (m, lang, over = {}) => entry({
  change: 'run-status-bar', stage: m.stage, stageTitle: m.title[lang], stageIcon: m.icon,
  ...(m.code === null ? {} : { state: 'waiting-for-owner', stateIcon: ICON.owner, reason: { code: m.code, text: m.text[lang] } }), ...over,
});

// Invariant (B-42): every line of mock/lone-change.md, character for character, from entries holding the mock's facts.
test('run-status-bar AC-7 mock: each line of the lone-change mock-up, in both languages and with the long id', async (t) => {
  for (const [lang, lines] of [['en', MOCK_LONE_EN], ['pt-BR', MOCK_LONE_PT]]) {
    await t.test(lang, () => {
      assert.equal(lines.length, MOMENTS.length);
      MOMENTS.forEach((m, i) => assert.equal(lineOfChange(momentEntry(m, lang), lang), lines[i], `moment ${i + 1}`));
    });
  }
  await t.test('the long id of the mock: the reason is cut by step 1 to exactly 100 columns', () => {
    const line = lineOfChange(momentEntry(MOMENTS[2], 'en', { change: 'roadmap-coordinator-followups' }), 'en');
    assert.equal(line, MOCK_LONG_ID);
    assert.equal(columns(line), 100);
  });
  await t.test('the widths the mock states: 97 and 98 cut, 104 whole', () => {
    assert.equal(columns(MOCK_LONE_EN[0]), 97);
    assert.equal(columns(MOCK_LONE_PT[0]), 98);
    assert.equal(columns(lineOfChange(momentEntry(MOMENTS[0], 'en', { stages: STAGES }), 'en').replace('…', ' request')), 104);
  });
});

// Invariant (B-43): every line of mock/roadmap-run.md, from the facts the mock records (ten running; the criterion's mix).
test('run-status-bar AC-7 mock: each line of the roadmap-run mock-up', async (t) => {
  await t.test('ten changes, all running', () => {
    assert.equal(countsLine(several(10, {}), 'en'), MOCK_ROADMAP.ten.en);
    assert.equal(countsLine(several(10, {}), 'pt-BR'), MOCK_ROADMAP.ten['pt-BR']);
  });
  await t.test('the mix of the criterion', () => {
    const mix = [...several(3, {}), ...several(2, WAITING), ...several(1, BLOCKED)];
    assert.equal(countsLine(mix, 'en'), MOCK_ROADMAP.mix.en);
    assert.equal(countsLine(mix, 'pt-BR'), MOCK_ROADMAP.mix['pt-BR']);
  });
});

// Invariant (B-44): the empty bar of mock/nothing-conducted.md: from the root checkout on main, a session no run file records.
test('run-status-bar AC-4 mock: a session that conducts nothing prints the empty bar of the mock-up', async () => {
  const stub = stateStub({ reply: listing(entry()) });
  const r = await bar(checkout(), 'S-ordinary', stub);
  assert.equal(r.stdout, MOCK_NOTHING);
  assert.deepEqual([r.stdout, r.stderr, r.code, stub.calls().length], ['', '', 0, 0]);
});

// ---------------------------------------------------------------- usage and the open input (D-1, D-2)

// Invariant (B-45): an option the bar does not know prints one line on standard error and nothing else, exit 0.
test('run-status-bar AC-1 usage: an unknown option prints nothing on standard output, one line on standard error, exit 0', async (t) => {
  for (const argv of [['--frobnicate'], ['--lang', 'en', '--frobnicate'], ['stray'], ['--lang']]) {
    await t.test(argv.join(' '), async () => {
      const view = lone();
      const stub = stateStub({ reply: listing(entry({ root: view.folder })) });
      const r = await bar(view.folder, null, stub, { argv });
      assert.equal(r.stdout, '');
      assert.equal(r.code, 0);
      assert.match(r.stderr, /^[^\n]+\n$/);
      assert.equal(stub.calls().length, 0);
    });
  }
});

// Invariant (B-46): the real process stops waiting for an input that stays open after 1 second (the 10-second default would fail this).
test('run-status-bar AC-1 input: a standard input left open is read as no fields after one second and the process exits 0', async () => {
  const folder = tmpFolder('devkit-bar-open-');
  const child = spawn(process.execPath, [BAR, '--lang', 'en'], { cwd: folder, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...SET } });
  child.stdin.on('error', () => {});
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  const started = Date.now();
  const guard = setTimeout(() => child.kill('SIGTERM'), 9000);
  const code = await new Promise((resolve) => child.on('close', (c, signal) => resolve(c ?? signal)));
  clearTimeout(guard);
  const took = Date.now() - started;
  assert.deepEqual([out, err, code], ['', '', 0]);
  assert.ok(took < 5000, `ended in ${took} ms`);
});
