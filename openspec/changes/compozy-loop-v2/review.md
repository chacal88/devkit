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
