// Tests for the release note and the release state of deliver-check.mjs (release-at-merge D-1 to D-3a, D-15): the reader of
// `openspec/changes/<id>/release.md`, the lines the delivery computes, the state of a branch against them, the rule a project follows and
// the module boundary. Run by `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/hooks/release-note.test.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './deliver-check.mjs';
import * as R from './release-merge.mjs';
import * as C from './conduct-check.mjs';
import { git, put, commitAll, shipRepo, GIT_ENV } from './test-fixtures.mjs';
import {
  REL_FILE, REL_CONFIG, NOTE_TEXT, ASSIGNED_CHANGELOG, CHANGELOG0, releaseLayout, noteRepo, stepCommit, baseReleases, noteShip, tickAll, driveToReady,
} from './deliver-check-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// The branch variables a run of the checker must not inherit from the machine it runs on.
const BLANK = { DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };

const note = (...lines) => `${lines.join('\n')}\n`;
const stateOf = (root) => D.releaseState(root, 'feat', D.gitFacts(root, { base: 'main' }));
const rewriteVersion = (root, path, version) => {
  const file = join(root, path);
  const obj = JSON.parse(readFileSync(file, 'utf8'));
  obj.version = version;
  writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
};
const nextOf = (t) => D.nextStep(D.collectState(t.root, 'feat', { env: { ...t.env, ...BLANK } }));

// ---------------------------------------------------------------- AC-1: the reader

test('release-note AC-1 reader: a complete note is read with its packs, the largest bump as the marketplace bump, the title and the body', () => {
  const r = D.parseReleaseNote(NOTE_TEXT);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.packs, [{ name: 'devkit-openspec', kind: 'minor' }, { name: 'devkit-core', kind: 'patch' }]);
  assert.equal(r.marketplace, 'minor');
  assert.equal(r.release, null);
  assert.equal(r.title, 'a change that does a thing');
  assert.equal(r.body, '- **devkit-openspec**: it does a thing\n- **devkit-core**: it helps');
});

test('release-note AC-1 reader: the marketplace and release lines are read when given, and a file name constant names the note', () => {
  assert.equal(D.RELEASE_NOTE, 'release.md');
  const r = D.parseReleaseNote(note('packs:', '- devkit-core: patch', 'marketplace: major', 'release: minor', '', '## t', '', 'body'));
  assert.equal(r.marketplace, 'major');
  assert.equal(r.release, 'minor');
  assert.equal(D.parseReleaseNote(note('packs:', '- a: patch', '- b: major', '', '## t', 'body')).marketplace, 'major', 'the default is the largest pack bump');
});

test('release-note AC-1 reader: packs: [] is no release and needs no title and no body', () => {
  const r = D.parseReleaseNote(note('packs: []'));
  assert.equal(r.error, undefined);
  assert.deepEqual(r.packs, []);
  assert.equal(r.marketplace, null);
  assert.equal(D.parseReleaseNote(note('# Release note', '', 'packs: []', '', '## t', '', 'body')).title, 't', 'a title and a body are allowed too');
});

test('release-note AC-1 reader: CRLF is read as LF and a last line with no newline as if it had one', () => {
  const lf = D.parseReleaseNote(NOTE_TEXT);
  assert.deepEqual(D.parseReleaseNote(NOTE_TEXT.replace(/\n/g, '\r\n')), lf);
  assert.deepEqual(D.parseReleaseNote(NOTE_TEXT.replace(/\n$/, '')), lf);
  assert.equal(D.parseReleaseNote('packs: []').error, undefined);
});

test('release-note AC-1 reader: a code fence that is closed, backticks or tildes, is part of the body', () => {
  for (const fence of ['```', '~~~']) {
    const r = D.parseReleaseNote(note('packs:', '- devkit-core: patch', '', '## t', '', 'text', `${fence}js`, 'code', fence));
    assert.equal(r.error, undefined, fence);
    assert.match(r.body, /code/);
  }
});

