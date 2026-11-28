<!-- devkit-stage evidence result=passed attempt=1 commit=25fd70ac542b3bcef42a9323a1c80f2525a1b0aa -->
Commit: 25fd70ac542b3bcef42a9323a1c80f2525a1b0aa

# Evidence

Change: `release-merge-manifest-fields`. HEAD differs from the code commit `cf1eba16` (the base merge the proof ran on) only in files under `openspec/changes/release-merge-manifest-fields/` (proof files and `tasks.md`), checked with `git diff --name-only cf1eba16 HEAD`. Nothing was re-run by the verifier: the gate and the real run are the conductor's recorded runs, cited below.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.6, 2.4 | `node scripts/test-suite.mjs --own-files --concurrency=4` | pass: selective run recorded in `proof/gate-phase2.txt` (run at concurrency 2 on this machine), 33 `selected` lines at lines 2-34 of that file (the own-files tests of `release-merge.mjs`, `release-merge.test.mjs`, `delivery-train.test.mjs`, `CONTRIBUTING.md`, `docs/openspec-flow.md`), `suite: 33 files, 3713 tests, 3713 pass, 0 fail, 2491.1s, concurrency 2`; 0 failing lines |
| 1.6, 2.4 | `python3 scripts/check.py` | train: proven by the train record (`devkit.delivery.train` on origin/main is `node scripts/test-suite.mjs && python3 scripts/check.py`; this change does not edit the key). The conductor also recorded "all checks passed" at the end of `proof/gate-phase2.txt` |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | head-only field kept | `proof/real-run.txt` case 1: `release-merge.mjs --merge` with the head editing devkit-core's description exits 0, `resolved: true`, versions renumbered to 0.19.1 / 0.55.3, plugin.json and marketplace entry carry the head's description. Tests in `gate-phase2.txt`: `release-merge-manifest-fields AC-1 mergeManifestFields keeps a field only the change side edited` and `AC-1 AC-6 the join keeps the head's description in both manifests` pass | pass |
| AC-2 | train-only field kept | Tests `AC-2 mergeManifestFields keeps a field only the base side edited` and `AC-2 the join keeps the train's description with the renumbered version` pass in `gate-phase2.txt`; no separate real-run case | pass |
| AC-3 | both-sides field refused | `proof/real-run.txt` case 2: exit 2, `resolved: false`, `oldHead` equals HEAD after (554c8155), clean `git status --porcelain`, no `.git/MERGE_HEAD`; `error` is "a manifest field was edited on both sides: .claude-plugin/marketplace.json (plugins[devkit-core].description); plugins/core/.claude-plugin/plugin.json (description)". Tests `AC-3 mergeManifestFields refuses...` and `AC-3 the join refuses a description both sides edited...` pass | pass |
| AC-4 | disjoint fields merged | Tests `AC-4 mergeManifestFields merges two different fields of one manifest` and `AC-4 the join keeps the head's description and the train's homepage in one plugin.json` pass in `gate-phase2.txt`; no separate real-run case | pass |
| AC-5 | base mode, same rule | `proof/real-run.txt` case 3: `--base main` exits 0 with `resolved: true`, description kept, version 0.19.1. Tests `AC-5 --base keeps the branch's description...` and `AC-5 --base refuses a description both sides edited and aborts to oldHead` pass | pass |
| AC-6 | catalog follows | `proof/real-run.txt` case 1: `python3 scripts/gen-catalog.py --check` exits 0 after the join and `docs/catalog.md` holds the head's description (count 1). Test `AC-1 AC-6 the join keeps ... regenerates the catalog` passes | pass |
| AC-7 | docs say the rule | Test `release-merge-manifest-fields AC-7 the flow page and CONTRIBUTING state the field rule` passes in `gate-phase2.txt`; `docs/openspec-flow.md` and `CONTRIBUTING.md` changed (own-files selection lists both); the `change-coordination` and `delivery-train` spec deltas exist under `specs/`. The verifier did not re-read the prose line by line | pass |

Outcome: verified
