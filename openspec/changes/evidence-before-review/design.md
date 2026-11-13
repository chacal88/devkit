# Design

Change: `evidence-before-review` · Date: 2026-11-12 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

## Context

The motivation is in proposal.md, under Why. This design builds on devkit-openspec 0.12.0,
devkit-core 0.6.1 and devkit-panel 0.2.0, as they are on `main` at 279c830.

**Where the order is computed.** `plugins/openspec/hooks/deliver-check.mjs#nextStep` (line 957,
"first match wins"). After the phases and `commit` (line 989), the delivery rows are, in order:

1. `stop-review-deadlock` (lines 991-994): a current rejected review and `review.md` at
   `FAIL (round 2/2)`;
2. `fix-review` (lines 995-1008): a current rejected review, or a current approved one with an
   undisposed `blocking`/`important` finding;
3. `review` (lines 1009-1020): any reviewer missing or stale, or a stale one with an undisposed
   finding; `round` is 2 only after `FAIL (round 1/2)` with a re-rejected reviewer;
4. `fix-defect` (lines 1021-1024): item 4 has a `fail`/`defect` row and `evidence.md` is current;
5. `verify` (lines 1025-1027): item 1 open for evidence (missing, stale, a gate without a row) or
   item 4 open for evidence or a missing criterion row;
6. `blocked` (line 1028): the lowest blocked item of 1 to 4 (item 4 with only `no proof` rows);

then the PR rows (`open-pr`, `push`, `fix-checks`, ...), which are not touched here.

**Why reviews and evidence never stale each other.** `staleness()` (line 193) accepts a recorded
sha when every later commit touches only `openspec/` and the working tree has no change outside
`openspec/` and `.claude/`. Both `reviews/*.md` and `evidence.md` live under
`openspec/changes/<id>/`, so writing either one, committed or not, leaves the other current
(pinned today by the `staleness:` tests at `deliver-check.test.mjs:221-300`).

**Who reads the order.** `ship-change` (its Loop runs `next.step` and never chooses the order),
`conduct` / `conduct-check` (passes `next` through, `conduct-check.mjs:47-66` maps `verify` to
`devkit-core:pr-verifier` and `review` to the session), and devkit-panel (`steps.ts#flowSteps`
places `next.step` on a ten-step ladder ordered by `i18n.ts#STEP_KEYS`, and marks every step
before the current one as done).

**Where the order is written as text.** Found with a repository grep (excluding
`openspec/changes/`):

