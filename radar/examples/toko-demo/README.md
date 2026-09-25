# Toko Demo

A **synthetic demo repository** for IBM Bob Live Collab experiments.

This repo contains no real products, users, or business data. All 8 products and
prices are entirely fictional and exist only to provide a realistic-looking
React + TypeScript codebase for the IBM Bob Live Collab collaboration experiments
described in PRD §15 and §17.

## Purpose

`toko-demo` is the shared workspace used by experiment participants. Multiple agents
or developers work on the same files simultaneously so that IBM Bob Live Collab can
detect and surface cross-file conflicts in real time.

Key "touch-point" files that most experiment tasks converge on:

| File | Why it's a touch-point |
|------|------------------------|
| `src/checkout/checkout.ts` | Central total calculation — tasks 1, 3, 6 modify it |
| `src/utils.ts` | Shared helpers — tasks 2, 4, 6 add/change functions |
| `src/routes.ts` | Route map — tasks 1, 5 add new routes |
| `src/ui/Header.tsx` | Renders totals — tasks 2, 3, 4 require changes here |

## Running locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build
npm run typecheck  # type-check only
```

## Stack

- **Vite** + **React 18** + **TypeScript 5** (strict)
- No external UI libraries; plain CSS variables in `src/ui/theme.css`
- Synthetic data in `src/data/products.json` (8 fictional products, prices in IDR)

## Experiment tasks

See [`EXPERIMENT_TASKS.md`](./EXPERIMENT_TASKS.md) for the 6 tasks used in the
IBM Bob Live Collab collaboration experiments.
