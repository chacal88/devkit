Verdict: approved
Commit: cba2f4484a9452a95615ee6eba015bb21ecc1f98

## Architecture review — auto-merge (round 2, re-review of 55722bf..cba2f44)

Analyzed: owners (gh runner and error formatter -> merge-setup.mjs, the declared home of GitHub facts; tag-to-sha resolution -> github-setup.mjs, the write/config side that already owns the workflow template fill); boundaries (hooks <-> skill script via the existing relative import, deliver-check <-> merge-setup, CI download set); contract consumers enumerated (makeGh/ghError: deliver-check.mjs:11 imports and re-exports makeGh for its tests, github-setup.mjs:40 wraps it, merge-setup.mjs uses ghError internally; grep finds no remaining copy of runGh/ghError/firstLine; template placeholders `{{ref}}`/`{{tag}}`: only github-setup.mjs applyItem fills them; `--ci` workflow downloads guard.mjs, deliver-check.mjs and merge-setup.mjs, which covers deliver-check's static imports); deletion tests (merge-setup.mjs now also hosts the runner: passes, two importers share it; resolveTag/workflowItem pin: passes, it hides the two-step annotated-tag dereference and the no-fallback rule, inlining would bloat workflowItem).

### Findings
- [important] github-setup.mjs gh runner and error formatter existed three times · fixed in cba2f44 (one `makeGh`/`ghError`/`GH_TIMEOUT_MS` in merge-setup.mjs:26-46; deliver-check.mjs and github-setup.mjs import it; the optional timedOut/signal fields are kept; test deliver-check.test.mjs:2023 pins the timeout path)
- [nit] guard.mjs <-> deliver-check.mjs import cycle · fixed in cba2f44 (recorded as accepted for 0.5.x in design D5)
- [nit] design D5 `--ci` without openspec/ · fixed in cba2f44 (design amended: exit 0 with a note)
- [nit] github-setup.mjs:13 skill script imports from the hooks folder · unchanged, accepted precedent (ship-change -> deliver-check).
- [nit] plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs:42 — `runGh` builds a new runner per call via `makeGh(cwd)(...)`; harmless, a thin local alias. Not worth a round.

New code check: the sha-pin (resolveTag :52, workflowItem :71) lives on the setup side, which is the single owner of template filling and repo configuration; the checker stays read-only. `deferred` on a missing tag with no fallback matches design D5 and the trust model. The extra download of merge-setup.mjs in the template is required by deliver-check's static import, so the CI file set is consistent. No new module, no contract change that lacks its consumers.
