// Tests for ship-entry.mjs (project-phases, design D-15). Run by `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from '../../../hooks/test-tmp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'ship-entry.mjs');
const BLANKS = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const ENV = { ...process.env, ...BLANKS };
const PIN = /CI pin/;

// A project root whose openspec/config.yaml holds `text` (or no config at all when `text` is null).
function project(text) {
  const root = realpathSync(tmpFolder('devkit-ship-entry-'));
  mkdirSync(join(root, 'openspec'));
  const file = join(root, 'openspec', 'config.yaml');
  if (text !== null) writeFileSync(file, text);
  const read = () => readFileSync(file, 'utf8');
  return { root, file, read };
}
const runIn = (root, ...args) => {
  const r = spawnSync(process.execPath, [script, root, ...args], { encoding: 'utf8', env: ENV });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test('ship-entry: a block with devkit merge gains devkit-project merge and every other byte is unchanged', () => {
  const before = 'schema: devkit\nship:\n  devkit: merge\n  devkit-lite: pr\n# trailing comment\nmerge_method: squash\n';
  const p = project(before);
  const r = runIn(p.root, '--apply');
  assert.equal(r.code, 0, r.err);
  assert.equal(p.read(), 'schema: devkit\nship:\n  devkit: merge\n  devkit-lite: pr\n  devkit-project: merge\n# trailing comment\nmerge_method: squash\n');
});

test('ship-entry: a block with no devkit key gains devkit-project plan', () => {
  const p = project('ship:\n  devkit-lite: merge\nother: 1\n');
  const r = runIn(p.root, '--apply');
  assert.equal(r.code, 0, r.err);
  assert.equal(p.read(), 'ship:\n  devkit-lite: merge\n  devkit-project: plan\nother: 1\n');
  assert.doesNotMatch(r.err + r.out, PIN, 'plan mode asks for no CI pin');
});

test('ship-entry: the new line takes the block\'s own indent', () => {
  const p = project('ship:\n    devkit: pr\n');
  runIn(p.root, '--apply');
  assert.equal(p.read(), 'ship:\n    devkit: pr\n    devkit-project: pr\n');
});

test('ship-entry: a block that already has the devkit-project key is left alone', () => {
  const before = 'ship:\n  devkit: merge\n  devkit-project: pr\n';
  const p = project(before);
  const r = runIn(p.root, '--apply');
  assert.equal(r.code, 0, r.err);
  assert.equal(p.read(), before);
});

test('ship-entry: a config with no ship entry, and a project with no config, are left alone', () => {
  const before = 'schema: devkit\nmerge_method: squash\n';
  const p = project(before);
  assert.equal(runIn(p.root, '--apply').code, 0);
  assert.equal(p.read(), before);
  const none = project(null);
  const r = runIn(none.root, '--apply');
  assert.equal(r.code, 0, r.err);
});

test('ship-entry: the flow form gains the key before its closing brace and an empty one becomes a one-key map', () => {
  const a = project('ship: { devkit: merge }\n');
  runIn(a.root, '--apply');
  assert.equal(a.read(), 'ship: { devkit: merge, devkit-project: merge }\n');
  const b = project('ship: {}\n');
  runIn(b.root, '--apply');
  assert.equal(b.read(), 'ship: { devkit-project: plan }\n');
  const c = project('ship: { devkit-lite: pr, devkit: pr }\nx: 1\n');
  runIn(c.root, '--apply');
  assert.equal(c.read(), 'ship: { devkit-lite: pr, devkit: pr, devkit-project: pr }\nx: 1\n');
});

test('ship-entry: an entry parseShip refuses exits 3 with its message and writes nothing', () => {
  for (const before of ['ship:\n  devkit: fast\n', 'ship: { devkit: merge\n', 'ship: merge\n']) {
    const p = project(before);
    const r = runIn(p.root, '--apply');
    assert.equal(r.code, 3, before);
    assert.match(r.err, /ship/);
    assert.equal(p.read(), before);
  }
});

test('ship-entry: adding merge prints the CI pin line, adding pr or plan does not', () => {
  const merge = runIn(project('ship:\n  devkit: merge\n').root, '--apply');
  assert.match(merge.err + merge.out, PIN);
  assert.match(merge.err + merge.out, /v0\.20\.0|new release/);
  const pr = runIn(project('ship:\n  devkit: pr\n').root, '--apply');
  assert.doesNotMatch(pr.err + pr.out, PIN);
  const done = runIn(project('ship:\n  devkit: merge\n  devkit-project: merge\n').root, '--apply');
  assert.doesNotMatch(done.err + done.out, PIN, 'nothing added, nothing to pin');
});

test('ship-entry: --apply writes and the plain run writes nothing but shows the file it would write', () => {
  const before = 'ship:\n  devkit: merge\n';
  const p = project(before);
  const plain = runIn(p.root);
  assert.equal(plain.code, 0, plain.err);
  assert.equal(p.read(), before, 'the plain run writes nothing');
  assert.match(plain.out, /^ {2}devkit-project: merge$/m, 'the plain run shows the added entry');
  assert.match(plain.err + plain.out, PIN, 'the plain run names the pin too');
  const applied = runIn(p.root, '--apply');
  assert.equal(applied.code, 0, applied.err);
  assert.equal(p.read(), 'ship:\n  devkit: merge\n  devkit-project: merge\n');
});

test('ship-entry: a missing project root exits 2 with the usage line', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', env: ENV });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: ship-entry\.mjs/);
});
