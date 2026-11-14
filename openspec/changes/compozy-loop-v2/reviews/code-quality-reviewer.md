Verdict: rejected
Commit: e10b21d46af3cc79a5977063f55fa74776073875

## Quality review — compozy-loop-v2 (round 1)

### Findings

- [important] `openspec/changes/compozy-loop-v2/design.md:256-258` and
  `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:265` — design.md's
  own Risk bullet claims "The template test pins the guards; a missed guard shows up in
  `compozy loop validate`." That claim is false for the test half: I grepped
  `plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs` for `worktree_path`,
  `guard` and `if .nodes` and the only hit is the unrelated `cleanup.params.path` assertion
  (line 240) — nothing in the suite asserts that `.nodes.design.output.*` or
  `.nodes.demo.output.*` references are guarded. The `compozy loop validate` half of the claim is
  also weaker than stated: I ran it for real (`compozy` 0.6.2 is on PATH here) —
  `compozy loop validate --file plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml -o json`
  → `{"resolution_source":"session_identity","valid":true}` — but `loop validate` only checks the
  definition without executing it, so it cannot simulate a skipped node's output and catch a
  `nil`-field panic at render time. The file is also internally inconsistent about how to guard a
  skipped node's output: `implement`'s prompt conditions directly on the nested field,
  `{{ if .nodes.design.output.worktree_path }}` (loop.yaml:265), while `implement`'s `review` block
  and `deliver`'s prompt guard the parent first, `{{ if .nodes.design.output }}` /
  `{{ if .nodes.demo.output }}`, and only dot deeper *inside* that block (loop.yaml:310-312, 443).
  If a skipped node's `.output` is represented as `nil`/absent (as the same Risk bullet says —
  "a skipped node settles with a skip marker rather than a filled schema") and the templating
  engine is Go-template-like, `.output.worktree_path` directly inside the `if` condition is the
  classic "nil pointer evaluating interface {}.worktree_path" panic. This is exactly the path this
  repository's own adopted loop exercises on every run (it declares no screens, so `design` is
  always skipped) and exactly the behaviour AC-3 claims ("implement still runs"). No test, and no
  demonstration with real output (an actual `compozy loop run` with a skipped design branch — not
  just `loop validate`), proves `implement`'s prompt renders without crashing in this case. · fix:
  either add an assertion to `loop-template.test.mjs` that every `.nodes.design.output.<field>` /
  `.nodes.demo.output.<field>` reference is textually inside a block already opened by
  `{{ if .nodes.design.output }}` / `{{ if .nodes.demo.output }}` (never conditions on the nested
  field itself), make `implement`'s guard consistent with the safer pattern already used at
  loop.yaml:310, and correct design.md's claim to say what is actually checked.

### Summary
- 1 finding (0 blocking, 1 important, 0 nit) + 3 praise
  - [praise] `plugins/compozy/skills/compozy-setup/templates/bin/devkit-kit` — the resolver avoids
    the classic `find | while read` subshell-loses-state bug by feeding `find`'s output through a
    heredoc instead of a pipe, so `best_path`/`best_version` survive across iterations; the
    tie-break order (integer-field version compare, then `LC_ALL=C` lexicographic path compare) is
    exactly what `devkit-kit.test.mjs` exercises with real fixtures (older-but-higher-version,
    `0.13.0` vs `0.9.0`, and an equal-version tie), not just happy-path coverage.
  - [praise] `plugins/compozy/skills/screen-design/scripts/screens-check.mjs` — the exit-3 boundary
    (setup error) vs exit-1 boundary (real failure) is sharp and each of the four setup-error shapes
    (no `screen_map` key, a path that doesn't exist, a path that is a directory, an unreadable file)
    has its own fixture in `screens-check.test.mjs`, including a real `chmod 000` test skipped only
    for root/Windows — this is a meaningfully adversarial test, not a mock of the implementation.
  - [praise] `plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs` — a genuine
    render-then-compare (template + `substitutions.json` defaults, with this repository's two
    overridden values, byte-for-byte against the installed `.compozy/`), which I independently
    reproduced outside the test (`diff` after a manual placeholder substitution) and it matches
    exactly; this is real drift protection, not a test that only asserts its own fixture.
- Justification: reviewed the four named executable surfaces end to end (resolver script, its
  sh-quoting and tie-break logic; `screens-check.mjs`'s YAML/Markdown parsing and exit codes;
  `evidence-names.mjs`'s pure path builders; the shipped and regenerated `loop.yaml`'s graph, gates
  and shell-quoting), ran all five new test files (98/98 passing), ran `compozy loop validate`
  against the live daemon, diffed the regenerated `.compozy/loop.yaml` against the template by hand,
  and cross-checked `DEVKIT_BRANCH`/`gh pr checks --required` usages against the existing hooks they
  call into. No shell-injection, YAML-compile, or silently-passing-parse defect found in the four
  named files; found one place where a documented safety net (a guard-pinning test) does not exist
  and the only other proof offered (`loop validate`) does not cover the claimed hazard. That is an
  unconfirmed-but-plausible runtime defect on the single most common path of this very loop (a
  change with no screens), guarded by nothing but a static validator that cannot see it, and it sits
  under a demonstrably false claim in `design.md` — enough to reject pending either a stronger test
  or a corrected claim.
