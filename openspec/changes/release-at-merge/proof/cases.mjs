// The cases of the release-at-merge real-run proof (design D-16, P-1 to P-12; tasks 6.1 to 6.6). Each case builds its projects with
// seed.mjs, runs this worktree's own CLIs (plugins/openspec/hooks/*.mjs) and the session's commands for each step, and records every
// command with its output in real-run.md.
//
//   TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/cases.mjs            # every case, real-run.md rewritten
//   TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/cases.mjs P-4 P-5    # some cases, to $CASES/partial.md
//
// The case root ($TMPDIR/devkit-proof-release-at-merge) must not exist when a run starts; remove it after the run.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROOF, CASES, WT, Record, sh, git, put, read, commitAll, seedProject, openChange, writeApproval, drive, human, report, node,
  marketFiles, TRAIN_CONFIG, RELEASE_FILE, GUIDE0, flowPage, hash12, manifest, marketplace, catalog, CHANGELOG0, consumerFiles,
} from './seed.mjs';

const wanted = process.argv.slice(2);
const all = wanted.length === 0;
if (existsSync(CASES)) throw new Error(`${CASES} exists: remove it first (it is this proof's own scratch folder)`);
mkdirSync(CASES, { recursive: true });
const OUT = all ? join(PROOF, 'real-run.md') : join(CASES, 'partial.md');
writeFileSync(OUT, '');
const rec = new Record(OUT);
const projects = {};

// ---------------------------------------------------------------- shared pieces

const note = (...lines) => `${lines.join('\n')}\n`;
const FEAT_NOTE = note('# Release note', '', 'packs:', '- devkit-openspec: minor', '- devkit-core: patch', '', '## the feature lands', '',
  '- **devkit-openspec**: the flow does the feature (ADR [feat])', '- **devkit-core**: the agents follow it');
const patchNote = (id, pack = 'devkit-openspec', kind = 'patch') => note('packs:', `- ${pack}: ${kind}`, '', `## ${id} lands`, '', `- **${pack}**: ${id} does its part`);
const guideWith = (section, line) => GUIDE0.replace(`${section} line two.`, `${section} line two. ${line}`);
// The session's part of `assign-release` (the ship-change row): fetch the base, run next.command in the change's worktree, push plainly.
function assignRelease(p, c, next, { expect = [0] } = {}) {
  sh(c.wt, ['git', 'fetch', 'origin', next.base], { env: p.env, rec });
  const r = sh(c.wt, next.command, { env: p.env, rec, expect });
  if (r.code === 0) sh(c.wt, ['git', 'push', 'origin', next.branch], { env: p.env, rec });
  return r;
}
// The session's part of `enable-auto-merge`, then GitHub merging the pull request once its rules pass (the stub's merge hook).
function autoMerge(p, c, next) {
  sh(c.wt, ['gh', 'pr', 'merge', String(next.number), '--auto', `--${next.method}`, '--match-head-commit', next.head], { env: p.env, rec });
  return sh(p.main, ['gh', '__merge', String(next.number)], { env: p.env, rec, label: `gh __merge ${next.number}   # the stub: GitHub merges the pull request once its rules pass` }).out.trim().split(' ')[0];
}
const nextOf = (p, c, env) => report(p, c, env).json.next;
// The `next` field of a `deliver-check <id> --json` run at the same head as the human report above it, in full (its command, path
// and number fields are what the session acts on).
const showNext = (n) => rec.block(`"next" of deliver-check <id> --json at this head:\n${JSON.stringify(n, null, 2)}`);
function expectStep(n, step, what) {
  if (n.step !== step) throw new Error(`${what}: expected ${step}, got ${n.step}: ${n.reason}`);
}
const assert = (ok, what) => { if (!ok) throw new Error(`check failed: ${what}`); };

// ---------------------------------------------------------------- the seed (6.1)

function seed() {
  rec.text(`# Real-run proof: release-at-merge (tasks 6.1 to 6.6)

Every case below ran for real, on ${new Date().toISOString().slice(0, 10)}, against this worktree's own scripts (\`$DEV\` is
\`plugins/openspec/hooks\` of the worktree \`$WT\`; never the installed plugin), in scratch repositories under a private \`TMPDIR\`
(\`$TMPDIR\` is \`/var/tmp/devkit-release-at-merge\`, \`$CASES\` is \`$TMPDIR/devkit-proof-release-at-merge\`, removed after the run).
Each block is one command as it ran, the folder it ran in, its whole output and its exit code; a block that starts with a list of
\`deliver-check ... --json -> next: ...\` lines is the drive of a change to its release rows: one line per check (its \`met\` count and
\`next\`), then what the session did for that step (the implementer's code and ticks, the gate, the commit, the evidence, the approved
reviews, the push and the pull request). The scripts are kept beside this file, so the proof can be run again:

    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/cases.mjs

The first runs of P-1 found two defects in \`deliver-check.mjs\`, each fixed test-first (a failing test, then the fix) before every
case below was run again:

- A changelog body that cites an ADR (\`(ADR [feat])\`): the step rewrites the citation in \`CHANGELOG.md\` like in any tracked text,
  but \`releaseStateAt\` compared the changelog with the unrewritten entry, so right after the step the change read as "release lines
  edited by hand: CHANGELOG.md" and the step refused to run again. The state now compares the changelog with the head's ADR numbers
  masked, and the note's title and body count as cited text, so a citation of another change's record there is rewritten once it
  landed and refused while it has not (tests "release-note AC-2 state: a changelog body that cites ..." and "release-note AC-7
  citation: a changelog body that cites another change's ADR that has not landed ..." in \`release-note.test.mjs\`).
- The step run again after the base numbered another record renumbers the change's own record (0002 to 0003) and its citations, but
  \`releaseOnlyEdit\` accepted only an unnumbered record turned numbered, and masked both sides with the later revision's numbers (where
  0002 is the other record), so the evidence and the reviews went stale. Each side is now masked with the records it holds, and a
  record renumbered from its former number is a release edit too (tests "release-note AC-4 staleness: the step run again after the base
  numbered another ADR ..." and its guard "release-note AC-5 staleness: a citation of the change's own record moved to another
  record's number ..." in \`deliver-check.test.mjs\`).

## How the seed is built

\`proof/seed.mjs\` builds every project the same way (\`seedProject\`): a bare \`origin.git\`, a main checkout \`main\` with this worktree's
schemas copied to \`openspec/schemas\`, one commit pushed to \`origin/main\` (\`origin/HEAD\` set), and a \`gh\` stub first on \`PATH\`. The
release layout is a two-pack marketplace at 1.0.0: \`plugins/openspec/.claude-plugin/plugin.json\` (devkit-openspec, the file
\`devkit.release_tag\` names, as in this repository), \`plugins/core/.claude-plugin/plugin.json\` (devkit-core), \`.claude-plugin/marketplace.json\`
(\`metadata.version\` and both packs), \`CHANGELOG.md\`, \`docs/openspec-flow.md\` with the three CI pin-marker lines of this repository's
flow page, \`docs/catalog.md\` with a stand-in \`scripts/gen-catalog.py\` that lists each pack's version (so a release visibly moves the
catalog), \`docs/adr/0001-start.md\` and \`docs/guide.md\`, where changes cite their records. A change is opened with
\`openChange\`: a worktree \`.claude/worktrees/<id>\` on branch \`<id>\` from \`origin/main\`, its plan committed (proposal, tasks with
one code task and one gate, and for schema \`devkit\` an APPROVED readiness verdict and \`approval.md\` written as the \`ship-change\`
row writes it, with \`- Release note: sha256:<12 hex>\` when the change has \`release.md\`), its note, its unnumbered ADRs listed in
\`decisions.md\` and the files the case names. The consumer projects of P-4 and P-5 and the project of P-11's marketplace variant
replace the layout with their own files, named in their case.

The \`gh\` stub (\`GH_STUB\` in \`seed.mjs\`) never calls GitHub: it answers from the JSON file \`gh/state.json\` of the project
(\`DEVKIT_PROOF_GH\`), where the case's \`gh pr create\` writes each pull request, and reads heads and bases live from the bare origin, so
a push moves a pull request as on GitHub. \`mergeable\` comes from \`git merge-tree\`; \`mergeStateStatus\` is DIRTY on a conflict,
BEHIND when the base tip is not in the head, else CLEAN; the required checks \`check\` and \`devkit-reviews\` answer green (the
\`defaultChecks\` of the JSON file). \`gh pr merge --auto\` records auto-merge; \`gh __merge <n>\` stands for GitHub merging a pull request
once its rules pass (a commit in the origin, by the auto-merge method when one is on) and, as GitHub does, marks every other open pull request whose head the new base
holds as merged by that commit. The release reads of ADR 0019 (\`pulls/<n>\`, \`git/commits/<sha>\`, \`git/ref/tags/<tag>\`, contents at
a commit) are answered from the origin. The seed project, as built:`);
  const p = seedProject('seed');
  sh(p.main, ['cat', 'openspec/config.yaml'], { rec });
  sh(p.main, ['git', 'ls-files', '--', '.', ':(exclude)openspec/schemas'], { rec });
  sh(p.main, ['git', 'ls-tree', '-d', '--name-only', 'HEAD', 'openspec/schemas/'], { rec });
  sh(p.main, ['cat', RELEASE_FILE, '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/catalog.md'], { rec });
  sh(p.main, ['grep', '-n', 'v1.0.0', 'docs/openspec-flow.md'], { rec });
  sh(p.main, ['git', 'ls-remote', 'origin'], { rec });
  sh(p.main, ['gh', '--version'], { env: p.env, rec });
  sh(p.main, ['gh', 'api', 'repos/{owner}/{repo}'], { env: p.env, rec });
  sh(p.main, ['cat', p.stateFile], { rec });
  rec.flush();
}

