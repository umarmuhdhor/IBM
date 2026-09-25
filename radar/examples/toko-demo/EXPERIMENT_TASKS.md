# Experiment Tasks — IBM Bob Live Collab (PRD §17)

These 6 tasks are intentionally designed so that multiple participants touch the
same files at the same time. IBM Bob Live Collab must detect and surface the
resulting cross-file conflicts in real time.

---

## Task 1 — Discount Coupon

**Story:** Add a coupon-code input to the checkout page and apply a percentage
discount when a valid code is entered.

**Files touched:**
- `src/checkout/coupon.ts` — implement real coupon logic (replace stub)
- `src/checkout/checkout.ts` — pass coupon code through `calculateTotal`
- `src/routes.ts` — add `/coupon` route for the coupon management page

**Conflict potential with:** Task 3 (both modify `checkout.ts`), Task 6 (both
modify `checkout.ts`).

---

## Task 2 — Dark Mode

**Story:** Add a dark-mode toggle to the header. The app should switch between
light and dark themes when the user clicks the toggle.

**Files touched:**
- `src/ui/theme.css` — add `[data-theme="dark"]` variable overrides
- `src/ui/Header.tsx` — add toggle button, apply `data-theme` to `<body>`
- `src/utils.ts` — add helper `prefersDark(): boolean` (reads `prefers-color-scheme`)

**Conflict potential with:** Task 4 (both modify `Header.tsx` and `utils.ts`).

---

## Task 3 — Shipping Cost

**Story:** Add a shipping-cost field to the checkout summary. Different shipping
tiers (regular, express, same-day) add a fixed fee to the order total.

**Files touched:**
- `src/checkout/checkout.ts` — extend signature to `calculateTotal(items, shipping?)`
- `src/ui/Header.tsx` — reflect new total including shipping

**Conflict potential with:** Task 1 (both modify `checkout.ts`), Task 6 (both
modify `checkout.ts`), Task 4 (both modify `Header.tsx`).

---

## Task 4 — International Price Formatting

**Story:** Allow the price formatter to accept a locale parameter so the app can
display prices in different formats (e.g. `en-US`, `id-ID`, `ja-JP`).

**Files touched:**
- `src/utils.ts` — add `formatPrice(amount, locale)` alongside `formatRupiah`
- `src/ui/Header.tsx` — use `formatPrice` instead of `formatRupiah`
- `src/cart/cart.ts` — propagate locale preference through cart items if needed

**Conflict potential with:** Task 2 (both modify `utils.ts` and `Header.tsx`).

---

## Task 5 — Order History Page

**Story:** Add an order-history page that lists past (mock) orders with their
totals and dates.

**Files touched:**
- `src/routes.ts` — add `/orders` route
- `src/orders/orders.ts` *(new file)* — `Order` type, mock data, `listOrders()`

**Conflict potential with:** Task 1 (both modify `routes.ts`).

---

## Task 6 — Item Quantity Limit

**Story:** Enforce a maximum quantity of 5 per product in the cart. The checkout
page must validate and reject carts that violate this rule.

**Files touched:**
- `src/cart/cart.ts` — lower `MAX_QUANTITY` constant to 5
- `src/utils.ts` — ensure `clamp` is used correctly for the new limit
- `src/checkout/checkout.ts` — add validation that throws if any item exceeds the limit

**Conflict potential with:** Task 1 (both modify `checkout.ts`), Task 3 (both
modify `checkout.ts`), Task 2 (both modify `utils.ts`).
