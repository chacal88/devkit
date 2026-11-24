#!/usr/bin/env node
// Installs the CompozyOS kit into a project as `.compozy/`, and installs it again later without
// losing what the project edited (design D-8 of coordinator-field-fixes, D-10 of compozy-driver).
//
//   node install-kit.mjs <project-root> [--set __NAME__=value]... [--accept <path>,...] [--json]
//
// The files are `config.toml`, `README.md`, every agent under `../templates/agents/` (one folder per
// role, listed at run time), the three loops and `bin/devkit-kit`, each rendered from `../templates/`
// with the placeholders of `templates/substitutions.json` (the agents and `bin/devkit-kit` are written
// verbatim). The manifest `.compozy/kit-manifest.json` records the inputs used and the sha256 of every
// file written (or already equal to its rendering). A file is, in order: absent (`create`), equal to its
// rendering (`same`), equal to its recorded digest (`update`), or `edited`: left in place with its
// difference printed, written only when named in `--accept` (`accepted`).
//
// The files of the old kit are retired: one that is present and equal to its recorded digest is removed
// (`remove`, with its digest and its folder when empty); one edited by the project, or with no recorded
// digest, is left (`kept`) and named, and removed only when named in `--accept` (`remove`). A recorded
// input the templates no longer have is dropped from the manifest and printed as `dropped __NAME__`.
// Exit 0; 2 on a usage error. Nothing is written outside `.compozy/`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(here, '..', 'templates');
const PACK_JSON = join(here, '..', '..', '..', '.claude-plugin', 'plugin.json');
const LOOPS = ['devkit-change', 'devkit-review', 'devkit-roadmap'];