// ---------------------------------------------------------------- P-1 (6.2): a single merge in `merge` mode

function p1() {
  rec.text(`## P-1 single merge in merge mode: a noted change with an ADR and citations, and a sibling that merges first

AC-4, AC-5. Project \`p1\` (the seed, \`ship: merge\`). Change \`feat\` notes devkit-openspec \`minor\` and devkit-core \`patch\`, names its
record \`docs/adr/feat.md\` (listed in \`decisions.md\`) and cites it \`ADR [feat]\` in \`docs/guide.md\` (with a link \`adr/feat.md\`), in the
prose of \`docs/openspec-flow.md\` (the file of the CI pins) and in its changelog body. Its sibling \`sib\` notes devkit-openspec \`patch\`
with its own record \`docs/adr/sib.md\` cited in \`docs/sib.md\` (no file of \`feat\`'s own: a base edit to one of them would stale \`feat\`'s records by ADR 0025, as it should). Both are approved \`devkit\` changes whose
\`approval.md\` records the note's hash.`);
  const p = seedProject('p1');
  projects.p1 = p;
  const feat = openChange(p, 'feat', {
    note: FEAT_NOTE, adrs: ['feat'],
    files: {
      'docs/guide.md': guideWith('A', 'The rule is ADR [feat]; see [the record](adr/feat.md).'),
      'docs/openspec-flow.md': flowPage('1.0.0').replace('The records of this project live in docs/adr/.', 'The records of this project live in docs/adr/; the newest is ADR [feat].'),
    },
  });
  p.feat = feat;
  rec.text('The plan of `feat` as committed on its branch (the note, the record, the decisions and the approval):');
  sh(feat.wt, ['git', 'show', '--stat', '--format=%h %s', 'HEAD', '--', '.', ':(exclude)openspec/changes/feat/proposal.md'], { rec });
  sh(feat.wt, ['cat', 'openspec/changes/feat/release.md', 'openspec/changes/feat/decisions.md', 'openspec/changes/feat/approval.md'], { rec });
  rec.text('The session drives `feat` through its tasks, evidence, reviews and pull request until the checker asks for the release step:');
  const r1 = drive(p, feat, rec);
  expectStep(r1.next, 'assign-release', 'feat before its release');
  human(p, feat, rec);
  showNext(r1.next);
  rec.text('The `assign-release` row of `ship-change`, as the session runs it: `git fetch origin <next.base>`, `next.command` in the change\'s worktree, then a plain `git push origin <next.branch>`.');
  const a1 = assignRelease(p, feat, r1.next);
  const j1 = JSON.parse(a1.out);
  assert(j1.mode === 'assign' && j1.adrs[0]?.to === 'docs/adr/0002-feat.md', 'feat numbered 0002');
  rec.text('The step\'s one commit holds only release lines, the record\'s number and the rewritten citations; no file under `openspec/changes/` changed:');
  sh(feat.wt, ['git', 'show', '--stat', '--format=%h %s', 'HEAD'], { rec });
  sh(feat.wt, ['git', 'diff', '--name-only', 'HEAD~1', 'HEAD', '--', 'openspec/changes/'], { rec, label: 'git diff --name-only HEAD~1 HEAD -- openspec/changes/   # empty: the plan, the evidence and the reviews are untouched' });
  sh(feat.wt, ['git', 'diff', 'HEAD~1', 'HEAD', '--', 'docs/guide.md', 'docs/openspec-flow.md', 'CHANGELOG.md', 'docs/catalog.md'], { rec });
  rec.text('After the step the evidence and the approved reviews recorded before it are still current (items 1 to 4 met), and `enable-auto-merge` is next:');
  human(p, feat, rec);
  const n2 = nextOf(p, feat);
  expectStep(n2, 'enable-auto-merge', 'feat after its release');
  showNext(n2);

  rec.text('### The sibling `sib` merges first\n\nThe owner lets `sib` go first: it is driven the same way, takes its release on the same base (devkit-openspec 1.0.1, `docs/adr/0002-sib.md`), enables auto-merge, and GitHub merges it.');
  const sib = openChange(p, 'sib', { note: patchNote('sib'), adrs: ['sib'], files: { 'docs/sib.md': '# The sibling\n\nThe fix is ADR [sib], see [the record](adr/sib.md).\n' } });
  const s1 = drive(p, sib, rec);
  expectStep(s1.next, 'assign-release', 'sib before its release');
  assignRelease(p, sib, s1.next);
  const s2 = nextOf(p, sib);
  expectStep(s2, 'enable-auto-merge', 'sib after its release');
  autoMerge(p, sib, s2);
  sh(p.main, ['git', 'fetch', '-q', 'origin'], { env: p.env });
  sh(p.main, ['git', 'log', '--oneline', '--graph', '-6', 'origin/main'], { rec });

  rec.text('### `feat` again: the base moved and released the same pack\n\nGitHub now reports `feat` in conflict with `main` (both wrote the same release lines), so the checker asks for `assign-release` again, in place of the conflict stop:');
  human(p, feat, rec);
  const n3 = nextOf(p, feat);
  expectStep(n3, 'assign-release', 'feat after the base moved');
  showNext(n3);
  const a2 = assignRelease(p, feat, n3);
  const j2 = JSON.parse(a2.out);
  assert(j2.versions.packs['devkit-openspec'] === '1.1.0' && j2.versions.packs['devkit-core'] === '1.0.1' && j2.adrs[0].to === 'docs/adr/0003-feat.md', 'feat renumbered above sib');
  rec.text('No conflict was left: the merge commit holds the base, `feat`\'s numbers above it (devkit-openspec 1.1.0 over 1.0.1, devkit-core 1.0.1, ADR 0003), both changelog entries and both citations:');
  sh(feat.wt, ['git', 'log', '--oneline', '--graph', '-5'], { rec });
  sh(feat.wt, ['git', 'show', '--stat', '--format=%h %s', 'HEAD'], { rec });
  sh(feat.wt, ['git', 'diff', '--name-only', 'HEAD^1', 'HEAD', '--', 'openspec/changes/feat/'], { rec, label: 'git diff --name-only HEAD^1 HEAD -- openspec/changes/feat/   # empty' });
  sh(feat.wt, ['cat', RELEASE_FILE, 'plugins/core/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/catalog.md'], { rec });
  sh(feat.wt, ['grep', '-n', 'ADR\\|v1\\.', 'docs/guide.md', 'docs/sib.md', 'docs/openspec-flow.md'], { rec });
  sh(feat.wt, ['ls', 'docs/adr'], { rec });
  human(p, feat, rec);
  const n4 = nextOf(p, feat);
  expectStep(n4, 'enable-auto-merge', 'feat after its second release');
  showNext(n4);
  rec.text('The session enables auto-merge with the row\'s exact command; P-12 lets GitHub merge it and follows the tag.');
  sh(feat.wt, ['gh', 'pr', 'merge', String(n4.number), '--auto', `--${n4.method}`, '--match-head-commit', n4.head], { env: p.env, rec });
  human(p, feat, rec);
  p.featNext = n4;
  rec.flush();
}

