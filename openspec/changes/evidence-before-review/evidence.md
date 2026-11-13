Commit: b719a4127c59af0d6c5e12f9811d26fbdbe81409

# Evidence

Change: `evidence-before-review` · verified on branch `evidence-before-review` at the commit above (working tree clean). No PR exists yet, so there is no PR comment.

## Verification

### Gates

The guard suite ran once as a background Bash (668 tests, 0 fail, 483 s) and serves every gate that names it. The bundled binary's `plugin test --help` first printed the rollout-switch refusal; one `-p "ok" --max-turns 1 --model haiku` run refreshed it and the retry printed `Run a mod's tests`.

| Gate | Command | Result |
|---|---|---|
| 1.9 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: 668 tests, 668 pass, 0 fail |
| 2.9 | `node --test --test-name-pattern="instructions-follow" --test-name-pattern="format:" plugins/openspec/hooks/deliver-check.test.mjs` | pass: 32 tests, 0 fail |
| 2.9 | `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` | pass: 55 tests, 0 fail |
| 2.9 | `openspec schema validate devkit` | pass: Schema 'devkit' is valid |
| 2.9 | `openspec schema validate devkit-lite` | pass: Schema 'devkit-lite' is valid |
| 2.9 | `python3 scripts/check.py` | pass: all checks passed |
| 2.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 3.9 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` | pass: 165 tests, 0 fail |
| 3.9 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate plugins/panel` | pass: Validation passed (one ICON_MISSING directory warning, not a failure) |
| 3.9 | `node --test --test-name-pattern="instructions-follow" plugins/openspec/hooks/deliver-check.test.mjs` | pass: 3 tests, 0 fail |
| 4.9 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel` | pass: 165 tests, 0 fail |
| 4.9 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate .` | pass: marketplace Validation passed |
| 4.9 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: 668 tests, 0 fail |
| 4.9 | `python3 scripts/check.py` | pass: all checks passed |
| 4.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.9 | `openspec validate evidence-before-review` | pass: Change 'evidence-before-review' is valid |
| 5.9 | `node --test --test-name-pattern="release-ready" plugins/openspec/hooks/deliver-check.test.mjs` | pass: 1 test, 0 fail |
| 5.9 | `python3 scripts/check.py` | pass: all checks passed |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `evidence-first`: missing or stale evidence goes to `verify`, current evidence with no defect goes to `review` | Unit tests `AC-1 evidence-first: ...` (two) in `plugins/openspec/hooks/deliver-check.test.mjs` pass; the flipped walkthroughs `driveToReady` and merge mode pass in the guard suite. Dogfood: `node plugins/openspec/hooks/deliver-check.mjs evidence-before-review --json` at this HEAD reports `next.step` = `verify` ("evidence.md is missing, stale or lacks a gate or criterion row") while item 2 (reviews) is open ("missing code-quality-reviewer, test-coverage-reviewer"), so `verify` comes before any review on this change | pass |
| AC-2 | `defect-before-review`: a failing row at current evidence gives `fix-defect`, never `review`, with the reviewers missing, stale or approved | Test `AC-2 defect-before-review: ...` in `deliver-check.test.mjs` passes (guard suite, 668/0) | pass |
| AC-3 | `fix-restales-both`: after a fix commit outside `openspec/`, `verify` then `review` for the stale reviewers | Tests `AC-3 fix-restales-both (a)`, `(b)` and `(c)` (rejected review, fail row, failing check; (c) ends in `push`) pass in `deliver-check.test.mjs` | pass |
| AC-4 | `no-mutual-staleness`: reviews recorded after evidence, or the reverse, committed or not, leave the other current | Tests `AC-4 no-mutual-staleness: ...` (reviews after evidence; evidence after reviews; control with a `src/` commit in between turning both stale) pass in `deliver-check.test.mjs` | pass |
| AC-5 | `guards-kept`: `gh pr create` still refused without approved reviews or without evidence; `--ci` still fails on stale reviews or stale evidence | `AC-5 guards-kept: gh pr create is refused ...` in `plugins/openspec/hooks/guard.test.mjs` passes, as does the existing "gh pr create needs approved reviews and evidence"; two `AC-5 guards-kept: --ci ...` tests in `deliver-check.test.mjs` pass (items 1 and 4 for stale evidence, item 2 for stale reviews) | pass |
| AC-6 | `instructions-follow`: schemas, config template, `openspec/config.yaml`, `ship-change`, `conduct`, flow doc and core README describe `pr-verifier` before `review-change`; no text keeps the old order | `AC-6 instructions-follow` test passes (schema copies identical, positive markers, `OLD_ORDER` scan over `git ls-files`); `format:` tests pass (32); `openspec schema validate devkit` and `devkit-lite` valid; `review-round.test.mjs` 55 pass; `check.py` and `gen-catalog.py --check` exit 0 | pass |
| AC-7 | `panel-order`: `Passos` shows `Provas` before `Revisão`; while next step is `verify`, `Revisão` is pending | Two `AC-7 panel-order` tests (`report.test.tsx`: Proofs current, Review pending, `Depois` line; `panel.test.tsx`: both surfaces draw Provas current then Revisão pending) pass in `plugin test plugins/panel` (165 pass, 0 fail) | pass |
| AC-8 | `release-ready`: versions bumped in `plugin.json` and `marketplace.json`, CHANGELOG entry, CI pin at `v0.13.0`, CONTRIBUTING tag rule, and `v0.13.0` free on `origin` and locally before the PR | Test `AC-8 release-ready: ...` passes (versions match: openspec 0.13.0, core 0.6.2, panel 0.2.1, marketplace metadata 0.16.0; doc pin names `v0.13.0`; CONTRIBUTING holds the tag rule with "merge commit" and "lightweight"). `CHANGELOG.md` tops with `## 0.16.0 — evidence before review`. The pin test "the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version" passes in the guard suite. Re-run now: `git ls-remote --tags origin refs/tags/v0.13.0` printed nothing (exit 0) and `git tag --list v0.13.0` printed nothing. The conducting session's 5.1 record (scratchpad `release-tag-free.md`, 2026-11-13T11:16Z) shows the same two empty outputs and `"version": "0.13.0"` | pass |

Outcome: verified
