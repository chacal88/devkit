// Fixtures the devkit-openspec hook tests share. No test lives here and nothing is made when the module is
// imported: a folder, a spawn or a git call happens only when one of its functions runs. A test file never imports
// another test file (scripts/test-suite.mjs refuses it); what two test files share is moved to this module.
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpFolder } from './test-tmp.mjs';
import { mkdirSync, cpSync, writeFileSync, chmodSync, rmSync as fsRm, existsSync, readFileSync, readdirSync, realpathSync, renameSync } from 'node:fs';
import * as deliver from './deliver-check.mjs';
import { nextStep, collectState } from './deliver-check.mjs';
import { makeGh } from './merge-setup.mjs';
import { conductState } from './conduct-check.mjs';
import { decide } from './change-loop.mjs';
import * as loopModule from './roadmap-loop.mjs';
import { classifyLines } from './roadmap-loop.mjs';
import { parseRoadmap } from './guard.mjs';

// ---------------------------------------------------------------- from deliver-check.test.mjs

const here = dirname(fileURLToPath(import.meta.url));
const schemas = join(here, '..', 'schemas');

// Commits must not depend on a global git identity.
export const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid',
  GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

export function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// A repo with openspec/, the schemas, an optional config and change files,
// and (unless commit is false) one initial commit. Returns the root.
export function gitRepo({ config = 'schema: devkit-lite\n', changes = {}, files = {}, branch = 'main', commit = true } = {}) {
  const root = tmpFolder('devkit-deliver-');
  git(root, 'init', '-q', '-b', branch);
  mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
  cpSync(schemas, join(root, 'openspec', 'schemas'), { recursive: true });
  if (config !== null) writeFileSync(join(root, 'openspec', 'config.yaml'), config);
  for (const [name, fs] of Object.entries(changes)) put(root, Object.fromEntries(Object.entries(fs).map(([f, b]) => [`openspec/changes/${name}/${f}`, b])));
  put(root, files);
  if (commit) commitAll(root, 'initial');
  return root;
}

// Write files (path relative to root -> content) without committing.
export function put(root, files) {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
}

// An `openspec` stand-in in `dir`: `--version` answers `version`; any other call is logged as "<label> <args>" in
// `marker`, then answers one error status. It lets a test prove which CLI a pack started (field-fixes 6).
export function openspecStub(dir, { version, label, marker }) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'openspec');
  writeFileSync(file, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; exit 0; fi\necho "${label} $*" >> "${marker}"\necho '{"status":[{"severity":"error","message":"stub"}]}'\nexit 1\n`);
  chmodSync(file, 0o755);
  return dir;
}

// Stage everything and commit; returns the new full sha.
export function commitAll(root, message) {
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--allow-empty', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}

export const proposalWith = (ids, extra = '') => `# Proposal\n\n## Why\n\nSee AC-99 elsewhere.\n\n## Acceptance criteria\n\n${ids.map((i) => `- ${i}: something`).join('\n')}\n\n## Impact\n\nMentions AC-98.\n${extra}`;

const FAKE_GH = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dir = process.env.FAKE_GH_DIR;
const args = process.argv.slice(2);
const apiKey = () => {
  if (args[1] === 'graphql') return 'api-graphql';
  const x = args.indexOf('-X');
  const method = x >= 0 ? args[x + 1] : 'GET';
  const route = args.slice(1).find((a, i, all) => !a.startsWith('-') && all[i - 1] !== '-X' && all[i - 1] !== '-F' && all[i - 1] !== '-f' && all[i - 1] !== '--jq' && all[i - 1] !== '--input');
  return 'api-' + method + '-' + String(route).replace(/[\\/{}?]/g, '_');
};
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
// pr list: the most specific fixture wins (--head, then --state), then plain pr-list.
const keys = args[0] === 'api' ? [apiKey()] : args[0] === 'pr' && args[1] === 'list'
  ? [...(opt('--head') ? ['pr-list-head-' + opt('--head').replace(/[\\/{}?]/g, '_')] : []), ...(opt('--state') ? ['pr-list-state-' + opt('--state')] : []), 'pr-list']
  : args[0] === '--version' ? ['version']
  : [args[0] + '-' + args[1] + (args.includes('--watch') ? '-watch' : '')];
// A view of a PR by number may have its own fixture (pr-view-<n>.json), ahead of the plain pr-view ones.
const own = args[0] === 'pr' && args[1] === 'view' && /^[0-9]+$/.test(args[2] || '') ? path.join(dir, 'pr-view-' + args[2] + '.json') : null;
const key = keys[0];
fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify(args) + '\\n');
// A body read of a merged PR in the list is answered from it, and is not counted as a plain pr-view call.
const fields = (opt('--json') || '').split(',');
const merged = path.join(dir, 'pr-list-state-merged.json');
const project = (o) => Object.fromEntries(fields.filter((f) => f in o).map((f) => [f, o[f]]));
if (own && !fs.existsSync(own) && fs.existsSync(merged) && opt('--json') === 'body') {
  const hit = (JSON.parse(fs.readFileSync(merged, 'utf8')).stdout || []).find((p) => String(p.number) === args[2]);
  if (hit) { process.stdout.write(JSON.stringify(project(hit))); process.exit(0); }
}
const counter = path.join(dir, key + '.count');
const n = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0) + 1;
fs.writeFileSync(counter, String(n));
const file = [own, ...keys.flatMap((k) => [k + '.' + n + '.json', k + '.json']).map((f) => path.join(dir, f))].filter(Boolean).find((f) => fs.existsSync(f));
// Like gh, answer only the JSON fields asked for: a merged-PR list carries a body only on request.
if (args[0] === 'pr' && args[1] === 'list' && opt('--state') === 'merged' && file === merged) {
  const fx = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(fx.stdout)) { process.stdout.write(JSON.stringify(fx.stdout.map(project))); process.exit(fx.exit === undefined ? 0 : fx.exit); }
}
if (!file) {
  process.stderr.write('fake gh: no fixture for "' + key + '" (call ' + n + '): ' + args.join(' ') + '\\n');
  process.exit(99);
}
const fx = JSON.parse(fs.readFileSync(file, 'utf8'));
const finish = () => {
  if (fx.stdout !== undefined) process.stdout.write(typeof fx.stdout === 'string' ? fx.stdout : JSON.stringify(fx.stdout));
  if (fx.stderr) process.stderr.write(fx.stderr);
  process.exit(fx.exit === undefined ? 0 : fx.exit);
};
if (fx.sleep) setTimeout(finish, fx.sleep); else finish();
`;

// A gh on PATH answering from JSON fixtures: set('pr-view', { stdout, stderr, exit, sleep }, n?)
// writes pr-view.json (every call) or pr-view.<n>.json (that call only).
export function fakeGh() {
  const base = tmpFolder('devkit-gh-');
  const bin = join(base, 'bin');
  const dir = join(base, 'fixtures');
  mkdirSync(bin);
  mkdirSync(dir);
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  return {
    bin,
    dir,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_DIR: dir },
    set(key, fixture, n) { writeFileSync(join(dir, n ? `${key}.${n}.json` : `${key}.json`), JSON.stringify(fixture)); },
    // The files pull request <n> changed, and the tasks.md of <id> on the default branch (field-fixes 4).
    prFiles(n, files) { this.set(PR_FILES_KEY(n), filesFixture(files)); },
    tasksOnDefault(id, text, base = 'main') { this.set(TASKS_ON_KEY(id, base), tasksFixture(text)); },
    // Start counting calls to `key` from 1 again (per-call fixtures).
    resetCount(key) { fsRm(join(dir, `${key}.count`), { force: true }); },
    calls() {
      const f = join(dir, 'calls.log');
      return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
  };
}

// The fixture keys of the two GitHub reads the delivery makes (field-fixes 4): the files a pull request changed
// and the tasks.md of a change on the default branch. An unset key fails loudly, as every fake gh key does.
export const PR_FILES_KEY = (n) => `api-GET-repos__owner___repo__pulls_${n}_files`;
export const TASKS_ON_KEY = (id, base = 'main') => `api-GET-repos__owner___repo__contents_openspec_changes_${id}_tasks.md_ref=${base}`;
export const filesFixture = (files) => ({ stdout: files.map((f) => `${f}\n`).join('') });
export const tasksFixture = (text) => ({ stdout: { name: 'tasks.md', encoding: 'base64', content: Buffer.from(text).toString('base64') } });
// A tasks.md with the given ticked and unticked task ids, one task per line under phase headings.
export const tasksText = ({ ticked = [], unticked = [] } = {}) => `# Tasks\n\n${[...ticked.map((id) => `- [x] ${id} done`), ...unticked.map((id) => `- [ ] ${id} left`)].join('\n')}\n`;

