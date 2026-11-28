# Release note

packs:
- devkit-openspec: patch

## the state listing reads its changes at once

- **devkit-openspec**: `change-loop.mjs state` without `--change`, run as a command, reads each
  change of its listing in a child process of the same script (`state --change <id>` with the
  same flags), at most as many at once as the machine's cores (`os.availableParallelism()`), and
  joins the entries in id order. Its output is byte-identical to the read one after another,
  failures included; a read process that dies or gives no entry fails the command with exit 3
  and `state of <id> could not be read`. The children run with `GIT_OPTIONAL_LOCKS=0`, so they
  never take a checkout's `index.lock`. `state --change <id>`, `next` and the status line are
  unchanged, and the
  coordinator's status bar can print its counts within its 20 s bound. Tests in
  `change-state-listing.test.mjs`.
- Repository: `docs/openspec-flow.md` says how the listing reads; `scripts/test-map.json` links the
  new test file to `change-loop.mjs`.
