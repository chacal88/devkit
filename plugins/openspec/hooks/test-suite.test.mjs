// Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`
// suite-speed: the suite script (`scripts/test-suite.mjs`): its file list, arguments, parallel pool, per-file TMPDIR, leftover check,
// exit codes, signals and the check that no test file imports another test file. Every probe runs a copy of the script inside a
// synthetic tree and reads that run's output; the probe's own output never reaches this file's output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync, readdirSync, symlinkSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import { suiteFiles, testImports } from '../../../scripts/test-suite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'test-suite.mjs');
// Built from pieces, so the repository scans (the import check, the skip check) do not find them in this file.
const TEST_EXT = '.test' + '.mjs';
const IMPORT = 'imp' + 'ort';
const FROM = 'fr' + 'om';

const HOOKS = 'plugins/openspec/hooks';
const SETUP = 'plugins/openspec/skills/openspec-setup/scripts';
const REVIEW = 'plugins/core/skills/review-change/scripts';
const COMPOZY_SETUP = 'plugins/compozy/skills/compozy-setup/scripts';

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

// A synthetic repository: a copy of the script and the given files (path relative to the tree -> text).
function tree(files) {
  const root = tmpFolder('devkit-suite-tree-');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  copyFileSync(SCRIPT, join(root, 'scripts', 'test-suite.mjs'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

// Starts the copy of the script in `root`; `done` settles when it has ended. `base` is the TMPDIR the script gets, so the
// run root it makes lives in a folder this test owns. NODE_TEST_CONTEXT is left in the environment on purpose.
function start(root, args = [], { env = {}, base = tmpFolder('devkit-suite-base-') } = {}) {
  const child = spawn(process.execPath, [join(root, 'scripts', 'test-suite.mjs'), ...args], {
    cwd: root,
    env: { ...process.env, TMPDIR: base, ...env },
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

test('suite-speed AC-1 the script runs the test files of the four folders and no other', async () => {
  const root = tree({
    [`${HOOKS}/a${TEST_EXT}`]: probe(),
    [`${HOOKS}/sub/deeper${TEST_EXT}`]: probe(),
    [`${SETUP}/b${TEST_EXT}`]: probe(),
    [`${REVIEW}/c${TEST_EXT}`]: probe(),
    [`${COMPOZY_SETUP}/d${TEST_EXT}`]: probe(),
    [`${HOOKS}/notes.mjs`]: 'throw new Error("not a test file");\n',
    [`${HOOKS}/node_modules/dep/n${TEST_EXT}`]: probe({ body: 'assert.fail("node_modules is not read");' }),
    [`plugins/compozy/skills/x/c${TEST_EXT}`]: probe({ body: 'assert.fail("only the compozy-setup folder is in the suite");' }),
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
  const together = await run(tree(files), ['--concurrency=2'], { env: { PROBE_MARKS: marks, PROBE_WAIT_MS: '5000' } });
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
  assert.equal(dirname(dirname(a.tmp)), realpathSync(out.base));
  assert.equal(existsSync(dirname(a.tmp)), false, 'the run root is still there after the run');
  assert.deepEqual(readdirSync(out.base), []);
});

test('suite-speed AC-4 a symlinked TMPDIR gives each file a real path', async () => {
  const target = tmpFolder('devkit-suite-target-');
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
  assert.equal(dirname(dirname(seen.tmp)), realpathSync(target), 'the run root is under the real path of the target');
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
  const compozy = check({ [`plugins/compozy/skills/x/b${TEST_EXT}`]: body });
  assert.equal(compozy.code, 0, compozy.out);
  assert.equal(compozy.out.trim(), 'all checks passed');
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
