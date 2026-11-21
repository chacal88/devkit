#!/usr/bin/env bash
# Installs the devkit schemas (OpenSpec resolves schemas: project openspec/schemas/ → user dir → built-in).
#
#   install-schemas.sh            # the current project: git top level of $PWD, else $PWD; needs openspec/ there
#   install-schemas.sh <project>  # into <project>/openspec/schemas/ (versioned with the repo)
#   install-schemas.sh --user     # machine-wide: ${XDG_DATA_HOME:-$HOME/.local/share}/openspec/schemas
#
# The project form is the default because devkit is per project (ADR 0004).
set -euo pipefail

usage="usage: install-schemas.sh [<project> | --user]"
src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../schemas" && pwd)"

if [[ $# -gt 1 ]]; then
  echo "$usage" >&2
  exit 2
fi

validate_dir=.
if [[ ${1:-} == --user ]]; then
  dest="${XDG_DATA_HOME:-$HOME/.local/share}/openspec/schemas"
elif [[ ${1:-} == -* ]]; then
  echo "$usage" >&2
  exit 2
elif [[ $# -eq 1 ]]; then
  root="$(cd "$1" && pwd)"
  dest="$root/openspec/schemas"
  validate_dir="$root"
else
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  if [[ ! -d "$root/openspec" ]]; then
    echo "no openspec/ in $root: run openspec init first, or pass the project path" >&2
    exit 1
  fi
  dest="$root/openspec/schemas"
  validate_dir="$root"
fi

# The project forms use the project's OpenSpec CLI (guard.mjs#openspecCli): its installed one, else the one on PATH.
# A pinned CLI that is not 2.x, or a pin declared and not installed, stops here with nothing replaced; a CLI on PATH
# keeps the copy-then-best-effort-validation below. Without node there is no pin to read, so PATH is used.
openspec_bin=openspec
if [[ ${root:-} != "" ]] && command -v node >/dev/null; then
  guard="$(dirname "$src")/hooks/guard.mjs"
  resolve='
    import { execFileSync } from "node:child_process";
    const [root, guard] = process.argv.slice(1);
    const { openspecCli, openspecRefusal } = await import(guard);
    const cli = openspecCli(root);
    if (cli.error) { console.error(cli.error); process.exit(1); }
    if (cli.pinned) {
      let text = "";
      try { text = execFileSync(cli.bin, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* refused below */ }
      const refusal = openspecRefusal(cli, text);
      if (refusal) { console.error(refusal); process.exit(1); }
    }
    console.log(cli.bin);
  '
  openspec_bin="$(node --input-type=module -e "$resolve" "$root" "$guard")" || exit 1
fi

mkdir -p "$dest"
for name in devkit devkit-lite; do
  if [[ -e "$dest/$name" ]]; then
    echo "replacing $dest/$name"
    rm -r -- "${dest:?}/$name"
  fi
  cp -R "$src/$name" "$dest/$name"
  echo "installed $dest/$name"
done

if [[ $openspec_bin != openspec ]] || command -v openspec >/dev/null; then
  for name in devkit devkit-lite; do
    (cd "$validate_dir" && "$openspec_bin" schema validate "$name" 2>/dev/null | tail -1) || true
  done
fi
