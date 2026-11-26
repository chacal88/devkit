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
import { tmpFolder } from './test-tmp.mjs';
import {
  REL_FILE, REL_CONFIG, NOTE_TEXT, ASSIGNED_CHANGELOG, CHANGELOG0, START_ADR, releaseLayout, noteRepo, stepCommit, baseReleases, noteShip, tickAll, driveToReady,
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

// Review round 1 (code-quality nit F5, D-23): changelogEntry would write a `## ` body line into CHANGELOG.md as a version heading of its own,
// which parseChangelog and the changelog rule of check.py read as a version; a `### ` line and a `## ` line inside a fence are text.
test('release-note AC-1 reader: a ## line in the changelog body is refused naming its line; a ### line and a fenced ## line are kept', () => {
  const refused = D.parseReleaseNote(note('packs:', '- devkit-core: patch', '', '## t', '', 'text', '## 2.0.0 — another', '- x'));
  assert.equal(refused.error, 'release.md: changelog body: line 7: "## 2.0.0 — another" is a version heading; write ### or a list item');
  assert.equal(refused.packs, undefined, 'a refused note gives no fields');
  const kept = D.parseReleaseNote(note('packs:', '- devkit-core: patch', '', '## t', '', 'text', '### a part', '- x', '```md', '## inside a fence', '```'));
  assert.equal(kept.error, undefined);
  assert.equal(kept.title, 't');
  assert.equal(kept.body, 'text\n### a part\n- x\n```md\n## inside a fence\n```');
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
  const not = 'Not ADR [feat-store], feat-store.md, myfeat.md, pre-feat.md, x_feat.md, feat.mdx or 0002-feat.md.\n';
  const text = `ADR [feat] and docs/adr/feat.md, (feat.md), adr/feat.md.\n${not}`;
  assert.equal(R.rewriteCitations(text, 'feat', '0002', 'docs/adr/0001-start.md'), `ADR 0002 and docs/adr/0002-feat.md, (0002-feat.md), adr/0002-feat.md.\n${not}`, 'in a file of an ADR folder the bare form names a record');
  assert.equal(R.rewriteCitations(text, 'feat', '0002', 'docs/x.md'), `ADR 0002 and docs/adr/0002-feat.md, (feat.md), adr/0002-feat.md.\n${not}`, 'elsewhere only a form whose folder part is an ADR folder');
});

// Review round 1 (code-quality F2, D-19): the file form names a record only where its folder part is an ADR folder, or with no folder
// part inside an ADR folder; a document elsewhere that shares the slug's name keeps every link to it.
test('release-note AC-5 rewrite: a change named like another document leaves its links alone', () => {
  const root = noteRepo({
    adr: false,
    extra: {
      'openspec/changes/feat/decisions.md': '# Decisions\n\n- ADR: `docs/adr/roles.md`\n',
      'docs/adr/roles.md': '# ADR [roles]: the roles\n\n- Status: proposed\n- Change: `feat`\n',
      'docs/roles.md': '# Roles\n',
      'docs/x.md': 'See [the roles](docs/roles.md), [the rule](adr/roles.md) and ADR [roles].\n',
      'docs/adr/0001-start.md': `${START_ADR}\nSee (roles.md).\n`,
    },
  });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'docs/x.md'), 'See [the roles](docs/roles.md), [the rule](adr/0002-roles.md) and ADR 0002.\n');
  assert.equal(readIn(root, 'docs/adr/0001-start.md'), `${START_ADR}\nSee (0002-roles.md).\n`);
  assert.equal(readIn(root, 'docs/roles.md'), '# Roles\n');
});

test('release-note AC-5 mask: a link to another document renamed by hand is not masked', () => {
  const map = { adrs: [{ number: '0002', slug: 'roles' }], file: null };
  assert.equal(D.maskRelease('See [the roles](docs/0002-roles.md).\n', 'docs/x.md', map), 'See [the roles](docs/0002-roles.md).\n');
  assert.equal(D.maskRelease('See (0002-roles.md).\n', 'docs/x.md', map), 'See (0002-roles.md).\n', 'a bare form outside an ADR folder');
  assert.equal(D.maskRelease('See [the rule](adr/0002-roles.md).\n', 'docs/x.md', map), 'See [the rule](adr/roles.md).\n', 'a form whose folder part is an ADR folder is masked');
  assert.equal(D.maskRelease('See (0002-roles.md).\n', 'docs/adr/0001-start.md', map), 'See (roles.md).\n', 'a bare form inside an ADR folder is masked');
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

// Found by the dogfood (task 8.1): the change's own tests write `ADR [x]` fixtures as string literals, and the step refused them as
// unlanded citations. A citation is read in every tracked text file outside openspec/changes/ but test files and fixtures (and in the note's
// changelog title and body, D-18); a test file or a fixture never holds one, so the scan, the "still cited" check and the rewrite all leave
// it alone.
const FIXTURE_SRC = "const a = 'Amends ADR [other].';\nconst b = 'ADR [feat] in docs/adr/feat.md';\n";

test('release-note AC-7 citation: an ADR [x] literal in a changed test file is neither cited nor rewritten', () => {
  const root = noteRepo({ extra: { 'plugins/openspec/hooks/x.test.mjs': FIXTURE_SRC } });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'plugins/openspec/hooks/x.test.mjs'), FIXTURE_SRC);
  assert.ok(!r.out.citations.includes('plugins/openspec/hooks/x.test.mjs'));
  assert.equal(readIn(root, 'docs/x.md'), 'See ADR 0002 for the rule.\n', 'the Markdown citation is still rewritten');
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['assigned', []], 'the literal left in the source file is not a citation still standing');
});

