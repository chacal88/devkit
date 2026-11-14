---
name: screen-design
description: Reads a project's screen map and mockup version, proposes or confirms a row for each screen a change declares, and runs the mechanical half of the design gate. Use when a change's `## Screens` section names at least one screen, before implementation starts.
---

# screen-design

Works on one thing: the rows of the project's screen map and the mockup version they point to,
for the screens a change declares in `openspec/changes/<id>/proposal.md`'s `## Screens` section.
Writes no product code, no test and no spec.

## Reading the map and its mockup version

The project's `openspec/config.yaml` carries a `design:` block naming where this lives:

```yaml
design:
  screen_map: docs/design/screen-map.md
  mockup: Figma                 # optional: the tool or document the mockup lives in
```

- `screen_map` is a path to a Markdown document, relative to the project root. It holds a table
  with one row per screen, **the screen id as the row's first cell**, and somewhere in the
  document a line starting with `Mockup:` carrying the version or the date of the mockup the rows
  describe (`Mockup: v3`, `Mockup: 1.2.0`, `Mockup: 2026-11-14`).
- `mockup` names the tool or document the mockup itself lives in (a Figma file, a design doc); it
  is informational only; `screens-check` does not read it to decide pass or fail.
- No `design:` block means the project has no screen map to check against: nothing to read, and
  the design gate is a no-op for it (see `screens-check`'s own `SKILL.md`-adjacent contract below).

## What a proposed row must carry

For a screen not yet in the map, or whose mockup is no longer current, propose a row with:

- **id** — the same id the change's `## Screens` section uses, exactly (no rename at this stage).
- **screen** — its name, the one a reader of the map would recognize.
- **what it shows and allows** — the content and the actions the screen holds, specific enough
  that a reviewer can tell the mockup matches it without opening the mockup tool.
- **the stage** — where the screen is on its way to shipping (for example: proposed, mocked,
  implemented).
- **the level of detail in the mockup** — whether the mockup is a sketch, a wireframe or a
  high-fidelity screen, so the reviewer knows how much to expect from it at this stage.

Bump the document's `Mockup:` line to the version or date the new rows describe; every row the
document carries is read against that one version, not a per-row one.

## Where the rows land

Propose and write the rows on the change's own branch (`<id>`), in a worktree created for the
change when one does not already exist, together with `openspec/changes/<id>/mock/screens.md`
(the change's own record of what was proposed). Commit both there. The screen map's rows and the
code that implements the screens merge together in the same pull request: a map updated on `main`
ahead of the code it describes would describe screens no commit yet builds.

## One review, before any code

Never approve a proposed row. The screen-map rows and the mockup version are part of what the
operator reviews before `implement` runs, in the same review as the plan itself (plan and design,
one decision): both can still change together if the operator asks for either. Only the operator's
`approve` decision opens the way to code.

## The mechanical check

`scripts/screens-check.mjs` is the command half of the design gate (design D5): it confirms every
screen a change declares is a row of the map and the map's `Mockup:` line carries a version or a
date, but it never judges whether a row's content is accurate — that is this skill's and the
operator's job.

```
node scripts/screens-check.mjs --change <id> [--json]
```

- **Exit 0** — every declared screen is mapped and the map has a valid `Mockup:` line, *or* the
  change declares no screens, *or* the project has no `design:` block. A project without a UI pays
  nothing for this gate.
- **Exit 1** — a real failure: a declared screen is missing from the map, the map has no
  `Mockup:` line, or that line's value is neither a version nor an ISO date. The message names
  what is missing.
- **Exit 3** — a setup error: an unknown change, a `design:` block whose `screen_map` names no
  `screen_map` key or a path that does not exist, or a map path that exists but cannot be read
  (a directory, or no read permission).

`--json` prints, on stdout, a verdict shaped like this (no trailing fields beyond these; a
no-op run still reports `"pass": true` and `"noop": true`):

```json
{
  "version": 1,
  "change": "compozy-loop-v2",
  "screens": ["chat-list", "chat-thread"],
  "designConfigured": true,
  "screenMap": "docs/design/screen-map.md",
  "mockupTool": "Figma",
  "mapped": ["chat-list", "chat-thread"],
  "missing": [],
  "mapMockup": "v3",
  "mapMockupOk": true,
  "noop": false,
  "pass": true
}
```

A setup error (exit 3) prints `{"version": 1, "error": "<message>"}` on stdout instead, and the
same message on stderr, prefixed `screens-check: `.

## Never

- Write product code, a test or a spec.
- Approve its own proposed row.
- Treat `mockup` (the tool) as a substitute for the map's own `Mockup:` line (the version):
  `screens-check` only reads the latter.
