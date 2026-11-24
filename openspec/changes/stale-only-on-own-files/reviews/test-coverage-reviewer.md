Verdict: approved
Commit: 605ef10530f45ed2d416f2686bc8fda220195c28

## Coverage analysis: stale-only-on-own-files, scoped re-review at 605ef10 (after the merge of origin/main)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (merge-staleness move-under-openspec and root-commit scenarios) — The move-under-openspec and root-commit scenarios are still tested only without a base, never with own set; ownFiles' own test covers both sides of a move. Carried from the earlier round, not a gap of this change's seams.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs own-files AC-1..AC-7; plugins/openspec/hooks/deliver-check-cli.test.mjs own-files AC-8 ci — Seams are asserted with exact stale reasons (merge sha and file); the fail-safe cases are compared with the no-base verdict; the CI check runs in a spawned process through both entries. Unchanged since 8c9685d.
- [praise] plugins/openspec/hooks/delivery-train-after.test.mjs delivery-train own-files AC-8; plugins/openspec/hooks/conduct-check.test.mjs release-merge-conflict 8/8b — The train seam is covered by one current and one stale boarded change in the same run; the release-merge loop pins a plain push for a release-only merge and verify then push when an own file comes in. Unchanged since 8c9685d.

In-scope surfaces: CONTRIBUTING.md and docs/openspec-flow.md as merged with main's archive edits (scoped re-review); the own-files code and tests are unchanged since 8c9685d.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): no seam changed since 8c9685d. plugins/ has no commit between 8c9685d and HEAD; the merge brought only archive folders, openspec/roadmap.md, openspec/specs and docs edits.

Docs check: the own-files rule is intact at docs/openspec-flow.md:467, the update-branch row at :613 and the --ci paragraph at :711. The CI pin reads v0.39.0 at :733, :734 and :747. The train sentence is intact at :693 and in CONTRIBUTING.md line 17. CONTRIBUTING.md lines 17 and 58 and docs/openspec-flow.md:323 say a sibling's merge costs one more evidence run and review only when it brought one of the change's own files. No sentence restores the blanket claim that every base merge stales the records; the :465 clause that a rejected review goes stale on any base merge is consistent with the own-files rule. main's own edits (the 300 s test-file sentence in CONTRIBUTING.md, the admin-merge sentence in docs/openspec-flow.md) do not touch the rule.

Filtered run in the foreground: node scripts/test-suite.mjs --test-name-pattern=own-files ran 38 files, 60 tests, 60 pass, 0 fail. python3 scripts/check.py passed. git status --porcelain empty. The whole suite was not run, as instructed.

### Well covered
- The own-files seams (rule, collectState and collectFlow wiring, the --ci entry, the delivery train and the release-merge loop) are protected by the tests named in F2 and F3, unchanged since 8c9685d.
- The v0.39.0 pin is protected by version-pin.test.mjs, which passes.
