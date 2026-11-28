# Release note

packs:
- devkit-core: patch

## the review writer gets the whole disposition and the round's own summary

- **devkit-core**: the review round's writer prompt keeps every disposition whole. A reviewer's own
  `refuted: <evidence>` and each refuting verifier's evidence are no longer cut at 400 characters; the
  text stays one line. The prompt leaves out the reviewer's own `## Summary` or `### Summary` section
  and asks for a last `### Summary` line built from the outcome:
  `- N findings (B blocking, I important, T nit) + P praise; open: <ids>; fixed: <ids>; refuted: <ids>`.
  The `workflow` path, the `agents` path and the CompozyOS review loop all get it from the one rules
  section. Tests in `review-round.test.mjs`.
