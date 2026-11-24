<!-- devkit-stage tasks result=passed attempt=1 commit=0d5aebd77d65b21a557a827f185b6a4e65d3f815 -->
# Tasks

Change: `roadmap-panel-study` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

This change is a study. Its one deliverable is
`openspec/changes/roadmap-panel-study/design.md`, the written recommendation, in the fixed form
given in "The design's form" below: its headings, its table columns and its labelled lines are
literal; what goes into the cells and the prose is the study. No file under `plugins/` or `scripts/`
changes, no test, hook, mock-up, ADR or spec is written, and no pack's version moves.

**Who does the tasks.** The loop hands the phase to `tdd-implementer`, which does it like any other
phase: it runs commands, reads files and writes `design.md` inside the change's folder. There is no
product code, so there is no test to write first; the red half is task 1.1's run of the design check
on the base, and the gate's design check stands for the test.

**How to work.** Work only in this change's worktree, on its branch, with
`TMPDIR=/private/tmp/devkit-roadmap-panel-study` for temporary files. Do not fetch. Every file is in
English (`scripts/check.py` refuses Portuguese prose): the mock's labels and the owner's planning
page are in Portuguese and are rendered in English, never quoted. The owner's reference is named
only as "another project's side pane": no project name, no screenshot, no file and no path of it
enters the repository. The reference's fields are known only from `requirements.md` and the round
22b and 23 lines of `openspec/roadmap.md`; nothing about it is guessed beyond them, and a point they
do not settle is an open point (O-n) of the grill input.

**The gate.** The gate is one backticked command, run as written: the flow takes the first
backticked text after `Gate:` and runs each `&&` part on its own, so no part holds a pipe, a
backtick or a nested `&&`. Its `node -e` part is the design check: it reads the file named after it
and prints one message per broken rule of the form below, or `design ok: ...`. It was proved in
planning on the base (exit 1, `no openspec/changes/roadmap-panel-study/design.md`), on a sample
that follows the form (exit 0) and on a sample with four broken rules (exit 1, four messages). The
two `git` parts prove AC-7's first half: no file under `plugins/` or `scripts/` is changed,
untracked or different from the merge base with `origin/main`. On the base every part but the
design check already exits 0.

**After the implementation.** `openspec/config.yaml` declares neither `devkit.tests.unit` nor
`devkit.tests.e2e`, so the flow skips the `unit-tests` and `e2e-tests` stages (their `appliesWhen`);
no suite is written and none is run for them. What a study is checked by is the gate: the design
check (each AC's section is in `design.md`, in form), `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, the two `git` parts and
`openspec validate roadmap-panel-study --strict`. The hook suite
(`node --test plugins/openspec/hooks/guard.test.mjs`) is not part of the gate: no file it tests
changes, which the `git` parts prove. `pr-verifier` runs the gate for `evidence.md` and may paste the
board and the state JSON there too (AC-6 accepts either place).

| AC | Tasks |
|---|---|
| AC-1 | 1.4, 1.9 |
| AC-2 | 1.5, 1.9 |
| AC-3 | 1.6, 1.9 |
| AC-4 | 1.7, 1.9 |
| AC-5 | 1.8, 1.9 |
| AC-6 | 1.3, 1.9 |
| AC-7 | 1.2, 1.9 |

## 1. The recommendation (AC-1 to AC-7)

- [x] 1.1 Run the design check (the `node -e` part of gate 1.9, alone) on the base and see it exit 1
  with `no openspec/changes/roadmap-panel-study/design.md`. Check: that exit and that message, the
  red half of this phase. (AC-1 to AC-6)
- [x] 1.2 Read the sources and write the head of
  `openspec/changes/roadmap-panel-study/design.md` as the form gives it: the title on line 1, the
  `Change:` line, the intro paragraph and `## Sources`, one bullet per source with its path and what
  the study took from it. Read at least: `requirements.md` of this change (whole, its Assumptions
  included: the views were answered, one board, option B kept with its cost); the round 22b, 23,
  23b, 23c and 24 lines of `openspec/roadmap.md`; `docs/coordination-design.md` sections 6 (D-6), 9
  (D-9), 11 (D-11) and "Where a change runs"; `docs/adr/0010-openspec-as-the-harness.md` (its
  Decision, its review trigger and its alternatives), `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`,
  `docs/adr/0017-a-change-state-is-derived-in-one-place.md`,
  `docs/adr/0020-a-change-can-run-on-another-machine.md` and
  `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`; `plugins/panel/README.md`,
  `plugins/panel/.claude-plugin/plugin.json`, every entry of `plugins/panel/hooks/` (the `.ts` and
  `.tsx` files and `hooks.json` whole; `panel.test.tsx`, `report.test.tsx` and `fixtures/` for what
  they pin) and `plugins/panel/types/`; the mock under
  `openspec/changes/archive/2026-11-19-orchestrator-replan/mock/` (`canvas.json` and the five
  `.dc.html` screens, `Manager.dc.html` first; the planning page only for context); the `state`
  command of `plugins/openspec/hooks/change-loop.mjs` and the fields of its JSON; the `status`
  command and the board of `plugins/openspec/hooks/roadmap-loop.mjs`, its `--json` form included;
  `plugins/openspec/hooks/run-file.mjs` and `plugins/openspec/hooks/machine-probe.mjs`; and
  `openspec/changes/archive/2026-11-23-change-budget/proposal.md` for the budget field. Check: the
  design check prints no message about line 1; `git status --porcelain -- plugins scripts` prints
  nothing. (AC-7)
- [x] 1.3 Write `## The real run`. Run, from the worktree, with the `TMPDIR` above,
  `node plugins/openspec/hooks/roadmap-loop.mjs status --lang en --load-limit 80 --machines '[]'`
  and `node plugins/openspec/hooks/change-loop.mjs state --change roadmap-panel-study --lang en`.
  Under `### The board` and `### The state of this change`, write each command line, then its whole
  output verbatim in a fenced block (`text` for the board, `json` for the state), and above them the
  `Printed on:` line with the local date and time of the run. The requirement's counts (8 waiting
  for you, 13 under way, 12 in the queue, 35 archived) were the grill's snapshot; the board moves
  with the run (at planning time it read 2 waiting, 21 under way, 12 in the queue, 35 archived), so
  the board printed now is the real one, and a print on a day other than 2026-11-23 says so in one
  line. Then one short paragraph per group of the board saying what it shows, and each thing on the
  board the study cannot explain from the sources (for example the header `Roadmap: 9 open of 2` at
  planning time) as a sentence that task 1.8 turns into an open point. Check: the design check
  prints no message about `### The board`, `### The state of this change`, `Printed on:`, the
  board's header or the state JSON. (AC-6)
