// machine-probe: the program the coordinator sends over SSH to ask another machine (design remote-worker D-6).
//
// It is never run from its path on the other machine: `roadmap-loop.mjs` reads this text and pipes it to
// `node --input-type=module - <verb> <args>...`. Node built-ins only, no import of the pack: the machine may hold any version of it.
//
// Verb `state <folder> <lang>`: finds the installation of the devkit-openspec pack in `~/.claude/plugins/installed_plugins.json` (one
// scoped to the project at `<folder>` or above, else a user-scoped one), runs its `roadmap-loop.mjs status --json --lang <lang>` in
// `<folder>` and prints its object. Anything that goes wrong prints `{ "version": 1, "error": "<why>" }` and exits 3.
//
// Verb `checkout <folder> <id>`: fetches the change's branch into the clone at `<folder>` and prints `{ "version": 1, "worktree": "<path>" }`,
// the worktree of that clone already on the branch, else `<folder>/.claude/worktrees/<id>` made from the branch.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PACK = 'devkit-openspec@';
const STATE_TIMEOUT_MS = 15_000;
const CHECKOUT_TIMEOUT_MS = 100_000;

const failWith = (error) => {
  process.stdout.write(`${JSON.stringify({ version: 1, error })}\n`);
  process.exitCode = 3;
};

// The installation of the pack that serves `folder`: the project-scoped one whose path is `folder` or above it, else the user's.
function installationFor(folder) {
  const installed = JSON.parse(readFileSync(join(homedir(), '.claude', 'plugins', 'installed_plugins.json'), 'utf8'));
  const all = Object.entries(installed.plugins ?? {}).filter(([key]) => key.startsWith(PACK)).flatMap(([, list]) => (Array.isArray(list) ? list : []));
  const above = (path) => typeof path === 'string' && (folder === path || folder.startsWith(path.endsWith('/') ? path : `${path}/`));
  return all.find((e) => e?.scope === 'project' && above(e.projectPath)) ?? all.find((e) => e?.scope === 'user') ?? null;
}

function state(folder, lang) {
  let installation;
  try { installation = installationFor(folder); } catch (e) { return failWith(`installed_plugins.json cannot be read: ${e instanceof Error ? e.message : e}`); }
  if (!installation || typeof installation.installPath !== 'string') return failWith('the devkit-openspec pack is not installed here');
  const l = lang === 'en' ? 'en' : 'pt-BR';
  const r = spawnSync(process.execPath, [join(installation.installPath, 'hooks', 'roadmap-loop.mjs'), 'status', '--json', '--lang', l], {
    cwd: folder, encoding: 'utf8', timeout: STATE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) return failWith(`status failed in ${folder}: ${(r.stderr || r.error?.message || `exit ${r.status}`).split('\n')[0]}`);
  process.stdout.write(r.stdout);
  return undefined;
}

const gitIn = (folder, argv) => spawnSync('git', ['-C', folder, ...argv], { encoding: 'utf8', timeout: CHECKOUT_TIMEOUT_MS });
const firstLine = (r) => (r.stderr || r.stdout || r.error?.message || `exit ${r.status}`).trim().split('\n')[0];

// The path of the worktree of `folder`'s clone that is on branch `id`, or null.
function worktreeOn(folder, id) {
  const listed = gitIn(folder, ['worktree', 'list', '--porcelain']);
  if (listed.status !== 0) return null;
  for (const block of listed.stdout.split('\n\n')) {
    const path = /^worktree (.+)$/m.exec(block)?.[1];
    if (path && block.split('\n').includes(`branch refs/heads/${id}`)) return path;
  }
  return null;
}

function checkout(folder, id) {
  const fetched = gitIn(folder, ['fetch', 'origin', id, '--quiet']);
  if (fetched.status !== 0) return failWith(firstLine(fetched));
  let path = worktreeOn(folder, id);
  if (path === null) {
    path = join(folder, '.claude', 'worktrees', id);
    const made = gitIn(folder, ['worktree', 'add', '-q', path, id]);
    if (made.status !== 0) return failWith(firstLine(made));
  }
  process.stdout.write(`${JSON.stringify({ version: 1, worktree: path })}\n`);
  return undefined;
}

const [verb, ...args] = process.argv.slice(2);
if (verb === 'state' && args.length === 2) state(args[0], args[1]);
else if (verb === 'checkout' && args.length === 2) checkout(args[0], args[1]);
else failWith(`unknown verb or arguments: ${[verb, ...args].join(' ')}`);
