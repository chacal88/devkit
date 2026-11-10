// conduct-check: what does every change of a roadmap round do next? (conduct-rounds design D2)
//
// Reads files, git and (through gh) GitHub; never writes files, refs or GitHub objects, never fetches.
// Reuses deliver-check, in-process and per worktree, for everything from `implement` to `archived`.
// No dependencies.

import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { changeSchemaAt, findRoot, parseRoadmap, readValue, schemaFile, schemaHasArtifact } from './guard.mjs';
import { readRepoSettings } from './merge-setup.mjs';
import {
  UsageError, gitFacts, makeGh, collectState, buildReport, detectHost, locateChange, parseTasks, approvalState, RELEASE_FILE, watchMinutes,
} from './deliver-check.mjs';

export const MAX_PARALLEL = 3;
// Mtime tolerance when a file is "older than" another (design D6).
const FRESH_MS = 2000;

// ---------------------------------------------------------------- git helpers

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}
function gitOk(root, args) {
  try { git(root, args); return true; } catch { return false; }
}
const resolves = (root, ref) => gitOk(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);

// The ids ticked in the roadmap of `rev` (a commit or ref), or null when it has none.
function tickedAt(root, rev) {
  let text;
  try { text = git(root, ['show', `${rev}:openspec/roadmap.md`]); } catch { return null; }
  return new Set((parseRoadmap(text) ?? []).flatMap((r) => r.items).filter((i) => i.done).map((i) => i.id));
}

// ---------------------------------------------------------------- the actors (design D9)

const TDD = 'devkit-core:tdd-implementer';
const COMMIT = 'devkit-core:commit-and-pr';
const PLANNER = 'devkit-core:change-planner';
const SUBAGENT = {
  implement: TDD, 'fix-review': TDD, 'fix-defect': TDD, 'fix-checks': TDD, 'apply-proposals': TDD, 'resolve-release-conflict': TDD,
  commit: COMMIT, 'open-pr': COMMIT, push: COMMIT, 'open-archive-pr': COMMIT, 'push-rebased': COMMIT,
  verify: 'devkit-core:pr-verifier',
  retro: 'general-purpose',
  plan: PLANNER, 'revise-plan': PLANNER,
  readiness: 'devkit-core:plan-readiness-reviewer',
  audit: 'devkit-core:plan-reality-auditor',
};
const MAIN = ['edit-pr-body', 'enable-auto-merge', 'disable-auto-merge', 'update-branch', 'archive', 'tick-roadmap', 'answer', 'worktree', 'rebase'];
const ASKABLE = ['stop-retro-answers', 'stop-plan-approval', 'create', 'new-change', 'grill', 'approve'];
const OWNER = ['ready', 'archive-pr-ready', 'stop-review-deadlock', 'stop-readiness-blocked', 'stop-audit-unverifiable'];
const GITHUB = ['wait-checks', 'wait-merge'];
const STOP = ['stop-plan-mode', 'stop-branch', 'stop-merge-setup', 'stop-archive', 'blocked', 'stop-not-approved'];

// The static map of design D9: { actor, agent?, askable? } for a `next.step`.
// `host` is deliver-check's ('app' or 'cli'): in the app, `implement` is a child session (conduct-sessions D2).
export function actorOf(step, host = 'cli') {
  if (step === 'implement' && host === 'app') return { actor: 'session', agent: TDD };
  if (SUBAGENT[step]) return { actor: 'subagent', agent: SUBAGENT[step] };
  if (step === 'review') return { actor: 'review' };
  if (step === 'gate') return { actor: 'gate' };
  if (MAIN.includes(step)) return { actor: 'main' };
  if (ASKABLE.includes(step)) return { actor: 'owner', askable: true };
  if (OWNER.includes(step)) return { actor: 'owner', askable: false };
  if (GITHUB.includes(step)) return { actor: 'github' };
  if (STOP.includes(step)) return { actor: 'stop' };
  // Steps that end a change's row without an actor; anything else is a deliver-check step this map lacks.
  if (step === 'archived' || step === 'wait-dependencies') return { actor: 'none' };
  return { actor: 'stop', reason: `unknown step ${step}` };
}

const RUNNABLE = ['session', 'subagent', 'review', 'gate', 'main'];
const OWNER_GATE = {
  create: 'schema', 'new-change': 'schema', grill: 'grill', approve: 'plan approval', 'stop-plan-approval': 'plan approval',
  'stop-retro-answers': 'retro answers', 'stop-readiness-blocked': 'readiness BLOCKED', 'stop-audit-unverifiable': 'plan audit UNVERIFIABLE',
};