// ---------------------------------------------------------------- P-2 (6.3): a train of two noted changes

// One call of the train loop and, for a session action, its command as the session runs it: { action, ran }.
function trainStep(p, { run = true } = {}) {
  const r = sh(p.main, node('train-loop.mjs', 'next', '--lang', 'en'), { env: p.env, rec, expect: [0, 1, 2] });
  const action = JSON.parse(r.out);
  if (!run || action.kind !== 'session') return { action, ran: null };
  const ran = sh(p.main, action.detail.command, { env: p.env, rec });
  return { action, ran };
}

function p2() {
  rec.text(`## P-2 a train of two noted changes through \`train-loop.mjs depart\`

AC-3, AC-5. Project \`p2\`: the seed with a delivery train (\`devkit.delivery\`: \`model: trunk-auto\`, \`train: "true"\`) and the same
\`devkit.release_tag\`. Changes \`alpha\` and \`beta\` both note devkit-openspec \`minor\`; each names its record (\`docs/adr/alpha.md\`,
\`docs/adr/beta.md\`, listed in its \`decisions.md\`) and cites it in a file of its own (\`docs/alpha.md\`, \`docs/beta.md\`). Neither branch
touches a release line. \`alpha\` is reviewed first, so it boards first.`);
  const p = seedProject('p2', { config: TRAIN_CONFIG });
  projects.p2 = p;
  sh(p.main, ['cat', 'openspec/config.yaml'], { rec });
  const changes = {};
  for (const id of ['alpha', 'beta']) {
    changes[id] = openChange(p, id, { note: patchNote(id, 'devkit-openspec', 'minor'), adrs: [id], files: { [`docs/${id}.md`]: `# ${id}\n\nThe rule of ${id} is ADR [${id}] ([the record](adr/${id}.md)).\n` } });
    const r = drive(p, changes[id], rec);
    expectStep(r.next, 'boarded', `${id} before the train`);
  }
  p.changes = changes;
  human(p, changes.alpha, rec);
  rec.text('The heads of both branches, locally and on origin, before the departure:');
  const heads = sh(p.main, ['git', 'ls-remote', 'origin', 'refs/heads/alpha', 'refs/heads/beta'], { env: p.env, rec }).out;
  rec.text('The train loop hands the session the departure; the session runs its command:');
  const first = trainStep(p, { run: false });
  expectStep({ step: first.action.step, reason: JSON.stringify(first.action) }, 'depart', 'the train loop');
  const dep = sh(p.main, first.action.detail.command, { env: p.env, rec });
  const out = JSON.parse(dep.out);
  assert(out.result === 'passed' && out.boarded.map((b) => b.id).join() === 'alpha,beta' && out.left.length === 0, 'both boarded in order');
  const wt = out.worktree;
  p.trainWt = wt;
  rec.text('The train: one join per boarded head (each numbered above the train\'s tip), then the record. The first boarded took devkit-openspec 1.1.0 and ADR 0002, the second 1.2.0 and ADR 0003; the marketplace, the changelog, the catalog and the CI pins follow:');
  sh(wt, ['git', 'log', '--oneline', '--graph', 'origin/main..HEAD'], { rec });
  for (const rev of ['HEAD~2', 'HEAD~1']) sh(wt, ['git', 'show', '--stat', '--format=%h %s', rev], { rec });
  sh(wt, ['cat', 'openspec/trains/1.md'], { rec });
  sh(wt, ['cat', RELEASE_FILE, '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/catalog.md', 'docs/alpha.md', 'docs/beta.md'], { rec });
  sh(wt, ['grep', '-n', 'v1\\.', 'docs/openspec-flow.md'], { rec });
  sh(wt, ['ls', 'docs/adr'], { rec });
  sh(wt, ['git', 'diff', '--stat', 'origin/main', 'HEAD', '--', 'openspec/changes/'], { rec, label: 'git diff --stat origin/main HEAD -- openspec/changes/   # the change folders as each branch has them, plus nothing' });
  for (const id of ['alpha', 'beta']) sh(wt, ['git', 'diff', '--stat', id, 'HEAD', '--', `openspec/changes/${id}/`], { rec, label: `git diff --stat ${id} HEAD -- openspec/changes/${id}/   # empty: the train holds ${id}'s folder exactly as its branch` });
  rec.text('`deliver-check --ci` on the train, as the pull request of `train/1` runs it in CI (`GITHUB_HEAD_REF=train/1`, `GITHUB_BASE_REF=main`): each boarded change passes at its own head, and the train\'s own commits are only release lines, ADR numbers and the record:');
  sh(wt, node('deliver-check.mjs', '--ci'), { env: { ...p.env, GITHUB_HEAD_REF: 'train/1', GITHUB_BASE_REF: 'main' }, rec });
  rec.text('Both boarded heads are unchanged, locally and on origin:');
  const after = sh(p.main, ['git', 'ls-remote', 'origin', 'refs/heads/alpha', 'refs/heads/beta'], { env: p.env, rec }).out;
  assert(after === heads, 'the boarded heads did not move');
  for (const id of ['alpha', 'beta']) human(p, changes[id], rec);
  rec.flush();
}

// ---------------------------------------------------------------- P-3 (6.4): an old-rule change

// The files of a change on the old rule: devkit-core bumped `kind` from 1.0.0 by the branch itself (manifest, marketplace, changelog,
// catalog), a numbered ADR `docs/adr/<number>-<id>.md` listed in decisions.md and cited in docs/<id>.md, and a code file of the pack.
function oldRuleFiles(id, { version = '1.1.0', number = '0002' } = {}) {
  return {
    'plugins/core/.claude-plugin/plugin.json': manifest('devkit-core', version),
    '.claude-plugin/marketplace.json': marketplace(version, { 'devkit-openspec': '1.0.0', 'devkit-core': version }),
    'CHANGELOG.md': CHANGELOG0.replace('## 1.0.0', `## ${version} — ${id} lands\n\n- **devkit-core** ${version}: ${id} does its part\n\n## 1.0.0`),
    'docs/catalog.md': catalog({ 'devkit-core': version, 'devkit-openspec': '1.0.0' }),
    'plugins/core/README.md': `# devkit-core\n\nThe agents of the core pack, and what ${id} adds.\n`,
    [`openspec/changes/${id}/decisions.md`]: `# Decisions and ADRs\n\n- ADR: \`docs/adr/${number}-${id}.md\` — the record of ${id}\n`,
    [`docs/adr/${number}-${id}.md`]: `# ADR ${number}: the rule of ${id}\n\n- Status: proposed\n`,
    [`docs/${id}.md`]: `# ${id}\n\nSee ADR ${number} ([the record](adr/${number}-${id}.md)).\n`,
  };
}

