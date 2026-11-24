# CompozyOS not running (AC-11, task 5.4)

Change: `compozy-driver` · Date: 2026-11-23 · Run by the conducting session in the scratch project
`devkit-proof` (`devkit.driver: compozy`).

**One variation from the plan, on purpose.** The plan has the owner stop the CompozyOS daemon for the
check. The daemon also runs the owner's other projects (`psim-kernel`, `whatsapp-platform`), so it was
not stopped. The daemon's address is read from `$COMPOZY_HOME/daemon.sock`; pointing `COMPOZY_HOME` at an
empty folder (`/tmp/czh`, a short path because a unix socket path is limited in length) gives a CompozyOS
whose daemon is not running, with the real daemon untouched (`COMPOZY_HOME=/tmp/czh compozy status -o json`: `Daemon unavailable: CompozyOS daemon is not reachable at /tmp/czh/daemon.sock ... (next: compozy daemon start)`). The same readiness probe runs in both cases.

Each call is the one the `devkit` skill makes. Before each, `git status --short` in the project shows
one entry (the untracked `.claude/worktrees/` folder of the earlier runs); after each, the same one,
and `compozy loop runs --status running` lists no run.

| # | Call | Condition | Reply (one sentence, with the command that fixes it) |
|---|---|---|---|
| 1 | `change-loop compozy-start probe-change` | no `compozy` on `PATH` | `O CompozyOS não está instalado nesta máquina, então nada foi executado: instale com brew install compozy/compozy/compozy e chame /devkit de novo.` (mode `compozy-unavailable`) |
| 2 | `roadmap-loop compozy-start` with `roadmap 2` | no `compozy` on `PATH` | the same sentence |
| 3 | `change-loop compozy-start probe-change` | daemon not running | `O CompozyOS não está rodando, então nada foi executado: inicie com compozy daemon start e chame /devkit de novo.` (mode `compozy-unavailable`) |
| 4 | `roadmap-loop compozy-start` with `roadmap 2` | daemon not running | the same sentence |
| 5 | `change-loop start` with `project billing` | the compozy driver | `/devkit project ainda não roda no CompozyOS; nada foi executado.` (mode `driver-no-project`) |

`PATH` for 1 and 2 was `<node's bin>:/usr/bin:/bin` (`compozy` lives in `/opt/homebrew/bin`). Result:
five replies, each with `git status` unchanged and no run started; pass.
