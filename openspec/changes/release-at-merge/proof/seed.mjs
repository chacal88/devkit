// The seed of the release-at-merge real-run proof (design D-16, task 6.1): scratch projects with a bare `origin`, the release files of a
// two-pack marketplace, the CI pin lines of docs/openspec-flow.md, `devkit.release_tag`, and a `gh` stub that answers from a JSON file the
// case writes and reads heads from the bare origin (no GitHub call is ever made). Every check and step runs this worktree's own
// plugins/openspec/hooks/*.mjs. Run through cases.mjs; importing it builds nothing (it only refuses a missing or /tmp TMPDIR).
//
// TMPDIR must be set to a private folder (never /tmp on this machine); every project lives under $TMPDIR/devkit-proof-release-at-merge.

import { spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROOF = dirname(fileURLToPath(import.meta.url));
export const WT = resolve(PROOF, '..', '..', '..', '..');
export const DEV = join(WT, 'plugins', 'openspec', 'hooks');
export const TMP = process.env.TMPDIR ?? '';
if (!TMP || TMP === '/tmp' || TMP.startsWith('/tmp/')) throw new Error('set TMPDIR to a private folder outside /tmp');
export const CASES = join(TMP, 'devkit-proof-release-at-merge');

// ---------------------------------------------------------------- the record

const fenceFor = (text) => '`'.repeat(Math.max(3, ...[...String(text).matchAll(/`{3,}/g)].map((m) => m[0].length + 1)));
// Absolute paths are written with the names the record's opening paragraph gives them.
export const short = (text) => String(text).split(DEV).join('$DEV').split(WT).join('$WT').split(CASES).join('$CASES').split(TMP).join('$TMPDIR');

// The text of real-run.md, written as the cases run (each `flush` appends what was logged since the last one).
export class Record {
  constructor(file) { this.file = file; this.parts = []; }
  text(s) { this.parts.push(`${s}\n`); }
  block(s) { const body = short(s).replace(/\n+$/, ''); const f = fenceFor(body); this.parts.push(`${f}text\n${body}\n${f}\n`); }
  flush() { if (this.parts.length) appendFileSync(this.file, `${this.parts.join('\n')}\n`); this.parts = []; }
}

// ---------------------------------------------------------------- running things

export const IDENT = {
  GIT_AUTHOR_NAME: 'devkit proof', GIT_AUTHOR_EMAIL: 'proof@devkit.invalid', GIT_COMMITTER_NAME: 'devkit proof', GIT_COMMITTER_EMAIL: 'proof@devkit.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_EDITOR: 'true',
};
// The variables a CI run or a session sets, blanked together.
export const BLANK = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '', CLAUDE_CODE_SESSION_ID: '', DEVKIT_HOST: 'cli', CLAUDE_CODE_ENTRYPOINT: '' };
const BASE_ENV = { ...process.env, ...BLANK, ...IDENT, TMPDIR: TMP };

const quote = (a) => (/^[A-Za-z0-9_./:=@%+,$-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);

// Runs `argv` in `cwd`: { code, out, err }. With `rec` the command (and the folder it runs in) and its whole output go to the record.
// A code outside `expect` (null: any) throws, so a case never goes on past a step that did not do what it says.
export function sh(cwd, argv, { env = BASE_ENV, rec = null, expect = [0], input = undefined, label = null } = {}) {
  const r = spawnSync(argv[0], argv.slice(1), { cwd, env, encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024 });
  const res = { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
  if (rec) rec.block(`(in ${cwd})\n$ ${label ?? argv.map(quote).join(' ')}\n${res.out}${res.err}${res.out || res.err ? '' : '(no output)\n'}[exit ${res.code}]`);
  if (expect && !expect.includes(res.code)) throw new Error(`${argv.join(' ')} in ${cwd} exited ${res.code}: ${res.err || res.out}`);
  return res;
}
export const git = (cwd, ...args) => sh(cwd, ['git', ...args]).out.trim();
export const put = (root, files) => {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), body);
  }
};
export const read = (root, f) => readFileSync(join(root, f), 'utf8');
export const commitAll = (root, message) => { git(root, 'add', '-A'); git(root, 'commit', '-q', '--allow-empty', '-m', message); return git(root, 'rev-parse', 'HEAD'); };
export const hash12 = (path) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12)}`;

// ---------------------------------------------------------------- the seed files

export const json = (obj) => `${JSON.stringify(obj, null, 2)}\n`;
export const manifest = (name, version) => json({ name, version, description: `the ${name} pack` });
export const marketplace = (metadata, packs) => json({
  name: 'devkit', metadata: { description: 'two packs', version: metadata },
  plugins: Object.entries(packs).map(([name, version]) => ({ name, source: `./plugins/${name.replace(/^devkit-/, '')}`, description: `the ${name} pack`, version })),
});
// The flow page around its CI pin: the three pin-marker lines of this repository's docs/openspec-flow.md, with prose before and after.
export const flowPage = (version) => [
  '# The OpenSpec flow', '', 'How a change moves from its plan to its merge in this project.', '',
  '## Records', '', 'The records of this project live in docs/adr/.', '', 'Line one of the records section.', 'Line two of the records section.', 'Line three of the records section.', '',
  '## CI', '',
  `          # pinned to the commit of v${version} (a tag can move; a commit cannot)`,
  `          base=https://raw.githubusercontent.com/o/devkit/<commit sha of v${version}>/plugins/openspec/hooks`,
  '', 'ci line one', 'ci line two', 'ci line three', '',
  `Pin the commit sha of the release tag (\`v${version}\` above), not the tag; by hand, run \`gh api repos/o/devkit/git/ref/tags/v${version}\`.`,
  '', '## Notes', '', 'Note one.', 'Note two.', 'Note three.', '',
].join('\n');
export const CHANGELOG0 = '# Changelog\n\n## 1.0.0 — first release\n\n- **devkit-openspec** 1.0.0: the flow\n- **devkit-core** 1.0.0: the agents\n';
export const GUIDE0 = [
  '# Guide', '', '## Section A', '', 'A line one.', 'A line two.', 'A line three.', 'A line four.', '',
  '## Section B', '', 'B line one.', 'B line two.', 'B line three.', 'B line four.', '',
  '## Section C', '', 'C line one.', 'C line two.', 'C line three.', 'C line four.', '',
].join('\n');
// A stand-in for this repository's scripts/gen-catalog.py: it lists each pack with its version, so a release visibly moves docs/catalog.md.
export const GEN_CATALOG = `#!/usr/bin/env python3
"""Writes docs/catalog.md from each plugins/<pack>/.claude-plugin/plugin.json (the proof's stand-in for gen-catalog.py)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
rows = []
for manifest in sorted(ROOT.glob("plugins/*/.claude-plugin/plugin.json")):
    data = json.loads(manifest.read_text(encoding="utf-8"))
    rows.append(f"| {data['name']} | {data['version']} |")
(ROOT / "docs" / "catalog.md").write_text("# Catalog\\n\\n| Pack | Version |\\n|---|---|\\n" + "\\n".join(rows) + "\\n", encoding="utf-8")
`;
export const catalog = (packs) => `# Catalog\n\n| Pack | Version |\n|---|---|\n${Object.entries(packs).sort(([a], [b]) => a.localeCompare(b)).map(([n, v]) => `| ${n} | ${v} |`).join('\n')}\n`;
export const RELEASE_FILE = 'plugins/openspec/.claude-plugin/plugin.json';

// The two-pack marketplace at 1.0.0: both manifests, the marketplace, the changelog, the flow page with its pins, the catalog and its
// generator, one numbered ADR, a guide the changes cite their records in, and a code file of each pack.
export const marketFiles = () => ({
  [RELEASE_FILE]: manifest('devkit-openspec', '1.0.0'),
  'plugins/core/.claude-plugin/plugin.json': manifest('devkit-core', '1.0.0'),
  'plugins/openspec/hooks/flow.mjs': 'export const flow = 1;\n',
  'plugins/core/README.md': '# devkit-core\n\nThe agents of the core pack.\n',
  '.claude-plugin/marketplace.json': marketplace('1.0.0', { 'devkit-openspec': '1.0.0', 'devkit-core': '1.0.0' }),
  'CHANGELOG.md': CHANGELOG0,
  'docs/openspec-flow.md': flowPage('1.0.0'),
  'docs/catalog.md': catalog({ 'devkit-core': '1.0.0', 'devkit-openspec': '1.0.0' }),
  'scripts/gen-catalog.py': GEN_CATALOG,
  'docs/adr/0001-start.md': '# ADR 0001: start\n\n- Status: accepted\n',
  'docs/guide.md': GUIDE0,
  'src/app.ts': 'export const app = 1;\n',
  '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n',
  '.gitignore': '.claude/\n',
});
// A consumer project of AC-8 and AC-9: an app whose release file is package.json, with a root CHANGELOG.md and docs/adr/ unless left out.
export const consumerFiles = ({ changelog = true, adr = true } = {}) => ({
  'package.json': json({ name: 'app', version: '1.4.0', private: true }),
  ...(changelog ? { 'CHANGELOG.md': '# Changelog\n\n## 1.4.0 — the last release\n\n- the app as it was\n' } : {}),
  ...(adr ? { 'docs/adr/0001-start.md': '# ADR 0001: start\n\n- Status: accepted\n' } : {}),
  'src/app.ts': 'export const app = 1;\n',
  '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n',
  '.gitignore': '.claude/\n',
});
export const MERGE_CONFIG = `schema: devkit\nship:\n  devkit: merge\n  devkit-lite: merge\ndevkit:\n  release_tag: ${RELEASE_FILE}\n`;
export const TRAIN_CONFIG = `schema: devkit\ndevkit:\n  delivery:\n    model: trunk-auto\n    train: "true"\n  release_tag: ${RELEASE_FILE}\n`;

// ---------------------------------------------------------------- the gh stub

export const GREEN = [{ name: 'check', state: 'SUCCESS', bucket: 'pass', link: 'https://ci.invalid/check' }, { name: 'devkit-reviews', state: 'SUCCESS', bucket: 'pass', link: 'https://ci.invalid/devkit-reviews' }];

// The stub: a pull request lives in the JSON file DEVKIT_PROOF_GH names; its head and base are read live from the bare origin, so a push
// moves it as on GitHub. `mergeable` comes from `git merge-tree`, `mergeStateStatus` is DIRTY on a conflict, BEHIND when the base tip is
// not in the head, else CLEAN. `gh pr merge --auto` records auto-merge; `gh __merge <n>` is GitHub merging it once its rules pass (a commit in
// the origin, by the auto-merge method when one is on), and like GitHub it marks every other open pull request whose head the new base holds as merged by that commit
// (how a train's boarded pull requests end). The release reads of ADR 0019 (`pulls/<n>`, `git/commits/<sha>`, `git/ref/tags/<tag>`) and
// the contents reads are answered from the origin. Every call is appended to the `.calls.log` beside the JSON file.
export const GH_STUB = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const file = process.env.DEVKIT_PROOF_GH;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const origin = state.origin;
const args = process.argv.slice(2);
const save = () => fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
fs.appendFileSync(file.replace(/\.json$/, '.calls.log'), JSON.stringify(args) + '\n');
const ident = { GIT_AUTHOR_NAME: 'github stub', GIT_AUTHOR_EMAIL: 'stub@devkit.invalid', GIT_COMMITTER_NAME: 'github stub', GIT_COMMITTER_EMAIL: 'stub@devkit.invalid', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
const git = (...a) => cp.spawnSync('git', ['--git-dir', origin, ...a], { encoding: 'utf8', env: { ...process.env, ...ident }, maxBuffer: 64 * 1024 * 1024 });
const tip = (b) => { const r = git('rev-parse', '--verify', '-q', 'refs/heads/' + b); return r.status === 0 ? r.stdout.trim() : null; };
const ancestor = (a, b) => git('merge-base', '--is-ancestor', a, b).status === 0;
const out = (v) => { process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v)); process.exit(0); };
const fail = (m, code) => { process.stderr.write(m + '\n'); process.exit(code || 1); };
const opt = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const mergeable = (p) => { const b = tip(p.base); const h = tip(p.head); if (!b || !h) return 'UNKNOWN'; return git('merge-tree', '--write-tree', b, h).status === 0 ? 'MERGEABLE' : 'CONFLICTING'; };
const mergeState = (p) => { if (p.state !== 'OPEN') return 'UNKNOWN'; if (mergeable(p) === 'CONFLICTING') return 'DIRTY'; const b = tip(p.base); const h = tip(p.head); return b && h && !ancestor(b, h) ? 'BEHIND' : 'CLEAN'; };
const view = (p) => ({ number: p.number, url: p.url, state: p.state, headRefOid: p.state === 'MERGED' ? p.mergedHead : tip(p.head), baseRefName: p.base, headRefName: p.head, mergeable: p.state === 'OPEN' ? mergeable(p) : 'UNKNOWN', body: p.body || '', title: p.title || '', mergedAt: p.mergedAt || null, mergeCommit: p.mergeCommit ? { oid: p.mergeCommit } : null, autoMergeRequest: p.autoMerge ? { mergeMethod: p.autoMerge } : null, mergeStateStatus: mergeState(p), ...(p.over || {}) });
const diffFiles = (b, h) => git('diff', '--name-only', git('merge-base', b, h).stdout.trim(), h).stdout.split('\n').filter(Boolean);
const filesOf = (p) => (p.state === 'MERGED' ? p.files : diffFiles(tip(p.base), tip(p.head)));
const prOf = (n) => { const p = state.prs.find((x) => x.number === Number(n)); if (!p) fail('no pull request #' + n); return p; };
const doMerge = (p, method) => {
  if (p.state !== 'OPEN') fail('pull request #' + p.number + ' is not open');
  const b = tip(p.base); const h = tip(p.head);
  const m = git('merge-tree', '--write-tree', b, h);
  if (m.status !== 0) fail('pull request #' + p.number + ' has conflicts');
  const files = diffFiles(b, h);
  const parents = method === 'squash' ? ['-p', b] : ['-p', b, '-p', h];
  const c = git('commit-tree', m.stdout.split('\n')[0], ...parents, '-m', 'Merge pull request #' + p.number + ' from ' + p.head).stdout.trim();
  const now = new Date().toISOString();
  const carried = state.prs.filter((o) => o !== p && o.state === 'OPEN' && o.base === p.base && tip(o.head) && ancestor(tip(o.head), c))
    .map((o) => ({ o, h: tip(o.head), files: diffFiles(b, tip(o.head)) }));
  git('update-ref', 'refs/heads/' + p.base, c);
  Object.assign(p, { state: 'MERGED', mergedHead: h, mergedAt: now, files, mergeCommit: c, autoMerge: null });
  for (const { o, h: oh, files: of } of carried) Object.assign(o, { state: 'MERGED', mergedHead: oh, mergedAt: now, files: of, mergeCommit: c, autoMerge: null });
  save();
  return c + (carried.length ? ' (also marked merged: ' + carried.map(({ o }) => '#' + o.number).join(', ') + ')' : '');
};
const [a, b] = args;
if (a === '--version') out('gh version 2.81.0 (devkit proof stub)\n');
if (a === '__merge') { const p = prOf(args[1]); out(doMerge(p, args[2] || (p.autoMerge ? p.autoMerge.toLowerCase() : 'merge')) + '\n'); }
if (a === 'pr' && b === 'list') {
  const head = opt('--head'); const base = opt('--base'); const st = opt('--state') || 'open';
  out(state.prs.filter((p) => (!head || p.head === head) && (!base || p.base === base) && (st === 'all' || p.state === st.toUpperCase()))
    .sort((x, y) => y.number - x.number).slice(0, Number(opt('--limit') || 30)).map(view));
}
if (a === 'pr' && b === 'view') {
  if (/^[0-9]+$/.test(args[2] || '')) out(view(prOf(args[2])));
  fail('no pull requests found for branch "' + (cp.spawnSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || 'HEAD') + '"');
}
if (a === 'pr' && b === 'create') {
  const bodyFile = opt('--body-file');
  const p = { number: ++state.next, base: opt('--base'), head: opt('--head'), title: opt('--title'), body: bodyFile ? fs.readFileSync(bodyFile, 'utf8') : (opt('--body') || ''), state: 'OPEN' };
  if (!tip(p.head)) fail('pull request create failed: ' + p.head + ' is not on origin');
  p.url = 'https://github.invalid/o/devkit/pull/' + p.number;
  state.prs.push(p);
  save();
  out(p.url + '\n');
}
if (a === 'pr' && b === 'edit') { const p = prOf(args[2]); const bodyFile = opt('--body-file'); p.body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : (opt('--body') ?? p.body); save(); out(p.url + '\n'); }
if (a === 'pr' && b === 'close') { prOf(args[2]).state = 'CLOSED'; save(); out(''); }
if (a === 'pr' && b === 'comment') { const p = prOf(args[2]); (p.comments = p.comments || []).push(opt('--body')); save(); out(''); }
if (a === 'pr' && b === 'merge') {
  const p = prOf(args[2]);
  const method = ['--merge', '--squash', '--rebase'].find((f) => args.includes(f));
  if (args.includes('--disable-auto')) { p.autoMerge = null; save(); out(''); }
  if (args.includes('--auto')) {
    if (opt('--match-head-commit') && opt('--match-head-commit') !== tip(p.head)) fail('GraphQL: Head commit does not match the expected head (enablePullRequestAutoMerge)');
    p.autoMerge = (method || '--merge').slice(2).toUpperCase();
    save();
    out('');
  }
  out(doMerge(p, (method || '--merge').slice(2)) + '\n');
}
if (a === 'pr' && b === 'checks') out(state.checks[args[2]] || state.defaultChecks || []);
if (a === 'api') {
  const route = args[1];
  if (route === 'graphql') out({ data: { viewer: { login: 'owner' }, repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] } } } } });
  if (/^repos\/\{owner\}\/\{repo\}\/rules\/branches\//.test(route)) out([{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }, { context: 'devkit-reviews' }] } }]);
  if (/^repos\/\{owner\}\/\{repo\}\/branches\/.*\/protection\/required_status_checks$/.test(route)) fail('gh: Branch not protected (HTTP 404)');
  if (route === 'repos/{owner}/{repo}') out({ default_branch: state.defaultBranch, allow_auto_merge: true, allow_squash_merge: true, allow_merge_commit: true, allow_rebase_merge: true });
  const files = /^repos\/\{owner\}\/\{repo\}\/pulls\/(\d+)\/files$/.exec(route);
  if (files) out(filesOf(prOf(files[1])).join('\n') + '\n');
  const pull = /^repos\/\{owner\}\/\{repo\}\/pulls\/(\d+)$/.exec(route);
  if (pull) { const p = prOf(pull[1]); out({ number: p.number, state: p.state === 'OPEN' ? 'open' : 'closed', merged: p.state === 'MERGED', base: { ref: p.base }, head: { ref: p.head }, merge_commit_sha: p.mergeCommit || null }); }
  const commit = /^repos\/\{owner\}\/\{repo\}\/git\/commits\/([0-9a-f]{40})$/.exec(route);
  if (commit) { const r = git('rev-list', '--parents', '-n', '1', commit[1]); if (r.status !== 0) fail('gh: Not Found (HTTP 404)'); const [sha, ...parents] = r.stdout.trim().split(' '); out({ sha, parents: parents.map((s) => ({ sha: s })) }); }
  const tag = /^repos\/\{owner\}\/\{repo\}\/git\/ref\/tags\/(.+)$/.exec(route);
  if (tag) { const r = git('rev-parse', '--verify', '-q', 'refs/tags/' + tag[1]); if (r.status !== 0) fail('gh: Not Found (HTTP 404)'); const sha = r.stdout.trim(); const type = git('cat-file', '-t', sha).stdout.trim(); out({ ref: 'refs/tags/' + tag[1], object: { sha, type } }); }
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
fail('gh proof stub: no answer for ' + args.join(' '), 99);
`;

// ---------------------------------------------------------------- a project

// A project `name` under CASES: a bare origin (`origin.git`), the main checkout (`main`) holding `files`, `config` as
// openspec/config.yaml and this worktree's schemas, pushed to origin; the gh stub with its JSON file `gh/state.json`.
export function seedProject(name, { config = MERGE_CONFIG, files = marketFiles(), roadmap = null } = {}) {
  const dir = join(CASES, name);
  const origin = join(dir, 'origin.git');
  const main = join(dir, 'main');
  mkdirSync(main, { recursive: true });
  sh(dir, ['git', 'init', '-q', '--bare', '-b', 'main', origin]);
  git(main, 'init', '-q', '-b', 'main');
  put(main, { 'openspec/config.yaml': config, ...files, ...(roadmap ? { 'openspec/roadmap.md': roadmap } : {}) });
  cpSync(join(WT, 'plugins', 'openspec', 'schemas'), join(main, 'openspec', 'schemas'), { recursive: true });
  mkdirSync(join(main, 'openspec', 'changes', 'archive'), { recursive: true });
  commitAll(main, 'seed: the project at its first release');
  git(main, 'remote', 'add', 'origin', origin);
  git(main, 'push', '-q', '-u', 'origin', 'main');
  git(main, 'remote', 'set-head', 'origin', 'main');
  const ghDir = join(dir, 'gh');
  mkdirSync(join(ghDir, 'bin'), { recursive: true });
  writeFileSync(join(ghDir, 'bin', 'gh'), GH_STUB);
  chmodSync(join(ghDir, 'bin', 'gh'), 0o755);
  const stateFile = join(ghDir, 'state.json');
  writeFileSync(stateFile, json({ origin, defaultBranch: 'main', next: 10, prs: [], checks: {}, defaultChecks: GREEN }));
  const env = { ...BASE_ENV, PATH: `${join(ghDir, 'bin')}:${process.env.PATH}`, DEVKIT_PROOF_GH: stateFile };
  return { name, dir, origin, main, env, stateFile, ghState: () => JSON.parse(readFileSync(stateFile, 'utf8')) };
}

export const proposalText = (id) => `# Proposal: ${id}\n\n## Why\n\nThe proof needs a change.\n\n## Acceptance criteria\n\n- AC-1: ${id} does its thing\n`;
export const TASKS = (id) => `# Tasks\n\n## 1. Code\n\n- [ ] 1.1 write src/${id}.ts\n- [ ] 1.2 Gate: \`node -e 0\` green\n`;

// A change `id` opened from origin/main in the worktree .claude/worktrees/<id> on branch `id`, with its plan committed: the proposal and
// tasks, for schema devkit the readiness verdict and the owner's approval (with the note's hash when there is a note), `note` as
// release.md, `adrs` (slugs) as unnumbered records listed in decisions.md, and `files` (any path, written with the plan). `releaseLine`
// is the approval's `- Release note:` value: 'auto' (the note's hash when there is a note), or null for none.
export function openChange(p, id, { schema = 'devkit', note = null, adrs = [], files = {}, tasks = TASKS(id), approve = true, releaseLine = 'auto' } = {}) {
  const wt = join(p.main, '.claude', 'worktrees', id);
  git(p.main, 'fetch', '-q', 'origin');
  git(p.main, 'worktree', 'add', '-q', '-b', id, wt, 'origin/main');
  const dir = `openspec/changes/${id}`;
  put(wt, {
    [`${dir}/.openspec.yaml`]: `schema: ${schema}\n`,
    [`${dir}/proposal.md`]: proposalText(id),
    [`${dir}/tasks.md`]: tasks,
    ...(note === null ? {} : { [`${dir}/release.md`]: note }),
    ...(adrs.length ? { [`${dir}/decisions.md`]: `# Decisions and ADRs\n\n${adrs.map((s) => `- ADR: \`docs/adr/${s}.md\` — the record of ${s}`).join('\n')}\n` } : {}),
    ...Object.fromEntries(adrs.map((s) => [`docs/adr/${s}.md`, `# ADR [${s}]: the rule of ${s}\n\n- Status: proposed\n- Change: \`${id}\`\n\nIt builds on ADR 0001 (docs/adr/0001-start.md).\n`])),
    ...files,
  });
  if (schema === 'devkit') {
    put(wt, { [`${dir}/readiness.md`]: `# Readiness review: ${id}\n\n- Status: APPROVED\n` });
    if (approve) writeApproval(wt, id, git(wt, 'rev-parse', 'HEAD'), { release: releaseLine });
  }
  commitAll(wt, `docs(${id}): the plan of ${id}`);
  return { id, wt, branch: id };
}

// A stage file's header line, as the loop's flow check reads it.
export const stageHead = (stage, commit, result = 'passed', attempt = 1) => `<!-- devkit-stage ${stage} result=${result} attempt=${attempt} commit=${commit} -->\n`;

// A spec delta that `openspec validate` reads (the loop's merge check validates the change at the merge of the base).
export const specText = (id) => `## ADDED Requirements\n\n### Requirement: ${id} does its thing\nThe project SHALL do what ${id} adds.\n\n#### Scenario: ${id} runs\n- **WHEN** ${id} runs\n- **THEN** it does its thing\n`;

// A `devkit-lite` change opened by openChange whose plan files carry the stage headers (requirements, proposal, specs and tasks, each
// passed at the commit the change was cut from), so this worktree's `change-loop.mjs next` walks it to its delivery (phase 11, D-36).
export function openLoopChange(p, id, { files = {}, ...opts } = {}) {
  git(p.main, 'fetch', '-q', 'origin');
  const c0 = git(p.main, 'rev-parse', 'origin/main');
  const d = `openspec/changes/${id}`;
  return openChange(p, id, {
    schema: 'devkit-lite', ...opts,
    files: {
      [`${d}/requirements.md`]: `${stageHead('requirements', c0)}# Requirements: ${id}\n\n- AC-1: ${id} does its thing\n`,
      [`${d}/proposal.md`]: `${stageHead('proposal', c0)}${proposalText(id)}`,
      [`${d}/specs/s/spec.md`]: `${stageHead('specs', c0)}${specText(id)}`,
      [`${d}/tasks.md`]: `${stageHead('tasks', c0)}${TASKS(id)}`,
      ...files,
    },
  });
}

// This worktree's `change-loop.mjs next` for the change, run in its worktree and recorded whole: the action it prints.
export function loopNext(p, c, rec) {
  const r = sh(c.wt, node('change-loop.mjs', 'next', '--change', c.id, '--lang', 'en'), { env: p.env, rec, expect: null });
  const i = r.out.indexOf('{');
  if (i < 0) throw new Error(`change-loop next ${c.id}: ${r.err || r.out}`);
  return JSON.parse(r.out.slice(i));
}

// approval.md as the ship-change row writes it, with the hashes of the readiness verdict and of release.md (when there is one).
export function writeApproval(wt, id, commit, { attempt = 1, release = 'auto' } = {}) {
  const dir = join(wt, 'openspec', 'changes', id);
  const note = release === 'auto' ? (existsSync(join(dir, 'release.md')) ? hash12(join(dir, 'release.md')) : null) : release;
  writeFileSync(join(dir, 'approval.md'), [
    `<!-- devkit-stage approval result=passed attempt=${attempt} commit=${commit} -->`, `# Plan approval: ${id}`, '',
    '- Status: APPROVED', `- Readiness: ${hash12(join(dir, 'readiness.md'))}`, ...(note ? [`- Release note: ${note}`] : []),
    '- Date: 2026-11-24', '- Owner\'s words: "`Aprovo`"', '',
  ].join('\n'));
}

// ---------------------------------------------------------------- the checker and the drive

export const node = (script, ...args) => ['node', join(DEV, script), ...args];
export function report(p, c, extraEnv = {}) {
  const r = sh(c.wt, node('deliver-check.mjs', c.id, '--json'), { env: { ...p.env, ...extraEnv }, expect: null });
  try { return { code: r.code, json: JSON.parse(r.out) }; } catch { throw new Error(`deliver-check ${c.id}: ${r.err || r.out}`); }
}
// The checker's human report, recorded.
export const human = (p, c, rec, extraEnv = {}) => sh(c.wt, node('deliver-check.mjs', c.id), { env: { ...p.env, ...extraEnv }, rec, expect: null });

const tickTasks = (wt, id, ids) => {
  const f = join(wt, 'openspec', 'changes', id, 'tasks.md');
  let text = readFileSync(f, 'utf8');
  for (const t of ids) text = text.replace(`- [ ] ${t} `, `- [x] ${t} `);
  writeFileSync(f, text);
};
const gateCommands = (wt, id) => [...read(wt, `openspec/changes/${id}/tasks.md`).matchAll(/Gate: `([^`]+)`/g)].flatMap((m) => m[1].split('&&').map((s) => s.trim()));

// What a session does at each step before the release rows, until a step of `until` (or a stop or a block) is next: the implementer's code
// and ticks, the gate, the commit, the evidence, the reviews, the pull request and the pushes. The trace (each check's `next`, and what was
// done for it) is recorded as one block; returns the last report.
export function drive(p, c, rec, { until = ['assign-release', 'enable-auto-merge', 'wait-merge', 'boarded', 'ready'], code = {} } = {}) {
  const trace = [];
  for (let i = 0; i < 40; i++) {
    const { json: r } = report(p, c);
    const n = r.next;
    trace.push(`$ node $DEV/deliver-check.mjs ${c.id} --json   -> ${r.met}/8, next: ${n.step} (${n.reason})`);
    if (until.includes(n.step) || n.step.startsWith('stop-') || n.step === 'blocked') { rec.block(`(in ${c.wt})\n${trace.join('\n')}`); return r; }
    let did;
    switch (n.step) {
      case 'implement': {
        const open = /unticked tasks: (.*)$/.exec(n.reason)[1].split(', ');
        put(c.wt, { [`src/${c.id}-${n.phase}.ts`]: `export const ${c.id.replace(/\W/g, '_')}${n.phase} = ${n.phase};\n`, ...(code[n.phase] ?? {}) });
        tickTasks(c.wt, c.id, open);
        did = `wrote src/${c.id}-${n.phase}.ts${code[n.phase] ? ` and ${Object.keys(code[n.phase]).join(', ')}` : ''}; ticked ${open.join(', ')}`;
        break;
      }
      case 'gate': {
        const g = sh(c.wt, ['sh', '-c', n.command]);
        tickTasks(c.wt, c.id, [n.task]);
        did = `ran \`${n.command}\` (exit ${g.code}); ticked ${n.task}`;
        break;
      }
      case 'commit': did = `git commit: ${commitAll(c.wt, `feat(${c.id}): phase work`).slice(0, 7)}`; break;
      case 'verify': {
        const sha = git(c.wt, 'rev-parse', 'HEAD');
        put(c.wt, { [`openspec/changes/${c.id}/evidence.md`]: `Commit: ${sha}\n\n# Evidence: ${c.id}\n\n### Gates\n| gate | command | result |\n|---|---|---|\n${gateCommands(c.wt, c.id).map((g) => `| 1.2 | \`${g}\` | pass: exit 0 |`).join('\n')}\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | src/${c.id}-1.ts | pass: written |\n` });
        did = `wrote evidence.md at ${sha.slice(0, 7)}; git commit: ${commitAll(c.wt, `docs(${c.id}): evidence`).slice(0, 7)}`;
        break;
      }
      case 'review': {
        const sha = git(c.wt, 'rev-parse', 'HEAD');
        put(c.wt, Object.fromEntries(n.reviewers.map((name) => [`openspec/changes/${c.id}/reviews/${name}.md`, `Verdict: approved\nCommit: ${sha}\n\n# Review by ${name}\n\nNo finding.\n`])));
        did = `wrote approved reviews of ${n.reviewers.join(', ')} at ${sha.slice(0, 7)}; git commit: ${commitAll(c.wt, `docs(${c.id}): reviews`).slice(0, 7)}`;
        break;
      }
      case 'open-pr': {
        commitAll(c.wt, `docs(${c.id}): change files`);
        git(c.wt, 'push', '-q', '-u', 'origin', c.branch);
        const url = sh(c.wt, ['gh', 'pr', 'create', '--base', 'main', '--head', c.branch, '--title', c.id, '--body', `${c.id}\n- AC-1\nopenspec/changes/${c.id}/evidence.md\n`], { env: p.env }).out.trim();
        c.number = Number(url.split('/').pop());
        did = `git push -u origin ${c.branch}; gh pr create -> ${url}`;
        break;
      }
      case 'push': git(c.wt, 'push', '-q', 'origin', c.branch); did = `git push origin ${c.branch}`; break;
      default: rec.block(`(in ${c.wt})\n${trace.join('\n')}`); throw new Error(`drive ${c.id}: unexpected step ${n.step}: ${n.reason}`);
    }
    trace.push(`    did: ${did}`);
  }
  rec.block(trace.join('\n'));
  throw new Error(`drive ${c.id}: no end after 40 steps`);
}
