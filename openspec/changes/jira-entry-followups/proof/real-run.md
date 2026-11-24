# Real-run proof of D-1: the round marks the `Commit:` line from git

Change `jira-entry-followups`, task 2.5. Every command below was run for real on a scratch clone of this worktree (one clone per run, under `/private/tmp/devkit-jira-entry-followups/real-run/`, removed afterwards), with this worktree's `review-round.mjs`, `review-round.workflow.js` and `deliver-check.mjs`. `$WT` is this worktree, `$CLONE` the clone of the run, `$IN` its folder of input files and `$RUN` the folder of the run.

What is real: the `tree`, `stage1`, `verify`, `outcomes` and `check-file` CLI calls, the Workflow script run by `node` with the tool globals of `review-round.test.mjs`'s harness, and `deliver-check.mjs` on the clone. What stands in for a model: the reviewers' stage-1 answers (fixed JSON, with one nit, so every verdict is approved) and the writer of stage 3, which here writes the file by reading its prompt line by line (line 1, line 2, a blank line, the heading, `### Findings`, the lines, the sections). Real reviewer agents writing their own files on the new line 2 are this change's own review round, recorded in `review.md`.

| Run | Tree | Stage-1 answer | Path | `dirty` | Line 2 of the writer prompts | reviews item of deliver-check | Holds |
|---|---|---|---|---|---|---|---|
| 1 | openspec-only | without uncommitted | agents | `[]` | `Commit: d15d3e6...` | 2 met      reviews at head: 2 reviews at head | yes |
| 2 | openspec-only | without uncommitted | workflow | `[]` | `Commit: d15d3e6...` | 2 met      reviews at head: 2 reviews at head | yes |
| 3 | openspec-only | with uncommitted: true | agents | `[]` | `Commit: d15d3e6...` | 2 met      reviews at head: 2 reviews at head | yes |
| 4 | openspec-only | with uncommitted: true | workflow | `[]` | `Commit: d15d3e6...` | 2 met      reviews at head: 2 reviews at head | yes |
| 5 | src-dirty | without uncommitted | agents | `["src/a.mjs"]` | `Commit: d15d3e6... (uncommitted changes)` | 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitt | yes |
| 6 | src-dirty | without uncommitted | workflow | `["src/a.mjs"]` | `Commit: d15d3e6... (uncommitted changes)` | 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitt | yes |
| 7 | src-dirty | with uncommitted: true | agents | `["src/a.mjs"]` | `Commit: d15d3e6... (uncommitted changes)` | 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitt | yes |
| 8 | src-dirty | with uncommitted: true | workflow | `["src/a.mjs"]` | `Commit: d15d3e6... (uncommitted changes)` | 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitt | yes |

8 of 8 runs hold.

# Run 1: tree openspec-only, stage-1 answer without uncommitted, agents path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: only openspec/ files dirty: design.md edited, evidence.md written
$ git status --short
 M openspec/changes/jira-entry-followups/design.md
 M openspec/changes/jira-entry-followups/tasks.md
?? openspec/changes/jira-entry-followups/evidence.md
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"agents","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}

## The agents path: stage1, verify, outcomes

input stage1.json: {"args":"<args above>"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs stage1 --input $IN/stage1.json
{"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"}]}
[exit 0]

stage-1 prompt of code-quality-reviewer: the rule sentence and the JSON shape line
```text
The round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.
End your reply with one fenced json block holding one object: { declined: boolean, commit: "<the full sha git rev-parse HEAD printed>", heading: "<your ## title line>", read: ["<repo-relative path you opened>"], notRead: ["<path of your remit you did not open>"], findings: [ { id: "F1", severity: "blocking|important|nit|praise", location: "<file:line or section>", text: "<one line>", disposition: null or "fixed in <one sha>" or "refuted: <evidence>" } ], sections: "<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>" }.
```
the shape line holds the word "uncommitted": false