- [x] 1.4 Write `## Fields of the reference`: the table of the form, one row per field, exactly the
  21 rows R-1 to R-21 in the form's order and wording. For each: the reference's view it belongs to
  (`roadmap`, `factory` or `both`, from the descriptions in `requirements.md` and the round 22b and
  23 lines); `taken` or `dropped` for the one board; for a taken field, the command, JSON field or
  file it is read from, in backticks (for a dropped one, `none` or the source it would have had);
  and `given`, `partly (G-n)` or `missing (G-n)` for what the commands give today. A field marked
  `given` is visible in the outputs pasted in task 1.3 or named by a field of the state JSON; a
  machine row reads the board's machine column. Below the table, one line per dropped field saying
  why, and one line per `partly` field saying which part is missing. Check: the design check prints
  no message naming an `R-` row. (AC-1)
- [x] 1.5 Write `## Views` in the form: the recommended answer A, one board for a roadmap run
  (counts on top: waiting for you, working, in line, asleep, delivered; a strip of rounds as wagons
  with their counts; one card per change; the foot line "who owes: you (n) / agents (n)"), as the
  coordinating session answered under the owner's delegation on 2026-11-23; option B, two switchable
  views as in the reference (a roadmap view and a factory view), with its cost (a second layout to
  draw, test and translate in both panel languages, and a switch the owner must learn) and what B
  would show that A does not; and the `Answer in one word: A or B` line. Check: the design check
  prints no message naming `Views`. (AC-2)
