---
format: 1920x1080
duration: 170s
message: "Every teammate's Bob, working together — collisions blocked before they land."
arc: Collision → Turn (product) → Sizzle → Slow down → Brief → Plan → Reveal → Build → Near-miss → Primitives → CTA
audience: IBM Bob hackathon judges and developers who code with IBM Bob
mode: collaborative
---

# IBM Bob Live Collab — film v1

## Decisions

- **Message:** Every teammate's Bob, working together — collisions blocked before they land.
- **Arc:** fast kinetic open (0–34 s) → slow narrated step-by-step demo in Bob IDE (34–148 s) → primitives + CTA (148–170 s).
- **Format:** 1920×1080, ~170 s, female VO (ElevenLabs, best model), music bed carved under VO, SFX on hits. Captions not planned (VO + on-screen type carry it); keep content in top 83% anyway.
- **Spine / hero prop:** the file `checkout.ts`. It is the collision in F01 and the near-miss in F09 (callback: same file, this time blocked instead of broken).
- **Brand (from capture/extracted/tokens.json):** bg `#0e0e10`, surfaces `#161616 / #1e1e20 / #262626`, border `#393939`, text `#f4f4f4 / #a8a8a8`, accent `#0f62fe` (soft `#a6c8ff`), ok `#42be65`, warn `#f1c21b`, danger `#fa4d56`, needs-you `#ff7eb6`. Owners: Aarief `#be95ff` (member-b), Alief `#78a9ff` (member-a), Umar `#08bdba` (member-d). Type: IBM Plex Sans 600 display, Plex Sans 400 body, Plex Mono for code/traces.
- **Bans:** no gradient text; no invented numbers (site stats belong to the Andi/Budi session — not used); no IBM logo; no slideshow (every beat a new card) and no screensaver (motion that says nothing); no Andi/Budi/Citra names.
- **Held frame:** F09 at the block — the red `PreToolUse → blocked` card holds still ~1.5 s while the line lands.
- **Truthfulness:** F03 uses real captured screenshots of ibm-bob-live-collab.pages.dev. F05–F09 are a **reconstructed Bob IDE** (user's choice), not a screen recording; each window slot can later be swapped for real Bob IDE footage without changing timing.
- **Seam direction:** leftward / zoom continuity; camera moves are the transitions inside the demo (one world, no cuts from F05 to F09).

## Frame 1 — Collision (0–9, ~9s)

- scene: Kinetic type beats — "Your team codes with AI." → three owner chips pop → two cursors race into the same checkout.ts → red CONFLICT slam
- duration: 9s
- blueprint: kinetic-type-beats
- transition_in: cut
- status: animated
- src: compositions/frames/01-collision.html
- voiceover: "Your whole team codes with AI now. Everyone brings their own Bob. And sooner or later, two of them reach for the same file."

Hook in outcome language: the pain is a broken build, not a feature. Words swap in place on hard cuts, the code block slides in, two owner-coloured carets type into line 3 at once, the frame shakes and `CONFLICT (content): Merge conflict in src/checkout.ts` slams in red. SFX: tick per word, low thud on the slam.

## Frame 2 — Takeover (9–18, ~9s)

- scene: The site headline "Your team's Bobs, working together" crashes in and shoves the CONFLICT bar off-frame; bob-crew mascot springs up; wordmark lockup
- duration: 9s
- blueprint: ticker-takeover
- transition_in: cut
- status: animated
- src: compositions/frames/02-takeover.html
- voiceover: "IBM Bob Live Collab turns every teammate's Bob into one team. Shared locks, a queue, and a PM who approves before anything risky lands."

Value claim lands in beat 2. Copy is the site's own hero line and sub-line. Collision physics, not a fade.

## Frame 3 — Sizzle (18–30, ~12s)

- scene: Cursorless camera flight across the real site screenshots (hero, Mission Control, near-miss card, primitives) with three slam words "Visible." "Locked." "Human-approved."
- duration: 12s
- blueprint: camera-journey
- transition_in: whip
- status: animated
- src: compositions/frames/03-sizzle.html
- voiceover: "Every Bob is visible. Every file has one owner. And every decision goes past a human."

Motion-designer showcase: tilted 3D planes of the captured site, motion-blur legs, one slam word per leg (the site's own three pillars). Ends pushing into black.

## Frame 4 — Slow down (30–34, ~4s)

- scene: Breather title — "Let's slow it down." then "One brief. Two coders. One near-miss."
- duration: 4s
- blueprint: titlecard-reveal
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-slowdown.html
- voiceover: "Let's watch it happen, step by step."

The gear change. Near-still; one slide-up crossfade.

## Frame 5 — The brief (34–58, ~24s)

- scene: Tight on Aarief's Bob IDE. Mode dropdown punches in, "Live Collab PM Lead" selected; brief.pdf chip attaches; prompt types; submit
- duration: 24s
- blueprint: prompt-type-submit-generate
- transition_in: zoom-in
- status: animated
- src: compositions/frames/05-brief.html
- voiceover: "It starts with the PM. Aarief has the client brief, and right now, only Aarief knows the project. Aarief switches Bob IDE to our custom mode, PM Lead. In this mode, Bob can read and plan, but it can't touch the code. Then Aarief asks Bob to split the brief for Alief and Umar."

Camera punch-ins follow the VO: dropdown on "custom mode", status bar `mode: pm-lead (read + mcp only)` on "can't touch the code", prompt box on "asks Bob".

## Frame 6 — The plan (58–76, ~18s)

- scene: Bob works — `mcp · radar.team_status` then `mcp · radar.propose_plan` with loaders; plan card cascades T1 (Alief: checkout.ts, promo.ts) and T2 (Umar: Header.tsx, cartBadge.ts); cursor clicks Approve; "✓ Approved by Aarief"
- duration: 18s
- blueprint: agent-progress-theater
- transition_in: continuous
- status: animated
- src: compositions/frames/05-demo.html
- voiceover: "Bob checks who's online and proposes a plan through our MCP server, radar-mcp. Every task gets an owner, and every file belongs to exactly one person. Nothing moves until a human approves."

Receipt cascade; file rows get owner-coloured lock chips as the plan lands. Press-spring on Approve, SFX click.

## Frame 7 — Zoom out (76–86, ~10s)

- scene: One continuous decelerating pull-back from Aarief's window to the three-window workspace; T1 and T2 cards fly on arcs into Alief's and Umar's Bob IDE
- duration: 10s
- blueprint: zoom-out-workspace-reveal
- transition_in: continuous
- status: animated
- src: compositions/frames/05-demo.html
- voiceover: "Now zoom out. Each task lands in that coder's own Bob IDE, with their own account and their own context."

The zoom-out is the engine. Windows labelled with owner dot + name + mode.

## Frame 8 — Build (86–112, ~26s)

- scene: Camera stations: Alief's window (SessionStart brief card, my_tasks, checkout.ts types live with "Alief · Bob coder writing" pill) → Umar's window (same, Header.tsx) → wide with both typing
- duration: 26s
- blueprint: spatial-pan-stations
- transition_in: continuous
- status: animated
- src: compositions/frames/05-demo.html
- voiceover: "Alief and Umar switch to Coder mode. The moment a session starts, a hook hands each Bob a short brief: your task, your files, and who owns the rest. Bob pulls the task through MCP and gets to work, and every edit is checked against the lock before it's written."

## Frame 9 — Near-miss (112–148, ~36s)

- scene: Umar's prompt asks to change calculateTotal() in checkout.ts → apply_diff → punch-in: red "hook · PreToolUse · lock_guard → blocked" (flash, shake, HOLD) → rules card → radar.why_blocked → Bob explains → radar.request_file → camera swoops to Aarief's "Needs you" toast → click "Queue after T1"
- duration: 36s
- blueprint: camera-journey
- transition_in: continuous
- status: animated
- src: compositions/frames/05-demo.html
- voiceover: "Then it happens. Umar asks Bob to change calculateTotal, in checkout.ts. But that's Alief's file. Before the edit lands, our PreToolUse hook blocks it. Now the rules kick in: Bob doesn't retry, and it doesn't sneak around the lock through the shell. It calls why_blocked, explains who holds the file, and asks the PM for access. Aarief decides. No conflict. No broken build."

Callback to F01: same file, same two coders, opposite outcome. Held frame on the block. SFX: error thud, then soft confirm on Queue.

## Frame 10 — Built on Bob (148–161, ~13s)

- scene: Four cards assemble — Custom modes (pm-lead / coder), Hooks (5 names), MCP (radar-mcp tools), Rules (✗ retry ✗ shell ✓ why_blocked) — then collapse into a `.bob/` folder icon
- duration: 13s
- blueprint: grid-card-assemble
- transition_in: whip
- status: animated
- src: compositions/frames/10-primitives.html
- voiceover: "All of this runs on Bob's own features. Custom modes set the roles. Hooks enforce the locks. MCP lets Bob explain itself. Rules tell Bob what to do when it's blocked. And we built it all with Bob."

## Frame 11 — CTA (161–170, ~9s)

- scene: bob-crew mascot + "IBM Bob Live Collab" lockup builds; "ibm-bob-live-collab.pages.dev" types in; "Watch the live replay" pill; team names Aarief · Alief · Umar · Imelda; "Community hackathon project · not an official IBM product"
- duration: 9s
- blueprint: logo-assemble-lockup
- transition_in: crossfade
- status: animated
- src: compositions/frames/11-cta.html
- voiceover: "IBM Bob Live Collab. Every Bob, on the same page. Watch the live replay at the link below."

Held to the final frame.
