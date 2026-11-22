<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `gh-version-check` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: the round 27 line of `openspec/roadmap.md` and the owner-confirmed `requirements.md`;
managed-agents-study retro, item 3).

## Why

`deliver-check` reads a pull request's checks with `gh pr checks <n> --required --json
name,state,bucket,link` (`readChecks` in `plugins/openspec/hooks/deliver-check.mjs`). A `gh` older
than 2.50.0 has no `--json` for that command, so the call fails with `unknown flag: --json` and every
reader reports it as "GitHub cannot be read" (`github-unreadable` in the change loop,
`checks-unreadable` in the stage readout). The owner then looks for a network, auth or GitHub
outage that does not exist, while the fix is to update `gh`. Nothing in `openspec-setup` says which
`gh` the `pr` and `merge` ship modes need.

## What Changes

- **One minimum and one parser, shared.** `plugins/openspec/hooks/merge-setup.mjs`, the one `gh`
  runner of the scripts, gains the minimum (`2.50.0`, the first `gh` with `gh pr checks --json`), a
  parser of the first line of `gh --version`, a numeric version comparison and one `gh --version`
  read. The requirements' ambiguity (a) / (b) is resolved as (a): no new module.
- **`deliver-check`'s checks item tells an old `gh` apart.** Only when `gh pr checks` fails with
  `unknown flag: --json` (or `unknown flag: --required`, see below) does it run `gh --version`. The
  item is then blocked with a reason that names the installed version (or says it is unknown) and
  2.50.0, and its details carry both. Every other failure keeps its reason and text; a successful
  read never calls `gh --version`.
- **A blocked reason of its own, `gh-too-old`,** in the stage readout (`flow-check.mjs`, English
  and Brazilian Portuguese), in the change loop (`change-loop.mjs`: `BLOCKED_OF`, the
  `blocked-why.gh-too-old` reply in both languages) and in the project loop (`project-loop.mjs`).
  The reply names both versions, says to update `gh` and to call `/devkit change` (or `/devkit
  project`) again. The roadmap loop renders it with no code change. The wait on GitHub ends at once
  on it; it is not retried like an unreadable GitHub.
- **The setup step checks `gh` once.** A new script,
  `plugins/openspec/skills/openspec-setup/scripts/gh-version.mjs` (ambiguity (a)), prints one line:
  `ok` with the version, or a warning naming the installed version and 2.50.0, or saying `gh` is not
  installed. Step 1 of `openspec-setup` runs it next to `openspec --version`; the setup always goes
  on (the `plan` ship mode needs no `gh`).
- **Docs and release.** Item 6 of the delivery contract in `docs/openspec-flow.md` names the old
  `gh`; a devkit-openspec minor release (0.21.1 to 0.22.0, marketplace 0.25.1 to 0.26.0, resolved
  against `origin/main` at the release step), its `CHANGELOG.md` section and the CI pin moved to
  `v0.22.0`.

Choices this plan makes on top of `requirements.md`, for the owner to see:

1. The old `gh` is also recognised by `unknown flag: --required`. The call passes `--required` before
  `--json`, and `gh` names the first flag it does not know; requirements state `--required` is no
  newer than 2.50.0, so a `gh` without it is also too old. Without this, such a `gh` would still read
  as "GitHub cannot be read".
2. A minor release, not a patch: the change adds a script and a reason code the skills read.
3. The 2.50.0 figure is the one `requirements.md` cites from the cli/cli release notes; this session
  did not fetch the changelog (no network), so it is confirmed before `implement` (task 1.1).

Non-goals (from `requirements.md`): no version check on every `deliver-check` call or before any
other `gh` call; no other `gh` feature with a minimum; the silent `gh pr checks --json name` call in
`reportedWhere` of `github-setup.mjs` stays as it is; nothing installs or updates `gh`.

## Acceptance criteria

Copied from `requirements.md`, with their ids (seven, as the owner confirmed them).

- AC-1 `old-gh-named`: with a `gh` whose `gh pr checks <n> --required --json ...` exits non-zero with `unknown flag: --json` and whose `gh --version` prints `gh version 2.46.0 (...)`, the `checks` item of `deliver-check` is blocked with a reason that names `2.46.0` and `2.50.0`, and its details carry the installed and minimum versions.
- AC-2 `change-loop-own-reason`: in that state, `change-loop.mjs next` ends blocked with the reason `gh-too-old`, whose reply in `en` and in `pt-BR` names `2.46.0` and `2.50.0`, says to update `gh` and to call `/devkit change` again, and does not say that GitHub cannot be read.
- AC-3 `project-loop-own-reason`: in the same state, `project-loop.mjs next` ends blocked with the same reason and a reply that names both versions and `/devkit project`.
- AC-4 `stage-readout`: `flow-check.mjs` shows the old-`gh` reason, in both languages, instead of "the checks cannot be read".
- AC-5 `unknown-version`: when the "unknown flag" failure happens and `gh --version` fails or prints something unparseable, the reason is still the old-`gh` one, with the installed version given as unknown.
- AC-6 `other-failures-unchanged`: an auth or network error, a timeout, a missing `gh` and unreadable output from `gh pr checks` keep ending as GitHub unreadable with their current text; when `gh pr checks --json` succeeds, `gh --version` is never called.
- AC-7 `setup-warns`: setup step 1 runs the version check; with `gh` 2.46.0 it prints a warning naming `2.46.0` and `2.50.0`; with `gh` missing it says `gh` is not installed; with `gh` 2.50.0 or newer it prints `ok` with the version; in every case the setup goes on.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-delivery`: ADDED, the delivery checker names a `gh` too old to read the checks.
- `change-stages`: MODIFIED "The delivery follows the change's pull request", a scenario for the
  old `gh` and the unreadable-checks scenario narrowed to the other failures.
