// Tests for release-rebase.mjs (conduct-rounds design D11). Imported by guard.test.mjs so that
// `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { bumpKind, applyBump, resolveVersion, resolveManifest, manifestEditsBeyondVersion, resolveChangelog } from './release-rebase.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'release-rebase.mjs');
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid',
  GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_EDITOR: 'true',
};
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// ---------------------------------------------------------------- pure functions (task 3.1)

test('release-rebase: bumpKind names the first field that differs, none when equal, and rejects non-semver', () => {
  assert.equal(bumpKind('0.6.0', '1.0.0'), 'major');
  assert.equal(bumpKind('0.6.0', '0.7.0'), 'minor');
  assert.equal(bumpKind('0.6.0', '0.6.1'), 'patch');
  assert.equal(bumpKind('0.6.0', '0.6.0'), 'none');
  assert.throws(() => bumpKind('0.6', '0.7.0'), { name: 'ReleaseError' });
  assert.throws(() => bumpKind('0.6.0', 'v0.7.0'), { name: 'ReleaseError' });
});

test('release-rebase: applyBump resets the lower fields', () => {
  assert.equal(applyBump('0.7.3', 'minor'), '0.8.0');
  assert.equal(applyBump('0.7.3', 'patch'), '0.7.4');
  assert.equal(applyBump('0.7.3', 'major'), '1.0.0');
  assert.equal(applyBump('0.7.3', 'none'), '0.7.3');
});

test('release-rebase: resolveVersion applies the change bump over the base version', () => {
  assert.equal(resolveVersion({ mergeBase: '0.6.0', change: '0.6.1', base: '0.7.0' }), '0.7.1');
  assert.equal(resolveVersion({ mergeBase: '0.6.0', change: '0.7.0', base: '0.7.0' }), '0.8.0');
  assert.equal(resolveVersion({ mergeBase: '0.6.0', change: '0.6.0', base: '0.7.0' }), '0.7.0');
});

const MARKET = `{
  "name": "devkit",
  "metadata": {
    "description": "d",
    "version": "0.6.0"
  },
  "plugins": [
    {
      "name": "a",
      "description": "pack a",
      "version": "0.6.0"
    },
    {
      "name": "b",
      "description": "pack b",
      "version": "0.5.0"
    }
  ]
}
`;

test('release-rebase: resolveManifest sets the named packs and metadata, keeping order and format', () => {
  const out = resolveManifest(MARKET, { packs: { a: '0.7.1' }, metadata: '0.7.1' });
  assert.equal(out, MARKET.replace('"version": "0.6.0"\n  },', '"version": "0.7.1"\n  },').replace('"pack a",\n      "version": "0.6.0"', '"pack a",\n      "version": "0.7.1"'));
  const plugin = '{\n  "name": "a",\n  "version": "0.6.0",\n  "description": "x"\n}\n';
  assert.equal(resolveManifest(plugin, { packs: { a: '0.7.1' } }), plugin.replace('0.6.0', '0.7.1'));
  assert.equal(resolveManifest(plugin, { packs: { b: '9.9.9' } }), plugin, 'another pack leaves it alone');
});

test('release-rebase: manifestEditsBeyondVersion is empty for a version edit and names a description edit', () => {
  const bumped = resolveManifest(MARKET, { packs: { a: '0.6.1' }, metadata: '0.6.1' });
  assert.deepEqual(manifestEditsBeyondVersion(MARKET, bumped), []);
  const edited = bumped.replace('"pack a"', '"pack a, better"');
  assert.deepEqual(manifestEditsBeyondVersion(MARKET, edited), ['plugins[a].description']);
});

const entry = (v, title, body = '- x') => `## ${v} — ${title}\n\n${body}\n\n`;
const CL = (...entries) => `# Changelog\n\n${entries.join('')}`.replace(/\n+$/, '\n');

test('release-rebase: resolveChangelog renumbers the change entry above the base newest and keeps every base entry', () => {
  const mergeBase = CL(entry('0.6.0', 'first'));
  const change = CL(entry('0.6.1', 'mine', '- mine'), entry('0.6.0', 'first'));
  const base = CL(entry('0.7.0', 'theirs', '- theirs'), entry('0.6.0', 'first'));
  const out = resolveChangelog({ mergeBase, change, base, version: '0.7.1' });
  assert.equal(out, CL(entry('0.7.1', 'mine', '- mine'), entry('0.7.0', 'theirs', '- theirs'), entry('0.6.0', 'first')));
});

test('release-rebase: resolveChangelog throws on zero or two new entries and on an edited older entry', () => {
  const mergeBase = CL(entry('0.6.0', 'first'));
  const base = CL(entry('0.7.0', 'theirs'), entry('0.6.0', 'first'));
  const none = mergeBase;
  const two = CL(entry('0.6.2', 'two'), entry('0.6.1', 'one'), entry('0.6.0', 'first'));
  const edited = CL(entry('0.6.1', 'mine'), entry('0.6.0', 'first', '- rewritten'));
  for (const change of [none, two, edited]) {
    assert.throws(() => resolveChangelog({ mergeBase, change, base, version: '0.7.1' }), { name: 'ReleaseError', message: /cannot place the CHANGELOG entry/ });
  }
});

