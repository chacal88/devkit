<!-- devkit-stage review result=passed attempt=2 commit=41b9c4c0c1036bb6749f2e35c38f96715cc6524e -->
# Review: suite-socket-path, round 1

Path: agents · range `74f2444..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 1 | 1 | 3826bb5 |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 3826bb5 |

Consensus: FAIL (round 1/2)

## Open findings
- test-coverage-reviewer — [important] scripts/test-suite.mjs:160-170 (tryRunRoot) vs test-suite.test.mjs AC-4 'fits by bytes' — [6] The byte-count test calls the exported runRootFits, but production decides in tryRunRoot with its own inline Buffer.byteLength + RUN_ROOT_NAME_BYTES > limit. Runtime never calls runRootFits; only the test helper runParent does. Changing tryRunRoot to use string .length, so a non-ASCII TMPDIR over 71 bytes is accepted and a socket bind fails with EINVAL, leaves every test green: the makeRunRoot tests use ASCII paths only. Write in: test-suite.test.mjs, one makeRunRoot test with a non-ASCII tmp folder whose byte length is over the limit and whose character count is under it (expect the short folder). Or make tryRunRoot call runRootFits so the byte test guards production.
- test-coverage-reviewer — [important] scripts/test-suite.mjs:310 (main -> makeRunRoot) and test-suite.test.mjs — [5] The bind probe's run root always lands under /tmp (about 32 bytes), far from the 71-byte limit, so the limit constants never meet the real 104-byte sun_path boundary. The 'limit leaves room for a wider place' test restates the formula (71 + 3 + 29 = 103) and is a tautology. If SOCKET_TAIL_BYTES or SOCKET_PATH_MAX_BYTES were wrong by a few bytes, nothing would go red. Likewise, passing the chosen file count instead of all files, or dropping the limit argument, would stay green as long as the limit is 71. Write in: test-suite.test.mjs, one end-to-end run with a TMPDIR whose real path is exactly 51 bytes (run root 71) that binds the socket under the child TMPDIR. Run it as a node:test case in the same probe style as the bind test; it is meaningful on macOS.

## Refuted by verification
- code-quality-reviewer — [important] CHANGELOG.md:3, .claude-plugin/marketplace.json:9 — The marketplace and CHANGELOG go from 0.50.0 to 0.50.2 and no 0.50.1 exists in either. Neither the proposal nor the design says why. If no sibling change took 0.50.1, this is a skipped version. · refuted: git show 6c40ded (ancestor of origin/main, landed after base 74f2444) adds '## 0.50.1 — fresh-base-check retro' and marketplace 0.50.1, so a sibling took 0.50.1; caveat: it also took devkit-openspec 0.45.1, which this change reuses, so a bump collision exists at merge. / git show 6c40ded (an ancestor of origin/main, not of HEAD) adds CHANGELOG '## 0.50.1 — fresh-base-check retro' and marketplace 0.50.1, so a sibling took 0.50.1 and the gap is not a skipped version (the same commit also took devkit-openspec 0.45.1, so a collision on merge is a separate risk) / git show 6c40ded (on main/origin/main, not an ancestor of HEAD) adds '## 0.50.1 — fresh-base-check retro' to CHANGELOG.md and marketplace 0.50.1; a sibling took 0.50.1, so 0.50.2 is correct after the merge (3 of 3)

## Notes
- agents path: the round ran on a turn a background task notification started, not one the owner typed, so the Workflow tool was not used.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: suite-socket-path, round 2

Path: agents · range `74f2444..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 41b9c4c |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 41b9c4c |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- agents path: the round ran on a turn a background task notification started, not one the owner typed, so the Workflow tool was not used.

## Next
Ready to ship.
