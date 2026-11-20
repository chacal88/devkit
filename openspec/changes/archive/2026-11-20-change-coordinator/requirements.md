<!-- devkit-stage requirements result=passed attempt=1 commit=6e4c0635215b4a1da287461e3713c9efe010db4d -->
# Requirements

Change: `change-coordinator` · Date: 2026-11-20 · Owner: Kaue (chacal88)

Grill: held on 2026-11-20 in the owner's session, four questions (Questions asked). This is round 15
of `openspec/roadmap.md`, step 3 of the build order in `docs/coordination-design.md` (section 11):
the first change that builds the loop over the checker `flow-check`, which round 14 delivered.

Classification: domain=product type=feature flags=[architecture, contract] (confirmed: `/devkit` is
the one command every project types, the stop locks are new hooks, and `/conduct` is removed).

## Request

(The roadmap line the owner approved, and the owner's go-ahead, translated from Portuguese.)

> change-coordinator (after: flow-script-checker) — the change coordinator runs one change as a loop
> over the checker, with `/devkit change`, the two stop locks, the skills wired into the agents and
> the two language settings; retires `/conduct` (D-1, D-2, D-3, D-8, D-9). Carried from the
> flow-script-checker retro for its grill: the questions the design did not answer, a commit that
> touches only tests should make stale only the reviewers it concerns, the wait on GitHub without
> the owner's message, and deliver-check still counting a checkbox inside a fenced example.

Asked "Do you want to start round 15, the change coordinator?", the owner answered "Começar a
rodada 15" ("Start round 15").

The design this change builds from is `docs/coordination-design.md`: section 1 (how the owner uses
it), section 2 (the change coordinator, `tech-lead`), section 3 (a command and a loop, never a
session that remembers), section 8 (the harness rules, the locks, the configuration block),
section 9 (the two language settings) and section 10 (the Claude driver), with ADR 0010
(`docs/adr/0010-openspec-as-the-harness.md`).

## Assumptions

- A-1. The command is `/devkit`, shipped by the pack `devkit-openspec`, and this change builds one
  verb: `change`. `/devkit change <free text>` starts a change from the text; `/devkit change` with
  no text, or with an existing change id, resumes. Any other verb (`roadmap`, `project`, `status`,
  `help`) answers in one plain sentence that it is not built yet, and does nothing.
- A-2. A new change is created the way `/conduct <id>` creates one today: its own git worktree and
  branch named after the change id, then `openspec new change <id> --schema <script>`. The session
  proposes the id (kebab-case, from the request), states it in its reply and does not ask about it.
- A-3. The script is chosen by the session (the owner's answer, question 3): `devkit-lite` only for
  a small, reversible change with no `architecture`, `contract` or `ui` flag in the classification
  of the requirements grill; `devkit` otherwise and whenever in doubt. The reply says which script
  and why in one sentence, and the owner switches it by answering before the plan is written.
- A-4. The owner's gates stay the ones the script declares: the grill's questions, the mock-up
  approval for a screen change, the plan approval (`approval.md`, `devkit` only) and the retro
  answers. `approval.md` and the retro `Answer:` lines are still written only from the owner's own
  message, by the main session. Typing `/devkit change <text>` is the go-ahead ADR 0007 asks for to
  create a missing change; no extra question is asked for it.
- A-5. The oracle of the loop is `plugins/openspec/hooks/flow-check.mjs` (`--json`, exit codes 0 to
  3, the four end states). The loop hands each stage to the role `flow.json` names for it and does
  what `onFail` and the ceilings say. `conduct-check.mjs` and `deliver-check.mjs` stay shipped and
  unchanged until round 24; whether the loop still calls `deliver-check` for the delivery part is
  the planner's to settle from what `flow-check` already answers.
- A-6. In the Claude driver the session the owner typed in runs the loop and each stage is a
  subagent (section 10). AMBIGUOUS: (a) the main session is the change coordinator, the stop lock
  holds it and a lock refuses its product edits | (b) `/devkit change` hands the loop to a
  `change-coordinator` subagent defined without edit tools, and the main session only relays the
  owner's gates; the planner resolves, keeping in mind that only the main session can ask the owner
  and write `approval.md`.
- A-7. The two roles called `tech-lead` (the open point of section 2): the script and the agent
  files keep the role id `change-coordinator`, which `flow.json` and `docs/roles.md` already use;
  `tech-lead` stays the team name of that role in the documents, and the CompozyOS kit's
  `tech-lead` (its planner) is untouched until round 21. `docs/roles.md` says so in one place.
- A-8. The files' language is `devkit.language` in the project's `openspec/config.yaml` (default
  `en`), and the driver is `devkit.driver` (default `claude`; `compozy` and `script` are accepted
  names whose drivers arrive in rounds 21 and 22). These two field names are decided here; the rest
  of the block stays open for its rounds.
- A-9. The person's language is a per-person setting of the plugin, values `pt-BR` and `en`, default
  `pt-BR` (the default `devkit-panel` and `flow-check --lang` already use). AMBIGUOUS: (a) a
  `userConfig.language` of `devkit-openspec` of its own | (b) one setting both `devkit-openspec` and
  `devkit-panel` read; the planner resolves from what the plugin configuration allows.
- A-10. This change is itself driven by today's flow (`ship-change` in one session, as section 11
  states). `/devkit change` is proved here by tests and by one live test (the owner's answer,
  question 4); its first real use is round 16.
- A-11. `ship-change` and `review-change` keep working as they do today for a change under way; no
  behaviour of theirs changes in this round. Whether the review stage keeps the Workflow path stays
  an open point.
- A-12. Two findings the retro of round 14 carried here are not built in this change and go to the
  roadmap instead (decided by the conducting session under the owner's standing instruction to
  decide routine choices): a commit that touches only tests making stale only the reviewers it
  concerns, and `deliver-check` counting a checkbox inside a fenced example. This change adds them
  to the `review-writer-prompt` line of round 25 in `openspec/roadmap.md`.

## Acceptance criteria

Each criterion says where it is proved: `here` (tests and the live test of this change) or `next`
(observed when round 16 is conducted with the new command; recorded in that change's retro).

- AC-1 `one-command-starts-a-change` — In a project set up for devkit, `/devkit change <free text>`
  creates the change (A-2), chooses the script (A-3) and replies with the change's name, the script
  chosen and why, and what comes next. Proved here.
- AC-2 `loop-over-the-checker` — The change coordinator takes the change from its opening towards
  its archive by asking `flow-check` what is next, handing that stage to the role `flow.json`
  names, and asking again. It never picks the order itself, and it ends a run only in one of the
  four end states (archived, waiting for the owner, waiting on GitHub, blocked), each with its
  reason in plain words. Proved here for the loop's decisions against fixtures of every end state;
  a whole change from opening to archive is proved next.
- AC-3 `calling-again-resumes` — `/devkit change` with no text, or with the change's id, continues
  the unfinished change from what the files say. Nothing is remembered between runs: killing the
  session at any stage and calling the command again reaches the same next stage. Proved here.
- AC-4 `unfinished-work-asked-first` — When `/devkit change <new request>` is typed while another
  change is unfinished, the session names that change and where it stopped and asks whether to
  continue it or start the new one, before anything is created or run (the owner's answer,
  question 2). Proved here.
- AC-5 `waits-on-github-alone` — While the pull request waits on GitHub (checks running, or the
  merge), the session keeps waiting with no time limit and without any message from the owner, and
  goes on by itself when GitHub answers: to the next stage when the checks pass or the pull request
  merges, to the fix when a check fails (the owner's answer, question 1). The reply that starts the
  wait says that the session is waiting and that calling `/devkit change` again is safe. Proved here
  for what the loop does at each answer of GitHub; the unattended wait itself is proved in the live
  test as far as a scratch repository allows, and next.
- AC-6 `coordinator-does-not-stop-early` — When the change coordinator tries to end its turn while
  `flow-check` reports a stage ready to run, the stop is refused and the refusal names that stage.
  It is not refused in any of the four end states, in a session with no `/devkit change` run, or
  when the owner interrupts. It cannot loop: when the same stage comes back with nothing changed up
  to the ceiling, the run ends as blocked with that reason. Proved here, by tests and in the live
  test.
- AC-7 `stage-agent-delivers-before-stopping` — A stage subagent that tries to stop while the file
  of its stage is missing, or still says `result=pending`, is refused with the file named; a second
  refusal with nothing changed lets it stop and the coordinator reports the stage as failed.
  Proved here, by tests and in the live test.
- AC-8 `coordinator-edits-no-code` — The change coordinator cannot edit product code and can hand
  work only to the roles the script lists: an edit or a hand-off to any other agent is refused,
  with the reason. Proved here.
- AC-9 `skills-wired-into-the-agents` — Every stage agent that ships declares the skills
  `flow.json` lists for its stage, so the coordinator's hand-off is the role, the change and the
  stage, never the method pasted into a prompt. A test compares the agents' declarations with both
  `flow.json` files and fails on a difference. Proved here.
- AC-10 `two-language-settings` — The files a stage writes follow `devkit.language` of the
  project; every reply of `/devkit change` and the `flow-check` readout it shows follow the
  person's language, in `pt-BR` and in `en`. With the owner's settings (files `en`, person `pt-BR`)
  the stage files are English and the replies Portuguese. Proved here.
- AC-11 `plain-replies` — Every reply of the command says what happened and what comes next in the
  person's language and uses no internal term: no stage id, no step name of a checker, no file
  name the owner did not ask about. A test reads the command's message table in both languages and
  refuses a listed set of internal words. Proved here.
- AC-12 `driver-setting-read` — With `devkit.driver: claude`, or no `devkit:` block, the command
  runs as above. With `compozy` or `script` it says in one plain sentence that this driver is not
  built yet, names the round, and runs nothing. Proved here.
- AC-13 `conduct-retired` — `/conduct` is no longer shipped, single-change and round mode alike:
  the skill is gone from the pack and the catalog, the session text and every document name
  `/devkit change` instead, and the CHANGELOG says what replaces it. No behaviour of `ship-change`,
  `review-change`, `conduct-check.mjs` or `deliver-check.mjs` changes. Proved here.
- AC-14 `live-test-recorded` — One live run of `/devkit change`, with the plugin loaded from this
  change's branch, on a throwaway change in a scratch project, is recorded as text in
  `evidence.md`: the command creating the change and choosing the script, the loop running at
  least the plan stages through subagents, each stop lock refusing once and then letting the run
  end, and the reply at an owner gate. Proved here.
- AC-15 `design-records-the-answers` — `docs/coordination-design.md` moves the points this change
  settles out of "Open points" into their sections, marked decided with who and when: the wait on
  GitHub, the two `tech-lead` roles, the ADR 0007 rules the coordinator keeps (both), and the field
  names `devkit.language` and `devkit.driver`. ADR 0010 gains a dated Note for them, the ADRs whose
  subject `/conduct` was say what replaced it, and `docs/openspec-flow.md` describes the new
  command. Proved here.

## Out of scope

- `/devkit roadmap`, `/devkit status` (round 18), `/devkit project` (round 19), `/devkit help`
  (round 23) and the Jira entry (round 20).
- The new stage roles: the ADR author, the unit-test suite, the E2E tester, the screen designer and
  the demonstration as text (round 16). Their stages stay "not applicable: nobody runs this stage
  yet", as `flow-check` reports today.
- The delivery models and the `develop` lock (round 17), the CompozyOS driver and the rename of the
  kit's planner (round 21), the script driver (round 22), the panels (round 23).
- Removing `conduct-check.mjs`, `deliver-check.mjs` as the next-step oracle and the child-session
  code (round 24).
- The two carried findings of A-12, and the project setup step (round 26).
- Publishing a release tag: it stays this repository's own rule after a merge.

## Questions the design document did not answer

Kept as round 14 did, to show whether `docs/coordination-design.md` is enough to plan from.

- How the coordinator waits on GitHub (named as open; asked: question 1).
- What happens to a new request while a change is unfinished (ADR 0007's rule named as open; asked:
  question 2).
- Who chooses between the two scripts for a free-text request (not mentioned; asked: question 3).
- How the round is proved before its first real use (section 13 says "one live test session";
  asked: question 4).
- What the other verbs answer before their rounds (assumed: A-1).
- How a change gets its id from free text (assumed: A-2).
- Whether the main session or a subagent is the change coordinator, given the lock "has no edit
  tool" and the rule that only the main session writes the approval (left to the planner: A-6).
- Where the person's language lives exactly, and the defaults of both settings (assumed: A-8, A-9).
- Whether the loop still needs `deliver-check` for the delivery part (left to the planner: A-5).

## Questions asked

1. [edges] When the pull request waits on GitHub's tests, what should the session do? → "Esperar
   sem limite": wait with no time limit and go on by itself (AC-5).
2. [project rules] A new request arrives while another change is unfinished (ADR 0007). → "Avisar e
   perguntar": name it and ask whether to continue it or start the new one (AC-4).
3. [scope] Who chooses between the short script and the full one? → "A sessão escolhe e avisa": the
   session chooses, says why, uses the full one when in doubt (A-3, AC-1).
4. [end effect] How do you want to see that `/devkit change` works before round 15 is delivered? →
   "Teste ao vivo com relato": a live test on a throwaway change, recorded as text (AC-14); real use
   starts in round 16 (A-10).
5. [scope, asked on 2026-11-20 while implementing] The gate of phase 5 is red on one panel test that
   fails the same way on `main` with the current app version: go on and fix it later, or fix it now?
   → "Corrigir agora": fixed inside this change (`design.md` D-11, "Decisions taken while
   implementing"; task 5.3). The diagnosis found a one-line fix in the test's own stand-in and no
   defect in the pack, so no acceptance criterion changes.

## Escalations

None.
