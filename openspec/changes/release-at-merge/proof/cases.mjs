// The cases of the release-at-merge real-run proof (design D-16 and D-36, P-1 to P-16; tasks 6.1 to 6.6, 9.14 and 11.10). Each case builds its projects with
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
  PROOF, CASES, WT, DEV, Record, sh, git, put, read, commitAll, seedProject, openChange, writeApproval, drive, human, report, node,
  marketFiles, TRAIN_CONFIG, RELEASE_FILE, GUIDE0, flowPage, hash12, manifest, marketplace, catalog, CHANGELOG0, consumerFiles,
  openLoopChange, loopNext, stageHead, proposalText, TASKS, specText,
} from './seed.mjs';

// This worktree's delivery checker, for the plan digest the owner's approval records (P-16).
const DC = await import(join(DEV, 'deliver-check.mjs'));

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
// The message of the change's last commit, recorded: the step's commits end with its record (D-20).
const recordOf = (c) => sh(c.wt, ['git', 'log', '-1', '--format=%B'], { rec }).out;
// The `next` field of a `deliver-check <id> --json` run at the same head as the human report above it, in full (its command, path
// and number fields are what the session acts on).
const showNext = (n) => rec.block(`"next" of deliver-check <id> --json at this head:\n${JSON.stringify(n, null, 2)}`);
function expectStep(n, step, what) {
  if (n.step !== step) throw new Error(`${what}: expected ${step}, got ${n.step}: ${n.reason}`);
}
const assert = (ok, what) => { if (!ok) throw new Error(`check failed: ${what}`); };

// ---------------------------------------------------------------- the seed (6.1)

