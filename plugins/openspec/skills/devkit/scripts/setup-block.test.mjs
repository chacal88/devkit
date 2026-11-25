// Tests for setup-block.mjs, the writer of the `devkit:` block of `/devkit setup` (project-setup D-3). Run by
// `node scripts/test-suite.mjs`, in a process of its own; alone:
// `node scripts/test-suite.mjs plugins/openspec/skills/devkit/scripts/setup-block.test.mjs`.
// Every test spawns the script, so each one fails on its own while the script is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, realpathSync, utimesSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readDevkitSettings } from '../../../hooks/change-loop.mjs';
import { deliveryConfig } from '../../../hooks/deliver-check.mjs';
import { tmpFolder } from '../../../hooks/test-tmp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'setup-block.mjs');
const TEMPLATE = readFileSync(join(here, '..', 'templates', 'config.yaml'), 'utf8');
const PACK_VERSION = JSON.parse(readFileSync(join(here, '..', '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
const BLANKS = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
const ENV = { ...process.env, ...BLANKS };
const HEADING = '# The settings of /devkit, written by /devkit setup.';
const ALL_KEYS = ['language', 'driver', 'delivery', 'tests.unit', 'tests.coverage.command', 'tests.coverage.target', 'tests.e2e', 'ship', 'merge_method'];

// A project folder: `config` is the text of openspec/config.yaml (null: no file); `files` maps other paths to their text.
function project(config, files = {}) {
  const root = realpathSync(tmpFolder('devkit-setup-block-'));
  if (config !== null) {
    mkdirSync(join(root, 'openspec'), { recursive: true });
    writeFileSync(join(root, 'openspec', 'config.yaml'), config);
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const configFile = (root) => join(root, 'openspec', 'config.yaml');
const configOf = (root) => readFileSync(configFile(root), 'utf8');
function run(args, input = '') {
  const r = spawnSync('node', [SCRIPT, ...args], { input, encoding: 'utf8', env: ENV });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
function plan(root) {
  const r = run(['plan', root, '--json']);
  assert.equal(r.code, 0, r.err);
  return JSON.parse(r.out);
}
const apply = (root, answers) => run(['apply', root], typeof answers === 'string' ? answers : JSON.stringify(answers));
function applied(root, answers) {
  const r = apply(root, answers);
  assert.equal(r.code, 0, r.err);
  return JSON.parse(r.out);
}
const keysOf = (p) => p.missing.map((m) => m.key);
const entry = (p, key) => p.missing.find((m) => m.key === key);
// A refusal: exit 3, one stderr line that matches `pattern`, nothing on standard output and the config as it was.
function refused(root, answers, pattern, label) {
  const before = existsSync(configFile(root)) ? configOf(root) : null;
  const r = apply(root, answers);
  assert.equal(r.code, 3, `${label}: ${r.out}${r.err}`);
  assert.match(r.err, pattern, label);
  assert.equal(r.err.trim().split('\n').length, 1, `${label}: one stderr line`);
  assert.equal(r.out, '', label);
  assert.equal(existsSync(configFile(root)) ? configOf(root) : null, before, `${label}: nothing written`);
}

// Invariant: with no config every key the setup asks is missing, with its default, and only the built drivers are offered.
// Layer: setup-block plan. Suite: setup-block.
test('setup AC-3 block plan: no config gives every key missing with its default, drivers claude and compozy', () => {
  const root = project(null);
  const p = plan(root);
  assert.equal(p.version, 1);
  assert.deepEqual([p.config, p.block, p.kit], ['absent', 'absent', 'absent']);
  assert.deepEqual(keysOf(p), ALL_KEYS);
  assert.deepEqual(p.drivers, ['claude', 'compozy']);
  assert.equal(entry(p, 'language').default, 'en');
  assert.deepEqual([entry(p, 'driver').default, entry(p, 'driver').options], ['claude', ['claude', 'compozy']]);
  assert.deepEqual([entry(p, 'delivery').default, entry(p, 'delivery').options], ['none', ['none', 'trunk', 'trunk-auto', 'two-prs']]);
  assert.equal(entry(p, 'delivery').proposed.base, 'main', 'no origin/HEAD: base main is proposed');
  for (const key of ['tests.unit', 'tests.coverage.command', 'tests.coverage.target', 'tests.e2e']) assert.equal(entry(p, key).proposed, null, key);
  assert.deepEqual([entry(p, 'ship').default, entry(p, 'ship').options], ['merge', ['plan', 'pr', 'merge']]);
  assert.deepEqual([entry(p, 'merge_method').default, entry(p, 'merge_method').options], ['squash', ['squash', 'merge', 'rebase']]);
  assert.deepEqual(p.kept, []);
  assert.equal(p.driverNotBuilt, null);
  assert.equal(p.releaseFile, null);
  assert.equal(p.ciPin, null);
  assert.deepEqual(p.fill, ['schema', 'context', 'rules', 'operations']);
  assert.deepEqual(readdirSync(root), [], 'plan writes nothing');

  const pnpm = project(null, {
    'package.json': JSON.stringify({ name: 'x', scripts: { test: 'vitest', coverage: 'vitest --coverage', 'test:e2e': 'playwright test' } }),
    'pnpm-lock.yaml': '',
    'playwright.config.ts': '',
  });
  const q = plan(pnpm);
  assert.deepEqual(keysOf(q), ALL_KEYS, 'a package.json with no version asks no release_tag');
  assert.deepEqual(['tests.unit', 'tests.coverage.command', 'tests.coverage.target', 'tests.e2e'].map((k) => entry(q, k).proposed),
    ['pnpm test', 'pnpm run coverage', null, 'pnpm run test:e2e']);
  const make = plan(project(null, { Makefile: 'test:\n\tgo test ./...\n', 'package.json': JSON.stringify({ scripts: { e2e: 'cypress run' } }) }));
  assert.equal(entry(make, 'tests.unit').proposed, 'make test');
  assert.equal(entry(make, 'tests.e2e').proposed, null, 'no playwright or cypress config: no e2e proposal');
});

// Invariant: a driver that is not built is kept as it is, with its round, and never offered. Layer: setup-block plan. Suite: setup-block.
test('setup AC-6 block plan: a present driver: script is kept with its round and never offered', () => {
  const root = project('schema: devkit\ndevkit:\n  driver: script\n');
  const p = plan(root);
  assert.equal(p.driverNotBuilt.driver, 'script');
  assert.equal(typeof p.driverNotBuilt.round, 'number');
  assert.equal(p.present.driver, 'script');
  assert.equal(keysOf(p).includes('driver'), false);
  assert.equal(p.drivers.includes('script'), false);
  refused(root, { driver: 'claude' }, /driver/, 'the present driver is not replaced');
});

// Invariant: a first answer set writes one block the loop reads with no refused value, and the template's budget and design
// examples stay comments. Layer: setup-block apply. Suite: setup-block.
test('setup AC-3 block apply: a first answer set appends the block, readDevkitSettings reads it with no unknown, and budget and design stay comments', () => {
  const root = project(null);
  const out = applied(root, {
    language: 'pt-BR', driver: 'compozy', delivery: { model: 'two-prs', base: 'main', test_branch: 'develop' },
    tests: { unit: 'npm test', coverage: { command: 'npm run coverage', target: 80 }, e2e: 'npm run e2e' },
  });
  assert.deepEqual(out, { file: 'created', added: ['language', 'driver', 'delivery', 'tests.unit', 'tests.coverage.command', 'tests.coverage.target', 'tests.e2e'] });
  const text = configOf(root);
  assert.equal(text, `${TEMPLATE}\n${HEADING}\ndevkit:\n  language: pt-BR\n  driver: compozy\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: develop\n`
    + '  tests:\n    unit: "npm test"\n    coverage:\n      command: "npm run coverage"\n      target: 80\n    e2e: "npm run e2e"\n');
  const settings = readDevkitSettings(root);
  assert.deepEqual(settings.unknown, []);
  assert.equal(settings.missing, undefined);
  assert.deepEqual([settings.language, settings.driver, settings.delivery], ['pt-BR', 'compozy', { model: 'two-prs', base: 'main', testBranch: 'develop' }]);
  assert.match(text, /^#   budget: \d+/m);
  assert.match(text, /^# design:/m);
  assert.doesNotMatch(text, /^\s*budget:/m);
  assert.doesNotMatch(text, /^design:/m);

  const merging = project(null);
  assert.deepEqual(applied(merging, { ship: 'merge', merge_method: 'squash' }), { file: 'created', added: ['ship', 'merge_method'] });
  assert.equal(configOf(merging), `${TEMPLATE}\nship:\n  devkit-lite: merge\n  devkit: merge\n  devkit-project: merge\nmerge_method: squash\n`);
  assert.deepEqual([deliveryConfig(merging, 'devkit').ship, deliveryConfig(merging, 'devkit').mergeMethod], ['merge', 'squash']);
});

// Invariant: the default delivery answer `none` writes no delivery key, so the loop reads no unknown model.
// Layer: setup-block apply. Suite: setup-block.
test('setup AC-3 block apply: the default delivery answer none on a project with no train writes no delivery and leaves no unknown value', () => {
  const root = project(null);
  const out = applied(root, { delivery: { model: 'none' }, language: 'en' });
  assert.deepEqual(out, { file: 'created', added: ['language'] });
  assert.equal(configOf(root), `${TEMPLATE}\n${HEADING}\ndevkit:\n  language: en\n`);
  assert.deepEqual(readDevkitSettings(root).unknown, []);
  assert.equal(deliveryConfig(root, 'devkit').model, null);
});

// Invariant: a delivery model answered in the same call decides what else may be answered: trunk-auto takes a merge_method and
// no ship map, and a model refuses a ship answer. Layer: setup-block apply. Suite: setup-block.
test('setup AC-7 block apply: a model answered in the same call accepts trunk-auto with merge_method and no ship map, and refuses trunk with a ship answer', () => {
  const auto = project(null);
  assert.deepEqual(applied(auto, { delivery: { model: 'trunk-auto' }, merge_method: 'squash' }), { file: 'created', added: ['delivery', 'merge_method'] });
  assert.equal(configOf(auto), `${TEMPLATE}\n${HEADING}\ndevkit:\n  delivery:\n    model: trunk-auto\n\nmerge_method: squash\n`);
  assert.doesNotMatch(configOf(auto), /^ship\s*:/m);
  const config = deliveryConfig(auto, 'devkit');
  assert.deepEqual([config.model, config.ship, config.mergeMethod], ['trunk-auto', 'merge', 'squash']);

  const trunk = project('schema: devkit\n');
  refused(trunk, { delivery: { model: 'trunk' }, ship: 'merge' }, /^setup-block: ship: not missing/, 'trunk with a ship answer');
  assert.deepEqual([deliveryConfig(trunk, 'devkit').model, deliveryConfig(trunk, 'devkit').ship], [null, 'plan'], 'the refused call wrote nothing');
});

// Invariant: a re-run with nothing missing does not touch the file. Layer: setup-block apply. Suite: setup-block.
test('setup AC-4 block apply: nothing missing leaves the file byte-identical and unwritten', () => {
  const config = 'schema: devkit\ndevkit:\n  language: en\n  driver: claude\n  delivery:\n    model: trunk\n  tests:\n    unit: "npm test"\n'
    + '    coverage:\n      command: "npm run coverage"\n      target: 80\n    e2e: "npm run e2e"\n';
  const root = project(config);
  assert.deepEqual(plan(root).missing, []);
  const old = new Date('2020-01-01T00:00:00Z');
  utimesSync(configFile(root), old, old);
  for (const answers of [{}, { language: null, tests: null, delivery: null }]) {
    const r = apply(root, answers);
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(JSON.parse(r.out), { file: 'unchanged', added: [] });
  }
  assert.equal(configOf(root), config);
  assert.equal(statSync(configFile(root)).mtimeMs, old.getTime());
});

// Invariant: a missing child of a present map goes under that map, and every other line keeps its place and bytes.
// Layer: setup-block apply. Suite: setup-block.
test('setup AC-4 block apply: one missing tests key is inserted under tests and nothing else moves', () => {
  const before = ['schema: devkit', 'devkit:', '  language: en   # the files', '  tests:', '    unit: "npm test"', '    coverage:',
    '      command: "npm run coverage"', '      target: 80', '', '# Who merges', 'ship:', '  devkit: pr', ''];
  const root = project(before.join('\n'));
  assert.equal(keysOf(plan(root)).includes('tests.e2e'), true);
  assert.deepEqual(applied(root, { tests: { e2e: 'npm run e2e' } }), { file: 'updated', added: ['tests.e2e'] });
  const after = [...before];
  after.splice(8, 0, '    e2e: "npm run e2e"');
  assert.equal(configOf(root), after.join('\n'));
  assert.deepEqual(readDevkitSettings(root).unknown, []);
});

// Invariant: a re-run keeps every value already held: an answer for a key that is not missing writes nothing.
// Layer: setup-block apply. Suite: setup-block.
test('setup AC-4 block apply: an answer for a key already present is refused and nothing is written', () => {
  const root = project('schema: devkit\ndevkit:\n  language: en\n');
  refused(root, { language: 'pt-BR' }, /language/, 'a present language');
  refused(root, { driver: 'claude', language: 'pt-BR' }, /language/, 'one refused answer refuses the set');
  refused(root, { budget: 1000 }, /budget/, 'budget is never asked');
});

// Invariant: only a driver that runs is written. Layer: setup-block apply. Suite: setup-block.
test('setup AC-6 block apply: a driver not offered is refused', () => {
  const root = project('schema: devkit\n');
  refused(root, { driver: 'script' }, /driver.*claude, compozy/, 'script');
  refused(root, { driver: 'robot' }, /driver.*claude, compozy/, 'robot');
});

// Invariant: release_tag is asked only when the project's package.json carries a version. Layer: setup-block plan. Suite: setup-block.
test('setup AC-3 block plan: release_tag is asked only with a package.json version', () => {
  const versioned = project('schema: devkit\n', { 'package.json': JSON.stringify({ name: 'x', version: '1.2.3' }) });
  const p = plan(versioned);
  assert.equal(p.releaseFile, 'package.json');
  assert.equal(entry(p, 'release_tag').default, 'package.json');
  assert.deepEqual(applied(versioned, { release_tag: 'package.json' }).added, ['release_tag']);
  assert.equal(readDevkitSettings(versioned).releaseTag, 'package.json');
  for (const pkg of [JSON.stringify({ name: 'x' }), JSON.stringify({ name: 'x', version: 3 })]) {
    const q = plan(project('schema: devkit\n', { 'package.json': pkg }));
    assert.equal(q.releaseFile, null, pkg);
    assert.equal(entry(q, 'release_tag'), undefined, pkg);
  }
});

// Invariant: the ship mode is asked, merge suggested, only when nothing decides it yet, and the merge method only when the mode
// merges. Layer: setup-block plan. Suite: setup-block.
test('setup AC-7 block plan: ship is asked with merge suggested only with no ship map and no model, and merge_method only when the mode merges', () => {
  const asked = (config) => keysOf(plan(project(config))).filter((k) => k === 'ship' || k === 'merge_method');
  assert.deepEqual(asked('schema: devkit\n'), ['ship', 'merge_method'], 'no model, no ship map');
  assert.deepEqual(asked('schema: devkit\ndevkit:\n  delivery:\n    model: trunk-auto\n'), ['merge_method'], 'trunk-auto merges');
  assert.deepEqual(asked('schema: devkit\ndevkit:\n  delivery:\n    model: trunk\n'), [], 'trunk is pr');
  assert.deepEqual(asked('schema: devkit\nship:\n  devkit-lite: pr\n  devkit: pr\n'), [], 'a ship map in pr');
  assert.deepEqual(asked('schema: devkit\nship:\n  devkit-lite: plan\n  devkit: merge\n'), ['merge_method'], 'a ship map that merges');
  assert.deepEqual(asked('schema: devkit\nship:\n  devkit: merge\nmerge_method: merge\n'), [], 'a merge_method already set');
  const root = project('schema: devkit\n');
  refused(root, { ship: 'pr', merge_method: 'squash' }, /merge_method/, 'a pr answer does not merge');
});

// Invariant: a present value the loop refuses is reported and kept, never asked again. Layer: setup-block plan. Suite: setup-block.
test('setup AC-4 block plan: a refused language value is kept and listed, not asked', () => {
  const root = project('schema: devkit\ndevkit:\n  language: xx_bad\n');
  const p = plan(root);
  assert.deepEqual(p.kept, [{ setting: 'language', value: 'xx_bad', accepted: 'a language tag such as en or pt-BR' }]);
  assert.equal(p.present.language, 'xx_bad');
  assert.equal(keysOf(p).includes('language'), false);
  refused(root, { language: 'en' }, /language/, 'the kept value is not replaced');
});

// Invariant: the writer keeps the file's line endings and reads an empty file as no block. Layer: setup-block apply. Suite: setup-block.
test('setup AC-3 block parser: CRLF kept, a missing final newline added, an empty file read as no block', () => {
  const crlf = project('schema: devkit\r\ndevkit:\r\n  language: en\r\n');
  applied(crlf, { driver: 'claude' });
  assert.equal(configOf(crlf), 'schema: devkit\r\ndevkit:\r\n  language: en\r\n  driver: claude\r\n');

  const noNewline = project('schema: devkit\ndevkit:\n  language: en');
  applied(noNewline, { driver: 'claude' });
  assert.equal(configOf(noNewline), 'schema: devkit\ndevkit:\n  language: en\n  driver: claude\n');

  const empty = project('');
  const p = plan(empty);
  assert.deepEqual([p.config, p.block], ['present', 'absent']);
  applied(empty, { language: 'en' });
  assert.equal(configOf(empty), `${HEADING}\ndevkit:\n  language: en\n`);
});

// Invariant: a CRLF config is read as its LF twin, so a re-run asks no key the file holds and writes no duplicate.
// Layer: setup-block plan (the shared readers parseDevkitBlock and readTestSettings). Suite: setup-block.
test('setup AC-4 block plan: after apply on a CRLF config, plan asks none of the keys the file holds and a second answer is refused', () => {
  const root = project('schema: devkit\r\ndevkit:\r\n  language: en\r\n');
  applied(root, { driver: 'claude', tests: { unit: 'npm test', coverage: { target: 80 } } });
  const p = plan(root);
  for (const key of ['language', 'driver', 'tests.unit', 'tests.coverage.target']) assert.equal(keysOf(p).includes(key), false, key);
  assert.deepEqual([p.present.language, p.present.driver, p.present.tests.unit, p.present.tests.coverage.target], ['en', 'claude', 'npm test', 80]);
  assert.deepEqual(readDevkitSettings(root).unknown, []);
  refused(root, { language: 'pt-BR' }, /language/, 'a present language in a CRLF file');
});

// Invariant: a block the writer cannot read safely (an inline value on any of its lines included), or a config it cannot read at all,
// is refused and never rewritten.
// Layer: setup-block parser. Suite: setup-block.
test('setup AC-3 block parser: an inline devkit value, a second devkit line, a tab indent and an openspec/config.yaml that cannot be read are refused with nothing written', () => {
  refused(project('schema: devkit\ndevkit: {}\n'), { driver: 'claude' }, /line 2.*by hand/, 'inline {}');
  refused(project('schema: devkit\ndevkit: x\n'), { driver: 'claude' }, /line 2.*by hand/, 'inline value');
  refused(project('schema: devkit\ndevkit:\n  language: en\nrules: {}\ndevkit:\n  driver: claude\n'), { tests: { unit: 'make test' } }, /line 5.*by hand/, 'a second devkit line');
  refused(project('schema: devkit\ndevkit:\n  language: en\n\tdriver: claude\n'), { tests: { unit: 'make test' } }, /line 4.*by hand/, 'a tab indent');
  refused(project('schema: devkit\ndevkit:\n  language: en\n  tests: { unit: "npm test" }\n'), { tests: { coverage: { target: 80 } } }, /line 4.*by hand/, 'an inline map in the block');
  refused(project('schema: devkit\ndevkit:\n  delivery:\n    model: trunk\n    extra: [a, b]\n'), { language: 'en' }, /line 5.*by hand/, 'an inline list in the block');

  const folder = project(null);
  mkdirSync(configFile(folder), { recursive: true });
  for (const r of [run(['plan', folder, '--json']), apply(folder, { language: 'en' })]) {
    assert.equal(r.code, 3, r.out + r.err);
    assert.match(r.err, /openspec\/config\.yaml/);
    assert.equal(r.err.trim().split('\n').length, 1);
    assert.equal(r.out, '', 'no JSON');
  }
  assert.equal(statSync(configFile(folder)).isDirectory(), true);
});

// Invariant: the report names the version the schemas come from and the CI pin the project records. Layer: setup-block plan.
// Suite: setup-block.
test('setup AC-5 block plan: pluginVersion is devkit-openspec\'s version and ciPin the workflow\'s tag', () => {
  const workflow = 'name: devkit-reviews\njobs:\n  check:\n    steps:\n      - name: fetch\n'
    + '          # pinned to the commit of v0.40.0 (resolved by github-setup.mjs, never the mutable tag)\n';
  const p = plan(project('schema: devkit\n', { '.github/workflows/devkit-reviews.yml': workflow }));
  assert.equal(p.pluginVersion, PACK_VERSION);
  assert.equal(p.ciPin, 'v0.40.0');
  assert.equal(plan(project('schema: devkit\n')).ciPin, null);
});

// Invariant: ciPin is the pin the workflow github-setup.mjs writes carries, read as deliver-check reads the pins.
// Layer: setup-block plan. Suite: setup-block.
test('setup AC-5 block plan: ciPin reads the pin of the workflow written from templates/devkit-reviews.yml', () => {
  const template = readFileSync(join(here, '..', 'templates', 'devkit-reviews.yml'), 'utf8');
  const workflow = template.replaceAll('{{ref}}', '0123456789abcdef0123456789abcdef01234567').replaceAll('{{tag}}', 'v0.41.2');
  assert.notEqual(workflow, template);
  assert.equal(plan(project('schema: devkit\n', { '.github/workflows/devkit-reviews.yml': workflow })).ciPin, 'v0.41.2');
  const moved = workflow.replace('# pinned to the commit of v0.41.2 (resolved', '# pinned to the commit of v0.41.2, resolved');
  assert.notEqual(moved, workflow);
  assert.equal(plan(project('schema: devkit\n', { '.github/workflows/devkit-reviews.yml': moved })).ciPin, 'v0.41.2', 'the pin reader of deliver-check, not a second one');
});

// Invariant: every invalid answer is refused before anything is written. Layer: setup-block apply. Suite: setup-block.
test('setup AC-3 block apply: an invalid language, model, ship, merge_method or target, and two-prs without base or test_branch, are refused with exit 3 and nothing written', () => {
  for (const [answers, pattern] of [
    [{ language: 'xx_bad' }, /language/],
    [{ delivery: { model: 'trunk-x' } }, /delivery.*none, trunk, trunk-auto, two-prs/],
    [{ ship: 'auto' }, /ship.*plan, pr, merge/],
    [{ ship: 'merge', merge_method: 'fast' }, /merge_method.*squash, merge, rebase/],
    [{ tests: { coverage: { target: 101 } } }, /target.*0 to 100/],
    [{ delivery: { model: 'two-prs' } }, /two-prs.*base.*test_branch/],
  ]) {
    const root = project(null);
    refused(root, answers, pattern, JSON.stringify(answers));
    assert.equal(existsSync(join(root, 'openspec')), false, 'no config created');
  }
});

// Invariant: fill names the parts outside the block the setup may write, and nothing of a config already filled.
// Layer: setup-block plan. Suite: setup-block.
test('setup AC-4 block plan: fill names schema, context, rules and operations only when absent, another schema or a context placeholder, and is empty on a filled config', () => {
  assert.deepEqual(plan(project(null)).fill, ['schema', 'context', 'rules', 'operations'], 'no config');
  assert.deepEqual(plan(project(TEMPLATE)).fill, ['context'], 'the template as it is');
  const filled = TEMPLATE.replace(/^context: \|\n(?: {2}.*\n)+/m, 'context: |\n  Stack: Node 22, no framework\n  Test command: npm test\n');
  assert.notEqual(filled, TEMPLATE);
  assert.deepEqual(plan(project(filled)).fill, [], 'a filled config');
  assert.deepEqual(plan(project(filled.replace(/^schema: devkit-lite$/m, 'schema: spec-driven'))).fill, ['schema'], 'another schema');
});

// Invariant: a call the skill wrote wrong exits 2 and writes nothing. Layer: setup-block CLI. Suite: setup-block.
test('setup AC-3 block apply: a usage error exits 2 with nothing written', () => {
  const root = project(null);
  for (const [args, input] of [[['merge', root], '{}'], [['apply', root], 'not json'], [['apply', root], '[1, 2]'], [['apply', root], 'null'],
    [['apply'], '{}'], [['plan', root, '--yaml'], '']]) {
    const r = run(args, input);
    assert.equal(r.code, 2, `${args.join(' ')} <<< ${input}: ${r.err}`);
    assert.equal(r.out, '');
  }
  assert.deepEqual(readdirSync(root), []);
});

// Invariant: a delivery train the loop refuses is kept, and the delivery question then offers only the models the train runs
// with. Layer: setup-block plan. Suite: setup-block.
test('setup AC-4 block plan: a delivery.train the loop refuses is kept, and the delivery question then offers only trunk and trunk-auto', () => {
  const noModel = project('schema: devkit\ndevkit:\n  delivery:\n    train: "npm test"\n');
  const p = plan(noModel);
  assert.deepEqual(p.kept, [{ setting: 'delivery.train', value: 'npm test', accepted: 'trunk, trunk-auto' }]);
  assert.deepEqual([entry(p, 'delivery').default, entry(p, 'delivery').options], ['trunk', ['trunk', 'trunk-auto']]);
  refused(noModel, { delivery: { model: 'two-prs', base: 'main', test_branch: 'develop' } }, /delivery.*trunk, trunk-auto/, 'two-prs under a train');
  refused(noModel, { delivery: { model: 'none' } }, /delivery.*trunk, trunk-auto/, 'none under a train');
  applied(noModel, { delivery: { model: 'trunk' } });
  assert.equal(configOf(noModel), 'schema: devkit\ndevkit:\n  delivery:\n    train: "npm test"\n    model: trunk\n');
  assert.deepEqual(readDevkitSettings(noModel).train, { suite: 'npm test', problem: null });

  const twoPrs = plan(project('schema: devkit\ndevkit:\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: develop\n    train: "npm test"\n'));
  assert.deepEqual(twoPrs.kept, [{ setting: 'delivery.train', value: 'npm test', accepted: 'trunk, trunk-auto' }]);
  assert.equal(entry(twoPrs, 'delivery'), undefined);

  assert.deepEqual(plan(project('schema: devkit\ndevkit:\n  delivery:\n    model: trunk\n    train: "npm test"\n')).kept, []);
});
