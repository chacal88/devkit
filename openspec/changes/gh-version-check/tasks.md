<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `gh-version-check` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. The short script has no `design.md`: the how is
fixed in "The how" below (H-1 to H-7). The implementer copies the names, texts and rules from there
and makes no design choice; a choice the section does not settle stops the phase and goes to the
owner.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every hook gate runs with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does: a new test that
passes only without them is not done. Every new test takes its env from its file's existing helpers
(`cleanEnv`, `SET`, `SHIP_ENV`, `gh.env`), which blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`. The tests need the
`openspec` CLI 2.x on `PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
13 to 21 minutes) runs once, in task 5.3, as a background command of the tool, never with a shell
`&`; the phase gates of phases 3 and 4 also take several minutes and run the same way.

Test first. The first task of phases 2, 3 and 4 writes that phase's tests, runs them on the code as
it is and saves the output, as printed, to `openspec/changes/gh-version-check/proof/red-<phase>.txt`.
That run is the task's check, never a gate. Every new test's name starts `gh-version <n>: ` (H-7).
A new test that needs a function this change adds reaches it through a namespace import
(`import * as M from './merge-setup.mjs'`) or a dynamic `import()` inside the test, so the red run
fails test by test instead of failing the file at load.

Existing tests change only where H-7 names them, each time with its invariant, the layer that owns it
and its suite (CLAUDE.md); name them in the commit message. Leave no backup or scratch file in the
tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `old-gh-named` | 2.1, 2.2, 2.3, 2.5, 5.3 |
| AC-2 | `change-loop-own-reason` | 3.1, 3.3, 3.6, 5.3 |
| AC-3 | `project-loop-own-reason` | 3.1, 3.4, 3.6, 5.3 |
| AC-4 | `stage-readout` | 3.1, 3.2, 3.6, 5.3 |
| AC-5 | `unknown-version` | 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.6, 5.3 |
| AC-6 | `other-failures-unchanged` | 2.1, 2.3, 2.5, 3.1, 3.4, 3.6, 5.3 |
| AC-7 | `setup-warns` | 4.1, 4.2, 4.3, 4.4, 5.3 |

## The how

