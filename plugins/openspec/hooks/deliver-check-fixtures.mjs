// What the three parts of deliver-check.test.mjs share (suite-speed D-11, second round): paths, builders and helpers more than one part uses. No test lives here and nothing is made when the module is
// imported: a folder, a spawn or a git call happens only when one of its functions runs. A test file never imports another test file; what two test files share is moved to a module like this one.
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nextStep, collectState } from './deliver-check.mjs';
import { createHash } from 'node:crypto';
import { tmpFolder } from './test-tmp.mjs';
import {
  git, gitRepo, put, commitAll, proposalWith, fakeGh, tasksText, check, presetSetup, shipRepo, cli, ARCHIVE_LISTING, ACTIVE_ON_MAIN, ARCHIVE_PRS,
} from './test-fixtures.mjs';

export const here = dirname(fileURLToPath(import.meta.url));

export const review = (verdict, sha, extra = '') => `Verdict: ${verdict}\nCommit: ${sha}${extra}\n\n# Review\n`;
export const reviews = (sha, over = {}) => ({
  'code-quality-reviewer': review('approved', sha),
  'test-coverage-reviewer': review('approved', sha),
  ...over,
});
export const withReviews = (rs) => Object.fromEntries(Object.entries(rs).map(([n, body]) => [`openspec/changes/feat/reviews/${n}.md`, body]));
export const base = () => gitRepo({ changes: { feat: { 'tasks.md': '- [x] 1.1 a\n' } }, files: { 'src/a.ts': 'a\n' } });
export const head = (root) => git(root, 'rev-parse', 'HEAD');

// base() on main; feat with a product commit R, both reviews and evidence at R; then `onMain(root)` builds the base's
// commits on main and `merge(root)` makes the merge on feat. Returns { root, R }.
export function mergeHistory(onMain, merge) {
  const root = base();
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, { 'src/a.ts': 'changed\n' });
  const R = commitAll(root, 'product commit');
  put(root, { ...withReviews(reviews(R)), 'openspec/changes/feat/evidence.md': `Commit: ${R}\n\n# Evidence\n` });
  commitAll(root, 'reviews and evidence');
  git(root, 'switch', '-q', 'main');
  onMain(root);
  git(root, 'switch', '-q', 'feat');
  merge(root);
  return { root, R };
}
export const mergeMain = (root) => git(root, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');
export const onlyOpenspec = (root) => { put(root, { 'openspec/changes/other.md': 'o\n' }); commitAll(root, 'plan only on main'); };
export const s7 = (sha) => sha.slice(0, 7);

export const gateRow = (cmd, result) => `| 1.4 | \`${cmd}\` | ${result} |\n`;
export const ev = (root, content) => put(root, { 'openspec/changes/feat/evidence.md': content });

export const acRow = (id, result) => `| ${id} | proof | ${result} |\n`;
export const changeFiles = (files) => Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/feat/${f}`, b]));

export const callGh = (gh, ...args) => spawnSync('gh', args, { env: gh.env, encoding: 'utf8' });

export const PR_FIELDS = 'number,url,state,headRefOid,baseRefName,mergeable,body';
export const prJson = (over = {}) => ({ number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', headRefOid: '', baseRefName: 'main', mergeable: 'MERGEABLE', body: '', autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over });

export const OLD_FLAG = (flag) => `unknown flag: --${flag}\n\nUsage:  gh pr checks [<number> | <url> | <branch>] [flags]\n`;
export const versionsOf = (t) => t.gh.calls().filter((c) => c[0] === '--version');
export function conversation({ threads = [], comments = [], reviews = [], more = false, viewer = 'me' } = {}) {
  return { data: { viewer: { login: viewer }, repository: { pullRequest: {
    reviewThreads: { pageInfo: { hasNextPage: more }, nodes: threads },
    comments: { nodes: comments },
    reviews: { nodes: reviews },
  } } } };
}

export const tick = (root, ...ids) => {
  const f = join(root, 'openspec/changes/feat/tasks.md');
  let text = readFileSync(f, 'utf8');
  for (const id of ids) text = text.replace(`- [ ] ${id} `, `- [x] ${id} `);
  writeFileSync(f, text);
};
// A schema `devkit` change `feat` (readiness artifact declared), ship: pr, on
// branch ship/feat, committed. Readiness and the branch are the variables.
export function devkitRepo({ readiness = null, branch = 'ship/feat', others = [], ship = 'pr' } = {}) {
  const root = gitRepo({
    config: `schema: devkit\nship:\n  devkit: ${ship}\n`,
    changes: Object.fromEntries([['feat', {
      '.openspec.yaml': 'schema: devkit\n',
      'proposal.md': proposalWith(['AC-1']),
      'tasks.md': '## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `node -e 0` green\n',
      ...(readiness === null ? {} : { 'readiness.md': `# Readiness\n\n- Status: ${readiness}\n` }),
    }], ...others.map((o) => [o, { 'tasks.md': '- [ ] 1.1 x\n' }])]),
    files: {
      'src/a.ts': 'a\n',
      ...(ship === 'merge' ? { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' } : {}),
      'openspec/schemas/devkit/schema.yaml': 'name: devkit\nversion: 1\nartifacts:\n  - id: readiness\n    generates: readiness.md\n',
    },
  });
  if (branch !== 'main') git(root, 'switch', '-q', '-c', branch);
  const gh = fakeGh();
  gh.set('pr-view', { exit: 1, stderr: `no pull requests found for branch "${branch}"\n` });
  if (ship === 'merge') presetSetup(gh);
  if (ship !== 'plan') gh.set('pr-list', { stdout: [] });
  const env = { ...gh.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
  return { root, gh, env, state: (over = {}) => collectState(root, 'feat', { env: { ...env, ...over } }) };
}