// Path under `.compozy/` and under `templates/` are the same for every kit file. The agents are the
// folders of templates/agents, sorted.
const agentFiles = () => readdirSync(join(TEMPLATES, 'agents'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().map((role) => `agents/${role}/AGENT.md`);
const kitFiles = () => ['config.toml', 'README.md', ...agentFiles(), ...LOOPS.map((name) => `loops/${name}/loop.yaml`), 'bin/devkit-kit'];
// The files of the old kit (version 0.3): the four shells and the loop of the seventeen nodes.
const RETIRED = ['agents/tech-lead/AGENT.md', 'agents/dev/AGENT.md', 'agents/qa/AGENT.md', 'agents/design/AGENT.md', 'loops/openspec-change/loop.yaml'];
const isVerbatim = (file) => file === 'bin/devkit-kit' || file.startsWith('agents/');
const MANIFEST = 'kit-manifest.json';

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function parseArgs(argv) {
  const opts = { root: null, set: {}, accept: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--set') {
      const pair = argv[(i += 1)] ?? '';
      const eq = pair.indexOf('=');
      if (eq < 0) throw new UsageError(`--set needs __NAME__=value, got "${pair}"`);
      opts.set[pair.slice(0, eq)] = pair.slice(eq + 1);
    } else if (arg === '--accept') {
      const list = argv[(i += 1)];
      if (list === undefined) throw new UsageError('--accept needs a path');
      opts.accept.push(...list.split(',').filter(Boolean));
    } else if (arg.startsWith('--')) {
      throw new UsageError(`unknown option ${arg}`);
    } else if (opts.root === null) {
      opts.root = arg;
    } else {
      throw new UsageError(`unexpected argument ${arg}`);
    }
  }
  if (opts.root === null) throw new UsageError('the project root is required');
  if (!existsSync(opts.root) || !statSync(opts.root).isDirectory()) {
    throw new UsageError(`${opts.root} is not a directory`);
  }
  opts.accept = opts.accept.map((p) => p.replace(/^\.compozy\//, ''));
  for (const path of opts.accept) {
    if (!kitFiles().includes(path) && !RETIRED.includes(path)) throw new UsageError(`--accept: ${path} is not a kit file`);
  }
  return opts;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// The inputs: each placeholder's default, overlaid by the manifest's recorded inputs, then by --set. A recorded input with no
// placeholder is dropped (the old kit's seven), and named in `dropped`; `--set` of an unknown token is a usage error.
function resolveInputs(placeholders, recorded, set) {
  const inputs = Object.fromEntries(Object.entries(placeholders).map(([token, spec]) => [token, spec.default]));
  const dropped = Object.keys(recorded).filter((token) => !(token in placeholders));
  for (const [token, value] of Object.entries({ ...recorded, ...set })) {
    if (dropped.includes(token) && !(token in set)) continue;
    if (!(token in placeholders)) throw new UsageError(`${token} is not a placeholder of substitutions.json`);
    inputs[token] = value;
  }
  return { inputs, dropped };
}

function render(template, inputs) {
  return template.replace(/__[A-Z_]+__/g, (token) => (token in inputs ? inputs[token] : token));
}

// `git diff --no-index` from the installed file to the rendering: what the re-run would change.
function differenceFrom(installedPath, rendering) {
  const dir = mkdtempSync(join(tmpdir(), 'install-kit-'));
  try {
    const rendered = join(dir, 'rendering');
    writeFileSync(rendered, rendering);
    const r = spawnSync('git', ['diff', '--no-index', '--no-color', installedPath, rendered], { encoding: 'utf8' });
    return r.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function install(opts) {
  const root = resolve(opts.root);
  const compozy = join(root, '.compozy');
  const manifestPath = join(compozy, MANIFEST);
  const previous = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const { placeholders } = readJson(join(TEMPLATES, 'substitutions.json'));
  const { inputs, dropped } = resolveInputs(placeholders, previous?.inputs ?? {}, opts.set);
  const digests = { ...(previous?.files ?? {}) };
  const report = [];

  for (const file of kitFiles()) {
    const target = join(compozy, file);
    const template = readFileSync(join(TEMPLATES, file), 'utf8');
    const rendering = isVerbatim(file) ? template : render(template, inputs);
    const wanted = Buffer.from(rendering);
    const write = () => {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, wanted);
      if (file === 'bin/devkit-kit') chmodSync(target, 0o755);
      digests[file] = sha256(wanted);
    };
    const entry = { path: `.compozy/${file}` };
    if (!existsSync(target)) {
      write();
      entry.state = 'create';
    } else {
      const installed = readFileSync(target);
      if (installed.equals(wanted)) {
        digests[file] = sha256(wanted);
        entry.state = 'same';
      } else if (digests[file] === sha256(installed)) {
        write();
        entry.state = 'update';
      } else if (opts.accept.includes(file)) {
        entry.diff = differenceFrom(target, rendering);
        write();
        entry.state = 'accepted';
      } else {
        entry.state = 'edited';
        entry.diff = differenceFrom(target, rendering);
      }
    }
    report.push(entry);
  }

  for (const file of RETIRED) {
    const target = join(compozy, file);
    if (!existsSync(target)) continue;
    const entry = { path: `.compozy/${file}` };
    if (digests[file] === sha256(readFileSync(target)) || opts.accept.includes(file)) {
      unlinkSync(target);
      delete digests[file];
      try { rmdirSync(dirname(target)); } catch { /* the folder holds something else: it stays */ }
      entry.state = 'remove';
    } else {
      entry.state = 'kept';
    }
    report.push(entry);
  }

  let pack = 'unknown';
  if (existsSync(PACK_JSON)) pack = readJson(PACK_JSON).version;
  const files = Object.fromEntries(Object.keys(digests).sort().map((file) => [file, digests[file]]));
  mkdirSync(compozy, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify({ version: 1, pack, inputs, files }, null, 2)}\n`);
  return { pack, files: report, dropped };
}

function main() {
  let opts;
  let result;
  try {
    opts = parseArgs(process.argv.slice(2));
    result = install(opts);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    process.stderr.write(`install-kit: ${err.message}\n`);
    process.stderr.write('usage: install-kit.mjs <project-root> [--set __NAME__=value]... [--accept <path>,...] [--json]\n');
    process.exit(2);
  }
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const lines = result.files.map((f) => `${f.state.padEnd(9)} ${f.path}`);
  for (const token of result.dropped) lines.push(`${'dropped'.padEnd(9)} ${token}`);
  const kept = result.files.filter((f) => f.state === 'kept');
  if (kept.length) lines.push('');
  for (const f of kept) lines.push(`${f.path}: edited by the project, left in place: delete it or run again with --accept ${f.path}`);
  for (const f of result.files) {
    if (f.state === 'edited' && f.diff) lines.push('', `Difference of ${f.path} from the current template:`, f.diff.trimEnd());
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
