Verdict: approved
Commit: 0bf76b45f9360e60d58bae1d927a5475b914dc2b

## Security audit — release-tags (round 1)

### Findings

Triaged scope: high: deliver-check.mjs (release facts, tagVersion, releaseTagFacts, archiveNext), guard.mjs (isJsonPath, releaseTagSetting), ship-change/SKILL.md (tag-release row); medium: change-loop.mjs; low: docs, tests, changelog, evidence.

Trace: the version read from the JSON file at the merge commit is checked by tagVersion (allow-list regex, no '..', no trailing '.' or '.lock'; probed with -f, spaces, '..', '@{', '/', '.lock' and a trailing newline, all rejected) before v<version> reaches the API route, git tag and git push origin refs/tags/<tag>. The v prefix rules out option injection. All shas are 40-hex checked. release_tag is checked by isJsonPath. gh is spawned with an argument array, no shell. The push is one explicit refspec with no force or --tags. An existing tag at another commit stops the run as blocked.

Findings: none. Discarded false positives: injection via version or release_tag; PR author controlling version (reviewed and merged change); fail-closed config; exposure; tag race between check and push (non-force push rejected by git).
