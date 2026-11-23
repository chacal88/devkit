<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> `deliver-check` tells an old `gh` (no `gh pr checks --json`) from an unreadable GitHub and says the installed version and the first one that works, and the setup step checks the `gh` version once (managed-agents-study retro, item 3)

Classification: domain=process, type=bug, flags=[] (strict-assumed: the change adds a blocked reason that the change loop, the project loop and the stage readout render, but no contract outside `plugins/openspec/` reads it).

## Questions asked

1. [scope] When does `deliver-check` find out that `gh` is too old? → Only when the call fails: when `gh pr checks ... --json` fails with "unknown flag", it runs `gh --version` and names the installed version and 2.50.0, the first `gh` with `gh pr checks --json`. No version call when everything works. (Answer delegated by the owner to the coordinating roadmap session, in the owner's own message there, translated from Portuguese: "Please check every question, and answer the ones you have the information to answer.")
2. [end effect] How does the loop end when `gh` is too old? → With a blocked reason of its own, distinct from "GitHub cannot be read", with its own reply in `en` and `pt-BR`, in `deliver-check`, the change loop and the project loop. (Delegated by the owner to the coordinating roadmap session, under the same message.)
3. [scope] Where does the setup step check the `gh` version? → In step 1 of `plugins/openspec/skills/openspec-setup/SKILL.md` ("Check the CLI"), always, next to `openspec --version`: a missing `gh` or one older than 2.50.0 gets a warning that names the installed version and 2.50.0; the setup goes on (the `plan` ship mode needs no `gh`). (Delegated by the owner to the coordinating roadmap session, under the same message.)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The first `gh` with `gh pr checks --json` is 2.50.0 (cli/cli release notes: "feat: add json output for `gh pr checks`"); the planner confirms it against the official changelog. `--required` and the `bucket` field are no newer than that.
- One constant holds the minimum, `2.50.0`, and one parser reads the first line of `gh --version` (`gh version 2.46.0 (2024-03-18)`); `deliver-check` and the setup step both use them. AMBIGUOUS: (a) both live in `plugins/openspec/hooks/merge-setup.mjs` next to `makeGh` and `ghError` | (b) a new module under `plugins/openspec/hooks/`; the planner resolves.
- The old `gh` is recognised from `readChecks` in `plugins/openspec/hooks/deliver-check.mjs`: a non-zero exit whose stderr matches `unknown flag: --json`. Only then is `gh --version` run.
- When the "unknown flag" failure happens but `gh --version` cannot be read or parsed, the reason is still the old-`gh` one, with the installed version given as unknown.
- The new blocked reason is `gh-too-old`, a sibling of `github-unreadable` in `BLOCKED_OF` and the `blocked-why.*` messages of `plugins/openspec/hooks/change-loop.mjs`, of the blocked reasons in `plugins/openspec/hooks/project-loop.mjs` and of `checks-unreadable` / `gh-error` in `plugins/openspec/hooks/flow-check.mjs` (the stage readout shows the same reason).
- The reply names the installed version, 2.50.0, says to update `gh`, and that resuming is calling `/devkit change` (or `/devkit project`) again.
- Every other `gh` failure (auth, network, timeout, missing `gh`, unreadable output) keeps its current reason and text.
- The silent `gh pr checks --json name` call in `reportedWhere` of `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs` stays as it is: step 1 already warned about the old `gh`.
- The setup step's check is a script line the skill shows, so it can be tested. AMBIGUOUS: (a) a new script under `plugins/openspec/skills/openspec-setup/scripts/` | (b) a flag of an existing one; the planner resolves.
- The change ships as a devkit-openspec release (version bump, catalog and changelog as `CONTRIBUTING.md` says), resolved against `origin/main` at the release step.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `old-gh-named`: with a `gh` whose `gh pr checks <n> --required --json ...` exits non-zero with `unknown flag: --json` and whose `gh --version` prints `gh version 2.46.0 (...)`, the `checks` item of `deliver-check` is blocked with a reason that names `2.46.0` and `2.50.0`, and its details carry the installed and minimum versions.
- AC-2 `change-loop-own-reason`: in that state, `change-loop.mjs next` ends blocked with the reason `gh-too-old`, whose reply in `en` and in `pt-BR` names `2.46.0` and `2.50.0`, says to update `gh` and to call `/devkit change` again, and does not say that GitHub cannot be read.
- AC-3 `project-loop-own-reason`: in the same state, `project-loop.mjs next` ends blocked with the same reason and a reply that names both versions and `/devkit project`.
- AC-4 `stage-readout`: `flow-check.mjs` shows the old-`gh` reason, in both languages, instead of "the checks cannot be read".
- AC-5 `unknown-version`: when the "unknown flag" failure happens and `gh --version` fails or prints something unparseable, the reason is still the old-`gh` one, with the installed version given as unknown.
- AC-6 `other-failures-unchanged`: an auth or network error, a timeout, a missing `gh` and unreadable output from `gh pr checks` keep ending as GitHub unreadable with their current text; when `gh pr checks --json` succeeds, `gh --version` is never called.
- AC-7 `setup-warns`: setup step 1 runs the version check; with `gh` 2.46.0 it prints a warning naming `2.46.0` and `2.50.0`; with `gh` missing it says `gh` is not installed; with `gh` 2.50.0 or newer it prints `ok` with the version; in every case the setup goes on.

## Out of scope

- Checking the `gh` version on every `deliver-check` call, or before any other `gh` call.
- Other `gh` features with a minimum version, and the silent call in `reportedWhere` of `github-setup.mjs`.
- Installing or updating `gh` for the owner.