const REFUSED = [
  ['an empty file', '', /^release\.md: packs: missing/],
  ['no packs line', note('## t', 'body'), /^release\.md: packs: missing/],
  ['a list line that is not "- name: kind"', note('packs:', '- devkit-core patch', '', '## t', 'body'), /^release\.md: packs: line 2: "- devkit-core patch"/],
  ['a kind outside patch, minor and major', note('packs:', '- devkit-core: big', '', '## t', 'body'), /^release\.md: packs: devkit-core: "big" is not patch, minor or major/],
  ['a pack twice', note('packs:', '- devkit-core: patch', '- devkit-core: minor', '', '## t', 'body'), /^release\.md: packs: devkit-core is listed twice/],
  ['marketplace: before packs:', note('marketplace: minor', 'packs: []'), /^release\.md: marketplace: out of order/],
  ['release: before marketplace:', note('packs: []', 'release: minor', 'marketplace: minor', '', '## t', 'body'), /^release\.md: marketplace: out of order/],
  ['marketplace: twice', note('packs: []', 'marketplace: minor', 'marketplace: patch', '', '## t', 'body'), /^release\.md: marketplace: given twice/],
  ['a marketplace bump that is not one', note('packs: []', 'marketplace: huge', '', '## t', 'body'), /^release\.md: marketplace: "huge" is not patch, minor or major/],
  ['a release bump that is not one', note('packs: []', 'release: huge', '', '## t', 'body'), /^release\.md: release: "huge" is not patch, minor or major/],
  ['an unknown line before the title', note('packs: []', 'foo bar'), /^release\.md: line 2: "foo bar" is not a field of the note/],
  ['no title for a note that releases', note('packs:', '- devkit-core: patch'), /^release\.md: changelog title: missing/],
  ['no title for a release: bump alone', note('packs: []', 'release: minor'), /^release\.md: changelog title: missing/],
  ['no body for a note that releases', note('packs:', '- devkit-core: patch', '', '## t', ''), /^release\.md: changelog body: empty/],
  ['a code fence never closed', note('packs:', '- devkit-core: patch', '', '## t', '', 'text', '```js', 'code'), /^release\.md: changelog body: a code fence opened at line 7 is never closed/],
];
for (const [label, text, pattern] of REFUSED) {
  test(`release-note AC-1 reader: refuses ${label} naming the field`, () => {
    const r = D.parseReleaseNote(text);
    assert.match(r.error ?? '', pattern);
    assert.equal(r.packs, undefined, 'a refused note gives no fields');
  });
}

test('release-note AC-1 reader: releaseNoteHash is the first 12 hex of the sha256 of the file bytes, null with no file', () => {
  const root = noteRepo();
  const dir = join(root, 'openspec', 'changes', 'feat');
  assert.equal(D.releaseNoteHash(dir), `sha256:${createHash('sha256').update(NOTE_TEXT).digest('hex').slice(0, 12)}`);
  assert.equal(D.releaseNoteHash(join(root, 'openspec', 'changes', 'archive')), null);
});

// ---------------------------------------------------------------- AC-1: the errors only the repository can find

const computeAt = (root, text, { setting = REL_FILE, adrs = [] } = {}) => D.computeRelease(D.repoReader(root), 'main', D.parseReleaseNote(text), setting, adrs);

test('release-note AC-1 reader: a pack the project does not have is refused naming it', () => {
  const root = noteRepo();
  assert.throws(() => computeAt(root, note('packs:', '- devkit-nope: patch', '', '## t', 'body')), { name: 'ReleaseError', message: /^release\.md: packs: devkit-nope is not a pack of this project/ });
});

test('release-note AC-1 reader: marketplace: in a project with no marketplace file is refused, a default marketplace is not', () => {
  const { ['.claude-plugin/marketplace.json']: _gone, ...without } = releaseLayout();
  const root = noteRepo({ files: without });
  assert.throws(() => computeAt(root, note('packs:', '- devkit-core: patch', 'marketplace: minor', '', '## t', 'body')), { name: 'ReleaseError', message: /^release\.md: marketplace: the project has no \.claude-plugin\/marketplace\.json/ });
  const ok = computeAt(root, note('packs:', '- devkit-core: patch', '', '## t', 'body'));
  assert.equal(ok.files['.claude-plugin/marketplace.json'], undefined);
});

test('release-note AC-1 reader: release: when the release file is a pack manifest is refused naming the pack', () => {
  const root = noteRepo();
  assert.throws(() => computeAt(root, note('packs: []', 'release: minor', '', '## t', 'body')), { name: 'ReleaseError', message: /^release\.md: release: plugins\/openspec\/\.claude-plugin\/plugin\.json is the manifest of devkit-openspec; state its bump under packs:/ });
});

// ---------------------------------------------------------------- AC-2: the lines the delivery writes