// The final or runnable state of a change (design D2, AC-7). `summary` is deliver-check's.
function stateOf(next, { summary = '' } = {}) {
  switch (next.actor) {
    case 'session': case 'subagent': case 'review': case 'gate': case 'main': return `ready to run: ${next.step}`;
    case 'owner':
      if (next.step === 'ready') return `waiting for the owner: merge PR #${next.number ?? ''}`.trim();
      if (next.step === 'archive-pr-ready') return `waiting for the owner: merge archive PR #${next.number ?? ''}`.trim();
      if (next.step === 'stop-review-deadlock') return `waiting for the owner: review deadlock (${(next.reviewers || []).join(', ')})`;
      if (next.step === 'answer') return `waiting for the owner: PR decision ${next.url ?? ''}`.trim();
      return `waiting for the owner: ${OWNER_GATE[next.step] ?? next.step}`;
    case 'github': return `waiting on GitHub: ${next.step === 'wait-checks' ? 'checks' : next.waitingFor ?? next.step}`;
    case 'stop':
      if (next.step === 'stop-plan-mode') return `blocked: ship mode plan for ${next.schema ?? ''}`.trim();
      if (next.blockedState) return next.blockedState;
      return /^blocked\b/.test(summary) ? [summary, next.reason].join(': ') : `blocked: ${[summary, next.reason].filter(Boolean).join(': ')}`;
    default:
      if (next.step === 'archived') return 'archived';
      if (next.step === 'wait-dependencies') return `waiting on ${next.ids.join(', ')}${next.archive ? ' (archive)' : ''}`;
      return next.reason ?? next.step;
  }
}

// ---------------------------------------------------------------- worktrees (design D4)

function rebaseBranch(path) {
  try {
    const gitDir = git(path, ['rev-parse', '--absolute-git-dir']).trim();
    for (const d of ['rebase-merge', 'rebase-apply']) {
      const f = join(gitDir, d, 'head-name');
      if (existsSync(f)) return readFileSync(f, 'utf8').trim().replace(/^refs\/heads\//, '');
    }
  } catch { /* not a worktree */ }
  return '';
}

// git worktree list --porcelain, minus prunable and bare entries: [{ path, branch, rebasing }].
// A worktree stopped in the middle of a rebase is detached; its rebase says which branch it is.
export function listWorktrees(root) {
  let out;
  try { out = git(root, ['worktree', 'list', '--porcelain']); } catch { return []; }
  const entries = [];
  for (const block of out.split(/\n\s*\n/)) {
    const e = { path: '', branch: '', prunable: false, bare: false, rebasing: false };
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) e.path = line.slice('worktree '.length);
      else if (line.startsWith('branch refs/heads/')) e.branch = line.slice('branch refs/heads/'.length);
      else if (line === 'bare') e.bare = true;
      else if (line.startsWith('prunable')) e.prunable = true;
    }
    if (!e.path || e.bare || e.prunable) continue;
    const rebasing = rebaseBranch(e.path);
    if (rebasing) { e.rebasing = true; if (!e.branch) e.branch = rebasing; }
    entries.push({ path: e.path, branch: e.branch, rebasing: e.rebasing });
  }
  return entries;
}

// The entry holding change `id`: its own branch, or its archive branch (which wins: it is the later phase).
function findWorktree(worktrees, id) {
  return worktrees.find((w) => w.branch === `chore/archive-${id}`) ?? worktrees.find((w) => w.branch === id) ?? null;
}

function mainRoot(root) {
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
  return dirname(common);
}

// ---------------------------------------------------------------- the schema proposal (design D6)

const CRITERIA = [
  [/new capabilit(?:y|ies)/i, 'a new capability'],
  [/\bcross(?:es|ing)?\b[^.]*\b(?:areas?|packs?|plugins?|modules?)\b/i, 'crosses areas'],
  [/public (?:contract|api|interface)|\bapi contract\b|\bbreaking change\b/i, 'a public contract'],
  [/data model|schema migration|\bmigrations?\b/i, 'a data model'],
  [/\bauth(?:entication|orization)?\b|\bmoney\b|\bpayments?\b|\bbilling\b|personal data|\bpii\b|\bcredentials?\b/i, 'auth, money or personal data'],
  [/hard to roll back|irreversible|roll ?back/i, 'hard to roll back'],
];

// { proposedSchema, reason } from the roadmap line's description and notes. The main session may override it.
export function proposeSchema(text, notes) {
  const body = `${text ?? ''}\n${notes ?? ''}`.trim();
  if (!body) return { proposedSchema: 'devkit', reason: 'the roadmap line has no description: the strictest track' };
  for (const [re, label] of CRITERIA) {
    const m = re.exec(body);
    if (m) return { proposedSchema: 'devkit', reason: `the roadmap line mentions "${m[0]}" (${label}): the full flow` };
  }
  return { proposedSchema: 'devkit-lite', reason: 'no devkit criterion matches the roadmap line: the small flow is enough' };
}

// ---------------------------------------------------------------- planning rows (design D6)

// The artifacts of `schema` that are plain files, except requirements and readiness.
function planArtifactsOf(root, schema) {
  const f = schemaFile(root, schema);
  if (!f) return ['proposal.md', 'tasks.md'];
  const names = [];
  let id = null;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.match(/^\s*-\s*id:\s*(\S+)/);
    if (i) { id = i[1]; continue; }
    const g = line.match(/^\s+generates:\s*["']?([^"'\s]+)["']?\s*$/);
    if (g && id && !g[1].includes('*') && !['requirements', 'readiness'].includes(id)) names.push(g[1]);
  }
  return names.length ? names : ['proposal.md', 'tasks.md'];
}

const mtime = (file) => (existsSync(file) ? statSync(file).mtimeMs : null);

