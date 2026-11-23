# Review: remote-worker, round 1

Path: agents · range `c561553..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 30e6cbd |
| test-coverage-reviewer | rejected | 0 | 3 | 3 | 0 | 30e6cbd |

Consensus: FAIL (round 1/2)

## Open findings
- test-coverage-reviewer — [important] plugins/openspec/hooks/machine-probe.mjs:30-36 (installationFor) — [6] Choosing the pack installation is untested beyond one user-scope entry. If the project-scope match picked the wrong path (the `folder === path || startsWith(path + '/')` check, or project preferred over user), the probe would run the wrong pack version on the other machine and no test would go red. Write in: roadmap-loop.test.mjs next to the localSsh fixture (~line 2886), with an installed_plugins.json holding a project-scope entry for t.other and a user-scope one, asserting which installPath runs.
- test-coverage-reviewer — [important] plugins/openspec/hooks/machine-probe.mjs:42-47 (state error paths) — [5] The probe's own error replies are never asserted: pack not installed, unreadable installed_plugins.json, inner status exiting non-zero. The AC-12 test injects fake ssh results that already contain the error JSON, so it checks how the caller reads an error, not whether the probe emits one. Breaking `failWith` or the `exitCode = 3` would leave it green. Write in: roadmap-loop.test.mjs, with localSsh and an empty HOME, asserting the stdout error and exit 3.
- test-coverage-reviewer — [important] plugins/openspec/hooks/change-loop.mjs claimThroughGh — [5] The gh read path has no assertion on its parse. The only gh fake, at change-loop.test.mjs:3012, returns 'not found' and exits 1, so it covers the failure branch. Nothing covers a successful folder listing with `approval.md` (`placed`), base64 decoding of `.openspec.yaml`, or machine and places parsing, which is where a stale clone reads another machine's claim. A bug there makes a placed change look unplaced, or a claim look machine-less. Write in: change-loop.test.mjs with an injected `gh` returning contents-API JSON, asserting `remoteClaims` returns machine, places and placed.

## Refuted by verification
None.

## Notes
- Path agents: this turn began with a background task notification, not the owner's typed message.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: remote-worker, round 2

Path: agents · range `30e6cbd..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 7b9c499 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 7b9c499 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Path agents: this turn began with a background task notification, not the owner's typed message.

## Next
Ready to ship.

# Review: remote-worker, round 1

Path: agents · range `7b9c499654e1b08818d7a4ff4a465fffb88e8d68..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 7b9c499 |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Verdict refresh only: the round-2 file of code-quality-reviewer carried an uncommitted mark on its Commit line; no code changed. Consumes no round.

## Next
Ready to ship.
