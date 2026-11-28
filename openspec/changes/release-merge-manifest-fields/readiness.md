<!-- devkit-stage readiness result=passed attempt=1 commit=4aa88a1ebea8213e62cdcfafa0b7b8257cf0867b -->
# Readiness review

Change: `release-merge-manifest-fields` · Reviewer: plan-readiness-reviewer · Base checked: `origin/main` at `6f03a57c` (branch HEAD `4aa88a1e`)

## Decision

- Status: APPROVED

Blockers: 0. An implementer can build every task from `design.md` D-1 to D-10 without a design choice, and each of AC-1 to AC-7 has a task and a test or run that proves it.

## Blockers

None.

## Validation

- `openspec validate release-merge-manifest-fields --strict`: valid, 0 errors.
- Gate commands run on the base: `python3 scripts/check.py` passed; `python3 scripts/gen-catalog.py --check` passed; `node plugins/compozy/kit/scripts/gen-agents.mjs --check` passed ("21 CompozyOS agents are up to date"); `node scripts/test-suite.mjs --own-files --concurrency=4` reported `selected no test file: 3 own files, none maps to a test`, exit 0. The change's full selective run is long and is the caller's. `claude plugin validate .` was not run.

## Scope

`correct`. The problem is objectively defined: the no-note refusal at `release-merge.mjs:713` blocks a description edit from a train or `--base` merge, and PR 148 is the example. Non-goals are tight: the noted path, `train-loop.mjs`, `gen-catalog.py`, and a whole pack entry or manifest the change added or removed.

## Proposal and design

- **Reading of requirements question 4.** `proposal.md` and `design.md` D-4 read "aborts on either side as today" as "behaves as today": only the change side's whole edits abort, and a base-side add or remove stays the base's. The reading is stated, justified (the literal one would newly refuse a train that carries a new pack) and matches the spec scenario "A pack entry or a manifest the joined head added". Accepted. The owner sees it at plan approval.
- **ADR check.** `decisions.md` records no new ADR. ADR 0022, ADR 0034 and ADR 0003 say nothing about a manifest edited beyond its version (grep of `docs/adr/`), so no rejected alternative is contradicted. Accepted.
- **Release note.** `release.md` reads: `packs:` with `devkit-openspec: minor`, a `## ` title, a body, no open fence. `openspec/config.yaml` names `devkit.release_tag`. No task bumps a version, edits the CHANGELOG, a pin or the catalog, or numbers an ADR. Task 2.3 checks that the diff touches none of those files.

## Claims verified against the code

| Claim | Result |
| --- | --- |
| `diffPaths` at `release-merge.mjs:36-46`, `manifestEditsBeyondVersion` at `:49-53` | confirmed |
| `resolveVersions` at `:233-263` collects `beyond`, and `:713` refuses the whole join | confirmed (`:236`, `:245`, `:262`, `:713`) |
| `side` at `:684` swaps the sides for `--base` and `--merge` | confirmed |
| `:715-720` writes `resolveManifest(<base side text>)` | confirmed (lines 715-720 of the file) |
| `withoutVersions` and `resolveManifest` in `deliver-check.mjs:1680` and `:1689` | confirmed. `withoutVersions` strips the top-level `version`, `metadata.version` and `plugins[].version`. |
| the catalog step runs when a manifest is written (`:734-740`), and `gen-catalog.py` reads `plugin.json` `description` (`:89-90`) | confirmed |
| the refusal is described in `docs/openspec-flow.md:337`, `CONTRIBUTING.md:60` and `openspec/specs/change-coordination/spec.md:942` | confirmed. The `CONTRIBUTING.md` sentence D-7 replaces exists once, byte for byte. |
| the tests pinning the old text: `release-merge.test.mjs:77`, `:246`, `:262`, `release-note.test.mjs:979-985`, `delivery-train-after.test.mjs:786-792`, `deliver-check-archive.test.mjs:1250`, `release-note.test.mjs:697` | confirmed. The `grep` finds no other test asserting the replaced sentences. |
| `--concurrency=N` and `--own-files` exist in `scripts/test-suite.mjs` | confirmed |
| `train-loop.mjs` `pathsDetail` and `build` turn exit 2 into `why: conflict` | confirmed (`:309-313`, `:328`). The design's `:308-313` is off by one line. |

