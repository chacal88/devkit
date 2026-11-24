# Real-run proof, stale-only-on-own-files (AC-10)

Made by task 3.6, with the CLIs of the change's worktree (`$DEV`), not the test helpers.
Each case has a scratch repository under `$P` (`$TMPDIR/devkit-proof-stale-only-on-own-files`) built from one seed:
a bare `origin-<case>.git`, the change's clone `work-<case>` on branch `feat` and a sibling clone `sib-<case>` that
commits to `main` and pushes. The seed's `main` holds `src/a.ts`, `src/a.test.ts`, `src/b.ts`, `src/other.ts`, the release
files and a `devkit-lite` change `feat` (ship mode `pr`, tasks ticked); `feat` changes `src/a.ts` and `src/a.test.ts`, bumps
`CHANGELOG.md` and `plugins/p/.claude-plugin/plugin.json`, then records `evidence.md`, the two required reviews and the stage
records at that commit (`R`). The base is found from `GITHUB_BASE_REF` in CI and from `origin/HEAD` locally. `gh` has no GitHub
remote here, so items 5 to 8 read `blocked`; the cases read items 1, 2 and 4 and `next`: a current record gives `blocked` at item 5, a stale one gives `verify` or `review`. The environment has no `GITHUB_*`, `DEVKIT_*` variable.
The seed is built by a script (`seed.sh`) and the cases by another (`run.sh`); every command of a case is printed with its output.

Recorded commit `R` = `b6f66d2363ea4dc59c5aaa765fe02c8bc3ca9a1e`.

## Result

