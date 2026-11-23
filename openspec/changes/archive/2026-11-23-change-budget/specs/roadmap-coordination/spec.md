<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The run's replies come from the one message table
Every line and reply of `/devkit roadmap` and `/devkit status` SHALL come from the message table of
`/devkit change`, in the person's language (`pt-BR` or `en`), with no internal term.

#### Scenario: Both languages
- **WHEN** every new message of the table is rendered in English and in Brazilian Portuguese
- **THEN** both languages have the same keys and none holds a stage, role or step id, a file name, a script name or an option, except the budget stop's reply of `/devkit change`, which names the change's settings file

#### Scenario: A blocked line for every reason
- **WHEN** a change of the run stops for any reason a change can stop with (a stage failed too often, a change of the previous script, a change that could not be opened, and every other)
- **THEN** its line and its entry in the list of a run that ends say that reason in the person's language, with the reason's own details, and the run goes on

#### Scenario: A gate phrase for every owner gate
- **WHEN** a change of the run waits for the owner at any gate a change can wait at (the grill, the plan approval, the retro, a merge, a decision, a disputed review, an unfinished file, a delivery by hand, a token budget reached)
- **THEN** its line names the change and says what the owner is asked for in the person's language
