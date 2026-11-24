<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> Asked by the owner on 2026-11-24, after the first two delivery trains: "Precisamos resolver essa questão de versão. Sempre vai dar conflito." A change stops choosing numbers. Today every change writes its release into files every other change also edits (the packs' plugin.json, .claude-plugin/marketplace.json, CHANGELOG.md, the CI pin lines of docs/openspec-flow.md, the pin assertion in a test) and picks the next free ADR number, so any two changes conflict on those lines by design: the train renumbers the release files when it joins heads, but it left every boarded change of train 2 for the pin assertion in plugins/openspec/hooks/change-loop-compozy.test.mjs, and ADR numbers picked in parallel collided four times in one day, each renumbering staling reviews and sometimes the owner's plan approval. Wanted: each change carries a small release note in a file of its own (which pack changes, how big the bump is, the changelog line) and names its ADR without a final number; the delivery (the train, and the single-change merge step where there is no train) assigns the version and the ADR number once, at the moment it reaches the default branch, writes the manifests, the changelog, the pin and the tag, and no change branch edits a shared release line. In the grill: what a change's branch shows before it merges (how its ADR and release are named), what happens to a consumer project with no train and to one with no release file, how the archive check and the release tag follow, and how changes already open move over.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
