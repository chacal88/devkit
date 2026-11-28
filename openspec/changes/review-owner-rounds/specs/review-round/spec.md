<!-- devkit-stage specs result=passed attempt=3 commit=a0e9efb9e046bf0cfe6f88199fbe8d334ea0b11b -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A round beyond the second runs within the authorized limit
The round script SHALL accept an optional `limit` argument, a whole number of 2 or more, 2 when
absent, and a round from 1 to that limit; a round above 2 SHALL also need the owner's recorded words
(requirement "A round beyond the second needs the owner's recorded words"). The prompts and
`review.md` SHALL name the round as `round <n> of <limit>` and `(round <n>/<limit>)`, and a failed
round at the limit SHALL say the owner decides.

#### Scenario: A third round with its limit
- **WHEN** the round runs with `round: 3`, `limit: 3` and the owner's words recorded for round 3 in `args.owner`
- **THEN** the arguments are accepted and `review.md` reads `Consensus: FAIL (round 3/3)` on a failure, with the deadlock sentence after round 3

#### Scenario: A third round with no limit
- **WHEN** the round runs with `round: 3` and no `limit`
- **THEN** the arguments are refused, as before

#### Scenario: A round above its limit
- **WHEN** the round runs with `round: 4` and `limit: 3`
- **THEN** the arguments are refused

#### Scenario: A limit below two
- **WHEN** the round runs with `limit: 1`, or a limit that is not a whole number
- **THEN** the arguments are refused

#### Scenario: No limit
- **WHEN** the round runs with `round: 2` and no `limit`
- **THEN** the texts are those of today: `round 2 of 2`, `(round 2/2)` and the deadlock after round 2

## ADDED Requirements

### Requirement: A round beyond the second needs the owner's recorded words
The Workflow script and every `review-round.mjs` command that takes `args` SHALL refuse a round
above 2 whose `args.owner` does not hold the owner's words for that round and for the review's scope
(`resolution` when `args.verdictDir` is set, `review` otherwise), with an error starting
`review input invalid:` that names the missing authorization, before any agent starts. A round of 1
or 2 SHALL take no `args.owner`.

#### Scenario: A third round without the owner's words, on the Workflow path
- **WHEN** the Workflow script runs with `round: 3`, `limit: 3` and no `args.owner`
- **THEN** it throws `review input invalid: round 3 needs the owner's authorization: args.owner holds no words recorded for round 3 of scope review (change-loop.mjs declare <change> review-round)`, starts no agent, and returns no section for `review.md`

#### Scenario: A third round without the owner's words, on the agents path
- **WHEN** `review-round.mjs stage1`, `verify`, `outcomes` or `consolidate` runs with `args` of `round: 3`, `limit: 3` and no `owner`
- **THEN** it exits 3, prints nothing on stdout, and stderr starts with `review input invalid: round 3 needs the owner's authorization:`

#### Scenario: An owner that is not an object
- **WHEN** a round of `round: 3` and `limit: 3` gets `args.owner` as an array or a string
- **THEN** the arguments are refused with `review input invalid: args.owner must be an object`, on the Workflow path and by every `review-round.mjs` command that takes `args`

#### Scenario: Words of another round or scope
- **WHEN** a round of `round: 4` gets an `args.owner` whose `round` is 3, or a code review gets one whose `scope` is `resolution`
- **THEN** the arguments are refused, the error naming the round or the scope they must hold

#### Scenario: Words that are not the owner's words
- **WHEN** `args.owner.words` is not a string, is empty or blank, or is longer than 200 characters
- **THEN** the arguments are refused with `review input invalid: args.owner.words must be the owner's words, 1 to 200 characters`

#### Scenario: Words on an early round
- **WHEN** a round of `round: 1` or `round: 2` gets an `args.owner` object
- **THEN** the arguments are refused with `review input invalid: args.owner is only for a round above 2`, and an absent or `null` `owner` is accepted

### Requirement: The owner command reads the owner's words from the record
`review-round.mjs owner`, given `{ changeDir, scope, round }`, SHALL print `{ owner: null }` for a
round of 1 or 2 without reading anything, and for a round above 2 `{ owner: { round, scope, words } }`
with the words of the last `review-round` entry of `<changeDir>/declared.json` for that round and
scope, an entry with no scope reading as `review`. It SHALL read the record by the rules of the
delivery check and exit 3 when no words are recorded.

