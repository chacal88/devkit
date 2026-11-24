<!-- devkit-stage specs result=passed attempt=2 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Spec Delta

## ADDED Requirements

### Requirement: A train's pull request is judged change by change at each one's own head
On a pull request whose head branch is `train/<n>`, the check SHALL read the train record
`openspec/trains/<n>.md` at the pull request's head and judge each boarded change by the delivery
contract it judges today (readiness, tasks and gates, reviews, findings, acceptance proof) at that
change's own head, never at the train's head.

#### Scenario: Two boarded changes, both current
- **WHEN** the record lists `alpha` and `beta`, each with approved and current reviews and current evidence at its own head
- **THEN** the check prints one result per change and passes

#### Scenario: A stale review at a boarded head
- **WHEN** `beta`'s `code-quality-reviewer` verdict was recorded before a product commit that is at `beta`'s listed head
- **THEN** the check fails naming `beta` and the stale review

### Requirement: Every boarded head is inside the train
The check SHALL fail, naming the change and the head, when a head the record lists as boarded is not an
ancestor of the pull request's head.

#### Scenario: A head pushed after the departure
- **WHEN** the record lists `alpha` at `1111111` and the train's history holds `alpha`'s earlier head `0000000` only
- **THEN** the check fails naming `alpha` and `1111111`

### Requirement: The train's own commits change only releases, the roadmap and its record
Every commit of the train not reachable from a boarded head or from the base branch SHALL change, beyond
what Git merges by itself, only release files, the CI pin, `openspec/roadmap.md` and the train's own
record; any other path SHALL fail the check, naming the commit and the path.

#### Scenario: A commit pushed onto the train
- **WHEN** a commit on `train/4` that no boarded head holds edits `plugins/x/hooks/a.mjs`
- **THEN** the check fails naming that commit and `plugins/x/hooks/a.mjs`

#### Scenario: The joins and the record
- **WHEN** the train's own commits are its join merges, whose resolutions edit only release files, and the record's commit
- **THEN** this rule passes

### Requirement: A train passes only with a green, current record
The check SHALL fail when the train record is missing or unreadable, says the suite did not pass, or
names a head after which a commit touched a path outside `openspec/`.

#### Scenario: No record
- **WHEN** the pull request from `train/4` holds no `openspec/trains/4.md`
- **THEN** the check fails saying the train record is missing and that the departure writes it

#### Scenario: A record of a red run
- **WHEN** the record of `train/4` is readable and says the suite failed
- **THEN** the check fails saying the train record did not pass

#### Scenario: A record older than the head
- **WHEN** the record says the suite passed at the train's join head and a later commit on the train edits `CHANGELOG.md`
- **THEN** the check fails saying the record is not current at the pull request's head

#### Scenario: An unclosed fence in the record
- **WHEN** the record holds a fenced block with no closing fence before its tables
- **THEN** the check fails saying the record cannot be read

### Requirement: The archives a train carries are judged as archive pull requests
For each archive the record lists as boarded, the check SHALL judge the archived folder that archive's
head brings exactly as it judges an archive pull request today: the file check against its approved
proposals and a readable retro with every proposal answered.

#### Scenario: An archive with an unanswered proposal
- **WHEN** the record lists the archive of `gamma` and its `retro.md` has a proposal with no answer
- **THEN** the check fails naming `gamma`'s archived folder and the unanswered proposal
