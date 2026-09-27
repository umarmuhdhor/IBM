# fase-11D2 brand — Live Collab logo on the web (lane web, Imelda)

## Change
- Nav wordmark icon: `/brand/bob-crew.png` → `/brand/logo/live-collab-mark-white.svg` (`radar/packages/web/src/landing-nav.tsx:32`).
- Halftone behind the demo card regenerated from the new mark: `public/brand/live-collab-halftone.svg` (`scripts/halftone-logo.py`), wired in `app/globals.css`.
- Favicon `app/icon.svg` = new mark. Unused `bob-crew.png` / `bob-crew-halftone.svg` removed from `public/brand`.
- Brand kit lives in `public/brand/logo/` (SVG marks, lockups, PNGs, `.icns`).

## UI gate (better-interface, scoped to the changed elements)
Checked at http://localhost:3100 (`next dev`), 1440×900 and 375×812.

| Severity | Finding | Location | Status |
|---|---|---|---|
| — | No findings. Nav `<img alt="">` is decorative; the link keeps its accessible name from the visible title. White mark on the dark nav reads at 28px at both widths. Halftone is decorative (`pointer-events: none`, opacity 0.16, masked), sits behind the card, no text clipped. | `src/landing-nav.tsx:32`, `app/globals.css:277-291` | Clear |

Not reviewed: domains outside these two elements (no other UI changed). `.lp-halftone` (hero) is defined in CSS but not rendered by the page.
