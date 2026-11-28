#!/usr/bin/env bash
# Real run of release-merge-manifest-fields (design D-10). Writes the transcript to $OUT.
set -u
export PATH=/home/kaue/.local/share/fnm/node-versions/v26.13.1/installation/bin:$PATH TMPDIR=/var/tmp
WT=/home/kaue/repos/devkit/.claude/worktrees/jolly-noyce-971704
OUT=$1
R=/var/tmp/devkit-rmmf
CL=$R/clone
rm -rf "$R"; mkdir -p "$R"
exec >"$OUT" 2>&1
run() { echo "\$ $*"; "$@"; local s=$?; echo "[exit $s]"; return 0; }
q() { "$@" >/dev/null 2>&1; }
edit() { # edit <file> <python expr on d>
  python3 - "$1" "$2" <<'PY'
import json,sys
p,expr=sys.argv[1],sys.argv[2]
d=json.load(open(p))
exec(expr)
open(p,'w').write(json.dumps(d,indent=2,ensure_ascii=False)+"\n")
PY
}
core_entry='[e for e in d["plugins"] if e["name"]=="devkit-core"][0]'
bump() { # bump <version>
  edit $CL/plugins/core/.claude-plugin/plugin.json "d['version']='$1'"
  edit $CL/.claude-plugin/marketplace.json "${core_entry/\[0\]/[0]}['version']='$1'"
}
desc() { # desc <text>
  edit $CL/plugins/core/.claude-plugin/plugin.json "d['description']='$1'"
  edit $CL/.claude-plugin/marketplace.json "${core_entry}['description']='$1'"
}
commit() { (cd $CL && python3 scripts/gen-catalog.py >/dev/null && git add -A && git -c user.name=realrun -c user.email=realrun@example.invalid commit -q -m "$1"); }

echo "# Real run of release-merge-manifest-fields (design D-10)"
echo "# clone of $(cd $WT && git rev-parse HEAD) on $(date -u +%FT%TZ); load: $(uptime)"
echo
q git clone -q --no-hardlinks "$WT" "$CL"
cd $CL
git checkout -q -b base0
BASE=$(git rev-parse HEAD)

echo "## Case 1: --merge, the head alone edits devkit-core's description (AC-1, AC-6)"
git checkout -q -b train/t1 $BASE; bump 0.19.0; commit "train: devkit-core minor"
git checkout -q -b head1 $BASE; bump 0.18.2; desc "Case 1 head description."; commit "head: devkit-core patch and description"
H1=$(git rev-parse HEAD)
git checkout -q train/t1
run node plugins/openspec/hooks/release-merge.mjs --merge $H1 --json
run python3 scripts/gen-catalog.py --check
run git show --stat --format='%H %s' HEAD
run python3 -c "import json;print(json.load(open('plugins/core/.claude-plugin/plugin.json'))['version'], json.load(open('plugins/core/.claude-plugin/plugin.json'))['description']); print([(e['version'],e['description']) for e in json.load(open('.claude-plugin/marketplace.json'))['plugins'] if e['name']=='devkit-core'])"
run grep -c "Case 1 head description." docs/catalog.md
echo

echo "## Case 2: --merge, both sides edit devkit-core's description (AC-3)"
git checkout -q -b train/t2 $BASE; bump 0.19.0; desc "Case 2 train description."; commit "train: devkit-core minor and description"
git checkout -q -b head2 $BASE; bump 0.18.2; desc "Case 2 head description."; commit "head: devkit-core patch and description"
H2=$(git rev-parse HEAD)
git checkout -q train/t2
OLD=$(git rev-parse HEAD); echo "train head before: $OLD"
run node plugins/openspec/hooks/release-merge.mjs --merge $H2 --json
run git rev-parse HEAD
run git status --porcelain
run test -e .git/MERGE_HEAD
echo

echo "## Case 3: --base, the branch alone edits devkit-core's description (AC-5)"
git checkout -q -b main3 $BASE; bump 0.19.0; commit "main: devkit-core minor"
M3=$(git rev-parse HEAD)
git checkout -q -b change3 $BASE; bump 0.18.2; desc "Case 3 branch description."; commit "change: devkit-core patch and description"
git update-ref refs/remotes/origin/main $M3
run node plugins/openspec/hooks/release-merge.mjs --base main --json
run python3 -c "import json;p=json.load(open('plugins/core/.claude-plugin/plugin.json'));print(p['version'],p['description'])"
run python3 scripts/gen-catalog.py --check
echo
echo "# end; $(uptime)"
cd /; rm -rf "$R"
