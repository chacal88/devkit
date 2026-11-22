<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the two defects of the 2026-11-20 field findings that round 17b left open, each reproduced on a scratch repository before its fix: `deliver-check --watch` returns at once with the checks still pending while its next step is `stop-merge-setup` (the ruleset comes after the first merge), instead of waiting for them; and `github-setup.mjs --checks ""` prints "the ruleset will require these checks, found on main: none" above a ruleset that requires `devkit-reviews`

Classification: domain=process type=bug flags=[contract] (strict-assumed: `deliver-check` and the `devkit-reviews` check are read by every project in merge mode).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The watch lives in `plugins/openspec/hooks/deliver-check.mjs` (the `opts.watch` branch of the main function, which today watches only when `nextStep(state).step` is `wait-checks` or `wait-merge`); the setup message lives in `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs` (the line that starts "the ruleset will require these checks"); the verdict reader is `readValue` in `plugins/openspec/hooks/guard.mjs`, used by `deliver-check.mjs`, `conduct-check.mjs` and the `devkit-reviews` check.
- Each defect is reproduced on a scratch repository (or a scratch project with a faked `gh`, as the existing suites do) before its fix, and the reproduction becomes the test that was red before the fix.
- Defect 1 (field item 9): with the next step `stop-merge-setup` and the pull request's checks still pending, `deliver-check --watch` waits for the checks within its minute cap, as it does for `wait-checks`, and then reports the contract again; it still ends on `stop-merge-setup` when the repository is not prepared.
- Defect 2 (field item 11): `github-setup.mjs --checks ""` prints the checks the ruleset it writes will really require (`devkit-reviews` at least), never "none" above a ruleset that requires a check.
- Defect 3 (field item 10, added by the owner): a verdict file with two `Verdict:` lines (the stage-1 text the writer pastes below its findings) is read by every reader from its first `Verdict:` line only; the second is ignored without a message. `readValue` already takes the first match; the plan checks every reader of a verdict (the panel included) and proves the case with a test.
- Field item 12 (the release notes do not say when a new `devkit-reviews` check verifies less than the one before) stays out of this change and stays in the owner's field findings.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `watch-waits-during-merge-setup` — on a scratch repository whose pull request has pending checks and whose next step is `stop-merge-setup`, `deliver-check --watch` does not return until the checks finish or its minute cap ends, and its report then shows the checks' final state.
- AC-2 `setup-lists-required-checks` — `github-setup.mjs --checks ""` on a scratch repository prints the checks the ruleset will require, `devkit-reviews` included, and never prints "none" above a ruleset that requires a check.
- AC-3 `first-verdict-line-wins` — a verdict file with two `Verdict:` lines that disagree is read as its first line's verdict by `deliver-check`, by the `devkit-reviews` check and by every other reader of verdicts in the repository.
- AC-4 `red-before-fix` — each of the three defects has a test that fails on the code before its fix and passes after it.

## Out of scope

- Field item 12 (a warning in the release notes when the `devkit-reviews` check verifies less than before).
- Any other behaviour of `deliver-check --watch` (its minute cap, the `wait-checks` and `wait-merge` waits) and of `github-setup.mjs`.

## Questions asked

1. [scope] Two more field defects are open besides the two of the request: a verdict file with a second `Verdict:` line (item 10) and release notes that do not warn when the check verifies less (item 12). Which does the change cover? → The two of the request and item 10; item 12 stays recorded.
2. [end effect] When a verdict file carries two `Verdict:` lines, what does the owner see? → The first one counts for every reader (`deliver-check`, the `devkit-reviews` check, the panel); the second is ignored without a message.

## Escalations

- None.