| Case | What the merge brings | Delivery checker | Stage checker | CI check (both entries) | AC |
|---|---|---|---|---|---|
| P-1 | `src/other.ts` and another change's `tasks.md` | items 1, 2, 4 met, next `blocked` (item 5, no GitHub remote), neither `verify` nor `review` | unit-tests, evidence, review passed | pass, exit 0 | AC-1, AC-8 |
| P-2 | `src/a.ts`, an own product file | items 1, 2, 4 open, next `verify`, reason names the merge and `src/a.ts` | unit-tests stale-code, same reason | fail, exit 1, same reason | AC-2, AC-8 |
| P-3 | `src/a.test.ts`, an own test file | items 1, 2, 4 open, next `verify`, names `src/a.test.ts` | unit-tests stale-code | fail, exit 1 | AC-2 |
| P-4 | `src/other.ts`, `src/b.ts` and `src/a.ts` | items 1, 2, 4 open, names `src/a.ts` (the own one) | unit-tests stale-code, names `src/a.ts` | fail, exit 1 | AC-3 |
| P-5 | release files only (`CHANGELOG.md` conflict resolved in the merge, `docs/catalog.md`, `marketplace.json`) | items 1, 2, 4 met, next `blocked` | all three passed | pass, exit 0 | AC-4 |
| P-6 | after P-1, a plain commit to `src/b.ts` | items 1, 2, 4 open, next `verify`, names the commit and `src/b.ts` | unit-tests stale-code | fail, exit 1 | AC-5 |
| P-7 | `origin` removed, local `main` merged, an unrelated file | items 1, 2, 4 open (today's verdict), names the merge and `src/other.ts` | unit-tests stale-code | not run (needs `origin/<base>`) | AC-7 |

## P-1 An unrelated merge of origin/main (AC-1, AC-8 pass)

The sibling changes `src/other.ts` and another change's `tasks.md`, then `feat` fetches and merges `origin/main`.

```text
$ cd $P/work-p1 && git fetch -q origin && git merge --no-ff -m 'merge origin/main' origin/main | tail -3
 src/other.ts                    | 2 +-
 2 files changed, 2 insertions(+), 1 deletion(-)
 create mode 100644 openspec/changes/other/tasks.md
```

Delivery checker (items 1, 2 and 4, and the next step):

```text
$ cd $P/work-p1 && node $DEV/plugins/openspec/hooks/deliver-check.mjs feat --json | jq -c '{next: .next.step, items: [.items[] | select(.id == 1 or .id == 2 or .id == 4) | {id, status, reason}]}'
{"next":"blocked","items":[{"id":1,"status":"met","reason":"all tasks ticked; 1 gate command green in evidence.md"},{"id":2,"status":"met","reason":"2 reviews at head"},{"id":4,"status":"met","reason":"1 criteria proven"}]}
```

Stage checker (code-bound stages):

```text
$ cd $P/work-p1 && node $DEV/plugins/openspec/hooks/flow-check.mjs feat --json | jq -c '{next: .next.stage, stages: [.stages[] | select(.id == "unit-tests" or .id == "evidence" or .id == "review") | {id, state, reasonCode, why: .params.why}]}'
{"next":null,"stages":[{"id":"unit-tests","state":"passed","reasonCode":"passed","why":null},{"id":"evidence","state":"passed","reasonCode":"passed","why":null},{"id":"review","state":"passed","reasonCode":"passed","why":null}]}
```

The check of CI (`GITHUB_BASE_REF=main`, the event file names the head), from both entries:

```text
$ cd $P/work-p1 && GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p1.json node $DEV/plugins/openspec/hooks/deliver-check.mjs --ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head 482a394)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
pass
exit=0
```

```text
$ cd $P/work-p1 && echo '{}' | GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p1.json node $DEV/plugins/openspec/hooks/guard.mjs ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head 482a394)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
pass
exit=0
```

### P-6 A plain product commit after the exempt merge of P-1 (AC-5)

In the same clone, `feat` commits a change to `src/b.ts` (a plain commit, not a merge of the base).

```text
$ cd $P/work-p1 && echo 'edit on the branch' >> src/b.ts && git add -A && git commit -q -m 'plain product commit' && git log --oneline -3
dfdaa59 plain product commit
482a394 merge origin/main
03073cf sibling: unrelated files
```

Delivery checker (items 1, 2 and 4, and the next step):

```text
$ cd $P/work-p1 && node $DEV/plugins/openspec/hooks/deliver-check.mjs feat --json | jq -c '{next: .next.step, items: [.items[] | select(.id == 1 or .id == 2 or .id == 4) | {id, status, reason}]}'
{"next":"verify","items":[{"id":1,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind dfdaa59, which touches src/b.ts)"},{"id":2,"status":"open","reason":"stale code-quality-reviewer (b6f66d2 is behind dfdaa59, which touches src/b.ts); stale test-coverage-reviewer (b6f66d2 is behind dfdaa59, which touches src/b.ts)"},{"id":4,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind dfdaa59, which touches src/b.ts)"}]}
```

Stage checker (code-bound stages):

```text
$ cd $P/work-p1 && node $DEV/plugins/openspec/hooks/flow-check.mjs feat --json | jq -c '{next: .next.stage, stages: [.stages[] | select(.id == "unit-tests" or .id == "evidence" or .id == "review") | {id, state, reasonCode, why: .params.why}]}'
{"next":"unit-tests","stages":[{"id":"unit-tests","state":"stale","reasonCode":"stale-code","why":"b6f66d2 is behind dfdaa59, which touches src/b.ts"},{"id":"evidence","state":"blocked","reasonCode":"waits-for","why":null},{"id":"review","state":"blocked","reasonCode":"waits-for","why":null}]}
```

The check of CI (`GITHUB_BASE_REF=main`, the event file names the head), from both entries:

```text
$ cd $P/work-p1 && GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p1.json node $DEV/plugins/openspec/hooks/deliver-check.mjs --ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head dfdaa59)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind dfdaa59, which touches src/b.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind dfdaa59, which touches src/b.ts); stale test-coverage-reviewer (b6f66d2 is behind dfdaa59, which touches src/b.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind dfdaa59, which touches src/b.ts)
fail: item 1, item 2, item 4
exit=1
```

```text
$ cd $P/work-p1 && echo '{}' | GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p1.json node $DEV/plugins/openspec/hooks/guard.mjs ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head dfdaa59)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind dfdaa59, which touches src/b.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind dfdaa59, which touches src/b.ts); stale test-coverage-reviewer (b6f66d2 is behind dfdaa59, which touches src/b.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind dfdaa59, which touches src/b.ts)
fail: item 1, item 2, item 4
exit=1
```

## P-2 The merge brings an own product file (AC-2, AC-8 fail)

The sibling edits the last line of `src/a.ts`, which `feat` changed (the first line), so the merge is clean.

```text
$ cd $P/work-p2 && git fetch -q origin && git merge --no-ff -m 'merge origin/main' origin/main | tail -3
Merge made by the 'ort' strategy.
 src/a.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Delivery checker (items 1, 2 and 4, and the next step):

```text
$ cd $P/work-p2 && node $DEV/plugins/openspec/hooks/deliver-check.mjs feat --json | jq -c '{next: .next.step, items: [.items[] | select(.id == 1 or .id == 2 or .id == 4) | {id, status, reason}]}'
{"next":"verify","items":[{"id":1,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind f83d527, which touches src/a.ts)"},{"id":2,"status":"open","reason":"stale code-quality-reviewer (b6f66d2 is behind f83d527, which touches src/a.ts); stale test-coverage-reviewer (b6f66d2 is behind f83d527, which touches src/a.ts)"},{"id":4,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind f83d527, which touches src/a.ts)"}]}
```

Stage checker (code-bound stages):

```text
$ cd $P/work-p2 && node $DEV/plugins/openspec/hooks/flow-check.mjs feat --json | jq -c '{next: .next.stage, stages: [.stages[] | select(.id == "unit-tests" or .id == "evidence" or .id == "review") | {id, state, reasonCode, why: .params.why}]}'
{"next":"unit-tests","stages":[{"id":"unit-tests","state":"stale","reasonCode":"stale-code","why":"b6f66d2 is behind f83d527, which touches src/a.ts"},{"id":"evidence","state":"blocked","reasonCode":"waits-for","why":null},{"id":"review","state":"blocked","reasonCode":"waits-for","why":null}]}
```

The check of CI (`GITHUB_BASE_REF=main`, the event file names the head), from both entries:

```text
$ cd $P/work-p2 && GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p2.json node $DEV/plugins/openspec/hooks/deliver-check.mjs --ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head f83d527)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind f83d527, which touches src/a.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind f83d527, which touches src/a.ts); stale test-coverage-reviewer (b6f66d2 is behind f83d527, which touches src/a.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind f83d527, which touches src/a.ts)
fail: item 1, item 2, item 4
exit=1
```

```text
$ cd $P/work-p2 && echo '{}' | GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p2.json node $DEV/plugins/openspec/hooks/guard.mjs ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head f83d527)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind f83d527, which touches src/a.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind f83d527, which touches src/a.ts); stale test-coverage-reviewer (b6f66d2 is behind f83d527, which touches src/a.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind f83d527, which touches src/a.ts)
fail: item 1, item 2, item 4
exit=1
```

## P-3 The merge brings an own test file (AC-2)

The sibling edits the last line of `src/a.test.ts`, a test file `feat` changed.

```text
$ cd $P/work-p3 && git fetch -q origin && git merge --no-ff -m 'merge origin/main' origin/main | tail -3
Merge made by the 'ort' strategy.
 src/a.test.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Delivery checker (items 1, 2 and 4, and the next step):

