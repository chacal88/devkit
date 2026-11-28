<!-- devkit-stage specs result=passed attempt=1 commit=1e8c2a5084a7b8508f46fe3c2a4aa8e43affe817 -->
# Spec Delta

## ADDED Requirements

### Requirement: A disposition keeps its whole text
A finding's disposition SHALL reach its outcome line and the writer prompt whole, on both paths: a
reviewer's own `refuted: <evidence>` or `fixed in <sha>`, and the `refuted: <e1> / <e2>` the round
builds from each refuting verifier's evidence, with no length cap and no `…`. A disposition SHALL stay
one line: runs of whitespace become one space and `·` becomes `-`, as before this change.

#### Scenario: A reviewer's own long refutation
- **WHEN** a stage-1 answer lists a finding with the disposition `refuted: ` followed by 600 characters of evidence
- **THEN** the finding's outcome line ends with ` · refuted: ` and the whole 600 characters, the writer prompt holds that line, and neither ends the evidence with `…`

#### Scenario: Long evidence of the verifiers
- **WHEN** two of the three verifiers of an `important` finding refute it, each with evidence longer than 400 characters
- **THEN** the finding's outcome line ends with ` · refuted: <first evidence> / <second evidence>`, each evidence whole, and the writer prompt holds that line

#### Scenario: Still one line
- **WHEN** a reviewer's own disposition holds a line break and a `·`
- **THEN** its outcome line holds one space for the line break and `-` for the `·`

### Requirement: The writer prompt leaves out the reviewer's own summary
The writer prompt SHALL leave out every summary section of a stage-1 `sections` text. A summary
section is a line `## Summary` or `### Summary`, in any case, with no text after the word but spaces.
The text under it, up to the next heading of the same or a higher level or the end, goes too. A line
inside a fenced code block is no heading, and an unclosed fence runs to the end. The rest of `sections`
SHALL reach the writer prompt verbatim.

#### Scenario: A summary between two sections
- **WHEN** `sections` is `### Notes\nKept.\n\n### Summary\n- 2 findings; F1 is open\n\n### Next\nKept too.`
- **THEN** the writer prompt holds `### Notes\nKept.\n\n` followed by `### Next\nKept too.`, and not the line `- 2 findings; F1 is open`

#### Scenario: A second-level summary in another case
- **WHEN** `sections` holds `## SUMMARY` followed by a `### Detail` heading, its text, and then a `## Notes` heading
- **THEN** the writer prompt holds neither `## SUMMARY` nor `### Detail` nor its text, and holds `## Notes` and what follows it

#### Scenario: No summary section
- **WHEN** `sections` holds no summary heading, or only a `#### Summary` or `# Summary` heading
- **THEN** the writer prompt holds `sections` byte for byte

#### Scenario: A summary heading inside a fence
- **WHEN** the line `### Summary` of `sections` sits between two fence lines
- **THEN** the writer prompt holds `sections` byte for byte

#### Scenario: An unclosed fence under a summary
- **WHEN** a `### Summary` heading of `sections` is followed by a fence line that no later line closes, and then by a `### Notes` heading
- **THEN** the writer prompt holds nothing of `sections` from the `### Summary` line to the end

### Requirement: The writer prompt asks for the round's summary
The writer prompt SHALL ask, as the file's last section, for the line `### Summary`, then one line built
from the outcome: `- N findings (B blocking, I important, T nit) + P praise; open: <ids>; fixed: <ids>;
refuted: <ids>`. B, I, T and P count the findings of each severity and N is B + I + T. The id lists hold
blocking, important and nit findings, in the outcome's order, joined by `, `. An empty list reads `none`.

#### Scenario: Every list filled
- **WHEN** an outcome holds F1 blocking refuted by the verifiers, F2 important open, F3 nit open, F4 praise, F5 important with `fixed in abc1234` and F6 nit with the reviewer's own `refuted: <evidence>`
- **THEN** the writer prompt asks for `### Summary` and then `- 5 findings (1 blocking, 2 important, 2 nit) + 1 praise; open: F2, F3; fixed: F5; refuted: F1, F6`, after the `sections` text

#### Scenario: No findings
- **WHEN** an outcome holds no finding
- **THEN** the line is `- 0 findings (0 blocking, 0 important, 0 nit) + 0 praise; open: none; fixed: none; refuted: none`

#### Scenario: A refuted blocking finding on both paths
- **WHEN** a round's only finding is a `blocking` one that two of its three verifiers refute, each with evidence longer than 400 characters, and the reviewer's `sections` holds a `### Summary` that calls it open
- **THEN** on the `workflow` path and in the `jobs` of `review-round.mjs outcomes` the outcome's verdict is `approved`. Its line ends with ` · refuted: ` and both pieces of evidence whole. The writer prompt holds `open: none` and `refuted: F1` and not the reviewer's summary line

#### Scenario: The prompt names no second header line
- **WHEN** the writer prompt is built for any outcome
- **THEN** it names `Verdict:` only in its `line 1:` instruction and `Commit:` only in its `line 2:` instruction
