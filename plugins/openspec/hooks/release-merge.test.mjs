// Tests for release-merge.mjs (conduct-rounds design D11). Run by `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/hooks/release-merge.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { bumpKind, applyBump, resolveVersion, resolveManifest, manifestEditsBeyondVersion, resolveChangelog, PIN_FILE, PIN_PACK, PIN_PACK_NAME, setPins, mergePins, classifyConflict, pinsIn } from './release-merge.mjs';
import * as D from './deliver-check.mjs';
import * as R from './release-merge.mjs';
import { pinDoc, underOwnTmp } from './test-fixtures.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'release-merge.mjs');
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid',
  GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_EDITOR: 'true',
};
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// ---------------------------------------------------------------- pure functions (task 3.1)

test('release-merge: bumpKind names the first field that differs, none when equal, and rejects non-semver', () => {
  assert.equal(bumpKind('0.6.0', '1.0.0'), 'major');
  assert.equal(bumpKind('0.6.0', '0.7.0'), 'minor');
  assert.equal(bumpKind('0.6.0', '0.6.1'), 'patch');
  assert.equal(bumpKind('0.6.0', '0.6.0'), 'none');
  assert.throws(() => bumpKind('0.6', '0.7.0'), { name: 'ReleaseError' });
  assert.throws(() => bumpKind('0.6.0', 'v0.7.0'), { name: 'ReleaseError' });
});

test('release-merge: applyBump resets the lower fields', () => {
  assert.equal(applyBump('0.7.3', 'minor'), '0.8.0');
  assert.equal(applyBump('0.7.3', 'patch'), '0.7.4');
  assert.equal(applyBump('0.7.3', 'major'), '1.0.0');
  assert.equal(applyBump('0.7.3', 'none'), '0.7.3');
});