test('release-note AC-2 computed: computeRelease gives the versions, the changelog entry, the pin and the ADR number the step writes', () => {
  const root = noteRepo();
  const r = computeAt(root, NOTE_TEXT, { adrs: ['docs/adr/feat.md'] });
  assert.deepEqual(r.versions, { packs: { 'devkit-openspec': '1.1.0', 'devkit-core': '1.0.1' }, metadata: '1.1.0' });
  assert.equal(JSON.parse(r.files[REL_FILE]).version, '1.1.0');
  assert.equal(JSON.parse(r.files['plugins/core/.claude-plugin/plugin.json']).version, '1.0.1');
  const market = JSON.parse(r.files['.claude-plugin/marketplace.json']);
  assert.deepEqual([market.metadata.version, ...market.plugins.map((p) => p.version)], ['1.1.0', '1.1.0', '1.0.1']);
  assert.equal(r.files['CHANGELOG.md'], ASSIGNED_CHANGELOG);
  assert.deepEqual(D.pinsIn(r.files['docs/openspec-flow.md']), ['v1.1.0']);
  assert.deepEqual(r.adrs, [{ slug: 'feat', folder: 'docs/adr', from: 'docs/adr/feat.md', to: 'docs/adr/0002-feat.md', number: '0002' }]);
});

test('release-note AC-2 computed: two ADRs of one change take the next numbers in the order listed', () => {
  const root = noteRepo({ files: { ...releaseLayout(), 'docs/adr/0007-seven.md': '# ADR 0007\n' } });
  const r = computeAt(root, 'packs: []\n', { adrs: ['docs/adr/feat.md', 'docs/adr/feat-store.md'] });
  assert.deepEqual(r.adrs.map((a) => a.to), ['docs/adr/0008-feat.md', 'docs/adr/0009-feat-store.md']);
});

test('release-note AC-2 computed: a note that releases nothing writes nothing', () => {
  const root = noteRepo();
  const r = computeAt(root, 'packs: []\n');
  assert.deepEqual(r.files, {});
  assert.deepEqual(r.versions, { packs: {} });
  assert.deepEqual(r.adrs, []);
});

test('release-note AC-2 computed: changelogEntry inserts above the first ## line and rewrites only the listed packs bullets', () => {
  const out = D.changelogEntry('# Changelog\n\nintro\n\n## 1.0.0 — first\n\n- x\n', '1.1.0', 't', '- **a**: one\n- **b**: two\n  - **a**: nested\n- plain **a**: no', { a: '1.1.0' });
  assert.equal(out, '# Changelog\n\nintro\n\n## 1.1.0 — t\n\n- **a** 1.1.0: one\n- **b**: two\n  - **a** 1.1.0: nested\n- plain **a**: no\n\n## 1.0.0 — first\n\n- x\n');
});

test('release-note AC-2 computed: changelogEntry appends the entry when the base has no ## line', () => {
  assert.equal(D.changelogEntry('# Changelog\n', '1.1.0', 't', 'body', {}), '# Changelog\n\n## 1.1.0 — t\n\nbody\n');
});

// ---------------------------------------------------------------- AC-2: the state of a branch

test('release-note AC-2 state: a branch that holds the base lines and an unnumbered ADR is unassigned', () => {
  const s = stateOf(noteRepo());
  assert.equal(s.kind, 'unassigned');
  assert.deepEqual(s.paths, []);
  assert.equal(s.current, false);
});

test('release-note AC-2 state: a branch that holds what the step writes is assigned, and current while the base is in it', () => {
  const root = noteRepo();
  stepCommit(root);
  const s = stateOf(root);
  assert.equal(s.kind, 'assigned');
  assert.equal(s.current, true);
});

test('release-note AC-2 state: an assigned branch stays assigned and is not current once the base has moved', () => {
  const root = noteRepo();
  stepCommit(root);
  baseReleases(root, { 'src/other.ts': 'other\n' });
  const s = stateOf(root);
  assert.equal(s.kind, 'assigned');
  assert.equal(s.current, false);
});

test('release-note AC-2 state: a version edited by hand is hand and names the manifest', () => {
  const root = noteRepo();
  rewriteVersion(root, REL_FILE, '1.0.7');
  commitAll(root, 'hand');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', [REL_FILE]]);
});