#### Scenario: The words of an authorized round
- **WHEN** `declared.json` holds a `review-round` entry of scope `review`, round 3 and words `Sim, libera`, and `owner` runs with scope `review` and round 3
- **THEN** it exits 0 and prints `{ "owner": { "round": 3, "scope": "review", "words": "Sim, libera" } }`

#### Scenario: No words recorded for the round
- **WHEN** `owner` runs with round 3 and the record is missing, or holds entries only for another round or the other scope
- **THEN** it exits 3, prints nothing on stdout, and stderr starts with `review input invalid: round 3 needs the owner's authorization:` and names the record's path

#### Scenario: An unreadable record
- **WHEN** `declared.json` is empty, is not JSON, holds no object, has a version other than 1 or no list of steps
- **THEN** `owner` exits 3 and stderr names the record's path and the delivery check's reason for it

#### Scenario: An early round
- **WHEN** `owner` runs with round 1 or 2, with or without a record
- **THEN** it exits 0 and prints `{ "owner": null }`

#### Scenario: A malformed input
- **WHEN** `owner` runs with no `changeDir`, a `scope` other than `review` or `resolution`, or a `round` that is not a whole number of 1 or more
- **THEN** it exits 3 and stderr starts with `review input invalid:`

#### Scenario: The same reading as the delivery check
- **WHEN** `owner` and `deliver-check.mjs` read the same `declared.json`, for each record of the scenarios above
- **THEN** `owner` refuses an unreadable record exactly when the delivery check reads it as unreadable, and finds words for a round and scope exactly when the delivery check lists a `review-round` entry of that round and scope

### Requirement: The round's section quotes the owner's words
For a round above 2, the section the round consolidates for `review.md`, or for `resolution.md` in a
resolution call, SHALL hold one line `` Owner's words for round <n>: "`<words>`" `` after its
`Consensus:` line: the words of `args.owner`, with each run of white space made one space and each
backtick printed as `'`, inside a backtick span within the double quotes. A round of 1 or 2 SHALL
print the section it prints today, with no such line.

#### Scenario: An authorized third round
- **WHEN** a round runs with `round: 3`, `limit: 3` and `args.owner` holding `Sim, libera`
- **THEN** its section reads `Consensus: <PASS|FAIL> (round 3/3)`, then a blank line, then `` Owner's words for round 3: "`Sim, libera`" ``, and holds no other line starting `Owner's words`

#### Scenario: A backtick inside the words
- **WHEN** a round runs with `round: 3`, `limit: 3` and `args.owner` holding `` Sim, `libera` ``
- **THEN** its line reads `` Owner's words for round 3: "`Sim, 'libera'`" ``, with no backtick inside the span

#### Scenario: Two authorized rounds
- **WHEN** round 3 runs with the words recorded for round 3 and round 4 runs with the words recorded for round 4, each appending its section
- **THEN** the section of round 3 quotes only the words of round 3 and the section of round 4 quotes only the words of round 4

#### Scenario: A resolution round
- **WHEN** a resolution call runs with `round: 3`, `limit: 3`, `verdictDir: "reviews/resolution"` and the words recorded for round 3 of scope `resolution`
- **THEN** the section for `resolution.md` quotes those words, never the words of scope `review`

#### Scenario: Rounds one and two
- **WHEN** a round runs with `round: 1` or `round: 2`
- **THEN** its section is byte for byte the one the round script of the base prints for the same input, with no line starting `Owner's words`

#### Scenario: The deadlock reading is unchanged
- **WHEN** a `review.md` holds an authorized round's section whose quoted words contain `Consensus: PASS (round 9/9)`
- **THEN** the delivery check reads the section's own `Consensus:` line, its round and its result

### Requirement: The review skill fills the owner's words from the record
The `review-change` skill SHALL tell its caller to fill `args.owner`, for a round above 2, with the
`owner` that `review-round.mjs owner` prints, unchanged, and SHALL NOT ask the session to copy the
owner's words into the section's notes. The `review` and `review-resolution` rows of the
`ship-change` skill SHALL say how `args.owner` is filled.

#### Scenario: The skill text
- **WHEN** `plugins/core/skills/review-change/SKILL.md` is read
- **THEN** its `args` sentence names `owner` and `review-round.mjs owner` with `{ changeDir, scope, round }`, and its rounds rule no longer says to quote the owner's words in the notes

#### Scenario: The ship-change rows
- **WHEN** the `review` and `review-resolution` rows of `plugins/openspec/skills/ship-change/SKILL.md` are read
- **THEN** each names `args.owner` and `review-round.mjs owner`, with the scope `review` or `resolution`
