<!-- devkit-stage specs result=passed attempt=1 commit=5d255b1e77f67a5628a3f1f7dabbcfe8f0147634 -->
# Spec Delta

## ADDED Requirements

### Requirement: The check judges a merge of the base by the change's own files
The `devkit-reviews` check SHALL judge whether the recorded evidence and reviews are current by the
same rule as the delivery checker (`change-delivery`), with the pull request's base branch
(`GITHUB_BASE_REF`, else the base the delivery checker reads) as the base and `origin/<that
branch>` as its tip, from both entries
(`deliver-check.mjs --ci` and `guard.mjs ci`).

#### Scenario: A merge of the base that brings only unrelated files
- **WHEN** a pull request's change has its evidence and approved reviews recorded at commit R, and the only later commit merges `origin/<base>` that brings product files the branch did not change
- **THEN** the check passes on the recorded evidence and reviews, from both entries

#### Scenario: A merge of the base that brings an own file
- **WHEN** the same merge also brings a change to a product file the branch changed
- **THEN** the check exits 1 naming the evidence and every review as stale, the reason naming the merge commit and that file, from both entries

#### Scenario: No origin of the base in the checkout
- **WHEN** the change's own branch selects the change, `GITHUB_BASE_REF` is unset, the checkout has no `origin/<base>`, and the only later commit merges the local base with unrelated product files
- **THEN** no merge is exempted and the check fails on the stale records, as before this rule