```text
$ cd $P/work-p3 && node $DEV/plugins/openspec/hooks/deliver-check.mjs feat --json | jq -c '{next: .next.step, items: [.items[] | select(.id == 1 or .id == 2 or .id == 4) | {id, status, reason}]}'
{"next":"verify","items":[{"id":1,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind cb49a92, which touches src/a.test.ts)"},{"id":2,"status":"open","reason":"stale code-quality-reviewer (b6f66d2 is behind cb49a92, which touches src/a.test.ts); stale test-coverage-reviewer (b6f66d2 is behind cb49a92, which touches src/a.test.ts)"},{"id":4,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind cb49a92, which touches src/a.test.ts)"}]}
```

Stage checker (code-bound stages):

```text
$ cd $P/work-p3 && node $DEV/plugins/openspec/hooks/flow-check.mjs feat --json | jq -c '{next: .next.stage, stages: [.stages[] | select(.id == "unit-tests" or .id == "evidence" or .id == "review") | {id, state, reasonCode, why: .params.why}]}'
{"next":"unit-tests","stages":[{"id":"unit-tests","state":"stale","reasonCode":"stale-code","why":"b6f66d2 is behind cb49a92, which touches src/a.test.ts"},{"id":"evidence","state":"blocked","reasonCode":"waits-for","why":null},{"id":"review","state":"blocked","reasonCode":"waits-for","why":null}]}
```

The check of CI (`GITHUB_BASE_REF=main`, the event file names the head), from both entries:

```text
$ cd $P/work-p3 && GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p3.json node $DEV/plugins/openspec/hooks/deliver-check.mjs --ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head cb49a92)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind cb49a92, which touches src/a.test.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind cb49a92, which touches src/a.test.ts); stale test-coverage-reviewer (b6f66d2 is behind cb49a92, which touches src/a.test.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind cb49a92, which touches src/a.test.ts)
fail: item 1, item 2, item 4
exit=1
```

```text
$ cd $P/work-p3 && echo '{}' | GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p3.json node $DEV/plugins/openspec/hooks/guard.mjs ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head cb49a92)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind cb49a92, which touches src/a.test.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind cb49a92, which touches src/a.test.ts); stale test-coverage-reviewer (b6f66d2 is behind cb49a92, which touches src/a.test.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind cb49a92, which touches src/a.test.ts)
fail: item 1, item 2, item 4
exit=1
```

## P-4 One own file among unrelated ones (AC-3)

The sibling edits `src/other.ts`, `src/b.ts` and `src/a.ts` in one commit; only `src/a.ts` is an own file and it is the one named.

```text
$ cd $P/work-p4 && git fetch -q origin && git merge --no-ff -m 'merge origin/main' origin/main | tail -3
 src/b.ts     | 2 +-
 src/other.ts | 2 +-
 3 files changed, 3 insertions(+), 3 deletions(-)
```

Delivery checker (items 1, 2 and 4, and the next step):

```text
$ cd $P/work-p4 && node $DEV/plugins/openspec/hooks/deliver-check.mjs feat --json | jq -c '{next: .next.step, items: [.items[] | select(.id == 1 or .id == 2 or .id == 4) | {id, status, reason}]}'
{"next":"verify","items":[{"id":1,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind 069353d, which touches src/a.ts)"},{"id":2,"status":"open","reason":"stale code-quality-reviewer (b6f66d2 is behind 069353d, which touches src/a.ts); stale test-coverage-reviewer (b6f66d2 is behind 069353d, which touches src/a.ts)"},{"id":4,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind 069353d, which touches src/a.ts)"}]}
```

Stage checker (code-bound stages):

```text
$ cd $P/work-p4 && node $DEV/plugins/openspec/hooks/flow-check.mjs feat --json | jq -c '{next: .next.stage, stages: [.stages[] | select(.id == "unit-tests" or .id == "evidence" or .id == "review") | {id, state, reasonCode, why: .params.why}]}'
{"next":"unit-tests","stages":[{"id":"unit-tests","state":"stale","reasonCode":"stale-code","why":"b6f66d2 is behind 069353d, which touches src/a.ts"},{"id":"evidence","state":"blocked","reasonCode":"waits-for","why":null},{"id":"review","state":"blocked","reasonCode":"waits-for","why":null}]}
```

The check of CI (`GITHUB_BASE_REF=main`, the event file names the head), from both entries:

```text
$ cd $P/work-p4 && GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p4.json node $DEV/plugins/openspec/hooks/deliver-check.mjs --ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head 069353d)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind 069353d, which touches src/a.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind 069353d, which touches src/a.ts); stale test-coverage-reviewer (b6f66d2 is behind 069353d, which touches src/a.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind 069353d, which touches src/a.ts)
fail: item 1, item 2, item 4
exit=1
```

```text
$ cd $P/work-p4 && echo '{}' | GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p4.json node $DEV/plugins/openspec/hooks/guard.mjs ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head 069353d)
  1 open     tasks and gates: evidence.md is stale (b6f66d2 is behind 069353d, which touches src/a.ts)
  2 open     reviews at head: stale code-quality-reviewer (b6f66d2 is behind 069353d, which touches src/a.ts); stale test-coverage-reviewer (b6f66d2 is behind 069353d, which touches src/a.ts)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (b6f66d2 is behind 069353d, which touches src/a.ts)
fail: item 1, item 2, item 4
exit=1
```

## P-5 The merge brings release files only (AC-4)

The sibling adds its own release entry to `CHANGELOG.md` (the same place `feat` bumped it, so the merge conflicts), edits `docs/catalog.md` and `.claude-plugin/marketplace.json`. The conflict is resolved in the merge, with both entries kept, as the release step does.

```text
$ cd $P/work-p5 && git fetch -q origin && (git merge --no-ff -m 'merge origin/main' origin/main 2>&1 | tail -3; git status --short)
Auto-merging CHANGELOG.md
CONFLICT (content): Merge conflict in CHANGELOG.md
Automatic merge failed; fix conflicts and then commit the result.
M  .claude-plugin/marketplace.json
UU CHANGELOG.md
M  docs/catalog.md
```

