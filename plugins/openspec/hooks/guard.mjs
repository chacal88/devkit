#!/usr/bin/env node
// devkit guard for OpenSpec projects. Claude Code hook, no dependencies.
//
//   node guard.mjs edit     PreToolUse on Edit|Write|MultiEdit|NotebookEdit
//   node guard.mjs bash     PreToolUse on Bash
//   node guard.mjs session  SessionStart: prints where the active change stands,
//                           and the current round of openspec/roadmap.md if any
//   node guard.mjs ci       CI: the devkit-reviews check, run by deliver-check.mjs --ci (exit 1)
//
// It only vetoes (exit 2 + reason on stderr). The flow lives in the OpenSpec
// schema; this file enforces what the CLI can't see:
//
// 1. Roles. Claude Code tells a hook which subagent is acting (agent_type), so
//    each gate file has exactly one writer and the author of a plan can't
//    approve it:
//      readiness.md              plan-readiness-reviewer
//      reviews/<reviewer>.md     that reviewer
//      evidence.md               pr-verifier
//      product code              tdd-implementer (devkit schema, once approved)
// 2. Gates. Product code stays closed until readiness.md says
//    "- Status: APPROVED"; `gh pr create` needs every review in reviews/ to be
//    approved (code-quality-reviewer and test-coverage-reviewer at least) and an
//    evidence.md.
// 3. Destructive git is refused.
//
// Only in projects whose openspec/config.yaml selects the devkit or devkit-lite
// schema (ADR 0004). Anywhere else session, edit and bash print nothing and
// block nothing, destructive git included, even when the plugin is loaded at
// user scope. `ci` does not depend on it.
//
// Active change: $DEVKIT_CHANGE, else the change whose name the git branch
// ends with (or contains), else the only open change. No open change means
// the work is outside the flow and nothing is gated.
//
// Bypass: start Claude Code with DEVKIT_BYPASS=1 (a prefix inside the command
// string does not reach this process). CI ignores it.

import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, resolve, relative, dirname, isAbsolute, sep, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];

export const REQUIRED_REVIEWERS = ['code-quality-reviewer', 'test-coverage-reviewer'];
export const REVIEWERS = ['code-quality-reviewer', 'test-coverage-reviewer', 'architecture-reviewer',
  'security-reviewer', 'adr-reviewer', 'spec-reviewer'];

