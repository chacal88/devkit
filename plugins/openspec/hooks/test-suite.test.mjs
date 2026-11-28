// Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`
// suite-speed: the suite script (`scripts/test-suite.mjs`): its file list, arguments, parallel pool, per-file TMPDIR, leftover check,
// exit codes, signals and the check that no test file imports another test file. Every probe runs a copy of the script inside a
// synthetic tree and reads that run's output; the probe's own output never reaches this file's output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync, readdirSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import { suiteFiles, testImports } from '../../../scripts/test-suite.mjs';
import * as suiteScript from '../../../scripts/test-suite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'test-suite.mjs');
// Built from pieces, so the repository scans (the import check, the skip check) do not find them in this file.
const TEST_EXT = '.test' + '.mjs';
const IMPORT = 'imp' + 'ort';
const FROM = 'fr' + 'om';

const HOOKS = 'plugins/openspec/hooks';
const SETUP = 'plugins/openspec/skills/devkit/scripts';
const REVIEW = 'plugins/core/skills/review-change/scripts';
const COMPOZY_SETUP = 'plugins/compozy/kit/scripts';

// A small test file made only of node built-ins. `body` runs inside one async test.
function probe({ name = 'suite-speed probe passes', body = '' } = {}) {
  return [
    `${IMPORT} { test } ${FROM} 'node:test';`,
    `${IMPORT} assert ${FROM} 'node:assert/strict';`,
    `${IMPORT} { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, realpathSync } ${FROM} 'node:fs';`,
    `${IMPORT} { join } ${FROM} 'node:path';`,
    `test(${JSON.stringify(name)}, async () => {`,
    body,
    '});',
    '',
  ].join('\n');
}

// The variables a branch or a pull request run sets, blanked in every run of the script, so that the CI environment cannot leak into a
// test (CONTRIBUTING.md). A test that needs one sets it on purpose.
const BLANK_ENV = { GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', DEVKIT_BYPASS: '' };
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid', GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function gitIn(root, ...args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, ...GIT_IDENTITY } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} in ${root}: ${r.stderr}`);
  return r.stdout.trim();
}

