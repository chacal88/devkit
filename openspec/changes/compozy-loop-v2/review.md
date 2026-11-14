# Review — compozy-loop-v2

- Change: `compozy-loop-v2`
- Branch: `compozy-loop-v2`
- Commit: `e10b21d46af3cc79a5977063f55fa74776073875`
- Reviewer: qa (independent; did not write this code)
- Verdict: **rejected** — three blocking issues

## What I read and ran

I read the diff (`git diff main...HEAD`, 46 files, ~4 800 added lines), the plan
(`proposal.md`, `design.md`, `tasks.md`, `requirements.md`, `readiness.md` — Status: APPROVED),
`openspec/config.yaml`, `CLAUDE.md`, `CONTRIBUTING.md` and the ADRs the change cites. I ran every
gate in `tasks.md` myself in this worktree at this commit.

Green:

- `python3 scripts/gen-catalog.py --check` — exit 0
- `python3 scripts/check.py` — "all checks passed"
- bundled `claude plugin validate .` (2.1.321) — "✔ Validation passed"
- the six new suites, 98 tests, all passing: `devkit-kit` 12, `loop-template` 19, `role-shells` 16,
  `adoption` 10, `screens-check` 25, `evidence-names` 16

Red:

- `node --test plugins/openspec/hooks/guard.test.mjs` — **668 tests, 666 pass, 2 fail**. Run by me
  (terminal `term-ee16162ba6a7`, 498 s) and reproduced independently by the author's own earlier run
  (`term-52413a4b58cf`, exit 1). Both failures also reproduce when run in isolation, so neither is
  an artefact of the two runs overlapping.

Independently verified beyond the tests: the shipped loop declares the twelve stages with exactly
the eighteen edges of design D2 in the planned order, every gate criterion is `command`, there is no
`agent-judge` criterion and no `goal` node, both `review` blocks carry `responders: { agents: deny }`;
`.compozy/loops/openspec-change/loop.yaml` differs from its template only in the seven placeholder
defaults; `screens-check` no-ops correctly on this screenless repository; no test was deleted or
weakened; `plugins/core/` and `plugins/openspec/` carry no change, so no pack but the new one is
bumped; and the shipped kit contains no destructive Git, push or merge.

## Blocking

### 1. `project_settings_packs_missing_compozy`

`plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs:16` lists six packs in `PACKS`;
`.claude-plugin/marketplace.json` now lists seven, including `devkit-compozy` (task 7.3).
`project-settings.test.mjs:175` asserts the two agree, and fails.

This is not only a red test. `project-settings.mjs:34-35` rejects any pack outside `PACKS`, so
`openspec-setup --packs devkit-compozy` refuses to install the pack this change exists to ship.

Note for the fix, which is the owner's call and not a silent edit: the repair lives in
`plugins/openspec/`, so it bumps `devkit-openspec` and contradicts the proposal's statement that
this release touches no `devkit-openspec` version and therefore creates no tag (`proposal.md`,
Impact; task 4.4 repeats it).

### 2. `compozy_kit_docs_sweep`

`docs/compozy-kit.md:24` and `docs/compozy-kit.md:36` each claim the loop "never merges" without
naming a ship mode on the same line. `plugins/openspec/hooks/deliver-check.test.mjs:3318` sweeps the
docs for exactly that and fails. Line 24 does say `ship: merge`, but the sweep wants a backticked
`plan`/`pr`/`merge` followed by "mode", or the literal "ship mode"; `` `ship: merge` `` matches
neither. Wording only — both lines describe the loop correctly.

### 3. `task_7_6_unticked`

Task 7.6, the final gate, is the one unchecked box in `tasks.md`, and it is unchecked because the
gate does not pass: its first three parts are green, its fourth is the suite that fails above. While
any box is unticked, `deliver-check` item 1 reads `open` (`deliver-check.mjs:307,321-327`), so the
loop's own verify gate cannot reach 8/8. Fix 1 and 2, re-run the gate, then tick it. I do not edit
`tasks.md`.

