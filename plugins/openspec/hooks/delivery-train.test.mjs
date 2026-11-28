// delivery-train: reviewed changes leave together on a delivery train (ADR 0022), part 1 of 2 (suite-speed D-11; the other part is delivery-train-after.test.mjs).
// Tests of the setting, the join (`release-merge.mjs --merge`), the roadmap tick, the train record, the train facts, boarding, the bisection, the departure scenarios and the rows of `next`. Run by
// `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs plugins/openspec/hooks/delivery-train.test.mjs`.
// Every scenario runs on real Git in a temporary folder; the env blanks every variable a pull-request run on CI sets. Every test name starts `delivery-train `. What the two parts share is in delivery-train-fixtures.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, statSync, existsSync, utimesSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder, tmpRoot } from './test-tmp.mjs';
import { put, commitAll, roundRepo, simGitHub } from './test-fixtures.mjs';
import { deliveryRow, actorOf, conductState } from './conduct-check.mjs';
import * as guard from './guard.mjs';
import * as deliver from './deliver-check.mjs';
import * as release from './release-merge.mjs';
import * as mergeSetupModule from './merge-setup.mjs';
import { readDevkitSettings, MESSAGES, render, decide, exitCodeOf, gateOf, unfinished } from './change-loop.mjs';
import {
  SET, trainEnv, GIT_ENV, git, SUITE, block, trunkAuto, configRepo, startRun, optedIn, pluginJson, marketplace, entry, CL, H, projectConfig, WORKFLOW,
  PROPOSAL, bodyOf, CHECK, GREEN, PENDING, PARTS, recordText, project, DEFAULT_TASKS, addChange, headOf, launchTrain, boardedOf, SPEC, train, perform,
  depEnv, departIn, nextIn, roadmapOfIds, RELEASE_BASE, bumpFiles, gitOf, showOn, addArchive, SUITE_COUNTER, countRuns, recordOn, noScratch,
  liveTrain, trainLoopFile, endOf,
} from './delivery-train-fixtures.mjs';

const trainOf = (text) => guard.trainSetting(guard.parseDevkitBlock(text));

// ---------------------------------------------------------------- P1 trainSetting

test('delivery-train config: no key and an empty value are no train and no problem', () => {
  for (const text of ['', 'devkit:\n', trunkAuto(), trunkAuto('""'), trunkAuto("''"), trunkAuto(''), 'devkit:\n  delivery:\n    train:\n']) {
    assert.deepEqual(trainOf(text), { suite: null, problem: null }, JSON.stringify(text));
  }
});

test('delivery-train config: a value with trunk or trunk-auto is the whole-suite command', () => {
  for (const model of ['trunk', 'trunk-auto']) {
    assert.deepEqual(trainOf(block(`    model: ${model}\n`, `    train: "${SUITE}"\n`)), { suite: SUITE, problem: null }, model);
  }
});

test('delivery-train config: a value with two-prs is a train-model problem naming the model', () => {
  const text = block('    model: two-prs\n    base: main\n    test_branch: develop\n', `    train: "${SUITE}"\n`);
  assert.deepEqual(trainOf(text), { suite: null, problem: { kind: 'train-model', model: 'two-prs' } });
});

test('delivery-train config: a value with no model, or an unknown one, is a train-model problem with no model', () => {
  assert.deepEqual(trainOf(block('', `    train: "${SUITE}"\n`)), { suite: null, problem: { kind: 'train-model', model: null } });
  assert.deepEqual(trainOf(block('    model: three-prs\n', `    train: "${SUITE}"\n`)), { suite: null, problem: { kind: 'train-model', model: null } });
});

test('delivery-train config: an unclosed double or single quote is refused, never read as the rest of the line', () => {
  for (const quote of ['"', "'"]) {
    const t = trainOf(trunkAuto(`${quote}node --test a.mjs`));
    assert.equal(t.suite, null, quote);
    assert.deepEqual(t.problem, { kind: 'unknown', setting: 'delivery-train', value: 'node --test a.mjs' }, quote);
  }
  assert.deepEqual(trainOf(trunkAuto('"closed" # a comment')), { suite: 'closed', problem: null });
});

test('delivery-train config: a quoted command keeps its && and #, an unquoted one ends at a # comment', () => {
  const quoted = 'node --test a.mjs && python3 b.py # not a comment';
  assert.equal(trainOf(trunkAuto(`"${quoted}"`)).suite, quoted);
  assert.equal(trainOf(trunkAuto(`'${quoted}'`)).suite, quoted);
  assert.equal(trainOf(trunkAuto('node --test a.mjs && python3 b.py # a comment')).suite, 'node --test a.mjs && python3 b.py');
});

test('delivery-train config: a train key nested under another key is not the setting', () => {
  const text = 'devkit:\n  delivery:\n    model: trunk-auto\n  other:\n    train: "x"\n';
  assert.deepEqual(trainOf(text), { suite: null, problem: null });
  assert.deepEqual(trainOf('devkit:\n  train: "x"\n'), { suite: null, problem: null });
  assert.deepEqual(trainOf('train: "x"\n'), { suite: null, problem: null });
});

test('delivery-train config: readTrainSetting reads the file, and no file is no train', () => {
  assert.deepEqual(guard.readTrainSetting(configRepo(trunkAuto(`"${SUITE}"`))), { suite: SUITE, problem: null });
  assert.deepEqual(guard.readTrainSetting(configRepo(null)), { suite: null, problem: null });
  assert.deepEqual(guard.readTrainSetting(configRepo('schema: devkit\n')), { suite: null, problem: null });
});

test('delivery-train config: deliverySettings keeps its shape with a train set', () => {
  const settings = guard.deliverySettings(guard.parseDevkitBlock(trunkAuto(`"${SUITE}"`)));
  assert.deepEqual(settings, { model: 'trunk-auto', base: null, testBranch: null, problems: [] });
});

// ---------------------------------------------------------------- P2 deliveryConfig and projectGate

const configOf = (text, schema = 'devkit') => deliver.deliveryConfig(configRepo(text), schema);

test('delivery-train config: deliveryConfig adds the suite, null without the key', () => {
  assert.equal(configOf(trunkAuto(`"${SUITE}"`)).train, SUITE);
  assert.equal(configOf(block('    model: trunk\n', `    train: "${SUITE}"\n`)).train, SUITE);
  assert.equal(configOf(trunkAuto()).train, null);
  assert.equal(configOf(trunkAuto('""')).train, null);
  assert.equal(configOf('schema: devkit\n').train, null);
});

test('delivery-train config: deliveryConfig refuses the three train problems with their messages', () => {
  const refusal = (text) => {
    try { configOf(text); } catch (e) { assert.ok(e instanceof deliver.ShipConfigError, String(e)); return e; }
    return assert.fail('the setting was accepted');
  };
  const two = block('    model: two-prs\n    base: main\n    test_branch: develop\n', `    train: "${SUITE}"\n`);
  assert.match(refusal(two).message, /^openspec\/config\.yaml: devkit\.delivery\.train: the train runs only with the model trunk or trunk-auto \(two-prs delivers each change through pull requests of its own\)$/);
  assert.match(refusal(block('', `    train: "${SUITE}"\n`)).message, /^openspec\/config\.yaml: devkit\.delivery\.train: needs devkit\.delivery\.model trunk or trunk-auto$/);
  assert.match(refusal(trunkAuto('"node --test')).message, /^openspec\/config\.yaml: devkit\.delivery\.train: "node --test" opens a quote it never closes$/);
});

test('delivery-train config: a refused train setting stops change, roadmap, status and project in both languages', () => {
  const two = optedIn(block('    model: two-prs\n    base: main\n    test_branch: develop\n', `    train: "${SUITE}"\n`));
  const noModel = optedIn(block('', `    train: "${SUITE}"\n`));
  const unclosed = optedIn(trunkAuto('"node --test'));
  const cases = [
    [two, 'train-model', {}],
    [noModel, 'train-no-model', {}],
    [unclosed, 'setting-unknown', { setting: 'delivery-train', value: 'node --test', accepted: 'a command whose quotes are closed' }],
  ];
  for (const [text, key, params] of cases) {
    const root = configRepo(text);
    for (const lang of ['en', 'pt-BR']) {
      for (const verb of ['change', 'roadmap', 'status', 'project']) {
        const { body } = startRun(root, verb === 'change' ? 'change add a thing' : verb, lang);
        assert.equal(body.mode, 'setting-unknown', `${key} ${lang} ${verb}`);
        assert.equal(body.reply, render(lang, key, params), `${key} ${lang} ${verb}`);
      }
    }
  }
  assert.match(render('en', 'train-model'), /delivery train.*trunk/);
  assert.match(render('pt-BR', 'train-model'), /trem de entrega.*trunk/);
  assert.match(render('en', 'train-no-model'), /delivery train.*delivery model/);
  assert.match(render('pt-BR', 'train-no-model'), /trem de entrega.*modelo de entrega/);
  assert.match(render('en', 'setting-unknown', { setting: 'delivery-train', value: 'x', accepted: 'y' }), /unknown delivery train/);
  assert.match(render('pt-BR', 'setting-unknown', { setting: 'delivery-train', value: 'x', accepted: 'y' }), /trem de entrega desconhecido/);
});

test('delivery-train config: an unknown driver is reported before a refused train', () => {
  const text = optedIn(`devkit:\n  driver: robot\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: develop\n    train: "${SUITE}"\n`);
  const { body } = startRun(configRepo(text), 'status');
  assert.equal(body.mode, 'setting-unknown');
  assert.match(body.reply, /driver/);
});

test('delivery-train config: a valid train does not stop the verbs', () => {
  const root = configRepo(optedIn(trunkAuto(`"${SUITE}"`)));
  for (const verb of ['roadmap', 'status', 'project']) {
    assert.equal(startRun(root, verb).body.mode, verb, verb);
  }
});

test('delivery-train config: readDevkitSettings holds the train only when the key is set', () => {
  const withTrain = readDevkitSettings(configRepo(trunkAuto(`"${SUITE}"`)));
  assert.deepEqual(withTrain.train, { suite: SUITE, problem: null });
  assert.deepEqual(withTrain.delivery, { model: 'trunk-auto', base: null, testBranch: null });
  const refused = readDevkitSettings(configRepo(block('    model: two-prs\n    base: main\n    test_branch: develop\n', `    train: "${SUITE}"\n`)));
  assert.deepEqual(refused.train, { suite: null, problem: { kind: 'train-model', model: 'two-prs' } });
  const unclosed = readDevkitSettings(configRepo(trunkAuto('"node --test')));
  assert.deepEqual(unclosed.unknown, [{ setting: 'delivery-train', value: 'node --test', accepted: 'a command whose quotes are closed' }]);
  // neg: without the key the object keeps its shape
  assert.deepEqual(readDevkitSettings(configRepo('devkit:\n  language: en\n')), { driver: 'claude', language: 'en', unknown: [] });
  assert.equal('train' in readDevkitSettings(configRepo(trunkAuto())), false);
  assert.equal('train' in readDevkitSettings(configRepo(trunkAuto('""'))), false);
});

// ---------------------------------------------------------------- the join: release-merge --merge (P6)

const script = join(dirname(fileURLToPath(import.meta.url)), 'release-merge.mjs');

function write(root, files) {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
}
const commit = (root, message) => { git(root, 'add', '-A'); git(root, 'commit', '-q', '--allow-empty', '-m', message); return git(root, 'rev-parse', 'HEAD'); };
const read = (root, f) => readFileSync(join(root, f), 'utf8');
const noMerge = (root) => { try { git(root, 'rev-parse', '-q', '--verify', 'MERGE_HEAD'); return false; } catch { return true; } };

// The files one side's release bump touches: a pack's plugin.json, the marketplace and the CHANGELOG entry.
function bump(root, { packs, metadata, packsAll, title, body = '- change' }) {
  const files = {};
  for (const [name, v] of Object.entries(packs)) files[`plugins/${name}/.claude-plugin/plugin.json`] = pluginJson(name, v);
  files['.claude-plugin/marketplace.json'] = marketplace(metadata, packsAll);
  files['CHANGELOG.md'] = read(root, 'CHANGELOG.md').replace('# Changelog\n\n', `# Changelog\n\n${entry(metadata, title, body)}`);
  write(root, files);
}

const ROADMAP = '# Roadmap\n\n## Round 1\n- [ ] alpha\n- [ ] beta\n- [ ] gamma\n';

// A repository on `train/4` (one commit by the train) and a branch `change` (one commit by the change), both cut from
// the same initial commit. Returns the train's tip, the change's head `rev` and the root, checked out on the train.
function joinRepo({ train = null, change = null, extraTrain = {}, extraChange = {}, initial = {} } = {}) {
  const root = tmpFolder('devkit-train-join-');
  git(root, 'init', '-q', '-b', 'main');
  write(root, {
    'plugins/a/.claude-plugin/plugin.json': pluginJson('a', '0.6.0'),
    'plugins/b/.claude-plugin/plugin.json': pluginJson('b', '0.5.0'),
    '.claude-plugin/marketplace.json': marketplace('0.6.0', { a: '0.6.0', b: '0.5.0' }),
    'CHANGELOG.md': CL(entry('0.6.0', 'first')),
    'README.md': 'readme\n',
    'openspec/roadmap.md': ROADMAP,
    ...initial,
  });
  commit(root, 'initial');
  git(root, 'checkout', '-q', '-b', 'change');
  if (change) bump(root, change);
  write(root, extraChange);
  const rev = commit(root, 'change B');
  git(root, 'checkout', '-q', 'main');
  git(root, 'checkout', '-q', '-b', 'train/4');
  if (train) bump(root, train);
  write(root, extraTrain);
  const tip = commit(root, 'train tip');
  return { root, rev, tip };
}

// The env of a spawned release-merge.mjs: a TMPDIR of its own, made once, outside every fixture repository. The script
// makes a `devkit-pin-*` folder there; in the shared one it would show in release-merge.test.mjs, which compares that
// folder before and after while this file runs in a parallel process. Made here, outside any test, so that no test's
// cleanup removes it under the others; test-tmp.mjs sweeps it on exit.
const ownTmp = tmpFolder('devkit-train-run-tmp-');
const runEnv = () => ({ ...GIT_ENV, TMPDIR: ownTmp });

const run = (root, ...args) => {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', env: runEnv() });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* human output */ }
  return { code: r.status, out, stdout: r.stdout, stderr: r.stderr };
};

test('delivery-train join: a spawned release-merge makes its temporary folders in a folder of its own, never the shared one', () => {
  const own = runEnv().TMPDIR;
  assert.equal(typeof own, 'string');
  assert.notEqual(own, tmpRoot(), 'devkit-pin-* folders would appear in the folder other test files compare');
  assert.ok(statSync(own).isDirectory());
  assert.equal(runEnv().TMPDIR, own, 'one folder for every call');
});

const versionOf = (root, f) => JSON.parse(read(root, f)).version;
const metaOf = (root) => JSON.parse(read(root, '.claude-plugin/marketplace.json')).metadata.version;

const MINOR = { packs: { a: '0.7.0' }, metadata: '0.7.0', packsAll: { a: '0.7.0', b: '0.5.0' } };
const PATCH = { packs: { a: '0.6.1' }, metadata: '0.6.1', packsAll: { a: '0.6.1', b: '0.5.0' } };

test('delivery-train join: a change with no release file merges into the train as one commit with the train message', () => {
  const { root, rev, tip } = joinRepo({ extraTrain: { 'src/a.txt': 'a\n' }, extraChange: { 'src/b.txt': 'b\n' } });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.resolved, true);
  assert.equal(r.out.mode, 'merge');
  assert.deepEqual(r.out.conflicts, []);
  assert.deepEqual(r.out.files, []);
  assert.equal(r.out.oldHead, tip);
  assert.equal(git(root, 'rev-parse', 'HEAD'), r.out.newHead);
  assert.equal(git(root, 'rev-parse', 'HEAD^1'), tip);
  assert.equal(git(root, 'rev-parse', 'HEAD^2'), rev);
  assert.equal(git(root, 'log', '-1', '--format=%s'), `chore(train): join ${rev.slice(0, 7)} and renumber its release above the train`);
  assert.equal(read(root, 'src/a.txt'), 'a\n');
  assert.equal(read(root, 'src/b.txt'), 'b\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('delivery-train join: two identical minor bumps become 0.8.0 above 0.7.0, with the CHANGELOG in order', () => {
  const { root, rev } = joinRepo({
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...MINOR, title: 'mine', body: '- mine' },
  });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.mode, 'merge');
  assert.ok(r.out.conflicts.includes('CHANGELOG.md'), 'the CHANGELOG conflicted and was resolved by rule');
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.8.0');
  assert.equal(versionOf(root, 'plugins/b/.claude-plugin/plugin.json'), '0.5.0');
  assert.equal(metaOf(root), '0.8.0');
  assert.deepEqual(JSON.parse(read(root, '.claude-plugin/marketplace.json')).plugins.map((p) => p.version), ['0.8.0', '0.5.0']);
  const cl = read(root, 'CHANGELOG.md');
  assert.ok(cl.indexOf('## 0.8.0 — mine') < cl.indexOf('## 0.7.0 — theirs') && cl.indexOf('## 0.7.0 — theirs') < cl.indexOf('## 0.6.0 — first'), cl);
  assert.doesNotMatch(cl, /<<<<<<<|>>>>>>>/);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('delivery-train join: a patch of the change above a minor of the train is renumbered above it', () => {
  const { root, rev } = joinRepo({
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...PATCH, title: 'mine', body: '- mine' },
  });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.1');
  assert.equal(metaOf(root), '0.7.1');
  const cl = read(root, 'CHANGELOG.md');
  assert.ok(cl.indexOf('## 0.7.1 — mine') < cl.indexOf('## 0.7.0 — theirs'), cl);
});

// ---- release-merge-manifest-fields: a manifest field only one side edited rides the join (design D-8)

const A_JSON = 'plugins/a/.claude-plugin/plugin.json';
const MARKET_JSON = '.claude-plugin/marketplace.json';
const aPlugin = (version, description, extra = {}) => json({ name: 'a', version, description, ...extra });
const aMarket = (version, description, extra = []) => json({ name: 'devkit', metadata: { description: 'd', version }, plugins: [{ name: 'a', description, version }, { name: 'b', description: 'pack b', version: '0.5.0' }, ...extra] });
const json = (obj) => `${JSON.stringify(obj, null, 2)}\n`;
// A stub of scripts/gen-catalog.py: one `<name>: <description>` line per pack manifest, as the real one reads the descriptions.
const GEN_STUB = "import glob, json\nfrom pathlib import Path\nlines = []\nfor f in sorted(glob.glob('plugins/*/.claude-plugin/plugin.json')):\n    d = json.load(open(f))\n    lines.append(d['name'] + ': ' + d['description'])\nPath('docs').mkdir(exist_ok=True)\nPath('docs/catalog.md').write_text('\\n'.join(lines) + '\\n')\n";

