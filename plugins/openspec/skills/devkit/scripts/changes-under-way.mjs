#!/usr/bin/env node
// Lists the changes under way before /devkit setup replaces a project's devkit schemas, and says what the upgrade
// changes for each (design D-7). Read-only without --apply.
//   node changes-under-way.mjs <project-root> [--json] [--apply --owner-answer "<text>"]
// --apply writes approval.md, as not applying, for every full-script change whose implementation started before the
// script asked for the owner's approval; it needs the owner's answer to the listing, and never overwrites a file.
// Exit: 0 done, 2 usage.

import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { changeSchemaAt, readValue, DEVKIT_SCHEMAS } from '../../../hooks/guard.mjs';
import { unfinished } from '../../../hooks/change-loop.mjs';
import { parseTasks } from '../../../hooks/deliver-check.mjs';
import { isPreviousScript, readFlowFile, stageFiles } from '../../../hooks/flow-check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packSchemas = join(here, '..', '..', '..', 'schemas');
const USAGE = 'usage: changes-under-way.mjs <project-root> [--json] [--apply --owner-answer "<text>"]';
const ANSWER_MAX = 200;

class UsageError extends Error {}

function parseArgs(argv) {
  const o = { root: null, json: false, apply: false, answer: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--apply') o.apply = true;
    else if (a === '--owner-answer') {
      if (i + 1 >= argv.length) throw new UsageError('--owner-answer needs the owner\'s words');
      o.answer = argv[++i];
    } else if (a.startsWith('-')) throw new UsageError(`unknown argument ${a}`);
    else if (o.root === null) o.root = a;
    else throw new UsageError(`unexpected argument ${a}`);
  }
  if (o.root === null) throw new UsageError('the project root is missing');
  if (o.apply && !String(o.answer ?? '').trim()) throw new UsageError('--apply needs --owner-answer with the owner\'s answer to the listing');
  return o;
}

// The effect of the upgrade on one change, first match wins: { effect, write }.
function effectOf(c) {
  if (c.script === 'devkit-project') return { effect: 'continues on the new project script; its stage records and documents stay', write: 'none' };
  if (!DEVKIT_SCHEMAS.includes(c.script)) return { effect: `untouched by the upgrade: it is on the schema ${c.script}, which the upgrade does not replace`, write: 'none' };
  if (c.script === 'devkit' && c.started && !c.approval) {
    return { effect: 'continues where it was; the owner\'s approval stage did not exist when its implementation began, so approval.md is written as not applying', write: 'approval-not-applicable' };
  }
  if (c.script === 'devkit' && c.readiness === 'APPROVED' && !c.started && !c.approval) {
    return { effect: 'asks the owner\'s approval once, before its implementation', write: 'none' };
  }
  if (c.script === 'devkit-lite' && c.previous) return { effect: 'continues where it was; it is not sent back to the grill', write: 'none' };
  return { effect: 'nothing changes for it', write: 'none' };
}

// Is the change begun on the previous script? Judged over the pack's own declaration of its script (D-2).
function previousScript(dir, script) {
  const file = join(packSchemas, script, 'flow.json');
  if (!DEVKIT_SCHEMAS.includes(script) || !existsSync(file) || !existsSync(dir)) return false;
  const flow = readFlowFile(file, script);
  const files = {};
  for (const s of flow.stages) if (s.source === 'artifact') files[s.id] = stageFiles(dir, s.file);
  return isPreviousScript(files, flow);
}

function listChanges(root) {
  return unfinished(root, { slices: true }).map(({ id, root: checkout, branch }) => {
    const dir = join(checkout, 'openspec', 'changes', id);
    const tasks = join(dir, 'tasks.md');
    const row = {
      id,
      script: changeSchemaAt(checkout, dir),
      checkout: { root: checkout, branch: branch || null },
      started: existsSync(tasks) && parseTasks(readFileSync(tasks, 'utf8')).some((t) => t.done),
      readiness: readValue(join(dir, 'readiness.md'), 'Status'),
      approval: existsSync(join(dir, 'approval.md')),
    };
    row.previous = previousScript(dir, row.script);
    return { ...row, ...effectOf(row) };
  });
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function approvalNotApplicable(row, answer) {
  const sha = spawnSync('git', ['-C', row.checkout.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const commit = sha.status === 0 && /^[0-9a-f]{7,40}$/.test(sha.stdout.trim()) ? sha.stdout.trim() : 'none';
  const words = answer.replace(/\s+/g, ' ').trim().slice(0, ANSWER_MAX);
  return [
    `<!-- devkit-stage approval result=not-applicable attempt=1 commit=${commit} -->`,
    `# Plan approval: ${row.id}`,
    '',
    '- Status: not applicable',
    `- Date: ${today()}`,
    '- Why: the implementation of this change had started (tasks ticked in tasks.md) when /devkit setup replaced the devkit schemas, before the script asked for this approval. No approval is recorded here.',
    `- Owner's words: "${words}"`,
    '',
  ].join('\n');
}

// Writes the approval-not-applicable rows; never overwrites a file. Returns the paths written.
function applyRows(rows, answer) {
  const written = [];
  for (const row of rows.filter((r) => r.write === 'approval-not-applicable')) {
    const file = join(row.checkout.root, 'openspec', 'changes', row.id, 'approval.md');
    if (existsSync(file)) continue;
    writeFileSync(file, approvalNotApplicable(row, answer), { flag: 'wx' });
    written.push(file);
  }
  return written;
}

function render(rows) {
  if (!rows.length) return 'no change under way';
  return [`${rows.length} changes under way:`, ...rows.map((r) => `- ${r.id} (${r.script}, ${r.checkout.root}, branch ${r.checkout.branch ?? 'none'}): ${r.effect}`)].join('\n');
}

function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`changes-under-way: ${e.message}\n${USAGE}\n`);
    return 2;
  }
  const root = resolve(o.root);
  if (!existsSync(root)) { process.stderr.write(`changes-under-way: ${root} does not exist\n${USAGE}\n`); return 2; }
  const rows = listChanges(realpathSync(root));
  const written = o.apply ? applyRows(rows, o.answer) : [];
  if (o.json) process.stdout.write(`${JSON.stringify({ version: 1, changes: rows, written }, null, 2)}\n`);
  else process.stdout.write(`${[render(rows), ...written.map((f) => `wrote ${f}`)].join('\n')}\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
