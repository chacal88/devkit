Verdict: approved
Commit: 1077219956e46fe2d6a0c73c0d7220209dc3f785

## Quality review: panel-conduct-view (round 2)

### Findings
- [nit] plugins/panel/hooks/register.tsx:~327 — A full trigger re-runs conduct-check for dropped (archived, not-a-change) entries; D5 says only changes in progress. Unchanged since round 1.
- [nit] plugins/panel/hooks/register.tsx:~312 — deliverReport still runs right after the conducted change's fetchOne hit a rate limit; skipping it when isLimited is true would save the gh calls. Unchanged since round 1.
- [nit] scripts/check.py:check_panel_parity — The check does substring matching of '/<src>/' in the checker file, so a changed copy still passes if the same text appears elsewhere in that file. It is also skipped silently when grammar.ts is missing. Optional hardening; I could not run a mutation probe because the hook blocked the write.
- [praise] plugins/panel/hooks/grammar.ts — The shared checker grammar now lives in one module, tied to its source by check_panel_parity. The duplicated isChangeId and the regexes are gone from conducted.ts and steps.ts, and the call sites import from grammar.ts.
- [praise] plugins/panel/hooks/panel.test.tsx:1738 — The new test covers the folder fallback to <root>/openspec/changes/<id> for both the conducted change and another change's progress, and asserts the rendered output.

### Summary
- 5 findings (0 blocking, 0 important, 3 nit) + 2 praise
- Justification: Re-review of 0820110..1077219. The code changes are a move of the grammar into grammar.ts, the new check_panel_parity in scripts/check.py, one new fallback test and a D27 design note. The moved identifiers keep the same expressions and behavior. The design note says check_panel_parity runs at gates 3.9 and 4.9 and in CI; the check itself is in scripts/check.py, which the conducting session reports passing. I relied on the conducting session's 162/162 and the passing check.py and validate results, and did not re-run them. Round 1 had no blocking or important findings, so there is nothing to mark fixed. The two round-1 nits stand as optional.