export const check = (name, bucket, link = `https://ci/${name}`) => ({ name, state: bucket.toUpperCase(), bucket, link });

const TASKS = `# Tasks

## 1. First
- [ ] 1.1 code one
- [ ] 1.2 Gate: \`node -e 0\` green

## 2. Second
- [ ] 2.1 code two
- [ ] 2.2 code three
- [ ] 2.3 Gate: \`node -v && node -e 0\` green
`;

// The fake gh answers of a repository ready for merge mode (auto-merge allowed, devkit-reviews required).
export function presetSetup(gh, { repo = {}, rules = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }] } = {}) {
  gh.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main', allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true, ...repo } });
  gh.set('api-GET-repos__owner___repo__rules_branches_main', { stdout: rules });
  gh.set('api-GET-repos__owner___repo__branches_main_protection_required_status_checks', { exit: 1, stderr: 'gh: Branch not protected (HTTP 404)\n' });
}
// A devkit-lite change `feat` with ship: pr, on branch ship/feat, committed. `extra` is config text appended to
// openspec/config.yaml before the first commit (release-tags: a `devkit:` block).
export function shipRepo({ ship = 'pr', method = '', extra = '' } = {}) {
  const root = gitRepo({
    config: `schema: devkit-lite\nship:\n  devkit-lite: ${ship}\n${method ? `merge_method: ${method}\n` : ''}${extra}`,
    changes: { feat: { '.openspec.yaml': 'schema: devkit-lite\n', 'proposal.md': proposalWith(['AC-1', 'AC-2']), 'tasks.md': TASKS } },
    files: { 'src/a.ts': 'a\n', ...(ship === 'merge' ? { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' } : {}) },
  });
  git(root, 'switch', '-q', '-c', 'ship/feat');
  const gh = fakeGh();
  if (ship === 'merge') presetSetup(gh);
  if (ship !== 'plan') gh.set('pr-list', { stdout: [] });
  gh.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "ship/feat"\n' });
  const env = { ...gh.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
  return { root, gh, env, next: () => nextStep(collectState(root, 'feat', { env })) };
}

export const cli = join(here, 'deliver-check.mjs');
export function runCli(t, args, { env = {}, cwd = t.root } = {}) {
  const r = spawnSync('node', [cli, ...args], { cwd, encoding: 'utf8', env: { ...t.env, DEVKIT_HOST: 'cli', CLAUDE_CODE_ENTRYPOINT: '', ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const EVIDENCE_LINK = 'openspec/changes/feat/evidence.md';
export const mergedPr = (over = {}) => ({
  number: 12, url: 'https://github.com/o/r/pull/12', state: 'MERGED', headRefName: 'ship/feat', headRefOid: 'b'.repeat(40), baseRefName: 'main',
  mergeable: 'UNKNOWN', mergedAt: '2026-11-09T14:56:00Z', body: `feat\n${EVIDENCE_LINK}\n`, autoMergeRequest: null, mergeStateStatus: 'UNKNOWN', ...over,
});
export const archivePrJson = (over = {}) => ({
  number: 13, url: 'https://github.com/o/r/pull/13', state: 'OPEN', headRefOid: 'c'.repeat(40), baseRefName: 'main',
  mergeable: 'MERGEABLE', autoMergeRequest: null, mergeStateStatus: 'CLEAN', ...over,
});
export const ARCHIVE_LISTING = 'api-GET-repos__owner___repo__contents_openspec_changes_archive_ref=main';
export const ACTIVE_ON_MAIN = 'api-GET-repos__owner___repo__contents_openspec_changes_feat_ref=main';
export const ARCHIVE_PRS = 'pr-list-head-chore_archive-feat';
export const ARCHIVED_DIR = 'openspec/changes/archive/2026-11-09-feat';
export const NOT_FOUND = { exit: 1, stderr: 'gh: Not Found (HTTP 404)\n' };

export const retroMd = (...blocks) => `# Retro: feat\n\n## Proposed updates\n\n${blocks.length ? blocks.join('\n') : 'None.\n'}`;
export const retroPath = (archived) => (archived ? `${ARCHIVED_DIR}/retro.md` : 'openspec/changes/feat/retro.md');
export const writeRetro = (t, md, archived = false) => put(t.root, { [retroPath(archived)]: md });

const answerLine = (answer) => (answer ? `- Answer: ${answer}\n` : '');
export const proposal = (targets, { answer = null, applied = false, kind = 'process-friction' } = {}) =>
  `### ${targets.map((t) => (t === 'user memory' ? t : `\`${t}\``)).join(', ')} (${kind})\nSummary of ${targets.join(' and ')}.\n- before: old\n+ after: new\n${answerLine(answer)}${applied ? '- Applied: yes\n' : ''}`;

// A repository after the change PR was merged: the default branch holds the change
// folder and the roadmap, origin/main is that commit, GitHub lists the merged PR.
export function pm({ ship = 'merge', branch = 'main', onDefault = 'active', archivePrs = [], mergedPrs = [mergedPr()], extra = '' } = {}) {
  const t = shipRepo({ ship, extra });
  git(t.root, 'switch', '-q', 'main');
  put(t.root, { 'openspec/roadmap.md': '## Round 3\n- [ ] feat\n', 'CONTRIBUTING.md': 'old\n' });
  commitAll(t.root, 'roadmap');
  git(t.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  if (branch !== 'main') {
    const exists = spawnSync('git', ['-C', t.root, 'rev-parse', '--verify', '-q', `refs/heads/${branch}`]).status === 0;
    git(t.root, 'switch', '-q', ...(exists ? [] : ['-c']), branch);
  }
  presetSetup(t.gh);
  // Each merged PR changed the change's folder and every task is ticked on main (field-fixes D-4).
  for (const p of mergedPrs) t.gh.prFiles(p.number, ['openspec/changes/feat/tasks.md', 'src/a.ts']);
  t.gh.tasksOnDefault('feat', tasksText({ ticked: ['1.1', '1.2'] }));
  t.gh.set('pr-list-state-merged', { stdout: mergedPrs });
  t.gh.set(ARCHIVE_LISTING, { stdout: onDefault === 'archived' ? [{ name: '2026-11-09-feat' }, { name: '2026-10-01-other' }] : [{ name: '2026-10-01-other' }] });
  t.gh.set(ACTIVE_ON_MAIN, onDefault === 'absent' ? NOT_FOUND : { stdout: { name: 'feat' } });
  t.gh.set(ARCHIVE_PRS, { stdout: archivePrs });
  t.gh.set('pr-checks', { stdout: [check('check', 'pass'), check('devkit-reviews', 'pass')] });
  t.state = (over = {}) => collectState(t.root, 'feat', { env: { ...t.env, ...over } });
  t.next = (over = {}) => nextStep(t.state(over));
  t.json = (args = []) => JSON.parse(runCli(t, ['feat', '--json', ...args]).out);
  return t;
}

// ---------------------------------------------------------------- from conduct-check.test.mjs

export const CONFIG = 'schema: devkit-lite\nship:\n  devkit-lite: pr\n  devkit: pr\n';
export const cleanEnv = { ...process.env, DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', DEVKIT_BYPASS: '', DEVKIT_HOST: 'cli' };
export const real = (p) => realpathSync(p);

// A bare origin with main, a clone (the "main checkout") and, per path, its own fake gh.
export function roundRepo({ roadmap, config = CONFIG, files = {}, changes = {} } = {}) {
  const clone = gitRepo({ config, changes, files: { 'openspec/roadmap.md': roadmap, ...files } });
  const originDir = tmpFolder('devkit-origin-');
  git(originDir, 'init', '-q', '--bare', '-b', 'main');
  git(clone, 'remote', 'add', 'origin', originDir);
  git(clone, 'push', '-q', 'origin', 'main');
  git(clone, 'fetch', '-q', 'origin');
  const main = real(clone);
  const ghs = new Map();
  const ghAt = (path) => {
    const key = real(path);
    if (!ghs.has(key)) {
      const g = fakeGh();
      g.set('api-GET-repos__owner___repo_', { stdout: { default_branch: 'main', allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true } });
      g.set('pr-view', { exit: 1, stderr: 'no pull requests found for branch "x"\n' });
      g.set('pr-list', { stdout: [] });
      ghs.set(key, g);
    }
    return ghs.get(key);
  };
  const t = {
    main, originDir, ghAt,
    ghFor: (r) => makeGh(r, ghAt(r).env),
    wtPath: (id) => join(main, '.claude', 'worktrees', id),
    addWt(id, { path = t.wtPath(id), from = 'origin/main', branch = id } = {}) {
      git(main, 'worktree', 'add', '-q', '-b', branch, path, from);
      return real(path);
    },
    // Put files on origin/main (committed in the main checkout, then pushed).
    commitOrigin(files, message = 'origin change') {
      put(main, files);
      const sha = commitAll(main, message);
      git(main, 'push', '-q', 'origin', 'main');
      return sha;
    },
    originSha: () => git(main, 'rev-parse', 'origin/main'),
    state: (opts = {}, root = main) => conductState(root, { env: cleanEnv, ghFor: t.ghFor, ...opts }),
  };
  return t;
}

// ---------------------------------------------------------------- from release-merge.test.mjs

// A doc shaped like docs/openspec-flow.md around its CI pin: a top slot, a body, the `## CI` block with
// the three pin lines of the real file, and a bottom slot. Each slot is 3+ unchanged lines from the pin lines.
export function pinDoc(version, { top = null, bottom = null } = {}) {
  const v = `v${version}`;
  return [
    '# Flow', '', ...(top === null ? [] : [top, '']),
    'intro 1', 'intro 2', 'intro 3', 'intro 4', '',
    '## Body', 'body 1', 'body 2', 'body 3', 'body 4', '',
    '## CI', '',
    `          # pinned to the commit of ${v} (a tag can move; a commit cannot)`,
    `          base=https://raw.githubusercontent.com/chacal88/devkit/<commit sha of ${v}>/plugins/openspec/hooks`,
    '', 'ci 1', 'ci 2', 'ci 3', '',
    `Pin the commit sha of the release tag (\`${v}\` above), not the tag; by hand, run \`gh api repos/chacal88/devkit/git/ref/tags/${v}\`. Bump it on purpose.`,
    '', 'ci 4', 'ci 5', 'ci 6', '',
    '## Notes', 'note 1', 'note 2', 'note 3', 'note 4', ...(bottom === null ? [] : ['', bottom]), '',
  ].join('\n');
}

// The invariant "mergePins and a release-file merge leave no devkit-pin-* folder behind", checked in a temporary
// folder of its own: other test processes of one gate (these files import each other) make and remove their own
// devkit-pin-* folders in the shared one while this test runs, so a before/after listing of the shared folder
// differs by chance. `fn` runs with TMPDIR set to a new empty folder (the temporary-folder lookup of Node reads it at
// call time); the previous TMPDIR is back when it returns or throws. Returns what `fn` returned and what it left in
// that folder.
export function underOwnTmp(fn) {
  const own = tmpFolder('devkit-ownscope-');
  assert.deepEqual(readdirSync(own), [], 'the private folder starts empty');
  const had = Object.hasOwn(process.env, 'TMPDIR');
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = own;
  try {
    const value = fn();
    return { value, left: readdirSync(own) };
  } finally {
    if (had) process.env.TMPDIR = previous;
    else delete process.env.TMPDIR;
  }
}

// ---------------------------------------------------------------- from change-loop.test.mjs

export const sandbox = () => tmpFolder('devkit-change-loop-lock-');

// A preload that appends one line to COUNT_FILE for every readFileSync of the file named by WATCH_FILE.
export const readCounter = () => {
  const dir = sandbox();
  const preload = join(dir, 'count-reads.mjs');
  writeFileSync(preload, [
    "import fs, { appendFileSync } from 'node:fs';",
    "import { syncBuiltinESMExports } from 'node:module';",
    'const real = fs.readFileSync;',
    'fs.readFileSync = (file, ...rest) => { if (String(file) === process.env.WATCH_FILE) appendFileSync(process.env.COUNT_FILE, "read\\n"); return real(file, ...rest); };',
    'syncBuiltinESMExports();',
  ].join('\n'));
  const count = join(dir, 'reads.log');
  return {
    env: (watch) => ({ NODE_OPTIONS: `--import=${preload}`, WATCH_FILE: watch, COUNT_FILE: count }),
    reads: () => (existsSync(count) ? readFileSync(count, 'utf8').split('\n').filter(Boolean).length : 0),
  };
};

// ---------------------------------------------------------------- from delivery-models.test.mjs

// The env fixture of this suite: the variables a CI run sets for a pull request are blanked together.
export const SET = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };

export const TWO_PRS = 'devkit:\n  delivery:\n    model: two-prs\n    base: main\n    test_branch: develop\n';

// ---------------------------------------------------------------- simGitHub (D-11): a second fake gh with state across calls
//
// The fake keeps its pull requests in a JSON file and reads heads live from the bare origin, so a push moves a pull request
// as it does on GitHub. It answers the calls deliver-check makes (`pr list` with --head, --base and --state, `pr checks`,
// `api graphql`, the repository, the contents and the files of a pull request, `run view`) and the writes the agents make
// (`pr create`, `pr close`, `pr comment`, `pr merge`, `run rerun`). A merge is the test's hook (`__merge`): a merge commit or a squash made in the
// origin. Per pull request it keeps an auto-merge method, a `mergeStateStatus` (default `CLEAN`) and `over`, fields that replace the ones the view
// computes (delivery-train D-13); the argument log (`calls`) lists every call it received.

const SIM_GH = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const dir = process.env.SIM_GH_DIR;
const origin = process.env.SIM_GH_ORIGIN;
const args = process.argv.slice(2);
const stateFile = dir + '/state.json';
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));
if (!args[0].startsWith('__')) fs.appendFileSync(dir + '/calls.log', JSON.stringify(args) + '\n');
const ident = { GIT_AUTHOR_NAME: 'sim', GIT_AUTHOR_EMAIL: 'sim@devkit.invalid', GIT_COMMITTER_NAME: 'sim', GIT_COMMITTER_EMAIL: 'sim@devkit.invalid', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
const git = (...a) => cp.spawnSync('git', ['--git-dir', origin, ...a], { encoding: 'utf8', env: { ...process.env, ...ident } });
const tip = (b) => { const r = git('rev-parse', '--verify', '-q', 'refs/heads/' + b); return r.status === 0 ? r.stdout.trim() : null; };
const out = (v) => { process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v)); process.exit(0); };
const fail = (m, code) => { process.stderr.write(m + '\n'); process.exit(code || 1); };
const opt = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const mergeable = (p) => { const b = tip(p.base); const h = tip(p.head); if (!b || !h) return 'UNKNOWN'; return git('merge-tree', '--write-tree', b, h).status === 0 ? 'MERGEABLE' : 'CONFLICTING'; };
const view = (p) => ({ number: p.number, url: p.url, state: p.state, headRefOid: p.state === 'MERGED' ? p.mergedHead : tip(p.head), baseRefName: p.base, headRefName: p.head, mergeable: p.state === 'OPEN' ? mergeable(p) : 'UNKNOWN', body: p.body || '', mergedAt: p.mergedAt || null, mergeCommit: p.mergeCommit ? { oid: p.mergeCommit } : null, autoMergeRequest: p.autoMerge ? { mergeMethod: p.autoMerge } : null, mergeStateStatus: p.mergeState || 'CLEAN', ...(p.over || {}) });
const filesOf = (p) => (p.state === 'MERGED' ? p.files : git('diff', '--name-only', tip(p.base) + '...' + tip(p.head)).stdout.split('\n').filter(Boolean));
const prOf = (n) => { const p = state.prs.find((x) => x.number === Number(n)); if (!p) fail('no pull request #' + n); return p; };

const doMerge = (p, method) => {
  if (p.state !== 'OPEN') fail('not open');
  const b = tip(p.base); const h = tip(p.head);
  const m = git('merge-tree', '--write-tree', b, h);
  if (m.status !== 0) fail('conflict');
  const parents = method === 'squash' ? ['-p', b] : ['-p', b, '-p', h];
  const c = git('commit-tree', m.stdout.split('\n')[0], ...parents, '-m', 'Merge pull request #' + p.number).stdout.trim();
  const files = filesOf(p);
  git('update-ref', 'refs/heads/' + p.base, c);
  Object.assign(p, { state: 'MERGED', mergedHead: h, mergedAt: new Date().toISOString(), files, mergeCommit: c });
  save();
  return c;
};
if (args[0] === '__merge') out(doMerge(prOf(args[1]), args[2] || 'merge'));
const [a, b] = args;
if (a === 'pr' && b === 'list') {
  const head = opt('--head'); const base = opt('--base'); const st = opt('--state') || 'open';
  out(state.prs.filter((p) => (!head || p.head === head) && (!base || p.base === base) && (st === 'all' || p.state === st.toUpperCase()))
    .sort((x, y) => y.number - x.number).slice(0, Number(opt('--limit') || 30)).map(view));
}
if (a === 'pr' && b === 'view') fail('no pull requests found for branch "x"');
if (a === 'pr' && b === 'create') {
  const bodyFile = opt('--body-file');
  const p = { number: ++state.next, base: opt('--base'), head: opt('--head'), title: opt('--title'), body: bodyFile ? fs.readFileSync(bodyFile, 'utf8') : (opt('--body') || ''), state: 'OPEN' };
  p.url = 'https://github.com/o/r/pull/' + p.number;
  state.prs.push(p);
  save();
  out(p.url + '\n');
}
if (a === 'pr' && b === 'close') { prOf(args[2]).state = 'CLOSED'; save(); out(''); }
if (a === 'pr' && b === 'comment') { const p = prOf(args[2]); (p.comments = p.comments || []).push(opt('--body')); save(); out(''); }
if (a === 'pr' && b === 'merge') {
  const p = prOf(args[2]);
  const method = ['--merge', '--squash', '--rebase'].find((f) => args.includes(f));
  if (args.includes('--disable-auto')) { p.autoMerge = null; save(); out(''); }
  if (args.includes('--auto')) {
    if (opt('--match-head-commit') && opt('--match-head-commit') !== tip(p.head)) fail('head commit did not match', 1);
    p.autoMerge = (method || '--merge').slice(2);
    save();
    out('');
  }
  doMerge(p, (method || '--merge').slice(2));
  out('');
}
if (a === 'pr' && b === 'checks') out(state.checks[args[2]] || []);
if (a === 'run' && b === 'view') { const r = state.runs[args[2]]; if (!r) fail('no run ' + args[2]); out({ startedAt: r.startedAt }); }
if (a === 'run' && b === 'rerun') out('');
if (a === 'api') {
  const route = args[1];
  if (route === 'graphql') out({ data: { viewer: { login: 'owner' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } });
  if (/^repos\/\{owner\}\/\{repo\}\/rules\/branches\//.test(route)) out([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }]);
  if (/^repos\/\{owner\}\/\{repo\}\/branches\/.*\/protection\/required_status_checks$/.test(route)) fail('gh: Branch not protected (HTTP 404)');
  if (route === 'repos/{owner}/{repo}') out({ default_branch: state.defaultBranch, allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true });
  const files = /^repos\/\{owner\}\/\{repo\}\/pulls\/(\d+)\/files$/.exec(route);
  if (files) out(filesOf(prOf(files[1])).join('\n') + '\n');
  const contents = /^repos\/\{owner\}\/\{repo\}\/contents\/(.*)\?ref=(.*)$/.exec(route);
  if (contents) {
    const ref = decodeURIComponent(contents[2]);
    const spec = (/^[0-9a-f]{40}$/.test(ref) ? ref : 'refs/heads/' + ref) + ':' + contents[1];
    const kind = git('cat-file', '-t', spec);
    if (kind.status !== 0) fail('gh: Not Found (HTTP 404)');
    if (kind.stdout.trim() === 'tree') out(git('ls-tree', '--name-only', spec).stdout.split('\n').filter(Boolean).map((name) => ({ name })));
    out({ name: contents[1].split('/').pop(), encoding: 'base64', content: Buffer.from(git('show', spec).stdout).toString('base64') });
  }
}
fail('simGitHub: unhandled ' + args.join(' '), 99);
`;

export function simGitHub({ origin, defaultBranch = 'main' }) {
  const dir = tmpFolder('devkit-delivery-models-gh-');
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), SIM_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  const file = join(dir, 'state.json');
  writeFileSync(file, JSON.stringify({ next: 10, prs: [], checks: {}, runs: {}, defaultBranch }));
  const env = { PATH: `${bin}:${process.env.PATH}`, SIM_GH_DIR: dir, SIM_GH_ORIGIN: origin };
  const read = () => JSON.parse(readFileSync(file, 'utf8'));
  const edit = (f) => { const s = read(); f(s); writeFileSync(file, JSON.stringify(s)); };
  const call = (...args) => {
    const r = spawnSync(join(bin, 'gh'), args, { env: { ...process.env, ...env }, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`simGitHub ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const calls = () => (existsSync(join(dir, 'calls.log')) ? readFileSync(join(dir, 'calls.log'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return {
    env, dir, calls,
    writes: () => calls().filter((c) => (c[0] === 'pr' && ['create', 'close', 'comment', 'merge', 'reopen', 'edit'].includes(c[1])) || (c[0] === 'run' && c[1] === 'rerun')),
    prs: () => read().prs,
    pr: (n) => read().prs.find((p) => p.number === n),
    gh: (cwd) => makeGh(cwd, { ...process.env, ...env }),
    create: ({ base, head, body = '' }) => Number(call('pr', 'create', '--base', base, '--head', head, '--title', `${head} to ${base}`, '--body', body).split('/').pop()),
    close: (n) => call('pr', 'close', String(n)),
    merge: (n, method = 'merge') => call('__merge', String(n), method),
    setChecks: (n, list) => edit((s) => { s.checks[n] = list; }),
    // Fields of a pull request's view replaced from now on (`mergeStateStatus`, `mergeable`, ...), and its auto-merge method.
    setPr: (n, over) => edit((s) => { const p = s.prs.find((x) => x.number === n); p.over = { ...p.over, ...over }; }),
    setAutoMerge: (n, method) => edit((s) => { s.prs.find((x) => x.number === n).autoMerge = method; }),
    setRun: (id, run) => edit((s) => { s.runs[id] = run; }),
    setDefaultBranch: (name) => edit((s) => { s.defaultBranch = name; }),
  };
}

export const BODY = 'feat\n- AC-1\nopenspec/changes/feat/evidence.md\n';

export const REVIEWS = ['code-quality-reviewer', 'test-coverage-reviewer'];

// Evidence and both reviews at the worktree's head: items 1 to 4 are met while only openspec/ files change after it.
export function prove(wt) {
  const sha = git(wt, 'rev-parse', 'HEAD');
  put(wt, {
    'openspec/changes/feat/evidence.md': `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n`,
    ...Object.fromEntries(REVIEWS.map((r) => [`openspec/changes/feat/reviews/${r}.md`, `Verdict: approved\nCommit: ${sha}\n\n# Review\n`])),
  });
  return commitAll(wt, 'evidence and reviews');
}

export function scenario({ config = `schema: devkit-lite\n${TWO_PRS}` } = {}) {
  const t = roundRepo({ roadmap: '# Roadmap\n', config });
  git(t.main, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  const wt = t.addWt('feat');
  put(wt, {
    'openspec/changes/feat/.openspec.yaml': 'schema: devkit-lite\n',
    'openspec/changes/feat/proposal.md': '<!-- devkit-stage proposal result=passed attempt=1 commit=none -->\n# Proposal\n\n## Acceptance criteria\n\n- AC-1: something\n',
    'openspec/changes/feat/tasks.md': '# Tasks\n\n## 1. Phase\n\n- [x] 1.1 code\n',
    'src/a.ts': 'a\n',
  });
  commitAll(wt, 'code');
  prove(wt);
  git(wt, 'push', '-q', 'origin', 'feat');
  const sim = simGitHub({ origin: t.originDir });
  const env = { ...process.env, ...sim.env, ...SET };
  const s = {
    ...t, wt, sim, env,
    state: (root = wt) => deliver.collectState(root, 'feat', { env }),
    next: (root = wt) => deliver.nextStep(s.state(root)),
    report: () => deliver.buildReport(s.state(), env),
    // What the commit-and-pr agent does for open-prs: both pull requests from the task branch.
    openBoth: () => ({ base: sim.create({ base: 'main', head: 'feat', body: BODY }), test: sim.create({ base: 'develop', head: 'feat', body: BODY }) }),
    // A fix on the task branch, committed with its evidence and reviews.
    fix: (text = 'fixed\n') => { put(wt, { 'src/a.ts': text }); commitAll(wt, 'fix'); return { fix: git(wt, 'rev-parse', 'HEAD'), proof: prove(wt) }; },
    ancestorOf: (sha, head) => spawnSync('git', ['--git-dir', t.originDir, 'merge-base', '--is-ancestor', sha, head]).status === 0,
  };
  return s;
}

// The support branch and its resolution round under two-prs (moved from delivery-models.test.mjs, coordinator-loop-fixes D-16):
// the steps the session, the implementer and the reviewers take, shared with change-loop-declared.test.mjs.
export const REQUIRED = ['code-quality-reviewer', 'test-coverage-reviewer'];
export const SUPPORT_BRANCH = 'feat-develop';

// A commit on origin's test branch that conflicts with the task branch (both add src/a.ts) and brings a file of its own.
export function conflictOnTest(s) {
  const o = s.addWt('other', { from: 'origin/develop' });
  put(o, { 'src/a.ts': 'develop\n', 'dev.txt': 'dev\n' });
  const sha = commitAll(o, 'develop edits a.ts');
  git(o, 'push', '-q', 'origin', 'HEAD:refs/heads/develop');
  git(s.main, 'fetch', '-q', 'origin');
  return sha;
}

// What the session does for merge-into-support (D-8) and the implementer for resolve-support-conflict.
export function mergeIntoSupport(s, n) {
  if (n.create) git(s.main, 'worktree', 'add', '-q', '-b', n.branch, n.root, 'feat');
  try { git(n.root, 'merge', '--no-ff', '--no-edit', n.from); } catch { /* a conflict is left in the worktree */ }
}
export function resolveSupport(n, text = 'merged\n') {
  put(n.root, Object.fromEntries(n.paths.map((f) => [f, text])));
  for (const f of n.paths) git(n.root, 'add', f);
  git(n.root, 'commit', '-q', '--no-edit');
  return git(n.root, 'rev-parse', 'HEAD');
}
// What the two reviewers and the consolidation leave in the task worktree, committed and pushed as the push row does.
export function reviewResolution(s, commit, { verdict = {}, findings = {}, consensus = 'PASS (round 1/2)' } = {}) {
  const files = { 'openspec/changes/feat/resolution.md': `# Resolution review\n\nConsensus: ${consensus}\n` };
  for (const r of REQUIRED) {
    files[`openspec/changes/feat/reviews/resolution/${r}.md`] = `Verdict: ${verdict[r] ?? 'approved'}\nCommit: ${commit}\n\n## ${r} - feat\n\n### Findings\n${findings[r] ?? '- [nit] F1 src/a.ts:1 reads fine\n'}`;
  }
  put(s.wt, files);
  commitAll(s.wt, 'resolution review');
  git(s.wt, 'push', '-q', 'origin', 'feat');
}
export const ARCHIVED_FEAT = 'openspec/changes/archive/2026-11-09-feat';
const RETRO = '# Retro: feat\n\n## Proposed updates\n\nNone.\n';
export const TEST_ARCHIVE = 'chore/archive-feat-develop';

// Both change pull requests merged, then the archive of `feat` committed on its own branch in the task worktree, pushed, with its
// pull request to main open. `testArchive` does what the commit-and-pr agent does for open-test-archive-pr.
export function archiving(options) {
  const s = scenario(options);
  const { base, test } = s.openBoth();
  s.sim.merge(test);
  s.sim.merge(base);
  git(s.wt, 'fetch', '-q', 'origin');
  git(s.wt, 'switch', '-q', '-c', 'chore/archive-feat', 'origin/main');
  put(s.wt, { 'openspec/changes/feat/retro.md': RETRO });
  mkdirSync(join(s.wt, 'openspec', 'changes', 'archive'), { recursive: true });
  renameSync(join(s.wt, 'openspec', 'changes', 'feat'), join(s.wt, ARCHIVED_FEAT));
  commitAll(s.wt, 'archive feat');
  s.commits = git(s.wt, 'rev-list', '--reverse', 'origin/main..HEAD').split('\n');
  git(s.wt, 'push', '-q', 'origin', 'chore/archive-feat');
  s.basePr = s.sim.create({ base: 'main', head: 'chore/archive-feat', body: 'archive' });
  s.testWt = join(s.main, '.claude', 'worktrees', 'archive-feat-develop');
  // The worktree of the test archive branch, from origin/develop; the cherry-pick may be left conflicted.
  s.cutTest = ({ pick = true } = {}) => {
    git(s.main, 'worktree', 'add', '-q', '-b', TEST_ARCHIVE, s.testWt, 'origin/develop');
    if (!pick) return null;
    return spawnSync('git', ['-C', s.testWt, '-c', 'user.name=t', '-c', 'user.email=t@t.invalid', 'cherry-pick', ...s.commits], { encoding: 'utf8' });
  };
  s.testPr = () => { git(s.testWt, 'push', '-q', 'origin', TEST_ARCHIVE); return s.sim.create({ base: 'develop', head: TEST_ARCHIVE, body: 'archive' }); };
  return s;
}

// ---------------------------------------------------------------- from compozy-driver.test.mjs

const FAKE = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, 'calls.log'), JSON.stringify({ argv, cwd: process.cwd() }) + '\\n');
const replies = JSON.parse(fs.readFileSync(path.join(__dirname, 'replies.json'), 'utf8'));
const key = argv[0] === '--version' ? '--version' : argv.slice(0, 2).join(' ');
const loop = argv.includes('--loop') ? argv[argv.indexOf('--loop') + 1] : null;
const r = (loop && replies[key + ' ' + loop]) || replies[key] || {};
if (r.stderr) process.stderr.write(r.stderr);
process.stdout.write(r.stdout === undefined ? '' : typeof r.stdout === 'string' ? r.stdout : JSON.stringify(r.stdout));
process.exitCode = r.code === undefined ? 0 : r.code;
`;

// The one helper that builds the fake `compozy` and a temporary COMPOZY_HOME (both folders from `tmpFolder`); the suites that
// need the fake import it from this module. `replies` maps a subcommand ("loop runs", "workspace info", "--version") to
// { code, stdout (a string or a value to print as JSON), stderr }; an unlisted subcommand exits 0 and prints nothing. A call with
// `--loop <name>` reads the key "<subcommand> <name>" ("loop runs devkit-roadmap") first.
// `daemon(t)` listens on the home's socket and closes the server when the test `t` ends.
export function fakeCompozy(replies = {}) {
  const dir = tmpFolder('devkit-compozy-bin-');
  const home = tmpFolder('devkit-ch-');
  const bin = join(dir, 'compozy');
  writeFileSync(bin, FAKE);
  chmodSync(bin, 0o755);
  const fake = {
    bin, home, dir,
    env: { COMPOZY_BIN: bin, COMPOZY_HOME: home },
    set(next) { writeFileSync(join(dir, 'replies.json'), JSON.stringify(next)); return fake; },
    calls() {
      const file = join(dir, 'calls.log');
      return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    },
    argvs() { return fake.calls().map((c) => c.argv); },
    async daemon(t) {
      const server = createServer();
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(join(home, 'daemon.sock'), resolve); });
      t.after(() => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); }));
      return fake;
    },
  };
  return fake.set(replies);
}

// ---------------------------------------------------------------- from change-loop.test.mjs (the decision, the plan, the transcripts)

// Every env a test of the two loops builds blanks the branch variables together (CONTRIBUTING.md, testing rules).
// change-loop.test.mjs and roadmap-loop.test.mjs each had this pair under the names SET and cleanEnv.
export const SET_LOOP = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', CLAUDE_CODE_SESSION_ID: '' };
export const cleanEnvLoop = { ...process.env, ...SET_LOOP };

const SCHEMAS = join(here, '..', 'schemas');
export const FLOWS = Object.fromEntries(['devkit', 'devkit-lite'].map((s) => [s, JSON.parse(readFileSync(join(SCHEMAS, s, 'flow.json'), 'utf8'))]));
const CTX = (over = {}) => ({ id: 'feat', script: 'devkit', root: '/w/feat', branch: 'feat', lang: 'en', filesLanguage: 'en', ...over });
export const stageOf = (flow, id) => flow.stages.find((s) => s.id === id);
const stagesOf = (flow, over = {}) => flow.stages.map((s, i) => ({ n: i + 1, id: s.id, title: s.title.en, state: 'passed', reasonCode: 'passed', params: {}, ...over[s.id] }));
export const nextOf = (flow, stage, reasonCode, params = {}) => {
  const s = stageOf(flow, stage);
  return { n: flow.stages.indexOf(s) + 1, stage, role: s.role, skills: s.skills ?? [], reasonCode, params, reason: 'x', progressKey: `${stage}@abc123` };
};
export const endOf = (state, stage, reasonCode, params = {}) => ({ state, stage, reasonCode, params, reason: 'x' });
export const reportOf = (flow, { next = null, end = null, stages = {}, script = 'current', schema = 'devkit' } = {}) => (
  { version: 1, change: 'feat', schema, script, head: 'h', stages: stagesOf(flow, stages), next, end, previous: null });
const APPROVAL = { status: null, recorded: null, readiness: 'sha256:abcdef012345', ok: false };
export const rowOf = (step, extra = {}) => ({ next: { step, reason: 'r', actor: 'x', ...extra }, state: 's', delivered: {} });
export function run(over = {}) {
  const flow = over.flow ?? FLOWS.devkit;
  return decide({
    ctx: CTX(over.ctx), flow, report: over.report ?? reportOf(flow, over.rep), after: null, fingerprint: 'abc123', approval: APPROVAL,
    hasProposal: false, flags: [], archiving: false, row: null, ...over.facts,
  });
}
export const head = (stage, c0, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${c0} -->\n`;
// Invariant (T-7, loop, change-loop.test.mjs): a fixture change opened at the grill stands right before its proposal, so the planner is its next role:
// the decisions stage comes first and is part of what the grill leaves behind.
export const PLAN_FILES = { requirements: 'requirements.md', decisions: 'decisions.md', proposal: 'proposal.md', specs: 'specs/s/spec.md', design: 'design.md', tasks: 'tasks.md', readiness: 'readiness.md', approval: 'approval.md' };
// A committed `devkit` change `feat` in the main checkout with the plan files of `have` written as passed (`results` and
// `attempts` per stage), the ship mode plan (no ship key). `headerless` writes no header line.
export function planChange({ have, results = {}, attempts = {}, headerless = false } = {}) {
  const root = gitRepo({ config: 'schema: devkit\n' });
  const c0 = git(root, 'rev-parse', 'HEAD');
  const files = { '.openspec.yaml': 'schema: devkit\n' };
  for (const stage of have) {
    const body = stage === 'readiness' ? '# Readiness\n\n- Status: APPROVED\n' : stage === 'tasks' ? '# Tasks\n\n- [ ] 1.1 a\n' : `# ${stage}\n`;
    files[PLAN_FILES[stage]] = `${headerless ? '' : head(stage, c0, results[stage] ?? 'passed', attempts[stage] ?? 1)}${body}`;
  }
  put(root, Object.fromEntries(Object.entries(files).map(([f, b]) => [`openspec/changes/feat/${f}`, b])));
  commitAll(root, 'change files');
  return root;
}
// The marker lines come first (`devkit-run:`, then `devkit-end:` on an end); the JSON action follows them.
export const actionOf = (stdout) => JSON.parse(stdout.split('\n').filter((l) => !/^devkit-(run|end): /.test(l)).join('\n'));
export const SESSION = 'session-0001';
// Transcript lines in the stored forms the probe of D-12a recorded (Claude Code 2.1.326, session ids replaced).
const LINE_BASE = { parentUuid: null, isSidechain: false, userType: 'external', entrypoint: 'sdk-cli', cwd: '/scratch/project', sessionId: SESSION, version: '2.1.326', gitBranch: 'main' };
export const stored = (extra) => JSON.stringify({ ...LINE_BASE, uuid: 'uuid-0001', timestamp: '2026-11-20T10:00:00.000Z', ...extra });
export const commandText = (name, args) => `<command-message>${name.replace(/^.*:|^\//g, '')}</command-message>\n<command-name>${name}</command-name>\n<command-args>${args}</command-args>`;
// A typed command: a line of type user whose message.content is a string.
export const typedLine = (args, name = '/devkit') => stored({ type: 'user', message: { role: 'user', content: commandText(name, args) } });
// The tool result of a command that printed `text`, in one of the three stored forms: `both` (content a string, and
// toolUseResult.stdout), `stdout` (the marker only in toolUseResult.stdout) and `blocks` (content a list of text blocks).
export const toolResultLine = (text, form = 'both') => stored({
  type: 'user',
  message: { role: 'user', content: [{ tool_use_id: 'toolu-0001', type: 'tool_result', content: form === 'blocks' ? [{ type: 'text', text: 'first block' }, { type: 'text', text }] : form === 'stdout' ? 'ok' : text, is_error: false }] },
  ...(form === 'blocks' ? {} : { toolUseResult: { stdout: text, stderr: '', interrupted: false, isImage: false, noOutputExpected: false } }),
});
// A command that printed `devkit-run: <id>`.
export const runLine = (id, form = 'both') => toolResultLine(`devkit-run: ${id}\n{"version":1}`, form);
export const assistantLine = () => stored({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
export const transcriptOf = (lines) => {
  const file = join(sandbox(), `${SESSION}.jsonl`);
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
};
export const stopInput = (root, transcript, extra = {}) => ({ session_id: SESSION, transcript_path: transcript, cwd: root, stop_hook_active: false, background_tasks: [], ...extra });

// ---------------------------------------------------------------- from roadmap-loop.test.mjs (the actions, the world, the commands)

// A roadmap of one round: each argument is the text after "- " of a line, so it carries its own checkbox.
export const ROUND = (...lines) => parseRoadmap(`# Roadmap\n\n## Round 1: flags\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
export const classify = ({ lines, archived = [], open = [], previous = [], declared = {} }) => (
  classifyLines(ROUND(...lines), { archived: new Set(archived), open: new Set(open), previous: new Set(previous), declared }));
// The actions of change-loop as decideRoadmap reads them (the fields of a real action, nothing the loop does not read).
export const base = (id) => ({ version: 1, change: id, script: 'devkit', root: `/w/${id}`, branch: id, filesLanguage: 'en' });
export const agentAct = (id, stage = 'proposal', over = {}) => ({
  ...base(id), kind: 'agent', stage, stageTitle: 'Proposal', role: 'change-planner', skills: [], agent: 'devkit-core:change-planner',
  brief: `Change ${id} (devkit script), stage ${stage}: write the plan.`, progressKey: `${stage}/${stage}@abc123`, model: 'opus', ...over,
});
export const grillAct = (id) => ({
  ...base(id), kind: 'grill', stage: 'requirements', stageTitle: 'Requirements', role: 'change-coordinator', skills: ['requirements-grill'], progressKey: 'requirements@abc123', model: 'opus',
});
export const endAct = (id, state, why, params = {}, over = {}) => ({
  ...base(id), kind: 'end', stage: null, stageTitle: null, role: null, skills: [], end: { state, why }, params: { id, ...params }, reply: 'x', ...over,
});
export const ownerAct = (id, why = 'waiting-approval') => endAct(id, 'waiting-for-owner', why, {}, { stage: 'approval', stageTitle: 'Plan approval' });
// The facts of one decision: a roadmap, what is archived, the open changes' actions and the run's bookkeeping.
export function world(over = {}) {
  const { lines = [], archived = [], actions = {}, previous = [], declared = {}, inflight = {}, openExtra = [], ...rest } = over;
  const open = [...Object.keys(actions), ...Object.keys(inflight), ...previous, ...openExtra];
  return {
    lang: 'en', places: 3, stopping: false, holding: false, load: 10, limit: 80, hasRoadmap: true,
    lines: classify({ lines, archived, open, previous, declared }),
    actions, inflight, declared, announced: {}, starting: [], held: false, asking: null, after: {}, wheres: {}, phaseTotals: {}, unfinished: [],
    ...rest,
  };
}
export const OFFLINE = () => ({ status: 1, stdout: '', stderr: 'offline' });
export const FLAGS = ['--lang', 'en', '--load-limit', '80'];
export const roadmapText = (...lines) => `# Roadmap\n\n## Round 1: flags\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
export const projectWith = (roadmap, { config = 'schema: devkit\n' } = {}) => gitRepo({ config, files: roadmap === null ? {} : { 'openspec/roadmap.md': roadmap } });
// One command of roadmap-loop, with no GitHub and the load handed in (a percentage).
export const cmd = (cwd, argv, { stdin = '', load = 10, env = cleanEnv, ...rest } = {}) => loopModule.main(argv, { cwd, env, stdin, gh: OFFLINE, load: () => load, ...rest });
export const doRun = (cwd, word = '', { session = 'S1', extra = [], ...opts } = {}) => cmd(cwd, ['run', ...FLAGS, '--session', session, ...extra], { stdin: word, ...opts });
export const doNext = (cwd, extra = [], opts = {}) => cmd(cwd, ['next', ...FLAGS, ...extra], opts);
export const doStatus = (cwd, opts = {}) => cmd(cwd, ['status', ...FLAGS], opts);
export const jsonOf = (stdout) => { const lines = stdout.split('\n'); return JSON.parse(lines.slice(lines.indexOf('{')).join('\n')); };
export const runFileOf = (cwd) => loopModule.runFilePath(cwd);
export const stateOf = (cwd) => JSON.parse(readFileSync(runFileOf(cwd), 'utf8'));
export const putRun = (cwd, patch) => {
  mkdirSync(dirname(runFileOf(cwd)), { recursive: true });
  writeFileSync(runFileOf(cwd), JSON.stringify({
    version: 1, session: 'S1', places: 1, stopping: false, asking: null, inflight: {}, declared: {}, announced: {}, starting: [], held: false, holding: false,
    changeSessions: false, startedSessions: {}, turn: null, ...patch,
  }));
};
// The event lines a command shows: the ones it printed itself, then the `lines` of its decision.
export const events = (stdout) => [...stdout.split('\n').filter((l) => l.startsWith('▸ ')), ...jsonOf(stdout).lines];
// `flow` is the version the change records as `x-devkit-flow`; null records none (a change opened before devkit-openspec 0.31.0).
export const pinLine = (flow) => (flow === null ? '' : `x-devkit-flow: ${flow}\n`);
export const addOpen = (root, id, flow = null) => { put(root, { [`openspec/changes/${id}/.openspec.yaml`]: `schema: devkit\n${pinLine(flow)}` }); commitAll(root, `open ${id}`); };

// The merge-mode project of the delivery tests: its settings, its required workflow file and the gh answers of a repository whose
// branch rules require `check` and `devkit-reviews` (shared by conduct-check.test.mjs and the change loop's tests).
export const MERGE_CONFIG = 'schema: devkit-lite\nship:\n  devkit-lite: merge\n  devkit: merge\nmerge_method: squash\n';
export const MERGE_FILES = { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' };
export function presetMerge(g) {
  g.set('api-GET-repos__owner___repo__rules_branches_main', { stdout: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }] });
  g.set('api-GET-repos__owner___repo__branches_main_protection_required_status_checks', { exit: 1, stderr: 'gh: Branch not protected (HTTP 404)\n' });
}