test('release-note AC-7 citation: the same token in a changed .md file is refused while unlanded and rewritten once landed, the literal in the test file never', () => {
  const extra = { 'plugins/openspec/hooks/x.test.mjs': FIXTURE_SRC, 'docs/y.md': 'Amends ADR [other].\n' };
  const root = noteRepo({ extra });
  const refused = assignIn(root);
  assert.equal(refused.code, 2, refused.text);
  assert.match(refused.out.error, /^ADR \[other\] is cited but has not landed on main/);
  baseReleases(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'docs/y.md'), 'Amends ADR 0002.\n');
  assert.equal(readIn(root, 'plugins/openspec/hooks/x.test.mjs'), FIXTURE_SRC);
});

for (const path of ['config/x.yaml', 'config/x.yml']) {
  test(`release-note AC-7 citation: a citation in a changed ${path.slice(path.lastIndexOf('.'))} file is cited, refused while unlanded and rewritten once landed`, () => {
    const root = noteRepo({ extra: { [path]: 'rule: ADR [other]\n' } });
    const refused = assignIn(root);
    assert.equal(refused.code, 2, refused.text);
    assert.match(refused.out.error, /^ADR \[other\] is cited but has not landed on main/);
    baseReleases(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
    const r = assignIn(root);
    assert.equal(r.code, 0, r.text);
    assert.equal(readIn(root, path), 'rule: ADR 0002\n');
    assert.ok(r.out.citations.includes(path));
  });
}

// Review round 1 (adr-reviewer F1, spec-reviewer F1, D-18): a citation lives in every tracked text file outside openspec/changes/ but
// test files and fixtures (`*.test.*`, `*-fixtures.*`, a file under a folder named test or tests); a binary file holds none.
test('release-note AC-7 citation: a citation in a changed source file is refused while unlanded and rewritten once landed', () => {
  const blob = Buffer.concat([Buffer.from('Amends ADR [third].'), Buffer.from([0, 1, 2, 255])]);
  const root = noteRepo({ extra: { 'plugins/openspec/hooks/x.mjs': '// amends ADR [other]\n', 'assets/blob.bin': blob } });
  const refused = assignIn(root);
  assert.equal(refused.code, 2, refused.text);
  assert.match(refused.out.error, /^ADR \[other\] is cited but has not landed on main; it lands with its own change/);
  assert.doesNotMatch(refused.out.error, /third/, 'a binary file holds no citation');
  baseReleases(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'plugins/openspec/hooks/x.mjs'), '// amends ADR 0002\n');
  assert.ok(r.out.citations.includes('plugins/openspec/hooks/x.mjs'));
  assert.deepEqual(readFileSync(join(root, 'assets/blob.bin')), blob);
});

test('release-note AC-5 rewrite: a source comment and a Python file are numbered with the record', () => {
  const sources = { 'plugins/a/hooks/x.mjs': '// the rule: ADR [feat] (docs/adr/feat.md)\n', 'scripts/x.py': '# ADR [feat], see docs/adr/feat.md\n' };
  const root = noteRepo({ extra: sources });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.equal(readIn(root, 'plugins/a/hooks/x.mjs'), '// the rule: ADR 0002 (docs/adr/0002-feat.md)\n');
  assert.equal(readIn(root, 'scripts/x.py'), '# ADR 0002, see docs/adr/0002-feat.md\n');
  assert.deepEqual(r.out.citations, ['docs/x.md', 'plugins/a/hooks/x.mjs', 'scripts/x.py']);
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['assigned', []]);
});

test('release-note AC-5 citation scope: a test file, a fixture and the files of a test folder are never cited, rewritten or counted as still cited', () => {
  const text = 'Amends ADR [other]. ADR [feat] in docs/adr/feat.md\n';
  const offenders = [];
  for (const path of ['plugins/a/hooks/x.test.mjs', 'plugins/a/hooks/x-fixtures.mjs', 'test/a.md', 'tests/b.yaml']) {
    const root = noteRepo({ extra: { [path]: text } });
    const r = assignIn(root);
    const state = stateOf(root);
    if (r.code !== 0 || readIn(root, path) !== text || r.out.citations.includes(path) || state.kind !== 'assigned' || state.paths.length) offenders.push(path);
  }
  assert.deepEqual(offenders, []);
});

