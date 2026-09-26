// Fase 10 (lane Core): test for scripts/sim-3pc.ts (runs the full story locally).
// Full PRD §15 path with 1 write per side: plan → live → block → layer-2 →
// decision → review → local commit → export. `pnpm -C radar sim` runs 5 writes ×3.
import { describe, expect, it } from 'vitest';
import { runSim } from './sim-3pc.js';

describe('sim-3pc (fase 10)', () => {
  it('runs plan → review with zero dual-writer violations', async () => {
    await expect(runSim({ server: 'local', until: 'review', writes: 1 })).resolves.toBe(0);
  }, 180_000);
});
