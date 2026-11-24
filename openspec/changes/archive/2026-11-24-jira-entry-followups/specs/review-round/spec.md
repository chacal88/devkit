<!-- devkit-stage specs result=passed attempt=4 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Spec Delta

## ADDED Requirements

### Requirement: The round reads the uncommitted paths from git
`review-round.mjs tree` SHALL print the worktree's head sha and the uncommitted paths that count: a
tracked path outside `openspec/` with a staged or unstaged change (both paths of a rename or copy),
and an untracked path outside `openspec/` and outside `.claude/`. A path under `openspec/` SHALL
never count. The `args` of a round SHALL hold those paths as `dirty`; every command that takes
`args`, and the Workflow script, SHALL refuse `args` without a `dirty` list.

#### Scenario: Only openspec files are uncommitted
- **WHEN** `review-round.mjs tree` runs in a worktree where `openspec/changes/<id>/evidence.md` and `openspec/changes/<id>/design.md` are edited and not committed, and `openspec/changes/<id>/notes.md` is untracked
- **THEN** it prints the head sha and an empty `dirty` list

#### Scenario: Paths that count
- **WHEN** `src/a.mjs` is edited, `src/b.mjs` is staged, `src/new.mjs` is untracked, `.claude/settings.json` is tracked and edited, and `src/old.mjs` is renamed to `openspec/moved.mjs`
- **THEN** `dirty` lists `src/a.mjs`, `src/b.mjs`, `src/new.mjs`, `.claude/settings.json` and `src/old.mjs`, and no `openspec/` path

#### Scenario: An untracked path under .claude
- **WHEN** the only uncommitted path is the untracked `.claude/worktrees/x/a.txt`
- **THEN** `dirty` is empty

#### Scenario: The same rule as the delivery check
- **WHEN** `review-round.mjs tree` and `deliver-check.mjs` read the same worktree, for each tree of the scenarios above
- **THEN** the round's `dirty` list holds exactly the paths the delivery check counts as uncommitted

#### Scenario: A root that is not a git worktree with a commit
- **WHEN** `review-round.mjs tree` runs with a `root` that is a folder with no git, or a git repository with no commit yet
- **THEN** it exits 3, prints nothing on stdout, and stderr is `review input invalid: <root> is not a git worktree with a commit`

#### Scenario: A missing or malformed root
- **WHEN** `review-round.mjs tree` runs with input that has no `root`, or a `root` that is not a non-empty string
- **THEN** it exits 3 and stderr is `review input invalid: root must be a path`

#### Scenario: A relative root
- **WHEN** `review-round.mjs tree` runs with `root` `.` from inside the worktree
- **THEN** it prints the same `head` and `dirty` as with the worktree's absolute path

#### Scenario: A command without dirty
- **WHEN** `review-round.mjs stage1`, `verify`, `outcomes` or `consolidate` runs with `args` that have no `dirty`, or a `dirty` that is not a list of non-empty strings
- **THEN** it exits 3 and stderr starts with `review input invalid:`

#### Scenario: The Workflow script without dirty
- **WHEN** the Workflow script runs with `args` that have no `dirty`
- **THEN** it throws an error starting `review input invalid:` and starts no agent

### Requirement: The round marks a verdict's Commit line from git
Line 2 of every verdict file a round asks for SHALL be `Commit: <args.head>` followed by
` (uncommitted changes)` exactly when `args.dirty` is not empty. The stage-1 prompt SHALL NOT ask the
reviewer whether the tree is dirty, SHALL say that the round marks the line from git and by which
rule, and an `uncommitted` key in a stage-1 answer SHALL change nothing.

#### Scenario: A round with only openspec files uncommitted
- **WHEN** a round runs with `args.dirty` empty while `openspec/changes/<id>/evidence.md` is not committed, and its reviewers approve
- **THEN** each writer prompt's line 2 is `Commit: <args.head>` with no marker, and `deliver-check.mjs <id>` reads those verdicts as current

#### Scenario: A round with a product file uncommitted
- **WHEN** a round runs with `args.dirty` holding `src/a.mjs`
- **THEN** each writer prompt's line 2 is `Commit: <args.head> (uncommitted changes)`, `check-file` expects that line, and `deliver-check.mjs <id>` lists the written verdicts as stale, recorded with uncommitted changes

#### Scenario: A reviewer's own flag
- **WHEN** a stage-1 answer carries `uncommitted: true` and `args.dirty` is empty
- **THEN** the outcome's writer prompt has line 2 with no marker, and the answer is not refused for the key

#### Scenario: The stage-1 prompt
- **WHEN** `review-round.mjs stage1` prints the prompt of a reviewer
- **THEN** its JSON shape holds no `uncommitted` key, and it says that the round marks the `Commit:` line from git when a path outside `openspec/` is uncommitted

#### Scenario: The skill text
- **WHEN** `plugins/core/skills/review-change/SKILL.md` and the `review` row of `plugins/openspec/skills/ship-change/SKILL.md` are read
- **THEN** both say that `args.head` and `args.dirty` come from `review-round.mjs tree`, run in the change's worktree right before the round