stage-1 answers ($RUN/in/stage1-answers.json): {"code-quality-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null}],"sections":"Scratch round: no other remarks."},"test-coverage-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","heading":"## test-coverage-reviewer - jira-entry-followups","read":["plugins/core/skills/r ...

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs verify --input $IN/verify.json
{"jobs":[],"failed":[]}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs outcomes --input $IN/outcomes.json
{"outcomes":[{"reviewer":"code-quality-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":false,"heading":"## code-quality-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"},{"reviewer":"test-coverage-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":false,"heading":"## test-coverage-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"}],"failed":[],"verifiersFailed":0,"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4\na blank line, then this heading line:\n## code-quality-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4\na blank line, then this heading line:\n## test-coverage-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"}]}
[exit 0]

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt of code-quality-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```
writer prompt of test-coverage-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is stale (no Commit: line); no p [...]
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (no Commit: line); no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
2/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 1: line 2 plain: true; check-file exits [0,0]; reviews item: 2 met      reviews at head: 2 reviews at head
Run 1 holds: true

# Run 2: tree openspec-only, stage-1 answer without uncommitted, workflow path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: only openspec/ files dirty: design.md edited, evidence.md written
$ git status --short
 M openspec/changes/jira-entry-followups/design.md
 M openspec/changes/jira-entry-followups/tasks.md
?? openspec/changes/jira-entry-followups/evidence.md
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"workflow","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}

## The workflow path: review-round.workflow.js run by node with the tool globals of the test harness

The agent global answers a reviewer from the stage-1 answers and a writer by writing its file as the prompt says; calls are listed as they happen.

stage-1 answer returned for code-quality-reviewer (the other one is alike): {"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","severity":"nit","locati ...

phases: review, verify, write; agent calls: review code-quality-reviewer; review test-coverage-reviewer; write code-quality-reviewer write; write test-coverage-reviewer write
result: consensus PASS, failed [], outcomes code-quality-reviewer approved commit d15d3e6 uncommitted=false | test-coverage-reviewer approved commit d15d3e6 uncommitted=false

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```
writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is stale (no Commit: line); no p [...]
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (no Commit: line); no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
2/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 2: line 2 plain: true; check-file exits [0,0]; reviews item: 2 met      reviews at head: 2 reviews at head
Run 2 holds: true

# Run 3: tree openspec-only, stage-1 answer with uncommitted: true, agents path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: only openspec/ files dirty: design.md edited, evidence.md written
$ git status --short
 M openspec/changes/jira-entry-followups/design.md
 M openspec/changes/jira-entry-followups/tasks.md
?? openspec/changes/jira-entry-followups/evidence.md
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"agents","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}

## The agents path: stage1, verify, outcomes

input stage1.json: {"args":"<args above>"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs stage1 --input $IN/stage1.json
{"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"}]}
[exit 0]

stage-1 prompt of code-quality-reviewer: the rule sentence and the JSON shape line
```text
The round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.
End your reply with one fenced json block holding one object: { declined: boolean, commit: "<the full sha git rev-parse HEAD printed>", heading: "<your ## title line>", read: ["<repo-relative path you opened>"], notRead: ["<path of your remit you did not open>"], findings: [ { id: "F1", severity: "blocking|important|nit|praise", location: "<file:line or section>", text: "<one line>", disposition: null or "fixed in <one sha>" or "refuted: <evidence>" } ], sections: "<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>" }.
```
the shape line holds the word "uncommitted": false