test('release-note AC-5 citation scope: holdsCitations and CITATION_PATHSPEC name the same files', () => {
  const paths = [
    'x.test.mjs', 'plugins/a/hooks/x.test.mjs', 'x-fixtures.mjs', 'plugins/a/hooks/x-fixtures.mjs', 'test/a.md', 'tests/b.yaml', 'plugins/a/test/c.md',
    'docs/x.md', 'plugins/a/hooks/x.mjs', 'scripts/x.py', 'openspec/config.yaml', 'openspec/changes/f/design.md',
  ];
  const root = tmpFolder('devkit-release-note-scope-');
  git(root, 'init', '-q', '-b', 'main');
  put(root, Object.fromEntries(paths.map((p) => [p, 'ADR [x]\n'])));
  commitAll(root, 'every kind of file');
  const r = spawnSync('git', ['-C', root, 'grep', '-I', '-l', '-F', '-e', 'ADR [x]', '--', ...D.CITATION_PATHSPEC], { encoding: 'utf8' });
  const grepped = r.stdout.split('\n').filter(Boolean).sort();
  const expected = ['docs/x.md', 'openspec/config.yaml', 'plugins/a/hooks/x.mjs', 'scripts/x.py'];
  assert.deepEqual(grepped, expected, r.stderr);
  assert.deepEqual(paths.filter(D.holdsCitations).sort(), expected);
});