// The facts planningStep and dependencyStep read, from a change's worktree.
function planFacts(ctx, item, entry) {
  const root = entry.path;
  const id = item.id;
  const located = locateChange(root, id);
  const dir = located?.dir ?? join(root, 'openspec', 'changes', id);
  const schema = located ? changeSchemaAt(root, dir) : null;
  const artifacts = located ? planArtifactsOf(root, schema) : [];
  const tasksFile = join(dir, 'tasks.md');
  const started = Boolean(located?.archived) || (existsSync(tasksFile) && parseTasks(readFileSync(tasksFile, 'utf8')).some((t) => t.done));
  const planned = artifacts.map((a) => mtime(join(dir, a))).filter((m) => m !== null);
  const newestPlan = planned.length ? Math.max(...planned) : null;
  const readinessFile = join(dir, 'readiness.md');
  const needsReadiness = Boolean(located) && schemaHasArtifact(root, schema, 'readiness');
  const needsRequirements = Boolean(located) && schemaHasArtifact(root, schema, 'requirements');
  const readinessAt = mtime(readinessFile);
  const proposal = proposeSchema(item.text, item.notes);
  const auditFile = join(dir, 'audit.md');
  const auditBase = readValue(auditFile, 'Base')?.toLowerCase() ?? null;
  const auditAt = mtime(auditFile);
  const baseTicked = auditBase && resolves(root, auditBase) ? tickedAt(root, auditBase) : null;
  return {
    id,
    worktree: root,
    branch: entry.branch,
    schema,
    text: item.text,
    notes: item.notes,
    ...proposal,
    after: item.after,
    hasFolder: Boolean(located),
    started,
    planArtifacts: artifacts,
    missingArtifacts: artifacts.filter((a) => !existsSync(join(dir, a))),
    requirementsFile: join(dir, 'requirements.md'),
    needsRequirements,
    hasRequirements: existsSync(join(dir, 'requirements.md')),
    needsReadiness,
    readiness: needsReadiness ? {
      exists: readinessAt !== null,
      status: readValue(readinessFile, 'Status'),
      fresh: readinessAt !== null && (newestPlan === null || readinessAt >= newestPlan - FRESH_MS),
    } : null,
    readinessFile,
    approval: needsReadiness ? approvalState(dir) : null,
    approvalFile: `openspec/changes/${id}/approval.md`,
    rebasing: entry.rebasing,
    ticked: ctx.ticked,
    headTicked: tickedAt(root, 'HEAD') ?? new Set(),
    base: ctx.originSha,
    ref: ctx.ref,
    audit: auditAt === null ? null : {
      verdict: readValue(auditFile, 'Verdict'),
      baseTicked: Boolean(baseTicked) && item.after.every((d) => baseTicked.has(d)),
      fresh: newestPlan === null || auditAt >= newestPlan - FRESH_MS,
      file: auditFile,
    },
  };
}

const step = (name, reason, extra = {}) => ({ step: name, reason, ...extra });

// Rows C2 and P-1 to P-5. null when planning is done (or never applies: the work has started).
export function planningStep(f) {
  if (!f.hasFolder) {
    return step('new-change', `${f.id} has a worktree but no change folder; ask the owner to confirm the schema`, {
      proposedSchema: f.proposedSchema, reason: f.reason, text: f.text, notes: f.notes,
      command: `openspec new change ${f.id} --schema <confirmed schema>`,
    });
  }
  if (f.started) return null;
  if (f.needsRequirements && !f.hasRequirements) {
    return step('grill', 'requirements.md is missing; grill the owner', { text: f.text, notes: f.notes });
  }
  if (f.missingArtifacts.length) {
    return step('plan', `the plan is missing ${f.missingArtifacts.join(', ')}`, {
      request: f.needsRequirements ? f.requirementsFile : null, text: f.text, notes: f.notes, missing: f.missingArtifacts,
    });
  }
  if (f.needsReadiness) {
    const r = f.readiness;
    if (!r.exists || !r.fresh || !['APPROVED', 'NEEDS-REVISION', 'BLOCKED'].includes(r.status)) {
      return step('readiness', r.exists ? 'readiness.md is older than the plan or has no status; review it again' : 'readiness.md is missing');
    }
    if (r.status === 'NEEDS-REVISION') return step('revise-plan', 'readiness is NEEDS-REVISION', { findings: f.readinessFile });
    if (r.status === 'BLOCKED') return step('stop-readiness-blocked', 'readiness is BLOCKED; the owner decides');
    if (!f.approval.ok) {
      const earlier = f.approval.status === 'APPROVED' && f.approval.recorded;
      return step('approve', earlier ? 'approval.md is for an earlier readiness.md' : 'no recorded owner approval', { readiness: f.approval.readiness, file: f.approvalFile });
    }
  }
  return null;
}

