# Tasks

Change: `design-open-points` · Date: 2026-11-19 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every text to write is given below as T-1 to
T-21; the implementer copies it as is and makes no wording choice. Line numbers are those of the
base (`e1d96e9`); each "old" text is unique in its file unless the task says which occurrence.

Every gate is one backticked command, run as written: each `&&` part runs on its own and
`pr-verifier` copies it verbatim, so no part holds a `|` or a backtick (a backticked word is matched
with `.` in a `grep -E` pattern). On the base the 21 parts of gate 1.5 that look for a new text,
or for the absence of an answered one, fail (checked in planning on a copy with T-1 to T-21
applied, where all of them pass). The other parts pass on the base too and guard what must not
break: the filtered tests (24 on the base), `check.py`, `gen-catalog.py --check`, `openspec
validate`, the session report, the four greps that keep the still-open points, the ADR 0010 status
and the count of 11 ticked roadmap lines.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `design-answers-recorded` | 1.1, 1.5 |
| AC-2 | `adr-and-roadmap-agree` | 1.2, 1.3, 1.4, 1.5 |
| AC-3 | `no-behaviour-change` | 1.5, 2.1 |

## 1. The answers in the documents (AC-1, AC-2, AC-3)

- [x] 1.1 In `docs/coordination-design.md` apply T-1 to T-15 below, each replacing its old text
  exactly; no other line changes. Verify: `python3 scripts/check.py` green and the
  `docs/coordination-design.md` parts of gate 1.5 pass. (AC-1)
- [x] 1.2 In `docs/adr/0010-openspec-as-the-harness.md` insert T-16 as the first paragraph under
  `## Context`, followed by one blank line; the status line, the Decision, the Consequences and
  every other line stay. Verify: `grep -qx -- "- Status: accepted"` on the file, and the filtered
  run of gate 1.5 passes the test "ADR 0010 is accepted, supersedes ADR 0001 and ADR 0007, and the
  config names it". (AC-2)
- [x] 1.3 In `openspec/roadmap.md` apply T-17 to T-21; no ticked line and no line of rounds 14, 15,
  16, 17, 19, 22, 23, 24, 25 or 26 changes. Verify: `git diff origin/main -- openspec/roadmap.md`
  shows exactly four changed lines and the added round 27, and
  `node plugins/openspec/hooks/guard.mjs session <<< "{}"` still reports `Round 14: the script and
  the checker (0/1 done)`. (AC-2)