## Important

### `implement_prompt_unguarded_design_output`

`templates/loops/openspec-change/loop.yaml:265` — `implement`'s prompt conditions on a nested field
of a node that is skipped on the screenless path: `{{ if .nodes.design.output.worktree_path }}`.
Every other reader of that node guards the parent first (`{{ if .nodes.design.output }}`, the same
node's `review` block and `deliver`'s prompt). `design.md:256-258` states the rule — "a skipped node
settles with a skip marker rather than a filled schema" — and adds "the template test pins the
guards", which is not true: `loop-template.test.mjs` has no assertion about these guards.

A refuting pass could not clear it. The `compozy` binary (0.6.2) contains Go `text/template`'s
`nil pointer evaluating %s.%s`, so dotting a field on a nil `.output` errors at render time rather
than yielding empty. `compozy loop validate` returns `valid: true` for both files but only checks
shape, not render behaviour for a skipped node, and the run driving this change still executes the
six-node v1 definition, so it does not exercise this path. I could not force an end-to-end render,
so I report this as unproven rather than blocking — but it sits on the path every screenless change
takes, which is this repository's own, and the fix is one guard. Fix it in the same commit that
closes the blocking issues, and either pin the guards in `loop-template.test.mjs` or correct the
sentence in `design.md`.

### `adr_0001_compozy_posture_unrecorded`

`docs/adr/0006-phases-as-child-sessions.md:62` lists "A daemon that starts sessions (Compozy-style)"
as a rejected alternative, for being "a harness outside the app; state outside the repository
(ADR 0001)". This change ships that daemon's loop as a pack for any project, and `design.md` D12
concludes no new ADR is needed without engaging that line.

I do not treat this as blocking: the posture is not introduced here. `.compozy/` with its roles and
loop was merged to `main` in PR #29 (184dc17), and `main`'s own `CLAUDE.md` already states that
`.compozy/` sequences this flow. This change extends and packages a decision the owner already took
and merged. But `openspec/config.yaml` tells `design.md` to record a decision that changes an ADR as
a proposal for a new ADR rather than a silent deviation, and packaging the harness for every project
raises the stakes. The owner should decide whether an ADR now records the CompozyOS posture and what
it means for ADR 0001 and ADR 0006.

## Not findings

- `.claude/settings.json` does not enable `devkit-compozy@devkit`. The repository enables only the
  packs it uses (`devkit-design`, `devkit-stack` and `devkit-ai-engineering` are absent too), and it
  already has `.compozy/` installed, so there is nothing to install here.
- `python3 scripts/check.py` failed once during this review on a broken link in `evidence.md`. That
  file is mine, written by `pr-verifier` during the review; I fixed the link and the check passes.
  It is not a defect of the commit under review.
- The AC-5 no-polling scan reads gate `check:` commands rather than prompt text, because the two
  waiting prompts must quote the forms they forbid. That narrowing is recorded in `design.md` and is
  the right reading of the criterion.

## Bench

