// What the two parts of delivery-train.test.mjs share (suite-speed D-11, second round): paths, builders and helpers both use. No test lives here and nothing is made when the module is
// imported: a folder, a spawn or a git call happens only when one of its functions runs. The one load at import is `train`, the departure script, imported the way the original file imported it. A test file never imports another test file.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpFolder } from './test-tmp.mjs';
import { put, commitAll, roundRepo, simGitHub } from './test-fixtures.mjs';
import * as deliver from './deliver-check.mjs';
import { main } from './change-loop.mjs';

// The env fixture of this suite: the variables a CI run sets for a pull request are blanked together.
export const SET = { DEVKIT_BYPASS: '', DEVKIT_BRANCH: '', DEVKIT_CHANGE: '', GITHUB_HEAD_REF: '', GITHUB_BASE_REF: '', GITHUB_EVENT_PATH: '' };
export const trainEnv = { ...process.env, ...SET };

export const GIT_ENV = {
  ...trainEnv,
  GIT_AUTHOR_NAME: 'devkit test', GIT_AUTHOR_EMAIL: 'test@devkit.invalid',
  GIT_COMMITTER_NAME: 'devkit test', GIT_COMMITTER_EMAIL: 'test@devkit.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_EDITOR: 'true',
};
export const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: GIT_ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export const SUITE = 'node scripts/test-suite.mjs && python3 scripts/check.py';
export const block = (delivery, extra = '') => `devkit:\n  delivery:\n${delivery}${extra}`;
export const trunkAuto = (train) => block('    model: trunk-auto\n', train === undefined ? '' : `    train: ${train}\n`);

export function configRepo(text) {
  const root = tmpFolder('devkit-train-cfg-');
  mkdirSync(join(root, 'openspec', 'changes'), { recursive: true });
  if (text !== null) writeFileSync(join(root, 'openspec', 'config.yaml'), text);
  return root;
}

export function startRun(cwd, text, lang = 'en') {
  const r = main(['start', '--lang', lang], { cwd, env: trainEnv, stdin: text });
  return { code: r.code, body: JSON.parse(r.stdout) };
}
export const optedIn = (devkit) => `schema: devkit\n${devkit}`;
export const json = (obj) => `${JSON.stringify(obj, null, 2)}\n`;
export const pluginJson = (name, version) => json({ name, version, description: `pack ${name}` });
export const marketplace = (metadata, packs) => json({ name: 'devkit', metadata: { description: 'd', version: metadata }, plugins: Object.entries(packs).map(([name, version]) => ({ name, description: `pack ${name}`, version })) });
export const entry = (v, title, body = '- x') => `## ${v} — ${title}\n\n${body}\n\n`;
export const CL = (...entries) => `# Changelog\n\n${entries.join('')}`.replace(/\n+$/, '\n');

export const H = (c) => c.repeat(40);
export const projectConfig = (model, train = null) => `schema: devkit-lite\ndevkit:\n  delivery:\n${model ? `    model: ${model}\n` : ''}${train === null ? '' : `    train: "${train}"\n`}`;
export const WORKFLOW = { '.github/workflows/devkit-reviews.yml': 'name: devkit-reviews\n' };
export const PROPOSAL = '<!-- devkit-stage proposal result=passed attempt=1 commit=none -->\n# Proposal\n\n## Acceptance criteria\n\n- AC-1: something\n';
export const bodyOf = (id) => `${id}\n- AC-1\nopenspec/changes/${id}/evidence.md\n`;
export const CHECK = (name, bucket) => ({ name, state: bucket.toUpperCase(), bucket, link: 'https://github.com/o/r/actions/runs/77/job/1' });
export const GREEN = [CHECK('check', 'pass'), CHECK('devkit-reviews', 'pass')];
export const PENDING = [CHECK('check', 'pending'), CHECK('devkit-reviews', 'pass')];
export const REVIEWS = ['code-quality-reviewer', 'test-coverage-reviewer'];
export const PARTS = SUITE.split('&&').map((c) => c.trim());

