# bob_sessions — IBM Bob evidence

Required by the judges: *"Your repository must include the code/files where IBM Bob assisted, plus IBM Bob task session summary screenshots from each team member."* Full protocol: [`plan/ref/R7-bukti-bob.md`](../plan/ref/R7-bukti-bob.md).

## Naming

`<team>_<name>_task<NN>_<slug>_summary.png`, flat in this folder. Team = `uaai` (`plan/team.json`), name ∈ `alief`, `umar`, `aarief`, `imelda`, `NN` counted per member. Optional task history export: same name without `_summary`, as `.md`.

## One Bob slice

1. Claude Code prints **BOB SLICE <id>** with the Bob mode, a ready prompt, and the expected files.
2. Work in **Bob IDE** (hackathon account, instance `ibm-coding-challenge-uat`, us-east). Correct Bob through chat, not by hand.
3. In Bob IDE open **Tasks → the task → click the task header** so the consumption summary is visible.
4. Tell Claude Code "bob selesai". Claude Code runs `radar/scripts/bob-evidence.sh <name> <NN> <slug>`, which captures the Bob IDE window without clicks and adds a row to [`INDEX.md`](INDEX.md).
5. Bob's code is committed as-is with the trailer `Bob-Assisted: bob_sessions/<png>`. Claude's fixes go in a separate commit.

macOS needs Screen Recording permission for the terminal once (System Settings → Privacy & Security → Screen Recording).
