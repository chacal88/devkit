<!-- devkit-stage specs result=passed attempt=1 commit=4aa88a1ebea8213e62cdcfafa0b7b8257cf0867b -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A release-only conflict is resolved by a merge of the base
The release-conflict step's command SHALL merge `origin/<base>` into the branch, never rebase it,
resolve the release files by the renumbering rule and commit the merge, so that the branch's old
head and its pull request's head stay ancestors of the new head. It SHALL never push. A merge it
cannot resolve SHALL be aborted, leaving the branch at its old head, no merge in progress and the
working tree as it was.

#### Scenario: A base that released after the branch forked
- **WHEN** the base bumped a pack and added a changelog entry after the branch forked, and the branch bumped the same pack with its own entry
- **THEN** the command exits 0, the new head is a merge commit whose first parent is the old head and whose second parent is `origin/<base>`, and the working tree has nothing uncommitted

#### Scenario: The release is renumbered above the base's
- **WHEN** the merge is resolved
- **THEN** each pack the branch bumped carries the base's version plus the branch's own bump kind in its manifest and in the marketplace, the branch's changelog entry sits above the base's newest with that number, every CI pin names the resolved devkit-openspec version, and the catalog is regenerated when a manifest changed

#### Scenario: A manifest field only the branch edited
- **WHEN** the branch bumped a pack and edited its `description` in `plugin.json` and in the pack's `marketplace.json` entry, and the base edited neither description since the merge base
- **THEN** the command exits 0, both manifests carry the renumbered version and the branch's description, a field only the base edited keeps the base's value, and the catalog is regenerated from the kept description

#### Scenario: A manifest field both sides edited
- **WHEN** the branch and the base both edited the same manifest field beyond the version fields since the merge base, to different values or to the same value, or one side edited a field inside a pack entry the other side removed
- **THEN** the command exits 2 with an `error` starting `a manifest field was edited on both sides:` that names the file and the field path, the branch is at its old head, no merge is in progress and the working tree is as it was

#### Scenario: The result goes up with a plain push
- **WHEN** the pull request's head was pushed before the command ran
- **THEN** a plain `git push` of the new head to the same remote is accepted, with no force

#### Scenario: A conflict outside the release files
- **WHEN** the merge conflicts in a file that is not a release file, or in the CI-pin file beyond its pins
- **THEN** the command exits 2 naming the paths, the branch is at its old head, no merge is in progress, and the tracked and untracked files are as they were

#### Scenario: A release file the rule cannot resolve
- **WHEN** a manifest field was edited on both sides, the branch added or removed a pack entry of `marketplace.json` or added a manifest the merge base lacks, the changelog does not hold exactly one new entry, the catalog conflicts without its generator, the generator fails, or the base has no devkit-openspec version for a conflicting pin
- **THEN** the command exits 2 with the reason, the branch is at its old head and no merge is in progress

#### Scenario: Uncommitted tracked changes or a rebase in progress
- **WHEN** the command starts with a tracked file changed and not committed, or with a rebase in progress
- **THEN** it exits 3 naming the cause, and the branch, the index and the working tree are not touched

#### Scenario: A merge left in progress by an earlier run
- **WHEN** the command starts while a merge is in progress
- **THEN** it aborts that merge and runs again from the branch's head

#### Scenario: The branch already holds the base
- **WHEN** `origin/<base>` is already an ancestor of the branch's head
- **THEN** the command exits 0, says there is nothing to do and makes no commit