```text
$ cd $P/work-p5 && printf '# Changelog\n\n## 1.1.0\n- feat\n\n## 1.0.1\n- sibling\n\n## 1.0.0\n- start\n' > CHANGELOG.md && git add CHANGELOG.md && git commit -q --no-edit && git log --oneline --graph -4
*   e4a1e9d merge origin/main
|\  
| * 6d68d67 sibling: release files
* | 6dccc81 evidence and reviews
* | b6f66d2 release bump
```

Delivery checker (items 1, 2 and 4, and the next step):

```text
$ cd $P/work-p5 && node $DEV/plugins/openspec/hooks/deliver-check.mjs feat --json | jq -c '{next: .next.step, items: [.items[] | select(.id == 1 or .id == 2 or .id == 4) | {id, status, reason}]}'
{"next":"blocked","items":[{"id":1,"status":"met","reason":"all tasks ticked; 1 gate command green in evidence.md"},{"id":2,"status":"met","reason":"2 reviews at head"},{"id":4,"status":"met","reason":"1 criteria proven"}]}
```

Stage checker (code-bound stages):

```text
$ cd $P/work-p5 && node $DEV/plugins/openspec/hooks/flow-check.mjs feat --json | jq -c '{next: .next.stage, stages: [.stages[] | select(.id == "unit-tests" or .id == "evidence" or .id == "review") | {id, state, reasonCode, why: .params.why}]}'
{"next":null,"stages":[{"id":"unit-tests","state":"passed","reasonCode":"passed","why":null},{"id":"evidence","state":"passed","reasonCode":"passed","why":null},{"id":"review","state":"passed","reasonCode":"passed","why":null}]}
```

The check of CI (`GITHUB_BASE_REF=main`, the event file names the head), from both entries:

```text
$ cd $P/work-p5 && GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p5.json node $DEV/plugins/openspec/hooks/deliver-check.mjs --ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head e4a1e9d)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
pass
exit=0
```

```text
$ cd $P/work-p5 && echo '{}' | GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat GITHUB_EVENT_PATH=$P/event-p5.json node $DEV/plugins/openspec/hooks/guard.mjs ci; echo "exit=$?"
devkit-reviews: feat (schema devkit-lite, head e4a1e9d)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
pass
exit=0
```

## P-7 No origin/<base> (AC-7: today's verdict)

The sibling edits only `src/other.ts`. In the change's clone, local `main` is fast-forwarded to it, then `git remote remove origin` deletes every `origin/*` ref, then local `main` is merged. The checker has no base to read, so the strict rule applies and the unrelated merge is stale (CI cannot be run: it needs `origin/<base>`).

