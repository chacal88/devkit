// Captured 2026-11-10 in the devkit repository: `node plugins/openspec/hooks/conduct-check.mjs --json --change x`
// (devkit-openspec 0.9.1, before the sibling change `conduct-one-change` adds the option). Exit code 3, whole.

/** The JSON error line on stdout. */
export const CHANGE_OPTION_STDOUT = "{\"version\":2,\"error\":\"unknown option --change; usage: conduct-check [--json] [--round <n>] [--busy <id,id>] [--watch[=<minutes>]]\"}"
/** The same message on stderr. */
export const CHANGE_OPTION_STDERR = "conduct-check: unknown option --change; usage: conduct-check [--json] [--round <n>] [--busy <id,id>] [--watch[=<minutes>]]"
/** The exit code of a usage error. */
export const CHANGE_OPTION_EXIT = 3
