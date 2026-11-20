<!-- devkit-stage specs result=passed attempt=1 commit=6e4c0635215b4a1da287461e3713c9efe010db4d -->
# Spec Delta

## ADDED Requirements

### Requirement: Every shipped stage agent declares its stage's skills
For every stage of both stage declarations whose role is shipped and has an agent file, the agent's
`skills` list SHALL equal the skills the declaration lists for that role's stages. Only the roles
played by the session, the review skill and the owner SHALL have no agent file.

#### Scenario: The declarations match
- **WHEN** the agents of `plan-readiness-reviewer`, `tdd-implementer`, `commit-and-pr`, `change-planner` and `pr-verifier` are compared with both stage declarations
- **THEN** each agent's skills, a plugin prefix removed, equal its stage's skills (none for the planner and the verifier)

#### Scenario: A difference
- **WHEN** an agent's skills lack one its stage lists, or list one it does not
- **THEN** the comparison fails and names the agent and the skill

#### Scenario: A role without wiring
- **WHEN** a shipped role other than `change-coordinator`, `review-bench` and `owner` has no agent file
- **THEN** the comparison fails and names the role

#### Scenario: A role still marked unshipped
- **WHEN** a role the declaration marks `"shipped": false` has an agent file
- **THEN** the comparison fails and asks for the role to be marked shipped and wired
