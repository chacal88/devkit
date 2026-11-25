// Tests for install-schemas.sh (devkit per project, design D5). Run by `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, readdirSync, realpathSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from '../../../hooks/test-tmp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'install-schemas.sh');
const folderOf = (bin) => dirname(execFileSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).trim());
// bash and git only, so `openspec` is not found and the validate step is skipped
const PATH = [...new Set([folderOf('bash'), folderOf('git')])].join(delimiter);
const tmp = () => realpathSync(tmpFolder('devkit-inst-'));

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
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite', 'devkit-project']);
  assert.deepEqual(readdirSync(w.xdg), []);
});

test('install-schemas: <path> keeps installing into <path>/openspec/schemas', () => {
  const w = world();
  const r = run(w, [w.repo], w.base);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite', 'devkit-project']);
  assert.deepEqual(readdirSync(w.xdg), []);
});

test('install-schemas: the "." form (CI) still works', () => {
  const w = world();
  const r = run(w, ['.'], w.repo);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite', 'devkit-project']);
});

test('install-schemas: --user installs machine-wide and leaves the project untouched', () => {
  const w = world();
  const r = run(w, ['--user'], w.repo);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.xdg, 'openspec', 'schemas')), ['devkit', 'devkit-lite', 'devkit-project']);
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

// ---- field-fixes 6: the project's OpenSpec CLI (D-1). These runs need node on PATH (the script resolves the pin with it).
// Same stand-in as hooks/deliver-check.test.mjs#openspecStub, kept here so this file runs alone.
function openspecStub(dir, { version, label, marker }) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'openspec');
  writeFileSync(file, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; exit 0; fi\necho "${label} $*" >> "${marker}"\necho '{"status":[{"severity":"error","message":"stub"}]}'\nexit 1\n`);
  chmodSync(file, 0o755);
  return dir;
}
function pinWorld({ pin } = {}) {
  const w = world();
  const marker = join(w.base, 'seen.log');
  const pathDir = openspecStub(join(w.base, 'pathcli'), { version: '2.1.0', label: 'path', marker });
  if (pin) openspecStub(join(w.repo, 'node_modules', '.bin'), { version: pin, label: 'pinned', marker });
  const fullPath = [pathDir, ...new Set([folderOf('bash'), folderOf('git'), folderOf('node')])].join(delimiter);
  const go = (args, cwd) => {
    const r = spawnSync('bash', [script, ...args], { cwd, encoding: 'utf8', env: { PATH: fullPath, HOME: w.home, XDG_DATA_HOME: w.xdg } });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  return { ...w, marker, go, seen: () => (existsSync(marker) ? readFileSync(marker, 'utf8') : '') };
}

test('field-fixes 6 install-schemas: a pinned 1.16.0 exits 1 naming version, path and the move, replaces no schema, and the PATH CLI never runs', () => {
  const w = pinWorld({ pin: '1.16.0' });
  const r = w.go([w.repo], w.base);
  assert.equal(r.code, 1, r.out);
  assert.match(r.err, /1\.16\.0/);
  assert.ok(r.err.includes(join(w.repo, 'node_modules', '.bin', 'openspec')), r.err);
  assert.match(r.err, /2\.x/);
  assert.equal(existsSync(join(w.repo, 'openspec', 'schemas')), false, 'nothing was copied');
  assert.equal(w.seen(), '');
});

test('field-fixes 6 install-schemas: a pinned 2.x validates the schemas with the pinned CLI', () => {
  const w = pinWorld({ pin: '2.0.0' });
  const r = w.go([w.repo], w.base);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite', 'devkit-project']);
  assert.match(w.seen(), /^pinned schema validate devkit$/m);
  assert.doesNotMatch(w.seen(), /^path /m);
});

test('field-fixes 6 install-schemas: a declared pin with nothing installed exits 1 and replaces no schema', () => {
  const w = pinWorld();
  writeFileSync(join(w.repo, 'package.json'), JSON.stringify({ devDependencies: { '@fission-ai/openspec': '^2.0.0' } }));
  const r = w.go([w.repo], w.base);
  assert.equal(r.code, 1);
  assert.match(r.err, /package\.json/);
  assert.equal(existsSync(join(w.repo, 'openspec', 'schemas')), false);
  assert.equal(w.seen(), '');
});

test('field-fixes 6 install-schemas: a 1.x on PATH with no pin keeps today\'s copy', () => {
  const w = pinWorld();
  openspecStub(join(w.base, 'pathcli'), { version: '1.16.0', label: 'path', marker: w.marker });
  const r = w.go([w.repo], w.base);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite', 'devkit-project']);
});

test('install-schemas: a second run replaces the schemas', () => {
  const w = world();
  run(w, [], w.repo);
  const r = run(w, [], w.repo);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /replacing .*devkit-lite/);
  assert.deepEqual(names(join(w.repo, 'openspec', 'schemas')), ['devkit', 'devkit-lite', 'devkit-project']);
});