export const readinessHash = (root, id = 'feat') => `sha256:${createHash('sha256').update(readFileSync(join(root, 'openspec', 'changes', id, 'readiness.md'))).digest('hex').slice(0, 12)}`;
export const approvalMd = (hash) => `# Plan approval: feat\n\n- Status: APPROVED\n- Readiness: ${hash}\n- Date: 2026-11-09\n- Owner's words: "Aprovo"\n`;
// An approved devkit change with phase 1 not started, unless `tasks` says otherwise.
export function planRepo({ tasks = '## 1. First\n- [ ] 1.1 code\n', approval } = {}) {
  const t = devkitRepo({ readiness: 'APPROVED' });
  put(t.root, { 'openspec/changes/feat/tasks.md': tasks });
  if (approval) put(t.root, { 'openspec/changes/feat/approval.md': typeof approval === 'function' ? approval(readinessHash(t.root)) : approval });
  return t;
}

export const reviewAt = (root, names, sha = head(root)) => put(root, withReviews(Object.fromEntries(names.map((n) => [n, review('approved', sha)]))));
export const fullEvidence = (root, env, sha = head(root)) => {
  const state = collectState(root, 'feat', { env });
  const cmds = state.phases.flatMap((p) => (p.gate ? p.gate.command.split('&&').map((c) => c.trim()) : []));
  ev(root, `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${cmds.map((c) => gateRow(c, 'pass: ok')).join('')}\n### Acceptance\n${acRow('AC-1', 'pass: t')}${acRow('AC-2', 'verified: r')}`);
};

export const PR_BODY = 'feat\n- AC-1\n- AC-2\nopenspec/changes/feat/evidence.md\n';
// Applies each step's effect until ready; returns the steps taken.
export function driveToReady(t) {
  const taken = [];
  const prBody = PR_BODY;
  const setPr = () => {
    t.gh.set('pr-view', { stdout: prJson({ headRefOid: head(t.root), body: prBody }) });
    t.gh.set('pr-checks', { stdout: [check('build', 'pass')] });
    t.gh.set('api-graphql', { stdout: conversation({}) });
  };
  for (let i = 0; i < 30; i++) {
    const state = collectState(t.root, 'feat', { env: t.env });
    const n = nextStep(state);
    taken.push(n.step);
    if (['ready', 'enable-auto-merge', 'assign-release'].includes(n.step)) break;
    assert.ok(!n.step.startsWith('stop-') && n.step !== 'blocked', `${n.step}: ${n.reason}`);
    switch (n.step) {
      case 'implement': {
        const phase = state.phases.find((p) => p.n === n.phase);
        put(t.root, { [`src/phase${n.phase}.ts`]: `export const p = ${n.phase};\n` });
        tick(t.root, ...phase.open);
        break;
      }
      case 'gate': tick(t.root, n.task); break;
      case 'commit': commitAll(t.root, 'code'); break;
      case 'review': reviewAt(t.root, n.reviewers); break;
      case 'verify': fullEvidence(t.root, t.env); break;
      case 'open-pr': commitAll(t.root, 'ship change files'); setPr(); break;
      default: assert.fail(`unexpected step ${n.step}: ${n.reason}`);
    }
  }
  return taken;
}