function p3() {
  rec.text(`## P-3 an old-rule change: its own bump, a numbered ADR, \`--base\`, \`renumber-adr\` and a join beside a noted change

AC-10. A change with no \`release.md\` in a project that names \`devkit.release_tag\` is delivered exactly as before this change.

### \`renumber-adr\` and \`--base\` with no train

Project \`p3\` (the seed, merge mode, a roadmap round listing \`old\`). Change \`old\` has no note: its branch bumps devkit-core
1.0.0 to 1.1.0 itself (manifest, marketplace, changelog, catalog) and adds \`docs/adr/0002-old.md\`, listed in \`decisions.md\` and cited
in \`docs/old.md\`, with a code file of the pack.`);
  const p = seedProject('p3', { roadmap: '# Roadmap\n\n## Round 1: proof\n- [ ] old\n' });
  const old = openChange(p, 'old', { files: oldRuleFiles('old') });
  sh(old.wt, ['git', 'show', '--stat', '--format=%h %s', 'HEAD'], { rec });
  const r1 = drive(p, old, rec);
  expectStep(r1.next, 'enable-auto-merge', 'old at the end of its cycle');
  rec.text('With no note the checker asks no `assign-release`: the last step is `enable-auto-merge`, as before. Before the owner lets it merge, another change lands on `main` by the old rule too (devkit-core 1.0.1 and its own `docs/adr/0002-landed.md`):');
  put(p.main, {
    'plugins/core/.claude-plugin/plugin.json': manifest('devkit-core', '1.0.1'),
    '.claude-plugin/marketplace.json': marketplace('1.0.1', { 'devkit-openspec': '1.0.0', 'devkit-core': '1.0.1' }),
    'CHANGELOG.md': CHANGELOG0.replace('## 1.0.0', '## 1.0.1 — landed lands\n\n- **devkit-core** 1.0.1: landed does its part\n\n## 1.0.0'),
    'docs/catalog.md': catalog({ 'devkit-core': '1.0.1', 'devkit-openspec': '1.0.0' }),
    'docs/adr/0002-landed.md': '# ADR 0002: the rule of landed\n\n- Status: accepted\n',
  });
  commitAll(p.main, 'chore(release): landed 1.0.1');
  sh(p.main, ['git', 'push', 'origin', 'main'], { env: p.env, rec });
  human(p, old, rec);
  rec.text('The conductor (`conduct-check`) turns the round into its rows: the ADR number the base took is `renumber-adr`, as before:');
  const c1 = sh(p.main, node('conduct-check.mjs', '--json'), { env: p.env, rec });
  const row1 = JSON.parse(c1.out).changes.find((r) => r.id === 'old');
  expectStep(row1.next, 'renumber-adr', 'the conductor on old');
  rec.text('The implementer does what the `renumber-adr` hand-off says: `git mv` each file and change every reference in the branch\'s files, then commits:');
  for (const f of row1.next.files) {
    sh(old.wt, ['git', 'mv', f.from, f.to], { rec });
    for (const ref of ['docs/old.md', 'openspec/changes/old/decisions.md']) put(old.wt, { [ref]: read(old.wt, ref).split(f.from.split('/').pop()).join(f.to.split('/').pop()).replace(`ADR ${f.from.split('/').pop().slice(0, 4)}`, `ADR ${f.number}`) });
    put(old.wt, { [f.to]: read(old.wt, f.to).replace(`# ADR ${f.from.split('/').pop().slice(0, 4)}`, `# ADR ${f.number}`) });
  }
  sh(old.wt, ['git', 'commit', '-q', '-am', 'docs(old): renumber the ADR the base took'], { rec });
  sh(old.wt, ['git', 'show', '-M', '--format=%h %s', 'HEAD'], { rec });
  rec.text('The renumbering is a plain commit that touches the change\'s own files, so it stales the evidence and the reviews, as before this change (the cost of the old rule); the session records them again and pushes, and the pull request is then in conflict with `main`:');
  const r2 = drive(p, old, rec);
  expectStep(r2.next, 'blocked', 'old after the renumbering');
  human(p, old, rec);
  rec.text('The conductor again: the pull request conflicts only in release files, which is `resolve-release-conflict`, as before:');
  const c2 = sh(p.main, node('conduct-check.mjs', '--json'), { env: p.env, rec });
  const row2 = JSON.parse(c2.out).changes.find((r) => r.id === 'old');
  expectStep(row2.next, 'resolve-release-conflict', 'the conductor on old after the renumbering');
  rec.text('Its command, `release-merge.mjs --base main`, merges `origin/main` and numbers the branch\'s own bump (minor) above the base\'s 1.0.1:');
  const m = sh(old.wt, row2.next.command, { env: p.env, rec });
  const mj = JSON.parse(m.out);
  assert(mj.resolved && mj.versions.packs['devkit-core'] === '1.1.0', 'old renumbered by kind');
  sh(old.wt, ['git', 'push', 'origin', 'old'], { env: p.env, rec });
  sh(old.wt, ['cat', 'plugins/core/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/catalog.md'], { rec });
  sh(old.wt, ['ls', 'docs/adr'], { rec });
  rec.text('The merge of the base touched no own file of `old` beyond its release lines, so the records stay current and auto-merge is next, as before:');
  human(p, old, rec);
  expectStep(nextOf(p, old), 'enable-auto-merge', 'old after resolve-release-conflict');

  rec.text(`### A join beside a noted change

Project \`p3t\` (a train project, configured as P-2's). \`oldt\` is on the old rule (devkit-core bumped \`minor\` on its branch, \`docs/adr/0002-oldt.md\`)
and boards first; \`notedt\` notes devkit-openspec \`minor\` with \`docs/adr/notedt.md\`. One departure joins both: \`oldt\` by the
kind of its own bump, \`notedt\` from its note, above it.`);
  const q = seedProject('p3t', { config: TRAIN_CONFIG });
  const oldt = openChange(q, 'oldt', { files: oldRuleFiles('oldt') });
  expectStep(drive(q, oldt, rec).next, 'boarded', 'oldt before the train');
  const notedt = openChange(q, 'notedt', { note: patchNote('notedt', 'devkit-openspec', 'minor'), adrs: ['notedt'], files: { 'docs/notedt.md': '# notedt\n\nSee ADR [notedt].\n' } });
  expectStep(drive(q, notedt, rec).next, 'boarded', 'notedt before the train');
  const dep = trainStep(q);
  expectStep({ step: dep.action.step, reason: JSON.stringify(dep.action) }, 'depart', 'the train loop');
  const out = JSON.parse(dep.ran.out);
  assert(out.result === 'passed' && out.boarded.map((b) => b.id).join() === 'oldt,notedt' && out.left.length === 0, 'both boarded');
  const wt = out.worktree;
  sh(wt, ['git', 'log', '--oneline', '--graph', 'origin/main..HEAD'], { rec });
  sh(wt, ['cat', RELEASE_FILE, 'plugins/core/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/catalog.md', 'docs/notedt.md'], { rec });
  sh(wt, ['ls', 'docs/adr'], { rec });
  sh(wt, node('deliver-check.mjs', '--ci'), { env: { ...q.env, GITHUB_HEAD_REF: 'train/1', GITHUB_BASE_REF: 'main' }, rec });
  rec.flush();
}

// ---------------------------------------------------------------- P-4, P-5 (6.5): consumer projects

