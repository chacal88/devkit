# Dogfood: this change numbers its own release and ADR (task 8.1)

Run from this worktree on 2026-11-24, after the merge of origin/main at 74f2444 (train 11; merge commit 29d022b), with origin/main fetched just before and unchanged:

```
TMPDIR=/var/tmp/devkit-release-at-merge node plugins/openspec/hooks/release-merge.mjs --assign --base main --json
```

Exit 0. JSON:

```json
{
  "resolved": true,
  "oldHead": "29d022b4fe36cc14812b323b063e306eea68eb7d",
  "newHead": "2bd35c53aa9dfc4f832293caf8600f88fd9bc735",
  "versions": {
    "packs": {
      "devkit-openspec": "0.46.0",
      "devkit-core": "0.17.0",
      "devkit-compozy": "0.4.1"
    },
    "metadata": "0.51.0"
  },
  "files": [
    "plugins/compozy/.claude-plugin/plugin.json",
    "plugins/core/.claude-plugin/plugin.json",
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "release-at-merge",
  "adrs": [
    {
      "from": "docs/adr/release-at-merge.md",
      "to": "docs/adr/0031-release-at-merge.md"
    }
  ],
  "citations": [
    "CONTRIBUTING.md",
    "docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md",
    "docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md",
    "docs/openspec-flow.md",
    "openspec/config.yaml"
  ],
  "mode": "assign"
}
```

The step's commit is 2bd35c5 `chore(release): assign the release of release-at-merge`.

## Earlier attempts

1. At 0684595 (after the merge of train 10) the step exited 2: `ADR [feat] is cited but has not landed on main` and four more fixture slugs. The citation scan read the `ADR [x]` string literals of the test files. Fixed test-first in 620c047 (a citation lives only in Markdown and YAML files).
2. At 620c047 origin/main had moved (train 11); the step exited 2 with `conflicts` in `plugins/openspec/hooks/change-loop.test.mjs` and `plugins/openspec/skills/ship-change/SKILL.md`, outside the release lines, and left the tree as it was. The base was merged (29d022b) and the step ran again (above).

## Checks after the step

```
$ git diff --stat HEAD^ HEAD -- openspec/changes/
(empty)
$ head -1 docs/adr/0031-release-at-merge.md
# ADR 0031: A change carries a release note and an unnumbered ADR, and the delivery numbers both once, at the merge
$ git grep -c 'ADR \[release-at-merge\]' -- ':!openspec/changes'
(none)
$ python3 scripts/check.py
all checks passed
$ GITHUB_HEAD_REF=train/99 python3 scripts/check.py   (a train head counts as the base: no unnumbered ADR is left)
all checks passed
$ node plugins/openspec/hooks/deliver-check.mjs release-at-merge --json   (next)
{"step": "implement", "reason": "phase 8 has unticked tasks: 8.1", "phase": 8}
```

No row N1 to N7: the next step is the open task 8.1 itself, not `assign-release` or a refusal.
