# Acceptance criteria map: delivery-train

Task 6.7. Each acceptance criterion of `proposal.md` with the test of `design.md` D-13's table that proves it, by its exact name in
`plugins/openspec/hooks/delivery-train.test.mjs`, and its result. The column "this hand-off" is the result of the focused run the
implementer made of that file (`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test
plugins/openspec/hooks/delivery-train.test.mjs`, which also runs the suites it imports: 957 tests, 957 pass, 0 fail; the real-run test
was then run alone again after its last edit, pass). The column "6.9 run" is filled from the
coordinator's single full-suite run (task 6.9), which the implementer does not run.

| AC | Slug | Test (exact name) | Also | This hand-off | 6.9 run |
|---|---|---|---|---|---|
| AC-1 | `train-opt-in` | `delivery-train AC-1: without the key the delivery rows give the JSON and the exit code they gave, whatever the model and the ship map` | plus the `delivery-train config: ...` tests (P1, P2) and every existing suite unchanged, which only the 6.9 run proves | pass | pending |
| AC-2 | `boarding-at-review` | `delivery-train AC-2: a change approved at its head is boarded behind main, with pending checks, and waits for the owner` | - | pass | pending |
| AC-3 | `merge-of-main-costs-nothing` | `delivery-train AC-3: a sibling's merge into main leaves the boarded change's evidence, reviews and action as they were` | - | pass | pending |
| AC-4 | `train-departure` | `delivery-train AC-4: one departure cuts train/<n>, joins in order, renumbers on the train only, opens one pull request; a second request starts none` | the real run exercises it through the command lines (`delivery-train AC-12: the real run`) | pass | pending |
| AC-5 | `one-full-run` | `delivery-train AC-5: the suite runs once at the train's head, into the record committed on the train branch`<br>`delivery-train AC-5: the tasks item skips the parts of the train and says how many the train proves` | - | pass | pending |
| AC-6 | `train-check` | `delivery-train AC-6: devkit-reviews judges each boarded change at its own head, its containment, the train's own commits and the record` | - | pass | pending |
| AC-7 | `red-train` | `delivery-train AC-7: two changes that pass alone and fail together: the later leaves with the failure, the rest departs after one more run` | case 3 of the real run runs it with a real `node --test` suite | pass | pending |
| AC-8 | `join-conflict` | `delivery-train AC-8: a release-only conflict is resolved by rule; a product conflict takes the change off with its path` | case 4 of the real run | pass | pending |
| AC-9 | `archives-board` | `delivery-train AC-9: two archives board together, no archive branch is updated, each folder is judged in the train's check`<br>`delivery-train AC-9: two archives at the archive step both go on in a train project, and one waits for the other without the key` | - | pass | pending |
| AC-10 | `delivered-by-train` | `delivery-train AC-10: after the merge every boarded change is delivered, merged or closed with a comment; trunk-auto enables auto-merge with --merge, trunk waits for the owner` | cases 1 and 2 of the real run | pass | pending |
| AC-11 | `adr-and-docs` | `delivery-train docs: the documents follow` | and the gates `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` | pass | pending |
| AC-12 | `real-run-proof` | `delivery-train AC-12: the real run` | and `proof/real-run.md` | pass | pending |