const CONSUMER_NOTE = note('# Release note', '', 'packs: []', 'release: minor', '', '## the app gets a feature', '', '- a feature of the app');
const consumerConfig = (file) => `schema: devkit\nship:\n  devkit: merge\n${file ? `devkit:\n  release_tag: ${file}\n` : ''}`;
// The files a run left in the project beyond the ones its change added: what `git status` and the tree list show.
function treeOf(p, c) {
  sh(c.wt, ['git', 'status', '--short'], { rec, label: 'git status --short   # nothing left uncommitted' });
  sh(c.wt, ['git', 'ls-files', '--', '.', ':(exclude)openspec/schemas', ':(exclude)openspec/changes'], { rec });
}

function p4() {
  rec.text(`## P-4 a consumer project with \`devkit.release_tag: package.json\`

AC-8, AC-9. No packs, no marketplace, no flow page and no catalog: the project's release file is \`package.json\` (1.4.0). Every
variant's change notes \`packs: []\` and \`release: minor\`; the first also names a record.

### With a root \`CHANGELOG.md\` and \`docs/adr/\``);
  const a = seedProject('p4a', { config: consumerConfig('package.json'), files: consumerFiles() });
  const fa = openChange(a, 'feature', { note: CONSUMER_NOTE, adrs: ['feature'], files: { 'docs/feature.md': '# Feature\n\nSee ADR [feature].\n' } });
  sh(a.main, ['cat', 'openspec/config.yaml', 'package.json', 'CHANGELOG.md'], { rec });
  const r = drive(a, fa, rec);
  expectStep(r.next, 'assign-release', 'feature before its release');
  showNext(r.next);
  assignRelease(a, fa, r.next);
  sh(fa.wt, ['git', 'show', '--stat', '--format=%h %s', 'HEAD'], { rec });
  sh(fa.wt, ['cat', 'package.json', 'CHANGELOG.md', 'docs/feature.md'], { rec });
  assert(JSON.parse(read(fa.wt, 'package.json')).version === '1.5.0', 'package.json written');
  treeOf(a, fa);
  human(a, fa, rec);
  expectStep(nextOf(a, fa), 'enable-auto-merge', 'feature after its release');

  rec.text('### With no `CHANGELOG.md` and no `docs/adr/`\n\nOnly the release file is written; no changelog and no ADR folder is created.');
  const b = seedProject('p4b', { config: consumerConfig('package.json'), files: consumerFiles({ changelog: false, adr: false }) });
  const fb = openChange(b, 'feature', { note: CONSUMER_NOTE });
  const rb = drive(b, fb, rec);
  expectStep(rb.next, 'assign-release', 'feature before its release (no changelog)');
  assignRelease(b, fb, rb.next);
  sh(fb.wt, ['git', 'show', '--stat', '--format=%h %s', 'HEAD'], { rec });
  sh(fb.wt, ['cat', 'package.json'], { rec });
  sh(fb.wt, ['ls', '-a'], { rec, label: 'ls -a   # no CHANGELOG.md, no docs/' });
  assert(!existsSync(join(fb.wt, 'CHANGELOG.md')) && !existsSync(join(fb.wt, 'docs')), 'no file created');
  treeOf(b, fb);
  human(b, fb, rec);
  expectStep(nextOf(b, fb), 'enable-auto-merge', 'feature after its release (no changelog)');

  rec.text('### The key names a file the project does not have\n\n`devkit.release_tag: VERSION.json`, which does not exist (and no `CHANGELOG.md`): there is nothing to write, so the note is assigned at once, the checker asks no new step and the step, run by hand, writes nothing.');
  const c = seedProject('p4c', { config: consumerConfig('VERSION.json'), files: consumerFiles({ changelog: false, adr: false }) });
  const fc = openChange(c, 'feature', { note: CONSUMER_NOTE });
  const rc = drive(c, fc, rec);
  expectStep(rc.next, 'enable-auto-merge', 'feature with a missing release file');
  human(c, fc, rec);
  const head0 = git(fc.wt, 'rev-parse', 'HEAD');
  sh(fc.wt, node('release-merge.mjs', '--assign', '--base', 'main', '--json'), { env: c.env, rec });
  assert(git(fc.wt, 'rev-parse', 'HEAD') === head0, 'no commit');
  treeOf(c, fc);
  rec.flush();
}

function p5() {
  rec.text(`## P-5 a consumer project with no \`devkit.release_tag\`

AC-9. Project \`p5\`: the consumer layout of P-4 (\`package.json\`, \`CHANGELOG.md\`, \`docs/adr/\`) with no \`devkit.release_tag\`. The same
commands: nothing new is asked, refused or written, whether the change has no note or carries a \`release.md\` (here a malformed one,
which nothing reads).`);
  const p = seedProject('p5', { config: consumerConfig(null), files: consumerFiles() });
  sh(p.main, ['cat', 'openspec/config.yaml'], { rec });
  rec.text('### A change with no note');
  const plain = openChange(p, 'plain');
  const r1 = drive(p, plain, rec);
  expectStep(r1.next, 'enable-auto-merge', 'plain');
  human(p, plain, rec);
  const full = sh(plain.wt, node('deliver-check.mjs', 'plain', '--json'), { env: p.env, expect: null });
  rec.block(`(in ${plain.wt})\n$ node $DEV/deliver-check.mjs plain --json   # its "approval" field: the four keys of a change with no note\n${JSON.stringify({ approval: JSON.parse(full.out).approval ?? null }, null, 2)}\n[exit ${full.code}]`);
  treeOf(p, plain);
  rec.text('### A change that carries a `release.md` nothing reads');
  const noted = openChange(p, 'noted', { note: note('packs:', '- app: big'), releaseLine: null });
  const r2 = drive(p, noted, rec);
  expectStep(r2.next, 'enable-auto-merge', 'noted with no key');
  human(p, noted, rec);
  rec.text('The step, run by hand, refuses to run in a project with no release setting and writes nothing (the checker never asks for it there):');
  const head0 = git(noted.wt, 'rev-parse', 'HEAD');
  sh(noted.wt, node('release-merge.mjs', '--assign', '--base', 'main', '--json'), { env: p.env, rec, expect: [2] });
  assert(git(noted.wt, 'rev-parse', 'HEAD') === head0, 'no commit');
  treeOf(p, noted);
  sh(noted.wt, ['cat', 'package.json', 'CHANGELOG.md'], { rec });
  rec.flush();
}

// ---------------------------------------------------------------- P-6 to P-11 (6.6): each refusal, and the fix that lets the run go on

// The step run by hand where the checker refuses, to show it refuses the same way and leaves the branch as it was.
function stepRefuses(p, c, pattern) {
  const head0 = git(c.wt, 'rev-parse', 'HEAD');
  const r = sh(c.wt, node('release-merge.mjs', '--assign', '--base', 'main', '--json'), { env: p.env, rec, expect: [2] });
  const error = JSON.parse(r.out).error ?? '';
  assert(pattern.test(error), `the step's refusal ${error} matches ${pattern}`);
  assert(git(c.wt, 'rev-parse', 'HEAD') === head0 && git(c.wt, 'status', '--porcelain') === '', 'the branch is as it was');
  return error;
}
function refusedWith(p, c, pattern, what) {
  human(p, c, rec);
  const n = nextOf(p, c);
  if (n.step !== 'blocked' || !pattern.test(n.reason)) throw new Error(`${what}: expected blocked ${pattern}, got ${n.step}: ${n.reason}`);
  return n;
}
// After a fix: the run goes on through the release step to enable-auto-merge.
function goesOn(p, c, { assign = true } = {}) {
  const r = drive(p, c, rec);
  if (assign) {
    expectStep(r.next, 'assign-release', `${c.id} after its fix`);
    assignRelease(p, c, r.next);
  }
  human(p, c, rec);
  expectStep(nextOf(p, c), 'enable-auto-merge', `${c.id} at the end`);
}

