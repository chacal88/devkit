# Design: a change's validation names its type

Change: `openspec-type-flag` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `specs/openspec-cli/spec.md`). Plan base: `c055e55`. devkit-lite has no
design stage. This file holds the how that `tasks.md` executes, so the implementer makes no design choice.

## What was measured at plan time

- The OpenSpec CLI on `PATH` answers `2.0.0` (CI installs `@fission-ai/openspec@2.0.0`, `.github/workflows/ci.yml:23`).
  In a scratch project (`schema: spec-driven`) holding the change `same` and the spec `same`:
  - `openspec validate same --strict` exits 1 with "Ambiguous item 'same' matches both a change and a spec.";
  - with `--json`, it prints `{"status":[{"severity":"error","code":"ambiguous_item",...}]}` on stdout and exits 1;
  - `openspec validate same --type change --strict` and the same with `--no-interactive` print
    `Change 'same' is valid` and exit 0.
- The rule of D-3, run as a prototype on the plan base, reports exactly 31 lines and no other line of the
  repository. They are the 14 source lines of D-1's table and 17 copies:
  - `openspec/schemas/devkit/schema.yaml:149, 275, 320, 408` and `openspec/schemas/devkit-lite/schema.yaml:107, 236, 322`;
  - `plugins/compozy/kit/templates/agents/change-planner/AGENT.md:53, 108`,
    `.../plan-readiness-reviewer/AGENT.md:41` and `.../openspec-validator/AGENT.md:38, 54`;
  - the same five lines under `.compozy/agents/`.

## D-1 The texts

Each edit replaces one line, and the rest of the line stays as it is. `<id>` and `<change-id>` keep the
placeholder each file already uses.

| File:line (plan base) | Before (the command part) | After (the whole line) |
| --- | --- | --- |
| `plugins/core/agents/plan-readiness-reviewer.md:23` | `` `openspec validate <id> --strict` `` | ``3. Run `openspec validate <id> --type change --strict` when the project uses OpenSpec, and count its errors as findings.`` |
| `plugins/core/agents/change-planner.md:33` | ``setting `result=passed` once `openspec validate <id> --strict` passes.`` | the same line, ending ``setting `result=passed` once `openspec validate <id> --type change --strict` passes.`` |
| `plugins/core/agents/change-planner.md:88` | ``in OpenSpec mode also `openspec validate <change-id>`)`` | the same line, with ``in OpenSpec mode also `openspec validate <change-id> --type change --strict`)`` |
| `plugins/openspec/agents/openspec-validator.md:18` | `` `openspec validate <change-id> --strict` `` | ``1. **CLI validation.** Run `openspec validate <change-id> --type change --strict` and report the result verbatim. Its verdict is final — never override it.`` |
| `plugins/openspec/agents/openspec-validator.md:34` (inside the fenced report) | `- openspec validate <change-id> --strict: PASS \| FAIL` | `- openspec validate <change-id> --type change --strict: PASS \| FAIL` |
| `plugins/core/skills/plan-readiness-review/SKILL.md:50` | ``(or `openspec validate <id> --strict` if the CLI lacks those flags)`` | ``OpenSpec: validate first with `openspec validate <id> --type change --strict --no-interactive`. Otherwise, do the structural checks by hand.`` |
| `plugins/core/skills/review-change/SKILL.md:40` | ``: `openspec validate <id> --strict` (add `--type change --no-interactive` when the CLI supports them).`` | ``- OpenSpec repo with a change id: `openspec validate <id> --type change --strict --no-interactive`.`` |
| `plugins/openspec/schemas/devkit/schema.yaml:149, 275, 320, 408` | ``Gate: `openspec validate <id> --strict` passes.`` | ``      Gate: `openspec validate <id> --type change --strict` passes.`` (six spaces of indentation, as now) |
| `plugins/openspec/schemas/devkit-lite/schema.yaml:107, 236, 322` | the same | the same |

