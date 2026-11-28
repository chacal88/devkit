Verdict: approved
Commit: 4e86ffb922b511123b953feb4202749ecdcbba3e

## Coverage analysis — openspec-type-flag (6f03a57c..4e86ffb9)

### Findings
- [nit] scripts/check.py:check_validate_type — The check refuses a missing --type change but does not require the command to be present; the per-file wording is pinned only by the AC-1 test.
- [nit] scripts/check.py:119-125 — The two documented accepted gaps (four-backtick fence, command split over two lines) have no test that pins them.
- [praise] plugins/openspec/hooks/validate-type.test.mjs:66 — The ambiguity test runs the real openspec CLI on a change and a spec with one id, so the typed forms are proven against the real tool.

## Coverage analysis — openspec-type-flag (6f03a57c..4e86ffb9)

In-scope surfaces: plugins/openspec, plugins/core, scripts/check.py, CompozyOS kit templates and .compozy copies, openspec/schemas copies.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): the check's glob and parse behavior in check.py is caught by the AC-3 tests in validate-type.test.mjs; the wording of each edited file is caught by the AC-1 test (line 26); the real CLI ambiguity is caught by the AC-2 test (line 66); the repository's own files are caught by the AC-3 test at line 208; the .compozy and kit-template copies are caught by gen-agents --check and the AC-3 test for every kind of file.

### Well covered
- Bare form in a span or a fence, including an unclosed fence, is refused with the right file:line.
- A typed command with a fallback on one line is refused once.
- No-id commands, prose, lone backticks, empty files, docs, READMEs, change folders and fixtures paths pass, so the negative side is tested.
- The ambiguity is shown against the real CLI, not a mock.