// Found by the real-run proof (task 6.2, P-1): the step rewrites the citations in every tracked text outside openspec/changes/, CHANGELOG.md
// included, so a changelog body that cites an ADR is written numbered and the state must read it so.
test('release-note AC-2 state: a changelog body that cites the change\'s own ADR is assigned after the step, and the step runs again after the base moved', () => {
  const root = noteRepo({ note: note('packs:', '- devkit-openspec: minor', '', '## the rule lands', '', '- **devkit-openspec**: the rule (ADR [feat])') });
  const first = assignIn(root);
  assert.equal(first.code, 0, first.text);
  assert.match(readIn(root, 'CHANGELOG.md'), /- \*\*devkit-openspec\*\* 1\.1\.0: the rule \(ADR 0002\)\n/);
  assert.deepEqual([stateOf(root).kind, stateOf(root).paths], ['assigned', []]);
  baseReleases(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
  const again = assignIn(root);
  assert.equal(again.code, 0, again.text);
  assert.match(readIn(root, 'CHANGELOG.md'), /the rule \(ADR 0003\)\n/);
  assert.deepEqual([stateOf(root).kind, stateOf(root).current], ['assigned', true]);
});

test('release-note AC-2 state: a changelog body that cites another change\'s landed ADR is assigned after the step', () => {
  const root = noteRepo({ note: note('packs:', '- devkit-openspec: minor', '', '## the rule lands', '', '- **devkit-openspec**: amends ADR [other]') });
  baseReleases(root, { 'docs/adr/0002-other.md': '# ADR 0002: other\n' });
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.match(readIn(root, 'CHANGELOG.md'), /amends ADR 0002\n/);
  assert.deepEqual([stateOf(root).kind, stateOf(root).current], ['assigned', true]);
});

test('release-note AC-7 citation: a changelog body that cites another change\'s ADR that has not landed is refused naming the slug', () => {
  const root = noteRepo({ note: note('packs:', '- devkit-openspec: minor', '', '## the rule lands', '', '- **devkit-openspec**: amends ADR [other]') });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 2, r.text);
  assert.match(r.out.error, /^ADR \[other\] is cited but has not landed on main/);
  assert.equal(headOf(root), oldHead);
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

// Review round 1 (test-coverage F2): the step's merge of a base that released the consumer's release file merges that file with the version
// line set to the base's on both sides (D-6 step 2), then step 3 writes the note's bump above the base's.
test('release-note AC-8 consumer: run again after the base released, the release file takes the note\'s bump above the base\'s', () => {
  const root = noteRepo({ config: CONSUMER, files: { 'package.json': pkgJson('1.4.0'), 'CHANGELOG.md': '# Changelog\n\n## 1.4.0 — old\n\n- x\n' }, adr: false, note: CONSUMER_NOTE });
  assert.equal(assignIn(root).code, 0);
  assert.equal(readIn(root, 'package.json'), pkgJson('1.5.0'));
  baseReleases(root, { 'package.json': pkgJson('1.5.0'), 'CHANGELOG.md': '# Changelog\n\n## 1.5.0 — other\n\n- o\n\n## 1.4.0 — old\n\n- x\n' });
  const oldHead = headOf(root);
  const r = assignIn(root);
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(git(root, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').slice(1), [oldHead, git(root, 'rev-parse', 'origin/main')], 'one merge commit of the base');
  assert.equal(readIn(root, 'package.json'), pkgJson('1.6.0'));
  assert.equal(readIn(root, 'CHANGELOG.md'), '# Changelog\n\n## 1.6.0 — t\n\nbody\n\n## 1.5.0 — other\n\n- o\n\n## 1.4.0 — old\n\n- x\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.deepEqual([stateOf(root).kind, stateOf(root).current], ['assigned', true]);
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

// ---------------------------------------------------------------- AC-6: scripts/check.py reads both ADR forms (D-12)

const CHECK_PY = join(here, '..', '..', '..', 'scripts', 'check.py');
const runCheckPy = (root, env = {}) => {
  const r = spawnSync('python3', [CHECK_PY, '--root', root], { encoding: 'utf8', env: { ...GIT_ENV, ...BLANK, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
};
const adrText = (slug) => `# ADR [${slug}]: a decision\n\n- Status: proposed\n`;
const listedBy = (dir, ...paths) => ({ [`${dir}/decisions.md`]: `# Decisions and ADRs\n\n${paths.map((p) => `- ADR: \`${p}\` — a decision`).join('\n')}\n` });
const UNNUMBERED_FEAT = { 'docs/adr/feat.md': adrText('feat'), ...listedBy('openspec/changes/feat', 'docs/adr/feat.md') };
const ON_BASE = /docs\/adr\/feat\.md: an unnumbered ADR on the base branch/;
const NOT_LISTED = /docs\/adr\/feat\.md: an unnumbered ADR that no active openspec\/changes\/<id>\/decisions\.md lists/;
// A repository on `main` (or `branch`) with one numbered record and `files`, all committed.
function adrRepo(files = {}, branch = 'main') {
  const root = tmpFolder('devkit-release-note-adrs-');
  git(root, 'init', '-q', '-b', branch);
  put(root, { 'docs/adr/0001-start.md': '# ADR 0001: Start\n\n- Status: accepted\n', ...files });
  commitAll(root, 'base');
  return root;
}
// `root` with a branch `feat` made from main's tip and one commit of `files` on it.
function onFeat(root, files) {
  git(root, 'checkout', '-q', '-b', 'feat');
  put(root, files);
  commitAll(root, 'feat');
  return root;
}

test('release-note AC-6 check: on a change branch an unnumbered ADR its change lists is tolerated', () => {
  const branch = onFeat(adrRepo(), UNNUMBERED_FEAT);
  const r = runCheckPy(branch);
  assert.equal(r.code, 0, r.out);
  assert.equal(runCheckPy(adrRepo(UNNUMBERED_FEAT), { GITHUB_HEAD_REF: 'feat' }).code, 0, 'a pull request\'s head on CI is a branch, whatever is checked out');
  const merge = adrRepo(UNNUMBERED_FEAT, 'pr-merge');
  git(merge, 'checkout', '-q', '--detach');
  const detached = runCheckPy(merge);
  assert.equal(detached.code, 0, `a detached merge ref with no default branch is a branch: ${detached.out}`);
});

test('release-note AC-6 check: on main, and on a fresh branch at main\'s tip, an unnumbered ADR is refused as the base\'s', () => {
  const main = adrRepo(UNNUMBERED_FEAT);
  const r = runCheckPy(main);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, ON_BASE);
  const fresh = adrRepo();
  git(fresh, 'checkout', '-q', '-b', 'feat');
  put(fresh, UNNUMBERED_FEAT);
  const f = runCheckPy(fresh);
  assert.equal(f.code, 1, f.out);
  assert.match(f.out, ON_BASE, 'an uncommitted ADR on a branch at the base\'s tip reads as the base');
  const numbered = runCheckPy(adrRepo({ 'docs/adr/0002-feat.md': '# ADR 0002: A decision\n' }));
  assert.equal(numbered.code, 0, `numbered records pass on the base: ${numbered.out}`);
});

test('release-note AC-6 check: a train/<n> pull request is the base, and an unnumbered ADR on it is refused', () => {
  const root = onFeat(adrRepo(), UNNUMBERED_FEAT);
  const r = runCheckPy(root, { GITHUB_HEAD_REF: 'train/1' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, ON_BASE);
  assert.equal(runCheckPy(root, { GITHUB_HEAD_REF: 'train-notes' }).code, 0, 'only train/<n> is a train');
});

test('release-note AC-6 check: an unnumbered ADR no active change lists is refused, on a branch too', () => {
  for (const [label, files] of [
    ['no decisions.md', { 'docs/adr/feat.md': adrText('feat') }],
    ['listed only by an archived change', { 'docs/adr/feat.md': adrText('feat'), ...listedBy('openspec/changes/archive/2026-11-01-feat', 'docs/adr/feat.md') }],
    ['decisions.md lists another record', { 'docs/adr/feat.md': adrText('feat'), ...listedBy('openspec/changes/feat', 'docs/adr/other.md') }],
  ]) {
    const r = runCheckPy(onFeat(adrRepo(), files));
    assert.equal(r.code, 1, `${label}: ${r.out}`);
    assert.match(r.out, NOT_LISTED, label);
    assert.doesNotMatch(r.out, ON_BASE, `${label}: a branch is not the base`);
  }
});

test('release-note AC-6 check: two records with one slug are refused, across the two folders and numbered or not', () => {
  const both = runCheckPy(onFeat(adrRepo(), { ...UNNUMBERED_FEAT, 'docs/decisions/0002-feat.md': '# ADR 0002: A decision\n' }));
  assert.equal(both.code, 1, both.out);
  assert.match(both.out, /a second ADR with the slug feat: docs\/adr\/feat\.md, docs\/decisions\/0002-feat\.md/);
  const numbered = runCheckPy(adrRepo({ 'docs/adr/0002-feat.md': '# ADR 0002: A\n', 'docs/adr/0003-feat.md': '# ADR 0003: B\n' }));
  assert.equal(numbered.code, 1, numbered.out);
  assert.match(numbered.out, /a second ADR with the slug feat: docs\/adr\/0002-feat\.md, docs\/adr\/0003-feat\.md/);
});

test('release-note AC-6 check: a README.md and a file whose first line is not an ADR title are ignored; blank lines before the title are not', () => {
  const ignored = runCheckPy(adrRepo({ 'docs/adr/README.md': '# Decision records\n\nOne file per decision.\n', 'docs/decisions/notes.md': '\n\nSome notes.\n' }));
  assert.equal(ignored.code, 0, ignored.out);
  const titled = runCheckPy(adrRepo({ 'docs/adr/feat.md': `\n\n${adrText('feat')}`, ...listedBy('openspec/changes/feat', 'docs/adr/feat.md') }));
  assert.equal(titled.code, 1, titled.out);
  assert.match(titled.out, ON_BASE);
});

test('release-note AC-6 check: a root that is not a git repository is the base', () => {
  const root = tmpFolder('devkit-release-note-nogit-');
  put(root, UNNUMBERED_FEAT);
  const r = runCheckPy(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, ON_BASE);
  assert.doesNotMatch(r.out, NOT_LISTED, 'its change lists it');
});

// ---------------------------------------------------------------- AC-4: the step's own record (review round 1, D-20)

const RELEASE_PATHS = [REL_FILE, 'plugins/core/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/openspec-flow.md'];
// A merge of origin/main by hand: every release file of releaseLayout takes the base's side but those of `ours`, which keep the branch's;
// `files` are written as the person resolves them; one merge commit.
function mergeByHand(root, { files = {}, ours = [] } = {}) {
  spawnSync('git', ['-C', root, 'merge', '--no-ff', '--no-commit', 'origin/main'], { encoding: 'utf8', env: GIT_ENV });
  for (const path of RELEASE_PATHS) git(root, 'checkout', ours.includes(path) ? 'HEAD' : 'origin/main', '--', path);
  put(root, files);
  commitAll(root, 'merge origin/main by hand');
}
const OTHER_CHANGELOG = (version) => `# Changelog\n\n## ${version} — other\n\n- **devkit-openspec**: other\n\n## 1.0.0 — first\n\n- **devkit-openspec**: start\n`;

test('release-note AC-4 record: stepRecord reads each key from the newest recorded commit that wrote it, ignores a trailer whose commit wrote nothing, and is null without one', () => {
  const root = noteRepo();
  const recordOf = (tip = 'origin/main', id = 'feat') => D.stepRecord(root, { head: 'HEAD', tip, id });
  assert.equal(recordOf(), null, 'no commit of the branch carries a record');

  const first = stepCommit(root, { record: true });
  const one = recordOf();
  assert.equal(one.commit, first);
  assert.deepEqual([...one.lines.keys()].sort(), ['.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/adr/feat.md', 'docs/openspec-flow.md', 'plugins/core/.claude-plugin/plugin.json', REL_FILE].sort());
  assert.equal(one.lines.get(REL_FILE), '1.1.0', 'a value read from the commit\'s tree');
  assert.equal(one.lines.get('docs/adr/feat.md'), 'numbered:docs/adr/0002-feat.md');
  assert.deepEqual(one.adrs, [{ from: 'docs/adr/feat.md', to: 'docs/adr/0002-feat.md', commit: first }]);
  assert.deepEqual(one.citations, [{ path: 'docs/x.md', commit: first }]);

  rewriteVersion(root, 'plugins/core/.claude-plugin/plugin.json', '1.0.2');
  const second = commitAll(root, [
    'chore(release): assign the release of feat', '',
    'Release-change: feat',
    'Release-line: plugins/core/.claude-plugin/plugin.json',
    'Release-line: CHANGELOG.md',
    'Release-adr: docs/adr/other.md -> docs/adr/0009-other.md',
    'Release-citation: docs/x.md',
  ].join('\n'));
  const two = recordOf();
  assert.equal(two.commit, second, 'the newest recorded commit is the record');
  const core = 'plugins/core/.claude-plugin/plugin.json';
  assert.deepEqual([...two.lines].sort(), [...one.lines].map(([k, v]) => [k, k === core ? '1.0.2' : v]).sort(),
    'each key takes the newest recorded commit that wrote it; a trailer naming what its commit did not write is ignored, so its key keeps the older commit\'s value');
  assert.deepEqual([two.adrs, two.citations], [one.adrs, one.citations], 'the rename and the citation the second commit did not write stay the first commit\'s');

  commitAll(root, 'chore(release): assign the release of other\n\nRelease-change: other');
  commitAll(root, 'notes\n\nRelease-change: feat\n\nnot a trailer block');
  assert.equal(recordOf().commit, second, 'another change\'s record and a Release- line outside the last paragraph are not this change\'s');
  assert.equal(recordOf('nope'), null, 'git log fails');
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  assert.equal(recordOf(), null, 'a recorded commit the tip holds is not read');
});

test('release-note AC-4 record: a line equal to both the merge base\'s value and the record\'s is unassigned and outside reassign, and a version kept from the record is left to step 3', () => {
  // The reproduction: the base released devkit-openspec 1.1.0 and devkit-core 1.0.1, as the step had, and took ADR 0002.
  const root = noteRepo({ extra: { 'src/a.ts': 'mine\n' } });
  assert.equal(assignIn(root).code, 0);
  baseReleases(root, { ...releaseLayout({ openspec: '1.1.0', core: '1.0.1', market: '1.1.0', changelog: OTHER_CHANGELOG('1.1.0') }), 'docs/adr/0002-other.md': '# ADR 0002: other\n', 'src/a.ts': 'theirs\n' });
  const refused = assignIn(root);
  assert.equal(refused.code, 2, refused.text);
  mergeByHand(root, { files: { 'src/a.ts': 'both\n' } });
  const s = stateOf(root);
  assert.equal(s.kind, 'unassigned', s.paths.join(', '));
  assert.deepEqual(s.reassign, ['docs/adr/feat.md'], 'devkit-openspec 1.1.0 on both sides is the merge base\'s, not the record\'s');

  // A merge by hand that kept the branch's 1.1.0 over a base at 2.0.0.
  const kept = noteRepo();
  assert.equal(assignIn(kept).code, 0);
  baseReleases(kept, releaseLayout({ openspec: '2.0.0', market: '2.0.0', changelog: OTHER_CHANGELOG('2.0.0') }));
  mergeByHand(kept, { ours: [REL_FILE] });
  const k = stateOf(kept);
  assert.equal(k.kind, 'unassigned', k.paths.join(', '));
  assert.ok(k.reassign.includes(REL_FILE), k.reassign.join(', '));
  const r = assignIn(kept);
  assert.equal(r.code, 0, r.text);
  assert.equal(JSON.parse(readIn(kept, REL_FILE)).version, '2.1.0', 'step 3 writes the version computed from the base');
  assert.deepEqual([stateOf(kept).kind, stateOf(kept).current], ['assigned', true]);
});

// ---------------------------------------------------------------- AC-14: the documents and agent texts (D-13)

// The change's id, which is its ADR's slug. The texts cite that ADR as `ADR [<slug>]` before the delivery and `ADR <NNNN>` after it, and
// name its file `<slug>.md`, then `<NNNN>-<slug>.md`: each pattern below takes both forms, so the step's rewrite leaves this test green.
const SLUG = 'release-at-merge';
const CITED = `ADR (?:\\[${SLUG}\\]|\\d{4})`;
const FILED = `(?:\\d{4}-)?${SLUG}\\.md`;
// The change's second record, which amends the first (D-20, "The `ADRs:` line"), cited in the same two forms.
const CITED2 = `ADR (?:\\[${SLUG}-step-record\\]|\\d{4})`;
const repoText = (...parts) => readFileSync(join(here, '..', '..', '..', ...parts), 'utf8');
const sectionOf = (text, heading) => (text.split(`\n${heading}\n`)[1] ?? '').split('\n## ')[0];

// The real planner of task 7.2 (proof/agents-run.md, S-2) wrote `packs:` / `- app: minor` in a project whose release file is package.json:
// the reader takes it, and computeRelease refuses it at the delivery (`packs: app is not a pack of this project`). Its text must say what a
// pack is and where the release file's own bump goes.
test('release-note AC-1 texts: the planner says a pack is a plugin manifest of the project and that the release file\'s bump goes under release:', () => {
  const planner = repoText('plugins', 'core', 'agents', 'change-planner.md');
  const bullet = planner.split('\n').find((l) => l.includes('**The release note**')) ?? '';
  assert.ok(bullet.includes('`plugins/<dir>/.claude-plugin/plugin.json`'), 'the note bullet says a pack is a plugins/<dir>/.claude-plugin/plugin.json of the project');
  assert.match(bullet, /`release:` [^.]*the file `devkit\.release_tag` names/, 'the note bullet puts the release file\'s bump under release:');
  assert.match(bullet, /no such pack[^.]*`packs: \[\]`/, 'a project with no pack writes packs: []');
});

// Review round 3 (D-31): the resolve-base-conflict hand-off of a noted change asks the implementer to take the base's side of a release
// line, which its Never bullet forbids editing; the bullet says that merge is not such an edit, in the agent and its generated kit copy.
test('release-note AC-14 texts: the implementer takes the base\'s side of a release line in a merge of the base for a change with a release note', () => {
  const sentence = 'Taking the base\'s side of such a line in a merge of the base, or keeping beside the base\'s entries the change\'s own citations as the branch holds them (the `resolve-base-conflict` hand-off of such a change), writes no number of the change and is not such an edit.';
  for (const parts of [['plugins', 'core', 'agents', 'tdd-implementer.md'], ['plugins', 'compozy', 'kit', 'templates', 'agents', 'tdd-implementer', 'AGENT.md']]) {
    const bullet = sectionOf(repoText(...parts), '## Never').split('\n').find((l) => l.startsWith('- In a change that has `release.md`')) ?? '';
    assert.ok(bullet.length > 0, `${parts.join('/')} has the release.md bullet`);
    assert.ok(bullet.includes(`the delivery writes them once, at the merge. ${sentence}`), `${parts.join('/')}: the bullet holds the sentence after the merge clause`);
    assert.ok(bullet.includes('keeping beside the base\'s entries the change\'s own citations as the branch holds them'), `${parts.join('/')} names the one-line list`);
  }
});

// Found by the real-run proof (task 11.11, S-13 (a)): the real implementer, handed resolve-base-conflict (a step with no phase), merged
// and committed as the row says but returned prose with no `Outcome:` line, which the loop and the conductor read. The Returns section
// says a delivery hand-off with no phase returns the same block, its Outcome line last, in the agent and its generated kit copy.
test('release-note AC-14 texts: a delivery hand-off with no phase returns the implementer\'s block with its Outcome line last', () => {
  const sentence = '- A hand-off of the delivery with no phase (`resolve-base-conflict`, `resolve-release-conflict`, `renumber-adr`) returns the same block, its heading naming the step in place of the phase and its `Tasks:` line `none`; its `Outcome:` line is last too.';
  for (const parts of [['plugins', 'core', 'agents', 'tdd-implementer.md'], ['plugins', 'compozy', 'kit', 'templates', 'agents', 'tdd-implementer', 'AGENT.md']]) {
    // From its heading to the next one, `## Escalate`: the block's own heading line is inside a code fence.
    const text = repoText(...parts);
    const returns = text.slice(text.indexOf('\n## Returns\n'), text.indexOf('\n## Escalate'));
    assert.ok(returns.split('\n').includes(sentence), `${parts.join('/')}: the Returns section holds the hand-off bullet`);
  }
});

test('release-note AC-14 texts: the agents, the documents and the records follow the release note and the unnumbered ADR', async (t) => {
  await t.test('agents: the planner, the ADR author and reviewer, the implementer and the readiness review', () => {
    const planner = repoText('plugins', 'core', 'agents', 'change-planner.md');
    for (const part of ['`release.md`', '`devkit.release_tag`', '`ADR [<slug>]`', 'no task bumps a version']) assert.ok(planner.includes(part), `change-planner names ${part}`);
    assert.match(planner, /stop hook refuses your stop/, 'the planner knows the stop hook refuses a stop without the note');
    assert.match(planner, /no `devkit\.release_tag`, write no `release\.md`/, 'without the setting the planner writes no note');

    for (const file of [['agents', 'adr-author.md'], ['skills', 'adr-authoring', 'SKILL.md']]) {
      const text = repoText('plugins', 'core', ...file);
      for (const part of ['`devkit.release_tag`', '`docs/adr/<slug>.md`', '`# ADR [<slug>]: ', '`ADR [<slug>]`', '0001']) assert.ok(text.includes(part), `${file.join('/')} names ${part}`);
      assert.match(text, /no ADR folder, create `docs\/adr\/` with the unnumbered record/, `${file.join('/')}: a project with no folder gets docs/adr/ unnumbered`);
    }

    const reviewer = repoText('plugins', 'core', 'agents', 'adr-reviewer.md');
    for (const part of ['`docs/adr/<slug>.md`', '`ADR [<slug>]`', 'before its delivery']) assert.ok(reviewer.includes(part), `adr-reviewer names ${part}`);

    const implementer = repoText('plugins', 'core', 'agents', 'tdd-implementer.md');
    const never = sectionOf(implementer, '## Never');
    for (const part of ['`release.md`', 'a version', 'a CHANGELOG line', 'a CI pin', 'an ADR number']) assert.ok(never.includes(part), `tdd-implementer never edits ${part}`);
    assert.match(sectionOf(implementer, '## Escalate (return `failure` with the reason; don\'t force it)'), /release line/, 'a task asking for a release line is escalated');
    assert.match(implementer, /apply-proposals call/, 'the apply-proposals call keeps its bump');

    const readiness = repoText('plugins', 'core', 'skills', 'plan-readiness-review', 'SKILL.md');
    for (const part of ['`release.md`', 'no task bumps a version', '`docs/adr/<slug>.md`']) assert.ok(readiness.includes(part), `plan-readiness-review names ${part}`);
    const nextFree = readiness.split('\n').filter((l) => l.includes('next free number'));
    assert.ok(nextFree.length > 0 && nextFree.every((l) => l.includes('old rule')), 'the next-free-number sentence is scoped to old-rule changes');

    for (const agent of ['change-planner', 'adr-author', 'adr-reviewer', 'tdd-implementer']) {
      const copy = repoText('plugins', 'compozy', 'kit', 'templates', 'agents', agent, 'AGENT.md');
      assert.ok(copy.includes('`release.md`') || copy.includes('`ADR [<slug>]`'), `the CompozyOS copy of ${agent} is regenerated`);
    }
  });

  await t.test('documents: CONTRIBUTING step 5, the config and the flow page', () => {
    const contributing = repoText('CONTRIBUTING.md');
    const step5 = contributing.slice(contributing.indexOf('\n5. Bump the `version`'), contributing.indexOf('\n   A release that changes devkit-openspec\'s version is tagged'));
    assert.ok(step5.startsWith('\n5. Bump the `version`'), 'step 5 keeps its first words');
    for (const part of ['`release.md`', 'edits no release line', 'the CI pins of `docs/openspec-flow.md` included', '`assign-release`', 'opened before', 'old rule', '0030-the-pin-test-reads-the-manifest']) {
      assert.ok(step5.includes(part), `step 5 names ${part}`);
    }

    const config = repoText('openspec', 'config.yaml').split('\n');
    const conventions = config.find((l) => l.trim().startsWith('Conventions:'));
    assert.match(conventions, /release note/, 'the Conventions line names the note');
    assert.match(conventions, /bumps no version and numbers no ADR/);
    const tasksAt = config.findIndex((l) => /^  tasks:\s*$/.test(l));
    const afterTasks = config.slice(tasksAt + 1);
    const taskRules = afterTasks.slice(0, afterTasks.findIndex((l) => !/^\s{4}-/.test(l)));
    const rule = taskRules.find((l) => l.includes('release note'));
    assert.ok(rule, 'a tasks rule names the release note');
    assert.match(rule, /^\s{4}- ['"]/, 'the rule is quoted');
    for (const part of ['no task bumps a version or numbers an ADR', 'old-rule', 'the next free number on origin/main at the last merge before review']) assert.ok(rule.includes(part), `the tasks rule says ${part}`);
    const adrs = config.find((l) => l.trim().startsWith('ADRs:'));
    assert.match(adrs, new RegExp(`; ${CITED} [^;]+, amends 0022 and 0025, amended by ${CITED2}; ${CITED2} [^;]+, amends ${CITED}\\)$`), 'the ADRs line ends with this change\'s two records, the first naming the second as its amender');
    assert.ok(adrs.includes('; 0030 the pin test reads the manifest, so only the flow page pins pass unnamed, amends 0003 and 0027;'), 'the entries before it stay');

    const flow = repoText('docs', 'openspec-flow.md');
    for (const part of ['**The release note.**', '| `assign-release` |', '`--assign --base <base>`', '**A noted change on the train.**']) assert.ok(flow.includes(part), `the flow page names ${part}`);
  });

  await t.test('records: ADR 0022 and ADR 0025 are amended, ADR 0003, 0027 and 0030 are not', () => {
    const amended = new RegExp(`^- Amended by ${CITED} \\(${FILED}\\)$`, 'm');
    for (const name of ['0022-reviewed-changes-leave-on-a-delivery-train.md', '0025-a-base-merge-stales-only-on-the-changes-own-files.md']) {
      const text = repoText('docs', 'adr', name);
      const header = text.split('\n## Context\n')[0];
      assert.match(header, amended, `${name} has the Amended by line in its header`);
      assert.match(text.split('\n## Context\n')[1], new RegExp(`^Note \\(${SLUG}, \\d{4}-\\d{2}-\\d{2}\\): ${CITED} amends `, 'm'), `${name} has the dated Note`);
    }
    for (const name of ['0003-auto-merge-the-archive-pr.md', '0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md', '0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md']) {
      assert.doesNotMatch(repoText('docs', 'adr', name), amended, `${name} is built on, not amended`);
    }
  });
});
