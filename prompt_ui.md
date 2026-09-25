# Prompt gambar UI — IBM Bob Live Collab

> Dipakai untuk men-generate mockup (Midjourney v7, GPT-image, Ideogram, Nano Banana, dll). Tujuannya supaya semua orang melihat tampilan yang sama sebelum membangun.
> Sumber kebenaran desain: [`DESIGN.md`](DESIGN.md). Kalau hasil gambar bertentangan dengan DESIGN.md, yang dipakai DESIGN.md.
> Setelah generate, simpan ke `UI Design/bob radar/<nomor>-<nama>.png` lalu kirim ke Claude untuk dicek.

---

## Cara pakai

1. Tempel **Blok gaya global** lalu **satu** prompt layar di bawahnya, dalam satu pesan.
2. Rasio: 16:10 untuk layar app (`--ar 16:10`), 16:9 untuk cover dan replay (`--ar 16:9`).
3. Model yang kuat merender teks (GPT-image, Ideogram) lebih cocok untuk layar yang penuh label. Midjourney cocok untuk cover dan ikon.
4. Kalau teks di gambar kacau, minta ulang dengan tambahan: *"render all UI text crisply and legibly, exact spelling"*.

---

## Blok gaya global (selalu disertakan)

```text
High-fidelity desktop app UI screenshot, macOS window with traffic-light buttons, dark theme.
Style: clean professional developer tool in the spirit of Amoeba and Linear, calm and minimal,
lots of near-black negative space, 1px hairline borders, no drop shadows, no gradients, no glassmorphism.
Colors: app background #0E0E10, panels #161616, cards #1E1E20, borders #2A2A2D, primary text #F4F4F4,
muted text #A8A8A8. Primary button IBM blue #0F62FE. Status colors only: green #42BE65, yellow #F1C21B,
red #FA4D56. "Needs you" accent magenta #FF7EB6 used as a thin left border.
Person colors used ONLY for initials chips, agent tags and outlines: Andi = blue #78A9FF,
Budi = purple #BE95FF, Citra = orange #FF832B.
Typography: IBM Plex Sans for UI, IBM Plex Mono for code, file paths, terminal and small meta text.
Agent tags are small rounded monospace pills like "Andi · Bob coder" with a 18% tint of the person color.
Icons: thin lucide-style line icons. Crisp legible text, exact spelling, pixel-perfect alignment, 4px grid.
No IBM logo, no real company logos. Product name is "IBM Bob Live Collab".
```

**Negative / hindari:** `neon glow, cyberpunk, 3D, isometric, gradient mesh, emoji clutter, lorem ipsum, misspelled text, light mode, heavy shadows, rounded bubbly cartoon UI, IBM logo`

---

## 01 · Home — Workspaces

```text
Screen: "Workspaces" home of the IBM Bob Live Collab desktop app.
Left sidebar (240px, #161616): items "Workspaces" (selected), "People"; a section header "LIVE COLLAB" with items
"Mission Control" (small magenta badge "1"), "Team", "Files & locks"; below a section "Projects" with two
muted folder rows; bottom-left user row with round avatar "A" and label "Aarief · signed in" and a gear icon.
Main area title "Workspaces" top-left, top-right controls: dropdown "Last active", search icon button,
white button "+ New".
Two cards in a grid (#1E1E20, 1px border, radius 10):
Card 1 title "toko-demo", subtitle "Coupon + dark mode", a status row with magenta left border
"⚠ Needs you · 1 near-miss", a row "◐ IBM Bob · coder ×2 · pm-lead", bottom: three overlapping initials
chips A (blue) B (purple) C (orange) and right-aligned muted text "live · 3/3".
Card 2 title "live-collab (dogfood)", subtitle "Building Live Collab with Live Collab", status "○ Working · 2 Bobs",
chips A and C, muted "idle 4m".
Bottom status bar: "● Live Collab · 3 online · 1 needs you".
```

## 02 · Workspace — tampilan coder (Budi diblokir)

```text
Screen: coder workspace in Live Collab, 4 regions.
Left: narrow icon rail + file EXPLORER tree in monospace: "src/", "checkout/", "checkout.ts" with a small pencil
glyph and an outlined blue chip "A", "coupon.ts" blue outlined chip "A", "ui/", "theme.css" solid purple chip "B",
"Header.tsx" purple chip "B", "routes.ts" blue chip "A" plus tiny grey chip "queue: B", "utils.ts" muted text "free".
Center top: code editor tab "checkout.ts" showing TypeScript lines 12–16 of a function "calculateTotal(items, shipping = 0)",
line 14 highlighted faintly blue with a floating monospace pill "Andi · Bob coder" at the end of the line
(shows a teammate's AI just wrote it).
Center bottom: Bob activity panel (from IBM Bob IDE hooks) showing the latest lines. Terminal content in IBM Plex Mono:
"> make the header toggle dark mode, also update checkout.ts"
dim line with anchor icon: "hook · PreToolUse · lock_guard → blocked · 84 ms" (text slightly red)
dim line: "mcp · radar.why_blocked"
"Bob: checkout.ts is held by Andi's Bob for T-1 (coupon). I'll continue with Header.tsx first."
dim line: "hook · UserPromptSubmit · team brief ━━━━╸ 4/6 lines"
Input box at the bottom with thin magenta border, placeholder "Ask your Bob…", left pill "IBM Bob ▾", right pill "coder".
Right panel "TEAM": rows for "Citra · PM" (orange avatar, "◐ pm-lead · idle"), "Andi" (blue, "◐ coder · writing ✎",
"T-1 Coupon · 3 files", small button "Watch terminal"), "Budi (you)" (purple, "◐ coder · blocked" in red).
Below "NOTIFICATIONS": red row "⛔ checkout.ts held by Andi (T-1)", green row "✓ Plan approved by Citra".
```