- [x] 1.4 Truthfulness sweep, no edit expected: run
  `git grep -n -e "proposed, not decided" -e "names changes (open)" -e "names are examples and are not confirmed" -e "assumes it is read-only" -e "as the request, read-only" -- . ":!openspec/changes"`
  and confirm the only lines it prints are `docs/adr/0010-openspec-as-the-harness.md:72` and
  `:168` (answered by the T-16 Note; their line numbers move down by the Note's length). Any other
  line is a sentence this plan missed: stop and report it, do not reword it. (AC-2)
- [x] 1.5 Gate: `node --test --test-name-pattern="^ADR 00" --test-name-pattern="^README" --test-name-pattern="^docs sweep" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs" --test-name-pattern="^the hook docs" --test-name-pattern="^review round: text" --test-name-pattern="^release-rebase pin: the real" --test-name-pattern="^config.yaml rules" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate design-open-points --strict && node plugins/openspec/hooks/guard.mjs session <<< "{}" > "${TMPDIR:-/tmp}/design-open-points-session.txt" && grep -qF "Roadmap: Round 14: the script and the checker (0/1 done)" "${TMPDIR:-/tmp}/design-open-points-session.txt" && ! grep -nF -e "names are examples and are not confirmed" -e "Whether devkit writes back to Jira" -e "(proposed and open)" -e "**Names (open).**" -e "A lean pull-request template (open)" -e "A one-off feature entering a roadmap (open)" -e "- The command names of" -e "- The role names, and the clash" -e "- Holding the start of a change while the machine is loaded" -e "- How a small one-off feature enters" -e "- The lean pull-request template (section 4)." docs/coordination-design.md && ! grep -nE -e "the name .manager. is proposed" -e "the name .tech lead. is proposed" docs/coordination-design.md && grep -qF "the names stay as proposed" docs/coordination-design.md && grep -qF "the name decided by the assistant on the owner's delegation, 2026-11-19" docs/coordination-design.md && grep -qF "so every driver uses the same role names" docs/coordination-design.md && grep -qF "coordinator holds the start of a new change while the machine is loaded" docs/coordination-design.md && grep -qF "writes back (a comment with the pull request link, a status change) only when the developer asks" docs/coordination-design.md && grep -qF "optional way to produce a roadmap, never a prerequisite" docs/coordination-design.md && grep -qF "It is a debt item on" docs/coordination-design.md && grep -qF "it is settled in the grill of round 17" docs/coordination-design.md && grep -qF "The kit's planning role is renamed from" docs/coordination-design.md && grep -qF "proved together, in one live test session" docs/coordination-design.md && grep -qF -e "- How the roadmap coordinator measures load" docs/coordination-design.md && grep -qF -e "- What to do when the task branch conflicts with" docs/coordination-design.md && grep -qF -e "- Which rules of ADR 0007 the change coordinator keeps" docs/coordination-design.md && grep -qF -e "- The header's field names (section 8)." docs/coordination-design.md && grep -qF -e "- Whether CompozyOS can choose the role at each turn (section 10)." docs/coordination-design.md && grep -qx -- "- Status: accepted" docs/adr/0010-openspec-as-the-harness.md && grep -qF "Note (design-open-points, 2026-11-19)" docs/adr/0010-openspec-as-the-harness.md && grep -qx -- "## Round 27: debts" openspec/roadmap.md && grep -qE "^- \[ \] lean-pr-template " openspec/roadmap.md && grep -qF "holds a new start while the machine is loaded" openspec/roadmap.md && grep -qF "only when the developer asks" openspec/roadmap.md && ! grep -qF "as the request, read-only," openspec/roadmap.md && grep -qE "renamed from .tech-lead. to .planner." openspec/roadmap.md && test "$(grep -c '^- \[x\] ' openspec/roadmap.md)" = 11 && test "$(grep -c '^- \[ \] ' openspec/roadmap.md)" = 14` green; covers AC-1, AC-2, AC-3.

## 2. Regression gate (AC-3)

Nothing is edited in this phase. A red part sends its fix back to phase 1, whose gate runs again.

- [x] 2.1 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && git diff --quiet origin/main -- plugins .claude-plugin .compozy CHANGELOG.md docs/catalog.md && test -z "$(git ls-files --others --exclude-standard -- plugins .claude-plugin .compozy)"` green, run once as a background Bash (about 8.5 minutes; 671 tests on the base); record the counts (tests, pass, fail 0) for `pr-verifier` and the reviewers, so nobody runs it again; covers AC-3.

## Texts

### `docs/coordination-design.md`

**T-1** (line 11). Old: `- **decided**: the owner said it.`
New:

```markdown
- **decided**: the owner said it, or the owner delegated it and the item names who decided.
```

**T-2** (insert after line 13, `- **open**: nobody decided it yet.`, as a new paragraph with one
blank line before and after):

```markdown
On 2026-11-19, after this page first shipped, the owner answered most of its open points; the
change `design-open-points` recorded the answers, and each answered item says who decided it and
when.
```

**T-3** (line 32). Old:

```text
**The commands (proposed; the names are examples and are not confirmed).** One `/devkit` command with
```

New:

```markdown
**The commands (decided by the owner on 2026-11-19: the names stay as proposed).** One `/devkit` command with
```

**T-4** (lines 54-55). Old: the two lines from `**Writing back to Jira (open).**` to
`assumes it is read-only.` New:

```markdown
**Writing back to Jira (decided by the owner on 2026-11-19).** devkit reads Jira by default and
writes back (a comment with the pull request link, a status change) only when the developer asks:
the developer decides.
```

**T-5** (line 59). Old:

```text
**The roadmap coordinator (decided; the name `manager` is proposed).** To be built in round 18. It
```

New:

```markdown
**The roadmap coordinator, `manager` (decided; the name decided by the assistant on the owner's delegation, 2026-11-19).** To be built in round 18. It
```

**T-6** (lines 67-69). Old: the three lines from `**Holding a start while the machine is loaded
(proposed and open).**` to `is measured, is open.` New:

```markdown
**Holding a start while the machine is loaded (decided by the owner on 2026-11-19).** The roadmap
coordinator holds the start of a new change while the machine is loaded, and what is under way
finishes first. How it measures load is open.
```

**T-7** (line 71). Old:

```text
**The change coordinator (decided; the name `tech lead` is proposed).** To be built in round 15. It
```

New:

```markdown
**The change coordinator, `tech-lead` (decided; the name decided by the assistant on the owner's delegation, 2026-11-19).** To be built in round 15. It
```

**T-8** (lines 79-80). Old: the two lines from `**Names (open).**` to `which one is open.` New:

```markdown
**Names (decided by the assistant on the owner's delegation, 2026-11-19).** The owner suggested
team-like names, said naming is not important, and left the choice to the assistant, noting that
the CompozyOS kit's `tech-lead` role is a planner today. `manager` is the roadmap coordinator and
`tech-lead` the change coordinator; the CompozyOS kit's present `tech-lead` role, which plans, is
renamed `planner`, so every driver uses the same role names: `manager`, `tech-lead`, `planner`,
`dev`, `qa` and `design`. The rename is to be built in round 21 (CompozyOS driver); until then the
kit's planner keeps the name `tech-lead`.
```

**T-9** (lines 154-156). Old: the three lines from `- **A lean pull-request template (open)**`
to `evidence path.` New:

```markdown
- **A lean pull-request template (decided by the owner on 2026-11-19: a debt for later)**: an idea
  of the owner's, with less text. It is a debt item on `openspec/roadmap.md` (round 27), and the
  owner researches models of a template first. Today `deliver-check` requires the PR body to name
  the change, every acceptance criterion and the evidence path, so that rule changes with the
  template.
```

**T-10** (line 176). Old: `not decided.` (the line right after the one opening with `**The conflict with`)
New:

```markdown
not decided; it is settled in the grill of round 17 (delivery models).
```

**T-11** (lines 214-215). Old: the two lines from `**A one-off feature entering a roadmap (open).**`
to `roadmap is not decided.` New:

```markdown
**The roadmap and small work (decided by the owner on 2026-11-19).** The four phases are one
optional way to produce a roadmap, never a prerequisite. A developer who knows what they want
writes `openspec/roadmap.md` directly, and a one-off feature goes straight onto it.
```

**T-12** (lines 334-336). Old: the three lines from `- **CompozyOS (round 21).**` to
`the role at each turn (open).` New:

```markdown
- **CompozyOS (round 21).** One short, generic loop (ask, run the role, check) in place of the
  619-line flow written apart. `/devkit` starts the run. The kit's planning role is renamed from
  `tech-lead` to `planner` (section 2). Not verified: whether CompozyOS can choose the role at each
  turn (open).
```

**T-13** (line 358). Old:

```text
| 9 | The CompozyOS driver | 21 | `compozy-driver` | `change-coordinator` |
```

New:

```markdown
| 9 | The CompozyOS driver, and the kit's planning role renamed `planner` | 21 | `compozy-driver` | `change-coordinator` |
```

**T-14** (section 13). Line 393, the `All proposed.` right under `## 13. Still to prove live, and
risks (D-13)` (not the one of line 327), becomes:

```markdown
All proposed, except how the points below are proved (decided).
```

and after line 401 (`- Grouped sessions work as a view.`) insert, with one blank line before:

```markdown
The points still to prove are proved together, in one live test session, when their round comes
(decided by the owner on 2026-11-19: testing several things at once saves time).
```

**T-15** (lines 414-422). Old: from `Every item nobody has decided yet:` through
`- The lean pull-request template (section 4).` New (the items after it, from
`- Which rules of ADR 0007`, stay as they are):

```markdown
Every item nobody has decided yet. The command names, the role names, holding a start while the
machine is loaded, writing back to Jira, small work and the roadmap, and the lean pull-request
template were answered on 2026-11-19 and are recorded in their sections.

- How the roadmap coordinator measures load before it holds a start (section 2).
- What to do when the task branch conflicts with `develop`; settled in the grill of round 17
  (section 5).
```

### `docs/adr/0010-openspec-as-the-harness.md`

**T-16** (the first paragraph under `## Context`, before `ADR 0001 let devkit coordinate`):

```markdown
Note (design-open-points, 2026-11-19): the owner answered points this ADR left open, and
[docs/coordination-design.md](../coordination-design.md) records each answer with who decided it.
The names are decided, by the assistant on the owner's delegation: `manager` is the roadmap
coordinator and `tech-lead` the change coordinator, and the CompozyOS kit's present `tech-lead`
role, which plans, is renamed `planner` in round 21 (compozy-driver). This answers the last
sentence of decision 2 and the last sentence of the Negative consequences, which call the names
proposed and open. The roadmap coordinator holds the start of a new change while the machine is
loaded, and what is under way finishes first; the four design phases are one optional way to write
the roadmap, never a prerequisite. Decisions 1 to 8 are otherwise unchanged.
```

### `openspec/roadmap.md`

The roadmap lines below are shown with a leading `(line) ` marker, which is not part of the text to write:
`deliver-check` reads any line of this file that starts with a checkbox as a task, fenced or not.

**T-17** (line 36). Old sentence, the paragraph's last:

```text
Rounds 25 and 26 are follow-ups from the `orchestrator-replan` retro, not steps of the build order.
```

New sentence (the rest of the paragraph stays):

```markdown
Rounds 25 and 26 are follow-ups from the `orchestrator-replan` retro, and round 27 holds debts the owner recorded on 2026-11-19 (`design-open-points`); none is a step of the build order.
```

**T-18** (line 51) becomes:

```markdown
(line) - [ ] roadmap-coordinator (after: change-coordinator) — the roadmap coordinator starts every change whose `after:` dependencies are archived, several at once up to the number the owner sets per run, and holds a new start while the machine is loaded so that what is under way finishes first, with `/devkit roadmap` and `/devkit status` (D-1, D-2)
```

**T-19** (line 57) becomes:

```markdown
(line) - [ ] jira-entry (after: change-coordinator) — `/devkit change <key or link>` reads a Jira task as the request and writes back to it (a comment with the pull request link, a status change) only when the developer asks, and the grill asks only what the task does not answer (D-1)
```

**T-20** (line 60) becomes:

```markdown
(line) - [ ] compozy-driver (after: change-coordinator) — CompozyOS runs the same short loop (ask the checker, run the role, check the gate) in place of the twelve-stage loop, `/devkit` starts the run when the project's driver is CompozyOS, and the kit's planning role is renamed from `tech-lead` to `planner` (D-2, D-3, D-10)
```

**T-21** (append at the end of the file, after round 26, with one blank line before):

```markdown
## Round 27: debts
(line) - [ ] lean-pr-template — a lean pull-request template with less text, built once the owner has researched models; `deliver-check`'s rule that the PR body names the change, every acceptance criterion and the evidence path changes with it (D-4; design-open-points)
```

## Workflow follow-up

- After the merge, `ship-change` archives the change; `openspec/roadmap.md` lists no line for it, so
  there is no tick.
- The next round's plan (`flow-script-checker`, round 14) reads the answered design; the rename to
  `planner` is built in round 21 (`compozy-driver`) and the conflict with `develop` is grilled in
  round 17 (`delivery-models`).
