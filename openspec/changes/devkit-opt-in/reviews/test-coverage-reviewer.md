Verdict: approved
Commit: 69c42d96c05415a9a1c766834b0a75347adb8db4

## Coverage analysis — devkit-opt-in (origin/main..HEAD)

In-scope surfaces: plugins/openspec/hooks (guard.mjs), openspec-setup scripts (project-settings.mjs, install-schemas.sh), scripts/check.py, docs/format tests
Blocking gaps (8-10 without a plan): 0
Seams checked (read only, no mutation runs; gate result 421/421 supplied by caller):
- guardBash reordering, findRoot then optedIn then gitViolation (guard.mjs:338-341) -> caught by 'not opted in' tests (guard.test.mjs ~L62-75, silent() asserts exit 0 and empty stdout/stderr for force push, reset --hard, gh pr merge/create); moving gitViolation back before the check turns them red.
- guardEdit and session gates (guard.mjs:324, :406) -> caught by the same hookCases (edit src/a.ts, session) and the spec-driven AC-2 test (gate-file writes exit 0, no [devkit] line).
- optedIn reads config.yaml, not the change schema -> caught by the table test ('a change schema does not opt in', comment-only, devkit-lite-custom, quoted/single-quoted, missing file).
- Opted-in side unchanged -> caught by the quoted devkit-lite test (force push exit 2, PR gate exit 2), subdirectory cwd, no-active-change repo.
- Nested worktree with its own config (findRoot picks the nearest root) -> caught by the nested checkout test, with the outer repo still gated.
- install-schemas.sh default scope (project, --user, refusals exit 1/2, "." form for CI, replace on rerun) -> caught by install-schemas.test.mjs:37-88 using a PATH without openspec and temp HOME/XDG.
- project-settings.mjs merge (key and order kept, false to true, foreign marketplace kept, unchanged mtime, dry-run, bad JSON/array byte-identical, HOME refused, settings.local never touched, PACKS vs marketplace.json) -> caught by project-settings.test.mjs:39-175.
- check.py install-scope lint -> caught by the four 'install-scope lint' tests (guard.test.mjs, run via check.py --root on fixtures), plus the migration-doc and real-repo runs in the gate.
- Repo's own .claude/settings.json (AC-6) -> caught by the guard.test.mjs test that parses it and runs a --dry-run expecting unchanged.

### Findings
- [nit] [3] Opted-in config with no openspec/changes/ directory: findRoot (guard.mjs:64-72) requires openspec/changes, so a project whose config.yaml says schema: devkit but has no changes/ dir gets no destructive-git guard. The project() helper always creates changes/archive, so this is untested and undocumented. Before the change, git was refused everywhere; now this case is silent. Likely fine because openspec init creates changes/. Pin the intent with one case in guard.test.mjs next to the opt-in tests.
- [nit] [3] project-settings.mjs:60 real() resolves symlinks for the HOME refusal, but the test (project-settings.test.mjs:129) only passes HOME literally. On macOS, where /tmp and /var are symlinks, a symlinked HOME is the realistic case. Add a case that passes a symlink to HOME as the root.
- [nit] [2] install-schemas.sh with a nonexistent <path> fails through cd under set -e (exit 1, bash's message). No test pins it. Low value.
- [nit] dead code: scripts/check.py ends with a second print and sys.exit after main(), which already exits. No test can see it. Remove it.

### Well covered
- AC-1 and AC-2: every mode times every destructive command, silent() asserts exit code, stdout and stderr, so it is not a mock-only test.
- AC-3 gating inside opted-in projects, including a change on a foreign schema, a subdirectory cwd and a repo with no active change.
- AC-5 scripts: tests spawn the real scripts with isolated HOME and XDG_DATA_HOME, so they do not test a mock.
- AC-8 and AC-4/7 docs: format tests with bash -n and jq fixtures, and the lint run on the real repo.
