# Local run (AC-1 to AC-5, task 5.2)

Change: `compozy-driver` · Date: 2026-11-23 · Run by the conducting session; the owner answered the
grill in CompozyOS.

Project: the scratch `devkit-proof` of task 5.1 (git repository with no remote, `devkit.driver:
compozy`, the branch's packs from the temporary `devkit-proof` marketplace, the kit installed, the
folder registered as the CompozyOS workspace `devkit-proof`). The change is `add-mul`: "add a
`mul(a, b)` function next to `add` in `src/add.mjs`, with a test", taken from the test roadmap of
`roadmap.md`. The script was `devkit-lite` (the coordinator's rule for a small change).

**What this record does not prove, stated first.** The run used the `devkit-lite` script, which has
no plan-approval stage and lists no decision record, so **the plan approval and the
`accept-decisions` step were not exercised live** (the tests of design D-3, D-4 and D-5 cover them);
they move to the dogfood line of task 6.4 with the retro answers and the mock-up approval. No
blocking finding was seeded: the first review round raised an important finding, which the round
rejected, and a second round would have cost another bench of agents. The run ended at the review
round's failed verdict and was cancelled there; it did not go on to the pull request, which needs a
remote.

## AC-1: the start

The run was started twice. First by `/devkit roadmap 2` (see `roadmap.md`): the roadmap run started
`devkit-change` runs for `add-sub` and `add-mul`. After the defects below were fixed, the
`add-mul` change was started again with the call the skill makes for a change that exists:

```
node <devkit-openspec>/hooks/change-loop.mjs compozy-start add-mul --lang pt-BR <<'DEVKIT_ARGS'
DEVKIT_ARGS
{
  "version": 1,
  "mode": "compozy-started",
  "change": "add-mul",
  "runId": "looprun-804867f10c74ee0c",
  ...
```

The call prints one reply and runs nothing else; Claude Code asks no question of the change. A
`/devkit change <id>` for a change with no worktree yet was exercised through the roadmap's start of
the same loop (the first generation's `open` turn created the change and its worktree).

## AC-3: the owner answers in CompozyOS

Run `looprun-a4bc9068808707a9` (the first, started by the roadmap). Every request below reached the
owner as a CompozyOS human request, which the owner answered on the run's page of the CompozyOS
web UI (`Needs you`, a text box and `Submit answer`); `compozy loop requests --state resolved`:

| Node | Gen | Question (summary) | Opened | Answered |
|---|---|---|---|---|
| `ask_grill` | 2 | what `mul` does with a non-number: follow `add`, or throw? | 15:15:48Z | 17:07:38Z |
| `ask_grill` | 3 | where the test goes, and what it covers | 17:13:14Z | 18:27:10Z |
| `ask_grill` | 4 | the same two choices, to close the test | 18:33:17Z | 18:38:05Z |
| `ask_owner` | 7 to 10 | "this project delivers by hand" (see the first defect below) | | the owner answered each; the project then got `ship: pr` |
| `ask_blocked` | 12 | the phase 1 gate reported red (see the second defect) | 20:11:32Z | 21:33:19Z, **by the conducting session**: `retry`, after the coordinating session asked it to keep the run going while the owner was away |

The grill's questions came one at a time, in the person's language; after each answer the node
`record_grill` passed and the next generation's `read` returned `grill` again until the requirements
were settled (`requirements.md` of the change: `result=passed attempt=1`). The three grill answers
are the owner's own words as typed in CompozyOS; the `ask_blocked` answer is not.

## AC-2: the short loop picks the role

Per generation, from `compozy loop nodes --run <id> --all -o json` and each session's history:
the `read` node is always the agent `change-coordinator`; its kind is the checker's view; the
agent of `run_role` is the one the checker named.


Run looprun-a4bc9068808707a9

| Gen | `read` kind | `read` agent | step (agent / node) |
|---|---|---|---|
| 1 | open | change-coordinator | `run_role` as `change-coordinator` |
| 2 | grill | change-coordinator | `run_role` as `change-coordinator` |
| 3 | grill | change-coordinator | `run_role` as `change-coordinator` |
| 4 | grill | change-coordinator | `run_role` as `change-coordinator` |
| 5 | grill | change-coordinator | `run_role` as `change-coordinator` |
| 6 | agent | change-coordinator | `run_role` as `change-planner` |
| 7 | owner | change-coordinator | `ask_owner` (succeeded) |
| 8 | owner | change-coordinator | `ask_owner` (succeeded) |
| 9 | owner | change-coordinator | `ask_owner` (succeeded) |
| 10 | owner | change-coordinator | `ask_owner` (succeeded) |
| 11 | agent | change-coordinator | `run_role` as `tdd-implementer` |
| 12 | gate | change-coordinator | `phase_gate` (succeeded) |
| 13 | gate | change-coordinator | `phase_gate` (succeeded) |

Run looprun-804867f10c74ee0c

| Gen | `read` kind | `read` agent | step (agent / node) |
|---|---|---|---|
| 1 | agent | change-coordinator | `run_role` as `tdd-implementer` |
| 2 | gate | change-coordinator | `phase_gate` (succeeded) |
| 3 | agent | change-coordinator | `run_role` as `commit-and-pr` |
| 4 | agent | change-coordinator | `run_role` as `test-runner` |
| 5 | agent | change-coordinator | `run_role` as `pr-verifier` |
| 6 | review | change-coordinator | `run_review` (succeeded) |
| 7 | agent | change-coordinator | `run_role` as `tdd-implementer` |
| 8 | agent | change-coordinator | `run_role` as `tdd-implementer` |
| 9 | blocked | change-coordinator | `ask_blocked` (canceled) |

Run `looprun-804867f10c74ee0c` shows the order the checker gave after the plan: implementation,
the phase gate, the commit (`commit-and-pr`), the unit tests (`test-runner`), the evidence
(`pr-verifier`), the review round, and the implementer again to answer the review. No role was
named by a translation table: each agent is the checker's name for the stage.

## AC-4: no Claude Code session after the start

From the start of `looprun-804867f10c74ee0c` to its review verdict (21:47Z to 22:02Z) every step
ran as a CompozyOS session or script: the `read` seats, the roles above and the review child run.
No Claude Code session held a step, asked a question or wrote a file of the change; the conducting
session only started the run and later read it. The run reached `review.md` (stage `review`,
`result=failed attempt=1`).

## AC-5: the review round

The `run_review` node started the child run `looprun-6c8bf54b2816ed10` (`devkit-review`, inputs
`change_id`, `lang`, `root`; parent `looprun-804867f10c74ee0c`). Its nodes, from `compozy loop nodes
--run looprun-6c8bf54b2816ed10 --all -o json`, with the agent of each session:

| Node | Item | State | Started | Agent |
|---|---|---|---|---|
| `bench` | | succeeded | 21:53:21.097 | change-coordinator |
| `review_lane` | 0 | succeeded | 21:54:59.724 | spec-reviewer |
| `review_lane` | 1 | succeeded | 21:54:59.724 | code-quality-reviewer |
| `review_lane` | 2 | succeeded | 21:54:59.724 | test-coverage-reviewer |
| `verify_plan` | | succeeded | 21:55:57.684 | change-coordinator |
| `verify_lane` | 0 | succeeded | 21:56:53.878 | finding-verifier |
| `verify_lane` | 1 | succeeded | 21:56:53.878 | finding-verifier |
| `verify_lane` | 2 | succeeded | 21:56:53.878 | finding-verifier |
| `outcomes` | | succeeded | 21:57:35.771 | change-coordinator |
| `write_lane` | 0 to 2 | succeeded | 21:58:28.854 | the three reviewers again |
| `consolidate` | | succeeded | 21:59:10.127 | change-coordinator |

The three reviewers started at the same instant, each in its own session and agent; the one
important finding (the spec reviewer's) got three `finding-verifier` lanes started together; the
three reviewers then wrote their own files `reviews/<reviewer>.md`. `review.md` of the change:

```
<!-- devkit-stage review result=failed attempt=1 commit=c3ec5f2... -->
| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 |
Consensus: FAIL (round 1/2)
- spec-reviewer [important] openspec/config.yaml:16-19: scope creep ... (the project's own ship setting, which the
  conducting session had added to the scratch project's branch)
```

The round rejected while a finding stayed open, as the script's rule says. After it the checker named
the implementer; two attempts changed nothing in the code (the finding was about the scratch
project's configuration, not the code), and the third turn's view was `blocked` with the checker's
no-progress reason, routed to `ask_blocked`. The run was cancelled there.

## Defects the live run found

Each was fixed in this change, with a test, before the run above went through:

1. Task 4.9: CompozyOS 0.6.2 refuses an agent whose description is longer than 280 characters; 19 of
   the 20 generated agents were, so the first node could not bind. The generator shortens the
   description at a sentence or word boundary.
2. Task 4.11: the record steps (`run-gate`, `run-step`, the answers) recomputed the checker's next
   action with the key `confirm` had just recorded, so the no-progress guard reported a green gate as
   red before it ran. They now compute the view without the earlier key.
3. Task 4.13: an `ask` node with more than one predecessor opens its request as soon as `read`
   succeeds, even when it is not taken. The change loop now has one ask per source, and a test pins
   that every ask has exactly one predecessor.
4. A setup error of the proof, not of the kit: the scratch project's configuration had no `ship:`
   setting, so its mode was `plan` (the project delivers by hand) and the checker's `owner` end
   asked the owner four times. The project then got `ship: pr`.
