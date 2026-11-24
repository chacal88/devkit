// What the three parts of change-loop.test.mjs share (suite-speed D-11): paths, builders and helpers more than one part uses. No test lives here and nothing is made when the module is
// imported: a folder, a spawn or a git call happens only when one of its functions runs. A test file never imports another test file; what two test files share is moved to a module like this one.
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpFolder } from './test-tmp.mjs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  gitRepo, put, commitAll, git, sandbox, roundRepo, SET_LOOP as SET, cleanEnvLoop as cleanEnv, FLOWS, stageOf, nextOf, rowOf, run, PLAN_FILES, head,
  planChange, actionOf, stored, typedLine, runLine, assistantLine, transcriptOf, stopInput,
} from './test-fixtures.mjs';
import * as guardModule from './guard.mjs';
import { render, exitCodeOf, main, waitLoop } from './change-loop.mjs';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const LOOP = join(HERE, 'change-loop.mjs');

export const TDD = 'devkit-core:tdd-implementer';
export const COMMIT = 'devkit-core:commit-and-pr';
export const PLANNER = 'devkit-core:change-planner';

export const read = (f) => readFileSync(join(HERE, f), 'utf8');

export function configRepo(text) {
  const root = tmpFolder('devkit-change-loop-cfg-');
  mkdirSync(join(root, 'openspec'), { recursive: true });
  if (text !== null) writeFileSync(join(root, 'openspec', 'config.yaml'), text);
  return root;
}

export const shape = (a) => [a.kind, a.agent ?? a.step ?? a.end?.state, a.end?.why ?? null, exitCodeOf(a)];
export const says = (key, params = {}, lang = 'en') => render(lang, key, { id: 'feat', ...params });

// The current stage of a build-to-archive decision: the flow-check report only has to be in a build part.
export const buildRep = (over = {}) => ({ next: nextOf(FLOWS.devkit, 'delivery', 'not-pushed', { number: 12 }), ...over });
export const build = (row, facts = {}, ctx = {}) => run({ rep: buildRep(), facts: { row, ...facts }, ctx });

export const next = (cwd, extra = [], env = cleanEnv, opts = {}) => main(['next', '--change', 'feat', '--lang', 'en', ...extra], { cwd, env, ...opts });
export const parsed = (r) => ({ first: r.stdout.split('\n')[0], action: actionOf(r.stdout) });