// Rows D-1 to D-5 (design D8): only while the work has not started and the change has `after:` ids.
export function dependencyStep(f) {
  if (f.started || !f.after?.length) return null;
  const waiting = f.after.filter((d) => !f.ticked.has(d));
  if (waiting.length) return step('wait-dependencies', `waiting on ${waiting.join(', ')} (not ticked on ${f.ref ?? 'the default branch'})`, { ids: waiting });
  if (f.rebasing) {
    return step('blocked', `rebase of ${f.id} stopped: resolve or abort it in ${f.worktree}`, {
      blockedState: `blocked: rebase of ${f.id} stopped: resolve or abort it in ${f.worktree}`,
    });
  }
  if (f.after.some((d) => !f.headTicked.has(d))) {
    return step('rebase', `${f.after.join(', ')} ticked on ${f.ref ?? 'the default branch'}; rebase ${f.id} onto it`, {
      command: ['git', '-C', f.worktree, 'rebase', '--autostash', f.ref ?? 'origin/main'],
    });
  }
  const a = f.audit;
  if (!a || !a.baseTicked || !a.fresh || !['ACCURATE', 'OUTDATED', 'UNVERIFIABLE'].includes(a.verdict)) {
    return step('audit', 'the plan is not audited against the merged dependencies', { base: f.base });
  }
  if (a.verdict === 'OUTDATED') return step('revise-plan', 'the plan audit is OUTDATED', { findings: a.file });
  if (a.verdict === 'UNVERIFIABLE') return step('stop-audit-unverifiable', 'the plan audit is UNVERIFIABLE; the owner decides');
  return null;
}

// ---------------------------------------------------------------- delivery (design D9)

// deliver-check's `next` as a conduct row: { next, state }. Fields pass through unchanged.
export function deliveryStep(change, report) {
  let next = { ...report.next, ...actorOf(report.next.step, report.host ?? 'cli') };
  if (next.step === 'answer') next = { ...next, actor: 'owner', askable: false, url: report.pr?.url ?? '' };
  if (next.step === 'ready' && next.number === undefined) next = { ...next, number: report.pr?.number };
  if (next.step === 'stop-plan-mode') next = { ...next, schema: report.schema };
  return { next, state: stateOf(next, { summary: report.summary }) };
}

