Verdict: approved
Commit: ec2730f3c7bf8211fcaade34636b61516bc544ac

## Coverage analysis: archive-release-pin (44ca321..HEAD)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:1259-1275 (archiveChanges texts) — Spec scenario 'present but cannot be read' has no seam test: the before/after catch-to-null paths are exercised only by a deleted file (after) and a file new on the branch (before, test file only). A regression turning a read failure into '' would pass equal empty texts as pin-only, and only a direct pinLinesOnly(null) test would notice. Write in: deliver-check-archive.test.mjs, next to archive-release-pin 8 (a doc new on the branch, or an unreadable pin file).
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs: archive-release-pin 11 — Implementation-coupled: asserts exact prose substrings in the flow page, ADR 0003 and config.yaml; a legitimate rewording of those docs turns it red without any behavior change.
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs: archive-release-pin 7, 8, 9 — Each seam (local stop, --ci, three-file consumer folder) is asserted end to end on real scratch git repos, committed and uncommitted, pass and fail, so a dropped texts argument or a broken module boundary goes red.
- [praise] plugins/openspec/hooks/fixtures/c561553 and archive-release-pin 1, 3, 6 — The fixtures are the literal hunks of the real archive commit c561553, not invented payloads, and test 6 shows that the same file list without texts names both pin files.

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs, release-merge.mjs and their node:test files), plus the docs and ADR text that tests pin.
Blocking gaps (8-10 without a plan): 0

Seams checked: archiveChanges texts -> caught by archive-release-pin 7 and 8; archiveNext/filesStop texts argument -> archive-release-pin 7; archivePrCheck texts argument (--ci) -> archive-release-pin 8; three-file consumer CI -> archive-release-pin 9; pin definition moved and re-exported -> archive-release-pin 10 plus the existing release-merge pin tests; RELEASE_FILE unchanged and conflict beyond the pin still blocked -> 'release list' and 'release-merge pin: classifyConflict ... blocks one beyond the pin'; pinLinesOnly core -> tests 1 to 6 on the real c561553 hunks (mutation runs: 0).

A filtered run of 12 tests (archive-release-pin 1 to 11 plus 'release list') passed with TMPDIR=/var/tmp/devkit-archive-release-pin. The whole suite was not run.

### Well covered
- Pin-only doc edit passes and a doc edit beyond the pin names the file: tests 2, 7, 8 and 9.
- A test file with any non-form line fails: test 4.
- The real c561553 file list passes with no proposal naming either pin file, and names both files without texts: test 6.
- Red-before-fix proofs are recorded in proof/red-1.txt and proof/red-2.txt.