**H-1 The minimum, the parser and the version read** (`plugins/openspec/hooks/merge-setup.mjs`,
the one `gh` runner of the scripts; the requirements' ambiguity resolved as (a), no new module).
Add, next to `makeGh` and `ghError`, and say so in the file's header comment:

- `export const GH_MIN_VERSION = '2.50.0';` with the comment: the first `gh` with
  `gh pr checks --json` (cli/cli v2.50.0), confirmed in task 1.1.
- `export function parseGhVersion(text)`: `'<major>.<minor>.<patch>'` or `null`. It reads only the
  first line: `String(text ?? '')` up to the first `\n` (the whole text when there is none), one
  trailing `\r` dropped, then trimmed, matched against `/^gh version (\d+)\.(\d+)\.(\d+)(?!\d)/`;
  it returns the three matched numbers joined by dots. Unterminated or odd input: an empty text,
  `undefined` and `null` give `null`; a text with no newline is its own first line; a version only
  on a later line gives `null`; `gh version DEV` and `gh version 2.46` give `null`;
  `gh version 2.50.0-rc.1 (x)` gives `2.50.0`.
- `export function versionOlder(a, b)`: true when `a` is older than `b`, comparing major, minor and
  patch as numbers (`2.105.0` is not older than `2.50.0`, `2.9.9` is).
- `export function ghVersion(gh)`: runs `gh(['--version'])` once and returns
  `{ installed, missing, why }`: `{ installed: '<x.y.z>', missing: false, why: null }` when the first
  line parses; `{ installed: null, missing: true, why: ghError(r) }` when `gh` is missing;
  `{ installed: null, missing: false, why: ghError(r) }` for a non-zero exit, a timeout or an
  overflow; `{ installed: null, missing: false, why: 'gh --version printed <first line, or "nothing">' }`
  when the output does not parse.

**H-2 The checks item** (`plugins/openspec/hooks/deliver-check.mjs`). Import `ghVersion` and
`GH_MIN_VERSION` from `./merge-setup.mjs`. Add `const OLD_GH = /unknown flag: --(json|required)\b/;`
with a comment saying `gh` names the first option it does not know and the call passes `--required`
before `--json`. In `readChecks`, after the JSON parse fails and before the two "no checks reported"
tests, return `{ tooOld: { installed: v.installed, minimum: GH_MIN_VERSION } }` (with
`v = ghVersion(gh)`) when `r.status !== 0 && !r.missing && !r.timedOut && !r.overflowed &&
OLD_GH.test(r.stderr)`; update the comment above `readChecks` with the new answer shape. In
`checksItem`, right after the `got.error` line, `got.tooOld` returns
`item(6, name, 'blocked', <reason>, { ...details, ghTooOld: got.tooOld })` with the reason
`cannot read the checks: gh pr checks --json needs gh <minimum> or newer and the installed gh is <installed>; update gh`,
`<installed>` being `of an unknown version` when it is `null`. A first call answered `tooOld`
makes no second call (neither `none` nor an empty list). No other line of `readChecks` or
`checksItem` changes; `ghError` and every other reason keep their text.

**H-3 The stage readout** (`plugins/openspec/hooks/flow-check.mjs`). In `readDelivery`, a blocked
checks item whose `details.ghTooOld` is set ends `end('blocked', 'gh-too-old', { installed, minimum })`
(both copied from `details.ghTooOld`); any other blocked checks item ends `checks-unreadable` as
today. Add the code `gh-too-old` to both languages of `TEXT`, after `checks-unreadable`:

```
en:    'gh-too-old': (p) => `the installed gh (${p.installed ?? 'unknown version'}) cannot read the checks; ${p.minimum} is the first version that can, so update gh`,
pt-BR: 'gh-too-old': (p) => `o gh instalado (${p.installed ?? 'versão desconhecida'}) não consegue ler os checks; ${p.minimum} é a primeira versão que consegue, então atualize o gh`,
```

**H-4 The change loop** (`plugins/openspec/hooks/change-loop.mjs`). `BLOCKED_OF` gains
`'gh-too-old': 'gh-too-old'`. In `blockedEnd`, when `why` is `gh-too-old`, the params also carry
`installed` (`e.params.installed`, else `render(lang, 'gh-version-unknown')`), `minimum`
(`e.params.minimum`) and `verb: 'change'`. `MESSAGES` gains two keys in each language, after
`blocked-why.github-unreadable` and after `blocked-why.cannot-open` respectively:

```
en:    'blocked-why.gh-too-old': 'the installed gh ({installed}) cannot read the pull request checks, which need version {minimum} or newer: update gh, then call /devkit {verb} {id} again',
en:    'gh-version-unknown': 'unknown version',
pt-BR: 'blocked-why.gh-too-old': 'o gh instalado ({installed}) não consegue ler os checks do pull request, que exigem a versão {minimum} ou mais nova: atualize o gh e chame /devkit {verb} {id} de novo',
pt-BR: 'gh-version-unknown': 'versão desconhecida',
```

`waitLoop` does not change: only `github-unreadable` is retried, so a `gh-too-old` poll ends the
wait at once. `roadmap-loop.mjs` does not change: it renders `blocked-why.<why>` with the action's
params, which now hold `installed`, `minimum` and `verb`.

**H-5 The project loop** (`plugins/openspec/hooks/project-loop.mjs`). In `archivedPart`, a blocked
checks item whose `details.ghTooOld` is set ends `blocked('gh-too-old', { installed, minimum, verb: 'project' }, 'delivery')`
(`installed` falling back to `render(lang, 'gh-version-unknown')`); any other blocked checks item
ends `github-unreadable` as today. Its `BLOCKED_OF` gains `'gh-too-old': 'gh-too-old'` and its
`blockedEnd` passes the same three params when `why` is `gh-too-old`, so the stage checker's end
reads the same in the slice's active part.

**H-6 The setup check.** New `plugins/openspec/skills/openspec-setup/scripts/gh-version.mjs`, run
as `node gh-version.mjs` with no argument (an argument prints `usage: gh-version.mjs` on standard
error and exits 2). It imports `makeGh`, `ghVersion`, `versionOlder` and `GH_MIN_VERSION` from
`../../../hooks/merge-setup.mjs`, exports `ghVersionLine(v)`, prints one line on standard output and
exits 0 in every other case; the main block runs only when the file is executed (the
`ship-entry.mjs` form). The four lines, with `2.50.0` taken from `GH_MIN_VERSION`:

- `gh: ok <installed>` when `installed` is not older than the minimum;
- `gh: warning: the installed gh is <installed>, older than 2.50.0; the pr and merge ship modes read pull request checks with gh pr checks --json, which needs 2.50.0 or newer: update gh`;
- `gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer`;
- `gh: warning: the gh version cannot be read (<why>); the pr and merge ship modes need gh 2.50.0 or newer`.

`plugins/openspec/skills/openspec-setup/SKILL.md`: the list under "Paths below are relative to this
skill's directory" gains, after the `project-settings.mjs` line,
"- `scripts/gh-version.mjs` checks the installed `gh` against the version the `pr` and `merge` ship
modes need (step 1)." Step 1 gains a last bullet: "- Whatever the OpenSpec check found, run
`node <skill-dir>/scripts/gh-version.mjs` once and show its line. A `warning` line never stops the
setup: the `plan` ship mode needs no `gh`. Tell the user that the `pr` and `merge` ship modes read a
pull request's checks with `gh` 2.50.0 or newer, and to install or update `gh` before choosing
them." The script must also run when another bullet of step 1 stops the setup, so the first
sentence of step 1 ends "Run that one with `--version`, and check `gh` (last bullet)."

`docs/openspec-flow.md`, the delivery contract table, row 6, `blocked` column: "`gh` error; an
unknown check state; a `gh` older than 2.50.0, which has no `gh pr checks --json` (the reason names
the installed version)".

**H-7 The tests.** New tests, by file, in order:

- `plugins/openspec/hooks/merge-setup.test.mjs`: 1 `parseGhVersion` reads the first line
  (`gh version 2.46.0 (2024-03-18)\nhttps://github.com/cli/cli/releases/tag/v2.46.0\n` gives
  `2.46.0`; `gh version 2.105.0 (2026-11-17)` with no newline gives `2.105.0`; a `\r\n` ending; the
  `-rc.1` case); 2 the `null` cases of H-1; 3 `versionOlder` (`2.46.0`/`2.50.0` true, `2.50.0`/`2.50.0`
  false, `2.105.0`/`2.50.0` false, `2.9.9`/`2.50.0` true, `3.0.0`/`2.50.0` false) and
  `GH_MIN_VERSION === '2.50.0'`; 4 `ghVersion` over a stub function (parsed, missing, exit 1,
  timed out, unparseable), each calling `gh` once with `['--version']`.
- `plugins/openspec/hooks/deliver-check.test.mjs`, section "item 6": 5 (AC-1) `pr-checks` exits 1
  with `unknown flag: --json\n\nUsage:  gh pr checks [<number> | <url> | <branch>] [flags]\n`,
  `version` answers `gh version 2.46.0 (2024-03-18)\n`: the item is blocked, its reason holds
  `2.46.0`, `2.50.0` and `update gh`, `details.ghTooOld` is `{ installed: '2.46.0', minimum: '2.50.0' }`,
  and the calls hold one `--version` and one `pr checks`; 6 the same with `unknown flag: --required`;
  7 (AC-5) `version` exits 1, answers `gh version DEV\n`, answers nothing: `installed` is `null`
  and the reason holds `of an unknown version` and `2.50.0`; 8 (AC-6) HTTP 502, an authentication
  error (`HTTP 401: Bad credentials (https://api.github.com/graphql)\nTry authenticating with:  gh auth login\n`),
  `not json` with exit 0, and through a stub function a missing `gh` and a timeout: each reason
  equals today's text exactly (`cannot read the checks: ` and `ghError`'s line, or
  `gh pr checks returned unreadable output`), no `ghTooOld`, no `--version` call; 9 (AC-6) a green
  list, a pending list with exit 8 and the "no required checks reported" fallback make no
  `--version` call.
