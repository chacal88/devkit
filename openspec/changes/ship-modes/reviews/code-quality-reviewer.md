Verdict: rejected
Commit: c15ff9b5443255278571f6b9b90b385219998c2e

## Quality review — ship-modes (round 1)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:821 — the id check `/^[\w.-]+$/` accepts `.` and `..`, so `deliver-check ..` resolves `openspec/changes/..` (the `openspec/` folder) as a change. Run for real: it prints a report for "change" `..` (schema devkit-lite, `1 blocked ... openspec/changes/../tasks.md does not exist`) and exits 2 instead of 3 "unknown change" (AC-10 preflight); `.` behaves the same. The test at deliver-check.test.mjs:1407 covers unknown/missing/archive only. · fix: reject ids that are `.`/`..` (or require a leading `[\w]`), and add the two ids to that test.
- [important] plugins/openspec/hooks/deliver-check.mjs:524-529 — `spoke` also counts the viewer's last word in review threads, so a reply in thread A makes every earlier top-level comment or review body by a person count as answered. Design D4 item 7 (design.md:96) says "newer than the viewer's latest comment or review" (top-level only). The code is more lenient than the written rule and can report item 7 `met` (and `ready`) with a person's comment still unanswered; no test pins this case. · fix: build `spoke` from top-level comments and reviews only (drop line 527), and add a test where the viewer replies in a thread after a person's top-level comment.

### Nits
- [nit] plugins/openspec/hooks/deliver-check.mjs:488-489 — `comments(last: 100)` and `reviews(last: 100)` have no `hasNextPage` guard, unlike threads (line 513). Beyond 100 items the oldest drop silently, including possibly the viewer's own replies. Blocking like the threads case, or documenting the cap, would match the "cannot tell" stance.
- [nit] plugins/openspec/hooks/deliver-check.mjs:7-9 — `node:fs` is imported in two statements and `join, basename` etc. could be merged; `staleness` for evidence is also computed twice in `tasksItem` (lines 262 and 272).
- [nit] plugins/openspec/hooks/deliver-check.mjs:127,130 — the comment on `dirtyPaths` and the docs say `.claude/` is excluded, but only untracked `.claude/` files are; a tracked, modified `.claude/` file makes every review stale. Align the wording or the code.
- [nit] plugins/openspec/hooks/deliver-check.mjs:173-176 — one `diff-tree` spawn per commit since the recorded sha, per review file. Fine at this size (the real run on this change took about 1 s) but linear in branch length times files; one `git log --name-only -m` per distinct sha would remove it.

### Praise
- [praise] plugins/openspec/hooks/guard.mjs:409-422 — the `isMain()` guard with `realpathSync` makes the helpers importable without inheriting the dispatch or `DEVKIT_BYPASS`'s exit 0, and handles symlinked plugin caches. Both behaviors have their own tests (guard.test.mjs, "symlinked path" and "importing guard.mjs runs no mode").
- [praise] plugins/openspec/hooks/deliver-check.mjs:61-96 — `parseShip` fails loudly and names the key for every invalid shape (scalar, nested map, duplicate, `merge`) instead of silently falling back to `plan`.
- [praise] plugins/openspec/hooks/deliver-check.mjs:163-180 — the staleness rule is one pure function with a human reason per failure, handling merge commits (`-m`), `openspecx/` look-alikes and unresolvable shas.

### Summary
- 6 findings (0 blocking, 2 important, 4 nit) + 3 praise
- Justification: read deliver-check.mjs in full, the guard.mjs diff, the agent diffs for this file's own format, tasks.md and design D4. Ran `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`: 173 tests pass, "all checks passed". Ran the CLI on this change for real output: `0/8 met`, exit 1, `evidence.md is missing`. That is expected before `pr-verifier`, whose acceptance proof is a later gate in tasks.md, so I did not count it as blocking. It means AC proof is still pending and must exist before approval of the delivery. Rejected only because the two important findings have neither a fix nor a contest; both are small, local fixes.
