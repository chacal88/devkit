#!/usr/bin/env bash
# Installs the devkit schemas for every project on this machine
# (OpenSpec resolves schemas: project openspec/schemas/ → user dir → built-in).
#
#   install-schemas.sh            # user dir
#   install-schemas.sh <project>  # into <project>/openspec/schemas/ (versioned with the repo)
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../schemas" && pwd)"
if [[ $# -ge 1 ]]; then
  dest="$(cd "$1" && pwd)/openspec/schemas"
else
  dest="${XDG_DATA_HOME:-$HOME/.local/share}/openspec/schemas"
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

if command -v openspec >/dev/null; then
  for name in devkit devkit-lite; do
    (cd "${1:-.}" && openspec schema validate "$name" 2>/dev/null | tail -1) || true
  done
fi
