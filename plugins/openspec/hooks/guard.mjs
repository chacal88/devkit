#!/usr/bin/env node
// devkit guard for OpenSpec projects. Claude Code hook, no dependencies.
//
//   node guard.mjs edit     PreToolUse on Edit|Write|MultiEdit|NotebookEdit
//   node guard.mjs bash     PreToolUse on Bash
//   node guard.mjs session  SessionStart: prints where the active change stands
//   node guard.mjs ci       CI: the same gates for the branch's change (exit 1)
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
// Active change: $DEVKIT_CHANGE, else the change whose name the git branch
// ends with (or contains), else the only open change. No open change means
// the work is outside the flow and nothing is gated.
//
// Bypass: start Claude Code with DEVKIT_BYPASS=1 (a prefix inside the command
// string does not reach this process). CI ignores it.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname, isAbsolute, sep, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

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

function findRoot(start) {
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

// Returns { name } | { ambiguous: [...] } | null
export function resolveChange(root, env = process.env,
  branch = env.DEVKIT_BRANCH || env.GITHUB_HEAD_REF || gitBranch(root)) {
  const changes = activeChanges(root);
  if (changes.length === 0) return null;
  if (env.DEVKIT_CHANGE) {
    return changes.includes(env.DEVKIT_CHANGE) ? { name: env.DEVKIT_CHANGE } : null;
  }
  const tail = branch.split('/').pop();
  const exact = changes.filter((c) => c === tail);
  if (exact.length === 1) return { name: exact[0] };
  const contained = changes.filter((c) => branch.includes(c));
  if (contained.length === 1) return { name: contained[0] };
  if (changes.length === 1) return { name: changes[0] };
  return { ambiguous: changes };
}

function changeSchema(root, name) {
  for (const f of [join(root, 'openspec', 'changes', name, '.openspec.yaml'), join(root, 'openspec', 'config.yaml')]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^schema:\s*["']?([\w.-]+)/m);
    if (m) return m[1];
  }
  return 'spec-driven';
}

function schemaFile(root, schema) {
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

function changeDir(root, name) { return join(root, 'openspec', 'changes', name); }

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

// Paths a command writes to (redirections, tee, sed -i, cp/mv/install/touch/
// truncate destinations), resolved against `cwd` and any `cd <dir>` earlier in
// the command. Returns absolute paths when `cwd` is given.
export function bashWrites(cmd, cwd) {
  const s = sanitize(cmd);
  const targets = [];
  let dir = cwd;
  const at = (t) => (dir ? resolve(dir, t) : t);
  // Walk segments in order so a `cd` applies to what follows it.
  for (const seg of s.split(/&&|\|\||[;\n]/)) {
    const text = seg.trim();
    const cdm = text.match(/^cd\s+([^\s|<>()]+)\s*$/);
    if (cdm) { if (dir) dir = resolve(dir, cdm[1].replace(/^~(?=\/|$)/, homedir())); continue; }
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
  const root = findRoot(input.cwd || dirname(resolve(file)));
  if (!root) return;
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
  const why = gitViolation(cmd);
  if (why) block(`blocked: ${why}. If you really need it, ask the user to run it.`);
  const root = findRoot(input.cwd);
  if (!root) return;
  const ch = resolveChange(root);
  if (!ch) return;
  const cwd = input.cwd || root;
  if (!ch.ambiguous) {
    for (const t of bashWrites(cmd, cwd)) {
      const v = writeViolation(root, ch, role(input), t);
      if (v) block(`${v} (Writing it through the shell is gated the same way.)`);
    }
  }
  if (/\bgh\s+pr\s+create\b/.test(sanitize(cmd))) {
    const v = prViolation(root, ch);
    if (v) block(v);
  }
}

function session(input) {
  const root = findRoot(input.cwd);
  if (!root) return;
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

function ci() {
  const root = findRoot(process.cwd());
  if (!root) { console.log('devkit ci: no openspec/ folder, nothing to check'); return; }
  const ch = resolveChange(root);
  if (!ch) { console.log('devkit ci: no open change, nothing to check'); return; }
  const fail = (m) => { console.error(`devkit ci: ${m}`); process.exitCode = 1; };
  if (ch.ambiguous) return fail(`several open changes (${ch.ambiguous.join(', ')}); name the branch after one, or set DEVKIT_CHANGE`);
  const dir = changeDir(root, ch.name);
  if (schemaHasArtifact(root, changeSchema(root, ch.name), 'readiness')) {
    const st = readValue(join(dir, 'readiness.md'), 'Status');
    if (st !== 'APPROVED') fail(`${ch.name}: readiness.md Status is ${st || 'missing'}, expected APPROVED`);
  }
  const v = prViolation(root, ch);
  if (v) fail(v);
  if (!process.exitCode) console.log(`devkit ci: ${ch.name} passed readiness, review and evidence`);
}

if (mode === 'ci') { ci(); process.exit(process.exitCode || 0); }
if (process.env.DEVKIT_BYPASS === '1') process.exit(0);
if (mode === 'edit') guardEdit(readStdin());
else if (mode === 'bash') guardBash(readStdin());
else if (mode === 'session') session(readStdin());
