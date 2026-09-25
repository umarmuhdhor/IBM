# Bob Radar: Roast & Improvements

Review of PRD v0.1 (24 Sep 2026), IBM Bob 2.0 Hackathon.

## Verdict

Strong hackathon idea: novel, native to Bob's hooks, and it has a clear demo moment. The PRD has four problems:

1. It fights the wrong enemy (textual merge conflicts).
2. It depends on platform behaviour that nobody has verified yet.
3. It makes humans the slow step (human-to-human negotiation).
4. It tries to build three products in 48 hours.

---

## Roast

### 1. Textual merge conflict is the wrong enemy

- `git merge-tree` only catches cases where both people edit the same lines. Bob can resolve that kind of conflict at merge time in about 30 seconds. A judge will ask: "Bob fixes those conflicts, so why block?"
- The costly case is a **semantic conflict**. Andi changes the signature of `total()`. Sari's new code calls the old `total()`. The merge is clean and the build breaks. The PRD marks this **yellow**, which means no block. Radar lets the real bug through and blocks the cheap one.
- The principle "Blokir harus jarang dan benar" (blocks must be rare and correct) contradicts using merge-tree. A textual check is not rare, because nearby hunks conflict, and it is not always correct.

### 2. Andi's half-finished work becomes a claim on the file

- Snapshots of work in progress are noisy. Andi's exploratory edit to `total()` 10 minutes ago now blocks Sari, even if Andi will throw that edit away.
- **Snapshots have no TTL.** Leases expire after 30 minutes, but `refs/radar/andi` stays. If Andi goes to sleep or abandons the branch, Sari stays blocked. Nothing clears a snapshot after Andi's PR merges.
- First writer wins. The person who touches the file first owns it, whoever should own it.
- **Different bases cause blame on the wrong person.** If Andi branched from an older `main`, merge-tree can report conflicts that come from `main` commits and blame Sari.

### 3. `apply_diff` is P1, but it is probably Bob's main edit tool

- FR-03 (P0) matches `apply_diff`, but applying the diff is FR-26 (P1). The fallback is line-range overlap on work-in-progress files, and those line numbers drift. In practice, the P0 check would run blind on most edits.
- **Fix:** the hook runs on the laptop, next to the file. Apply the proposed edit locally to build the resulting file, and send the full content. The server never has to parse diff formats.

### 4. A `git push -f` to GitHub after every edit

- This adds about 1–3 seconds of network time per edit and a lot of ref noise on the team remote. The server also needs credentials to fetch.
- **Race condition:** Sari's next `/check` can run before the server has fetched her previous snapshot.
- **Secret risk:** `git add -A` pushes untracked files that `.gitignore` does not cover, such as `.env.local` or `scratch.json`, to the shared remote after every edit.
- **Simpler:** POST `{head_sha, git diff HEAD}` to the server. The server fetches `main` once and applies the patches itself. You need no GitHub push credentials and create no noise on the remote.

### 5. Negotiation between two humans is the slowest step

