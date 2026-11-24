// node --test plugins/openspec/hooks/test-tmp.test.mjs
// test-fixture-cleanup: the temporary-folder helper (`test-tmp.mjs`) removes what a test makes, and its copies stay identical.
// Run by `node scripts/test-suite.mjs`, in a process of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const HELPER_URL = pathToFileURL(join(HERE, 'test-tmp.mjs')).href;
const HELPER_COPIES = [
  join(HERE, 'test-tmp.mjs'),
  join(REPO_ROOT, 'plugins', 'core', 'skills', 'review-change', 'scripts', 'test-tmp.mjs'),
  join(REPO_ROOT, 'plugins', 'compozy', 'skills', 'test-tmp.mjs'),
];

// Runs `source` as a script of its own, with a temporary root of its own, and reports how it ended.
// With `signal`, waits for READY on stdout, sends the signal, then waits for the exit.
async function probe(source, { signal } = {}) {
  const folder = tmpFolder('devkit-tmp-probe-');
  const childRoot = tmpFolder('devkit-tmp-probe-root-');
  const logFile = join(folder, 'probe.log');
  writeFileSync(join(folder, 'probe.mjs'), source);
  const child = spawn(process.execPath, [join(folder, 'probe.mjs')], {
    env: { ...process.env, TMPDIR: childRoot, PROBE_LOG: logFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.resume();
  const ended = new Promise((resolve) => child.on('close', (code, sig) => resolve({ code, signal: sig })));
  if (signal) {
    const deadline = Date.now() + 30_000;
    while (!stdout.includes('READY')) {
      if (Date.now() > deadline) {
        child.kill('SIGKILL');
        await ended;
        assert.fail('the probe never wrote READY within 30 seconds');
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    child.kill(signal);
  }
  const result = await ended;
  const log = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [];
  return { ...result, log, left: readdirSync(childRoot) };
}

// The paths whose bytes differ from the first one's.
function differingCopies(paths) {
  const [first, ...rest] = paths;
  const reference = readFileSync(first);
  return rest.filter((path) => !readFileSync(path).equals(reference));
}

const HEAD = `
import { test } from 'node:test';
import { appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpFolder } from ${JSON.stringify(HELPER_URL)};
const log = (line) => appendFileSync(process.env.PROBE_LOG, line + '\\n');
`;

test('test-fixture-cleanup AC-1 a folder is removed when its test passes and when it fails', async () => {
  const run = await probe(HEAD + `
let passed, failed;
test('pass', () => { passed = tmpFolder('devkit-probe-pass-'); writeFileSync(join(passed, 'f.txt'), 'x'); });
test('fail', () => { failed = tmpFolder('devkit-probe-fail-'); throw new Error('boom'); });
test('check', () => { log('SEEN pass=' + existsSync(passed) + ' fail=' + existsSync(failed)); });
`);
  assert.equal(run.code, 1, 'the failing probe test makes the probe exit 1');
  assert.ok(run.log.includes('SEEN pass=false fail=false'), `log: ${JSON.stringify(run.log)}`);
  assert.deepEqual(run.left, [], 'nothing is left in the probe temporary root');
});

test('test-fixture-cleanup AC-1 a prefix that does not start with devkit- is refused and makes nothing', async () => {
  const run = await probe(HEAD + `
test('refuse', () => {
  try { tmpFolder('x-'); log('NOTHROW'); } catch (e) { log('THROW ' + e.message); }
});
`);
  assert.equal(run.code, 0);
  assert.deepEqual(run.log, ['THROW test-tmp: a prefix starts with devkit- and ends with -: x-']);
  assert.deepEqual(run.left, []);
});

test('test-fixture-cleanup AC-2 a module-level folder lives through the tests and goes at the run end', async () => {
  const run = await probe(HEAD + `
const made = tmpFolder('devkit-probe-module-');
test('seen', () => { log('SEEN module=' + existsSync(made)); });
`);
  assert.equal(run.code, 0);
  assert.ok(run.log.includes('SEEN module=true'), `log: ${JSON.stringify(run.log)}`);
  assert.deepEqual(run.left, [], 'the exit sweep removed the module-level folder');
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`test-fixture-cleanup AC-2 ${signal} sweeps the module-level folder and the one of a running test`, async () => {
    const run = await probe(HEAD + `
const atModule = tmpFolder('devkit-probe-module-');
log('MADE ' + atModule);
test('hang', async () => {
  const inTest = tmpFolder('devkit-probe-test-');
  log('MADE ' + inTest);
  setInterval(() => {}, 1000);
  console.log('READY');
  await new Promise(() => {});
});
`, { signal });
    const made = run.log.filter((line) => line.startsWith('MADE ')).map((line) => line.slice(5));
    assert.equal(made.length, 2, `log: ${JSON.stringify(run.log)}`);
    for (const path of made) assert.equal(existsSync(path), false, `${path} is gone after ${signal}`);
    assert.deepEqual(run.left, []);
  });
}

test('test-fixture-cleanup AC-4 the three copies of the helper are identical', () => {
  assert.deepEqual(differingCopies(HELPER_COPIES), [], 'copies that differ from the openspec one');
});

test('test-fixture-cleanup AC-4 a copy with one byte changed is named', () => {
  const folder = tmpFolder('devkit-tmp-copies-');
  const changed = join(folder, 'test-tmp.mjs');
  const bytes = readFileSync(HELPER_COPIES[0]);
  bytes[bytes.length - 1] ^= 0x01;
  writeFileSync(changed, bytes);
  assert.deepEqual(differingCopies([HELPER_COPIES[0], changed]), [changed]);
});

// `<path relative to root>:<line>` of every raw temporary-folder call in a *.test.mjs or a fixtures module (test-fixtures.mjs, *-fixtures.mjs) under <root>/plugins.
const RAW_TEMP_CALL = /\bmkdtempSync\s*\(|\btmpdir\s*\(/;
function rawTempCalls(root) {
  const found = [];
  const files = readdirSync(join(root, 'plugins'), { recursive: true });
  for (const file of files) {
    const parts = String(file).split(/[\\/]/);
    if (parts.includes('node_modules') || !(String(file).endsWith('.test.mjs') || String(file).endsWith('-fixtures.mjs'))) continue;
    const lines = readFileSync(join(root, 'plugins', String(file)), 'utf8').split('\n');
    lines.forEach((line, at) => {
      if (RAW_TEMP_CALL.test(line)) found.push(`${join('plugins', String(file))}:${at + 1}`);
    });
  }
  return found.sort();
}

test('test-fixture-cleanup AC-3 a raw mkdtemp or tmpdir call in a test file is found by file and line', () => {
  const root = tmpFolder('devkit-tmp-raw-');
  mkdirSync(join(root, 'plugins', 'x'), { recursive: true });
  writeFileSync(join(root, 'plugins', 'x', 'fake.test.mjs'), [
    "import { tmpFolder } from './test-tmp.mjs';",
    'const a = ' + 'mkdtemp' + "Sync('x');",
    'const b = os.' + 'tmp' + 'dir();',
    'const c = tmpFolder(\'devkit-ok-\');',
  ].join('\n'));
  assert.deepEqual(rawTempCalls(root), ['plugins/x/fake.test.mjs:2', 'plugins/x/fake.test.mjs:3']);
});

test('suite-speed AC-3 the raw-temp scan reads test-fixtures.mjs and every *-fixtures.mjs', () => {
  const root = tmpFolder('devkit-tmp-raw-fixtures-');
  mkdirSync(join(root, 'plugins', 'x'), { recursive: true });
  writeFileSync(join(root, 'plugins', 'x', 'test-fixtures.mjs'), [
    "import { tmpFolder } from './test-tmp.mjs';",
    'const a = ' + 'mkdtemp' + "Sync('x');",
    'const c = tmpFolder(\'devkit-ok-\');',
  ].join('\n'));
  writeFileSync(join(root, 'plugins', 'x', 'x-fixtures.mjs'), [
    "import { tmpFolder } from './test-tmp.mjs';",
    'const c = tmpFolder(\'devkit-ok-\');',
    'const a = os.' + 'tmp' + 'dir();',
  ].join('\n'));
  writeFileSync(join(root, 'plugins', 'x', 'notes.mjs'), 'const b = os.' + 'tmp' + 'dir();\n');
  assert.deepEqual(rawTempCalls(root), ['plugins/x/test-fixtures.mjs:2', 'plugins/x/x-fixtures.mjs:3']);
});

test('test-fixture-cleanup AC-3 no test file under plugins makes a temporary folder or reads the root by hand', () => {
  assert.deepEqual(rawTempCalls(REPO_ROOT), [], 'raw calls: use tmpFolder or tmpRoot from test-tmp.mjs');
});

// Steps of a workflow file: split at each `- name:` or `- uses:` line.
function ciSteps(text) {
  const steps = [];
  for (const line of text.split('\n')) {
    if (/^\s*- (name|uses):/.test(line)) {
      const name = line.match(/^\s*- name:\s*(.*)$/);
      steps.push({ name: name ? name[1].trim() : '', text: '' });
    }
    if (steps.length) steps[steps.length - 1].text += line + '\n';
  }
  return steps;
}

// Invariant: CI runs the one suite command in one step, and that command owns each file's empty TMPDIR.
// Layer: the CI workflow text. Suite: test-tmp.test.mjs.
test('test-fixture-cleanup AC-5 the hook tests run on an empty TMPDIR and a step fails when it is not empty after', () => {
  const steps = ciSteps(readFileSync(join(REPO_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'));
  const install = steps.findIndex((s) => s.name.startsWith('Install OpenSpec'));
  assert.notEqual(install, -1, 'ci.yml has no Install OpenSpec step');
  const at = steps.findIndex((s) => s.name === 'Test suite');
  assert.ok(at > install, 'ci.yml has no step named Test suite after the Install OpenSpec step');
  assert.ok(steps[at].text.includes('node scripts/test-suite.mjs'), 'step Test suite lacks: node scripts/test-suite.mjs');
  for (const old of ['Hook tests', 'Hook tests left nothing in TMPDIR']) {
    assert.equal(steps.some((s) => s.name === old), false, `ci.yml still has a step named ${old}`);
  }
  for (const s of steps) {
    for (const part of ['hook-tests-tmp', 'guard.test.mjs']) {
      assert.ok(!s.text.includes(part), `step ${s.name || '(unnamed)'} still holds: ${part}`);
    }
  }
});
