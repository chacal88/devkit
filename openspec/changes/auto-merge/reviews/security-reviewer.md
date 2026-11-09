Verdict: approved
Commit: cba2f4484a9452a95615ee6eba015bb21ecc1f98

## Security audit — auto-merge (round 2, re-review of 55722bf..cba2f44)

Triaged scope: high: github-setup.mjs (resolveTag, workflowItem, template write), templates/devkit-reviews.yml, merge-setup.mjs (shared gh runner, branch encoding); low: docs, ADR 0002, tests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection (template substitution) — `{{ref}}` is replaced only by a value that passed `/^[0-9a-f]{40}$/` (github-setup.mjs:47,58) and `{{tag}}` by `v<version>` read from the local plugin.json. Neither carries shell or YAML metacharacters, so the curl URL cannot be altered.
- injection (gh runner) — `makeGh` uses `spawnSync('gh', args)` with an argument array and no shell. `input` goes through stdin. The route in resolveTag is built from the constant repo and the local plugin version.
- injection (branch names) — `encodeURIComponent(branch)` at merge-setup.mjs:68 and :75 and at github-setup.mjs:100 escapes `/`, `?`, `#` and `..` segments, so a branch name cannot change the API path. `git cat-file` takes `HEAD:<constant path>`.
- config (fail-open on tag lookup) — a 404 gives `deferred`, any other error gives `error`. A tag that is not a commit is an `error`. No path falls back to the tag name or a branch. The workflow is only written in the `create` state, which always carries a validated sha.
- exposure — gh errors are cut to the first stderr line (`ghError`). The timeout and signal fields carry no secrets.
- residual trust in the chacal88/devkit repo (whoever controls it controls the pinned content) — this is the accepted distribution trust in ADR 0002, not a flaw in the diff.

### Findings (TRUE POSITIVE)
- [important] [insecure config / supply chain] plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml — the workflow downloads its three scripts by tag with no checksum, and a tag can be moved. · fixed in cba2f4484a9452a95615ee6eba015bb21ecc1f98 (resolveTag resolves the tag to a commit sha, annotated tags are dereferenced, the template pins `{{ref}}` to that sha, and a missing tag defers with no fallback)

No new findings in the changed range.