The frontmatter `description` of `openspec-validator.md` names `openspec validate --strict` with no id. It stays as it
is, so `plugins/openspec/README.md`, `docs/catalog.md` and `python3 scripts/gen-catalog.py --check` stay as
they are, and so does the description of the generated CompozyOS agent. No hook, no `flow.json` and no
template's stage header changes. `scripts/released-flows.json` digests `flows/<n>.json` only, so its digests
stay valid.

## D-2 The copies

Run in this order from the worktree root, after D-1:

1. `bash plugins/openspec/skills/devkit/scripts/install-schemas.sh .` writes `openspec/schemas/devkit/schema.yaml`
   and `openspec/schemas/devkit-lite/schema.yaml`. `flow-check schema: the openspec/schemas copies are
   byte-identical` (`plugins/openspec/hooks/flow-check.test.mjs:188`) holds them (CONTRIBUTING.md:78).
2. `node plugins/compozy/kit/scripts/gen-agents.mjs` rewrites
   `plugins/compozy/kit/templates/agents/{change-planner,plan-readiness-reviewer,openspec-validator}/AGENT.md`
   (bodies are the source text, `docs/compozy-kit.md:37-40`); `--check` then exits 0.
3. `node plugins/compozy/kit/scripts/install-kit.mjs .` reinstalls the repository's `.compozy/`. It reads the
   recorded inputs from `.compozy/kit-manifest.json`, writes the same three
   `.compozy/agents/<role>/AGENT.md` (`update`), and records their new digests in `.compozy/kit-manifest.json`.
   Every other kit file is `same`. This is the step that change `release-at-merge` ran (commit `33560369`,
   "reinstall the repository's CompozyOS agents"). If it reports any other file as `update`, `edited` or
   `remove`, the implementer stops and reports it, and edits nothing by hand.

## D-3 The repository check (`scripts/check.py`)

A new function `check_validate_type()`, defined after `check_install_scope()` (`scripts/check.py:103`),
the nearest pattern (a line rule over files that names `file:line`). `main()` calls it right after
`check_install_scope()`. The module docstring gains one bullet after the install-scope bullet:
"- every `openspec validate` command that names an id in an agent, skill, schema or CompozyOS agent file
passes `--type change` (a change and a spec of one id are ambiguous);".

**Files read.** These are the files under `ROOT` matching one of the patterns below, each read once, sorted.
A file is skipped when its path relative to `ROOT` has a `fixtures` part or a part in `SKIP_DIRS`:

- `plugins/*/agents/*.md`
- `plugins/*/skills/**/*.md`
- `plugins/*/schemas/**/*.yaml` and `plugins/*/schemas/**/*.md`
- `openspec/schemas/**/*.yaml` and `openspec/schemas/**/*.md`
- `plugins/compozy/kit/templates/agents/*/AGENT.md`
- `.compozy/agents/*/AGENT.md`

So `docs/`, the repository's and the packs' `README.md`, `CONTRIBUTING.md`, `openspec/changes/` (the archive
included) and `plugins/openspec/skills/devkit/scripts/fixtures/schemas-0.13.0/` are not read.