test('release-merge: resolveVersion applies the change bump over the base version', () => {
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

test('release-merge: resolveManifest sets the named packs and metadata, keeping order and format', () => {
  const out = resolveManifest(MARKET, { packs: { a: '0.7.1' }, metadata: '0.7.1' });
  assert.equal(out, MARKET.replace('"version": "0.6.0"\n  },', '"version": "0.7.1"\n  },').replace('"pack a",\n      "version": "0.6.0"', '"pack a",\n      "version": "0.7.1"'));
  const plugin = '{\n  "name": "a",\n  "version": "0.6.0",\n  "description": "x"\n}\n';
  assert.equal(resolveManifest(plugin, { packs: { a: '0.7.1' } }), plugin.replace('0.6.0', '0.7.1'));
  assert.equal(resolveManifest(plugin, { packs: { b: '9.9.9' } }), plugin, 'another pack leaves it alone');
});

test('release-merge: manifestEditsBeyondVersion is empty for a version edit and names a description edit', () => {
  const bumped = resolveManifest(MARKET, { packs: { a: '0.6.1' }, metadata: '0.6.1' });
  assert.deepEqual(manifestEditsBeyondVersion(MARKET, bumped), []);
  const edited = bumped.replace('"pack a"', '"pack a, better"');
  assert.deepEqual(manifestEditsBeyondVersion(MARKET, edited), ['plugins[a].description']);
});

const entry = (v, title, body = '- x') => `## ${v} — ${title}\n\n${body}\n\n`;
const CL = (...entries) => `# Changelog\n\n${entries.join('')}`.replace(/\n+$/, '\n');

test('release-merge: resolveChangelog renumbers the change entry above the base newest and keeps every base entry', () => {
  const mergeBase = CL(entry('0.6.0', 'first'));
  const change = CL(entry('0.6.1', 'mine', '- mine'), entry('0.6.0', 'first'));
  const base = CL(entry('0.7.0', 'theirs', '- theirs'), entry('0.6.0', 'first'));
  const out = resolveChangelog({ mergeBase, change, base, version: '0.7.1' });
  assert.equal(out, CL(entry('0.7.1', 'mine', '- mine'), entry('0.7.0', 'theirs', '- theirs'), entry('0.6.0', 'first')));
});

test('release-merge: resolveChangelog throws on zero or two new entries and on an edited older entry', () => {
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
function releaseRepo({ a, b, extraA = {}, extraB = {}, gen = false, initial = {} } = {}) {
  const root = tmpFolder('devkit-release-');
  const origin = tmpFolder('devkit-release-origin-');
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
    ...initial,
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
// True when no merge is in progress (MERGE_HEAD does not resolve).
const noMerge = (root) => { try { git(root, 'rev-parse', '-q', '--verify', 'MERGE_HEAD'); return false; } catch { return true; } };

const A_MINOR = { packs: { a: '0.7.0' }, metadata: '0.7.0', packsAll: { a: '0.7.0', b: '0.5.0' }, title: 'theirs', body: '- theirs' };
const B_PATCH = { packs: { a: '0.6.1' }, metadata: '0.6.1', packsAll: { a: '0.6.1', b: '0.5.0' }, title: 'mine', body: '- mine' };

test('release-merge: a minor bump on main and a patch on the branch resolve to a merge commit holding the renumbered release', () => {
  const { root, origin } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const before = git(origin, 'rev-parse', 'main');
  const oldHead = git(root, 'rev-parse', 'HEAD');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.resolved, true);
  assert.equal(r.out.oldHead, oldHead);
  assert.equal(git(root, 'rev-parse', 'HEAD'), r.out.newHead);
  assert.equal(git(root, 'rev-parse', 'HEAD^1'), oldHead);
  assert.equal(git(root, 'rev-parse', 'HEAD^2'), git(root, 'rev-parse', 'origin/main'));
  assert.equal(git(root, 'rev-list', '--merges', '--count', 'origin/main..HEAD'), '1');
  assert.equal(JSON.parse(git(root, 'show', 'HEAD:plugins/a/.claude-plugin/plugin.json')).version, '0.7.1');
  assert.equal(JSON.parse(git(root, 'show', 'HEAD:.claude-plugin/marketplace.json')).metadata.version, '0.7.1');
  const market = JSON.parse(git(root, 'show', 'HEAD:.claude-plugin/marketplace.json'));
  assert.equal(market.plugins.find((p) => p.name === 'a').version, '0.7.1');
  const cl = git(root, 'show', 'HEAD:CHANGELOG.md');
  assert.ok(cl.indexOf('## 0.7.1 — mine') < cl.indexOf('## 0.7.0 — theirs') && cl.indexOf('## 0.7.0 — theirs') < cl.indexOf('## 0.6.0 — first'));
  assert.doesNotMatch(cl, /<<<<<<<|0\.6\.1/);
  assert.equal(git(root, 'status', '--porcelain'), '', 'the merge is committed');
  assert.equal(git(origin, 'rev-parse', 'main'), before, 'never pushes');
});

test('release-merge: the base side is kept during the merge and the final values come from oldHead', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr);
  assert.equal(JSON.parse(git(root, 'show', 'HEAD:plugins/a/.claude-plugin/plugin.json')).version, '0.7.1');
  assert.match(git(root, 'show', 'HEAD:CHANGELOG.md'), /## 0\.7\.1 — mine/);
});

test('release-merge: a branch that bumps another pack resolves only metadata.version and its own pack', () => {
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

test('release-merge: only CHANGELOG and marketplace conflict, the clean-merged plugin.json is still resolved', () => {
  const a = { packs: { b: '0.6.0' }, metadata: '0.7.0', packsAll: { a: '0.6.0', b: '0.6.0' }, title: 'theirs', body: '- theirs' };
  const { root } = releaseRepo({ a, b: B_PATCH });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr);
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.6.1');
  assert.equal(versionOf(root, 'plugins/b/.claude-plugin/plugin.json'), '0.6.0');
  assert.equal(meta(root), '0.7.1');
  assert.equal(JSON.parse(git(root, 'show', 'HEAD:.claude-plugin/marketplace.json')).metadata.version, '0.7.1');
});

test('release-merge: a conflict outside the release files aborts to oldHead with the conflicts listed', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH, extraA: { 'README.md': 'theirs\n' }, extraB: { 'README.md': 'mine\n' } });
  const oldHead = git(root, 'rev-parse', 'HEAD');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.equal(r.out.resolved, false);
  assert.ok(r.out.conflicts.includes('README.md'));
  assert.equal(git(root, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.ok(noMerge(root));
});

test('release-merge: a manifest edited beyond its version aborts to oldHead', () => {
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
  assert.ok(noMerge(root));
});

test('release-merge: an invalid JSON manifest on the branch restores to oldHead with exit 2', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  git(root, 'checkout', '-q', '-b', 'tmp');
  write(root, { 'plugins/a/.claude-plugin/plugin.json': '{ not json' });
  commit(root, 'break');
  const oldHead = git(root, 'rev-parse', 'HEAD');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.equal(r.out.resolved, false);
  assert.equal(git(root, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.ok(noMerge(root));
});

test('release-merge: a docs/catalog.md conflict runs scripts/gen-catalog.py, and aborts without it', () => {
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
  assert.ok(noMerge(without.root));
});

test('release-merge: a merge left in progress is aborted and redone', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const oldHead = git(root, 'rev-parse', 'HEAD');
  assert.throws(() => git(root, 'merge', '--no-commit', 'origin/main')); // exit 1 on its conflict
  assert.equal(noMerge(root), false);
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.oldHead, oldHead, 'the old head is the pre-merge branch tip');
  assert.equal(git(root, 'rev-parse', 'HEAD^2'), git(root, 'rev-parse', 'origin/main'));
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.1');
});

test('release-merge: two new CHANGELOG entries abort to oldHead', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const cl = read(root, 'CHANGELOG.md').replace('# Changelog\n\n', `# Changelog\n\n${entry('0.6.2', 'again')}`);
  write(root, { 'CHANGELOG.md': cl });
  const oldHead = commit(root, 'second entry');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.match(r.out.error, /cannot place the CHANGELOG entry/);
  assert.equal(git(root, 'rev-parse', 'HEAD'), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.ok(noMerge(root));
});

test('release-merge: a missing origin/<base> and an unknown option are setup errors (exit 3)', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const missing = run(root, '--base', 'nope');
  assert.equal(missing.code, 3);
  assert.match(missing.stderr, /git fetch origin nope/);
  assert.equal(run(root, '--bogus').code, 3);
});

// ---------------------------------------------------------------- the CI pin (release-rebase-pin)

const here = dirname(fileURLToPath(import.meta.url));

const pinPack = (version) => ({ [PIN_PACK]: json({ name: PIN_PACK_NAME, version, description: 'pack devkit-openspec' }) });
const pinMarket = (metadata, version) => marketplace(metadata, { a: '0.6.0', b: '0.5.0', [PIN_PACK_NAME]: version });
const pinSide = (metadata, version) => ({ packs: {}, metadata, packsAll: { a: '0.6.0', b: '0.5.0', [PIN_PACK_NAME]: version }, title: `at ${version}`, body: `- at ${version}` });
const pinInitial = { ...pinPack('0.10.0'), [PIN_FILE]: pinDoc('0.10.0'), '.claude-plugin/marketplace.json': pinMarket('0.6.0', '0.10.0') };
const pinsOf = (text) => [...text.matchAll(/v\d+\.\d+\.\d+/g)].map((m) => m[0]);

test('release-merge pin: setPins rewrites each of the four marker forms, both pins of one line, and keeps the period of a sentence end', () => {
  assert.equal(setPins('pinned to the commit of v0.10.3 (x)', '1.2.3'), 'pinned to the commit of v1.2.3 (x)');
  assert.equal(setPins('base=https://h/<commit sha of v0.10.3>/p', '1.2.3'), 'base=https://h/<commit sha of v1.2.3>/p');
  assert.equal(setPins('run gh api repos/o/r/git/ref/tags/v0.10.3 now', '1.2.3'), 'run gh api repos/o/r/git/ref/tags/v1.2.3 now');
  assert.equal(setPins('the tag (`v0.10.3` above), not the tag', '1.2.3'), 'the tag (`v1.2.3` above), not the tag');
  assert.equal(setPins('(`v0.10.3` above) and git/ref/tags/v0.10.3', '1.2.3'), '(`v1.2.3` above) and git/ref/tags/v1.2.3');
  assert.equal(setPins('see git/ref/tags/v0.10.3.', '0.11.0'), 'see git/ref/tags/v0.11.0.');
});

test('release-merge pin: setPins replaces v1.2.34 whole and leaves a v1.2.3 on a line without a marker', () => {
  assert.equal(setPins('pinned to the commit of v1.2.34', '2.0.0'), 'pinned to the commit of v2.0.0');
  assert.equal(setPins('mentions v1.2.3 only', '2.0.0'), 'mentions v1.2.3 only');
});

test('release-merge pin: setPins keeps CRLF endings, leaves a marker line without a pin, and is idempotent', () => {
  const crlf = 'a\r\npinned to the commit of v0.1.0\r\nb\r\n';
  assert.equal(setPins(crlf, '0.2.0'), 'a\r\npinned to the commit of v0.2.0\r\nb\r\n');
  const literal = 'the markers are `git/ref/tags/v` and `<commit sha of v`';
  assert.equal(setPins(literal, '9.9.9'), literal);
  const once = setPins(pinDoc('0.10.0'), '0.11.0');
  assert.equal(setPins(once, '0.11.0'), once);
});

test('release-merge pin: mergePins keeps both edits with every pin masked, and leaves no temporary folder', () => {
  const base = pinDoc('0.10.0');
  const ours = pinDoc('0.11.0', { top: 'TOP A' });
  const theirs = pinDoc('0.10.1', { bottom: 'BOTTOM B' });
  const { value: merged, left } = underOwnTmp(() => mergePins({ base, ours, theirs }));
  assert.equal(typeof merged, 'string');
  assert.match(merged, /TOP A/);
  assert.match(merged, /BOTTOM B/);
  assert.deepEqual([...new Set(pinsOf(merged))], ['v0.0.0']);
  assert.deepEqual(left, [], 'no temporary folder is left behind');
});

test('release-merge pin: mergePins is null when both sides edit one paragraph or any side is null, and leaves no temporary folder', () => {
  const base = pinDoc('0.10.0');
  const { left } = underOwnTmp(() => {
    assert.equal(mergePins({ base, ours: pinDoc('0.11.0', { top: 'TOP A' }), theirs: pinDoc('0.10.1', { top: 'TOP B' }) }), null);
    for (const side of ['base', 'ours', 'theirs']) {
      const sides = { base, ours: base, theirs: base, [side]: null };
      assert.equal(mergePins(sides), null, side);
    }
  });
  assert.deepEqual(left, [], 'no temporary folder is left behind');
});

test('release-merge pin: classifyConflict lets release files through without reading any stage', () => {
  let calls = 0;
  const stagesOf = () => { calls++; return null; };
  assert.deepEqual(classifyConflict(['CHANGELOG.md', '.claude-plugin/marketplace.json', 'docs/catalog.md'], stagesOf), { blocking: [], pinMerged: null });
  assert.equal(calls, 0);
});

test('release-merge pin: classifyConflict resolves a pin-only docs/openspec-flow.md and blocks one beyond the pin, reading it once', () => {
  const asked = [];
  const base = pinDoc('0.10.0');
  const pinOnly = () => ({ base, ours: pinDoc('0.11.0', { top: 'TOP A' }), theirs: pinDoc('0.10.1', { bottom: 'BOTTOM B' }) });
  const ok = classifyConflict(['CHANGELOG.md', PIN_FILE], (p) => { asked.push(p); return pinOnly(); });
  assert.deepEqual(ok.blocking, []);
  assert.equal(typeof ok.pinMerged, 'string');
  assert.deepEqual(asked, [PIN_FILE]);
  const beyond = classifyConflict([PIN_FILE], () => ({ base, ours: pinDoc('0.11.0', { top: 'TOP A' }), theirs: pinDoc('0.10.1', { top: 'TOP B' }) }));
  assert.deepEqual(beyond, { blocking: [PIN_FILE], pinMerged: null });
});

test('release-merge pin: classifyConflict always blocks README.md and keeps the order of the paths', () => {
  const base = pinDoc('0.10.0');
  const stagesOf = () => ({ base, ours: base, theirs: base });
  assert.deepEqual(classifyConflict(['README.md', 'CHANGELOG.md'], stagesOf), { blocking: ['README.md'], pinMerged: null });
  assert.deepEqual(classifyConflict(['README.md', PIN_FILE, 'src/x.js'], stagesOf).blocking, ['README.md', 'src/x.js']);
});

test('release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines', () => {
  const repo = join(here, '..', '..', '..');
  const doc = readFileSync(join(repo, PIN_FILE), 'utf8');
  const v = JSON.parse(readFileSync(join(repo, PIN_PACK), 'utf8')).version;
  assert.equal(setPins(doc, v), doc);
  const MARKER = /pinned to the commit of v|<commit sha of v|git\/ref\/tags\/v|\(`v\d+\.\d+\.\d+` above\)/;
  const PIN = /(?<![A-Za-z0-9])v\d+\.\d+\.\d+(?!\d)/;
  const before = doc.split('\n');
  const after = setPins(doc, '99.0.0').split('\n');
  assert.equal(after.length, before.length);
  const changed = before.flatMap((l, i) => (l !== after[i] ? [i] : []));
  const pinLines = before.flatMap((l, i) => (MARKER.test(l) && PIN.test(l) ? [i] : []));
  assert.deepEqual(changed, pinLines);
  assert.ok(pinLines.length >= 3, 'at least 3 pin lines');
  const ci = before.indexOf('## CI');
  const next = before.findIndex((l, i) => i > ci && l.startsWith('## '));
  assert.ok(ci >= 0);
  for (const i of pinLines) assert.ok(i > ci && (next < 0 || i < next), `line ${i + 1} is inside ## CI`);
  const urls = [...after.join('\n').matchAll(/chacal88\/devkit\/([^/\n]+)\/plugins\/openspec\/hooks/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(urls)], ['<commit sha of v99.0.0>']);
});

const sha = (root, rev = 'HEAD') => git(root, 'rev-parse', rev);

test('release-merge pin: both sides move the pin and add text apart, the merge keeps both texts and commits the resolved version (AC-4)', () => {
  const a = pinSide('0.7.0', '0.11.0');
  const b = pinSide('0.6.1', '0.10.1');
  const { root } = releaseRepo({
    a, b, initial: pinInitial,
    extraA: { ...pinPack('0.11.0'), [PIN_FILE]: pinDoc('0.11.0', { top: 'TOP A' }) },
    extraB: { ...pinPack('0.10.1'), [PIN_FILE]: pinDoc('0.10.1', { bottom: 'BOTTOM B' }) },
  });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.resolved, true);
  const doc = read(root, PIN_FILE);
  assert.match(doc, /TOP A/);
  assert.match(doc, /BOTTOM B/);
  assert.deepEqual([...new Set(pinsOf(doc))], ['v0.11.1']);
  assert.ok(r.out.files.includes(PIN_FILE));
  assert.equal(r.out.versions.packs[PIN_PACK_NAME], '0.11.1');
  const head = git(root, 'show', `HEAD:${PIN_FILE}`);
  assert.match(head, /TOP A/);
  assert.match(head, /BOTTOM B/);
  assert.deepEqual([...new Set(pinsOf(head))], ['v0.11.1']);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-merge pin: both sides edit the same paragraph, the run aborts to the old head (AC-5)', () => {
  const { root } = releaseRepo({
    a: pinSide('0.7.0', '0.11.0'), b: pinSide('0.6.1', '0.10.1'), initial: pinInitial,
    extraA: { ...pinPack('0.11.0'), [PIN_FILE]: pinDoc('0.11.0', { top: 'TOP A' }) },
    extraB: { ...pinPack('0.10.1'), [PIN_FILE]: pinDoc('0.10.1', { top: 'TOP B' }) },
  });
  const oldHead = sha(root);
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.equal(r.out.resolved, false);
  assert.ok(r.out.conflicts.includes(PIN_FILE));
  assert.equal(sha(root), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.ok(noMerge(root));
});

test('release-merge pin: a renumbered pack with no conflict in the doc commits the resolved pins in the merge (AC-6)', () => {
  const { root } = releaseRepo({
    a: pinSide('0.7.0', '0.11.0'), b: pinSide('0.6.1', '0.10.1'), initial: pinInitial,
    extraA: pinPack('0.11.0'),
    extraB: { ...pinPack('0.10.1'), [PIN_FILE]: pinDoc('0.10.1') },
  });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual([...new Set(pinsOf(git(root, 'show', 'HEAD^1:' + PIN_FILE)))], ['v0.10.1']);
  assert.deepEqual([...new Set(pinsOf(git(root, 'show', `HEAD:${PIN_FILE}`)))], ['v0.11.1']);
  assert.ok(r.out.files.includes(PIN_FILE));
});

test('release-merge pin: a change that did not bump devkit-openspec takes the base version for every pin (AC-6)', () => {
  const b = { ...B_PATCH, packsAll: { a: '0.6.1', b: '0.5.0', [PIN_PACK_NAME]: '0.10.0' } };
  const { root } = releaseRepo({ a: pinSide('0.7.0', '0.11.0'), b, initial: pinInitial, extraA: pinPack('0.11.0') });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual([...new Set(pinsOf(read(root, PIN_FILE)))], ['v0.11.0']);
  assert.ok(r.out.files.includes(PIN_FILE));
});

test('release-merge pin: without a devkit-openspec pack a pin conflict stops with "cannot set the pin:", and no conflict leaves the file alone', () => {
  const noPack = { [PIN_FILE]: pinDoc('0.10.0') };
  const conflicted = releaseRepo({
    a: A_MINOR, b: B_PATCH, initial: noPack,
    extraA: { [PIN_FILE]: pinDoc('0.11.0', { top: 'TOP A' }) },
    extraB: { [PIN_FILE]: pinDoc('0.10.1', { bottom: 'BOTTOM B' }) },
  });
  const oldHead = sha(conflicted.root);
  const r = run(conflicted.root, '--base', 'main', '--json');
  assert.equal(r.code, 2);
  assert.match(r.out.error, /^cannot set the pin:/);
  assert.equal(sha(conflicted.root), oldHead);
  assert.equal(git(conflicted.root, 'status', '--porcelain'), '');
  assert.ok(noMerge(conflicted.root));

  const calm = releaseRepo({ a: A_MINOR, b: B_PATCH, initial: noPack, extraB: { [PIN_FILE]: pinDoc('0.10.0', { bottom: 'BOTTOM B' }) } });
  const ok = run(calm.root, '--base', 'main', '--json');
  assert.equal(ok.code, 0, ok.stderr + ok.stdout);
  assert.equal(ok.out.files.includes(PIN_FILE), false);
  assert.equal(read(calm.root, PIN_FILE), pinDoc('0.10.0', { bottom: 'BOTTOM B' }));
});

test('release-merge pin: two change commits that both touch the pin file are resolved in the one merge', () => {
  const { root } = releaseRepo({
    a: pinSide('0.7.0', '0.11.0'), b: pinSide('0.6.1', '0.10.1'), initial: pinInitial,
    extraA: { ...pinPack('0.11.0'), [PIN_FILE]: pinDoc('0.11.0', { top: 'TOP A' }) },
    extraB: { ...pinPack('0.10.1'), [PIN_FILE]: pinDoc('0.10.1', { bottom: 'BOTTOM B' }) },
  });
  // A second change commit: moves the pin again and edits a body line.
  write(root, { [PIN_FILE]: pinDoc('0.10.2', { bottom: 'BOTTOM B' }).replace('body 2', 'body 2 edited C') });
  commit(root, 'second change commit');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const doc = read(root, PIN_FILE);
  for (const text of ['TOP A', 'BOTTOM B', 'body 2 edited C']) assert.match(doc, new RegExp(text));
  assert.deepEqual([...new Set(pinsOf(doc))], ['v0.11.1']);
  assert.ok(r.out.files.includes(PIN_FILE));
  const head = git(root, 'show', `HEAD:${PIN_FILE}`);
  assert.match(head, /body 2 edited C/);
  assert.deepEqual([...new Set(pinsOf(head))], ['v0.11.1']);
  assert.equal(git(root, 'rev-list', '--count', 'origin/main..HEAD'), '3');
});

// ---------------------------------------------------------------- release-merge-conflict: the merge commit

const PIN_FIXTURE = {
  a: pinSide('0.7.0', '0.11.0'),
  b: pinSide('0.6.1', '0.10.1'),
  initial: pinInitial,
  extraA: { ...pinPack('0.11.0'), [PIN_FILE]: pinDoc('0.11.0', { top: 'TOP A' }) },
  extraB: { ...pinPack('0.10.1'), [PIN_FILE]: pinDoc('0.10.1', { bottom: 'BOTTOM B' }) },
};

test('release-merge-conflict 1: a base that released after the branch forked is merged, renumbered and committed, and a plain push of the result is accepted', () => {
  const { root, origin } = releaseRepo({ ...PIN_FIXTURE, gen: true });
  git(root, 'push', '-q', 'origin', 'feature');
  const oldHead = sha(root);
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(sha(root, 'HEAD^1'), oldHead);
  assert.equal(sha(root, 'HEAD^2'), sha(root, 'origin/main'));
  assert.equal(r.out.newHead, sha(root));
  git(root, 'merge-base', '--is-ancestor', oldHead, 'HEAD');
  assert.equal(git(root, 'status', '--porcelain'), '');
  const at = (f) => git(root, 'show', `HEAD:${f}`);
  assert.equal(JSON.parse(at(PIN_PACK)).version, '0.11.1');
  const market = JSON.parse(at('.claude-plugin/marketplace.json'));
  assert.equal(market.plugins.find((p) => p.name === PIN_PACK_NAME).version, '0.11.1');
  assert.equal(market.metadata.version, '0.7.1');
  const cl = at('CHANGELOG.md');
  assert.ok(cl.indexOf('## 0.7.1 — at 0.10.1') < cl.indexOf('## 0.7.0 — at 0.11.0') && cl.indexOf('## 0.7.0 — at 0.11.0') < cl.indexOf('## 0.6.0 — first'));
  assert.doesNotMatch(cl, /<<<<<<</);
  const doc = at(PIN_FILE);
  assert.ok(pinsIn(doc).length >= 3 && pinsIn(doc).every((p) => p === 'v0.11.1'));
  assert.match(doc, /TOP A/);
  assert.match(doc, /BOTTOM B/);
  assert.equal(at('docs/catalog.md'), 'regenerated'); // git() trims the trailing newline
  assert.equal(git(root, 'log', '-1', '--format=%s'), 'chore(release): merge origin/main and renumber the release above it');
  assert.equal(git(origin, 'rev-parse', 'feature'), oldHead);
  git(root, 'push', '-q', 'origin', 'feature');
  assert.equal(git(origin, 'rev-parse', 'feature'), sha(root));
});

test('release-merge-conflict 2: an aborted merge leaves an untracked file and an unstaged openspec/ edit as they were', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH, initial: { 'openspec/notes.md': 'n\n' }, extraA: { 'README.md': 'theirs\n' }, extraB: { 'README.md': 'mine\n' } });
  const oldHead = sha(root);
  write(root, { 'notes.txt': 'untracked\n', 'openspec/notes.md': 'n edited\n' });
  const status = git(root, 'status', '--porcelain');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.ok(r.out.conflicts.includes('README.md'));
  assert.equal(sha(root), oldHead);
  assert.ok(noMerge(root));
  assert.equal(git(root, 'status', '--porcelain'), status);
  assert.equal(read(root, 'notes.txt'), 'untracked\n');
  assert.equal(read(root, 'openspec/notes.md'), 'n edited\n');
});

