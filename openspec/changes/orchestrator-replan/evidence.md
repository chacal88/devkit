Commit: e6ea4e53955bdd5d53848413ba381083bec4ce7d

# Evidence

Verified at HEAD e6ea4e5 with a clean working tree. Proof is read from the delivered files, not from task ticks. Every gate part ran as its own command, in the order the delivery checker lists them, and its exit code decided.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.9, 2.7 | `node --test --test-name-pattern="^ADR 00" --test-name-pattern="^README" --test-name-pattern="^docs sweep" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs" --test-name-pattern="^the hook docs" --test-name-pattern="^review round: text" --test-name-pattern="^release-rebase pin: the real" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, the named ADR, README, docs-sweep, AC-6, AC-8, pin and review-round tests pass |
| 2.7 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.7 | `grep -qx -- "- Status: accepted" docs/adr/0010-openspec-as-the-harness.md` | pass: exit 0 |
| 2.7 | `grep -qx -- "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)" docs/adr/0001-coordination-without-a-harness.md` | pass: exit 0 |
| 2.7 | `grep -qx -- "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)" docs/adr/0007-one-change-on-request.md` | pass: exit 0 |
| 2.7 | `grep -qF "ADR 0010" docs/adr/0006-phases-as-child-sessions.md` | pass: exit 0 |
| 2.7 | `grep -qF "ADR 0010" docs/adr/0008-reviews-as-a-workflow.md` | pass: exit 0 |
| 2.7 | `grep -qF "ADR 0010" docs/adr/0009-compozy-loop-as-a-second-driver.md` | pass: exit 0 |
| 2.7 | `test "$(grep -c '^## .*(D-[0-9]*)$' docs/coordination-design.md)" = 13` | pass: exit 0 |
| 2.7 | `grep -qF "openspec/changes/orchestrator-replan/mock/" docs/coordination-design.md` | pass: exit 0 |
| 2.7 | `grep -qF "docs/coordination-design.md" CLAUDE.md` | pass: exit 0 |
| 2.7 | `grep -qF "docs/coordination-design.md" README.md` | pass: exit 0 |
| 2.7 | `test -f openspec/changes/orchestrator-replan/mock/canvas.json` | pass: exit 0 |
| 2.7 | `test -f openspec/changes/orchestrator-replan/mock/planning-page.pt-BR.html` | pass: exit 0 |
| 2.7 | `test -f openspec/changes/orchestrator-replan/mock/Band.dc.html` | pass: exit 0 |
| 2.7 | `test -f openspec/changes/orchestrator-replan/mock/Help.dc.html` | pass: exit 0 |
| 2.7 | `test -f openspec/changes/orchestrator-replan/mock/Main.dc.html` | pass: exit 0 |
| 2.7 | `test -f openspec/changes/orchestrator-replan/mock/Manager.dc.html` | pass: exit 0 |
| 2.7 | `test -f openspec/changes/orchestrator-replan/mock/Stage.dc.html` | pass: exit 0 |
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
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 3.2 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 669 tests, 669 pass, 0 fail |
| 3.2 | `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate .` | pass: exit 0, plugin validation passed using the bundled binary |
| 3.2 | `git diff --quiet origin/main -- 'plugins/*/agents/*' 'plugins/*/skills/*' 'plugins/*/schemas/*'` | pass: exit 0 |
| 3.2 | `git diff --quiet origin/main -- 'plugins/*/hooks/*' ':!plugins/openspec/hooks/guard.test.mjs'` | pass: exit 0 |
| 3.2 | `git diff --quiet origin/main -- plugins/core/.claude-plugin plugins/design/.claude-plugin plugins/stack/.claude-plugin plugins/ai-engineering/.claude-plugin plugins/panel/.claude-plugin plugins/compozy/.claude-plugin docs/catalog.md` | pass: exit 0 |
| 3.2 | `test -z "$(git ls-files --others --exclude-standard -- plugins)"` | pass: exit 0 |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | ADR 0010 recorded, accepted, supersedes 0001 and 0007 | docs/adr/0010-openspec-as-the-harness.md line 3 is "- Status: accepted"; its Alternatives table (lines 179-190) lists 12 options including keep ADR 0001, child sessions per stage, long-running session, single-platform, own harness, Stop hook, ADR 0007 kept, one Workflow script, sixth exception, remove /conduct now. ADR 0001 and 0007 carry "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)"; ADRs 0006, 0008 and 0009 each carry a "Note (ADR 0010, 2026-11-19)" line. Gate parts 2-7 pass. | pass |
| AC-2 | Design document complete and linked | docs/coordination-design.md has 13 sections tagged (D-1) to (D-13) (gate part 8 = 13), a 14-row stage table (stage 0 to 13) with role, skills, product and gate, section 5 with the delivery models (two pull requests, trunk-based, trunk-based with automatic merge), the lock table in section 8 (line 273), the build order table in section 11, the Open points list, and it names openspec/changes/orchestrator-replan/mock/. CLAUDE.md and README.md link it (gate parts 9-11 pass). The per-item decided/proposed/open marking was read in sections 4 and 5; it was not audited item by item for all 13. | pass |
| AC-3 | Roadmap rewritten | git diff --stat origin/main...HEAD: openspec/roadmap.md 34 insertions, 11 deletions. Gate parts 28-30 pass: no unticked line of the six ids remains, 11 ticked lines kept. guard.mjs session reports "Roadmap: Round 14: the script and the checker (0/1 done)". | pass |
| AC-4 | No file states ADR 0001 or 0007 as the rule in force | A repository-wide grep outside CHANGELOG.md, archive, ADR bodies and this change leaves only: README.md:64 and docs/compozy-kit.md:88,96 and docs/openspec-flow.md:5,148 (each says superseded by ADR 0010 and that the machinery stays until its round); docs/coordination-design.md:423 (an open point); openspec/roadmap.md:21 (a ticked historical line, unchanged); plugins/panel/hooks/project.ts:157 (a historical version note) and test fixtures and guard.test.mjs names (not statements of the rule). config.yaml ADRs line lists 0010 and both supersessions (gate parts 25-26 pass). | pass |
| AC-5 | Mock and page kept | openspec/changes/orchestrator-replan/mock/ holds Band.dc.html, Help.dc.html, Main.dc.html, Manager.dc.html, Stage.dc.html, canvas.json and planning-page.pt-BR.html (gate parts 12-18 pass); the design names the folder (line 191). | pass |
| AC-6 | Gates green and only the allowed plugin changes | Gate parts 44-50 and the whole suite pass (669/669). git diff --stat origin/main...HEAD -- plugins/ shows exactly three files: plugins/openspec/.claude-plugin/plugin.json (1 line), plugins/openspec/README.md (1 line) and plugins/openspec/hooks/guard.test.mjs (1 line, the ADR 0007 status assertion). No agents, skills or schemas path changed (parts 47-50 pass). | pass |
| AC-7 | Design rules load | openspec instructions design --change orchestrator-replan --json prints no "ignoring this artifact" text (part 21 pass) and returns the three rules (parts 22-24 pass); config.yaml diff shows the third rule now quoted. | pass |

## Defects

None found.