// A devkit-lite change driven to ready: code, reviews and evidence current, PR open, one commit ahead of nothing.
export function readyRepo() {
  const t = shipRepo();
  assert.equal(driveToReady(t).at(-1), 'ready');
  return t;
}

export function committedChange() {
  const t = shipRepo();
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  return t;
}
export const itemsOf = (t) => collectState(t.root, 'feat', { env: t.env }).items;
export const bothEvidenceCurrent = (t) => { const i = itemsOf(t); return [i[0].details.evidence, i[3].details.evidence]; };

export const MERGE_FIELDS = `${PR_FIELDS},autoMergeRequest,mergeStateStatus`;

export const noMergeCall = (t) => t.gh.calls().filter((c) => c[0] === 'pr' && c[1] === 'merge');

// A merge-mode repo at 8/8 with the PR open and clean.
export function mergeReady(over = {}) {
  const t = shipRepo({ ship: 'merge' });
  driveToReady(t);
  t.gh.set('pr-view', { stdout: prJson({ headRefOid: head(t.root), body: PR_BODY, ...over }) });
  return t;
}

// The GitHub reads of the post-merge phase for a change whose folder is still on main and has no archive PR.
export function presetArchiveReads(t) {
  // The change's own pull request #12 changed its folder and every task is ticked on main (field-fixes D-4).
  t.gh.prFiles(12, ['openspec/changes/feat/tasks.md', 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '1.2'] }));
  t.gh.set(ARCHIVE_LISTING, { stdout: [] });
  t.gh.set(ACTIVE_ON_MAIN, { stdout: {} });
  t.gh.set(ARCHIVE_PRS, { stdout: [] });
}

export const repoRoot = join(here, '..', '..', '..');
export const coreAgent = (name) => readFileSync(join(repoRoot, 'plugins', 'core', 'agents', `${name}.md`), 'utf8');

