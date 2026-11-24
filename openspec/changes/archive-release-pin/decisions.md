<!-- devkit-stage decisions result=passed attempt=2 commit=d2010cafc71627b2d8d365d75af477fbecd0e736 -->
# Decisions and ADRs

- ADR: `docs/adr/0023-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` — The archive check lets the release pin lines pass unnamed, not the files that hold them

Why a record, not a note: the change alters the exemption list in ADR 0003's Decision, which governs what merges unreviewed, and moves the pin definition into `deliver-check.mjs`, the file the consumer CI downloads. A note on an accepted record may only say the Decision is unchanged, so an amendment needs a new record. Once the owner approves the plan, the implementation adds an `Amended by ADR 0023` line to ADR 0003's header and a Note line in its Context, in the form ADR 0018 used.

Revision (attempt 2): the record follows grill answer A2, so the test-file rule accepts the `assert.match` and `assert.doesNotMatch` pin lines with any message and the `// Invariant: the CI snippet pins the current release` comment line, and the pin definition lives in `deliver-check.mjs`, re-exported by `release-merge.mjs`.

Numbering: sibling worktrees hold their own 0022, so this record keeps 0023; the number is re-checked against `origin/main` right before the push and renamed (file, title and every reference) if another record has taken it.
