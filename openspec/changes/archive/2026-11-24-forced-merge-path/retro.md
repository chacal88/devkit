<!-- devkit-stage retro result=passed attempt=1 commit=18c9bfb37b75b5227036834ddef85604be069ff4 -->
## Retro: forced-merge-path

1. Went wrong: main moved many times under the change (trains 7 to 12), and each merge of main staled the evidence and all five reviews and renumbered the release (0.39.0, 0.45.0, 0.46.0 on the branch; the train shipped it as 0.47.0, tagged `v0.47.0` at `be0c35d`). Several of those merges were taken for conflicts in release files only, which a train project leaves to the train; the desktop app's Auto-fix kept asking to merge main for them after the push, and train 12 left without the change. One merge of main also showed a duplicated rule drifting: `gatesAtHead` called `verdictAllowed` without the `open` flag main had added to `readReviews`, caught by the architecture-reviewer and fixed in `0934b63` by one shared parser (`findingsOfText`). Review round 2 failed (a spec scenario for the stricter verdict rule, two compare-path tests); the review-change skill allows no automatic third round, and when the owner approved one, `review-round` refused `round: 3`, so it ran as round 1 of a new cycle with a note in `review.md`. Evidence attempt 6 ran gate 1.9 only as test-name subsets, so `deliver-check` kept item 1 open ("no passing row") and the take was redone. Environment: a `TMPDIR` whose path held the word "force" turned `delivery-train P9 N2` red, because the test matches `/force/` against a JSON that holds the worktree path; the default macOS `TMPDIR` also makes socket paths too long for the CompozyOS tests, so every run moved to one short private folder. The `claude -p` login of the default config directory expired mid-evidence and blocked four of five real retro runs until the owner renewed it. The live replay drifted as later archive pull requests merged, until the read-only `gh` shim got a cut at the pull request number of the owner's merge. Two stage-1 reviewer answers with a non-empty `notRead` were refused and re-run. Gate 1.9's first attempt ended exit 1 under load about 33 with no failure line; the retry passed 655/655 and the cause was not found. Early merge-conflict hunks were resolved by the session with Python before the guard closed product files to it; after that only the tdd-implementer wrote product code and docs. Open from the change itself: the stack case names the stack's top pull request (proposal, "Also out of scope"), and the resume reply names the implementation stage while the loop is at the retro (evidence, observation 8).
2. Better next time: in a train project, merge the base only when the loop's `next` asks for it, and treat a conflict the train renumbers as no reason to merge. When the owner approves a further review round, run it as round 1 of a new cycle and say so in the notes, as the skill should state. Run each gate part as the one command `tasks.md` writes. Assert a forbidden flag per argument, never as a regex over a JSON that holds temporary paths. Probe the `claude -p` login once before a batch of real runs.
3. Remember: in a train project, a merge of the base you were not asked for costs the evidence and every review and buys nothing.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | In a train project, merges of main for release-only conflicts (and on Auto-fix's prompt) staled the evidence and five reviews several times; ship-change still says a conflict is reported `blocked: item 5`, which the train path no longer does | process-friction | doc-update | project |
| 2 | The review-change skill says what happens after a round-2 deadlock but not how an owner-approved further round runs, and `review-round` refuses round 3 | doc-gap | doc-update | project |
| 3 | `delivery-train P9 N2` matches `/force/` against a JSON holding the worktree path, so a temporary folder whose name holds "force" turns it red | bug-class | regression-gate | project |
| 4 | A gate part run as test-name subsets gives no passing row, and one evidence take was redone for it; the verifier brief does not say a part runs whole | process-friction | doc-update | project |
| 5 | Two open points of the change itself: the stack case names the top pull request, and the resume reply names the wrong stage at the retro | bug-class | followup | project |
| 6 | An expired `claude -p` login blocked four of five real runs mid-evidence | environment | memory-only | user |

## Proposed updates

### `plugins/openspec/skills/ship-change/SKILL.md` (process-friction)
In a train project a conflict with the base is the train's (`deliver-check` T5 goes on, it neither blocks nor updates), so the app host's text stops promising `blocked: item 5` there and says to merge the base only when `next` asks. A pack file changes, so devkit-openspec takes a patch release with its CHANGELOG line.
- before: - `app`: same single watch, but a red check afterwards is fixed in the same run (`fix-checks`, its commit, `verify`, scoped re-review, `push`, one more watch), within the stops above. When the run ends `in progress`, say that the app's Auto-fix wakes this session on a CI failure, merge conflict or review comment, and that the session then runs `ship-change` again. A merge conflict is reported `blocked: item 5`. Auto-fix does not wake on green checks, which is why one capped watch runs.
+ after: - `app`: same single watch, but a red check afterwards is fixed in the same run (`fix-checks`, its commit, `verify`, scoped re-review, `push`, one more watch), within the stops above. When the run ends `in progress`, say that the app's Auto-fix wakes this session on a CI failure, merge conflict or review comment, and that the session then runs `ship-change` again. A merge conflict is reported `blocked: item 5`, except in a project with a delivery train: there a conflict with the base is the train's to join and renumber, so the session merges the base only when `next` asks for it (`rejoin-train`, `rejoin-archive`), never because Auto-fix reported the conflict. Auto-fix does not wake on green checks, which is why one capped watch runs.
- Answer: approved
- Applied: yes

### `plugins/core/skills/review-change/SKILL.md` (doc-gap)
Say how an owner-approved round after a round-2 deadlock runs, since `review-round` accepts only rounds 1 and 2. A pack file changes, so devkit-core takes a patch release with its CHANGELOG line.
- before: - No convergence after 2 rounds → stop and escalate to the human with the disputed points. No automatic third round.
+ after: - No convergence after 2 rounds → stop and escalate to the human with the disputed points. No automatic third round. When the owner approves one more round in their own message, run it as round 1 of a new cycle (`review-round` accepts only rounds 1 and 2), summoning the reviewers that rejected and those gone stale, and write in the section's notes that it is the owner's further round, quoting the owner's words.
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/delivery-train.test.mjs` (bug-class)
Invariant: the `push-train` step never force-pushes (layer: `train-loop.mjs`'s session actions; suite: `delivery-train.test.mjs`). The assertion reads each argument of the command instead of a regex over the whole detail, which holds the worktree path, so a temporary folder named with "force" no longer turns it red; the command itself stays pinned by the `deepEqual` above it. A pack file changes, so devkit-openspec takes a patch release with its CHANGELOG line.
- before:   assert.doesNotMatch(JSON.stringify(r.action.detail), /force|-f\b/);
+ after:   assert.ok(!r.action.detail.command.some((a) => /^(-f|--force(-with-lease)?)$/.test(a)), 'a plain push, never a force push');
- Answer: approved
- Applied: yes

### `plugins/core/agents/pr-verifier.md`, `plugins/compozy/skills/compozy-setup/templates/agents/pr-verifier/AGENT.md`, `.compozy/agents/pr-verifier/AGENT.md` (process-friction)
A gate part runs whole, as the one command `tasks.md` writes; subsets of its test files or test names give no row for it (evidence attempt 6 of this change was redone for that). A pack file changes, so devkit-core takes a patch release with its CHANGELOG line.
- before:    - A `### Gates` table with one row per command named by a gate task in `tasks.md` (split on `&&`: one row per part): `| <gate> | \`<command>\` | pass: <summary> |`, or `fail: <summary>`. A part the train proves has the `train:` row above instead. The command is in backticks and the last cell starts with `pass` or `fail`. The command cell holds the part exactly as `tasks.md` writes it, never abbreviated (no `$VAR` standing for a long path): `deliver-check` matches the part's text inside backticks.
+ after:    - A `### Gates` table with one row per command named by a gate task in `tasks.md` (split on `&&`: one row per part): `| <gate> | \`<command>\` | pass: <summary> |`, or `fail: <summary>`. A part the train proves has the `train:` row above instead. The command is in backticks and the last cell starts with `pass` or `fail`. The command cell holds the part exactly as `tasks.md` writes it, never abbreviated (no `$VAR` standing for a long path): `deliver-check` matches the part's text inside backticks. Run each part whole, as that one command: runs of some of its test files or of a `--test-name-pattern` subset are no row for it, even when every subset passes.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
Add the follow-up the proposal promised for the stack case, with the wrong stage name of the resume reply that the evidence recorded.
- before: ## Round 28m: redacted real-run proofs
+ after: ## Round 28o: follow-ups of forced-merge-path
+ after: - [ ] forced-merge-path-followups (after: forced-merge-path) — from the forced-merge-path retro: when several merged pull requests change a change's folder (a stack), the lookup from the default branch and from another change's checkout names the newest merged one, so the retro title and the release tag may name the stack's top (delivery-train, #91 against #93); prefer the pull request whose head branch is the change id. And `change-loop.mjs start`'s `resumed` reply names the implementation stage while `next` answers `retro` for a forced merge (forced-merge-path evidence, observation 8); name the stage the loop is at.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Before a batch of real `claude -p` runs, probe the login of the config directory with one short run; an expired login blocks every run until the owner renews it.
- Answer: approved
- Applied: yes
