Verdict: approved
Commit: 9c4fffed5a46c751787fcf1e08e410bcac3c70e4

## Coverage analysis — coordinator-loop-fixes, review round 3 (9eaef84..9c4fffe)

### Findings
- [important] plugins/openspec/hooks/conduct-check.mjs:64 — [5] The conduct-check side of conductor-task was untested: removing 'conductor-task' from MAIN would turn the row into the blocked 'unknown step conductor-task', and no test would fail. · fixed in f1acdfd7c0973d728b3f8075c470d01c6f8b4d5e
- [nit] plugins/openspec/hooks/guard.mjs:745 — [3] Tests pinned DECLARE_CALL only for the bare, quoted and cd-prefixed forms; `node --no-warnings <path>/change-loop.mjs declare` from a subagent got through. · fixed in 66f35536c6811681f247993690bf8813aba8dd3b
- [nit] plugins/openspec/hooks/change-loop.mjs:3263 — [3] `round = REVIEW_ROUNDS + authorizedRounds(dir, scope) + 1` is still tested only at round 3 (T38, T96, T143), so a hard-coded 3 would pass. Write in change-loop-declared.test.mjs after T111: a second declare at the deadlock after round 3 records round 4 and its reply says 'round 4'.
- [nit] plugins/openspec/hooks/flow-check.mjs:562 — [2] Still no test of a plan revised after approval but before the first task tick: dropping `started &&` would make the readiness stale and the suite would stay green. Write in flow-check.test.mjs next to T58: no task ticked, design edited, readiness stays passed.
- [praise] plugins/openspec/hooks/change-loop-declared.test.mjs — Round 1 praise, still true: the seams between parts are tested where the behaviour shows (declare CLI fed to the real stop hook, the resolution deadlock through push and fix-resolution, the plan digest through next, record-approval and the CompozyOS view), and the flows that cross processes have real runs in proof/.
- [nit] plugins/openspec/hooks/guard.test.mjs:1857 — [4] No test refuses a subagent's declare in the quoted-heredoc form the skills prescribe (`... declare feat review-round --stdin words <<'DEVKIT_ARGS'` + body + terminator); a withoutHeredocs that dropped the `<<` line with its body would let it through with T99 and T102 green. Write in guard.test.mjs, T99's refused list.
- [nit] plugins/openspec/hooks/guard.mjs:746 — [2] The option skip `(?:\s+-[^\s;&|]*)*` leaves unmatched a node option whose value is a separate word (`node -r ./x.cjs`, `--require ./x.cjs`, `--stack-size 2000`); D-1 now states this form as decided, so it is a design point for the security reviewer, not a missing test.
- [praise] plugins/openspec/hooks/change-loop-declared.test.mjs:449 — The stdin fix is tested at the seam: T144 spawns real bash with the quoted heredoc, so dropping 'declare' from the entry point's stdin read turns exit 0 into exit 3, and it checks no command in the words ran.
- [nit] plugins/openspec/hooks/change-loop.mjs:3264 — [3] The spec scenario revised in cccd21b (specs/change-coordination/spec.md:330) now promises 'the first 200 characters of the words', but no declare test passes words longer than 200: dropping `.slice(0, 200)` stays green (the record-approval and record-mockup cuts are tested in change-loop-compozy.test.mjs:1946/2051, this one is not). Write in change-loop-declared.test.mjs next to T143: words of 250 characters record exactly the first 200.
- [praise] plugins/openspec/hooks/guard.mjs:127 — The merge f72e442's one code resolution (main's `split(/\r?\n/)` with this change's keyed `opening`) is pinned on both sides: keeping main's literal `/^devkit:/` opening fails T135/T136/T137, keeping `split('\n')` fails 'delivery-models config: a CRLF block is read as its LF twin'.

In-scope surfaces: the change's own commits since round 2 (0b71037, f29093d, cccd21b, 81d5bcd, ab2e0e8, 0107079, 9c4fffe), which edit only plan, record and evidence files under openspec/changes/coordinator-loop-fixes/; and the merge f72e442's conflict resolutions in plugins/openspec/hooks/guard.mjs (parseDevkitBlock), guard.test.mjs (both sides' tests kept), openspec/config.yaml and the release files. No hook code of this change changed in the range. The rest of the merge is project-setup's work, reviewed in that change, and is not in this round's scope.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- parseDevkitBlock after the merge: keyed `opening` → T135 (guard), T136/T137 (change-loop-declared), T138 (stage-models); CRLF split → 'delivery-models config: a CRLF block is read as its LF twin'. A CRLF `x-devkit:` block in a change's .openspec.yaml is not tested on its own, but it follows the same code path as the two tests above, and OpenSpec writes LF.
- Plan delta 'every .md file under specs/' (change-stages spec) → deliver-check T54 (specs/s/notes.txt leaves the digest equal)
- Plan delta 'first 200 characters' (change-coordination spec) → gap (F9, nit)
- Plan delta on DECLARE_CALL's matched text (file-writers spec) → T99 (node option words, quoted path or not, both directions); option with a separate value → unmatched by design (F7)
- Task 6.4d (written ticked; its code landed in round 2) → T44, T96-T102, T143-T148, all re-run green here
- Moved paths in 0107079 (plan text only) → no test reads them; evidence attempt 3 ran the gate checks at the new paths (gen-agents --check, github-setup and project-settings tests)
Test run: one scoped run in the foreground at concurrency 3 under the CI branch variables over change-loop-declared, guard, conduct-check, delivery-models and stage-models, filtered to T44, T96-T102, T135-T138, T143-T148 and the delivery-models CRLF test: 5 files, 19 tests, 19 pass, 0 fail.

### Well covered
- The merge resolution of parseDevkitBlock: each side of the conflict has a test that turns red if that side is dropped (F10).
- The owner's words through stdin: in-process (T143), a spawned real shell with the quoted heredoc (T144), each refusal leaving nothing recorded (T145), and the nested-session real run ver-r7s for the conducting session's own part.
- conductor-task in conduct-check: T146 pins both actorOf and the deliveryStep row's state and reason.
- The plan digest's scope: T51-T54 pin the tick normalization, each plan file's edit, the files outside the plan, and the .md-only rule under specs/.