// ---------------------------------------------------------------- the CLI (task 3.2)

const json = (obj) => `${JSON.stringify(obj, null, 2)}\n`;
const pluginJson = (name, version) => json({ name, version, description: `pack ${name}` });
const marketplace = (metadata, packs) => json({ name: 'devkit', metadata: { description: 'd', version: metadata }, plugins: Object.entries(packs).map(([name, version]) => ({ name, description: `pack ${name}`, version })) });

function write(root, files) {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
}
const commit = (root, message) => { git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', message); return git(root, 'rev-parse', 'HEAD'); };

// The files a release bump touches: each pack's plugin.json, the marketplace and the CHANGELOG.
function bump(root, { packs, metadata, packsAll, title, body = '- change', catalog }) {
  const files = {};
  for (const [name, v] of Object.entries(packs)) files[`plugins/${name}/.claude-plugin/plugin.json`] = pluginJson(name, v);
  files['.claude-plugin/marketplace.json'] = marketplace(metadata, packsAll);
  const cl = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  files['CHANGELOG.md'] = cl.replace('# Changelog\n\n', `# Changelog\n\n${entry(metadata, title, body)}`);
  if (catalog) files['docs/catalog.md'] = catalog;
  write(root, files);
}

// A clone on branch `feature` (one commit by B) behind origin/main (one commit by A).
function releaseRepo({ a, b, extraA = {}, extraB = {}, gen = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'devkit-release-'));
  const origin = mkdtempSync(join(tmpdir(), 'devkit-release-origin-'));
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  git(root, 'init', '-q', '-b', 'main');
  write(root, {
    'plugins/a/.claude-plugin/plugin.json': pluginJson('a', '0.6.0'),
    'plugins/b/.claude-plugin/plugin.json': pluginJson('b', '0.5.0'),
    '.claude-plugin/marketplace.json': marketplace('0.6.0', { a: '0.6.0', b: '0.5.0' }),
    'CHANGELOG.md': CL(entry('0.6.0', 'first')),
    'README.md': 'readme\n',
    'docs/catalog.md': 'catalog v1\n',
    ...(gen ? { 'scripts/gen-catalog.py': "from pathlib import Path\nPath('docs/catalog.md').write_text('regenerated\\n')\n" } : {}),
  });
  commit(root, 'initial');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', '-b', 'feature');
  bump(root, b);
  write(root, extraB);
  commit(root, 'change B');
  git(root, 'checkout', '-q', 'main');
  bump(root, a);
  write(root, extraA);
  commit(root, 'change A');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', 'feature');
  git(root, 'fetch', '-q', 'origin');
  git(root, 'branch', '-q', '-D', 'main');
  return { root, origin };
}

const run = (root, ...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', env: ENV });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* human output */ }
  return { code: r.status, out, stdout: r.stdout, stderr: r.stderr };
};
const read = (root, f) => readFileSync(join(root, f), 'utf8');
const versionOf = (root, f) => JSON.parse(read(root, f)).version;
const meta = (root) => JSON.parse(read(root, '.claude-plugin/marketplace.json')).metadata.version;

const A_MINOR = { packs: { a: '0.7.0' }, metadata: '0.7.0', packsAll: { a: '0.7.0', b: '0.5.0' }, title: 'theirs', body: '- theirs' };
const B_PATCH = { packs: { a: '0.6.1' }, metadata: '0.6.1', packsAll: { a: '0.6.1', b: '0.5.0' }, title: 'mine', body: '- mine' };

test('release-rebase: a minor bump on main and a patch on the branch resolve to one linear history, uncommitted', () => {
  const { root, origin } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const before = git(origin, 'rev-parse', 'main');
  const oldHead = git(root, 'rev-parse', 'HEAD');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.resolved, true);
  assert.equal(r.out.oldHead, oldHead);
  assert.equal(git(root, 'rev-parse', 'HEAD'), r.out.newHead);
  git(root, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD'); // linear on origin/main (throws otherwise)
  assert.equal(git(root, 'rev-list', '--merges', '--count', 'origin/main..HEAD'), '0');
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.1');
  assert.equal(meta(root), '0.7.1');
  const market = JSON.parse(read(root, '.claude-plugin/marketplace.json'));
  assert.equal(market.plugins.find((p) => p.name === 'a').version, '0.7.1');
  const cl = read(root, 'CHANGELOG.md');
  assert.ok(cl.indexOf('## 0.7.1 — mine') < cl.indexOf('## 0.7.0 — theirs') && cl.indexOf('## 0.7.0 — theirs') < cl.indexOf('## 0.6.0 — first'));
  assert.doesNotMatch(cl, /<<<<<<<|0\.6\.1/);
  assert.match(git(root, 'status', '--porcelain'), /CHANGELOG\.md/, 'the edits stay uncommitted');
  assert.equal(git(origin, 'rev-parse', 'main'), before, 'never pushes');
});