| File | Lines today |
|---|---|
| `plugins/openspec/schemas/devkit/schema.yaml` (copy: `openspec/schemas/devkit/`) | 3 (`description`), 336-345 (`apply.instruction`) |
| `plugins/openspec/schemas/devkit-lite/schema.yaml` (copy: `openspec/schemas/devkit-lite/`) | 3, 265-271 |
| `plugins/openspec/skills/openspec-setup/templates/config.yaml` | 1-2 (comment), 47 (`operations.apply.guidance`) |
| `openspec/config.yaml` | 1-2, 43 |
| `plugins/openspec/skills/ship-change/SKILL.md` | 3 (description), 26 (Mode), 40 (`commit` row), 79 (Resume), 86 (Hosts, `app`) |
| `plugins/openspec/skills/conduct/SKILL.md` | 94-96 (Delivery rows: follows ship-change, names no order) |
| `docs/openspec-flow.md` | 51, 61, 199, 420, 541; no paragraph states the delivery order |
| `plugins/core/README.md` | 3, 17 (diagram), 27-28 (step table) |
| `README.md` | 9 (asset list in flow order), 47 (diagram) |
| `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (devkit-openspec) | `description` ("review → evidence"); `docs/catalog.md` is generated from it |
| `plugins/panel/hooks/i18n.ts` | 12 (`STEP_KEYS`) |
| `plugins/panel/README.md` | 31 (the ten step names) |

**The release and the tag.** `openspec-setup` pins a project's CI workflow to the commit of the tag
`v<devkit-openspec version>` (`github-setup.mjs:49-68`; ADR 0002, Consequences). The newest tag is
`v0.8.0` (`git tag`), so releases 0.9.0 to 0.12.0 cannot be pinned. `deliver-check.test.mjs:3110`
already requires the doc pin to equal the devkit-openspec version.

## Goals / Non-Goals

**Goals:**

- One move inside `nextStep`; every other row, the JSON, the step names and the staleness rule
  stay byte-for-byte.
- Every text that orders the delivery steps says `pr-verifier` before `review-change`, held by a
  test so the old order cannot come back silently.
- The panel's ladder follows the checker.
- A tagged release that projects can pin.

**Non-Goals:**

- No change to `review-change`, `review-round.mjs`, the verdict rules, `pr-verifier` or its
  evidence format, `guard.mjs`, `deliver-check --ci`, or `staleness()`.
- No `deliver-check` step for the release or the tag; the tag push is a manual post-merge step.
- No tags for 0.9.0 to 0.12.0.

## Decisions

### D1. No spec delta

`openspec list --specs` reports "No specs found"; `openspec/specs/` holds only `.gitkeep`, and all
twelve archived changes set `skip_specs: true`. There is no capability spec in which a MODIFIED
delta could be written, and creating the repository's first spec here would be scope the request
did not ask for. This change sets `skip_specs: true` too; the acceptance criteria and the tests
pin the behaviour, as in every prior change. (The planning request asked for MODIFIED deltas;
there is no spec for one to modify.)

### D2. The new order in `nextStep`

Move the `fix-defect` block (lines 1021-1024, with its `const ac`) and the `verify` block (lines 1025-1027) to just
after the `fix-review` block and before the `toReview` / `review` block. `stop-review-deadlock`
stays first; `blocked` (items 1-4) stays after `review`. The rows after `commit` become:

| # | Step | Condition (unchanged) |
|---|---|---|
| 1 | `stop-review-deadlock` | current rejected review and `FAIL (round 2/2)` |
| 2 | `fix-review` | current rejected review, or current approved review with an undisposed finding |
| 3 | `fix-defect` | a `fail`/`defect` row and `evidence.md` current |
| 4 | `verify` | evidence missing or stale, a gate or criterion row missing |
| 5 | `review` | a reviewer missing or stale (round computed as today) |
| 6 | `blocked` | lowest blocked item of 1-4 |

The comment above `nextStep` names this change and D2 next to "design D4, first match wins".

What changes, by state (nothing open but items 1-4, no PR yet):

| Evidence | Reviews | 0.12.0 | 0.13.0 |
|---|---|---|---|
| missing or stale | missing or stale | `review` | `verify` (AC-1, AC-3) |
| current, no defect | missing or stale | `review` | `review` (AC-1) |
| current, defect | missing or stale | `review` | `fix-defect` (AC-2) |
| current, defect | current and approved, nothing undisposed | `fix-defect` | `fix-defect` (AC-2) |
| any | a current rejected one | `fix-review` | `fix-review` |
| any | a current approved one with an undisposed finding | `fix-review` | `fix-review` |
| any | current rejected at `FAIL (round 2/2)` | `stop-review-deadlock` | same |
| current, only `no proof` rows | missing | `review`, then `blocked` | same |

Why this place:

- **`fix-review` stays before evidence.** A rejected review means a code fix is coming; the fix
  commit stales any evidence recorded now, so recording it first would be a wasted `pr-verifier`
  run. This is also why `fix-review` stays ahead of `fix-defect`: both lead to a code fix, the
  reviewer's finding is already current, and after the fix commit both the evidence and the
  reviews are stale, so the next steps are `verify` and then `review` either way.
- **`fix-defect` before `verify`, both before `review`.** The owner confirmed (requirements.md,
  Assumptions) that a failing criterion is fixed and the evidence recorded again before any review
  round. The existing guard `ac.evidence === 'current'` keeps a defect on stale evidence from being
  "fixed" before it is re-verified (today's test "row 11 before row 10").
- **`stop-review-deadlock` first.** It is the owner's stop; fresh evidence does not resolve a
  disputed finding.
- **`noProof` unchanged.** A criterion with only `no proof` rows does not open `verify`
  (`acOpen` reads `missing`, not `noProof`), so such a change still goes to `review` and then
  stops `blocked: item 4` for the owner, as today.

Alternatives considered:

| Option | Why rejected |
|---|---|
| `verify` before `fix-review` too | the fix commit stales that evidence; one wasted `pr-verifier` run per rejected round |
| `verify` before `review`, `fix-defect` after `review` | a review round would run on code with a known failing criterion; contradicts the owner's answer and AC-2 |
| `verify` before `stop-review-deadlock` | the deadlock is the owner's; evidence does not change it |
| Make reviews depend on the evidence (stale when `evidence.md` changes) | every evidence write would stale every review; AC-4 forbids it |
| Leave `nextStep` alone and only change the instructions | `ship-change` and `conduct` never choose the order; the checker would keep sending `review` first |

### D3. Staleness is not touched; AC-4 is proven by tests

`staleness()` and the `Commit:` rule do not change. New tests (task 1.4) build a repository with
committed code, then: (a) write `evidence.md` at `HEAD`, then `reviews/*.md` uncommitted, and check
items 1 and 4 still read `evidence: 'current'`; (b) commit the reviews and check again; (c) the
reverse (reviews first, then `evidence.md`, uncommitted then committed) with item 2 still met.

### D4. The guards are not touched; AC-5 is proven by tests

`guard.mjs#prViolation` (lines 322-332) checks reviews, then evidence, independent of the order
they were written in; `deliver-check --ci` reads items 1-4 with the same staleness rule. Today's
`guard.test.mjs:181` writes the reviews first; the new order writes the evidence first, so a new
guard test checks that `gh pr create` is refused with `evidence.md` present and no reviews
(`review not approved`), and with approved reviews and no evidence (`evidence.md`). Two `--ci`
tests check a failure when only the evidence is stale (reviews recorded at the later commit) and
when only the reviews are stale (evidence recorded at the later commit).

### D5. Tests: names and the ones that flip

A test that proves a criterion starts its name with the id and the slug (`AC-2
defect-before-review: ...`), as panel-conduct-view did; existing tests keep their names, which cite
other changes' ids in parentheses. Evidence rows cross-reference by slug only (a row naming two ids
counts for both).

New tests (tasks 1.2-1.5): listed in tasks.md with the state each builds.

Existing tests whose expectation moves because the evidence was missing when they asked for
`review`. Rule: when the test is about the order (a walkthrough, `seen` lists), the expectation
flips; when it is about something else (scoped re-review, rounds), the test records current
evidence first so it keeps proving its own point.

| Test | Kind | Change |
|---|---|---|
| `deliver-check.test.mjs:1717` resume: one review current | about scoping | record `fullEvidence` before each `t.next()` |
| `:1781` walkthrough devkit-lite | order | `[..., 'commit', 'verify', 'review', 'open-pr', 'ready']` |
| `:1784` round-2 deadlock resume | about rounds | after the owner's commit expect `verify`, record evidence, then `review` round 1 |
| `:2324` merge-mode walkthrough | order | `'verify', 'review'` |
| `:2361` auto-merge after a product commit | order | call `fullEvidence` before `reviewAt`; `seen` has `'verify', 'review', 'push'` |
| `conduct-check.test.mjs:710` override 2c | order | rename to "after the force push both are stale: verify, then review (override 2c)"; expect `verify` (`subagent`, `devkit-core:pr-verifier`), record evidence, then `['review', 'review']` |

Any other test that turns red in task 1.6 follows the same rule; the implementer lists it in the
phase report.

### D6. The text: what changes and how it stays changed

What counts as "describing the order" (AC-6): text that sequences the two steps (numbered steps,
"then", arrows, a list in flow order, "followed by"). A conjunction naming both requirements of the
PR gate ("approved reviews and evidence before the PR", ADR 0001; the gates table row "Review and
evidence before the PR"; `plugins/openspec/README.md:19` "reviews and evidence still required") is
not an order and stays. Out of the scan: `openspec/changes/` (archived and this change's own
records), `CHANGELOG.md` (history), `plugins/panel/hooks/fixtures/` (captured data).

The new wording, by file (the implementer keeps the surrounding text):

- **Schemas, `apply.instruction`** (devkit): "After the last phase: 1. Dispatch
  devkit-core:pr-verifier: it writes evidence.md, one row of proof per acceptance criterion id. If
  it records a defect, dispatch tdd-implementer to fix it, then dispatch pr-verifier again. 2. Run
  the review-change skill for this change. [reviewer sentence as today]. If any rejects, dispatch
  tdd-implementer to fix, then dispatch pr-verifier again and re-run the reviewers concerned.
  3. [commit-and-pr, unchanged]". devkit-lite: the same two moves in its shorter form.
  `description:` "... → evidence + review before the PR". Both `openspec/schemas/*/schema.yaml`
  copies are rewritten byte-identical to `plugins/openspec/schemas/*`.
- **Config template and `openspec/config.yaml`**: comment "(... → apply → evidence + reviews)";
  guidance "After the last phase, dispatch devkit-core:pr-verifier (writes evidence.md; a defect is
  fixed and the evidence recorded again), then run review-change for this change (each reviewer
  writes reviews/<reviewer>.md)".
- **`ship-change`**: description "implements phase by phase, verifies, reviews, opens the PR";
  Mode "(plan, readiness, `tdd-implementer` per phase ..., `pr-verifier`, `review-change`,
  `commit-and-pr`)"; `commit` row "This is a pre-review commit: precondition 3 does not apply;
  verify and review run next" (commit-and-pr's "the caller says review comes next" still holds);
  Resume adds "a current `evidence.md` is not recorded again; after a commit that touches product
  code the checker gives `verify` first, then only the reviewers that went stale"; Hosts `app`
  "(`fix-checks`, its commit, `verify`, scoped re-review, `push`, one more watch)".
- **`conduct`**: one sentence under Delivery rows: the checker orders the delivery steps as the
  ship-change Loop runs them: after the phases `pr-verifier` records the evidence (`verify`, and
  `fix-defect` until no defect is left) before a `review` round, and a fix outside `openspec/`
  makes both stale again (`verify`, then `review`).
- **`docs/openspec-flow.md`**: line 51 (apply: `pr-verifier`, a defect fixed and re-verified, then
  `review-change`, then `commit-and-pr`); line 61 ("`evidence.md` and the reviews"); line 199 ("the
  evidence and every review are stale, so `verify` and then `review` follow"); line 420
  (`pr-verifier`, then `review-change` for only the reviewers that went stale); line 541 ("Dispatch
  `pr-verifier`, then run `review-change`"); a new paragraph **Order of the delivery steps.** in
  "The delivery contract", after "The `Commit:` staleness rule", giving the D2 table in prose and
  saying why reviews and evidence do not stale each other.
- **`plugins/core/README.md`**: line 3 "implement with TDD, verify, review with a bench of
  specialist reviewers, and ship a PR"; line 17 `retro ◀── commit-and-pr ◀── review-change ◀──
  pr-verifier ◀── tdd-implementer (one phase at a time)` (same width, so the `│` above still
  lines up); the "Prove it works" row moves above "Review" (the `| Review |` row keeps "verif", which
  `review-round.test.mjs:766` reads).
- **`README.md`**: line 9 lists `pr-verifier` before `review-change`; line 47 `retro ◀──
  commit-and-pr ◀── review-change ◀── pr-verifier ◀──────┘`.
- **devkit-openspec description** (`plugin.json`, `marketplace.json`): "(grill → plan → readiness
  → TDD → evidence → review)"; `python3 scripts/gen-catalog.py` regenerates `docs/catalog.md` and
  the pack README's catalog block (ship-change's description changes too).

**The regression test** (task 2.6, in `deliver-check.test.mjs` beside the other `format:` text
tests), `AC-6 instructions-follow: ...`:

1. each `plugins/openspec/schemas/<s>/schema.yaml` equals `openspec/schemas/<s>/schema.yaml`;
2. positive markers: in each schema's `apply:` block, in the guidance line of both config files,
   in ship-change's Mode paragraph, in conduct's Delivery rows section, and in the flow doc's apply
   paragraph, the first `pr-verifier` comes before the first `review-change` (conduct: `verify`
   before `review`); the two diagrams contain `review-change ◀── pr-verifier`;
3. negative scan: no file from `git ls-files` outside the exclusions above (and outside this test
   file) contains a phrase of an `OLD_ORDER` list, at least: `review → evidence`,
   `review + evidence`, `reviews + evidence`, `pr-verifier ◀── review-change`,
   `1. Run the review-change skill`, `then dispatch devkit-core:pr-verifier`,
   `` `review-change`, `pr-verifier` ``, `` for only the reviewers that went stale, `pr-verifier` ``,
   `reviews, verifies`, `` scoped re-review, `verify` ``, `` `review` and `verify` follow ``,
   `` then dispatch `pr-verifier` ``, `review with a bench of specialist reviewers, verify`,
   `` `review-change` with six specialist reviewers, `pr-verifier` ``. Phase 3 adds the panel's:
   `'review', 'proofs'`, `Revisão, Provas`, `revisão, provas`, `review, proofs`.

### D7. The panel: swap two keys

`i18n.ts:12` `STEP_KEYS` becomes `[..., 'implementation', 'proofs', 'review', 'pr', ...]` (the
`StepKey` union and `STEP_NAMES` are reordered the same way for reading; a `Record` has no order
the code reads). Checked against `steps.ts`, nothing else changes:

- `STEP_OF` maps step ids to keys, not positions: `verify`, `fix-defect` stay under `proofs`;
  `review`, `fix-review`, `stop-review-deadlock` under `review`.
- `STEP_ITEMS` (`review: [2, 3]`, `proofs: [1, 4]`) and `stepOfItem` (item 1 → Implementation
  while a task is open, else Proofs; 2-3 → Review; 4 → Proofs) are positional-free.
- `partial`: Proofs is partly done when the flow is past it with an unproven criterion. With the
  new order "past it" is Review or later, which is when `no proof` rows wait for the owner
  (D2, last row): it reads right.
- `isFinished` fallback (a step id outside the table): the first unfinished key now checks Proofs
  (items 1, 4 met) before Review (items 2, 3 met), the checker's order.
- `nowOf`'s `then` lists the next pending steps in ladder order: at `verify` it reads `Depois:
  revisão, PR e checks, merge.`
- The approved mock (`mock/passos.md`) is this order with the 0.2.0 rows and facts; only the
  order changes. While the next step is `verify`, Review is after the current step, so it is
  `pending` (AC-7).

Tests that flip (task 3.2): `report.test.tsx:606` (sample text), `:612-613` (names in ladder
order), `:942` (`steps[6]` → `steps[5]` for Proofs), `:952-953` (partial Proofs index), `:961-965`
(`fix-review` → 6, `fix-defect` → 5, blocked item 2 → 6, item 4 → 5), `:1017`, `:1021` (then
text); `panel.test.tsx:396`, `:405-406`, `:444`, `:458`. New: one `flowSteps` test and one drawn
test (both surfaces) with `next.step: verify`, named `AC-7 panel-order: ...`.

### D8. Release

- devkit-openspec 0.12.0 → **0.13.0** (behaviour of `deliver-check`: minor), devkit-core 0.6.1 →
  **0.6.2** (README only), devkit-panel 0.2.0 → **0.2.1** (ladder order), marketplace
  `metadata.version` 0.15.0 → **0.16.0**; each in its `plugin.json` and `marketplace.json`.
- `CHANGELOG.md`: `## 0.16.0 — evidence before review`, one line per pack and a Docs line.
- The CI pin in `docs/openspec-flow.md` (lines 479, 480, 487) → `v0.13.0`
  (`deliver-check.test.mjs:3110` holds it to the version).
- `CONTRIBUTING.md` has no tagging rule today (`grep -in tag CONTRIBUTING.md` on 279c830 finds
  none). This change adds one, confirmed by the owner on 2026-11-13 (requirements.md,
  Assumptions), after step 5 of "Adding or changing an asset": a release that changes
  devkit-openspec's version is tagged `v<that version>` on its merge commit on `main`, with a
  lightweight tag pushed after the merge (`git tag v<x> <merge sha>` then `git push origin
  v<x>`), because `openspec-setup` pins projects' CI and vendored schemas to that tag's commit
  (ADR 0002). A release that bumps only other packs gets no new tag: it has nothing new to pin,
  and `v<that version>` already names an earlier commit.
- The same task corrects the guard-suite time in CONTRIBUTING line 40: "about 9 minutes; 8.7
  observed on 94e795d" becomes "about 13 minutes; 12m54s observed on 279c830".
- A test `AC-8 release-ready: ...` (task 4.5): every pack's `plugin.json` version equals its
  `marketplace.json` entry; the doc pin names `v<devkit-openspec version>`; CONTRIBUTING holds the
  tag rule (`v<devkit-openspec version>`, "merge commit", "lightweight"). Version values are
  checked by `pr-verifier` against this design, not hard-coded in a test that the next release
  would break.

### D9. The tag: an owner-run last phase, and a post-merge step

The tag must point at the merge commit, which exists only after GitHub merges, while
`deliver-check` needs every checkbox of `tasks.md` and every criterion's row in `evidence.md`
before the PR. So the work splits, as the owner confirmed on 2026-11-13: AC-8 (`release-ready`)
covers what exists before the PR, and the tag is a post-merge step, recorded and checked in
`retro.md`:

- **Phase 5 (before the PR), owner-run by the conducting session, no implementer and no child
  session**, like panel-conduct-view's phase 5: task 5.1 checks that `v0.13.0` is free
  (`git ls-remote --tags origin refs/tags/v0.13.0` and `git tag --list v0.13.0` print nothing) and
  that `plugins/openspec/.claude-plugin/plugin.json` reads `0.13.0`, and writes that record, with
  the post-merge commands below, to the conducting session's scratchpad for `pr-verifier`. Gate 5.9
  is quick and offline. Every checkbox can be ticked before the PR.
- **After the merge (plain bullets under `## Workflow follow-up`, not tasks)**: when the checker
  reports `retro` for this change, the conducting session, before dispatching the retro:

  ```bash
  git fetch origin main
  sha="$(gh pr view <n> --json mergeCommit --jq .mergeCommit.oid)"
  git show "$sha:plugins/openspec/.claude-plugin/plugin.json"   # reads "version": "0.13.0"
  git tag v0.13.0 "$sha"
  git push origin v0.13.0
  git ls-remote origin refs/tags/v0.13.0                         # prints "$sha	refs/tags/v0.13.0"
  ```

  It passes the commands' output to the retro dispatch. `retro.md` records it and checks it: the
  `git ls-remote` line names the merge commit's sha. If the push is refused, the session stops and
  tells the owner; an existing tag is never moved.

**How AC-8 is proven.** Every part of AC-8 is true before the PR, so `pr-verifier` records a plain
`pass` row: the bumped versions and the CONTRIBUTING rule (the `release-ready` test), the CHANGELOG
entry (`python3 scripts/check.py`), the pin (the pin test), and `v0.13.0` free on `origin` and
locally (5.1's record). The tag on the merge commit is not part of any criterion; its record is in
`retro.md`.

### D10. Dogfood: delivered with the working tree's checker

From gate 1.9 on, the conducting session reads the next step from the working tree's checkers in
the change's worktree: `node plugins/openspec/hooks/deliver-check.mjs evidence-before-review
--json`, and, when it conducts, `node plugins/openspec/hooks/conduct-check.mjs --json --change
evidence-before-review`, in place of the installed 0.12.0 ones. When they disagree, the working
tree's wins for this change. So this change records its own evidence before its own review round.
Expected after gate 5.9: `commit` → `verify` → (`fix-defect` → `commit` → `verify`)* → `review` →
`open-pr` → ... → `enable-auto-merge` → `wait-merge` → (tag, D9) → `retro`. `pr-verifier` runs the
same `deliver-check` before it writes and quotes `next.step` (`verify`) and item 2 (reviewers
missing): a live proof of AC-1 on this change. The gain in Digital-Representative shows only in a
later change there.

### D11. ADRs

No ADR changes and no new ADR:

- ADR 0001's gates ("approved reviews and evidence before the PR") hold; only the order between
  the two changes, inside the PR gate.
- ADR 0002's pin to a release tag's commit is what the tag serves; the tag rule in CONTRIBUTING
  is a release convention, not a new decision.
- ADR 0004 (hooks per project), ADR 0006 and 0007 (`/conduct`) are untouched.
- ADR 0008: the review round is unchanged; only when it runs moves.

## Risks / Trade-offs

| Risk | P × I | Mitigation |
|---|---|---|
| A test flipped from `review` to `verify` loses what it proved (scoped re-review, rounds) | MEDIUM × MEDIUM | D5's rule: record evidence first in tests about something else; the table lists the known ones |
| The phrase scan misses a paraphrase of the old order | MEDIUM × LOW | positive markers in the listed files; the planner's grep in Context; reviewers |
| A project updates with a change mid-delivery | LOW × LOW | nothing goes stale; it gets `verify` where it got `review`; a rejected review is still fixed first |
| The tag push is refused (a tag ruleset) or `v0.13.0` already exists | LOW × MEDIUM | 5.1 checks the tag is free; on refusal the session stops and tells the owner (`gh api repos/chacal88/devkit/git/refs -f ref=refs/tags/v0.13.0 -f sha=<sha>` from the owner's login); never move a tag |
| The post-merge tag is forgotten after a green merge | MEDIUM × MEDIUM | a Workflow follow-up bullet ties it to the `retro` step; `retro.md` records the `git ls-remote` line and the retro reports a missing tag |
| The conducting session uses the installed 0.12.0 checker and reviews first | MEDIUM × LOW | D10, Workflow follow-up; `pr-verifier` quotes the working tree's `next.step` |
| The bundled binary's `plugin test` is behind the rollout switch | MEDIUM × LOW | CONTRIBUTING "Testing a mod pack" warm-up; `plugin test` first in each gate |
| The guard suite (~9 min) outruns a foreground Bash (600 s) | HIGH × LOW | gates 1.9 and 4.9 run as a background Bash |

Trade-off: a rejected round now costs a `pr-verifier` run after each fix (verify, then review),
where the old order ran it once at the end. Accepted: the evidence is what the reviewers read, and
a missing one cost a whole round.

## Migration Plan

1. Phases 1-5 on branch `evidence-before-review`; the PR merges in `merge` mode at 8/8.
2. After the merge: the tag (D9), then `claude plugin update devkit-openspec@devkit`,
   `devkit-core@devkit` and `devkit-panel@devkit` in this repository.
3. Projects: `claude plugin update`, then re-vendor the schemas from `v0.13.0`
   (`install-schemas.sh`) and pin CI to its commit (the `openspec-setup` GitHub step).

Rollback: revert the squash commit; `nextStep` goes back to `review` first, and no recorded file
goes stale either way. A pushed tag is not deleted on rollback (projects may already pin its
commit); the next release supersedes it.

## Implementation plan

Dependency order: checker (phase 1) → text (phase 2) → panel (phase 3) → release files (phase 4)
→ tag check (phase 5). Phases 2 and 3 do not need phase 1's code, but phase 2 describes it, and
phase 4 bumps what 1-3 changed.

**Per surface:**

- devkit-openspec hooks: `nextStep` reorder; tests in `deliver-check.test.mjs`,
  `conduct-check.test.mjs`, `guard.test.mjs`.
- devkit-openspec schemas, skills, config template: text (D6).
- devkit-core: `README.md` text.
- devkit-panel: `STEP_KEYS` and tests, `README.md`.
- Repository: `openspec/schemas/`, `openspec/config.yaml`, docs, release files.

**Files.** Modify: `plugins/openspec/hooks/deliver-check.mjs`,
`plugins/openspec/hooks/deliver-check.test.mjs`, `plugins/openspec/hooks/conduct-check.test.mjs`,
`plugins/openspec/hooks/guard.test.mjs`, `plugins/openspec/schemas/devkit/schema.yaml`,
`plugins/openspec/schemas/devkit-lite/schema.yaml`, `openspec/schemas/devkit/schema.yaml`,
`openspec/schemas/devkit-lite/schema.yaml`,
`plugins/openspec/skills/openspec-setup/templates/config.yaml`, `openspec/config.yaml`,
`plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/skills/conduct/SKILL.md`,
`plugins/openspec/README.md` (generated catalog block), `plugins/openspec/.claude-plugin/plugin.json`,
`plugins/core/README.md`, `plugins/core/.claude-plugin/plugin.json`, `plugins/panel/hooks/i18n.ts`,
`plugins/panel/hooks/report.test.tsx`, `plugins/panel/hooks/panel.test.tsx`,
`plugins/panel/README.md`, `plugins/panel/.claude-plugin/plugin.json`, `docs/openspec-flow.md`,
`docs/catalog.md` (generated), `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`,
`.claude-plugin/marketplace.json`. Create: none. Delete: none.

**Estimate:** optimistic 7 h, likely 11 h, pessimistic 17 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| `nextStep` reorder and comment (1.1) | 0.5 | Core | LOW |
| AC-1/AC-2 unit tests (1.2) | 1 | Testing | LOW |
| AC-1/AC-3 integration tests (1.3) | 1.5 | Testing | MEDIUM |
| AC-4 staleness tests (1.4) | 0.5 | Testing | LOW |
| AC-5 guard and `--ci` tests (1.5) | 0.5 | Testing | LOW |
| Flip existing tests (1.6) | 1.5 | Testing | MEDIUM |
| Schemas, configs, skills text (2.1-2.3) | 1.5 | Documentation | LOW |
| Flow doc, READMEs, descriptions, catalog (2.4-2.5) | 1 | Documentation | LOW |
| AC-6 text test (2.6) | 1 | Testing | MEDIUM |
| Panel keys, tests, README (3.1-3.3) | 1 | Core | LOW |
| Release files, CONTRIBUTING, AC-8 test (4.1-4.5) | 0.75 | Migration | LOW |
| Tag check and post-merge tag (5.1, follow-up) | 0.25 | Integration | MEDIUM |

**Assumptions** (where the plan breaks if reality differs):

- `staleness()` ignores commits and uncommitted files under `openspec/` (`deliver-check.mjs:193`;
  tests `:221-300`). If not, AC-4 fails and D3 needs a code change.
- `pr-verifier` needs no review to run (`plugins/core/agents/pr-verifier.md`, Delivers: "You can
  run on the branch before the PR exists").
- The guard checks reviews and evidence independently (`guard.mjs:322-332`).
- No ADR fixes the order (ADRs 0001-0008 read for this plan).
- The panel's ladder order comes only from `STEP_KEYS` (`steps.ts:172`, `:287`).
- The tag name `openspec-setup` reads is `v<devkit-openspec version>` (`github-setup.mjs:53`).
- The `devkit` ruleset does not cover tags (not verified; see Risks).
- `node --test --test-name-pattern` filters to the named tests in well under a second (observed
  on 279c830 with the existing `format:` and pin tests).

**Dependencies:** review-workflow (archived; `fix-review` for an approved review with an
undisposed finding, kept as is) and panel-conduct-view (archived; the ten-step ladder). No open
change.