// The train record of D-4, written by hand here (the departure's writer is phase 3).
export function recordText({ n = 4, base = 'main', baseSha = H('a'), suite = SUITE, ranAt = H('b'), result = 'passed', boarded = [], left = [], runs = [], failures = {} } = {}) {
  const row = (cells) => `| ${cells.join(' | ')} |`;
  const out = [
    `<!-- devkit-train n=${n} base=${base} result=${result} -->`, `# Train ${n}`, '',
    `- Base: \`${base}\` at \`${baseSha}\``, `- Suite: \`${suite}\``, `- Ran at: \`${ranAt}\``, `- Result: ${result}`, '',
    '## Boarded', '', row(['Order', 'Kind', 'Change', 'Pull request', 'Head', 'Boarded at']), row(['---', '---', '---', '---', '---', '---']),
    ...boarded.map((b, i) => row([i + 1, b.kind ?? 'change', `\`${b.id}\``, `#${b.number}`, `\`${b.head}\``, b.at ?? '2026-11-23T10:00:00Z'])), '',
  ];
  if (left.length) {
    out.push('## Left', '', row(['Kind', 'Change', 'Pull request', 'Head', 'Why', 'Detail']), row(['---', '---', '---', '---', '---', '---']),
      ...left.map((l) => row([l.kind ?? 'change', `\`${l.id}\``, `#${l.number}`, `\`${l.head}\``, l.why, l.detail ?? (l.why === 'red' ? `Failure of \`${l.id}\`, below` : '`x`')])), '');
  }
  if (runs.length) out.push('## Runs', '', row(['Run', 'Changes', 'Head', 'Result']), row(['---', '---', '---', '---']), ...runs.map((r, i) => row([i + 1, r.changes, `\`${r.head}\``, r.result])), '');
  for (const [id, text] of Object.entries(failures)) out.push(`## Failure of \`${id}\``, '', '```text', text, '```', '');
  return out.join('\n');
}

// A commit made at `at` (an ISO time) for the order of boarding, which reads the committer time of the newest review commit.
export function commitAt(wt, message, at = null) {
  if (!at) return commitAll(wt, message);
  git(wt, 'add', '-A');
  execFileSync('git', ['-C', wt, 'commit', '-q', '--allow-empty', '-m', message], { encoding: 'utf8', env: { ...GIT_ENV, GIT_COMMITTER_DATE: at, GIT_AUTHOR_DATE: at }, stdio: ['ignore', 'pipe', 'pipe'] });
  return git(wt, 'rev-parse', 'HEAD');
}

export function prove(wt, id, gates = [], at = null) {
  const sha = git(wt, 'rev-parse', 'HEAD');
  const gateTable = gates.length ? `\n### Gates\n| gate | command | result |\n|---|---|---|\n${gates.map((g) => `| 1.2 | \`${g}\` | pass: green |`).join('\n')}\n` : '';
  put(wt, {
    [`openspec/changes/${id}/evidence.md`]: `Commit: ${sha}\n\n# Evidence\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n${gateTable}`,
    ...Object.fromEntries(REVIEWS.map((r) => [`openspec/changes/${id}/reviews/${r}.md`, `Verdict: approved\nCommit: ${sha}\n\n# Review\n`])),
  });
  return commitAt(wt, `evidence and reviews of ${id}`, at);
}

// A project on the simulated GitHub: `p.t` is roundRepo's fixture (bare origin, main checkout), `p.sim` the fake gh.
export function project({ model = 'trunk-auto', train = SUITE, roadmap = '# Roadmap\n', files = {}, config = null } = {}) {
  const t = roundRepo({ roadmap, config: config ?? projectConfig(model, train), files: { ...WORKFLOW, ...files } });
  const sim = simGitHub({ origin: t.originDir });
  const env = { ...process.env, ...sim.env, ...SET };
  const p = { t, sim, env, changes: {}, archives: {}, scratch: tmpFolder('devkit-train-scratch-') };
  p.state = (id) => deliver.collectState(p.changes[id].wt, id, { env });
  p.next = (id) => deliver.nextStep(p.state(id));
  return p;
}

