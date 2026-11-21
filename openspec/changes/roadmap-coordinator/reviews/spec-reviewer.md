Verdict: approved
Commit: 9307ba1dd24843a444fabc6594695db1888dc830

## Spec review — roadmap-coordinator

### Findings
- [praise] plugins/openspec/hooks/roadmap-loop.test.mjs — Every scenario of the three deltas has a named test, including the lock rows RS/RH/RU and the board rendered line by line in both languages.

Verdict: approved
Commit: 9307ba1dd24843a444fabc6594695db1888dc830

## Spec review — roadmap-coordinator

In-scope specs: openspec/changes/roadmap-coordinator/specs/roadmap-coordination/spec.md, openspec/changes/roadmap-coordinator/specs/change-coordination/spec.md, openspec/changes/roadmap-coordinator/specs/coordination-locks/spec.md. The canonical baselines openspec/specs/change-coordination and openspec/specs/coordination-locks were checked as the bases of the MODIFIED requirements. ADR 0010, 0011 and 0013 are the decisions the spec defers to.

### Coverage
| Requirement | Status |
|---|---|
| The roadmap command reads its number | covered (parseWord; run U1) |
| The run and the status command run only where the change command runs | covered (start routing test: schema, unknown driver, compozy) |
| A roadmap line is started only when its dependencies are archived | covered (lines C1-C8; decide starts) |
| Every open change of the roadmap fills a place | covered (decide places) |
| The number can change during a run | covered (places lower number; run U4) |
| Starts are held while the machine is loaded | covered (limitOf, readLoad, load, hold) |
| The owner sees one line per event | covered (events test) |
| The owner's gates are asked one change at a time | covered (owner queue tests) |
| Stopping a run lets each stage end | covered (stopping; run U3) |
| A blocked change keeps its place | covered (blocked; C6) |
| A run ends by itself | covered (E1-E3) |
| Calling the command again resumes from the files | covered (resume; run file; status nothing written) |
| A project without a roadmap is offered a draft | covered (U2; draft tests) |
| Changes outside the roadmap are left alone | covered (C4, previous-script fixtures P1-P6, Q1-Q2) |
| The status command shows the whole picture | covered (board pt-BR and en; no-roadmap; outside block) |
| The run's replies come from the one message table | covered (T-5 and replies tests) |
| The devkit command reads its verb (MODIFIED) | covered |
| Replies use no internal term (MODIFIED) | covered (T-5 with the exempt list the spec names) |
| Two openings at once do not collide | covered (change-loop open: two openings; lock older than ten minutes taken over; waitMs 60s) |
| A roadmap run is known from the session's own record | covered (lock run tests) |
| The roadmap coordinator does not end its turn while work is ready | covered (RS1-RS5) |
| In a roadmap run a hand-off names its change | covered (RH0-RH5) |
| A stage agent of a roadmap change delivers before it stops | covered (RU1-RU7) |
| The session writes no product code in a roadmap run | covered (lock edit tests) |

Scope creep: none found. The extra plumbing (the `--fresh`, `--after`, `hold` and `wait` internals, the `load_limit` plugin setting) is the mechanism the spec and design name. The setting is the one the load requirement names. The documents, the version bump to 0.18.0 and ADR 0013 follow design D-14 to D-16. ADR 0013 is accepted, and the owner's approval is recorded in approval.md, so no open decision is bypassed. ADR 0010 and 0011 carry the Amended-by lines. No two specs disagree.

### Summary
- 0 findings (0 scope creep, 0 gaps)

Spec review — pass. Full coverage; no scope creep.
