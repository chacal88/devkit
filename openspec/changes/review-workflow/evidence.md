Commit: 01ee2969e180f353ff1752bf655688839976fa96

# Evidence: review-workflow

The uncommitted files are only under `openspec/changes/review-workflow/` (`review.md` and `reviews/*.md`); no plugin, script, doc or agent file differs from HEAD. A live Workflow run, and the guard accepting a Workflow agent's write, are the dogfood of the next change and are not claimed here.

## Verification

### Gates

The two long commands were run by the conducting session on this tree (01ee296): `node --test plugins/openspec/hooks/guard.test.mjs` tests 648, pass 648, fail 0 (about 9 minutes, not re-run by the verifier). Gate 2.8 on 4955dcf also passed the validate parts; the verifier re-ran those on 01ee296.

| Gate | Command | Result |
|---|---|---|
| 1.5 / 2.8 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: tests 648, pass 648, fail 0 (conducting session's run on 01ee296, not re-run by the verifier) |
| 1.5 / 2.8 | `python3 scripts/check.py` | pass: all checks passed (conducting session on 01ee296, and re-run by the verifier, exit 0) |
| 2.8 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (conducting session on 4955dcf, re-run by the verifier on 01ee296) |
| 2.8 | `"$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude" plugin validate .` | pass: "Validation passed", exit 0 (conducting session on 4955dcf, re-run by the verifier on 01ee296) |
| 2.8 | `openspec validate review-workflow --strict` | pass: "Change 'review-workflow' is valid", exit 0 (conducting session on 4955dcf, re-run by the verifier on 01ee296) |

Targeted proofs run by the verifier on 01ee296:

| Command | Result |
|---|---|
| `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` | pass: tests 54, pass 54, fail 0 |
| `node --test --test-name-pattern="fix-review" plugins/openspec/hooks/deliver-check.test.mjs` | pass: tests 3, pass 3, fail 0 |
| `node --test --test-name-pattern="0008" plugins/openspec/hooks/guard.test.mjs` | pass: tests 2, pass 2, fail 0 |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | Every reviewer of the bench starts in parallel as its own `devkit-core:<reviewer>` agent type, on both paths; the skill falls back to `agents` on a refused call, unreadable result or lost notice | `review-round.test.mjs`: "workflow starts every reviewer of the bench before any returns (AC-1)"; "cli stage1 gives one job per bench entry with its agent type and prompt"; text tests "review-change names the script, the two paths and check-file", "holds the result-check row and runs the whole round on the agents path", "holds the lost-round row and drops the busy mark", "ship-change review row and conduct Delivery item 5 name the Workflow tool, the agents path and the lost round". All pass. No live Workflow run (next change's dogfood). | pass |
| AC-2 | Each undisposed blocking/important finding gets exactly 3 `finding-verifier` jobs; refuted at 2 of 3 with non-empty evidence; nit, praise and already-disposed findings get none | `review-round.test.mjs`: "needsVerification holds for blocking and important findings without a disposition only"; "decide refutes at 2 of 3 with evidence, never at 1 or 0"; "decide counts a refutation with blank evidence and a null vote as not refuted"; "workflow sends exactly 6 verifier calls for a blocking and an important finding and none for the rest (AC-2)"; "workflow votes decide each finding (AC-2)"; "verifierPrompt holds only its finding, the range and the word refute"; "cli verify makes three jobs per finding"; "cli outcomes decides from objects, text and null votes"; "outcomeOf leaves a disposed previous finding neither open nor verified"; "finding-verifier exists and its tools hold neither Write nor Edit". All pass. | pass |
| AC-3 | Each `reviews/<reviewer>.md` is written by that reviewer's agent type, prompt holds the commit line and every finding line verbatim, no verdict suggested; `check-file` accepts only the right file (exit 2 otherwise); session never writes a verdict file | `review-round.test.mjs`: "workflow writes one prompt per reviewer with its own agent type, the lines and the commit (AC-3)"; "workflow outcome verdict is rejected while an important stays open (AC-3)"; "writerPrompt holds every line verbatim and the commit line, and suggests no verdict"; "writeMismatch ..."; "workflow fails a writer whose returned verdict or commit differs from the outcome"; "cli check-file exits 0 for a file written from the outcome"; "cli check-file exits 2 with the mismatch prefix for a missing file, line 1, line 2 and a missing refuted line". All pass. Guard accepting a Workflow agent's write: next change's dogfood. | pass |
| AC-4 | `review.md` consolidates verdicts, verified and refuted counts, consensus, round and path | `review-round.test.mjs`: "consolidate writes the table, the counts, the consensus line and the path"; "workflow reviewMd holds the verdicts, the counts, the consensus with its round and the path (AC-4)"; "cli consolidate returns the consensus and the review.md section"; "consensusOf is PASS only when every outcome is approved or declined and nothing failed". All pass. | pass |
| AC-5 | Without the Workflow tool or on an automated turn, the same stages run with the Agent tool; files meet AC-3/AC-4 with path `agents` | `review-round.test.mjs`: "cli equals the workflow for the same fixtures, except the path (AC-5)"; text tests "review-change names the script, the two paths and check-file" and "holds the result-check row and runs the whole round on the agents path". All pass. | pass |
| AC-6 | `deliver-check` gives `fix-review` with the finding in `next.findings` for an approved verdict with an undisposed important/blocking finding; existing delivery-contract tests stay green | `deliver-check.test.mjs`: "nextStep: an approved review at the current commit with an undisposed important finding goes to fix-review with that finding (AC-6)"; "a rejected review and an approved one with an open finding give one fix-review with both reviewers and both findings"; "row 8: a rejected review ... fix-review". 3 of 3 pass. The existing delivery-contract tests are inside the full `guard.test.mjs` run (648 of 648, conducting session). | pass |
| AC-7 | ADR 0008 records the exception; ADR 0001's Note points to it; `openspec/config.yaml` lists it | `docs/adr/0008-reviews-as-a-workflow.md` exists; `docs/adr/0001-coordination-without-a-harness.md` lines 40-41 cite ADR 0008; `openspec/config.yaml` line 22 (`ADRs:`) lists it (grep). `guard.test.mjs` "ADR 0008 records the reviewer round as a Workflow script; ADR 0001 and the config point to it" passes. | pass |
| AC-8 | Skills and `docs/openspec-flow.md` describe the round and fallback; devkit-core and devkit-openspec bumped with CHANGELOG entry; CI pin follows; guard tests and `check.py` green | Skills and docs: text tests (see AC-1) and "docs/openspec-flow.md has the review round section and links ADR 0008" pass. Versions: `plugins/core/.claude-plugin/plugin.json` 0.6.0 and `plugins/openspec/.claude-plugin/plugin.json` 0.12.0, matching `.claude-plugin/marketplace.json` (core 0.6.0, openspec 0.12.0, metadata 0.13.0). `CHANGELOG.md` has "0.13.0 — reviews as a workflow" naming both packs. `docs/openspec-flow.md` pins `v0.12.0` (lines 477-485). Gates: see table above. | pass |

Outcome: verified
