Verdict: approved
Commit: e10b21d46af3cc79a5977063f55fa74776073875

## Spec review — compozy-loop-v2

This change sets `skip_specs: true`; the contract reviewed is AC-1..AC-10 of
`openspec/changes/compozy-loop-v2/proposal.md` plus `tasks.md`'s checked tasks.

In-scope specs: `openspec/changes/compozy-loop-v2/proposal.md` (## Acceptance criteria),
`openspec/changes/compozy-loop-v2/tasks.md`, `openspec/changes/compozy-loop-v2/design.md`
(decisions D1-D14, cited by the tasks as the reference).

### Coverage

| Requirement | Status |
|---|---|
| AC-1 `kit-pack` | covered |
| AC-2 `loop-shape` | covered |
| AC-3 `design-gate` | covered |
| AC-4 `screens-check` | covered |
| AC-5 `ci-green` | covered |
| AC-6 `demo-contract` | covered |
| AC-7 `archive-cleanup` | covered |
| AC-8 `portable-hooks` | covered |
| AC-9 `repo-adopts` | covered |
| AC-10 `release-ready` | covered |

### Evidence per criterion

- **AC-1** `plugins/compozy/.claude-plugin/plugin.json` carries `name: devkit-compozy`,
  `version: 0.1.0`, a one-sentence description, `keywords`, `author`/`license`/`homepage`/
  `repository` matching the other packs. `plugins/compozy/README.md` has the
  `<!-- catalog:begin -->`/`<!-- catalog:end -->` markers filled (lines 48-56) and
  `.claude-plugin/marketplace.json` carries the `devkit-compozy` entry (source
  `./plugins/compozy`, version `0.1.0`, category `development`). Ran
  `python3 scripts/gen-catalog.py --check` and `python3 scripts/check.py`: both pass (confirmed
  live). `plugin validate .` and the 13-minute guard suite are task 7.6, left unchecked in
  `tasks.md` — see note below, not re-verified here per instruction.
- **AC-2** `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:98-619`
  declares the seventeen nodes in exactly the stated order (`propose`, `approve_plan`,
  `touches_screens`, `design`, `screens_ok`, `implement`, `review`, `verify`, `has_demo`, `demo`,
  `deliver`, `ci_fix`, `checks_green`, `await_merge`, `merged`, `archive`, `cleanup`) and eighteen
  edges (`:594-612`), including the two skip edges `approve_plan → implement` (`:597`) and
  `verify → deliver` (`:604`). Every gate (`approve_plan`, `screens_ok`, `verify`, `checks_green`,
  `merged`) has only `type: command` criteria; the only two human decisions (`implement`'s and
  `deliver`'s `review:` blocks, `:303-320` and `:457-461`) both carry `responders: { agents: deny }`;
  no `agent-judge` criterion and no `kind: goal` node anywhere. `plugins/compozy/skills/compozy-
  setup/scripts/loop-template.test.mjs` pins all of this and passes (18 tests). Independently ran
  `compozy loop validate --file <template> -o json` against the real CompozyOS daemon on this
  machine: `{"valid": true}` — the strongest proof in design.md's own words, and it passes for
  real, not only via the test's daemon-optional skip path.
- **AC-3** `touches_screens` (`:187-190`) branches on `size(nodes.propose.output.screens) > 0`;
  `design` and `screens_ok` are its exclusive descendants; with an empty `screens` list,
  `implement`'s second incoming edge from `approve_plan` (`:597`) lets it run with `design`/
  `screens_ok` skipped. Pinned by `loop-template.test.mjs` and independently by `screens-
  check.test.mjs`'s own "design-gate" fixtures reading a real project's screen-map shape.
- **AC-4** `plugins/compozy/skills/screen-design/scripts/screens-check.mjs`: exit 0 only when
  every declared id is a mapped row AND the map has a `Mockup:` line with a version/ISO date
  (`compute`, `:126-181`); exit 1 naming missing ids/version (`renderHuman`, `:183-200`); exit 3 on
  a setup error — unknown change, unreadable map (directory, no-read), a `design:` block with no
  `screen_map` or pointing nowhere (`:126-164`). 21 tests in `screens-check.test.mjs` cover every
  exit path named in the criterion, including `--json`.
- **AC-5** `ci_fix` (`:471-495`, after `deliver`) prompts the implementer to register a "CompozyOS
  pull-request monitor" and fix until green, naming `sleep`, `gh pr checks --watch`,
  `gh run watch` and "a polling loop" as forbidden by name (`:480-482`); `checks_green`
  (`:500-510`) gates on `gh pr checks <url> --required`, `on_result.fail: escalate`. Confirmed no
  executed `check:`/`contract.verification` command in the file contains `sleep `, `--watch`,
  `gh run watch` or `until ` (only inside natural-language prompt prohibitions, which an agent
  reads but the engine never executes) — `grep` against the file confirms the three hits are all
  on prompt/comment lines (467, 481, 523), none inside a `check:` string.
- **AC-6** `screen-demo/SKILL.md` (:14-31), the `demo` node's prompt (loop.yaml `:402-409`) and
  `templates/demo/screens.spec.ts` agree on `evidence/<screen-id>-<theme>-<width>.png` and
  `evidence/journey.webm`, both themes (light/dark), both widths (desktop/phone), one video; the
  spec's inlined constants are asserted equal to `evidence-names.mjs`'s exports
  (`evidence-names.test.mjs`, 14 passing tests). `deliver`'s prompt (`:443-446`) links
  `openspec/changes/<id>/evidence/` from the PR body when `nodes.demo.output` exists.
- **AC-7** `archive` (`:556-582`) runs the `ship-change` archive steps; `cleanup` (`:586-592`,
  `kind: compozy__worktree_remove`, `on_error: { allow_fail: true }`) has its only incoming edge
  from `archive` (`:612`), whose only incoming edge is from `merged` (`:611`) — cleanup runs only
  after the change is merged and archived. `definition_of_done` (`:67-75`) keeps "except tasks the
  operator deferred by a dated decision recorded in tasks.md" verbatim.
- **AC-8** `templates/bin/devkit-kit` resolves `$DEVKIT_HOOKS` → repository checkout
  (`plugins/openspec/hooks/`) → installed `devkit-openspec` (highest `version`, integer-field
  comparison, lexicographic tie-break) for `deliver-check`/`conduct-check`, and resolves
  `screens-check` inside this pack only, ignoring `$DEVKIT_HOOKS` — exactly as design D9
  specifies. `devkit-kit.test.mjs` (12 tests) exercises every source, the tie-break rules
  (version-vs-mtime-vs-name, `0.13.0` > `0.9.0`, same-version path tie-break) and both exit-3
  paths. Every template file greps clean of a one-repository path (role-shells.test.mjs's deny
  list, `:48-55`, plus the loop template's own `.compozy/bin/devkit-kit` calls).
- **AC-9** This repo's `.compozy/` (loop, four role shells, `config.toml`, `README.md`,
  `bin/devkit-kit`) is asserted byte-for-byte equal to the templates rendered with
  `substitutions.json`'s values (`adoption.test.mjs`, 10 passing tests, render-then-compare, not a
  heuristic). Independently confirmed by running `compozy loop validate` directly against both
  `plugins/compozy/.../templates/loops/openspec-change/loop.yaml` and the installed
  `.compozy/loops/openspec-change/loop.yaml`: both return `{"valid": true}` against the real
  CompozyOS daemon on this machine.
- **AC-10** `marketplace.json` gains the `devkit-compozy` entry and `metadata.version` bumps to
  `0.17.0` (diff confirmed, no other pack's version touched); `CHANGELOG.md` gains the `0.17.0`
  entry; `docs/catalog.md` is regenerated with the `devkit-compozy` section (`gen-catalog.py
  --check` passes); the kit is named in `README.md` (pack table + "seven packs" sentence,
  matching the actual plugin count: core, openspec, panel, design, stack, ai-engineering,
  compozy), `docs/conventions.md` (pack table row), `CLAUDE.md` (table row) and the new
  `docs/compozy-kit.md`.

### Scope check

No behavior in the diff that the acceptance criteria or `tasks.md` do not ask for. The only file
not named by any task — `scripts/gen-catalog.py`'s `PACKS` list gaining `"compozy"` — is
necessary support for task 7.5 ("regenerate `docs/catalog.md`") and AC-1's gate
(`gen-catalog.py --check`), not an unrelated addition.

### Note (not scored)

Task 7.6 (the final gate, `gen-catalog.py --check && check.py && plugin validate . &&
guard.test.mjs`) is unchecked in `tasks.md`, as flagged by the caller for independent
verification — not reviewed here.

### Summary
- 0 findings (0 scope creep, 0 gaps)