function seed() {
  rec.text(`# Real-run proof: release-at-merge (tasks 6.1 to 6.6, 9.14 after review round 1, and 11.10 after review round 3)

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

After review round 1 the whole script ran again with P-13 (task 9.14), and its first run of P-13 found one defect in
\`release-merge.mjs\`, fixed test-first before this run:

- The note's body cites \`ADR [feat]\`, so the step's record lists \`CHANGELOG.md\` among the citations it rewrote. After the merge by
  hand, which takes the base's changelog as the \`assign-release\` row says, the give-back of D-20 tried to put \`ADR [feat]\` back in an
  entry the file no longer held and refused (\`cannot give back the numbers the step wrote in CHANGELOG.md\`, exit 2), though the flow
  page already says a \`CHANGELOG.md\` entry the record wrote is not given back. The give-back now skips \`CHANGELOG.md\`, whose whole
  text the step writes from the note on the base (test "release-note AC-4 assign: a merge by hand that takes the base's CHANGELOG.md,
  where the step had cited the ADR by its number, is numbered again" in \`release-merge.test.mjs\`).

After review round 3 the whole script ran again with P-14 to P-16 (task 11.10, D-36). Their changes that the loop walks
(\`openLoopChange\` of \`seed.mjs\`) are \`devkit-lite\` changes whose plan files carry the stage headers and a spec delta
\`openspec validate\` reads, and every step from the release on is the one this worktree's \`change-loop.mjs next\` hands. Two steps
the loop hands there are not named in D-36's table and are run as handed: \`merge-check\` (the merge of the base on the branch checked
with \`openspec validate\` before the delivery goes on), and the plain \`push\`, which the loop hands to \`devkit-core:commit-and-pr\`
and the case runs as its command. The first run of P-14 (d), whose sibling's step wrote the base's entry on the one-line list in the
step's form with the number the change's step had written (\`ADR 0002 other\` beside \`ADR 0002 the rule\`), found one defect in
\`deliver-check.mjs\`, fixed test-first before this run:

- After the merge by hand keeping both entries, the step gave the change's number back and numbered it 0003 (exit 0), but the
  evidence and the reviews written at the merge read stale (\`touches docs/context.yaml\`): \`releaseOnlyEdit\` masks the merge's
  text with the records the merge holds, two of them numbered 0002, so both \`ADR 0002\` read as the first of them and the base's entry
  did not match the step's commit, where it reads as its own record. A number two records hold at one revision now cites either of
  them there (tests "release-note AC-4 staleness: the step run on a merge by hand holding two records numbered 0002, ..." and its guard
  "release-note AC-5 staleness: a citation a person changes on a merge by hand holding two records numbered 0002 still stales the
  records" in \`deliver-check.test.mjs\`).

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
  rec.text('Its message ends with the step\'s record (D-20): the change, each release line it wrote, the record\'s rename and each citation it rewrote, as `Release-` trailers:');
  assert(/\nRelease-change: feat\n/.test(recordOf(feat)), 'the step\'s record');
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
  assert(/\nRelease-change: feat\n/.test(recordOf(feat)), 'the merge commit\'s record');
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
  rec.text('The step, run by hand, refuses to run in a project with no release setting with a usage error (exit 3, D-24) and writes nothing (the checker never asks for it there):');
  const head0 = git(noted.wt, 'rev-parse', 'HEAD');
  sh(noted.wt, node('release-merge.mjs', '--assign', '--base', 'main', '--json'), { env: p.env, rec, expect: [3] });
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

// ---------------------------------------------------------------- P-13 (9.14): a merge by hand after a code conflict, then the step again

// The release files of the seed's layout: the lines the step writes, whose base side the session takes in a merge by hand.
const RELEASE_PATHS = [RELEASE_FILE, 'plugins/core/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/catalog.md', 'docs/openspec-flow.md'];
// The state of the change's release lines at this head (D-3, D-20), as the checker derives it: releaseState of this worktree's
// deliver-check.mjs with the facts gitFacts reads against origin/main, recorded.
function showRelease(p, c) {
  const code = `import('${join(DEV, 'deliver-check.mjs')}').then((D) => { const s = D.releaseState(process.cwd(), '${c.id}', D.gitFacts(process.cwd(), { base: 'main' })); `
    + 'console.log(JSON.stringify({ kind: s.kind, current: s.current, paths: s.paths, reassign: s.reassign, adrs: s.adrs }, null, 2)); })';
  const r = sh(c.wt, ['node', '-e', code], { env: p.env, rec, label: `node -e "import('$DEV/deliver-check.mjs').then((D) => console.log(D.releaseState(process.cwd(), '${c.id}', D.gitFacts(process.cwd(), { base: 'main' }))))"   # kind, current, paths, reassign, adrs` });
  return JSON.parse(r.out);
}

function p13() {
  rec.text(`## P-13 a merge by hand after a code conflict with a base that released the same pack and took the same ADR number

AC-4, AC-5 (code-quality F1 of review round 1, D-20). Project \`p13\`: the seed with a source file \`src/a.ts\`. Change \`feat\` notes
devkit-openspec \`minor\` and devkit-core \`patch\`, names its record \`docs/adr/feat.md\` (listed in \`decisions.md\`), cites it
\`ADR [feat]\` and \`adr/feat.md\` in \`docs/guide.md\`, and edits \`src/a.ts\`. Its sibling \`sib\` notes devkit-openspec \`minor\`,
names its record \`docs/adr/sib.md\` and edits \`src/a.ts\` too, in the same line. \`feat\` takes its release first (devkit-openspec 1.1.0,
ADR 0002); then \`sib\` takes the same numbers on the same base and lands.`);
  const p = seedProject('p13', { files: { ...marketFiles(), 'src/a.ts': 'export const a = 0;\n' } });
  const feat = openChange(p, 'feat', {
    note: FEAT_NOTE, adrs: ['feat'],
    // The file-form citation is plain text, not a Markdown link: real-run.md is read by check.py, whose fence matching P-11's four-backtick
    // block (a note with an unclosed fence) shifts, so a link in a later case would be read as prose and resolved.
    files: { 'docs/guide.md': guideWith('A', 'The rule is ADR [feat], recorded in adr/feat.md.'), 'src/a.ts': 'export const a = 1; // feat\n' },
  });
  const sib = openChange(p, 'sib', { note: patchNote('sib', 'devkit-openspec', 'minor'), adrs: ['sib'], files: { 'docs/sib.md': '# The sibling\n\nThe fix is ADR [sib].\n', 'src/a.ts': 'export const a = 2; // sib\n' } });
  rec.text('### `feat` takes its release');
  const r1 = drive(p, feat, rec);
  expectStep(r1.next, 'assign-release', 'feat before its release');
  showNext(r1.next);
  const a1 = JSON.parse(assignRelease(p, feat, r1.next).out);
  assert(a1.adrs[0]?.to === 'docs/adr/0002-feat.md' && a1.versions.packs['devkit-openspec'] === '1.1.0', 'feat numbered 0002 and 1.1.0');
  recordOf(feat);
  expectStep(nextOf(p, feat), 'enable-auto-merge', 'feat after its release');

  rec.text('### The sibling lands with the same pack\'s next version and the same ADR number, and an edit of `src/a.ts`');
  const s1 = drive(p, sib, rec);
  expectStep(s1.next, 'assign-release', 'sib before its release');
  const sa = JSON.parse(assignRelease(p, sib, s1.next).out);
  assert(sa.adrs[0]?.to === 'docs/adr/0002-sib.md' && sa.versions.packs['devkit-openspec'] === '1.1.0', 'sib numbered 0002 and 1.1.0');
  autoMerge(p, sib, nextOf(p, sib));
  sh(p.main, ['git', 'fetch', '-q', 'origin'], { env: p.env });
  sh(p.main, ['git', 'log', '--oneline', '--graph', '-4', 'origin/main'], { rec });
  sh(p.main, ['git', 'show', 'origin/main:src/a.ts', `origin/main:${RELEASE_FILE}`], { rec });
  sh(p.main, ['git', 'ls-tree', '--name-only', 'origin/main', 'docs/adr/'], { rec });

  rec.text('### `feat` again: the step stops on the code conflict\n\nThe base moved, so the checker asks for `assign-release` again; the step merges `origin/main`, meets a conflict outside the release lines (`src/a.ts`), exits 2 naming it and leaves the branch as it was:');
  human(p, feat, rec);
  const n2 = nextOf(p, feat);
  expectStep(n2, 'assign-release', 'feat after the base moved');
  showNext(n2);
  const head0 = git(feat.wt, 'rev-parse', 'HEAD');
  const refused = assignRelease(p, feat, n2, { expect: [2] });
  const rj = JSON.parse(refused.out);
  assert((rj.conflicts ?? []).includes('src/a.ts'), `the step names src/a.ts: ${refused.out}`);
  assert(git(feat.wt, 'rev-parse', 'HEAD') === head0 && git(feat.wt, 'status', '--porcelain') === '', 'the branch is as it was');
  sh(feat.wt, ['git', 'status', '--short', '--branch'], { rec, label: 'git status --short --branch   # the branch as it was: no merge in progress' });

  rec.text('### The merge by hand\n\nThe session stops as `blocked: item 5 (src/a.ts)` and, as the `assign-release` row of `ship-change` says for a conflict outside the release lines, merges `origin/main` by hand: it resolves `src/a.ts`, takes the base\'s side of every release line, and commits.');
  sh(feat.wt, ['git', 'merge', '--no-ff', '--no-commit', 'origin/main'], { env: p.env, rec, expect: [1] });
  sh(feat.wt, ['git', 'diff', '--name-only', '--diff-filter=U'], { rec, label: 'git diff --name-only --diff-filter=U   # the files in conflict' });
  sh(feat.wt, ['git', 'checkout', 'origin/main', '--', ...RELEASE_PATHS], { rec });
  put(feat.wt, { 'src/a.ts': 'export const a = 3; // feat and sib\n' });
  sh(feat.wt, ['git', 'add', '-A'], { rec });
  sh(feat.wt, ['git', 'commit', '-q', '--no-edit'], { env: p.env, rec });
  sh(feat.wt, ['git', 'log', '--oneline', '--graph', '-4'], { rec });
  sh(feat.wt, ['git', 'show', '--stat', '--format=%h %s%n%P', 'HEAD'], { rec });
  sh(feat.wt, ['cat', 'src/a.ts', RELEASE_FILE], { rec });
  sh(feat.wt, ['ls', 'docs/adr'], { rec, label: 'ls docs/adr   # both records numbered 0002: feat\'s number came with the branch, sib\'s with the base' });

  rec.text('### The loop answers `assign-release`, and the step numbers the branch again\n\nThe merge by hand changed `src/a.ts`, a file of the change, so the session records the evidence and the reviews again (ADR 0025). The release lines are then the base\'s and the number the step wrote (ADR 0002 for `feat`) is in its own record, so the checker reads the release as unassigned and hands `assign-release` again (the pull request\'s head on origin is still the one before the merge by hand), not `blocked`:');
  const r3 = drive(p, feat, rec);
  human(p, feat, rec);
  expectStep(r3.next, 'assign-release', 'feat after the merge by hand');
  showNext(r3.next);
  const head1 = git(feat.wt, 'rev-parse', 'HEAD');
  const a3 = JSON.parse(assignRelease(p, feat, r3.next).out);
  assert(a3.adrs[0]?.from === 'docs/adr/feat.md' && a3.adrs[0]?.to === 'docs/adr/0003-feat.md', `feat renumbered above sib: ${JSON.stringify(a3.adrs)}`);
  assert(a3.versions.packs['devkit-openspec'] === '1.2.0' && a3.versions.packs['devkit-core'] === '1.0.1', `feat's versions above the base's: ${JSON.stringify(a3.versions)}`);
  assert(git(feat.wt, 'rev-parse', 'HEAD^') === head1, 'one commit on the merge by hand');
  rec.text('One plain commit on that head: it gives back the number it wrote before (0002), numbers the record above the sibling\'s (0003), writes devkit-openspec 1.2.0 above the base\'s 1.1.0 and devkit-core 1.0.1, and its message ends with its new record:');
  const body = recordOf(feat);
  assert(/\nRelease-change: feat\n/.test(body) && body.includes('docs/adr/0003-feat.md'), 'the record names the new number');
  sh(feat.wt, ['git', 'show', '--stat', '-M', '--format=%h %s', 'HEAD'], { rec });
  sh(feat.wt, ['git', 'diff', '--name-only', 'HEAD^', 'HEAD', '--', 'openspec/changes/'], { rec, label: 'git diff --name-only HEAD^ HEAD -- openspec/changes/   # empty' });
  sh(feat.wt, ['cat', RELEASE_FILE, 'plugins/core/.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'CHANGELOG.md', 'docs/catalog.md', 'src/a.ts'], { rec });
  sh(feat.wt, ['grep', '-n', 'ADR\\|v1\\.', 'docs/guide.md', 'docs/sib.md', 'docs/openspec-flow.md'], { rec });
  sh(feat.wt, ['ls', 'docs/adr'], { rec });
  assert(!existsSync(join(feat.wt, 'docs/adr/0002-feat.md')) && existsSync(join(feat.wt, 'docs/adr/0002-sib.md')), 'the number is given back');
  rec.text('The state reads assigned and current, and `enable-auto-merge` is next:');
  const st = showRelease(p, feat);
  assert(st.kind === 'assigned' && st.current === true, `the state: ${JSON.stringify(st)}`);
  human(p, feat, rec);
  const n4 = nextOf(p, feat);
  expectStep(n4, 'enable-auto-merge', 'feat after the step on the merge by hand');
  showNext(n4);
  rec.flush();
}

// ---------------------------------------------------------------- P-14 (11.10): the loop routes a noted change's conflict with the base (D-31)

// The one-line list of records of docs/context.yaml, in the shape of openspec/config.yaml's `ADRs:` line.
const adrsLine = (entries) => `  ADRs: docs/adr/ (0001 start${entries})\n`;
// What the loop handed, checked: its kind and step (or agent), with the action in the error when it is not.
function expectAction(a, kind, step, what) {
  const got = a.kind === 'agent' ? `${a.kind} ${a.step ?? a.detail?.step} ${a.agent}` : `${a.kind} ${a.step ?? a.detail?.step ?? a.end?.state}`;
  if (a.kind !== kind || (a.step ?? a.detail?.step ?? a.end?.state) !== step) throw new Error(`${what}: expected ${kind} ${step}, got ${got}: ${JSON.stringify(a.detail ?? a.end ?? {})}`);
}
// The session's part of a `session` action whose detail is a plain command (the push), run in the change's worktree.
const runCommand = (p, c, a) => sh(c.wt, a.detail.command, { env: p.env, rec });

// The loop's next action past its `merge-check` (post-merge-validate: a merge of the base on the branch is checked with `openspec
// validate` before the delivery goes on), which the session runs as it is handed: its command, then `next` again.
function pastMergeCheck(p, c) {
  let a = loopNext(p, c, rec);
  if ((a.step ?? a.detail?.step) === 'merge-check') {
    runCommand(p, c, a);
    a = loopNext(p, c, rec);
  }
  return a;
}
const thenAutoMerge = (p, c, what) => expectAction(pastMergeCheck(p, c), 'session', 'enable-auto-merge', what);

// A merge-mode project with `src/a.ts` (and the one-line list with `list`), where `feat` (a `devkit-lite` change whose plan carries the
// stage headers, so the loop walks it) notes devkit-openspec `minor` and devkit-core `patch`, names `docs/adr/feat.md` and writes `files`;
// it is driven to its release step and assigned once (devkit-openspec 1.1.0, ADR 0002). Then `sib` (with `sibFiles`, and its record
// `docs/adr/sib.md` unless `sibAdr` is false) takes the same pack's next version on the same base and lands, unless `sibFiles` is null.
function assignedThenSibling(name, { files = {}, sibFiles = {}, sibAdr = true, list = false } = {}) {
  const p = seedProject(name, { files: { ...marketFiles(), 'src/a.ts': 'export const a = 0;\n', ...(list ? { 'docs/context.yaml': adrsLine('') } : {}) } });
  const feat = openLoopChange(p, 'feat', { note: FEAT_NOTE, adrs: ['feat'], files: { 'src/a.ts': 'export const a = 1; // feat\n', ...files } });
  rec.text('`feat` is driven to its release step and takes its release (devkit-openspec 1.1.0, devkit-core 1.0.1, ADR 0002):');
  const r1 = drive(p, feat, rec);
  expectStep(r1.next, 'assign-release', 'feat before its release');
  const a1 = JSON.parse(assignRelease(p, feat, r1.next).out);
  assert(a1.adrs[0]?.to === 'docs/adr/0002-feat.md' && a1.versions.packs['devkit-openspec'] === '1.1.0', 'feat numbered 0002 and 1.1.0');
  expectStep(nextOf(p, feat), 'enable-auto-merge', 'feat after its release');
  if (sibFiles !== null) {
    rec.text(`The sibling \`sib\` notes devkit-openspec \`minor\`${sibAdr ? ', names `docs/adr/sib.md`' : ''} and writes ${Object.keys(sibFiles).map((f) => `\`${f}\``).join(', ') || 'no other file'}; it takes devkit-openspec 1.1.0${sibAdr ? ' and ADR 0002' : ''} on the same base and lands:`);
    const sib = openChange(p, 'sib', { note: patchNote('sib', 'devkit-openspec', 'minor'), adrs: sibAdr ? ['sib'] : [], files: sibFiles });
    const s1 = drive(p, sib, rec);
    expectStep(s1.next, 'assign-release', 'sib before its release');
    assignRelease(p, sib, s1.next);
    autoMerge(p, sib, nextOf(p, sib));
    sh(p.main, ['git', 'fetch', '-q', 'origin'], { env: p.env });
    sh(p.main, ['git', 'log', '--oneline', '--graph', '-4', 'origin/main'], { rec });
  }
  return { p, feat };
}
// A merge of origin/main by hand, as the `resolve-base-conflict` row says for a change with a release note (scripted here; S-13 runs
// the real implementer): the base's side of every release line, `resolved` written, committed with no push.
function mergeLikeTheRow(p, c, resolved) {
  const old = git(c.wt, 'rev-parse', 'HEAD');
  sh(c.wt, ['git', 'merge', '--no-ff', '--no-commit', 'origin/main'], { env: p.env, rec, expect: [1] });
  sh(c.wt, ['git', 'diff', '--name-only', '--diff-filter=U'], { rec, label: 'git diff --name-only --diff-filter=U   # the files in conflict' });
  sh(c.wt, ['git', 'checkout', 'origin/main', '--', ...RELEASE_PATHS], { rec });
  put(c.wt, resolved);
  sh(c.wt, ['git', 'add', '-A'], { rec });
  sh(c.wt, ['git', 'commit', '-q', '--no-edit'], { env: p.env, rec });
  sh(c.wt, ['git', 'show', '--stat', '--format=%h %s%n%P', 'HEAD'], { rec });
  assert(git(c.wt, 'rev-parse', 'HEAD^1') === old && git(c.wt, 'rev-parse', 'HEAD^2') === git(c.wt, 'rev-parse', 'origin/main'), 'the merge\'s parents are the old head and origin/main');
  assert(!/^(<<<<<<<|>>>>>>>)/m.test(sh(c.wt, ['git', 'grep', '-n', '-e', '<<<<<<<', '-e', '>>>>>>>'], { expect: [0, 1] }).out), 'no conflict marker');
  return old;
}
// After the merge: the records the merge staled written again, then the loop's `push`, the push, and the loop's `assign-release`, run.
function pushThenAssign(p, c, old, what) {
  rec.text('The merge changed files of the change, so the session records the evidence and the reviews again (ADR 0025), with no push:');
  const r = drive(p, c, rec, { until: ['assign-release', 'enable-auto-merge', 'push', 'blocked'] });
  rec.text(`The loop checks the merge of the base (\`merge-check\`, run as handed); GitHub still reports the pull request in conflict at the old head (${old.slice(0, 7)}), so the loop then hands the plain push to \`devkit-core:commit-and-pr\` (run here as its command):`);
  const push = pastMergeCheck(p, c);
  expectAction(push, 'agent', 'push', `${what}: after the merge`);
  assert(push.agent === 'devkit-core:commit-and-pr', `the push goes to commit-and-pr: ${push.agent}`);
  assert(JSON.stringify(push.detail.command) === JSON.stringify(['git', 'push', 'origin', c.branch]), 'a plain push');
  runCommand(p, c, push);
  rec.text('After the push the release state is not current (the merge base moved), so the loop hands `assign-release`; the session runs its row:');
  const assign = loopNext(p, c, rec);
  expectAction(assign, 'session', 'assign-release', `${what}: after the push`);
  const out = JSON.parse(assignRelease(p, c, assign.detail).out);
  recordOf(c);
  return { r, out };
}

function p14() {
  rec.text(`## P-14 the loop routes a noted change's conflict with the base: release files only, outside them, behind, and a one-line list

AC-4, AC-5, AC-15 (review round 3, D-31, D-36). Each variant is a merge-mode project with the key, where \`feat\` is a noted change
assigned once (devkit-openspec 1.1.0, devkit-core 1.0.1, ADR 0002) and the base then moves. From there each step is the one this
worktree's \`change-loop.mjs next\` hands, run in \`feat\`'s worktree: it fetches the base, reads the delivery checker and the
conductor's override, and prints the action; the session runs it as its \`ship-change\` row says (the implementer's merge is
scripted here, and S-13 of \`agents-run.md\` runs the real implementer on (b) and (d)).

### (a) The base releases, in conflict with the branch in the release files only`);
  {
    const { p, feat } = assignedThenSibling('p14a', { sibFiles: { 'docs/sib.md': '# The sibling\n\nThe fix is ADR [sib].\n' } });
    rec.text('The pull request of `feat` now conflicts with `main` in release files only; the step\'s masked merge resolves them, so the loop hands `assign-release` (with `conflict: true`) to the session:');
    const a = loopNext(p, feat, rec);
    expectAction(a, 'session', 'assign-release', 'P-14 (a)');
    assert(a.detail.conflict === true, 'conflict: true');
    const out = JSON.parse(assignRelease(p, feat, a.detail).out);
    assert(out.adrs[0]?.to === 'docs/adr/0003-feat.md' && out.versions.packs['devkit-openspec'] === '1.2.0', `feat numbered above sib: ${JSON.stringify(out.adrs)}`);
    rec.text('The step exited 0 and the session pushed; the loop then hands `enable-auto-merge`:');
    thenAutoMerge(p, feat, 'P-14 (a) after the step');
  }

  rec.text('### (b) The base releases and edits `src/a.ts`, which the branch edits too');
  {
    const { p, feat } = assignedThenSibling('p14b', { sibFiles: { 'docs/sib.md': '# The sibling\n\nThe fix is ADR [sib].\n', 'src/a.ts': 'export const a = 2; // sib\n' } });
    rec.text('The conflict lies outside the release lines (`src/a.ts`), which the step\'s masked merge does not resolve, so the loop hands `resolve-base-conflict` to the implementer, with `noted: true`:');
    const a = loopNext(p, feat, rec);
    expectAction(a, 'agent', 'resolve-base-conflict', 'P-14 (b)');
    assert(a.agent === 'devkit-core:tdd-implementer' && a.detail.noted === true && a.detail.others.includes('src/a.ts'), `the hand-off: ${JSON.stringify(a.detail)}`);
    rec.text('The merge the row says (scripted): `src/a.ts` resolved, the base\'s side of every release line taken, committed, not pushed:');
    const old = mergeLikeTheRow(p, feat, { 'src/a.ts': 'export const a = 3; // feat and sib\n' });
    const { out } = pushThenAssign(p, feat, old, 'P-14 (b)');
    assert(out.adrs[0]?.from === 'docs/adr/feat.md' && out.adrs[0]?.to === 'docs/adr/0003-feat.md' && out.versions.packs['devkit-openspec'] === '1.2.0', `feat numbered above the base: ${JSON.stringify(out)}`);
    sh(feat.wt, ['ls', 'docs/adr'], { rec });
    sh(feat.wt, ['cat', RELEASE_FILE, 'src/a.ts'], { rec });
    rec.text('The step exited 0, numbering the branch above the base from its record, and the session pushed; the loop then hands `enable-auto-merge`:');
    thenAutoMerge(p, feat, 'P-14 (b) after the step');
  }

  rec.text('### (c) The loop hands `assign-release` for a branch behind; the base then gains a conflict in `src/a.ts` before the step runs');
  {
    const { p, feat } = assignedThenSibling('p14c', { sibFiles: null });
    rec.text('The base moves by a commit that touches no file of `feat`, so the branch is only behind:');
    put(p.main, { 'docs/notes.md': '# Notes\n\nA note of the base.\n' });
    commitAll(p.main, 'docs: a note of the base');
    sh(p.main, ['git', 'push', 'origin', 'main'], { env: p.env, rec });
    const a = loopNext(p, feat, rec);
    expectAction(a, 'session', 'assign-release', 'P-14 (c) behind');
    assert(!('conflict' in a.detail), 'no conflict: the branch is behind');
    rec.text('Before the session runs the row, another clone pushes a commit to `main` on the remote that edits `src/a.ts`:');
    const other = join(p.dir, 'other');
    sh(p.dir, ['git', 'clone', '-q', p.origin, other], { env: p.env, rec });
    put(other, { 'src/a.ts': 'export const a = 4; // the base\n' });
    sh(other, ['git', 'commit', '-q', '-am', 'fix: the base edits src/a.ts'], { env: p.env, rec });
    sh(other, ['git', 'push', '-q', 'origin', 'main'], { env: p.env, rec });
    rec.text('The session\'s row: the fetch, then the step, which meets the conflict outside its lines and exits 2 listing it, with no `error`:');
    const head0 = git(feat.wt, 'rev-parse', 'HEAD');
    const refused = JSON.parse(assignRelease(p, feat, a.detail, { expect: [2] }).out);
    assert((refused.conflicts ?? []).includes('src/a.ts') && !refused.error, `exit 2 listing src/a.ts with no error: ${JSON.stringify(refused)}`);
    assert(git(feat.wt, 'rev-parse', 'HEAD') === head0 && git(feat.wt, 'status', '--porcelain') === '', 'the branch is as it was');
    rec.text('So the session runs `next` again, which fetches the base and hands `resolve-base-conflict`:');
    const again = loopNext(p, feat, rec);
    expectAction(again, 'agent', 'resolve-base-conflict', 'P-14 (c) after the exit 2');
    assert(again.detail.noted === true && again.detail.others.includes('src/a.ts'), `the hand-off: ${JSON.stringify(again.detail)}`);
  }

  rec.text('### (d) The base lands a record and extends the one-line list holding the change\'s own citation');
  {
    const { p, feat } = assignedThenSibling('p14d', {
      list: true, files: { 'docs/context.yaml': adrsLine('; ADR [feat] the rule') }, sibFiles: { 'docs/context.yaml': adrsLine('; ADR [sib] other') },
    });
    sh(feat.wt, ['cat', 'docs/context.yaml'], { rec, label: 'cat docs/context.yaml   # the branch: the citation the step wrote' });
    sh(feat.wt, ['git', 'show', 'origin/main:docs/context.yaml'], { rec, label: 'git show origin/main:docs/context.yaml   # the base: its own entry' });
    rec.text('Both sides extended the one line, which no mask resolves, so the loop hands `resolve-base-conflict` naming that file:');
    const a = loopNext(p, feat, rec);
    expectAction(a, 'agent', 'resolve-base-conflict', 'P-14 (d)');
    assert(a.detail.noted === true && JSON.stringify(a.detail.others) === JSON.stringify(['docs/context.yaml']), `others: ${JSON.stringify(a.detail)}`);
    rec.text('The merge the row says (scripted): both entries kept on the line, the branch\'s as the branch holds it, the base\'s side of every release line taken:');
    const old = mergeLikeTheRow(p, feat, { 'docs/context.yaml': adrsLine('; ADR 0002 the rule; ADR 0002 other') });
    const { out } = pushThenAssign(p, feat, old, 'P-14 (d)');
    assert(out.adrs[0]?.to === 'docs/adr/0003-feat.md', `feat numbered above the base: ${JSON.stringify(out.adrs)}`);
    const line = read(feat.wt, 'docs/context.yaml');
    assert(line === adrsLine('; ADR 0003 the rule; ADR 0002 other'), `the line holds both entries: ${line}`);
    sh(feat.wt, ['cat', 'docs/context.yaml'], { rec });
    sh(feat.wt, ['ls', 'docs/adr'], { rec });
    rec.text('The step exited 0: the line holds both entries, the change\'s with its new number; the loop then hands `enable-auto-merge`:');
    thenAutoMerge(p, feat, 'P-14 (d) after the step');
  }
  rec.flush();
}

// ---------------------------------------------------------------- P-15 (11.10): the token-level give-back of D-34, through the step

function p15Variant(name, baseEntry, merged) {
  const p = seedProject(name, { files: { ...marketFiles(), 'docs/context.yaml': adrsLine('') } });
  const feat = openChange(p, 'feat', { note: patchNote('feat', 'devkit-openspec', 'minor'), adrs: ['feat'], files: { 'docs/context.yaml': adrsLine('; ADR [feat] the rule') } });
  const r1 = drive(p, feat, rec);
  expectStep(r1.next, 'assign-release', 'feat before its release');
  const a1 = JSON.parse(assignRelease(p, feat, r1.next).out);
  assert(a1.adrs[0]?.to === 'docs/adr/0002-feat.md', 'feat numbered 0002');
  rec.text(`\`feat\` took devkit-openspec 1.1.0 and ADR 0002. The base then lands another change by the old rule: devkit-openspec 1.1.0, \`docs/adr/0002-other.md\`, and its entry \`${baseEntry.slice(2)}\` on the list:`);
  put(p.main, {
    [RELEASE_FILE]: manifest('devkit-openspec', '1.1.0'),
    '.claude-plugin/marketplace.json': marketplace('1.1.0', { 'devkit-openspec': '1.1.0', 'devkit-core': '1.0.0' }),
    'CHANGELOG.md': CHANGELOG0.replace('## 1.0.0', '## 1.1.0 — other lands\n\n- **devkit-openspec** 1.1.0: other does its part\n\n## 1.0.0'),
    'docs/catalog.md': catalog({ 'devkit-core': '1.0.0', 'devkit-openspec': '1.1.0' }),
    'docs/openspec-flow.md': flowPage('1.1.0'),
    'docs/adr/0002-other.md': '# ADR 0002: other\n\n- Status: accepted\n',
    'docs/context.yaml': adrsLine(baseEntry),
  });
  commitAll(p.main, 'chore(release): other 1.1.0');
  sh(p.main, ['git', 'push', 'origin', 'main'], { env: p.env, rec });
  sh(feat.wt, ['cat', 'docs/context.yaml'], { rec, label: 'cat docs/context.yaml   # the branch' });
  sh(feat.wt, ['git', 'fetch', 'origin', 'main'], { env: p.env, rec });
  sh(feat.wt, ['git', 'show', 'origin/main:docs/context.yaml'], { rec, label: 'git show origin/main:docs/context.yaml   # the base' });
  const step = { base: 'main', branch: 'feat', command: node('release-merge.mjs', '--assign', '--base', 'main', '--json') };
  rec.text('The step meets the line both sides extended and exits 2 listing it, with no `error`:');
  const refused = JSON.parse(assignRelease(p, feat, step, { expect: [2] }).out);
  assert((refused.conflicts ?? []).includes('docs/context.yaml') && !refused.error, `exit 2 listing docs/context.yaml: ${JSON.stringify(refused)}`);
  rec.text(`The merge by hand: the base's side of every release line, and the line written \`${merged.trim()}\`:`);
  mergeLikeTheRow(p, feat, { 'docs/context.yaml': adrsLine(merged) });
  return { p, feat, step };
}

function p15() {
  rec.text(`## P-15 the give-back at the token level after a merge by hand of a one-line list

AC-4, AC-5, AC-15 (review round 3, D-34, D-36). Each variant: \`feat\` (merge mode, a noted change) cites its record on the one-line
list \`  ADRs: docs/adr/ (0001 start; ADR [feat] the rule)\` of \`docs/context.yaml\` and is assigned once (ADR 0002); the base lands its
own record 0002 and extends the same line; the step refuses the merge, a person merges by hand, and \`release-merge.mjs --assign\` runs
again on that merge. No number is given back by hand.

### (a) The base's entry in the list's own form`);
  {
    const { p, feat, step } = p15Variant('p15a', '; 0002 other', '; ADR 0002 the rule; 0002 other');
    const old = git(feat.wt, 'rev-parse', 'HEAD');
    const out = JSON.parse(assignRelease(p, feat, step).out);
    assert(out.adrs[0]?.to === 'docs/adr/0003-feat.md' && git(feat.wt, 'rev-parse', 'HEAD^') === old, `numbered above the base at once: ${JSON.stringify(out.adrs)}`);
    assert(read(feat.wt, 'docs/context.yaml') === adrsLine('; ADR 0003 the rule; 0002 other'), 'the line keeps the base\'s entry');
    recordOf(feat);
    sh(feat.wt, ['cat', 'docs/context.yaml'], { rec });
    sh(feat.wt, ['ls', 'docs/adr'], { rec });
    rec.text('The state reads assigned and current:');
    const st = showRelease(p, feat);
    assert(st.kind === 'assigned' && st.current === true, `the state: ${JSON.stringify(st)}`);
  }
  rec.text('### (b) The base\'s entry in the step\'s form, with the step\'s old number');
  {
    const { p, feat, step } = p15Variant('p15b', '; ADR 0002 other', '; ADR 0002 the rule; ADR 0002 other');
    const out = JSON.parse(assignRelease(p, feat, step).out);
    assert(out.adrs[0]?.to === 'docs/adr/0003-feat.md', `numbered above the base: ${JSON.stringify(out.adrs)}`);
    assert(read(feat.wt, 'docs/context.yaml') === adrsLine('; ADR 0003 the rule; ADR 0002 other'), 'the base\'s entry keeps its number');
    sh(feat.wt, ['cat', 'docs/context.yaml'], { rec });
  }
  rec.text('### (c) The merge by hand dropped the change\'s entry, where the base cites its own record with that number');
  {
    const { p, feat, step } = p15Variant('p15c', '; ADR 0002 other', '; ADR 0002 other');
    const head0 = git(feat.wt, 'rev-parse', 'HEAD');
    const out = JSON.parse(assignRelease(p, feat, step, { expect: [2] }).out);
    assert(out.error === 'cannot give back the numbers the step wrote in docs/context.yaml', `exit 2 naming the file: ${JSON.stringify(out)}`);
    assert(git(feat.wt, 'rev-parse', 'HEAD') === head0 && git(feat.wt, 'status', '--porcelain') === '', 'the head and the tree as they were');
    sh(feat.wt, ['git', 'status', '--short', '--branch'], { rec, label: 'git status --short --branch   # the head and the tree as they were' });
    sh(feat.wt, ['ls', 'docs/adr'], { rec });
  }
  rec.flush();
}

// ---------------------------------------------------------------- P-16 (11.10): a noted plan revised after the start (D-32)

// A `devkit` change whose plan files carry every stage header up to the readiness review (passed), with its note, and the owner's
// approval recording the readiness's hash, the plan's digest and the note's hash (as the `stop-plan-approval` row writes it); then
// its work started: task 1.1 ticked and its code committed.
function startedPlan(p, id) {
  git(p.main, 'fetch', '-q', 'origin');
  const c0 = git(p.main, 'rev-parse', 'origin/main');
  const d = `openspec/changes/${id}`;
  const c = openChange(p, id, { note: patchNote(id, 'devkit-openspec', 'minor'), approve: false, files: {
    [`${d}/requirements.md`]: `${stageHead('requirements', c0)}# Requirements: ${id}\n\n- AC-1: ${id} does its thing\n`,
    [`${d}/decisions.md`]: `${stageHead('decisions', c0, 'not-applicable')}# Decisions and ADRs\n\nNo record.\n`,
    [`${d}/proposal.md`]: `${stageHead('proposal', c0)}${proposalText(id)}`,
    [`${d}/specs/s/spec.md`]: `${stageHead('specs', c0)}${specText(id)}`,
    [`${d}/design.md`]: `${stageHead('design', c0)}# Design of ${id}\n\nOne file, src/${id}.ts.\n`,
    [`${d}/tasks.md`]: `${stageHead('tasks', c0)}${TASKS(id)}`,
  } });
  const h = git(c.wt, 'rev-parse', 'HEAD');
  put(c.wt, { [`${d}/readiness.md`]: `${stageHead('readiness', h)}# Readiness review: ${id}\n\n## 1. Decision\n- Status: APPROVED\n` });
  const dir = join(c.wt, d);
  put(c.wt, { [`${d}/approval.md`]: [`${stageHead('approval', h).trim()}`, `# Plan approval: ${id}`, '', '- Status: APPROVED', `- Readiness: ${hash12(join(dir, 'readiness.md'))}`,
    `- Plan: ${DC.planDigest(dir)}`, `- Release note: ${hash12(join(dir, 'release.md'))}`, '- Date: 2026-11-26', '- Owner\'s words: "`Aprovo`"', ''].join('\n') });
  commitAll(c.wt, `docs(${id}): the owner approves the plan`);
  put(c.wt, { [`src/${id}-1.ts`]: `export const ${id} = 1;\n`, [`${d}/tasks.md`]: read(c.wt, `${d}/tasks.md`).replace('- [ ] 1.1 ', '- [x] 1.1 ') });
  commitAll(c.wt, `feat(${id}): task 1.1`);
  sh(c.wt, ['cat', `${d}/approval.md`], { rec });
  sh(c.wt, ['git', 'log', '--oneline', '-3'], { rec });
  return c;
}
// The flow checker's readiness stage and `next`, recorded.
function readinessOf(p, c) {
  const r = sh(c.wt, node('flow-check.mjs', c.id, '--json'), { env: p.env, expect: null });
  const j = JSON.parse(r.out);
  const s = (j.stages ?? []).find((x) => x.id === 'readiness') ?? {};
  rec.block(`(in ${c.wt})\n$ node $DEV/flow-check.mjs ${c.id} --json   (its readiness stage and "next")\n${JSON.stringify({ readiness: { state: s.state, reasonCode: s.reasonCode }, next: j.next ? { stage: j.next.stage, reasonCode: j.next.reasonCode } : null }, null, 2)}\n[exit ${r.code}]`);
  return s;
}

function p16() {
  rec.text(`## P-16 a started noted plan revised with its note goes back to the readiness review; the note alone asks the approval

AC-12, AC-16, AC-15 (review round 3, D-32, D-36). Project \`p16\` (the seed, merge mode). Changes \`plan\` and \`twin\` are \`devkit\` changes
with every plan stage passed, each approved by the owner with the readiness's hash, the plan's digest and the note's hash, and each
started (task 1.1 ticked, its code committed).

### \`plan\`: \`design.md\` and \`release.md\` revised`);
  const p = seedProject('p16');
  const c = startedPlan(p, 'plan');
  const d = 'openspec/changes/plan';
  put(c.wt, {
    [`${d}/design.md`]: read(c.wt, `${d}/design.md`).replace('One file', 'Two files'),
    [`${d}/release.md`]: patchNote('plan', 'devkit-openspec', 'major'),
  });
  sh(c.wt, ['git', 'commit', '-q', '-am', 'docs(plan): revise the design and the note'], { rec });
  sh(c.wt, ['git', 'show', '--stat', '--format=%h %s', 'HEAD'], { rec });
  const s1 = readinessOf(p, c);
  assert(s1.state === 'stale' && s1.reasonCode === 'plan-revised', `readiness stale with plan-revised: ${JSON.stringify(s1)}`);
  rec.text('The loop hands the readiness review (`plan-revised`):');
  const a1 = loopNext(p, c, rec);
  assert(a1.kind === 'agent' && a1.agent === 'devkit-core:plan-readiness-reviewer', `the readiness review: ${a1.kind} ${a1.agent}`);
  rec.text('The readiness review runs again and passes (written as the reviewer writes it):');
  put(c.wt, { [`${d}/readiness.md`]: `${stageHead('readiness', git(c.wt, 'rev-parse', 'HEAD'), 'passed', 2)}# Readiness review: plan\n\n## 1. Decision\n- Status: APPROVED\n` });
  sh(c.wt, ['git', 'commit', '-q', '-am', 'docs(plan): the readiness review, again'], { rec });
  rec.text('The loop now waits for the owner\'s approval of both, with `readiness`, `plan` and `release`:');
  const a2 = loopNext(p, c, rec);
  assert(a2.kind === 'end' && a2.end?.state === 'waiting-for-owner' && a2.detail?.readiness && a2.detail?.plan && a2.detail?.release, `the approval asked again: ${JSON.stringify({ end: a2.end, detail: a2.detail })}`);
  assert(a2.detail.release === hash12(join(c.wt, d, 'release.md')) && a2.detail.plan === DC.planDigest(join(c.wt, d)), 'the new hashes');

  rec.text('### `twin`: only `release.md` revised');
  const t = startedPlan(p, 'twin');
  put(t.wt, { 'openspec/changes/twin/release.md': patchNote('twin', 'devkit-openspec', 'major') });
  sh(t.wt, ['git', 'commit', '-q', '-am', 'docs(twin): revise the note'], { rec });
  const s2 = readinessOf(p, t);
  assert(s2.state === 'passed', `the twin's readiness stays passed: ${JSON.stringify(s2)}`);
  rec.text('The loop waits for the owner\'s approval directly (row A1), with no readiness review:');
  const a3 = loopNext(p, t, rec);
  assert(a3.kind === 'end' && a3.end?.state === 'waiting-for-owner' && a3.detail?.release === hash12(join(t.wt, 'openspec/changes/twin/release.md')), `the approval asked directly: ${JSON.stringify({ kind: a3.kind, agent: a3.agent, end: a3.end, detail: a3.detail })}`);
  rec.flush();
}

// ---------------------------------------------------------------- the run

const CASE_LIST = [['seed', seed], ['P-1', p1], ['P-2', p2], ['P-3', p3], ['P-4', p4], ['P-5', p5], ['P-6', p6], ['P-7', p7], ['P-8', p8], ['P-9', p9], ['P-10', p10], ['P-11', p11], ['P-12', p12], ['P-13', p13], ['P-14', p14], ['P-15', p15], ['P-16', p16]];
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
