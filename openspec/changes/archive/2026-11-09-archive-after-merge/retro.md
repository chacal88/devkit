## Retro: archive-after-merge

1. Went wrong: the gate this change exists for (the exact-path file check before an auto-merged
   archive PR) was placed only on the "no archive PR yet" path of `archiveNext`; with a PR open the
   run reached `enable-auto-merge` without it. Two reviewers found it in round 1, and a narrower
   variant (PR open, folder not archived locally) only in round 2. The round-1 fixes made ADR 0003's
   text stale, which cost a third, owner-authorized review round. `commit-and-pr` again wrote the
   Sonnet co-author trailer (twice), despite an explicit instruction. An implementer believed the
   gate command did not run `deliver-check.test.mjs` and started extra full-suite runs.
2. Better next time: when a check guards an action, list every path in the step logic that reaches
   that action and put the check (and a test) on each, including "already open" and "resumed"
   states. When a fix changes behaviour that an ADR or design written in the same change describes,
   update that text in the same fix. Tell implementers and reviewers that the gate already includes
   `deliver-check.test.mjs` through `guard.test.mjs`'s import.
3. Remember: a guard on one path to an action is no guard; enumerate the paths.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The file check guarded only the first-open path to `enable-auto-merge` | bug-class | doc-update (proposed below) | project |
| 2 | Review fixes left the change's own ADR 0003 stale, forcing a third round | process-friction | doc-update (proposed below) | project |
| 3 | Implementers did not know the gate runs `deliver-check.test.mjs` | doc-gap | doc-update (proposed below) | project |
| 4 | `commit-and-pr` writes the Sonnet trailer whatever the caller asks (recurs from auto-merge's retro, item 9) | tooling | followup: let the caller's trailer win, or drop per-commit trailers under squash | project |
| 5 | The owner works in Portuguese and wants routine choices made for them | environment | memory-only (proposed below) | user |
| 6 | A test pinned `openspec/changes/archive-after-merge/design.md`, so the archive move turned the suite red (same class as auto-merge's retro item 5: paths into a change folder break on archive) | bug-class | doc-update (proposed below, found at apply-proposals) | project |

## Proposed updates

### `CONTRIBUTING.md` (bug-class)
Under "How changes are made here", after the line about amending `design.md`.
- before: When an implementer resolves a readiness note in a way the design does not say, amend `design.md` in the same phase.
+ after: When an implementer resolves a readiness note in a way the design does not say, amend `design.md` in the same phase. When a check guards an action (auto-merge, a push, a merge), the design lists every step path that reaches that action, open and resumed states included, and each path gets the check and a test.
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (process-friction)
In the same section, a new line.
- before: (none)
+ after: When a fix changes behaviour that an ADR or `design.md` written in the same change describes, update that text in the same fix commit; a stale ADR found by review costs another round.
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (doc-gap)
Under "Adding or changing an asset", step 4, after the `node --test` block.
- before: (none)
+ after: `guard.test.mjs` imports `deliver-check.test.mjs`, `merge-setup.test.mjs` and `github-setup.test.mjs`, so this one command runs every hook test (about 6 minutes); give reviewers its result instead of having them re-run it.
- Answer: approved
- Applied: yes

### user memory (memory-only)
The owner (kauemsc) works in Portuguese and expects Claude to decide routine choices itself; ask only real owner decisions, in Portuguese.
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/guard.test.mjs` (bug-class)
Found by the dogfood at `apply-proposals`: the ADR 0003 test reads the change's own `design.md` by its active path, which the archive moved. The ADR text is the durable record; drop the two `design.md` assertions.
- before: const design = read('openspec', 'changes', 'archive-after-merge', 'design.md'); assert.doesNotMatch(design, /gates nothing on an archive PR/); assert.match(design, /`devkit-reviews --ci` checks archive PRs/);
+ after: (removed; the ADR 0003 assertions above stay)
- Answer: approved
- Applied: yes

## Dogfood

AC-9, the first change archived by the flow it delivers (design R-4). Recorded up to the archive PR;
the archive PR's merge is proven by `gh pr view` on it and by `deliver-check archive-after-merge`
reporting `archived` from `main` after it merges.

- Change PR #7 (`https://github.com/chacal88/devkit/pull/7`): `deliver-check` reported 8/8 at head
  `8898a3b`; `gh pr merge 7 --auto --squash --match-head-commit 8898a3b…` enabled auto-merge and
  GitHub merged it as `75ea405` on `main`.
- On `chore/archive-archive-after-merge` from `origin/main`, the repo's `deliver-check` (0.6.0)
  reported `merged: archive step retro`, `next.step: retro`, `archive.changePr.number: 7`,
  `onDefault: active`, `roadmap.listed: true`. The installed plugin (0.5.0) still reported `merged`,
  so the dogfood ran the repo's hooks and retro format (`CONTRIBUTING.md`, installed-plugin note).