- `plugins/openspec/hooks/flow-check.test.mjs`, beside `DELIVERY_ROWS`, through `deliveryReport`:
  10 (AC-4) the old `gh` of test 5 ends `{ end: 'blocked', reasonCode: 'gh-too-old' }` with params
  `{ installed: '2.46.0', minimum: '2.50.0' }`; `renderText` in `en` and `pt-BR` holds both
  versions and holds neither `the checks cannot be read` nor the Portuguese `checks-unreadable`
  sentence; 11 (AC-5) `version` exits 1: `installed` is `null` and the readout says `unknown version`
  and its Portuguese form.
- `plugins/openspec/hooks/change-loop.test.mjs`: 12 (AC-2, AC-5) `decide` over a report ending
  blocked `gh-too-old`: shape `['end', 'blocked', 'gh-too-old', 2]`; the reply in `en` and `pt-BR`
  holds `2.46.0`, `2.50.0`, `update gh` (or its Portuguese form) and `/devkit change <id>`, and does
  not match `GitHub cannot be read` nor its Portuguese form; with `installed: null` it holds
  `unknown version` and its Portuguese form; `render(lang, 'roadmap-blocked', ...)` with the
  action's params holds both versions; 13 (AC-2) `next` over `deliveredChange()` with `pr-checks`
  and `version` set as in test 5 exits 2, `end.why` is `gh-too-old` and the reply equals
  `render('en', 'blocked', { id: 'feat', why: 'gh-too-old', installed: '2.46.0', minimum: '2.50.0', verb: 'change' })`;
  14 `waitLoop` over `[WAIT, <the action of test 12>]` returns that action at poll 2.