test('release-note AC-2 state: a version that is neither the base\'s nor the computed one is hand even when the computed ones are in', () => {
  const root = noteRepo();
  stepCommit(root);
  rewriteVersion(root, 'plugins/core/.claude-plugin/plugin.json', '1.0.9');
  commitAll(root, 'hand');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', ['plugins/core/.claude-plugin/plugin.json']]);
});

test('release-note AC-2 state: an edited changelog is hand and names CHANGELOG.md', () => {
  const root = noteRepo();
  put(root, { 'CHANGELOG.md': `${CHANGELOG0}\n## 0.9.0 — older\n` });
  commitAll(root, 'hand');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', ['CHANGELOG.md']]);
});

test('release-note AC-2 state: an edited CI pin is hand and names the flow page', () => {
  const root = noteRepo();
  put(root, { 'docs/openspec-flow.md': readFileSync(join(root, 'docs/openspec-flow.md'), 'utf8').replace('v1.0.0', 'v9.9.9') });
  commitAll(root, 'hand');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', ['docs/openspec-flow.md']]);
});

test('release-note AC-2 state: a release file that is not a manifest, edited by hand, is hand', () => {
  const pkg = (v) => `${JSON.stringify({ name: 'app', version: v }, null, 2)}\n`;
  const root = noteRepo({ config: 'schema: devkit-lite\ndevkit:\n  release_tag: package.json\n', files: { 'package.json': pkg('1.4.0'), 'CHANGELOG.md': '# Changelog\n\n## 1.4.0 — old\n\n- x\n' }, adr: false, note: note('packs: []', 'release: minor', '', '## t', '', 'body') });
  assert.equal(stateOf(root).kind, 'unassigned');
  put(root, { 'package.json': pkg('1.4.3') });
  commitAll(root, 'hand');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', ['package.json']]);
  put(root, { 'package.json': pkg('1.5.0') });
  commitAll(root, 'what the step writes');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', ['CHANGELOG.md']], 'the changelog entry is still missing: half of what the step writes');
});

test('release-note AC-2 state: the versions written with the ADR still unnumbered are hand and name the ADR', () => {
  const root = noteRepo();
  stepCommit(root, { adr: false });
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', ['docs/adr/feat.md']]);
});

test('release-note AC-2 state: the ADR numbered with the versions not written is hand and names the versions', () => {
  const root = noteRepo();
  stepCommit(root, { versions: false, changelog: false, pin: false });
  const s = stateOf(root);
  assert.equal(s.kind, 'hand');
  assert.ok(s.paths.includes(REL_FILE), s.paths.join(', '));
});

test('release-note AC-2 state: an ADR numbered with another number than the next free one is hand', () => {
  const root = noteRepo();
  stepCommit(root);
  git(root, 'mv', 'docs/adr/0002-feat.md', 'docs/adr/0005-feat.md');
  commitAll(root, 'hand');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['hand', ['docs/adr/feat.md']]);
});

test('release-note AC-2 state: a missing origin/<base> is an error naming the fetch, never a pass', () => {
  const root = noteRepo();
  git(root, 'update-ref', '-d', 'refs/remotes/origin/main');
  const s = stateOf(root);
  assert.equal(s.kind, 'error');
  assert.match(s.error, /^cannot compute the release: origin\/main is missing; git fetch origin main$/);
});

test('release-note AC-2 state: a note that cannot be read leaves the state out and the facts carry its message', () => {
  const root = noteRepo({ note: 'packs:\n- devkit-core: big\n' });
  const f = D.releaseFacts(root, 'feat', D.gitFacts(root, { base: 'main' }));
  assert.equal(f.applies, true);
  assert.equal(f.noted, true);
  assert.match(f.note.error, /^release\.md: packs: devkit-core: "big"/);
});

// ---------------------------------------------------------------- AC-5: the records of a change

test('release-note AC-5 adrs: changeAdrs lists the unnumbered records of decisions.md in the folders, in the order listed', () => {
  const root = noteRepo();
  put(root, { 'openspec/changes/feat/decisions.md': '# D\n\n- ADR: `docs/adr/feat-store.md`\n- ADR: `docs/adr/0003-old.md`\n- ADR: `docs/decisions/feat.md`\n- ADR: `notes/feat.md`\n' });
  commitAll(root, 'decisions');
  assert.deepEqual(D.changeAdrs(root, 'HEAD', 'feat'), ['docs/adr/feat-store.md', 'docs/decisions/feat.md']);
  assert.deepEqual(D.changeAdrs(root, null, 'feat'), ['docs/adr/feat-store.md', 'docs/decisions/feat.md'], 'null reads the working tree');
  assert.deepEqual(D.changeAdrs(root, 'HEAD', 'nope'), []);
});

