<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

Change: `jira-entry` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Grill: held on 2026-11-22, six questions (Questions asked). This is round 20 of
`openspec/roadmap.md`: the Jira entry of `/devkit change` that `docs/coordination-design.md`
section 1 (D-1) lists. The owner delegated the answers to the coordinating roadmap session
("Please check every question, and answer the ones you have the information for", translated
from Portuguese); each answer below says so.

Classification: domain=process type=feature flags=[contract, external: Jira through the session's
Atlassian connector] (confirmed: the JSON `change-loop.mjs start` prints gains a mode the skill acts
on, and the request and the write-back go through a third-party service).

## Request

> `/devkit change <key or link>` reads a Jira task as the request and writes back to it (a comment with the pull request link, a status change) only when the developer asks, and the grill asks only what the task does not answer (D-1)

## Assumptions

- Reading and writing Jira happen in the session, through the Atlassian connector's tools (the
  read of an issue, its transitions, a comment, a transition). `plugins/openspec/hooks/change-loop.mjs`
  makes no network call and keeps no token: it only recognises the key or the link and says what
  the session must fetch.
- A key is an upper-case Jira key typed as the whole request, matching `^[A-Z][A-Z0-9_]+-[0-9]+$`
  (`PROJ-482`). A link is an `http(s)` URL whose path holds `/browse/<KEY>` or whose query holds
  `selectedIssue=<KEY>`. Any other text stays a free-text request, as today; a lower-case single
  word that names a known change still resumes that change, as today.
- The id of a change opened from a task is the key in lower case, a dash and the subject in at most
  a few words, within the 48 characters of `NAME` in `change-loop.mjs` (`proj-482-login-timeout`).
- `requirements.md` of such a change records the key and the link on one line under `## Request`,
  then the task's title, description and acceptance-criteria field (when the Jira project has one)
  copied literally. AMBIGUOUS: the exact form of the key line (a) a plain `Jira: <KEY> <link>`
  line | (b) a field in the stage header; the planner resolves, and the resume of AC-5 reads it.
- Typing `/devkit change <KEY>` (or its link) when an unfinished change already records that key
  resumes that change; nothing new is opened.
- When the task answers every grill point, the grill still asks the owner one question: to confirm
  the assumptions it drew from the task. `result=passed` still comes only from the owner's answer.