function readStdin() {
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

function block(reason) {
  process.stderr.write(`devkit guard: ${reason}\n`);
  process.exit(2);
}

// "devkit-core:tdd-implementer" -> "tdd-implementer"; main session -> "".
export function role(input) {
  return String(input.agent_type || '').split(':').pop();
}

export function findRoot(start) {
  let dir = resolve(start || process.cwd());
  for (;;) {
    if (existsSync(join(dir, 'openspec', 'changes'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function activeChanges(root) {
  const dir = join(root, 'openspec', 'changes');
  return readdirSync(dir).filter((n) => n !== 'archive' && !n.startsWith('.')
    && statSync(join(dir, n)).isDirectory());
}

function gitBranch(root) {
  try {
    // symbolic-ref also works before the first commit; detached HEAD gives ''.
    return execFileSync('git', ['-C', root, 'symbolic-ref', '--short', '-q', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

function archivedIds(root) {
  const dir = join(root, 'openspec', 'changes', 'archive');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((a) => a.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)?.[1]).filter(Boolean);
}

// The change a `chore/archive-<id>` branch is for: <id> when it is a known
// change, active or archived (exact id after the date prefix), else null.
export function archiveBranchChange(root, branch) {
  const id = /^chore\/archive-(.+)$/.exec(branch || '')?.[1];
  if (!id) return null;
  return activeChanges(root).includes(id) || archivedIds(root).includes(id) ? id : null;
}

// Returns { name } | { ambiguous: [...] } | null
export function resolveChange(root, env = process.env,
  branch = env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF || gitBranch(root)) {
  const changes = activeChanges(root);
  if (changes.length === 0) return null;
  if (env.DEVKIT_CHANGE) {
    return changes.includes(env.DEVKIT_CHANGE) ? { name: env.DEVKIT_CHANGE } : null;
  }
  const archiving = archiveBranchChange(root, branch);
  if (archiving) return changes.includes(archiving) ? { name: archiving } : null;
  const tail = branch.split('/').pop();
  const exact = changes.filter((c) => c === tail);
  if (exact.length === 1) return { name: exact[0] };
  const contained = changes.filter((c) => branch.includes(c));
  if (contained.length === 1) return { name: contained[0] };
  if (changes.length === 1) return { name: changes[0] };
  return { ambiguous: changes };
}

export function changeSchema(root, name) {
  return changeSchemaAt(root, join(root, 'openspec', 'changes', name));
}

// The schema of the change whose folder is `dir` (active or archived): its
// own .openspec.yaml, else the project's default.
export function changeSchemaAt(root, dir) {
  for (const f of [join(dir, '.openspec.yaml'), join(root, 'openspec', 'config.yaml')]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^schema:\s*["']?([\w.-]+)/m);
    if (m) return m[1];
  }
  return 'spec-driven';
}

export const DEVKIT_SCHEMAS = ['devkit', 'devkit-lite'];

// The project's default schema: openspec/config.yaml `schema:`, else null.
export function projectSchema(root) {
  const f = join(root, 'openspec', 'config.yaml');
  if (!existsSync(f)) return null;
  return readFileSync(f, 'utf8').match(/^schema:\s*["']?([\w.-]+)/m)?.[1] ?? null;
}

// Has this project chosen devkit? Its openspec/config.yaml selects a devkit schema.
export function optedIn(root) { return DEVKIT_SCHEMAS.includes(projectSchema(root)); }

export function schemaFile(root, schema) {
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  for (const p of [
    join(root, 'openspec', 'schemas', schema, 'schema.yaml'),
    join(dataHome, 'openspec', 'schemas', schema, 'schema.yaml'),
  ]) if (existsSync(p)) return p;
  return null;
}

export function schemaHasArtifact(root, schema, id) {
  const f = schemaFile(root, schema);
  if (!f) return false;
  return new RegExp(`^\\s*-\\s*id:\\s*${id}\\s*$`, 'm').test(readFileSync(f, 'utf8'));
}

// The single value of a "Status:" / "Verdict:" line, upper-cased. A template
// line with the alternatives still in it ("APPROVED | BLOCKED") is not a value.
export function readValue(file, key) {
  if (!existsSync(file)) return null;
  const re = new RegExp(`^\\s*[-*]?\\s*\\**${key}\\**\\s*:\\s*\\**\\s*(.+?)\\s*\\**\\s*$`, 'im');
  const m = readFileSync(file, 'utf8').match(re);
  if (!m) return null;
  const v = m[1].replace(/[`*]/g, '').trim();
  if (v.includes('|')) return null;
  return v.split(/\s+/)[0].replace(/[.,;:]$/, '').toUpperCase();
}

export function changeDir(root, name) { return join(root, 'openspec', 'changes', name); }

// Consensus from reviews/<reviewer>.md, each written by that reviewer.
export function reviewConsensus(dir) {
  const rdir = join(dir, 'reviews');
  const found = existsSync(rdir) ? readdirSync(rdir).filter((f) => f.endsWith('.md')) : [];
  const verdicts = Object.fromEntries(found.map((f) => [basename(f, '.md'), readValue(join(rdir, f), 'Verdict')]));
  const missing = REQUIRED_REVIEWERS.filter((r) => !(r in verdicts));
  // "declined" = no surface for that reviewer (e.g. security on a docs diff): non-blocking.
  const notApproved = Object.entries(verdicts).filter(([, v]) => v !== 'APPROVED' && v !== 'DECLINED')
    .map(([r, v]) => `${r}: ${v ? v.toLowerCase() : 'no verdict line'}`);
  return { ok: missing.length === 0 && notApproved.length === 0, missing, notApproved, verdicts };
}

function evidenceOk(dir) {
  const ev = join(dir, 'evidence.md');
  return existsSync(ev) && readFileSync(ev, 'utf8').trim().length >= 20;
}

// ---------------------------------------------------------------- paths

// What a path is, relative to the active change.
export function classify(root, change, file) {
  const abs = isAbsolute(file) ? file : resolve(root, file);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) return { kind: 'outside' };
  const parts = rel.split(sep);
  if (parts[0] === '.claude') return { kind: 'exempt' };
  if (parts[0] !== 'openspec') return { kind: 'code' };
  if (!change || parts[1] !== 'changes' || parts[2] !== change) return { kind: 'planning' };
  const inner = parts.slice(3).join('/');
  if (inner === 'readiness.md') return { kind: 'gate', owner: 'plan-readiness-reviewer' };
  if (inner === 'evidence.md') return { kind: 'gate', owner: 'pr-verifier' };
  if (inner === 'approval.md') return { kind: 'gate', owner: '' }; // the main session only
  const rv = inner.match(/^reviews\/([\w-]+)\.md$/);
  if (rv) return { kind: 'gate', owner: rv[1] };
  if (inner.startsWith('reviews/')) return { kind: 'gate', owner: '(a reviewer, as reviews/<its-name>.md)' };
  return { kind: 'planning' };
}

// Why `actor` may not write `file` now, or null.
function writeViolation(root, ch, actor, file) {
  const c = classify(root, ch.name, file);
  if (c.kind === 'outside' || c.kind === 'exempt') return null;
  const who = actor || 'the main session';
  if (c.kind === 'gate' && c.owner === '') {
    return actor === '' ? null
      : `approval.md is written only by the main session, from the owner's own message; not by ${who}`;
  }
  if (c.kind === 'gate') {
    return actor === c.owner ? null
      : `${relative(root, resolve(root, file))} is written only by the ${c.owner} agent, not by ${who}. Dispatch it with the Agent tool (subagent_type devkit-core:${c.owner}).`;
  }
  if (REVIEWERS.includes(actor) || actor === 'plan-readiness-reviewer' || actor === 'pr-verifier') {
    return `${who} only writes its own verdict file, not ${relative(root, resolve(root, file))}.`;
  }
  if (c.kind !== 'code') return null;
  const schema = changeSchema(root, ch.name);
  if (!schemaHasArtifact(root, schema, 'readiness')) return null; // devkit-lite and friends
  const status = readValue(join(changeDir(root, ch.name), 'readiness.md'), 'Status');
  if (status !== 'APPROVED') {
    return `change "${ch.name}" has no approved readiness (Status: ${status || 'missing'}). Product code stays closed until the plan-readiness-reviewer agent writes "- Status: APPROVED" in openspec/changes/${ch.name}/readiness.md. Run: openspec status --change ${ch.name}`;
  }
  if (actor !== 'tdd-implementer') {
    return `in schema ${schema}, product code is written by the tdd-implementer agent, one phase at a time. Dispatch it with the Agent tool (subagent_type devkit-core:tdd-implementer).`;
  }
  return null;
}

// ---------------------------------------------------------------- bash

// The command with heredoc bodies and quoted strings removed, so text being
// written to a file is not mistaken for a command.
export function sanitize(cmd) {
  let out = '';
  const lines = cmd.split('\n');
  for (let i = 0; i < lines.length; i++) {
    out += lines[i] + '\n';
    const hd = [...lines[i].matchAll(/<<-?\s*(['"]?)([\w.-]+)\1/g)].map((m) => m[2]);
    for (const tag of hd) {
      while (i + 1 < lines.length && lines[i + 1].trim() !== tag) i++;
      i++; // the terminator line
    }
  }
  return out.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

// The command's segments (split on `&&`, `||`, `;` and newlines, quoted text
// and heredoc bodies removed) as { text, dir }, where `dir` is the directory the
// segment runs in: `cwd`, moved by any `cd <dir>` before it. `cd` segments
// themselves are not yielded. Without `cwd`, `dir` is undefined.
export function commandSegments(cmd, cwd) {
  const out = [];
  let dir = cwd;
  for (const seg of sanitize(cmd).split(/&&|\|\||[;\n]/)) {
    const text = seg.trim();
    const cdm = text.match(/^cd\s+([^\s|<>()]+)\s*$/);
    if (cdm) { if (dir) dir = resolve(dir, cdm[1].replace(/^~(?=\/|$)/, homedir())); continue; }
    if (text) out.push({ text, dir });
  }
  return out;
}

// Paths a command writes to (redirections, tee, sed -i, cp/mv/install/touch/
// truncate destinations), resolved against `cwd` and any `cd <dir>` earlier in
// the command. Returns absolute paths when `cwd` is given.
export function bashWrites(cmd, cwd) {
  const targets = [];
  for (const { text, dir } of commandSegments(cmd, cwd)) {
    const at = (t) => (dir ? resolve(dir, t) : t);
    for (const m of text.matchAll(/(?:^|[^<>&\d])\d?>>?\s*([^\s;&|<>()]+)/g)) targets.push(at(m[1]));
    for (const m of text.matchAll(/\btee\s+(?:-a\s+)?([^\s;&|<>()]+)/g)) targets.push(at(m[1]));
    const words = text.split(/\s+/).filter(Boolean);
    const c = words[0];
    const inPlace = (c === 'sed' || c === 'perl') && words.some((w) => /^-[a-zA-Z]*i/.test(w));
    if ((inPlace || ['cp', 'mv', 'install', 'touch', 'truncate'].includes(c)) && words.length > 1) {
      targets.push(at(words[words.length - 1]));
    }
  }
  // A target built from a variable or a quoted string can't be resolved from
  // the command text: skip it (CI is the backstop) rather than guess.
  return targets.filter((t) => {
    if (/[$`]|''|""/.test(t)) return false;
    const base = t.split('/').pop();
    return t && !t.startsWith('/dev/') && !/^['"]{2}$/.test(base) && !/^&\d$/.test(base) && !base.startsWith('-');
  });
}

const GIT_RULES = [
  [/\bgit\s+push\b[^\n;&|]*\s(--force(?!-with-lease)\b|-f\b)/, 'force push (use --force-with-lease on your own branch)'],
  [/\s--no-verify\b/, '--no-verify skips the project hooks'],
  [/\bgit\s+reset\s+[^\n;&|]*--hard\b/, 'git reset --hard discards work'],
  [/\bgit\s+clean\s+[^\n;&|]*-[a-z]*f/, 'git clean -f deletes untracked files'],
  [/\bgit\s+branch\s+[^\n;&|]*-D\b/, 'git branch -D deletes an unmerged branch'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'discarding every change in the tree'],
  [/\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))/, 'stage files by name, not all at once'],
  [/\bgh\s+pr\s+merge\b[^\n;&|]*--admin\b/, 'gh pr merge --admin bypasses branch protection'],
];

export function gitViolation(cmd) {
  const s = sanitize(cmd);
  for (const [re, why] of GIT_RULES) if (re.test(s)) return why;
  return null;
}

function prViolation(root, ch) {
  if (ch.ambiguous) return `several active OpenSpec changes (${ch.ambiguous.join(', ')}); name the branch after the change before opening the PR.`;
  const dir = changeDir(root, ch.name);
  const rc = reviewConsensus(dir);
  if (!rc.ok) {
    const why = [rc.missing.length ? `missing ${rc.missing.join(', ')}` : '', ...rc.notApproved].filter(Boolean).join('; ');
    return `change "${ch.name}": review not approved (${why}). Run the review-change skill: each reviewer agent writes openspec/changes/${ch.name}/reviews/<reviewer>.md.`;
  }
  if (!evidenceOk(dir)) return `change "${ch.name}": evidence.md is missing or empty. Run the pr-verifier agent first.`;
  return null;
}

// ---------------------------------------------------------------- modes

function guardEdit(input) {
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path || ti.path;
  if (!file) return;
  // The root comes from the file, not the session: a file in a linked worktree
  // is gated by that worktree's change, and by that root's own opt-in.
  const root = findRoot(dirname(resolve(input.cwd || process.cwd(), file)));
  if (!root || !optedIn(root)) return;
  const ch = resolveChange(root);
  if (!ch) return;
  if (ch.ambiguous) {
    const c = classify(root, null, file);
    if (c.kind === 'code') block(`several active OpenSpec changes (${ch.ambiguous.join(', ')}). Name the branch after the change you are implementing, or start Claude Code with DEVKIT_CHANGE=<name>.`);
    return;
  }
  const why = writeViolation(root, ch, role(input), file);
  if (why) block(why);
}

function guardBash(input) {
  const cmd = (input.tool_input || {}).command || '';
  // The git rules follow the session's project; writes and PRs follow their own target root.
  const sessionRoot = findRoot(input.cwd);
  const why = sessionRoot && optedIn(sessionRoot) ? gitViolation(cmd) : null;
  if (why) block(`blocked: ${why}. If you really need it, ask the user to run it.`);
  const cwd = input.cwd || process.cwd();
  // Each root's change is resolved once; a target or a segment is judged by its own root.
  const changes = new Map();
  const changeAt = (root) => {
    if (!changes.has(root)) changes.set(root, resolveChange(root));
    return changes.get(root);
  };
  for (const t of bashWrites(cmd, cwd)) {
    const root = findRoot(dirname(t));
    const ch = root && optedIn(root) && changeAt(root);
    if (!ch || ch.ambiguous) continue;
    const v = writeViolation(root, ch, role(input), t);
    if (v) block(`${v} (Writing it through the shell is gated the same way.)`);
  }
  for (const { text, dir } of commandSegments(cmd, cwd)) {
    if (!/\bgh\s+pr\s+create\b/.test(text)) continue;
    const root = findRoot(dir);
    const ch = root && optedIn(root) && changeAt(root);
    if (!ch) continue;
    const v = prViolation(root, ch);
    if (v) block(v);
  }
}

// ---------------------------------------------------------------- roadmap

// openspec/roadmap.md groups changes into rounds ("## " headings) of checklist
// lines ("- [ ] <change-id> (after: a, b)"). It is read for the session report
// only: it never gates anything and this file never writes it. Lines it does
// not recognise are skipped. Returns [{ title, items: [{ id, done, after }] }]
// or null when there is no roadmap.
export function readRoadmap(root) {
  const file = join(root, 'openspec', 'roadmap.md');
  if (!existsSync(file)) return null;
  return parseRoadmap(readFileSync(file, 'utf8'));
}

// The same parse over roadmap text (conduct-check reads origin/<base>:openspec/roadmap.md).
export function parseRoadmap(text) {
  const rounds = [];
  let item = null;
  const notes = [];
  const close = () => { if (item) item.notes = notes.join('\n').trim(); item = null; notes.length = 0; };
  for (const line of String(text).split(/\r?\n/)) {
    const h = line.match(/^##\s+(\S.*?)\s*$/);
    if (h) { close(); rounds.push({ title: h[1], items: [] }); continue; }
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+([A-Za-z0-9][\w.-]*)(?:\s+\(after:\s*([^)]*)\))?(.*)$/);
    if (m && rounds.length > 0) {
      close();
      const after = (m[3] || '').split(',').map((d) => d.trim()).filter((d) => /^[A-Za-z0-9][\w.-]*$/.test(d));
      item = { id: m[2], done: m[1] !== ' ', after, text: m[4].replace(/^\s*[—:-]?\s*/, '').trim(), notes: '' };
      rounds[rounds.length - 1].items.push(item);
      continue;
    }
    if (item && /^( {2,}|\t)\S/.test(line)) notes.push(line.replace(/^ {2}/, '').replace(/\s+$/, ''));
    else if (item && line.trim() !== '') close();
  }
  close();
  return rounds;
}

function roadmapReport(root) {
  const rounds = readRoadmap(root);
  if (!rounds) return '';
  const all = rounds.flatMap((r) => r.items);
  if (all.length === 0) return '';
  const done = new Set(all.filter((i) => i.done).map((i) => i.id));
  const current = rounds.find((r) => r.items.some((i) => !i.done));
  if (!current) return '[devkit] Roadmap: all rounds done.\n';
  const open = new Set(activeChanges(root));
  const archiveDir = join(root, 'openspec', 'changes', 'archive');
  // `openspec archive` moves a change to archive/YYYY-MM-DD-<id>.
  const archived = new Set((existsSync(archiveDir) ? readdirSync(archiveDir) : [])
    .map((a) => a.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)?.[1]).filter(Boolean));
  const state = (i) => {
    if (!open.has(i.id) && archived.has(i.id)) return 'archived, tick it';
    const waiting = i.after.filter((d) => !done.has(d));
    if (waiting.length) return `waiting on ${waiting.join(', ')}`;
    return open.has(i.id) ? 'open' : 'not started';
  };
  const n = current.items.filter((i) => i.done).length;
  return `[devkit] Roadmap: ${current.title} (${n}/${current.items.length} done). Pending:\n`
    + current.items.filter((i) => !i.done).map((i) => `  - ${i.id}: ${state(i)}\n`).join('')
    + 'openspec/roadmap.md only reports; it gates nothing. Tick a change there once it is archived.\n';
}

function session(input) {
  const root = findRoot(input.cwd);
  if (!root || !optedIn(root)) return;
  sessionChange(root);
  let report = '';
  try { report = roadmapReport(root); } catch { /* a broken roadmap never breaks the hook */ }
  process.stdout.write(report);
}

function sessionChange(root) {
  const ch = resolveChange(root);
  if (!ch) return;
  if (ch.ambiguous) {
    process.stdout.write(`[devkit] Open OpenSpec changes: ${ch.ambiguous.join(', ')}. Ask which one to work on; the branch name (or DEVKIT_CHANGE) selects it for the guards.\n`);
    return;
  }
  let status = '';
  try {
    status = execFileSync('openspec', ['status', '--change', ch.name],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
  } catch { /* openspec not installed: still point at the change */ }
  process.stdout.write(`[devkit] Active OpenSpec change: ${ch.name} (schema ${changeSchema(root, ch.name)}).\n${status}`
    + 'Follow the schema: the next step is what `openspec status` says, and `openspec instructions <artifact> --change <name>` says how. '
    + 'Gate files have one writer each (readiness.md: plan-readiness-reviewer; reviews/<reviewer>.md: that reviewer; evidence.md: pr-verifier); '
    + 'in the devkit schema, product code is written by tdd-implementer after readiness is APPROVED. Dispatch those agents with the Agent tool.\n');
}

// The devkit-reviews check (deliver-check --ci): readiness, then contract items
// 1-4 with the staleness rule. Imported dynamically so this file keeps no static
// import of deliver-check.mjs, which imports it. Without deliver-check.mjs and
// merge-setup.mjs (which deliver-check.mjs imports) in the same folder it fails closed.
async function ci() {
  let ciMain;
  try {
    ({ ciMain } = await import('./deliver-check.mjs'));
  } catch (e) {
    if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    console.error('devkit ci: guard.mjs ci needs deliver-check.mjs and merge-setup.mjs in the same folder (download all three; see docs/openspec-flow.md#ci)');
    process.exitCode = 1;
    return;
  }
  const r = ciMain(process.argv.slice(3));
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exitCode = r.code;
}

// Run a mode only when executed directly, so other scripts can import the
// helpers above without inheriting the dispatch (or DEVKIT_BYPASS's exit 0).
// Symlinked paths (plugin caches) are resolved before comparing.
function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  // Not awaited at the top level: deliver-check.mjs imports this file, and a
  // top-level await here would wait on an import that waits on this module.
  if (mode === 'ci') ci().then(() => process.exit(process.exitCode || 0));
  else if (process.env.DEVKIT_BYPASS === '1') process.exit(0);
  else if (mode === 'edit') guardEdit(readStdin());
  else if (mode === 'bash') guardBash(readStdin());
  else if (mode === 'session') session(readStdin());
}
