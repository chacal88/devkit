#!/usr/bin/env node
// status-line: the Claude Code status line of a session that conducts a change or coordinates a roadmap run (run-status-bar D-1 to D-10).
//
// `node status-line.mjs [--lang <en|pt-BR>]` reads the JSON Claude Code writes on standard input (`session_id`, and the folder from
// `workspace.current_dir`, else `cwd`; every other field is ignored) and prints ONE line, or nothing:
//   - the session the roadmap run file records prints the counts of the changes in play (`state --offline`, D-7);
//   - a folder that is a change's checkout, on the change's branch or its archive branch, prints that change's line (`state --change`, D-5);
//   - any other session prints nothing.
// It reads the state only through `change-loop.mjs state` (ADR 0017 decision 1), at most once per run and for at most 20 seconds, writes
// nothing, calls no AI and always exits 0: whatever cannot be read leaves the line empty.

import { execFileSync, spawn } from 'node:child_process';
import { statSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOOKS_DIR, isObject, normalizeLang, readStdin, render } from './change-loop.mjs';
import { readRun, runFilePath } from './run-file.mjs';
import { isChangeId } from './guard.mjs';

const STATE_BOUND_MS = 20_000; // the bound a remote `state` read already has in roadmap-loop.mjs
const GIT_BOUND_MS = 5000;
const INPUT_WAIT_MS = 1000; // Claude Code writes the JSON at once; a longer wait would only keep a stale run alive (D-2)
const ARCHIVE_BRANCH = 'chore/archive-';

// ---------------------------------------------------------------- the input (D-2)

// { folder, session } from the text on standard input: the folder is the first non-empty string of `workspace.current_dir` and `cwd`, else
// `cwd` (the process's folder); the session is `session_id` when it is a non-empty string, else null. Text that is empty, cut off, not JSON
// or not an object reads as no fields.
export function inputOf(text, cwd = process.cwd()) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { folder: cwd, session: null }; }
  if (!isObject(parsed)) return { folder: cwd, session: null };
  const named = (value) => (typeof value === 'string' && value !== '' ? value : null);
  const workspace = isObject(parsed.workspace) ? parsed.workspace : {};
  return { folder: named(workspace.current_dir) ?? named(parsed.cwd) ?? cwd, session: named(parsed.session_id) };
}

// { lang } from the arguments, or { problem } naming the first one the command does not know.
function optionsOf(argv) {
  let lang = null;
  for (let i = 0; i < argv.length; i += 1) {
    const hasValue = argv[i] === '--lang' && i + 1 < argv.length && !argv[i + 1].startsWith('--');
    if (!hasValue) return { problem: argv[i] };
    lang = argv[i + 1];
    i += 1;
  }
  return { lang };
}

// ---------------------------------------------------------------- the drawing (D-5 to D-7)

const LIMIT = 100;
const SEPARATOR = ' · ';
const ELLIPSIS = '…';
const ID_KEEPS = 20; // the id keeps at least this many columns when the line is cut at the id
const MARK = { done: '■', current: '◆', later: '□' };
const IS_MARK = /\p{M}/u;
const IS_PICTOGRAPH = /\p{Extended_Pictographic}/u;

// The columns the text takes: an emoji two, a variation selector, a joiner or a combining mark none, any other code point one.
export function columns(text) {
  let total = 0;
  for (const point of text) {
    if (point === '\uFE0F' || point === '\u200D' || IS_MARK.test(point)) continue;
    total += IS_PICTOGRAPH.test(point) ? 2 : 1;
  }
  return total;
}

const present = (value) => typeof value === 'string' && value !== '';

// The strip and `<n> of <N>` of an entry whose `stages` list holds its stage: one mark per stage, done before the current one, the
// current one, not yet after it (D-5); null when the list is missing or does not hold the stage.
function progressOf(entry, lang) {
  const stages = Array.isArray(entry.stages) ? entry.stages : [];
  const at = stages.indexOf(entry.stage);
  if (at < 0) return null;
  const strip = stages.map((_, i) => (i < at ? MARK.done : i === at ? MARK.current : MARK.later)).join('');
  return { strip, progress: render(lang, 'bar.progress', { n: at + 1, total: stages.length }) };
}

// The change's line (D-5): `<state icon> <stage icon> <id> · <stage title> · <strip> · <n> of <N>[ · <reason>]`, cut to 100 columns (D-6).
export function lineOfChange(entry, lang) {
  const l = normalizeLang(lang);
  const icons = [entry.stateIcon, entry.stageIcon === entry.stateIcon ? null : entry.stageIcon].filter(present);
  const drawn = progressOf(entry, l);
  const middle = [entry.stageTitle, drawn?.strip, drawn?.progress].filter(present);
  const text = entry.state !== 'running' && isObject(entry.reason) && present(entry.reason.text) ? entry.reason.text : null;
  const compose = (id, reason) => [[...icons, id].join(' '), ...middle, ...(reason === null ? [] : [reason])].join(SEPARATOR);
  const whole = compose(entry.change, text);
  if (columns(whole) <= LIMIT) return whole;
  // 1. the reason loses its last words, one at a time, and ends in an ellipsis, keeping its first word.
  const words = text === null ? [] : text.split(' ');
  while (words.length > 1) {
    words.pop();
    const cut = compose(entry.change, `${words.join(' ')}${ELLIPSIS}`);
    if (columns(cut) <= LIMIT) return cut;
  }
  // 2. the reason goes with its separator.
  const bare = compose(entry.change, null);
  if (columns(bare) <= LIMIT) return bare;
  // 3. the id is cut at its end: the leading columns for which the line, with the ellipsis after them, fits, never fewer than 20.
  const keep = Math.max(ID_KEEPS, LIMIT - columns(compose('', null)) - columns(ELLIPSIS));
  if (columns(entry.change) <= keep) return bare;
  let id = '';
  for (const point of entry.change) {
    if (columns(id) + columns(point) > keep) break;
    id += point;
  }
  return compose(`${id}${ELLIPSIS}`, null);
}