stage-1 answers ($RUN/in/stage1-answers.json): {"code-quality-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null}],"sections":"Scratch round: no other remarks."},"test-coverage-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## test-coverage-reviewer - jira-entry-fol ...

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs verify --input $IN/verify.json
{"jobs":[],"failed":[]}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs outcomes --input $IN/outcomes.json
{"outcomes":[{"reviewer":"code-quality-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":false,"heading":"## code-quality-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"},{"reviewer":"test-coverage-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":false,"heading":"## test-coverage-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"}],"failed":[],"verifiersFailed":0,"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4\na blank line, then this heading line:\n## code-quality-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4\na blank line, then this heading line:\n## test-coverage-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"}]}
[exit 0]

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt of code-quality-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```
writer prompt of test-coverage-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is stale (no Commit: line); no p [...]
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (no Commit: line); no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
2/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 3: line 2 plain: true; check-file exits [0,0]; reviews item: 2 met      reviews at head: 2 reviews at head
Run 3 holds: true

# Run 4: tree openspec-only, stage-1 answer with uncommitted: true, workflow path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: only openspec/ files dirty: design.md edited, evidence.md written
$ git status --short
 M openspec/changes/jira-entry-followups/design.md
 M openspec/changes/jira-entry-followups/tasks.md
?? openspec/changes/jira-entry-followups/evidence.md
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"workflow","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":[]}

## The workflow path: review-round.workflow.js run by node with the tool globals of the test harness

The agent global answers a reviewer from the stage-1 answers and a writer by writing its file as the prompt says; calls are listed as they happen.

stage-1 answer returned for code-quality-reviewer (the other one is alike): {"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","seve ...

phases: review, verify, write; agent calls: review code-quality-reviewer; review test-coverage-reviewer; write code-quality-reviewer write; write test-coverage-reviewer write
result: consensus PASS, failed [], outcomes code-quality-reviewer approved commit d15d3e6 uncommitted=false | test-coverage-reviewer approved commit d15d3e6 uncommitted=false

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```
writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is stale (no Commit: line); no p [...]
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is stale (no Commit: line); no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
2/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 4: line 2 plain: true; check-file exits [0,0]; reviews item: 2 met      reviews at head: 2 reviews at head
Run 4 holds: true

# Run 5: tree src-dirty, stage-1 answer without uncommitted, agents path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: src/a.mjs dirty (untracked product file)
$ git status --short
 M openspec/changes/jira-entry-followups/tasks.md
?? src/
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"agents","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}

## The agents path: stage1, verify, outcomes

input stage1.json: {"args":"<args above>"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs stage1 --input $IN/stage1.json
{"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"}]}
[exit 0]

stage-1 prompt of code-quality-reviewer: the rule sentence and the JSON shape line
```text
The round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.
End your reply with one fenced json block holding one object: { declined: boolean, commit: "<the full sha git rev-parse HEAD printed>", heading: "<your ## title line>", read: ["<repo-relative path you opened>"], notRead: ["<path of your remit you did not open>"], findings: [ { id: "F1", severity: "blocking|important|nit|praise", location: "<file:line or section>", text: "<one line>", disposition: null or "fixed in <one sha>" or "refuted: <evidence>" } ], sections: "<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>" }.
```
the shape line holds the word "uncommitted": false

stage-1 answers ($RUN/in/stage1-answers.json): {"code-quality-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null}],"sections":"Scratch round: no other remarks."},"test-coverage-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","heading":"## test-coverage-reviewer - jira-entry-followups","read":["plugins/core/skills/r ...

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs verify --input $IN/verify.json
{"jobs":[],"failed":[]}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs outcomes --input $IN/outcomes.json
{"outcomes":[{"reviewer":"code-quality-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## code-quality-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"},{"reviewer":"test-coverage-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## test-coverage-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"}],"failed":[],"verifiersFailed":0,"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)\na blank line, then this heading line:\n## code-quality-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)\na blank line, then this heading line:\n## test-coverage-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"}]}
[exit 0]

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt of code-quality-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```
writer prompt of test-coverage-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is missing; no passing row in ev [...]
  2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
1/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 5: line 2 marked: true; check-file exits [0,0]; reviews item: 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
Run 5 holds: true

# Run 6: tree src-dirty, stage-1 answer without uncommitted, workflow path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: src/a.mjs dirty (untracked product file)
$ git status --short
 M openspec/changes/jira-entry-followups/tasks.md
?? src/
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"workflow","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}

## The workflow path: review-round.workflow.js run by node with the tool globals of the test harness

The agent global answers a reviewer from the stage-1 answers and a writer by writing its file as the prompt says; calls are listed as they happen.

stage-1 answer returned for code-quality-reviewer (the other one is alike): {"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","severity":"nit","locati ...

phases: review, verify, write; agent calls: review code-quality-reviewer; review test-coverage-reviewer; write code-quality-reviewer write; write test-coverage-reviewer write
result: consensus PASS, failed [], outcomes code-quality-reviewer approved commit d15d3e6 uncommitted=true | test-coverage-reviewer approved commit d15d3e6 uncommitted=true

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```
writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is missing; no passing row in ev [...]
  2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