function p6() {
  rec.text(`## P-6 refusal: a version edited by hand

AC-2. Project \`p6\` (the seed). Change \`hand\` notes devkit-openspec \`patch\`, but its code task also sets devkit-core's version to
1.0.5 in \`plugins/core/.claude-plugin/plugin.json\`, a release line the delivery writes.`);
  const p = seedProject('p6');
  const c = openChange(p, 'hand', { note: patchNote('hand') });
  drive(p, c, rec, { code: { 1: { 'plugins/core/.claude-plugin/plugin.json': manifest('devkit-core', '1.0.5') } } });
  refusedWith(p, c, /^release lines edited by hand: plugins\/core\/\.claude-plugin\/plugin\.json$/, 'hand');
  stepRefuses(p, c, /^release lines edited by hand: plugins\/core\/\.claude-plugin\/plugin\.json$/);
  rec.text('The fix: the implementer puts the line back as the base has it; the run goes on to the release step, which writes the release from the note:');
  sh(c.wt, ['git', 'checkout', 'origin/main', '--', 'plugins/core/.claude-plugin/plugin.json'], { rec });
  sh(c.wt, ['git', 'commit', '-q', '-m', 'fix(hand): leave the release lines to the delivery'], { rec });
  goesOn(p, c);
  sh(c.wt, ['cat', 'plugins/core/.claude-plugin/plugin.json', RELEASE_FILE], { rec });
  rec.flush();
}

function p7() {
  rec.text(`## P-7 refusal: no release; then \`packs: []\` passes

AC-11. Project \`p7\` (the seed). Change \`nonote\` (schema \`devkit-lite\`) has no note and no bump of its own, and its code task edits
\`plugins/core/README.md\`, a file of the devkit-core pack.`);
  const p = seedProject('p7');
  const c = openChange(p, 'nonote', { schema: 'devkit-lite' });
  drive(p, c, rec, { code: { 1: { 'plugins/core/README.md': '# devkit-core\n\nThe agents of the core pack, edited.\n' } } });
  refusedWith(p, c, /^no release: plugins\/core: /, 'nonote');
  rec.text('The fix: the change states that it releases nothing, in a note of `packs: []`; with nothing to write the note is assigned at once, so no `assign-release` is asked and the run goes on to `enable-auto-merge`:');
  put(c.wt, { 'openspec/changes/nonote/release.md': note('packs: []') });
  sh(c.wt, ['git', 'add', 'openspec/changes/nonote/release.md'], { rec });
  sh(c.wt, ['git', 'commit', '-q', '-m', 'docs(nonote): the release note: no release'], { rec });
  sh(c.wt, ['git', 'show', '--format=%h %s', 'HEAD'], { rec });
  goesOn(p, c, { assign: false });
  rec.text('### The same refusal for an unnumbered record listed with no note\n\nChange `noadr` (schema `devkit-lite`) lists `docs/adr/noadr.md` in its `decisions.md` and has no note:');
  const d = openChange(p, 'noadr', { schema: 'devkit-lite', adrs: ['noadr'] });
  drive(p, d, rec);
  refusedWith(p, d, /^no release: docs\/adr\/noadr\.md: /, 'noadr');
  rec.text('The fix: a note of `packs: []`; the record is then numbered by the release step:');
  put(d.wt, { 'openspec/changes/noadr/release.md': note('packs: []') });
  sh(d.wt, ['git', 'add', 'openspec/changes/noadr/release.md'], { rec });
  sh(d.wt, ['git', 'commit', '-q', '-m', 'docs(noadr): the release note: no release'], { rec });
  sh(d.wt, ['git', 'show', '--format=%h %s', 'HEAD'], { rec });
  goesOn(p, d);
  sh(d.wt, ['ls', 'docs/adr'], { rec });
  rec.flush();
}

function p8() {
  rec.text(`## P-8 refusal: the note changed after the approval

AC-12. Project \`p8\` (the seed). Change \`late\` (schema \`devkit\`) was approved with its note (devkit-core \`patch\`); its
\`approval.md\` records the note's hash. After the work is done and the pull request is open, the note is changed to \`minor\`.`);
  const p = seedProject('p8');
  const c = openChange(p, 'late', { note: patchNote('late', 'devkit-core', 'patch') });
  sh(c.wt, ['cat', 'openspec/changes/late/approval.md'], { rec });
  const r = drive(p, c, rec);
  expectStep(r.next, 'assign-release', 'late before the edit');
  put(c.wt, { 'openspec/changes/late/release.md': patchNote('late', 'devkit-core', 'minor') });
  sh(c.wt, ['git', 'commit', '-q', '-am', 'docs(late): a bigger release'], { rec });
  sh(c.wt, ['git', 'show', '--format=%h %s', 'HEAD'], { rec });
  sh(c.wt, ['sha256sum', 'openspec/changes/late/release.md'], { rec });
  human(p, c, rec);
  const n = nextOf(p, c);
  expectStep(n, 'stop-plan-approval', 'late after its note changed');
  assert(n.reason === 'release note changed after approval' && n.release === hash12(join(c.wt, 'openspec/changes/late/release.md')), 'A1 names the new hash');
  showNext(n);
  rec.text('The session stops and asks the owner; once the owner\'s own message approves again, it writes `approval.md` as the `stop-plan-approval` row says, with `next.readiness` and `- Release note: <next.release>`, and runs the loop again:');
  writeApproval(c.wt, 'late', git(c.wt, 'rev-parse', 'HEAD'), { attempt: 2, release: n.release });
  sh(c.wt, ['cat', 'openspec/changes/late/approval.md'], { rec });
  sh(c.wt, ['git', 'commit', '-q', '-am', 'docs(late): the owner approves the plan again'], { rec });
  goesOn(p, c);
  sh(c.wt, ['cat', 'plugins/core/.claude-plugin/plugin.json'], { rec });
  rec.flush();
}

function p9() {
  rec.text(`## P-9 refusal: an unlanded citation; the cited change lands; the citation is rewritten

AC-7. Project \`p9\` (the seed). Change \`cited\` names \`docs/adr/cited.md\`. Change \`citing\` names \`docs/adr/citing.md\` and writes
\`Amends ADR [cited]\` in \`docs/citing.md\`. Both note a devkit-openspec \`patch\`.`);
  const p = seedProject('p9');
  const cited = openChange(p, 'cited', { note: patchNote('cited'), adrs: ['cited'] });
  const citing = openChange(p, 'citing', { note: patchNote('citing'), adrs: ['citing'], files: { 'docs/citing.md': '# citing\n\nThis rule is ADR [citing]. Amends ADR [cited].\n' } });
  drive(p, citing, rec);
  refusedWith(p, citing, /^ADR \[cited\] is cited but has not landed on main$/, 'citing');
  stepRefuses(p, citing, /^ADR \[cited\] is cited but has not landed on main; it lands with its own change$/);
  rec.text('`cited` is delivered first: its release step numbers it 0002, auto-merge is enabled and GitHub merges it:');
  const r = drive(p, cited, rec);
  assignRelease(p, cited, r.next);
  autoMerge(p, cited, nextOf(p, cited));
  rec.text('`citing` again, after a fetch: the citation has landed, so the checker no longer blocks and the run goes on to the release step, which rewrites the citation to the number `cited` took and numbers `citing`\'s own record above it:');
  sh(citing.wt, ['git', 'fetch', 'origin'], { env: p.env, rec });
  goesOn(p, citing);
  sh(citing.wt, ['cat', 'docs/citing.md'], { rec });
  sh(citing.wt, ['ls', 'docs/adr'], { rec });
  assert(read(citing.wt, 'docs/citing.md').includes('Amends ADR 0002.') && read(citing.wt, 'docs/citing.md').includes('This rule is ADR 0003.'), 'the citations are rewritten');
  rec.flush();
}

const checkPy = (dir, env, extra = {}, expect = [0]) => sh(dir, ['python3', join(WT, 'scripts', 'check.py'), '--root', dir], { env: { ...env, ...extra }, rec, expect, label: `${Object.entries(extra).map(([k, v]) => `${k}=${v} `).join('')}python3 $WT/scripts/check.py --root ${dir}` });

