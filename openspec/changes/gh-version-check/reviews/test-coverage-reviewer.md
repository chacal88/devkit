Verdict: rejected
Commit: 4fadc2a97437f4af8bdffab9070a42aa3eefaa52

## Coverage analysis — gh-version-check (c561553..4fadc2a)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:946-949 — [5] The state collector for the merge/archive facts calls checksItem and keeps only c.reason; with an old gh it carries the new text as a plain error string. No test runs that path with an old gh, so a change to how ghTooOld is consumed there would stay green. Write in: deliver-check.test.mjs, next to the gh-version 5-9 tests, with the same fakeGh pr-checks 'unknown flag: --json' fixture, asserting the collected checks.error includes 2.50.0 and 'update gh'.
- [nit] plugins/openspec/hooks/project-loop.mjs:167 — ghParams has a null-installed fallback (render(lang,'gh-version-unknown')) and a pt-BR reply, but project-loop tests 15 and 16 only cover English with a known version. Breaking the fallback leaves this suite green; change-loop tests 12 and 14 cover the same logic for the change verb. Write in: project-loop.test.mjs, a variant of gh-version 15 with version unreadable and lang pt-BR.
- [nit] plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs:67-80 — Test 19 asserts SKILL.md prose by regex (the 'never stops the setup' wording). It is coupled to the wording, so a legitimate rewrite turns it red while dropping the instruction in a different phrasing would not. It is a doc-presence check, not a behavior check.
- [nit] plugins/openspec/hooks/deliver-check.mjs:660 — OLD_GH matches only 'unknown flag: --(json|required)'. Tests 5 and 6 use hand-written stderr that matches that shape, and the change has proof files. A different gh wording (for example 'unknown shorthand flag') is not recognized and falls to 'checks-unreadable', which is today's safe behavior. No test pins that fallback, so the exact unknown-flag text is an unguarded assumption.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:1137-1210 — Tests 5-9 assert the seam end to end: a fake gh, the exact calls made (exactly one --version call, exactly one pr checks call), the negative path (HTTP 401/502, non-JSON, missing, timeout all ask for no version), and the readable path (including the pending exit 8) asking for none.

In-scope surfaces: plugins/openspec hooks (merge-setup, deliver-check, flow-check, change-loop, project-loop), the openspec-setup skill script gh-version.mjs and SKILL.md.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0, by reading only):
- readChecks, the unknown-flag detection and the ghVersion call: caught by deliver-check gh-version 5, 6, 7, 8, 9.
- checksItem to ghTooOld to flow-check readDelivery: caught by flow-check gh-version 10 and 11 (reason code, params, and the readout in both languages), plus the 'every reason code' table.
- flow-check to change-loop blocked end (gh-too-old params, verb, unknown version): caught by change-loop gh-version 12, 13 (full next CLI, exit 2) and 14 (waitLoop).
- checksItem to project-loop slice (blocked, nothing merged): caught by project-loop gh-version 15 (and 16 for the other-failure path).
- Reply rendering of the new message in roadmap-loop: caught by BLOCKED_PARAMS in roadmap-loop.test, which renders every blocked reason in both languages.
- gh-version.mjs script (four lines, exit 0, exit 2 on an argument, missing gh with an empty PATH): caught by gh-version 17 and 18; the script is imported by guard.test.mjs, so it runs in the full suite.
- SKILL.md step 1 naming the script: gh-version 19 (wording-coupled, see F3).
- Merge/archive facts path (deliver-check.mjs:946): gap (F1).

No mock-only tests found; the fake gh answers with canned stderr and the assertions are on our transformation. No impossible fixtures found; the stderr shape matches the usage text real gh prints.

Well covered:
- Version parsing and comparison: first line only, CRLF, rc suffix, DEV, truncated and empty input; versionOlder on 2.9.9 vs 2.50.0 (a numeric-versus-string comparison trap) is covered (merge-setup gh-version 1-4).