test('release-rebase: the base side is kept during the replay and the final values come from oldHead', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr);
  // The commit the rebase made carries the base's (--ours) release files; the renumbering sits in the working tree.
  assert.equal(JSON.parse(git(root, 'show', 'HEAD:plugins/a/.claude-plugin/plugin.json')).version, '0.7.0');
  assert.doesNotMatch(git(root, 'show', 'HEAD:CHANGELOG.md'), /mine/);
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.1');
});

test('release-rebase: a branch that bumps another pack resolves only metadata.version and its own pack', () => {
  const b = { packs: { b: '0.5.1' }, metadata: '0.6.1', packsAll: { a: '0.6.0', b: '0.5.1' }, title: 'mine', body: '- mine' };
  const { root } = releaseRepo({ a: A_MINOR, b });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr);
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.0', 'pack a is the base\'s');
  assert.equal(versionOf(root, 'plugins/b/.claude-plugin/plugin.json'), '0.5.1');
  assert.equal(meta(root), '0.7.1');
  const market = JSON.parse(read(root, '.claude-plugin/marketplace.json'));
  assert.deepEqual(market.plugins.map((p) => p.version), ['0.7.0', '0.5.1']);
});

test('release-rebase: only CHANGELOG and marketplace conflict, the clean-merged plugin.json is still resolved', () => {
  const a = { packs: { b: '0.6.0' }, metadata: '0.7.0', packsAll: { a: '0.6.0', b: '0.6.0' }, title: 'theirs', body: '- theirs' };
  const { root } = releaseRepo({ a, b: B_PATCH });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr);
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.6.1');
  assert.equal(versionOf(root, 'plugins/b/.claude-plugin/plugin.json'), '0.6.0');
  assert.equal(meta(root), '0.7.1');
  assert.equal(JSON.parse(git(root, 'show', 'HEAD:.claude-plugin/marketplace.json')).metadata.version, '0.7.0', 'the base side on the intermediate commit');
});

test('release-rebase: a conflict outside the release files aborts to oldHead with the conflicts listed', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH, extraA: { 'README.md': 'theirs\n' }, extraB: { 'README.md': 'mine\n' } });
  const oldHead = git(root, 'rev-parse', 'HEAD');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.equal(r.out.resolved, false);
  assert.ok(r.out.conflicts.includes('README.md'));
  assert.equal(git(root, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.equal(existsSync(join(root, '.git', 'rebase-merge')), false);
});

test('release-rebase: a manifest edited beyond its version aborts to oldHead', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH, extraB: {} });
  // B also rewrites pack a's description inside the conflicting plugin.json.
  git(root, 'checkout', '-q', '-b', 'tmp');
  write(root, { 'plugins/a/.claude-plugin/plugin.json': json({ name: 'a', version: '0.6.1', description: 'a better pack a' }) });
  commit(root, 'describe');
  const oldHead = git(root, 'rev-parse', 'HEAD');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.equal(r.out.resolved, false);
  assert.match(JSON.stringify(r.out), /plugin\.json/);
  assert.equal(git(root, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-rebase: a docs/catalog.md conflict runs scripts/gen-catalog.py, and aborts without it', () => {
  const b = { ...B_PATCH, catalog: 'catalog mine\n' };
  const a = { ...A_MINOR, catalog: 'catalog theirs\n' };
  const withGen = releaseRepo({ a, b, gen: true });
  const r = run(withGen.root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(read(withGen.root, 'docs/catalog.md'), 'regenerated\n');
  assert.ok(r.out.files.includes('docs/catalog.md'));

  const without = releaseRepo({ a, b });
  const oldHead = git(without.root, 'rev-parse', 'HEAD');
  const r2 = run(without.root, '--base', 'main', '--json');
  assert.equal(r2.code, 2);
  assert.ok(r2.out.conflicts.includes('docs/catalog.md'));
  assert.equal(git(without.root, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(git(without.root, 'status', '--porcelain'), '');
});

test('release-rebase: a rebase left in progress is aborted and redone', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const oldHead = git(root, 'rev-parse', 'HEAD');
  assert.throws(() => git(root, 'rebase', 'origin/main'), /conflict|CONFLICT/i);
  assert.ok(existsSync(join(root, '.git', 'rebase-merge')));
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.oldHead, oldHead, 'the old head is the pre-rebase branch tip');
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.1');
});

test('release-rebase: two new CHANGELOG entries abort to oldHead', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const cl = read(root, 'CHANGELOG.md').replace('# Changelog\n\n', `# Changelog\n\n${entry('0.6.2', 'again')}`);
  write(root, { 'CHANGELOG.md': cl });
  const oldHead = commit(root, 'second entry');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.match(r.out.error, /cannot place the CHANGELOG entry/);
  assert.equal(git(root, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-rebase: a missing origin/<base> and an unknown option are setup errors (exit 3)', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const missing = run(root, '--base', 'nope');
  assert.equal(missing.code, 3);
  assert.match(missing.stderr, /git fetch origin nope/);
  assert.equal(run(root, '--bogus').code, 3);
});