- `change-coordination`: ADDED, a `gh` too old ends the run with its own reason, not retried by
  the wait.
- `project-definition`: ADDED, a slice's run names a `gh` too old to read its pull request's checks.
- `project-setup`: ADDED, the setup names a missing or too old `gh` and goes on.

## Impact

- devkit-openspec (0.21.1 to 0.22.0): `hooks/merge-setup.mjs`, `hooks/deliver-check.mjs`
  (`readChecks`, `checksItem`), `hooks/flow-check.mjs`, `hooks/change-loop.mjs`,
  `hooks/project-loop.mjs`; new `skills/openspec-setup/scripts/gh-version.mjs` and its test;
  `skills/openspec-setup/SKILL.md` (step 1 and the script list); tests in `merge-setup.test.mjs`,
  `deliver-check.test.mjs`, `flow-check.test.mjs`, `change-loop.test.mjs`, `project-loop.test.mjs`,
  `roadmap-loop.test.mjs` and `guard.test.mjs` (the new suite's import). No change to `guard.mjs`,
  `conduct-check.mjs`, `roadmap-loop.mjs`, `github-setup.mjs`, the schemas or the panel.
- JSON contract: `end.why` gains the value `gh-too-old` in the change and project loops, and the
  stage report gains the reason code `gh-too-old`; both are read only inside `plugins/openspec/`
  (the `devkit` skill shows the reply as it is).
- The `devkit-reviews` check runs `deliver-check.mjs --ci`, which reads no pull request checks; it
  is unaffected.
- Docs: `docs/openspec-flow.md` (item 6 and the `v0.21.1` pins), `CHANGELOG.md`,
  `.claude-plugin/marketplace.json`, `plugins/openspec/.claude-plugin/plugin.json`.

**Exit criteria.** The gates of `tasks.md`, the last being the whole hook suite
(`node --test plugins/openspec/hooks/guard.test.mjs`), `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check` and `claude plugin validate .`; and
`openspec validate gh-version-check --strict`.

**Dependencies.** `managed-agents-study` (archived; its retro item 3 is this change).
`review-writer-prompt` (archived; devkit-openspec 0.21.1, the version this change bumps). A sibling
that also bumps devkit-openspec meets this bump at the release rebase (`CONTRIBUTING.md`).

**Decisions cited.** ADR 0010 decision 3 (a loop over files that ends in one of four states, each
with its reason: the new reason is one more `blocked` reason, no new state, and calling the command
again reads the files anew); ADR 0011 decision 1 (the change coordinator is the session the owner
typed `/devkit change` in, so the reply sends the owner back to that command); ADR 0015 decision 6
(a slice's one pull request follows its ship entry, and the project loop reads its checks); ADR 0002
(merge mode still needs the checks green: an old `gh` blocks, never passes). No new ADR is needed:
no decision changes.

**Open decisions inherited.** None; no point of `docs/coordination-design.md` ("Open points") is
touched.
