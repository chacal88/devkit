Commit: b5d4d191b8f535ac1e8207b41ce2c1f6597455ab

# Evidence

Verified at HEAD b5d4d19 (one commit on `origin/main` e1d96e9) with a clean working tree before this file was written. Proof is read from the delivered files, not from task ticks. Every gate part ran as its own command, in the order `deliver-check` lists them (`items[0].details.missingGates`), and its exit code decided; no output was piped, trimmed or masked. The suite ran once, as its own command, output to a file. Part 35 of gate 2.1 (the `git diff --quiet` part, row 2 of the three) ran after the suite instead of before it; it is read-only, so the order changes nothing. Every number below was counted at this commit.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.5 | `node --test --test-name-pattern="^ADR 00" --test-name-pattern="^README" --test-name-pattern="^docs sweep" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs" --test-name-pattern="^the hook docs" --test-name-pattern="^review round: text" --test-name-pattern="^release-rebase pin: the real" --test-name-pattern="^config.yaml rules" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 24 tests, 24 pass, 0 fail |
| 1.5 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 1.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 1.5 | `openspec validate design-open-points --strict` | pass: exit 0, change 'design-open-points' is valid (--strict) |
| 1.5 | `node plugins/openspec/hooks/guard.mjs session <<< "{}" > "${TMPDIR:-/tmp}/design-open-points-session.txt"` | pass: exit 0, report written |
| 1.5 | `grep -qF "Roadmap: Round 14: the script and the checker (0/1 done)" "${TMPDIR:-/tmp}/design-open-points-session.txt"` | pass: exit 0, report names Round 14 (0/1 done) |
| 1.5 | `! grep -nF -e "names are examples and are not confirmed" -e "Whether devkit writes back to Jira" -e "(proposed and open)" -e "**Names (open).**" -e "A lean pull-request template (open)" -e "A one-off feature entering a roadmap (open)" -e "- The command names of" -e "- The role names, and the clash" -e "- Holding the start of a change while the machine is loaded" -e "- How a small one-off feature enters" -e "- The lean pull-request template (section 4)." docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `! grep -nE -e "the name .manager. is proposed" -e "the name .tech lead. is proposed" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "the names stay as proposed" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "the name decided by the assistant on the owner's delegation, 2026-11-19" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "so every driver uses the same role names" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "coordinator holds the start of a new change while the machine is loaded" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "writes back (a comment with the pull request link, a status change) only when the developer asks" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "optional way to produce a roadmap, never a prerequisite" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "It is a debt item on" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "it is settled in the grill of round 17" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "The kit's planning role is renamed from" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF "proved together, in one live test session" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF -e "- How the roadmap coordinator measures load" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF -e "- What to do when the task branch conflicts with" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF -e "- Which rules of ADR 0007 the change coordinator keeps" docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF -e "- The header's field names (section 8)." docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qF -e "- Whether CompozyOS can choose the role at each turn (section 10)." docs/coordination-design.md` | pass: exit 0 |
| 1.5 | `grep -qx -- "- Status: accepted" docs/adr/0010-openspec-as-the-harness.md` | pass: exit 0 |
| 1.5 | `grep -qF "Note (design-open-points, 2026-11-19)" docs/adr/0010-openspec-as-the-harness.md` | pass: exit 0 |
| 1.5 | `grep -qx -- "## Round 27: debts" openspec/roadmap.md` | pass: exit 0 |
| 1.5 | `grep -qE "^- \[ \] lean-pr-template " openspec/roadmap.md` | pass: exit 0 |
| 1.5 | `grep -qF "holds a new start while the machine is loaded" openspec/roadmap.md` | pass: exit 0 |
| 1.5 | `grep -qF "only when the developer asks" openspec/roadmap.md` | pass: exit 0 |
| 1.5 | `! grep -qF "as the request, read-only," openspec/roadmap.md` | pass: exit 0 |
| 1.5 | `grep -qE "renamed from .tech-lead. to .planner." openspec/roadmap.md` | pass: exit 0 |
| 1.5 | `test "$(grep -c '^- \[x\] ' openspec/roadmap.md)" = 11` | pass: exit 0, 11 ticked lines |
| 1.5 | `test "$(grep -c '^- \[ \] ' openspec/roadmap.md)" = 14` | pass: exit 0, 14 unticked lines |
| 2.1 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 671 tests, 671 pass, 0 fail, 0 cancelled, 0 skipped |
| 2.1 | `git diff --quiet origin/main -- plugins .claude-plugin .compozy CHANGELOG.md docs/catalog.md` | pass: exit 0, no diff against origin/main in plugins, .claude-plugin, .compozy, CHANGELOG.md, docs/catalog.md |
| 2.1 | `test -z "$(git ls-files --others --exclude-standard -- plugins .claude-plugin .compozy)"` | pass: exit 0, no untracked file under plugins, .claude-plugin, .compozy |

