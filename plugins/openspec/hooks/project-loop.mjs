// project-loop: the decision core of `/devkit project` (design project-phases D-5 to D-10).
//
// A slice is an OpenSpec change on the `devkit-project` script, named after the slice, in its own worktree and branch. Given a
// slice, `next` asks the stage checker (flow-check) which stage it is in and, once the slice is archived on its branch, GitHub
// which step of its one pull request comes next, and answers with ONE action or ONE end for the session to carry out. It reads
// files, git and (through gh) GitHub, calls no AI, and runs nothing when imported.
//
// Commands (the same output shape and exit codes as change-loop.mjs: 0 an action or delivered, 1 a wait, 2 blocked, 3 an error):
//   start --lang <l>                       (the words after `project` on standard input) the mode of the start, read-only
//   open <slice> --lang <l>                creates the worktree, the branch and the change
//   next --slice <slice> --lang <l> [--after <progressKey>]
//   status <slice> --lang <l>              the readout of design D-10, plain text
//   rounds <slice> --lang <l> [--write]    checks the roadmap record's rounds; with --write appends them to openspec/roadmap.md
//   record-review <slice> --lang <l>       writes review.md from the ADR reviewer's verdict file
//   archive <slice> --lang <l>             archives the slice when every stage before the delivery is settled
//   wait --slice <slice> --lang <l> [--interval <seconds>]   waits on GitHub with no limit
// Only open, rounds --write, record-review and archive write. No run line is printed: no lock holds a `/devkit project` run (D-12).
// No dependencies beyond the pack's hook modules.

import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { findRoot, parseRoadmap, readValue, parseCommitLine, sliceReviewStale, parseStageHeader, archivedSliceOf } from './guard.mjs';
import { collectFlow, computeFlow, fingerprint, inSentence, makeOpenspec, reasonText, readFlow } from './flow-check.mjs';
import { shipConfig, locateChange, fetchPr, checksItem } from './deliver-check.mjs';
import { mergeSetup, makeGh } from './merge-setup.mjs';
import {
  LoopUsageError, LoopRefusal, render, normalizeLang, projectGate, readDevkitSettings, locate, cleanOf, checkoutsOf, activeIds, isSliceDir,
  knownChange, archivedDates, mainRoot, defaultBase, tryGit, NAME, openCheckout, whereOf, waitLoop, readStdin, stagePhrase, filesLanguageOf, filesLanguageName,
} from './change-loop.mjs';

export const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));
const LOOP = join(HOOKS_DIR, 'project-loop.mjs');
const SCRIPT = 'devkit-project';

const PHASES = ['business', 'domain-model', 'architecture', 'implementation-plan'];
const SETTLED_STAGES = [...PHASES, 'roadmap'];
const DOC = { business: '1-business-vision.md', 'domain-model': '2-domain-model.md', architecture: '3-architecture.md', 'implementation-plan': '4-implementation-plan.md' };
const AGENT = { 'commit-and-pr': 'devkit-core:commit-and-pr', 'adr-reviewer': 'devkit-core:adr-reviewer' };
const INTERVIEW = ['no-file', 'no-header', 'bad-header', 'header-other-stage'];
const REVIEW_REASONS = ['no-file', 'stale-code', 'stale-plan', 'rerun-after-fix'];
const BLOCKED_OF = { 'ceiling-reached': 'ceiling', 'no-progress': 'no-progress', 'gh-too-old': 'gh-too-old', 'undeclared-stage': 'undeclared-stage' };
const MARKERS = /<!-- devkit-rounds:begin -->\r?\n([\s\S]*?)<!-- devkit-rounds:end -->/;
const ITEM = /^\s*[-*]\s+\[([ xX])\]\s+([A-Za-z0-9][\w.-]*)(?:\s+\(after:\s*([^)]*)\))?(.*)$/;

// ---------------------------------------------------------------- small readers

const gitOut = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
const headOf = (root) => tryGit(root, ['rev-parse', 'HEAD']);
const sameCommit = (a, b) => Boolean(a) && Boolean(b) && (a.startsWith(b) || b.startsWith(a));

// Every path git sees as changed under `root`, tracked or not, outside .claude/ (the loop's own worktrees).
function uncommittedPaths(root) {
  const entries = gitOut(root, ['status', '--porcelain', '-z', '-uall']).split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    paths.push(entries[i].slice(3));
    if (/[RC]/.test(entries[i].slice(0, 2))) i++;
  }
  return paths.filter((p) => !p.startsWith('.claude/'));
}

// { exists, word, sha, full, isHead, usable } of an ADR reviewer's verdict file, read against `head`.
function readVerdict(file, root, head) {
  if (!existsSync(file)) return { exists: false, usable: false };
  const text = readFileSync(file, 'utf8');
  const word = readValue(file, 'Verdict');
  const commit = parseCommitLine(text);
  const full = commit ? tryGit(root, ['rev-parse', '--verify', '--quiet', `${commit.sha}^{commit}`]) : '';
  return { exists: true, word, sha: commit?.sha ?? null, full, uncommitted: Boolean(commit?.uncommitted), isHead: Boolean(full) && full === head, usable: Boolean(word && commit && full && !commit.uncommitted) };
}

// { result, attempt, commit } of a stage record's header, or null.
function readRecord(file) {
  if (!existsSync(file)) return null;
  const h = parseStageHeader(readFileSync(file, 'utf8'));
  return h && !h.malformed ? h : null;
}

