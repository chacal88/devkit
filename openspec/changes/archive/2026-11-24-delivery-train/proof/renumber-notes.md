# Renumber notes: delivery-train

Written for tasks 6.1 and 6.5 at the base `19c0196`, first against `origin/main` `4631376` ("archive remote-worker"), then
renumbered a second time against `origin/main` `6999a04` (the merge of PR 88, `roadmap-sessions-upfront`), which took ADR
0021, devkit-openspec 0.33.0, devkit-core 0.14.0 and marketplace 0.37.0. When `origin/main` moves again before the last
merge, renumber with the rules below; nothing else in the change carries a number that depends on `origin/main`.

## What `origin/main` showed

| Fact | Value on `origin/main` (`4631376`) | Value this change took |
|---|---|---|
| ADR numbers on `main` | 0001 to 0021 (0020 `a-change-can-run-on-another-machine`, 0021 `a-roadmap-run-opens-every-change-at-its-start`) | 0022 |
| devkit-openspec | 0.33.0 | 0.34.0 (minor) |
| devkit-core | 0.14.0 | 0.14.1 (patch) |
| marketplace `metadata.version` and CHANGELOG heading | 0.37.0 | 0.38.0 (a minor of devkit-openspec is a minor of the marketplace) |
| CI pin tag (`docs/openspec-flow.md`) | `v0.33.0` | `v0.34.0` (the tag is made after the merge, on the merge commit) |

Earlier numbers of this change: ADR 0019 in the plan, 0021 at the first merge (against `4631376`), now 0022; release
0.33.0 / 0.13.4 / 0.37.0 at the first merge, now 0.34.0 / 0.14.1 / 0.38.0.

The sibling `roadmap-sessions-upfront` merged first (PR 88) and took 0021 and the 0.33.0 / 0.14.0 / 0.37.0 numbers; this
change renumbered above it. Another local sibling branch (`stage-models`) is not merged to `main`; it will renumber above
whatever `main` holds when it merges, not this change.

## The ADR number (renumber by hand; `release-merge.mjs` does not touch it)

The ADR is now `docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md` (it was `0019-...` in the plan, then `0021-...`).
If `main` takes 0022 first, rename the file to the next free number and replace `ADR 0022`, `0022-reviewed-changes-leave-on-a-delivery-train`
and the `0022 reviewed changes leave on a delivery train` entry in each file below. Count of the number `0022` per file at
this commit (main's own `0021` references, to the roadmap run, stay on `0021`; check each hit before replacing):

| File | `0022` | What it holds |
|---|---|---|
| `docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md` | 2 | the file name, the title (`# ADR 0022: ...`) |
| `docs/adr/0002-merge-without-the-owner-opt-in.md` | 2 | `- Amended by ADR 0022 (...)` header line, the dated Note |
| `docs/adr/0003-auto-merge-the-archive-pr.md` | 2 | the same two |
| `docs/adr/0012-the-reviews-check-follows-the-change-script.md` | 2 | the same two |
| `docs/adr/0018-the-delivery-model-is-chosen-per-project.md` | 2 | the same two |
| `openspec/config.yaml` | 1 | the entry on the `ADRs:` line (that line only) |
| `docs/coordination-design.md` | 1 | the link at the end of the train paragraph of section 5 |
| `docs/openspec-flow.md` | 1 | the link in `### The delivery train` |
| `CONTRIBUTING.md` | 1 | the reference in the merge-during-review paragraph |
| `CHANGELOG.md` | 1 | `ADR 0022 (accepted) amends ...` in the 0.37.0 entry |
| `plugins/openspec/hooks/train-loop.mjs` | 1 | the header comment |
| `plugins/openspec/hooks/deliver-check.mjs` | 2 | two comments |
| `plugins/openspec/hooks/delivery-train.test.mjs` | 1 | the header comment |
| `openspec/changes/delivery-train/decisions.md` | 1 | the path of the listed ADR (the loop reads it: it must name an existing file) |
| `openspec/changes/delivery-train/proposal.md` | 7 | references |
| `openspec/changes/delivery-train/design.md` | 11 | references |
| `openspec/changes/delivery-train/tasks.md` | 3 | the phase 6 heading and task 6.1's two references |

Left on `0019` on purpose, do not touch them:

- `openspec/changes/delivery-train/approval.md` (the owner's words quote the question as it was asked: "approve the plan and
  ADR 0019") and `readiness.md` (the reviewer's record; its hash is the approval's). The `Accepted by:` line of the ADR says
  the number was 0019 until the base took it.
- `design.md` D-12 (the sentence "`0019 reviewed changes leave on a delivery train ...`" and "took the number 0019") and
  `tasks.md` 6.1 ("a sibling took 0019"): they state the rule, and 0019 is the number the rule is about.

## The release numbers (`release-merge.mjs` renumbers these on the merge of `origin/main`)

Files that carry them at this commit, all for the numbers 0.34.0 / 0.14.1 / 0.38.0:

| File | What carries the number |
|---|---|
| `plugins/openspec/.claude-plugin/plugin.json` | `"version": "0.34.0"` |
| `plugins/core/.claude-plugin/plugin.json` | `"version": "0.14.1"` |
| `.claude-plugin/marketplace.json` | `metadata.version` `0.38.0`; the `devkit-core` entry `0.14.1`; the `devkit-openspec` entry `0.34.0` |
| `CHANGELOG.md` | the heading `## 0.38.0 — delivery train`; the text `**devkit-openspec** 0.34.0`, `**devkit-core** 0.14.1` and ``pins `v0.34.0` `` in that entry |
| `docs/openspec-flow.md` | the CI pin: three lines hold `v0.34.0` (the comment `pinned to the commit of v0.34.0`, the `<commit sha of v0.34.0>` URL, and the sentence "Pin the commit sha of the release tag (`v0.34.0` above)" with the `gh api .../tags/v0.34.0` command) |
| `docs/catalog.md` | no version; regenerated by `python3 scripts/gen-catalog.py` (the `devkit` skill description changed) |

After the merge of `origin/main` these files conflict with `main`'s 0.33.0 / 0.14.0 / 0.37.0 numbers (0.32.0 / 0.13.3 / 0.36.1 at the first merge; this branch is cut
from 0.29.0 / 0.13.1 / 0.33.0). At the second merge `release-merge.mjs --base main --json` aborted on code conflicts
(`change-loop.mjs`, `conduct-check.mjs`, the README) and the release was renumbered by hand with the same rule. `release-merge.mjs --base main` resolves release files, the pin and the CHANGELOG by rule; the
numbers it must give are the next ones above whatever `main` holds then. Check afterwards: `python3 scripts/gen-catalog.py
--check`; `git grep -c <previous tag>` in `docs/openspec-flow.md` prints nothing; the pin test of `deliver-check.test.mjs`
(`the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version ...`) and `change-loop docs: the design
records the answers` pass (they read the manifest's version).
