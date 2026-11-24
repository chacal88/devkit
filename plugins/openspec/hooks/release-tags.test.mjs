// release-tags: the delivery loop tags the release a merge made (design D-1 to D-9).
// Phase 1: the `release_tag` setting, read by `guard.mjs` and by the loop's settings reader.
// Phase 2: the checker's facts and rows (`releaseTagFacts`, rows R1 to R3), on `fakeGh` fixtures.
// Phase 3: the loop's decision on the real rows (`decide`, `tag-elsewhere`) and the skills' text.
// Phase 4: the documents and this repository's own configuration (they read the working tree, never its history).
// Every scenario runs on a temporary folder; no test reads this repository's git history: commits, versions and tags are fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import * as guard from './guard.mjs';
import * as deliver from './deliver-check.mjs';
import { readDevkitSettings, decide, exitCodeOf, render } from './change-loop.mjs';
import { deliveryStep } from './conduct-check.mjs';
import { pinsIn } from './release-merge.mjs';
import { pm, retroMd, writeRetro, mergedPr, archivePrJson, ARCHIVE_PRS, ARCHIVE_LISTING, fakeGh, scenario, archiving, TWO_PRS, put, commitAll } from './test-fixtures.mjs';
import { makeGh } from './merge-setup.mjs';

const PLUGIN_JSON = 'plugins/openspec/.claude-plugin/plugin.json';
const ACCEPTED = 'a path from the repository root to a JSON file, such as package.json';

const keyOf = (text) => guard.parseDevkitBlock(text).release_tag;
const settingOf = (text) => guard.releaseTagSetting(guard.parseDevkitBlock(text));
const devkit = (...lines) => `schema: devkit\ndevkit:\n${lines.map((l) => `  ${l}\n`).join('')}`;

function configRepo(text) {
  const root = tmpFolder('devkit-release-tags-cfg-');
  mkdirSync(join(root, 'openspec'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'config.yaml'), text);
  return root;
}

// ---------------------------------------------------------------- P1: parseDevkitBlock and releaseTagSetting (D-1)

test('release-tags 1: a plain, a quoted and a commented release_tag read as the path', () => {
  assert.equal(keyOf(devkit('release_tag: package.json')), 'package.json');
  assert.equal(keyOf(devkit('release_tag: "package.json"')), 'package.json');
  assert.equal(keyOf(devkit("release_tag: 'package.json'")), 'package.json');
  assert.equal(keyOf(devkit('release_tag: package.json   # the file the release is read from')), 'package.json');
  assert.deepEqual(settingOf(devkit('release_tag: package.json # the file')), { file: 'package.json' });
});

test('release-tags 1: no release_tag, or an empty one, is unset', () => {
  assert.equal(keyOf(devkit('driver: claude')), undefined);
  assert.equal(keyOf(devkit('release_tag:')), undefined);
  assert.equal(keyOf(devkit('release_tag: ""')), undefined);
  assert.deepEqual(settingOf(devkit('release_tag:')), { file: null });
  assert.deepEqual(settingOf(devkit('driver: claude')), { file: null });
  assert.deepEqual(guard.releaseTagSetting(null), { file: null });
  assert.deepEqual(guard.releaseTagSetting(undefined), { file: null });
});

test('release-tags 1: a release_tag nested under delivery is ignored (neg)', () => {
  const text = devkit('delivery:', '  model: trunk', '  release_tag: package.json');
  assert.equal(keyOf(text), undefined);
  assert.deepEqual(settingOf(text), { file: null });
});

test('release-tags 1: a release_tag followed by indented lines is unset and its nested lines are skipped', () => {
  const text = devkit('release_tag:', '  file: package.json', 'driver: script');
  assert.equal(keyOf(text), undefined);
  assert.ok('release_tag' in guard.parseDevkitBlock(text), 'the block names the key, unset');
  assert.equal(guard.parseDevkitBlock(text).driver, 'script');
});

test('release-tags 1: an unterminated quote keeps the text after the quote', () => {
  assert.equal(keyOf(devkit('release_tag: "package.json')), 'package.json');
  assert.deepEqual(settingOf(devkit('release_tag: "package.json')), { file: 'package.json' });
});

test('release-tags 1: a path from the repository root to a JSON file is the file', () => {
  for (const file of [PLUGIN_JSON, 'package.json', 'a/b.c-d_e/x.v1.json', '.claude/x.json']) {
    assert.deepEqual(settingOf(devkit(`release_tag: ${file}`)), { file }, file);
  }
});

test('release-tags 1: every form that is not such a path is a problem', () => {
  for (const value of ['/abs.json', '../x.json', 'a/./x.json', 'a//x.json', 'x.yaml', '[a.json]', 'a b.json', 'a\\b.json',
    'a/../x.json', 'a/', 'x.json?ref=main', 'x.json#top', 'json', '.json/']) {
    assert.deepEqual(settingOf(devkit(`release_tag: ${value}`)),
      { file: null, problem: { kind: 'unknown', setting: 'release-tag', value } }, value);
  }
});

// ---------------------------------------------------------------- P2: readDevkitSettings (D-1)

test('release-tags 1: a valid release_tag sets releaseTag in the settings', () => {
  assert.deepEqual(readDevkitSettings(configRepo(devkit(`release_tag: ${PLUGIN_JSON}`))),
    { driver: 'claude', language: 'en', unknown: [], releaseTag: PLUGIN_JSON });
});

