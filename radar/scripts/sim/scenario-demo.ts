// Fase 10 (lane Core): shared scenario data for scripts/sim-3pc.ts.
// Seed files, plan payload, metric computation, and export normalisation.
// No secrets here; tokens always come from the environment or /admin/init.
export const CHECKOUT = 'src/checkout/checkout.ts';
export const COUPON = 'src/checkout/coupon.ts';
export const THEME = 'src/ui/theme.css';
export const HEADER = 'src/ui/Header.tsx';
export const ROUTES = 'src/routes.ts';
export const UTILS = 'src/utils.ts';

export const SEED_FILES: { path: string; content: string }[] = [
  {
    path: CHECKOUT,
    content:
      "export function calculateTotal(items: { price: number }[]): number {\n" +
      '  return items.reduce((sum, item) => sum + item.price, 0);\n' +
      '}\n',
  },
  {
    path: HEADER,
    content:
      "import { calculateTotal } from '../checkout/checkout';\n" +
      '\n' +
      'export function Header({ items }: { items: { price: number }[] }): string {\n' +
      '  return `<header>Total: ${calculateTotal(items)}</header>`;\n' +
      '}\n',
  },
  {
    path: COUPON,
    content: 'export function applyCoupon(total: number, code: string): number {\n  return code === "HEMAT10" ? total * 0.9 : total;\n}\n',
  },
  { path: THEME, content: ':root {\n  --bg: #ffffff;\n  --fg: #111111;\n}\n' },
  { path: ROUTES, content: "export const routes = ['/', '/checkout', '/settings'] as const;\n" },
  { path: UTILS, content: 'export function formatIdr(n: number): string {\n  return `Rp${n}`;\n}\n' },
];

export const PLAN_BODY = {
  kind: 'plan',
  reason: 'Dua fitur paralel: kupon dan dark mode',
  payload: {
    goal: 'Tambah fitur kupon diskon (total dihitung di src/checkout/checkout.ts) dan dark mode',
    tasks: [
      { ref: 'kupon', title: 'Kupon', ownerId: 'A', files: [CHECKOUT, COUPON, ROUTES] },
      { ref: 'dark', title: 'Dark mode', ownerId: 'B', files: [THEME, HEADER], queuedFiles: [ROUTES] },
    ],
  },
} as const;

/** Every file.changed event must come from the scripted holder of that path. */
export const EXPECTED_WRITER: Record<string, string> = {
  [CHECKOUT]: 'A',
  [COUPON]: 'A',
  [ROUTES]: 'A',
  [THEME]: 'B',
  [HEADER]: 'B',
  [UTILS]: 'B',
};

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i] as number;
}

export interface SimEvent {
  id: number;
  type: string;
  ts: number;
  actor?: string | null;
  by?: string | null;
  payload?: Record<string, unknown>;
}

export interface SimMetrics {
  lockCheckP95Ms: number;
  lockCheckCount: number;
  syncP95Ms: number;
  syncCount: number;
  dualWriterViolations: number;
  reviewsFlagged: number;
  blockToDecisionMs: number | null;
}

export function computeMetrics(events: SimEvent[], lockCheckMs: number[], syncMs: number[], blockToDecisionMs: number | null): SimMetrics {
  let dualWriterViolations = 0;
  for (const e of events) {
    if (e.type !== 'file.changed') continue;
    const p = (e.payload as { path?: unknown } | undefined)?.path;
    const expected = typeof p === 'string' ? EXPECTED_WRITER[p] : undefined;
    const writer = e.actor ?? e.by ?? (e.payload as { by?: string } | undefined)?.by;
    if (expected !== undefined && writer !== expected) dualWriterViolations += 1;
  }
  let reviewsFlagged = 0;
  for (const e of events) {
    if (e.type !== 'review.created') continue;
    const verdict = (e.payload as { verdict?: string } | undefined)?.verdict;
    if (verdict === 'setujui_beri_tahu' || verdict === 'kembalikan') reviewsFlagged += 1;
  }
  const lc = [...lockCheckMs].sort((a, b) => a - b);
  const sy = [...syncMs].sort((a, b) => a - b);
  return {
    lockCheckP95Ms: percentile(lc, 95),
    lockCheckCount: lc.length,
    syncP95Ms: percentile(sy, 95),
    syncCount: sy.length,
    dualWriterViolations,
    reviewsFlagged,
    blockToDecisionMs,
  };
}

/** Fixed timeline so the committed replay fixture is stable across runs. */
export const FIXTURE_T0 = 1_790_000_000_000;
export const FIXTURE_STEP_MS = 1_500;

export function normalizeExport(exp: { events: SimEvent[]; exportedAt?: number }): { exportedAt: number; events: SimEvent[] } {
  return {
    exportedAt: FIXTURE_T0 + exp.events.length * FIXTURE_STEP_MS,
    events: exp.events.map((e, i) => ({ ...e, ts: FIXTURE_T0 + i * FIXTURE_STEP_MS })),
  };
}