test('release-note AC-5 adrs: ADR_DIRS and ADR_LINES live in deliver-check.mjs and conduct-check.mjs re-exports ADR_DIRS', () => {
  assert.deepEqual(D.ADR_DIRS, ['docs/adr', 'docs/decisions']);
  assert.equal(C.ADR_DIRS, D.ADR_DIRS);
  assert.deepEqual([...'- ADR: `docs/adr/feat.md`\n'.matchAll(D.ADR_LINES)].map((m) => m[1]), ['docs/adr/feat.md']);
});

// ---------------------------------------------------------------- AC-9: nothing new without the setting

test('release-note AC-9 no key: the project names no devkit.release_tag, so no rule applies whatever release.md holds', () => {
  const root = noteRepo({ config: 'schema: devkit-lite\n', note: 'packs:\n- devkit-core: big\n' });
  assert.equal(D.releaseTagOf(root), null);
  assert.deepEqual(D.releaseFacts(root, 'feat', D.gitFacts(root, { base: 'main' })), { applies: false });
  assert.equal(stateOf(root), null);
});

test('release-note AC-9 no key: the delivery checker walks a change with a malformed release.md to ready as before', () => {
  const t = shipRepo({ ship: 'pr' });
  put(t.root, { 'openspec/changes/feat/release.md': 'packs:\n- devkit-core: big\n', 'plugins/openspec/hooks/x.mjs': 'x\n' });
  commitAll(t.root, 'a pack file and a note');
  const taken = driveToReady(t);
  assert.equal(taken.at(-1), 'ready', taken.join(' > '));
  assert.ok(!taken.includes('assign-release'));
  assert.deepEqual(D.collectState(t.root, 'feat', { env: t.env }).release, { applies: false }, 'the state records that no release rule applies');
});

test('release-note AC-9 release file missing: the key names a file the project does not have and nothing is written or refused', () => {
  const text = note('packs: []', 'release: minor', '', '## t', '', 'body');
  const root = noteRepo({ config: 'schema: devkit-lite\ndevkit:\n  release_tag: missing.json\n', files: { 'CHANGELOG.md': CHANGELOG0 }, adr: false, note: text });
  const r = computeAt(root, text, { setting: 'missing.json' });
  assert.deepEqual(r.files, {});
  assert.deepEqual(r.versions, { packs: {} }, 'no version is bumped for a file that is not there');
  assert.equal(stateOf(root).kind, 'assigned');
});

test('release-note AC-9 no key: releaseTagOf names the file the key gives, and null without the key', () => {
  assert.equal(D.releaseTagOf(noteRepo()), REL_FILE);
  assert.equal(D.releaseTagOf(noteRepo({ config: 'schema: devkit-lite\n' })), null);
});

// ---------------------------------------------------------------- AC-11: a release or a note that says there is none

test('release-note AC-11 no release: a note of packs: [] has nothing to write and is assigned at once', () => {
  const root = noteRepo({ note: 'packs: []\n', adr: false });
  const s = stateOf(root);
  assert.equal(s.kind, 'assigned');
  assert.equal(s.current, true);
});

test('release-note AC-11 no release: a pack file changed with no note and no bump is refused naming the pack, a note of packs: [] is not', () => {
  const refused = noteShip({ note: null, adr: false });
  put(refused.root, { 'plugins/openspec/hooks/x.mjs': 'x\n' });
  commitAll(refused.root, 'a pack file');
  tickAll(refused);
  const n = nextOf(refused);
  assert.equal(n.step, 'blocked');
  assert.match(n.reason, /^no release: plugins\/openspec/);

  const passes = noteShip({ note: 'packs: []\n', adr: false });
  put(passes.root, { 'plugins/openspec/hooks/x.mjs': 'x\n' });
  commitAll(passes.root, 'a pack file');
  tickAll(passes);
  assert.doesNotMatch(nextOf(passes).reason ?? '', /^no release:/);
});

// ---------------------------------------------------------------- AC-5, AC-7, AC-8, AC-9: what the step writes (D-4, D-6)