## 03 · Mission Control — tampilan PM

```text
Screen: "Mission Control · toko-demo" inside IBM Bob Live Collab, wide 3-column layout.
Top bar: title left, center "● live · 3/3 online", three initials chips A B C, right small monospace text
"Bobcoin A 31 · B 28 · C 22".
Column 1 "TASKS": mini kanban with sub-columns "Working", "Review", "Done". Cards: "T-1 Coupon" (blue chip A,
"3 files · 14 edits"), "T-2 Dark mode" (purple chip B, "2 files"), in Review "T-0 Shipping" (chip A, badge "waiting PM"),
in Done "T-00 Schema" (chip B, commit hash "3f9a2c1"). Bottom ghost button "Ask pm-lead to plan…".
Column 2 "FILES & LOCKS": monospace tree with lock chips as in the coder screen, a legend line
"✎ writing · ○ reserved · ● held · ⏱ review".
Column 3 "NEEDS YOU (2)": two cards with thin magenta left border.
Card 1: "[blocked] Budi needs checkout.ts", muted "held by Andi · T-1 Coupon", a row with half-circle icon
"pm-lead suggests: QUEUE Budi after T-1; continue Header.tsx meanwhile.", buttons "Approve" (IBM blue) and "Deny" (outline),
tiny caption "suggested by pm-lead · needs a human".
Card 2: "[review] T-0 Shipping · +12 −3 · 2 files", yellow warning line "calculateTotal() signature changed; used by Header.tsx (Budi)",
buttons "Approve & commit" and "Send back".
Below: "LIVE" feed with timestamps "21:06 ● Andi's Bob edited checkout.ts", "21:06 ● Budi's Bob blocked · PreToolUse",
"21:05 ● Budi's Bob edited theme.css", "21:03 ● Andi submitted T-0 for review" — colored dots per person.
```

## 04 · Momen near-miss (close-up untuk video/thumbnail)

```text
Close-up composition, two panels side by side on a dark dotted halftone background.
Left panel: a terminal with purple 1px border, header "Budi's Bob · coder". Lines:
"hook · PreToolUse · lock_guard → blocked · 84 ms" in red,
"Bob: checkout.ts is held by Andi's Bob (T-1 Coupon). Switching to Header.tsx."
Right panel: a single decision card with magenta left border: "[blocked] Budi needs checkout.ts",
"pm-lead suggests: QUEUE after T-1", a big IBM-blue "Approve" button with a cursor hovering over it, and an outline "Deny".
Between the panels a thin line connecting the red terminal line to the card. Calm, premium, cinematic but flat.
```

## 05 · Tonton Bob rekan (timeline aktivitas Bob IDE)

```text
Screen: a tab titled "Watching Andi's Bob · Bob IDE · coder · live" inside IBM Bob Live Collab.
A vertical live timeline card with 1px blue (#78A9FF) border, small blue "A" chip in the header, right button "Stop watching".
Rows in IBM Plex Mono with time, icon and text:
"21:04  prompt   \"add coupon discount to checkout\""
"21:04  mode coder · hook · SessionStart · team brief 5/6 lines"
"21:05  read     src/checkout/checkout.ts"
"21:05  write    src/checkout/coupon.ts  +18   hook · PreToolUse → allowed · 61 ms" (green-dim trace)
"21:06  edit     src/checkout/checkout.ts  +8 −2"
"21:06  turn end \"Coupon done, moving to tests\""
Footer: "prompts shared by Andi · 2 watching" with chips B and C. Left sidebar with "Team" selected.
```

## 06 · (dihapus: ketik tamu di terminal jadi P2)

## 07 · Review card detail

```text
Modal/drawer on the right (520px) titled "Review · T-0 Shipping". Sections:
"Diff" with a compact unified diff of checkout.ts (green/red line backgrounds, IBM Plex Mono).
"Impact" with a yellow icon: "calculateTotal() now takes shipping; called in src/ui/Header.tsx (owned by Budi)".
"pm-lead verdict": "Approve and notify Budi" with a half-circle mode icon and a trace line
"mcp · radar.get_task_diff → radar.propose_review".
Footer buttons: IBM-blue "Approve & commit", outline "Send back".
After-state toast bottom-right: "✓ 3f9a2c1 · T-0 Shipping · co-authored by IBM Bob".
```

## 08 · Replay web untuk juri