test('release-merge-conflict 3: an unstaged openspec/ edit stays out of the merge commit', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH, initial: { 'openspec/notes.md': 'n\n' } });
  write(root, { 'openspec/notes.md': 'n edited\n' });
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(git(root, 'show', 'HEAD:openspec/notes.md'), 'n');
  assert.equal(read(root, 'openspec/notes.md'), 'n edited\n');
  assert.match(git(root, 'status', '--porcelain'), /M openspec\/notes\.md$/m);
  assert.equal(git(root, 'diff', '--cached', '--name-only'), '', 'nothing of it is staged');
});

test('release-merge-conflict 4: a tracked change outside openspec/ stops the run with exit 3 and touches nothing', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  const oldHead = sha(root);
  write(root, { 'README.md': 'edited\n' });
  const status = git(root, 'status', '--porcelain');
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 3);
  assert.match(r.stderr, /README\.md/);
  assert.equal(sha(root), oldHead);
  assert.ok(noMerge(root));
  assert.equal(git(root, 'status', '--porcelain'), status);
});

test('release-merge-conflict 5: a rebase in progress stops the run with exit 3', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  assert.throws(() => git(root, 'rebase', 'origin/main'), /conflict|CONFLICT/i);
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 3);
  assert.match(r.stderr, /a rebase is in progress/);
  assert.ok(existsSync(join(root, '.git', 'rebase-merge')));
});

