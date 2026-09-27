---
workflow: general-video
flow: companion
storyboard: yes
message: "Every teammate's Bob, working together — collisions blocked before they land."
destination: youtube
aspect: 1920x1080
language: en
audience: IBM Bob hackathon judges (lablab) and developers who code with IBM Bob
length: 170s
angle: kinetic product intro, then a slow step-by-step Bob IDE demo
voice: elevenlabs Matilda (XrExE9yKIg1WjnnlVkGX) · eleven_multilingual_v2 · clause-aligned to the cut
---

## Intent

Hackathon submission video for IBM Bob Live Collab (community project, not an official IBM product).
Opens fast and punchy — "shows what an incredible motion designer you are" — with content focused on
https://ibm-bob-live-collab.pages.dev (headline, near-miss, the Bob primitives). Then slows down:
a step-by-step demo explained with zoom in / zoom out across three reconstructed Bob IDE windows —
PM Aarief (mode pm-lead), coders Alief and Umar (mode coder). Story: PM gets a brief → Bob splits it
into tasks by file → PM approves → zoom out, tasks land in each coder's Bob IDE → both build →
Umar's Bob reaches for Alief's checkout.ts → PreToolUse hook blocks it → rules + why_blocked →
request_file → PM decides. Close on the 4 Bob features (custom modes, hooks, MCP, rules) + CTA.
User's words: "terlalu statis dan ngebosenin… lebih dinamis di awal… demo nya bisa pelan2".

## Assets

- ../storyboard/index.html — first animatic (scene timing, Bob IDE layout, copy). Reuse its structure, not its static feel.
- ../vo/script.json — 9-scene narration draft (EN). Female voice, best ElevenLabs model.
- ../public/icon.png — project icon (3-robot mascot).
- Live site https://ibm-bob-live-collab.pages.dev — headline, feature copy, visual language.

## Customizations

- Reference feel: Threads post (prateekkeshari/dannystuart) — punchy, clean, polished product motion graphics.
- Voice-over: ElevenLabs, female, best model. Key in repo-root .env (gitignored). Placeholder VO until key valid.

## Notes

- Hackathon rules: MP4 ≤ 3:00, ≥ 90 s of the solution running on screen, narration, Bob IDE clearly the core tool.
- Style: dark Carbon (IBM Plex Sans/Mono, #0f62fe accent). Owner colors: Aarief #be95ff, Alief #33b1ff, Umar #08bdba.
- Never invent numbers. The site's stats (1 near-miss, 2.9 s …) come from the Andi/Budi session — do not attach them to Aarief/Alief/Umar.
- No IBM logo. Say "community hackathon project, not an official IBM product" in the close.