```text
$ cd $P/work-p7 && git fetch -q origin && git branch -f main origin/main && git remote remove origin && git branch -a && git merge --no-ff -m 'merge main' main | tail -3
branch 'main' set up to track 'origin/main'.
* feat
  main
Merge made by the 'ort' strategy.
 src/other.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Delivery checker (items 1, 2 and 4, and the next step):

```text
$ cd $P/work-p7 && node $DEV/plugins/openspec/hooks/deliver-check.mjs feat --json | jq -c '{next: .next.step, items: [.items[] | select(.id == 1 or .id == 2 or .id == 4) | {id, status, reason}]}'
{"next":"verify","items":[{"id":1,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind d50160f, which touches src/other.ts)"},{"id":2,"status":"open","reason":"stale code-quality-reviewer (b6f66d2 is behind d50160f, which touches src/other.ts); stale test-coverage-reviewer (b6f66d2 is behind d50160f, which touches src/other.ts)"},{"id":4,"status":"open","reason":"evidence.md is stale (b6f66d2 is behind d50160f, which touches src/other.ts)"}]}
```

Stage checker (code-bound stages):

```text
$ cd $P/work-p7 && node $DEV/plugins/openspec/hooks/flow-check.mjs feat --json | jq -c '{next: .next.stage, stages: [.stages[] | select(.id == "unit-tests" or .id == "evidence" or .id == "review") | {id, state, reasonCode, why: .params.why}]}'
{"next":"unit-tests","stages":[{"id":"unit-tests","state":"stale","reasonCode":"stale-code","why":"b6f66d2 is behind d50160f, which touches src/other.ts"},{"id":"evidence","state":"blocked","reasonCode":"waits-for","why":null},{"id":"review","state":"blocked","reasonCode":"waits-for","why":null}]}
```


## The seed

Run with `TMPDIR` set, `DEV` the worktree and `P=$TMPDIR/devkit-proof-stale-only-on-own-files`; each case then runs the commands printed above.

```bash
#!/bin/bash
# Builds the seed repository of the real-run proof: main, and feat with a product commit, a release bump and the recorded evidence and reviews.
set -euo pipefail
DEV=<the worktree of the change>
P=$TMPDIR/devkit-proof-stale-only-on-own-files
rm -rf "$P"; mkdir -p "$P/seed"; cd "$P/seed"
git init -q -b main; git config user.email proof@example.invalid; git config user.name proof
lines() { for i in $(seq 1 12); do if [ $i = 1 ]; then echo "$1"; elif [ $i = 12 ]; then echo "$2"; else echo "line $i"; fi; done; }
mkdir -p openspec/changes/archive openspec/changes/feat src/ docs .claude-plugin plugins/p/.claude-plugin
cp -r "$DEV/plugins/openspec/schemas" openspec/schemas
printf 'schema: devkit-lite\nship:\n  devkit-lite: pr\n' > openspec/config.yaml
touch openspec/changes/archive/.gitkeep
lines 'line 1' 'line 12' > src/a.ts; lines 'line 1' 'line 12' > src/a.test.ts
echo b > src/b.ts; echo other > src/other.ts
printf '# Changelog\n\n## 1.0.0\n- start\n' > CHANGELOG.md
echo '{"version":"1.0.0"}' > plugins/p/.claude-plugin/plugin.json; echo '{"version":"1.0.0"}' > .claude-plugin/marketplace.json; echo catalog > docs/catalog.md
printf 'schema: devkit-lite\ncreated: 2026-11-23\nskip_specs: true\n' > openspec/changes/feat/.openspec.yaml
hdr() { printf '<!-- devkit-stage %s result=passed attempt=1 commit=%s -->\n' "$1" "$2"; }
{ hdr proposal none; printf '# Proposal\n\n## Why\n\nProof.\n\n## Acceptance criteria\n\n- AC-1: something\n\n## Impact\n\nNone.\n'; } > openspec/changes/feat/proposal.md
{ hdr requirements none; printf '# Requirements\n\n- AC-1: something\n'; } > openspec/changes/feat/requirements.md
{ hdr tasks none; printf '## 1. First\n- [x] 1.1 code\n- [x] 1.2 Gate: `node -e 0` green\n'; } > openspec/changes/feat/tasks.md
git add -A; git commit -q -m initial
git switch -q -c feat
lines 'branch 1' 'line 12' > src/a.ts; lines 'branch 1' 'line 12' > src/a.test.ts
git add -A; git commit -q -m 'product and test'
printf '# Changelog\n\n## 1.1.0\n- feat\n\n## 1.0.0\n- start\n' > CHANGELOG.md; echo '{"version":"1.1.0"}' > plugins/p/.claude-plugin/plugin.json
git add -A; git commit -q -m 'release bump'
R=$(git rev-parse HEAD)
mkdir -p openspec/changes/feat/reviews
{ hdr unit-tests "$R"; printf '# unit-tests\n'; } > openspec/changes/feat/unit-tests.md
{ hdr e2e-tests "$R"; printf '# e2e-tests\n'; } > openspec/changes/feat/e2e-tests.md
{ hdr review "$R"; printf '# review\n'; } > openspec/changes/feat/review.md
for r in code-quality-reviewer test-coverage-reviewer; do printf 'Verdict: approved\nCommit: %s\n\n# Review\n' "$R" > openspec/changes/feat/reviews/$r.md; done
{ hdr evidence "$R"; printf 'Commit: %s\n\n# Evidence\n\n### Gates\n| gate | command | result |\n|---|---|---|\n| 1.2 | `node -e 0` | pass: ok |\n\n### Acceptance\n| AC | proof | result |\n|---|---|---|\n| AC-1 | proof | pass: t |\n' "$R"; } > openspec/changes/feat/evidence.md
git add -A; git commit -q -m 'evidence and reviews'
git switch -q main
echo "seed ready: R=$R"
```