const CLEAN_KEYS = ['DEVKIT_CHANGE', 'DEVKIT_BRANCH', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF', 'DEVKIT_BYPASS'];
function cleanOf(env) {
  const clean = { ...env };
  for (const k of CLEAN_KEYS) delete clean[k];
  return clean;
}

// deliver-check inside the worktree. Errors are that change's blocked state, never the round's.
function deliver(ctx, row) {
  const clean = cleanOf(ctx.env);
  try {
    const state = collectState(row.worktree, row.id, { env: clean, gh: ctx.ghFor(row.worktree) });
    const report = buildReport(state, clean);
    return { state, report };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}


// ---------------------------------------------------------------- the overrides (design D9)

const RELEASE_REBASE = join(dirname(fileURLToPath(import.meta.url)), 'release-rebase.mjs');

// The PR this checkout's branch is open for: the change PR, or the archive PR after the merge.
const openPrOf = (state) => {
  const pr = state.archive ? state.archive.pr : state.pr;
  return pr && pr.state === 'OPEN' ? pr : null;
};

// Override 2: a branch we rewrote. The PR head is not an ancestor of HEAD but the branch held it before our rebase.
function rewrittenBranch(row, state) {
  const pr = openPrOf(state);
  if (!pr?.headRefOid) return null;
  const root = row.worktree;
  if (gitOk(root, ['merge-base', '--is-ancestor', pr.headRefOid, 'HEAD'])) return null;
  let reflog = [];
  try { reflog = git(root, ['reflog', 'show', '--format=%H', `refs/heads/${state.branch}`]).split('\n').filter(Boolean); } catch { /* no reflog */ }
  if (!reflog.includes(pr.headRefOid)) return null;
  const branch = state.branch;
  return step('push-rebased', `the branch was rewritten by a rebase; PR #${pr.number} still has ${pr.headRefOid.slice(0, 7)}`, {
    number: pr.number, oldHead: pr.headRefOid, branch, paths: [...state.dirty],
    command: ['git', 'push', `--force-with-lease=${branch}:${pr.headRefOid}`, 'origin', branch],
  });
}

// The paths git merge-tree reports as conflicted between origin/<base> and HEAD: { paths } | { clean: true } | { error }.
function conflictedPaths(root, ref) {
  const r = spawnSync('git', ['-C', root, 'merge-tree', '--write-tree', '--name-only', '--no-messages', ref, 'HEAD'], { encoding: 'utf8' });
  if (r.status === 0) return { clean: true };
  if (r.status !== 1) return { error: true };
  const lines = r.stdout.split('\n');
  const paths = [];
  for (const line of lines.slice(1)) { if (line === '') break; paths.push(line); }
  return { paths };
}

// Override 1: a PR in conflict. Release files only: resolve-release-conflict; anything else stays blocked.
function releaseConflict(ctx, row, state, report) {
  const n = report.next;
  const onChange = n.step === 'blocked' && n.item === 5 && n.conflict === true;
  const onArchive = n.step === 'stop-archive' && n.archiveStep === 'archive-pr' && n.conflict === true;
  if (!onChange && !onArchive) return null;
  const where = onChange ? 'item 5' : 'archive (archive-pr)';
  const stop = (message, extra = {}) => ({ ...step('blocked', message, extra), blockedState: `blocked: ${message}` });
  const found = conflictedPaths(row.worktree, ctx.ref);
  if (found.error) {
    return stop(`${where} ${onChange ? '(cannot classify the conflict: git merge-tree --write-tree needs git 2.38)' : ': cannot classify the conflict: git merge-tree --write-tree needs git 2.38'}`);
  }
  if (found.clean) {
    const pr = openPrOf(state);
    return state.ship === 'merge' && pr ? step('update-branch', `GitHub reports a conflict but ${ctx.ref} merges cleanly; update the branch`, { number: pr.number }) : null;
  }
  const others = found.paths.filter((p) => !RELEASE_FILE.test(p));
  if (others.length) return stop(onChange ? `item 5 (conflict in ${others.join(', ')})` : `archive (archive-pr): conflict in ${others.join(', ')}`);
  const pr = openPrOf(state);
  return step('resolve-release-conflict', `the PR conflicts only in release files: ${found.paths.join(', ')}`, {
    number: pr?.number ?? null, paths: [...found.paths].sort(), base: ctx.base,
    command: ['node', RELEASE_REBASE, '--base', ctx.base, '--json'],
  });
}

// deliver-check's report as a conduct row, after the overrides that need git (D9): a rewritten branch first,
// except that auto-merge is switched off before anything else.
function deliveryRow(ctx, row, d) {
  const plain = deliveryStep(row, d.report);
  const info = { delivered: { summary: d.report.summary, met: d.report.met, next: d.report.next } };
  if (d.report.next.step === 'disable-auto-merge') return { ...plain, ...info };
  const override = rewrittenBranch(row, d.state) ?? releaseConflict(ctx, row, d.state, d.report);
  if (!override) return { ...plain, ...info };
  const next = { ...override, ...actorOf(override.step) };
  return { next, state: stateOf(next, { summary: d.report.summary }), ...info };
}

// Override 3: archives are serialized. One archive branch at a time: a change at `archive` waits on every
// other change that already has an archive branch, and on the changes before it in roadmap order that also
// want to archive.
function serializeArchives(ctx, rows) {
  const archiving = (r) => r.next.step !== 'archived' && (r.branch === `chore/archive-${r.id}` || resolves(ctx.root, `refs/heads/chore/archive-${r.id}`));
  const wanting = [];
  return rows.map((r) => {
    if (r.next.step !== 'archive') return r;
    const blockers = [...rows.filter((o) => o.id !== r.id && archiving(o)).map((o) => o.id), ...wanting];
    wanting.push(r.id);
    if (!blockers.length) return r;
    const next = { step: 'wait-dependencies', reason: `waiting on ${blockers.join(', ')} to archive first`, ids: [...new Set(blockers)], archive: true, ...actorOf('wait-dependencies') };
    return { ...r, next, state: stateOf(next) };
  });
}

// ---------------------------------------------------------------- one change

function blockedRow(row, message) {
  const next = { step: 'blocked', reason: message, ...actorOf('blocked'), blockedState: `blocked: ${message}` };
  return { ...row, next, state: stateOf(next) };
}

// The half-done work of a change in its worktree (design D4): { dirty, phases, summary }, or null when there is none.
function unfinishedWork(worktree, id) {
  const dirty = gitFacts(worktree).dirty;
  const located = locateChange(worktree, id);
  const tasksFile = located ? join(located.dir, 'tasks.md') : null;
  const tasks = tasksFile && existsSync(tasksFile) ? parseTasks(readFileSync(tasksFile, 'utf8')) : [];
  const phases = [...new Set(tasks.map((t) => t.phase))]
    .filter((n) => tasks.some((t) => t.phase === n && t.done) && tasks.some((t) => t.phase === n && !t.done))
    .sort((a, b) => a - b);
  if (!dirty.length && !phases.length) return null;
  const parts = [];
  if (dirty.length) parts.push(`${dirty.length} uncommitted path${dirty.length === 1 ? '' : 's'} outside openspec/: ${dirty.slice(0, 3).join(', ')}`);
  for (const n of phases) {
    const inPhase = tasks.filter((t) => t.phase === n);
    parts.push(`phase ${n} half done (${inPhase.filter((t) => t.done).map((t) => t.id).join(', ')} ticked, ${inPhase.filter((t) => !t.done).map((t) => t.id).join(', ')} open)`);
  }
  return { dirty, phases, summary: parts.join('; ') };
}

const NEW_CHANGE_CMD = (id) => `openspec new change ${id} --schema <devkit|devkit-lite>`;

// The newest archived folder of `id` on `ref`: its name, or null.
function archivedOn(root, ref, id) {
  let out = '';
  try { out = git(root, ['ls-tree', '--name-only', ref, 'openspec/changes/archive/']); } catch { return null; }
  const re = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const names = out.split('\n').map((l) => l.split('/').pop()).filter((n) => re.test(n)).sort();
  return names.at(-1) ?? null;
}

// Single-change mode, no worktree, no branch (design D3 steps 3 and 4): the archived row, or exit 3.
function missingChange(ctx, id) {
  if (archivedOn(ctx.root, ctx.ref, id)) return null;
  const here = locateChange(ctx.root, id);
  if (here && !here.archived) {
    let branch = '';
    try { branch = git(ctx.root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { /* no branch */ }
    throw new UsageError(`change ${id} is on another branch: openspec/changes/${id}/ is in ${ctx.root} on branch ${branch}; run \`git switch -c ${id}\` there and run again`);
  }
  throw new UsageError(`no change ${id}: no worktree, no branch ${id}, no openspec/changes/${id}/ on ${ctx.ref} and no archived folder; create it with \`${NEW_CHANGE_CMD(id)}\` on a branch named ${id}`);
}

function evaluate(ctx, item, round) {
  const entry = findWorktree(ctx.worktrees, item.id);
  if (ctx.single && entry && !locateChange(entry.path, item.id)) {
    throw new UsageError(`change ${item.id} has a worktree without a folder: ${entry.path} has no openspec/changes/${item.id}/; run \`${NEW_CHANGE_CMD(item.id)}\` there`);
  }
  const row = {
    id: item.id, round, after: item.after, text: item.text, notes: item.notes, schema: null,
    worktree: entry?.path ?? join(ctx.main, '.claude', 'worktrees', item.id),
    branch: entry?.branch ?? item.id, base: ctx.base, next: null, state: '', deliver: null,
    unfinished: entry ? unfinishedWork(entry.path, item.id) : null,
  };
  const finish = (next, extra = {}) => {
    const full = { ...next, ...actorOf(next.step), ...(next.askable !== undefined ? { askable: next.askable } : {}) };
    return { ...row, ...extra, next: full, state: stateOf(full, { summary: extra.deliver?.summary }) };
  };

  if (!entry) {
    const proposal = proposeSchema(item.text, item.notes);
    const path = row.worktree;
    const local = resolves(ctx.root, `refs/heads/${item.id}`);
    const remote = resolves(ctx.root, `refs/remotes/origin/${item.id}`);
    const onBase = gitOk(ctx.root, ['rev-parse', '--verify', '--quiet', `${ctx.ref}:openspec/changes/${item.id}`]);
    if (local) return finish(step('worktree', 'the change has a branch but no worktree', { path, command: ['git', 'worktree', 'add', path, item.id] }));
    if (remote) return finish(step('worktree', 'the change has a remote branch but no local one', { path, command: ['git', 'worktree', 'add', '--track', '-b', item.id, path, `origin/${item.id}`] }));
    if (onBase) return finish(step('worktree', `openspec/changes/${item.id}/ is on ${ctx.ref}`, { path, command: ['git', 'worktree', 'add', '-b', item.id, path, ctx.ref] }));
    if (ctx.single) {
      missingChange(ctx, item.id);
      return finish(step('archived', `${item.id} is archived on ${ctx.ref}`));
    }
    return finish(step('create', 'a new change: ask the owner to confirm the schema, then create its worktree and folder', {
      path, text: item.text, notes: item.notes, ...proposal, command: ['git', 'worktree', 'add', '-b', item.id, path, ctx.ref],
    }));
  }

  const facts = planFacts(ctx, item, entry);
  row.schema = facts.schema ?? (facts.hasFolder ? null : proposeSchema(item.text, item.notes).proposedSchema);
  const planning = planningStep(facts) ?? dependencyStep(facts);
  if (planning) return finish(planning, { schema: facts.schema });

  const d = deliver(ctx, { ...row, worktree: entry.path });
  if (d.error) return blockedRow({ ...row, schema: facts.schema }, d.error);
  const { next, state, delivered: info } = deliveryRow(ctx, { ...row, worktree: entry.path }, d);
  return { ...row, schema: d.report.schema, next, state, deliver: info };
}

// ---------------------------------------------------------------- the round (design D3, D10, D12)

// The conducted changes, in roadmap order, by actor: dispatch (capped at 3 minus busy; `main` steps are
// not capped), owner (askable gates), github, stopped, and busy.
export function selectDispatch(changes, busy = [], cap = MAX_PARALLEL) {
  const busySet = new Set(busy);
  const free = Math.max(0, cap - busySet.size);
  let used = 0;
  const dispatch = [];
  for (const c of changes) {
    if (busySet.has(c.id) || !RUNNABLE.includes(c.next.actor)) continue;
    if (c.next.actor === 'main') { dispatch.push(c.id); continue; }
    if (used < free) { dispatch.push(c.id); used++; }
  }
  return dispatch;
}

function summarizeRound(changes, busy) {
  const known = new Set(changes.map((c) => c.id));
  const busyIds = busy.filter((id) => known.has(id));
  const dispatch = selectDispatch(changes, busy);
  const owner = changes.filter((c) => c.next.actor === 'owner' && c.next.askable).map((c) => c.id);
  const github = changes.filter((c) => c.next.actor === 'github').map((c) => c.id);
  const stopped = changes.filter((c) => c.next.actor === 'stop').map((c) => c.id);
  return { dispatch, owner, github, stopped, busy: busyIds, end: dispatch.length === 0 && owner.length === 0 && busyIds.length === 0 };
}

// ---------------------------------------------------------------- sessions (conduct-sessions D3)

const cutId = (id, n) => id.slice(0, n).replace(/-+$/, '');

// The name prefix (`<id20>-p`) of every conducted change: Map id -> prefix. Two ids with the same cut id
// both get `<id18><hh>-p`, hh being the first two hex characters of the SHA-1 of the full id.
export function sessionPrefixes(ids) {
  const cuts = new Map();
  for (const id of ids) cuts.set(cutId(id, 20), (cuts.get(cutId(id, 20)) ?? 0) + 1);
  return new Map(ids.map((id) => {
    const cut = cutId(id, 20);
    if (cuts.get(cut) === 1) return [id, `${cut}-p`];
    return [id, `${cutId(id, 18)}${createHash('sha1').update(id).digest('hex').slice(0, 2)}-p`];
  }));
}

function briefOf(id, phase, worktree, branch) {
  return [
    `Implement phase ${phase} of change \`${id}\` in \`${worktree}\` on branch \`${branch}\`.`,
    `Work only there; every path is absolute under it; start every Bash command with \`cd ${worktree} && \`; do not fetch.`,
    `Dispatch \`devkit-core:tdd-implementer\` with the Agent tool: "Implement phase ${phase} of change ${id}; stop at its gate." Wait for its \`Outcome:\`.`,
    'Do not run the gate, commit, push, open a PR, start a session or edit product code yourself (in the `devkit` schema the project\'s hooks refuse it).',
    'End your turn with exactly two lines first: `Outcome: success` or `Outcome: failure: <reason>`, then `Head: <sha of HEAD in the worktree>`.',
  ].join(' ');
}

function backgroundOf(result, c) {
  const round = result.mode === 'change' ? `Change \`${result.change}\`, conducted on its own: no roadmap round.` : result.round ? `Round ${result.round.n} (${result.round.title}).` : '';
  return [round, c.text ? `Roadmap: ${c.text}.` : '', `Schema: ${c.schema}.`,
    'The coordinating session recomputes the next step when you end; it runs the gate and the commit.'].filter(Boolean).join(' ');
}

// sessionPrefix on every change row; the `session` descriptor on every row whose actor is `session`.
function addSessions(result, host) {
  const prefixes = sessionPrefixes(result.changes.map((c) => c.id));
  for (const c of result.changes) {
    c.sessionPrefix = prefixes.get(c.id);
    if (c.next.actor !== 'session') continue;
    const phase = c.next.phase;
    c.session = {
      title: `${c.id}: phase ${phase}`, name: `${c.sessionPrefix}${phase}`, cwd: c.worktree, branch: c.branch, phase,
      brief: briefOf(c.id, phase, c.worktree, c.branch), background: backgroundOf(result, c),
    };
  }
}

// Seconds between watch polls: DEVKIT_POLL_SECONDS, default 60 (tests use 0).
function pollSeconds(env) {
  const n = Number(env.DEVKIT_POLL_SECONDS);
  return env.DEVKIT_POLL_SECONDS !== undefined && env.DEVKIT_POLL_SECONDS !== '' && n >= 0 ? n : 60;
}
function sleepSync(ms) {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// What a GitHub wait is waiting for: when it changes, something happened.
const signature = (c) => JSON.stringify([c.next.step, c.next.waitingFor ?? null, c.next.pending ?? null, c.state]);

// The round number of a row: `at + 1` in a round, null in single-change mode (where `at` is null).
const roundOf = (at) => (at === null ? null : at + 1);

function compute(root, { env, ghFor, round, busy, change }) {
  const repo = readRepoSettings(ghFor(root));
  if (repo.error) throw new UsageError(`cannot read the default branch: ${repo.error}`);
  const base = repo.settings?.default_branch;
  if (!base) throw new UsageError('cannot read the default branch: the repository settings have no default_branch');
  const ref = `origin/${base}`;
  if (!resolves(root, ref)) throw new UsageError(`${ref} does not resolve; run: git fetch origin ${base}`);
  if (change) {
    const result = { version: 2, base, mode: 'change', change, round: null, startedAt: null, skipped: [], roadmapDone: false, changes: [] };
    const ctx = {
      root, env, ghFor, base, ref, ticked: new Set(), main: mainRoot(root), worktrees: listWorktrees(root),
      originSha: git(root, ['rev-parse', ref]).trim(), single: true,
    };
    const items = [{ id: change, after: [], text: null, notes: null }];
    result.changes = serializeArchives(ctx, items.map((item) => evaluate(ctx, item, null)));
    return conclude(result, ctx, items, null, busy, env);
  }
  let text;
  try { text = git(root, ['show', `${ref}:openspec/roadmap.md`]); } catch { throw new UsageError(`${ref} has no openspec/roadmap.md`); }
  const rounds = parseRoadmap(text) ?? [];
  if (round !== null && !(Number.isInteger(round) && round >= 1 && round <= rounds.length)) {
    throw new UsageError(`--round ${round} is out of range: the roadmap has ${rounds.length} round${rounds.length === 1 ? '' : 's'}`);
  }
  const startedAt = round ?? 1;
  const unticked = (r) => r.items.filter((i) => !i.done);
  const skipped = rounds.slice(0, startedAt - 1).map((r, i) => ({ n: i + 1, unticked: unticked(r).map((x) => x.id) })).filter((s) => s.unticked.length);
  const at = rounds.findIndex((r, i) => i >= startedAt - 1 && unticked(r).length > 0);
  const ticked = new Set(rounds.flatMap((r) => r.items).filter((i) => i.done).map((i) => i.id));
  const current = at >= 0 ? rounds[at] : null;
  const result = { version: 2, base, mode: 'round', change: null, round: null, startedAt, skipped, roadmapDone: current === null, changes: [] };
  let ctx = null;
  let items = [];
  if (current) {
    result.round = { n: at + 1, title: current.title, done: current.items.filter((i) => i.done).length, total: current.items.length };
    ctx = {
      root, env, ghFor, base, ref, ticked, main: mainRoot(root), worktrees: listWorktrees(root),
      originSha: git(root, ['rev-parse', ref]).trim(),
    };
    items = unticked(current);
    result.changes = serializeArchives(ctx, items.map((item) => evaluate(ctx, item, at + 1)));
  }
  return conclude(result, ctx, items, at, busy, env);
}

// The dispatch summary, the running states and the sessions, on a computed result.
function conclude(result, ctx, items, at, busy, env) {
  const summary = summarizeRound(result.changes, busy);
  const busySet = new Set(summary.busy);
  for (const c of result.changes) if (busySet.has(c.id) && RUNNABLE.includes(c.next.actor)) c.state = 'running';
  Object.assign(result, summary);
  addSessions(result, detectHost(env));
  return { result, ctx, items, at };
}

// The whole round: { version: 2, base, round, startedAt, skipped, roadmapDone, changes, dispatch, owner, github,
// stopped, busy, end }. With `watch` (minutes) and everything waiting on GitHub, polls the waiting changes
// until one moves or the cap passes, then returns the recomputed round with `watch: { minutes, timedOut }`.
export function conductState(root, { env = process.env, ghFor = (r) => makeGh(r, env), round = null, busy = [], watch = null, change = null } = {}) {
  const opts = { env, ghFor, round, busy, change };
  let { result, ctx, items, at } = compute(root, opts);
  if (watch === null || !result.end || result.github.length === 0) return result;
  const before = new Map(result.changes.filter((c) => result.github.includes(c.id)).map((c) => [c.id, signature(c)]));
  const deadline = Date.now() + watch * 60000;
  const every = pollSeconds(env) * 1000;
  let timedOut = true;
  while (Date.now() < deadline) {
    sleepSync(Math.min(every, Math.max(0, deadline - Date.now())));
    const moved = [...before].some(([id, sig]) => signature(evaluate(ctx, items.find((i) => i.id === id), roundOf(at))) !== sig);
    if (moved) { timedOut = false; break; }
  }
  ({ result } = compute(root, opts));
  result.watch = { minutes: watch, timedOut };
  return result;
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const opts = { json: false, round: null, change: null, busy: [], watch: null };
  const value = (a, name, rest) => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : rest.shift() ?? '');
  const rest = [...argv];
  while (rest.length) {
    const a = rest.shift();
    if (a === '--json') opts.json = true;
    else if (a === '--round' || a.startsWith('--round=')) {
      const v = value(a, 'round', rest);
      if (!/^\d+$/.test(v)) throw new UsageError(`--round expects a round number, not "${v}"`);
      opts.round = Number(v);
    } else if (a === '--change' || a.startsWith('--change=')) {
      const v = value(a, 'change', rest);
      if (!/^[\w.-]+$/.test(v) || ['.', '..', 'archive'].includes(v)) throw new UsageError(`--change expects a change id, not "${v}"`);
      opts.change = v;
    } else if (a === '--busy' || a.startsWith('--busy=')) opts.busy = value(a, 'busy', rest).split(',').map((x) => x.trim()).filter(Boolean);
    else if (a === '--watch' || a.startsWith('--watch=')) opts.watch = watchMinutes(a.includes('=') ? a.slice(a.indexOf('=') + 1) : undefined);
    else throw new UsageError(`unknown option ${a}; usage: conduct-check [--json] [--round <n>] [--change <id>] [--busy <id,id>] [--watch[=<minutes>]]`);
  }
  if (opts.change !== null && opts.round !== null) throw new UsageError('--change and --round do not combine');
  return opts;
}

export function renderHuman(result) {
  const list = (ids) => (ids.length ? ids.join(', ') : 'none');
  return [
    ...result.changes.map((c) => `${c.id}: ${c.state}`),
    `dispatch: ${list(result.dispatch)}`,
    `owner: ${list(result.owner)}`,
    `github: ${list(result.github)}`,
    ...(result.watch ? [`watch: ${result.watch.timedOut ? `stopped after ${result.watch.minutes} minutes` : 'ended'}`] : []),
  ].join('\n') + '\n';
}

// Runs the checker: { code, stdout, stderr }. 0 with a report (a blocked change is a state, not an exit code),
// 3 on a usage or setup error.
export function main(argv, env = process.env, cwd = process.cwd()) {
  let json = argv.includes('--json');
  try {
    const opts = parseArgs(argv);
    json = opts.json;
    const root = findRoot(cwd);
    if (!root) throw new UsageError(`no openspec/ folder found from ${cwd}`);
    if (!gitOk(root, ['rev-parse', '--git-dir'])) throw new UsageError(`${root} is not a git repository: conduct-check reads commits and worktrees`);
    const result = conductState(root, { env, round: opts.round, change: opts.change, busy: opts.busy, watch: opts.watch });
    return { code: 0, stdout: json ? `${JSON.stringify(result, null, 2)}\n` : renderHuman(result), stderr: '' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { code: 3, stdout: json ? `${JSON.stringify({ version: 2, error: message })}\n` : '', stderr: `conduct-check: ${message}\n` };
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
