Verdict: approved
Commit: 55722bf6a30ec7d49ebea78efb3187222f1d0ca5

## Security audit — auto-merge (round 1)

Triaged scope: high: .github/workflows/devkit-reviews.yml, templates/devkit-reviews.yml, github-setup.mjs, merge-setup.mjs, deliver-check.mjs (--ci, merge steps), guard.mjs (ci), ship-change and openspec-setup SKILL.md, ADR 0002; medium: config parsing (parseMergeMethod, parseShip); low: docs, tests, manifests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection — gh and git are called with spawnSync/execFileSync argument arrays (no shell). The ruleset payload goes through stdin as JSON. Branch names, change ids and merge_method never reach a shell. merge_method and ship are whitelisted, and DEVKIT_CHANGE is checked against /^[\w.-]+$/ and the active change list.
- authz — the PR changing its own workflow or checker (devkit-reviews can be edited by the PR it judges) is a GitHub limit and is already Accepted in ADR 0002. No approval is required, by design.
- authz — the PR author's branch name picks the change that --ci checks, and a PR that touches no change passes. That needs write access, which already allows editing the workflow (ADR 0002), and the "no folder, nothing to check" case is the intended R-3 behaviour.
- workflow trigger — pull_request, not pull_request_target. It has contents: read, no secrets, and checks out the PR head sha. A fork PR gets no write token.
- github-setup applying without confirmation — the default run is read-only. --apply acts only on the named items in create/update state. The SKILL requires per-item owner confirmation. The workflow file is written but not committed.
- auto-merge race — the command is pinned with --match-head-commit <head>, and disable-auto-merge runs before any other step once the contract drops below 8/8.
- exposure and secrets — no tokens are logged or committed. gh errors are reduced to their first line.
- config — merge-setup and mergeSetup fail closed on any read error. A missing devkit-reviews rule gives stop-merge-setup, not a downgrade.

### Findings (TRUE POSITIVE)
- [important] [insecure config / supply chain] plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml — the generated workflow runs, as the required merge gate, three scripts fetched with curl from raw.githubusercontent.com/chacal88/devkit/v<version> with no checksum. A tag is mutable, so a moved or compromised tag would change the gate in every adopting repository. This is not exploitable in this diff and the job has contents: read only, so it does not block. Follow-up: pin to a commit sha, or verify a sha256 recorded in the template.