export const CI_TASKS = '## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `node -e 0` green\n';
export const CI_ENV = { DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', DEVKIT_BYPASS: '' };
export function runCi(root, args = [], env = {}) {
  const r = spawnSync(process.execPath, [cli, '--ci', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...CI_ENV, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) };
}
export const ciGate = (cmd = 'node -e 0') => `${gateRow(cmd, 'pass: ok')}`;
// Reviews and evidence for `name` at the current head, committed (an openspec/-only commit).
export function ciProve(root, name = 'feat', { rows = ciGate(), acs = ['AC-1'], ac = (id) => acRow(id, 'pass: t') } = {}) {
  const sha = head(root);
  const dir = `openspec/changes/${name}`;
  put(root, {
    [`${dir}/reviews/code-quality-reviewer.md`]: review('approved', sha),
    [`${dir}/reviews/test-coverage-reviewer.md`]: review('approved', sha),
    [`${dir}/evidence.md`]: `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${rows}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acs.map(ac).join('')}`,
  });
  commitAll(root, `prove ${name}`);
}
export function changeFilesOf() {
  return { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': proposalWith(['AC-1']), 'tasks.md': CI_TASKS };
}
// A repo on `branch` with the given changes (default: one complete change `feat`, proven at head).
export function ciRepo({ branch = 'ship/feat', names = ['feat'], config = 'schema: devkit-lite\n', prove = true } = {}) {
  const root = gitRepo({ config, changes: Object.fromEntries(names.map((n) => [n, changeFilesOf()])), files: { 'src/a.ts': 'a\n' } });
  if (branch !== 'main') git(root, 'switch', '-q', '-c', branch);
  if (prove) for (const n of names) ciProve(root, n);
  return root;
}

// A base where `x` was squash-merged (still active, unproven) next to the `others`, and a PR branch that archives it.
// The retro approves `src/a.ts` by default; `retro` and `files` override what the PR carries.
export const X_RETRO = '## Proposed updates\n\n### `src/a.ts` (process-friction)\nSummary.\n- Answer: approved\n- Applied: yes\n';
export function archivePrRepo({ branch = 'chore/archive-x', others = [], retro = X_RETRO, files = {}, schema = 'devkit-lite', base = {} } = {}) {
  const root = gitRepo({ branch: 'main', changes: Object.fromEntries(['x', ...others].map((n) => [n, { ...changeFilesOf(), ...(n === 'x' ? { '.openspec.yaml': `schema: ${schema}\n` } : {}) }])), files: { 'src/a.ts': 'a\n', 'openspec/roadmap.md': '## R\n- [ ] x\n', ...base } });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(root, 'switch', '-q', '-c', branch);
  git(root, 'mv', 'openspec/changes/x', 'openspec/changes/archive/2026-11-09-x');
  put(root, { ...(retro === null ? {} : { 'openspec/changes/archive/2026-11-09-x/retro.md': retro }), 'openspec/roadmap.md': '## R\n- [x] x\n', 'src/a.ts': 'changed\n', ...files });
  commitAll(root, 'archive x');
  return root;
}

export const GUARD_FILE = join(here, 'guard.mjs');
// The same check through both entries: deliver-check.mjs --ci and guard.mjs ci.
export function bothEntries(root, args = [], env = {}) {
  const viaDeliver = runCi(root, args, env);
  const r = spawnSync(process.execPath, [GUARD_FILE, 'ci', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...CI_ENV, ...env } });
  return [viaDeliver, { code: r.status, out: r.stdout, err: r.stderr, json: () => JSON.parse(r.stdout) }];
}

// ---- the nextStep states (moved from deliver-check.test.mjs: part 1 and the loop-evidence tests of the archive part both build them)
export const BASE_DETAILS = {
  1: { unticked: [], missingGates: [], evidence: 'current' },
  2: { stale: [], rejected: [], missing: [] },
  3: { fixed: 0, refuted: 0, undisposed: [] },
  4: { ids: ['AC-1'], proven: ['AC-1'], missing: [], defects: [], noProof: [], evidence: 'current' },
  5: { pr: { number: 12, url: 'u' }, ahead: false, uncommitted: [] },
  6: { required: true, failing: [], pending: [] },
  7: { threads: [], comments: [], changesRequested: [], waiting: [] },
  8: { missing: [] },
};
// A state where all eight items are met; `over.items[n]` = { status, details } merges into item n.
export function state(over = {}) {
  const items = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    id: n, name: `item${n}`, status: 'met', reason: `item ${n} reason`,
    ...over.items?.[n], details: { ...BASE_DETAILS[n], ...over.items?.[n]?.details },
  }));
  const { items: _ignored, ...rest } = over;
  return {
    id: 'feat', schema: 'devkit-lite', ship: 'pr', branchOk: true, needsReadiness: false, readiness: null,
    phases: [{ n: 1, title: 'One', open: [], gate: { id: '1.2', done: true, command: 'npm test' } }],
    dirty: [], reviewMd: null,
    reviews: [{ name: 'code-quality-reviewer', verdict: 'APPROVED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: true }],
    pr: { number: 12, url: 'u' },
    ...rest, items,
  };
}
export const open = (details = {}) => ({ status: 'open', details });
export const blocked = (details = {}) => ({ status: 'blocked', details });
export const rejectedState = (over = {}) => state({
  reviewMd: { consensus: 'FAIL', round: 1 },
  reviews: [{ name: 'code-quality-reviewer', verdict: 'REJECTED', current: true }, { name: 'test-coverage-reviewer', verdict: 'APPROVED', current: true }],
  items: { 2: open({ rejected: ['code-quality-reviewer'] }), 3: open({ undisposed: [{ reviewer: 'code-quality-reviewer', excerpt: '[blocking] x' }] }) },
  ...over,
});
export const BOTH = ['code-quality-reviewer', 'test-coverage-reviewer'];

// ---- own-files (stale-only-on-own-files D-8): the repository the rule tests and the --ci test build
export const OWN_REVIEWERS = ['code-quality-reviewer', 'test-coverage-reviewer', 'spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer'];
// Twelve lines whose first and last differ, so the branch and the base edit one file without a conflict.
export const ownLines = (first = 'line 1', last = 'line 12') => Array.from({ length: 12 }, (_, i) => (i === 0 ? first : i === 11 ? last : `line ${i + 1}`)).join('\n') + '\n';
export const ownReviews = (sha, rejected = []) => Object.fromEntries(OWN_REVIEWERS.map((n) => [`openspec/changes/feat/reviews/${n}.md`, review(rejected.includes(n) ? 'rejected' : 'approved', sha)]));
export const ownEvidence = (sha) => `Commit: ${sha}\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${ciGate()}\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n${acRow('AC-1', 'pass: t')}`;
export const ownUnrelated = (root) => { put(root, { 'src/other.ts': 'changed on main\n', 'openspec/changes/other/tasks.md': '- [ ] 1.1 x\n' }); commitAll(root, 'unrelated on main'); };
export const ownMergeMain = (root) => git(root, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');

// main with product, test, unrelated and release files and the change folder; branch feat with a product and test
// commit, a release bump, then evidence and six reviews recorded at R; then `onMain` on main, origin/main set
// (`origin`: 'tip' | 'initial' (not fetched) | 'none' | 'head' (the head is in the base)), then `merge` on feat.
export function ownFilesRepo({ config = 'schema: devkit-lite\n', origin = 'tip', onMain = ownUnrelated, merge = ownMergeMain, before = null, rejected = [] } = {}) {
  const root = gitRepo({
    config,
    changes: { feat: changeFilesOf() },
    files: {
      'src/a.ts': ownLines(), 'src/a.test.ts': ownLines(), 'src/b.ts': 'b\n', 'src/other.ts': 'other\n',
      'CHANGELOG.md': '# Changelog\n\n## 1.0.0\n- start\n', 'plugins/p/.claude-plugin/plugin.json': '{"version":"1.0.0"}\n',
      '.claude-plugin/marketplace.json': '{"version":"1.0.0"}\n', 'docs/catalog.md': 'catalog\n',
    },
  });
  const initial = head(root);
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, { 'src/a.ts': ownLines('branch 1'), 'src/a.test.ts': ownLines('branch 1') });
  commitAll(root, 'product and test');
  put(root, { 'CHANGELOG.md': '# Changelog\n\n## 1.1.0\n- feat\n\n## 1.0.0\n- start\n', 'plugins/p/.claude-plugin/plugin.json': '{"version":"1.1.0"}\n' });
  commitAll(root, 'bump');
  if (before) before(root);
  const R = head(root);
  put(root, { ...ownReviews(R, rejected), 'openspec/changes/feat/evidence.md': ownEvidence(R) });
  commitAll(root, 'reviews and evidence');
  git(root, 'switch', '-q', 'main');
  onMain(root);
  const tip = head(root);
  if (origin === 'tip' || origin === 'initial') git(root, 'update-ref', 'refs/remotes/origin/main', origin === 'tip' ? tip : initial);
  git(root, 'switch', '-q', 'feat');
  if (merge) merge(root);
  if (origin === 'head') git(root, 'update-ref', 'refs/remotes/origin/main', head(root));
  return { root, R, initial, tip, merged: head(root) };
}
// The merge of main after the commits `edit` makes on main.
export const ownBrings = (files) => (root) => { put(root, files); commitAll(root, 'base brings files'); };

// ---- the release note (release-at-merge): the repositories the release-note tests share. The texts the delivery step writes are
// written out here by hand, never computed by the code under test.
export const REL_FILE = 'plugins/openspec/.claude-plugin/plugin.json';
export const REL_CONFIG = `devkit:\n  release_tag: ${REL_FILE}\n`;
const manifestJson = (name, version) => `${JSON.stringify({ name, version, description: `pack ${name}` }, null, 2)}\n`;
const marketJson = (metadata, packs) => `${JSON.stringify({ name: 'devkit', metadata: { description: 'd', version: metadata }, plugins: Object.entries(packs).map(([name, version]) => ({ name, description: `pack ${name}`, version })) }, null, 2)}\n`;
export const flowPage = (version) => `# Flow\n\nProse of the flow page.\n\n## CI\n\n# pinned to the commit of v${version} here\n`;
export const START_ADR = '# ADR 0001: start\n\n- Status: accepted\n';
export const CHANGELOG0 = '# Changelog\n\n## 1.0.0 — first\n\n- **devkit-openspec**: start\n';
// The release lines of a project with two packs and a marketplace, at the given versions.
export const releaseLayout = ({ openspec = '1.0.0', core = '1.0.0', market = '1.0.0', changelog = CHANGELOG0 } = {}) => ({
  [REL_FILE]: manifestJson('devkit-openspec', openspec),
  'plugins/core/.claude-plugin/plugin.json': manifestJson('devkit-core', core),
  '.claude-plugin/marketplace.json': marketJson(market, { 'devkit-openspec': openspec, 'devkit-core': core }),
  'CHANGELOG.md': changelog,
  'docs/openspec-flow.md': flowPage(openspec),
  'docs/adr/0001-start.md': START_ADR,
});
export const NOTE_TEXT = '# Release note\n\npacks:\n- devkit-openspec: minor\n- devkit-core: patch\n\n## a change that does a thing\n\n- **devkit-openspec**: it does a thing\n- **devkit-core**: it helps\n';
export const ADR_FEAT = '# ADR [feat]: the rule\n\n- Status: proposed\n- Change: `feat`\n';
export const DECISIONS = '# Decisions\n\n- ADR: `docs/adr/feat.md`\n';
// What the delivery step writes on the layout above for NOTE_TEXT and the ADR `docs/adr/feat.md`, with the base at 1.0.0.
export const ASSIGNED_CHANGELOG = '# Changelog\n\n## 1.1.0 — a change that does a thing\n\n- **devkit-openspec** 1.1.0: it does a thing\n- **devkit-core** 1.0.1: it helps\n\n## 1.0.0 — first\n\n- **devkit-openspec**: start\n';

// A repository whose main holds `files`, with a bare origin, and the noted change `feat` on branch `feat`: its plan files, the note
// (null: none), the ADR `docs/adr/feat.md` listed in decisions.md (`adr: false`: none) and `docs/x.md`, which cites it. Returns the root.
export function noteRepo({ config = `schema: devkit-lite\n${REL_CONFIG}`, files = releaseLayout(), note = NOTE_TEXT, adr = true, extra = {} } = {}) {
  const root = gitRepo({ config, files: { 'src/a.ts': 'a\n', ...files } });
  const origin = tmpFolder('devkit-origin-');
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', 'origin', 'main');
  git(root, 'switch', '-q', '-c', 'feat');
  put(root, {
    ...changeFiles(changeFilesOf()),
    ...(note === null ? {} : { 'openspec/changes/feat/release.md': note }),
    ...(adr ? { 'openspec/changes/feat/decisions.md': DECISIONS, 'docs/adr/feat.md': ADR_FEAT, 'docs/x.md': 'See ADR [feat] for the rule.\n' } : {}),
    ...extra,
  });
  commitAll(root, 'plan files');
  return root;
}
// The commit the delivery step would make on noteRepo's branch (base at 1.0.0): the versions, the changelog entry, the pin and the
// ADR numbered 0002 with its citations rewritten. each option set to false leaves that part out, to build a half of it. `record: true`
// ends its message with the step's record of all of it (release-at-merge D-20), written out here by hand.
export const STEP_RECORD = [
  'Release-change: feat',
  `Release-line: ${REL_FILE}`,
  'Release-line: plugins/core/.claude-plugin/plugin.json',
  'Release-line: .claude-plugin/marketplace.json',
  'Release-line: CHANGELOG.md',
  'Release-line: docs/openspec-flow.md',
  'Release-adr: docs/adr/feat.md -> docs/adr/0002-feat.md',
  'Release-citation: docs/x.md',
].join('\n');
export function stepCommit(root, { versions = true, changelog = true, pin = true, adr = true, record = false } = {}) {
  const files = {};
  if (versions) {
    files[REL_FILE] = manifestJson('devkit-openspec', '1.1.0');
    files['plugins/core/.claude-plugin/plugin.json'] = manifestJson('devkit-core', '1.0.1');
    files['.claude-plugin/marketplace.json'] = marketJson('1.1.0', { 'devkit-openspec': '1.1.0', 'devkit-core': '1.0.1' });
  }
  if (changelog) files['CHANGELOG.md'] = ASSIGNED_CHANGELOG;
  if (pin) files['docs/openspec-flow.md'] = flowPage('1.1.0');
  put(root, files);
  if (adr) {
    git(root, 'mv', 'docs/adr/feat.md', 'docs/adr/0002-feat.md');
    put(root, { 'docs/adr/0002-feat.md': ADR_FEAT.replace('ADR [feat]', 'ADR 0002'), 'docs/x.md': 'See ADR 0002 for the rule.\n' });
  }
  return commitAll(root, `chore(release): assign the release of feat${record ? `\n\n${STEP_RECORD}` : ''}`);
}
// A commit on main that releases another change (every file written by hand) and the bare origin follows; the root ends on `branch`.
export function baseReleases(root, files, branch = 'feat') {
  git(root, 'switch', '-q', 'main');
  put(root, files);
  commitAll(root, 'another change released');
  try { git(root, 'push', '-q', 'origin', 'main'); } catch { git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD'); }
  git(root, 'switch', '-q', branch);
}

// shipRepo's change `feat` with the release layout on main, origin/main set to it (`origin: false`: no remote-tracking ref), the
// note, the ADR and `docs/x.md` committed as the plan files, on branch ship/feat. `train` names the suite of a delivery train.
export function noteShip({ ship = 'merge', train = null, note = NOTE_TEXT, files = releaseLayout(), adr = true, origin = true } = {}) {
  const trainConfig = train === null ? '' : `  delivery:\n    model: trunk-auto\n    train: "${train}"\n`;
  const t = shipRepo({ ship, extra: `${REL_CONFIG}${trainConfig}` });
  git(t.root, 'switch', '-q', 'main');
  put(t.root, files);
  commitAll(t.root, 'release layout');
  if (origin) git(t.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(t.root, 'switch', '-q', 'ship/feat');
  git(t.root, 'merge', '-q', '--ff-only', 'main');
  put(t.root, {
    ...(note === null ? {} : { 'openspec/changes/feat/release.md': note }),
    ...(adr ? { 'openspec/changes/feat/decisions.md': DECISIONS, 'docs/adr/feat.md': ADR_FEAT, 'docs/x.md': 'See ADR [feat] for the rule.\n' } : {}),
  });
  commitAll(t.root, 'plan files');
  return t;
}

// Every task of shipRepo's change ticked and committed as code.
export function tickAll(t) {
  tick(t.root, '1.1', '1.2', '2.1', '2.2', '2.3');
  commitAll(t.root, 'all code');
  return t;
}
// A merge-mode (or `ship`) noted change driven until the checker has nothing before the release step to ask: its last step is
// `enable-auto-merge` on the code before the release rows, `assign-release` after them. The pull request is open at the head.
export function noteReady(opts = {}) {
  const t = noteShip(opts);
  driveToReady(t);
  setPrHead(t);
  return t;
}
// The fake gh answers for an open pull request at the local head (a push done), with `over` on top.
export function setPrHead(t, over = {}) {
  t.gh.set('pr-view', { stdout: prJson({ headRefOid: head(t.root), body: PR_BODY, ...over }) });
}
