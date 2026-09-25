# Landing page style — "warm paper notebook" (Notion-like)

Source: https://styles.refero.design/style/2bf4c61f-de10-4614-ba1b-20c0453bd2a9 (Refero style reference of notion.com, captured 2026-09-25).
Used ONLY as a style direction for the web landing page (`radar/packages/web/app/page.tsx`). The app and the replay stay dark (DESIGN.md §0).

Do not copy Notion's brand: no Notion logo, name, illustrated character marks, or proprietary fonts (NotionInter, Lyon Text). Use the substitutes below and our own content.

## Tokens we take
| Token | Value | Use |
|---|---|---|
| canvas | `#f6f5f4` | page background (warm off-white, never pure white) |
| surface | `#ffffff` | cards |
| border | `rgba(0,0,0,0.08)` | 1px hairline on cards, no shadows |
| text | `#000000` at 100/95/60/40% alpha | hierarchy by alpha |
| body warm gray | `#615d59` | paragraphs |
| primary | `#0075de` | the ONE filled CTA per screen ("Watch the live replay") |
| ghost | bg `#e6f3fe`, text `#0075de` | secondary CTA ("Download for macOS") |
| accents | `#ffb110` `#f64932` `#62aef0` `#02093a` | feature-card backgrounds, highlight pill |
| fonts | **Inter** (sub for NotionInter), **Source Serif 4** (sub for Lyon Text, subhead only) | |
| display type | 72px/1.21, letter-spacing -2px (desktop); 48px on mobile | |
| radius | cards 12px, buttons 8px, pills 9999px | |
| spacing | 4px grid, section gap 80px, card padding 24px | |
| motion | 200ms ease on hover; spring only for hero accents | |

## Page recipe
1. Sticky top bar 64px: wordmark "IBM Bob Live Collab" (text only), links Repo · bob_sessions · Video · Deck, primary CTA right.
2. Hero (centered): headline with one **highlight pill** around a verb, e.g. "Your team's Bobs, **working** together." (pill bg `#f6d5b8`). Serif subhead in `#615d59`. CTA row: primary + ghost. Below: large product screenshot (the dark Mission Control) with `0 4px 12px rgba(0,0,0,.1)`.
3. Three white feature cards: Live sync · One file, one Bob (hook-enforced) · PM agent proposes, human approves.
4. Accent block (marigold `#ffb110`): the near-miss moment GIF, with "hook · PreToolUse → blocked" caption.
5. Dark island (`#02093a`): "Built on IBM Bob primitives": custom modes, hooks, MCP, with the `bob_sessions/` evidence link.
6. Footer: install steps (3 lines), license/attribution, "not an official IBM product".

Do: flat fills, hairline borders, one blue button per view. Don't: gradients, shadows on cards, radius > 12px on rectangles, multiple filled button colors.

Full reference (all colors, type scale, component specs, Tailwind v4 `@theme` block): open the source URL at the top.
