Verdict: approved
Commit: 2079b0f84d05c024a14338da7f9117b44b14c137

## Security audit — project-setup (round 5, staleness re-review of 76e88ad..2079b0f)

### Findings

Scope: re-review of 76e88ad..2079b0f. My round-2 verdict at 76e88ad was approved with no findings, so no earlier finding needs a disposition.

Triaged scope:
- High: plugins/openspec/hooks/change-loop.mjs, the `setup` branch of startMode (ac5958e, code-quality F6). It still asks git for the top level first and answers setup-no-repo when there is none. Then it takes findRoot's folder as the root only if, after realpathSync, `relative(top, start)` stays inside the top level (no `..` prefix and not absolute). In every other case the root is the top level.
- Low: plugins/openspec/hooks/change-loop.test.mjs (one new test, N-20). The project-setup design.md D-1 text and the N-20 row. Evidence attempt 4, review.md rounds 2 to 4, and the six reviewer files. These are plan text only, with no code and no config.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

- Injection: no new sink. `start` comes from findRoot(cwd), which is the session's own working folder, and `top` comes from `git rev-parse --show-toplevel`. The new code only compares paths with node:path functions (`relative`, `isAbsolute`, `sep`) and runs no shell. Every import it uses is already on line 38 or 39.
- Authn/authz: the change narrows where the setup can write. Before ac5958e, a git repository nested in an outer folder holding openspec/changes (or in an outer devkit project as a submodule) got the outer folder as its root. The setup could then write outside the repository where `/devkit setup` was typed. Now the root is always the top level or a folder inside it. The no-repo refusal from round 2 still comes first. The skill and the guard did not change.
- Exposure: no new message, log or payload. The only output is the root path, which is the session's own repository.
- Crypto: none touched.
- Secret: I scanned every added line in the range for credential patterns and found nothing. No secret-looking file was added.
- Config: no new defaults. When `start` is null or outside the top level, the root falls back to the git top level, which is the narrower choice, so the change fails closed.

Tests: `TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3 --test-name-pattern='setup AC-1 start' plugins/openspec/hooks/change-loop.test.mjs` ran in the foreground, with no other suite running (load average 0.07): 1 file, 6 tests, 6 pass, 0 fail. The new nested-repository test was among them.

Discarded false positives:
- authz: in a nested repository, the settings are still read from findRoot's outer folder (design D-1 says so). For `setup` they only fill the driver and language fields of the output. The setup checks no setting value, and every write goes to the inner root, so the outer settings cannot widen what the setup writes.
- authz/path: in the new check, `start` is resolved with realpathSync but the root that is returned keeps the path as typed. Both name the same folder, which has already been shown to be inside the top level, so a symlink cannot move the root outside the repository.

Out of round: none.