test('release-merge-manifest-fields AC-1 AC-6 the join keeps the head\'s description in both manifests and regenerates the catalog from it', () => {
  const { root, rev } = joinRepo({
    initial: { 'scripts/gen-catalog.py': GEN_STUB },
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...PATCH, title: 'mine', body: '- mine' },
    extraChange: { [A_JSON]: aPlugin('0.6.1', 'a better pack a'), [MARKET_JSON]: aMarket('0.6.1', 'a better pack a') },
  });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.resolved, true);
  const plugin = JSON.parse(git(root, 'show', `HEAD:${A_JSON}`));
  assert.equal(plugin.version, '0.7.1');
  assert.equal(plugin.description, 'a better pack a');
  const entryA = JSON.parse(git(root, 'show', `HEAD:${MARKET_JSON}`)).plugins.find((p) => p.name === 'a');
  assert.equal(entryA.version, '0.7.1');
  assert.equal(entryA.description, 'a better pack a');
  assert.match(git(root, 'show', 'HEAD:docs/catalog.md'), /^a: a better pack a$/m);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-merge-manifest-fields AC-2 the join keeps the train\'s description with the renumbered version', () => {
  const { root, rev } = joinRepo({
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...PATCH, title: 'mine', body: '- mine' },
    extraTrain: { [A_JSON]: aPlugin('0.7.0', 'the train\'s pack a'), [MARKET_JSON]: aMarket('0.7.0', 'the train\'s pack a') },
  });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const plugin = JSON.parse(read(root, A_JSON));
  assert.equal(plugin.version, '0.7.1');
  assert.equal(plugin.description, 'the train\'s pack a');
  assert.equal(JSON.parse(read(root, MARKET_JSON)).plugins.find((p) => p.name === 'a').description, 'the train\'s pack a');
});

test('release-merge-manifest-fields AC-3 the join refuses a description both sides edited to the same value and leaves the train as it was', () => {
  const { root, rev, tip } = joinRepo({
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...PATCH, title: 'mine', body: '- mine' },
    extraTrain: { [A_JSON]: aPlugin('0.7.0', 'same') },
    extraChange: { [A_JSON]: aPlugin('0.6.1', 'same') },
  });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.equal(r.out.resolved, false);
  assert.deepEqual(r.out.conflicts, [A_JSON]);
  assert.ok(r.out.error.startsWith('a manifest field was edited on both sides:'), r.out.error);
  assert.ok(r.out.error.includes(`${A_JSON} (description)`), r.out.error);
  assert.equal(git(root, 'rev-parse', 'HEAD'), tip);
  assert.ok(noMerge(root));
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-merge-manifest-fields AC-4 the join keeps the head\'s description and the train\'s homepage in one plugin.json', () => {
  const { root, rev } = joinRepo({
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...PATCH, title: 'mine', body: '- mine' },
    extraTrain: { [A_JSON]: aPlugin('0.7.0', 'pack a', { homepage: 'https://train.example' }) },
    extraChange: { [A_JSON]: aPlugin('0.6.1', 'the head\'s pack a') },
  });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const plugin = JSON.parse(read(root, A_JSON));
  assert.deepEqual(plugin, { name: 'a', version: '0.7.1', description: 'the head\'s pack a', homepage: 'https://train.example' });
});

test('release-merge-manifest-fields whole entry: the join refuses a pack the head added and keeps a pack the train added', () => {
  const C = { name: 'c', description: 'pack c', version: '0.1.0' };
  const refused = joinRepo({
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...PATCH, title: 'mine', body: '- mine' },
    extraChange: { [MARKET_JSON]: aMarket('0.6.1', 'pack a', [C]) },
  });
  const r1 = run(refused.root, '--merge', refused.rev, '--json');
  assert.equal(r1.code, 2, r1.stderr + r1.stdout);
  assert.ok(r1.out.error.startsWith(`a manifest was edited beyond its version: ${MARKET_JSON} (plugins[c])`), r1.out.error);
  assert.equal(git(refused.root, 'rev-parse', 'HEAD'), refused.tip);
  assert.ok(noMerge(refused.root));

  const kept = joinRepo({
    train: { ...MINOR, title: 'theirs', body: '- theirs' },
    change: { ...PATCH, title: 'mine', body: '- mine' },
    extraTrain: { [MARKET_JSON]: aMarket('0.7.0', 'pack a', [C]) },
    extraChange: { [A_JSON]: aPlugin('0.6.1', 'the head\'s pack a'), [MARKET_JSON]: aMarket('0.6.1', 'the head\'s pack a') },
  });
  const r2 = run(kept.root, '--merge', kept.rev, '--json');
  assert.equal(r2.code, 0, r2.stderr + r2.stdout);
  const market = JSON.parse(read(kept.root, MARKET_JSON));
  assert.deepEqual(market.plugins.map((p) => p.name), ['a', 'b', 'c']);
  assert.equal(market.plugins.find((p) => p.name === 'a').description, 'the head\'s pack a');
  assert.equal(market.plugins.find((p) => p.name === 'a').version, '0.7.1');
  assert.equal(JSON.parse(read(kept.root, A_JSON)).description, 'the head\'s pack a');
});

test('delivery-train join: a product conflict exits 2 with the path and leaves the train as it was', () => {
  const { root, rev, tip } = joinRepo({
    train: { ...MINOR, title: 'theirs' }, change: { ...PATCH, title: 'mine' },
    extraTrain: { 'README.md': 'train\n' }, extraChange: { 'README.md': 'change\n' },
  });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.equal(r.out.resolved, false);
  assert.equal(r.out.mode, 'merge');
  assert.ok(r.out.conflicts.includes('README.md'));
  assert.equal(git(root, 'rev-parse', 'HEAD'), tip);
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.ok(noMerge(root));
});

// A doc shaped like docs/openspec-flow.md around its CI pin: three unchanged lines separate the pin from each slot.
const pinDoc = (version, { top = null, bottom = null } = {}) => [
  '# Flow', '', ...(top === null ? [] : [top, '']),
  'intro 1', 'intro 2', 'intro 3', 'intro 4', '',
  '## CI', '',
  `          # pinned to the commit of v${version} (a tag can move; a commit cannot)`,
  '', 'ci 1', 'ci 2', 'ci 3', '',
  '## Notes', 'note 1', 'note 2', 'note 3', 'note 4', ...(bottom === null ? [] : ['', bottom]), '',
].join('\n');