test('release-merge-conflict 6: a generator that fails after the files are rewritten aborts the merge and restores every file', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH, initial: { 'scripts/gen-catalog.py': 'import sys\nsys.exit(1)\n' } });
  const oldHead = sha(root);
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.match(r.out.error, /gen-catalog\.py failed/);
  assert.equal(sha(root), oldHead);
  assert.ok(noMerge(root));
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-merge-conflict 7: a branch that already holds origin/<base> is left alone with exit 0', () => {
  const { root } = releaseRepo({ a: A_MINOR, b: B_PATCH });
  git(root, 'merge', '-q', '-s', 'ours', '--no-edit', 'origin/main');
  const before = sha(root);
  const r = run(root, '--base', 'main', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(r.out.files, []);
  assert.equal(r.out.newHead, before);
  assert.equal(sha(root), before);
});

// Invariant (archive-release-pin, ADR 0027, ADR 0030): the pin definition lives in deliver-check.mjs, which the consumer CI downloads and which never imports release-merge.mjs; release-merge.mjs re-exports it.
test('archive-release-pin 10: release-merge.mjs re-exports the one pin definition of deliver-check.mjs, which never imports release-merge.mjs', () => {
  assert.equal(typeof D.pinsIn, 'function', 'deliver-check.mjs exports pinsIn');
  assert.equal(typeof D.setPins, 'function', 'deliver-check.mjs exports setPins');
  assert.equal(R.pinsIn, D.pinsIn, 'the same pinsIn');
  assert.equal(R.setPins, D.setPins, 'the same setPins');
  // An import, not a mention: delivery-train's comment on TRAIN_PIN_FILE names release-merge.mjs's PIN_FILE, and the consumer CI downloads only the three files, so it is an import that must never exist.
  assert.doesNotMatch(readFileSync(join(dirname(script), 'deliver-check.mjs'), 'utf8'), /(?:\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"][^'"]*release-merge/m, 'deliver-check.mjs never imports release-merge');
  assert.deepEqual(D.PIN_LINE_FILES, [R.PIN_FILE], 'the archive check reads by content exactly the one file whose pins the conflict rule resolves');
});

// ---------------------------------------------------------------- release-at-merge: the step `--assign` (D-6, AC-4)
// A noted change states its release in openspec/changes/<id>/release.md and names its ADR without a number; `--assign --base <base>`
// merges origin/<base> when the branch is behind it and writes the release lines and the ADR numbers above it.

