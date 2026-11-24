#!/usr/bin/env node
// The devkit test suite: `node scripts/test-suite.mjs [--concurrency=<n>] [--reporter=<name>]
// [--test-name-pattern=<re>] [--test-skip-pattern=<re>] [<test file>...]` (ADR 0026).
//
// Runs every `*.test.mjs` of the suite's four folders, each file in a process of its own (`node --test <file>`),
// several at once, each with its own empty real-path TMPDIR under one run root. Refuses a test file that imports
// another test file, fails a file that leaves anything in its TMPDIR, and exits 1 when any file fails.
// Exit codes: 0 green; 1 a failed file, a leftover, a refused import or no test file; 2 a usage error;
// 130 after SIGINT; 143 after SIGTERM.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, rmdirSync, statSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The folders the suite reads, relative to the root: those whose tests the old command ran. The other tests of plugins/compozy and
// those of plugins/panel stay out (ADR 0026 decision 6).
const SUITE_FOLDERS = [
  'plugins/openspec/hooks',
  'plugins/openspec/skills/openspec-setup/scripts',
  'plugins/core/skills/review-change/scripts',
  'plugins/compozy/skills/compozy-setup/scripts',
];
const TEST_FILE = /\.test\.mjs$/;
const IMPORTED_TEST_FILE = /(?:\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"]([^'"]*\.test\.mjs)['"]/;
const FIXTURES = 'plugins/openspec/hooks/test-fixtures.mjs';
const USAGE = 'usage: node scripts/test-suite.mjs [--concurrency=<n>] [--reporter=<name>] [--test-name-pattern=<re>] [--test-skip-pattern=<re>] [<test file>...]';
const STOP_WAIT_MS = 10_000;
const LEFT_NAMES_SHOWN = 10;

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

// `{ file, line, spec }` of every line of a *.test.mjs under <root>/plugins that imports a *.test.mjs, sorted.
export function testImports(root = ROOT) {
  const found = [];
  for (const file of walk(root, join(root, 'plugins'), (name) => TEST_FILE.test(name))) {
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

// The arguments, one by one; anything else is a usage error.
function parseArgs(argv, root, files) {
  const options = { concurrency: availableParallelism(), reporter: 'spec', patterns: [], only: [] };
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
    } else {
      throw new UsageError(`unknown argument: ${arg}`);
    }
  }
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

function runFile(file, place, options, root, runRoot, running) {
  const folder = join(runRoot, `${String(place).padStart(2, '0')}-${file.split('/').pop().replace(TEST_FILE, '')}`);
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
    if (result.status === 'LEFT') {
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

export async function main(argv, root = ROOT) {
  let options;
  let order;
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
    const chosen = options.only.length ? options.only : files;
    if (chosen.length === 0) {
      process.stderr.write(`no test file under ${SUITE_FOLDERS.join(', ')}\n`);
      return 1;
    }
    order = chosen
      .map((file) => ({ file, place: files.indexOf(file), size: statSync(join(root, file)).size }))
      .sort((a, b) => b.size - a.size || (a.file < b.file ? -1 : 1));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`${error.message}\n${USAGE}\n`);
    return 2;
  }

  const runRoot = mkdtempSync(join(realpathSync(tmpdir()), 'devkit-suite-'));
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
