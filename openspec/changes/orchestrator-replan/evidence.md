Commit: d3a9928df5d8e55a29099d4a58ea0cc0833f7bdf

# Evidence

Verified at HEAD d3a9928 with a clean working tree. Proof is read from the delivered files, not from task ticks. Every gate part ran as its own command, in the order the delivery checker lists them, and its exit code decided. A part repeated across gates (the first two parts of 1.9 and 2.7, check.py and gen-catalog in 3.2) is one row naming each gate; it was run each time it appeared and exited 0 every time. The suite (part of 3.2) ran once, as its own background command, output to a file, after the short parts.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.9, 2.7 | `node --test --test-name-pattern="^ADR 00" --test-name-pattern="^README" --test-name-pattern="^docs sweep" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs" --test-name-pattern="^the hook docs" --test-name-pattern="^review round: text" --test-name-pattern="^release-rebase pin: the real" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 23 tests, 23 pass, 0 fail |
| 1.9, 2.7, 3.2 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 1.9 | `grep -qx -- "- Status: accepted" docs/adr/0010-openspec-as-the-harness.md` | pass: exit 0 |
| 1.9 | `grep -qx -- "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)" docs/adr/0001-coordination-without-a-harness.md` | pass: exit 0 |
| 1.9 | `grep -qx -- "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)" docs/adr/0007-one-change-on-request.md` | pass: exit 0 |
| 1.9 | `grep -qF "ADR 0010" docs/adr/0006-phases-as-child-sessions.md` | pass: exit 0 |
| 1.9 | `grep -qF "ADR 0010" docs/adr/0008-reviews-as-a-workflow.md` | pass: exit 0 |
| 1.9 | `grep -qF "ADR 0010" docs/adr/0009-compozy-loop-as-a-second-driver.md` | pass: exit 0 |
| 1.9 | `test "$(grep -c '^## .*(D-[0-9]*)$' docs/coordination-design.md)" = 13` | pass: exit 0 |
| 1.9 | `grep -qF "openspec/changes/orchestrator-replan/mock/" docs/coordination-design.md` | pass: exit 0 |
| 1.9 | `grep -qF "docs/coordination-design.md" CLAUDE.md` | pass: exit 0 |
| 1.9 | `grep -qF "docs/coordination-design.md" README.md` | pass: exit 0 |
| 1.9 | `test -f openspec/changes/orchestrator-replan/mock/canvas.json` | pass: exit 0 |
| 1.9 | `test -f openspec/changes/orchestrator-replan/mock/planning-page.pt-BR.html` | pass: exit 0 |
| 1.9 | `test -f openspec/changes/orchestrator-replan/mock/Band.dc.html` | pass: exit 0 |
| 1.9 | `test -f openspec/changes/orchestrator-replan/mock/Help.dc.html` | pass: exit 0 |
| 1.9 | `test -f openspec/changes/orchestrator-replan/mock/Main.dc.html` | pass: exit 0 |
| 1.9 | `test -f openspec/changes/orchestrator-replan/mock/Manager.dc.html` | pass: exit 0 |
| 1.9 | `test -f openspec/changes/orchestrator-replan/mock/Stage.dc.html` | pass: exit 0 |
| 2.7 | `openspec validate orchestrator-replan --strict` | pass: exit 0, change is valid (--strict) |
| 2.7 | `openspec instructions design --change orchestrator-replan --json > "${TMPDIR:-/tmp}/orchestrator-replan-design.json" 2>&1` | pass: exit 0 |
| 2.7 | `! grep -qF "ignoring this artifact" "${TMPDIR:-/tmp}/orchestrator-replan-design.json"` | pass: exit 0 |
| 2.7 | `grep -qF "Record any decision that changes an ADR" "${TMPDIR:-/tmp}/orchestrator-replan-design.json"` | pass: exit 0 |
| 2.7 | `grep -qF "A sentence saying a test pins a behaviour" "${TMPDIR:-/tmp}/orchestrator-replan-design.json"` | pass: exit 0 |
| 2.7 | `grep -qF "Read the ADRs' rejected alternatives" "${TMPDIR:-/tmp}/orchestrator-replan-design.json"` | pass: exit 0 |
| 2.7 | `grep -qF "0001 coordination without a harness, superseded by 0010" openspec/config.yaml` | pass: exit 0 |
| 2.7 | `grep -qF "0007 one change on request, superseded by 0010" openspec/config.yaml` | pass: exit 0 |
| 2.7 | `node plugins/openspec/hooks/guard.mjs session <<< "{}" > "${TMPDIR:-/tmp}/orchestrator-replan-session.txt"` | pass: exit 0 |
| 2.7 | `grep -qF "Roadmap: Round 14: the script and the checker (0/1 done)" "${TMPDIR:-/tmp}/orchestrator-replan-session.txt"` | pass: exit 0 |
| 2.7 | `! grep -nF -e "- [ ] commit-and-pr-trailer" -e "- [ ] conventions-trailer" -e "- [ ] review-writer-prompt" -e "- [ ] ac-clause-coverage" -e "- [ ] compozy-loop-v2-dogfood" -e "- [ ] release-pin-in-release-files" openspec/roadmap.md` | pass: exit 0 |
| 2.7 | `test "$(grep -c '^- \[x\] ' openspec/roadmap.md)" = 11` | pass: exit 0 |
| 2.7 | `! grep -nF -e "Coordination is allowed; a harness is not" -e "## Why no harness" -e "enforce without a harness" README.md` | pass: exit 0 |
| 2.7 | `! grep -nF "never a harness that replaces it" docs/compozy-kit.md` | pass: exit 0 |
| 2.7 | `grep -qF "ADR 0010" docs/openspec-flow.md` | pass: exit 0 |
| 2.7 | `! grep -qF "OpenSpec) without a harness" plugins/openspec/README.md` | pass: exit 0 |
| 2.7 | `grep -qF "0010-openspec-as-the-harness.md" plugins/openspec/README.md` | pass: exit 0 |
| 2.7 | `python3 -c "import json,sys; sys.exit(0 if json.load(open('plugins/openspec/.claude-plugin/plugin.json'))['version']=='0.14.2' else 1)"` | pass: exit 0 |
| 2.7 | `python3 -c "import json,sys; m=json.load(open('.claude-plugin/marketplace.json')); sys.exit(0 if [p['version'] for p in m['plugins'] if p['name']=='devkit-openspec']==['0.14.2'] else 1)"` | pass: exit 0 |
| 2.7 | `python3 -c "import json,sys; sys.exit(0 if json.load(open('.claude-plugin/marketplace.json'))['metadata']['version']=='0.18.1' else 1)"` | pass: exit 0 |
| 2.7 | `grep -q "^## 0.18.1 " CHANGELOG.md` | pass: exit 0 |
| 2.7 | `grep -qF "pinned to the commit of v0.14.2" docs/openspec-flow.md` | pass: exit 0 |
| 2.7 | `grep -qF "<commit sha of v0.14.2>" docs/openspec-flow.md` | pass: exit 0 |
| 2.7 | `grep -qF "git/ref/tags/v0.14.2" docs/openspec-flow.md` | pass: exit 0 |
| 2.7 | `! grep -qF "v0.14.1" docs/openspec-flow.md` | pass: exit 0 |
| 2.7, 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output (catalog up to date) |
| 3.2 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 671 tests, 671 pass, 0 fail |
| 3.2 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate .` | pass: exit 0, "Validation passed" using the bundled binary |
| 3.2 | `git diff --quiet origin/main -- 'plugins/*/agents/*' 'plugins/*/skills/*' 'plugins/*/schemas/*'` | pass: exit 0 |
| 3.2 | `git diff --quiet origin/main -- 'plugins/*/hooks/*' ':!plugins/openspec/hooks/guard.test.mjs'` | pass: exit 0 |
| 3.2 | `git diff --quiet origin/main -- plugins/core/.claude-plugin plugins/design/.claude-plugin plugins/stack/.claude-plugin plugins/ai-engineering/.claude-plugin plugins/panel/.claude-plugin plugins/compozy/.claude-plugin docs/catalog.md` | pass: exit 0 |
| 3.2 | `test -z "$(git ls-files --others --exclude-standard -- plugins)"` | pass: exit 0 |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | ADR 0010 recorded, accepted, supersedes 0001 and 0007 | docs/adr/0010-openspec-as-the-harness.md line 3 is "- Status: accepted" and line 6 is "- Supersedes: ADR 0001 (...) and ADR 0007 (...)". Its Alternatives table has its header at line 179, the separator at line 180 and 11 option rows at lines 181-191 (counted with awk over table lines from line 181: 11; the file has 191 lines). The 11 options: keep ADR 0001's model and fix /conduct, app child sessions per stage, a long-running orchestrator session, a single-platform design, devkit's own harness, a Stop hook, ADR 0007 kept, the whole delivery as one Workflow script, one more exception in ADR 0001's Note, remove /conduct now, keep child sessions for implementation phases only. ADR 0001 and ADR 0007 carry "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)" at line 3; ADRs 0006, 0008 and 0009 each carry a "Note (ADR 0010, 2026-11-19)" (0006 line 10, 0008 line 9, 0009 line 9). Gate parts for the status lines and ADR notes pass. | pass |
| AC-2 | Design document complete and linked | docs/coordination-design.md has 13 sections tagged (D-1) to (D-13) (gate part count = 13), a stage table with rows 0 to 15 (16 rows, section 4), delivery models in section 5 (two pull requests, trunk-based, trunk-based with automatic merge), the lock table in section 8 (8 rows, counted), the build order table in section 11 (12 steps), an Open points list of 13 items (counted), and it names openspec/changes/orchestrator-replan/mock/ (lines 190-191, section 6). CLAUDE.md and README.md link it (gate parts pass). Marking audit, all 13 sections read in full: every decision, proposal and open question carries decided, proposed or open, either on the item or as a section-level statement (D-9 "All decided by the owner", D-10 and D-13 "All proposed", D-11 "decided", D-12 "decided as findings", D-4 "stages decided; agents, skills and gates proposed"; D-1, D-2, D-3, D-5, D-6, D-7, D-8 per item). Paragraphs with no mark are statements of fact or location, not decisions: "devkit knows only the last two today" (D-5), "Where the approved mock lives" (D-6), "Today" (D-7), "What the hooks can do (checked on 2026-11-19)" (D-8), the closing note of D-11 on step 1 and the after: reasoning. One loose end: the grouped-session view is marked open in D-3 ("open until that test") and listed under D-13 to prove, but is not in the Open points list; this is a minor inconsistency, not a missing mark. | pass |
| AC-3 | Roadmap rewritten | git diff --stat origin/main...HEAD -- openspec/roadmap.md: 34 insertions, 11 deletions. openspec/roadmap.md has Rounds 14 to 24 as new sections (11 unticked lines, steps 2 to 12 of D-11) and 11 ticked lines; the gate parts show no unticked line of the six ids remains and 11 ticked lines are kept. guard.mjs session reports "Roadmap: Round 14: the script and the checker (0/1 done)". | pass |
| AC-4 | No file states ADR 0001 or 0007 as the rule in force | Sweep of the requested grep over README.md CLAUDE.md CONTRIBUTING.md docs plugins/*/README.md openspec/config.yaml gave 9 hits (README.md:64, docs/openspec-flow.md:3, docs/adr/0009 line 74, plugins/openspec/README.md:3, docs/adr/0001 lines 1, 12, 17 and 28, openspec/config.yaml:22), each read: README.md:64 names ADR 0001 only as superseded by ADR 0010; docs/openspec-flow.md:3 says no orchestrator session runs today and that ADR 0010 adds coordinators, a description of shipped machinery; plugins/openspec/README.md:3 says the same of today's state and names ADR 0010; docs/adr/0009 line 74 is a row of ADR 0009's own alternatives table, a historical record, and the ADR carries the ADR 0010 Note; docs/adr/0001 lines 1, 12, 17 and 28 are the body of the ADR now marked superseded at line 3; openspec/config.yaml:22 lists 0001 as "superseded by 0010". CLAUDE.md and CONTRIBUTING.md have no hit. None states the old rule as in force. The earlier wider reading (docs/compozy-kit.md, docs/coordination-design.md open point) is covered by the gate parts that refuse the old phrases. config.yaml ADRs line lists 0010 and both supersessions (gate parts pass). | pass |
| AC-5 | Mock and page kept | openspec/changes/orchestrator-replan/mock/ holds Band.dc.html, Help.dc.html, Main.dc.html, Manager.dc.html, Stage.dc.html, canvas.json and planning-page.pt-BR.html (ls, 7 files; gate parts pass); docs/coordination-design.md names the folder at line 191. | pass |
| AC-6 | Gates green and only the allowed plugin changes | check.py, gen-catalog --check, plugin validate and the whole suite pass (671 tests, 671 pass, 0 fail). git diff --stat origin/main...HEAD -- plugins shows 3 files: plugins/openspec/.claude-plugin/plugin.json (2 lines), plugins/openspec/README.md (2 lines) and plugins/openspec/hooks/guard.test.mjs (39 lines: 37 insertions, 2 deletions), 39 insertions and 4 deletions in all. Under plugins/*/hooks/* only guard.test.mjs differs (git diff --stat -- 'plugins/*/hooks/*': 1 file), and the agents, skills and schemas paths show no change (empty diff stat; gate parts pass). The test diff adds the two tests named "ADR 0010 is accepted, supersedes ADR 0001 and ADR 0007, and the config names it" and "config.yaml rules: no list item is an unquoted string holding ": " ...". Whole-branch diffstat: 37 files changed. | pass |
| AC-7 | Design rules load | openspec instructions design --change orchestrator-replan --json prints no "ignoring this artifact" text and returns the three rules (gate parts pass); the config.yaml diff changes exactly the third rules.design entry to a quoted string. | pass |

## Defects

None found.
