<!-- devkit-stage specs result=passed attempt=1 commit=466f908cf1f23235f45246423900b23e45ab524a -->
# Spec Delta

## ADDED Requirements

### Requirement: The listing reads its changes concurrently
Without `--change`, the state command run as a process SHALL read the changes of its listing
concurrently, at most as many at once as the cores the machine makes available and at least one,
and SHALL print what reading them one after another prints, byte for byte, failures included,
except that a read process that gives neither its entry nor a failure of the command SHALL fail
the command with exit 3.

#### Scenario: The reads overlap
- **WHEN** `state --offline --lang en` runs as a process over a listing of three changes, on a machine that makes at least two cores available, with an `openspec` on `PATH` that records when each call starts and ends
- **THEN** the calls of at least two different changes are running at the same instant, and at no instant are more changes being read than the cores the machine makes available

#### Scenario: One core
- **WHEN** the machine makes one core available to the process, or reports none
- **THEN** the changes are read one at a time, and the output is the same

#### Scenario: The same output as one after another
- **WHEN** the listing runs as a process, and the same repository, unchanged, is read one change after another
- **THEN** the two outputs are byte-identical, and each entry equals the one entry that `state --change <id>` prints for its id with the same flags

#### Scenario: A change that cannot be read
- **WHEN** the listing holds a change whose delivery read fails
- **THEN** that change is listed `blocked` with the reason `unreadable`, every other change is listed as it is when read alone, and the command exits 0

#### Scenario: A read that fails the command
- **WHEN** the read of one change of the listing fails the command, as the read of a change whose checkout's `openspec/config.yaml` holds an unknown `merge_method` does
- **THEN** the command exits 3 with the output the read one after another gives: that of the first such id in id order, and no entry

#### Scenario: A read process that gives no entry
- **WHEN** the read process of one change of the listing ends by a signal, fails to start, exits with a code other than 0 or 3, or prints no single entry for its id
- **THEN** the command exits 3 with `state of <id> could not be read: <why>` in its `error` field and prints no entry, when that id is the first in id order whose read gives no entry; when an earlier id's read fails the command, that earlier failure is the output, as in the scenario before

#### Scenario: A small listing
- **WHEN** the listing holds one change or none
- **THEN** no read process is started, and the output is that of the read one after another

#### Scenario: One change and next
- **WHEN** `state --change <id>` or `next --change <id>` runs
- **THEN** it reads that one change in its own process, as before this requirement, and prints what it printed before; an id that no file can place still exits 3 with `no change named <id>`
