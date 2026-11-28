<!-- devkit-stage decisions result=not-applicable attempt=1 commit=466f908cf1f23235f45246423900b23e45ab524a -->
# Decisions and ADRs

No record needed: reading the listing's changes in parallel, bounded by `os.availableParallelism()`, is an internal change to `state` in `plugins/openspec/hooks/change-loop.mjs` that keeps its output byte-identical and is easy to reverse; it stays within ADR 0017 decision 1 (the state is derived on every read and stored nowhere) and reuses the bound ADR 0026 already chose, so it crosses no boundary, changes no contract, picks no technology and amends no accepted record.