const stepScript = join(here, 'release-merge.mjs');
// The delivery step as the session runs it, in the change's worktree.
const assignIn = (root) => {
  const r = spawnSync(process.execPath, [stepScript, '--assign', '--base', 'main', '--json'], { cwd: root, encoding: 'utf8', env: { ...GIT_ENV, ...BLANK } });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* human output */ }
  return { code: r.status, out, text: r.stderr + r.stdout };
};
const headOf = (root) => git(root, 'rev-parse', 'HEAD');
const readIn = (root, path) => readFileSync(join(root, path), 'utf8');
const changedSince = (root, rev, ...paths) => git(root, 'diff', '--name-only', rev, 'HEAD', '--', ...paths).split('\n').filter(Boolean).sort();
const pkgJson = (v) => `${JSON.stringify({ name: 'app', version: v }, null, 2)}\n`;
const CONSUMER = 'schema: devkit-lite\ndevkit:\n  release_tag: package.json\n';
const CONSUMER_NOTE = note('packs: []', 'release: minor', '', '## t', '', 'body');

test('release-note AC-5 rewrite: ADR [<slug>] becomes ADR <NNNN> and <slug>.md becomes <NNNN>-<slug>.md, each only as a whole token', () => {
  const text = 'ADR [feat] and docs/adr/feat.md, (feat.md), adr/feat.md.\nNot ADR [feat-store], feat-store.md, myfeat.md, pre-feat.md, x_feat.md, feat.mdx or 0002-feat.md.\n';
  assert.equal(R.rewriteCitations(text, 'feat', '0002'), 'ADR 0002 and docs/adr/0002-feat.md, (0002-feat.md), adr/0002-feat.md.\nNot ADR [feat-store], feat-store.md, myfeat.md, pre-feat.md, x_feat.md, feat.mdx or 0002-feat.md.\n');
});

test('release-note AC-5 rewrite: the step numbers the ADR, its title and both citation forms, and writes what the release lines of stepCommit hold', () => {
  const root = noteRepo({ extra: { 'docs/z.md': 'Read [the rule](adr/feat.md) and ADR [feat].\n' } });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'docs/z.md'), 'Read [the rule](adr/0002-feat.md) and ADR 0002.\n');
  assert.deepEqual(r.out.citations, ['docs/x.md', 'docs/z.md']);
  git(root, 'switch', '-q', '-c', 'by-hand', oldHead);
  put(root, { 'docs/z.md': 'Read [the rule](adr/0002-feat.md) and ADR 0002.\n' });
  stepCommit(root);
  assert.equal(git(root, 'diff', '--name-only', 'by-hand', 'feat'), '', 'the step wrote exactly the lines written out by hand');
});

test('release-note AC-5 rewrite: no file under openspec/changes/ changes, in the change\'s folder, another change\'s or the archive', () => {
  const inChanges = {
    'openspec/changes/feat/design.md': 'See ADR [feat] in docs/adr/feat.md.\n',
    'openspec/changes/other/notes.md': 'Builds on ADR [feat].\n',
    'openspec/changes/archive/2026-01-01-old/notes.md': 'feat.md\n',
  };
  const root = noteRepo({ extra: inChanges });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(changedSince(root, oldHead, 'openspec'), []);
  for (const [path, text] of Object.entries(inChanges)) assert.equal(readIn(root, path), text, path);
  assert.equal(readIn(root, 'docs/x.md'), 'See ADR 0002 for the rule.\n', 'outside openspec/changes/ the citation is rewritten');
});

test('release-note AC-5 rewrite: a binary file that holds the citation bytes is skipped', () => {
  const blob = Buffer.concat([Buffer.from('ADR [feat] docs/adr/feat.md'), Buffer.from([0, 1, 2, 255])]);
  const root = noteRepo({ extra: { 'assets/blob.bin': blob } });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(readFileSync(join(root, 'assets/blob.bin')), blob);
  assert.ok(!r.out.citations.includes('assets/blob.bin'));
});

test('release-note AC-5 mask: the step\'s rewrite masks back to the unnumbered text, and another number does not', () => {
  const text = 'See ADR [feat] in docs/adr/feat.md.\n';
  const map = { adrs: [{ number: '0002', slug: 'feat' }], file: null };
  const numbered = R.rewriteCitations(text, 'feat', '0002');
  assert.equal(numbered, 'See ADR 0002 in docs/adr/0002-feat.md.\n');
  assert.equal(D.maskRelease(numbered, 'docs/x.md', map), text);
  assert.equal(D.maskRelease(text, 'docs/x.md', map), text, 'an unnumbered text masks to itself');
  assert.notEqual(D.maskRelease(R.rewriteCitations(text, 'feat', '0003'), 'docs/x.md', map), text);
});