function p10() {
  rec.text(`## P-10 refusal: a duplicate slug; \`check.py\` on the branch and on \`main\`

AC-6. Project \`p10\` (the seed). Two changes pick the same slug: \`cache\` names its record of the store topic \`docs/adr/cache-store.md\`
(\`<change-id>-<topic>\`), and \`cache-store\` names its own \`docs/adr/cache-store.md\` (\`<change-id>\`). Both are opened from the same
base; \`cache\` lands first.`);
  const p = seedProject('p10');
  const cache = openChange(p, 'cache', { note: patchNote('cache', 'devkit-core'), adrs: ['cache-store'] });
  const store = openChange(p, 'cache-store', { note: patchNote('cache-store'), adrs: ['cache-store'], files: { 'docs/cache-store.md': '# cache-store\n\nSee ADR [cache-store].\n' } });
  rec.text('On its own branch, before anything lands, `cache-store`\'s unnumbered record is tolerated by `check.py` (it is listed by its change):');
  checkPy(store.wt, p.env);
  const rc = drive(p, cache, rec);
  assignRelease(p, cache, rc.next);
  autoMerge(p, cache, nextOf(p, cache));
  rec.text('`cache` landed as `docs/adr/0002-cache-store.md`. `cache-store` reaches its release step; the step merges `main` and refuses the second record with that slug, undoing the merge:');
  sh(store.wt, ['git', 'fetch', 'origin'], { env: p.env, rec });
  const r = drive(p, store, rec);
  expectStep(r.next, 'assign-release', 'cache-store before its release');
  const head0 = git(store.wt, 'rev-parse', 'HEAD');
  const a = assignRelease(p, store, r.next, { expect: [2] });
  assert(/^a second ADR with the slug cache-store: docs\/adr\/cache-store\.md, docs\/adr\/0002-cache-store\.md$/.test(JSON.parse(a.out).error), 'the duplicate slug is named');
  assert(git(store.wt, 'rev-parse', 'HEAD') === head0 && git(store.wt, 'status', '--porcelain') === '', 'the branch is as it was');
  rec.text('The session stops as `blocked: item 5 (<the JSON\'s error>)`. What `check.py` says of the same tree, in the two places it runs: the pull request\'s merge ref in CI (`GITHUB_HEAD_REF` set: a branch), where two records with one slug are refused, and `main` once such a merge reached it, where the unnumbered record is refused too:');
  const ci = join(p.dir, 'ci-merge-ref');
  sh(p.main, ['git', 'worktree', 'add', '-q', '--detach', ci, 'origin/main'], { rec });
  sh(ci, ['git', 'merge', '-q', '--no-ff', '--no-edit', 'origin/cache-store'], { rec });
  assert(/^a second ADR with the slug cache-store: docs\/adr\/0002-cache-store\.md, docs\/adr\/cache-store\.md$/.test(checkPy(ci, p.env, { GITHUB_HEAD_REF: 'cache-store' }, [1]).out.trim()), 'check.py on the merge ref');
  const clone = join(p.dir, 'main-after-a-bad-merge');
  sh(p.dir, ['git', 'clone', '-q', p.origin, clone], { rec });
  sh(clone, ['git', 'merge', '-q', '--no-ff', '--no-edit', 'origin/cache-store'], { rec });
  assert(/unnumbered ADR on the base branch/.test(checkPy(clone, p.env, {}, [1]).out), 'check.py on main');
  rec.text('The fix: `cache-store` renames its record to a slug of its own (`cache-store-layer`), in its file, `decisions.md` and its citation; the rename is a plain edit of its own files, so the records are taken again, and the release step then goes through:');
  sh(store.wt, ['git', 'mv', 'docs/adr/cache-store.md', 'docs/adr/cache-store-layer.md'], { rec });
  for (const f of ['docs/adr/cache-store-layer.md', 'docs/cache-store.md', 'openspec/changes/cache-store/decisions.md']) put(store.wt, { [f]: read(store.wt, f).replaceAll('ADR [cache-store]', 'ADR [cache-store-layer]').replaceAll('docs/adr/cache-store.md', 'docs/adr/cache-store-layer.md') });
  sh(store.wt, ['git', 'commit', '-q', '-am', 'docs(cache-store): a slug of its own for the record'], { rec });
  sh(store.wt, ['git', 'show', '--format=%h %s', 'HEAD'], { rec });
  goesOn(p, store);
  sh(store.wt, ['ls', 'docs/adr'], { rec });
  checkPy(store.wt, p.env);
  rec.flush();
}

const MALFORMED = [
  ['an empty file', '', /^release\.md: packs: missing/],
  ['no packs: line', note('# Release note', '', '## t', '', '- body'), /^release\.md: packs: missing/],
  ['a list line that is not "- <pack>: <kind>"', note('packs:', '- devkit-core patch', '', '## t', '', '- body'), /^release\.md: packs: line 2: "- devkit-core patch" is not/],
  ['a kind outside the three', note('packs:', '- devkit-core: big', '', '## t', '', '- body'), /^release\.md: packs: devkit-core: "big" is not patch, minor or major$/],
  ['a pack twice', note('packs:', '- devkit-core: patch', '- devkit-core: minor', '', '## t', '', '- body'), /^release\.md: packs: devkit-core is listed twice$/],
  ['marketplace: after release:', note('packs:', '- devkit-core: patch', 'release: minor', 'marketplace: minor', '', '## t', '', '- body'), /^release\.md: marketplace: out of order/],
  ['marketplace: twice', note('packs:', '- devkit-core: patch', 'marketplace: minor', 'marketplace: minor', '', '## t', '', '- body'), /^release\.md: marketplace: given twice$/],
  ['a marketplace kind outside the three', note('packs:', '- devkit-core: patch', 'marketplace: huge', '', '## t', '', '- body'), /^release\.md: marketplace: "huge" is not patch, minor or major$/],
  ['a line that is no field', note('packs:', '- devkit-core: patch', 'notes: none', '', '## t', '', '- body'), /^release\.md: line 3: "notes: none" is not a field of the note$/],
  ['no changelog title', note('packs:', '- devkit-core: patch'), /^release\.md: changelog title: missing/],
  ['an empty changelog body', note('packs:', '- devkit-core: patch', '', '## t'), /^release\.md: changelog body: empty/],
  ['a code fence never closed', note('packs:', '- devkit-core: patch', '', '## t', '', '- body', '', '```js', 'const x = 1;'), /^release\.md: changelog body: a code fence opened at line 8 is never closed$/],
  ['a pack the project does not have', note('packs:', '- devkit-x: patch', '', '## t', '', '- body'), /^release\.md: packs: devkit-x is not a pack of this project$/],
  ['release: when the release file is a pack manifest', note('packs:', '- devkit-core: patch', 'release: minor', '', '## t', '', '- body'), /^release\.md: release: plugins\/openspec\/\.claude-plugin\/plugin\.json is the manifest of devkit-openspec; state its bump under packs:$/],
];

function malformed(p, c, name, text, pattern) {
  rec.text(`### ${name}`);
  put(c.wt, { [`openspec/changes/${c.id}/release.md`]: text });
  sh(c.wt, ['git', 'add', '-A'], {});
  sh(c.wt, ['git', 'commit', '-q', '-m', `docs(${c.id}): a note with ${name}`], {});
  sh(c.wt, ['cat', '-A', `openspec/changes/${c.id}/release.md`], { rec });
  refusedWith(p, c, pattern, name);
  stepRefuses(p, c, pattern);
}

