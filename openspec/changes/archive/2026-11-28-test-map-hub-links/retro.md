<!-- devkit-stage retro result=passed attempt=1 commit=d79d3b683e3f80823217185fafa3117029388f4e -->
## Retro: test-map-hub-links

1. Went wrong: the change narrowed which tests a hub module or a document selects, and its first
   version pinned only what was dropped. Removing a real reader of `change-loop.mjs` or
   `deliver-check.mjs` from the map left every test green; the test-coverage review found it in
   round 1 and `cfaefc9f` added the pin.
2. Better next time: when a change narrows a selection map, the plan names the kept links as well as
   the dropped ones and pins both with a test in the first commit.
3. Remember: a narrowing change must pin what it keeps, not only what it removes.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A narrowing of a selection map needs a test for the links that stay | bug-class | memory-only | user |

## Proposed updates

### user memory (memory-only)
A change that narrows a selection or filter map pins the kept entries with a test in its first commit, not only the dropped ones.
- Answer: approved
- Applied: yes