- [x] 1.6 Write `## Extend or replace devkit-panel`: the `Decision: replace` line, citing the
  `coordination-cleanup` line of `openspec/roadmap.md`, D-11 of `docs/coordination-design.md`
  ("What stays shipped until its round") and ADR 0010, as decided, not re-decided; then the table of
  the form with one row per entry of `plugins/panel/hooks/` as `ls` lists it when the task runs (15
  at planning time: `commands.ts`, `conducted.ts`, `detail.ts`, `fixtures/`, `grammar.ts`,
  `hooks.json`, `i18n.ts`, `pane.tsx`, `panel.test.tsx`, `project.ts`, `register.tsx`,
  `report.test.tsx`, `report.ts`, `sessions.ts`, `steps.ts`), each `reused`, `reused with changes`
  or `dropped`, with why. Weigh in each why: what the file reads today (`conduct-check` and
  `deliver-check`, which round 24 removes; the child sessions of ADR 0006); D-6 and the requirement's
  rule that a press only opens a detail, a document or a session (the prompt-filling buttons of
  `commands.ts` included); the open path `mcp__ccd_window__open_session_in` of `sessions.ts`; and the
  per-person language of D-9 (`i18n.ts`). One line after the table names what outside `hooks/`
  (`types/`, `README.md`, the pack's manifest) follows the same fate, without deciding the removal,
  which is `coordination-cleanup`'s. Check: the design check prints no message naming a file or
  the `Decision:` line. (AC-3)
- [x] 1.7 Write `## What the pane reads` with its three subsections. `### Sources read`: a table of
  each source (`change-loop.mjs state`, `roadmap-loop.mjs status` and its `--json` form,
  `openspec/roadmap.md`, the run file `<git common dir>/devkit/roadmap-run.json`, the per-person
  `machines` setting and the board's machine column of `remote-worker`), what it gives and which
  `R-` rows read it; and whether the board's machine column covers another machine's changes or
  needs `machine-probe.mjs` over SSH (ADR 0020). `### The refresh rule`: when the pane reads, weighed
  against today's panel (a light refresh every 60 s while the pane is open, a full one on a press, a
  15-minute back-off on a rate limit, all in `plugins/panel/hooks/register.tsx`), the board's cost
  (each listed machine asked over SSH, 20 s at most each, ADR 0020) and ADR 0021's check about every
  30 minutes; the pane writes nothing, starts nothing and schedules nothing beyond its own refresh
  while it is open. `### Fields no command gives today`: one line per gap, `- G-n `, naming the
  field (its `R-` id), the command that should give it and the fact it lacks (for example the age
  of a change's work and a change's share of its budget). Check: the design check prints no message
  naming `What the pane reads` or a `G-` id. (AC-4)
- [x] 1.8 Write `## Beside the approved mock` and `## Grill input for coordination-panels`, the
  last section. The first says which screen of the `orchestrator-replan` mock the board stands for
  (the roadmap coordinator's, `Manager.dc.html`), how the two differ field by field, and what of the
  other four screens stays for `coordination-panels` to weigh; the band above the prompt box
  (`Band.dc.html`) overlaps `run-status-bar` and is only noted. The second holds only lines, each
  copyable as it stands into `coordination-panels`' requirements: `- D-n ` for each decision the
  study records (the views, the replacement, the read-only rule, the sources, the refresh rule) and
  `- O-n ` for each open point (every `G-` gap, by its id; every board line task 1.3 could not
  explain; the owner's one-word answer on the views while it is not given). Check: the design check
  prints no message naming the grill input or a `G-` id. (AC-5)
- [x] 1.9 Gate: `test -z "$(git status --porcelain -- plugins scripts)" && git diff --quiet "$(git merge-base HEAD origin/main)" -- plugins scripts && node -e 'const fs=require("fs");if(!fs.existsSync(process.argv[1])){console.error("no "+process.argv[1]);process.exit(1)}const P=String.fromCharCode(124);const B=String.fromCharCode(96);const t=fs.readFileSync(process.argv[1],"utf8");const L=t.split("\n");const bad=[];const no=(c,m)=>{if(!c)bad.push(m)};no(L[0]=="# Design: the side pane of a roadmap run","line 1 is not the title");const H=["## Sources","## The real run","## Fields of the reference","## Views","## Extend or replace devkit-panel","## What the pane reads","## Beside the approved mock","## Grill input for coordination-panels"];const hs=L.filter(l=>l.startsWith("## "));no(hs.join("\n")==H.join("\n"),"the ## headings are not, in order: "+H.join(", "));const sec=(h)=>{const i=L.indexOf(h);if(i<0)return [];const r=[];for(let j=i+1;j<L.length;j++){if(L[j].startsWith("## "))break;r.push(L[j])}return r};const has=(s,x)=>s.some(l=>l.includes(x));no(t.includes("another project\x27s side pane"),"the reference is not named as another project\x27s side pane");const run=sec("## The real run");no(has(run,"### The board"),"no ### The board");no(has(run,"### The state of this change"),"no ### The state of this change");no(run.some(l=>/^Printed on: \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(l)),"no Printed on: line");no(has(run,"Roadmap: "),"the board\x27s header line is not pasted");no(has(run,"\"change\": \"roadmap-panel-study\""),"the state JSON of this change is not pasted");const F=["Count: demands","Count: working","Count: ready","Count: waiting for you","Count: asleep","Count: delivered","Header line: n of m delivered","Strip of rounds: one wagon per round with its count","Row of figures: one per change","Card: number","Card: stage icon","Card: stage dots","Card: state in words","Card: age of the work","Card: reason of a wait","Card: acts: you / the agent","Card: machine","Card: Open link to the session","Ahead list: the next round\x27s changes","Foot line: who owes: you (n) / agents (n)","Card: share of the budget"];const cells=(l)=>l.split(P).slice(1,-1).map(c=>c.trim());const rows=sec("## Fields of the reference").filter(l=>l.startsWith(P+" R-")).map(cells);no(rows.length==F.length,"field rows: "+rows.length+" of "+F.length);const G=new Set();rows.forEach((r,i)=>{const id="R-"+(i+1);no(r.length==6,id+" has not 6 cells");no(r[0]==id,"row "+(i+1)+" is not "+id);no(r[1]==F[i],id+" is not "+F[i]);no(["roadmap","factory","both"].includes(r[2]),id+" view is not roadmap, factory or both");no(["taken","dropped"].includes(r[3]),id+" is not taken or dropped");no(r[3]=="dropped"?true:(r[4]??"").includes(B),id+" taken but no source in backticks");const m=(r[5]??"").replace(/^partly /,"missing ").match(/^missing \((G-\d+)\)$/);no((r[5]=="given")?true:!!m,id+" today is not given, partly (G-n) or missing (G-n)");if(m)G.add(m[1])});const vw=sec("## Views");["Recommended: A (one board)","Option B: two views","Cost of B: ","Answer in one word: A or B"].forEach(x=>no(has(vw,x),"Views lacks "+x));const ex=sec("## Extend or replace devkit-panel");no(has(ex,"Decision: replace"),"no Decision: replace line");const er=ex.filter(l=>l.startsWith(P+" "+B)).map(cells);const names=fs.readdirSync("plugins/panel/hooks",{withFileTypes:true}).map(d=>d.name+(d.isDirectory()?"/":""));names.forEach(n=>{const k=er.filter(r=>r[0]==B+n+B);no(k.length==1,"file "+n+" has "+k.length+" rows");if(k.length==1)no(["reused","reused with changes","dropped"].includes(k[0][1]),"file "+n+" is not reused, reused with changes or dropped")});no(er.length==names.length,"file rows: "+er.length+" of "+names.length);const rd=sec("## What the pane reads");["### Sources read","### The refresh rule","### Fields no command gives today","change-loop.mjs state","roadmap-loop.mjs status","openspec/roadmap.md","roadmap-run.json","machines"].forEach(x=>no(has(rd,x),"What the pane reads lacks "+x));const gl=rd.filter(l=>/^- G-\d+ /.test(l)).map(l=>l.split(" ")[1]);no(gl.length>0,"no - G-n line");G.forEach(g=>no(gl.includes(g),g+" cited in the fields but not listed"));const gr=sec("## Grill input for coordination-panels").filter(l=>l.trim()!="");no(gr.length>0,"the grill input is empty");gr.forEach(l=>no(/^- [DO]-\d+ \S/.test(l),"grill line is not - D-n or - O-n: "+l.slice(0,60)));no(gr.some(l=>l.startsWith("- D-")),"no - D-n line");no(gr.some(l=>l.startsWith("- O-")),"no - O-n line");gl.forEach(g=>no(gr.some(l=>l.startsWith("- O-")?l.includes(g):false),g+" is in no - O-n line"));if(bad.length>0){console.error(bad.join("\n"));process.exit(1)}console.log("design ok: "+rows.length+" fields, "+er.length+" files, "+gl.length+" missing fields, "+gr.length+" grill lines")' openspec/changes/roadmap-panel-study/design.md && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate roadmap-panel-study --strict` green; covers AC-1 to AC-7.

## The design's form

`design.md` follows this skeleton. Angle brackets are filled in; everything else is literal. The
`##` headings are exactly these eight, in this order, and no other `##` heading appears. Table rows
are one physical line each. Ids are numbered from 1 in order of appearance: `R-` rows, `G-` lines,
`D-` and `O-` lines.

```markdown
# Design: the side pane of a roadmap run

Change: `roadmap-panel-study` · Date: <YYYY-MM-DD> · Owner: Kaue (chacal88) · PRD / tech spec: n/a

<one paragraph: what the study compares, another project's side pane against what devkit's commands give, and for whom (the grill of coordination-panels)>

## Sources

- <path or command>: <what the study took from it>

## The real run

Printed on: <YYYY-MM-DD HH:MM>

### The board

<the command line>

    (a fenced text block: the board, verbatim)

<one short paragraph per group of the board>

### The state of this change

<the command line>

    (a fenced json block: the state, verbatim)

## Fields of the reference

| Id | Field | View | Decision | Read from | Today |
|---|---|---|---|---|---|
| R-1 | Count: demands | <roadmap, factory or both> | <taken or dropped> | <source in backticks, or none> | <given, partly (G-n) or missing (G-n)> |
| R-2 | Count: working | ... |
| R-3 | Count: ready | ... |
| R-4 | Count: waiting for you | ... |
| R-5 | Count: asleep | ... |
| R-6 | Count: delivered | ... |
| R-7 | Header line: n of m delivered | ... |
| R-8 | Strip of rounds: one wagon per round with its count | ... |
| R-9 | Row of figures: one per change | ... |
| R-10 | Card: number | ... |
| R-11 | Card: stage icon | ... |
| R-12 | Card: stage dots | ... |
| R-13 | Card: state in words | ... |
| R-14 | Card: age of the work | ... |
| R-15 | Card: reason of a wait | ... |
| R-16 | Card: acts: you / the agent | ... |
| R-17 | Card: machine | ... |
| R-18 | Card: Open link to the session | ... |
| R-19 | Ahead list: the next round's changes | ... |
| R-20 | Foot line: who owes: you (n) / agents (n) | ... |
| R-21 | Card: share of the budget | ... |

<one line per dropped field: why; one line per partly field: what is missing>

## Views

Recommended: A (one board)

<what A shows, top to bottom>

Option B: two views

<what B shows that A does not>

Cost of B: <the second layout to draw, test and translate, the switch to learn, and anything else found>

Answer in one word: A or B

## Extend or replace devkit-panel

Decision: replace

<why, citing the coordination-cleanup line, D-11 and ADR 0010>

| File | Fate | Why |
|---|---|---|
| `<entry of plugins/panel/hooks/, a folder with a trailing slash>` | <reused, reused with changes or dropped> | <why> |

<one line on what outside hooks/ follows the same fate>

## What the pane reads

### Sources read

| Source | What it gives | Rows |
|---|---|---|

### The refresh rule

<when the pane reads, and what it never does>

### Fields no command gives today

- G-<n> <R-id>: <the field>; <the command that should give it>; <the fact it lacks>

## Beside the approved mock

<the board against the mock's roadmap coordinator screen, and what of the other screens stays>

## Grill input for coordination-panels

- D-<n> <a decision, as a requirement line>
- O-<n> <an open point, naming its G- id when it has one>
```

The two indented "(a fenced ... block)" lines stand for real fenced blocks in `design.md`; they are
written indented here only so this skeleton stays one fence.

## Plan notes

- Estimate: optimistic 2 h, likely 3 h, pessimistic 5 h (one session, one file).

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| Sources and the real run (1.1 to 1.3) | 1 | Documentation | LOW |
| Fields, views, extend or replace (1.4 to 1.6) | 1 | Documentation | MEDIUM |
| Reads, mock, grill input (1.7, 1.8) | 0.5 | Documentation | MEDIUM |
| Gate (1.9) | 0.5 | Testing | LOW |

- Risk: a field is marked `given` that the commands do not really give (probability MEDIUM, impact
  MEDIUM: `coordination-panels` would plan on a field that is not there). Mitigation: task 1.4 ties
  each `given` to the outputs pasted in task 1.3 or a named field of the state JSON.
- Risk: the reference is described beyond what the owner said, or named (probability LOW, impact
  HIGH: the repository is public). Mitigation: the reference is known only from `requirements.md`
  and the roadmap lines; the check requires the phrase "another project's side pane"; the review
  bench reads the file.
- Risk: Portuguese text from the mock or the planning page enters `design.md` (probability MEDIUM,
  impact LOW: `scripts/check.py` fails). Mitigation: render labels in English; the gate runs
  `scripts/check.py`.
- Risk: `plugins/panel/hooks/` gains or loses an entry before the gate runs, after a merge of main
  (probability LOW, impact LOW). Mitigation: the check lists the folder when it runs, and task 1.6
  writes one row per entry it lists.
- Assumption: the board command and the state command run on this machine without `gh` errors
  (planning ran both on 2026-11-23 with exit 0). If either fails, its error is pasted verbatim and
  becomes an open point; the study does not fix the commands (out of scope).
- Assumption: `origin/main` is present locally for the merge-base part of the gate (it was at
  planning, `c1ac8c4`).