```text
Web page, 16:9, dark dotted halftone background. Header: "IBM Bob Live Collab — session replay", badge "no login · no API key",
links "Repo", "bob_sessions", "Video", "Deck".
Top counters in large monospace numbers: "3 near-misses prevented", "0 merge conflicts", "4 decisions", "38 s median decision".
Three columns: "Andi · Bob IDE" (blue header, activity timeline), "Mission Control · Citra" (orange header,
compact board + decision card), "Budi · Bob Shell in Live Collab" (purple header, mini terminal replay with a red blocked line).
Right side panel "Bob inside" showing for the selected event: "hook PreToolUse · lock_guard", a small JSON payload excerpt,
"mcp radar.why_blocked", "mode coder", and a quote bubble from Bob with a link "bob_sessions/budi/03-blocked.md".
Bottom: timeline scrubber with chapter markers "Plan · Live · Near-miss · Review · Commit", speed buttons "1× 2× 4×", play button.
```

## 09 · Onboarding / join

```text
Centered onboarding card (560px) in the IBM Bob Live Collab app on a dark dotted background. Title "Join a Live Collab workspace".
Step 1 input "Paste invite code" with value "rdr_inv_••••••••", Step 2 "Folder: ~/code/toko-demo".
Checklist with green checks in monospace: "Bob CLI found (bob 2.x)", "IBM Bob kit installed · mode coder",
"4 hooks registered", "radar-mcp reachable", "Synced 42 files", "You are Budi · coder" (purple chip B).
Primary button "Open workspace" (IBM blue).
```

## 10 · Cover 16:9 / slide pertama

```text
16:9 presentation cover. Near-black background with a subtle dotted halftone pattern fading from the right.
Left: large title "IBM Bob Live Collab" in IBM Plex Sans semibold, subtitle "Multiplayer IBM Bob. Every teammate's Bob, one live workspace."
Below three monospace agent pills: "Andi · Bob coder" (blue), "Budi · Bob coder" (purple), "Citra · Bob pm-lead" (orange).
Right: the Mission Control screenshot slightly angled (5 degrees), with the magenta "Needs you" decision card
"[blocked] Budi needs checkout.ts — Approve" standing out. Minimal, premium, lots of breathing room. Small footer text
"Built on IBM Bob · hooks · custom modes · MCP".
```

## 12 · Landing web (Application URL), gaya warm paper

> Prompt ini **tidak** memakai blok gaya global (yang gelap). Landing sengaja terang (DESIGN.md §5.11).

```text
Web landing page, 16:10, LIGHT theme in a "warm paper notebook" style. Page canvas warm off-white #f6f5f4,
white cards with 1px hairline border rgba(0,0,0,0.08), 12px radius, no shadows on cards, flat colors, no gradients.
Sticky top bar: text wordmark "IBM Bob Live Collab" left, muted links "Repo  bob_sessions  Video  Deck",
small blue button "Watch replay" right.
Centered hero: huge Inter headline 72px, tight negative letter-spacing, black:
"Your team's Bobs, working together." with the word "working" wrapped in a soft peach pill (#f6d5b8, fully rounded).
Serif subhead (Source Serif) in warm gray #615d59: "Multiplayer for IBM Bob. Every teammate's own Bob, one live workspace."
Button row: filled blue #0075de "Watch the live replay" and ghost button (bg #e6f3fe, blue text) "Download for macOS"
with tiny caption "unsigned · open via Privacy & Security".
Below: a large DARK product screenshot of a developer app (Mission Control with a magenta "Needs you" card)
sitting on the light canvas with a soft shadow 0 4px 12px rgba(0,0,0,.1).
Next row: three white feature cards: "Live sync", "One file, one Bob", "PM agent proposes, human approves".
Then a marigold #ffb110 full-width card with a terminal snippet "hook · PreToolUse · lock_guard → blocked".
Then a deep navy #02093a card with white text "Built on IBM Bob primitives: custom modes · hooks · MCP".
Footer small text: "Community hackathon project, not an official IBM product · built on Orca (MIT)".
Calm, editorial, generous whitespace, crisp legible text, exact spelling. No logos of real companies, no illustrated mascots.
```

## 11 · Ikon app

```text
macOS app icon, 1024x1024, rounded square (Big Sur style). Dark charcoal background #161616.
A minimal radar: three thin concentric circles in muted grey and one sweep wedge in IBM blue #0F62FE,
with three small dots in blue #78A9FF, purple #BE95FF, orange #FF832B on the rings. A bold geometric "B" glyph subtly integrated
at the center. Flat, crisp vector, no text, no IBM logo.
```

---

## Checklist setelah generate

- [ ] Warna orang konsisten (Andi biru, Budi ungu, Citra oranye) di semua gambar.
- [ ] Setiap layar punya minimal satu jejak primitif Bob (`hook · …`, `mcp · …`, mode `coder`/`pm-lead`).
- [ ] Tidak ada logo IBM atau logo perusahaan nyata.
- [ ] Teks terbaca dan ejaannya benar.
- [ ] Kirim hasil ke Claude untuk dicocokkan dengan `DESIGN.md` sebelum Lane Aarief/Imelda mulai fase 09c.
