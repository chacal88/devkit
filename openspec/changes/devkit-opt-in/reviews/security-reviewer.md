Verdict: approved
Commit: 69c42d96c05415a9a1c766834b0a75347adb8db4

## Security audit — devkit-opt-in (round 1)

Triaged scope: high = plugins/openspec/hooks/guard.mjs, project-settings.mjs, install-schemas.sh; medium = SKILL.md, docs/migrate-to-project-scope.md, check.py; low = docs, READMEs, version bumps, tests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Gate result (421/421) taken as given, not re-run.

Discarded false positives:
- authz — guard.mjs:338-341 `guardBash` resolves root from `input.cwd` and returns silently when it is not opted in, so `git reset --hard` is no longer refused outside opted-in projects. This is ADR 0004, the owner's explicit choice. Not a bypass of an opted-in repo: findRoot (guard.mjs:64) walks up from the real cwd, so a subdirectory of an opted-in repo still resolves to it. A non-opted-in cwd only silences the guard for that cwd's own project. `git -C <opted-in repo> ...` or `cd` from a non-opted-in cwd was never covered (gitViolation is a command-string check and this is unchanged), so it is not a regression.
- authz — the agent can edit openspec/config.yaml (classified `planning`, guard.mjs:204) to change `schema:` and opt the project out. Same trust boundary as before: `.claude/**` is already `exempt` (guard.mjs:202), so settings.json can disable the plugin outright, and the hook is a workflow guardrail against mistakes, not a sandbox against the agent. No new capability.
- fail-open config — a missing or unparseable config.yaml means "not opted in" and silent. Intended by ADR 0004 and documented in the guard.mjs header. The regex (`^schema:\s*["']?([\w.-]+)`) is anchored and compared with an allowlist (DEVKIT_SCHEMAS), so there is no injection.
- injection / path — project-settings.mjs: the root comes from an argument or `git rev-parse` and is passed to `execFileSync` with an argv array (no shell). `--packs` is validated against the PACKS allowlist. The output path is fixed at `<root>/.claude/settings.json`. The home folder is refused through realpath on both sides (:73). Write is tmp + rename (a symlinked settings.json is replaced, not followed, and a symlinked `.claude` is the user's own choice). JSON merge keeps unrelated keys, refuses invalid or non-object JSON and does not downgrade a foreign marketplace declaration ("kept"). The tmp name uses the pid in the same directory, which is not a privilege boundary.
- injection — install-schemas.sh: `rm -r -- "${dest:?}/$name"` only removes the fixed names devkit and devkit-lite under dest. `${dest:?}` guards against an empty value. A symlink at that name is unlinked, not followed. Arguments starting with `-` are rejected. `--user` uses XDG_DATA_HOME or HOME, which are the user's own environment variables.
- data exposure / secrets — no credentials, tokens or secret-looking files in the range. The marketplace source is a public repo slug.
- docs/migrate-to-project-scope.md — the commands edit the owner's files with a backup and an Undo, are gated per item on the owner's yes, and use `jq --arg` (no interpolation into the filter). Not an exploit surface.

### Findings (TRUE POSITIVE)
None blocking.
- [nit] docs/migrate-to-project-scope.md items 3 and 4 — re-running the Command overwrites the `.bak-devkit-opt-in` file with the already edited file (`cp "$f" "$f.bak..."`), so the Undo would restore the edited version. Suggest `cp -n` or an abort if the backup exists. Data-loss hygiene, not a vulnerability.
- [nit] the same item 3 — if `jq` fails after `> "$f"` opens it, the original is truncated. The backup exists, so recovery is possible. Writing to a temp file and `mv` on success would avoid it.