1/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 6: line 2 marked: true; check-file exits [0,0]; reviews item: 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
Run 6 holds: true

# Run 7: tree src-dirty, stage-1 answer with uncommitted: true, agents path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: src/a.mjs dirty (untracked product file)
$ git status --short
 M openspec/changes/jira-entry-followups/tasks.md
?? src/
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"agents","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}

## The agents path: stage1, verify, outcomes

input stage1.json: {"args":"<args above>"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs stage1 --input $IN/stage1.json
{"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 1 of a staged review round for change jira-entry-followups (round 1 of 2).\nChange folder: openspec/changes/jira-entry-followups\nReview range: main..HEAD\nReview as your own instructions say, but write no file: a later stage writes your verdict file. Run every test in the foreground and give your answer when it ends: start no background command and leave none running.\nRun git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.\nThe round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.\nList in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.\nA disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.\nsections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.\nEnd your reply with one fenced json block holding one object: { declined: boolean, commit: \"<the full sha git rev-parse HEAD printed>\", heading: \"<your ## title line>\", read: [\"<repo-relative path you opened>\"], notRead: [\"<path of your remit you did not open>\"], findings: [ { id: \"F1\", severity: \"blocking|important|nit|praise\", location: \"<file:line or section>\", text: \"<one line>\", disposition: null or \"fixed in <one sha>\" or \"refuted: <evidence>\" } ], sections: \"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>\" }.\nFinding ids are F1, F2, ... in order, one per finding, praise included. The commit is the output of git rev-parse HEAD, never a short or padded sha.\n"}]}
[exit 0]

stage-1 prompt of code-quality-reviewer: the rule sentence and the JSON shape line
```text
The round writes your Commit line itself, from git: it adds (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under .claude/ does not count); report nothing about it.
End your reply with one fenced json block holding one object: { declined: boolean, commit: "<the full sha git rev-parse HEAD printed>", heading: "<your ## title line>", read: ["<repo-relative path you opened>"], notRead: ["<path of your remit you did not open>"], findings: [ { id: "F1", severity: "blocking|important|nit|praise", location: "<file:line or section>", text: "<one line>", disposition: null or "fixed in <one sha>" or "refuted: <evidence>" } ], sections: "<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>" }.
```
the shape line holds the word "uncommitted": false

