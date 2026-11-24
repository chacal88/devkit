<!-- devkit-stage specs result=passed attempt=2 commit=77b15b107e15b2071ba2de372fa75eb23daa390f -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Every shipped stage agent declares its stage's skills
For every stage of both stage declarations whose role is shipped and has an agent file, the agent's
`skills` list SHALL equal the skills the declaration lists for that role's stages. Only the review
skill's role and the owner SHALL have no agent file; `change-coordinator`, which the session plays
on the Claude driver, SHALL have one, for the CompozyOS driver.

#### Scenario: The declarations match
- **WHEN** the agents of `plan-readiness-reviewer`, `tdd-implementer`, `commit-and-pr`, `change-planner`, `pr-verifier`, `screen-designer`, `adr-author`, `test-runner`, `e2e-tester` and `change-coordinator` are compared with both stage declarations
- **THEN** each agent's skills, a plugin prefix removed, equal its stage's skills (none for the planner and the verifier; `screen-mockup` for the screen designer; `adr-authoring` for the ADR author; `test-and-coverage` and `systematic-debugging` for the test runner; `e2e-testing` for the E2E tester; `requirements-grill` and `retro` for the coordinator)

#### Scenario: A difference
- **WHEN** an agent's skills lack one its stage lists, or list one it does not
- **THEN** the comparison fails and names the agent and the skill

#### Scenario: A role without wiring
- **WHEN** a shipped role other than `review-bench` and `owner` has no agent file
- **THEN** the comparison fails and names the role

#### Scenario: A role still marked unshipped
- **WHEN** a role the declaration marks `"shipped": false` has an agent file
- **THEN** the comparison fails and asks for the role to be marked shipped and wired
