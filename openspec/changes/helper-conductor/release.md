# Release note

packs:
- devkit-openspec: minor
- devkit-core: minor

marketplace: minor

## a roadmap run is conducted by one scheduled task, with no session per change

- **devkit-openspec**: `/devkit roadmap [<n>]` records the run's queue and, on that typed turn,
  installs one scheduled task of the project; each tick claims one ready change and its own session
  drives it up to its next wait, handing each stage to its role and running the review round as the
  review bench's Workflow, and a new `UserPromptSubmit` hook, `hooks/tick-gate.mjs`, refuses an empty
  tick before the model. The task never removes itself: when the roadmap is done or a stop ends the
  run, the hook refuses every later firing and the owner is told once to delete the task with one
  click in the app. What needs the owner is one line in the run file, shown by `/devkit status` and in the session
  the run was typed in; decisions travel as request files in the change's folder; the owner's
  `openspec/standing-answers.md` can answer grill questions and delegate gates by name. A tick sweeps
  the run every five minutes, dispatches the train when a change boards, checks an item for a parked
  branch or delivered code before opening it, re-hands an escalated plan once the decision is
  recorded, and opens every change on its own machine, taking over a change another machine
  claimed only from its pushed branch once that claim is released. The task's prompt names no
  command and no path: the hook adds a note with the session and the installed pack's paths.
- **devkit-openspec**: a conducted run owns the machine's test capacity: one whole-suite run at a time
  on the machine, the train's first, and the gates at once and each run's files at once capped by two
  new settings, `test_gates` (default 2) and `test_concurrency` (default 4), recorded in the run file;
  while the train departs no other test run starts; every test command goes through
  `roadmap-loop.mjs test-run`, and every stage brief carries the cap. In a conducted run a pull
  request whose files are all under `openspec/` (an archive, a roadmap edit) boards no train and
  merges on its required checks.
- **devkit-openspec (breaking)**: the change sessions go: the start tickets, the `devkit-session`
  skill and its entry guard, the `session-start` action, `session-next`, `session-wait`, the
  `--change-sessions` and `--cron` flags, the session cron and its `check` verb, and the session-model
  switches. A run file from an earlier version keeps working; its old fields are not read.
- **devkit-core**: the `requirements-grill` skill gains a conducted grill (step 2c) for a roadmap run:
  the questions the triage leaves go to the standing answers, then to the owner's line, and are
  answered by their most conservative reading only when the standing answers delegate the grill; the
  `review-change` skill lets the review round run as its Workflow in a roadmap tick's session.
- Repository: `scripts/test-suite.mjs` takes `DEVKIT_TEST_CONCURRENCY` as a ceiling on its files at
  once; the grill rule of `openspec/config.yaml` and of the four `schema.yaml` copies allows
  exactly that; the record supersedes ADR 0021.
