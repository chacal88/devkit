// The machine's test-slot ledger (helper-conductor D-25, AC-22): which whole-suite and gate test runs are in flight on this machine,
// so that a conducted roadmap run caps them. One ledger per machine, not per run file, so two clones share it:
// `$DEVKIT_STATE_DIR`, else `$XDG_STATE_HOME/devkit`, else `~/.local/state/devkit`, file `test-slots.json` under the lock
// `test-slots.lock`. The `test-run` verb of `roadmap-loop.mjs` is its only caller. Runs nothing when imported.
//
// Shape: `{ version: 1, suite: { owner, pid, clone, at } | null, trainWaiting: { pid, clone, at } | null, gates: [{ owner, pid,
// clone, at }] }`, `owner` a change id or `@train`, `clone` the main root. Every read drops an entry whose pid is not alive.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { withLockFile } from './change-loop.mjs';

export const SLOTS_LOCK = { stepMs: 100, waitMs: 5_000, staleMs: 60_000 };
export const SLOT_STEP_MS = 15_000;

const emptyLedger = () => ({ version: 1, suite: null, trainWaiting: null, gates: [] });
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A pid is alive unless `process.kill(pid, 0)` says there is no such process (a process of another user answers EPERM and is alive).
function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code !== 'ESRCH'; }
}

export function slotsPaths(env = process.env) {
  const dir = env.DEVKIT_STATE_DIR || (env.XDG_STATE_HOME ? join(env.XDG_STATE_HOME, 'devkit') : join(env.HOME || homedir(), '.local', 'state', 'devkit'));
  return { dir, ledger: join(dir, 'test-slots.json'), lock: join(dir, 'test-slots.lock') };
}

const entryOf = (v, withOwner) => (isObject(v) && Number.isInteger(v.pid) && v.pid > 0 && (!withOwner || typeof v.owner === 'string')
  ? { ...(withOwner ? { owner: v.owner } : {}), pid: v.pid, clone: typeof v.clone === 'string' ? v.clone : '', at: typeof v.at === 'string' ? v.at : '' }
  : null);

// The ledger as the file holds it, every entry whole, no pid asked about; a missing or broken file is an empty ledger.
function rawLedger(env) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(slotsPaths(env).ledger, 'utf8')); } catch { return emptyLedger(); }
  if (!isObject(parsed)) return emptyLedger();
  return {
    version: 1,
    suite: entryOf(parsed.suite, true),
    trainWaiting: entryOf(parsed.trainWaiting, false),
    gates: Array.isArray(parsed.gates) ? parsed.gates.map((g) => entryOf(g, true)).filter(Boolean) : [],
  };
}

function liveOnly(ledger, alive) {
  return {
    version: 1,
    suite: ledger.suite && alive(ledger.suite.pid) ? ledger.suite : null,
    trainWaiting: ledger.trainWaiting && alive(ledger.trainWaiting.pid) ? ledger.trainWaiting : null,
    gates: ledger.gates.filter((g) => alive(g.pid)),
  };
}

// The ledger with the dead pids dropped. No lock, no write.
export function readSlots({ env = process.env, alive = pidAlive } = {}) {
  return liveOnly(rawLedger(env), alive);
}

function writeLedger(env, ledger) {
  const { dir, ledger: file } = slotsPaths(env);
  mkdirSync(dir, { recursive: true });
  const scratch = `${file}.${process.pid}.tmp`;
  writeFileSync(scratch, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(scratch, file);
}

function underLock(env, work) {
  const { dir, lock } = slotsPaths(env);
  mkdirSync(dir, { recursive: true });
  return withLockFile({ lock, ...SLOTS_LOCK, timeout: () => new Error(`test-slots: the ledger lock ${lock} is held`) }, work);
}

// One round of taking a slot, under the lock. → `{ taken: true }` with the entry written, or `{ taken: false, wait }` with the line
// the waiter prints on its first round (having written `trainWaiting` for a train's suite that has to wait).
export function tryTakeSlot({ owner, kind, clone, pid, gates, env = process.env, alive = pidAlive, now = new Date() }) {
  return underLock(env, () => {
    const ledger = readSlots({ env, alive });
    const entry = { owner, pid, clone, at: now.toISOString() };
    const waiting = ledger.trainWaiting !== null && ledger.trainWaiting.pid !== pid;
    const trainRuns = ledger.suite?.owner === '@train' && ledger.suite.pid !== pid;
    const trainLine = "devkit-test: waiting for the train's suite";
    if (kind === 'gate') {
      if (waiting || trainRuns) return { taken: false, wait: trainLine };
      if (ledger.gates.length >= gates) return { taken: false, wait: `devkit-test: waiting for a gate slot (${ledger.gates.length} of ${gates} in flight)` };
      writeLedger(env, { ...ledger, gates: [...ledger.gates, entry] });
      return { taken: true };
    }
    if (owner === '@train') {
      const mine = { pid, clone, at: entry.at };
      if (ledger.suite === null && !waiting && ledger.gates.length === 0) {
        writeLedger(env, { ...ledger, suite: entry, trainWaiting: null });
        return { taken: true };
      }
      if (!waiting) writeLedger(env, { ...ledger, trainWaiting: mine });
      if (ledger.suite !== null) return { taken: false, wait: `devkit-test: waiting for a whole-suite slot (${ledger.suite.owner})` };
      if (waiting) return { taken: false, wait: 'devkit-test: waiting for a whole-suite slot (@train)' };
      return { taken: false, wait: `devkit-test: the train waits for ${ledger.gates.length} test runs to end` };
    }
    if (ledger.suite !== null) return { taken: false, wait: ledger.suite.owner === '@train' ? trainLine : `devkit-test: waiting for a whole-suite slot (${ledger.suite.owner})` };
    if (waiting) return { taken: false, wait: trainLine };
    writeLedger(env, { ...ledger, suite: entry });
    return { taken: true };
  });
}

// Removes that pid's `suite`, gate and `trainWaiting` entries and no other; a missing ledger is no error and stays missing.
export function releaseSlots({ pid, env = process.env }) {
  underLock(env, () => {
    if (!existsSync(slotsPaths(env).ledger)) return;
    const ledger = rawLedger(env);
    writeLedger(env, {
      ...ledger,
      suite: ledger.suite?.pid === pid ? null : ledger.suite,
      trainWaiting: ledger.trainWaiting?.pid === pid ? null : ledger.trainWaiting,
      gates: ledger.gates.filter((g) => g.pid !== pid),
    });
  });
}

// Tries until the slot is taken, sleeping `stepMs` between rounds and logging the first wait line only.
export async function waitForSlot({ owner, kind, clone, pid, gates, env = process.env, alive = pidAlive, sleep = delay, log = (line) => process.stderr.write(`${line}\n`), stepMs = SLOT_STEP_MS }) {
  for (let round = 0; ; round++) {
    const result = tryTakeSlot({ owner, kind, clone, pid, gates, env, alive });
    if (result.taken) return;
    if (round === 0) log(result.wait);
    await sleep(stepMs);
  }
}