const roadmapFile = (root) => join(root, 'openspec', 'roadmap.md');
const roadmapIds = (root) => (existsSync(roadmapFile(root)) ? parseRoadmap(readFileSync(roadmapFile(root), 'utf8')).flatMap((r) => r.items.map((i) => i.id)) : []);
// One more than the highest `## Round <n>` heading of the roadmap, 1 with none.
function nextRoundOf(root) {
  if (!existsSync(roadmapFile(root))) return 1;
  const numbers = [...readFileSync(roadmapFile(root), 'utf8').matchAll(/^##\s+Round\s+(\d+)/gm)].map((m) => Number(m[1]));
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

// The rounds block of a roadmap record: { record: header | null, block: text between the markers | null }.
function roundsBlock(dir) {
  const file = join(dir, 'roadmap.md');
  if (!existsSync(file)) return { record: null, block: null };
  const text = readFileSync(file, 'utf8');
  const m = MARKERS.exec(text);
  return { record: parseStageHeader(text), block: m ? m[1] : null };
}

const cmdOf = (slice, lang, ...args) => ['node', LOOP, ...args.slice(0, 1), slice, '--lang', lang, ...args.slice(1)];

// ---------------------------------------------------------------- the decision (D-6), pure

// facts: { ctx: { slice, root, branch, lang, filesLanguage, base, ship, method }, flow, after, fingerprint, kind: 'default' | 'active' | 'archived',
// noRounds, notOpened, report, dirty, docs, flat, adrFolder, nextRound, rounds: { passed, ids, missing }, verdict, reviewMd, archived }.
// Returns the action of D-6; pure.
export function decideSlice(facts) {
  const { ctx, flow } = facts;
  const lang = normalizeLang(ctx.lang);
  const say = (key, params = {}) => render(lang, key, { id: ctx.slice, ...params });
  const stageById = (id) => flow?.stages.find((s) => s.id === id) ?? null;
  const titleOf = (id) => stageById(id)?.title[lang] ?? id;
  const base = { version: 1, slice: ctx.slice, root: ctx.root, branch: ctx.branch, filesLanguage: ctx.filesLanguage };
  const stageFields = (id) => {
    const s = stageById(id);
    return { stage: s ? id : null, stageTitle: s ? s.title[lang] : null, role: s?.role ?? null, skills: s?.skills ?? [] };
  };
  const finish = (state, why, key, params, stageId, detail) => ({
    ...base, kind: 'end', ...stageFields(stageId), end: { state, why }, params: { id: ctx.slice, ...params }, ...(detail ? { detail } : {}), reply: say(key, params),
  });
  const blocked = (why, params = {}, stageId = null, detail) => finish('blocked', why, 'blocked', { why, ...params }, stageId, detail);
  const delivered = () => finish('delivered', facts.noRounds ? 'project-delivered-no-rounds' : 'project-delivered', facts.noRounds ? 'project-delivered-no-rounds' : 'project-delivered', {}, null);
  const key = (stage, step) => `${stage}/${step ?? stage}@${facts.fingerprint}`;
  const brief = (stage, what) => `Slice ${ctx.slice} (${SCRIPT} script), stage ${stage}: ${what}. Work only in ${ctx.root} on branch ${ctx.branch}; `
    + `every file path is absolute under it; start every Bash command with cd ${ctx.root} && ; do not fetch. `
    + `Write the slice's files in ${filesLanguageName(ctx.filesLanguage)}.`;
  const COMMIT_RULE = ` Commit by name only the files under docs/design/${ctx.slice}/, the ADR folders, openspec/roadmap.md and the slice's folder; never on the default branch.`;

  // K1: the loop does not repeat an action that made no progress.
  const guard = (action) => (facts.after && facts.after === action.progressKey ? blocked('no-progress', { stage: titleOf(action.stage) }, action.stage) : action);
  const agent = (stage, role, step, what, extra = '') => guard({
    ...base, kind: 'agent', ...stageFields(stage), agent: AGENT[role], step, brief: brief(stage, what) + extra, progressKey: key(stage, step),
  });
  const sessionAction = (stage, step, detail) => guard({ ...base, kind: 'session', ...stageFields(stage), step, detail, progressKey: key(stage, step) });
  const commitAgent = (stage, what) => agent(stage, 'commit-and-pr', 'commit', what, COMMIT_RULE);
  // K2: an ADR reviewer handed the review whose verdict did not come back ends the run.
  const reviewAgent = (folder) => {
    const action = agent('review', 'adr-reviewer', 'review', `review the slice's diff against origin/${ctx.base} (the documents under docs/design/${ctx.slice}/ and the new or changed files of the ADR folders) `
      + `against the project's ADRs, and write your verdict file to ${join(folder, 'reviews', 'adr-reviewer.md')}`);
    if (action.kind === 'agent' && facts.after && /^review\/review@/.test(facts.after)) return blocked('not-delivered', { stage: titleOf('review') }, 'review');
    return action;
  };
  const recordReview = () => sessionAction('review', 'record-review', { command: cmdOf(ctx.slice, lang, 'record-review') });

  const designDir = join(ctx.root, 'docs', 'design', ctx.slice);
  const recordDir = join(ctx.root, 'openspec', 'changes', ctx.slice);
  const phase = (stageId, step, extra = {}) => {
    const s = stageById(stageId);
    const earlier = PHASES.slice(0, PHASES.indexOf(stageId)).map((id) => DOC[id]).filter((f) => facts.docs.includes(f)).map((f) => join(designDir, f));
    const detail = {
      skills: s?.skills ?? [], document: join(designDir, DOC[stageId]), record: join(recordDir, `${stageId}.md`), notes: join(designDir, 'STATE.md'),
      adrFolder: join(ctx.root, facts.adrFolder), earlier, flat: facts.flat, ...extra,
    };
    return guard({
      ...base, kind: 'phase', ...stageFields(stageId), step, detail, progressKey: key(stageId, step),
      ...(step === 'approval' ? { reply: say('phase-approval', { stage: titleOf(stageId) }) } : {}),
    });
  };
  const roundsAction = (step) => guard({
    ...base, kind: 'rounds', ...stageFields('roadmap'), step, progressKey: key('roadmap', step),
    detail: {
      record: join(recordDir, 'roadmap.md'), source: join(designDir, DOC['implementation-plan']), nextRound: facts.nextRound,
      checkCommand: cmdOf(ctx.slice, lang, 'rounds'), writeCommand: cmdOf(ctx.slice, lang, 'rounds', '--write'),
    },
    ...(step === 'approval' ? { reply: say('rounds-approval', { list: facts.rounds.ids.join(', ') }) } : {}),
  });

  const ghParams = (p) => ({ installed: p?.installed ?? render(lang, 'gh-version-unknown'), minimum: p?.minimum, verb: 'project' });

  // The reason of a blocked end of the stage checker, in plain words.
  const blockedEnd = (e) => {
    const why = BLOCKED_OF[e.reasonCode] ?? 'unknown-step';
    const stageId = e.params?.stage ?? e.stage;
    const params = { stage: titleOf(stageId), attempt: e.params?.attempt };
    if (why === 'gh-too-old') Object.assign(params, ghParams(e.params));
    return blocked(why, params, e.stage);
  };

  if (facts.kind === 'default') return delivered();
  if (facts.notOpened) return blocked('not-opened', {}, 'open');
  return facts.kind === 'active' ? activePart() : archivedPart();

  // -------- S3 to S12: the slice's folder is active
  function activePart() {
    const r = facts.report;
    const n = r.next;
    const e = r.end;
    if (n?.stage === 'open') return blocked('not-opened', {}, 'open');
    if (n) {
      if (n.reasonCode === 'fix-after-failure') return phase(n.stage, 'revise', { findings: join(recordDir, 'reviews', 'adr-reviewer.md') });
      if (PHASES.includes(n.stage) && INTERVIEW.includes(n.reasonCode)) return phase(n.stage, 'interview');
      if (n.stage === 'roadmap' && INTERVIEW.includes(n.reasonCode)) return roundsAction('propose');
      if (n.stage === 'review' || n.stage === 'delivery') {
        if (facts.rounds.passed && facts.rounds.missing.length) return sessionAction('roadmap', 'write-rounds', { command: cmdOf(ctx.slice, lang, 'rounds', '--write') });
        if (n.stage === 'delivery') return sessionAction('delivery', 'archive', { command: cmdOf(ctx.slice, lang, 'archive') });
        return reviewPart(n);
      }
      return blocked('unknown-step', {}, n.stage);
    }
    if (e.state === 'waiting-for-owner' && e.reasonCode === 'owner-pending') {
      if (PHASES.includes(e.stage)) return phase(e.stage, 'approval');
      if (e.stage === 'roadmap') return roundsAction('approval');
    }
    if (e.state === 'blocked') return blockedEnd(e);
    return blocked('unknown-step', {}, e.stage ?? null);
  }

  function reviewPart(n) {
    if (!REVIEW_REASONS.includes(n.reasonCode)) return blocked('unknown-step', {}, 'review');
    if (facts.dirty.length) return commitAgent('review', `commit the slice's files by name on its branch, push nothing`);
    const v = facts.verdict;
    if (v.usable && v.isHead && !sameCommit(facts.reviewMd?.commit, v.sha)) return recordReview();
    return reviewAgent(recordDir);
  }

  // -------- S13 to S26: the slice is archived on its branch
  function archivedPart() {
    const a = facts.archived;
    const waitGithub = (what) => finish('waiting-on-github', 'waiting-github', 'project-waiting-github', { what }, 'delivery');
    if (ctx.ship === 'plan') {
      if (a.uncommitted) return commitAgent('delivery', `commit the archive move and anything uncommitted of the slice on its branch, push nothing`);
      return finish('waiting-for-owner', 'project-plan-mode', 'project-plan-mode', {}, 'delivery');
    }
    const v = a.verdict;
    const rm = a.reviewMd;
    if (v.usable && v.isHead && !sameCommit(rm?.commit, v.sha)) return recordReview();
    if (!v.usable || a.stale || !rm || rm.result !== 'passed') return reviewAgent(a.folder);

    const fetched = a.pr();
    if (fetched.error) return blocked('github-unreadable', { error: fetched.error }, 'delivery');
    if (fetched.none) {
      return agent('delivery', 'commit-and-pr', 'open-pr', `commit by name the archive move and anything uncommitted of the slice, push the branch, and open one pull request to ${ctx.base} `
        + `titled \`docs(design): ${ctx.slice}\`, whose body lists the slice's documents, its new ADRs, the appended rounds (or that the roadmap is unchanged) and the archived folder; never merge`, COMMIT_RULE);
    }
    const pr = fetched.pr;
    if (pr.state === 'MERGED') return delivered();
    if (pr.state !== 'OPEN') return blocked('pr-closed', { number: pr.number }, 'delivery');
    if (pr.headRefOid !== a.head || a.uncommitted) {
      return agent('delivery', 'commit-and-pr', 'push', `commit by name anything uncommitted of the slice and push the branch so that pull request #${pr.number} holds the local head`, COMMIT_RULE);
    }
    const checks = a.checks(fetched);
    if (checks.status === 'blocked') {
      const old = checks.details.ghTooOld;
      if (old) return blocked('gh-too-old', ghParams(old), 'delivery');
      return blocked('github-unreadable', { error: checks.reason }, 'delivery');
    }
    const failing = checks.details.failing;
    if (failing.length) return blocked('checks-failing', { list: failing.map((c) => `${c.name} (${c.link})`).join(', ') }, 'delivery');
    if (pr.mergeable === 'CONFLICTING') return blocked('branch-conflict', { number: pr.number, base: pr.baseRefName }, 'delivery');
    if (pr.mergeStateStatus === 'BEHIND') return sessionAction('delivery', 'update-branch', { number: pr.number });
    if (checks.details.pending.length) return waitGithub('checks');
    if (pr.autoMergeRequest != null) return waitGithub('merge');
    if (ctx.ship === 'pr') return finish('waiting-for-owner', 'project-pr-mode', 'project-pr-mode', { number: pr.number }, 'delivery');
    const setup = a.mergeSetup();
    if (!setup.ok) return blocked('merge-setup-missing', { list: setup.missing.map((m) => m.replace(/; run the openspec-setup skill.*$/, '')).join('; ') }, 'delivery');
    return sessionAction('delivery', 'enable-auto-merge', { number: pr.number, head: a.head, method: ctx.method });
  }
}

// The exit code of an action: 0 an action or delivered, 1 a wait, 2 blocked, 3 the slice cannot be read.
export function exitCodeOf(action) {
  if (action.kind !== 'end') return 0;
  const { state, why } = action.end;
  if (state === 'delivered') return 0;
  if (state === 'blocked') return why === 'unreadable' ? 3 : 2;
  return 1;
}

// ---------------------------------------------------------------- reading the slice (D-6)

// What kind of slice `slice` is in this project and where: { start, known (the checkout), located, kind } or null when no checkout holds
// a slice of that name. `kind` is `default` (archived on the default branch), `active` or `archived` (archived on its own branch).
function findSlice(start, slice, { env, gh }) {
  const known = knownChange(start, slice);
  if (!known) return null;
  const located = locateChange(known.root, slice);
  if (!located) return null;
  const sliceDir = isSliceDir(located.dir) || (!located.archived && !existsSync(join(located.dir, '.openspec.yaml')) && known.branch === slice);
  if (!sliceDir) return null;
  if (located.archived && archivedOnDefaultSet(start, { env, gh }).has(slice)) return { known, located, kind: 'default' };
  return { known, located, kind: located.archived ? 'archived' : 'active' };
}
const archivedOnDefaultSet = (start, opts) => new Set(archivedDates(start, opts).keys());

// The next action of slice `slice`, read from the files, git and GitHub of its checkout. Errors (an unknown slice, an unreadable
// setting, no openspec CLI) are thrown.
export function nextSlice(cwd, slice, { env = process.env, lang = 'pt-BR', after = null, openspec, gh } = {}) {
  const facts = readFacts(cwd, slice, { env, lang, after, openspec, gh });
  return decideSlice(facts);
}

function readFacts(cwd, slice, { env, lang, after, openspec, gh }) {
  const clean = cleanOf(env);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = findSlice(start, slice, { env: clean, gh });
  if (!found) throw new LoopRefusal('project-not-found', render(normalizeLang(lang), 'project-not-found', { id: slice }));
  const { known, located, kind } = found;
  const root = realpathSync(known.root);
  const settings = readDevkitSettings(root);
  const config = shipConfig(root, SCRIPT);
  const ghRun = gh ?? makeGh(root, clean);
  const base = defaultBase(mainRoot(start));
  const ctx = { slice, root, branch: known.branch, lang: normalizeLang(lang), filesLanguage: filesLanguageOf(settings), base, ship: config.ship, method: config.mergeMethod };
  const roadmapState = (dir) => readRecord(join(dir, 'roadmap.md'))?.result;
  const noRounds = roadmapState(located.dir) === 'not-applicable';
  const common = { ctx, after, noRounds, kind, flow: null, fingerprint: '' };
  if (kind === 'default') return common;

  const head = headOf(root);
  if (kind === 'active' && !existsSync(join(located.dir, '.openspec.yaml'))) return { ...common, notOpened: true, flow: readFlow(root, SCRIPT), fingerprint: fingerprint(root, head) };
  const run = openspec ?? makeOpenspec(root, clean);
  const { facts, flow } = collectFlow(root, slice, { env: clean, openspec: run, gh: ghRun });
  const fp = facts.fingerprint ?? fingerprint(root, head);
  if (kind === 'archived') {
    const verdict = readVerdict(join(located.dir, 'reviews', 'adr-reviewer.md'), root, head);
    let stale = null;
    if (verdict.usable) { try { stale = sliceReviewStale(root, verdict.full, slice, 'HEAD'); } catch { stale = 'the ADR review cannot be compared with the current commit'; } }
    let fetched;
    let setup;
    return {
      ...common, flow, fingerprint: fp,
      archived: {
        head, uncommitted: uncommittedPaths(root).length > 0, folder: located.dir, verdict, stale, reviewMd: readRecord(join(located.dir, 'review.md')),
        pr: () => (fetched ??= fetchPr(ghRun, { merge: true, branch: slice, list: true })),
        checks: (f) => checksItem(f, ghRun),
        mergeSetup: () => (setup ??= mergeSetup(ghRun, root, config.mergeMethod)),
      },
    };
  }
  // An active slice is always archived before its pull request, so the walk asks GitHub nothing.
  facts.delivery = () => ({ next: { stage: 'delivery', reasonCode: 'no-pr', params: {} } });
  const report = computeFlow(facts, flow, {});
  const block = roundsBlock(located.dir);
  const onRoadmap = new Set(roadmapIds(root));
  const ids = block.block ? parseRoadmap(block.block).flatMap((r) => r.items.map((i) => i.id)) : [];
  const docsDir = join(root, 'docs', 'design', slice);
  return {
    ...common, flow, fingerprint: fp, report, dirty: facts.dirty ?? [],
    docs: existsSync(docsDir) ? readdirSync(docsDir) : [],
    flat: existsSync(join(root, 'docs', 'design', '1-business-vision.md')),
    adrFolder: !existsSync(join(root, 'docs', 'adr')) && existsSync(join(root, 'docs', 'decisions')) ? 'docs/decisions' : 'docs/adr',
    nextRound: nextRoundOf(root),
    rounds: { passed: report.stages.find((s) => s.id === 'roadmap')?.state === 'passed', ids, missing: ids.filter((id) => !onRoadmap.has(id)) },
    verdict: readVerdict(join(located.dir, 'reviews', 'adr-reviewer.md'), root, head),
    reviewMd: readRecord(join(located.dir, 'review.md')),
  };
}

// ---------------------------------------------------------------- start and open (D-5)

// The slices unfinished in this project: an active folder on the project script in any checkout, and a worktree on branch `<slice>`
// holding the slice archived on its branch while its pull request is not merged. Each once, sorted by id.
export function unfinishedSlices(start, { env = process.env, gh } = {}) {
  const archived = archivedDates(start, { env, gh });
  const found = new Map();
  const note = (id, c, rank, isArchived) => { if (!archived.has(id) && (!found.has(id) || found.get(id).rank < rank)) found.set(id, { id, root: c.root, branch: c.branch, archived: isArchived, rank }); };
  for (const c of checkoutsOf(start)) {
    for (const id of activeIds(c.root)) if (isSliceDir(join(c.root, 'openspec', 'changes', id))) note(id, c, c.branch === id ? 2 : 1, false);
    const own = archivedSliceOf(c.root, c.branch);
    if (own) note(own.id, c, 3, true);
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, root, branch, archived: isArchived }) => ({ id, root, branch, archived: isArchived }));
}

// Is `devkit-design@devkit` enabled in the checkout's settings (.claude/settings.json or settings.local.json)?
function designPackEnabled(root) {
  for (const name of ['settings.json', 'settings.local.json']) {
    try {
      const settings = JSON.parse(readFileSync(join(root, '.claude', name), 'utf8'));
      if (settings?.enabledPlugins?.['devkit-design@devkit'] === true) return true;
    } catch { /* absent or not JSON: not enabled by this file */ }
  }
  return false;
}

// The schema an archived folder on the default branch names: from the main checkout, else the default branch's tree.
function archivedSchemaOnDefault(main, id, date) {
  const rel = `openspec/changes/archive/${date}-${id}/.openspec.yaml`;
  const base = defaultBase(main);
  const texts = [existsSync(join(main, rel)) ? readFileSync(join(main, rel), 'utf8') : '', tryGit(main, ['show', `refs/remotes/origin/${base}:${rel}`]), tryGit(main, ['show', `refs/heads/${base}:${rel}`])];
  for (const text of texts) { const m = /^schema:\s*["']?([\w.-]+)/m.exec(text); if (m) return m[1]; }
  return null;
}

// Is `docs/design/<slice>/` on the default branch? The remote branch's tree when it resolves, else the main checkout.
function designFolderOnDefault(main, slice) {
  const base = defaultBase(main);
  if (tryGit(main, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${base}`])) return tryGit(main, ['ls-tree', '--name-only', `origin/${base}`, `docs/design/${slice}`]) !== '';
  return existsSync(join(main, 'docs', 'design', slice));
}

// Where an unfinished slice stopped, in one phrase of the person's language.
function whereOfSlice(u, read) {
  if (u.archived) return render(read.lang, 'where.slice-archived');
  try { return whereOf(u, u.id, read); } catch (e) { if (!(e instanceof LoopUsageError)) throw e; return null; }
}

// What `/devkit project` does with the words after `project`: { version, mode, verb, text, slice, unfinished, settings, reply }.
// Read-only: it creates and runs nothing.
export function startProject(cwd, text, { lang = 'pt-BR', env = process.env, openspec, gh } = {}) {
  const l = normalizeLang(lang);
  const words = String(text ?? '').trim();
  const start = findRoot(cwd);
  const settings = start ? readDevkitSettings(start) : { driver: 'claude', language: 'en', unknown: [] };
  const out = (mode, extra = {}) => ({
    version: 1, mode, verb: 'project', text: words, slice: null, unfinished: [],
    settings: { driver: settings.driver, filesLanguage: filesLanguageOf(settings), personLanguage: l }, ...extra,
  });
  const say = (key, params = {}) => render(l, key, params);
  const gate = projectGate(start, settings);
  if (gate) return out(gate.mode, { reply: say(gate.key, gate.params) });
  if (!designPackEnabled(start)) return out('design-pack-missing', { reply: say('design-pack-missing') });

  const read = { lang: l, env, openspec, gh };
  const list = unfinishedSlices(start, { env, gh }).map((u) => ({ id: u.id, root: u.root, branch: u.branch, where: whereOfSlice(u, read) }));
  const resume = (u) => out('resume', { slice: u.id, unfinished: list, reply: say('project-resumed', { id: u.id, where: u.where ?? whereOfSlice({ ...u, archived: false }, read) }) });
  if (words === '') {
    if (list.length === 1) return resume(list[0]);
    if (list.length > 1) return out('choose', { unfinished: list, reply: say('project-choose', { n: list.length, list: list.map((u) => (u.where ? `${u.id} (${u.where})` : u.id)).join('; ') }) });
    return out('project-name-needed', { reply: say('project-name-needed') });
  }
  if (!NAME.test(words) || words === 'archive') return out('name-invalid', { reply: say('name-invalid', { id: words }) });
  const unfinishedOne = list.find((u) => u.id === words);
  if (unfinishedOne) return resume(unfinishedOne);
  const main = mainRoot(start);
  const dates = archivedDates(start, { env, gh });
  if (dates.has(words)) {
    if (archivedSchemaOnDefault(main, words, dates.get(words)) === SCRIPT) return out('project-done-already', { slice: words, reply: say('project-done-already', { id: words }) });
    return out('is-change', { reply: say('is-change', { id: words }) });
  }
  if (knownChange(start, words)) return out('is-change', { reply: say('is-change', { id: words }) });
  if (designFolderOnDefault(main, words)) return out('project-folder-exists', { reply: say('project-folder-exists', { id: words }) });
  return out('new');
}

// `open <slice>`: the worktree, the branch and the change on the project script; refusals are LoopRefusal (exit 3, nothing created).
export function openSlice(cwd, id, { lang = 'pt-BR', env = process.env, openspec } = {}) {
  const l = normalizeLang(lang);
  const refuse = (key, params = {}) => new LoopRefusal(key, render(l, key, params));
  if (!NAME.test(id) || id === 'archive') throw refuse('name-invalid', { id });
  const start = findRoot(cwd);
  const settings = start ? readDevkitSettings(start) : { driver: 'claude', language: 'en', unknown: [] };
  const gate = projectGate(start, settings);
  if (gate) throw refuse(gate.key, gate.params);
  const { worktree, base } = openCheckout(cwd, id, { script: SCRIPT, lang: l, env, openspec });
  return { version: 1, slice: id, worktree, branch: id, base, reply: render(l, 'project-opened', { id }) };
}

// ---------------------------------------------------------------- the roadmap stage (D-7)

// The problems of the rounds block (an empty list is a block that can go on the roadmap), and its ids with their `after:`.
function checkRounds(block, { onRoadmap, archived }) {
  const problems = [];
  const items = [];
  const seen = new Set();
  let rounds = 0;
  let open = null; // { title, count } of the round being read
  const closeRound = () => { if (open && open.count === 0) problems.push(`${open.title} holds no change`); };
  for (const line of block.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    if (/^##\s/.test(line)) {
      closeRound();
      if (!/^##\s+Round\s+\d+\s*:\s*\S/.test(line)) { problems.push(`${line.trim()} is not a round heading (## Round <n>: <title>)`); open = null; continue; }
      rounds += 1;
      open = { title: line.replace(/^##\s+/, '').trim(), count: 0 };
      continue;
    }
    const m = ITEM.exec(line);
    if (m) {
      const [, tick, id, afterText] = m;
      const after = (afterText ?? '').split(',').map((d) => d.trim()).filter(Boolean);
      if (!open) problems.push(`${id} is outside any round`);
      else open.count += 1;
      if (tick !== ' ') problems.push(`${id} is ticked: a new change starts unticked`);
      if (!NAME.test(id)) problems.push(`${id} is not a valid change name (lowercase letters, digits and dashes)`);
      if (seen.has(id)) problems.push(`${id} appears twice in the block`);
      if (onRoadmap.has(id)) problems.push(`${id} is already on the roadmap`);
      for (const d of after) {
        if (!seen.has(d) && !onRoadmap.has(d) && !archived.has(d)) problems.push(`${id} comes after ${d}, which is not above it in the block, not on the roadmap and not archived`);
      }
      seen.add(id);
      items.push({ id, after });
      continue;
    }
    if (/^( {2,}|\t)\S/.test(line) && items.length) continue; // the note of the last change
    problems.push(`text outside rounds: ${line.trim()}`);
  }
  closeRound();
  if (rounds === 0) problems.push('the block holds no round');
  else if (items.length === 0 && !problems.some((p) => /no change/.test(p))) problems.push('the block holds no change');
  return { problems, items };
}

// `rounds <slice> [--write]`: { code, body }.
export function roundsCommand(cwd, slice, { write = false, lang = 'pt-BR', env = process.env, gh } = {}) {
  const l = normalizeLang(lang);
  const clean = cleanOf(env);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = findSlice(start, slice, { env: clean, gh });
  if (!found || found.kind !== 'active') throw new LoopRefusal('project-not-found', render(l, 'project-not-found', { id: slice }));
  const root = realpathSync(found.known.root);
  const { record, block } = roundsBlock(found.located.dir);
  if (!record || record.malformed || record.result === 'not-applicable' || block === null) {
    throw new LoopRefusal('rounds-missing', render(l, 'rounds-missing', { id: slice }));
  }
  const reply = (code, result, key, params = {}, more = {}) => ({ code, body: { version: 1, slice, result, ...more, reply: render(l, key, { id: slice, ...params }) } });
  const text = block.trim();
  const file = roadmapFile(root);
  const original = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const onRoadmap = new Set(roadmapIds(root));
  const ids = parseRoadmap(text).flatMap((r) => r.items.map((i) => i.id));
  if (ids.length > 0 && ids.every((id) => onRoadmap.has(id)) && original !== null && original.trimEnd().endsWith(text)) {
    return reply(0, 'rounds-already', 'rounds-already', {}, { ids });
  }
  const archived = archivedOnDefaultSet(start, { env: clean, gh });
  const { problems, items } = checkRounds(text, { onRoadmap, archived });
  if (problems.length) return reply(2, 'rounds-invalid', 'rounds-invalid', { list: problems.join('; ') }, { problems });
  const list = items.map((i) => (i.after.length ? `${i.id} (after: ${i.after.join(', ')})` : i.id)).join(', ');
  const outcome = reply(0, 'rounds-ok', 'rounds-ok', { list }, { ids: items.map((i) => i.id) });
  if (!write) return outcome;
  if (record.result !== 'passed') return reply(2, 'rounds-not-approved', 'rounds-not-approved');
  const appended = original === null ? `# Roadmap\n\n${text}\n` : `${original}${original.endsWith('\n') ? '' : '\n'}\n${text}\n`;
  writeFileSync(file, appended);
  return outcome;
}

// ---------------------------------------------------------------- the ADR review and the archive (D-8, D-9)

// `record-review <slice>`: writes review.md from the verdict file; { code, body }.
export function recordReviewCommand(cwd, slice, { lang = 'pt-BR', env = process.env, gh } = {}) {
  const l = normalizeLang(lang);
  const clean = cleanOf(env);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = findSlice(start, slice, { env: clean, gh });
  if (!found || found.kind === 'default') throw new LoopRefusal('project-not-found', render(l, 'project-not-found', { id: slice }));
  const root = realpathSync(found.known.root);
  const dir = found.located.dir;
  const verdictFile = join(dir, 'reviews', 'adr-reviewer.md');
  const v = readVerdict(verdictFile, root, headOf(root));
  const unusable = (why) => ({ code: 2, body: { version: 1, slice, result: 'verdict-unusable', reply: render(l, 'verdict-unusable', { id: slice, why }) } });
  if (!v.exists) return unusable('no-verdict-file');
  if (!v.word) return unusable('no-verdict');
  if (!v.sha) return unusable('no-commit');
  if (v.uncommitted) return unusable('uncommitted');
  if (!v.isHead) return unusable('other-commit');
  const result = v.word === 'APPROVED' || v.word === 'DECLINED' ? 'passed' : 'failed';
  const attempt = (readRecord(join(dir, 'review.md'))?.attempt ?? 0) + 1;
  const rel = verdictFile.slice(root.length + 1);
  writeFileSync(join(dir, 'review.md'), `<!-- devkit-stage review result=${result} attempt=${attempt} commit=${v.sha} -->\n# ADR review: ${slice}\n\n## Verdict\n- Verdict: ${v.word}\n- File: ${rel}\n`);
  return { code: 0, body: { version: 1, slice, result, verdict: v.word, attempt, commit: v.sha } };
}

// `archive <slice>`: archives the slice when every stage from the business to the ADR review is settled; { code, body }.
export function archiveCommand(cwd, slice, { lang = 'pt-BR', env = process.env, openspec, gh } = {}) {
  const l = normalizeLang(lang);
  const clean = cleanOf(env);
  const start = findRoot(cwd);
  if (!start) throw new LoopUsageError(`no openspec/ folder found from ${cwd}`);
  const found = findSlice(start, slice, { env: clean, gh });
  if (!found || found.kind !== 'active') throw new LoopRefusal('project-not-found', render(l, 'project-not-found', { id: slice }));
  const root = realpathSync(found.known.root);
  const run = openspec ?? makeOpenspec(root, clean);
  const { facts, flow } = collectFlow(root, slice, { env: clean, openspec: run, gh: gh ?? makeGh(root, clean) });
  facts.delivery = () => ({ next: { stage: 'delivery', reasonCode: 'no-pr', params: {} } });
  const report = computeFlow(facts, flow, {});
  const open = report.stages.filter((s) => [...SETTLED_STAGES, 'review'].includes(s.id) && s.state !== 'passed' && s.state !== 'not-applicable');
  if (open.length) {
    const list = open.map((s) => stagePhrase(l, flow.stages.find((x) => x.id === s.id).title[l])).join(', ');
    return { code: 2, body: { version: 1, slice, result: 'archive-refused', reply: render(l, 'blocked', { id: slice, why: 'archive-refused', list }) } };
  }
  const done = run(['archive', slice, '--yes']);
  if (done.status !== 0) throw new LoopUsageError(`openspec archive failed: ${(done.stderr || done.stdout).trim()}`);
  const archiveDir = join(root, 'openspec', 'changes', 'archive');
  const landed = existsSync(archiveDir) && readdirSync(archiveDir).some((n) => n.replace(/^\d{4}-\d{2}-\d{2}-/, '') === slice);
  if (!landed || existsSync(join(root, 'openspec', 'changes', slice))) throw new LoopUsageError(`openspec archive did not move ${slice}`);
  return { code: 0, body: { version: 1, slice, result: 'archived', reply: render(l, 'archived-slice', { id: slice }) } };
}

// ---------------------------------------------------------------- the readout (D-10)

// The text of `status <slice>`.
export function statusText(cwd, slice, { lang = 'pt-BR', env = process.env, openspec, gh } = {}) {
  const l = normalizeLang(lang);
  const facts = readFacts(cwd, slice, { env, lang: l, after: null, openspec, gh });
  const say = (key, params = {}) => render(l, key, params);
  const flow = facts.flow ?? readStatusFlow(cwd);
  const lines = [say('slice-title', { id: slice })];
  const names = Object.fromEntries((flow?.stages ?? []).map((s) => [s.id, inSentence(s.title.en)]));
  const states = SETTLED_STAGES.map((id) => {
    if (facts.kind === 'active') return facts.report.stages.find((s) => s.id === id);
    const header = readRecord(join(facts.kind === 'archived' ? facts.archived.folder : archivedFolderOf(cwd, slice), `${id}.md`));
    return { id, state: header?.result === 'passed' || header?.result === 'not-applicable' ? header.result : 'pending', reasonCode: 'no-file', params: { file: `${id}.md` } };
  });
  let ready = false;
  for (const entry of states) {
    const title = flow?.stages.find((s) => s.id === entry.id)?.title[l] ?? entry.id;
    if (entry.state === 'passed') lines.push(`${title}: ${say('slice-passed')}`);
    else if (entry.state === 'not-applicable') lines.push(`${title}: ${say('slice-na')}`);
    else if (!ready) { ready = true; lines.push(`${title}: ${say('slice-ready')} (${reasonText(l, entry.reasonCode, entry.params, names)})`); } else lines.push(`${title}: ${say('slice-blocked')}`);
  }
  if (!ready) lines.push(afterFive(facts, { say, cwd, slice, lang: l, env, openspec, gh }));
  return `${lines.join('\n')}\n`;
}

const archivedFolderOf = (cwd, slice) => {
  const start = findRoot(cwd);
  const known = start ? knownChange(start, slice) : null;
  return known ? (locateChange(known.root, slice)?.dir ?? '') : '';
};
const readStatusFlow = (cwd) => {
  const start = findRoot(cwd);
  try { return JSON.parse(readFileSync(join(start, 'openspec', 'schemas', SCRIPT, 'flow.json'), 'utf8')); } catch { return null; }
};

// The one line after the five stages: the ADR review next, the pull request, or delivered.
function afterFive(facts, { say, cwd, slice, lang, env, openspec, gh }) {
  if (facts.kind === 'default') return say('slice-delivered');
  if (facts.kind === 'active') return facts.report.stages.find((s) => s.id === 'review')?.state === 'passed' ? say('slice-next-pr') : say('slice-next-review');
  const action = nextSlice(cwd, slice, { env, lang, openspec, gh });
  if (action.kind === 'end' && action.end.state === 'delivered') return say('slice-delivered');
  const fetched = facts.ctx.ship === 'plan' ? { none: true } : facts.archived.pr();
  if (!fetched.pr) return say('slice-next-pr');
  const state = action.kind === 'end' && action.end.state === 'waiting-on-github' ? 'github' : action.kind === 'end' && action.end.state === 'blocked' ? 'blocked' : 'owner';
  return say('slice-pr', { number: fetched.pr.number, state });
}

// ---------------------------------------------------------------- the command line (D-5)

const USAGE = 'usage: project-loop.mjs start --lang <l> (the words after project on standard input) | open <slice> --lang <l> | next --slice <slice> --lang <l> [--after <progress-key>] '
  + '| status <slice> --lang <l> | rounds <slice> --lang <l> [--write] | record-review <slice> --lang <l> | archive <slice> --lang <l> | wait --slice <slice> --lang <l> [--interval <seconds>]';

function parseArgs(argv, { values = [], flags = [] } = {}) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (values.includes(a)) {
      const v = argv[++i];
      if (v === undefined) throw new LoopUsageError(`${a} needs a value; ${USAGE}`);
      opts[a.slice(2)] = v;
    } else if (flags.includes(a)) opts[a.slice(2)] = true;
    else if (a.startsWith('--')) throw new LoopUsageError(`unknown option ${a}; ${USAGE}`);
    else opts.positional.push(a);
  }
  return opts;
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const one = (opts) => { if (opts.positional.length !== 1) throw new LoopUsageError(USAGE); return opts.positional[0]; };

// Runs the command: { code, stdout, stderr }. 3 for a usage or preflight error, with `{ version: 1, error, reply }`.
// `wait` sleeps, so it runs through `runCommand`.
export function main(argv, { env = process.env, cwd = process.cwd(), openspec, gh, stdin = '' } = {}) {
  try {
    const [sub, ...rest] = argv;
    if (sub === 'start') {
      const opts = parseArgs(rest, { values: ['--lang'] });
      if (opts.positional.length) throw new LoopUsageError(USAGE);
      return { code: 0, stdout: json(startProject(cwd, stdin, { lang: opts.lang, env, openspec, gh })), stderr: '' };
    }
    if (sub === 'open') {
      const opts = parseArgs(rest, { values: ['--lang'] });
      return { code: 0, stdout: json(openSlice(cwd, one(opts), { lang: opts.lang, env, openspec })), stderr: '' };
    }
    if (sub === 'next') {
      const opts = parseArgs(rest, { values: ['--slice', '--lang', '--after'] });
      if (!opts.slice || opts.positional.length) throw new LoopUsageError(USAGE);
      const action = nextSlice(cwd, opts.slice, { env, lang: opts.lang, after: opts.after ?? null, openspec, gh });
      return { code: exitCodeOf(action), stdout: json(action), stderr: '' };
    }
    if (sub === 'status') {
      const opts = parseArgs(rest, { values: ['--lang'] });
      return { code: 0, stdout: statusText(cwd, one(opts), { lang: opts.lang, env, openspec, gh }), stderr: '' };
    }
    if (sub === 'rounds') {
      const opts = parseArgs(rest, { values: ['--lang'], flags: ['--write'] });
      const { code, body } = roundsCommand(cwd, one(opts), { write: Boolean(opts.write), lang: opts.lang, env, gh });
      return { code, stdout: json(body), stderr: '' };
    }
    if (sub === 'record-review') {
      const opts = parseArgs(rest, { values: ['--lang'] });
      const { code, body } = recordReviewCommand(cwd, one(opts), { lang: opts.lang, env, gh });
      return { code, stdout: json(body), stderr: '' };
    }
    if (sub === 'archive') {
      const opts = parseArgs(rest, { values: ['--lang'] });
      const { code, body } = archiveCommand(cwd, one(opts), { lang: opts.lang, env, openspec, gh });
      return { code, stdout: json(body), stderr: '' };
    }
    throw new LoopUsageError(USAGE);
  } catch (e) {
    return failure(argv, e);
  }
}

// The usage-error form of every subcommand: exit 3 with `{ version: 1, error, reply }`, nothing created or run.
function failure(argv, e) {
  const message = e instanceof Error ? e.message : String(e);
  const lang = argv.indexOf('--lang') === -1 ? undefined : argv[argv.indexOf('--lang') + 1];
  const reply = e instanceof LoopRefusal ? e.reply : render(lang, 'project-unreadable'); // the raw message stays in `error`, never shown
  return { code: 3, stdout: `${JSON.stringify({ version: 1, error: message, reply })}\n`, stderr: `project-loop: ${message}\n` };
}

const MIN_INTERVAL = 5;
const DEFAULT_INTERVAL = 60;
const realSleep = (seconds) => new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });

async function runWait(args, { env, cwd, openspec, gh, sleep = realSleep }) {
  const opts = parseArgs(args, { values: ['--slice', '--lang', '--interval'] });
  if (!opts.slice || opts.positional.length) throw new LoopUsageError(USAGE);
  const interval = opts.interval === undefined ? DEFAULT_INTERVAL : Number(opts.interval);
  if (!Number.isFinite(interval) || interval < MIN_INTERVAL) throw new LoopUsageError(`--interval needs a number of seconds, at least ${MIN_INTERVAL}`);
  const lang = normalizeLang(opts.lang);
  const poll = async () => nextSlice(cwd, opts.slice, { env, lang, openspec, gh });
  const action = await waitLoop({ poll, sleep, interval, id: opts.slice, lang });
  return { code: exitCodeOf(action), stdout: json(action), stderr: '' };
}

// `main`, and `wait` too: the one entry point of the command line.
export async function runCommand(argv, opts = {}) {
  if (argv[0] !== 'wait') return main(argv, opts);
  try {
    return await runWait(argv.slice(1), { env: opts.env ?? process.env, cwd: opts.cwd ?? process.cwd(), openspec: opts.openspec, gh: opts.gh, sleep: opts.sleep });
  } catch (e) {
    return failure(argv, e);
  }
}

function isMain() {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}

if (isMain()) {
  const argv = process.argv.slice(2);
  runCommand(argv, { stdin: argv[0] === 'start' ? readStdin() : '' }).then((r) => {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exitCode = r.code;
  });
}

