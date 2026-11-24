Verdict: approved
Commit: ec2730f3c7bf8211fcaade34636b61516bc544ac

## ADR review: archive-release-pin

### Findings

ADRs reviewed: ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0027 (`docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`), ADR 0012 (`docs/adr/0012-the-reviews-check-follows-the-change-script.md`), ADR 0019 (`docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md`). ADR 0002, ADR 0004, ADR 0018 and ADR 0026 were checked only through the references in ADR 0027, 0003 and 0019.

### Findings
No findings. ADR review: pass.

The change conforms to ADR 0003 as amended by ADR 0027. The amendment follows the Note form ADR 0018 used. The content rule sits in `unnamedFiles`, so the local archive check, the readout and `devkit-reviews --ci` read one result. `RELEASE_FILE` is unchanged. `deliver-check.mjs` does not import `release-merge.mjs`, so the consumer CI keeps downloading three files (ADR 0012 and ADR 0027 point 6). The owner's per-proposal answer remains the gate, no push to the default branch was added, and no tag logic changed (ADR 0019). ADR 0027 is listed in the ADR index in `openspec/config.yaml`, and the gap at 0025 is explained in `decisions.md`. `approval.md` records the owner's approval of the plan.

Tests: `deliver-check-archive.test.mjs` and `release-merge.test.mjs` run once in the foreground with TMPDIR=/var/tmp/devkit-archive-release-pin: 195 of 195 pass. The worktree was clean afterwards.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