- `plugins/openspec/hooks/project-loop.test.mjs`: 15 (AC-3) `openPr(t, { checksFail: 'unknown flag: --json\n', version: 'gh version 2.46.0 (2024-03-18)\n' })`:
  `nextP` exits 2, `end.why` is `gh-too-old`, the reply holds `2.46.0`, `2.50.0` and
  `/devkit project billing`, and no `pr merge` call was made; 16 (AC-6) `checksFail: 'HTTP 502'`
  still ends `github-unreadable`.
- `plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs` (new suite): 17
  `ghVersionLine` gives the four lines of H-6 exactly; 18 (AC-7) the script, spawned with
  `process.execPath` and `fakeGh()`'s env: `version` `2.46.0` prints the warning naming `2.46.0` and
  `2.50.0`; `2.50.0` prints `gh: ok 2.50.0`; `2.105.0` prints `gh: ok 2.105.0`; `version` exiting 1
  prints the cannot-be-read warning; a `PATH` of an empty temporary folder prints the not-installed
  warning; each exits 0; one argument exits 2; 19 (AC-7) the step 1 paragraph of `SKILL.md`
  (between `1. **Check the CLI.**` and `2. **Opt the project in.**`) names
  `scripts/gh-version.mjs` and `2.50.0` and says the setup goes on.

Existing tests changed, each additive:

- `deliver-check.test.mjs`, `FAKE_GH`: `gh --version` answers from the fixture key `version` (today
  it would look up `--version-undefined`). Invariant: every fake `gh` call answers from its key's
  fixture and fails loudly when the key is unset. Layer: the fake `gh` shared by every hook suite and
  the setup suites. Suite: `deliver-check.test.mjs`.
- `flow-check.test.mjs`, the parameter table of the reason-text test: `'gh-too-old': { installed: '2.46.0', minimum: '2.50.0' }`.
  Invariant: every reason code renders in both languages. Layer: the stage readout. Suite:
  `flow-check.test.mjs`.
- `change-loop.test.mjs`, `SAMPLE`: `installed: '2.46.0', minimum: '2.50.0'`. Invariant: every
  message renders in both languages with no internal term. Layer: the change loop's message table.
  Suite: `change-loop.test.mjs`.
- `roadmap-loop.test.mjs`, `BLOCKED_PARAMS`: `installed: '2.46.0', minimum: '2.50.0', verb: 'change'`.
  Invariant: a blocked line renders every blocked reason in both languages. Layer: the roadmap
  loop's replies. Suite: `roadmap-loop.test.mjs`.
