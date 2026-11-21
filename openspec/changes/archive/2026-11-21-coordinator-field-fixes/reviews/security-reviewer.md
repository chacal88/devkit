Verdict: approved
Commit: 4f6d958d353b78c317244ddf0763268d7829e5bd

## Security audit — coordinator-field-fixes (round 2)

### Findings


Verdict: approved
Commit: 4f6d958d353b78c317244ddf0763268d7829e5bd

Triaged scope: high: plugins/openspec/hooks/change-loop.mjs (`archivedDates`, `createdAfter` and `unfinished`). Low: the two test files and the `evidence.md` commit.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Previous findings: round 1 was approved with no findings, so there is nothing to re-list.

Discarded false positives:
- injection, `createdAfter`: the `id` comes from directory names read by `activeIds` in a checkout the project controls. It is only joined into a read path for `.openspec.yaml`. Nothing is written or executed, and the content is checked against a fixed date regex, so there is no sink.
- config/authz, reused-id relisting: a forged `created:` date in `.openspec.yaml` could make an archived id show up in the unfinished list again. That only affects which changes the coordinator lists. It gates no access and no permission. An unreadable file or a missing date fails to `false`, the stricter side.
- regex: `ARCHIVED` and the `created:` pattern are linear, with no nested quantifiers.
- exposure, crypto, secret: the range adds no logging, tokens, hashing or credentials. The test files and `evidence.md` add no secret-looking files.

I did not re-run the test suites. I used the results you recorded for fb91e5f.