- The write-back question is asked once, when the change's pull request opens, in the session that
  runs the change (in a roadmap run with a session per change, that change's own session). It lists
  the transitions the task accepts at that moment, plus "only comment" and "no". It does not hold
  the delivery: merge and archive go on while it waits. A yes is taken only from the developer's
  own message, as the plan approval is. An answer that arrives after the change is archived writes
  nothing.
- The comment carries the pull request's link and the change id, written in the project's files
  language (`filesLanguage`).
- The choice between the `devkit` and `devkit-lite` scripts follows the skill's existing rule, on
  the task's text.

## Acceptance criteria

- AC-1 `key-opens-from-task` — `/devkit change PROJ-482` in a set-up project with no unfinished
  change makes `change-loop.mjs start` print a mode that tells the session to read task `PROJ-482`;
  given the connector's answer, the change opens as `proj-482-<subject>` with the key, the link,
  the title, the description and the acceptance-criteria field in `requirements.md`, and no other
  part of the task (comments, subtasks, linked tasks).
- AC-2 `link-same-as-key` — `/devkit change https://<site>.atlassian.net/browse/PROJ-482` (and a
  board link with `selectedIssue=PROJ-482`) behaves exactly as AC-1.
- AC-3 `no-connector-asks-text` — with no Atlassian connector in the session, or a task the
  connector cannot read (not found, no permission), nothing is opened and the reply says so in the
  person's language and asks for the request as text.
- AC-4 `grill-skips-answered` — the grill of a change opened from a task asks no question the task's
  copied parts answer, records each such point in `requirements.md` as "answered by the task", and
  still asks the owner at least one question before `result=passed`.
- AC-5 `key-resumes` — typing the same key (or link) again while its change is unfinished resumes
  that change; no second change is opened.
- AC-6 `write-back-asks-once` — when the pull request of a change opened from a task opens, the
  session asks once whether to comment on the task, listing the transitions the task accepts then,
  plus "only comment" and "no"; the merge and the archive go on while it waits.
- AC-7 `write-back-only-on-yes` — on a yes the task gets one comment with the pull request link and,
  when a transition was picked, that transition; on "only comment" only the comment; on "no", no
  answer, or an answer after the archive, nothing is written to Jira.
- AC-8 `free-text-unchanged` — a free-text request, a known change id and `/devkit change` alone
  behave exactly as before this change.
- AC-9 `fakes-only` — every criterion above is proved by tests with fake connector answers; no test
  and no evidence step calls a real Jira.
- AC-10 `live-proof-followup` — this change adds a follow-up line to `openspec/roadmap.md` for the
  live proof: read a real task and write on a disposable test task the owner names.

## Out of scope

- Any call to a real Jira in this change (question 6): the live proof is the follow-up of AC-10.
  If the owner gives a task key in this session before the plan is approved, the live read moves
  into this change.
- The Jira REST API, tokens or Jira settings in `openspec/config.yaml` (questions 1 and 3).
- Comments, subtasks, linked tasks and attachments of the task (question 4).
- Writing to Jira at any moment other than the pull request's opening, and any write without the
  developer's yes (question 2).
- Jira keys in `openspec/roadmap.md` or `/devkit roadmap`; the CompozyOS and script drivers
  (rounds 21 and 22).
- Other trackers (Linear, GitHub issues).

## Questions asked

1. [scope] How does devkit read the Jira task: through the session's Atlassian connector, through the Jira REST API called by the script with a token in environment variables, or both? → (a) Through the session's Atlassian connector: `change-loop.mjs` only recognises the key or the link, no token is kept in the project, and without a connector devkit says so and asks for the request as text. Answer delegated by the owner to the coordinating roadmap session (owner's message there, translated from Portuguese: "Please check every question, and answer the ones you have the information for"), relayed on 2026-11-22.
2. [scope] How does the developer ask for the write-back (the comment with the pull request link, the status change)? → (a) devkit asks once, when the pull request opens ("Comment the link on PROJ-482 and move it to <status>?"); nothing is written to Jira without a yes, and the pending question does not hold the delivery (merge and archive go on). Answer delegated by the owner to the coordinating roadmap session, as in question 1, relayed on 2026-11-22.
3. [edges] Which status does the task move to on a yes, given every Jira workflow names its statuses differently? → (a) The write-back question lists the transitions the task accepts at that moment (read through the connector), plus "only comment"; nothing about the status is configured. Answer delegated by the owner to the coordinating roadmap session, as in question 1, relayed on 2026-11-22.
4. [scope] Which parts of the Jira task become the change's request? → (a) The title, the description and the acceptance-criteria field when the Jira project has one, copied literally under `## Request` of `requirements.md` with the key and the link; comments, subtasks and linked tasks are left out. The grill does not ask what those parts already answer and marks each such point "answered by the task". Answer delegated by the owner to the coordinating roadmap session, as in question 1, relayed on 2026-11-22.
5. [scope] What id does a change opened from a Jira task get, and how is it resumed? → (a) The lower-case key plus the subject (`proj-482-login-timeout`); typing `/devkit change PROJ-482` again resumes the open change of that key instead of opening a new one; the key is recorded in `requirements.md`. Answer delegated by the owner to the coordinating roadmap session, as in question 1, relayed on 2026-11-22.
6. [end effect] How is it proved against a real Jira? → (c) Everything with fake connector answers; the live proof (read a real task, write on a disposable test task) becomes a roadmap follow-up line this change writes. The coordinating session had no task keys to give, and writing to a real Jira is an external action the owner has not asked for; if the owner gives a key in this session, the live read moves into this change (option b). Answer delegated by the owner to the coordinating roadmap session, as in question 1, relayed on 2026-11-22.

## Escalations

- None. No ADR is contradicted: the script stays a reader of files, git and GitHub (ADR 0010,
  0011), and the session, as the change coordinator, makes the connector calls.
