// compozy-driver: the one module that calls CompozyOS from the scripts (design compozy-driver D-2).
//
// `change-loop.mjs` and `roadmap-loop.mjs` import it; no other file spawns `compozy`. Every function takes `{ env, exec }`:
// the binary is `env.COMPOZY_BIN` when set, else `compozy` on PATH, and `exec(command, args, { cwd, env })` (the shape of
// `spawnSync`'s result: { status, stdout, stderr, error }) is injectable so a test passes a fake. `root` is the main checkout,
// the workspace's folder. The readiness check starts nothing: it never starts the daemon. No dependencies.

import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { LoopUsageError } from './change-loop.mjs';

// The states of a run that still holds its change: a second `compozy-start` for the change answers with its url.
export const LIVE_STATES = ['queued', 'running', 'watching', 'needs-approval', 'paused'];

// The change loop the readiness check looks for in the workspace.
export const CHANGE_LOOP = 'devkit-change';

const FIX = {
  'not-installed': 'brew install compozy/compozy/compozy',
  'daemon-stopped': 'compozy daemon start',
  'kit-missing': '/devkit setup installs the devkit kit into this project (answer yes to the kit question)',
};

const defaultExec = (command, args, { cwd, env }) => spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function context(opts = {}) {
  const env = opts.env ?? process.env;
  return { env, exec: opts.exec ?? defaultExec, bin: env.COMPOZY_BIN || 'compozy' };
}

// Runs `compozy <args>` in `root`; the spawn result, with `error` set when the binary could not be spawned.
function call(root, args, opts) {
  const { env, exec, bin } = context(opts);
  return exec(bin, args, { cwd: root, env: { ...process.env, ...env } });
}

const firstLine = (text) => String(text ?? '').split('\n').find((l) => l.trim() !== '')?.trim() ?? '';

// The command's JSON on success; any other failure is a LoopUsageError with its first stderr line (or its exit status).
function ask(root, args, opts) {
  const r = call(root, args, opts);
  if (r.error || r.status !== 0) {
    const why = r.error ? r.error.message : firstLine(r.stderr) || `compozy ${args.slice(0, 2).join(' ')} exited ${r.status}`;
    throw new LoopUsageError(why);
  }
  return r.stdout;
}

function askJson(root, args, opts) {
  const text = ask(root, args, opts);
  try { return JSON.parse(text); } catch { throw new LoopUsageError(`compozy ${args.slice(0, 2).join(' ')} printed something that is not JSON`); }
}

const itemsOf = (value) => (Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []);

// True when something listens on the daemon's socket. A child process connects and exits 0 or 1, so the check never starts the daemon.
function daemonListens(env) {
  const home = env.COMPOZY_HOME || join(env.HOME || homedir(), '.compozy');
  const script = "const s=require('net').connect(process.argv[1]);s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),3000)";
  const r = spawnSync(process.execPath, ['-e', script, join(home, 'daemon.sock')], { stdio: 'ignore', timeout: 5000 });
  return r.status === 0;
}

// `{ ok: true }`, or the first failing row as `{ ok: false, reason, fix }`: not-installed, daemon-stopped, workspace-unknown, kit-missing.
export function readiness(root, opts = {}) {
  const { env } = context(opts);
  const stop = (reason) => ({ ok: false, reason, fix: reason === 'workspace-unknown' ? `compozy workspace add ${root}` : FIX[reason] });
  if (call(root, ['--version'], opts).error?.code === 'ENOENT') return stop('not-installed');
  if (!daemonListens({ ...process.env, ...env })) return stop('daemon-stopped');
  if (call(root, ['workspace', 'info', '-o', 'json'], opts).status !== 0) return stop('workspace-unknown');
  if (call(root, ['loop', 'inspect', '--name', CHANGE_LOOP, '--workspace', root, '-o', 'json'], opts).status !== 0) return stop('kit-missing');
  return { ok: true };
}

// The runs of `loop` that are still live: [{ runId, status, inputs }].
export function liveRuns(root, loop, opts = {}) {
  const runs = itemsOf(askJson(root, ['loop', 'runs', '--loop', loop, '--workspace', root, '-o', 'json'], opts));
  return runs
    .filter((r) => LIVE_STATES.includes(r?.status))
    .map((r) => ({ runId: r.run_id, status: r.status, inputs: r.inputs && typeof r.inputs === 'object' ? r.inputs : {} }));
}

// Starts a run of `loop` with `inputs` (one --input per key): { runId, url }, `url` null when the reply has no web_url.
export function startRun(root, loop, inputs, opts = {}) {
  const args = ['loop', 'run', '--name', loop, '--workspace', root, '--no-prompt', '-o', 'json'];
  for (const [key, value] of Object.entries(inputs ?? {})) args.push('--input', `${key}=${value}`);
  const reply = askJson(root, args, opts);
  const runId = reply?.run?.run_id ?? reply?.run?.id;
  if (typeof runId !== 'string' || !runId) throw new LoopUsageError('compozy loop run answered with no run id');
  return { runId, url: typeof reply.web_url === 'string' && reply.web_url ? reply.web_url : null };
}

const act = (verb) => (root, runId, opts = {}) => { ask(root, ['loop', verb, '--run-id', runId, '--workspace', root], opts); };
export const pauseRun = act('pause');
export const resumeRun = act('resume');
export const cancelRun = act('cancel');

// The count of the human requests of the workspace that wait for an answer.
export function pendingRequests(root, opts = {}) {
  return itemsOf(askJson(root, ['loop', 'requests', '--workspace', root, '-o', 'json'], opts)).length;
}
