// Fixtures the devkit-openspec hook tests share. No test lives here and nothing is made when the module is
// imported: a folder, a spawn or a git call happens only when one of its functions runs. A test file never imports
// another test file (scripts/test-suite.mjs refuses it); what two test files share is moved to this module.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpFolder } from './test-tmp.mjs';
import { mkdirSync, cpSync, writeFileSync, chmodSync, rmSync as fsRm, existsSync, readFileSync, realpathSync, renameSync } from 'node:fs';
import * as deliver from './deliver-check.mjs';
import { nextStep, collectState } from './deliver-check.mjs';
import { makeGh } from './merge-setup.mjs';
import { conductState } from './conduct-check.mjs';

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
const view = (p) => ({ number: p.number, url: p.url, state: p.state, headRefOid: p.state === 'MERGED' ? p.mergedHead : tip(p.head), baseRefName: p.base, headRefName: p.head, mergeable: p.state === 'OPEN' ? mergeable(p) : 'UNKNOWN', body: p.body || '', mergedAt: p.mergedAt || null, autoMergeRequest: null, mergeStateStatus: 'CLEAN' });
const filesOf = (p) => (p.state === 'MERGED' ? p.files : git('diff', '--name-only', tip(p.base) + '...' + tip(p.head)).stdout.split('\n').filter(Boolean));
const prOf = (n) => { const p = state.prs.find((x) => x.number === Number(n)); if (!p) fail('no pull request #' + n); return p; };

if (args[0] === '__merge') {
  const p = prOf(args[1]);
  if (p.state !== 'OPEN') fail('not open');
  const b = tip(p.base); const h = tip(p.head);
  const m = git('merge-tree', '--write-tree', b, h);
  if (m.status !== 0) fail('conflict');
  const parents = (args[2] || 'merge') === 'squash' ? ['-p', b] : ['-p', b, '-p', h];
  const c = git('commit-tree', m.stdout.split('\n')[0], ...parents, '-m', 'Merge pull request #' + p.number).stdout.trim();
  const files = filesOf(p);
  git('update-ref', 'refs/heads/' + p.base, c);
  Object.assign(p, { state: 'MERGED', mergedHead: h, mergedAt: new Date().toISOString(), files });
  save();
  out(c);
}
const [a, b] = args;
if (a === 'pr' && b === 'list') {
  const head = opt('--head'); const base = opt('--base'); const st = opt('--state') || 'open';
  out(state.prs.filter((p) => (!head || p.head === head) && (!base || p.base === base) && (st === 'all' || p.state === st.toUpperCase()))
    .sort((x, y) => y.number - x.number).slice(0, Number(opt('--limit') || 30)).map(view));
}
if (a === 'pr' && b === 'view') fail('no pull requests found for branch "x"');
if (a === 'pr' && b === 'create') {
  const p = { number: ++state.next, base: opt('--base'), head: opt('--head'), title: opt('--title'), body: opt('--body') || '', state: 'OPEN' };
  p.url = 'https://github.com/o/r/pull/' + p.number;
  state.prs.push(p);
  save();
  out(p.url + '\n');
}
if (a === 'pr' && b === 'close') { prOf(args[2]).state = 'CLOSED'; save(); out(''); }
if (a === 'pr' && b === 'checks') out(state.checks[args[2]] || []);
if (a === 'run' && b === 'view') { const r = state.runs[args[2]]; if (!r) fail('no run ' + args[2]); out({ startedAt: r.startedAt }); }
if (a === 'run' && b === 'rerun') out('');
if (a === 'api') {
  const route = args[1];
  if (route === 'graphql') out({ data: { viewer: { login: 'owner' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } });
  if (route === 'repos/{owner}/{repo}') out({ default_branch: state.defaultBranch, allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true });
  const files = /^repos\/\{owner\}\/\{repo\}\/pulls\/(\d+)\/files$/.exec(route);
  if (files) out(filesOf(prOf(files[1])).join('\n') + '\n');
  const contents = /^repos\/\{owner\}\/\{repo\}\/contents\/(.*)\?ref=(.*)$/.exec(route);
  if (contents) {
    const spec = 'refs/heads/' + decodeURIComponent(contents[2]) + ':' + contents[1];
    const kind = git('cat-file', '-t', spec);
    if (kind.status !== 0) fail('gh: Not Found (HTTP 404)');
    if (kind.stdout.trim() === 'tree') out(git('ls-tree', '--name-only', spec).stdout.split('\n').filter(Boolean).map((name) => ({ name })));
    out({ name: contents[1].split('/').pop(), encoding: 'base64', content: Buffer.from(git('show', spec).stdout).toString('base64') });
  }
}
fail('simGitHub: unhandled ' + args.join(' '), 99);
`;

function simGitHub({ origin, defaultBranch = 'main' }) {
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
    writes: () => calls().filter((c) => (c[0] === 'pr' && ['create', 'close', 'merge', 'reopen', 'edit'].includes(c[1])) || (c[0] === 'run' && c[1] === 'rerun')),
    prs: () => read().prs,
    pr: (n) => read().prs.find((p) => p.number === n),
    gh: (cwd) => makeGh(cwd, { ...process.env, ...env }),
    create: ({ base, head, body = '' }) => Number(call('pr', 'create', '--base', base, '--head', head, '--title', `${head} to ${base}`, '--body', body).split('/').pop()),
    close: (n) => call('pr', 'close', String(n)),
    merge: (n, method = 'merge') => call('__merge', String(n), method),
    setChecks: (n, list) => edit((s) => { s.checks[n] = list; }),
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
