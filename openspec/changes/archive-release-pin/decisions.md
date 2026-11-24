<!-- devkit-stage decisions result=passed attempt=2 commit=d2010cafc71627b2d8d365d75af477fbecd0e736 -->
# Decisions and ADRs

- ADR: `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` — The archive check lets the release pin lines pass unnamed, not the files that hold them

Why a record, not a note: the change alters the exemption list in ADR 0003's Decision, which governs what merges unreviewed, and moves the pin definition into `deliver-check.mjs`, the file the consumer CI downloads. A note on an accepted record may only say the Decision is unchanged, so an amendment needs a new record. Once the owner approves the plan, the implementation adds an `Amended by ADR 0027` line to ADR 0003's header and a Note line in its Context, in the form ADR 0018 used.

Revision (attempt 2): the record follows grill answer A2, so the test-file rule accepts the `assert.match` and `assert.doesNotMatch` pin lines with any message and the `// Invariant: the CI snippet pins the current release` comment line, and the pin definition lives in `deliver-check.mjs`, re-exported by `release-merge.mjs`.

Numbering: this record was drafted as 0023; `origin/main` took 0022, 0023, 0024 and 0026 before this change merged and a sibling branch holds 0025, so the record was renamed to 0027 (file, title and every reference) at the merge of `main`; the number is re-checked against `origin/main` right before the push.
