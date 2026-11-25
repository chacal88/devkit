#!/usr/bin/env node
// The writer of the `devkit:` block for `/devkit setup` (project-setup D-3).
//
//   node setup-block.mjs plan <project-root> [--json]   reads only; prints one JSON object: what the project holds and what to ask
//   node setup-block.mjs apply <project-root>           the answers as one JSON object on standard input; writes the missing keys
//
// `plan` lists, in `missing`, each key of the block the setup asks (language, driver, delivery, the four test keys, ship,
// merge_method, release_tag) with its default, proposal and options, and in `kept` each present value the loop refuses, which the
// setup never changes. `apply` computes the plan again with the answers and writes only keys that are missing: a re-run keeps every
// value. With no openspec/config.yaml it starts from templates/config.yaml. It never reformats the file: a missing key is inserted
// after its map's last line, a new block is appended, the `ship:` map and `merge_method` go at the end, line endings are kept.
// Exit: 0 done; 2 a usage error (nothing written); 3 a refused answer, a block it cannot edit, or a config it cannot read (one
// stderr line, nothing written). No dependencies: it reuses the readers of the hooks.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILT_DRIVERS, DRIVER_ROUND, LANGUAGE_TAG, isObject, readDevkitSettings, tryGit } from '../../../hooks/change-loop.mjs';
import { DELIVERY_MODELS, DEVKIT_SCHEMAS, parseDevkitBlock, projectSchema, releaseTagSetting } from '../../../hooks/guard.mjs';
import { readTestSettings } from '../../../hooks/flow-check.mjs';
import { MERGE_METHOD_VALUES, SHIP_MODES, parseMergeMethod, parseShip, pinsIn } from '../../../hooks/deliver-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(here, '..', 'templates', 'config.yaml');
const PLUGIN_JSON = join(here, '..', '..', '..', '.claude-plugin', 'plugin.json');
const USAGE = 'usage: setup-block.mjs plan <project-root> [--json] | setup-block.mjs apply <project-root> (the answers as JSON on standard input)';
const HEADING = '# The settings of /devkit, written by /devkit setup.';
const SHIP_SCHEMAS = ['devkit-lite', 'devkit', 'devkit-project'];
const TEST_KEYS = ['tests.unit', 'tests.coverage.command', 'tests.coverage.target', 'tests.e2e'];
const KEYS = ['language', 'driver', 'delivery', ...TEST_KEYS, 'ship', 'merge_method', 'release_tag'];
const TRAIN_MODELS = ['trunk', 'trunk-auto'];
const FILL = ['schema', 'context', 'rules', 'operations'];
const PLACEHOLDER = /<[^<>\n]*>/;

export class SetupUsageError extends Error {
  constructor(message) { super(message); this.name = 'SetupUsageError'; }
}
export class SetupRefusal extends Error {
  constructor(message) { super(message); this.name = 'SetupRefusal'; }
}

const clean = (row) => row.replace(/\r$/, '');
const configPath = (root) => join(root, 'openspec', 'config.yaml');