I found no generalization that fails.

## Specs

Both deltas are `MODIFIED` and carry full requirement text. The `change-coordination` delta replaces the requirement that holds `:942`. Every outcome of the D-3, D-4 and D-6 decision tables has a scenario:

- a field only the change edited is kept;
- a field only the base edited is kept;
- two disjoint fields are both kept;
- a field both sides edited is refused;
- a whole entry or a new manifest is refused with the old text;
- a base-side add is not refused;
- a field inside an entry the base removed is a conflict (covered by T3, and by the spec "both sides" scenario at the requirement level).

The delivery-train delta names the exit code, `resolved: false`, the `conflicts` list and the clean tree.

## Tasks

- Every task path is a real directory. Each phase ends in a gate task (1.6 and 2.4). Every AC id appears in a task (the table at the top of `tasks.md`).
- Test-first is explicit, with a red check per task. T8 rewrites the pinned test at `:246` and its commit names the invariant, layer and suite (CLAUDE.md).
- The real run (2.2) proves each declared case (keep, refuse, `--base`) and first checks that the session can delete its folder outside the repo.
- No script or test file is added, so `scripts/test-map.json` stays unchanged, as the plan states.
- Task 2.1 re-reads every anchor after the base merge, as CLAUDE.md requires.

## Omissions

- **Validation, parsers:** D-5 sends a non-JSON side to the existing `try` in `main`, which restores the tree and exits 2. The test at `:262` stays.
- **Error handling:** two error texts, with exit 2 and the old head restored.
- **Idempotency and compat:** when the change edited no field, `text` is the base text, so today's output is byte-identical (T2).
- **Rollout and rollback:** revert of the commits, no data. Release is a minor bump through the note.
- **No findings** on retries, permissions, observability or migration (not applicable to a local script).

## Execution-readiness

Doubts for the next phase: none that change behavior. Two points are stated and accepted:

- an added key lands at the end of its object (listed under Risks);
- the whole-edit refusal now lists only the manifests with a whole edit (listed under Risks, no test pins the list).

Top production risks, all with a mitigation in the plan:

1. A formatted path changes in the `diffPaths` refactor and breaks the noted path's `assignBlocking`. `:77` and 1.4's diff check guard it.
2. The merged text differs byte-wise from today's for a version-only change. T2 and the unchanged `release-merge` tests guard it.
3. The T11 generator stub diverges from the real generator. The real run runs `gen-catalog.py --check`.
4. A base-side edit of a parent leaves the change's field with no parent. The helper throws a `ReleaseError`, so the tree is restored.
5. The selective gate runs slow or times out on a loaded machine. `--concurrency=4`, alone on the machine, with `TMPDIR=/var/tmp`.

## Mandatory questions

1. Problem objectively defined: yes.
2. Result measurable: yes, AC-1 to AC-7 with fixtures and a real run.
3. Error behaviors defined: yes, D-6 and D-7.
4. Edge cases covered: yes (same-value edit, removed entry, null sides, unnamed arrays, new key, removed key).
5. Dependencies clear: yes (`delivery-train` and `release-at-merge` archived, ADR 0036).
6. Contracts defined: yes (helper signature, return shape, error texts, exit codes).
7. Two developers could interpret it differently: no. D-1 to D-10 leave no choice.
8. Implicit decisions: the question 4 reading is explicit. The rest is written.
9. Tasks deliver the outcome: yes.
10. Discovered too late: nothing found. Task 2.1's re-read after the base merge is the one guard, and it is in the plan.

Findings: no findings at `Mandatory before implementation` or any other class.