export const DEFAULT_TASKS = '# Tasks\n\n## 1. Phase\n\n- [x] 1.1 code\n';

// A change with its work, evidence and reviews at its head, pushed, with an open pull request and green checks.
export function addChange(p, id, { tasks = DEFAULT_TASKS, gates = [], pr = true, files = {}, at = null, branch = id } = {}) {
  const wt = p.t.addWt(id, { branch });
  put(wt, {
    [`openspec/changes/${id}/.openspec.yaml`]: 'schema: devkit-lite\n',
    [`openspec/changes/${id}/proposal.md`]: PROPOSAL,
    [`openspec/changes/${id}/tasks.md`]: tasks,
    [`src/${id}.txt`]: `${id}\n`,
    ...files,
  });
  commitAll(wt, `code of ${id}`);
  prove(wt, id, gates, at);
  git(wt, 'push', '-q', 'origin', branch);
  const entry = { wt, number: null, branch };
  if (pr) {
    entry.number = p.sim.create({ base: 'main', head: branch, body: bodyOf(id) });
    p.sim.setChecks(entry.number, GREEN);
  }
  p.changes[id] = entry;
  return entry;
}

// The pull request head of a change: what a train record lists as its head.
export const headOf = (p, id) => git(p.changes[id].wt, 'rev-parse', 'HEAD');

// A train: the branch train/<n> on origin holding its record, and its pull request. `merged` and `closed` end the pull request.
export function launchTrain(p, n, record, { merged = false, closed = false } = {}) {
  const dir = tmpFolder('devkit-train-wt-');
  const wt = join(dir, 'w');
  git(p.t.main, 'worktree', 'add', '-q', '-b', `train/${n}`, wt, 'origin/main');
  put(wt, { [`openspec/trains/${n}.md`]: recordText({ n, ...record }) });
  const head = commitAll(wt, `chore(train): record train ${n}`);
  git(wt, 'push', '-q', 'origin', `train/${n}`);
  git(p.t.main, 'worktree', 'remove', '--force', wt);
  const number = p.sim.create({ base: 'main', head: `train/${n}`, body: '' });
  if (merged) p.sim.merge(number);
  else if (closed) p.sim.close(number);
  return { number, head, n };
}
export const boardedOf = (p, id, kind = 'change') => ({ kind, id, number: p.changes[id].number, head: headOf(p, id) });
export const SPEC = 'openspec/specs/change-coordination/spec.md';

// The departure script is imported on the side so that, before it exists, each test of this phase fails on its own call
// and the tests of the earlier phases still run.
export const train = await import('./train-loop.mjs').catch(() => ({}));

export const IDENT = Object.fromEntries(Object.entries(GIT_ENV).filter(([k]) => k.startsWith('GIT_')));
// The env of a departure: the simulated GitHub on PATH, a git identity, and a TMPDIR of the project's own scratch folder.
// Runs the command of a session action the way the session does, in the main checkout, against the simulated GitHub.
export const perform = (p, action) => spawnSync(action.detail.command[0], action.detail.command.slice(1), { cwd: p.t.main, env: depEnv(p), encoding: 'utf8' });
export const depEnv = (p) => ({ ...p.env, ...IDENT, TMPDIR: p.scratch });
export const departIn = (p, opts = {}) => train.depart(p.t.main, { env: depEnv(p), tmp: p.scratch, lang: 'en', ...opts });
export const nextIn = (p, opts = {}) => train.next(p.t.main, { env: depEnv(p), tmp: p.scratch, lang: 'en', ...opts });

