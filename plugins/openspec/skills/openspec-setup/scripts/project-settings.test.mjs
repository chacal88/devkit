// Tests for project-settings.mjs (devkit per project, design D4). Imported by hooks/guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too. HOME is a temp folder in every spawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, realpathSync, utimesSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PACKS } from './project-settings.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'project-settings.mjs');
const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), 'pset-')));

const DEFAULT = {
  extraKnownMarketplaces: { devkit: { source: { source: 'github', repo: 'chacal88/devkit' } } },
  enabledPlugins: { 'devkit-core@devkit': true, 'devkit-openspec@devkit': true },
};
const text = (o) => JSON.stringify(o, null, 2) + '\n';

function world() {
  const base = tmp();
  const home = join(base, 'home');
  const root = join(base, 'proj');
  mkdirSync(home);
  mkdirSync(root);
  return { base, home, root, file: join(root, '.claude', 'settings.json') };
}
const seed = (w, content) => {
  mkdirSync(dirname(w.file), { recursive: true });
  writeFileSync(w.file, typeof content === 'string' ? content : text(content));
};
const run = (w, args, cwd = w.base) => {
  const r = spawnSync('node', [script, ...args], { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: w.home } });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test('project-settings: a missing file is created with the default JSON', () => {
  const w = world();
  const r = run(w, [w.root]);
  assert.equal(r.code, 0, r.err);
  assert.equal(readFileSync(w.file, 'utf8'), text(DEFAULT));
  assert.match(r.out, /marketplace devkit: add/);
  assert.match(r.out, /devkit-core@devkit: enable/);
  assert.match(r.out, /file: create /);
});

test('project-settings: an existing file keeps every key, value and order, and gains the devkit keys at the end', () => {
  const w = world();
  const before = {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    permissions: { allow: ['Bash(ls)'] },
    hooks: { Stop: [] },
    enabledPlugins: { 'other@x': true },
  };
  seed(w, before);
  const r = run(w, [w.root]);
  assert.equal(r.code, 0, r.err);
  const after = JSON.parse(readFileSync(w.file, 'utf8'));
  assert.deepEqual(Object.keys(after), ['$schema', 'permissions', 'hooks', 'enabledPlugins', 'extraKnownMarketplaces']);
  assert.deepEqual(after.permissions, before.permissions);
  assert.deepEqual(after.hooks, before.hooks);
  assert.deepEqual(Object.keys(after.enabledPlugins), ['other@x', 'devkit-core@devkit', 'devkit-openspec@devkit']);
  assert.match(r.out, /file: update /);
});

test('project-settings: a pack set to false becomes true and says so', () => {
  const w = world();
  seed(w, { ...DEFAULT, enabledPlugins: { 'devkit-core@devkit': true, 'devkit-openspec@devkit': false } });
  const r = run(w, [w.root]);
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(readFileSync(w.file, 'utf8')).enabledPlugins['devkit-openspec@devkit'], true);
  assert.match(r.out, /devkit-openspec@devkit: enable \(was false\)/);
});

test('project-settings: a marketplace with another source is kept', () => {
  const w = world();
  const custom = { ...DEFAULT, extraKnownMarketplaces: { devkit: { source: { source: 'directory', path: '/x/devkit' } } } };
  seed(w, custom);
  const r = run(w, [w.root]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(readFileSync(w.file, 'utf8')).extraKnownMarketplaces, custom.extraKnownMarketplaces);
  assert.match(r.out, /marketplace devkit: kept/);
});

test('project-settings: an up-to-date file is unchanged and its mtime does not move', () => {
  const w = world();
  seed(w, DEFAULT);
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(w.file, old, old);
  const r = run(w, [w.root]);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /file: unchanged /);
  assert.equal(statSync(w.file).mtimeMs, old.getTime());
});

test('project-settings: --dry-run writes nothing and prints the same lines', () => {
  const w = world();
  const dry = run(w, [w.root, '--dry-run']);
  assert.equal(dry.code, 0, dry.err);
  assert.equal(existsSync(w.file), false);
  assert.equal(existsSync(join(w.root, '.claude')), false);
  const real = run(w, [w.root]);
  assert.equal(dry.out, real.out);
});

test('project-settings: --packs enables the named packs only; an unknown pack exits 2', () => {
  const w = world();
  const r = run(w, [w.root, '--packs', 'devkit-core,devkit-stack']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(readFileSync(w.file, 'utf8')).enabledPlugins, { 'devkit-core@devkit': true, 'devkit-stack@devkit': true });
  const w2 = world();
  const bad = run(w2, [w2.root, '--packs', 'nope']);
  assert.equal(bad.code, 2);
  assert.equal(existsSync(w2.file), false);
});

test('project-settings: invalid JSON and a top-level array exit 1 with the file byte-identical', () => {
  for (const content of ['{ not json', '[1, 2]\n']) {
    const w = world();
    seed(w, content);
    const r = run(w, [w.root]);
    assert.equal(r.code, 1);
    assert.equal(readFileSync(w.file, 'utf8'), content);
  }
});

test('project-settings: a root equal to HOME is refused and nothing is written', () => {
  const w = world();
  const r = run(w, [w.home]);
  assert.equal(r.code, 1);
  assert.equal(existsSync(join(w.home, '.claude', 'settings.json')), false);
});

test('project-settings: no argument writes the git top level from a subfolder; outside git it exits 1', () => {
  const w = world();
  execFileSync('git', ['init', '-q', w.root]);
  const sub = join(w.root, 'a', 'b');
  mkdirSync(sub, { recursive: true });
  const r = run(w, [], sub);
  assert.equal(r.code, 0, r.err);
  assert.equal(existsSync(w.file), true);
  const w2 = world();
  const out = run(w2, [], w2.root);
  assert.equal(out.code, 1);
  assert.match(out.err, /pass the project path/);
});

test('project-settings: settings.local.json is never created or changed', () => {
  const w = world();
  const local = join(w.root, '.claude', 'settings.local.json');
  run(w, [w.root]);
  assert.equal(existsSync(local), false);
  mkdirSync(dirname(local), { recursive: true });
  writeFileSync(local, '{"enabledPlugins":{"devkit-openspec@devkit":false}}\n');
  run(w, [w.root]);
  assert.equal(readFileSync(local, 'utf8'), '{"enabledPlugins":{"devkit-openspec@devkit":false}}\n');
});

test('project-settings: --json prints { path, file, items }', () => {
  const w = world();
  const r = run(w, [w.root, '--json']);
  assert.equal(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  assert.equal(j.path, w.file);
  assert.equal(j.file, 'create');
  assert.deepEqual(j.items, [
    { key: 'marketplace devkit', action: 'add' },
    { key: 'devkit-core@devkit', action: 'enable' },
    { key: 'devkit-openspec@devkit', action: 'enable' },
  ]);
});

test('project-settings: PACKS equals the plugin names in marketplace.json', () => {
  const market = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', '..', '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.deepEqual([...PACKS].sort(), market.plugins.map((p) => p.name).sort());
});
