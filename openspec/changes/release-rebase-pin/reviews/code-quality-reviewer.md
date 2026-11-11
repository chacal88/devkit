Verdict: approved
Commit: 66b6041b362791ff6eed4b1c90ea537db7b2cd69

## Quality review — release-rebase-pin (round 1)

### Findings
- [nit] plugins/openspec/hooks/release-rebase.mjs:306-309 — the post-replay rewrite pushes `PIN_FILE` into `files` even when `setPins` changed no byte (for example base 0.10.3, the change did not bump the pack, and the file has no pin to move). The caller is told to commit a file that is not dirty. The docs say "listed in `files`", so this is consistent, but you could compare before writing and list the file only on a real change. · fix: `if (next !== current) { write; files.push }`.
- [nit] plugins/openspec/hooks/conduct-check.test.mjs:11 — `import { pinDoc } from './release-rebase.test.mjs'` registers the 32 release-rebase tests a second time whenever the conduct-check test file runs on its own. deliver-check.test.mjs is already imported the same way, so this follows a project pattern. · fix: move `pinDoc` to a small shared fixture module if the duplicate runtime starts to matter.
- [nit] plugins/openspec/hooks/conduct-check.mjs:378-382 — `threeVersions` swallows every `git show` failure into `null`, which `mergePins` treats as "blocking". That is the safe direction (a conflict that cannot be read is blocked, never auto-resolved). A short comment saying so would make it explicit.
- [praise] plugins/openspec/hooks/release-rebase.mjs:155-165 — `classifyConflict` is one shared predicate with an injected `stagesOf`. `conduct-check` (before any rebase, three blobs by `merge-base`) and `release-rebase` (at each stop, index stages `:1:/:2:/:3:`) use the same rule. `stagesOf` is called at most once and only for `PIN_FILE`. `RELEASE_FILE` and ADR 0003 stay untouched, and the new AC-7 test pins that.
- [praise] plugins/openspec/hooks/release-rebase.mjs:136-147 — `mergePins` removes its temporary folder in `finally`, fails closed (`null`) on a missing side or a non-zero `git merge-file` status, and the tests assert that no `devkit-pin-*` folder is left. The conduct-check test also asserts that HEAD and `git status` are unchanged.

### Acceptance (real output)
- `node --test plugins/openspec/hooks/release-rebase.test.mjs` run here: 32/32 pass, including the pin tests for AC-4, AC-5, AC-6 and the no-pack case.
- `node --test --test-name-pattern="conduct pin" plugins/openspec/hooks/conduct-check.test.mjs` run here: 3/3 pass (AC-1, AC-2, AC-3, including the archive PR).
- The full guard suite, `check.py`, the catalog check, the plugin validate and `openspec validate` were not re-run, per instruction. I take the conducting session's gate 2.9 result as given.
- AC-7 is pinned by the new deliver-check test. AC-8 is visible in the diff: the flow doc, the CHANGELOG 0.12.0 entry, the plugin version bump and the `v0.11.0` pin.

### Summary
- 3 findings (0 blocking, 0 important, 3 nit) + 2 praise
- Justification: I read the whole diff of the two hooks, the tests, the docs and the changelog against the requirements, the AC list and the tasks. I found no correctness, edge or contract defect. A conflict that cannot be read or merged is blocked, and an abort restores the old head. `conduct-check` can say "resolve" while the per-commit replay later finds a conflict, but the script then exits 2 and the branch is restored, so the failure is safe. The scope matches the proposal.