test('release-note AC-7 citation: a citation of another change\'s ADR that has not landed is refused naming the slug, and nothing changes', () => {
  const root = noteRepo({ extra: { 'docs/y.md': 'Amends ADR [other].\n' } });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 2, r.text);
  assert.match(r.out.error, /^ADR \[other\] is cited but has not landed on main; it lands with its own change/);
  assert.equal(headOf(root), oldHead);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.equal(readIn(root, 'docs/y.md'), 'Amends ADR [other].\n');
});

test('release-note AC-7 citation: once the cited ADR landed on the base, the step rewrites the citation to its number', () => {
  const root = noteRepo({ extra: { 'docs/y.md': 'Amends ADR [other] (docs/adr/other.md).\n' } });
  baseReleases(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'docs/y.md'), 'Amends ADR 0002 (docs/adr/0002-other.md).\n');
  assert.equal(readIn(root, 'docs/adr/0003-feat.md').split('\n')[0], '# ADR 0003: the rule');
  assert.ok(r.out.citations.includes('docs/y.md'));
});

test('release-note AC-8 consumer: the release file gets the note\'s bump and CHANGELOG.md the entry above its newest', () => {
  const root = noteRepo({ config: CONSUMER, files: { 'package.json': pkgJson('1.4.0'), 'CHANGELOG.md': '# Changelog\n\n## 1.4.0 — old\n\n- x\n' }, adr: false, note: CONSUMER_NOTE });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'package.json'), pkgJson('1.5.0'));
  assert.equal(readIn(root, 'CHANGELOG.md'), '# Changelog\n\n## 1.5.0 — t\n\nbody\n\n## 1.4.0 — old\n\n- x\n');
  assert.deepEqual(changedSince(root, oldHead), ['CHANGELOG.md', 'package.json']);
  assert.equal(stateOf(root).kind, 'assigned');
});

test('release-note AC-8 consumer: with no CHANGELOG.md only the release file changes and no file is created', () => {
  const root = noteRepo({ config: CONSUMER, files: { 'package.json': pkgJson('1.4.0') }, adr: false, note: CONSUMER_NOTE });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'package.json'), pkgJson('1.5.0'));
  assert.deepEqual(changedSince(root, oldHead), ['package.json']);
  assert.ok(!existsSync(join(root, 'CHANGELOG.md')));
  assert.ok(!existsSync(join(root, 'docs')));
});

test('release-note AC-9 no docs/adr: a project with no ADR folder gets its release lines and no docs/adr', () => {
  const { ['docs/adr/0001-start.md']: _start, ...layout } = releaseLayout();
  const root = noteRepo({ files: layout, adr: false });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.ok(!existsSync(join(root, 'docs', 'adr')));
  assert.deepEqual(r.out.adrs, []);
  assert.deepEqual(changedSince(root, oldHead), ['.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/openspec-flow.md', 'plugins/core/.claude-plugin/plugin.json', REL_FILE].sort());
});

// ---------------------------------------------------------------- AC-9: the module boundary (D-3a)

test('release-note AC-9 boundary: release-merge.mjs re-exports the moved names as the same objects', () => {
  const names = ['pinsIn', 'setPins', 'ReleaseError', 'bumpKind', 'applyBump', 'resolveManifest', 'PIN_FILE', 'PIN_PACK', 'PIN_PACK_NAME'];
  for (const name of names) {
    assert.notEqual(D[name], undefined, `deliver-check.mjs exports ${name}`);
    assert.equal(R[name], D[name], `release-merge.mjs re-exports ${name} as the same object`);
  }
  assert.equal(D.TRAIN_PIN_FILE, R.PIN_FILE);
  assert.equal(typeof D.withoutVersions, 'function', 'the manifest mask of maskRelease and manifestEditsBeyondVersion');
});

test('release-note AC-9 boundary: deliver-check.mjs names no relative module but guard.mjs and merge-setup.mjs', () => {
  const source = readFileSync(join(here, 'deliver-check.mjs'), 'utf8');
  const specifiers = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(specifiers)].sort(), ['./guard.mjs', './merge-setup.mjs']);
});
