<!-- devkit-stage specs result=passed attempt=1 commit=98145b018d4b38a066289b69ed972c09b2497e60 -->
# Spec Delta

## ADDED Requirements

### Requirement: The loop fetches the base branch before it judges a delivery step
When the change command's `next` decides a step of a change in its delivery part, it SHALL first
fetch the default branch from the `origin` remote into that remote's tracking ref, so that every
delivery step, the release-conflict step and the archive steps among them, is judged from the
remote's current base. The fetch SHALL write that one tracking ref and nothing else.

#### Scenario: A base that moved on the remote
- **WHEN** the remote's `main` holds a commit that conflicts with the change in a release file, the local tracking ref of `main` is one commit behind, and `next` runs for the change in delivery
- **THEN** the tracking ref moves to the remote's commit and the action hands the release-conflict step, not the update of the branch saying the base merges cleanly

#### Scenario: The same base without the fetch
- **WHEN** the loop decides the same change from the stale tracking ref without fetching
- **THEN** the action is the update of the branch, which is the step the fetch corrects

#### Scenario: Only the base's tracking ref changes
- **WHEN** the fetch succeeds while the remote also holds a new tag and a moved branch other than the base
- **THEN** only the base's tracking ref differs afterwards: no tag is created, no other remote branch moves, and the working tree and the index are as they were

#### Scenario: A successful fetch is recorded without a line
- **WHEN** the fetch succeeds
- **THEN** the action records that the base was fetched, and its reply holds no extra line

#### Scenario: A change before its delivery
- **WHEN** `next` runs for a change whose stage is still in the plan
- **THEN** nothing is fetched

#### Scenario: A repository without a remote
- **WHEN** the repository has no `origin` remote
- **THEN** nothing is fetched, the action records no fetch and its reply is the one of today

### Requirement: A base that cannot be fetched does not stop the loop
When the fetch of the base fails or runs past 15 seconds, the loop SHALL decide the action from the
local copy of the base, exactly as it would without the fetch, with the same exit code. The action
SHALL record the failure with the base and git's first error line, and its reply SHALL end with one
line, in the person's language, saying the step was judged from this machine's copy of the base.

#### Scenario: The remote cannot be reached
- **WHEN** the remote's address leads nowhere and `next` runs for a change in delivery
- **THEN** the action and its exit code are the ones the local copy gives, the action records the failed fetch with git's first error line, and the reply's last line says the step was judged from this machine's copy

#### Scenario: The fetch runs past its time
- **WHEN** the fetch has not finished after 15 seconds
- **THEN** it is stopped, the tracking ref is as it was, and the action records a fetch that timed out

#### Scenario: Another session holds the ref
- **WHEN** another session is updating the same tracking ref and the fetch cannot lock it
- **THEN** the action is decided from the local copy and records the failure, and nothing is retried

#### Scenario: The line in both languages
- **WHEN** the person's language is Brazilian Portuguese or English
- **THEN** the line is in that language and holds no internal term, no file name and no command

### Requirement: The wait fetches the base at each poll
The change command's wait on GitHub SHALL fetch the base before each poll it decides. A line saying
the base was judged from this machine's copy SHALL NOT, by itself, count as a changed decision.

#### Scenario: Three polls
- **WHEN** the wait polls three times before the decision changes
- **THEN** the base is fetched three times, once before each poll

#### Scenario: A fetch that fails at one poll only
- **WHEN** the decision stays the same wait on GitHub and only one poll's fetch fails
- **THEN** the wait keeps polling

### Requirement: One fetch per base in one call
Within one call of the change command, and within one poll of a wait, the loop SHALL fetch each
base of the same repository at most once, and every change judged in that call SHALL use that
fetch's result.

#### Scenario: Two reads of one change in one call
- **WHEN** one call decides the action of a change twice
- **THEN** the base is fetched once

#### Scenario: Two calls
- **WHEN** `next` is called twice for the same change
- **THEN** each call fetches the base

### Requirement: Reading a change's state never fetches
The change command's state reading and the stop lock SHALL read the local copy of the base and SHALL
never fetch.

#### Scenario: The state command on a stale base
- **WHEN** the state command runs for a change in delivery whose base's tracking ref is behind the remote
- **THEN** no fetch runs and the tracking ref stays where it was

#### Scenario: The stop lock on a stale base
- **WHEN** the stop lock reads the action of a change in delivery whose base's tracking ref is behind the remote
- **THEN** no fetch runs and the tracking ref stays where it was