stage-1 answers ($RUN/in/stage1-answers.json): {"code-quality-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null}],"sections":"Scratch round: no other remarks."},"test-coverage-reviewer":{"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## test-coverage-reviewer - jira-entry-fol ...

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs verify --input $IN/verify.json
{"jobs":[],"failed":[]}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs outcomes --input $IN/outcomes.json
{"outcomes":[{"reviewer":"code-quality-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## code-quality-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"},{"reviewer":"test-coverage-reviewer","declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## test-coverage-reviewer - jira-entry-followups","sections":"Scratch round: no other remarks.","findings":[{"id":"F1","severity":"nit","location":"review-round.mjs:1","text":"a nit of the scratch round","disposition":null,"status":"open"}],"lines":["- [nit] review-round.mjs:1 — a nit of the scratch round"],"verified":0,"refuted":0,"voteFailures":0,"verdict":"approved"}],"failed":[],"verifiersFailed":0,"jobs":[{"reviewer":"code-quality-reviewer","agentType":"devkit-core:code-quality-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)\na blank line, then this heading line:\n## code-quality-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"},{"reviewer":"test-coverage-reviewer","agentType":"devkit-core:test-coverage-reviewer","prompt":"This is stage 3 of a staged review round for change jira-entry-followups (round 1 of 2). Do not review again.\nWrite your verdict file openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md, overwriting it, and write nothing else.\nDo not change, add or drop a finding, and do not reword a line. The file is, in this order:\nline 1: exactly Verdict: approved (the round computed it: approved only when no blocking or important finding is left open)\nline 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)\na blank line, then this heading line:\n## test-coverage-reviewer - jira-entry-followups\na blank line, then the line: ### Findings\nthen these lines, verbatim:\n- [nit] review-round.mjs:1 — a nit of the scratch round\nthen a blank line, then this text, verbatim:\nScratch round: no other remarks.\nEnd your reply with one fenced json block: { written: boolean, verdict: \"<the verdict you wrote>\", commit: \"<the sha on line 2>\" }.\n"}]}
[exit 0]

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt of code-quality-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```
writer prompt of test-coverage-reviewer, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is missing; no passing row in ev [...]
  2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
1/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 7: line 2 marked: true; check-file exits [0,0]; reviews item: 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
Run 7 holds: true

# Run 8: tree src-dirty, stage-1 answer with uncommitted: true, workflow path

Setup of the scratch clone:

$ git clone -q $WT $CLONE
# a scratch clone of this worktree: its committed files only
(no output)
[exit 0]

$ git log --oneline -1
d15d3e6 fix(openspec): hand a plan fix inside the change folder to commit, then the re-review
[exit 0]

# this worktree's uncommitted files of the change, copied into the clone: openspec/changes/jira-entry-followups/tasks.md

# tree: src/a.mjs dirty (untracked product file)
$ git status --short
 M openspec/changes/jira-entry-followups/tasks.md
?? src/
[exit 0]

## The conducting session's part: review-round.mjs tree

input tree.json: {"root":"$CLONE"}
$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs tree --input $IN/tree.json
{"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}
[exit 0]

args, with head and dirty put in as the review skill says: {"change":"jira-entry-followups","changeDir":"openspec/changes/jira-entry-followups","round":1,"path":"workflow","range":"main..HEAD","structural":"PASS","preamble":"","bench":[{"reviewer":"code-quality-reviewer","previous":null,"range":null},{"reviewer":"test-coverage-reviewer","previous":null,"range":null}],"head":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","dirty":["src/a.mjs"]}

## The workflow path: review-round.workflow.js run by node with the tool globals of the test harness

The agent global answers a reviewer from the stage-1 answers and a writer by writing its file as the prompt says; calls are listed as they happen.

stage-1 answer returned for code-quality-reviewer (the other one is alike): {"declined":false,"commit":"d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4","uncommitted":true,"heading":"## code-quality-reviewer - jira-entry-followups","read":["plugins/core/skills/review-change/scripts/review-round.mjs"],"notRead":[],"findings":[{"id":"F1","seve ...

phases: review, verify, write; agent calls: review code-quality-reviewer; review test-coverage-reviewer; write code-quality-reviewer write; write test-coverage-reviewer write
result: consensus PASS, failed [], outcomes code-quality-reviewer approved commit d15d3e6 uncommitted=true | test-coverage-reviewer approved commit d15d3e6 uncommitted=true

### Line 2 of every writer prompt, and the files written as each prompt says

writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/code-quality-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```
writer prompt, line 2: Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
written: openspec/changes/jira-entry-followups/reviews/test-coverage-reviewer.md
```text
Verdict: approved
Commit: d15d3e6c7716e36ac79e7c22ff3031bbadedb6e4 (uncommitted changes)
```

### check-file on each written file

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-0.json
{"ok":true}
[exit 0]

$ node $WT/plugins/core/skills/review-change/scripts/review-round.mjs check-file --input $IN/check-1.json
{"ok":true}
[exit 0]

## deliver-check on the clone

$ cd $CLONE && node $WT/plugins/openspec/hooks/deliver-check.mjs jira-entry-followups
# item 1 (tasks and gates) is cut at 160 characters; the other lines are whole
deliver-check: jira-entry-followups (schema devkit, ship merge, host app, head d15d3e6)
  1 open     tasks and gates: unticked tasks: 2.5, 2.9, 3.1, 3.2, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.2, 5.9; evidence.md is missing; no passing row in ev [...]
  2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
  5 blocked  PR open at local head: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  6 blocked  required checks green: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  7 blocked  conversation answered: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
  8 blocked  PR body complete: cannot read the PR: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`
1/8 met: blocked: item 5
next: stop-branch: the current branch does not select change jira-entry-followups for the hooks; create or switch to a branch named after it
[exit 2]

Result of run 8: line 2 marked: true; check-file exits [0,0]; reviews item: 2 open     reviews at head: stale code-quality-reviewer (d15d3e6 was recorded with uncommitted changes); stale test-coverage-reviewer (d15d3e6 was recorded with uncommitted changes)
Run 8 holds: true

