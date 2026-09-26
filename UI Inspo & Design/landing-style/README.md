# Landing page style — Carbon dark (app-aligned)

Landing `/` (`radar/packages/web/app/page.tsx`) uses the same dark Carbon tokens as app + replay (`--lc-*` in `radar/packages/ui/src/theme-vars.css`). Atmosphere may echo Amoeba (black, quiet type, 12px halftone dots). Do not copy Amoeba or Notion brand: no logos, names, character marks, or proprietary fonts.

Warm-paper Notion tokens (`#f6f5f4`, `#0075de`) are retired. See DESIGN.md §5.11 and `plan/log/DECISIONS.md` D-imelda-09.

## Tokens we take
| Token | Value | Use |
|---|---|---|
| canvas | `#0E0E10` / `--lc-bg` | page background |
| surface | `#1E1E20` / `--lc-surface-2` | cards, install panel |
| border | `#2A2A2D` / `--lc-border` | 1px hairline on cards, no shadows |
| text | `#F4F4F4` / `--lc-text` | headings |
| muted | `#A8A8A8` / `--lc-text-muted` | body, nav |
| faint | `#6F6F6F` / `--lc-text-faint` | captions, footer |
| primary | `#0F62FE` / `--lc-accent` | the ONE filled CTA ("Watch the live replay") |
| ghost | bg `rgba(15,98,254,.16)`, text `#A6C8FF` | secondary CTA ("Download for macOS") |
| accents | `#ffb110` marigold, `#02093a` navy | near-miss block, primitives panel |
| fonts | **Inter** (landing UI), **Source Serif 4** (subhead only) | replay stays IBM Plex |
| display type | 72px/1.21, letter-spacing -2px (desktop); 48px on mobile | |
| radius | cards 12px, buttons 8px, pills 9999px | |
| spacing | 4px grid, section gap 80px, card padding 24px | |
| motion | 200ms ease on hover; spring only for hero accents | |

## Page recipe
1. Sticky top bar 64px: wordmark "IBM Bob Live Collab" (text only), links Repo · bob_sessions · Video · Deck, primary CTA right.
2. Hero (centered): headline with one **highlight pill** around a verb, e.g. "Your team's Bobs, **working** together." (pill bg `#ffb110`). Serif subhead in `--lc-text-muted`. CTA row: primary + ghost.
3. **Product window** (HTML, not empty dashed box): Mission Control / `BobTrace` frame. Andi writing `checkout.ts`, Budi `hook · PreToolUse → blocked`, Citra Needs you. Person colors `--lc-member-a/b/c`. Tabs Andi · Mission Control · Budi (or chapters Plan · Live · Near-miss). Click swaps the pane. Button **Watch full replay** → `/demo/`.
4. Four mechanism lines under the window (facts, not slogans): one file one Bob (`lock_guard`) · near-miss (`PreToolUse` + `radar.why_blocked`) · PM proposes, human Approve · each person has their own Bob, radar syncs.
5. Three words: **Visible · Locked · Human-approved** — one sentence each.
6. Accent block (marigold `#ffb110`): near-miss GIF when it exists; keep the dashed placeholder until fase 10 recording. Caption `hook · PreToolUse → blocked`.
7. Dark island (`#02093a`): "Built on IBM Bob primitives" with one line each for `coder` / `pm-lead`, 5 hooks, `radar-mcp`, plus `bob_sessions/` link.
8. Footer: install steps (3 lines), license/attribution, "not an official IBM product".

The old three abstract feature cards (Live sync / One file / PM proposes) are replaced by steps 3–5. Do not keep both.

## Build order (so the diff stays readable)

Kerjakan di `radar/packages/web/app/page.tsx` berurutan. Satu langkah = satu commit kalau perlu, atau satu PR dengan section comments `// 18a-1` … `// 18a-4`.

| # | Tambah | Kenapa hidup |
|---|---|---|
| 1 | Jendela produk HTML + chip Andi/Budi/Citra | Produk kelihatan di fold, bukan poster |
| 2 | Tab/chapter klik di window + CTA ke `/demo/` | Halaman bisa disentuh |
| 3 | Pulse titik Andi 3s, kartu Needs you `translateY(4px)` 180ms; hormati `prefers-reduced-motion` | Ada yang kerja |
| 4 | Empat mekanisme + tiga kata + 1 baris per primitif Bob | Juri paham tanpa buka replay dulu |

Angka di UI hanya dari `public/demo/meta.json` (`nearMisses`, `decisions`, `mergeConflicts`). Jangan karang.

**Jangan:** logo palsu (Google/Replit), blog, Discord wall, confetti, glow ungu, jiplak copy/logo Amoeba.

Do: flat fills, hairline borders, one IBM Blue button per view, Carbon tokens. Don't: gradients, glow orbs, card shadows, Notion blue `#0075de`, warm paper canvas.