export const roadmapOfIds = (...ids) => `# Roadmap\n\n## Round 1\n${ids.map((i) => `- [ ] ${i}`).join('\n')}\n`;
export const RELEASE_BASE = {
  'plugins/a/.claude-plugin/plugin.json': pluginJson('a', '0.6.0'),
  'plugins/b/.claude-plugin/plugin.json': pluginJson('b', '0.5.0'),
  '.claude-plugin/marketplace.json': marketplace('0.6.0', { a: '0.6.0', b: '0.5.0' }),
  'CHANGELOG.md': CL(entry('0.6.0', 'first')),
};
// A change's release bump: devkit pack `a` to `version`, with its CHANGELOG entry.
export const bumpFiles = (version, title) => ({
  'plugins/a/.claude-plugin/plugin.json': pluginJson('a', version),
  '.claude-plugin/marketplace.json': marketplace(version, { a: version, b: '0.5.0' }),
  'CHANGELOG.md': CL(entry(version, title), entry('0.6.0', 'first')),
});
export const RETRO = '# Retro: x\n\n## Proposed updates\n\nNone.\n';
export const gitOf = (p, ...args) => git(p.t.main, ...args);
export const showOn = (p, rev, path) => git(p.t.main, 'show', `${rev}:${path}`);

// The archive of change `id`: the change merged by the simulated GitHub, its folder moved and the roadmap ticked on
// chore/archive-<id>, pushed, with an open pull request and green checks. Its head commit is made at `at`; `files` are
// written on the archive branch with the move and the tick (a canonical spec the archive syncs, for one), and `changeFiles` are
// files of the change's own folder (the spec delta that makes that canonical spec the archive's own).
export function addArchive(p, id, { at = null, retro = RETRO, files = {}, changeFiles = {} } = {}) {
  const own = addChange(p, id, { files: { [`openspec/changes/${id}/retro.md`]: retro, ...changeFiles } });
  p.sim.merge(own.number);
  git(p.t.main, 'fetch', '-q', 'origin');
  const wt = p.t.addWt(`archive-${id}`, { branch: `chore/archive-${id}`, from: 'origin/main' });
  mkdirSync(join(wt, 'openspec', 'changes', 'archive'), { recursive: true });
  git(wt, 'mv', `openspec/changes/${id}`, `openspec/changes/archive/2026-11-23-${id}`);
  put(wt, { 'openspec/roadmap.md': readFileSync(join(wt, 'openspec', 'roadmap.md'), 'utf8').replace(`- [ ] ${id}`, `- [x] ${id}`), ...files });
  commitAt(wt, `archive ${id}`, at);
  git(wt, 'push', '-q', 'origin', `chore/archive-${id}`);
  const number = p.sim.create({ base: 'main', head: `chore/archive-${id}`, body: `Archive ${id}.\n` });
  p.sim.setChecks(number, GREEN);
  p.archives[id] = { wt, number };
  return p.archives[id];
}

export const SUITE_COUNTER = () => join(tmpFolder('devkit-train-count-'), 'runs.txt');
export const countRuns = (file) => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0);
export const recordOn = (p, rev, n) => deliver.parseTrainRecord(showOn(p, rev, `openspec/trains/${n}.md`));
export const noScratch = (p) => {
  assert.deepEqual(readdirSync(p.scratch), [], 'every scratch worktree and folder of the departure is removed');
  assert.deepEqual(git(p.t.main, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ') && l.includes(p.scratch)), [], 'no scratch worktree stays registered');
};

// A train on origin with its record (cut from origin/main, ranAt the base) and its pull request: launchTrain of phase 2.
export const liveTrain = (p, n = 4, record = {}, ending = {}) => launchTrain(p, n, { boarded: [boardedOf(p, 'alpha')], ranAt: p.t.originSha(), baseSha: p.t.originSha(), ...record }, ending);
export const trainLoopFile = join(dirname(fileURLToPath(import.meta.url)), 'train-loop.mjs');
export const endOf = (r) => [r.code, r.action.kind, r.action.end.state, r.action.end.why];
