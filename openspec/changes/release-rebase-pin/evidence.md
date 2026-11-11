Commit: af4055acf094de5228be025d780f5d611905f06c

# Evidence: release-rebase-pin

## Verification

### Gates

Two long gates were run by the conducting session, not by the verifier (the hook suite takes about 9 minutes). The rest were re-run by the verifier on af4055a.

| Gate | Command | Result |
|------|---------|--------|
| 1.9 / 2.9 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: conducting session's run on af4055a: tests 588, pass 588, fail 0 (on 66b6041, gate 2.9: 587/587); not re-run by the verifier |
| 1.9 / 2.9 | `python3 scripts/check.py` | pass: verifier re-run on af4055a, exit 0, "all checks passed" (conducting session: also all checks passed) |
| 2.9 | `python3 scripts/gen-catalog.py --check` | pass: verifier re-run, exit 0 (conducting session on 66b6041: pass) |
| 2.9 | `"$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude" plugin validate .` | pass: verifier re-run, exit 0, "Validation passed" |
| 2.9 | `openspec validate release-rebase-pin --strict` | pass: verifier re-run, exit 0, "Change 'release-rebase-pin' is valid" |

Targeted tests, run by the verifier on af4055a (all exit 0):

- `node --test --test-name-pattern="release-rebase pin" plugins/openspec/hooks/release-rebase.test.mjs`: 15 tests, 15 pass.
- `node --test --test-name-pattern="conduct pin" plugins/openspec/hooks/conduct-check.test.mjs`: 3 tests, 3 pass.
- `node --test --test-name-pattern="release list" plugins/openspec/hooks/deliver-check.test.mjs`: 1 test, 1 pass.

### Acceptance criteria

| AC | Criterion | Proof | Result |
|----|-----------|-------|--------|
| AC-1 | `conduct-check --json`, PR conflict in release files and a pin-only conflict in `docs/openspec-flow.md`, gives `resolve-release-conflict` with the file in `paths` | conduct-check.test.mjs "conduct pin: a change PR whose only conflicts are release files and the CI pin is resolve-release-conflict, and nothing is touched (AC-1)", throwaway git repos | pass |
| AC-2 | Same file also conflicting beyond the pin gives `blocked: item 5 (conflict in docs/openspec-flow.md)`, no `resolve-release-conflict` | conduct-check.test.mjs "conduct pin: both sides editing one paragraph of docs/openspec-flow.md is blocked (AC-2)" | pass |
| AC-3 | AC-1 and AC-2 hold for an archive PR (`blocked: archive (archive-pr): conflict in docs/openspec-flow.md` beyond the pin) | conduct-check.test.mjs "conduct pin: an archive PR conflicting in the CI pin only is resolve-release-conflict, beyond the pin it is blocked (AC-3)" | pass |
| AC-4 | `release-rebase.mjs --base <base> --json`, both sides move the pin and add text: exit 0, resolved, both texts present, all pins equal resolved version, file in `files`, edit uncommitted | release-rebase.test.mjs "both sides move the pin and add text apart, the rebase merges them and the worktree takes the resolved version (AC-4)"; plus the "two change commits that both touch the pin file" test | pass |
| AC-5 | Same paragraph edited on both sides: exit 2, `resolved: false`, `conflicts` names the file, branch at old head, worktree clean | release-rebase.test.mjs "both sides edit the same paragraph, the run aborts to the old head (AC-5)" | pass |
| AC-6 | Renumbered pack with no conflict in the doc: every pin rewritten and file in `files`; no bump by the change: every pin equals the base version | release-rebase.test.mjs "a renumbered pack with no conflict in the doc keeps the change commit and rewrites the worktree (AC-6)" and "a change that did not bump devkit-openspec takes the base version for every pin (AC-6)" | pass |
| AC-7 | `RELEASE_FILE` unchanged; `unnamedFiles` still reports `docs/openspec-flow.md` without an approved proposal naming it | deliver-check.test.mjs "release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)" | pass |
| AC-8 | Docs describe the rule in the "Release-file conflict" override and the "Classification" bullet; devkit-openspec 0.11.0 in plugin.json and marketplace.json; CHANGELOG entry; pin `v0.11.0`; guard.test.mjs and check.py green | `docs/openspec-flow.md` line 198 (override) and line 204 (Classification) describe the pin rule; line 209 also covers the rewrite; `plugins/openspec/.claude-plugin/plugin.json` version 0.11.0; `.claude-plugin/marketplace.json` devkit-openspec 0.11.0; `CHANGELOG.md` line 5 holds the devkit-openspec 0.11.0 entry; pin `v0.11.0` at `docs/openspec-flow.md` lines 460, 461, 468; check.py re-run green; guard.test.mjs 588/588 by the conducting session (see Gates) | pass |

No defect found. No UI, no PR comment (no PR exists yet), no screenshots.