- Proposals reach Andi only on his next prompt (`UserPromptSubmit`). If Andi is in a 10-minute agent run, Sari waits the whole time. The "< 60 s to approval" target works only in a staged demo.
- The board approve button (FR-35) is P2, so the MVP has no fast path at all.
- A judge will ask: "Why not just Slack Andi?" An AI-written "interface contract" is a formal way to say "you do X, I do Y".
- The persona section says developers "tidak mau alur kerjanya diperlambat" (don't want their workflow slowed down). The design then interrupts two humans for every conflict.

### 6. The `Stop` hook probably does not mean what you think

In Claude Code-style hook systems, `Stop` fires at the end of **every agent turn**, not at session end. If Bob works the same way, FR-06 releases leases after every response, and leases stop working. **Add this to the spike.**

### 7. The architecture assumes things nobody has tested

- Open question #1 (what the model receives after exit 2) decides whether the product works at all. If the stderr from an exit-2 hook already reaches the model, as in Claude Code, then `why_blocked` and most of `radar-mcp` are unnecessary.
- The Bob hook knowledge comes partly from a third-party blog post. The rubric and track are not known yet.
- GATE 1 is correct. Also decide now what you will cut if the spike shows that stderr passthrough works.

### 8. The A/B experiment is circular

- "0 merge conflicts with Radar" is true by construction, because Radar blocked those edits. It proves nothing.
- It uses one designed scenario, one run and two people. A sharp judge will point this out, even though the PRD already admits the small sample.
- The honest metric is **total time until both tasks merge and pass tests**, plus **total Bobcoin**. Blocking can make wall-clock time worse, and you need to know that before the judges find out.

### 9. The scope is huge for 48 hours

The plan has 5 hooks, 6 MCP tools, a FastAPI server, a conflict engine, a mirror repo, WebSocket, a Next.js radar map, replay mode, duplicate-intent detection with Granite, an A/B experiment, a video, a deck and a cover image. The schedule also has **no sleep block**: the spike runs 01:00–04:00 right after kickoff. At Sunday 14:00, a tired team produces a broken demo.

### 10. Smaller issues

- **Static token:** "token statis di file konfigurasi" (a static token in the config file). If the MVP commits that file, the secret is in the repo. Use an env var or a gitignored file from day one.
- **Hard lease abuse:** anyone can set a `hard` lease, which means anyone can squat on files. Define who is allowed to set one.
- **Hooks as code execution:** the hooks run arbitrary Python from the repo on every teammate's machine. The deck already says this, which is good. Expect a question about it.
- **The statistic:** "41.7%" counts **PR pairs**, not PRs. That is easy to misquote on a slide, and judges check numbers. Quote the paper's exact wording.
- **Document length:** a 17-section PRD is fine for the team, but nobody outside the team will read it. The deck needs one diagram and one number.

---

## Improvements

### Change the idea from locking to sharing context (the biggest improvement)

- When Radar detects a collision, block only the first time, and put Andi's current in-progress diff for that function into Sari's Bob context.
- Sari's Bob then writes code that fits Andi's version, for example by calling the new `calculateTotal()`. The collision becomes cooperation, and neither human is interrupted.
- Keep human negotiation only for real ownership disputes.
- This beats Clash and MCP Agent Mail more clearly than "we block too".

### Add one semantic check to the demo

- Use tree-sitter or a simple symbol regex. Report: "Andi changed the signature of `total()`, and your edit calls `total()`." Mark this **red** even when the merge is clean.
- This is the moment that shows the judges "git can't do this".

### Tighten P0

| Change | Fixes |
| --- | --- |
| Simulate the edit locally in the hook and send the full resulting file | Roast 3 |
| Upload snapshots as patches over HTTP instead of `git push` | Roast 4 |
| Give snapshots a TTL, and clear them on merge or inactivity | Roast 2 |
| Promote the board approve button to P0, because it is the only fast path | Roast 5 |
| Verify `Stop` hook semantics in the spike | Roast 6 |

### Cut or demote

- **Granite embeddings:** cut, unless the rubric gives points for IBM runtime use.
- **Live WebSocket radar map:** make the board read the same JSON that replay mode uses, and poll it in live mode. That removes a whole subsystem.
- **Duplicate-intent detection:** demote to P2. It is a second product.
- **`radar-mcp`:** cut it if the spike shows that the model sees stderr from the hook.

### Fix the experiment

- Run each condition 3 times.
- Include one semantic-conflict task.
- Report total time, Bobcoin, and tests passing after merge, not merge-conflict counts.
- If Radar loses on time, say so, and show that it wins on broken builds.

### Fix the schedule

- Plan two 4-hour sleep blocks.
- Freeze features for the core flow at Saturday 23:00.
- Record demo footage on Sunday morning while the team is fresh.

### Give the pitch one sentence

> Git tells you about conflicts after the code exists. Radar tells Bob before it writes, and shows it your teammate's in-progress code so it writes something compatible.
