Verdict: approved
Commit: 76e88ad3fdab3ffd0ced32b6418bc4c38cef11da

## Security audit — project-setup (round 2)

### Findings

Triaged scope:
- High: plugins/openspec/hooks/guard.mjs (parseDevkitBlock now splits on CRLF), plugins/openspec/hooks/change-loop.mjs (the `setup` verb now needs a git top level even when findRoot finds an openspec folder), plugins/openspec/skills/devkit/scripts/setup-block.mjs (ciPinOf now uses deliver-check's pinsIn; checkBlock refuses an inline map or list on any line of the block).
- Medium: plugins/openspec/hooks/flow-check.mjs (readTestSettings splits on CRLF), plugins/openspec/skills/devkit/SKILL.md (step 7 prose about a blocked ruleset), openspec/config.yaml (ADR list text only).
- Low: CONTRIBUTING.md (suite gate prose), ADR 0026 and 0031 (amendment lines), the project-setup plan, evidence and review files, the new tests (CRLF twins, inline map or list refusal, the `none` delivery answer, trunk-auto in the same call, the ciPin template reader, setup-no-repo with openspec/changes, the blocked-ruleset skill text, the ADR 0026 records). The archived suite-socket-path folder and openspec/trains/18.md came in through the train 18 merge of origin/main and are not this change's own code.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

- Injection: no new sink. ciPinOf now returns only a token that matches PIN_TOKEN (`v\d+\.\d+\.\d+`) from a PIN_MARKER line. The old regex captured any `\S+`, so the value that reaches the setup's plan output is now narrower. The new checkBlock rule only adds a refusal (it throws before any write). The CRLF split changes how lines end and nothing else: values lose a trailing `\r` they used to keep, and every key regex and value check stays the same.
- Authn/authz: the `setup` branch of startMode is stricter. It used to return `root: start` without asking git; now a folder outside any git repository answers setup-no-repo even when it holds openspec/changes (covered by the new change-loop test). The skill keeps `disable-model-invocation: true`. No guard or write lock changed: guard.mjs changes only its line split.
- Exposure: the new refusal message prints a line number and a fixed text. No credential is printed.
- Crypto: none touched.
- Secret: a credential-pattern scan of every added line in the range found nothing. No secret-looking file was added.
- Config: no new defaults. Reading CRLF the same way as LF cannot turn a setting the readers refused into a weaker one: the same values are accepted as from the LF twin (pinned by the delivery-models, flow-check and setup-block CRLF tests).

Tests: plugins/openspec/skills/devkit/scripts/setup-block.test.mjs and plugins/openspec/hooks/flow-check.test.mjs ran once, with --concurrency=3 and TMPDIR=/var/tmp/devkit-project-setup, while no other suite was running (load average 2.75): 2 files, 177 tests, 177 pass, 0 fail.

Discarded false positives:
- authz: evidence F-1 shows a session asked in plain words running the setup's scripts by hand and writing .claude/settings.json, openspec/ and .agents/skills. A session that can run those scripts already has Bash and can write the same files directly, so the scripts give it no new capability. The old skills' scripts could be run the same way, and the owner accepted the narrower spec wording (choice A, D-14 note).
- config: guard.mjs parseDevkitBlock now reads a CRLF `driver`/`delivery.model` that it used to read as an unknown value with a trailing `\r`. That fixes a misread, not a fail-open default. Every reader applies the same accepted-value lists.
- injection: the CI pin read from .github/workflows/devkit-reviews.yml comes from the repository's own file and is limited to a vX.Y.Z token. There is no trust boundary and no shell or path sink.
- authz: setup-no-repo now wins over a found openspec folder. That only adds a refusal.

Out of round: none.
