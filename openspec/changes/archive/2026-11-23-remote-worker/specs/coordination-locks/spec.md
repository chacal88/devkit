<!-- devkit-stage specs result=passed attempt=3 commit=ccb3dfbe2170e76a9b17224e8dcc98db8ca8ee74 -->
# Spec Delta

## ADDED Requirements

### Requirement: No lock reaches another machine
No lock SHALL reach another machine over SSH. The roadmap stop lock SHALL judge with every listed
machine counted as not answering, and the locks of a change run SHALL judge the place of a change from
this clone and `origin` alone. A machine that cannot be reached SHALL never make a lock refuse, and a
lock that cannot read `origin` SHALL let the action through.

#### Scenario: The stop lock with a listed machine
- **WHEN** in a roadmap run with the machines setting listing `avel`, the session tries to end its turn and the only work a decision could give is to open a change for `avel`
- **THEN** the stop is allowed, and no SSH command is run by the hook

#### Scenario: The stop lock of a change waiting for a place
- **WHEN** in a `/devkit change` run the change's next action is the blocked end waiting for a place
- **THEN** the stop is allowed

#### Scenario: GitHub cannot be read by a lock
- **WHEN** the stop lock of a roadmap run cannot list the branches on `origin`
- **THEN** it judges as if no line were open on another machine, and lets the stop through when that judgment cannot be made

#### Scenario: Reading the claims stays within a lock's time
- **WHEN** a lock reads which changes are open on other machines in a clone whose view of `origin` is out of date for many branches
- **THEN** it skips the default branch, asks GitHub about at most 4 branches with at most 8 calls, starts no call after 10 seconds, and counts a branch it did not read as holding no place
