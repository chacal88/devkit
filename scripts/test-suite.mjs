#!/usr/bin/env node
// The devkit test suite: `node scripts/test-suite.mjs [--concurrency=<n>] [--reporter=<name>]
// [--test-name-pattern=<re>] [--test-skip-pattern=<re>] [--own-files] [<test file>...]` (ADR 0026).
//
// Runs every `*.test.mjs` of the suite's four folders, each file in a process of its own (`node --test <file>`),
// several at once, each with its own empty real-path TMPDIR under one run root (made under the real TMPDIR when a Unix socket
// path under it fits, else under the real /tmp). Refuses a test file or a fixtures
// module that imports a test file, fails a file that leaves anything in its TMPDIR, and exits 1 when any file fails.
// `--own-files` (ADR 0036) runs only the tests the branch's own files map to, by
// scripts/test-map.json, and prints each choice before the first `start` line; it runs the whole suite when it cannot tell, and on a
// train branch. Without it, nothing of this runs and the map is never read.
// Exit codes: 0 green, or no test selected; 1 a failed file, a leftover, a refused import, a refused map or no test file; 2 a usage error;
// 130 after SIGINT; 143 after SIGTERM.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, rmdirSync, statSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The folders the suite reads, relative to the root: those whose tests the old command ran. The other tests of plugins/compozy and
// those of plugins/panel stay out (ADR 0026 decision 6).
const SUITE_FOLDERS = [
  'plugins/openspec/hooks',
  'plugins/openspec/skills/devkit/scripts',
  'plugins/core/skills/review-change/scripts',
  'plugins/compozy/kit/scripts',
];
const TEST_FILE = /\.test\.mjs$/;
const FIXTURES_FILE = /(?:^|-)fixtures\.mjs$/; // test-fixtures.mjs and every <name>-fixtures.mjs
const IMPORTED_TEST_FILE = /(?:\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"]([^'"]*\.test\.mjs)['"]/;
const FIXTURES = 'plugins/openspec/hooks/test-fixtures.mjs';
const USAGE = 'usage: node scripts/test-suite.mjs [--concurrency=<n>] [--reporter=<name>] [--test-name-pattern=<re>] [--test-skip-pattern=<re>] [--own-files] [<test file>...]';
const STOP_WAIT_MS = 10_000;
const LEFT_NAMES_SHOWN = 10;
export const SOCKET_PATH_MAX_BYTES = 103; // the longest Unix socket path both platforms take: macOS sun_path holds 104 with the terminator, Linux 108
export const SOCKET_TAIL_BYTES = 29; // /devkit-ch-XXXXXX (17) + /daemon.sock (12): the deepest socket a suite test binds (test-fixtures.mjs daemon)
export const RUN_ROOT_NAME_BYTES = 20; // /devkit-suite-XXXXXX, the run root's own name
export const SHORT_TMP = '/tmp'; // the folder whose real path (/private/tmp on macOS) holds the run root when TMPDIR does not fit

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

const slashed = (path) => path.split(sep).join('/');

// Every file under `folder` (absolute) for which `keep(name)` holds, as paths relative to `root` with `/`, no node_modules.
function walk(root, folder, keep) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return found;
    throw new UsageError(`cannot read ${slashed(relative(root, folder))}: ${error.message}`);
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...walk(root, path, keep));
    else if (keep(entry.name)) found.push(slashed(relative(root, path)));
  }
  return found;
}

export function suiteFiles(root = ROOT) {
  return SUITE_FOLDERS.flatMap((folder) => walk(root, join(root, folder), (name) => TEST_FILE.test(name))).sort();
}