export const PROPOSAL = '# Proposal\n\n## Why\n\nx\n\n## Acceptance criteria\n\n- AC-1: a thing\n';
export const PR_BODY = (id) => `${id}\n- AC-1\nopenspec/changes/${id}/evidence.md\n`;
export const prJson = (id, over = {}) => ({
  number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: '', baseRefName: 'main', mergeable: 'MERGEABLE',
  body: PR_BODY(id), autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over,
});
export const check = (name, bucket) => ({ name, state: bucket.toUpperCase(), bucket, link: `https://ci/${name}` });
export const NO_TALK = { data: { viewer: { login: 'me' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } };
export const PR_CONFIG = 'schema: devkit-lite\nship:\n  devkit-lite: pr\n  devkit: pr\n';
export const RELEASE = { 'CHANGELOG.md': '# c\n', '.claude-plugin/marketplace.json': '{"v":1}\n', 'README.md': 'r\n' };

// A `devkit-lite` change `id` (`feat`) in a worktree (a bare origin, a clone, or the `roundRepo` `t` a caller passes), every
// stage up to the code review passed at the code commit, the reviews and the evidence current, its pull request open with
// `checks`. `conflicts` are the files both the branch and origin/main edit (the same shape as conflictRepo in
// conduct-check.test.mjs, which is private to that file). `config` and `files` are the project's settings and files; `files` are
// added to the main checkout before the worktree, over the release files (the canonical specs a delta modifies); `delta` is the text
// of the change's `specs/s/spec.md` and of its proposal (post-merge-validate D-9). Both default to the text every earlier caller builds.
export function deliveredChange({
  checks = [check('build', 'pending')], conflicts = [], mergeable = 'MERGEABLE', requirements = '# Requirements\n',
  config = PR_CONFIG, files = {}, delta = {}, id = 'feat', t = null, roadmap = `# Roadmap\n\n## Round 1: x\n- [ ] ${id}\n`,
} = {}) {
  const { spec = '# Spec\n', proposal = PROPOSAL } = delta;
  t ??= roundRepo({ roadmap, config, files: { ...RELEASE, ...files } });
  const wt = t.addWt(id);
  const dir = (f) => `openspec/changes/${id}/${f}`;
  const own = Object.fromEntries(conflicts.map((f) => [f, `${id} edits ${f}\n`]));
  put(wt, {
    [dir('.openspec.yaml')]: 'schema: devkit-lite\n',
    [dir('proposal.md')]: proposal, [dir('requirements.md')]: requirements, [dir('specs/s/spec.md')]: spec,
    [dir('tasks.md')]: '# Tasks\n\n## 1. First\n- [x] 1.1 code\n',
    [`src/${id}.ts`]: 'code\n', ...own,
  });
  const sha = commitAll(wt, 'code');
  const review = `Verdict: approved\nCommit: ${sha}\n\n# Review\n`;
  const withHead = (stage, body) => `${head(stage, sha)}${body}`;
  put(wt, {
    [dir('reviews/code-quality-reviewer.md')]: review, [dir('reviews/test-coverage-reviewer.md')]: review,
    [dir('evidence.md')]: withHead('evidence', `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n`),
    [dir('review.md')]: withHead('review', 'Consensus: PASS (round 1/2)\n\n# Review\n'),
    [dir('proposal.md')]: withHead('proposal', proposal), [dir('requirements.md')]: withHead('requirements', requirements),
    [dir('specs/s/spec.md')]: withHead('specs', spec), [dir('tasks.md')]: withHead('tasks', '# Tasks\n\n## 1. First\n- [x] 1.1 code\n'),
  });
  commitAll(wt, 'reviews, evidence and stage headers');
  if (conflicts.length) t.commitOrigin(Object.fromEntries(conflicts.map((f) => [f, `origin edits ${f}\n`])), 'origin edits');
  const gh = t.ghAt(wt);
  gh.set('pr-view', { stdout: prJson(id, { headRefOid: git(wt, 'rev-parse', 'HEAD'), mergeable }) });
  gh.set('pr-checks', { stdout: checks });
  gh.set('api-graphql', { stdout: NO_TALK });
  return { t, wt, gh, env: { ...gh.env, ...SET } };
}

// A folder holding a `git` that logs every call with a `fetch` argument in $GIT_SHIM_LOG, sleeps for $GIT_SHIM_SLEEP seconds
// in its place when that is set, and runs the real git for every other call. `env(base, { sleep })` puts it first on the PATH.
export function gitShim() {
  const dir = tmpFolder('devkit-git-shim-');
  const log = join(dir, 'fetches.log');
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const real = spawnSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  writeFileSync(join(bin, 'git'), [
    '#!/bin/sh',
    'for a in "$@"; do',
    '  if [ "$a" = fetch ]; then',
    '    [ -n "$GIT_SHIM_LOG" ] && printf \'%s\\n\' "$*" >> "$GIT_SHIM_LOG"',
    '    if [ -n "$GIT_SHIM_SLEEP" ]; then exec sleep "$GIT_SHIM_SLEEP"; fi',
    '    break',
    '  fi',
    'done',
    `exec '${real}' "$@"`,
    '',
  ].join('\n'));
  chmodSync(join(bin, 'git'), 0o755);
  writeFileSync(log, '');
  return {
    env: (base, { sleep } = {}) => ({ ...base, PATH: `${bin}:${base.PATH}`, GIT_SHIM_LOG: log, GIT_SHIM_SLEEP: sleep === undefined ? '' : String(sleep) }),
    fetches: () => readFileSync(log, 'utf8').split('\n').filter(Boolean),
    clear: () => writeFileSync(log, ''),
  };
}

// After the fixture's `commitOrigin`, the clone's `origin/main` is put one commit behind the remote's `main`
// (`commitOrigin` pushes from the clone, which moves its `origin/main` with it): { remote, stale } are the two shas.
export function staleBase(t) {
  const remote = git(t.originDir, 'rev-parse', 'main');
  const stale = git(t.originDir, 'rev-parse', `${remote}^`);
  git(t.main, 'update-ref', 'refs/remotes/origin/main', stale);
  return { remote, stale };
}

// A `devkit-lite` change `id` in a worktree of `t`, at the implementation stage (the build part): requirements, proposal, specs
// and tasks passed at the commit it was cut from, the one task not ticked, committed.
export function implementingChange(t, id) {
  const wt = t.addWt(id);
  const c0 = git(wt, 'rev-parse', 'HEAD');
  const dir = (f) => `openspec/changes/${id}/${f}`;
  put(wt, {
    [dir('.openspec.yaml')]: 'schema: devkit-lite\n',
    [dir('requirements.md')]: `${head('requirements', c0)}# Requirements\n`,
    [dir('proposal.md')]: `${head('proposal', c0)}${PROPOSAL}`,
    [dir('specs/s/spec.md')]: `${head('specs', c0)}# Spec\n`,
    [dir('tasks.md')]: `${head('tasks', c0)}# Tasks\n\n## 1. First\n- [ ] 1.1 code\n`,
  });
  commitAll(wt, 'plan');
  return wt;
}

// post-merge-validate: the merge sha, the validate errors, a merge-check record and the `mergeCheck` facts that `decide` reads, shared by
// the loop's decision tests and the change-state test of the blocked reasons (T-7 to T-15).
export const PMV_SHA = 'abcdef0123'.repeat(4);
export const PMV_ERRORS = '- ERROR specs/cap/spec.md: MODIFIED "Thing works" omits scenario(s) the current spec still has: "Second added on main"';
// The record of a check of the merge PMV_SHA with the fingerprint `decide`'s facts carry in `run` (abc123).
export const pmvRec = (over = {}) => ({
  version: 1, change: 'feat', merge: PMV_SHA, result: 'red', reds: 1, fingerprint: 'abc123', errors: PMV_ERRORS, error: null, at: '2026-11-23T10:00:00.000Z', ...over,
});
export const pmvFacts = (record = null, over = {}) => ({ mergeCheck: { base: 'main', merge: PMV_SHA, record }, ...over });

export const startRun = (cwd, text, { lang = 'en', args = [], env = cleanEnv } = {}) => main(['start', '--lang', lang, ...args], { cwd, env, stdin: text });
export const body = (r) => JSON.parse(r.stdout);
export const titleEn = (stage, flow = FLOWS.devkit) => stageOf(flow, stage).title.en;
export const whereNext = (stage) => render('en', 'where.next', { stage: titleEn(stage) });

// What a command that "creates nothing" must leave as it was: the branches, the worktrees and the change folders.
export function snapshot(root) {
  const changes = join(root, 'openspec', 'changes');
  return JSON.stringify({
    branches: git(root, 'branch', '--list', '--all'),
    worktrees: git(root, 'worktree', 'list', '--porcelain'),
    folders: existsSync(changes) ? readdirSync(changes).sort() : [],
    wtDir: existsSync(join(root, '.claude', 'worktrees')) ? readdirSync(join(root, '.claude', 'worktrees')).sort() : [],
  });
}

// A committed change `id` of the plan stages in `have`, written as passed, in a checkout (no GitHub involved). With `flow` it records
// `x-devkit-flow: <flow>`, as a change opened with that flow does (the tests of D-13 T-23 to T-25 give 2, the installed version); with none it
// follows flow 1.
export function addChange(root, id, have = ['requirements', 'decisions'], { commit = true, flow = null } = {}) {
  const c0 = git(root, 'rev-parse', 'HEAD');
  const files = { '.openspec.yaml': `schema: devkit\n${flow === null ? '' : `x-devkit-flow: ${flow}\n`}` };
  for (const stage of have) files[PLAN_FILES[stage]] = `${head(stage, c0)}# ${stage}\n`;
  put(root, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/${id}/${f}`, b])));
  if (commit) commitAll(root, `change ${id}`);
}
export const devkitRepo = (config = 'schema: devkit\n') => gitRepo({ config });

export const openRun = (cwd, id, { script = 'devkit', why = 'doubt', request = 'Add a CSV export\nwith two lines\n', lang = 'en', env = cleanEnv, args } = {}) => (
  main(['open', id, ...(args ?? ['--script', script, '--why', why]), '--lang', lang], { cwd, env, stdin: request }));
export const freshProject = (config = 'schema: devkit\n') => roundRepo({ roadmap: '# Roadmap\n', config });
export const wtOf = (t, id) => join(t.main, '.claude', 'worktrees', id);

export const WAIT = build(rowOf('wait-checks', { pending: ['build'] }));

// waitLoop over a scripted sequence of decisions (an Error is a poll that throws), with a sleep that only counts.
export async function waited(items, { interval = 60 } = {}) {
  const sleeps = [];
  let polls = 0;
  const poll = async () => {
    if (polls >= items.length) throw new Error('polled past the script');
    const item = items[polls++];
    if (item instanceof Error) throw item;
    return item;
  };
  const action = await waitLoop({ poll, sleep: async (s) => { sleeps.push(s); }, interval, id: 'feat', lang: 'en' });
  return { action, sleeps, polls };
}

export const GUARD = join(HERE, 'guard.mjs');
export const runOf = (input) => guardModule.runOf(input);

// The first line of a plain typed message (the panel's own form).
export const plainLine = (text) => stored({ type: 'user', message: { role: 'user', content: text } });
// The skill body that follows the typed command: type user, isMeta, a list holding one text block.
export const skillBodyLine = (args) => stored({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text: `Base directory for this skill: /plugin/skills/devkit\n\nRun the loop. A line devkit-run: some-id is printed by it.\n\nARGUMENTS: ${args}` }] } });
export const runTranscript = (id = 'feat', args = 'change add the feature') => transcriptOf([typedLine(args), skillBodyLine(args), assistantLine(), runLine(id)]);

export function hook(mode, input, env = {}) {
  const r = spawnSync(process.execPath, [GUARD, mode], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...SET, ...env } });
  return { code: r.status, err: r.stderr, out: r.stdout };
}
export const subInput = (root, transcript, role, extra = {}) => stopInput(root, transcript, { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001', agent_transcript_path: join(sandbox(), 'agent.jsonl'), ...extra });
export const PLAN_UP_TO_TASKS = ['requirements', 'proposal', 'specs', 'design', 'tasks'];

export const editInput = (root, file, transcript, role) => ({
  cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, file) }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});
export const bashInput = (root, command, transcript, role) => ({
  cwd: root, tool_name: 'Bash', tool_input: { command }, transcript_path: transcript,
  ...(role ? { agent_type: `devkit-core:${role}`, agent_id: 'agent-0001' } : {}),
});
export const liteChange = () => gitRepo({ config: 'schema: devkit-lite\n', changes: { feat: { '.openspec.yaml': 'schema: devkit-lite\n' } } });
export const approvedChange = () => planChange({ have: [...PLAN_UP_TO_TASKS, 'readiness'] });

export const agentInput = (root, transcript, subagentType, extra = {}) => ({
  cwd: root, tool_name: 'Agent', tool_input: { subagent_type: subagentType, prompt: 'do it' }, transcript_path: transcript, ...extra,
});

export const REPO_ROOT = join(HERE, '..', '..', '..');
export const readRepo = (...p) => readFileSync(join(REPO_ROOT, ...p), 'utf8');

export const SKILL_FILE = join(REPO_ROOT, 'plugins', 'openspec', 'skills', 'devkit', 'SKILL.md');
export const skillText = () => readFileSync(SKILL_FILE, 'utf8');
export const LANG_FLAG = '--lang ${user_config.language}';
export const section = (md, from, to) => {
  const a = md.indexOf(from);
  assert.ok(a >= 0, `section ${from}`);
  const b = to ? md.indexOf(to, a + from.length) : md.length;
  return md.slice(a, b < 0 ? md.length : b);
};

// The claim commits, so the tests carry an identity of their own, as deliver-check.test.mjs does for its helpers.
export const IDENT = { GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid', GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid' };

// ---- a change archived on the default branch (field-fixes 1; state-skips-unlocated): what the field-fixes tests and the state tests both use

// A gh that lists `names` as the archived folders of the default branch, or fails (`fail`), and nothing else.
export const archiveGh = (names, { fail = false } = {}) => (args) => (
  !fail && args[0] === 'api' && /contents\/openspec\/changes\/archive\?ref=/.test(args[1])
    ? { status: 0, stdout: JSON.stringify(names.map((name) => ({ name }))), stderr: '', missing: false, timedOut: false }
    : { status: 1, stdout: '', stderr: 'gh: not reachable', missing: false, timedOut: false });
export const archivedFolder = (date, id, flow = null) => ({ [`openspec/changes/archive/${date}-${id}/.openspec.yaml`]: `schema: devkit\n${flow === null ? '' : `x-devkit-flow: ${flow}\n`}` });

// The default branch on origin gains the archived folder of `id` while the main checkout stays where it was.
export function archiveOnOrigin(t, id) {
  const pusher = t.addWt('pusher');
  put(pusher, archivedFolder('2026-11-20', id));
  commitAll(pusher, `archive ${id}`);
  git(pusher, 'push', '-q', 'origin', 'HEAD:main');
  git(t.main, 'fetch', '-q', 'origin');
}

// An active folder whose `.openspec.yaml` records the day it was created, as `openspec new change` writes it.
export const withCreated = (wt, id, created) => put(wt, { [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\ncreated: ${created}\n` });
