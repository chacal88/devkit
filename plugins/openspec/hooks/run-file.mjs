// The run file's shape and its reading (design remote-worker D-9): one run's bookkeeping, kept in the repository's common
// git directory. Moved here from `change-loop.mjs`, where they now also carry `placed`, so that `change-loop.mjs` (the place of a change) and `roadmap-loop.mjs` (the run) read it alike;
// `roadmap-loop.mjs` re-exports `readRun` and `runFilePath`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isChangeId } from './guard.mjs';
import { LoopUsageError } from './change-loop.mjs'; // used only when a function runs, so the import cycle is harmless

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// One run's bookkeeping and nothing the files, the repository or GitHub can say.
export const emptyRun = () => ({
  version: 1, session: null, places: 1, stopping: false, asking: null, inflight: {}, declared: {}, announced: {}, starting: [],
  held: false, holding: null, changeSessions: false, startedSessions: {}, placed: {}, turn: null, updatedAt: null,
});

// `<common git directory>/devkit/roadmap-run.json`: every checkout of the clone and every session see the same file, and no commit holds it.
export function runFilePath(cwd) {
  let common;
  try {
    common = execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { throw new LoopUsageError(`${cwd} is not inside a git repository`); }
  return join(common, 'devkit', 'roadmap-run.json');
}

// The file as it is; a missing or broken one is an empty run with one place, and a field of the wrong type is dropped.
export function readRun(file) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { return emptyRun(); }
  if (!isObject(parsed)) return emptyRun();
  const run = emptyRun();
  if (Number.isInteger(parsed.places) && parsed.places >= 1) run.places = parsed.places;
  if (typeof parsed.session === 'string') run.session = parsed.session;
  if (typeof parsed.asking === 'string') run.asking = parsed.asking;
  if (typeof parsed.updatedAt === 'string') run.updatedAt = parsed.updatedAt;
  for (const key of ['stopping', 'held', 'changeSessions']) if (typeof parsed[key] === 'boolean') run[key] = parsed[key];
  if (parsed.turn === 'typed' || parsed.turn === 'event') run.turn = parsed.turn;
  // The change sessions the run started (D-3): { <change id>: { at } }; a key that is no change id is dropped.
  if (isObject(parsed.startedSessions)) {
    for (const [id, entry] of Object.entries(parsed.startedSessions)) {
      if (isChangeId(id) && isObject(entry)) run.startedSessions[id] = { at: typeof entry.at === 'string' ? entry.at : null };
    }
  }
  // The changes the run opened for another machine (remote-worker D-8): { <change id>: { machine, at } }; anything else is dropped.
  if (isObject(parsed.placed)) {
    for (const [id, entry] of Object.entries(parsed.placed)) {
      if (isChangeId(id) && isObject(entry) && typeof entry.machine === 'string') run.placed[id] = { machine: entry.machine, at: typeof entry.at === 'string' ? entry.at : null };
    }
  }
  // The watch of the load: { pid, at } (D-7); the boolean of 0.18.0, or anything else, is no watch.
  if (isObject(parsed.holding) && Number.isInteger(parsed.holding.pid) && parsed.holding.pid > 0) {
    run.holding = { pid: parsed.holding.pid, at: typeof parsed.holding.at === 'string' ? parsed.holding.at : null };
  }
  for (const key of ['inflight', 'declared', 'announced']) if (isObject(parsed[key])) run[key] = parsed[key];
  if (Array.isArray(parsed.starting)) run.starting = parsed.starting.filter((id) => typeof id === 'string');
  return run;
}