The suite totals read from its own output: `tests 671`, `suites 0`, `pass 671`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, 0 lines starting `not ok`.

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `design-answers-recorded`: the open-points list drops the answered points, keeps the others, and each answer reads decided with who and when | Read from `docs/coordination-design.md` at b5d4d19. The "Open points" list (line 429 heading, lines 431-433 intro) now holds 9 items: load measurement (section 2), the conflict with `develop` naming the grill of round 17 (section 5), ADR 0007's rules, the Workflow review path, the header's field names, the configuration's field names, CompozyOS choosing the role per turn, the script driver, and project setup. Left the list (the intro names them as answered on 2026-11-19): command names, role names, load hold, Jira write-back, small work and the roadmap, lean pull-request template. Decided in their sections: commands, line 36, "decided by the owner on 2026-11-19: the names stay as proposed"; Jira, line 58, decided by the owner on 2026-11-19, read by default and written back only when the developer asks; `manager`, line 64, and `tech-lead`, line 76, "the name decided by the assistant on the owner's delegation, 2026-11-19"; load hold, line 72, decided by the owner on 2026-11-19, "how it measures load is open"; names and the `planner` rename, line 84 (section 2), "decided by the assistant on the owner's delegation, 2026-11-19", rename placed in round 21; lean template, line 164, decided by the owner on 2026-11-19, debt item on the roadmap round 27; conflict with `develop`, line 187, still "(open)", "settled in the grill of round 17"; small work, line 226, decided by the owner on 2026-11-19; live proving, section 13, lines 417-418, "proved together, in one live test session ... decided by the owner on 2026-11-19". Round 21 is placed by section 10 (line 348, "CompozyOS (round 21)", the rename `tech-lead` to `planner`) and by section 11 (line 372, row 9, "the kit's planning role renamed `planner`", round 21). The 17 gate parts that grep these texts (the sixth to the twenty-second row of gate 1.5) exited 0. | pass |
| AC-2 | `adr-and-roadmap-agree`: ADR 0010 accepted with a Note, roadmap round 27, round 14 still current, no sentence still calls the names proposed or Jira read-only | ADR 0010: line 3 is `- Status: accepted`; `## Context` is line 8 and the `Note (design-open-points, 2026-11-19)` paragraph starts at line 10, its first paragraph, 10 lines added and 0 removed (`git diff --stat`), so Decision text is untouched. The Note says the names are decided by the assistant on the owner's delegation (`manager`, `tech-lead`, `planner` in round 21), names "the last sentence of decision 2 and the last sentence of the Negative consequences" as the two sentences it answers, records the load hold and the optional four phases, and says decisions 1 to 8 are otherwise unchanged. Roadmap: `git diff origin/main -- openspec/roadmap.md` shows four reworded lines (the paragraph before round 14, now naming round 27, plus the lines of rounds 18, 20 and 21), one added heading `## Round 27: debts` and one added line `- [ ] lean-pr-template`; rounds 14 to 17, 19 and 22 to 26 do not appear in the diff. The prompt expected three reworded lines; four is the paragraph plus the three item lines, and the paragraph is named by the change's own plan. Session report (`guard.mjs session <<< "{}"`) line 14: `Roadmap: Round 14: the script and the checker (0/1 done)`. Counts in the roadmap: 11 ticked, 14 unticked lines. Sweep (outside `CHANGELOG.md`, `openspec/changes/archive/` and this change's folder) for "proposed", "not confirmed", "open" next to role or command names, "read-only", and every "Jira" hit: `docs/coordination-design.md:36` says the names stay as proposed, which is the owner's decision, not an open state; `:58` carries the on-request clause; `:41`, `:54`, `:371`, `:414`, `:432` and `:318` say Jira is read or a task source with no read-only claim; `:115` "The script names roles (proposed)" is about the script naming roles instead of Claude tool names, not the role names; `:321` "The header's field names (open)" is a point still open by design; `docs/adr/0010-openspec-as-the-harness.md:82` ("`manager` and `tech lead` are proposed, not decided") and `:178` ("one of the two names changes (open)") are the two sentences the Note answers, excluded by the criterion; the other "read-only" hits (agents, panel, hooks, `docs/openspec-flow.md`, `docs/adr/0006`, roadmap line 66 on panels) describe tools and panels, not Jira. No hit contradicts the decisions. | pass |
| AC-3 | `no-behaviour-change`: nothing that runs changes; the guard suite, `scripts/check.py`, `scripts/gen-catalog.py --check` and `openspec validate --strict` pass | `git diff --stat origin/main...HEAD` lists 6 files, 465 insertions and 33 deletions: `docs/adr/0010-openspec-as-the-harness.md` (10), `docs/coordination-design.md` (73), `openspec/roadmap.md` (11) and the change folder's `.openspec.yaml`, `proposal.md`, `tasks.md`. Nothing under `plugins/`, `.claude-plugin/` or `.compozy/` (`git diff --name-only origin/main...HEAD` for those paths prints 0 files), and `CHANGELOG.md` and `docs/catalog.md` are unchanged. Gates: the suite passed (671 of 671), `scripts/check.py` exit 0, `scripts/gen-catalog.py --check` exit 0, `openspec validate design-open-points --strict` exit 0, `git diff --quiet` of the pack paths exit 0, no untracked file there. | pass |

Outcome: verified. No defect found.