// The text of openspec/config.yaml, or null when there is none; any other read error is a refusal.
function readConfig(root) {
  try { return readFileSync(configPath(root), 'utf8'); } catch (e) {
    if (e?.code === 'ENOENT') return null;
    throw new SetupRefusal(`openspec/config.yaml cannot be read (${e?.code ?? e}): ${configPath(root)}; fix the file, then run the setup again`);
  }
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

// The lines of a top-level key (its line and the lines under it), or null when the file has no such key.
function topSection(text, key) {
  const rows = text.split('\n').map(clean);
  const at = rows.findIndex((row) => new RegExp(`^${key}\\s*:`).test(row));
  if (at < 0) return null;
  const end = rows.findIndex((row, i) => i > at && row.trim() !== '' && !/^\s/.test(row));
  return rows.slice(at, end < 0 ? rows.length : end).join('\n');
}

// The parts outside the block that step 5 may write (D-3, `fill`).
function fillOf(root, text) {
  if (text === null) return [...FILL];
  const fill = [];
  if (!DEVKIT_SCHEMAS.includes(projectSchema(root))) fill.push('schema');
  const context = topSection(text, 'context');
  if (context === null || PLACEHOLDER.test(context)) fill.push('context');
  for (const key of ['rules', 'operations']) if (topSection(text, key) === null) fill.push(key);
  return fill;
}

// The commands the repository suggests for the four test keys (D-3): package.json scripts run with the package manager its lockfile
// names, else a Makefile `test:` target; e2e only when a Playwright or Cypress config exists. No proposal for the target.
function testProposals(root, pkg) {
  const scripts = isObject(pkg?.scripts) ? pkg.scripts : {};
  const has = (name) => typeof scripts[name] === 'string';
  const pm = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(join(root, 'yarn.lock')) ? 'yarn' : 'npm';
  let makeTest = false;
  try { makeTest = /^test\s*:/m.test(readFileSync(join(root, 'Makefile'), 'utf8')); } catch { /* no Makefile */ }
  let names = [];
  try { names = readdirSync(root); } catch { /* an unreadable root proposes nothing */ }
  const e2eTool = names.some((name) => /^(playwright|cypress)\.config\./.test(name));
  const e2eScript = ['e2e', 'test:e2e'].find(has);
  return {
    'tests.unit': has('test') ? `${pm} test` : makeTest ? 'make test' : null,
    'tests.coverage.command': has('coverage') ? `${pm} run coverage` : null,
    'tests.coverage.target': null,
    'tests.e2e': e2eTool && e2eScript ? `${pm} run ${e2eScript}` : null,
  };
}

function defaultBranch(root) {
  const ref = tryGit(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  return ref ? ref.replace(/^origin\//, '') : 'main';
}

// The CI pin the project records: the first pin of its devkit-reviews workflow, read by the one pin reader (deliver-check pinsIn).
function ciPinOf(root) {
  try {
    return pinsIn(readFileSync(join(root, '.github', 'workflows', 'devkit-reviews.yml'), 'utf8'))[0] ?? null;
  } catch { return null; }
}

function catching(read) {
  try { return read(); } catch { return null; }
}

// The plan of D-3. `text` is the config the answers would be written into (null: no file); `answers` (the flat map of `flatten`,
// or null in `plan`) decides the keys whose need depends on an earlier answer: `ship` once a delivery model is answered, and
// `merge_method` once the mode is known. With no answers a `ship` still to ask may be `merge`, so `merge_method` is listed.
export function planOf(root, text, answers = null) {
  const block = parseDevkitBlock(text ?? '');
  const tests = text === null ? { paths: {} } : readTestSettings(root);
  const settings = readDevkitSettings(root);
  const pkg = readJson(join(root, 'package.json'));
  const releaseFile = isObject(pkg) && typeof pkg.version === 'string' ? 'package.json' : null;
  const shipLine = text !== null && /^ship\s*:/m.test(text);
  const mergeLine = text !== null && /^merge_method\s*:/m.test(text);
  const shipMap = shipLine ? catching(() => parseShip(text)) : null;
  const delivery = block.delivery;
  const present = {
    language: block.language ?? null,
    driver: block.driver ?? null,
    delivery: ['model', 'base', 'test_branch', 'train'].some((k) => delivery[k] !== undefined)
      ? { model: delivery.model ?? null, base: delivery.base ?? null, test_branch: delivery.test_branch ?? null, train: delivery.train ?? null } : null,
    tests: {
      unit: tests.paths['tests.unit'] ?? null,
      coverage: { command: tests.paths['tests.coverage.command'] ?? null, target: tests.coverage?.target ?? tests.paths['tests.coverage.target'] ?? null },
      e2e: tests.paths['tests.e2e'] ?? null,
    },
    ship: shipMap,
    merge_method: mergeLine ? catching(() => parseMergeMethod(text)) : null,
    release_tag: block.release_tag ?? null,
  };
  const kept = [
    ...settings.unknown.map(({ setting, value, accepted }) => ({ setting, value, accepted })),
    ...(settings.missing ?? []).map(({ setting }) => ({ setting, value: null, accepted: null })),
  ];
  if (settings.train?.problem?.kind === 'train-model') kept.push({ setting: 'delivery.train', value: delivery.train, accepted: TRAIN_MODELS.join(', ') });
  const underTrain = kept.some((k) => k.setting === 'delivery.train');

  const answeredModel = answers?.has('delivery') && answers.get('delivery').model !== 'none' ? answers.get('delivery').model : null;
  const model = delivery.model ?? answeredModel;
  const shipMissing = !shipLine && !model;
  const shipMerges = shipMissing ? (answers ? answers.get('ship') === 'merge' : true) : Object.values(shipMap ?? {}).includes('merge');
  const proposals = testProposals(root, pkg);
  const need = {
    language: block.language === undefined,
    driver: block.driver === undefined,
    delivery: !delivery.model && !shipLine,
    ship: shipMissing,
    merge_method: !mergeLine && (model === 'trunk-auto' || shipMerges),
    release_tag: block.release_tag === undefined && releaseFile !== null,
  };
  for (const key of TEST_KEYS) need[key] = tests.paths[key] === undefined;
  const entryOf = {
    language: { default: present.language ?? 'en', proposed: null, options: null },
    driver: { default: 'claude', proposed: null, options: [...BUILT_DRIVERS] },
    delivery: underTrain
      ? { default: 'trunk', proposed: { base: defaultBranch(root) }, options: [...TRAIN_MODELS] }
      : { default: 'none', proposed: { base: defaultBranch(root) }, options: ['none', ...[...DELIVERY_MODELS].sort()] },
    ship: { default: 'merge', proposed: null, options: [...SHIP_MODES] },
    merge_method: { default: 'squash', proposed: null, options: [...MERGE_METHOD_VALUES] },
    release_tag: { default: releaseFile, proposed: null, options: null },
  };
  for (const key of TEST_KEYS) entryOf[key] = { default: null, proposed: proposals[key], options: null };
  return {
    version: 1,
    config: text === null ? 'absent' : 'present',
    block: /^devkit\s*:/m.test(text ?? '') ? 'present' : 'absent',
    present,
    kept,
    missing: KEYS.filter((key) => need[key]).map((key) => ({ key, ...entryOf[key] })),
    drivers: [...BUILT_DRIVERS],
    driverNotBuilt: present.driver && DRIVER_ROUND[present.driver] ? { driver: present.driver, round: DRIVER_ROUND[present.driver] } : null,
    releaseFile,
    kit: existsSync(join(root, '.compozy', 'kit-manifest.json')) ? 'installed' : 'absent',
    pluginVersion: readJson(PLUGIN_JSON)?.version ?? null,
    ciPin: ciPinOf(root),
    fill: fillOf(root, text),
  };
}

// The answers as a Map from each key of KEYS to its value, in KEYS order; `delivery` maps to { model, base, test_branch }. A key left
// out or null is not in the map. A key the setup does not ask is a refusal.
function flatten(answers) {
  const flat = new Map();
  const nested = (value, key, fields) => {
    if (value === null || value === undefined) return null;
    if (!isObject(value)) throw new SetupRefusal(`${key}: expected an object with ${fields.join(', ')}`);
    const extra = Object.keys(value).filter((k) => !fields.includes(k));
    if (extra.length) throw new SetupRefusal(`${key}.${extra[0]}: not a key the setup asks; it asks ${KEYS.join(', ')}`);
    return value;
  };
  const extra = Object.keys(answers).filter((k) => !['language', 'driver', 'delivery', 'tests', 'ship', 'merge_method', 'release_tag'].includes(k));
  if (extra.length) throw new SetupRefusal(`${extra[0]}: not a key the setup asks; it asks ${KEYS.join(', ')}`);
  const put = (key, value) => { if (value !== null && value !== undefined) flat.set(key, value); };
  put('language', answers.language);
  put('driver', answers.driver);
  const delivery = nested(answers.delivery, 'delivery', ['model', 'base', 'test_branch']);
  if (delivery && delivery.model !== null && delivery.model !== undefined) flat.set('delivery', delivery);
  const tests = nested(answers.tests, 'tests', ['unit', 'coverage', 'e2e']);
  const coverage = nested(tests?.coverage, 'tests.coverage', ['command', 'target']);
  put('tests.unit', tests?.unit);
  put('tests.coverage.command', coverage?.command);
  put('tests.coverage.target', coverage?.target);
  put('tests.e2e', tests?.e2e);
  put('ship', answers.ship);
  put('merge_method', answers.merge_method);
  put('release_tag', answers.release_tag);
  return new Map(KEYS.filter((k) => flat.has(k)).map((k) => [k, flat.get(k)]));
}

const isText = (value) => typeof value === 'string' && value.trim() !== '' && !/[\r\n]/.test(value);
const offered = (key, value, options) => {
  if (!options.includes(value)) throw new SetupRefusal(`${key}: ${JSON.stringify(value)} is not offered; accepted: ${options.join(', ')}`);
};

// Refuses the first answer that is not for a missing key or holds a value outside its options (D-3).
function check(plan, answers) {
  const missing = new Map(plan.missing.map((m) => [m.key, m]));
  for (const [key, value] of answers) {
    if (!missing.has(key)) throw new SetupRefusal(`${key}: not missing, so the setup keeps what the file holds (it asks ${[...missing.keys()].join(', ') || 'nothing'})`);
    const { options } = missing.get(key);
    if (key === 'language' && !(typeof value === 'string' && LANGUAGE_TAG.test(value))) {
      throw new SetupRefusal(`language: ${JSON.stringify(value)} is not accepted; accepted: a language tag such as en or pt-BR`);
    }
    if (key === 'driver' || key === 'ship' || key === 'merge_method') offered(key, value, options);
    if (key === 'delivery') {
      offered(key, value.model, options);
      if (value.model === 'two-prs' && !(isText(value.base) && isText(value.test_branch) && value.base !== value.test_branch)) {
        throw new SetupRefusal('delivery: two-prs needs base and test_branch, two different branch names');
      }
    }
    if (key === 'tests.unit' || key === 'tests.coverage.command' || key === 'tests.e2e') {
      if (!isText(value)) throw new SetupRefusal(`${key}: ${JSON.stringify(value)} is not accepted; accepted: a command on one line`);
    }
    const whole = (typeof value === 'number' || typeof value === 'string') && /^\d+$/.test(String(value)) && Number(value) <= 100;
    if (key === 'tests.coverage.target' && !whole) {
      throw new SetupRefusal(`tests.coverage.target: ${JSON.stringify(value)} is not accepted; accepted: a whole number from 0 to 100`);
    }
    if (key === 'release_tag' && !(typeof value === 'string' && releaseTagSetting({ release_tag: value }).file)) {
      throw new SetupRefusal(`release_tag: ${JSON.stringify(value)} is not accepted; accepted: a path from the repository root to a .json file, such as package.json`);
    }
  }
}

// The column-0 `devkit:` line and the end of its block (the first later line that is not blank, not a comment and not indented,
// as parseDevkitBlock reads it), or null.
function blockOf(rows) {
  const start = rows.findIndex((row) => /^devkit:\s*(#.*)?$/.test(clean(row)));
  if (start < 0) return null;
  const end = rows.findIndex((row, i) => i > start && clean(row).trim() !== '' && !/^\s*#/.test(row) && !/^\s/.test(row));
  return { start, end: end < 0 ? rows.length : end };
}

// Refuses a block the writer cannot edit without guessing: an inline value on the `devkit:` line, an inline map or list (a value
// that starts with `{` or `[`) on any line of the block, a second `devkit:` line, a tab in an indentation.
function checkBlock(rows) {
  const lines = rows.map((row, i) => (/^devkit\s*:/.test(clean(row)) ? i : -1)).filter((i) => i >= 0);
  const byHand = (i, what) => new SetupRefusal(`openspec/config.yaml line ${i + 1}: ${what}; edit the block by hand, then run the setup again`);
  if (lines.length > 1) throw byHand(lines[1], 'a second devkit: line');
  if (!lines.length) return;
  if (!/^devkit:\s*(#.*)?$/.test(clean(rows[lines[0]]))) throw byHand(lines[0], 'devkit: holds an inline value');
  const { start, end } = blockOf(rows);
  for (let i = start + 1; i < end; i++) {
    if (clean(rows[i]).trim() !== '' && /^[ \t]*\t/.test(rows[i])) throw byHand(i, 'a tab in the indentation of the devkit block');
    if (/^\s+[A-Za-z][\w-]*:\s*[{[]/.test(clean(rows[i]))) throw byHand(i, 'an inline map or list in the devkit block');
  }
}

const indentOf = (row) => /^\s*/.exec(clean(row))[0].length;

// The index of the last line nested under the key at `at` (its own index when none), within the rows before `limit`.
function lastNested(rows, at, indent, limit) {
  let last = at;
  for (let i = at + 1; i < limit; i++) {
    const row = clean(rows[i]);
    if (row.trim() === '') continue;
    if (/^\s*#/.test(row)) { if (indentOf(row) > indent) last = i; continue; }
    if (indentOf(row) <= indent) break;
    last = i;
  }
  return last;
}

// { indent, keys } of the keys right under the key at `at`: the indent of its first child (null with none) and the line of each.
function childrenOf(rows, at, last) {
  let indent = null;
  const keys = new Map();
  for (let i = at + 1; i <= last; i++) {
    const m = /^(\s+)([A-Za-z][\w-]*):/.exec(clean(rows[i]));
    if (!m || /^\s*#/.test(rows[i])) continue;
    if (indent === null) indent = m[1].length;
    if (m[1].length === indent && !keys.has(m[2])) keys.set(m[2], i);
  }
  return { indent, keys };
}

// Inserts `segments` (a path under `devkit`) with its value: after the last line of the deepest map of the path that exists, at the
// indent of that map's first child, else one block indent deeper; the maps of the path that do not exist are written on the way.
function insertPath(rows, segments, value, eol) {
  const { start, end } = blockOf(rows);
  const unit = childrenOf(rows, start, lastNested(rows, start, 0, end)).indent ?? 2;
  let at = start;
  let indent = 0;
  for (let d = 0; d < segments.length; d++) {
    const last = lastNested(rows, at, indent, end);
    const children = childrenOf(rows, at, last);
    const childIndent = children.indent ?? indent + unit;
    const found = children.keys.get(segments[d]);
    if (found !== undefined && d < segments.length - 1) { at = found; indent = childIndent; continue; }
    const rest = segments.slice(d);
    const added = rest.map((segment, k) => `${' '.repeat(childIndent + k * unit)}${segment}:${k === rest.length - 1 ? ` ${value}` : ''}${eol}`);
    rows.splice(last + 1, 0, ...added);
    return;
  }
}

// The rows of the answers to write under `devkit`: [path segments, value text], in KEYS order.
function blockEntries(answers) {
  const entries = [];
  for (const [key, value] of answers) {
    if (key === 'delivery') {
      if (value.model === 'none') continue;
      entries.push([['delivery', 'model'], value.model]);
      if (value.model === 'two-prs') entries.push([['delivery', 'base'], value.base], [['delivery', 'test_branch'], value.test_branch]);
    } else if (key === 'tests.coverage.target') entries.push([key.split('.'), String(Number(value))]);
    else if (key.startsWith('tests.')) entries.push([key.split('.'), JSON.stringify(value)]);
    else if (key !== 'ship' && key !== 'merge_method') entries.push([[key], value]);
  }
  return entries;
}

// The new text of the config with the answers written (D-3, "How it writes"), and the keys added.
function written(base, answers) {
  const eol = /^[^\n]*\r\n/.test(base) ? '\r' : '';
  let body = base;
  if (body !== '' && !body.endsWith('\n')) body += `${eol}\n`;
  const rows = body === '' ? [] : body.slice(0, -1).split('\n');
  const blankBefore = () => { if (rows.length && clean(rows[rows.length - 1]).trim() !== '') rows.push(eol); };
  const entries = blockEntries(answers);
  if (entries.length && !blockOf(rows)) {
    blankBefore();
    rows.push(`${HEADING}${eol}`, `devkit:${eol}`);
  }
  for (const [segments, value] of entries) insertPath(rows, segments, value, eol);
  if (answers.has('ship')) {
    blankBefore();
    rows.push(`ship:${eol}`, ...SHIP_SCHEMAS.map((schema) => `  ${schema}: ${answers.get('ship')}${eol}`));
  }
  if (answers.has('merge_method')) {
    if (!answers.has('ship')) blankBefore();
    rows.push(`merge_method: ${answers.get('merge_method')}${eol}`);
  }
  const added = [...answers.keys()].filter((key) => !(key === 'delivery' && answers.get(key).model === 'none'));
  return { text: `${rows.join('\n')}\n`, added };
}

export function plan(root) {
  return planOf(root, readConfig(root));
}

export function apply(root, input) {
  let answers;
  try { answers = JSON.parse(input); } catch { throw new SetupUsageError('standard input is not one JSON object'); }
  if (!isObject(answers)) throw new SetupUsageError('standard input is not one JSON object');
  const text = readConfig(root);
  const base = text ?? readFileSync(TEMPLATE, 'utf8');
  checkBlock(base.split('\n'));
  const flat = flatten(answers);
  check(planOf(root, text, flat), flat);
  const { text: next, added } = written(base, flat);
  if (!added.length) return { file: 'unchanged', added: [] };
  const file = configPath(root);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.setup-${process.pid}.tmp`;
  try {
    writeFileSync(tmp, next);
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
  return { file: text === null ? 'created' : 'updated', added };
}

function parseArgs(argv) {
  const [command, root, ...rest] = argv;
  if (command !== 'plan' && command !== 'apply') throw new SetupUsageError(USAGE);
  if (!root || root.startsWith('-')) throw new SetupUsageError(USAGE);
  if (rest.some((arg) => !(command === 'plan' && arg === '--json'))) throw new SetupUsageError(USAGE);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new SetupUsageError(`${root} is not a folder; ${USAGE}`);
  return { command, root };
}

function main() {
  try {
    const { command, root } = parseArgs(process.argv.slice(2));
    const result = command === 'plan' ? plan(root) : apply(root, readFileSync(0, 'utf8'));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (e) {
    if (e instanceof SetupUsageError) { process.stderr.write(`setup-block: ${e.message}\n`); process.exit(2); }
    if (e instanceof SetupRefusal) { process.stderr.write(`setup-block: ${e.message}\n`); process.exit(3); }
    throw e;
  }
}

const invoked = () => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } };
if (invoked()) main();
