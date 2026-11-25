Proof of project-setup (tasks.md header, design D-13 and D-14, AC-10)

The files below are saved here as the phases run. Each holds a run's output as printed, never
edited after it was saved.

Red runs (test first, phases 3 to 6). The phase's first task writes its new tests, runs them on the
code as it is, and saves the output here. That run is the task's check, never a gate. N-6, N-7, N-16
and N-19 pin behaviour that already holds once their files exist; they pass when written and are
never among the failing tests of a red file.
  red-3.txt   task 3.1: N-1 to N-5, N-8, N-9 and N-18 fail
  red-4.txt   task 4.1: B-1 to B-17 and K-1 to K-5 fail; P-1 and N-19 pass, as the task says
  red-5.txt   task 5.1: N-11 to N-14, N-17 and T-15 fail; N-15 passes, as the task says
  red-6.txt   task 6.1: N-10 fails, naming the files of tasks 6.2 to 6.4

Real runs (phase 7, design D-14). Done by the session that conducts this change, in scratch
projects under the session's TMPDIR, outside this repository. Each file holds the run's transcript
lines and the commands' outputs. A run that could not happen is recorded in its file with the
reason, and the owner decides at the evidence whether it counts. The six files are committed before
the evidence stage and cited in evidence.md before the first review round.
  r1-first-install.txt   R-1: first install, kit declined (task 7.1)
  r2-rerun.txt           R-2: re-run on R-1's project, nothing missing (task 7.2)
  r3-merge-mode.txt      R-3: merge mode, every GitHub item declined (task 7.3)
  r4-kit-yes.txt         R-4: kit yes (task 7.4)
  r5-driver-compozy.txt  R-5: driver compozy, then /devkit setup typed again (task 7.5)
  r6-typed-only.txt      R-6: a plain-words request runs no setup (task 7.6)
