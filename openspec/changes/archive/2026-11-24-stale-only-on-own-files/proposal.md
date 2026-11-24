<!-- devkit-stage proposal result=passed attempt=1 commit=5d255b1e77f67a5628a3f1f7dabbcfe8f0147634 -->
# Proposal

Change: `stale-only-on-own-files` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, ADR 0025, ADR 0002, the `Commit:` staleness rule of
`docs/openspec-flow.md`). Roadmap: Round 25d of `openspec/roadmap.md`, line `stale-only-on-own-files`
(change-state retro, learning 3).

## Why

Every merge of `main` into a change's branch that brings a file outside `openspec/` makes the
change's `evidence.md` and every review stale, even when it touches none of the change's files. On
2026-11-23 several changes ran in parallel and each merge of `main` made every other one redo its
suite (13 to 45 minutes) and its review bench. The owner asked that a busy `main` no longer cost
that, and ADR 0025 records the rule.

## What Changes

- **The own-files rule.** A change's own files are the paths its branch changed against the base
  (`git diff origin/<base>...HEAD`) plus `openspec/changes/<id>/`, never a release file
  (`RELEASE_FILE` of `deliver-check.mjs`). A merge of the base whose first-parent diff holds none of
  them, and the base commits it brings in, no longer stale the recorded evidence or an approved or
  declined review. One own path is enough to stale them, and the reason names the commit and that
  path, in today's form.
- **Unchanged.** A plain commit on the branch, a merge of anything other than the base, a rejected
  verdict (or one with no `Verdict:` line), the test-spared reviewers and the `openspec/`-only rule
  are judged as today.
- **Fails safe.** With `origin/<base>` missing, with a base merged in that `origin/<base>` does not
  yet hold (an unfetched base), or with the head already contained in `origin/<base>`, no merge is
  exempted and the verdict is today's.
- **One rule everywhere.** The delivery checker (`deliver-check`), the stage checker (`flow-check`),
  the loop that reads both (`change-loop`, `conduct-check`) and the `devkit-reviews` check
  (`deliver-check --ci`) apply the same rule.
- **Documents.** `docs/openspec-flow.md` states the rule, which merges keep the records current and
  which do not, and that the pull request's required `check` CI is the backstop. Every sentence that
  says any base merge outside `openspec/` stales the records is corrected (the flow doc,
  `CONTRIBUTING.md`, the `devkit` skill and the `review-change` skill). ADR 0002 gets its
  "Amended by ADR 0025" line; `openspec/config.yaml` lists ADR 0025.
- **Release.** devkit-openspec and devkit-core minor bumps, the marketplace and `CHANGELOG.md`, the CI
  pin of `docs/openspec-flow.md` and the release tag.

Non-goals: fetching the base before judging (`fresh-base-check`), validating after a base merge
(`post-merge-validate`), merge trains or holds, a dependency closure of the own files, a per-project
release-file list, narrowing stale reviewers by area (requirements, "Out of scope").

## Acceptance criteria

- AC-1: On a scratch repository, after evidence.md and the reviews are recorded at a commit, a merge of `origin/<base>` that brings only paths outside the change's own files (not in `git diff origin/<base>...HEAD`, not under `openspec/changes/<id>/`) leaves evidence.md and every review current: `deliver-check` reports no `verify` and no `review` step because of that merge.
- AC-2: On the same scratch repository, a merge that brings a path the branch itself changed (a product file or a test file) makes evidence.md and the reviews stale, and the reason names the merge commit and that path.
- AC-3: A merge that brings both an unrelated path and one of the change's own paths is stale (one own path is enough), and the reason names the own path.
- AC-4: A merge that brings only release files (`RELEASE_FILE`), the ones the branch itself bumped included, leaves evidence.md and the reviews current.
- AC-5: A plain, non-merge commit on the branch that touches a path outside `openspec/` still makes the recorded evidence and reviews stale, as before this change.
- AC-6: The per-reviewer rules are unchanged: a rejected verdict, the test-spared reviewers and the openspec-only allowance behave as before, each with its existing test still green.
- AC-7: With `origin/<base>` missing, no merge is exempted and the verdict is the one given before this change.
- AC-8: `deliver-check --ci` (the `devkit-reviews` check) applies the same rule: after a merge that brings only unrelated paths, the check still passes on the recorded reviews; after a merge that brings an own path, it reports them stale.
- AC-9: `docs/openspec-flow.md` states the rule: which merges leave evidence and reviews current, which do not, and that CI's `check` is the backstop for the base changing something the change depends on.
- AC-10: Real-run proof covers every case above (AC-1 to AC-5 and AC-7, AC-8) on a scratch repository with an `origin`, not one case plus prose.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `change-delivery`: the requirement "A merge commit is judged by what it brings into the branch"
  gains the own-files exemption for a merge of the base; new requirements say which merges are
  exempt, that one own path stales the records, and that the rule fails safe.
- `change-stages`: "A stale stage runs again alone" judges "changes product code" by the delivery
  checker's rule, so a merge of the base that brings none of the change's own files leaves a
  code-bound stage passed.
- `verdict-files`: "A rejected verdict goes stale after any commit outside the change's review
  record" says that a merge of the base gets no own-files exemption for a rejected verdict.
- `reviews-check`: a new requirement that the `devkit-reviews` check applies the own-files rule.

## Impact

- **devkit-openspec (hooks):** `plugins/openspec/hooks/deliver-check.mjs` (`staleness`, `gitFacts`,
  `readReviews`, `tasksItem`, `acceptanceItem`, `collectState`, `runCi`, new `stalenessBase` and
  `ownFiles`); `plugins/openspec/hooks/flow-check.mjs` (`collectFlow`'s staleness facts).
  `change-loop.mjs` and `conduct-check.mjs` change no code: they read the two checkers.
- **devkit-openspec (tests):** `deliver-check.test.mjs`, `flow-check.test.mjs`,
  `conduct-check.test.mjs` (`release-merge-conflict 8` changes its expectation, AC-4),
  `change-loop.test.mjs` (`release-merge-conflict 16` pins the `devkit` skill sentence).
- **devkit-openspec (skill):** `plugins/openspec/skills/devkit/SKILL.md`, the
  `resolve-release-conflict` sentence.
- **devkit-core (skill):** `plugins/core/skills/review-change/SKILL.md`, the stale definition.
- **Docs and decisions:** `docs/openspec-flow.md`, `CONTRIBUTING.md`,
  `docs/adr/0002-merge-without-the-owner-opt-in.md`,
  `docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md` (status),
  `openspec/config.yaml` (ADR list).
- **Release:** `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md` if the generator changes it,
  the CI pin in `docs/openspec-flow.md`, the release tag.
- **Projects:** a project's `devkit-reviews` workflow gets the rule when it moves its pin to the new
  tag. Its `actions/checkout` already needs `fetch-depth: 0`, which brings `origin/<base>`.
- **Dependencies:** none. Inherited open decisions: none (the "Open points" of
  `docs/coordination-design.md` hold nothing on staleness).
- **Decisions cited:** ADR 0025 (this rule; `decisions.md`), ADR 0002 (its accepted cost narrows),
  ADR 0012 (the check judges devkit-script changes), ADR 0018 (the configured base of `two-prs`).

**Exit criteria:** `openspec validate stale-only-on-own-files --strict`; the hook suite
`node --test plugins/openspec/hooks/guard.test.mjs`; `python3 scripts/check.py`;
`python3 scripts/gen-catalog.py --check`; `claude plugin validate .`; the real-run proof of AC-10.