// The coordinator's counts (D-7): every entry in play, then those running, waiting for the owner and blocked, each printed even at zero;
// `waiting-on-github` and `archived` count in play only.
export function countsLine(changes, lang) {
  const l = normalizeLang(lang);
  const count = (state) => changes.filter((entry) => entry.state === state).length;
  const blocked = count('blocked');
  return render(l, 'bar.counts', {
    all: changes.length, running: count('running'), waiting: count('waiting-for-owner'), blocked,
    blockedWord: render(l, blocked === 1 ? 'bar.blocked-one' : 'bar.blocked-other'),
  });
}

// ---------------------------------------------------------------- which line (D-3)

const git = (folder, args) => {
  try {
    return execFileSync('git', ['-C', folder, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_BOUND_MS }).trim();
  } catch { return null; }
};
const isFolder = (path) => { try { return statSync(path).isDirectory(); } catch { return false; } };
const sameFolder = (a, b) => { try { return realpathSync(a) === realpathSync(b); } catch { return false; } };

// True when the run file of the clone records this session as the one that coordinates the run.
function coordinates(folder, session) {
  if (session === null) return false;
  try { return readRun(runFilePath(folder)).session === session; } catch { return false; }
}

// { checkout, branch, id } of the change this folder conducts: on `chore/archive-<id>` the change `<id>`, else the branch itself when
// the checkout has a folder of that name under openspec/changes; null for a detached HEAD, `main` or a branch that is no change.
function changeAt(folder) {
  const checkout = git(folder, ['rev-parse', '--show-toplevel']);
  const branch = git(folder, ['symbolic-ref', '--short', '-q', 'HEAD']);
  if (!checkout || !branch) return null;
  const id = branch.startsWith(ARCHIVE_BRANCH) ? branch.slice(ARCHIVE_BRANCH.length) : branch;
  if (!isChangeId(id)) return null;
  if (id === branch && !isFolder(join(checkout, 'openspec', 'changes', id))) return null;
  return { checkout, branch, id };
}

// ---------------------------------------------------------------- the state call (D-9)

// The standard output of `program <args>` run in `folder`, or null when it exits non-zero, cannot start, is aborted, or passes `boundMs`.
// Its child is killed with SIGTERM at the bound or at the abort, and the promise settles only once the child has ended.
function stateText(program, args, folder, { boundMs, signal }) {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(null); return; }
    let child;
    try { child = spawn(program, args, { cwd: folder, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { resolve(null); return; }
    let out = '';
    let cut = false;
    const stop = () => { cut = true; child.kill('SIGTERM'); };
    const timer = setTimeout(stop, boundMs);
    signal?.addEventListener('abort', stop, { once: true });
    const settle = (value) => { clearTimeout(timer); signal?.removeEventListener('abort', stop); resolve(value); };
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('error', () => settle(null));
    child.on('close', (code) => settle(cut || code !== 0 ? null : out));
  });
}

// The `changes` of a state listing, or null when the text is no listing.
function changesOf(text) {
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text);
    return isObject(parsed) && Array.isArray(parsed.changes) ? parsed.changes.filter(isObject) : null;
  } catch { return null; }
}

// ---------------------------------------------------------------- the command

// The line for this session and folder, or '' when it conducts nothing or the state cannot be read.
async function lineFor({ folder, session, lang, ask }) {
  if (coordinates(folder, session)) {
    const changes = changesOf(await ask(['--offline', '--lang', lang]));
    return changes === null ? '' : countsLine(changes, lang);
  }
  const where = changeAt(folder);
  if (where === null) return '';
  const changes = changesOf(await ask(['--change', where.id, '--lang', lang]));
  const found = changes?.find((entry) => entry.change === where.id);
  if (!found || typeof found.root !== 'string' || !sameFolder(found.root, where.checkout) || found.branch !== where.branch) return '';
  return lineOfChange(found, lang);
}

// The injection points are the tests': `stdin` is the input text, `cwd` the process's folder, `stateCommand` the program and leading
// arguments of the `state` call, `boundMs` its bound and `signal` an abort that ends it as the bound does.
export async function main(argv, { stdin = '', cwd = process.cwd(), stateCommand = [process.execPath, join(HOOKS_DIR, 'change-loop.mjs')], boundMs = STATE_BOUND_MS, signal } = {}) {
  const options = optionsOf(argv);
  if (options.problem !== undefined) {
    return { stdout: '', stderr: `status-line: cannot use ${JSON.stringify(options.problem)}; the one option is --lang <en|pt-BR>\n`, code: 0 };
  }
  try {
    const { folder, session } = inputOf(stdin, cwd);
    const [program, ...leading] = stateCommand;
    const ask = (args) => stateText(program, [...leading, 'state', ...args], folder, { boundMs, signal });
    const line = await lineFor({ folder, session, lang: normalizeLang(options.lang), ask });
    return { stdout: line === '' ? '' : `${line}\n`, stderr: '', code: 0 };
  } catch {
    return { stdout: '', stderr: '', code: 0 };
  }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  // Claude Code aborts the run in flight when a newer one starts: the child of the state call ends before this process does.
  const abort = new AbortController();
  for (const name of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(name, () => abort.abort());
  main(process.argv.slice(2), { stdin: readStdin(INPUT_WAIT_MS), signal: abort.signal }).then((r) => {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exitCode = r.code;
  });
}