- `project-loop.test.mjs`, `scriptedGh`: `s.checksFail` (a `pr checks` call fails with that stderr)
  and `s.version` (`--version` answers that text). Invariant: a call the script does not know
  fails. Layer: the project loop's scripted `gh`. Suite: `project-loop.test.mjs`.
- `guard.test.mjs`: one import line for `../skills/openspec-setup/scripts/gh-version.test.mjs`, after
  the `ship-entry.test.mjs` line. Invariant: one command runs every hook and setup suite. Suite:
  `guard.test.mjs`.
- `change-loop.test.mjs`, the docs test ("the design records the answers"): the pin assertion
  becomes `/v0\.24\.0/` with the message `(gh-version-check: 0.25.0)`, plus a `doesNotMatch` for
  `/v0\.21\.1/` (task 5.1). Invariant: the CI snippet pins the current release.

## 1. The minimum version (owner-run)

Owner-run phase: done by the session that conducts this change, never `tdd-implementer`, which has
no web tool. The implementer changes no file here and returns
`Outcome: success — owner-run phase, left to the conducting session`; the session does task 1.1
itself, then runs the loop's `next`, which hands it the gate.

- [x] 1.1 Owner-run task, done by the session that conducts this change (never `tdd-implementer`):
  read https://github.com/cli/cli/releases/tag/v2.50.0 and confirm that `gh pr checks` gained
  `--json` (with the `bucket` field) in that release and that `--required` is older. Write the URL,
  the release-note line and the reading date to
  `openspec/changes/gh-version-check/proof/gh-min-version.txt`, whose first line is
  `minimum: v2.50.0`. If the release differs, write nothing, stop and tell the owner: the constant,
  every text of H-1 to H-6 and the acceptance criteria change with it. Check: the file exists and
  its first line reads `minimum: v2.50.0`.
- [x] 1.2 Gate: `grep -qx "minimum: v2.50.0" openspec/changes/gh-version-check/proof/gh-min-version.txt` green.

## 2. The version facts and the checks item (AC-1, AC-5, AC-6)

- [x] 2.1 Write tests `gh-version 1` to `gh-version 9` (H-7) in
  `plugins/openspec/hooks/merge-setup.test.mjs` and `plugins/openspec/hooks/deliver-check.test.mjs`,
  and the additive `FAKE_GH` change of H-7. Run
  `node --test --test-name-pattern="^gh-version " plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs`
  on the unchanged code and save its output to `openspec/changes/gh-version-check/proof/red-2.txt`.
  Check: the file names all nine tests; 1 to 7 fail; 8 and 9 pass (they pin behaviour that must not
  change).
- [x] 2.2 Add `GH_MIN_VERSION`, `parseGhVersion`, `versionOlder` and `ghVersion` to
  `plugins/openspec/hooks/merge-setup.mjs` and its header comment, as H-1 says. Check: tests 1 to 4
  pass.
- [x] 2.3 Make `readChecks` and `checksItem` in `plugins/openspec/hooks/deliver-check.mjs` tell the
  old `gh` apart, as H-2 says. Check: tests 5 to 9 pass, and every existing "item 6" test passes
  unchanged.
- [x] 2.4 Write the row 6 sentence of H-6 into the delivery contract table of `docs/openspec-flow.md`.
  Check: `python3 scripts/check.py` passes and `grep -c "older than 2.50.0" docs/openspec-flow.md`
  prints 1.
- [x] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-5 and AC-6 at the checker.

## 3. The stage readout and the loops (AC-2, AC-3, AC-4, AC-5, AC-6)

- [x] 3.1 Write tests `gh-version 10` to `gh-version 16` (H-7) in
  `plugins/openspec/hooks/flow-check.test.mjs`, `change-loop.test.mjs` and `project-loop.test.mjs`,
  and the additive changes of H-7 to the reason-text table, `SAMPLE`, `BLOCKED_PARAMS` and
  `scriptedGh`. Run
  `node --test --test-name-pattern="^gh-version 1[0-6]: " plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs`
  on the code of phase 2 and save its output to `openspec/changes/gh-version-check/proof/red-3.txt`.
  Check: the file names all seven tests; 10 to 13 and 15 fail; 14 and 16 pass (they pin behaviour
  that must not change).