| Reviewer | Verdict | Disposition |
| --- | --- | --- |
| `spec-reviewer` | approved | AC-1 to AC-10 all honoured, no scope creep; validated both loop files against the live daemon |
| `security-reviewer` | approved | No injection, traversal or fail-open defect; every gate interpolation goes through `shellQuote` outside authored quotes |
| `code-quality-reviewer` | rejected | One important finding, no blocking: the unguarded `.output` above. Verified and upheld; reported as important, since it is unproven at runtime |
| `adr-reviewer` | rejected | Blocking claim refuted as a finding of this change (PR #29 already merged the posture); kept as the important note above. Its other three points: one is the same ADR argument, one is `settings.json` (not a finding), one is the `evidence.md` link I fixed |

Evidence for this commit is in `evidence.md`: all ten acceptance criteria have reproduced proof;
the Gates table records the guard suite's failure and the Defects section names the two regressions.


---

# Review — compozy-loop-v2, round 2

- Change: `compozy-loop-v2`
- Branch: `compozy-loop-v2`
- Commit: `307e1f54ea97c27a45796299bbaeb918bf5c3102`
- Reviewer: qa (independent; did not write this code)
- Verdict: **rejected** — one blocking issue, two important ones

## What I read and ran

I read the diff at this head (`git diff main...HEAD`, 58 files) and the round-2 range
(`git diff e10b21d..HEAD`, 23 files) line by line, the plan (`proposal.md`, `design.md`,
`tasks.md`, `requirements.md`, `readiness.md`), `openspec/config.yaml`, `CLAUDE.md`,
`CONTRIBUTING.md`, ADR 0009 in full and the two ADRs it amends.

Structural: `openspec validate compozy-loop-v2 --strict` reports the change valid (with the
expected `skip_specs` info line).

Gates, run by me in this worktree at this commit as one `&&` chain in a background terminal
(`term-f3203c82dfac`), exit 0 — gate 8.5 as `tasks.md` writes it:

- `python3 scripts/gen-catalog.py --check` — exit 0
- `python3 scripts/check.py` — "all checks passed"
- bundled `claude plugin validate .` (2.1.321) — "Validation passed"
- `node --test .../loop-template.test.mjs` — 20/20
- `node --test .../adoption.test.mjs` — 11/11
- `node --test plugins/openspec/hooks/guard.test.mjs` — **668 tests, 668 pass, 0 fail, 655 s**

The guard suite was red at the previous head (2 of 668). Both failures are gone, and I confirmed
each fix in the diff rather than taking the green run on trust.

## Round 1's blocking issues, re-checked

- `project_settings_packs_missing_compozy` — **fixed** (task 8.1). `PACKS` in
  `project-settings.mjs` now holds seven entries matching `marketplace.json`; `devkit-openspec`
  moved 0.13.0 to 0.14.0 in its `plugin.json` and in `marketplace.json`; the CI pin in
  `docs/openspec-flow.md` moved to `v0.14.0`.
- `compozy_kit_docs_sweep` — **fixed** (task 8.4). Both `docs/compozy-kit.md` lines now carry the
  literal "ship mode" on the line that makes the claim; the meaning is unchanged.
- `task_7_6_unticked` — **resolved**. Every box in `tasks.md` is ticked. Gate 7.6 no longer carries
  the guard suite; it moved to the new last gate, 8.5, which runs it unweakened. I checked that no
  part of the suite was dropped: 668 tests ran, the same count as the red run.

Round 1's two important findings are also closed: the `implement` prompt now guards on the parent
`.nodes.design.output` in both the template and the installed copy, pinned by a structural scan
that fails on the shape that shipped (`screens_ok`'s unguarded read is exempted by line, and I
confirmed it is reachable only by the single edge `design -> screens_ok`); and ADR 0009 records the
CompozyOS posture in the exception form, which is the form the owner approved — the plan-approval
review of generation 2 put OD-5 to them explicitly and they answered `approve` on 2026-11-14.

## Blocking

### 1. `proposal_release_claim_contradicts_itself`

`openspec/changes/compozy-loop-v2/proposal.md:64-65`, the `## What Changes` bullet "Docs and
release", still ends: "`devkit-openspec` is not touched, so this release creates no tag
(`CONTRIBUTING.md`)."

That is false at this commit and contradicted three times inside the same file: the bullet seven
lines above it says the `PACKS` entry "is what makes this release a tagged one"; AC-10 says the
`openspec-setup` change "bumps `devkit-openspec` and makes the release a tagged one"; and Impact
says it "bumps `devkit-openspec` to `0.14.0`, and `CONTRIBUTING.md` makes this a tagged release
(`v0.14.0`, pushed after the merge)". The diff agrees with those three and not with the bullet.

Task 8.1 corrected this claim in `CHANGELOG.md` and named no other place, so the proposal's own
copy of it survived. `skip_specs: true` makes this file the change's contract, and the sentence
sits in the prose that frames it. The practical cost is not cosmetic: the tag is a post-merge step
the owner performs by hand, and `openspec-setup` resolves that tag to a commit when it pins a
project's CI, so a reader who believes the bullet skips `v0.14.0` and leaves every project that
installs this release pinned to a tag that does not exist.

Verified by three independent verifiers; none could refute it. It is not a deferred task: no dated
decision in `tasks.md` covers it.

## Important

### `deliver_evidence_link_untested`

`plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:443-446` — the
`deliver` prompt's guarded sentence that links `openspec/changes/<id>/evidence/` from the pull
request body is the last clause of AC-6, and no test asserts it or its `{{ if .nodes.demo.output }}`
guard. A verifier deleted the block from both the template and the installed copy and all 47 tests
of the three relevant suites still passed (the files were restored; I confirmed the tree clean at
`307e1f5`). Upheld 3 of 3.

### `screens_check_parseargs_untested`

`plugins/compozy/skills/screen-design/scripts/screens-check.mjs:202-220` — `parseArgs`'s negative
branches (an unknown option, a missing `--change` value, and the `.`, `..` and `archive` exclusion)
have no test. The 25 tests of `screens-check.test.mjs` all pass a well-formed id, so loosening the
regex or dropping the exclusion list would stay green — and that exclusion is what keeps a change
id from escaping its folder. Upheld 3 of 3.

Neither is a failing or weakened test, so neither blocks on its own; both are gaps in what the new
suites pin, on behaviour the acceptance criteria name.

## Not findings

- The guard suite moving from gate 7.6 to gate 8.5. It is documented in `tasks.md`'s preamble with
  its reason, no assertion was dropped, and the suite runs green at the new last gate.
- `.claude/settings.json` not enabling `devkit-compozy@devkit`. AC-9 now excludes it explicitly and
  `tasks.md` records it under `## Workflow follow-up`, dated, with the `devkit-panel` precedent.
- The `git push origin v0.14.0` line in `tasks.md`. It is an instruction for the owner after the
  merge, not a push this change performs. No remote branch exists for `compozy-loop-v2`, there are
  no merge commits, and the diff introduces no destructive Git.

## Evidence

`evidence.md` is rewritten for this commit: all ten acceptance criteria pass with proof gathered
here, the Gates table records gate 8.5 green including the 668-test guard suite, and the Defects
section is empty. The two defects it recorded at `e10b21d` are confirmed fixed.


# Review: compozy-loop-v2, round 2

Path: agents · range `main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 307e1f5 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 307e1f5 |
| code-quality-reviewer | rejected | 1 | 0 | 1 | 0 | 307e1f5 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 307e1f5 |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 307e1f5 |

Consensus: FAIL (round 2/2)

## Open findings
- code-quality-reviewer — [blocking] openspec/changes/compozy-loop-v2/proposal.md:64-65 — The 'Docs and release' bullet still says devkit-openspec is untouched and this release creates no tag, contradicting the same file's Impact section, AC-10 and the diff (plugin.json 0.13.0 to 0.14.0, the CHANGELOG 0.14.0 entry, the docs/openspec-flow.md v0.14.0 pin).
- test-coverage-reviewer — [important] plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml (deliver node prompt, the guarded evidence link) — AC-6 requires deliver to link the evidence folder from the PR body when the demo ran; no test anywhere asserts that text or its guard, so deleting it leaves every suite green.
- test-coverage-reviewer — [important] plugins/compozy/skills/screen-design/scripts/screens-check.mjs:parseArgs (tested in screens-check.test.mjs) — parseArgs's negative validation (unknown option, missing --change value, the '.', '..' and 'archive' exclusion) has zero test coverage; removing the exclusion or loosening the regex leaves every test green.

## Refuted by verification
None.

## Notes
- Path: agents (this turn began as a loop task notification, not the owner's typed message, so the Workflow path does not apply).

## Next
Consensus deadlock after round 2: the owner decides.


# Review: compozy-loop-v2, round 1

Path: agents · range `main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 1d0c2e0 |
| spec-reviewer | approved | 0 | 0 | 1 | 1 | 1d0c2e0 |
| code-quality-reviewer | approved | 0 | 0 | 1 | 1 | 1d0c2e0 |
| security-reviewer | declined | 0 | 0 | 0 | 0 | 1d0c2e0 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 1d0c2e0 |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
- spec-reviewer — [blocking] plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml (uncommitted, deliver node prompt, ~line 443-446) — Gap: AC-6 demo-contract — the deliver node's guarded sentence linking openspec/changes/<id>/evidence/ (pinned by task 9.2's own new test) is missing from the working-tree copy of the template, and AC-9's byte-for-byte equality test fails; both committed-HEAD copies are correct, only the live working tree regresses. · refuted: git status --porcelain is empty; the evidence-link sentence is present verbatim at loop.yaml:443-444; adoption.test.mjs 12/12 pass including the byte-for-byte AC-9 render-then-compare / git status clean at HEAD 1d0c2e0, git diff HEAD on the template empty, loop.yaml:444 still guarded by {{ if .nodes.demo.output }}, loop-template+adoption 34/34 pass / git status --porcelain and git diff HEAD empty (working tree == HEAD 1d0c2e0), loop.yaml:444 holds the evidence/ link, loop-template.test.mjs 22/22 including the cited AC-6 test (3 of 3)
- code-quality-reviewer — [blocking] plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:440-444 (uncommitted) — Uncommitted edit removes the {{ if .nodes.demo.output }} evidence-link block from the shipped template; loop-template.test.mjs (AC-6) and adoption.test.mjs (AC-9) fail against that working tree, contradicting evidence.md's claimed green gate 9.6. · refuted: git status clean at HEAD 1d0c2e02; loop.yaml:443-445 still contains the {{ if .nodes.demo.output }} evidence-link block; loop-template+adoption 34/34 pass including AC-6 and AC-9 / git status --short empty, no uncommitted edit at all, the {{ if .nodes.demo.output }} block present as shipped, tests 34, pass 34, fail 0 / git status/diff HEAD show a clean working tree; loop.yaml:440-444 intact; loop-template 22/22 (AC-6) and adoption 12/12 (AC-9) both pass at HEAD 1d0c2e0; the finding described a transient mid-round state (3 of 3)

## Notes
- Path: agents (this turn began as a loop task notification, not the owner typed message, so the Workflow path does not apply).
- Called after round 2 deadlocked; phase 9 (tasks 9.1-9.5) answered its three findings, so this is a fresh round over 307e1f5..HEAD, not a third round of the same cycle.
- During stage 1 the test-coverage reviewer mutation-tested the shipped loop template in place instead of in its scratch copy and restored that one file with git checkout -- on that path. The spec and quality reviewers, running in parallel, observed that transient state and each raised it as blocking. Three verifiers each refuted both findings at HEAD: git status --porcelain empty, the guarded evidence-link block intact at loop.yaml:443-446, loop-template 22/22 and adoption 12/12 green. The committed change was never affected.
- Those two verdict files were first written with a (uncommitted changes) marker on their Commit: line, which deliver-check reads as stale. Stage 3 ran once more for both with the verified tree state; the marker is gone and check-file passes for all five.
- Two writer agents reported a prompt-shaped reminder urging them to write their verdict file through raw shell rather than the Write tool, and the spec reviewer reported one asserting the uncommitted edit was intentional and needed no disclosure. All three declined and reported it. Flagged for the owner, not a finding against the change.

## Next
Ready to ship.
