<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `jira-entry` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the answers the owner delegated). Round 20 of `openspec/roadmap.md`;
step 8 of the build order in `docs/coordination-design.md` (section 1, D-1).

## Why

`docs/coordination-design.md` section 1 lists `/devkit change PROJ-482` as one of the forms of the
command, but today a Jira key or link is treated as free text: the session opens a change whose request is just
"PROJ-482", and the developer has to paste the task by hand and later copy the pull request link back
to Jira. The design decided on 2026-11-19 that devkit reads Jira by default and writes back only
when the developer asks. This round builds that.

## What Changes

- `change-loop.mjs start` recognises a request that is only a Jira key (`PROJ-482`) or only a Jira
  link (`.../browse/PROJ-482`, or a board link with `selectedIssue=PROJ-482`) and answers a new
  mode, `task`, that tells the session which task to read. When an unfinished change already records
  that key, it answers `resume` for that change instead. Any other text works as it does today.
- The session reads the task through its Atlassian connector. The script makes no network call and
  keeps no token. With no connector, or a task the connector cannot read, nothing is opened, and
  the reply asks for the request as text.
- `change-loop.mjs open <id> --task <KEY>` takes the task's title, description and
  acceptance-criteria field as JSON on standard input and writes them literally under `## Request`
  of `requirements.md`, after a `Jira: <KEY> <link>` line. The id starts with the lower-case key. A
  second change for a key that already has an unfinished change is refused.
- The grill of such a change does not ask what the copied parts answer, and records each of those
  points as "answered by the task". It still asks the owner at least one question.
- `change-loop.mjs next` adds the recorded task to every action. On the first action after the
  change's pull request exists, it also adds a `writeBack` field. The session then asks once, in
  plain text that does not hold the loop, whether to comment the link on the task. The question
  lists the transitions the task accepts at that moment, plus "only comment" and "no".
- A new subcommand, `change-loop.mjs write-back ask|answer`, records the question and the answer in
  the repository's git common directory. On a yes it gives the session the comment (in the
  project's files language) and the transition to apply. On "no", or after the archive, it gives
  nothing to write.
- The `devkit` skill, the `requirements-grill` skill, `docs/openspec-flow.md`,
  `docs/coordination-design.md`, a dated Note on ADR 0010, a follow-up line in
  `openspec/roadmap.md` for the live proof, and a release of devkit-openspec and devkit-core.

Non-goals: everything under "Out of scope" in `requirements.md`. In particular: no call to a real
Jira, no REST API or token, no Jira setting in `openspec/config.yaml`, no comments, subtasks or
links of the task, no write at any other moment, no Jira keys in the roadmap, no other tracker, no
hook that refuses a Jira write (see "Flagged" below), and no change to `/devkit roadmap`, the panels
or the CompozyOS kit.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `key-opens-from-task` — `/devkit change PROJ-482` in a set-up project with no unfinished change makes `change-loop.mjs start` print a mode that tells the session to read task `PROJ-482`; given the connector's answer, the change opens as `proj-482-<subject>` with the key, the link, the title, the description and the acceptance-criteria field in `requirements.md`, and no other part of the task (comments, subtasks, linked tasks).
- AC-2 `link-same-as-key` — `/devkit change https://<site>.atlassian.net/browse/PROJ-482` (and a board link with `selectedIssue=PROJ-482`) behaves exactly as AC-1.
- AC-3 `no-connector-asks-text` — with no Atlassian connector in the session, or a task the connector cannot read (not found, no permission), nothing is opened and the reply says so in the person's language and asks for the request as text.
- AC-4 `grill-skips-answered` — the grill of a change opened from a task asks no question the task's copied parts answer, records each such point in `requirements.md` as "answered by the task", and still asks the owner at least one question before `result=passed`.
- AC-5 `key-resumes` — typing the same key (or link) again while its change is unfinished resumes that change; no second change is opened.
- AC-6 `write-back-asks-once` — when the pull request of a change opened from a task opens, the session asks once whether to comment on the task, listing the transitions the task accepts then, plus "only comment" and "no"; the merge and the archive go on while it waits.
- AC-7 `write-back-only-on-yes` — on a yes the task gets one comment with the pull request link and, when a transition was picked, that transition; on "only comment" only the comment; on "no", no answer, or an answer after the archive, nothing is written to Jira.
- AC-8 `free-text-unchanged` — a free-text request, a known change id and `/devkit change` alone behave exactly as before this change.
- AC-9 `fakes-only` — every criterion above is proved by tests with fake connector answers; no test and no evidence step calls a real Jira.
- AC-10 `live-proof-followup` — this change adds a follow-up line to `openspec/roadmap.md` for the live proof: read a real task and write on a disposable test task the owner names.