**Code.** The file is read line by line, numbered from 1. A line whose text, with its leading spaces stripped,
starts with three backticks opens or closes a fenced block and is not itself read. On a line inside a fenced
block the whole line is code. On any other line, code is each backtick span: the text between a backtick and
the next backtick on the same line (the regex `` `([^`\n]*)` ``, as `check_links` uses).

**Unterminated input.** A fence that is never closed makes every line after it code, up to the end of the
file. A lone backtick with no closing one on its line opens no span, so the text after it is prose. An empty
file reports nothing.

**The rule.** In each piece of code, every match of `openspec validate\s+(?!-)\S` is a command that names an id.
Its first argument does not start with `-`, so `--all`, `--strict` and a bare `openspec validate` name none.
The command's text runs from the match to the next `openspec validate` in the same piece, or to the piece's
end. The command is refused when that text does not hold `--type change`. Flag order is free, so
`--strict --type change --json` passes.

**Report.** One problem per refused command, appended to `problems`:
`f"{rel}:{n}: openspec validate names an id without --type change; a change and a spec of one id are ambiguous"`,
`rel` with `/` separators (`f.relative_to(ROOT).as_posix()`). The check reads no git state and no network.

**Docs.** `CONTRIBUTING.md` gets one sentence at the end of the paragraph of step 4 that states the `t.test(` rule
(line 50): "`scripts/check.py` also fails on an `openspec validate` command that names an id without
`--type change` in an agent, skill, schema or CompozyOS agent file, naming the file and line: a change and
a canonical spec of one id are otherwise ambiguous."

## D-4 Tests

All new tests live in one new file, `plugins/openspec/hooks/validate-type.test.mjs`, a fast file (not in
`slow`). Its header comment says what it covers and how to run it alone
(`node scripts/test-suite.mjs plugins/openspec/hooks/validate-type.test.mjs`), as `version-pin.test.mjs:1-3`
does. Every name starts with `openspec-type-flag AC-<n> `. Invariant: the packs' texts and this repository's
check keep every validation of one change typed. Layer: the shipped Markdown and YAML texts, and
`scripts/check.py`. Suite: `validate-type`. Folders come from `tmpFolder` of `./test-tmp.mjs` (ADR 0026), with
the prefixes `devkit-validate-type-` and `devkit-validate-same-`.

Helpers of the file (one each, no second copy elsewhere):

- `REPO`: the repository root (`join(HERE, '..', '..', '..')`). `CHECK_PY`: `join(REPO, 'scripts', 'check.py')`.
- `lint(files)`: writes `files` (path, text) into a new `tmpFolder('devkit-validate-type-')`, runs
  `spawnSync('python3', [CHECK_PY, '--root', root], { encoding: 'utf8' })` and returns `{ code, out }`, the same
  shape as `guard.test.mjs:675-678`.
- `agent(name, ...body)` and `skill(name, ...body)`: a frontmatter of four lines
  (`---`, `name: <name>`, `description: Checks the fixture. Use when testing.`, `---`), then the body
  lines. `check_assets` then reports nothing, and body line `k` is file line `4 + k`.
- `refused(out)`: the sorted `path:line` of each output line that matches
  `^(\S+):(\d+): openspec validate names an id without --type change`.
- The constants `TYPED = 'openspec validate <id> --type change --strict'` and
  `TYPED_NI = `${TYPED} --no-interactive``. T-10 and T-11 both use them, so the tested command and the
  shipped text cannot drift apart.

The scratch roots use the pack `plugins/demo/` for agents, skills and schemas. `check_flow_versions` then reads
no `plugins/openspec/schemas/`, and no other check of `check.py` reports a problem on them.

| Id | Test name (after the prefix) | Input | Expected |
| --- | --- | --- | --- |
| T-1 | `AC-3 the bare form in a backtick span of an agent is refused, naming the file and the line` | `plugins/demo/agents/a.md` = `agent('a', 'text', ``3. Run `openspec validate <id> --strict` when the project uses OpenSpec.``)` | code 1; `refused` = `['plugins/demo/agents/a.md:6']` |
| T-2 | `AC-3 a bare line inside a fenced block is refused, and an unclosed fence runs to the end of the file` | `a.md`: body ```` ``` ````, `- openspec validate <change-id> --strict: PASS \| FAIL`, ```` ``` ````; `b.md`: body ```` ``` ````, `x`, `openspec validate <id> --strict` (no closing fence) | code 1; `refused` = `['plugins/demo/agents/a.md:6', 'plugins/demo/agents/b.md:7']` |
| T-3 | `AC-3 a line with the typed form and a fallback is refused once, and so is a bare command after a typed one` | `plugins/demo/skills/s/SKILL.md` body line 1: ``validate with `openspec validate <id> --type change --strict` (or `openspec validate <id> --strict` if old)``; body lines 2-4: a fence holding `openspec validate a --type change --strict && openspec validate b --strict` | code 1; `refused` = `['plugins/demo/skills/s/SKILL.md:5', 'plugins/demo/skills/s/SKILL.md:7']` |
| T-4 | `AC-3 every kind of file is read: a pack schema and its template, the openspec/schemas copy, the kit's agent template and the .compozy copy` | each of `plugins/demo/schemas/x/schema.yaml` (lines 1-3 `artifacts:`, `  - id: p`, `    instruction: \|`, line 4 ``      Gate: `openspec validate <id> --strict` passes.``), `plugins/demo/schemas/x/templates/proposal.md`, `openspec/schemas/x/schema.yaml`, `plugins/compozy/kit/templates/agents/r/AGENT.md`, `.compozy/agents/r/AGENT.md` holds the bare span on a known line | code 1; `refused` names the five files, each at its line |
| T-5 | `AC-3 the typed form passes, its flags in any order, in a span and in a fence` | agent, skill and schema holding ``TYPED``, ``TYPED_NI``, `` `openspec validate <id> --strict --type change --json` `` in spans and the same in a fence | code 0; output `all checks passed` |
| T-6 | `AC-3 a command that names no id passes: --all, the bare name, a flag first` | spans `` `openspec validate --all --strict` ``, `` `openspec validate` rejects a change ``, `` `openspec validate --strict` fails `` in an agent and a schema | code 0 |
| T-7 | `AC-3 prose outside code passes, so do a lone backtick and an empty file` | agent body `openspec validate <id> --strict is old` (no backticks) and ``a lone ` then openspec validate <id> --strict``; an empty `plugins/demo/schemas/x/templates/empty.md` | code 0 |
| T-8 | `AC-3 files of other kinds pass: docs, the READMEs, a change folder and a fixtures path` | the bare span in `docs/roles.md`, `README.md`, `plugins/demo/README.md`, `openspec/changes/x/tasks.md`, `openspec/changes/archive/2026-01-01-x/proposal.md`, `plugins/demo/skills/s/scripts/fixtures/schemas-0.13.0/devkit/templates/proposal.md` | code 0 |
| T-9 | `AC-3 the repository's own files pass the check` | `python3 scripts/check.py` on `REPO` itself | `refused(out)` is `[]` (the other checks are not asserted here: they read git state of the checkout) |
| T-10 | `AC-1 each file in scope names the typed command on its line and keeps no fallback` | the seven source files of D-1, read from `REPO`; the expected texts are constants of the test built from `TYPED` and `TYPED_NI` (with `<change-id>` in place of `<id>` where D-1 has it) | each row of D-1 whose "After" is a whole line is a line of its file; `change-planner.md` has a line holding each of its two "After" fragments; `devkit/schema.yaml` holds the typed `Gate:` line 4 times and `devkit-lite/schema.yaml` 3 times; none of the seven holds `lacks those flags`, `when the CLI supports them`, `` `openspec validate <id> --strict` ``, `` `openspec validate <change-id> --strict` `` or `` `openspec validate <change-id>` `` |
| T-11 | `AC-2 a change and a spec with one id: the bare form is ambiguous, the typed forms validate the change` | a `tmpFolder('devkit-validate-same-')` project: `openspec/config.yaml` `schema: spec-driven`, change `same` (`.openspec.yaml` `schema: spec-driven`, a `proposal.md` with `## Why` and `## What Changes`, one ADDED delta `specs/cap/spec.md` with a WHEN/THEN scenario), spec `openspec/specs/same/spec.md` (Purpose of 50+ characters, one requirement with a scenario); `spawnSync('openspec', ...)` with `env: process.env`, as `change-loop-declared.test.mjs:1101` does | `validate same --strict --json`: status 1 and `JSON.parse(stdout).status[0].code === 'ambiguous_item'`; `TYPED` and `TYPED_NI` with `<id>` replaced by `same`, split on spaces: status 0 and stdout includes `Change 'same' is valid` |

T-9 proves AC-3's "on the files of this change it passes" inside the suite. The gate's
`python3 scripts/check.py` proves it again on the whole checkout.

The tests land in two steps, so that each phase's gate is green at its end. T-10 and T-11 come with phase 1
(task 2.1). On the base T-10 fails, because the files hold the bare form. T-11 passes on the base: its
commands are constants, and it proves the CLI behaviour the new texts rely on. T-1 to T-9 come with phase 2
(task 3.1), where D-1 is already done. T-1 to T-4 fail until D-3 exists. T-5 to T-9 are the negatives and
pass before and after it. The red proof of the check on the base's texts is task 4.1: the branch's
`check.py` is run on a scratch worktree of the plan base.

**Existing tests.** These were searched in every suite file (`git ls-files '*.test.mjs'`), for the bare text, the fallback
sentences, `Gate:`, `Next step:`, `CLI validation`, `count its errors` and `--no-interactive`:

| Test | What it pins | Effect of this change |
| --- | --- | --- |
| `change-loop.test.mjs:3285` | `docs/openspec-flow.md` no longer holds ``before the evidence, run `openspec validate <id> --strict`;`` | none: that document is not edited |
| `change-loop.test.mjs:3109`, `:3196`, `change-loop-declared.test.mjs:1213` | the loop's `--type change` texts | none |
| `flow-check.test.mjs:188` | the `openspec/schemas/` copies equal the plugin's byte for byte | holds after D-2 step 1 |
| `flow-check.test.mjs:218-245` | the first line of each schema instruction names its role | none: only `Gate:` lines change |
| `gen-agents.test.mjs` | the generated agents equal their rendering | holds after D-2 step 2 |
| `adoption.test.mjs:97-105` | `.compozy/kit-manifest.json` lists every kit file with a digest | holds after D-2 step 3 (same file list, new digests) |
| `review-round.test.mjs:1041-1130`, `:1304` | other sentences of `review-change/SKILL.md` | none: line 40 is not asserted |
| `release-note.test.mjs:903-960`, `change-loop-compozy.test.mjs:667` | other sentences of `change-planner.md` | none |
| `guard.test.mjs:664-711` | the install-scope and changelog checks of `check.py` on scratch roots | none: the new check finds no command in their files |

No existing test is edited.

## D-5 `scripts/test-map.json`

This is in the same commit as the new test file (task 2.1). `mapProblems` M6 refuses a test that no key links. The
edits keep the file's sorted key order and two-space format:

- add `plugins/openspec/hooks/validate-type.test.mjs` to the lists of `scripts/check.py`,
  `plugins/core/agents/change-planner.md`, `plugins/core/skills/review-change/SKILL.md`,
  `plugins/openspec/schemas/devkit/schema.yaml` and `plugins/openspec/schemas/devkit-lite/schema.yaml`;
- add the keys `plugins/core/agents/plan-readiness-reviewer.md`, `plugins/openspec/agents/openspec-validator.md`
  and `plugins/core/skills/plan-readiness-review/SKILL.md`, each `["plugins/openspec/hooks/validate-type.test.mjs"]`.
  Today no key covers them, so an edit of any of them makes `--own-files` run the whole suite (S7).

No document key changes, and no hub list changes. The invariants of `test-suite.test.mjs:1023` and `:1082`
(no map problem, no slow test on a document key, the hub lists) hold. The generated and copied files select
what they select today: `plugins/compozy/kit/templates/` by its folder key, `openspec/schemas/` and `.compozy/agents/` nothing
(S5 and S6), and `.compozy/kit-manifest.json` by its key.

## D-6 Release note

`release.md`: `devkit-core: patch`, `devkit-openspec: patch` and `devkit-compozy: patch`, no `marketplace:`
line (the largest pack bump), and no `release:` line (`devkit.release_tag` names
`plugins/openspec/.claude-plugin/plugin.json`, a pack manifest). No task bumps a version or edits
`CHANGELOG.md`, and no ADR is written (ADR 0034).

## Alternatives considered

- **A Node test over the real files instead of a `check.py` rule.** Rejected. AC-3 asks for a repository check
  that runs locally and in CI. `check.py` is the home of text rules, and it runs whole in every gate and in CI,
  where `--own-files` might not select a test (ADR 0036 decision 4).
- **A per-line rule.** Rejected: `plan-readiness-review/SKILL.md:50` holds a typed span and a bare span on
  one line, and a per-line rule passes it.
- **Refusing every `openspec validate` with no `--type`.** Rejected. It refuses `--all` and the prose names that
  requirements.md keeps out of scope.
- **Keeping the skills' fallback for an older CLI.** Rejected: devkit supports 2.x only
  (`docs/openspec-flow.md:131`), and the fallback is the bare form.
- **Editing the CompozyOS copies by hand.** Rejected: `gen-agents.mjs --check` fails on a hand edit, and
  `docs/compozy-kit.md:37-40` names the source.

Rollback: revert the branch's commits. No state, schema version or setting outlives them.

## Implementation plan

Order: phase 1 writes T-10 and T-11 (T-10 red), then the texts and their copies. Phase 2 writes T-1 to T-9
(T-1 to T-4 red), then the check and its sentence. Validation comes last.

- devkit-core and devkit-openspec: D-1 and D-2 step 1. devkit-compozy: D-2 steps 2 and 3. Repository: D-3,
  D-4, D-5, the `CONTRIBUTING.md` sentence.
- Files to create: `plugins/openspec/hooks/validate-type.test.mjs`. Files to modify: the seven source files of
  D-1, their copies (D-2), `.compozy/kit-manifest.json`, `scripts/check.py`, `scripts/test-map.json`,
  `CONTRIBUTING.md`. Files to delete: none.
- Estimate: optimistic 3 h, likely 4.5 h, pessimistic 7 h. The pessimistic case is a long `--own-files` selection run twice
  plus an install-kit surprise.

| Deliverable | Hours | Type | Risk |
| --- | --- | --- | --- |
| Test file T-1 to T-11 and the map edits (D-4, D-5) | 1.5 | Testing | MEDIUM: fixture lines must match the numbers asserted |
| The texts (D-1) | 0.5 | Core | LOW |
| The copies (D-2) | 0.5 | Integration | MEDIUM: install-kit touching another file |
| `check_validate_type` and the docstring (D-3) | 1 | Core | LOW |
| `CONTRIBUTING.md` sentence | 0.25 | Documentation | LOW |
| Gates, the red proof on the base, validation | 0.75 | Testing | LOW |

Risks:

- install-kit reports a file other than the three agents (probability LOW, impact MEDIUM). Mitigation: D-2 step 3
  stops and reports, and task 2.4's check lists the exact `git status` paths.
- The CLI on `PATH` is not 2.x on the machine running T-11 (LOW × MEDIUM). Mitigation: T-11 asserts on the JSON
  `code`, not on a message. CI installs 2.0.0. The owner's rule keeps the global CLI on the pinned version.
- A future text holds a command inside a four-backtick fence, or splits a command over two lines (LOW × LOW).
  Mitigation: the fence rule and the one-line span are stated in D-3, and the gap is named in the
  check's comment. No such text exists today (the prototype run).
- The `--own-files` selection is large, because `change-planner.md`, the schemas and `scripts/check.py` link slow files
  (MEDIUM × LOW). Mitigation: run it as a background command of the tool with no other suite running.
  Check the disk first.

Assumptions:

- The OpenSpec 2.0.0 behaviour measured above (plan-time scratch run; ADR 0033 context, line 26).
- `install-kit.mjs .` on this repository rewrites only the files whose rendering changed
  (`plugins/compozy/kit/scripts/install-kit.mjs:6-13`, the header comment).
- No sibling change in flight edits the seven source files. The plan base holds no other open change but
  `test-map-hub-links`, whose map edits are already on the base (`ad182dd2`).

Dependencies: `post-merge-validate` (archived) for `merge-check`'s typed call; ADR 0036 for the map and the
selective gate; ADR 0034 for the release note.
