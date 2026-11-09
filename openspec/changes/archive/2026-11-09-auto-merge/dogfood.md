# Dogfood: chacal88/devkit in merge mode

## 5.1 Precondition and plan (2026-11-09T14:37:29Z)

PR https://github.com/chacal88/devkit/pull/5 open. `gh pr checks 5 --json name`:

```
[{"name":"check","state":"SUCCESS"},{"name":"devkit-reviews","state":"FAILURE"}]
```

The plan (dry run) was shown to the owner, including that `main` refuses direct pushes from everyone. The owner confirmed auto-merge, delete-branch and ruleset.

## 5.2 Apply and re-run

```
$ node plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs --apply auto-merge,delete-branch,ruleset
applied: auto-merge, delete-branch, ruleset   (exit 0)

$ node plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs   # re-run, nothing left to do
repository: default branch main, merge method squash
the ruleset will require these checks, found on main (confirm them, or pass --checks): check
workflow       ok        .github/workflows/devkit-reviews.yml runs deliver-check --ci
auto-merge     ok        allow_auto_merge and allow_squash_merge are on
delete-branch  ok        delete_branch_on_merge is on
ruleset        ok        ruleset devkit (#26859494) already requires check, devkit-reviews
exit 0
```

```
$ gh api repos/chacal88/devkit --jq '{allow_auto_merge,delete_branch_on_merge}'
{"allow_auto_merge":true,"delete_branch_on_merge":true}

$ gh api repos/chacal88/devkit/rules/branches/main
[{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"required_reviewers":[],"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":false,"require_extra_approval_for_unattributed_changes":true,"allowed_merge_methods":["merge","squash","rebase"]},"ruleset_source_type":"Repository","ruleset_source":"chacal88/devkit","ruleset_id":26859494},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":true,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"check"},{"context":"devkit-reviews"}]},"ruleset_source_type":"Repository","ruleset_source":"chacal88/devkit","ruleset_id":26859494},{"type":"non_fast_forward","ruleset_source_type":"Repository","ruleset_source":"chacal88/devkit","ruleset_id":26859494}]
```

## 5.3 ship: merge in openspec/config.yaml

The owner confirmed `ship: { devkit-lite: merge, devkit: merge }` and `merge_method: squash` (R-9).

```
diff --git a/openspec/config.yaml b/openspec/config.yaml
index ff55b8d..a7beb11 100644
--- a/openspec/config.yaml
+++ b/openspec/config.yaml
@@ -7,6 +7,13 @@
 #   openspec new change <name> --schema devkit
 schema: devkit-lite
 
+# How far ship-change takes an approved change, per schema (plan | pr | merge).
+# merge: GitHub's auto-merge, enabled only when deliver-check reports 8/8 (ADR 0002).
+ship:
+  devkit-lite: merge
+  devkit: merge
+merge_method: squash
+
 # Shown to the agent in every artifact and in apply. Fill in for this project.
 context: |
   Stack: Claude Code plugin marketplace - Markdown agents/skills, OpenSpec schemas (YAML), Node.js hooks (plugins/openspec/hooks/guard.mjs), Python scripts
$ node plugins/openspec/hooks/deliver-check.mjs auto-merge --json   # exit 2 (blocked: item 4, AC-10 not yet proven), not 3
{
 "ship": "merge",
 "summary": "blocked: item 4",
 "merge.setup": {
  "ok": true,
  "missing": []
 }
}
```

## 5.4 Working tree

```
 M openspec/config.yaml
?? openspec/changes/auto-merge/dogfood.md
```