Exit criteria: every phase gate of `tasks.md` green, then
`node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
`openspec validate jira-entry --strict`.

## Capabilities

### New Capabilities

- `jira-tasks`: a Jira key or link typed to `/devkit change` as the request. This covers how the
  task is read and recorded in the change, how its key resumes the change, how the grill treats it,
  and the one write-back question with what is written to Jira on each answer.

### Modified Capabilities

None. `change-coordination` keeps every requirement as it is: free text, a change id and
`/devkit change` alone behave as before (AC-8), and the new replies come from the same message
table, so its "Replies use no internal term" requirement covers them.

## Impact

- devkit-openspec (0.21.1 to 0.22.0): new `hooks/jira-task.mjs` and `hooks/jira-task.test.mjs`
  (imported by `hooks/guard.test.mjs`); `hooks/change-loop.mjs` (`startMode`, `openChange`,
  `nextAction`, the new `write-back` subcommand, the message table, the module header) and
  `hooks/change-loop.test.mjs`; `skills/devkit/SKILL.md`.
- devkit-core (0.9.0 to 0.10.0): `skills/requirements-grill/SKILL.md` (a request copied from a task).
- Docs and release: `docs/openspec-flow.md` (the forms of `/devkit change`, a Jira paragraph, the CI
  pin `v0.21.1` to `v0.22.0`), `docs/coordination-design.md` (sections 1, 8 and 13),
  `docs/adr/0010-openspec-as-the-harness.md` (a dated Note), `openspec/roadmap.md` (round 20b),
  `CHANGELOG.md`, both `plugin.json` files, `.claude-plugin/marketplace.json` (0.25.1 to 0.26.0),
  `docs/catalog.md` and `plugins/openspec/README.md` (regenerated by `scripts/gen-catalog.py`).
  The tag `v0.22.0` goes on after the merge.
- External system: the Jira of whoever uses the command, reached only through the session's own
  Atlassian connector. No test touches it.

**Dependencies.** `change-coordinator` (archived 2026-11-20: `/devkit change`, `change-loop.mjs`,
the message table, the stop locks). `review-writer-prompt` (archived 2026-11-22) set the current
pin `v0.21.1`.

**Decisions cited.** ADR 0010 (decision 1: the configuration block is filled by the rounds that need
it; decision 3: a loop over files, with nothing remembered in the session; decision 5: hooks veto and
do not drive; decision 6: the owner's gates stay). ADR 0011 (the change coordinator is the owner's
session: it, not the script, calls the connector). ADR 0014 (in a roadmap run each change has a
session of its own, which is where its write-back question is asked). ADR 0002 and ADR 0003 (merge
modes: the pending question holds neither merge). No new ADR (`design.md`, "Decisions and ADRs").

**Open decisions inherited.** None of the "Open points" of `docs/coordination-design.md`. The
design decided "writing back to Jira" on 2026-11-19, and this change builds it. The proposed
configuration field `tasks: source: jira` (section 8) is answered as not needed.

**Flagged for the owner at plan approval.**

- ADR 0010 decision 1 lists "the task source, round 20" among the settings the configuration block
  is to gain, and decision 8 names a task source among its settings. Grill question 1 answered that
  no Jira setting goes into `openspec/config.yaml`. The plan records this as a dated Note on ADR 0010
  (`design.md` D-10), not as a new ADR. If the owner reads it as a change of the decision, an ADR
  0016 that amends ADR 0010 is drafted before readiness instead.
- The developer's yes is held the same way the plan approval is: only the session writes, and it
  writes only from the developer's own message. No hook refuses a Jira write. A hook on the
  connector's write tools would be a new lock in `guard.mjs`, outside this request. It would need a
  roadmap line of its own.
- `docs/openspec-flow.md` still says `project` is not built. Task 4.3 corrects that sentence while it
  edits the same list of forms.
