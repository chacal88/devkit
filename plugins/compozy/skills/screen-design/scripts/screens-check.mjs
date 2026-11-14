#!/usr/bin/env node
// screens-check: the mechanical half of the design gate (design D5, AC-3 design-gate,
// AC-4 screens-check).
//
// Reads the project's openspec/config.yaml `design:` block (`screen_map:`, optional `mockup:`),
// the change's proposal.md `## Screens` list, and the screen map. Exits 0 when every declared id
// is the first cell of a row of the map and the map holds a line starting with `Mockup:` carrying
// a version or an ISO date; exits 1 naming what is missing; exits 3 on a setup error (unknown
// change, unreadable map, a `design:` block pointing nowhere). No `## Screens` section, or no
// `design:` block, is exit 0: a project without a UI pays nothing for this gate.
//
//   node screens-check.mjs --change <id> [--json]
//
// The change is resolved as openspec/changes/<id>/proposal.md relative to the project root,
// which is the current working directory: the loop that calls this script `cd`s there first.
// No dependencies.

import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = 'openspec/config.yaml';

export class UsageError extends Error {
  constructor(message) { super(message); this.name = 'UsageError'; }
}

// Strip a `#` comment that starts at the beginning of a token, outside quotes (same reader guard.mjs
// and deliver-check.mjs use for their own single-line and small nested-map YAML reads).
function stripComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function unquote(text) {
  const t = text.trim();
  const m = t.match(/^(["'])(.*)\1$/);
  return m ? m[2] : t;
}

// The project's `design:` block: { screen_map: <path> | null, mockup: <string> | null }, or null
// when the file has no top-level `design:` key. Accepts only the flat shape this block ever
// carries:
//
//   design:
//     screen_map: docs/design/screen-map.md
//     mockup: Figma
//
// A key this block does not define is ignored, not an error: the two keys named above are the
// only ones screens-check reads.
export function parseDesign(text) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => /^design\s*:\s*$/.test(stripComment(l)));
  if (at < 0) return null;
  const design = { screen_map: null, mockup: null };
  let indent = null;
  for (const raw of lines.slice(at + 1)) {
    const line = stripComment(raw);
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) break; // next top-level key
    const lead = line.match(/^\s*/)[0].length;
    if (indent === null) indent = lead;
    if (lead < indent) break;
    const m = line.trim().match(/^(["']?)([\w.-]+)\1\s*:(.*)$/);
    if (!m) continue;
    const value = unquote(m[3]);
    if (m[2] === 'screen_map' && value) design.screen_map = value;
    else if (m[2] === 'mockup' && value) design.mockup = value;
  }
  return design;
}

// The screen ids `## Screens` lists: "- id", "- `id`" or "* id", backticks and any trailing
// " — description" stripped. A section with no list items (prose only), or no section at all,
// is no screens: [].
export function parseScreens(text) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => /^##\s+Screens\s*$/i.test(l.trim()));
  if (at < 0) return [];
  const ids = [];
  for (const raw of lines.slice(at + 1)) {
    if (/^##\s+\S/.test(raw.trim()) || /^##\s*$/.test(raw.trim())) break; // next ## section
    const m = raw.match(/^\s*[-*]\s+(.+)$/);
    if (!m) continue;
    const item = m[1].trim().replace(/\s—\s[\s\S]*$/, '').replace(/`/g, '').trim();
    if (item) ids.push(item);
  }
  return ids;
}

// The set of ids that are the first cell of a Markdown table row ("| id | ... |"), skipping the
// header-separator row ("| --- | --- |" or any cell made only of `-`/`:`).
export function mapIds(text) {
  const ids = new Set();
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    const first = line.slice(1).split('|')[0]?.trim() ?? '';
    if (!first || /^:?-+:?$/.test(first)) continue;
    ids.add(first.replace(/`/g, ''));
  }
  return ids;
}

// The value of the map's first line starting with "Mockup:", or null when there is none.
export function mockupLine(text) {
  for (const raw of String(text).split(/\r?\n/)) {
    const m = raw.trim().match(/^Mockup:\s*(.*)$/);
    if (m) return m[1].trim();
  }
  return null;
}

// A version ("v3", "1.2.0") or an ISO date ("2026-11-14").
export function isVersionOrDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^v?\d+(\.\d+)*$/i.test(value);
}

// The verdict for one change, or throws UsageError (exit 3) on a setup error.
function compute(root, change) {
  const changeDir = join(root, 'openspec', 'changes', change);
  if (!existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
    throw new UsageError(`unknown change "${change}": no openspec/changes/${change}/`);
  }
  const proposalFile = join(changeDir, 'proposal.md');
  if (!existsSync(proposalFile)) {
    throw new UsageError(`unknown change "${change}": openspec/changes/${change}/proposal.md does not exist`);
  }
  const screens = parseScreens(readFileSync(proposalFile, 'utf8'));

  const configFile = join(root, CONFIG);
  const configText = existsSync(configFile) ? readFileSync(configFile, 'utf8') : '';
  const design = parseDesign(configText);

  const base = { version: 1, change, screens, mapped: [], missing: [], mapMockup: null, mapMockupOk: false };

  if (!design) {
    return { ...base, designConfigured: false, screenMap: null, mockupTool: null, noop: true, pass: true };
  }
  if (!design.screen_map) {
    throw new UsageError(`design: block in ${CONFIG} has no screen_map`);
  }
  const mapPath = join(root, design.screen_map);
  let mapStat;
  try {
    mapStat = statSync(mapPath);
  } catch {
    throw new UsageError(`design.screen_map "${design.screen_map}" does not exist`);
  }
  if (!mapStat.isFile()) {
    throw new UsageError(`design.screen_map "${design.screen_map}" is not a readable file`);
  }
  let mapText;
  try {
    mapText = readFileSync(mapPath, 'utf8');
  } catch (e) {
    throw new UsageError(`cannot read design.screen_map "${design.screen_map}": ${e.message}`);
  }

  if (screens.length === 0) {
    return { ...base, designConfigured: true, screenMap: design.screen_map, mockupTool: design.mockup, noop: true, pass: true };
  }

  const ids = mapIds(mapText);
  const mapped = screens.filter((id) => ids.has(id));
  const missing = screens.filter((id) => !ids.has(id));
  const mapMockup = mockupLine(mapText);
  const mapMockupOk = mapMockup !== null && isVersionOrDate(mapMockup);
  const pass = missing.length === 0 && mapMockupOk;

  return {
    ...base, designConfigured: true, screenMap: design.screen_map, mockupTool: design.mockup,
    mapped, missing, mapMockup, mapMockupOk, noop: false, pass,
  };
}

function renderHuman(result) {
  if (result.noop) {
    const reason = !result.designConfigured ? 'no design: block configured' : 'no screens declared';
    return `screens-check: ${reason}; nothing to check\n`;
  }
  const problems = [];
  if (result.missing.length) problems.push(`not mapped: ${result.missing.join(', ')}`);
  if (!result.mapMockupOk) {
    problems.push(result.mapMockup === null
      ? 'the map has no Mockup: line with a version or an ISO date'
      : `the map's Mockup: line ("${result.mapMockup}") is not a version or an ISO date`);
  }
  return [
    `screens-check: ${result.change}`,
    ...problems.map((m) => `  ${m}`),
    result.pass ? 'pass' : `fail: ${problems.join('; ')}`,
  ].join('\n') + '\n';
}

function parseArgs(argv) {
  const opts = { json: false, change: null };
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    if (a === '--json') opts.json = true;
    else if (a === '--change' || a.startsWith('--change=')) {
      const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : rest.shift();
      if (!v || !/^[A-Za-z0-9][\w.-]*$/.test(v) || ['.', '..', 'archive'].includes(v)) {
        throw new UsageError(`--change expects a change id, not "${v ?? ''}"`);
      }
      opts.change = v;
    } else {
      throw new UsageError(`unknown option ${a}; usage: screens-check --change <id> [--json]`);
    }
  }
  if (!opts.change) throw new UsageError('usage: screens-check --change <id> [--json]');
  return opts;
}

// Runs the checker: { code, stdout, stderr }. 0 pass or no-op, 1 a real failure, 3 a setup error.
export function main(argv, env = process.env, cwd = process.cwd()) {
  let json = argv.includes('--json');
  try {
    const opts = parseArgs(argv);
    json = opts.json;
    const result = compute(cwd, opts.change);
    return {
      code: result.pass ? 0 : 1,
      stdout: json ? `${JSON.stringify(result, null, 2)}\n` : renderHuman(result),
      stderr: '',
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      code: 3,
      stdout: json ? `${JSON.stringify({ version: 1, error: message })}\n` : '',
      stderr: `screens-check: ${message}\n`,
    };
  }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  const r = main(process.argv.slice(2));
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exitCode = r.code;
}