// `{ file, line, spec }` of every line of a *.test.mjs or a fixtures module under <root>/plugins that imports a *.test.mjs, sorted.
export function testImports(root = ROOT) {
  const found = [];
  for (const file of walk(root, join(root, 'plugins'), (name) => TEST_FILE.test(name) || FIXTURES_FILE.test(name))) {
    let text;
    try {
      text = readFileSync(join(root, file), 'utf8');
    } catch (error) {
      throw new UsageError(`cannot read ${file}: ${error.message}`);
    }
    text.split('\n').forEach((line, at) => {
      const hit = IMPORTED_TEST_FILE.exec(line);
      if (hit) found.push({ file, line: at + 1, spec: hit[1] });
    });
  }
  return found.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

const underSuiteFolder = (path) => SUITE_FOLDERS.some((folder) => path.startsWith(`${folder}/`));
const hasKey = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// The map key that covers `path`: the exact key, else the longest folder key (one that ends in `/`) that is a prefix of it; null when none.
function coveringKey(files, path) {
  if (hasKey(files, path)) return path;
  let found = null;
  for (const key of Object.keys(files)) {
    if (key.endsWith('/') && path.startsWith(key) && (found === null || key.length > found.length)) found = key;
  }
  return found;
}

// The suite test files an own-path list selects (the header names the record): `{ kind: 'files', files:
// [{ file, by }] }`, `{ kind: 'whole', reason }` or `{ kind: 'none', count }`. `own` is the sorted own paths, `exists(path)` tells whether
// a path is on disk and `uses` maps each shared helper to the suite tests that use it (sharedUses). Each own path takes the first rule
// that matches: S1 a suite test, S2 a deleted one, S3 a shared helper, S4 a map entry, S5 openspec/, S6 docs, S7 anything else.
export function selectTests({ own, map, suite, exists, uses }) {
  const slow = new Set(map.slow);
  const picked = new Map(); // test file -> the own paths that selected it
  const add = (file, path) => {
    if (!picked.has(file)) picked.set(file, new Set());
    picked.get(file).add(path);
  };
  const uncovered = [];
  for (const path of [...own].sort(byPath)) {
    if (suite.includes(path) && exists(path)) { // S1
      add(path, path);
    } else if (TEST_FILE.test(path) && underSuiteFolder(path) && !exists(path)) { // S2
      // a deleted test selects nothing
    } else if (hasKey(map.shared, path)) { // S3
      for (const file of uses.get(path) ?? []) if (!slow.has(file)) add(file, path);
      for (const file of map.shared[path]) add(file, path);
    } else if (coveringKey(map.files, path) !== null) { // S4
      const tests = map.files[coveringKey(map.files, path)];
      if (tests.length === 0) uncovered.push(path); // a key that covers no test covers nothing
      for (const file of tests) add(file, path);
    } else if (path.startsWith('openspec/')) { // S5
      // the change's own records run no test
    } else if (path.endsWith('.md') && !path.startsWith('plugins/')) { // S6
      // docs run no test
    } else { // S7
      uncovered.push(path);
    }
  }
  if (uncovered.length) return { kind: 'whole', reason: `no entry of scripts/test-map.json covers ${uncovered.join(', ')}` };
  if (picked.size === 0) return { kind: 'none', count: own.length };
  return { kind: 'files', files: [...picked].sort(([a], [b]) => byPath(a, b)).map(([file, by]) => ({ file, by: [...by].sort(byPath) })) };
}

const RELATIVE_IMPORT = /(?:\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

// The repository paths a module imports by a relative specifier (static, side-effect or dynamic), resolved against its folder.
function relativeImports(root, file) {
  let text;
  try {
    text = readFileSync(join(root, file), 'utf8');
  } catch {
    return [];
  }
  const found = [];
  for (const line of text.split('\n')) {
    for (const hit of line.matchAll(RELATIVE_IMPORT)) found.push(posix.join(posix.dirname(file), hit[1]));
  }
  return found;
}

// A `Map` from each shared helper of the map to the sorted suite tests that use it: a test uses a helper when it imports it, or imports a
// shared helper or a test-support module (a `-fixtures.mjs` file under a suite folder) that uses it. The closure goes through those two
// kinds of module only and stops at every other one: a product module that imports a helper does not make its importers users of it.
export function sharedUses(root, map, suite) {
  const shared = new Set(Object.keys(map.shared));
  const follows = (file) => shared.has(file) || (FIXTURES_FILE.test(file.split('/').pop()) && underSuiteFolder(file));
  const users = new Map([...shared].map((helper) => [helper, new Set()]));
  for (const test of suite) {
    const seen = new Set();
    const stack = relativeImports(root, test);
    while (stack.length) {
      const file = stack.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      if (shared.has(file)) users.get(file).add(test);
      if (follows(file)) stack.push(...relativeImports(root, file));
    }
  }
  return new Map([...users].map(([helper, tests]) => [helper, [...tests].sort(byPath)]));
}

export const MAP_FILE = 'scripts/test-map.json';
const MAP_KEYS = ['slow', 'shared', 'files'];

// The parsed map of `root`, `{ map }`, or `{ error }` when the file cannot be read or is not JSON (what it is, an object or not, is `mapProblems`'s).
export function readTestMap(root = ROOT) {
  let text;
  try {
    text = readFileSync(join(root, MAP_FILE), 'utf8');
  } catch (error) {
    return { error: `cannot read: ${error.code || error.message}` };
  }
  try {
    return { map: JSON.parse(text) };
  } catch (error) {
    return { error: `not JSON: ${error.message}` };
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isStrings = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

// The files git tracks under the suite folders and that exist on disk (M5's list), sorted, relative to `root` with `/`; null when git cannot
// tell which files belong: no work tree of `root`'s own (a copy, or a folder inside another repository), a git failure, or no tracked file.
// A file that is untracked or ignored is no repository file, and an own file that no key covers selects the whole suite (S7) anyway.
function trackedSuitePaths(root, env) {
  const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'] });
  let listed;
  try {
    if (realpathSync(git(['rev-parse', '--show-toplevel']).trim()) !== realpathSync(root)) return null;
    listed = git(['ls-files', '-z', '--cached', '--', ...SUITE_FOLDERS]);
  } catch {
    return null;
  }
  const found = listed.split('\0').filter((path) => path && statSync(join(root, path), { throwIfNoEntry: false })?.isFile()).sort(byPath);
  return found.length ? found : null;
}

// `[{ entry, why }]`, one per fault of the map (M1 to M7 of the design), none when it holds. `suite` is the suiteFiles() list; the paths the
// map names are looked up under `root`. A map of the wrong shape (M7) gives only the shape's faults: the other checks need the shape. `env`
// reaches only the git calls of M5.
export function mapProblems(root, map, suite, env = process.env) {
  if (!isObject(map)) return [{ entry: 'the map', why: 'is not an object' }];
  const problems = [];
  const problem = (entry, why) => problems.push({ entry, why });
  for (const key of Object.keys(map)) if (!MAP_KEYS.includes(key)) problem(key, `is not a key of the map (${MAP_KEYS.join(', ')})`);
  if (hasKey(map, 'slow') && !isStrings(map.slow)) problem('slow', 'is not an array of strings');
  for (const name of ['shared', 'files']) {
    if (!hasKey(map, name)) continue;
    if (!isObject(map[name])) problem(name, 'is not an object');
    else for (const [key, value] of Object.entries(map[name])) if (!isStrings(value)) problem(key, 'is not an array of strings');
  }
  if (problems.length) return problems;

  const slow = map.slow ?? [];
  const shared = map.shared ?? {};
  const files = map.files ?? {};
  const stat = (path) => {
    try {
      return statSync(join(root, path));
    } catch {
      return null;
    }
  };
  const linked = new Set();
  // A path the map names as a test file: it must exist (M1) and be a test file of the suite (M2). A `files` value and a shared link link
  // the test to a key (M6); a slow item only marks it.
  const checkLinks = (entry, paths, links = true) => {
    for (const path of paths) {
      if (links) linked.add(path);
      if (!stat(path)) problem(entry, `names ${path}, which does not exist`);
      else if (!suite.includes(path)) problem(entry, `links ${path}, which is not a test file of the suite`);
    }
  };
  for (const [key, tests] of Object.entries(files)) {
    const found = stat(key.endsWith('/') ? key.slice(0, -1) : key);
    if (!found) problem(key, `names ${key}, which does not exist`);
    else if (key.endsWith('/') && !found.isDirectory()) problem(key, 'is not a folder');
    checkLinks(key, tests);
  }
  for (const [key, tests] of Object.entries(shared)) {
    if (!stat(key)) problem(key, `names ${key}, which does not exist`);
    checkLinks(key, tests);
  }
  checkLinks('slow', slow, false);
  for (const key of [...Object.keys(files), ...Object.keys(shared)]) {
    if (suite.includes(key)) problem(key, 'is a test file of the suite: it selects itself');
  }
  for (const key of Object.keys(shared)) if (hasKey(files, key)) problem(key, 'is both a file entry and a shared helper');
  const covered = (path) => hasKey(shared, path) || coveringKey(files, path) !== null;
  const repoFiles = trackedSuitePaths(root, env) ?? SUITE_FOLDERS.flatMap((folder) => walk(root, join(root, folder), () => true)).sort(byPath);
  for (const path of repoFiles) {
    if (!suite.includes(path) && !covered(path)) problem(path, 'is not covered by the map');
  }
  for (const test of suite) if (!linked.has(test)) problem(test, 'is linked to nothing');
  return problems;
}

// The arguments, one by one; anything else is a usage error.
function parseArgs(argv, root, files) {
  const options = { concurrency: availableParallelism(), reporter: 'spec', patterns: [], only: [], ownFiles: false };
  for (const arg of argv) {
    const hit = /^(--[a-z-]+)=(.*)$/s.exec(arg);
    if (!arg.startsWith('--')) {
      const rel = slashed(relative(root, resolve(root, arg)));
      if (!files.includes(rel)) throw new UsageError(`not a file of the suite: ${arg}`);
      if (!options.only.includes(rel)) options.only.push(rel);
    } else if (hit && hit[1] === '--concurrency') {
      if (!/^[1-9][0-9]*$/.test(hit[2])) throw new UsageError(`--concurrency takes a whole number from 1: ${arg}`);
      options.concurrency = Number(hit[2]);
    } else if (hit && hit[1] === '--reporter') {
      if (hit[2] === '') throw new UsageError('--reporter takes a name');
      options.reporter = hit[2];
    } else if (hit && (hit[1] === '--test-name-pattern' || hit[1] === '--test-skip-pattern')) {
      if (hit[2] === '') throw new UsageError(`${hit[1]} takes a pattern`);
      options.patterns.push(arg);
    } else if (arg === '--own-files') {
      options.ownFiles = true;
    } else {
      throw new UsageError(`unknown argument: ${arg}`);
    }
  }
  if (options.ownFiles && options.only.length) throw new UsageError('--own-files takes no file argument');
  return options;
}

// The count lines of a child's output (`ℹ tests 3` of the spec reporter, `# tests 3` of the tap one); the last one wins.
function counts(output) {
  const found = {};
  for (const line of output.split('\n')) {
    const hit = /^(?:ℹ|#) (tests|pass|fail) (\d+)\s*$/.exec(line);
    if (hit) found[hit[1]] = Number(hit[2]);
  }
  return 'tests' in found && 'pass' in found && 'fail' in found ? found : null;
}

function leftNames(folder) {
  try {
    return readdirSync(folder).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function removeEmpty(path) {
  try {
    rmdirSync(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function removeTree(path) {
  rmSync(path, { recursive: true, force: true, maxRetries: 3 });
}

// The longest run root, in bytes: the socket limit less the socket tail and the file's place (a slash and at least two digits).
export function runRootLimit(fileCount) {
  return SOCKET_PATH_MAX_BYTES - SOCKET_TAIL_BYTES - (1 + Math.max(2, String(fileCount - 1).length));
}

// The bytes of a run root made under the real path `realBase` (bytes, not characters): the one place that adds its name.
export function runRootBytes(realBase) {
  return Buffer.byteLength(realBase) + RUN_ROOT_NAME_BYTES;
}

// Whether a run root made under the real path `realBase` fits `limit` (runRootLimit of the file count).
export function runRootFits(realBase, limit) {
  return runRootBytes(realBase) <= limit;
}

function failure(shown, error) {
  return { shown, reason: `cannot be used: ${error.code || error.message}` };
}

// Makes the run root under `folder` when it fits `limit` and can be written; else says why not. Nothing is written to a folder that does not fit.
function tryRunRoot(folder, limit) {
  let real;
  try {
    real = realpathSync(folder);
  } catch (error) {
    return failure(folder, error);
  }
  if (!runRootFits(real, limit)) {
    return { shown: real, reason: `its run root would take ${runRootBytes(real)} bytes, over ${limit}, and a Unix socket path under it would pass ${SOCKET_PATH_MAX_BYTES} bytes` };
  }
  try {
    return { runRoot: mkdtempSync(join(real, 'devkit-suite-')) };
  } catch (error) {
    return failure(real, error);
  }
}

// The run root: under the real `tmp` when it fits, else under the real `short`, else a UsageError. `line` says where and why when `tmp` was not used.
export function makeRunRoot({ tmp, short, limit }) {
  const first = tryRunRoot(tmp, limit);
  if (first.runRoot) return { runRoot: first.runRoot, line: null };
  const second = tryRunRoot(short, limit);
  if (second.runRoot) return { runRoot: second.runRoot, line: `run root: ${second.runRoot} (TMPDIR ${first.shown}: ${first.reason})` };
  throw new UsageError(`no folder can hold the run root: TMPDIR ${first.shown}: ${first.reason}; ${second.shown}: ${second.reason}`);
}

function runFile(file, place, options, root, runRoot, running) {
  const folder = join(runRoot, String(place).padStart(2, '0')); // the place alone: a Unix socket path under it must stay short (runRootLimit)
  mkdirSync(folder);
  const env = { ...process.env, TMPDIR: folder };
  delete env.NODE_TEST_CONTEXT; // a nested `node --test` would otherwise act as a child runner and write serialized reports
  const args = ['--test', `--test-reporter=${options.reporter}`, ...options.patterns, file];
  const startedAt = Date.now();
  process.stdout.write(`start ${file}\n`);
  return new Promise((done) => {
    let output = '';
    let child;
    let finished = false;
    const finish = (code, signal) => {
      if (finished) return;
      finished = true;
      running.delete(file);
      const left = leftNames(folder);
      if (left.length) removeTree(folder);
      else removeEmpty(folder);
      const failed = code !== 0 || signal !== null;
      const status = failed ? 'FAIL' : left.length ? 'LEFT' : 'pass';
      const seconds = (Date.now() - startedAt) / 1000;
      if (output && !output.endsWith('\n')) output += '\n';
      process.stdout.write(`=== ${file}\n${output}=== ${file}: ${status} ${seconds.toFixed(1)}s\n`);
      done({ file, status, seconds, left, counts: counts(output) });
    };
    try {
      child = spawn(process.execPath, args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      output = `${error.message}\n`;
      finish(1, null);
      return;
    }
    running.set(file, child);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      output += `${error.message}\n`;
      if (child.pid === undefined) finish(1, null); // never started: no close event follows
    });
    child.on('close', finish);
  });
}

// Starts files in `order` while fewer than `concurrency` run; stops starting after `state.signal` is set.
function runPool(order, concurrency, state, runOne) {
  return new Promise((resolvePool) => {
    const results = [];
    let next = 0;
    let active = 0;
    const pump = () => {
      while (!state.signal && active < concurrency && next < order.length) {
        const file = order[next];
        next += 1;
        active += 1;
        runOne(file).then((result) => {
          results.push(result);
          active -= 1;
          pump();
        });
      }
      if (active === 0 && (state.signal || next >= order.length)) resolvePool(results);
    };
    pump();
  });
}

function killGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function summary(results, seconds, concurrency) {
  const lines = [];
  for (const result of [...results].sort((a, b) => (a.file < b.file ? -1 : 1))) {
    let line = `${result.status} ${result.seconds.toFixed(1)}s ${result.file}`;
    if (result.left.length) { // LEFT, or FAIL with something left too
      const shown = result.left.slice(0, LEFT_NAMES_SHOWN).join(', ');
      const more = result.left.length - LEFT_NAMES_SHOWN;
      line += ` left: ${shown}${more > 0 ? `, and ${more} more` : ''}`;
    }
    lines.push(line);
  }
  const sum = (key) => (results.every((r) => r.counts) ? String(results.reduce((total, r) => total + r.counts[key], 0)) : '?');
  lines.push(`suite: ${results.length} files, ${sum('tests')} tests, ${sum('pass')} pass, ${sum('fail')} fail, ${seconds.toFixed(1)}s, concurrency ${concurrency}`);
  return lines.join('\n');
}

function isEntry(argv1) {
  try {
    return realpathSync(argv1) === fileURLToPath(import.meta.url);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

// What `--own-files` runs: the result of selectTests, or `whole` when the branch is a train branch or git cannot tell the own files. The own
// files, the branch and the train pattern come from deliver-check.mjs, loaded here only: a whole run never loads it.
async function selectOwn(root, map, files) {
  const deliver = await import(pathToFileURL(join(root, 'plugins/openspec/hooks/deliver-check.mjs')).href);
  const branch = deliver.currentBranch(root, process.env);
  if (deliver.TRAIN_BRANCH.test(branch)) return { kind: 'whole', reason: `${branch} is a train branch` };
  let own;
  try {
    own = deliver.branchOwnPaths(root, deliver.gitFacts(root, { base: deliver.stalenessBase(root, process.env) }));
  } catch (error) {
    own = { base: null, why: `git cannot tell the own files: ${String(error.message).split('\n')[0]}` };
  }
  if (own.why) return { kind: 'whole', reason: own.why };
  return selectTests({ own: own.paths, map: { slow: [], shared: {}, files: {}, ...map }, suite: files, exists: (path) => existsSync(join(root, path)), uses: sharedUses(root, { shared: {}, ...map }, files) });
}

// The lines that say what a selection runs (D-6); `none` has its own line and no run.
function selectionLines(selection) {
  if (selection.kind === 'whole') return [`selected the whole suite: ${selection.reason}`];
  if (selection.kind === 'none') return [selection.count === 0 ? 'selected no test file: no own file' : `selected no test file: ${selection.count} own files, none maps to a test`];
  return selection.files.map(({ file, by }) => `selected ${file} by ${by.join(', ')}`);
}

export async function main(argv, root = ROOT, short = SHORT_TMP) {
  let options;
  let order;
  let made;
  let selection = null;
  try {
    const files = suiteFiles(root);
    options = parseArgs(argv, root, files);
    const refused = testImports(root);
    if (refused.length) {
      for (const { file, line, spec } of refused) {
        process.stderr.write(`${file}:${line}: imports ${spec}, a test file; move what it needs to a module that holds no test (in devkit-openspec, ${FIXTURES}) and import that\n`);
      }
      process.stderr.write(`refused: ${refused.length} test-file imports\n`);
      return 1;
    }
    if (options.ownFiles) {
      const found = readTestMap(root);
      const problems = found.error ? [{ entry: null, why: found.error }] : mapProblems(root, found.map, files);
      if (problems.length) {
        for (const { entry, why } of problems) process.stderr.write(`${MAP_FILE}: ${entry === null ? '' : `${entry}: `}${why}\n`);
        process.stderr.write(`refused: ${problems.length} test map problems\n`);
        return 1;
      }
      selection = await selectOwn(root, found.map, files);
      if (selection.kind === 'none') {
        process.stdout.write(`${selectionLines(selection).join('\n')}\n`);
        return 0;
      }
    }
    const chosen = selection?.kind === 'files' ? selection.files.map(({ file }) => file) : options.only.length ? options.only : files;
    if (chosen.length === 0) {
      process.stderr.write(`no test file under ${SUITE_FOLDERS.join(', ')}\n`);
      return 1;
    }
    order = chosen
      .map((file) => ({ file, place: files.indexOf(file), size: statSync(join(root, file)).size }))
      .sort((a, b) => b.size - a.size || (a.file < b.file ? -1 : 1));
    made = makeRunRoot({ tmp: tmpdir(), short, limit: runRootLimit(files.length) });
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`${error.message}\n${USAGE}\n`);
    return 2;
  }

  const { runRoot, line } = made;
  if (line) process.stdout.write(`${line}\n`);
  if (selection) process.stdout.write(`${selectionLines(selection).join('\n')}\n`);
  const running = new Map(); // file -> child
  const state = { signal: null };
  let stillRunning = [];
  const interrupt = (signal) => {
    if (state.signal) return;
    state.signal = signal;
    stillRunning = [...running.keys()];
    for (const child of running.values()) killGroup(child, 'SIGTERM');
    setTimeout(() => {
      for (const child of running.values()) killGroup(child, 'SIGKILL');
    }, STOP_WAIT_MS).unref();
  };
  const onInt = () => interrupt('SIGINT');
  const onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);

  const startedAt = Date.now();
  const places = new Map(order.map(({ file, place }) => [file, place]));
  let results;
  try {
    results = await runPool(order.map(({ file }) => file), options.concurrency, state,
      (file) => runFile(file, places.get(file), options, root, runRoot, running));
  } finally {
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
    removeTree(runRoot);
  }
  if (state.signal) {
    process.stdout.write(`interrupted; still running: ${stillRunning.join(', ')}\n`);
    return state.signal === 'SIGINT' ? 130 : 143;
  }
  process.stdout.write(`${summary(results, (Date.now() - startedAt) / 1000, options.concurrency)}\n`);
  return results.every((result) => result.status === 'pass') ? 0 : 1;
}

// `import.meta.url` is the real path, so a start through a symlink (macOS /tmp and /var are links) compares by real path.
if (process.argv[1] && isEntry(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2));
}