test('delivery-train join: the CI pin of both sides is merged and set to the renumbered devkit-openspec version', () => {
  const pack = (version) => ({ [release.PIN_PACK]: pluginJson(release.PIN_PACK_NAME, version) });
  const market = (meta, version) => marketplace(meta, { a: '0.6.0', b: '0.5.0', [release.PIN_PACK_NAME]: version });
  const initial = { ...pack('0.10.0'), [release.PIN_FILE]: pinDoc('0.10.0'), '.claude-plugin/marketplace.json': market('0.6.0', '0.10.0') };
  const side = (meta, version, title, doc) => ({
    ...pack(version), [release.PIN_FILE]: doc, '.claude-plugin/marketplace.json': market(meta, version),
    'CHANGELOG.md': CL(entry(meta, title), entry('0.6.0', 'first')),
  });
  const { root, rev } = joinRepo({ initial, extraTrain: side('0.7.0', '0.11.0', 'theirs', pinDoc('0.11.0', { top: 'TOP A' })), extraChange: side('0.6.1', '0.10.1', 'mine', pinDoc('0.10.1', { bottom: 'BOTTOM B' })) });
  const r = run(root, '--merge', rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.ok(r.out.conflicts.includes(release.PIN_FILE));
  assert.equal(versionOf(root, release.PIN_PACK), '0.11.1');
  const doc = read(root, release.PIN_FILE);
  assert.match(doc, /TOP A/);
  assert.match(doc, /BOTTOM B/);
  assert.deepEqual([...new Set(doc.match(/v\d+\.\d+\.\d+/g))], ['v0.11.1']);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('delivery-train join: a revision already in the train is nothing to do', () => {
  const { root, rev, tip } = joinRepo({ extraTrain: { 'src/a.txt': 'a\n' } });
  assert.equal(run(root, '--merge', rev, '--json').code, 0);
  const head = git(root, 'rev-parse', 'HEAD');
  assert.notEqual(head, tip);
  const again = run(root, '--merge', rev, '--json');
  assert.equal(again.code, 0, again.stderr + again.stdout);
  assert.equal(again.out.resolved, true);
  assert.equal(again.out.mode, 'merge');
  assert.equal(again.out.oldHead, head);
  assert.equal(again.out.newHead, head);
  assert.equal(git(root, 'rev-parse', 'HEAD'), head);
});

test('delivery-train join: a missing revision, both modes together and a lone --roadmap-ticks are setup errors', () => {
  const { root, rev } = joinRepo();
  const missing = run(root, '--merge', 'no-such-rev');
  assert.equal(missing.code, 3);
  assert.match(missing.stderr, /no-such-rev/);
  assert.equal(run(root, '--merge', rev, '--base', 'main').code, 3);
  assert.equal(run(root, '--roadmap-ticks').code, 3);
  assert.equal(run(root, '--merge').code, 3);
});

// ---------------------------------------------------------------- release-at-merge: the join of a noted head (D-7)
// A boarded head that carries openspec/changes/<id>/release.md is numbered from its note above the train's tip; a head with none
// joins as before (AC-10).

const releaseConfig = (file) => `schema: devkit-lite\ndevkit:\n  release_tag: ${file}\n`;
const noteOf = (id, pack = 'a', kind = 'minor') => `packs:\n- ${pack}: ${kind}\n\n## ${id}\n\n- **${pack}**: ${id}\n`;
// A change's ADR named without a number, listed in its decisions.md, cited in its design and in docs/<id>.md.
const unnumberedAdr = (id) => ({
  [`openspec/changes/${id}/decisions.md`]: `# Decisions\n\n- ADR: \`docs/adr/${id}.md\`\n`,
  [`openspec/changes/${id}/design.md`]: `See ADR [${id}].\n`,
  [`docs/adr/${id}.md`]: `# ADR [${id}]: ${id}\n`,
  [`docs/${id}.md`]: `See ADR [${id}] (adr/${id}.md).\n`,
});
// main holding the release lines of packs a and b, `config` and `initial`; each of `changes` a branch cut from main with its files;
// then train/4 cut from main, checked out. Returns the root and the head of each change.
function notedJoinRepo(changes, { initial = {}, config = releaseConfig('plugins/a/.claude-plugin/plugin.json') } = {}) {
  const root = tmpFolder('devkit-train-noted-');
  git(root, 'init', '-q', '-b', 'main');
  write(root, { 'openspec/config.yaml': config, ...RELEASE_BASE, 'README.md': 'readme\n', ...initial });
  commit(root, 'initial');
  const heads = {};
  for (const [id, files] of Object.entries(changes)) {
    git(root, 'checkout', '-q', '-b', id, 'main');
    write(root, { [`openspec/changes/${id}/proposal.md`]: '# Proposal\n', ...files });
    heads[id] = commit(root, `change ${id}`);
  }
  git(root, 'checkout', '-q', '-b', 'train/4', 'main');
  return { root, heads };
}
const joinMessage = (rev) => `chore(train): join ${rev.slice(0, 7)} and renumber its release above the train`;
const headsKept = (root, heads) => { for (const [id, h] of Object.entries(heads)) assert.equal(git(root, 'rev-parse', id), h, `${id}'s branch is unchanged`); };

test('release-note AC-3 join: two noted heads bumping the same pack join with no conflict, the first boarded takes the next version and the second the one after', () => {
  const op = release.PIN_PACK_NAME;
  const initial = {
    [release.PIN_PACK]: pluginJson(op, '0.29.0'),
    '.claude-plugin/marketplace.json': marketplace('0.29.0', { a: '0.6.0', b: '0.5.0', [op]: '0.29.0' }),
    'CHANGELOG.md': CL(entry('0.29.0', 'first')),
    [release.PIN_FILE]: pinDoc('0.29.0'),
    'docs/catalog.md': 'catalog\n',
    'scripts/gen-catalog.py': "from pathlib import Path\nimport json\nv = json.loads(Path('.claude-plugin/marketplace.json').read_text())['metadata']['version']\nPath('docs/catalog.md').write_text(f'catalog {v}\\n')\n",
  };
  const { root, heads } = notedJoinRepo({ alpha: { 'openspec/changes/alpha/release.md': noteOf('alpha', op) }, beta: { 'openspec/changes/beta/release.md': noteOf('beta', op) } }, { initial, config: releaseConfig(release.PIN_PACK) });
  const first = run(root, '--merge', heads.alpha, '--json');
  assert.equal(first.code, 0, first.stderr + first.stdout);
  assert.equal(versionOf(root, release.PIN_PACK), '0.30.0');
  const second = run(root, '--merge', heads.beta, '--json');
  assert.equal(second.code, 0, second.stderr + second.stdout);
  assert.equal(second.out.mode, 'merge');
  assert.deepEqual(second.out.conflicts, [], 'neither head touched a release line, so nothing conflicted');
  assert.equal(git(root, 'log', '-1', '--format=%s'), joinMessage(heads.beta));
  assert.equal(git(root, 'rev-parse', 'HEAD^2'), heads.beta);
  assert.equal(versionOf(root, release.PIN_PACK), '0.31.0');
  assert.equal(metaOf(root), '0.31.0');
  assert.deepEqual(JSON.parse(read(root, '.claude-plugin/marketplace.json')).plugins.map((p) => [p.name, p.version]), [['a', '0.6.0'], ['b', '0.5.0'], [op, '0.31.0']]);
  assert.equal(read(root, 'CHANGELOG.md'), `# Changelog\n\n## 0.31.0 — beta\n\n- **${op}** 0.31.0: beta\n\n## 0.30.0 — alpha\n\n- **${op}** 0.30.0: alpha\n\n## 0.29.0 — first\n\n- x\n`);
  assert.deepEqual([...new Set(read(root, release.PIN_FILE).match(/v\d+\.\d+\.\d+/g))], ['v0.31.0']);
  assert.equal(read(root, 'docs/catalog.md'), 'catalog 0.31.0\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
  headsKept(root, heads);
});

test('release-note AC-3 join: two unnumbered ADRs take the next numbers on the train in boarding order, their citations follow and the change folders do not change', () => {
  const { root, heads } = notedJoinRepo({
    alpha: { 'openspec/changes/alpha/release.md': 'packs: []\n', ...unnumberedAdr('alpha') },
    beta: { 'openspec/changes/beta/release.md': 'packs: []\n', ...unnumberedAdr('beta') },
  }, { initial: { 'docs/adr/0026-base.md': '# ADR 0026: base\n' } });
  const tip = git(root, 'rev-parse', 'HEAD');
  for (const id of ['alpha', 'beta']) {
    const r = run(root, '--merge', heads[id], '--json');
    assert.equal(r.code, 0, r.stderr + r.stdout);
  }
  assert.equal(read(root, 'docs/adr/0027-alpha.md'), '# ADR 0027: alpha\n');
  assert.equal(read(root, 'docs/adr/0028-beta.md'), '# ADR 0028: beta\n');
  assert.ok(!existsSync(join(root, 'docs/adr/alpha.md')) && !existsSync(join(root, 'docs/adr/beta.md')));
  assert.equal(read(root, 'docs/alpha.md'), 'See ADR 0027 (adr/0027-alpha.md).\n');
  assert.equal(read(root, 'docs/beta.md'), 'See ADR 0028 (adr/0028-beta.md).\n');
  assert.equal(read(root, 'openspec/changes/alpha/design.md'), 'See ADR [alpha].\n');
  for (const id of ['alpha', 'beta']) {
    assert.equal(git(root, 'diff', '--name-only', heads[id], 'HEAD', '--', `openspec/changes/${id}`), '', `openspec/changes/${id}/ is as the change wrote it`);
  }
  assert.equal(git(root, 'diff', '--name-only', tip, 'HEAD', '--', 'docs/adr/0026-base.md', 'README.md'), '');
  headsKept(root, heads);
});

test('release-note AC-10 join: a noted head and an old-rule head on one train, in both orders, are numbered from the note and by the kind of the old one\'s bump', () => {
  const changes = { alpha: { 'openspec/changes/alpha/release.md': noteOf('alpha') }, beta: bumpFiles('0.6.1', 'beta') };
  const noted = notedJoinRepo(changes);
  for (const id of ['alpha', 'beta']) assert.equal(run(noted.root, '--merge', noted.heads[id], '--json').code, 0, id);
  assert.equal(versionOf(noted.root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.1', 'the old head\'s patch above the note\'s minor');
  assert.equal(metaOf(noted.root), '0.7.1');
  const cl = read(noted.root, 'CHANGELOG.md');
  assert.ok(cl.indexOf('## 0.7.1 — beta') >= 0 && cl.indexOf('## 0.7.1 — beta') < cl.indexOf('## 0.7.0 — alpha') && cl.indexOf('## 0.7.0 — alpha') < cl.indexOf('## 0.6.0 — first'), cl);
  assert.equal(git(noted.root, 'log', '-1', '--format=%s'), joinMessage(noted.heads.beta));

  const old = notedJoinRepo(changes);
  for (const id of ['beta', 'alpha']) assert.equal(run(old.root, '--merge', old.heads[id], '--json').code, 0, id);
  assert.equal(versionOf(old.root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.0', 'the note\'s minor above the old head\'s patch');
  assert.equal(metaOf(old.root), '0.7.0');
  const cl2 = read(old.root, 'CHANGELOG.md');
  assert.ok(cl2.indexOf('## 0.7.0 — alpha') >= 0 && cl2.indexOf('## 0.7.0 — alpha') < cl2.indexOf('## 0.6.1 — beta') && cl2.indexOf('## 0.6.1 — beta') < cl2.indexOf('## 0.6.0 — first'), cl2);
  assert.match(cl2, /- \*\*a\*\* 0\.7\.0: alpha/);
  assert.equal(git(old.root, 'status', '--porcelain'), '');
});

// Review round 1 (test-coverage nit F8): with no devkit.release_tag no note rule applies (AC-9), so a head that carries release.md and bumps
// by hand is renumbered by the kind of its own bump, its note is not read and its unnumbered ADR is left as it is.
test('release-note AC-9 join: with no devkit.release_tag a head carrying release.md joins by the old rule', () => {
  const { root, heads } = notedJoinRepo({
    alpha: bumpFiles('0.7.0', 'alpha'),
    beta: { ...bumpFiles('0.6.1', 'beta'), 'openspec/changes/beta/release.md': noteOf('beta', 'a', 'major'), ...unnumberedAdr('beta') },
  }, { config: 'schema: devkit-lite\n' });
  assert.equal(run(root, '--merge', heads.alpha, '--json').code, 0);
  const r = run(root, '--merge', heads.beta, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(r.out.mode, 'merge');
  assert.equal('change' in r.out, false, 'no noted change is named: the old rule ran');
  assert.equal('adrs' in r.out, false);
  assert.equal(git(root, 'log', '-1', '--format=%s'), joinMessage(heads.beta));
  assert.equal(versionOf(root, 'plugins/a/.claude-plugin/plugin.json'), '0.7.1', 'beta\'s own patch above the train\'s 0.7.0, not the note\'s major');
  assert.equal(metaOf(root), '0.7.1');
  const cl = read(root, 'CHANGELOG.md');
  assert.ok(cl.indexOf('## 0.7.1 — beta') >= 0 && cl.indexOf('## 0.7.1 — beta') < cl.indexOf('## 0.7.0 — alpha'), cl);
  assert.equal(read(root, 'docs/adr/beta.md'), '# ADR [beta]: beta\n', 'the ADR keeps its unnumbered name');
  assert.equal(read(root, 'docs/beta.md'), 'See ADR [beta] (adr/beta.md).\n');
  assert.equal(git(root, 'status', '--porcelain'), '');
  headsKept(root, heads);
});

test('release-note AC-7 join: a citation of an ADR neither the base nor an earlier join numbered exits 2 naming the slug and leaves the train as it was', () => {
  const { root, heads } = notedJoinRepo({ beta: { 'openspec/changes/beta/release.md': noteOf('beta'), 'docs/beta.md': 'Amends ADR [gamma].\n' } });
  const tip = git(root, 'rev-parse', 'HEAD');
  const r = run(root, '--merge', heads.beta, '--json');
  assert.equal(r.code, 2, r.stderr + r.stdout);
  assert.equal(r.out.resolved, false);
  assert.equal(r.out.mode, 'merge');
  assert.match(r.out.error, /ADR \[gamma\] is cited but has not landed/);
  assert.deepEqual(r.out.conflicts, [], 'no path: the train takes the error as the reason the change left');
  assert.equal(git(root, 'rev-parse', 'HEAD'), tip);
  assert.ok(noMerge(root));
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release-note AC-7 join: a citation of an ADR an earlier join of the train numbered is rewritten to that number', () => {
  const { root, heads } = notedJoinRepo({
    alpha: { 'openspec/changes/alpha/release.md': 'packs: []\n', ...unnumberedAdr('alpha') },
    beta: { 'openspec/changes/beta/release.md': 'packs: []\n', 'docs/beta.md': 'Amends ADR [alpha].\n' },
  });
  for (const id of ['alpha', 'beta']) assert.equal(run(root, '--merge', heads[id], '--json').code, 0, id);
  assert.equal(read(root, 'docs/beta.md'), 'Amends ADR 0001.\n');
});

// Found by the dogfood (task 8.1): a citation never lives in a test file or a fixture (D-18), so the join neither gives back nor renumbers an
// `ADR <NNNN>` or `ADR [<x>]` literal in a test file or a fixture.
test('release-note AC-7 join: a head numbered before the train is renumbered in its Markdown citations, and its test-file literals stay as written', () => {
  const src = "const a = 'ADR 0001';\nconst b = 'ADR [beta] in docs/adr/beta.md';\n";
  const { root, heads } = notedJoinRepo({
    alpha: { 'openspec/changes/alpha/release.md': 'packs: []\n', ...unnumberedAdr('alpha') },
    beta: {
      'openspec/changes/beta/release.md': 'packs: []\n',
      'openspec/changes/beta/decisions.md': '# Decisions\n\n- ADR: `docs/adr/beta.md`\n',
      'docs/adr/0001-beta.md': '# ADR 0001: beta\n',
      'docs/beta.md': 'See ADR 0001 (adr/0001-beta.md).\n',
      'src/beta.test.mjs': src,
    },
  });
  for (const id of ['alpha', 'beta']) {
    const r = run(root, '--merge', heads[id], '--json');
    assert.equal(r.code, 0, `${id}: ${r.stderr}${r.stdout}`);
  }
  assert.equal(read(root, 'docs/adr/0002-beta.md'), '# ADR 0002: beta\n');
  assert.equal(read(root, 'docs/beta.md'), 'See ADR 0002 (adr/0002-beta.md).\n');
  assert.equal(read(root, 'src/beta.test.mjs'), src);
});

// Review round 1 (adr-reviewer F1, D-18): a source file holds citations as a Markdown file does, so the join gives its numbers back and
// renumbers them; a binary file holds none and keeps its bytes.
test('release-note AC-7 join: a source file\'s citation of a head numbered before the train is given back and renumbered', () => {
  const blob = Buffer.concat([Buffer.from('ADR 0001 (docs/adr/0001-beta.md)'), Buffer.from([0, 1, 2, 255])]);
  const { root, heads } = notedJoinRepo({
    alpha: { 'openspec/changes/alpha/release.md': 'packs: []\n', ...unnumberedAdr('alpha') },
    beta: {
      'openspec/changes/beta/release.md': 'packs: []\n',
      'openspec/changes/beta/decisions.md': '# Decisions\n\n- ADR: `docs/adr/beta.md`\n',
      'docs/adr/0001-beta.md': '# ADR 0001: beta\n',
      'src/beta.mjs': '// the rule of ADR 0001 (docs/adr/0001-beta.md)\n',
      'assets/beta.bin': blob,
    },
  });
  for (const id of ['alpha', 'beta']) {
    const r = run(root, '--merge', heads[id], '--json');
    assert.equal(r.code, 0, `${id}: ${r.stderr}${r.stdout}`);
  }
  assert.equal(read(root, 'docs/adr/0002-beta.md'), '# ADR 0002: beta\n');
  assert.equal(read(root, 'src/beta.mjs'), '// the rule of ADR 0002 (docs/adr/0002-beta.md)\n');
  assert.deepEqual(readFileSync(join(root, 'assets/beta.bin')), blob);
});

// ---------------------------------------------------------------- the roadmap tick (P7)

test('delivery-train roadmap: two neighbouring ticks of the change are written onto the base', () => {
  const mergeBase = '# R\n- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n';
  const change = '# R\n- [x] a\n- [x] b\n- [ ] c\n- [ ] d\n';
  const base = '# R\n- [ ] a\n- [ ] b\n- [x] c\n- [ ] d\n- [ ] e\n';
  assert.equal(release.resolveRoadmapTicks({ mergeBase, change, base }), '# R\n- [x] a\n- [x] b\n- [x] c\n- [ ] d\n- [ ] e\n');
});

test('delivery-train roadmap: a tick of a line the base already ticked changes nothing', () => {
  const mergeBase = '- [ ] a\n- [ ] b\n';
  const change = '- [x] a\n- [ ] b\n';
  const base = '- [x] a\n- [x] b\n';
  assert.equal(release.resolveRoadmapTicks({ mergeBase, change, base }), base);
});

test('delivery-train roadmap: a reworded, added, removed, unticked or unknown line throws', () => {
  const mergeBase = '- [ ] a\n- [ ] b\n';
  const base = '- [ ] a\n- [ ] b\n';
  const throws = (change, baseText = base) => assert.throws(() => release.resolveRoadmapTicks({ mergeBase, change, base: baseText }), { name: 'ReleaseError' }, change);
  throws('- [x] a renamed\n- [ ] b\n');
  throws('- [x] a\n- [ ] b\n- [ ] c\n');
  throws('- [x] a\n');
  throws('- [ ] a\n- [x] b\n', '- [ ] a\n');
  throws('- [x] a\n- [ ] b\n', '- [ ] b\n');
  assert.throws(() => release.resolveRoadmapTicks({ mergeBase: '- [x] a\n', change: '- [ ] a\n', base: '- [x] a\n' }), { name: 'ReleaseError' }, 'an untick');
});

test('delivery-train roadmap: a missing final newline is kept as the base has it', () => {
  const mergeBase = '- [ ] a\n- [ ] b';
  const change = '- [x] a\n- [ ] b';
  assert.equal(release.resolveRoadmapTicks({ mergeBase, change, base: '- [ ] a\n- [ ] b' }), '- [x] a\n- [ ] b');
  assert.equal(release.resolveRoadmapTicks({ mergeBase, change, base: '- [ ] a\n- [ ] b\n' }), '- [x] a\n- [ ] b\n');
});

const stagesOf = (mergeBase, theirs, ours) => () => ({ base: mergeBase, ours, theirs });

test('delivery-train roadmap: classifyConflict resolves a tick conflict only with the resolver, and returns roadmapMerged', () => {
  const mergeBase = '- [ ] a\n- [ ] b\n';
  const stages = stagesOf(mergeBase, '- [ ] a\n- [x] b\n', '- [x] a\n- [ ] b\n');
  const none = release.classifyConflict(['openspec/roadmap.md'], stages);
  assert.deepEqual(none, { blocking: ['openspec/roadmap.md'], pinMerged: null });
  assert.equal(none.roadmapMerged, null, 'without a resolver the field is null');
  const resolved = release.classifyConflict(['openspec/roadmap.md'], stages, { roadmap: release.resolveRoadmapTicks });
  assert.deepEqual(resolved.blocking, []);
  assert.equal(resolved.roadmapMerged, '- [x] a\n- [x] b\n');
  const reworded = release.classifyConflict(['openspec/roadmap.md'], stagesOf(mergeBase, '- [ ] a\n- [x] b!\n', '- [x] a\n- [ ] b\n'), { roadmap: release.resolveRoadmapTicks });
  assert.deepEqual(reworded.blocking, ['openspec/roadmap.md']);
  assert.equal(reworded.roadmapMerged, null);
});

const ticks = (a, b) => `# Roadmap\n\n## Round 1\n- [${a}] alpha\n- [${b}] beta\n- [ ] gamma\n`;

test('delivery-train roadmap: --merge resolves a tick conflict by rule and a reworded line is blocking', () => {
  const ok = joinRepo({ extraTrain: { 'openspec/roadmap.md': ticks('x', ' ') }, extraChange: { 'openspec/roadmap.md': ticks(' ', 'x') } });
  const r = run(ok.root, '--merge', ok.rev, '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.ok(r.out.conflicts.includes('openspec/roadmap.md'));
  assert.equal(read(ok.root, 'openspec/roadmap.md'), ticks('x', 'x'));
  assert.equal(git(ok.root, 'status', '--porcelain'), '');

  const bad = joinRepo({ extraTrain: { 'openspec/roadmap.md': ticks('x', ' ') }, extraChange: { 'openspec/roadmap.md': ticks(' ', 'x').replace('beta', 'beta renamed') } });
  const tip = git(bad.root, 'rev-parse', 'HEAD');
  const refused = run(bad.root, '--merge', bad.rev, '--json');
  assert.equal(refused.code, 2, refused.stderr + refused.stdout);
  assert.ok(refused.out.conflicts.includes('openspec/roadmap.md'));
  assert.equal(git(bad.root, 'rev-parse', 'HEAD'), tip);
  assert.ok(noMerge(bad.root));
});

// `change` is the branch under work and origin/main the train's tip, the orientation of --base.
function baseRepo() {
  const { root, tip, rev } = joinRepo({ extraTrain: { 'openspec/roadmap.md': ticks('x', ' ') }, extraChange: { 'openspec/roadmap.md': ticks(' ', 'x') } });
  git(root, 'update-ref', 'refs/remotes/origin/main', tip);
  git(root, 'checkout', '-q', 'change');
  return { root, rev, tip };
}

test('delivery-train roadmap: --base resolves a tick conflict only under --roadmap-ticks, and exits 2 without it', () => {
  const without = baseRepo();
  const head = git(without.root, 'rev-parse', 'HEAD');
  const refused = run(without.root, '--base', 'main', '--json');
  assert.equal(refused.code, 2, refused.stderr + refused.stdout);
  assert.deepEqual(refused.out.conflicts, ['openspec/roadmap.md']);
  assert.equal(git(without.root, 'rev-parse', 'HEAD'), head);
  assert.ok(noMerge(without.root));

  const flagged = baseRepo();
  const r = run(flagged.root, '--base', 'main', '--roadmap-ticks', '--json');
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(read(flagged.root, 'openspec/roadmap.md'), ticks('x', 'x'));
  assert.equal(git(flagged.root, 'rev-parse', 'HEAD^2'), flagged.tip);
  assert.equal(git(flagged.root, 'log', '-1', '--format=%s'), 'chore(release): merge origin/main and renumber the release above it');
  assert.equal('mode' in r.out, false, '--base keeps its JSON');
});

test('delivery-train roadmap: --base keeps its resolved JSON keys as they are', () => {
  const { root } = baseRepo();
  const r = run(root, '--base', 'main', '--roadmap-ticks', '--json');
  assert.deepEqual(Object.keys(r.out), ['resolved', 'oldHead', 'newHead', 'versions', 'files']);
});

// kept so the render helper and the message table are exercised by name in this suite
test('delivery-train config: both languages carry the same train keys', () => {
  for (const key of ['train-model', 'train-no-model', 'setting.delivery-train']) {
    assert.ok(MESSAGES.en[key] && MESSAGES['pt-BR'][key], key);
  }
});

// ---------------------------------------------------------------- P5 parseTrainRecord

test('delivery-train record: a full record parses into its facts, its tables and the failure of a red change', () => {
  const text = recordText({
    boarded: [{ id: 'alpha', number: 81, head: H('1') }, { kind: 'archive', id: 'gamma', number: 85, head: H('2'), at: '2026-11-23T10:05:00Z' }],
    left: [{ id: 'beta', number: 83, head: H('3'), why: 'conflict', detail: '`plugins/x/hooks/a.mjs`' }, { id: 'delta', number: 84, head: H('4'), why: 'red' }],
    runs: [{ changes: 'alpha, gamma, delta', head: H('5'), result: 'failed' }],
    failures: { delta: 'not ok 1 - delta\n## Boarded\n| 9 | nope |' },
  });
  assert.deepEqual(deliver.parseTrainRecord(text), {
    n: 4, base: 'main', result: 'passed', baseSha: H('a'), suite: SUITE, ranAt: H('b'),
    boarded: [
      { order: 1, kind: 'change', id: 'alpha', number: 81, head: H('1'), at: '2026-11-23T10:00:00Z' },
      { order: 2, kind: 'archive', id: 'gamma', number: 85, head: H('2'), at: '2026-11-23T10:05:00Z' },
    ],
    left: [
      { kind: 'change', id: 'beta', number: 83, head: H('3'), why: 'conflict', detail: '`plugins/x/hooks/a.mjs`', failure: null },
      { kind: 'change', id: 'delta', number: 84, head: H('4'), why: 'red', detail: 'Failure of `delta`, below', failure: 'not ok 1 - delta\n## Boarded\n| 9 | nope |' },
    ],
  });
});

test('delivery-train record: a record with no left entries has an empty left list', () => {
  const r = deliver.parseTrainRecord(recordText({ boarded: [{ id: 'alpha', number: 81, head: H('1') }] }));
  assert.deepEqual(r.left, []);
  assert.equal(r.boarded.length, 1);
});

test('delivery-train record: an empty file, a missing header and a wrong header are errors', () => {
  assert.match(deliver.parseTrainRecord('').error, /empty/);
  assert.match(deliver.parseTrainRecord('\n\n').error, /empty/);
  assert.match(deliver.parseTrainRecord('# Train 4\n').error, /devkit-train/);
  assert.match(deliver.parseTrainRecord(recordText({ boarded: [{ id: 'a', number: 1, head: H('1') }] }).replace('devkit-train', 'devkit-other')).error, /devkit-train/);
});

test('delivery-train record: a fence that opens and never closes is an error', () => {
  const text = `${recordText({ boarded: [{ id: 'a', number: 1, head: H('1') }] })}\n## Failure of \`a\`\n\n\`\`\`text\nnever closed\n`;
  assert.match(deliver.parseTrainRecord(text).error, /fence/);
});

test('delivery-train record: no Boarded table, or an empty one, is an error', () => {
  assert.match(deliver.parseTrainRecord('<!-- devkit-train n=4 base=main result=passed -->\n# Train 4\n\n- Result: passed\n').error, /Boarded/);
  assert.match(deliver.parseTrainRecord(recordText({ boarded: [] })).error, /Boarded/);
});

test('delivery-train record: a bad head, kind, order or why is an error naming it', () => {
  const ok = recordText({ boarded: [{ id: 'a', number: 1, head: H('1') }, { id: 'b', number: 2, head: H('2') }], left: [{ id: 'c', number: 3, head: H('3'), why: 'conflict' }] });
  assert.equal(deliver.parseTrainRecord(ok).error, undefined);
  assert.match(deliver.parseTrainRecord(ok.replace(H('1'), 'abc123')).error, /head/);
  assert.match(deliver.parseTrainRecord(ok.replace('| change | `a`', '| feature | `a`')).error, /kind/);
  assert.match(deliver.parseTrainRecord(ok.replace('| 2 | change |', '| 3 | change |')).error, /order/);
  assert.match(deliver.parseTrainRecord(ok.replace('| conflict |', '| broken |')).error, /why/);
});

// ---------------------------------------------------------------- P3 boarding: the rows of a change

test('delivery-train P3 T9: a change with all its items met boards, in trunk-auto and in trunk', () => {
  for (const model of ['trunk-auto', 'trunk']) {
    const p = project({ model });
    addChange(p, 'feat');
    const state = p.state('feat');
    const next = deliver.nextStep(state);
    assert.equal(next.step, 'boarded', model);
    assert.equal(state.train.suite, SUITE, model);
    assert.deepEqual(state.train.parts, PARTS, model);
    assert.equal(state.train.kind, 'change');
    assert.deepEqual([state.train.onTrain, state.train.carried, state.train.left], [null, null, null], model);
  }
});

test('delivery-train P3 T1: auto-merge found on a change of a train project is disabled first, in trunk-auto and in trunk', () => {
  for (const model of ['trunk-auto', 'trunk']) {
    const p = project({ model });
    const { number } = addChange(p, 'feat');
    p.sim.setAutoMerge(number, 'squash');
    const next = p.next('feat');
    assert.deepEqual([next.step, next.number], ['disable-auto-merge', number], model);
    p.sim.setAutoMerge(number, null);
    assert.equal(p.next('feat').step, 'boarded', model);
  }
});

test('delivery-train P3 T1: auto-merge on disables even before the contract is met', () => {
  const p = project();
  const { number, wt } = addChange(p, 'feat');
  p.sim.setAutoMerge(number, 'merge');
  put(wt, { 'src/feat.txt': 'changed\n' });
  commitAll(wt, 'code after evidence');
  assert.equal(p.next('feat').step, 'disable-auto-merge');
});

test('delivery-train P3 T9: a change of a train project is never told to enable auto-merge, update its branch or wait for a merge', () => {
  for (const model of ['trunk-auto', 'trunk']) {
    const p = project({ model });
    const { number } = addChange(p, 'feat');
    const seen = [];
    for (const mutate of [() => {}, () => p.sim.setChecks(number, PENDING), () => p.sim.setPr(number, { mergeStateStatus: 'BEHIND' }), () => p.sim.setPr(number, { mergeable: 'CONFLICTING' })]) {
      mutate();
      seen.push(p.next('feat').step);
    }
    assert.deepEqual(seen, ['boarded', 'boarded', 'boarded', 'boarded'], model);
  }
});

test('delivery-train P3 T4: a change with no pull request opens one, as before the train', () => {
  const p = project();
  addChange(p, 'feat', { pr: false });
  assert.equal(p.next('feat').step, 'open-pr');
});

test('delivery-train P3 T5: pending checks board', () => {
  const p = project();
  const { number } = addChange(p, 'feat');
  p.sim.setChecks(number, PENDING);
  assert.equal(p.next('feat').step, 'boarded');
});

test('delivery-train P3 T5: a failing check does not board, and the next step fixes it', () => {
  const p = project();
  const { number } = addChange(p, 'feat');
  p.sim.setChecks(number, [CHECK('check', 'fail'), CHECK('devkit-reviews', 'pass')]);
  const next = p.next('feat');
  assert.equal(next.step, 'fix-checks');
  assert.deepEqual(next.failing.map((f) => f.name), ['check']);
});

test('delivery-train P3 T5: a pull request behind the base boards, and one in conflict with it boards too', () => {
  const p = project();
  const { number } = addChange(p, 'feat');
  p.sim.setPr(number, { mergeStateStatus: 'BEHIND' });
  assert.equal(p.next('feat').step, 'boarded', 'behind');
  p.sim.setPr(number, { mergeStateStatus: 'DIRTY', mergeable: 'CONFLICTING' });
  assert.equal(p.next('feat').step, 'boarded', 'in conflict');
  p.sim.setPr(number, { mergeStateStatus: 'BEHIND', mergeable: 'CONFLICTING' });
  assert.equal(p.next('feat').step, 'boarded', 'behind and in conflict');
});

test('delivery-train P3 T5: in trunk a conflict boards too and a project without the train still stops on it', () => {
  const trunk = project({ model: 'trunk' });
  const a = addChange(trunk, 'feat');
  trunk.sim.setPr(a.number, { mergeable: 'CONFLICTING' });
  assert.equal(trunk.next('feat').step, 'boarded');
  const off = project({ model: 'trunk', train: null });
  const b = addChange(off, 'feat');
  off.sim.setPr(b.number, { mergeable: 'CONFLICTING' });
  const next = off.next('feat');
  assert.deepEqual([next.step, next.conflict], ['blocked', true]);
});

test('delivery-train P3 T6: local commits not pushed, and uncommitted files of the change folder, push', () => {
  const p = project();
  const { wt } = addChange(p, 'feat');
  put(wt, { 'openspec/changes/feat/notes.md': 'notes\n' });
  assert.equal(p.next('feat').step, 'push', 'uncommitted');
  commitAll(wt, 'notes');
  assert.equal(p.next('feat').step, 'push', 'ahead of the pull request');
});

test('delivery-train P3 T6: a closed pull request is blocked, as before the train', () => {
  const p = project();
  const { number } = addChange(p, 'feat');
  p.sim.close(number);
  const next = p.next('feat');
  assert.equal(next.step, 'blocked');
  assert.match(next.reason, /closed/);
});

test('delivery-train P3 T7: an incomplete body, a failing check and a conversation to answer come before boarding', () => {
  const p = project();
  const { number } = addChange(p, 'feat');
  p.sim.setPr(number, { body: 'feat\n' });
  assert.equal(p.next('feat').step, 'edit-pr-body');
  const state = { ...p.state('feat') };
  const talk = { ...state.items[6], status: 'open', details: { threads: [{ id: 't1' }], comments: [], changesRequested: [], waiting: [] } };
  const answering = { ...state, items: state.items.map((i, k) => (k === 6 ? talk : k === 7 ? { ...i, status: 'met' } : i)) };
  assert.equal(deliver.nextStep(answering).step, 'answer');
});

test('delivery-train P3 T9: a push after boarding unboards, and the next step records the evidence again', () => {
  const p = project();
  const { wt } = addChange(p, 'feat');
  assert.equal(p.next('feat').step, 'boarded');
  put(wt, { 'src/feat.txt': 'changed after boarding\n' });
  commitAll(wt, 'code after boarding');
  assert.equal(p.next('feat').step, 'verify');
});

test('delivery-train P3 T2: a change left by an open train waits on GitHub naming that pull request', () => {
  const p = project();
  addChange(p, 'feat');
  const train = launchTrain(p, 4, { boarded: [{ id: 'x', number: 1, head: H('1') }], left: [{ id: 'feat', number: p.changes.feat.number, head: headOf(p, 'feat'), why: 'red' }], failures: { feat: 'boom' } });
  const state = p.state('feat');
  const next = deliver.nextStep(state);
  assert.deepEqual([next.step, next.number, next.train], ['wait-train', train.number, 4]);
  assert.deepEqual(state.train.left, { n: 4, number: train.number, state: 'OPEN', why: 'red', detail: 'Failure of `feat`, below', failure: 'boom' });
});

test('delivery-train P3 T3: a change left by a train that merged or closed goes back to the implementer with the record\'s facts', () => {
  for (const ending of [{ merged: true }, { closed: true }]) {
    const p = project();
    addChange(p, 'feat');
    const train = launchTrain(p, 4, { boarded: [{ id: 'x', number: 1, head: H('1') }], left: [{ id: 'feat', number: p.changes.feat.number, head: headOf(p, 'feat'), why: 'conflict', detail: '`src/a.mjs`, `src/b.mjs`' }] }, ending);
    const next = p.next('feat');
    assert.equal(next.step, 'rejoin-train', JSON.stringify(ending));
    assert.deepEqual([next.number, next.train, next.why, next.paths], [train.number, 4, 'conflict', ['src/a.mjs', 'src/b.mjs']]);
  }
});

test('delivery-train P3 T3: a red leaver carries the failure to the implementer', () => {
  const p = project();
  addChange(p, 'feat');
  launchTrain(p, 4, { boarded: [{ id: 'x', number: 1, head: H('1') }], left: [{ id: 'feat', number: p.changes.feat.number, head: headOf(p, 'feat'), why: 'red' }], failures: { feat: 'not ok 7 - feat' } }, { merged: true });
  const next = p.next('feat');
  assert.deepEqual([next.step, next.why, next.failure], ['rejoin-train', 'red', 'not ok 7 - feat']);
  // Found by the real run (AC-12): the detail of a red leaver is "Failure of `feat`, below", whose backticks named the change
  // as if it were a path to resolve in the brief the implementer gets.
  assert.deepEqual(next.paths, [], 'a red change has no conflicting paths');
});

test('delivery-train P3 T8: a change on an open train ends on GitHub naming the train\'s pull request', () => {
  const p = project();
  addChange(p, 'feat');
  const train = launchTrain(p, 4, { boarded: [boardedOf(p, 'feat')] });
  const state = p.state('feat');
  const next = deliver.nextStep(state);
  assert.deepEqual([next.step, next.number, next.train], ['on-train', train.number, 4]);
  assert.deepEqual(state.train.onTrain, { n: 4, number: train.number, url: `https://github.com/o/r/pull/${train.number}` });
});

test('delivery-train P3 T9: a train that left the change at an older head does not apply, and it boards again', () => {
  const p = project();
  const { wt, number } = addChange(p, 'feat');
  launchTrain(p, 4, { boarded: [{ id: 'x', number: 1, head: H('1') }], left: [{ id: 'feat', number, head: H('9'), why: 'red' }], failures: { feat: 'boom' } });
  assert.equal(p.next('feat').step, 'boarded');
  assert.equal(git(wt, 'rev-parse', 'HEAD').length, 40);
});

test('delivery-train P3 T9: a closed train that carried the change is not under way, so the change boards again', () => {
  const p = project();
  addChange(p, 'feat');
  launchTrain(p, 4, { boarded: [boardedOf(p, 'feat')] }, { closed: true });
  assert.equal(p.next('feat').step, 'boarded');
});

test('delivery-train P3 T2: GitHub silent on a train record is a blocked read, never a boarding', () => {
  const p = project();
  addChange(p, 'feat');
  launchTrain(p, 4, { boarded: [boardedOf(p, 'feat')] });
  const gh = (args, opts) => (args[0] === 'api' && /contents\/openspec\/trains\//.test(args[1]) ? { status: 1, stdout: '', stderr: 'HTTP 502: bad gateway' } : p.sim.gh(p.changes.feat.wt)(args, opts));
  const state = deliver.collectState(p.changes.feat.wt, 'feat', { env: p.env, gh });
  assert.match(state.train.error, /502/);
  const next = deliver.nextStep(state);
  assert.equal(next.step, 'blocked');
  assert.match(next.reason, /train/);
});

test('delivery-train P3 fields: with the key a trunk project asks the merge fields and can see auto-merge on; without it, today\'s', () => {
  const prFields = (log) => log.filter((c) => c[0] === 'pr' && (c[1] === 'view' || (c[1] === 'list' && c.includes('--head')))).map((c) => c[c.indexOf('--json') + 1]);
  const MERGE_FIELDS = 'number,url,state,headRefOid,baseRefName,mergeable,body,autoMergeRequest,mergeStateStatus';
  const PR_FIELDS = 'number,url,state,headRefOid,baseRefName,mergeable,body';
  const on = project({ model: 'trunk' });
  addChange(on, 'feat');
  on.next('feat');
  assert.ok(prFields(on.sim.calls()).length > 0);
  assert.deepEqual([...new Set(prFields(on.sim.calls()))], [MERGE_FIELDS]);
  const off = project({ model: 'trunk', train: null });
  addChange(off, 'feat');
  off.next('feat');
  assert.deepEqual([...new Set(prFields(off.sim.calls()))], [PR_FIELDS]);
});

test('delivery-train P3 fields: trunk-auto asks the merge fields with and without the key', () => {
  const fields = (p) => [...new Set(p.sim.calls().filter((c) => c[0] === 'pr' && (c[1] === 'view' || (c[1] === 'list' && c.includes('--head')))).map((c) => c[c.indexOf('--json') + 1]))];
  const on = project();
  addChange(on, 'feat');
  on.next('feat');
  const off = project({ train: null });
  addChange(off, 'feat');
  off.next('feat');
  assert.deepEqual(fields(on), fields(off));
  assert.match(fields(on)[0], /autoMergeRequest/);
});

test('delivery-train P3 fields: a trunk project without the key makes exactly the gh calls it made before the train', () => {
  const off = project({ model: 'trunk', train: null });
  addChange(off, 'feat');
  const before = off.sim.calls().length;
  const state = off.state('feat');
  const calls = off.sim.calls().slice(before).map((c) => c.join(' '));
  assert.equal('train' in state, false);
  assert.deepEqual(calls.filter((c) => /^pr (view|list)/.test(c)), [
    'pr view --json number,url,state,headRefOid,baseRefName,mergeable,body',
    'pr list --head feat --state all --limit 10 --json number,url,state,headRefOid,baseRefName,mergeable,body',
  ]);
  assert.equal(calls.some((c) => /train/.test(c)), false, calls.join('\n'));
});

// ---------------------------------------------------------------- P4 trainFacts

const ghOf = (p, id = 'feat') => p.sim.gh(p.changes[id].wt);
const factsOf = (p, id = 'feat', extra = {}) => deliver.trainFacts(ghOf(p, id), p.changes[id].wt, id, { suite: SUITE, prHead: headOf(p, id), kind: 'change', ...extra });

test('delivery-train P4 trainFacts: on an open train, carried by a merged one, left on an open one and left on a closed one', () => {
  const p = project();
  addChange(p, 'feat');
  const open = launchTrain(p, 4, { boarded: [boardedOf(p, 'feat')] });
  assert.deepEqual(factsOf(p).onTrain, { n: 4, number: open.number, url: `https://github.com/o/r/pull/${open.number}` });
  assert.equal(factsOf(p).carried, null);

  const q = project();
  addChange(q, 'feat');
  const merged = launchTrain(q, 4, { boarded: [boardedOf(q, 'feat')] }, { merged: true });
  const facts = factsOf(q);
  assert.equal(facts.onTrain, null);
  assert.deepEqual([facts.carried.n, facts.carried.number], [4, merged.number]);
  assert.match(facts.carried.mergeCommit, /^[0-9a-f]{40}$/);

  const r = project();
  addChange(r, 'feat');
  const leftOpen = launchTrain(r, 4, { boarded: [{ id: 'x', number: 1, head: H('1') }], left: [{ id: 'feat', number: r.changes.feat.number, head: headOf(r, 'feat'), why: 'conflict', detail: '`a`' }] });
  assert.deepEqual(factsOf(r).left, { n: 4, number: leftOpen.number, state: 'OPEN', why: 'conflict', detail: '`a`', failure: null });

  const s = project();
  addChange(s, 'feat');
  launchTrain(s, 4, { boarded: [{ id: 'x', number: 1, head: H('1') }], left: [{ id: 'feat', number: s.changes.feat.number, head: headOf(s, 'feat'), why: 'conflict' }] }, { closed: true });
  assert.equal(factsOf(s).left.state, 'CLOSED');
});

test('delivery-train P4 trainFacts: a record at another head, another kind or another change lists nobody', () => {
  const p = project();
  addChange(p, 'feat');
  launchTrain(p, 4, { boarded: [{ id: 'feat', number: 1, head: H('9') }, { kind: 'archive', id: 'feat', number: 2, head: headOf(p, 'feat') }, { id: 'other', number: 3, head: headOf(p, 'feat') }] });
  const facts = factsOf(p);
  assert.deepEqual([facts.onTrain, facts.carried, facts.left], [null, null, null]);
  assert.equal(factsOf(p, 'feat', { kind: 'archive' }).onTrain.n, 4, 'the archive kind reads the archive rows');
});

test('delivery-train P4 trainFacts: the newest train wins, only train heads are read and only five of them', () => {
  const p = project();
  addChange(p, 'feat');
  for (const n of [1, 2, 3, 4, 5, 6]) launchTrain(p, n, { boarded: [n === 1 ? boardedOf(p, 'feat') : { id: 'x', number: 1, head: H('1') }] }, { closed: true });
  const facts = factsOf(p);
  assert.equal(facts.onTrain, null, 'the oldest of six trains is not read');
  const reads = p.sim.calls().filter((c) => c[0] === 'api' && /contents\/openspec\/trains\//.test(c[1])).length;
  assert.equal(reads, 5);
});

test('delivery-train P4 trainFacts: a pull request that is not a train, and no pull request head, make no train reads', () => {
  const p = project();
  addChange(p, 'feat');
  assert.deepEqual(factsOf(p, 'feat', { prHead: null }).records, []);
  const before = p.sim.calls().length;
  factsOf(p, 'feat', { prHead: null });
  assert.equal(p.sim.calls().length, before, 'no pull request head, no call');
  const facts = factsOf(p);
  assert.deepEqual(facts.records, [], 'a feature branch is not a train');
  assert.equal(facts.suite, SUITE);
  assert.deepEqual(facts.parts, PARTS);
});

test('delivery-train P4 trainFacts: GitHub silent is an error, and a train with no record or a bad one lists nobody', () => {
  const p = project();
  addChange(p, 'feat');
  const down = (args) => ({ status: 1, stdout: '', stderr: 'HTTP 502: bad gateway', missing: false, timedOut: false });
  assert.match(deliver.trainFacts(down, p.changes.feat.wt, 'feat', { suite: SUITE, prHead: headOf(p, 'feat'), kind: 'change' }).error, /502/);

  launchTrain(p, 3, { boarded: [boardedOf(p, 'feat')] });
  const dir = tmpFolder('devkit-train-wt-');
  const wt = join(dir, 'w');
  git(p.t.main, 'worktree', 'add', '-q', '-b', 'train/9', wt, 'origin/main');
  put(wt, { 'openspec/trains/9.md': 'not a record\n' });
  commitAll(wt, 'bad record');
  git(wt, 'push', '-q', 'origin', 'train/9');
  git(p.t.main, 'worktree', 'remove', '--force', wt);
  p.sim.create({ base: 'main', head: 'train/9', body: '' });
  git(p.t.main, 'worktree', 'add', '-q', '-b', 'train/10', wt, 'origin/main');
  git(wt, 'push', '-q', 'origin', 'train/10');
  git(p.t.main, 'worktree', 'remove', '--force', wt);
  p.sim.create({ base: 'main', head: 'train/10', body: '' });
  const facts = factsOf(p);
  assert.equal(facts.error, undefined);
  assert.equal(facts.onTrain.n, 3, 'the broken record and the missing one are skipped');
});

// ---------------------------------------------------------------- AC-2, AC-3

test('delivery-train AC-2: a change approved at its head is boarded behind main, with pending checks, and waits for the owner', () => {
  const p = project();
  const { number } = addChange(p, 'feat');
  p.sim.setChecks(number, PENDING);
  p.sim.setPr(number, { mergeStateStatus: 'BEHIND' });
  const state = p.state('feat');
  const next = deliver.nextStep(state);
  assert.equal(next.step, 'boarded');
  assert.deepEqual(state.items.slice(0, 4).map((i) => i.status), ['met', 'met', 'met', 'met']);
  assert.equal(state.items[4].status, 'open', 'item 5 is open for being behind');
  assert.equal(state.items[5].status, 'open', 'item 6 is open for pending checks');
  const flow = deliveryRow({ root: p.t.main, env: p.env, ref: 'origin/main', base: 'main' }, { id: 'feat', worktree: p.changes.feat.wt }, { state, report: deliver.buildReport(state, p.env) });
  assert.deepEqual([flow.next.step, flow.next.actor], ['boarded', 'owner']);
  assert.equal(flow.next.askable, false);
  assert.equal(flow.state, 'waiting for the owner: boarded');
});

test('delivery-train AC-3: a sibling\'s merge into main leaves the boarded change\'s evidence, reviews and action as they were', () => {
  const p = project();
  const { number, wt } = addChange(p, 'feat');
  const sib = addChange(p, 'sib');
  const before = p.state('feat');
  assert.equal(deliver.nextStep(before).step, 'boarded');
  p.sim.merge(sib.number);
  git(wt, 'fetch', '-q', 'origin');
  p.sim.setPr(number, { mergeStateStatus: 'BEHIND' });
  const after = p.state('feat');
  const next = deliver.nextStep(after);
  assert.equal(next.step, 'boarded', 'the same end as before the merge');
  for (const n of [0, 1, 2, 3]) assert.deepEqual(after.items[n], before.items[n], `item ${n + 1} is as it was`);
  assert.equal(after.head, before.head, 'the head did not move');
  assert.equal(after.items[0].details.evidence, 'current');
  assert.deepEqual(after.items[1].details.stale, []);
  assert.notEqual(next.step, 'update-branch');
});

// ---------------------------------------------------------------- AC-5, the tasks item (half)

const GATE_TASKS = `# Tasks\n\n## 1. Phase\n\n- [x] 1.1 code\n- [x] 1.2 Gate: \`${SUITE}\`\n`;

test('delivery-train AC-5: the tasks item skips the parts of the train and says how many the train proves', () => {
  const root = project().t.main;
  const dir = join(root, 'openspec', 'changes', 'g');
  put(root, { 'openspec/changes/g/tasks.md': GATE_TASKS, 'openspec/changes/g/evidence.md': `Commit: ${git(root, 'rev-parse', 'HEAD')}\n\n| gate | command | result |\n|---|---|---|\n| 1.2 | \`${PARTS[0]}\` | pass: green |\n` });
  assert.ok(dir);
  const none = deliver.tasksItem(root, 'g', deliver.gitFacts(root));
  assert.equal(none.status, 'open');
  assert.deepEqual(none.details.missingGates, [PARTS[1]], 'without the train the second part needs a row');
  const item = deliver.tasksItem(root, 'g', deliver.gitFacts(root), { trainParts: [PARTS[1]] });
  assert.equal(item.status, 'met');
  assert.deepEqual(item.details.trainParts, [PARTS[1]]);
  assert.match(item.reason, /1 proven by the train/);
  assert.deepEqual(item.details.missingGates, []);
});

test('delivery-train AC-5: a part the train does not run still needs its row, and a train row ending in train: is no pass', () => {
  const root = project().t.main;
  put(root, { 'openspec/changes/g/tasks.md': GATE_TASKS, 'openspec/changes/g/evidence.md': `Commit: ${git(root, 'rev-parse', 'HEAD')}\n\n| gate | command | result |\n|---|---|---|\n| 1.2 | \`${PARTS[0]}\` | pass: green |\n| 1.2 | \`${PARTS[1]}\` | train: proven by the train record |\n` });
  const none = deliver.tasksItem(root, 'g', deliver.gitFacts(root));
  assert.equal(none.status, 'open', 'the train: cell is never a pass');
  assert.deepEqual(none.details.missingGates, [PARTS[1]]);
  const other = deliver.tasksItem(root, 'g', deliver.gitFacts(root), { trainParts: ['npm run something-else'] });
  assert.deepEqual(other.details.missingGates, [PARTS[1]]);
  assert.deepEqual(other.details.trainParts, []);
  const both = deliver.tasksItem(root, 'g', deliver.gitFacts(root), { trainParts: PARTS });
  assert.equal(both.status, 'met');
  assert.deepEqual(both.details.trainParts, [PARTS[1]], 'a train part that has its pass row is not skipped, so it is not listed');
});

test('delivery-train AC-5: collectState passes the train parts to the tasks item, and a project without the key does not', () => {
  const p = project();
  addChange(p, 'feat', { tasks: GATE_TASKS, gates: [PARTS[0]] });
  const on = p.state('feat');
  assert.equal(on.items[0].status, 'met');
  assert.deepEqual(on.items[0].details.trainParts, [PARTS[1]]);
  const off = project({ train: null });
  addChange(off, 'feat', { tasks: GATE_TASKS, gates: [PARTS[0]] });
  const state = off.state('feat');
  assert.equal(state.items[0].status, 'open');
  assert.deepEqual(state.items[0].details.missingGates, [PARTS[1]]);
  assert.equal('trainParts' in state.items[0].details, false);
  assert.equal(deliver.nextStep(state).step, 'verify');
});

// Invariant: the selective gate part is not a part of the train's whole-suite command, so it needs its own pass row; the check part is the train's.
// Layer: the tasks item (`tasksItem`). Suite: delivery-train.test.mjs.
test('selective-tests-by-map-2 AC-6: a gate naming the selective command needs its own row, and the train still proves the check part', () => {
  const SELECTIVE = 'node scripts/test-suite.mjs --own-files';
  const gate = `${SELECTIVE} && ${PARTS[1]}`;
  const tasks = `# Tasks\n\n## 1. Phase\n\n- [x] 1.1 code\n- [x] 1.2 Gate: \`${gate}\`\n`;
  const root = project().t.main;
  const evidence = (rows) => `Commit: ${git(root, 'rev-parse', 'HEAD')}\n\n| gate | command | result |\n|---|---|---|\n${rows}`;
  put(root, { 'openspec/changes/g/tasks.md': tasks, 'openspec/changes/g/evidence.md': evidence('') });
  const none = deliver.tasksItem(root, 'g', deliver.gitFacts(root), { trainParts: PARTS });
  assert.equal(none.status, 'open');
  assert.deepEqual(none.details.missingGates, [SELECTIVE], 'the selective part is not a train part, so it is listed');
  assert.deepEqual(none.details.trainParts, [PARTS[1]], 'the check part is the train\'s');
  put(root, { 'openspec/changes/g/evidence.md': evidence(`| 1.2 | \`${SELECTIVE}\` | pass: selected 2 test files, suite: 2 files, 20 tests, 20 pass |\n`) });
  const item = deliver.tasksItem(root, 'g', deliver.gitFacts(root), { trainParts: PARTS });
  assert.equal(item.status, 'met');
  assert.deepEqual(item.details.missingGates, []);
});

// ---------------------------------------------------------------- the archive rows A1-A5 (P3), pure

const URL = (n) => `https://github.com/o/r/pull/${n}`;
const metItem = (id, name, details = {}) => ({ id, name, status: 'met', reason: `item ${id} met`, details });

// A state after the merge in a train project: the change archived in this checkout, its archive pull request open and clean.
function archiveState({ pr = {}, train = {}, ship = 'merge', retro = {} } = {}) {
  return {
    id: 'gamma', schema: 'devkit-lite', ship, mergeMethod: 'squash', branch: 'chore/archive-gamma', head: H('a'), dirty: [], mergedLeft: null, setup: { ok: true, missing: [] },
    pr: { number: 5, url: URL(5), state: 'MERGED', headRefOid: H('a'), mergeable: null },
    items: [metItem(1, 'tasks'), metItem(2, 'reviews'), metItem(3, 'findings'), metItem(4, 'acceptance'), metItem(5, 'pr', { pr: { number: 5, url: URL(5) }, merged: true }), metItem(6, 'checks'), metItem(7, 'conversation'), metItem(8, 'body')],
    archive: {
      branch: 'chore/archive-gamma', base: 'main', onDefault: 'active', changePr: { number: 5, url: URL(5) }, local: 'archived', folder: '2026-11-23-gamma',
      retro: { exists: true, readable: true, proposals: [], ...retro }, roadmap: { listed: true, ticked: true, line: '- [x] gamma' }, branchExists: true, dirty: [], waitingFor: null, changed: { paths: [] },
      pr: { number: 30, url: URL(30), state: 'OPEN', mergeable: 'MERGEABLE', autoMerge: false, mergeStateStatus: 'CLEAN', headRefOid: H('a'), headRel: 'same', checks: { failing: [], pending: [], error: null }, ...pr },
    },
    train: { suite: SUITE, parts: PARTS, kind: 'archive', records: [], onTrain: null, carried: null, left: null, ...train },
  };
}
const LEFT = (over = {}) => ({ n: 4, number: 40, state: 'OPEN', why: 'conflict', detail: '`openspec/specs/x/spec.md`', failure: null, ...over });

test('delivery-train P3 A5: an open archive pull request that passes its checks boards, in trunk-auto and in trunk', () => {
  for (const ship of ['merge', 'pr']) {
    const next = deliver.nextStep(archiveState({ ship }));
    assert.equal(next.step, 'boarded', ship);
  }
});

test('delivery-train P3 A5: pending checks board an archive, and a failing check does not', () => {
  assert.equal(deliver.nextStep(archiveState({ pr: { checks: { failing: [], pending: ['check'], error: null } } })).step, 'boarded');
  const failing = deliver.nextStep(archiveState({ pr: { checks: { failing: [{ name: 'check', link: 'https://ci/check' }], pending: [], error: null } } }));
  assert.deepEqual([failing.step, failing.archiveStep], ['stop-archive', 'archive-pr']);
});

test('delivery-train P3 A4: an archive on an open train ends on GitHub naming it', () => {
  const next = deliver.nextStep(archiveState({ train: { onTrain: { n: 4, number: 40, url: URL(40) } } }));
  assert.deepEqual([next.step, next.number, next.train], ['on-train', 40, 4]);
});

test('delivery-train P3 A1: an archive left while its train is open waits on GitHub and is never boarded', () => {
  const next = deliver.nextStep(archiveState({ train: { left: LEFT() } }));
  assert.deepEqual([next.step, next.number, next.train], ['wait-train', 40, 4]);
});

test('delivery-train P3 A2: an archive left on a red train stops for the owner naming the train and the failure', () => {
  for (const state of ['MERGED', 'CLOSED']) {
    const next = deliver.nextStep(archiveState({ train: { left: LEFT({ why: 'red', state, detail: 'Failure of `gamma`, below', failure: 'not ok 3 - spec' }) } }));
    assert.deepEqual([next.step, next.archiveStep], ['stop-archive', 'train-left'], state);
    assert.match(next.reason, /train 4/);
    assert.match(next.reason, /not ok 3 - spec/);
  }
});

test('delivery-train P3 A3: an archive left for a conflict on a train that ended rejoins with the paths', () => {
  const next = deliver.nextStep(archiveState({ train: { left: LEFT({ state: 'MERGED', detail: '`openspec/specs/x/spec.md`, `openspec/roadmap.md`' }) } }));
  assert.equal(next.step, 'rejoin-archive');
  assert.deepEqual([next.number, next.branch, next.base, next.train], [30, 'chore/archive-gamma', 'main', 4]);
  assert.deepEqual(next.paths, ['openspec/specs/x/spec.md', 'openspec/roadmap.md']);
});

test('delivery-train P3 A rows: a conflicting or behind archive pull request boards, and is never told to update its branch', () => {
  assert.equal(deliver.nextStep(archiveState({ pr: { mergeable: 'CONFLICTING' } })).step, 'boarded');
  assert.equal(deliver.nextStep(archiveState({ pr: { mergeStateStatus: 'BEHIND' } })).step, 'boarded');
  const off = archiveState({ pr: { mergeStateStatus: 'BEHIND' } });
  delete off.train;
  assert.equal(deliver.nextStep(off).step, 'update-branch', 'without the train it still updates');
  const conflict = archiveState({ pr: { mergeable: 'CONFLICTING' } });
  delete conflict.train;
  assert.equal(deliver.nextStep(conflict).step, 'stop-archive', 'without the train a conflict still stops');
});

test('delivery-train P3 A rows: auto-merge on an archive pull request is disabled, and the archive boards after it', () => {
  for (const ship of ['merge', 'pr']) {
    const on = archiveState({ ship, pr: { autoMerge: true } });
    const next = deliver.nextStep(on);
    assert.deepEqual([next.step, next.number], ['disable-auto-merge', 30], ship);
    assert.equal(deliver.nextStep(archiveState({ ship })).step, 'boarded', ship);
  }
});

test('delivery-train P3 A rows: the retro answers and the file check still hold an archive back, and an unpushed one is pushed first', () => {
  const unanswered = deliver.nextStep(archiveState({ retro: { proposals: [{ n: 1, targets: ['README.md'], kind: 'x', answer: null }] } }));
  assert.equal(unanswered.step, 'stop-retro-answers');
  const ahead = deliver.nextStep(archiveState({ pr: { headRel: 'ahead' } }));
  assert.equal(ahead.step, 'open-archive-pr');
});

// ---------------------------------------------------------------- P3b override 4: an archive that left a train

const roadmapOf = (gamma, delta) => `# Roadmap\n\n## Round 1\n- [${gamma}] gamma\n- [${delta}] delta\n- [ ] epsilon\n`;

// A project whose archive branch `chore/archive-delta` ticks `delta`, in a worktree, with origin/main moved by `originFiles`.
function archiveBranch({ archiveFiles = {}, originFiles = {}, files = {} } = {}) {
  const t = roundRepo({ roadmap: roadmapOf(' ', ' '), config: projectConfig('trunk-auto', SUITE), files: { ...WORKFLOW, [SPEC]: '# spec\n\nline 1\nline 2\nline 3\n', ...files } });
  const wt = t.addWt('archive-delta', { branch: 'chore/archive-delta' });
  put(wt, { 'openspec/roadmap.md': roadmapOf(' ', 'x'), ...archiveFiles });
  const head = commitAll(wt, 'archive delta');
  t.commitOrigin(originFiles, 'origin moves');
  return { t, wt, head };
}

function rejoinRow({ t, wt, head }, over = {}) {
  const ctx = { root: t.main, env: trainEnv, ref: 'origin/main', base: 'main', ghFor: t.ghFor, ...over.ctx };
  const row = { id: 'delta', worktree: wt };
  const state = { id: 'delta', branch: 'chore/archive-delta', ship: 'merge', archive: { pr: { number: 30, state: 'OPEN', headRefOid: head } } };
  const next = { step: 'rejoin-archive', reason: 'archive of delta left train 4', number: 30, branch: 'chore/archive-delta', base: 'main', paths: ['openspec/roadmap.md'], train: 4, ...over.next };
  return deliveryRow(ctx, row, { state: over.state ?? state, report: { summary: 'in progress', met: 8, next } });
}

test('delivery-train P3b: a clean merge with the base gives rejoin-archive with the roadmap-ticks command', () => {
  const r = archiveBranch({ originFiles: { 'README.md': 'origin\n' } });
  const row = rejoinRow(r);
  assert.deepEqual([row.next.step, row.next.actor], ['rejoin-archive', 'main']);
  assert.deepEqual(row.next.command.slice(2), ['--base', 'main', '--roadmap-ticks', '--json']);
  assert.match(row.next.command[1], /release-merge\.mjs$/);
  assert.equal(row.next.root, r.wt);
  assert.equal(git(r.wt, 'rev-parse', 'HEAD'), r.head, 'nothing was touched');
});

test('delivery-train P3b: release files and a roadmap tick in the way give the same step', () => {
  const r = archiveBranch({
    files: { 'CHANGELOG.md': '# c\n' },
    archiveFiles: { 'CHANGELOG.md': '# c\narchive edit\n', 'openspec/roadmap.md': roadmapOf(' ', 'x') },
    originFiles: { 'CHANGELOG.md': '# c\norigin edit\n', 'openspec/roadmap.md': roadmapOf('x', ' ') },
  });
  const row = rejoinRow(r);
  assert.equal(row.next.step, 'rejoin-archive');
  assert.deepEqual(row.next.command.slice(2), ['--base', 'main', '--roadmap-ticks', '--json']);
});

test('delivery-train P3b: a canonical spec edited on both sides stops for the owner with the path, and nothing is merged', () => {
  const r = archiveBranch({
    archiveFiles: { [SPEC]: '# spec\n\nline 1\narchive line 2\nline 3\n' },
    originFiles: { [SPEC]: '# spec\n\nline 1\norigin line 2\nline 3\n' },
  });
  const row = rejoinRow(r);
  assert.deepEqual([row.next.step, row.next.archiveStep, row.next.actor], ['stop-archive', 'train-left', 'stop']);
  assert.match(row.next.reason, new RegExp(`archive of delta left train 4 and conflicts with main in ${SPEC.replace(/[.]/g, '\\.')}; resolve them on chore/archive-delta`));
  assert.equal(git(r.wt, 'rev-parse', 'HEAD'), r.head);
  assert.equal(git(r.wt, 'status', '--porcelain'), '');
});

test('delivery-train P3b: a merge made here and not pushed yet is pushed, never with force, and not merged again', () => {
  const r = archiveBranch({ originFiles: { 'README.md': 'origin\n' } });
  git(r.wt, 'merge', '-q', '--no-ff', '-m', 'merge main', 'origin/main');
  const row = rejoinRow(r);
  assert.equal(row.next.step, 'open-archive-pr');
  assert.deepEqual(row.next.command, ['git', 'push', 'origin', 'chore/archive-delta']);
  assert.doesNotMatch(JSON.stringify(row.next), /--force/);
});

test('delivery-train P3b: a change row, and any other step of an archive, is left alone', () => {
  const r = archiveBranch({ originFiles: { 'README.md': 'origin\n' } });
  for (const step of ['boarded', 'on-train', 'wait-train', 'rejoin-train']) {
    assert.equal(rejoinRow(r, { next: { step } }).next.step, step, step);
  }
});

test('delivery-train P3b: the actors of the six new steps', () => {
  assert.deepEqual(actorOf('boarded'), { actor: 'owner', askable: false });
  assert.deepEqual(actorOf('on-train'), { actor: 'github' });
  assert.deepEqual(actorOf('wait-train'), { actor: 'github' });
  assert.deepEqual(actorOf('rejoin-train'), { actor: 'subagent', agent: 'devkit-core:tdd-implementer' });
  assert.deepEqual(actorOf('close-boarded-pr'), { actor: 'main' });
  assert.deepEqual(actorOf('rejoin-archive'), { actor: 'main' });
});

// ---------------------------------------------------------------- AC-9 boarding: two archives at once

const RETRO_NONE = '# Retro: x\n\n## Proposed updates\n\nNone.\n';
const roadmapIds = (...ids) => `# Roadmap\n\n## Round 1\n${ids.map((i) => `- [ ] ${i}`).join('\n')}\n`;

// Changes `ids` finished, their pull requests merged by the simulated GitHub, each at its archive step (the retro answered).
function atArchive({ train = SUITE, ids = ['a', 'b'] } = {}) {
  const t = roundRepo({ roadmap: roadmapIds(...ids), config: projectConfig('trunk-auto', train), files: WORKFLOW });
  const sim = simGitHub({ origin: t.originDir });
  const env = { ...process.env, ...sim.env, ...SET };
  const p = { t, sim, env, changes: {} };
  for (const id of ids) {
    const wt = t.addWt(id);
    put(wt, {
      [`openspec/changes/${id}/.openspec.yaml`]: 'schema: devkit-lite\n', [`openspec/changes/${id}/proposal.md`]: PROPOSAL,
      [`openspec/changes/${id}/tasks.md`]: DEFAULT_TASKS, [`openspec/changes/${id}/retro.md`]: RETRO_NONE, [`src/${id}.txt`]: `${id}\n`,
    });
    commitAll(wt, `work of ${id}`);
    git(wt, 'push', '-q', 'origin', id);
    const number = sim.create({ base: 'main', head: id, body: bodyOf(id) });
    sim.merge(number);
    p.changes[id] = { wt, number };
  }
  git(t.main, 'fetch', '-q', 'origin');
  return p;
}
const archiveRows = (p) => Object.fromEntries(conductState(p.t.main, { env: p.env, ghFor: p.sim.gh }).changes.map((c) => [c.id, c.next.step]));

test('delivery-train AC-9: two archives at the archive step both go on in a train project, and one waits for the other without the key', () => {
  assert.deepEqual(archiveRows(atArchive()), { a: 'archive', b: 'archive' });
  assert.deepEqual(archiveRows(atArchive({ train: null })), { a: 'archive', b: 'wait-dependencies' });
  assert.deepEqual(archiveRows(atArchive({ train: '' })), { a: 'archive', b: 'wait-dependencies' });
});

// ---------------------------------------------------------------- AC-1 the rows without the key

const SHIP_MERGE = `schema: devkit-lite\nship:\n  devkit-lite: merge\nmerge_method: squash\n`;

test('delivery-train AC-1: without the key the delivery rows give the JSON and the exit code they gave, whatever the model and the ship map', () => {
  const configs = { 'ship: merge': SHIP_MERGE, 'trunk-auto': projectConfig('trunk-auto'), 'trunk-auto with an empty train': projectConfig('trunk-auto', '') };
  const p = project({ train: null });
  const { number, wt } = addChange(p, 'feat');
  addChange(p, 'solo', { pr: false });
  const fixtures = [
    ['solo', 'open-pr', () => {}],
    ['feat', 'enable-auto-merge', () => {}],
    ['feat', 'wait-checks', () => p.sim.setChecks(number, PENDING)],
    ['feat', 'update-branch', () => { p.sim.setChecks(number, GREEN); p.sim.setPr(number, { mergeStateStatus: 'BEHIND' }); }],
    ['feat', 'wait-merge', () => { p.sim.setPr(number, { mergeStateStatus: 'CLEAN' }); p.sim.setAutoMerge(number, 'squash'); }],
    ['feat', 'disable-auto-merge', () => { put(wt, { 'src/feat.txt': 'changed\n' }); commitAll(wt, 'code after evidence'); }],
  ];
  for (const [id, step, mutate] of fixtures) {
    mutate();
    const root = p.changes[id].wt;
    const answers = Object.entries(configs).map(([name, text]) => {
      put(root, { 'openspec/config.yaml': text });
      const r = deliver.main([id, '--json'], p.env, root);
      return [name, r.code, r.stdout];
    });
    assert.equal(JSON.parse(answers[0][2]).next.step, step, `${id} ${step}`);
    assert.equal('train' in JSON.parse(answers[0][2]), false);
    for (const [name, code, stdout] of answers.slice(1)) {
      assert.equal(code, answers[0][1], `${step} ${name}: exit code`);
      assert.equal(stdout, answers[0][2], `${step} ${name}: JSON`);
    }
  }
});

// ---------------------------------------------------------------- the loop's ends and hand-offs for the new steps (2.5)

const FLOW = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas', 'devkit', 'flow.json'), 'utf8'));
// A decision inside the delivery stage, as `nextAction` builds it from the delivery checker's row.
function decideRow(step, extra = {}, { lang = 'en', archiving = false } = {}) {
  const at = FLOW.stages.find((s) => s.id === 'delivery');
  const report = {
    version: 1, change: 'feat', schema: 'devkit', script: 'current', head: 'h', previous: null, end: null,
    stages: FLOW.stages.map((st, i) => ({ n: i + 1, id: st.id, title: st.title.en, state: 'passed', reasonCode: 'passed', params: {} })),
    next: { n: FLOW.stages.indexOf(at) + 1, stage: 'delivery', role: at.role, skills: at.skills ?? [], reasonCode: 'not-pushed', params: { number: 12 }, reason: 'x', progressKey: 'delivery@abc123' },
  };
  return decide({
    ctx: { id: 'feat', script: 'devkit', root: '/w/feat', branch: 'feat', lang, filesLanguage: 'en' }, flow: FLOW, report, after: null, fingerprint: 'abc123',
    approval: { status: null, recorded: null, readiness: 'sha256:abcdef012345', ok: false }, hasProposal: false, flags: [], archiving,
    row: { next: { step, reason: 'r', actor: 'x', ...extra }, state: 's', delivered: {} },
  });
}

test('delivery-train loop: a boarded change ends waiting for the owner with the waiting-train reply, in both languages', () => {
  for (const lang of ['en', 'pt-BR']) {
    const a = decideRow('boarded', { number: 12 }, { lang });
    assert.deepEqual([a.kind, a.end.state, a.end.why, exitCodeOf(a)], ['end', 'waiting-for-owner', 'waiting-train', 1], lang);
    assert.equal(a.reply, render(lang, 'waiting-train', { id: 'feat' }), lang);
    assert.match(a.reply, /\/devkit train/);
    assert.equal(gateOf(a), 'train');
    assert.ok(MESSAGES[lang]['gate.train'] && MESSAGES[lang]['what.train'], lang);
  }
  assert.match(render('en', 'waiting-train', { id: 'feat' }), /boarded/);
});

test('delivery-train loop: a change on a train, or left by an open one, ends waiting on GitHub for the train', () => {
  for (const step of ['on-train', 'wait-train']) {
    const a = decideRow(step, { number: 40, train: 4 });
    assert.deepEqual([a.kind, a.end.state, a.end.why, exitCodeOf(a)], ['end', 'waiting-on-github', 'waiting-github', 1], step);
    assert.equal(a.params.what, 'train', step);
    assert.equal(a.reply, render('en', 'waiting-github', { id: 'feat', what: 'train' }), step);
    assert.match(a.reply, /pull request of its train/, step);
    assert.equal(decideRow(step, { number: 40, train: 4 }, { archiving: true }).params.what, 'train', `${step} of an archive`);
  }
});

test('delivery-train loop: a change that left a train goes to the implementer with the base and the record\'s facts', () => {
  const a = decideRow('rejoin-train', { number: 40, train: 4, why: 'red', paths: [], failure: 'not ok 7 - feat', base: 'main' });
  assert.deepEqual([a.kind, a.agent, a.step, a.stage, a.role], ['agent', 'devkit-core:tdd-implementer', 'rejoin-train', 'implementation', 'tdd-implementer']);
  assert.match(a.brief, /node release-merge\.mjs --base main/);
  assert.match(a.brief, /git merge origin\/main/);
  assert.match(a.brief, /not ok 7 - feat/);
  assert.match(a.brief, /test first/);
  const conflict = decideRow('rejoin-train', { number: 40, train: 4, why: 'conflict', paths: ['src/a.mjs'], failure: null, base: 'main' });
  assert.match(conflict.brief, /resolve src\/a\.mjs/);
});

test('delivery-train loop: an archive that rejoins is a session step of the delivery stage', () => {
  const command = ['node', '/hooks/release-merge.mjs', '--base', 'main', '--roadmap-ticks', '--json'];
  const rejoin = decideRow('rejoin-archive', { number: 30, branch: 'chore/archive-feat', base: 'main', paths: [], train: 4, command });
  assert.deepEqual([rejoin.kind, rejoin.step, rejoin.stage, exitCodeOf(rejoin)], ['session', 'rejoin-archive', 'delivery', 0]);
  assert.deepEqual(rejoin.detail.command, command);
});

// ---------------------------------------------------------------- unfinished skips the checkout of a train (2.5, P13)

const OFFLINE = () => ({ status: 1, stdout: '', stderr: 'offline', missing: false, timedOut: false, overflowed: false });
const changeFiles = (id) => ({ [`openspec/changes/${id}/.openspec.yaml`]: 'schema: devkit-lite\n', [`openspec/changes/${id}/proposal.md`]: PROPOSAL });

test('delivery-train P13: a checkout on train/<n> holding a change folder never reports that change, and its own worktree still does', () => {
  const t = roundRepo({ roadmap: '# Roadmap\n', config: projectConfig('trunk-auto', SUITE), files: WORKFLOW });
  const own = t.addWt('feat');
  put(own, changeFiles('feat'));
  const train = t.addWt('train-4', { branch: 'train/4' });
  put(train, { ...changeFiles('carried'), ...changeFiles('feat') });
  const found = unfinished(t.main, { env: trainEnv, gh: OFFLINE }).map((u) => [u.id, u.branch]);
  assert.deepEqual(found, [['feat', 'feat']], 'carried lives only in the train\'s checkout and is not unfinished; feat is read from its own worktree');
  const lone = roundRepo({ roadmap: '# Roadmap\n', config: projectConfig('trunk-auto', SUITE), files: WORKFLOW });
  put(lone.addWt('train-4', { branch: 'train/4' }), changeFiles('carried'));
  put(lone.addWt('other-work'), changeFiles('other-work'));
  assert.deepEqual(unfinished(lone.main, { env: trainEnv, gh: OFFLINE }).map((u) => u.id), ['other-work']);
  const feature = roundRepo({ roadmap: '# Roadmap\n', config: projectConfig('trunk-auto', SUITE), files: WORKFLOW });
  put(feature.addWt('trainer', { branch: 'feature/train/4' }), changeFiles('kept'));
  assert.deepEqual(unfinished(feature.main, { env: trainEnv, gh: OFFLINE }).map((u) => u.id), ['kept'], 'a branch that only contains train/4 is not a train');
});

// ================================================================ phase 3: the departure, the verb and the skill
const archiveNext = (p, id) => deliver.nextStep(deliver.collectState(p.archives[id].wt, id, { env: p.env }));

test('delivery-train depart fixture: a proven change and a ready archive both board where the departure will judge them', () => {
  const p = project({ roadmap: roadmapOfIds('gamma') });
  addChange(p, 'alpha');
  addArchive(p, 'gamma');
  assert.equal(p.next('alpha').step, 'boarded');
  assert.equal(archiveNext(p, 'gamma').step, 'boarded');
});

// ---------------------------------------------------------------- P5 writeTrainRecord

test('delivery-train record: the record the departure writes parses back to what was written, with a fence of four backticks in a failure', () => {
  const r = {
    n: 4, base: 'main', result: 'passed', baseSha: H('a'), suite: SUITE, ranAt: H('b'),
    boarded: [{ order: 1, kind: 'change', id: 'alpha', number: 81, head: H('1'), at: '2026-11-23T10:00:00Z' }, { order: 2, kind: 'archive', id: 'gamma', number: 85, head: H('2'), at: '2026-11-23T10:05:00Z' }],
    left: [
      { kind: 'change', id: 'delta', number: 84, head: H('4'), why: 'red', detail: 'Failure of `delta`, below', failure: 'not ok 1\n````\n## Boarded\n| 9 | nope |\n```\nmore' },
      { kind: 'change', id: 'beta', number: 83, head: H('3'), why: 'conflict', detail: '`plugins/x/hooks/a.mjs`', failure: null },
    ],
  };
  const text = train.writeTrainRecord({ ...r, runs: [{ changes: 'alpha, gamma, delta', head: H('5'), result: 'failed' }] });
  assert.deepEqual(deliver.parseTrainRecord(text), r);
  assert.match(text, /^<!-- devkit-train n=4 base=main result=passed -->\n# Train 4\n/);
  assert.match(text, /\n`````text\n/, 'the fence is one backtick longer than the longest run that starts a line');
  assert.match(text, /\n\| 1 \| alpha, gamma, delta \| `[0-9a-f]{40}` \| failed \|\n/);
  const plain = train.writeTrainRecord({ ...r, left: [] });
  assert.doesNotMatch(plain, /## Left|## Runs|## Failure/);
  assert.deepEqual(deliver.parseTrainRecord(plain).left, []);
});

// ---------------------------------------------------------------- P8 the bisection

test('delivery-train P8 bisect: the culprit last of three is found with one probe, in the order the design gives', () => {
  const probes = [];
  const found = train.findCulprit(3, (mid) => { probes.push(mid); return { ok: mid < 2, output: `red at ${mid}` }; }, 'full red');
  assert.deepEqual(probes, [1]);
  assert.deepEqual([found.index, found.output], [2, 'full red']);
});

test('delivery-train P8 bisect: the culprit in the middle of four is found with two probes and its smallest red prefix is the failure', () => {
  const probes = [];
  const found = train.findCulprit(4, (mid) => { probes.push(mid); return { ok: mid < 2, output: `red at ${mid}` }; }, 'full red');
  assert.deepEqual(probes, [1, 2]);
  assert.deepEqual([found.index, found.output], [2, 'red at 2']);
});

test('delivery-train P8 bisect: the culprit first is the one prefix of one change, and a single change needs no probe', () => {
  const probes = [];
  const first = train.findCulprit(3, (mid) => { probes.push(mid); return { ok: false, output: `red at ${mid}` }; }, 'full red');
  assert.deepEqual(probes, [1, 0]);
  assert.deepEqual([first.index, first.output], [0, 'red at 0']);
  const lone = train.findCulprit(1, () => assert.fail('no probe for one change'), 'only red');
  assert.deepEqual([lone.index, lone.output], [0, 'only red']);
});

// ---------------------------------------------------------------- departure scenarios
const trainWorktree = (p, n) => join(p.t.main, '.claude', 'worktrees', `train-${n}`);
const heads = (p, ...ids) => ids.map((id) => git(p.t.main, 'rev-parse', `origin/${id}`));

test('delivery-train AC-4: one departure cuts train/<n>, joins in order, renumbers on the train only, opens one pull request; a second request starts none', () => {
  const p = project({ train: 'true', roadmap: roadmapOfIds('gamma'), files: RELEASE_BASE });
  p.t.commitOrigin({ 'openspec/trains/3.md': recordText({ n: 3, boarded: [{ id: 'old', number: 1, head: H('1') }] }) }, 'train 3 landed');
  const alpha = addChange(p, 'alpha', { files: bumpFiles('0.7.0', 'alpha'), at: '2026-11-23T10:00:00Z' });
  const beta = addChange(p, 'beta', { files: bumpFiles('0.7.0', 'beta'), at: '2026-11-23T10:10:00Z' });
  const gamma = addArchive(p, 'gamma', { at: '2026-11-23T10:05:00Z' });
  const gammaHead = git(gamma.wt, 'rev-parse', 'HEAD');
  const alphaHead = headOf(p, 'alpha');
  const betaHead = headOf(p, 'beta');

  const r = departIn(p);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.deepEqual([r.out.n, r.out.branch, r.out.result, r.out.worktree], [4, 'train/4', 'passed', trainWorktree(p, 4)]);
  assert.deepEqual(r.out.boarded.map((b) => [b.kind, b.id, b.number, b.head]), [['change', 'alpha', alpha.number, alphaHead], ['archive', 'gamma', gamma.number, gammaHead], ['change', 'beta', beta.number, betaHead]]);
  assert.deepEqual(r.out.left, []);

  // cut from origin/main, three merge commits in boarding order, then the record
  assert.equal(gitOf(p, 'merge-base', 'train/4', 'origin/main'), gitOf(p, 'rev-parse', 'origin/main'));
  const joins = gitOf(p, 'log', '--first-parent', '--reverse', '--merges', '--format=%P', 'origin/main..train/4').split('\n').map((l) => l.split(' '));
  assert.deepEqual(joins.map((parents) => parents[1]), [alphaHead, gammaHead, betaHead]);
  assert.equal(gitOf(p, 'log', '-1', '--format=%s', 'train/4'), 'chore(train): record train 4');
  assert.equal(gitOf(p, 'rev-parse', 'train/4'), git(trainWorktree(p, 4), 'rev-parse', 'HEAD'));
  assert.equal(git(trainWorktree(p, 4), 'rev-parse', '--abbrev-ref', 'HEAD'), 'train/4');
  assert.deepEqual(heads(p, 'alpha', 'beta'), [alphaHead, betaHead], 'no boarded branch moved');
  assert.equal(git(gamma.wt, 'rev-parse', 'HEAD'), gammaHead);
  assert.equal(gitOf(p, 'ls-remote', '--heads', 'origin', 'train/4'), '', 'nothing is pushed');

  // the release is renumbered on the train only
  assert.equal(JSON.parse(showOn(p, 'train/4', 'plugins/a/.claude-plugin/plugin.json')).version, '0.8.0');
  const changelog = showOn(p, 'train/4', 'CHANGELOG.md');
  assert.ok(changelog.indexOf('## 0.8.0 — beta') < changelog.indexOf('## 0.7.0 — alpha'), changelog);
  for (const id of ['alpha', 'beta']) assert.equal(JSON.parse(showOn(p, `origin/${id}`, 'plugins/a/.claude-plugin/plugin.json')).version, '0.7.0', id);
  noScratch(p);

  // the session steps that follow: push, open one pull request; a second request starts no train
  const push = nextIn(p).action;
  assert.deepEqual([push.kind, push.step], ['session', 'push-train']);
  assert.equal(perform(p, push).status, 0);
  const open = nextIn(p).action;
  assert.equal(open.step, 'open-train-pr');
  assert.equal(perform(p, open).status, 0);
  const trainPrs = () => p.sim.prs().filter((pr) => /^train\/\d+$/.test(pr.head));
  assert.equal(trainPrs().length, 1);
  assert.equal(trainPrs()[0].body.trim(), showOn(p, 'train/4', 'openspec/trains/4.md'), 'the body is the record');
  const again = nextIn(p);
  assert.notEqual(again.action.step, 'depart');
  assert.equal(again.action.step, 'enable-auto-merge');
  assert.equal(perform(p, again.action).status, 0);
  const waiting = nextIn(p);
  assert.deepEqual([waiting.code, waiting.action.kind, waiting.action.end.state, waiting.action.end.why], [1, 'end', 'waiting-on-github', 'train-auto-merge-on']);
  assert.equal(trainPrs().length, 1, 'a second request opens no second pull request');
  assert.deepEqual(gitOf(p, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/train'), 'train/4');
});

test('delivery-train AC-4: the boarding order is the time of the newest review commit, ties by pull request number, an archive by its head', () => {
  const p = project({ train: 'true', roadmap: roadmapOfIds('gamma') });
  const alpha = addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
  const beta = addChange(p, 'beta', { at: '2026-11-23T09:00:00Z' });
  const delta = addChange(p, 'delta', { at: '2026-11-23T10:00:00Z' });
  const gamma = addArchive(p, 'gamma', { at: '2026-11-23T09:30:00Z' });
  const set = train.boardedSet(p.t.main, { env: depEnv(p), tmp: p.scratch, base: 'main' });
  assert.deepEqual(set.boarded.map((b) => `${b.kind}:${b.id}`), ['change:beta', 'archive:gamma', 'change:alpha', 'change:delta']);
  assert.deepEqual(set.boarded.map((b) => b.number), [beta.number, gamma.number, alpha.number, delta.number]);
  assert.deepEqual(set.boarded.map((b) => b.at), ['2026-11-23T09:00:00Z', '2026-11-23T09:30:00Z', '2026-11-23T10:00:00Z', '2026-11-23T10:00:00Z']);
  assert.deepEqual(set.boarded.map((b) => b.head), [headOf(p, 'beta'), git(gamma.wt, 'rev-parse', 'HEAD'), headOf(p, 'alpha'), headOf(p, 'delta')]);
  noScratch(p);
});

test('delivery-train P9 boarded set: a change that is not boarded, a train head and a branch of two change names are left out', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  const failing = addChange(p, 'beta');
  p.sim.setChecks(failing.number, [CHECK('check', 'fail'), CHECK('devkit-reviews', 'pass')]);
  addChange(p, 'unproven');
  put(p.changes.unproven.wt, { 'src/unproven.txt': 'changed after the evidence\n' });
  commitAll(p.changes.unproven.wt, 'code after evidence');
  git(p.changes.unproven.wt, 'push', '-q', 'origin', 'unproven');
  const set = train.boardedSet(p.t.main, { env: depEnv(p), tmp: p.scratch, base: 'main' });
  assert.deepEqual(set.boarded.map((b) => b.id), ['alpha']);
  assert.deepEqual(set.skipped, [], 'a change that is simply not boarded is not a skipped pull request');
});

test('delivery-train P9 boarded set: a branch whose name holds two active change ids and equals neither is skipped and listed; the id equal to the last segment wins', () => {
  const other = (id) => ({ [`openspec/changes/${id}/.openspec.yaml`]: 'schema: devkit-lite\n', [`openspec/changes/${id}/proposal.md`]: PROPOSAL });
  const p = project({ train: 'true' });
  const clash = addChange(p, 'alpha', { branch: 'feat/alpha-beta', files: other('beta') });
  const none = deliver.nextStep(deliver.collectState(clash.wt, 'alpha', { env: { ...p.env, DEVKIT_BRANCH: 'feat/alpha-beta' } }));
  assert.equal(none.step, 'stop-branch', 'on its own the hooks cannot tell which of the two changes the branch selects, so it is not boarded; the departure skips it the same way');
  const set = train.boardedSet(p.t.main, { env: depEnv(p), tmp: p.scratch, base: 'main' });
  assert.deepEqual(set.boarded, []);
  assert.deepEqual(set.skipped.map((s) => [s.number, s.branch]), [[clash.number, 'feat/alpha-beta']]);
  assert.match(set.skipped[0].why, /alpha, beta/);

  const q = project({ train: 'true' });
  const tail = addChange(q, 'beta', { branch: 'feat/alpha-beta/beta', files: other('alpha') });
  const taken = train.boardedSet(q.t.main, { env: depEnv(q), tmp: q.scratch, base: 'main' });
  assert.deepEqual(taken.boarded.map((b) => [b.id, b.number]), [['beta', tail.number]]);
  assert.deepEqual(taken.skipped, []);
});

test('delivery-train AC-5: the suite runs once at the train\'s head, into the record committed on the train branch', () => {
  const counter = SUITE_COUNTER();
  const suite = `echo run >> ${counter}`;
  const p = project({ train: suite });
  addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
  addChange(p, 'beta', { at: '2026-11-23T10:10:00Z' });
  const r = departIn(p);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.equal(countRuns(counter), 1, 'one full run for the whole train');
  assert.equal(r.out.runs, 1);
  const record = recordOn(p, 'train/1', 1);
  assert.equal(record.error, undefined);
  assert.deepEqual([record.n, record.base, record.result, record.suite], [1, 'main', 'passed', suite]);
  assert.equal(record.baseSha, gitOf(p, 'rev-parse', 'origin/main'));
  assert.equal(record.ranAt, gitOf(p, 'rev-parse', 'train/1~1'), 'it names the head the suite ran at');
  assert.deepEqual(record.boarded.map((b) => [b.order, b.kind, b.id, b.number, b.head, b.at]), [
    [1, 'change', 'alpha', p.changes.alpha.number, headOf(p, 'alpha'), '2026-11-23T10:00:00Z'],
    [2, 'change', 'beta', p.changes.beta.number, headOf(p, 'beta'), '2026-11-23T10:10:00Z'],
  ]);
  assert.deepEqual(gitOf(p, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'train/1').split('\n'), ['openspec/trains/1.md'], 'the record is the only thing the last commit changes');
  assert.match(showOn(p, 'train/1', 'openspec/trains/1.md'), /^- Result: passed$/m);
  assert.equal(deliver.staleness(p.t.main, { sha: record.ranAt }, { head: gitOf(p, 'rev-parse', 'train/1'), dirty: [] }), null, 'the record does not stale itself');
  noScratch(p);
});

const PAIR_SUITE = 'if test -e src/alpha.txt && test -e src/beta.txt; then echo alpha-and-beta-clash; exit 1; fi';

test('delivery-train AC-7: two changes that pass alone and fail together: the later leaves with the failure, the rest departs after one more run', () => {
  const p = project({ train: PAIR_SUITE });
  addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
  addChange(p, 'beta', { at: '2026-11-23T10:10:00Z' });
  const r = departIn(p);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.deepEqual(r.out.boarded.map((b) => b.id), ['alpha']);
  assert.deepEqual(r.out.left.map((l) => [l.id, l.why]), [['beta', 'red']]);
  assert.equal(r.out.runs, 3, 'the full train (red), the prefix of alpha (green), then the rebuilt train (green)');
  const record = recordOn(p, 'train/1', 1);
  assert.equal(record.result, 'passed');
  assert.deepEqual(record.left.map((l) => [l.id, l.number, l.head, l.why]), [['beta', p.changes.beta.number, headOf(p, 'beta'), 'red']]);
  assert.match(record.left[0].failure, /alpha-and-beta-clash/);
  assert.equal(record.left[0].detail, 'Failure of `beta`, below');
  const runs = [...showOn(p, 'train/1', 'openspec/trains/1.md').matchAll(/^\| (\d) \| ([^|]*) \| `[0-9a-f]{40}` \| (\w+) \|$/gm)].map((m) => [m[1], m[2].trim(), m[3]]);
  assert.deepEqual(runs, [['1', 'alpha, beta', 'failed'], ['2', 'alpha', 'passed'], ['3', 'alpha', 'passed']]);
  assert.equal(showOn(p, 'train/1', 'src/alpha.txt'), 'alpha');
  assert.throws(() => showOn(p, 'train/1', 'src/beta.txt'), 'beta is not in the train');
  noScratch(p);
});

test('delivery-train P8: a culprit first with a green base leaves red and the others depart', () => {
  const p = project({ train: 'if test -e src/alpha.txt; then echo alpha-is-red; exit 1; fi' });
  addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
  addChange(p, 'beta', { at: '2026-11-23T10:10:00Z' });
  const r = departIn(p);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.deepEqual([r.out.boarded.map((b) => b.id), r.out.left.map((l) => [l.id, l.why])], [['beta'], [['alpha', 'red']]]);
  assert.match(recordOn(p, 'train/1', 1).left[0].failure, /alpha-is-red/);
  noScratch(p);
});

test('delivery-train P8: a culprit first with a red base blocks, nobody leaves and nothing is created', () => {
  const p = project({ train: 'echo the-base-is-red; exit 1' });
  addChange(p, 'alpha');
  addChange(p, 'beta');
  const r = departIn(p);
  assert.deepEqual([r.code, r.out.result], [2, 'base-red']);
  assert.equal(r.out.reply, render('en', 'train-base-red', { base: 'main' }));
  assert.deepEqual(gitOf(p, 'for-each-ref', 'refs/heads/train'), '');
  assert.equal(existsSync(trainWorktree(p, 1)), false);
  assert.deepEqual(r.out.left, []);
  noScratch(p);
});

// the text of one `## <name>` section of a record, up to the next `## ` heading
const sectionOf = (text, head) => { const from = text.indexOf(head); const next = text.indexOf('\n## ', from + head.length); return text.slice(from, next === -1 ? undefined : next); };

test('delivery-train P8: a train that empties leaves every change with its failure, writes its record outside the checkout and creates no train branch', () => {
  const p = project({ train: 'if test -e src/alpha.txt || test -e src/beta.txt; then echo not-green; exit 1; fi' });
  addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
  addChange(p, 'beta', { at: '2026-11-23T10:10:00Z' });
  const statusBefore = gitOf(p, 'status', '--porcelain');
  const refsBefore = gitOf(p, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads');
  const r = departIn(p);
  assert.deepEqual([r.code, r.out.result], [1, 'empty']);
  assert.deepEqual(r.out.left.map((l) => [l.id, l.why]), [['alpha', 'red'], ['beta', 'red']]);
  for (const l of r.out.left) assert.match(l.failure, /not-green/, `${l.id} keeps its failing output`);
  const common = gitOf(p, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  assert.ok(isAbsolute(r.out.record));
  assert.equal(r.out.record, join(common, 'devkit-trains', '1.md'));
  assert.equal(existsSync(r.out.record), true);
  const text = readFileSync(r.out.record, 'utf8');
  assert.equal(text.split('\n')[0], '<!-- devkit-train n=1 base=main result=empty -->');
  const boarded = sectionOf(text, '## Boarded').split('\n').slice(1).filter((l) => l.trim() !== '');
  assert.equal(boarded.filter((l) => /^\|/.test(l)).length, 2, 'the Boarded table has its header and separator rows and no data row');
  const leftSection = sectionOf(text, '## Left');
  for (const id of ['alpha', 'beta']) {
    assert.match(leftSection, new RegExp(`\\|[^\\n]*${id}[^\\n]*red`), `${id} has a Left row`);
    assert.match(text, new RegExp(`## Failure of \`${id}\`[\\s\\S]*?not-green`), `${id} has its failure block`);
  }
  assert.match(text, /\n## Runs/);
  assert.equal(r.out.reply, render('en', 'train-empty', { where: r.out.record }));
  assert.equal(existsSync(trainWorktree(p, 1)), false);
  assert.equal(gitOf(p, 'for-each-ref', 'refs/heads/train'), '');
  assert.equal(gitOf(p, 'status', '--porcelain'), statusBefore);
  assert.equal(gitOf(p, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'), refsBefore);
  noScratch(p);
  writeFileSync(r.out.record, 'stale\n');
  const again = departIn(p, { lang: 'pt-BR' });
  assert.equal(again.out.n, 1);
  assert.equal(again.out.record, r.out.record);
  const replaced = readFileSync(r.out.record, 'utf8');
  assert.equal(replaced.includes('stale'), false);
  assert.equal(replaced.split('\n')[0], '<!-- devkit-train n=1 base=main result=empty -->');
  assert.equal(again.out.reply, render('pt-BR', 'train-empty', { where: r.out.record }));
  noScratch(p);
});

const CONFLICT_BASE = { 'plugins/x/hooks/a.mjs': 'line 1\nline 2\nline 3\n', ...RELEASE_BASE };

test('train-empty-failure-text AC-4: a train emptied only by a conflict writes its record, and its left entry carries no failure', () => {
  const p = project({ train: 'true', files: CONFLICT_BASE });
  addChange(p, 'alpha', { files: { 'plugins/x/hooks/a.mjs': 'line 1\nalpha line 2\nline 3\n' } });
  const wt = join(tmpFolder('devkit-train-main-'), 'w');
  git(p.t.main, 'worktree', 'add', '-q', '--detach', wt, 'origin/main');
  put(wt, { 'plugins/x/hooks/a.mjs': 'line 1\nmain line 2\nline 3\n' });
  commitAll(wt, 'main edits the same line');
  git(wt, 'push', '-q', 'origin', 'HEAD:main');
  git(p.t.main, 'worktree', 'remove', '--force', wt);
  const r = departIn(p);
  assert.deepEqual([r.code, r.out.result], [1, 'empty']);
  assert.equal(r.out.left.length, 1);
  const [l] = r.out.left;
  assert.deepEqual([l.kind, l.id, l.why, l.detail, l.failure], ['change', 'alpha', 'conflict', '`plugins/x/hooks/a.mjs`', null]);
  assert.equal(l.number, p.changes.alpha.number);
  assert.equal(existsSync(r.out.record), true);
  const text = readFileSync(r.out.record, 'utf8');
  assert.match(text.split('\n')[0], /result=empty/);
  assert.match(sectionOf(text, '## Left'), /alpha[^\n]*conflict/);
  assert.equal(text.includes('## Failure of'), false);
  assert.equal(text.includes('## Runs'), false);
  assert.equal(r.out.reply, render('en', 'train-empty', { where: r.out.record }));
  assert.equal(gitOf(p, 'for-each-ref', 'refs/heads/train'), '');
  noScratch(p);
});

test('delivery-train AC-8: a release-only conflict is resolved by rule; a product conflict takes the change off with its path', () => {
  const p = project({ train: 'true', files: CONFLICT_BASE });
  addChange(p, 'alpha', { files: { ...bumpFiles('0.7.0', 'alpha'), 'plugins/x/hooks/a.mjs': 'line 1\nalpha line 2\nline 3\n' }, at: '2026-11-23T10:00:00Z' });
  addChange(p, 'beta', { files: { ...bumpFiles('0.7.0', 'beta'), 'plugins/x/hooks/a.mjs': 'line 1\nbeta line 2\nline 3\n' }, at: '2026-11-23T10:10:00Z' });
  addChange(p, 'delta', { files: bumpFiles('0.6.1', 'delta'), at: '2026-11-23T10:20:00Z' });
  const r = departIn(p);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.deepEqual(r.out.boarded.map((b) => b.id), ['alpha', 'delta']);
  assert.deepEqual(r.out.left.map((l) => [l.id, l.why, l.detail]), [['beta', 'conflict', '`plugins/x/hooks/a.mjs`']]);
  const record = recordOn(p, 'train/1', 1);
  assert.deepEqual(record.left.map((l) => [l.id, l.why, l.detail, l.failure]), [['beta', 'conflict', '`plugins/x/hooks/a.mjs`', null]]);
  assert.equal(showOn(p, 'train/1', 'plugins/x/hooks/a.mjs'), 'line 1\nalpha line 2\nline 3');
  assert.equal(JSON.parse(showOn(p, 'train/1', 'plugins/a/.claude-plugin/plugin.json')).version, '0.7.1', 'delta\'s patch is renumbered above alpha\'s minor');
  assert.equal(gitOf(p, 'status', '--porcelain', '--untracked-files=no'), '');
  assert.equal(git(trainWorktree(p, 1), 'status', '--porcelain'), '', 'no join is left half done');
  noScratch(p);
});

test('delivery-train AC-8: a conflict between two boarded changes names the one that came later, and the train still runs the suite once', () => {
  const counter = SUITE_COUNTER();
  const p = project({ train: `echo run >> ${counter}`, files: CONFLICT_BASE });
  addChange(p, 'alpha', { files: { 'plugins/x/hooks/a.mjs': 'line 1\nalpha line 2\nline 3\n' }, at: '2026-11-23T10:10:00Z' });
  addChange(p, 'beta', { files: { 'plugins/x/hooks/a.mjs': 'line 1\nbeta line 2\nline 3\n' }, at: '2026-11-23T10:00:00Z' });
  const r = departIn(p);
  assert.deepEqual([r.out.boarded.map((b) => b.id), r.out.left.map((l) => l.id)], [['beta'], ['alpha']]);
  assert.equal(countRuns(counter), 1);
});

test('delivery-train AC-4: nothing boarded creates nothing; a project without the key is blocked; a closed train is not under way', () => {
  const p = project({ train: 'true' });
  const none = departIn(p);
  assert.deepEqual([none.code, none.out.result, none.out.reply], [1, 'nothing', render('en', 'train-nothing')]);
  assert.equal(gitOf(p, 'for-each-ref', 'refs/heads/train'), '');
  const off = project({ train: null });
  const blocked = departIn(off);
  assert.deepEqual([blocked.code, blocked.out.reply], [2, render('en', 'train-off')]);
  noScratch(p);
});

test('delivery-train P9 depart: the train after a merged one takes the next number, counting branches and records', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  git(p.t.main, 'push', '-q', 'origin', 'HEAD:refs/heads/train/7');
  git(p.t.main, 'branch', 'train/9', 'HEAD');
  const r = departIn(p);
  assert.equal(r.out.n, 10);
});

// Found by the real run (AC-12): the branch is made from a commit, so it tracked nothing and `git branch -d` judged it against
// the main checkout's HEAD, which stays behind the base after the merge: the cleaning step could never delete it.
test('delivery-train P9 depart: the train branch tracks origin/<base>, so git branch -d accepts it once the base holds the merged train', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  const r = departIn(p);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.deepEqual([gitOf(p, 'config', 'branch.train/1.remote'), gitOf(p, 'config', 'branch.train/1.merge')], ['origin', 'refs/heads/main']);
  assert.equal(gitOf(p, 'rev-parse', '--abbrev-ref', 'train/1@{upstream}'), 'origin/main');
});

// ---------------------------------------------------------------- P9 depart: the lock

const lockOf = (p) => join(gitOf(p, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'devkit', 'train.lock');
function holdLock(p, hoursAgo) {
  const file = lockOf(p);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${process.pid}\n`);
  const when = new Date(Date.now() - hoursAgo * 3_600_000);
  utimesSync(file, when, when);
  return file;
}

test('delivery-train P9 depart: a lock younger than six hours stops the departure and names the file; one older is taken over and released', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  const file = holdLock(p, 1);
  const busy = departIn(p);
  assert.deepEqual([busy.code, busy.out.result, busy.out.lock], [1, 'running', file]);
  assert.equal(busy.out.reply, render('en', 'train-running', { where: file }));
  assert.equal(existsSync(file), true, 'the lock of the other departure is left alone');
  assert.equal(gitOf(p, 'for-each-ref', 'refs/heads/train'), '');
  holdLock(p, 7);
  const taken = departIn(p);
  assert.equal(taken.code, 0, JSON.stringify(taken.out));
  assert.equal(existsSync(file), false, 'the departure releases its lock');
});

test('delivery-train P9 depart: GitHub silent fails the departure with the error, and the lock is released', () => {
  const p = project({ train: 'true' });
  addChange(p, 'alpha');
  const down = () => ({ status: 1, stdout: '', stderr: 'HTTP 502: bad gateway', missing: false, timedOut: false });
  assert.throws(() => train.depart(p.t.main, { env: depEnv(p), tmp: p.scratch, lang: 'en', gh: down }), /502/);
  assert.equal(existsSync(lockOf(p)), false);
  noScratch(p);
});

// ---------------------------------------------------------------- P9 next: the rows N0 to N15
// A train branch of the departure's own: in its worktree under .claude/worktrees, with its record, not pushed.
function localTrain(p, n = 4, record = {}) {
  const wt = p.t.addWt(`train-${n}`, { branch: `train/${n}`, from: 'origin/main' });
  put(wt, { [`openspec/trains/${n}.md`]: recordText({ n, ranAt: p.t.originSha(), baseSha: p.t.originSha(), boarded: [boardedOf(p, 'alpha')], ...record }) });
  commitAll(wt, `chore(train): record train ${n}`);
  return wt;
}
// A commit on the local train branch (in a scratch worktree of it), pushed or not.
function commitOnTrain(p, n, files, { push = true } = {}) {
  const wt = join(p.scratch, `on-train-${n}`);
  git(p.t.main, 'worktree', 'add', '-q', wt, `train/${n}`);
  put(wt, files);
  const sha = commitAll(wt, 'work on the train');
  if (push) git(wt, 'push', '-q', 'origin', `train/${n}`);
  git(p.t.main, 'worktree', 'remove', '--force', wt);
  return sha;
}

test('delivery-train P9 N0: a project with no train, or a refused one, ends blocked with the setting\'s reply, in both languages', () => {
  for (const lang of ['en', 'pt-BR']) {
    const off = nextIn(project({ train: null }), { lang });
    assert.deepEqual(endOf(off), [2, 'end', 'blocked', 'train-off'], lang);
    assert.equal(off.action.reply, render(lang, 'train-off'), lang);
    const two = project({ config: `schema: devkit-lite\n${block('    model: two-prs\n    base: main\n    test_branch: develop\n', `    train: "${SUITE}"\n`)}` });
    const refused = nextIn(two, { lang });
    assert.deepEqual(endOf(refused), [2, 'end', 'blocked', 'train-model'], lang);
    assert.equal(refused.action.reply, render(lang, 'train-model'), lang);
    const noModel = nextIn(project({ config: `schema: devkit-lite\n${block('', `    train: "${SUITE}"\n`)}` }), { lang });
    assert.equal(noModel.action.end.why, 'train-no-model');
  }
  assert.match(render('en', 'train-off'), /devkit\.delivery\.train/);
});

test('delivery-train P9 N1: a departure under way ends waiting for the owner with the lock file, a lock older than six hours is not under way', () => {
  const p = project();
  addChange(p, 'alpha');
  const file = holdLock(p, 1);
  const busy = nextIn(p);
  assert.deepEqual(endOf(busy), [1, 'end', 'waiting-for-owner', 'train-running']);
  assert.equal(busy.action.detail.lock, file);
  assert.equal(busy.action.reply, render('en', 'train-running', { where: file }));
  holdLock(p, 7);
  assert.equal(nextIn(p).action.step, 'depart', 'an old lock is taken over by the departure');
});

test('delivery-train P9 N2: a train branch with its record that is not on origin is pushed from its worktree', () => {
  const p = project();
  addChange(p, 'alpha');
  const wt = localTrain(p, 4);
  const r = nextIn(p);
  assert.deepEqual([r.code, r.action.kind, r.action.step], [0, 'session', 'push-train']);
  assert.deepEqual(r.action.detail.command, ['git', '-C', wt, 'push', 'origin', 'train/4']);
  assert.ok(!r.action.detail.command.some((a) => /^(-f|--force(-with-lease)?)$/.test(a)), 'a plain push, never a force push');
  assert.equal(perform(p, r.action).status, 0);
  assert.equal(nextIn(p).action.step, 'open-train-pr', 'once pushed the next is the pull request');
});

test('delivery-train P9 N2: a local train that moved ahead of its open pull request is pushed too', () => {
  const p = project();
  addChange(p, 'alpha');
  liveTrain(p);
  assert.notEqual(nextIn(p).action.step, 'push-train', 'level with the pull request: nothing to push');
  commitOnTrain(p, 4, { 'openspec/trains/note.md': 'note\n' }, { push: false });
  const r = nextIn(p);
  assert.equal(r.action.step, 'push-train');
  assert.equal(r.action.detail.command.at(-1), 'train/4');
});

test('delivery-train P9 N3: a train on origin with no pull request opens one from the branch with the record as its body', () => {
  const p = project();
  addChange(p, 'alpha');
  addChange(p, 'beta');
  const wt = localTrain(p, 4, { boarded: [boardedOf(p, 'alpha'), boardedOf(p, 'beta')] });
  git(wt, 'push', '-q', 'origin', 'train/4');
  const r = nextIn(p);
  assert.deepEqual([r.code, r.action.step], [0, 'open-train-pr']);
  assert.deepEqual(r.action.detail.command, ['gh', 'pr', 'create', '--base', 'main', '--head', 'train/4', '--title', 'train 4: alpha, beta', '--body-file', join(wt, 'openspec', 'trains', '4.md')]);
});

test('delivery-train P9 N3: a train on origin with no checkout to read the record from ends blocked', () => {
  const p = project();
  addChange(p, 'alpha');
  const wt = localTrain(p, 4);
  git(wt, 'push', '-q', 'origin', 'train/4');
  git(p.t.main, 'worktree', 'remove', '--force', wt);
  const r = nextIn(p);
  assert.deepEqual(endOf(r), [2, 'end', 'blocked', 'train-blocked']);
  assert.match(r.action.reply, /train 4/);
});

test('delivery-train P9 N4: an open train behind the base is brought up to date by the departure, run in the background', () => {
  const p = project();
  addChange(p, 'alpha');
  const { number } = liveTrain(p);
  p.sim.setPr(number, { mergeStateStatus: 'BEHIND' });
  const r = nextIn(p);
  assert.deepEqual([r.code, r.action.kind, r.action.step], [0, 'session', 'update-train']);
  assert.deepEqual(r.action.detail.command, ['node', trainLoopFile, 'depart', '--update', '--lang', 'en']);
  assert.equal(r.action.detail.background, true);
  assert.equal(r.action.detail.number, number);
});

test('delivery-train P9 N5: a failing check of the open train ends blocked naming the check and its link', () => {
  const p = project();
  addChange(p, 'alpha');
  const { number } = liveTrain(p);
  p.sim.setChecks(number, [CHECK('check', 'fail'), CHECK('devkit-reviews', 'pass')]);
  const r = nextIn(p);
  assert.deepEqual(endOf(r), [2, 'end', 'blocked', 'train-blocked']);
  assert.match(r.action.reply, /check/);
  assert.match(r.action.reply, /https:\/\/github\.com\/o\/r\/actions\/runs\/77\/job\/1/);
  assert.deepEqual(r.action.detail.failing.map((f) => f.name), ['check']);
});

test('delivery-train P9 N6: a record that did not pass, is not current at the head or cannot be read ends blocked naming it', () => {
  const failed = project();
  addChange(failed, 'alpha');
  liveTrain(failed, 4, { result: 'failed' });
  const a = nextIn(failed);
  assert.deepEqual(endOf(a), [2, 'end', 'blocked', 'train-blocked']);
  assert.match(a.action.reply, /failed/);

  const stale = project();
  addChange(stale, 'alpha');
  liveTrain(stale, 4);
  commitOnTrain(stale, 4, { 'src/after-the-run.txt': 'product\n' });
  const b = nextIn(stale);
  assert.equal(b.action.end.why, 'train-blocked');
  assert.match(b.action.reply, /src\/after-the-run\.txt/);

  const current = project();
  addChange(current, 'alpha');
  liveTrain(current, 4);
  commitOnTrain(current, 4, { 'openspec/trains/extra.md': 'only openspec\n' });
  assert.notEqual(nextIn(current).action.end?.why, 'train-blocked', 'a later commit under openspec/ keeps the record current');

  const missing = project();
  addChange(missing, 'alpha');
  const n = missing.sim.create({ base: 'main', head: 'train/4', body: '' });
  git(missing.t.main, 'push', '-q', 'origin', 'HEAD:refs/heads/train/4');
  assert.ok(n);
  const c = nextIn(missing);
  assert.equal(c.action.end.why, 'train-blocked');
  assert.match(c.action.reply, /record/);
});

test('delivery-train P9 N7: a project whose repository does not allow merge commits ends blocked naming the setup, only in trunk-auto', () => {
  const noMerge = (p) => (args, opts) => {
    const r = p.sim.gh(p.t.main)(args, opts);
    if (args[0] === 'api' && args[1] === 'repos/{owner}/{repo}' && r.status === 0) return { ...r, stdout: JSON.stringify({ ...JSON.parse(r.stdout), allow_merge_commit: false }) };
    return r;
  };
  const p = project();
  addChange(p, 'alpha');
  liveTrain(p);
  const r = nextIn(p, { gh: noMerge(p) });
  assert.deepEqual(endOf(r), [2, 'end', 'blocked', 'train-blocked']);
  assert.match(r.action.reply, /merge commits|merge merges|allow_merge_commit/);
  assert.match(r.action.reply, /github-setup\.mjs --method merge/);
  const t = project({ model: 'trunk' });
  addChange(t, 'alpha');
  liveTrain(t);
  assert.notEqual(nextIn(t, { gh: noMerge(t) }).action.end?.why, 'train-blocked', 'trunk needs no auto-merge setup');
});

// Invariant: the blocked train reply lists the missing merge facts without the setup pointer each fact carries, and still names the
// one call that fixes them. Layer: nextAction (train-loop.mjs), through merge-setup.mjs's one strip helper. Suite: delivery-train.
test('setup AC-2 train: the blocked train reply lists the missing merge facts without the setup pointer', () => {
  const pointer = mergeSetupModule.SETUP_POINTER;
  assert.equal(typeof pointer, 'string', 'merge-setup.mjs exports the pointer');
  assert.match(pointer, /\/devkit setup/);
  assert.equal(typeof mergeSetupModule.withoutSetupPointer, 'function', 'merge-setup.mjs exports the strip');
  const noMerge = (p) => (args, opts) => {
    const r = p.sim.gh(p.t.main)(args, opts);
    if (args[0] === 'api' && args[1] === 'repos/{owner}/{repo}' && r.status === 0) return { ...r, stdout: JSON.stringify({ ...JSON.parse(r.stdout), allow_merge_commit: false }) };
    return r;
  };
  const p = project();
  addChange(p, 'alpha');
  liveTrain(p);
  const r = nextIn(p, { gh: noMerge(p) });
  assert.deepEqual(endOf(r), [2, 'end', 'blocked', 'train-blocked']);
  const { reply, detail } = r.action;
  assert.match(reply, /merge merges are not allowed \(allow_merge_commit\)/);
  assert.ok(!reply.includes(pointer), reply);
  assert.doesNotMatch(reply, /run the GitHub step/);
  assert.ok(detail.error.endsWith('github-setup.mjs --method merge allows merge commits and auto-merge'), detail.error);
  assert.ok(reply.includes(`${detail.error}.`), 'the reply holds the error as written');
});

test('delivery-train P9 N8: trunk-auto with auto-merge off enables it with --merge, pinned to the train head', () => {
  const p = project();
  addChange(p, 'alpha');
  const { number, head } = liveTrain(p);
  const r = nextIn(p);
  assert.deepEqual([r.code, r.action.kind, r.action.step], [0, 'session', 'enable-auto-merge']);
  assert.deepEqual(r.action.detail.command, ['gh', 'pr', 'merge', String(number), '--auto', '--merge', '--match-head-commit', head]);
  assert.equal(perform(p, r.action).status, 0);
  assert.equal(p.sim.pr(number).autoMerge, 'merge');
  assert.ok(p.sim.calls().some((c) => c.join(' ') === `pr merge ${number} --auto --merge --match-head-commit ${head}`));
});

test('delivery-train P9 N9: trunk-auto with auto-merge on waits on GitHub for the merge', () => {
  const p = project();
  addChange(p, 'alpha');
  const { number } = liveTrain(p);
  p.sim.setAutoMerge(number, 'merge');
  const r = nextIn(p);
  assert.deepEqual(endOf(r), [1, 'end', 'waiting-on-github', 'train-auto-merge-on']);
  assert.equal(r.action.reply, render('en', 'train-auto-merge-on', { n: 4, number }));
  assert.equal(r.action.detail.number, number);
});

test('delivery-train P9 N10 and N11: trunk waits on GitHub while checks run, then for the owner, and never enables auto-merge', () => {
  const p = project({ model: 'trunk' });
  addChange(p, 'alpha');
  const { number } = liveTrain(p);
  p.sim.setChecks(number, PENDING);
  const pending = nextIn(p);
  assert.deepEqual(endOf(pending), [1, 'end', 'waiting-on-github', 'train-checks']);
  assert.equal(pending.action.reply, render('en', 'train-checks', { n: 4, number }));
  p.sim.setChecks(number, GREEN);
  const ready = nextIn(p);
  assert.deepEqual(endOf(ready), [1, 'end', 'waiting-for-owner', 'train-ready']);
  assert.equal(ready.action.reply, render('en', 'train-ready', { n: 4, number }));
  assert.equal(p.sim.calls().some((c) => c.includes('--auto')), false);
});

test('delivery-train P9 N12: a merged train with a boarded pull request still open at the listed head closes it with the comment', () => {
  const p = project();
  const alpha = addChange(p, 'alpha');
  const beta = addChange(p, 'beta');
  const merged = liveTrain(p, 4, { boarded: [boardedOf(p, 'alpha'), boardedOf(p, 'beta')] }, { merged: true });
  p.sim.merge(alpha.number); // GitHub marks alpha merged; beta's pull request stays open
  const mergeCommit = p.sim.pr(merged.number).mergeCommit;
  const r = nextIn(p);
  assert.deepEqual([r.code, r.action.kind, r.action.step], [0, 'session', 'close-boarded-pr']);
  const comment = `Delivered by train 4 in #${merged.number} (merge commit ${mergeCommit.slice(0, 7)}).`;
  assert.deepEqual(r.action.detail.command, ['gh', 'pr', 'close', String(beta.number), '--comment', comment]);
  assert.deepEqual([r.action.detail.number, r.action.detail.train, r.action.detail.trainNumber, r.action.detail.comment], [beta.number, 4, merged.number, comment]);
  assert.equal(perform(p, r.action).status, 0);
  assert.equal(p.sim.pr(beta.number).state, 'CLOSED');
  assert.notEqual(nextIn(p).action.step, 'close-boarded-pr', 'once closed, the next call goes on');
});

test('delivery-train P9 N12: a pull request that moved after the record is not the boarded one and is left alone', () => {
  const p = project();
  const alpha = addChange(p, 'alpha');
  liveTrain(p, 4, { boarded: [{ kind: 'change', id: 'alpha', number: alpha.number, head: H('9') }] }, { merged: true });
  assert.notEqual(nextIn(p).action.step, 'close-boarded-pr');
});

test('delivery-train P9 N13: a merged train\'s worktree is removed, then its local branch deleted, and nothing else', () => {
  const p = project();
  addChange(p, 'alpha');
  const wt = localTrain(p, 4);
  git(wt, 'push', '-q', 'origin', 'train/4');
  const number = p.sim.create({ base: 'main', head: 'train/4', body: '' });
  p.sim.merge(number);
  p.sim.merge(p.changes.alpha.number);
  const first = nextIn(p);
  assert.deepEqual([first.code, first.action.kind, first.action.step], [0, 'session', 'clean-train']);
  assert.deepEqual(first.action.detail.command, ['git', '-C', p.t.main, 'worktree', 'remove', wt]);
  assert.equal(perform(p, first.action).status, 0);
  assert.equal(existsSync(wt), false);
  const second = nextIn(p);
  assert.equal(second.action.step, 'clean-train');
  assert.deepEqual(second.action.detail.command, ['git', '-C', p.t.main, 'branch', '-d', 'train/4']);
  assert.ok(gitOf(p, 'worktree', 'list').includes('alpha'), 'the worktrees of the changes stay');
});

// Found by the real run (AC-12): `git branch -d` refuses a branch its upstream does not hold, and the train branch tracks
// `origin/<base>`, which no call had fetched since the merge: the step failed and, being before the departure, blocked every
// later train. `next` fetches `origin` before it gives the branch step, and gives it only when `git branch -d` can succeed.
test('delivery-train P9 N13: next fetches origin before the branch step, so a stale origin/<base> does not make git refuse the deletion', () => {
  const p = project();
  addChange(p, 'alpha');
  const wt = localTrain(p, 4);
  git(wt, 'push', '-q', 'origin', 'train/4');
  const number = p.sim.create({ base: 'main', head: 'train/4', body: '' });
  p.sim.merge(number);
  p.sim.merge(p.changes.alpha.number);
  assert.equal(spawnSync('git', ['-C', p.t.main, 'merge-base', '--is-ancestor', 'train/4', 'origin/main'], { env: GIT_ENV }).status, 1, 'the main checkout has not seen the merge');
  assert.equal(perform(p, nextIn(p).action).status, 0, 'the worktree goes first');
  const branch = nextIn(p);
  assert.deepEqual([branch.action.step, branch.action.detail.command], ['clean-train', ['git', '-C', p.t.main, 'branch', '-d', 'train/4']]);
  const deleted = perform(p, branch.action);
  assert.equal(deleted.status, 0, deleted.stderr);
  assert.equal(spawnSync('git', ['-C', p.t.main, 'rev-parse', '--verify', '-q', 'refs/heads/train/4'], { env: GIT_ENV }).status, 1, 'the branch is gone');
});

test('delivery-train P9 N13: a train branch its upstream does not hold (the owner squashed the merge) is left, and the run goes on', () => {
  const p = project();
  addChange(p, 'alpha');
  const wt = localTrain(p, 4);
  git(wt, 'push', '-q', 'origin', 'train/4');
  const number = p.sim.create({ base: 'main', head: 'train/4', body: '' });
  p.sim.merge(number, 'squash');
  p.sim.merge(p.changes.alpha.number);
  assert.equal(perform(p, nextIn(p).action).status, 0, 'the worktree goes first');
  const left = nextIn(p);
  assert.notEqual(left.action.step, 'clean-train', JSON.stringify(left.action));
  assert.deepEqual(endOf(left), [1, 'end', 'waiting-for-owner', 'train-nothing']);
  assert.equal(gitOf(p, 'rev-parse', '--verify', 'refs/heads/train/4').length, 40, 'the branch stays: it is never forced');
});

// Found by the real run (AC-12): the skill passes `--after <progressKey>` after every session action, and the two clean-train
// steps of one merged train had the same key, so the second was refused as "done and changed nothing".
test('delivery-train P9 N13: the worktree step and the branch step carry different progress keys, so --after never blocks the second', () => {
  const p = project();
  addChange(p, 'alpha');
  const wt = localTrain(p, 4);
  git(wt, 'push', '-q', 'origin', 'train/4');
  const number = p.sim.create({ base: 'main', head: 'train/4', body: '' });
  p.sim.merge(number);
  p.sim.merge(p.changes.alpha.number);
  const first = nextIn(p);
  assert.equal(perform(p, first.action).status, 0);
  const second = nextIn(p, { after: first.action.progressKey });
  assert.deepEqual([second.code, second.action.kind, second.action.step], [0, 'session', 'clean-train'], JSON.stringify(second.action));
  assert.deepEqual(second.action.detail.command, ['git', '-C', p.t.main, 'branch', '-d', 'train/4']);
  assert.notEqual(second.action.progressKey, first.action.progressKey);
  const deleted = perform(p, second.action);
  assert.equal(deleted.status, 0, deleted.stderr);
  const done = nextIn(p, { after: second.action.progressKey });
  assert.notEqual(done.action.step, 'clean-train', 'nothing is left to clean');
  assert.notEqual(done.action.end?.why, 'train-blocked', 'and the call is not refused as a repeat');
});

test('delivery-train P9 N14: with nothing boarded the run ends waiting for the owner and creates nothing', () => {
  const p = project();
  const r = nextIn(p);
  assert.deepEqual(endOf(r), [1, 'end', 'waiting-for-owner', 'train-nothing']);
  assert.equal(r.action.reply, render('en', 'train-nothing'));
  assert.equal(gitOf(p, 'for-each-ref', 'refs/heads/train'), '');
  noScratch(p);
});

test('delivery-train P9 N15: boarded changes and archives give the departure as a session step, run in the background', () => {
  const p = project({ roadmap: roadmapOfIds('gamma') });
  addChange(p, 'alpha', { at: '2026-11-23T10:00:00Z' });
  addArchive(p, 'gamma', { at: '2026-11-23T10:05:00Z' });
  const r = nextIn(p);
  assert.deepEqual([r.code, r.action.kind, r.action.step], [0, 'session', 'depart']);
  assert.deepEqual(r.action.detail.command, ['node', trainLoopFile, 'depart', '--lang', 'en']);
  assert.equal(r.action.detail.background, true);
  assert.deepEqual(r.action.detail.boarded.map((b) => `${b.kind}:${b.id}`), ['change:alpha', 'archive:gamma']);
  assert.equal(gitOf(p, 'for-each-ref', 'refs/heads/train'), '', 'next never departs by itself');
  noScratch(p);
});

test('delivery-train P9 N15: a closed train is not under way, so its boarded changes depart again', () => {
  const p = project();
  addChange(p, 'alpha');
  liveTrain(p, 4, {}, { closed: true });
  const r = nextIn(p);
  assert.equal(r.action.step, 'depart');
  assert.equal(r.action.detail.boarded.length, 1);
});

test('delivery-train P9 next: the same session step twice in a row ends blocked, and a different one goes on', () => {
  const p = project();
  addChange(p, 'alpha');
  const first = nextIn(p);
  assert.equal(first.action.step, 'depart');
  assert.match(first.action.progressKey, /^depart@/);
  const stuck = nextIn(p, { after: first.action.progressKey });
  assert.deepEqual(endOf(stuck), [2, 'end', 'blocked', 'train-blocked']);
  assert.equal(nextIn(p, { after: 'push-train@4' }).action.step, 'depart');
});
