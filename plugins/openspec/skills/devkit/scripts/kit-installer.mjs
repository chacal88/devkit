#!/usr/bin/env node
// Finds devkit-compozy's kit installer for `/devkit setup` and runs it (project-setup D-4).
//
//   node kit-installer.mjs <project-root> [install-kit arguments...]   runs `node <installer> <project-root> <arguments...>`
//   node kit-installer.mjs --where                                      prints { "installer": <path>, "version": <version> }
//
// The installer is `kit/scripts/install-kit.mjs` of a pack whose `.claude-plugin/plugin.json` names devkit-compozy, searched in order:
//   1. the sibling of this pack, `<devkit-openspec root>/../compozy` (a checkout, or a --plugin-dir run from one);
//   2. the installed packs under `$CLAUDE_CONFIG_DIR/plugins`, else `$HOME/.claude/plugins`: the highest `version` wins, compared
//      field by field as integers, and a tie goes to the lexicographically last path (the rule of the kit's resolver `bin/devkit-kit`).
// A devkit-compozy that keeps its installer elsewhere (0.4.0 and older) is not matched.
// Exit: the installer's own exit code (its output passed through); 2 a usage error; 3 no installer found (one stderr line naming
// devkit-compozy and every location tried). No dependencies.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PACK = 'devkit-compozy';
const INSTALLER = join('kit', 'scripts', 'install-kit.mjs');
const USAGE = 'usage: kit-installer.mjs <project-root> [install-kit arguments...] | kit-installer.mjs --where';

export class KitUsageError extends Error {
  constructor(message) { super(message); this.name = 'KitUsageError'; }
}
export class KitNotFound extends Error {
  constructor(message) { super(message); this.name = 'KitNotFound'; }
}

function manifestOf(dir) {
  try { return JSON.parse(readFileSync(join(dir, '.claude-plugin', 'plugin.json'), 'utf8')); } catch { return null; }
}

// { installer, version } of the devkit-compozy pack at `dir`, or null when it is not one or has no kit installer.
function packAt(dir) {
  const manifest = manifestOf(dir);
  if (manifest?.name !== PACK || !existsSync(join(dir, INSTALLER))) return null;
  return { installer: join(dir, INSTALLER), version: typeof manifest.version === 'string' ? manifest.version : '0' };
}

// > 0 when version `a` is higher than `b`, field by field as integers (a missing field is 0).
function compareVersions(a, b) {
  const x = a.split('.').map((f) => Number.parseInt(f, 10) || 0);
  const y = b.split('.').map((f) => Number.parseInt(f, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

// Every folder under `dir` that holds `.claude-plugin/plugin.json`; symbolic links are not followed.
function packFolders(dir) {
  const found = [];
  const walk = (folder) => {
    let entries;
    try { entries = readdirSync(folder, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.isDirectory() && e.name === '.claude-plugin') && existsSync(join(folder, '.claude-plugin', 'plugin.json'))) found.push(folder);
    for (const e of entries) if (e.isDirectory() && e.name !== '.claude-plugin') walk(join(folder, e.name));
  };
  walk(dir);
  return found;
}

export function pluginsDir(env = process.env) {
  return env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, 'plugins') : join(env.HOME || homedir(), '.claude', 'plugins');
}

// The installer to run: the sibling pack, else the best installed one. Throws KitNotFound naming every location tried.
export function findInstaller(env = process.env) {
  const sibling = resolve(here, '..', '..', '..', '..', 'compozy');
  const own = packAt(sibling);
  if (own) return own;
  const plugins = pluginsDir(env);
  let best = null;
  let bestDir = null;
  for (const dir of packFolders(plugins)) {
    const pack = packAt(dir);
    if (!pack) continue;
    const order = best === null ? 1 : compareVersions(pack.version, best.version);
    if (order > 0 || (order === 0 && dir > bestDir)) { best = pack; bestDir = dir; }
  }
  if (best) return best;
  throw new KitNotFound(`no ${PACK} with ${INSTALLER} was found (tried ${sibling} and ${plugins}); install or update ${PACK}, then run the setup again`);
}

function main(argv) {
  try {
    if (argv[0] === '--where') {
      if (argv.length > 1) throw new KitUsageError(USAGE);
      process.stdout.write(`${JSON.stringify(findInstaller())}\n`);
      return 0;
    }
    if (!argv[0] || argv[0].startsWith('-')) throw new KitUsageError(USAGE);
    const { installer } = findInstaller();
    const r = spawnSync(process.execPath, [installer, ...argv], { stdio: 'inherit' });
    if (r.error) throw r.error;
    return r.status ?? 1;
  } catch (e) {
    if (e instanceof KitUsageError) { process.stderr.write(`kit-installer: ${e.message}\n`); return 2; }
    if (e instanceof KitNotFound) { process.stderr.write(`kit-installer: ${e.message}\n`); return 3; }
    throw e;
  }
}

const invoked = () => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } };
if (invoked()) process.exitCode = main(process.argv.slice(2));
