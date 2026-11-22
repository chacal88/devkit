#!/usr/bin/env node
// Adds the `devkit-project` entry to the `ship:` block of a project's openspec/config.yaml (project-phases, D-15).
//   node ship-entry.mjs <project-root> [--apply]
// A project that has a `ship:` entry and no `devkit-project` key gets `devkit-project: <mode of devkit, else plan>`;
// every other byte of the file is unchanged. Without --apply the file it would write is printed and nothing is
// written; with --apply it is written. No `ship:` entry, or the key already there: nothing to do.
// When the mode added is `merge`, one line on standard error says the CI pin must name the new release first.
// Exit: 0 done (or nothing to do), 2 usage, 3 an entry parseShip refuses (nothing written).

import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShip, ShipConfigError } from '../../../hooks/deliver-check.mjs';

const USAGE = 'usage: ship-entry.mjs <project-root> [--apply]';
const KEY = 'devkit-project';
const PIN_LINE = 'ship-entry: the CI pin must name the new release (v0.19.0) before a slice can merge by itself: move the sha of .github/workflows/devkit-reviews.yml first (docs/openspec-flow.md, CI section).';

export class ShipEntryUsageError extends Error {
  constructor(message) { super(message); this.name = 'ShipEntryUsageError'; }
}

// { text, mode } with the entry added, or null when there is nothing to add. Throws ShipConfigError for an entry
// parseShip refuses.
export function addShipEntry(text) {
  const map = parseShip(text); // refuses a ship entry it cannot read, before anything is edited
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^ship\s*:/.test(l));
  if (at < 0 || Object.hasOwn(map, KEY)) return null;
  const mode = map.devkit ?? 'plan';

  const flow = /^(ship\s*:\s*)\{([^}]*)\}(.*)$/.exec(lines[at]);
  if (flow) {
    const inner = flow[2];
    const trailing = inner.match(/\s*$/)[0];
    const body = inner.trimEnd();
    lines[at] = body.trim() === ''
      ? `${flow[1]}{ ${KEY}: ${mode} }${flow[3]}`
      : `${flow[1]}{${body}, ${KEY}: ${mode}${trailing}}${flow[3]}`;
    return { text: lines.join('\n'), mode };
  }

  // The block form: after the block's last entry, with the block's own indent (two spaces for an empty block).
  let last = at;
  let indent = null;
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) break;
    indent ??= line.match(/^\s*/)[0];
    last = i;
  }
  const eol = lines[last].endsWith('\r') ? '\r' : '';
  lines.splice(last + 1, 0, `${indent ?? '  '}${KEY}: ${mode}${eol}`);
  return { text: lines.join('\n'), mode };
}

function parseArgs(argv) {
  const o = { root: null, apply: false };
  for (const a of argv) {
    if (a === '--apply') o.apply = true;
    else if (a.startsWith('-')) throw new ShipEntryUsageError(`unknown argument ${a}`);
    else if (o.root === null) o.root = a;
    else throw new ShipEntryUsageError(`unexpected argument ${a}`);
  }
  if (o.root === null) throw new ShipEntryUsageError('the project root is missing');
  return o;
}

export function main(argv, { out = process.stdout, err = process.stderr } = {}) {
  let o;
  try { o = parseArgs(argv); } catch (e) {
    if (!(e instanceof ShipEntryUsageError)) throw e;
    err.write(`ship-entry: ${e.message}\n${USAGE}\n`);
    return 2;
  }
  const root = resolve(o.root);
  if (!existsSync(root)) { err.write(`ship-entry: ${root} does not exist\n${USAGE}\n`); return 2; }
  const file = join(realpathSync(root), 'openspec', 'config.yaml');
  if (!existsSync(file)) return 0;
  let result;
  try { result = addShipEntry(readFileSync(file, 'utf8')); } catch (e) {
    if (!(e instanceof ShipConfigError)) throw e;
    err.write(`ship-entry: ${e.message}\n`);
    return 3;
  }
  if (result === null) return 0;
  if (o.apply) {
    writeFileSync(file, result.text);
    out.write(`wrote ${file}: added ${KEY}: ${result.mode}\n`);
  } else {
    out.write(result.text);
  }
  if (result.mode === 'merge') err.write(`${PIN_LINE}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