- [x] 3.2 Add the `gh-too-old` end and its two sentences to `plugins/openspec/hooks/flow-check.mjs`,
  as H-3 says. Check: tests 10 and 11 pass, and the reason-text test passes with the new row.
- [x] 3.3 Add the reason, its params and the two message keys to
  `plugins/openspec/hooks/change-loop.mjs`, as H-4 says. Check: tests 12 to 14 pass, and the test
  "change-loop replies: no internal term in either language" passes.
- [x] 3.4 Add the reason to `plugins/openspec/hooks/project-loop.mjs`, as H-5 says. Check: tests 15
  and 16 pass, and "project-loop next: S25 a merged pull request ends delivered and S26 a closed one
  ends blocked" passes unchanged.
- [x] 3.5 Check the roadmap loop renders the new reason with no code change. Check:
  "roadmap-loop replies: a blocked line renders every blocked reason in both languages" passes with
  the new `BLOCKED_PARAMS`, and `git diff --stat -- plugins/openspec/hooks/roadmap-loop.mjs` prints
  nothing.
- [x] 3.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green (a background command); covers AC-2, AC-3, AC-4, AC-5 and AC-6 in the loops.

## 4. The setup check (AC-7)

- [x] 4.1 Write the new suite `plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs`
  with tests `gh-version 17` to `gh-version 19` (H-7), importing `fakeGh` from
  `../../../hooks/deliver-check.test.mjs` as `github-setup.test.mjs` does, and add its import line to
  `plugins/openspec/hooks/guard.test.mjs` (H-7). Run
  `node --test --test-name-pattern="^gh-version 1[7-9]: " plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs`
  on the code of phase 3 and save its output to `openspec/changes/gh-version-check/proof/red-4.txt`.
  Check: the file names the three tests and all three fail.
- [x] 4.2 Write `plugins/openspec/skills/openspec-setup/scripts/gh-version.mjs`, as H-6 says.
  Check: tests 17 and 18 pass.
- [x] 4.3 Add the script line and the step 1 text of H-6 to
  `plugins/openspec/skills/openspec-setup/SKILL.md`. Check: test 19 passes and
  `python3 scripts/check.py` passes.
- [x] 4.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs && python3 scripts/check.py` green (a background command: the suite loads the deliver-check suite); covers AC-7.

## 5. Release and the whole suite (AC-1 to AC-7)

- [x] 5.1 Release. Take the next versions after `origin/main`'s (`CONTRIBUTING.md`, step 5); on
  today's `main` they are devkit-openspec 0.25.0 and marketplace 0.29.0, and the rest of this task
  names them. Bump devkit-openspec in `plugins/openspec/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`, and the marketplace version. Add the `CHANGELOG.md` section
  `## 0.29.0 — gh version check`: devkit-openspec 0.25.0, `deliver-check` and the loops name a `gh`
  older than 2.50.0 with its own blocked reason, `openspec-setup` step 1 checks `gh` once, the CI
  snippet now pins `v0.25.0`. Turn every `v0.21.1` of `docs/openspec-flow.md` (three lines) into
  `v0.25.0`, and change the pin assertion of the change-loop docs test as H-7 says. Check:
  `python3 scripts/gen-catalog.py --check` passes; `grep -c "v0.21.1" docs/openspec-flow.md` prints
  0; and the change-loop docs test and the two `deliver-check.test.mjs` pin tests ("the pin in
  docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, …" and "AC-8
  release-ready: …") pass.
- [x] 5.2 Check that nothing outside the plan changed. Check:
  `git diff --stat $(git merge-base origin/main HEAD) -- plugins/openspec/hooks/guard.mjs plugins/openspec/hooks/conduct-check.mjs plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs plugins/openspec/schemas openspec/schemas plugins/panel`
  prints nothing.
- [x] 5.3 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green (the guard suite as a background command); covers AC-1 to AC-7 and every other suite at once.

## Workflow follow-up

- After the merge, tag `v0.25.0` (or the version task 5.1 took) on the merge commit and push the
  tag (`CONTRIBUTING.md`, step 5).
- Archive with the retro; the archive ticks the `gh-version-check` line of round 27 in
  `openspec/roadmap.md`.
