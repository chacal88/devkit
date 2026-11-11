#!/usr/bin/env node
// Opts a project into devkit by writing <root>/.claude/settings.json (ADR 0004, design D4).
//
//   node project-settings.mjs [<project-root>] [--packs <pack,...>] [--dry-run] [--json]
//
// Root: the argument, else the git top level of the cwd, else exit 1. Only <root>/.claude/settings.json
// is written (never settings.local.json), and never when the root is the home folder (user scope).
// Exit 0 done, 1 refused or unreadable, 2 usage.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const PACKS = ['devkit-core', 'devkit-openspec', 'devkit-design', 'devkit-stack', 'devkit-ai-engineering', 'devkit-panel'];
export const DEFAULT_PACKS = ['devkit-core', 'devkit-openspec'];
export const MARKETPLACE_SOURCE = { source: 'github', repo: 'chacal88/devkit' };
const USAGE = 'usage: project-settings.mjs [<project-root>] [--packs <pack,...>] [--dry-run] [--json]';

export class UsageError extends Error { name = 'UsageError'; }
export class RefusedError extends Error { name = 'RefusedError'; }

export function parseArgs(argv) {
  const opts = { root: null, packs: DEFAULT_PACKS, dryRun: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--packs') {
      const v = argv[++i];
      if (!v) throw new UsageError(USAGE);
      opts.packs = v.split(',').map((s) => s.trim()).filter(Boolean);
      const bad = opts.packs.filter((p) => !PACKS.includes(p));
      if (bad.length || !opts.packs.length) throw new UsageError(`unknown pack: ${bad.join(', ') || '(none)'}. Known: ${PACKS.join(', ')}`);
    } else if (a.startsWith('-') || opts.root) throw new UsageError(USAGE);
    else opts.root = a;
  }
  return opts;
}

function resolveRoot(arg) {
  if (arg) return resolve(arg);
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new RefusedError('not in a git repository: pass the project path');
  }
}

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

// Returns { next, items } without touching the disk. `current` is the parsed settings object or null.
export function merge(current, packs) {
  const next = current ? { ...current } : {};
  const items = [];

  const markets = { ...(next.extraKnownMarketplaces ?? {}) };
  const have = markets.devkit;
  if (have === undefined) {
    markets.devkit = { source: { ...MARKETPLACE_SOURCE } };
    items.push({ key: 'marketplace devkit', action: 'add' });
  } else if (isDeepStrictEqual(have, { source: MARKETPLACE_SOURCE })) {
    items.push({ key: 'marketplace devkit', action: 'ok' });
  } else {
    items.push({ key: 'marketplace devkit', action: `kept (${JSON.stringify(have.source ?? have)})` });
  }
  if (!isDeepStrictEqual(markets, next.extraKnownMarketplaces)) next.extraKnownMarketplaces = markets;

  const enabled = { ...(next.enabledPlugins ?? {}) };
  for (const pack of packs) {
    const key = `${pack}@devkit`;
    if (!(key in enabled)) { enabled[key] = true; items.push({ key, action: 'enable' }); }
    else if (enabled[key] === true) items.push({ key, action: 'ok' });
    else { enabled[key] = true; items.push({ key, action: 'enable (was false)' }); }
  }
  if (!isDeepStrictEqual(enabled, next.enabledPlugins)) next.enabledPlugins = enabled;
  return { next, items };
}

export function plan(rootArg, packs, home = homedir()) {
  const root = resolveRoot(rootArg);
  if (real(root) === real(home)) throw new RefusedError(`${root} is the home folder: ~/.claude/settings.json is user scope, run this in a project`);
  const path = join(root, '.claude', 'settings.json');
  let current = null;
  let before = null;
  if (existsSync(path)) {
    before = readFileSync(path, 'utf8');
    try { current = JSON.parse(before); } catch (e) { throw new RefusedError(`${path} is not valid JSON (${e.message}); fix it first`); }
    if (current === null || typeof current !== 'object' || Array.isArray(current)) throw new RefusedError(`${path} is not a JSON object; fix it first`);
  }
  const { next, items } = merge(current, packs);
  const text = JSON.stringify(next, null, 2) + '\n';
  const file = before === null ? 'create' : text === before || isDeepStrictEqual(current, next) ? 'unchanged' : 'update';
  return { path, text, file, items };
}

export function apply({ path, text }) {
  mkdirSync(join(path, '..'), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
    const p = plan(opts.root, opts.packs);
    if (p.file !== 'unchanged' && !opts.dryRun) apply(p);
    if (opts.json) process.stdout.write(JSON.stringify({ path: p.path, file: p.file, items: p.items }) + '\n');
    else {
      for (const it of p.items) process.stdout.write(`${it.key}: ${it.action}\n`);
      process.stdout.write(`file: ${p.file} ${p.path}\n`);
    }
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(e instanceof UsageError ? 2 : 1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
