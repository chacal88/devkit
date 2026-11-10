// Tests for install-schemas.sh (devkit per project, design D5). Imported by hooks/guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'install-schemas.sh');
const folderOf = (bin) => dirname(execFileSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).trim());
// bash and git only, so `openspec` is not found and the validate step is skipped
const PATH = [...new Set([folderOf('bash'), folderOf('git')])].join(delimiter);
const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), 'inst-')));

function world({ openspec = true } = {}) {
  const base = tmp();
  const repo = join(base, 'repo');
  mkdirSync(join(repo, 'sub', 'dir'), { recursive: true });
  execFileSync('git', ['init', '-q', repo]);
  if (openspec) mkdirSync(join(repo, 'openspec'));
  const home = join(base, 'home');
  const xdg = join(base, 'xdg');
  mkdirSync(home);
  mkdirSync(xdg);
  return { base, repo, home, xdg };
}
const run = (w, args, cwd) => {
  const r = spawnSync('bash', [script, ...args], { cwd, encoding: 'utf8', env: { PATH, HOME: w.home, XDG_DATA_HOME: w.xdg } });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const names = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);
const USAGE = /usage: install-schemas\.sh/;

test('install-schemas: no argument from a subfolder installs into the project, not the user dir', () => {
  const w = world();
  const r = run(w, [], join(w.repo, 'sub', 'dir'));
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite']);
  assert.deepEqual(readdirSync(w.xdg), []);
});

test('install-schemas: <path> keeps installing into <path>/openspec/schemas', () => {
  const w = world();
  const r = run(w, [w.repo], w.base);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite']);
  assert.deepEqual(readdirSync(w.xdg), []);
});

test('install-schemas: the "." form (CI) still works', () => {
  const w = world();
  const r = run(w, ['.'], w.repo);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite']);
});

test('install-schemas: --user installs machine-wide and leaves the project untouched', () => {
  const w = world();
  const r = run(w, ['--user'], w.repo);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.xdg, 'openspec', 'schemas')), ['devkit', 'devkit-lite']);
  assert.equal(existsSync(join(w.repo, 'openspec', 'schemas')), false);
});

test('install-schemas: no argument where the root has no openspec/ exits 1 and writes nothing', () => {
  const w = world({ openspec: false });
  const r = run(w, [], join(w.repo, 'sub'));
  assert.equal(r.code, 1);
  assert.match(r.err, /run openspec init first/);
  assert.equal(existsSync(join(w.repo, 'openspec')), false);
  assert.deepEqual(readdirSync(w.xdg), []);
});

test('install-schemas: --user <path>, two paths and --bogus exit 2 with the usage line and write nothing', () => {
  const w = world();
  for (const args of [['--user', w.repo], [w.repo, w.repo], ['--bogus']]) {
    const r = run(w, args, w.repo);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, USAGE);
    assert.equal(existsSync(join(w.repo, 'openspec', 'schemas')), false);
    assert.deepEqual(readdirSync(w.xdg), []);
  }
});

test('install-schemas: a second run replaces the schemas', () => {
  const w = world();
  run(w, [], w.repo);
  const r = run(w, [], w.repo);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /replacing .*devkit-lite/);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite']);
});