test('release-tags 1: no release_tag keeps the three-key settings exactly', () => {
  for (const text of ['schema: devkit\n', devkit('release_tag:'), devkit('delivery:', '  release_tag: package.json')]) {
    assert.deepEqual(readDevkitSettings(configRepo(text)), { driver: 'claude', language: 'en', unknown: [] }, text);
  }
});

test('release-tags 1: an invalid release_tag adds the release-tag unknown entry, after the other settings', () => {
  const bad = readDevkitSettings(configRepo(devkit('release_tag: x.yaml')));
  assert.deepEqual(bad.unknown, [{ setting: 'release-tag', value: 'x.yaml', accepted: ACCEPTED }]);
  assert.equal('releaseTag' in bad, false);
  const both = readDevkitSettings(configRepo(devkit('driver: robot', 'release_tag: /abs.json', 'tests:', '  coverage:', '    target: high')));
  assert.deepEqual(both.unknown.map((u) => u.setting), ['driver', 'coverage-target', 'release-tag']);
});

// ================================================================ phase 2: the checker's facts and rows (D-2 to D-4)

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'deliver-check.mjs');
const FILE = 'release.json';
const KEY = `devkit:\n  release_tag: ${FILE}\n`;
const MERGE = '1'.repeat(40); // the change's merge commit (PR #12) and the commit before it
const PARENT = '2'.repeat(40);
const AMERGE = '3'.repeat(40); // the archive's merge commit (PR #13) and the commit before it
const APARENT = '4'.repeat(40);
const ELSEWHERE = '5'.repeat(40);
const TAG_OBJECT = '6'.repeat(40);
const NOT_FOUND = { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' };
const httpError = (n) => ({ exit: 1, stderr: `gh: Bad Gateway (HTTP ${n})\n` });
const route = (path) => `api-GET-repos__owner___repo__${path}`;

// A fixture from a spec: null is an HTTP 404, a number is that HTTP error, anything else is the answer.
const answer = (spec) => (spec === null ? NOT_FOUND : typeof spec === 'number' ? httpError(spec) : { stdout: spec });
const contents = (text) => ({ type: 'file', encoding: 'base64', content: Buffer.from(text).toString('base64') });
// The release file at a commit: a string is its `version`; `{ raw }` is the file's text; `{ json }` its object.
const fileAnswer = (spec) => {
  if (spec === null || typeof spec === 'number') return answer(spec);
  if (typeof spec === 'string') return answer(contents(JSON.stringify({ name: 'x', version: spec })));
  return answer(contents(spec.raw ?? JSON.stringify(spec.json)));
};

// The GitHub reads of D-2 for one pull request, as fixtures. `atMerge` and `atParent` are the release file at the merge commit and
// at its first parent; `tag` is the answer for `v<version at the merge>`: null or unset (no such tag, HTTP 404), a number (that
// HTTP error), `{ at }` (a lightweight tag at that commit), `{ at, annotated }` (an annotated tag object that points at it), or
// `{ raw }` (the ref endpoint's own answer, such as an array). `pull`, `commit` and `tagObject` replace the answers of calls 1, 3 and 6.
function releaseFixtures(gh, { number = 12, base = 'main', merged = true, merge = MERGE, parent = PARENT, atMerge, atParent, tag, pull, commit, tagObject } = {}) {
  gh.set(route(`pulls_${number}`), pull !== undefined ? answer(pull)
    : answer({ number, merged, base: { ref: base }, ...(merge === null ? {} : { merge_commit_sha: merge }) }));
  if (merge !== null) {
    gh.set(route(`contents_${FILE}_ref=${merge}`), fileAnswer(atMerge));
    gh.set(route(`git_commits_${merge}`), commit !== undefined ? answer(commit) : answer({ parents: parent === null ? [] : [{ sha: parent }] }));
  }
  if (parent !== null) gh.set(route(`contents_${FILE}_ref=${parent}`), fileAnswer(atParent));
  const version = typeof atMerge === 'string' ? atMerge : null;
  if (version === null) return;
  const ref = `refs/tags/v${version}`;
  if (tag === undefined || tag === null || typeof tag === 'number') gh.set(route(`git_ref_tags_v${version}`), answer(tag ?? null));
  else if (tag.raw !== undefined) gh.set(route(`git_ref_tags_v${version}`), answer(tag.raw));
  else if (tag.annotated) {
    gh.set(route(`git_ref_tags_v${version}`), answer({ ref, object: { type: 'tag', sha: tag.annotated } }));
    gh.set(route(`git_tags_${tag.annotated}`), tagObject !== undefined ? answer(tagObject) : answer({ object: { type: 'commit', sha: tag.at } }));
  } else gh.set(route(`git_ref_tags_v${version}`), answer({ ref, object: { type: 'commit', sha: tag.at } }));
}

// A merged change PR #12 on a repository that names `release.json`; its release at the merge is `version`, before it `before`.
function released({ version = '1.3.0', before = '1.2.0', tag, extra = KEY, ...opts } = {}) {
  const t = pm({ extra, ...opts });
  releaseFixtures(t.gh, { atMerge: version, atParent: before, tag });
  return t;
}
// The archive's merged PR #13 on top of it (the change is archived on the default branch).
const archivedRelease = ({ version, before, tag, changeTag, ...opts } = {}) => {
  const t = pm({ extra: KEY, onDefault: 'archived', archivePrs: [archivePrJson({ state: 'MERGED' })], ...opts });
  releaseFixtures(t.gh, { atMerge: '1.2.0', atParent: '1.2.0', tag: changeTag ?? { at: MERGE } });
  releaseFixtures(t.gh, { number: 13, merge: AMERGE, parent: APARENT, atMerge: version ?? '1.3.0', atParent: before ?? '1.2.0', tag });
  return t;
};
const runCli = (t, args = []) => {
  const r = spawnSync('node', [CLI, 'feat', ...args], { cwd: t.root, encoding: 'utf8', env: { ...t.env, DEVKIT_HOST: 'cli', CLAUDE_CODE_ENTRYPOINT: '' } });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const releaseCalls = (t) => t.gh.calls().filter((c) => c[0] === 'api' && /\/(pulls\/\d+|contents\/release\.json|git\/commits|git\/ref|git\/tags)\b/.test(c[1] ?? '') && !/\/files$/.test(c[1]));

test("release-tags 2: the change's merge that bumped the release asks tag-release before the retro", () => {
  const t = released();
  const n = t.next();
  assert.deepEqual({ step: n.step, tag: n.tag, sha: n.sha, number: n.number, merged: n.merged, version: n.version, file: n.file, base: n.base },
    { step: 'tag-release', tag: 'v1.3.0', sha: MERGE, number: 12, merged: 'change', version: '1.3.0', file: FILE, base: 'main' });
  assert.equal(n.reason, `PR #12 merged version 1.3.0 of ${FILE} at ${MERGE.slice(0, 7)}, and origin has no tag v1.3.0`);
  assert.match(deliver.renderHuman(deliver.buildReport(t.state(), t.env)), new RegExp(`^next: tag-release v1\\.3\\.0 at ${MERGE.slice(0, 7)} \\(PR #12\\)$`, 'm'));
  const j = t.json();
  assert.deepEqual([j.summary, j.next.step], ['merged: archive step tag-release', 'tag-release']);
  assert.equal(runCli(t).code, 0);
  // With the tag at the merge commit the run goes on to the retro, the step it was ahead of.
  releaseFixtures(t.gh, { atMerge: '1.3.0', atParent: '1.2.0', tag: { at: MERGE } });
  assert.equal(t.next().step, 'retro');
});

test("release-tags 2: the archive merge that bumped the release asks tag-release instead of archived", () => {
  const t = archivedRelease();
  const n = t.next();
  assert.deepEqual({ step: n.step, tag: n.tag, sha: n.sha, number: n.number, merged: n.merged, version: n.version },
    { step: 'tag-release', tag: 'v1.3.0', sha: AMERGE, number: 13, merged: 'archive', version: '1.3.0' });
  releaseFixtures(t.gh, { number: 13, merge: AMERGE, parent: APARENT, atMerge: '1.3.0', atParent: '1.2.0', tag: { at: AMERGE } });
  assert.equal(t.next().step, 'archived');
});

test('release-tags 2: an unchanged version asks no tag', () => {
  const t = released({ version: '1.2.0', before: '1.2.0' });
  assert.equal(t.next().step, 'retro');
  assert.equal(releaseCalls(t).some((c) => c[1].includes('git/ref')), false, 'no tag is read for an unchanged version');
  assert.equal(releaseCalls(t).length, 4, 'the pull request, the file at the merge, the merge commit and the file at its parent: nothing else');
});

test('release-tags 2: a tag at the merge commit is the step done (lightweight and annotated)', () => {
  for (const tag of [{ at: MERGE }, { at: MERGE, annotated: TAG_OBJECT }]) {
    const t = released({ tag });
    assert.equal(t.next().step, 'retro', JSON.stringify(tag));
  }
  const annotated = released({ tag: { at: MERGE, annotated: TAG_OBJECT } });
  annotated.next();
  assert.ok(annotated.gh.calls().some((c) => (c[1] ?? '').endsWith(`/git/tags/${TAG_OBJECT}`)), 'the annotated tag is followed to its commit');
});

test("release-tags 2: without release_tag the answer and the gh calls are today's", () => {
  for (const extra of ['', 'devkit:\n  language: en\n']) {
    const t = pm({ extra });
    assert.equal(t.next().step, 'retro');
    assert.deepEqual(releaseCalls(t), [], 'no pull request, commit or tag read');
    assert.equal('release' in t.state().archive, false, 'the facts carry no release key');
    assert.deepEqual(Object.keys(t.json().archive), ['base', 'branch', 'changePr', 'onDefault', 'folder', 'local', 'retro', 'roadmap', 'pr', 'waitingFor']);
  }
  const archived = pm({ onDefault: 'archived', archivePrs: [archivePrJson({ state: 'MERGED' })] });
  assert.equal(archived.next().step, 'archived');
  assert.equal(archived.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('chore/archive-feat')), false, 'an archived change reads no archive PR list');
});

test('release-tags 2: a tag at another commit stops naming the tag and both commits', () => {
  const t = released({ tag: { at: ELSEWHERE } });
  const n = t.next();
  assert.deepEqual({ step: n.step, archiveStep: n.archiveStep, tag: n.tag, at: n.at, sha: n.sha, number: n.number },
    { step: 'stop-archive', archiveStep: 'tag-release', tag: 'v1.3.0', at: ELSEWHERE, sha: MERGE, number: 12 });
  assert.equal(n.reason, `tag v1.3.0 on origin is at ${ELSEWHERE.slice(0, 7)}, not at ${MERGE.slice(0, 7)}, the merge commit of PR #12; the loop never moves a tag`);
  const r = runCli(t);
  assert.equal(r.code, 2);
  assert.match(r.out, /^next: stop-archive: tag v1\.3\.0 on origin is at 5555555/m);
  assert.equal(JSON.parse(runCli(t, ['--json']).out).summary, 'blocked: archive (tag-release)');
  // An annotated tag that points elsewhere is the same stop.
  const a = released({ tag: { at: ELSEWHERE, annotated: TAG_OBJECT } });
  assert.deepEqual([a.next().step, a.next().at], ['stop-archive', ELSEWHERE]);
});

test('release-tags 2: a retro written but a tag still missing is still tag-release', () => {
  const t = released();
  writeRetro(t, retroMd());
  assert.equal(t.next().step, 'tag-release');
});

test("release-tags 2: a file new at the parent, or a parent that is not JSON, is a bump", () => {
  for (const atParent of [null, { raw: 'not json' }, { json: { name: 'x' } }, { json: { version: 3 } }]) {
    const t = released({ before: undefined });
    releaseFixtures(t.gh, { atMerge: '1.3.0', atParent });
    const n = t.next();
    assert.deepEqual([n.step, n.tag], ['tag-release', 'v1.3.0'], JSON.stringify(atParent));
  }
});

test('release-tags 2: a merge commit without a parent has no earlier version, so its version is a bump', () => {
  const t = released({ tag: null });
  releaseFixtures(t.gh, { atMerge: '1.3.0', parent: null });
  assert.equal(t.next().step, 'tag-release');
});

test('release-tags 2: a release file gone at the merge asks nothing (neg)', () => {
  const t = released();
  releaseFixtures(t.gh, { atMerge: null, atParent: '1.2.0' });
  assert.equal(t.next().step, 'retro');
  assert.deepEqual(releaseCalls(t).map((c) => c[1].replace(/^repos\/\{owner\}\/\{repo\}\//, '')), ['pulls/12', `contents/${FILE}?ref=${MERGE}`], 'read, and nothing after the 404');
});

test('release-tags 2: a pull request to another base, or one not merged, asks nothing (neg)', () => {
  for (const over of [{ base: 'develop' }, { merged: false }]) {
    const t = released();
    releaseFixtures(t.gh, { atMerge: '1.3.0', atParent: '1.2.0', ...over });
    assert.equal(t.next().step, 'retro', JSON.stringify(over));
    assert.equal(releaseCalls(t).length, 1, 'the pull request answered: nothing else is read');
  }
});

test('release-tags 2: a release file a tag cannot carry is a stop, never a pass', () => {
  for (const atMerge of [{ raw: 'not json' }, { json: { name: 'x' } }, { json: { version: 3 } }, '1..2', '1.2.', '1.2.lock', '-1.0', 'a b', '1#2']) {
    const t = released();
    releaseFixtures(t.gh, { atMerge, atParent: '1.2.0' });
    const n = t.next();
    assert.deepEqual([n.step, n.archiveStep, n.number], ['stop-archive', 'tag-release', 12], JSON.stringify(atMerge));
    assert.match(n.reason, new RegExp(`^${FILE} at ${MERGE.slice(0, 7)} has no top-level "version" a tag can carry$`), JSON.stringify(atMerge));
  }
});

test('release-tags 2: both merges bumped asks the change first, then the archive', () => {
  const t = archivedRelease({ version: '1.4.0', before: '1.3.0', changeTag: null });
  releaseFixtures(t.gh, { atMerge: '1.3.0', atParent: '1.2.0', tag: null });
  const first = t.next();
  assert.deepEqual([first.step, first.merged, first.number, first.tag], ['tag-release', 'change', 12, 'v1.3.0']);
  releaseFixtures(t.gh, { atMerge: '1.3.0', atParent: '1.2.0', tag: { at: MERGE } });
  const second = t.next();
  assert.deepEqual([second.step, second.merged, second.number, second.tag], ['tag-release', 'archive', 13, 'v1.4.0']);
});

test('release-tags 2: an archive that did not move the version is archived (neg)', () => {
  const t = archivedRelease({ version: '1.3.0', before: '1.3.0' });
  assert.equal(t.next().step, 'archived');
  assert.ok(releaseCalls(t).some((c) => c[1].endsWith(`/contents/${FILE}?ref=${APARENT}`)), 'the archive merge was read');
});

test('release-tags 2: an archive with the change tag done and its own missing is tag-release for the archive', () => {
  const t = archivedRelease();
  releaseFixtures(t.gh, { atMerge: '1.2.0', atParent: '1.1.0', tag: { at: MERGE } });
  const n = t.next();
  assert.deepEqual([n.step, n.merged, n.number], ['tag-release', 'archive', 13]);
});

test('release-tags 2: the ref endpoint answering a list is read for the exact ref only', () => {
  const entry = (ref, sha) => ({ ref, object: { type: 'commit', sha } });
  const withExact = released({ tag: { raw: [entry('refs/tags/v1.3.0.1', ELSEWHERE), entry('refs/tags/v1.3.0', MERGE)] } });
  assert.equal(withExact.next().step, 'retro', 'the entry with the exact ref is the tag');
  const without = released({ tag: { raw: [entry('refs/tags/v1.3.0.1', ELSEWHERE)] } });
  assert.deepEqual([without.next().step, without.next().tag], ['tag-release', 'v1.3.0'], 'a longer name is no tag');
  const empty = released({ tag: { raw: [] } });
  assert.equal(empty.next().step, 'tag-release');
});

test('release-tags 2: an invalid release_tag value is refused by the CLI with exit 3, naming devkit.release_tag', () => {
  const t = pm({ extra: 'devkit:\n  release_tag: ../x.json\n' });
  const r = runCli(t);
  assert.equal(r.code, 3);
  assert.match(r.err, /devkit\.release_tag: "\.\.\/x\.json" is not a path from the repository root to a \.json file/);
  assert.throws(() => t.state(), deliver.ShipConfigError);
});

// ---------------------------------------------------------------- P4: what GitHub does not answer (AC-5)

const stops = (t, number = 12) => {
  const n = t.next();
  assert.deepEqual([n.step, n.archiveStep, n.number], ['stop-archive', 'tag-release', number]);
  return n;
};

test('release-tags 2: each fact GitHub does not answer stops tag-release, never a pass', () => {
  const full = { atMerge: '1.3.0', atParent: '1.2.0' };
  const cases = [
    ['call 1, the pull request', { ...full, pull: 502 }],
    ['call 2, the file at the merge', { ...full, atMerge: 502 }],
    ['call 3, the merge commit', { ...full, commit: 502 }],
    ['call 4, the file at the parent', { ...full, atParent: 502 }],
    ['call 5, the tag', { ...full, tag: 502 }],
    ['call 6, the annotated tag', { ...full, tag: { at: MERGE, annotated: TAG_OBJECT }, tagObject: 502 }],
  ];
  for (const [name, over] of cases) {
    const t = released();
    releaseFixtures(t.gh, over);
    const n = stops(t);
    assert.match(n.reason, /^cannot read the release of PR #12 on GitHub: .*502/, name);
  }
});

test('release-tags 2: a pull request answer without a merge commit is a stop', () => {
  const t = released();
  releaseFixtures(t.gh, { merge: null, atMerge: '1.3.0', atParent: '1.2.0' });
  assert.match(stops(t).reason, /merge commit/);
  const short = released();
  releaseFixtures(short.gh, { merge: 'abc123', atMerge: '1.3.0', atParent: '1.2.0' });
  assert.match(stops(short).reason, /merge commit/, 'a sha that is not 40 hex is no merge commit');
});

test('release-tags 2: an answer that is not JSON, or has no parent list, or names another ref is a stop', () => {
  const full = { atMerge: '1.3.0', atParent: '1.2.0' };
  for (const [name, over] of [
    ['pulls', { pull: 'not json' }],
    ['commits', { commit: 'not json' }],
    ['commit without parents', { commit: {} }],
    ['ref', { tag: { raw: 'not json' } }],
    ['ref of another tag', { tag: { raw: { ref: 'refs/tags/v9.9.9', object: { type: 'commit', sha: MERGE } } } }],
    ['ref of a tree', { tag: { raw: { ref: 'refs/tags/v1.3.0', object: { type: 'tree', sha: MERGE } } } }],
    ['annotated target', { tag: { at: MERGE, annotated: TAG_OBJECT }, tagObject: 'not json' }],
    ['annotated tag of a tree', { tag: { at: MERGE, annotated: TAG_OBJECT }, tagObject: { object: { type: 'tree', sha: MERGE } } }],
  ]) {
    const t = released();
    releaseFixtures(t.gh, { ...full, ...over });
    stops(t);
    assert.ok(t.next().reason, name);
  }
});

test('release-tags 2: a gh that times out on the tag read is a stop naming it', () => {
  const t = released();
  const real = deliver.makeGh(t.root, t.env);
  const gh = (args, opts) => (args.join(' ').includes('/git/ref/tags/') ? { status: null, signal: null, stdout: '', stderr: '', missing: false, timedOut: true, overflowed: false } : real(args, opts));
  const n = deliver.nextStep(deliver.collectState(t.root, 'feat', { env: t.env, gh }));
  assert.deepEqual([n.step, n.archiveStep], ['stop-archive', 'tag-release']);
  assert.equal(n.reason, 'cannot read the release of PR #12 on GitHub: gh timed out');
});

test('release-tags 2: an archive PR list that cannot be read, on an archived change, is a stop', () => {
  const t = archivedRelease();
  t.gh.set(ARCHIVE_PRS, { exit: 1, stderr: 'gh: connection reset\n' });
  const n = stops(t, null);
  assert.match(n.reason, /^cannot read the archive PR on GitHub: /);
});

test('release-tags 2: HTTP 404 on the tag read is the step to run, not a stop (neg)', () => {
  const t = released({ tag: null });
  assert.equal(t.next().step, 'tag-release');
});

test('release-tags 2: an archived change whose archive PR list has no merged entry asks nothing', () => {
  const t = archivedRelease({ archivePrs: [] });
  assert.equal(t.next().step, 'archived');
  assert.ok(t.gh.calls().some((c) => c[0] === 'pr' && c[1] === 'list' && c.includes('chore/archive-feat')), 'the archive PR list was read');
});

// ---- release-at-merge (AC-13): the merge that carries the numbers assign-release or the train's join wrote is the one tagged, by the same
// rules (ADR 0019). The change states its release in openspec/changes/feat/release.md; the version at the merge is the one the note's bump
// gives over the version before it, read through the same GitHub calls as any other merge.
const NOTED = '# Release note\n\npacks: []\nrelease: minor\n\n## the change\n\n- it does a thing\n';
const TRAIN_MERGE = '7'.repeat(40);
const TRAIN_PARENT = '8'.repeat(40);
function notedMerged({ version, before, merge = MERGE, parent = PARENT }) {
  const t = pm({ extra: KEY });
  releaseFixtures(t.gh, { atMerge: version, atParent: before, merge, parent });
  put(t.root, { 'openspec/changes/feat/release.md': NOTED });
  commitAll(t.root, 'the release note of feat');
  return t;
}
const bumped = (version, times = 1) => Array.from({ length: times }).reduce((v) => deliver.applyBump(v, deliver.parseReleaseNote(NOTED).release), version);

test('release-note AC-13 tag: the single merge whose release assign-release wrote asks tag-release for its merge commit', () => {
  const version = bumped('1.2.0');
  const t = notedMerged({ version, before: '1.2.0' });
  const n = t.next();
  assert.deepEqual({ step: n.step, tag: n.tag, sha: n.sha, number: n.number, merged: n.merged, version: n.version, file: n.file },
    { step: 'tag-release', tag: 'v1.3.0', sha: MERGE, number: 12, merged: 'change', version: '1.3.0', file: FILE });
  releaseFixtures(t.gh, { atMerge: version, atParent: '1.2.0', tag: { at: MERGE } });
  assert.equal(t.next().step, 'retro', 'with the tag at the merge commit the run goes on');
});

test("release-note AC-13 tag: a train's merge commit that carries two noted releases asks tag-release for that commit", () => {
  // GitHub marks a boarded pull request merged with the train's merge commit (delivery-train D-2); two noted joins bumped the file twice.
  const version = bumped('1.2.0', 2);
  const t = notedMerged({ version, before: '1.2.0', merge: TRAIN_MERGE, parent: TRAIN_PARENT });
  const n = t.next();
  assert.deepEqual({ step: n.step, tag: n.tag, sha: n.sha, number: n.number, version: n.version },
    { step: 'tag-release', tag: 'v1.4.0', sha: TRAIN_MERGE, number: 12, version: '1.4.0' });
  assert.equal(n.reason, `PR #12 merged version 1.4.0 of ${FILE} at ${TRAIN_MERGE.slice(0, 7)}, and origin has no tag v1.4.0`);
});

// ---- two-prs (ADR 0018): only the merges into the base branch are tagged. The delivery-models simulator answers the pull requests of
// both branches; the release reads go to a fakeGh with the fixtures above, so a read of a test-branch pull request is on record.

const TWO_PRS_RELEASE = `schema: devkit-lite\n${TWO_PRS}  release_tag: ${FILE}\n`;
const RELEASE_ROUTE = /^repos\/\{owner\}\/\{repo\}\/(pulls\/\d+|contents\/release\.json\?.*|git\/(commits|ref|tags)\/.*)$/;

function withReleases(s) {
  const fake = fakeGh();
  const sim = s.sim.gh(s.wt);
  const release = makeGh(s.wt, fake.env);
  const seen = [];
  const gh = (args, opts) => { seen.push(args); return args[0] === 'api' && RELEASE_ROUTE.test(args[1] ?? '') ? release(args, opts) : sim(args, opts); };
  return {
    fake,
    next: () => deliver.nextStep(deliver.collectState(s.wt, 'feat', { env: s.env, gh })),
    // The numbers of the pull requests whose release facts were read, and every release route that was read.
    pulls: () => [...new Set(seen.map((a) => /\/pulls\/(\d+)$/.exec(a[1] ?? '')?.[1]).filter(Boolean).map(Number))].sort((a, b) => a - b),
    routes: () => seen.filter((a) => a[0] === 'api' && RELEASE_ROUTE.test(a[1] ?? '')).map((a) => a[1]),
  };
}
const prOn = (s, base, head) => s.sim.prs().find((p) => p.base === base && p.head === head).number;

test('release-tags 2: two-prs names tag-release for the merge into main and reads nothing of the test-branch change pull request', () => {
  const s = scenario({ config: TWO_PRS_RELEASE });
  const { base, test } = s.openBoth();
  s.sim.merge(test);
  s.sim.merge(base);
  const r = withReleases(s);
  releaseFixtures(r.fake, { number: base, atMerge: '1.3.0', atParent: '1.2.0' });
  const n = r.next();
  assert.deepEqual({ step: n.step, tag: n.tag, sha: n.sha, number: n.number, merged: n.merged, base: n.base },
    { step: 'tag-release', tag: 'v1.3.0', sha: MERGE, number: base, merged: 'change', base: 'main' });
  assert.deepEqual(r.pulls(), [base], `only pulls/${base} (main) is read, not pulls/${test} (develop): ${r.routes()}`);
  assert.equal(r.routes().some((x) => x.includes(`pulls/${test}`)), false);
});

test('release-tags 2: two-prs names tag-release for the archive merge into main and reads nothing of the test-branch archive pull request', () => {
  const s = archiving({ config: TWO_PRS_RELEASE });
  const changeBase = prOn(s, 'main', 'feat');
  const changeTest = prOn(s, 'develop', 'feat');
  s.sim.merge(s.basePr);
  s.cutTest();
  const testArchive = s.testPr();
  s.sim.merge(testArchive);
  const r = withReleases(s);
  // The change's merge did not move the version; the archive merge into main did; the test-branch archive PR (a develop merge) is never read.
  releaseFixtures(r.fake, { number: changeBase, atMerge: '1.2.0', atParent: '1.2.0' });
  releaseFixtures(r.fake, { number: s.basePr, merge: AMERGE, parent: APARENT, atMerge: '1.3.0', atParent: '1.2.0' });
  const n = r.next();
  assert.deepEqual({ step: n.step, tag: n.tag, sha: n.sha, number: n.number, merged: n.merged, base: n.base },
    { step: 'tag-release', tag: 'v1.3.0', sha: AMERGE, number: s.basePr, merged: 'archive', base: 'main' });
  assert.deepEqual(r.pulls(), [changeBase, s.basePr].sort((a, b) => a - b), `no pulls/${changeTest} nor pulls/${testArchive}: ${r.routes()}`);
  releaseFixtures(r.fake, { number: s.basePr, merge: AMERGE, parent: APARENT, atMerge: '1.3.0', atParent: '1.2.0', tag: { at: AMERGE } });
  assert.equal(r.next().step, 'archived', 'with the main merge tagged the two-prs archive is done: the develop merge asks nothing');
  assert.equal(r.pulls().includes(changeTest) || r.pulls().includes(testArchive), false);
});

// ================================================================ phase 3: the loop and the skills (D-5, D-6)

const HERE = dirname(fileURLToPath(import.meta.url));
const FLOW = JSON.parse(readFileSync(join(HERE, '..', 'schemas', 'devkit', 'flow.json'), 'utf8'));
const skillText = (name) => readFileSync(join(HERE, '..', 'skills', name, 'SKILL.md'), 'utf8');
const DELIVERY = FLOW.stages.find((s) => s.id === 'delivery');
const REPORT = {
  version: 1, change: 'feat', schema: 'devkit', script: 'current', head: 'h', stages: [], previous: null, end: null,
  next: { n: FLOW.stages.indexOf(DELIVERY) + 1, stage: 'delivery', role: DELIVERY.role, skills: [], reasonCode: 'not-pushed', params: { number: 12 }, reason: 'x', progressKey: 'delivery@abc123' },
};
const ARCHIVED_REPORT = { ...REPORT, next: null, end: { state: 'archived', stage: null, reasonCode: 'archived', params: {}, reason: 'x' } };
const APPROVAL = { status: null, recorded: null, readiness: 'sha256:abcdef012345', ok: false };

// The loop's decision on the checker's real answer: the row is `deliveryStep` of the phase-2 report, never a hand-made one.
function decideOn(t, { archiving = false, after = null, lang = 'en' } = {}) {
  const row = deliveryStep('feat', deliver.buildReport(t.state(), t.env));
  return decide({
    ctx: { id: 'feat', script: 'devkit', root: '/w/feat', branch: archiving ? 'chore/archive-feat' : 'feat', lang, filesLanguage: 'en' },
    flow: FLOW, report: archiving ? ARCHIVED_REPORT : REPORT, after, fingerprint: 'abc123', approval: APPROVAL, hasProposal: false, flags: [], archiving, row,
  });
}

test("release-tags 3: tag-release after the change's merge is a session step of the delivery stage", () => {
  const a = decideOn(released());
  assert.deepEqual([a.kind, a.stage, a.step, exitCodeOf(a)], ['session', 'delivery', 'tag-release', 0]);
  assert.equal(a.progressKey, 'delivery/tag-release@abc123');
  assert.deepEqual(
    { tag: a.detail.tag, sha: a.detail.sha, number: a.detail.number, merged: a.detail.merged, version: a.detail.version, file: a.detail.file, base: a.detail.base },
    { tag: 'v1.3.0', sha: MERGE, number: 12, merged: 'change', version: '1.3.0', file: FILE, base: 'main' });
  assert.match(a.detail.reason, /origin has no tag v1\.3\.0$/);
  assert.equal('actor' in a.detail, false, 'the actor is not part of the detail');
});

test('release-tags 3: on the archive branch tag-release comes before the archived end', () => {
  const a = decideOn(archivedRelease(), { archiving: true });
  assert.deepEqual([a.kind, a.stage, a.step, exitCodeOf(a)], ['session', 'delivery', 'tag-release', 0]);
  assert.deepEqual([a.detail.merged, a.detail.number, a.detail.sha, a.detail.tag], ['archive', 13, AMERGE, 'v1.3.0']);
  const done = archivedRelease({ tag: { at: AMERGE } });
  const end = decideOn(done, { archiving: true });
  assert.deepEqual([end.kind, end.end.state, end.end.why], ['end', 'archived', 'archived'], 'with the tag pushed the archived end is back');
});

test('release-tags 3: the same tag-release back with nothing changed ends the run blocked no-progress', () => {
  const a = decideOn(released(), { after: 'delivery/tag-release@abc123' });
  assert.deepEqual([a.kind, a.end.state, a.end.why, exitCodeOf(a)], ['end', 'blocked', 'no-progress', 2]);
});

test('release-tags 3: a tag at another commit ends the run blocked tag-elsewhere, naming both commits', () => {
  const t = released({ tag: { at: ELSEWHERE } });
  const a = decideOn(t);
  assert.deepEqual([a.kind, a.end.state, a.end.why, exitCodeOf(a)], ['end', 'blocked', 'tag-elsewhere', 2]);
  assert.deepEqual([a.params.tag, a.params.at, a.params.sha], ['v1.3.0', ELSEWHERE.slice(0, 7), MERGE.slice(0, 7)]);
  for (const lang of ['en', 'pt-BR']) {
    const reply = decideOn(t, { lang }).reply;
    for (const part of ['v1.3.0', ELSEWHERE.slice(0, 7), MERGE.slice(0, 7)]) assert.ok(reply.includes(part), `${lang}: ${reply}`);
    assert.ok(!reply.includes('`'), reply);
  }
  assert.match(render('en', 'blocked-why.tag-elsewhere', { tag: 'v1.3.0', at: 'd4e5f60', sha: 'a1b2c3d' }), /never moves a tag/);
  assert.match(render('pt-BR', 'blocked-why.tag-elsewhere', { tag: 'v1.3.0', at: 'd4e5f60', sha: 'a1b2c3d' }), /nunca move uma tag/);
});

test('release-tags 3: a tag-release stop that GitHub could not answer stays archive-failed (neg)', () => {
  const a = decideOn(released({ tag: 502 }));
  assert.deepEqual([a.kind, a.end.state, a.end.why, exitCodeOf(a)], ['end', 'blocked', 'archive-failed', 2]);
});

test('release-tags 3: ship-change has the tag-release row, its report line and its never line', () => {
  const text = skillText('ship-change');
  const row = text.split('\n').find((l) => l.startsWith('| `tag-release` |'));
  assert.ok(row, 'the tag-release row');
  for (const part of ['git fetch origin <next.base>', 'git tag <next.tag> <next.sha>', 'git push origin refs/tags/<next.tag>']) assert.ok(row.includes(part), part);
  for (const part of ['git rev-parse -q --verify refs/tags/<next.tag>', 'stop `blocked: archive (tag-release)', 'never retry it with force', "<git's first error line>"]) assert.ok(row.includes(part), `the row keeps its guard: ${part}`);
  assert.doesNotMatch(row, /git (tag|push)[^`]*(--force|-f\b|--tags|-a\b|-s\b)/, 'no command of the row forces, annotates or pushes every tag');
  const report = text.slice(text.indexOf('## Report'), text.indexOf('## Never'));
  assert.ok(report.includes('A run that pushed a tag adds `tagged <tag> at <short sha>` for each one'), 'the Report sentence');
  const never = text.slice(text.indexOf('## Never'));
  assert.ok(never.includes('- Create a tag except at `tag-release`, or move, delete or force-push one.'), 'the Never line');
});

test('release-tags 3: the devkit skill declares a stopped tag-release as an archive-failed end', () => {
  const bullet = skillText('devkit').split('\n').find((l) => l.startsWith('- `session`:'));
  assert.ok(bullet, 'the session bullet');
  const at = bullet.indexOf('`tag-release`');
  assert.ok(at > 0, 'it names tag-release');
  const sentence = bullet.slice(at);
  assert.ok(sentence.includes('--param why=archive-failed'), sentence);
  assert.ok(sentence.includes("git's first error line"), sentence);
});

// ================================================================ phase 4: documents and configuration (D-7)

const REPO = join(HERE, '..', '..', '..');
const repoText = (...parts) => readFileSync(join(REPO, ...parts), 'utf8');
const ADR_LINK = 'docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md';

test('release-tags 4: CONTRIBUTING and the flow page describe the key and the step', () => {
  const contributing = repoText('CONTRIBUTING.md');
  const step5 = contributing.slice(contributing.indexOf('\n5. Bump the `version`'), contributing.indexOf('## Changing the OpenSpec schemas'));
  assert.ok(step5.length > 0, 'CONTRIBUTING has step 5');
  for (const part of ['release_tag', 'tag-release', ADR_LINK, '`git tag v<x> <merge sha>`', 'lightweight', 'merge commit']) assert.ok(step5.includes(part), `step 5 names ${part}`);

  const flow = repoText('docs', 'openspec-flow.md');
  const section = (from, to) => { const a = flow.indexOf(from); assert.ok(a >= 0, from); const b = flow.indexOf(to, a + from.length); assert.ok(b > a, to); return flow.slice(a, b); };
  const archive = section('### After the merge: the archive steps', '## Shipping a change: ship modes');
  const paragraph = archive.split('\n').find((l) => l.startsWith('**The release tag.**'));
  assert.ok(paragraph, 'the release tag paragraph');
  for (const part of ['release_tag', 'tag-release', 'two-prs', 'git/ref/tags/', 'git/commits/', 'adr/0019-the-delivery-loop-tags-the-release-it-merged.md']) assert.ok(paragraph.includes(part), `the paragraph names ${part}`);
  const rows = archive.split('\n').filter((l) => /^\| (R[123]|P0) \|/.test(l)).map((l) => l.split('|')[1].trim());
  assert.deepEqual(rows, ['R1', 'R2', 'R3', 'P0'], 'rows R1 to R3 sit ahead of P0');
  assert.ok(archive.split('\n').some((l) => /^\| R3 \|.*`tag-release`/.test(l)), 'R3 is the tag-release row');
  assert.ok(archive.split('\n').some((l) => /^\| R2 \|.*`stop-archive`.*archiveStep: tag-release/.test(l)), 'R2 stops the archive at tag-release');

  const shipping = section('## Shipping a change: ship modes', '## CI');
  assert.ok(shipping.split('\n').some((l) => l.startsWith('| `tag-release` |')), 'the merge-mode table has the tag-release row');
  const delivery = flow.split('\n').find((l) => l.startsWith('**Delivery rows.**'));
  assert.ok(delivery.includes('`tag-release`'), 'tag-release joins the main-session steps of conduct-check');
  assert.ok(section('## Troubleshooting', '## Cost').split('\n').some((l) => l.startsWith('| `blocked: archive (tag-release)`')), 'the troubleshooting row');

  const ciAt = flow.indexOf('\n## CI\n');
  const outside = flow.split('\n').map((l, i) => ({ l, at: flow.split('\n').slice(0, i).join('\n').length })).filter(({ l, at }) => pinsIn(l).length > 0 && at < ciAt);
  assert.deepEqual(outside.map(({ l }) => l.slice(0, 80)), [], 'no literal version next to a pin marker outside ## CI');
});

test("release-tags 4: this repository names devkit-openspec's plugin.json as its release file", () => {
  assert.equal(readDevkitSettings(REPO).releaseTag, PLUGIN_JSON);
  const adrs = repoText('openspec', 'config.yaml').split('\n').find((l) => l.trim().startsWith('ADRs:'));
  assert.match(adrs, /0019 the delivery loop tags the release it merged/, 'the ADRs line names 0019');
  const manifest = JSON.parse(repoText(...PLUGIN_JSON.split('/')));
  assert.equal(typeof manifest.version, 'string', 'the release file has a string version');
});