// A synthetic repository: a copy of the script and the given files (path relative to the tree -> text). The tree is a git repository
// on a branch `feature` off `origin/main` (one base commit holds everything written) and holds `deliver-check.mjs` as a link to the real
// one (the mode loads it; Node resolves its imports from the real path); `git: false` makes the tree without `git init`, `link: false`
// without the link.
function tree(files, { git = true, link = true } = {}) {
  const root = tmpFolder('devkit-suite-tree-');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  copyFileSync(SCRIPT, join(root, 'scripts', 'test-suite.mjs'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  if (link) {
    mkdirSync(join(root, HOOKS), { recursive: true });
    symlinkSync(join(REPO_ROOT, HOOKS, 'deliver-check.mjs'), join(root, HOOKS, 'deliver-check.mjs'));
  }
  if (git) {
    gitIn(root, 'init', '-q', '-b', 'main');
    gitIn(root, 'add', '-A');
    gitIn(root, 'commit', '-q', '-m', 'base');
    gitIn(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    gitIn(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    gitIn(root, 'switch', '-q', '-c', 'feature');
  }
  return root;
}

// A commit on the tree's branch: the files written (path -> text) and committed.
function commitOnBranch(root, content, message = 'change') {
  for (const [path, text] of Object.entries(content)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', message);
}

// Where a run root lands for a TMPDIR `base` that holds `fileCount` files: under the base when it fits, else under the real /tmp.
function runParent(base, fileCount) {
  return suiteScript.runRootFits(realpathSync(base), suiteScript.runRootLimit(fileCount)) ? realpathSync(base) : realpathSync(suiteScript.SHORT_TMP);
}

const runRootLines = (out) => out.stdout.split('\n').filter((line) => line.startsWith('run root: '));

// Starts the copy of the script in `root`; `done` settles when it has ended. `base` is the TMPDIR the script gets, so the
// run root it makes lives in a folder this test owns. The default prefix is short (devkit-b-) so that the inner run root
// fits under the suite's own TMPDIR (suite-socket-path). NODE_TEST_CONTEXT is left in the environment on purpose.
function start(root, args = [], { env = {}, base = tmpFolder('devkit-b-') } = {}) {
  const child = spawn(process.execPath, [join(root, 'scripts', 'test-suite.mjs'), ...args], {
    cwd: root,
    env: { ...process.env, ...BLANK_ENV, TMPDIR: base, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const seen = { stdout: '', stderr: '' };
  child.stdout.on('data', (chunk) => { seen.stdout += chunk; });
  child.stderr.on('data', (chunk) => { seen.stderr += chunk; });
  const done = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal, base, get stdout() { return seen.stdout; }, get stderr() { return seen.stderr; } }));
  });
  return { child, seen, done, base };
}

const run = (root, args, options) => start(root, args, options).done;
const startLines = (out) => out.stdout.split('\n').filter((line) => line.startsWith('start ')).map((line) => line.slice(6));
const either = (out) => out.stdout + out.stderr;

test('suite-speed AC-1 started through a symlinked folder or file, the script still runs (a bad argument exits 2 with the usage)', () => {
  const root = tree({ [`${HOOKS}/a${TEST_EXT}`]: probe() });
  const links = tmpFolder('devkit-suite-links-');
  symlinkSync(join(root, 'scripts'), join(links, 'folder'));
  symlinkSync(join(root, 'scripts', 'test-suite.mjs'), join(links, 'file.mjs'));
  for (const path of [join(links, 'folder', 'test-suite.mjs'), join(links, 'file.mjs')]) {
    const r = spawnSync(process.execPath, [path, '--no-such-option'], { cwd: root, env: { ...process.env, TMPDIR: links }, encoding: 'utf8' });
    assert.equal(r.status, 2, `${path}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /^usage: node scripts\/test-suite\.mjs /m, `${path}: ${r.stderr}`);
  }
});

test('suite-speed AC-1 the script runs the test files of the four folders and no other', async () => {
  const root = tree({
    [`${HOOKS}/a${TEST_EXT}`]: probe(),
    [`${HOOKS}/sub/deeper${TEST_EXT}`]: probe(),
    [`${SETUP}/b${TEST_EXT}`]: probe(),
    [`${REVIEW}/c${TEST_EXT}`]: probe(),
    [`${COMPOZY_SETUP}/d${TEST_EXT}`]: probe(),
    [`${HOOKS}/notes.mjs`]: 'throw new Error("not a test file");\n',
    [`${HOOKS}/node_modules/dep/n${TEST_EXT}`]: probe({ body: 'assert.fail("node_modules is not read");' }),
    [`plugins/compozy/skills/x/c${TEST_EXT}`]: probe({ body: 'assert.fail("only the kit\'s scripts folder is in the suite");' }),
  });
  const out = await run(root, []);
  assert.equal(out.code, 0, either(out));
  assert.deepEqual(startLines(out).sort(), [
    `${COMPOZY_SETUP}/d${TEST_EXT}`,
    `${HOOKS}/a${TEST_EXT}`,
    `${HOOKS}/sub/deeper${TEST_EXT}`,
    `${REVIEW}/c${TEST_EXT}`,
    `${SETUP}/b${TEST_EXT}`,
  ].sort());
});

test('suite-speed AC-1 the repository suite holds every file the old command ran', () => {
  const ran = [
    'change-loop', 'compozy-driver', 'conduct-check', 'deliver-check', 'delivery-models', 'delivery-train', 'flow-check', 'guard', 'jira-task', 'merge-setup',
    'project-loop', 'release-merge', 'release-tags', 'roadmap-loop', 'stage-models', 'test-tmp', 'version-pin',
  ].map((name) => `${HOOKS}/${name}${TEST_EXT}`).concat(
    ['changes-under-way', 'gh-version', 'github-setup', 'install-schemas', 'project-settings', 'ship-entry'].map((name) => `${SETUP}/${name}${TEST_EXT}`),
    [`${REVIEW}/review-round${TEST_EXT}`],
    ['adoption', 'devkit-kit', 'gen-agents', 'install-kit', 'loop-templates'].map((name) => `${COMPOZY_SETUP}/${name}${TEST_EXT}`),
  );
  assert.equal(ran.length, 29);
  const listed = suiteFiles(REPO_ROOT);
  assert.deepEqual(ran.filter((file) => !listed.includes(file)), [], 'files the old command ran that the script does not list');
  assert.ok(listed.includes(`${HOOKS}/test-suite${TEST_EXT}`), 'this file is in the suite');
  assert.deepEqual(listed.filter((file) => file.startsWith('plugins/compozy/') && !file.startsWith(`${COMPOZY_SETUP}/`)), [], 'no other compozy test file');
  assert.deepEqual(listed.filter((file) => file.startsWith('plugins/panel/')), []);
});

// Invariant: the setup's new test files run because their folder is in the suite's list, and no test file is left under the two
// removed setup folders. Layer: suite wiring (project-setup D-10). Suite: test-suite. The old folder names are built from pieces (D-9).
test('setup AC-3 suite: the repository suite lists setup-block.test.mjs and kit-installer.test.mjs under the devkit skill\'s scripts, and no test file under the two removed setup folders', () => {
  const listed = suiteFiles(REPO_ROOT);
  for (const name of ['setup-block', 'kit-installer']) assert.ok(listed.includes(`${SETUP}/${name}${TEST_EXT}`), name);
  const removed = [`plugins/openspec/skills/${'openspec' + '-setup'}/`, `plugins/compozy/skills/${'compozy' + '-setup'}/`];
  assert.deepEqual(listed.filter((file) => removed.some((folder) => file.startsWith(folder))), []);
});

test('suite-speed AC-1 files run at the same time up to --concurrency', async () => {
  const marks = tmpFolder('devkit-suite-marks-');
  const waiting = (me, other) => probe({
    name: `suite-speed probe ${me} meets ${other}`,
    body: [
      `writeFileSync(join(process.env.PROBE_MARKS, ${JSON.stringify(me)}), 'here');`,
      'const deadline = Date.now() + Number(process.env.PROBE_WAIT_MS);',
      `while (!existsSync(join(process.env.PROBE_MARKS, ${JSON.stringify(other)}))) {`,
      `  if (Date.now() > deadline) assert.fail('the other file did not start');`,
      '  await new Promise((resolve) => setTimeout(resolve, 25));',
      '}',
    ].join('\n'),
  });
  const files = { [`${HOOKS}/a${TEST_EXT}`]: waiting('a', 'b'), [`${HOOKS}/b${TEST_EXT}`]: waiting('b', 'a') };
  const together = await run(tree(files), ['--concurrency=2'], { env: { PROBE_MARKS: marks, PROBE_WAIT_MS: '20000' } });
  assert.equal(together.code, 0, either(together));

  const alone = tmpFolder('devkit-suite-marks-');
  const apart = await run(tree(files), ['--concurrency=1'], { env: { PROBE_MARKS: alone, PROBE_WAIT_MS: '1500' } });
  assert.equal(apart.code, 1, either(apart));
  const out = apart.stdout;
  assert.ok(out.indexOf(`start ${HOOKS}/b${TEST_EXT}`) > out.indexOf(`=== ${HOOKS}/a${TEST_EXT}: FAIL`), 'the second file starts only after the first has ended');
});

test('suite-speed AC-1 a bad argument exits 2 and runs nothing', async () => {
  const root = tree({
    [`${HOOKS}/a${TEST_EXT}`]: probe(),
    [`plugins/compozy/skills/x/c${TEST_EXT}`]: probe(),
  });
  const bad = [
    ['--bogus'],
    ['--concurrency=0'],
    ['--concurrency=x'],
    ['--concurrency=-2'],
    ['--concurrency=1.5'],
    ['--concurrency='],
    ['--concurrency', '2'],
    ['--reporter='],
    ['--test-name-pattern='],
    [`plugins/compozy/skills/x/c${TEST_EXT}`],
    [`${HOOKS}/missing${TEST_EXT}`],
    [`${HOOKS}/a${TEST_EXT}`, '--bogus'],
  ];
  for (const args of bad) {
    const out = await run(root, args);
    assert.equal(out.code, 2, `${args.join(' ')}: ${either(out)}`);
    assert.deepEqual(startLines(out), [], `${args.join(' ')} started a file`);
    assert.match(out.stderr, /usage/i, `${args.join(' ')} prints no usage line`);
  }
});

test('suite-speed AC-1 a tree with no test file fails instead of passing empty', async () => {
  const out = await run(tree({ [`${HOOKS}/notes.mjs`]: 'export const a = 1;\n' }), []);
  assert.equal(out.code, 1, either(out));
  assert.match(either(out), /no test file/);
});

test('suite-speed AC-1 file arguments, the reporter and name patterns reach the children; a pattern that matches nothing is not an error', async () => {
  const root = tree({
    [`${HOOKS}/a${TEST_EXT}`]: probe({ name: 'suite-speed probe alpha' }),
    [`${HOOKS}/b${TEST_EXT}`]: probe({ name: 'suite-speed probe beta' }),
  });
  const only = await run(root, [`${HOOKS}/a${TEST_EXT}`, '--reporter=tap']);
  assert.equal(only.code, 0, either(only));
  assert.deepEqual(startLines(only), [`${HOOKS}/a${TEST_EXT}`]);
  assert.match(only.stdout, /^ok 1 - suite-speed probe alpha$/m, 'the tap reporter reached the child');
  assert.match(only.stdout, /suite: 1 files, 1 tests, 1 pass, 0 fail,/);

  const picked = await run(root, ['--test-name-pattern=beta']);
  assert.equal(picked.code, 0, either(picked));
  assert.ok(picked.stdout.includes('suite-speed probe beta'), 'beta did not run');
  assert.ok(!picked.stdout.includes('suite-speed probe alpha'), 'alpha ran although the pattern names beta');

  const none = await run(root, ['--test-name-pattern=^nothing matches this$']);
  assert.equal(none.code, 0, either(none));
  assert.ok(!none.stdout.includes('suite-speed probe'), 'a test ran although no name matches');

  const skipped = await run(root, ['--test-skip-pattern=alpha']);
  assert.equal(skipped.code, 0, either(skipped));
  assert.ok(skipped.stdout.includes('suite-speed probe beta'), 'beta did not run');
  assert.ok(!skipped.stdout.includes('suite-speed probe alpha'), 'alpha ran although the skip pattern names it');
});

test('suite-speed AC-3 a test file that imports another is refused by file and line before any file runs', async () => {
  const spec = `./helper${TEST_EXT}`;
  const head = `${IMPORT} { test } ${FROM} 'node:test';`;
  const root = tree({
    [`${HOOKS}/from-line${TEST_EXT}`]: [head, `${IMPORT} { shared } ${FROM} '${spec}';`, ''].join('\n'),
    [`${HOOKS}/side-effect${TEST_EXT}`]: [head, `${IMPORT} '${spec}';`, ''].join('\n'),
    [`${HOOKS}/multi-line${TEST_EXT}`]: [head, `${IMPORT} {`, '  one,', '  two,', `} ${FROM} '${spec}';`, ''].join('\n'),
    [`${HOOKS}/dynamic${TEST_EXT}`]: [head, `await ${IMPORT}('${spec}');`, ''].join('\n'),
    [`plugins/compozy/skills/x/outside${TEST_EXT}`]: [head, `${IMPORT} '${spec}';`, ''].join('\n'),
    [`${HOOKS}/clean${TEST_EXT}`]: probe(),
  });
  const out = await run(root, []);
  assert.equal(out.code, 1, either(out));
  assert.deepEqual(startLines(out), [], 'no file started');
  const text = either(out);
  for (const where of [
    `${HOOKS}/from-line${TEST_EXT}:2`,
    `${HOOKS}/side-effect${TEST_EXT}:2`,
    `${HOOKS}/multi-line${TEST_EXT}:5`,
    `${HOOKS}/dynamic${TEST_EXT}:2`,
    `plugins/compozy/skills/x/outside${TEST_EXT}:2`,
  ]) {
    assert.ok(text.includes(`${where}: imports ${spec}, a test file`), `${where} is not named in: ${text}`);
  }
  assert.ok(text.includes('plugins/openspec/hooks/test-fixtures.mjs'), 'the message names the module to import');
  assert.ok(!text.includes(`${HOOKS}/clean${TEST_EXT}:`), 'a clean file is not named');
  assert.match(text, /refused: 5 test-file imports/);
});

test('suite-speed AC-3 a fixtures module that imports a test file is refused by file and line', async () => {
  const spec = `./helper${TEST_EXT}`;
  const root = tree({
    [`${HOOKS}/test-fixtures.mjs`]: [`${IMPORT} { shared } ${FROM} '${spec}';`, ''].join('\n'),
    [`${HOOKS}/x-fixtures.mjs`]: ['export const x = 1;', `${IMPORT} '${spec}';`, ''].join('\n'),
    [`${HOOKS}/notes.mjs`]: [`${IMPORT} '${spec}';`, ''].join('\n'),
    [`${HOOKS}/clean${TEST_EXT}`]: probe(),
  });
  const out = await run(root, []);
  assert.equal(out.code, 1, either(out));
  assert.deepEqual(startLines(out), [], 'no file started');
  const text = either(out);
  for (const where of [`${HOOKS}/test-fixtures.mjs:1`, `${HOOKS}/x-fixtures.mjs:2`]) {
    assert.ok(text.includes(`${where}: imports ${spec}, a test file`), `${where} is not named in: ${text}`);
  }
  assert.ok(!text.includes(`${HOOKS}/notes.mjs:`), 'a module that is not a fixtures module is not read');
  assert.match(text, /refused: 2 test-file imports/);
});

test('suite-speed AC-3 no test file under plugins imports another test file', () => {
  assert.deepEqual(testImports(REPO_ROOT), []);
});

test('suite-speed AC-4 each file runs in its own empty TMPDIR under one run root, removed after', async () => {
  const marks = tmpFolder('devkit-suite-marks-');
  const writer = (me) => probe({
    name: `suite-speed probe ${me} records its TMPDIR`,
    body: `writeFileSync(join(process.env.PROBE_MARKS, ${JSON.stringify(me)} + '.json'), JSON.stringify({ tmp: process.env.TMPDIR, entries: readdirSync(process.env.TMPDIR).length }));`,
  });
  const root = tree({ [`${HOOKS}/a${TEST_EXT}`]: writer('a'), [`${HOOKS}/b${TEST_EXT}`]: writer('b') });
  const out = await run(root, [], { env: { PROBE_MARKS: marks } });
  assert.equal(out.code, 0, either(out));
  const a = JSON.parse(readFileSync(join(marks, 'a.json'), 'utf8'));
  const b = JSON.parse(readFileSync(join(marks, 'b.json'), 'utf8'));
  assert.notEqual(a.tmp, b.tmp, 'two files share a TMPDIR');
  assert.equal(a.entries, 0);
  assert.equal(b.entries, 0);
  assert.equal(dirname(a.tmp), dirname(b.tmp), 'the two folders have different run roots');
  assert.match(dirname(a.tmp).split('/').pop(), /^devkit-suite-/);
  assert.match(a.tmp.split('/').pop(), /^\d\d$/, 'the folder of a file is its place only: a socket path under it must stay short');
  assert.equal(dirname(dirname(a.tmp)), runParent(out.base, 2));
  assert.ok(runRootLines(out).length <= 1, 'at most one run root line');
  assert.equal(existsSync(dirname(a.tmp)), false, 'the run root is still there after the run');
  assert.deepEqual(readdirSync(out.base), []);
});

test('suite-speed AC-4 a symlinked TMPDIR gives each file a real path', async () => {
  const target = tmpFolder('devkit-t-');
  const link = join(tmpFolder('devkit-suite-links-'), 'link');
  symlinkSync(target, link);
  const marks = tmpFolder('devkit-suite-marks-');
  const root = tree({
    [`${HOOKS}/a${TEST_EXT}`]: probe({
      name: 'suite-speed probe reads its real path',
      body: `writeFileSync(join(process.env.PROBE_MARKS, 'a.json'), JSON.stringify({ tmp: process.env.TMPDIR, real: realpathSync(process.env.TMPDIR) }));`,
    }),
  });
  const out = await run(root, [], { base: link, env: { PROBE_MARKS: marks } });
  assert.equal(out.code, 0, either(out));
  const seen = JSON.parse(readFileSync(join(marks, 'a.json'), 'utf8'));
  assert.equal(seen.tmp, seen.real, 'the child saw a path with a symlink in it');
  assert.equal(dirname(dirname(seen.tmp)), runParent(target, 1), 'the run root is under the real path of the target');
  assert.deepEqual(readdirSync(target), []);
});

test('suite-speed AC-4 a file that leaves something in its TMPDIR fails the run and is named with what it left', async () => {
  const leaver = probe({ name: 'suite-speed probe leaves a folder', body: "mkdirSync(join(process.env.TMPDIR, 'left-behind'));" });
  const root = tree({ [`${HOOKS}/leaver${TEST_EXT}`]: leaver, [`${HOOKS}/clean${TEST_EXT}`]: probe() });
  const out = await run(root, []);
  assert.equal(out.code, 1, either(out));
  assert.match(out.stdout, new RegExp(`^LEFT .*${HOOKS}/leaver\\.test\\.mjs.*left-behind`, 'm'));
  assert.match(out.stdout, new RegExp(`^pass .*${HOOKS}/clean\\.test\\.mjs`, 'm'));
  assert.match(out.stdout, new RegExp(`^=== ${HOOKS}/leaver\\.test\\.mjs: LEFT `, 'm'));
  assert.deepEqual(readdirSync(out.base), [], 'the run root is gone');

  const many = probe({
    name: 'suite-speed probe leaves twelve files',
    body: "for (let i = 0; i < 12; i += 1) writeFileSync(join(process.env.TMPDIR, 'f' + String(i).padStart(2, '0')), '');",
  });
  const more = await run(tree({ [`${HOOKS}/many${TEST_EXT}`]: many }), []);
  assert.equal(more.code, 1, either(more));
  assert.match(more.stdout, /f00.*f09, and 2 more/, 'ten names, then the rest counted');
  assert.deepEqual(readdirSync(more.base), []);

  const failing = probe({
    name: 'suite-speed probe fails and leaves a folder',
    body: "mkdirSync(join(process.env.TMPDIR, 'left-by-failure')); assert.fail('on purpose');",
  });
  const both = await run(tree({ [`${HOOKS}/both${TEST_EXT}`]: failing }), []);
  assert.equal(both.code, 1, either(both));
  assert.match(both.stdout, new RegExp(`^FAIL .*${HOOKS}/both\\.test\\.mjs.*left: left-by-failure`, 'm'), 'a failing file names what it left');
  assert.deepEqual(readdirSync(both.base), []);
});

test('suite-speed AC-6 a failing test exits 1 and prints its name and file; the other files still run', async () => {
  const root = tree({
    [`${HOOKS}/failing${TEST_EXT}`]: probe({ name: 'suite-speed probe fails on purpose', body: "assert.fail('on purpose');" }),
    [`${HOOKS}/passing${TEST_EXT}`]: probe({ name: 'suite-speed probe passes alone' }),
  });
  const out = await run(root, []);
  assert.equal(out.code, 1, either(out));
  assert.ok(out.stdout.includes('suite-speed probe fails on purpose'), 'the failing test is not named');
  assert.ok(out.stdout.includes('suite-speed probe passes alone'), 'the other file did not run');
  assert.match(out.stdout, new RegExp(`^=== ${HOOKS}/failing\\.test\\.mjs: FAIL `, 'm'));
  assert.match(out.stdout, new RegExp(`^FAIL .*${HOOKS}/failing\\.test\\.mjs`, 'm'));
  assert.match(out.stdout, new RegExp(`^pass .*${HOOKS}/passing\\.test\\.mjs`, 'm'));
  assert.match(out.stdout, /suite: 2 files, 2 tests, 1 pass, 1 fail,/);
});

test('suite-speed AC-4 SIGTERM stops every running file, removes the run root and exits 143', async () => {
  const marks = tmpFolder('devkit-suite-marks-');
  const waiter = probe({
    name: 'suite-speed probe waits to be stopped',
    body: [
      "writeFileSync(join(process.env.PROBE_MARKS, 'probe.json'), JSON.stringify({ pid: process.pid, tmp: process.env.TMPDIR }));",
      'await new Promise((resolve) => setTimeout(resolve, 30000));',
    ].join('\n'),
  });
  const root = tree({ [`${HOOKS}/waiter${TEST_EXT}`]: waiter });
  const running = start(root, [], { env: { PROBE_MARKS: marks } });
  const marker = join(marks, 'probe.json');
  const deadline = Date.now() + 20_000;
  while (!existsSync(marker) || readFileSync(marker, 'utf8') === '') {
    if (Date.now() > deadline) {
      running.child.kill('SIGKILL');
      assert.fail(`the probe never started: ${running.seen.stdout}${running.seen.stderr}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const probeRun = JSON.parse(readFileSync(marker, 'utf8'));
  const sent = Date.now();
  running.child.kill('SIGTERM');
  const out = await running.done;
  assert.ok(Date.now() - sent < 15_000, 'the script took more than 15 seconds to stop');
  assert.equal(out.code, 143, either(out));
  assert.ok(out.stdout.includes('interrupted; still running: '), out.stdout);
  assert.ok(out.stdout.includes(`${HOOKS}/waiter${TEST_EXT}`), 'the running file is not named');
  let gone = false;
  for (let i = 0; i < 100 && !gone; i += 1) {
    try {
      process.kill(probeRun.pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      assert.equal(error.code, 'ESRCH');
      gone = true;
    }
  }
  assert.ok(gone, 'the probe process is still running');
  assert.equal(existsSync(dirname(probeRun.tmp)), false, 'the run root is still there');
  assert.deepEqual(readdirSync(out.base), []);
});

// Invariant: scripts/check.py refuses a skipped, only or todo test in the suite's files and leaves compozy's alone.
// Layer: scripts/check.py. Suite: test-suite.test.mjs.
// The skip forms are joined from pieces, so the check does not find them in this file.
const SKIPPED_TEST_FORMS = [
  "test." + "skip('a skipped test', () => {});",
  "test('an only test', { on" + "ly: true }, () => {});",
  "test." + "todo('a todo test');",
];
const NOT_A_TEST_CALL = "const options = { sk" + "ip: true, on" + "ly: false };";

test('suite-speed AC-5c check.py refuses skip, only and todo in the suite test files, not in compozy', () => {
  const checkPy = join(REPO_ROOT, 'scripts', 'check.py');
  const check = (files) => {
    const root = tmpFolder('devkit-suite-check-');
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const r = spawnSync('python3', [checkPy, '--root', root], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  };
  const body = [NOT_A_TEST_CALL, ...SKIPPED_TEST_FORMS, ''].join('\n');
  const refused = check({ [`${HOOKS}/a${TEST_EXT}`]: body });
  assert.equal(refused.code, 1, refused.out);
  const lines = refused.out.split('\n').filter((line) => line.includes('a test is skipped'));
  assert.deepEqual(
    lines.map((line) => line.split(' ')[0]),
    [`${HOOKS}/a${TEST_EXT}:2:`, `${HOOKS}/a${TEST_EXT}:3:`, `${HOOKS}/a${TEST_EXT}:4:`],
    refused.out,
  );
  assert.ok(lines[0].includes('(skip, only or todo); the suite runs every test'), lines[0]);
  const [skipForm, onlyForm, todoForm] = SKIPPED_TEST_FORMS;
  const compozy = check({ [`plugins/compozy/skills/x/b${TEST_EXT}`]: [NOT_A_TEST_CALL, skipForm, todoForm, ''].join('\n') });
  assert.equal(compozy.code, 0, compozy.out);
  assert.equal(compozy.out.trim(), 'all checks passed');
  const compozyOnly = check({ [`plugins/compozy/skills/x/b${TEST_EXT}`]: [NOT_A_TEST_CALL, skipForm, onlyForm, ''].join('\n') });
  assert.equal(compozyOnly.code, 1, compozyOnly.out);
  const onlyLines = compozyOnly.out.split('\n').filter((line) => line.includes('a test is skipped'));
  assert.deepEqual(onlyLines.map((line) => line.split(' ')[0]), [`plugins/compozy/skills/x/b${TEST_EXT}:3:`], compozyOnly.out);
  const clean = check({ [`${HOOKS}/c${TEST_EXT}`]: [NOT_A_TEST_CALL, "test('fine', () => {});", ''].join('\n') });
  assert.equal(clean.code, 0, clean.out);
  assert.equal(clean.out.trim(), 'all checks passed');
});

// Invariant: the documents and the agents' context name the one suite command, and no file outside the records names the
// old one (the guard file as the command, or as the file the other test files are imported by).
// Layer: the documents. Suite: test-suite.test.mjs.
// Both expressions are joined from pieces, so this file does not match them itself.
const GUARD = 'guard' + '\\.test\\.mjs';
const OLD_COMMAND = new RegExp('node --test(?: [^ `\\n]+)* plugins/openspec/hooks/' + GUARD);
const OLD_HEADER = new RegExp('Imported by (?:hooks/|plugins/openspec/hooks/)?' + GUARD);
// Records that quote the old command as the state they replace or as history.
const OLD_COMMAND_EXEMPT = ['openspec/' + 'changes/', 'CHANGE' + 'LOG.md', 'plugins/' + 'panel/', 'docs/' + 'adr/'];
const ONE_COMMAND = 'node scripts/' + 'test-suite.mjs';

test('suite-speed AC-7 the docs and the agents context name the one command, and no file outside the records names the old one', () => {
  for (const doc of ['CLAUDE.md', 'CONTRIBUTING.md', 'plugins/openspec/README.md', 'openspec/config.yaml']) {
    assert.ok(readFileSync(join(REPO_ROOT, doc), 'utf8').includes(ONE_COMMAND), `${doc} does not hold ${ONE_COMMAND}`);
  }
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  const names = [];
  for (const path of listed.stdout.split('\0').filter(Boolean)) {
    if (OLD_COMMAND_EXEMPT.some((prefix) => path.startsWith(prefix))) continue;
    let text;
    try {
      text = readFileSync(join(REPO_ROOT, path), 'utf8');
    } catch {
      continue; // deleted in the working tree, a dangling link or a folder (a submodule)
    }
    text.split('\n').forEach((line, index) => {
      if (OLD_COMMAND.test(line) || OLD_HEADER.test(line)) names.push(`${path}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(names, [], 'these lines still name the old command or the guard as the importer of the test files');
});

// Invariant: CLAUDE.md and CONTRIBUTING.md state the time the suite measured on an idle 8-core machine, not the old
// figures. The figure is evidence (measure.md), never a constant here: the test recognises the form it is written in.
// Layer: the documents. Suite: test-suite.test.mjs.
// The old figures are joined from pieces, so this file does not hold them itself.
const OLD_FIGURES = ['13 to 21 ' + 'minutes', 'about 13 ' + 'minutes'];
const MEASURED = /about \d+ minutes on an idle 8-core machine/;
const MEASURED_AT = /about \d+ minutes on an idle 8-core machine; \d+:\d{2} observed on [0-9a-f]{7,40}\b/;

test('suite-speed AC-8 CLAUDE.md and CONTRIBUTING.md state the measured time', () => {
  const claude = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
  const contributing = readFileSync(join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8');
  for (const [doc, text] of [['CLAUDE.md', claude], ['CONTRIBUTING.md', contributing]]) {
    for (const old of OLD_FIGURES) assert.ok(!text.includes(old), `${doc} still holds the old figure "${old}"`);
  }
  const row = claude.split('\n').find((line) => line.includes(ONE_COMMAND));
  assert.ok(row, `CLAUDE.md has no line holding ${ONE_COMMAND}`);
  assert.match(row, MEASURED, 'the CLAUDE.md row does not state the measured time');
  assert.ok(contributing.includes(ONE_COMMAND), `CONTRIBUTING.md does not hold ${ONE_COMMAND}`);
  const after = contributing.slice(contributing.indexOf(ONE_COMMAND));
  const paragraph = after.split(/\n[ \t]*\n/)[1] ?? '';
  assert.match(paragraph, MEASURED_AT, 'the CONTRIBUTING.md paragraph after the command block does not state the measured time');
});

// suite-socket-path: the run root fits a Unix socket path (macOS holds 104 bytes in sun_path, the terminator included).

// A folder whose real path is at least 60 bytes: nested folders under a tmpFolder until it is.
function longTmp() {
  let folder = tmpFolder('devkit-long-');
  while (Buffer.byteLength(realpathSync(folder)) < 60) {
    folder = join(folder, 'nested');
    mkdirSync(folder);
  }
  return folder;
}

// A path whose parent is a regular file: realpath and mkdir fail with ENOTDIR on every platform.
function belowAFile() {
  const file = join(tmpFolder('devkit-file-'), 'plain');
  writeFileSync(file, 'x');
  return join(file, 'below');
}

// The child binds a Unix socket where fakeCompozy(...).daemon does: <TMPDIR>/devkit-ch-xxxxxx/daemon.sock.
const BIND_PROBE_BODY = [
  "const { createServer } = await import('node:net');",
  "const { rmSync } = await import('node:fs');",
  "const folder = join(process.env.TMPDIR, 'devkit-ch-xxxxxx');",
  'mkdirSync(folder);',
  'const server = createServer();',
  'let bound = true;',
  "try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(join(folder, 'daemon.sock'), resolve); }); } catch (error) { bound = error.code || String(error); }",
  "writeFileSync(join(process.env.PROBE_MARKS, 'a.json'), JSON.stringify({ tmp: process.env.TMPDIR, bound }));",
  'if (bound === true) await new Promise((resolve) => server.close(resolve));',
  'rmSync(folder, { recursive: true, force: true });',
].join('\n');

test('suite-socket-path AC-4 under a TMPDIR of 60 bytes or more a child binds <TMPDIR>/devkit-ch-xxxxxx/daemon.sock and its TMPDIR is at most 71 bytes', async () => {
  const base = longTmp();
  assert.ok(Buffer.byteLength(realpathSync(base)) >= 60);
  const marks = tmpFolder('devkit-marks-');
  const root = tree({ [`${HOOKS}/a${TEST_EXT}`]: probe({ name: 'suite-socket-path probe binds a socket', body: BIND_PROBE_BODY }) });
  const out = await run(root, [], { base, env: { PROBE_MARKS: marks } });
  assert.equal(out.code, 0, either(out));
  const seen = JSON.parse(readFileSync(join(marks, 'a.json'), 'utf8'));
  assert.equal(seen.bound, true, `the socket did not bind (${seen.bound}) under ${seen.tmp}`);
  assert.ok(Buffer.byteLength(seen.tmp) <= suiteScript.runRootLimit(1), `the child TMPDIR is ${Buffer.byteLength(seen.tmp)} bytes: ${seen.tmp}`);
  assert.equal(runRootLines(out).length, 1, out.stdout);
  assert.equal(dirname(dirname(seen.tmp)), realpathSync(suiteScript.SHORT_TMP));
  assert.equal(existsSync(dirname(seen.tmp)), false, 'the run root is still there after the run');
  assert.deepEqual(readdirSync(base), []);
});

test('suite-socket-path AC-3 under the short run root a file that leaves something still fails the run with its name, and the root is removed', async () => {
  const base = longTmp();
  const leaver = probe({ name: 'suite-socket-path probe leaves a folder', body: "mkdirSync(join(process.env.TMPDIR, 'left-behind'));" });
  const root = tree({ [`${HOOKS}/leaver${TEST_EXT}`]: leaver, [`${HOOKS}/clean${TEST_EXT}`]: probe() });
  const out = await run(root, [], { base });
  assert.equal(out.code, 1, either(out));
  assert.match(out.stdout, new RegExp(`^LEFT .*${HOOKS}/leaver\\.test\\.mjs.*left-behind`, 'm'));
  assert.match(out.stdout, new RegExp(`^pass .*${HOOKS}/clean\\.test\\.mjs`, 'm'));
  const lines = runRootLines(out);
  assert.equal(lines.length, 1, out.stdout);
  const named = /^run root: (\S+) /.exec(lines[0]);
  assert.ok(named, lines[0]);
  assert.equal(existsSync(named[1]), false, 'the run root is still there after the run');
});

test('suite-socket-path AC-2 a TMPDIR whose run root fits exactly holds it and gives no line', () => {
  const tmp = tmpFolder('devkit-fit-');
  const short = tmpFolder('devkit-short-');
  const limit = Buffer.byteLength(realpathSync(tmp)) + suiteScript.RUN_ROOT_NAME_BYTES;
  const made = suiteScript.makeRunRoot({ tmp, short, limit });
  rmSync(made.runRoot, { recursive: true, force: true });
  assert.equal(dirname(made.runRoot), realpathSync(tmp));
  assert.match(made.runRoot.split('/').pop(), /^devkit-suite-/);
  assert.equal(made.line, null);
  assert.deepEqual(readdirSync(short), []);
});

test('suite-socket-path AC-3 a TMPDIR one byte over the limit puts the run root under the short folder with one line naming where and why', () => {
  const tmp = tmpFolder('devkit-over-');
  const short = tmpFolder('devkit-sh-'); // two bytes shorter than tmp, so it fits under the limit that tmp misses by one
  const limit = Buffer.byteLength(realpathSync(tmp)) + suiteScript.RUN_ROOT_NAME_BYTES - 1;
  const made = suiteScript.makeRunRoot({ tmp, short, limit });
  rmSync(made.runRoot, { recursive: true, force: true });
  assert.equal(dirname(made.runRoot), realpathSync(short));
  assert.deepEqual(readdirSync(tmp), [], 'something was written under the TMPDIR that does not fit');
  assert.ok(made.line.startsWith(`run root: ${made.runRoot} (TMPDIR ${realpathSync(tmp)}: its run root would take `), made.line);
  assert.ok(made.line.includes(`over ${limit}`), made.line);
  assert.ok(made.line.includes(`${suiteScript.SOCKET_PATH_MAX_BYTES} bytes`), made.line);
  assert.ok(!made.line.includes('\n'), 'the line is one line');
});

test('suite-socket-path AC-3 a TMPDIR that cannot be used puts the run root under the short folder and the line says why', () => {
  const short = tmpFolder('devkit-short-');
  const made = suiteScript.makeRunRoot({ tmp: belowAFile(), short, limit: 1000 });
  rmSync(made.runRoot, { recursive: true, force: true });
  assert.equal(dirname(made.runRoot), realpathSync(short));
  assert.ok(made.line.includes('cannot be used: ENOTDIR'), made.line);
  assert.ok(!made.line.includes('\n'), 'the line is one line');
});

test('suite-socket-path AC-3 when the short folder is too long as well, a usage error names both folders and nothing is made', () => {
  const tmp = tmpFolder('devkit-fit-');
  const short = tmpFolder('devkit-short-');
  assert.throws(
    () => suiteScript.makeRunRoot({ tmp, short, limit: 10 }),
    (error) => error.name === 'UsageError'
      && error.message.startsWith('no folder can hold the run root: ')
      && error.message.includes(realpathSync(tmp))
      && error.message.includes(realpathSync(short)),
  );
  assert.deepEqual(readdirSync(tmp), []);
  assert.deepEqual(readdirSync(short), []);
});

test('suite-socket-path AC-3 when the short folder cannot be used either, a usage error names both folders', () => {
  const tmp = tmpFolder('devkit-fit-');
  const short = belowAFile();
  assert.throws(
    () => suiteScript.makeRunRoot({ tmp, short, limit: 10 }),
    (error) => error.name === 'UsageError'
      && error.message.startsWith('no folder can hold the run root: ')
      && error.message.includes(realpathSync(tmp))
      && error.message.includes(short)
      && error.message.includes('cannot be used: ENOTDIR'),
  );
  assert.deepEqual(readdirSync(tmp), []);
});

test('suite-socket-path AC-4 a TMPDIR over the limit by bytes but under it by characters puts the run root under the short folder', () => {
  const tmp = join(tmpFolder('devkit-na-'), 'ééé'); // three characters, six bytes
  mkdirSync(tmp);
  const short = tmpFolder('devkit-sh-');
  const real = realpathSync(tmp);
  const limit = [...real].length + suiteScript.RUN_ROOT_NAME_BYTES; // the characters fit, the bytes do not
  assert.ok(Buffer.byteLength(real) + suiteScript.RUN_ROOT_NAME_BYTES > limit);
  assert.ok(Buffer.byteLength(realpathSync(short)) + suiteScript.RUN_ROOT_NAME_BYTES <= limit, 'the short folder must fit');
  const made = suiteScript.makeRunRoot({ tmp, short, limit });
  rmSync(made.runRoot, { recursive: true, force: true });
  assert.equal(dirname(made.runRoot), realpathSync(short));
  assert.ok(made.line && made.line.startsWith('run root: '), String(made.line));
  assert.deepEqual(readdirSync(tmp), []);
});

test('suite-socket-path AC-3 when no folder can hold the run root, the script exits 2 with the usage before any file runs', async () => {
  assert.equal(typeof suiteScript.makeRunRoot, 'function', 'the script has no makeRunRoot');
  const base = longTmp();
  const root = tree({ [`${HOOKS}/a${TEST_EXT}`]: probe() });
  const short = belowAFile();
  const was = { tmpdir: process.env.TMPDIR, out: process.stdout.write, err: process.stderr.write };
  let stdout = '';
  let stderr = '';
  let pending;
  process.env.TMPDIR = base;
  process.stdout.write = (chunk) => { stdout += chunk; return true; };
  process.stderr.write = (chunk) => { stderr += chunk; return true; };
  try {
    pending = suiteScript.main([], root, short); // returns 2 before its first await, so the swap covers it
  } finally {
    process.stdout.write = was.out;
    process.stderr.write = was.err;
    process.env.TMPDIR = was.tmpdir;
  }
  assert.equal(await pending, 2);
  assert.ok(stderr.includes('no folder can hold the run root'), stderr);
  assert.ok(stderr.includes('usage: node scripts/test-suite.mjs'), stderr);
  assert.ok(!stdout.includes('start '), stdout);
  assert.deepEqual(readdirSync(base), []);
});

test('suite-socket-path AC-4 the run root fits by bytes: 51 fits, 52 does not, a non-ASCII byte counts', () => {
  const room = suiteScript.runRootLimit(1) - suiteScript.RUN_ROOT_NAME_BYTES; // the longest base, in bytes
  const limit = suiteScript.runRootLimit(1);
  assert.equal(suiteScript.runRootFits('/' + 'a'.repeat(room - 1), limit), true);
  assert.equal(suiteScript.runRootFits('/' + 'a'.repeat(room), limit), false);
  assert.equal(suiteScript.runRootFits('/' + 'é' + 'a'.repeat(room - 3), limit), true); // room bytes, room - 1 characters
  assert.equal(suiteScript.runRootFits('/' + 'é' + 'a'.repeat(room - 2), limit), false);
});

test('suite-socket-path AC-4 the run-root limit leaves room for a wider place: 71 up to 100 files, one less from 101', () => {
  assert.equal(suiteScript.runRootLimit(1), suiteScript.runRootLimit(100));
  assert.equal(suiteScript.runRootLimit(101), suiteScript.runRootLimit(100) - 1);
  // 103 is the macOS sun_path size (104) less the terminator: the run root, a slash and two digits, and the socket tail.
  assert.equal(suiteScript.runRootLimit(1) + 1 + 2 + suiteScript.SOCKET_TAIL_BYTES, 103);
});

// A folder whose real path is exactly `bytes` bytes: under a tmpFolder when the test's own TMPDIR leaves room for a
// folder name of two characters at least, else under the real short folder (a unique name, removed by `cleanup`).
function exactTmp(bytes) {
  const parent = realpathSync(tmpFolder('devkit-ex-'));
  if (Buffer.byteLength(parent) + 3 <= bytes) {
    const folder = join(parent, 'p'.repeat(bytes - Buffer.byteLength(parent) - 1));
    mkdirSync(folder);
    return { folder, cleanup() {} };
  }
  const shortReal = realpathSync(suiteScript.SHORT_TMP);
  const name = `devkit-ex-${process.pid}-${Date.now()}`;
  const folder = join(shortReal, name.padEnd(bytes - Buffer.byteLength(shortReal) - 1, 'p'));
  mkdirSync(folder);
  return { folder, cleanup() { rmSync(folder, { recursive: true, force: true }); } };
}

test('suite-socket-path AC-4 a TMPDIR of exactly the longest base keeps the run root inside it and a socket bound at 103 bytes', async () => {
  const room = suiteScript.runRootLimit(1) - suiteScript.RUN_ROOT_NAME_BYTES; // 51
  const { folder: base, cleanup } = exactTmp(room);
  try {
    assert.equal(Buffer.byteLength(realpathSync(base)), room);
    const marks = tmpFolder('devkit-marks-');
    const root = tree({ [`${HOOKS}/a${TEST_EXT}`]: probe({ name: 'suite-socket-path probe binds a socket', body: BIND_PROBE_BODY }) });
    const out = await run(root, [], { base, env: { PROBE_MARKS: marks } });
    assert.equal(out.code, 0, either(out));
    const seen = JSON.parse(readFileSync(join(marks, 'a.json'), 'utf8'));
    assert.equal(seen.bound, true, `the socket did not bind (${seen.bound}) under ${seen.tmp}`);
    assert.equal(Buffer.byteLength(dirname(seen.tmp)), suiteScript.runRootLimit(1), `the run root is not at the limit: ${seen.tmp}`);
    assert.equal(Buffer.byteLength(join(seen.tmp, 'devkit-ch-xxxxxx', 'daemon.sock')), suiteScript.SOCKET_PATH_MAX_BYTES);
    assert.deepEqual(runRootLines(out), [], 'the fits branch prints no run root line');
    assert.equal(dirname(dirname(seen.tmp)), realpathSync(base));
    assert.equal(existsSync(dirname(seen.tmp)), false, 'the run root is still there after the run');
    assert.deepEqual(readdirSync(base), []);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------- selective-tests-by-map-2: the selection (D-5)
// Invariant: `selectTests` classes each own path by the first rule that matches (S1 a suite test, S2 a deleted one, S3 a shared helper,
// S4 a map entry, S5 openspec/, S6 docs, S7 anything else) and gives `files`, `whole` or `none`. Layer: the pure function of
// scripts/test-suite.mjs (the change's decision 2: a change runs only the tests its own files map to). Suite: test-suite.

const SELECT_SUITE = ['a', 'b', 'c', 'slow', 'slow2'].map((name) => `${HOOKS}/${name}${TEST_EXT}`);
const [TA, TB, TC, TSLOW, TSLOW2] = SELECT_SUITE;
const modPath = (name) => `${HOOKS}/${name}.mjs`;
// `map` is merged over an empty map whose slow tests are `slow` and `slow2`.
const pick = ({ own, map = {}, suite = SELECT_SUITE, exists = () => true, uses = new Map() }) =>
  suiteScript.selectTests({ own, map: { slow: [TSLOW, TSLOW2], shared: {}, files: {}, ...map }, suite, exists, uses });
const noCover = (...paths) => `no entry of scripts/test-map.json covers ${paths.join(', ')}`;

test('selective-tests-by-map-2 AC-1 T-1 S4 an exact key selects its fast and its slow tests, each with the own path that selected it; a test no key links is not selected', () => {
  const result = pick({ own: [modPath('m')], map: { files: { [modPath('m')]: [TA, TSLOW] } } });
  assert.deepEqual(result, { kind: 'files', files: [{ file: TA, by: [modPath('m')] }, { file: TSLOW, by: [modPath('m')] }] });
  assert.ok(!result.files.some((f) => f.file === TB || f.file === TC), 'a test no key links is not selected');
});

test('selective-tests-by-map-2 AC-1 T-2 two own files linking one test: both are in its by, and the test is selected once', () => {
  const result = pick({ own: [modPath('n'), modPath('m')], map: { files: { [modPath('m')]: [TA, TB], [modPath('n')]: [TB] } } });
  assert.deepEqual(result, { kind: 'files', files: [{ file: TA, by: [modPath('m')] }, { file: TB, by: [modPath('m'), modPath('n')] }] });
});

test('selective-tests-by-map-2 AC-1 T-3 S1 a touched suite test, slow or fast, selects itself; S2 a deleted one selects nothing', () => {
  assert.deepEqual(pick({ own: [TSLOW] }), { kind: 'files', files: [{ file: TSLOW, by: [TSLOW] }] });
  assert.deepEqual(pick({ own: [TA] }), { kind: 'files', files: [{ file: TA, by: [TA] }] });
  const gone = `${HOOKS}/gone${TEST_EXT}`;
  assert.deepEqual(pick({ own: [gone], exists: (path) => path !== gone }), { kind: 'none', count: 1 });
  assert.deepEqual(pick({ own: [gone, TA], exists: (path) => path !== gone }), { kind: 'files', files: [{ file: TA, by: [TA] }] }, 'a deleted test beside a kept one adds nothing');
});

test('selective-tests-by-map-2 AC-1 T-4 S4 a folder key covers a path under it; the exact key beats the folder; the longer folder beats the shorter; a sibling is not covered', () => {
  const files = { 'plugins/x/': [TA], 'plugins/x/deep/': [TB], 'plugins/x/deep/exact.json': [TC] };
  assert.deepEqual(pick({ own: ['plugins/x/other.json'], map: { files } }), { kind: 'files', files: [{ file: TA, by: ['plugins/x/other.json'] }] });
  assert.deepEqual(pick({ own: ['plugins/x/deep/f.json'], map: { files } }), { kind: 'files', files: [{ file: TB, by: ['plugins/x/deep/f.json'] }] }, 'the longer folder key');
  assert.deepEqual(pick({ own: ['plugins/x/deep/exact.json'], map: { files } }), { kind: 'files', files: [{ file: TC, by: ['plugins/x/deep/exact.json'] }] }, 'the exact key');
  assert.deepEqual(pick({ own: ['plugins/xy/f.json'], map: { files } }), { kind: 'whole', reason: noCover('plugins/xy/f.json') }, 'a sibling of the folder is not under it');
});

test('selective-tests-by-map-2 AC-2 AC-3 T-5 S3 a shared helper selects the fast tests that use it and no slow one, no other', () => {
  const helper = modPath('helper');
  const uses = new Map([[helper, [TA, TB, TSLOW]]]);
  const result = pick({ own: [helper], map: { shared: { [helper]: [] } }, uses });
  assert.deepEqual(result, { kind: 'files', files: [{ file: TA, by: [helper] }, { file: TB, by: [helper] }] });
  assert.ok(!result.files.some((f) => f.file === TSLOW), 'a slow importer is not selected');
  assert.ok(!result.files.some((f) => f.file === TC), 'a fast non-importer is not selected');
  assert.deepEqual(pick({ own: [helper], map: { shared: { [helper]: [] } } }), { kind: 'none', count: 1 }, 'a helper no test uses selects nothing');
});

test('selective-tests-by-map-2 AC-2 T-6 S3 a slow test the helper entry links is selected; the same slow test unlinked is not', () => {
  const helper = modPath('helper');
  const uses = new Map([[helper, [TA, TSLOW, TSLOW2]]]);
  const linked = pick({ own: [helper], map: { shared: { [helper]: [TSLOW] } }, uses });
  assert.deepEqual(linked.files.map((f) => f.file), [TA, TSLOW]);
  assert.deepEqual(linked.files.find((f) => f.file === TSLOW).by, [helper]);
  assert.ok(!linked.files.some((f) => f.file === TSLOW2), 'the slow test the entry does not link is not selected');
});

test('selective-tests-by-map-2 AC-4 T-7 S7 an unmapped code path gives the whole suite naming it; mapped it gives its tests; under a key with an empty list it gives the whole suite again', () => {
  const code = modPath('new');
  assert.deepEqual(pick({ own: [code] }), { kind: 'whole', reason: noCover(code) });
  assert.deepEqual(pick({ own: [code], map: { files: { [code]: [TA] } } }), { kind: 'files', files: [{ file: TA, by: [code] }] });
  assert.deepEqual(pick({ own: [code], map: { files: { [code]: [] } } }), { kind: 'whole', reason: noCover(code) }, 'an exact key with no test covers nothing');
  assert.deepEqual(pick({ own: [`${HOOKS}/sub/deep.mjs`], map: { files: { [`${HOOKS}/sub/`]: [] } } }), { kind: 'whole', reason: noCover(`${HOOKS}/sub/deep.mjs`) }, 'a folder key with no test covers nothing');
  assert.deepEqual(pick({ own: [modPath('z'), code] }), { kind: 'whole', reason: noCover(code, modPath('z')) }, 'every unmapped path is named, in order');
});

test('selective-tests-by-map-2 AC-4 T-8 S5 and S6 select nothing; an unmapped markdown file under plugins/ gives the whole suite; a mapped openspec/ path or root markdown gives its tests', () => {
  assert.deepEqual(pick({ own: ['openspec/changes/x/tasks.md', 'openspec/config.yaml'] }), { kind: 'none', count: 2 }, 'S5');
  assert.deepEqual(pick({ own: ['docs/guide.md', 'README.md'] }), { kind: 'none', count: 2 }, 'S6');
  assert.deepEqual(pick({ own: [] }), { kind: 'none', count: 0 });
  assert.deepEqual(pick({ own: ['plugins/panel/README.md'] }), { kind: 'whole', reason: noCover('plugins/panel/README.md') }, 'a markdown file under plugins/ is code');
  assert.deepEqual(pick({ own: ['openspec/config.yaml'], map: { files: { 'openspec/config.yaml': [TA] } } }), { kind: 'files', files: [{ file: TA, by: ['openspec/config.yaml'] }] }, 'a mapped openspec/ path');
  assert.deepEqual(pick({ own: ['CLAUDE.md'], map: { files: { 'CLAUDE.md': [TB] } } }), { kind: 'files', files: [{ file: TB, by: ['CLAUDE.md'] }] }, 'a mapped root markdown file');
});

test('selective-tests-by-map-2 AC-4 T-9 a path that selects nothing beside a mapped one adds nothing; an unmapped code path beside a mapped one gives the whole suite', () => {
  const files = { [modPath('m')]: [TA] };
  assert.deepEqual(pick({ own: ['docs/guide.md', modPath('m'), 'openspec/changes/x/tasks.md'], map: { files } }), { kind: 'files', files: [{ file: TA, by: [modPath('m')] }] });
  assert.deepEqual(pick({ own: ['docs/guide.md', modPath('m'), modPath('new')], map: { files } }), { kind: 'whole', reason: noCover(modPath('new')) });
});

// A folder of plain files (path relative to it -> text), for the functions that read the tree.
function files(content) {
  const root = tmpFolder('devkit-map-');
  for (const [path, text] of Object.entries(content)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const importing = (spec) => `${IMPORT} ${JSON.stringify(spec)};\n`;

test('selective-tests-by-map-2 AC-2 AC-3 T-5 sharedUses finds the tests that import a shared helper directly, through another shared helper or through a -fixtures module, and no other', () => {
  const root = files({
    [`${HOOKS}/test-fixtures.mjs`]: 'export const a = 1;\n',
    [`${HOOKS}/test-tmp.mjs`]: importing('./test-fixtures.mjs'),
    [`${HOOKS}/x-fixtures.mjs`]: importing('./test-fixtures.mjs'),
    [`${HOOKS}/product.mjs`]: importing('./test-fixtures.mjs'),
    [`${HOOKS}/direct${TEST_EXT}`]: importing('./test-fixtures.mjs'),
    [`${HOOKS}/viashared${TEST_EXT}`]: importing('./test-tmp.mjs'),
    [`${HOOKS}/viafixtures${TEST_EXT}`]: importing('./x-fixtures.mjs'),
    [`${HOOKS}/viaproduct${TEST_EXT}`]: importing('./product.mjs'),
    [`${HOOKS}/dynamic${TEST_EXT}`]: `await ${IMPORT}('./test-fixtures.mjs');\n`,
    [`${HOOKS}/other${TEST_EXT}`]: importing('./test-tmp.mjs'),
    [`${HOOKS}/none${TEST_EXT}`]: 'export const a = 1;\n',
    [`${SETUP}/parent${TEST_EXT}`]: importing('../../../../openspec/hooks/test-fixtures.mjs'),
  });
  const map = { slow: [], shared: { [`${HOOKS}/test-fixtures.mjs`]: [], [`${HOOKS}/test-tmp.mjs`]: [] }, files: {} };
  const uses = suiteScript.sharedUses(root, map, suiteScript.suiteFiles(root));
  const at = (name) => `${HOOKS}/${name}${TEST_EXT}`;
  assert.deepEqual(uses.get(`${HOOKS}/test-fixtures.mjs`), [at('direct'), at('dynamic'), at('other'), at('viafixtures'), at('viashared'), `${SETUP}/parent${TEST_EXT}`].sort());
  assert.deepEqual(uses.get(`${HOOKS}/test-tmp.mjs`), [at('other'), at('viashared')]);
  assert.ok(!uses.get(`${HOOKS}/test-fixtures.mjs`).includes(at('viaproduct')), 'a product module is not followed');
  assert.ok(!uses.get(`${HOOKS}/test-fixtures.mjs`).includes(at('none')));
});

// ---------------------------------------------------------------- selective-tests-by-map-2: the map and its check (D-3)
// Invariant: `mapProblems` refuses a map that names a path that is not there (M1) or not a suite test (M2), lets a test select itself
// (M3), keeps one path from being a file entry and a shared helper (M4), leaves a script no key covers (M5) or a test no entry links
// (M6) or has a wrong shape (M7); `readTestMap` refuses a missing or unparsable file. Layer: the pure functions of
// scripts/test-suite.mjs. Suite: test-suite.

const MAP_FILES = {
  [`${HOOKS}/a${TEST_EXT}`]: '',
  [`${HOOKS}/b${TEST_EXT}`]: '',
  [`${HOOKS}/mod.mjs`]: 'export const m = 1;\n',
  [`${HOOKS}/helper.mjs`]: 'export const h = 1;\n',
  [`${HOOKS}/fixtures/f.json`]: '{}\n',
  'docs/guide.md': '# guide\n',
};
const goodMap = () => ({
  slow: [TB],
  shared: { [`${HOOKS}/helper.mjs`]: [] },
  files: { [`${HOOKS}/mod.mjs`]: [TA], 'docs/guide.md': [TB], [`${HOOKS}/fixtures/`]: [TA] },
});
const problemsOf = (root, map) => suiteScript.mapProblems(root, map, suiteScript.suiteFiles(root));
const said = (problems) => problems.map((p) => `${p.entry}: ${p.why}`);

test('selective-tests-by-map-2 AC-9 T-10 M1 a key, value, shared key, shared link or slow item that names a missing path is a problem naming it; a folder key on a file is one; existing paths are none', () => {
  const root = files(MAP_FILES);
  assert.deepEqual(problemsOf(root, goodMap()), []);
  const ghost = `${HOOKS}/ghost.mjs`;
  const cases = {
    'a files key': (m) => { m.files[ghost] = [TA]; },
    'a files value': (m) => { m.files[`${HOOKS}/mod.mjs`].push(`${HOOKS}/ghost${TEST_EXT}`); },
    'a shared key': (m) => { m.shared[ghost] = []; },
    'a shared link': (m) => { m.shared[`${HOOKS}/helper.mjs`].push(`${HOOKS}/ghost${TEST_EXT}`); },
    'a slow item': (m) => { m.slow.push(`${HOOKS}/ghost${TEST_EXT}`); },
  };
  for (const [name, edit] of Object.entries(cases)) {
    const map = goodMap();
    edit(map);
    const found = problemsOf(root, map);
    assert.equal(found.length, 1, `${name}: ${JSON.stringify(found)}`);
    assert.match(found[0].why, /^names .*ghost.*, which does not exist$/, name);
  }
  const folderOnFile = goodMap();
  folderOnFile.files['docs/guide.md/'] = [TA];
  assert.deepEqual(problemsOf(root, folderOnFile).map((p) => [p.entry, p.why]), [['docs/guide.md/', 'is not a folder']]);
  const noFolder = goodMap();
  noFolder.files['docs/nothing/'] = [TA];
  assert.match(said(problemsOf(root, noFolder)).join('\n'), /docs\/nothing\/: names docs\/nothing\/, which does not exist/);
});

test('selective-tests-by-map-2 AC-9 T-11 M2 a value, a shared link or a slow item that is no test file of the suite is a problem; a suite file is none', () => {
  const root = files(MAP_FILES);
  const mod = `${HOOKS}/mod.mjs`;
  for (const [name, edit] of Object.entries({
    'a files value': (m) => { m.files[mod].push(mod); },
    'a shared link': (m) => { m.shared[`${HOOKS}/helper.mjs`].push(mod); },
    'a slow item': (m) => { m.slow.push(mod); },
  })) {
    const map = goodMap();
    edit(map);
    const found = problemsOf(root, map);
    assert.equal(found.length, 1, `${name}: ${JSON.stringify(found)}`);
    assert.equal(found[0].why, `links ${mod}, which is not a test file of the suite`, name);
  }
  const fine = goodMap();
  fine.shared[`${HOOKS}/helper.mjs`].push(TA);
  fine.slow.push(TA);
  assert.deepEqual(problemsOf(root, fine), []);
});

test('selective-tests-by-map-2 AC-9 T-12 M3 a suite test as a key and M4 one path as a file entry and a shared helper are problems; apart they are none', () => {
  const root = files(MAP_FILES);
  const itself = goodMap();
  itself.files[TA] = [TB];
  itself.shared[TB] = [];
  assert.deepEqual(said(problemsOf(root, itself)).sort(), [
    `${TA}: is a test file of the suite: it selects itself`,
    `${TB}: is a test file of the suite: it selects itself`,
  ].sort());
  const both = goodMap();
  both.files[`${HOOKS}/helper.mjs`] = [TA];
  assert.deepEqual(said(problemsOf(root, both)), [`${HOOKS}/helper.mjs: is both a file entry and a shared helper`]);
  assert.deepEqual(problemsOf(root, goodMap()), []);
});

test('selective-tests-by-map-2 AC-9 T-13 M5 a module under a suite folder that no key covers is a problem; an exact key, a folder key, a shared key or a key with an empty list covers it', () => {
  const root = files({ ...MAP_FILES, [`${HOOKS}/orphan.mjs`]: '', [`${HOOKS}/sub/deep.mjs`]: '', [`${HOOKS}/sub/deeper/x.json`]: '{}' });
  const orphan = `${HOOKS}/orphan.mjs`;
  const base = () => { const m = goodMap(); m.files[`${HOOKS}/sub/`] = [TA]; return m; };
  assert.deepEqual(said(problemsOf(root, base())), [`${orphan}: is not covered by the map`]);
  const exact = base(); exact.files[orphan] = [TA];
  assert.deepEqual(problemsOf(root, exact), [], 'an exact key');
  const shared = base(); shared.shared[orphan] = [];
  assert.deepEqual(problemsOf(root, shared), [], 'a shared key');
  const empty = base(); empty.files[orphan] = [];
  assert.deepEqual(problemsOf(root, empty), [], 'a key with an empty list still covers it');
  const folder = base(); folder.files[`${HOOKS}/`] = [TA];
  assert.deepEqual(problemsOf(root, folder), [], 'a folder key');
  const noSub = goodMap(); noSub.files[orphan] = [TA];
  assert.deepEqual(said(problemsOf(root, noSub)).sort(), [`${HOOKS}/sub/deep.mjs: is not covered by the map`, `${HOOKS}/sub/deeper/x.json: is not covered by the map`], 'a folder no key covers, its nested files included');
});

test('selective-tests-by-map-2 AC-9 T-14 M6 a test linked to nothing is a problem, a test that only imports a shared helper too; a files value or a shared link makes it none', () => {
  const root = files({ ...MAP_FILES, [`${HOOKS}/c${TEST_EXT}`]: importing('./helper.mjs') });
  const unlinked = goodMap();
  assert.deepEqual(said(problemsOf(root, unlinked)), [`${TC}: is linked to nothing`], 'importing a shared helper is no link');
  const slowOnly = goodMap(); slowOnly.slow.push(TC);
  assert.deepEqual(said(problemsOf(root, slowOnly)), [`${TC}: is linked to nothing`], 'a slow mark is no link');
  const byFiles = goodMap(); byFiles.files[`${HOOKS}/mod.mjs`].push(TC);
  assert.deepEqual(problemsOf(root, byFiles), []);
  const byShared = goodMap(); byShared.shared[`${HOOKS}/helper.mjs`].push(TC);
  assert.deepEqual(problemsOf(root, byShared), []);
  const bare = files({ ...MAP_FILES, [`${HOOKS}/c${TEST_EXT}`]: 'export const a = 1;\n' });
  assert.deepEqual(said(problemsOf(bare, goodMap())), [`${TC}: is linked to nothing`], 'a test that imports nothing');
});

test('selective-tests-by-map-2 AC-9 T-15 M7 and the input cases: a missing file, an empty file, not JSON, an array, an unknown key and a value that is no array of strings', () => {
  const read = (content) => suiteScript.readTestMap(files(content));
  assert.deepEqual(read({}), { error: 'cannot read: ENOENT' });
  assert.match(read({ 'scripts/test-map.json': '' }).error, /^not JSON: /);
  assert.match(read({ 'scripts/test-map.json': '{' }).error, /^not JSON: /);
  assert.deepEqual(read({ 'scripts/test-map.json': JSON.stringify(goodMap()) }), { map: goodMap() });

  const root = files(MAP_FILES);
  assert.deepEqual(said(problemsOf(root, [])), ['the map: is not an object']);
  assert.deepEqual(said(problemsOf(root, null)), ['the map: is not an object']);
  assert.deepEqual(said(problemsOf(root, 'text')), ['the map: is not an object']);
  const extra = { ...goodMap(), other: [] };
  assert.deepEqual(said(problemsOf(root, extra)), ['other: is not a key of the map (slow, shared, files)']);
  const notArray = goodMap(); notArray.files[`${HOOKS}/mod.mjs`] = TA;
  assert.deepEqual(said(problemsOf(root, notArray)), [`${HOOKS}/mod.mjs: is not an array of strings`]);
  const notStrings = goodMap(); notStrings.slow = [TB, 3];
  assert.deepEqual(said(problemsOf(root, notStrings)), ['slow: is not an array of strings']);
  const sharedWrong = goodMap(); sharedWrong.shared = [];
  assert.deepEqual(said(problemsOf(root, sharedWrong)), ['shared: is not an object']);
  const filesWrong = goodMap(); filesWrong.files = 'x';
  assert.deepEqual(said(problemsOf(root, filesWrong)), ['files: is not an object']);
});

test('selective-tests-by-map-2 AC-9 AC-2 T-16 the repository\'s own map has no problem, marks slow tests, shares test-fixtures.mjs and links a script by its code lines, not by a comment', () => {
  const found = suiteScript.readTestMap(REPO_ROOT);
  assert.equal(found.error, undefined, found.error);
  const listed = suiteFiles(REPO_ROOT);
  assert.deepEqual(suiteScript.mapProblems(REPO_ROOT, found.map, listed), []);
  assert.ok(Object.hasOwn(found.map.shared, `${HOOKS}/test-fixtures.mjs`), 'test-fixtures.mjs is a shared helper');
  assert.ok(found.map.slow.length > 0, 'slow is not empty');
  assert.deepEqual(found.map.slow.filter((file) => !listed.includes(file)), [], 'slow holds suite files only');
  const entry = found.map.files['scripts/test-suite.mjs'];
  assert.ok(entry.includes(`${HOOKS}/test-suite${TEST_EXT}`), 'the script entry holds its own test');
  // ship-entry.test.mjs names scripts/test-suite.mjs only in comments (ADR 0026's "Run by" header line): a comment links nothing (D-4).
  assert.ok(!entry.includes(`${SETUP}/ship-entry${TEST_EXT}`), 'a test that names the script in a comment is not linked to it');
});

// Invariant: a document key of the repository's map (a non-code path outside plugins/) lists no slow test, the fast readers of the eight
// named documents stay linked, the hub links of tests that neither import nor run change-loop.mjs or deliver-check.mjs stay dropped, and no
// files key has an empty list. Layer: the data of scripts/test-map.json (design D-1 to D-4 of test-map-hub-links). Suite: test-suite.

// D-1: a document key is a non-code path outside plugins/ (not .mjs, .js, .cjs, .py or .sh, and no bin/ segment).
function isDocumentKey(key) {
  if (key.startsWith('plugins/')) return false;
  if (/\.(mjs|js|cjs|py|sh)$/.test(key)) return false;
  return !key.split('/').includes('bin');
}

// The sorted `<key>: <test>` strings of each document key whose list holds a test of `map.slow`.
function slowDocumentLinks(map) {
  const slow = new Set(map.slow);
  const found = [];
  for (const [key, tests] of Object.entries(map.files)) {
    if (!isDocumentKey(key)) continue;
    for (const file of tests) if (slow.has(file)) found.push(`${key}: ${file}`);
  }
  return found.sort();
}

test('test-map-hub-links AC-1 a document key is a non-code path outside plugins/', () => {
  for (const key of ['openspec/roadmap.md', 'CHANGELOG.md', '.claude-plugin/marketplace.json', '.gitignore', 'docs/adr/']) {
    assert.equal(isDocumentKey(key), true, `${key} is a document key`);
  }
  for (const key of [
    'plugins/openspec/README.md', 'scripts/test-suite.mjs', 'x.js', 'x.cjs', 'scripts/check.py',
    'plugins/openspec/skills/devkit/scripts/install-schemas.sh', 'tools/run.sh', '.compozy/bin/devkit-kit',
  ]) {
    assert.equal(isDocumentKey(key), false, `${key} is not a document key`);
  }
});

test('test-map-hub-links AC-1 slowDocumentLinks names each document key that lists a slow test', () => {
  const S = 'plugins/openspec/hooks/slow.test.mjs';
  const F = 'plugins/openspec/hooks/fast.test.mjs';
  const of = (files) => slowDocumentLinks({ slow: [S], shared: {}, files });
  assert.deepEqual(of({ 'docs/a.md': [F, S] }), [`docs/a.md: ${S}`]);
  assert.deepEqual(of({ 'docs/a.md': [F] }), []);
  assert.deepEqual(of({ 'scripts/x.mjs': [S] }), []);
  assert.deepEqual(of({ 'plugins/openspec/README.md': [S] }), []);
  assert.deepEqual(of({ 'openspec/b.md': [S], 'docs/a.md': [S] }), [`docs/a.md: ${S}`, `openspec/b.md: ${S}`]);
});

test('test-map-hub-links AC-1 AC-2 AC-3 AC-4 the repository\'s map links no slow test to a document, keeps the named documents\' readers and the hubs\' dropped links out, and has no empty list', () => {
  const found = suiteScript.readTestMap(REPO_ROOT);
  assert.equal(found.error, undefined, found.error);
  const { map } = found;
  const listed = suiteFiles(REPO_ROOT);
  const stem = (name) => {
    const hits = listed.filter((file) => file.split('/').pop() === name + TEST_EXT);
    assert.equal(hits.length, 1, `${name} names exactly one suite test file`);
    return hits[0];
  };
  assert.deepEqual(slowDocumentLinks(map), [], 'a document key lists no slow test');
  // D-3: the fast tests that read each of the eight named documents from the checkout.
  const readers = {
    'openspec/roadmap.md': ['guard'],
    'openspec/config.yaml': ['guard', 'test-suite'],
    'CHANGELOG.md': ['guard'],
    'CONTRIBUTING.md': ['guard', 'test-suite'],
    'README.md': ['guard', 'test-suite'],
    'docs/openspec-flow.md': ['guard', 'review-round', 'status-line'],
    'docs/catalog.md': ['guard'],
    '.claude-plugin/marketplace.json': ['guard', 'project-settings'],
  };
  for (const [key, stems] of Object.entries(readers)) {
    for (const name of stems) assert.ok((map.files[key] ?? []).includes(stem(name)), `${key} keeps its reader ${name}`);
  }
  // D-4: the tests that reach a hub only through test-fixtures.mjs, guard.mjs or another module and run none of its code are not linked.
  const dropped = {
    'plugins/openspec/hooks/change-loop.mjs': [
      'conduct-check', 'deliver-check-cli', 'deliver-check', 'flow-check', 'merge-setup', 'release-merge', 'release-note', 'gh-version', 'github-setup',
    ],
    'plugins/openspec/hooks/deliver-check.mjs': ['devkit-kit', 'compozy-driver', 'gh-version', 'github-setup'],
  };
  for (const [hub, stems] of Object.entries(dropped)) {
    for (const name of stems) assert.ok(!map.files[hub].includes(stem(name)), `${hub} does not link ${name}`);
  }
  assert.ok(map.files['plugins/openspec/hooks/change-loop.mjs'].includes(`${HOOKS}/change-loop${TEST_EXT}`), 'change-loop.mjs keeps its own test');
  assert.ok(map.files['plugins/openspec/hooks/deliver-check.mjs'].includes(`${HOOKS}/deliver-check${TEST_EXT}`), 'deliver-check.mjs keeps its own test');
  const empty = Object.entries(map.files).filter(([, tests]) => tests.length === 0).map(([key]) => key);
  assert.deepEqual(empty, [], 'no files key has an empty list');
});

// D-4: the tests each hub keeps, the rows of design.md's two tables marked `kept`.
const KEPT_HUB_READERS = {
  'plugins/openspec/hooks/change-loop.mjs': [
    'gen-agents', 'change-loop-compozy', 'change-loop-declared', 'change-loop-remote-state', 'change-loop-remote', 'change-loop',
    'change-state-listing', 'change-state-stages', 'compozy-driver', 'deliver-check-archive', 'delivery-models', 'delivery-train-after',
    'delivery-train', 'guard', 'jira-task', 'project-loop', 'release-tags', 'roadmap-loop-followups', 'roadmap-loop-upfront', 'roadmap-loop',
    'stage-models', 'status-line', 'version-pin', 'changes-under-way', 'setup-block',
  ],
  'plugins/openspec/hooks/deliver-check.mjs': [
    'change-loop-compozy', 'change-loop-declared', 'change-loop-remote-state', 'change-loop-remote', 'change-loop',
    'change-state-stages', 'conduct-check', 'deliver-check-archive', 'deliver-check-cli', 'deliver-check', 'delivery-models',
    'delivery-train-after', 'delivery-train', 'flow-check', 'guard', 'merge-setup', 'project-loop', 'release-merge', 'release-note',
    'release-tags', 'roadmap-loop-followups', 'roadmap-loop-upfront', 'roadmap-loop', 'stage-models', 'status-line', 'test-suite',
    'version-pin', 'changes-under-way', 'setup-block',
  ],
};

// The one suite file named `<name>` plus the test extension; a name that matches none or several is a plan error.
function suiteStem(listed, name) {
  const hits = listed.filter((file) => file.split('/').pop() === name + TEST_EXT);
  if (hits.length !== 1) throw new Error(`${name} names ${hits.length} suite test files, not one`);
  return hits[0];
}

// The sorted problems of `hub`'s list in `map` against the kept stems: `<hub>: missing <test>` and `<hub>: extra <test>`.
function hubLinkProblems(map, listed, hub, stems) {
  const expected = new Set(stems.map((name) => suiteStem(listed, name)));
  const actual = new Set(map.files[hub] ?? []);
  const missing = [...expected].filter((file) => !actual.has(file)).map((file) => `${hub}: missing ${file}`);
  const extra = [...actual].filter((file) => !expected.has(file)).map((file) => `${hub}: extra ${file}`);
  return [...missing, ...extra].sort();
}

test('test-map-hub-links AC-3 AC-4 hubLinkProblems names a kept reader the hub list lacks and a link it holds beyond the kept ones', () => {
  const T = (name) => `${HOOKS}/${name}${TEST_EXT}`;
  const listed = [T('a'), T('b'), T('c')];
  const hub = 'plugins/openspec/hooks/hub.mjs';
  const of = (tests) => hubLinkProblems({ files: { [hub]: tests } }, listed, hub, ['a', 'b']);
  assert.deepEqual(of([T('a'), T('b')]), []);
  assert.deepEqual(of([T('b'), T('a')]), [], 'the order of the list does not matter');
  assert.deepEqual(of([T('a')]), [`${hub}: missing ${T('b')}`]);
  assert.deepEqual(of([T('a'), T('b'), T('c')]), [`${hub}: extra ${T('c')}`]);
  assert.deepEqual(of([T('a'), T('c')]), [`${hub}: extra ${T('c')}`, `${hub}: missing ${T('b')}`]);
  assert.deepEqual(hubLinkProblems({ files: {} }, listed, hub, ['a']), [`${hub}: missing ${T('a')}`], 'an absent key misses every kept reader');
  assert.throws(() => hubLinkProblems({ files: {} }, listed, hub, ['nope']), /nope names 0 suite test files/);
});

for (const [ac, hub] of [['AC-3', 'plugins/openspec/hooks/change-loop.mjs'], ['AC-4', 'plugins/openspec/hooks/deliver-check.mjs']]) {
  test(`test-map-hub-links ${ac} the map links ${hub} to exactly its kept readers`, () => {
    const found = suiteScript.readTestMap(REPO_ROOT);
    assert.equal(found.error, undefined, found.error);
    assert.deepEqual(hubLinkProblems(found.map, suiteFiles(REPO_ROOT), hub, KEPT_HUB_READERS[hub]), []);
  });
}

// Invariant: M5 asks for a key only for a file git tracks, so an untracked or git-ignored file under a suite folder (a macOS `.DS_Store`,
// an editor's backup) refuses no run; where git cannot tell (no work tree of its own, no tracked file), the disk walk decides and the
// check is never weaker. Layer: the pure function mapProblems of scripts/test-suite.mjs (D-3, "The M5 list"). Suite: test-suite.

// A `files()` folder made a git work tree of its own, everything written committed on `main`.
function gitFiles(content) {
  const root = files(content);
  gitIn(root, 'init', '-q', '-b', 'main');
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-q', '-m', 'base');
  return root;
}
const ORPHAN = `${HOOKS}/orphan.mjs`;
const STRAY = `${HOOKS}/stray.mjs`;
const DS_STORE = `${HOOKS}/.DS_Store`;
const notCovered = (path) => `${path}: is not covered by the map`;

test('selective-tests-by-map-2 AC-9 T-31 M5 on git\'s list: an untracked or an ignored file is no problem; a tracked module no key covers is one, committed or only staged; a deleted tracked file is none', () => {
  const root = gitFiles({ ...MAP_FILES, '.gitignore': 'ignored.log\n' });
  for (const path of [DS_STORE, STRAY, `${HOOKS}/ignored.log`]) writeFileSync(join(root, path), '');
  assert.deepEqual(problemsOf(root, goodMap()), [], 'untracked .DS_Store and stray.mjs, and a file the .gitignore ignores');

  const committed = gitFiles({ ...MAP_FILES, [ORPHAN]: '' });
  assert.deepEqual(said(problemsOf(committed, goodMap())), [notCovered(ORPHAN)], 'a committed module no key covers');

  const staged = gitFiles(MAP_FILES);
  writeFileSync(join(staged, ORPHAN), '');
  gitIn(staged, 'add', ORPHAN);
  assert.deepEqual(said(problemsOf(staged, goodMap())), [notCovered(ORPHAN)], 'a module only staged');

  const covered = gitFiles(MAP_FILES);
  rmSync(join(covered, `${HOOKS}/fixtures/f.json`));
  assert.deepEqual(problemsOf(covered, goodMap()), [], 'a tracked file a folder key covers, deleted and not staged');

  const gone = gitFiles({ ...MAP_FILES, [ORPHAN]: '' });
  rmSync(join(gone, ORPHAN));
  assert.deepEqual(problemsOf(gone, goodMap()), [], 'a tracked module no key covers, deleted and not staged: M5 asks a key only for a file that exists');
});

test('selective-tests-by-map-2 AC-9 T-32 M5 falls back to the walk where git cannot tell: no work tree, a folder inside another repository, a work tree whose suite folders track no file', () => {
  const walked = (root, env) => said(suiteScript.mapProblems(root, goodMap(), suiteFiles(root), env));

  const bare = files({ ...MAP_FILES, [STRAY]: '', [DS_STORE]: '' });
  assert.deepEqual(walked(bare, { ...process.env, GIT_CEILING_DIRECTORIES: dirname(bare) }), [notCovered(DS_STORE), notCovered(STRAY)], 'no git work tree');

  const outer = gitFiles(Object.fromEntries(Object.entries(MAP_FILES).map(([path, text]) => [`inner/${path}`, text])));
  const inner = join(outer, 'inner');
  writeFileSync(join(inner, STRAY), '');
  assert.deepEqual(walked(inner, process.env), [notCovered(STRAY)], 'a folder inside an enclosing repository is not a work tree of its own');

  const empty = files(MAP_FILES);
  gitIn(empty, 'init', '-q', '-b', 'main');
  gitIn(empty, 'add', 'docs/guide.md');
  writeFileSync(join(empty, STRAY), '');
  assert.deepEqual(walked(empty, process.env), [notCovered(STRAY)], 'a work tree whose suite folders track no file');
});

// ---------------------------------------------------------------- selective-tests-by-map-2: the mode, end to end (D-1, D-5, D-6)
// Invariant: `node scripts/test-suite.mjs --own-files` runs the tests the branch's own files map to, prints which ones and why before the
// first `start` line, runs the whole suite when it cannot tell or the branch is a train branch, exits 0 with no run when nothing maps,
// and refuses a bad map or a bad argument before any file runs; without the flag nothing of it runs. Layer: the script, run in a
// synthetic git tree. Suite: test-suite.

const E_A = `${HOOKS}/a${TEST_EXT}`;
const E_B = `${HOOKS}/b${TEST_EXT}`;
const E_C = `${HOOKS}/c${TEST_EXT}`;
const E_ALL = [E_A, E_B, E_C];
const E_MOD = `${HOOKS}/mod.mjs`;
const E_OTHER = `${HOOKS}/other.mjs`;
const E_LATE = `${HOOKS}/late.mjs`;
const E_CHECK = `${HOOKS}/deliver-check.mjs`;
const eMap = (files = {}) => ({
  slow: [],
  shared: {},
  files: { [E_MOD]: [E_A], [E_OTHER]: [E_B], [E_CHECK]: [E_C], 'openspec/config.yaml': [E_B], ...files },
});
const eFiles = (map = eMap(), extra = {}) => ({
  [E_A]: probe({ name: 'suite-speed probe alpha' }),
  [E_B]: probe({ name: 'suite-speed probe beta' }),
  [E_C]: probe({ name: 'suite-speed probe gamma' }),
  [E_MOD]: 'export const m = 1;\n',
  [E_OTHER]: 'export const o = 1;\n',
  'openspec/config.yaml': 'context: |\n  one\n',
  'CHANGELOG.md': '# Changelog\n',
  'scripts/test-map.json': JSON.stringify(map),
  ...extra,
});
const selectedLines = (out) => out.stdout.split('\n').filter((line) => line.startsWith('selected '));
const noStack = (out) => assert.ok(!/^\s+at /m.test(out.stderr), `a stack trace on stderr: ${out.stderr}`);

test('selective-tests-by-map-2 AC-1 T-17 a branch that touches a mapped module prints the selected lines with their by and starts only those files', async () => {
  const root = tree(eFiles());
  commitOnBranch(root, { [E_MOD]: 'export const m = 2;\n' });
  const out = await run(root, ['--own-files']);
  assert.equal(out.code, 0, either(out));
  assert.deepEqual(selectedLines(out), [`selected ${E_A} by ${E_MOD}`]);
  assert.deepEqual(startLines(out), [E_A]);
  assert.ok(out.stdout.indexOf('selected ') < out.stdout.indexOf('start '), 'the selected lines come before the first start line');
  assert.match(out.stdout, /suite: 1 files, 1 tests, 1 pass, 0 fail,/);
});

test('selective-tests-by-map-2 AC-4 AC-6 T-18 a branch of docs and openspec/ files only exits 0, says it selected no test file, starts none and leaves no run root', async () => {
  const root = tree(eFiles());
  commitOnBranch(root, { 'docs/guide.md': '# guide\n', 'openspec/changes/x/tasks.md': '# tasks\n' });
  const out = await run(root, ['--own-files']);
  assert.equal(out.code, 0, either(out));
  assert.deepEqual(out.stdout.trim().split('\n'), ['selected no test file: 2 own files, none maps to a test']);
  assert.deepEqual(readdirSync(out.base), [], 'no run root was made');
  assert.ok(!out.stdout.includes('suite:'), 'no suite line');
});

test('selective-tests-by-map-2 AC-4 T-19 an unmapped code file starts every suite file after a line that names it', async () => {
  const root = tree(eFiles());
  commitOnBranch(root, { 'scripts/x.py': 'print(1)\n' });
  const out = await run(root, ['--own-files']);
  assert.equal(out.code, 0, either(out));
  assert.deepEqual(selectedLines(out), ['selected the whole suite: no entry of scripts/test-map.json covers scripts/x.py']);
  assert.deepEqual(startLines(out).sort(), E_ALL);
});

test('selective-tests-by-map-2 AC-7 T-20 a train branch, from the pull request variable or the local branch, runs the whole suite; another branch name stays selective', async () => {
  const root = tree(eFiles());
  commitOnBranch(root, { [E_MOD]: 'export const m = 2;\n' });
  const train = await run(root, ['--own-files'], { env: { GITHUB_HEAD_REF: 'train/7' } });
  assert.equal(train.code, 0, either(train));
  assert.deepEqual(selectedLines(train), ['selected the whole suite: train/7 is a train branch']);
  assert.deepEqual(startLines(train).sort(), E_ALL);

  const plain = await run(root, ['--own-files'], { env: { GITHUB_HEAD_REF: 'feature' } });
  assert.equal(plain.code, 0, either(plain));
  assert.deepEqual(startLines(plain), [E_A], 'the same tree, another branch name, is selective');

  gitIn(root, 'switch', '-q', '-c', 'train/3');
  const local = await run(root, ['--own-files']);
  assert.equal(local.code, 0, either(local));
  assert.deepEqual(selectedLines(local), ['selected the whole suite: train/3 is a train branch']);
  assert.deepEqual(startLines(local).sort(), E_ALL);

  gitIn(root, 'switch', '-q', '-c', 'train/3x');
  const near = await run(root, ['--own-files']);
  assert.deepEqual(startLines(near), [E_A], 'train/3x is not a train branch');
});

test('selective-tests-by-map-2 AC-1 T-21 an uncommitted, a staged and an untracked own file count; an uncommitted openspec/ file selects nothing until it is committed', async () => {
  const root = tree(eFiles(eMap({ [E_LATE]: [E_C] })));
  writeFileSync(join(root, E_MOD), 'export const m = 3;\n'); // modified, not staged
  writeFileSync(join(root, E_OTHER), 'export const o = 3;\n'); // staged
  gitIn(root, 'add', E_OTHER);
  writeFileSync(join(root, E_LATE), 'export const l = 1;\n'); // untracked
  const dirty = await run(root, ['--own-files']);
  assert.equal(dirty.code, 0, either(dirty));
  assert.deepEqual(selectedLines(dirty), [`selected ${E_A} by ${E_MOD}`, `selected ${E_B} by ${E_OTHER}`, `selected ${E_C} by ${E_LATE}`]);

  const config = tree(eFiles());
  writeFileSync(join(config, 'openspec/config.yaml'), 'context: |\n  two\n');
  const unsaved = await run(config, ['--own-files']);
  assert.equal(unsaved.code, 0, either(unsaved));
  assert.deepEqual(selectedLines(unsaved), ['selected no test file: no own file']);
  commitOnBranch(config, {});
  const saved = await run(config, ['--own-files']);
  assert.deepEqual(selectedLines(saved), [`selected ${E_B} by openspec/config.yaml`]);
});

test('selective-tests-by-map-2 AC-4 T-22 when the own files cannot be told, the whole suite runs: no origin/main, no git repository, no commit; release files only select nothing', async () => {
  const noBase = tree(eFiles());
  gitIn(noBase, 'update-ref', '-d', 'refs/remotes/origin/main');
  const missing = await run(noBase, ['--own-files']);
  assert.equal(missing.code, 0, either(missing));
  assert.deepEqual(selectedLines(missing), ['selected the whole suite: origin/main is missing']);
  assert.deepEqual(startLines(missing).sort(), E_ALL);

  const bare = tree(eFiles(), { git: false });
  const nogit = await run(bare, ['--own-files'], { env: { GIT_CEILING_DIRECTORIES: dirname(bare) } });
  assert.equal(nogit.code, 0, either(nogit));
  assert.equal(selectedLines(nogit).length, 1);
  assert.ok(selectedLines(nogit)[0].startsWith('selected the whole suite: git cannot tell the own files: '), selectedLines(nogit)[0]);
  assert.deepEqual(startLines(nogit).sort(), E_ALL);
  noStack(nogit);

  const unborn = tree(eFiles());
  gitIn(unborn, 'checkout', '-q', '--orphan', 'unborn');
  const empty = await run(unborn, ['--own-files']);
  assert.equal(empty.code, 0, either(empty));
  assert.deepEqual(selectedLines(empty), ['selected the whole suite: no commit']);

  const release = tree(eFiles());
  commitOnBranch(release, { 'CHANGELOG.md': '# Changelog\n\n## 1.0.0\n' });
  const none = await run(release, ['--own-files']);
  assert.equal(none.code, 0, either(none));
  assert.deepEqual(selectedLines(none), ['selected no test file: no own file']);
  assert.deepEqual(startLines(none), []);
});

test('selective-tests-by-map-2 AC-9 T-23 a map that names a missing file exits 1 naming the entry and starts no file', async () => {
  const ghost = `${HOOKS}/ghost.mjs`;
  const root = tree(eFiles(eMap({ [ghost]: [E_A] })));
  commitOnBranch(root, { [E_MOD]: 'export const m = 2;\n' });
  const out = await run(root, ['--own-files']);
  assert.equal(out.code, 1, either(out));
  assert.ok(out.stderr.includes(`scripts/test-map.json: ${ghost}: names ${ghost}, which does not exist`), out.stderr);
  assert.ok(out.stderr.includes('refused: 1 test map problems'), out.stderr);
  assert.deepEqual(startLines(out), []);
  noStack(out);
});

test('selective-tests-by-map-2 AC-9 T-23 a missing or unreadable map file exits 1 before any file runs', async () => {
  const missing = tree(eFiles());
  rmSync(join(missing, 'scripts', 'test-map.json'));
  const out = await run(missing, ['--own-files']);
  assert.equal(out.code, 1, either(out));
  assert.ok(out.stderr.includes('scripts/test-map.json: cannot read: ENOENT'), out.stderr);
  assert.deepEqual(startLines(out), []);

  const broken = tree(eFiles(undefined, { 'scripts/test-map.json': '{' }));
  const notJson = await run(broken, ['--own-files']);
  assert.equal(notJson.code, 1, either(notJson));
  assert.match(notJson.stderr, /scripts\/test-map\.json: not JSON: /);
  assert.deepEqual(startLines(notJson), []);
});

test('selective-tests-by-map-2 AC-1 T-24 --own-files with a file argument or a value exits 2 and starts no file', async () => {
  const root = tree(eFiles());
  const withFile = await run(root, ['--own-files', E_A]);
  assert.equal(withFile.code, 2, either(withFile));
  assert.ok(withFile.stderr.includes('--own-files takes no file argument'), withFile.stderr);
  assert.match(withFile.stderr, /^usage: node scripts\/test-suite\.mjs .*\[--own-files\]/m);
  assert.deepEqual(startLines(withFile), []);
  const withValue = await run(root, ['--own-files=x']);
  assert.equal(withValue.code, 2, either(withValue));
  assert.ok(withValue.stderr.includes('unknown argument: --own-files=x'), withValue.stderr);
  assert.deepEqual(startLines(withValue), []);
});

test('selective-tests-by-map-2 AC-8 T-25 a whole run of a tree with a broken map and no deliver-check.mjs runs every file as before', async () => {
  const root = tree(eFiles(undefined, { 'scripts/test-map.json': '{' }), { link: false });
  const out = await run(root, []);
  assert.equal(out.code, 0, either(out));
  assert.deepEqual(startLines(out).sort(), E_ALL);
  assert.ok(!out.stdout.includes('selected '), out.stdout);
  assert.match(out.stdout, /suite: 3 files, 3 tests, 3 pass, 0 fail,/);
});

test('selective-tests-by-map-2 AC-1 T-26 under --own-files, the reporter and a name pattern reach the selected children', async () => {
  const root = tree(eFiles());
  commitOnBranch(root, { [E_MOD]: 'export const m = 2;\n' });
  const out = await run(root, ['--own-files', '--reporter=tap', '--test-name-pattern=alpha']);
  assert.equal(out.code, 0, either(out));
  assert.match(out.stdout, /^ok 1 - suite-speed probe alpha$/m, 'the tap reporter reached the child');
  assert.deepEqual(startLines(out), [E_A]);
  const skipped = await run(root, ['--own-files', '--test-name-pattern=beta']);
  assert.equal(skipped.code, 0, either(skipped));
  assert.deepEqual(startLines(skipped), [E_A], 'the file still starts');
  assert.ok(!skipped.stdout.includes('suite-speed probe alpha'), 'alpha ran although the pattern names beta');
});

// Invariant: the map check refuses no run over a file the repository does not hold (an ignored one), and an untracked file no key covers is
// an own file that selects the whole suite, while a committed module no key covers is refused. Layer: the script, run in a synthetic git
// tree whose committed .gitignore is the repository's (D-3, "The M5 list"). Suite: test-suite.
const NOT_COVERED = 'is not covered by the map';
const IGNORING = { '.gitignore': '.DS_Store\n__pycache__/\n' };

test('selective-tests-by-map-2 AC-9 T-33 an ignored .DS_Store and __pycache__ change no selected line; an untracked stray file no key covers selects the whole suite; a committed one is refused', async () => {
  const root = tree(eFiles(undefined, IGNORING));
  commitOnBranch(root, { [E_MOD]: 'export const m = 2;\n' });
  const clean = await run(root, ['--own-files']);
  assert.equal(clean.code, 0, either(clean));
  assert.deepEqual(selectedLines(clean), [`selected ${E_A} by ${E_MOD}`]);
  writeFileSync(join(root, HOOKS, '.DS_Store'), '');
  mkdirSync(join(root, HOOKS, '__pycache__'));
  writeFileSync(join(root, HOOKS, '__pycache__', 'x.pyc'), '');
  const littered = await run(root, ['--own-files']);
  assert.equal(littered.code, 0, either(littered));
  assert.ok(!either(littered).includes(NOT_COVERED), either(littered));
  assert.deepEqual(selectedLines(littered), selectedLines(clean), 'the same selected lines as the same run without the ignored files');
  assert.deepEqual(startLines(littered), [E_A]);

  const stray = tree(eFiles(undefined, IGNORING));
  commitOnBranch(stray, { [E_MOD]: 'export const m = 2;\n' });
  writeFileSync(join(stray, HOOKS, 'stray.tmp'), '');
  const whole = await run(stray, ['--own-files']);
  assert.equal(whole.code, 0, either(whole));
  assert.deepEqual(selectedLines(whole), [`selected the whole suite: no entry of scripts/test-map.json covers ${HOOKS}/stray.tmp`]);
  assert.ok(!either(whole).includes(NOT_COVERED), either(whole));
  assert.deepEqual(startLines(whole).sort(), E_ALL);

  const orphan = tree(eFiles(undefined, IGNORING));
  commitOnBranch(orphan, { [`${HOOKS}/orphan.mjs`]: 'export const o = 1;\n' });
  const refused = await run(orphan, ['--own-files']);
  assert.equal(refused.code, 1, either(refused));
  assert.ok(refused.stderr.includes(`scripts/test-map.json: ${HOOKS}/orphan.mjs: ${NOT_COVERED}`), refused.stderr);
  assert.deepEqual(startLines(refused), []);
});

// Invariant: the script reads the branch it is on through `currentBranch` of deliver-check.mjs, the owner of the train rule, so
// DEVKIT_BRANCH wins over GITHUB_HEAD_REF, which wins over the git branch (D-5). Layer: the script, run in a synthetic git tree on the local
// branch `feature`. Suite: test-suite. With both variables blank, the local branch decides: T-20.
test('selective-tests-by-map-2 AC-7 T-34 DEVKIT_BRANCH names the branch: train/4 runs the whole suite on a local feature branch, and feature beside GITHUB_HEAD_REF=train/7 stays selective', async () => {
  const root = tree(eFiles());
  commitOnBranch(root, { [E_MOD]: 'export const m = 2;\n' });
  const train = await run(root, ['--own-files'], { env: { DEVKIT_BRANCH: 'train/4' } });
  assert.equal(train.code, 0, either(train));
  assert.deepEqual(selectedLines(train), ['selected the whole suite: train/4 is a train branch']);
  assert.deepEqual(startLines(train).sort(), E_ALL);

  const wins = await run(root, ['--own-files'], { env: { DEVKIT_BRANCH: 'feature', GITHUB_HEAD_REF: 'train/7' } });
  assert.equal(wins.code, 0, either(wins));
  assert.deepEqual(selectedLines(wins), [`selected ${E_A} by ${E_MOD}`], 'DEVKIT_BRANCH wins over GITHUB_HEAD_REF, as in currentBranch');
  assert.deepEqual(startLines(wins), [E_A]);
});

// Invariant: the own files are the diff against the base `stalenessBase(root, process.env)` gives: `GITHUB_BASE_REF` in CI, else origin/HEAD
// (D-2). Layer: the script, run in a synthetic git tree with a second origin branch `origin/release`, one commit past `origin/main` that
// touches module A; the branch under test is made from it and touches module B. Suite: test-suite. The case passes on the code as it stands:
// the mutation of task 2.9 (`{}` in place of `process.env` in the script's `stalenessBase` call) is what turns it red.
test('selective-tests-by-map-2 AC-1 T-35 GITHUB_BASE_REF names the base: release selects only what the branch added past it, and a blank one diffs against origin/main', async () => {
  const root = tree(eFiles());
  gitIn(root, 'switch', '-q', '-c', 'release');
  commitOnBranch(root, { [E_MOD]: 'export const m = 2;\n' }, 'release adds module A');
  gitIn(root, 'update-ref', 'refs/remotes/origin/release', 'HEAD');
  gitIn(root, 'switch', '-q', '-c', 'work');
  commitOnBranch(root, { [E_OTHER]: 'export const o = 2;\n' }, 'work adds module B');

  const ci = await run(root, ['--own-files'], { env: { GITHUB_BASE_REF: 'release' } });
  assert.equal(ci.code, 0, either(ci));
  assert.deepEqual(selectedLines(ci), [`selected ${E_B} by ${E_OTHER}`], 'against origin/release only module B is own');
  assert.deepEqual(startLines(ci), [E_B]);

  const local = await run(root, ['--own-files']);
  assert.equal(local.code, 0, either(local));
  assert.deepEqual(selectedLines(local).sort(), [`selected ${E_A} by ${E_MOD}`, `selected ${E_B} by ${E_OTHER}`].sort(), 'a blank GITHUB_BASE_REF diffs against origin/main: A and B are own');
  assert.deepEqual(startLines(local).sort(), [E_A, E_B]);
});

// Invariant: the agents read the selective command as the project's test command and gate, and the train keeps the whole command.
// Layer: the text of openspec/config.yaml. Suite: test-suite.test.mjs.
test('selective-tests-by-map-2 AC-5 T-30 the config names the selective command as the test command and the gate, and the train keeps the whole command', () => {
  const config = readFileSync(join(REPO_ROOT, 'openspec', 'config.yaml'), 'utf8').split('\n');
  const line = (prefix) => config.find((l) => l.startsWith(prefix));
  assert.equal(line('  Test command: '), '  Test command: node scripts/test-suite.mjs --own-files && python3 scripts/check.py');
  const gates = line('  Gates: ');
  assert.ok(gates, 'openspec/config.yaml has no Gates line');
  assert.ok(gates.includes('`node scripts/test-suite.mjs --own-files`'), 'the Gates line does not name the selective command');
  assert.ok(gates.includes('`python3 scripts/check.py`'), 'the Gates line does not name the check part');
  assert.ok(gates.includes('--test-name-pattern="^<name>"'), 'the Gates line lost the sentence on --test-name-pattern');
  assert.ok(config.includes('    train: "node scripts/test-suite.mjs && python3 scripts/check.py"'), 'devkit.delivery.train is not the whole command');
  const history = line('  Test history: ');
  assert.ok(history.includes("CI's push run checks out at depth 1"), 'the Test history line does not say the depth is the push run');
});

// Invariant: the documents the sessions read name the selective command and its map, after the whole-suite row they keep.
// Layer: the text of CLAUDE.md, CONTRIBUTING.md and docs/openspec-flow.md. Suite: test-suite.test.mjs.
test('selective-tests-by-map-2 AC-5 T-30 CLAUDE.md has the selective row after the whole one, CONTRIBUTING.md names the mode and the map, and the flow page names the project test command', () => {
  const claude = readFileSync(join(REPO_ROOT, 'CLAUDE.md'), 'utf8').split('\n');
  const whole = claude.findIndex((l) => l.includes('node scripts/test-suite.mjs'));
  assert.ok(whole >= 0 && !claude[whole].includes('--own-files'), 'the first CLAUDE.md line with the command is not the whole-suite row');
  const selective = claude.findIndex((l, i) => i > whole && l.startsWith('|') && l.includes('node scripts/test-suite.mjs --own-files'));
  assert.ok(selective > whole, 'CLAUDE.md has no Commands row with --own-files after the whole-suite row');
  assert.ok(claude[selective].includes('scripts/test-map.json'), 'the selective row does not name the map');
  assert.ok(claude.some((l, i) => i > selective && l.startsWith('- ') && l.includes('scripts/test-map.json')), 'CLAUDE.md has no working rule on the map upkeep');
  const contributing = readFileSync(join(REPO_ROOT, 'CONTRIBUTING.md'), 'utf8');
  assert.ok(contributing.includes('--own-files'), 'CONTRIBUTING.md does not name --own-files');
  assert.ok(contributing.includes('scripts/test-map.json'), 'CONTRIBUTING.md does not name scripts/test-map.json');
  const flow = readFileSync(join(REPO_ROOT, 'docs', 'openspec-flow.md'), 'utf8');
  assert.ok(flow.includes("the project's test command runs once, in the evidence stage that follows"), 'the flow page does not name the project test command');
  assert.ok(!flow.includes('the whole test suite runs once, in the evidence stage that follows'), 'the flow page still says the whole test suite');
});
