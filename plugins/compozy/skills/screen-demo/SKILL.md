---
name: screen-demo
description: Runs a project's demo command and files the screenshots and the journey video a change's declared screens produce, under openspec/changes/<id>/evidence/. Use when a change's `## Screens` section names at least one screen and the project has a demo_command, after verify and before the pull request.
---

# screen-demo

Works on one thing: the demo evidence for the screens a change declares in
`openspec/changes/<id>/proposal.md`'s `## Screens` section. Runs the project's own
`demo_command`, writes the files it produces under `openspec/changes/<id>/evidence/` with the
naming contract below, and commits them on the change branch. Writes no product code, no test and
no spec.

## The matrix

For every declared screen, one screenshot for each combination of:

- **theme** — `light`, `dark`.
- **width** — `desktop` (1440x900), `phone` (390x844).

Four files per screen (two themes x two widths), plus one video of the whole journey, shared by
every screen the demo covers.

## The file names (design D11, AC-6 demo-contract)

A published contract, exactly these names, under `openspec/changes/<id>/evidence/`:

```
evidence/<screen-id>-<theme>-<width>.png   # theme: light|dark, width: desktop|phone
evidence/journey.webm
```

`scripts/evidence-names.mjs` is the pure naming helper: `shotPath(changeId, screenId, theme,
width)` for one file, `shotPaths(changeId, screenId)` for a screen's four, `videoPath(changeId)`
for the video, and the exported constants `THEMES`, `WIDTHS` and `VIEWPORTS` (the two viewport
sizes the matrix fixes). A project's demo spec computes names from this module rather than
hand-writing the pattern, so the kit and the project never drift on what a file is called.

## The journey video

One `journey.webm`, short, covering the change's own path through its declared screens — the
sequence a reviewer would click through by hand, not a recording of the whole application. It is
not per-screen, per-theme or per-width: one file for the change.

## Where the evidence lands, and who reads it

Commit the evidence folder on the change's own branch (`<id>`), in the worktree already in use for
the change, next to the code it demonstrates. The `deliver` step of the loop links
`openspec/changes/<id>/evidence/` from the pull-request body, so a reviewer finds it from the PR
without asking.

## The example spec

`templates/demo/screens.spec.ts` is an example Playwright spec a project copies and adapts; it is
not a dependency this kit installs or runs (design D11, OD-4 — the project supplies its own
`demo_command`, which may or may not use Playwright). It reads three environment variables, which
is what a project's `demo_command` must set before running it:

- `DEMO_CHANGE_ID` — the change id, used for the evidence path.
- `DEMO_SCREENS` — the declared screens, as a comma-separated list of screen ids.
- `DEMO_URL` — the base URL to run the demo against (the loop's `demo_url` input).

## No demo_command, no demo

An empty `demo_command` means the project has no demo: the loop's `has_demo` branch is false, this
skill never runs, and no evidence folder is expected. This is not a failure; a project without a
demo pipeline pays nothing for this step.

## Never

- Write product code, a test or a spec.
- Invent a file name outside the `<screen-id>-<theme>-<width>.png` / `journey.webm` contract.
- Run when `demo_command` is empty.
