Verdict: approved
Commit: 73e159c2acfac2959d8f6f84b099c538b0eafc54

## Security audit — coordinator-loop-fixes (round 1)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:745 — DECLARE_CALL needs the script path right after `node`, so a subagent's `node --no-warnings <path>/change-loop.mjs declare <id> review-round --param words=x` passes declareViolation (probed: false), and `node -- <path>` or `node $(...)/change-loop.mjs` likewise; a forged record only lifts the review ceiling or records a red gate (never approves a review or opens a gate), so this is hardening: allow `(?:-\S+\s+)*` before the path in a follow-up.

Triaged scope:
- High: plugins/openspec/hooks/guard.mjs (new gate file declared.json, the pr-verifier proof/ write exemption, the guardBash rule declareViolation, the runOf end-marker change), plugins/openspec/hooks/deliver-check.mjs (planDigest/planRevision, readDeclared/authorizedRounds, the prItem merged-at-advanced-head rule, foreignArchiveHead in isOwnPr/findChangePr/findByCommits), plugins/openspec/hooks/change-loop.mjs (declare/declaredStep/recordDeclared, approvalText Plan line), plugins/openspec/hooks/flow-check.mjs (postMerge via headInBase, plan-revised staleness, ceilingOf lift), openspec/config.yaml and the four schema.yaml files.
- Medium: plugins/openspec/hooks/conduct-check.mjs (resolve-base-conflict, conductor-task), review-round.workflow.js (args.limit validation), roadmap-loop.mjs and project-loop.mjs (imports), the agent and skill texts (pr-verifier proof/ scope, tdd-implementer Conductor: tasks, ship-change/devkit rows), plugin and marketplace manifests.
- Low (scanned for secrets and personal data only, across every added line of the diff): tests, docs, ADRs 0032/0033, CHANGELOG, the change folder and its proof/ run logs.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config

Discarded false positives:
- authz (declare bypass, F1) — not exploitable as a gate bypass: review-round only raises roundLimit (all current reviews must still approve; nextStep still needs consensus) and gate-red only routes to a fix; approval.md stays main-session only; and the design's risk table already accepts that the guard sees commands, not interpreter writes. Kept as a nit.
- authz (pr-verifier writes under proof/) — inProofFolder resolves the path (`..` normalized; probed: proof/../../d/x false, proofx/ false, the folder itself false) and runs after every gate check in writeViolation, so a proof/ path can never reach readiness.md, approval.md, declared.json, reviews/ or product code; the only escape would be a symlink, which affects every lexical rule the guard already had (evidence.md, verdict files).
- injection (declare `<id>` into a filesystem path) — declaredStep checks NAME.test(id) before changeDirOf/recordDeclared; words are cut to 200 characters and JSON-serialized, never reaching a shell.
- crypto (12-hex truncated SHA-256 plan digest) — this is tamper detection of plan edits after approval, not a credential, token or signature. approval.md, which holds the digest, is written by the main session only.
- authz (prItem met on an advanced head; postMerge via headInBase) — both need the local head to be an ancestor of origin/<base>, so it holds no commit that did not go through the protected base; prItem also needs the merged PR head in HEAD's history, so no unreviewed commit is accepted.
- authz (isOwnPr now accepts an archive-named head equal to the id) — foreignArchiveHead exempts only a head equal to the change id; the other rules (files under the change's active folder, none in its archive folder) are unchanged, and a head name was never proof.
- authz (runOf: an end line of another change no longer ends the run) — this narrows when the stop lock releases, so the lock is stricter, not weaker.
- secret — no secret-looking file staged; no token, key or credential pattern in any added line; the proof/ logs hold session ids and scrubbed paths only, with no home folder or email.
- config — the config.yaml and schema.yaml edits are comments and gate prose; changeDevkitBlock builds its regex from a constant key, with no fail-open default added.

Removed code checked: guard.mjs's old blanket pr-verifier refusal is replaced by an allow-list (proof/ only) plus a refusal for the rest. nextStep's stop-plan-approval now also fires for a started change whose plan changed, which is stricter. The fixed round 2 deadlock becomes roundLimit, which is 2 unless declared.json adds rounds. No validation, authz check or masking was dropped.

Tests run: none (a node -e probe of declareViolation and inProofFolder only, no file written).
