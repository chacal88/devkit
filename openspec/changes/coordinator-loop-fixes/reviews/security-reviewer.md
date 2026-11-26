Verdict: approved
Commit: 9c4fffed5a46c751787fcf1e08e410bcac3c70e4

## Security audit — coordinator-loop-fixes (round 3)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:745 — DECLARE_CALL needed the script path right after `node`, so `node --no-warnings <path>/change-loop.mjs declare ...` and `node -- <path>` passed declareViolation for a subagent; allow node option words before the path. · fixed in 66f3553
- [nit] plugins/openspec/hooks/guard.mjs:746 — DECLARE_CALL still misses a node option that takes a separate value (`node -r ./x.cjs <path>/change-loop.mjs declare`, `--require x`) and a variable path (`P=...; node $P declare`); a forged record only lifts the review ceiling or records a red gate (never approves a review or opens a gate), and design.md now records both forms as unmatched by decision with the widening as a follow-up.
- [praise] plugins/openspec/hooks/change-loop.mjs:3303 (runDeclare --stdin words); plugins/openspec/skills/ship-change/SKILL.md:60; plugins/openspec/skills/devkit/SKILL.md:151 — The owner's words for declare review-round travel on standard input through the quoted heredoc instead of a double-quoted --param, so a backtick or $(...) in them never runs in the main session's shell; the round-3 record in declared.json was written that way.

Triaged scope:
- High: plugins/openspec/hooks/guard.mjs, as `f72e442` resolved it. The line split comes from main, `split(/\r?\n/)`. The keyed opening `opening = new RegExp(`^${key}:...`)` is kept from this change. `key` is only ever the literal `devkit` or `x-devkit` from code, never request input, so the regex takes no injection. `classify` still treats `declared.json` and `approval.md` as gate files only the main session writes. `DECLARE_CALL` and `declareViolation` are byte-identical to round 2.
- Medium: the rest of the merge resolution:
  - the release numbers in .claude-plugin/marketplace.json, both plugin.json files and CHANGELOG.md;
  - the CI pin in docs/openspec-flow.md, moved to `v0.49.0` and still a commit sha, downloaded into `$RUNNER_TEMP`;
  - .compozy/kit-manifest.json, regenerated (`gen-agents.mjs --check` exits 0);
  - the kit templates of tdd-implementer and pr-verifier under plugins/compozy/kit/, which carry the `Conductor:` and `proof/` rules from the core agents;
  - openspec/config.yaml.
- Low:
  - `0107079`, path renames in design.md, proposal.md and tasks.md;
  - `9c4fffe`, the evidence rewrite;
  - the plan revision for readiness attempts 13 and 14: design.md, specs/, tasks.md, readiness.md, approval.md;
  - declared.json, which holds the owner's words "Sim, libera" for round 3.

  I pattern-scanned every added line of the change folder for home paths, tokens, keys and passwords and found none.
- Outside my remit: the ~190 files of project-setup that came in with the merge of `494daa5`. They are main's and were reviewed in PR #148. I checked only where they touch this change: guard.mjs and the merged guard tests.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config

Discarded false positives:
- **injection** (`parseDevkitBlock` builds a RegExp from `key`): the only callers pass the literals `devkit` and `x-devkit` (`changeDevkitBlock`). No value from a file or user reaches `key`.
- **authz** (the merge could have dropped this change's guard rules): the remerge diff of guard.mjs only joins the CRLF split with the keyed opening. `declareViolation`, `inProofFolder` and the `declared.json` gate class are unchanged against round 2's head (`git diff 494daa5 HEAD -- guard.mjs`). T98-T100 and T135 pass.
- **authz** (project-setup's `/devkit setup` writer could get around `declared.json`): setup-block.mjs writes openspec/config.yaml's devkit block, not a change folder's declared.json. The guard still classifies declared.json as a file only the main session writes. The `setup AC-*` guard tests pass next to this change's tests.
- **exposure** (declared.json and approval.md record the owner's words): this is the designed record of an owner decision. The words are not credentials, are capped at 200 characters and never reach a shell (the round-2 heredoc path).
- **config** (the CI pin moved to v0.49.0): it is still pinned by commit sha, not by tag. Only the version number changed in the merge.
- **secret**: no secret-looking file in the range, and no credential pattern in any added line of the change folder.

Removed code checked: the merge drops this branch's `split('\n')` and keeps main's CRLF-tolerant split. The opening regex accepts `\r?$` either way, so a block is still recognized. Nothing a check needed was removed.

Tests run (foreground, no other suite running), with `TMPDIR=/var/tmp/devkit-coordinator-loop-fixes GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`:
- `node --test --test-concurrency=3 --test-name-pattern='coordinator-loop-fixes AC-1 T9|coordinator-loop-fixes AC-1 T100|AC-19 T135|^setup AC' plugins/openspec/hooks/guard.test.mjs`: 15 tests, 15 pass, 0 fail.
- `node plugins/compozy/kit/scripts/gen-agents.mjs --check`: exit 0.

No file was written.