function p11() {
  rec.text(`## P-11 each malformed field of the note, through the checker and the step

AC-1. Project \`p11\` (the seed). Change \`mal\` (schema \`devkit-lite\`) has its work committed; each variant below replaces its
\`release.md\` with one defect and commits it. The checker answers row N1 (\`blocked\` with the reader's message, which starts
\`release.md:\` and names the field) and the step, run by hand, refuses with the same message and leaves the branch as it was.`);
  const p = seedProject('p11');
  const c = openChange(p, 'mal', { schema: 'devkit-lite', note: patchNote('mal', 'devkit-core') });
  const r = drive(p, c, rec, { until: ['verify'] });
  expectStep(r.next, 'verify', 'mal with its work committed');
  for (const [name, text, pattern] of MALFORMED) malformed(p, c, name, text, pattern);
  rec.text('### `marketplace:` in a project with no marketplace file\n\nProject `p11m`: the seed without `.claude-plugin/marketplace.json`.');
  const { ['.claude-plugin/marketplace.json']: _market, ...noMarket } = marketFiles();
  const q = seedProject('p11m', { files: noMarket });
  const m = openChange(q, 'mal', { schema: 'devkit-lite', note: patchNote('mal', 'devkit-core') });
  drive(q, m, rec, { until: ['verify'] });
  malformed(q, m, 'marketplace: with no marketplace file', note('packs:', '- devkit-core: patch', 'marketplace: minor', '', '## t', '', '- body'), /^release\.md: marketplace: the project has no \.claude-plugin\/marketplace\.json$/);
  rec.text('### The fix\n\nA note that reads: the run goes on through the evidence, the reviews and the pull request to the release step, and then to `enable-auto-merge`.');
  put(c.wt, { 'openspec/changes/mal/release.md': patchNote('mal', 'devkit-core') });
  sh(c.wt, ['git', 'commit', '-q', '-am', 'docs(mal): a note that reads'], { rec });
  sh(c.wt, ['git', 'show', '--format=%h %s', 'HEAD'], { rec });
  goesOn(p, c);
  rec.flush();
}

// ---------------------------------------------------------------- P-12 (6.2, 6.3): the tag after the single merge and after the train

function p12() {
  rec.text(`## P-12 the release tag after the single merge of P-1 and after the train of P-2

AC-13. The tag rule of ADR 0019 is unchanged: \`deliver-check\` reads the release file's \`version\` at the merge commit and at its first
parent through the stub (which serves the merge commits the cases made) and asks \`tag-release\` when they differ and origin has no tag.`);
  const p = projects.p1;
  if (p) {
    rec.text('### After the single merge of P-1\n\nGitHub merges `feat` (auto-merge was enabled at its head):');
    const merge = sh(p.main, ['gh', '__merge', String(p.featNext.number)], { env: p.env, rec, label: `gh __merge ${p.featNext.number}   # the stub: GitHub merges the pull request once its rules pass` }).out.trim().split(' ')[0];
    sh(p.feat.wt, ['git', 'fetch', 'origin'], { env: p.env, rec });
    sh(p.feat.wt, ['git', 'show', '--format=%H %P%n%s', '--no-patch', 'origin/main'], { rec });
    sh(p.feat.wt, ['git', 'show', `origin/main:${RELEASE_FILE}`], { rec });
    sh(p.feat.wt, ['git', 'show', `origin/main^1:${RELEASE_FILE}`], { rec });
    human(p, p.feat, rec);
    const t = nextOf(p, p.feat);
    expectStep(t, 'tag-release', 'feat after its merge');
    assert(t.sha === merge && t.tag === 'v1.1.0', 'the tag of the merge commit');
    showNext(t);
    rec.text('The `tag-release` row, as the session runs it:');
    sh(p.feat.wt, ['git', 'fetch', 'origin', t.base], { env: p.env, rec });
    sh(p.feat.wt, ['git', 'rev-parse', '-q', '--verify', `refs/tags/${t.tag}`], { rec, expect: [1], label: `git rev-parse -q --verify refs/tags/${t.tag}   # no local tag yet` });
    sh(p.feat.wt, ['git', 'tag', t.tag, t.sha], { rec });
    sh(p.feat.wt, ['git', 'push', 'origin', `refs/tags/${t.tag}`], { env: p.env, rec });
    sh(p.feat.wt, ['gh', 'api', `repos/{owner}/{repo}/git/ref/tags/${t.tag}`], { env: p.env, rec });
    human(p, p.feat, rec);
    const after = nextOf(p, p.feat);
    assert(after.step !== 'tag-release', 'the tag is done');
    showNext(after);
  }
  const q = projects.p2;
  if (q) {
    rec.text('### After the train of P-2\n\nThe train loop hands the session the push, the pull request and auto-merge of `train/1`; then GitHub merges it, and marks both boarded pull requests merged by the train\'s merge commit:');
    for (const step of ['push-train', 'open-train-pr', 'enable-auto-merge']) {
      const { action } = trainStep(q);
      expectStep({ step: action.step, reason: JSON.stringify(action) }, step, 'the train loop');
    }
    const wait = trainStep(q);
    expectStep({ step: wait.action.step, reason: JSON.stringify(wait.action) }, 'train-auto-merge-on', 'the train loop');
    const trainPr = wait.action.detail.number;
    const merge = sh(q.main, ['gh', '__merge', String(trainPr)], { env: q.env, rec, label: `gh __merge ${trainPr}   # the stub: GitHub merges the train once its rules pass` }).out.trim().split(' ')[0];
    sh(q.main, ['git', 'fetch', 'origin'], { env: q.env, rec });
    sh(q.main, ['git', 'show', '--format=%H %P%n%s', '--no-patch', 'origin/main'], { rec });
    sh(q.main, ['gh', 'pr', 'list', '--state', 'all', '--json', 'number,headRefName,state,mergeCommit'], { env: q.env, rec });
    const [alpha, beta] = [q.changes.alpha, q.changes.beta];
    human(q, alpha, rec);
    const t = nextOf(q, alpha);
    expectStep(t, 'tag-release', 'alpha after the train merged');
    assert(t.sha === merge && t.tag === 'v1.2.0', 'the tag of the train\'s merge commit');
    showNext(t);
    rec.text('The `tag-release` row, as the session runs it in `alpha`\'s worktree:');
    sh(alpha.wt, ['git', 'fetch', 'origin', t.base], { env: q.env, rec });
    sh(alpha.wt, ['git', 'rev-parse', '-q', '--verify', `refs/tags/${t.tag}`], { rec, expect: [1], label: `git rev-parse -q --verify refs/tags/${t.tag}   # no local tag yet` });
    sh(alpha.wt, ['git', 'tag', t.tag, t.sha], { rec });
    sh(alpha.wt, ['git', 'push', 'origin', `refs/tags/${t.tag}`], { env: q.env, rec });
    rec.text('The same tag is the release of `beta`, carried by the same merge commit, so `beta` asks for no other tag:');
    for (const c of [alpha, beta]) {
      human(q, c, rec);
      const n = nextOf(q, c);
      assert(n.step !== 'tag-release', `${c.id}: the tag is done`);
      showNext(n);
    }
  }
  rec.flush();
}

// ---------------------------------------------------------------- the run

const CASE_LIST = [['seed', seed], ['P-1', p1], ['P-2', p2], ['P-3', p3], ['P-4', p4], ['P-5', p5], ['P-6', p6], ['P-7', p7], ['P-8', p8], ['P-9', p9], ['P-10', p10], ['P-11', p11], ['P-12', p12]];
for (const [name, fn] of CASE_LIST) {
  if (!all && name !== 'seed' && !wanted.includes(name)) continue;
  try { fn(); } catch (e) {
    rec.text(`**The run stopped in ${name}:** ${e.message}`);
    rec.flush();
    process.stderr.write(`${name}: ${e.stack}\n`);
    process.exit(1);
  }
  process.stdout.write(`${name} done\n`);
}
process.stdout.write(`written: ${OUT}\n`);