// The branch variables a run must not inherit from the machine it runs on (release-at-merge D-15).
const BRANCH_VARS = { DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const runNoted = (root, ...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', env: { ...ENV, ...BRANCH_VARS } });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* human output */ }
  return { code: r.status, out, stdout: r.stdout, stderr: r.stderr };
};
const assign = (root) => runNoted(root, '--assign', '--base', 'main', '--json');
const NOTED_CONFIG = `schema: devkit-lite\ndevkit:\n  release_tag: ${PIN_PACK}\n`;
const noteFor = (title, kind = 'minor') => `# Release note\n\npacks:\n- ${PIN_PACK_NAME}: ${kind}\n\n## ${title}\n\n- **${PIN_PACK_NAME}**: ${title}\n`;
const CL0 = '# Changelog\n\n## 1.0.0 — first\n\n- start\n';
// main of a two-pack project at 1.0.0 with its release lines, an ADR 0001, `files` and a bare origin.
function notedMain(files = {}) {
  const root = tmpFolder('devkit-assign-');
  const origin = tmpFolder('devkit-assign-origin-');
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  git(root, 'init', '-q', '-b', 'main');
  write(root, {
    'openspec/config.yaml': NOTED_CONFIG,
    [PIN_PACK]: pluginJson(PIN_PACK_NAME, '1.0.0'),
    'plugins/core/.claude-plugin/plugin.json': pluginJson('devkit-core', '1.0.0'),
    '.claude-plugin/marketplace.json': marketplace('1.0.0', { [PIN_PACK_NAME]: '1.0.0', 'devkit-core': '1.0.0' }),
    'CHANGELOG.md': CL0,
    [PIN_FILE]: pinDoc('1.0.0'),
    'docs/adr/0001-start.md': '# ADR 0001: start\n',
    'src/a.ts': 'a\n',
    ...files,
  });
  commit(root, 'initial');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', 'origin', 'main');
  return { root, origin };
}
// The noted change `id` on branch `id` cut from main: its note, its ADR docs/adr/<id>.md listed in decisions.md and docs/<id>.md citing it.
function notedChange(root, id, { note = noteFor(`the change ${id}`), adr = true, files = {} } = {}) {
  git(root, 'checkout', '-q', '-b', id, 'main');
  write(root, {
    [`openspec/changes/${id}/proposal.md`]: '# Proposal\n',
    [`openspec/changes/${id}/release.md`]: note,
    ...(adr ? {
      [`openspec/changes/${id}/decisions.md`]: `# Decisions\n\n- ADR: \`docs/adr/${id}.md\`\n`,
      [`openspec/changes/${id}/design.md`]: `# Design\n\nSee ADR [${id}].\n`,
      [`docs/adr/${id}.md`]: `# ADR [${id}]: the rule\n\n- Status: proposed\n- Change: \`${id}\`\n`,
      [`docs/${id}.md`]: `See ADR [${id}] in docs/adr/${id}.md.\n`,
    } : {}),
    ...files,
  });
  return commit(root, `plan of ${id}`);
}
function notedRepo({ main = {}, ...opts } = {}) {
  const { root, origin } = notedMain(main);
  notedChange(root, 'feat', opts);
  return { root, origin };
}
// Another change released on main by hand (its manifest, marketplace, changelog, pins and ADR 0002), pushed; the root goes back to `branch`.
function mainReleases(root, branch, files = {}) {
  git(root, 'checkout', '-q', 'main');
  write(root, {
    [PIN_PACK]: pluginJson(PIN_PACK_NAME, '1.1.0'),
    '.claude-plugin/marketplace.json': marketplace('1.1.0', { [PIN_PACK_NAME]: '1.1.0', 'devkit-core': '1.0.0' }),
    'CHANGELOG.md': '# Changelog\n\n## 1.1.0 — other\n\n- other\n\n## 1.0.0 — first\n\n- start\n',
    [PIN_FILE]: pinDoc('1.1.0'),
    'docs/adr/0002-other.md': '# ADR 0002: other\n',
    ...files,
  });
  commit(root, 'another change released');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', branch);
}
const at = (root, rev, f) => { try { return git(root, 'show', `${rev}:${f}`); } catch { return null; } };
const parentsOf = (root, rev = 'HEAD') => git(root, 'rev-list', '--parents', '-n', '1', rev).split(' ').slice(1);
const changedBy = (root, from, to = 'HEAD') => git(root, 'diff', '--name-only', '--no-renames', from, to).split('\n').filter(Boolean).sort();

test('release-note AC-4 assign: a branch up to date with the base gets one plain commit holding only the release lines and the numbered ADR', () => {
  const { root, origin } = notedRepo();
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(parentsOf(root), [oldHead], 'one plain commit on the old head');
  assert.equal(git(root, 'log', '-1', '--format=%s'), 'chore(release): assign the release of feat');
  assert.equal(versionOf(root, PIN_PACK), '1.1.0');
  assert.equal(versionOf(root, 'plugins/core/.claude-plugin/plugin.json'), '1.0.0', 'a pack the note does not list keeps its version');
  const market = JSON.parse(read(root, '.claude-plugin/marketplace.json'));
  assert.deepEqual([market.metadata.version, ...market.plugins.map((p) => p.version)], ['1.1.0', '1.1.0', '1.0.0']);
  assert.equal(read(root, 'CHANGELOG.md'), `# Changelog\n\n## 1.1.0 — the change feat\n\n- **${PIN_PACK_NAME}** 1.1.0: the change feat\n\n## 1.0.0 — first\n\n- start\n`);
  assert.deepEqual([...new Set(pinsIn(read(root, PIN_FILE)))], ['v1.1.0']);
  assert.ok(!existsSync(join(root, 'docs/adr/feat.md')));
  assert.equal(read(root, 'docs/adr/0002-feat.md'), '# ADR 0002: the rule\n\n- Status: proposed\n- Change: `feat`\n');
  assert.equal(read(root, 'docs/feat.md'), 'See ADR 0002 in docs/adr/0002-feat.md.\n');
  assert.deepEqual(changedBy(root, oldHead), ['.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/adr/0002-feat.md', 'docs/adr/feat.md', 'docs/feat.md', PIN_FILE, PIN_PACK].sort());
  assert.equal(r.out.mode, 'assign');
  assert.equal(r.out.change, 'feat');
  assert.equal(r.out.resolved, true);
  assert.equal(r.out.oldHead, oldHead);
  assert.equal(r.out.newHead, sha(root));
  assert.deepEqual(r.out.adrs, [{ from: 'docs/adr/feat.md', to: 'docs/adr/0002-feat.md' }]);
  assert.deepEqual(r.out.citations, ['docs/feat.md']);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.throws(() => git(origin, 'rev-parse', '--verify', 'feat'), 'the step never pushes');
  const s = D.releaseState(root, 'feat', D.gitFacts(root, { base: 'main' }));
  assert.deepEqual([s.kind, s.current], ['assigned', true]);
});

test('release-note AC-4 assign: a branch behind the base gets one merge commit of origin/<base> and the release above it', () => {
  const { root } = notedRepo();
  git(root, 'checkout', '-q', 'main');
  write(root, { 'src/b.ts': 'b\n' });
  commit(root, 'an unrelated base commit');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', 'feat');
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(parentsOf(root), [oldHead, sha(root, 'origin/main')], 'one merge commit');
  assert.equal(git(root, 'log', '-1', '--format=%s'), 'chore(release): merge origin/main and assign the release of feat');
  assert.equal(read(root, 'src/b.ts'), 'b\n');
  assert.equal(versionOf(root, PIN_PACK), '1.1.0');
  assert.equal(read(root, 'docs/feat.md'), 'See ADR 0002 in docs/adr/0002-feat.md.\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.ok(noMerge(root));
});

test('release-note AC-4 assign: run again after the base released the same pack, the release and the ADR are renumbered above it with no conflict', () => {
  const { root } = notedRepo();
  assert.equal(assign(root).code, 0);
  mainReleases(root, 'feat');
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(parentsOf(root), [oldHead, sha(root, 'origin/main')]);
  assert.equal(versionOf(root, PIN_PACK), '1.2.0');
  assert.equal(JSON.parse(read(root, '.claude-plugin/marketplace.json')).metadata.version, '1.2.0');
  const cl = read(root, 'CHANGELOG.md');
  assert.equal(cl, `# Changelog\n\n## 1.2.0 — the change feat\n\n- **${PIN_PACK_NAME}** 1.2.0: the change feat\n\n## 1.1.0 — other\n\n- other\n\n## 1.0.0 — first\n\n- start\n`);
  assert.deepEqual([...new Set(pinsIn(read(root, PIN_FILE)))], ['v1.2.0']);
  assert.ok(!existsSync(join(root, 'docs/adr/0002-feat.md')), 'the number the branch held is given back');
  assert.equal(read(root, 'docs/adr/0002-other.md'), '# ADR 0002: other\n');
  assert.equal(read(root, 'docs/adr/0003-feat.md'), '# ADR 0003: the rule\n\n- Status: proposed\n- Change: `feat`\n');
  assert.equal(read(root, 'docs/feat.md'), 'See ADR 0003 in docs/adr/0003-feat.md.\n');
  assert.deepEqual(r.out.adrs, [{ from: 'docs/adr/feat.md', to: 'docs/adr/0003-feat.md' }]);
  assert.doesNotMatch(cl + read(root, PIN_FILE), /<<<<<<<|>>>>>>>/);
  assert.equal(git(root, 'status', '--porcelain'), '');
  const s = D.releaseState(root, 'feat', D.gitFacts(root, { base: 'main' }));
  assert.deepEqual([s.kind, s.current], ['assigned', true]);
});

test('release-note AC-4 assign: two changes in a row bumping the same pack never conflict, the second takes the version after the first', () => {
  const { root } = notedMain();
  notedChange(root, 'feat');
  notedChange(root, 'next');
  git(root, 'checkout', '-q', 'feat');
  assert.equal(assign(root).code, 0);
  git(root, 'push', '-q', 'origin', 'feat:main'); // the first change merges
  git(root, 'fetch', '-q', 'origin');
  git(root, 'checkout', '-q', 'next');
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(versionOf(root, PIN_PACK), '1.2.0');
  const cl = read(root, 'CHANGELOG.md');
  assert.ok(cl.indexOf('## 1.2.0 — the change next') < cl.indexOf('## 1.1.0 — the change feat'), cl);
  assert.equal(read(root, 'docs/adr/0002-feat.md').split('\n')[0], '# ADR 0002: the rule');
  assert.equal(read(root, 'docs/adr/0003-next.md').split('\n')[0], '# ADR 0003: the rule');
  assert.equal(read(root, 'docs/next.md'), 'See ADR 0003 in docs/adr/0003-next.md.\n');
  assert.equal(read(root, 'docs/feat.md'), 'See ADR 0002 in docs/adr/0002-feat.md.\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-note AC-4 assign: a release already current, or a note with nothing to write, exits 0 with no commit', () => {
  const { root } = notedRepo();
  assert.equal(assign(root).code, 0);
  const head = sha(root);
  const again = assign(root);
  assert.equal(again.code, 0, again.stderr + again.stdout);
  assert.deepEqual([again.out.resolved, again.out.oldHead, again.out.newHead, again.out.files], [true, head, head, []]);
  assert.equal(sha(root), head);

  const empty = notedRepo({ note: 'packs: []\n', adr: false });
  const before = sha(empty.root);
  const none = assign(empty.root);
  assert.equal(none.code, 0, none.stderr + none.stdout);
  assert.equal(none.out.newHead, before);
  assert.equal(sha(empty.root), before);
  assert.equal(git(empty.root, 'status', '--porcelain'), '');
});

// Each refusal leaves the branch at its old head, no merge in progress and the tree as it was.
const asItWas = (root, oldHead) => {
  assert.equal(sha(root), oldHead);
  assert.ok(noMerge(root));
  assert.equal(git(root, 'status', '--porcelain'), '');
};

test('release-note AC-4 assign: a conflict in src/a.ts exits 2 naming it and the branch is at its old head', () => {
  const { root } = notedRepo({ files: { 'src/a.ts': 'mine\n' } });
  git(root, 'checkout', '-q', 'main');
  write(root, { 'src/a.ts': 'theirs\n' });
  commit(root, 'the base edits src/a.ts');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', 'feat');
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.equal(r.out.resolved, false);
  assert.ok(r.out.conflicts.includes('src/a.ts'), JSON.stringify(r.out));
  asItWas(root, oldHead);
});

test('release-note AC-4 assign: a version edited by hand exits 2 naming the release line', () => {
  const { root } = notedRepo({ files: { [PIN_PACK]: pluginJson(PIN_PACK_NAME, '1.0.5') } });
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.match(r.out.error, new RegExp(`^release lines edited by hand: .*${PIN_PACK.replace(/[.]/g, '\\.')}`));
  asItWas(root, oldHead);
});

test('release-note AC-4 assign: a slug the base already has exits 2 naming the slug and both paths, and nothing is renamed', () => {
  const { root } = notedRepo();
  git(root, 'checkout', '-q', 'main');
  write(root, { 'docs/adr/0031-feat.md': '# ADR 0031: feat elsewhere\n' });
  commit(root, 'the base holds an ADR with the slug');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', 'feat');
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.match(r.out.error, /^a second ADR with the slug feat: /);
  assert.match(r.out.error, /docs\/adr\/feat\.md/);
  assert.match(r.out.error, /docs\/adr\/0031-feat\.md/);
  assert.ok(existsSync(join(root, 'docs/adr/feat.md')));
  asItWas(root, oldHead);
});

test('release-note AC-4 assign: a citation of an ADR the base has not numbered exits 2 naming the slug', () => {
  const { root } = notedRepo({ files: { 'docs/y.md': 'Amends ADR [other].\n' } });
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.match(r.out.error, /ADR \[other\] is cited but has not landed on main; it lands with its own change/);
  asItWas(root, oldHead);
});

// Review round 1 (D-19; D-20, "The `Amended by` line"): the first record's header names the second record of the same change in both
// citation forms; the bare `(feat-store.md)` stands in a file of an ADR folder, so it is rewritten with the record's number.
test('release-note AC-5 assign: the first record\'s Amended by header line naming the second record of the same change takes the second\'s number in both tokens', () => {
  const { root } = notedMain();
  write(root, { 'docs/adr/0026-base.md': '# ADR 0026: base\n' });
  commit(root, 'the base numbers up to 0026');
  git(root, 'push', '-q', 'origin', 'main');
  notedChange(root, 'feat', {
    adr: false,
    files: {
      'openspec/changes/feat/decisions.md': '# Decisions\n\n- ADR: `docs/adr/feat.md`\n- ADR: `docs/adr/feat-store.md`\n',
      'docs/adr/feat.md': '# ADR [feat]: the rule\n\n- Status: proposed\n- Change: `feat`\n- Amended by ADR [feat-store] (feat-store.md)\n',
      'docs/adr/feat-store.md': '# ADR [feat-store]: the store\n\n- Status: proposed\n- Change: `feat`\n',
    },
  });
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(r.out.adrs, [{ from: 'docs/adr/feat.md', to: 'docs/adr/0027-feat.md' }, { from: 'docs/adr/feat-store.md', to: 'docs/adr/0028-feat-store.md' }]);
  assert.equal(read(root, 'docs/adr/0027-feat.md').split('\n').filter((l) => l.startsWith('- ')).pop(), '- Amended by ADR 0028 (0028-feat-store.md)');
  const left = spawnSync('git', ['-C', root, 'grep', '-n', '-F', '-e', 'ADR [feat-store]', '-e', '(feat-store.md)', '-e', '0027-feat-store.md', '--', '.', ':(exclude)openspec/changes'], { encoding: 'utf8' });
  assert.equal(left.status, 1, left.stdout);
});

test('release-note AC-4 assign: a malformed note exits 2 with the reader\'s message', () => {
  const { root } = notedRepo({ note: `packs:\n- ${PIN_PACK_NAME}: big\n` });
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.match(r.out.error, new RegExp(`^release\\.md: packs: ${PIN_PACK_NAME}: "big" is not patch, minor or major`));
  asItWas(root, oldHead);
});

test('release-note AC-4 assign: the preflights of --base are setup errors (exit 3) and touch nothing', () => {
  const { root } = notedRepo();
  const oldHead = sha(root);
  const missing = runNoted(root, '--assign', '--base', 'nope', '--json');
  assert.equal(missing.code, 3);
  assert.match(missing.stderr, /git fetch origin nope/);
  assert.equal(runNoted(root, '--assign').code, 3, '--assign needs --base');
  assert.equal(runNoted(root, '--assign', '--merge', oldHead).code, 3, '--assign and --merge are two modes');
  write(root, { 'src/a.ts': 'edited\n' });
  const dirty = assign(root);
  assert.equal(dirty.code, 3);
  assert.match(dirty.stderr, /uncommitted changes outside openspec\/: src\/a\.ts/);
  assert.equal(sha(root), oldHead);
  git(root, 'checkout', '-q', '--', 'src/a.ts');
});

// ---------------------------------------------------------------- review round 1 (D-20): the step's own record, and the step after a merge by hand

// The release files of notedMain, which a person merging origin/main by hand takes from the base's side.
const RELEASE_PATHS = [PIN_PACK, 'plugins/core/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'CHANGELOG.md', PIN_FILE];
// A merge of origin/main by hand, as a person makes it after the step's exit 2 on a conflict outside the release lines: every release file
// takes the base's side but those of `ours`, which keep the branch's; `files` are written as the person resolves them; one merge commit.
function mergeByHand(root, { files = {}, ours = [] } = {}) {
  spawnSync('git', ['-C', root, 'merge', '--no-ff', '--no-commit', 'origin/main'], { encoding: 'utf8', env: ENV });
  for (const path of RELEASE_PATHS) git(root, 'checkout', ours.includes(path) ? 'HEAD' : 'origin/main', '--', path);
  write(root, files);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'merge origin/main by hand');
}
// The reviewer's sequence (code-quality F1): `feat` is assigned (devkit-openspec 1.1.0, docs/adr/0002-feat.md); the base then releases
// 1.1.0, takes 0002 for docs/adr/0002-other.md and edits src/a.ts, which `feat` edits too; `--assign` exits 2 on src/a.ts; a person merges
// origin/main by hand, resolves src/a.ts and takes the base's side of every release file. `amend` drops the trailers of the step's commit.
function mergedByHand({ main = {}, change = {}, base = {}, amend = false } = {}) {
  const { root } = notedRepo({ main, files: { 'src/a.ts': 'mine\n', ...change } });
  const first = assign(root);
  assert.equal(first.code, 0, first.stderr + first.stdout);
  if (amend) git(root, 'commit', '-q', '--amend', '-m', 'chore(release): assign the release of feat');
  mainReleases(root, 'feat', { 'src/a.ts': 'theirs\n', ...base });
  const refused = assign(root);
  assert.equal(refused.code, 2, refused.stderr + refused.stdout);
  assert.ok(refused.out.conflicts.includes('src/a.ts'), JSON.stringify(refused.out));
  mergeByHand(root, { files: { 'src/a.ts': 'both\n' } });
  return root;
}
const stateNow = (root) => D.releaseState(root, 'feat', D.gitFacts(root, { base: 'main' }));

test('release-note AC-4 assign: an assigned branch merged by hand after a code conflict with a base that released the same pack and ADR number is numbered again', () => {
  const root = mergedByHand();
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(parentsOf(root), [oldHead], 'one plain commit: the person already merged the base');
  assert.equal(read(root, 'src/a.ts'), 'both\n');
  assert.equal(versionOf(root, PIN_PACK), '1.2.0');
  assert.equal(read(root, 'CHANGELOG.md'), `# Changelog\n\n## 1.2.0 — the change feat\n\n- **${PIN_PACK_NAME}** 1.2.0: the change feat\n\n## 1.1.0 — other\n\n- other\n\n## 1.0.0 — first\n\n- start\n`);
  assert.deepEqual([...new Set(pinsIn(read(root, PIN_FILE)))], ['v1.2.0']);
  assert.ok(!existsSync(join(root, 'docs/adr/0002-feat.md')), 'the number the step wrote is given back');
  assert.ok(!existsSync(join(root, 'docs/adr/feat.md')));
  assert.equal(read(root, 'docs/adr/0002-other.md'), '# ADR 0002: other\n');
  assert.equal(read(root, 'docs/adr/0003-feat.md'), '# ADR 0003: the rule\n\n- Status: proposed\n- Change: `feat`\n');
  assert.equal(read(root, 'docs/feat.md'), 'See ADR 0003 in docs/adr/0003-feat.md.\n');
  assert.deepEqual(r.out.adrs, [{ from: 'docs/adr/feat.md', to: 'docs/adr/0003-feat.md' }]);
  assert.equal(git(root, 'status', '--porcelain'), '');
  const s = stateNow(root);
  assert.deepEqual([s.kind, s.current], ['assigned', true]);
});

test('release-note AC-4 assign: a number the step kept across a base merge is still its own after a later merge by hand', () => {
  // The step numbers ADR 0002; the base releases devkit-openspec 1.1.0 and takes no ADR; the step runs again in a merge commit and keeps
  // 0002 (its record names the ADR, but that commit did not rename it); the base then takes 0002 and edits src/a.ts in conflict.
  const { root } = notedRepo({ files: { 'src/a.ts': 'mine\n' } });
  assert.equal(assign(root).code, 0);
  git(root, 'checkout', '-q', 'main');
  write(root, {
    [PIN_PACK]: pluginJson(PIN_PACK_NAME, '1.1.0'),
    '.claude-plugin/marketplace.json': marketplace('1.1.0', { [PIN_PACK_NAME]: '1.1.0', 'devkit-core': '1.0.0' }),
    'CHANGELOG.md': '# Changelog\n\n## 1.1.0 — other\n\n- other\n\n## 1.0.0 — first\n\n- start\n',
    [PIN_FILE]: pinDoc('1.1.0'),
  });
  commit(root, 'another change released with no ADR');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', 'feat');
  const again = assign(root);
  assert.equal(again.code, 0, again.stderr + again.stdout);
  assert.equal(parentsOf(root).length, 2, 'a merge commit');
  assert.ok(existsSync(join(root, 'docs/adr/0002-feat.md')), 'the step kept 0002');
  git(root, 'checkout', '-q', 'main');
  write(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n', 'src/a.ts': 'theirs\n' });
  commit(root, 'another change takes ADR 0002');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', 'feat');
  const refused = assign(root);
  assert.equal(refused.code, 2, refused.stderr + refused.stdout);
  assert.ok(refused.out.conflicts.includes('src/a.ts'), JSON.stringify(refused.out));
  mergeByHand(root, { files: { 'src/a.ts': 'both\n' } });
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(parentsOf(root), [oldHead]);
  assert.equal(versionOf(root, PIN_PACK), '1.2.0');
  assert.ok(!existsSync(join(root, 'docs/adr/0002-feat.md')) && !existsSync(join(root, 'docs/adr/feat.md')));
  assert.equal(read(root, 'docs/adr/0002-other.md'), '# ADR 0002: other\n');
  assert.equal(read(root, 'docs/adr/0003-feat.md'), '# ADR 0003: the rule\n\n- Status: proposed\n- Change: `feat`\n');
  assert.equal(read(root, 'docs/feat.md'), 'See ADR 0003 in docs/adr/0003-feat.md.\n', 'the citation the first record wrote is given back too');
  assert.deepEqual(r.out.adrs, [{ from: 'docs/adr/feat.md', to: 'docs/adr/0003-feat.md' }]);
  assert.equal(git(root, 'status', '--porcelain'), '');
  const s = stateNow(root);
  assert.deepEqual([s.kind, s.current], ['assigned', true]);
});

test('release-note AC-4 assign: the step\'s commit ends with its record', () => {
  const record = [
    'Release-change: feat',
    `Release-line: ${PIN_PACK}`,
    'Release-line: .claude-plugin/marketplace.json',
    'Release-line: CHANGELOG.md',
    `Release-line: ${PIN_FILE}`,
    'Release-adr: docs/adr/feat.md -> docs/adr/0002-feat.md',
    'Release-citation: docs/feat.md',
  ].join('\n');
  const plain = notedRepo().root;
  assert.equal(assign(plain).code, 0);
  assert.equal(git(plain, 'log', '-1', '--format=%B'), `chore(release): assign the release of feat\n\n${record}`);
  assert.equal(git(plain, 'log', '-1', '--format=%(trailers:key=Release-change,valueonly)'), 'feat', 'Git reads the block as trailers');

  const behind = notedRepo().root;
  git(behind, 'checkout', '-q', 'main');
  write(behind, { 'src/b.ts': 'b\n' });
  commit(behind, 'an unrelated base commit');
  git(behind, 'push', '-q', 'origin', 'main');
  git(behind, 'checkout', '-q', 'feat');
  assert.equal(assign(behind).code, 0);
  assert.equal(parentsOf(behind).length, 2, 'a merge commit');
  assert.equal(git(behind, 'log', '-1', '--format=%B'), `chore(release): merge origin/main and assign the release of feat\n\n${record}`);
});

test('release-note AC-4 assign: the same branch with its record removed by an amend reads hand naming the record', () => {
  const root = mergedByHand({ amend: true });
  assert.deepEqual([stateNow(root).kind, stateNow(root).paths], ['hand', ['docs/adr/feat.md']]);
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.equal(r.out.error, 'release lines edited by hand: docs/adr/feat.md');
  asItWas(root, oldHead);
});

test('release-note AC-4 assign: a version no recorded commit wrote is still refused', () => {
  const root = mergedByHand();
  write(root, { [PIN_PACK]: pluginJson(PIN_PACK_NAME, '1.1.5') });
  commit(root, 'a version by hand');
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.match(r.out.error, new RegExp(`^release lines edited by hand: .*${PIN_PACK.replace(/[.]/g, '\\.')}`));
  asItWas(root, oldHead);
});

test('release-note AC-4 assign: a citation the base brought with the step\'s old number keeps its number when the step gives its own back', () => {
  const root = mergedByHand({
    main: { 'docs/x.md': 'The rules.\nb\nc\nd\nend\n' },
    change: { 'docs/x.md': 'See ADR [feat].\nb\nc\nd\nend\n' },
    base: { 'docs/x.md': 'The rules.\nb\nc\nd\nSee ADR 0002 for the other rule.\n' },
  });
  assert.equal(read(root, 'docs/x.md'), 'See ADR 0002.\nb\nc\nd\nSee ADR 0002 for the other rule.\n', 'the merge by hand holds both numbers 0002');
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(read(root, 'docs/x.md'), 'See ADR 0003.\nb\nc\nd\nSee ADR 0002 for the other rule.\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-note AC-4 assign: a line the step wrote, edited by a person after the record, is not given back: exit 2 naming the path, the head and the tree as they were', () => {
  const root = mergedByHand({ change: { 'docs/x.md': 'see ADR [feat]\n' } });
  assert.equal(read(root, 'docs/x.md'), 'see ADR 0002\n');
  write(root, { 'docs/x.md': 'see ADR 0002 and its notes\n' });
  commit(root, 'a person edits the line the step wrote');
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.equal(r.out.error, 'cannot give back the numbers the step wrote in docs/x.md');
  assert.match(r.stderr, /cannot give back the numbers the step wrote in docs\/x\.md/);
  asItWas(root, oldHead);
  assert.ok(existsSync(join(root, 'docs/adr/0002-feat.md')) && !existsSync(join(root, 'docs/adr/feat.md')), 'nothing renamed');
});

test('release-note AC-5 assign: two unnumbered records of one change take the next two numbers in the order decisions.md lists them, the second\'s citations of the first follow, and the record names both renames in that order', () => {
  const { root } = notedMain({ 'docs/adr/0026-base.md': '# ADR 0026: base\n' });
  notedChange(root, 'feat', {
    adr: false,
    files: {
      'openspec/changes/feat/decisions.md': '# Decisions\n\n- ADR: `docs/adr/feat.md`\n- ADR: `docs/adr/feat-store.md`\n',
      'docs/adr/feat.md': '# ADR [feat]: the rule\n\n- Status: proposed\n- Change: `feat`\n',
      'docs/adr/feat-store.md': '# ADR [feat-store]: the store\n\n- Status: proposed\n- Change: `feat`\n- Amends: ADR [feat] (feat.md)\n',
      'docs/x.md': 'See ADR [feat] and ADR [feat-store], in docs/adr/feat.md and docs/adr/feat-store.md.\n',
    },
  });
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(r.out.adrs, [{ from: 'docs/adr/feat.md', to: 'docs/adr/0027-feat.md' }, { from: 'docs/adr/feat-store.md', to: 'docs/adr/0028-feat-store.md' }]);
  assert.equal(read(root, 'docs/adr/0027-feat.md'), '# ADR 0027: the rule\n\n- Status: proposed\n- Change: `feat`\n');
  assert.equal(read(root, 'docs/adr/0028-feat-store.md'), '# ADR 0028: the store\n\n- Status: proposed\n- Change: `feat`\n- Amends: ADR 0027 (0027-feat.md)\n');
  assert.equal(read(root, 'docs/x.md'), 'See ADR 0027 and ADR 0028, in docs/adr/0027-feat.md and docs/adr/0028-feat-store.md.\n');
  assert.equal(git(root, 'log', '-1', '--format=%(trailers:key=Release-adr,valueonly)'), 'docs/adr/feat.md -> docs/adr/0027-feat.md\ndocs/adr/feat-store.md -> docs/adr/0028-feat-store.md');
});

// ---------------------------------------------------------------- review round 1 (D-26): the paths round 1 found untested, and D-24

// test-coverage F1: the flow page's pins conflict on the step's own merge, and the page cites no ADR, so only the pin clause of D-6 step 2
// sends it through the masked merge.
test('release-note AC-4 assign: run again after the base released another devkit-openspec version, the pin-only conflict of a flow page that cites no ADR is resolved by rule', () => {
  const { root } = notedRepo({ adr: false });
  assert.equal(assign(root).code, 0);
  assert.deepEqual([...new Set(pinsIn(read(root, PIN_FILE)))], ['v1.1.0']);
  mainReleases(root, 'feat', {
    [PIN_PACK]: pluginJson(PIN_PACK_NAME, '1.0.1'),
    '.claude-plugin/marketplace.json': marketplace('1.0.1', { [PIN_PACK_NAME]: '1.0.1', 'devkit-core': '1.0.0' }),
    'CHANGELOG.md': '# Changelog\n\n## 1.0.1 — other\n\n- other\n\n## 1.0.0 — first\n\n- start\n',
    [PIN_FILE]: pinDoc('1.0.1'),
  });
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(parentsOf(root), [oldHead, sha(root, 'origin/main')], 'one merge commit of the base');
  assert.equal(versionOf(root, PIN_PACK), '1.1.0', 'the note\'s minor above the base\'s 1.0.1');
  assert.deepEqual([...new Set(pinsIn(read(root, PIN_FILE)))], ['v1.1.0'], 'every pin names the branch\'s new version');
  assert.equal(read(root, PIN_FILE), pinDoc('1.1.0'));
  assert.doesNotMatch(read(root, PIN_FILE) + read(root, 'CHANGELOG.md'), /<<<<<<<|=======|>>>>>>>/);
  assert.equal(git(root, 'status', '--porcelain'), '');
  const s = stateNow(root);
  assert.deepEqual([s.kind, s.current], ['assigned', true]);
});

// test-coverage F4, architecture nit F4 (D-6 step 3): the release lines are set on the merged text, so a manifest field the branch added
// stays beside the version the step writes.
const richPack = (version, keywords) => json({ name: PIN_PACK_NAME, version, description: 'pack devkit-openspec', homepage: 'https://example.invalid/devkit', license: 'MIT', keywords });
test('release-note AC-4 assign: a manifest field the branch added is kept when the step merges a base that released, and only the version moves', () => {
  const { root } = notedRepo({ main: { [PIN_PACK]: richPack('1.0.0', ['flow']) }, files: { [PIN_PACK]: richPack('1.0.0', ['flow', 'release']) } });
  const first = assign(root);
  assert.equal(first.code, 0, first.stderr + first.stdout);
  assert.equal(read(root, PIN_PACK), richPack('1.1.0', ['flow', 'release']));
  mainReleases(root, 'feat', { [PIN_PACK]: richPack('1.1.0', ['flow']) });
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(parentsOf(root), [oldHead, sha(root, 'origin/main')]);
  assert.equal(read(root, PIN_PACK), richPack('1.2.0', ['flow', 'release']), 'the branch\'s keyword stays and only the version moved');
  assert.equal(git(root, 'status', '--porcelain'), '');
  const s = stateNow(root);
  assert.deepEqual([s.kind, s.current], ['assigned', true], 'assigned right after the step');
});

// test-coverage nit F7, D-24: every refusal before the step writes anything leaves the branch at its old head; a project with no
// devkit.release_tag, a setting the reader refuses and a usage error are setup errors (exit 3), a branch with no or two noted changes is
// not resolvable (exit 2).
test('release-note AC-9 assign: the refusals before any write', () => {
  const noKey = notedRepo({ main: { 'openspec/config.yaml': 'schema: devkit-lite\n' } }).root;
  const noKeyHead = sha(noKey);
  const none = assign(noKey);
  assert.equal(none.code, 3, none.stderr + none.stdout);
  assert.equal(none.stderr, 'release-merge: openspec/config.yaml names no devkit.release_tag: this project has no release to assign\n');
  assert.equal(none.stdout, '', 'no JSON');
  asItWas(noKey, noKeyHead);

  const badKey = notedRepo({ main: { 'openspec/config.yaml': 'schema: devkit-lite\ndevkit:\n  release_tag: notes.txt\n' } }).root;
  const badHead = sha(badKey);
  const bad = assign(badKey);
  assert.equal(bad.code, 3, bad.stderr + bad.stdout);
  assert.match(bad.stderr, /^release-merge: openspec\/config\.yaml: devkit\.release_tag: "notes\.txt" is not a path from the repository root to a \.json file\n$/);
  asItWas(badKey, badHead);

  const { root } = notedRepo();
  const oldHead = sha(root);
  const ticks = runNoted(root, '--assign', '--base', 'main', '--roadmap-ticks', '--json');
  assert.equal(ticks.code, 3, ticks.stderr + ticks.stdout);
  assert.match(ticks.stderr, /usage:/);
  asItWas(root, oldHead);

  const unnoted = notedMain().root;
  git(unnoted, 'checkout', '-q', '-b', 'feat', 'main');
  write(unnoted, { 'src/b.ts': 'b\n' });
  const unnotedHead = commit(unnoted, 'a change with no note');
  const nothing = assign(unnoted);
  assert.equal(nothing.code, 2, nothing.stderr + nothing.stdout);
  assert.match(nothing.out.error, /^no change under openspec\/changes\/ adds a release\.md since its merge base with the base$/);
  asItWas(unnoted, unnotedHead);

  const two = notedRepo({ files: { 'openspec/changes/other/release.md': noteFor('the change other') } }).root;
  const twoHead = sha(two);
  const both = assign(two);
  assert.equal(both.code, 2, both.stderr + both.stdout);
  assert.equal(both.out.error, 'more than one change adds a release.md: feat, other');
  asItWas(two, twoHead);
});

// test-coverage nit F10: the step's merge gives back its own numbered record (docs/adr/0002-feat.md to docs/adr/feat.md) before the slug check,
// so a refusal there must take out the unnumbered name HEAD does not hold.
test('release-note AC-4 assign: a slug refusal after the step gave back its own numbered record leaves the tree as it was', () => {
  const { root } = notedRepo();
  assert.equal(assign(root).code, 0);
  assert.ok(existsSync(join(root, 'docs/adr/0002-feat.md')));
  git(root, 'checkout', '-q', 'main');
  write(root, { 'docs/adr/0031-feat.md': '# ADR 0031: feat elsewhere\n' });
  commit(root, 'the base holds an ADR with the slug');
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'checkout', '-q', 'feat');
  const oldHead = sha(root);
  const r = assign(root);
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.match(r.out.error, /^a second ADR with the slug feat: docs\/adr\/feat\.md, /);
  assert.match(r.out.error, /docs\/adr\/0031-feat\.md/);
  asItWas(root, oldHead);
  assert.ok(!existsSync(join(root, 'docs/adr/feat.md')), 'restore takes out the given-back name');
  assert.equal(read(root, 'docs/adr/0002-feat.md'), '# ADR 0002: the rule\n\n- Status: proposed\n- Change: `feat`\n');
  assert.equal(read(root, 'docs/feat.md'), 'See ADR 0002 in docs/adr/0002-feat.md.\n');
});
