// Fase 06 step 4: task diff + impact analysis (R3 §2.15). Pure helper tests plus one HTTP flow.
import { describe, expect, it } from 'vitest';
import { runInDurableObject } from 'cloudflare:test';
import { upsertTouch } from '../db/repo/touch';
import { writeFileVersion } from '../db/repo/file';
import { buildTaskDiff, extractExports, resolveImportSpec } from './diff';
import { call, freshWorkspace, hello, seedTestWorkspace, sha256Hex } from '../../test/helpers';
import { withLocks } from '../../test/lock-fixture';

const OLD_CHECKOUT = 'export interface Item { price: number; }\nexport function calculateTotal(items: Item[]) {\n  return items.reduce((s, i) => s + i.price, 0);\n}\n';
const NEW_CHECKOUT =
  'export interface Item { price: number; }\nexport function calculateTotal(items: Item[], shipping: number) {\n  return items.reduce((s, i) => s + i.price, 0) + shipping;\n}\n';

describe('extractExports', () => {
  it('reports a changed function signature', () => {
    expect(extractExports(OLD_CHECKOUT, NEW_CHECKOUT)).toEqual([
      { name: 'calculateTotal', kind: 'function', before: 'calculateTotal(items: Item[])', after: 'calculateTotal(items: Item[], shipping: number)' },
    ]);
  });

  it('reports added and removed exports', () => {
    expect(extractExports('export const a = 1;\n', 'export const a = 1;\nexport class Kupon {}\n')).toEqual([
      { name: 'Kupon', kind: 'class', before: '', after: 'class Kupon' },
    ]);
    expect(extractExports('export type T = number;\n', '')).toEqual([{ name: 'T', kind: 'type', before: 'type T', after: '' }]);
  });

  it('ignores unchanged exports and non-export code', () => {
    expect(extractExports(`${OLD_CHECKOUT}const x = calculateTotal([]);\n`, `${NEW_CHECKOUT}const x = calculateTotal([], 1);\n`)).toEqual([
      { name: 'calculateTotal', kind: 'function', before: 'calculateTotal(items: Item[])', after: 'calculateTotal(items: Item[], shipping: number)' },
    ]);
  });
});

describe('resolveImportSpec', () => {
  const files = new Set(['src/checkout/checkout.ts', 'src/ui/index.ts']);
  const exists = (p: string) => files.has(p);
  it('resolves relative specs with candidate extensions', () => {
    expect(resolveImportSpec('src/ui', '../checkout/checkout.ts', exists)).toBe('src/checkout/checkout.ts');
    expect(resolveImportSpec('src/ui', '../checkout/checkout', exists)).toBe('src/checkout/checkout.ts');
    expect(resolveImportSpec('src/ui', './index', exists)).toBe('src/ui/index.ts');
  });
  it('returns null for packages, aliases without a map, and misses', () => {
    expect(resolveImportSpec('src/ui', 'preact', exists)).toBeNull();
    expect(resolveImportSpec('src/ui', '@/x', exists)).toBeNull();
    expect(resolveImportSpec('src/ui', './missing', exists)).toBeNull();
  });
});

describe('buildTaskDiff on raw rows', () => {
  it('marks a deleted file with an empty after side', () =>
    withLocks((f) => {
      const t = f.task('A', 'review', 'Hapus');
      upsertTouch(f.db, { taskId: t.id, path: 'src/old.ts', firstVersion: 1, lastVersion: 2, deleted: true });
      writeFileVersion(f.db, { path: 'src/old.ts', version: 2, hash: '', content: null, size: 0, by: 'A', taskId: t.id, now: 999 });
      const diff = buildTaskDiff(f.db, t.id, 1000);
      expect(diff.files).toHaveLength(1);
      expect(diff.files[0]).toMatchObject({ path: 'src/old.ts', change: 'deleted', fromVersion: 1, toVersion: 2 });
      expect(diff.files[0]?.patch).toContain('-export const old = 1;');
    }, [{ path: 'src/old.ts', content: 'export const old = 1;\n' }]));

  it('throws 404 for an unknown task', () =>
    withLocks((f) => {
      expect(() => buildTaskDiff(f.db, 'T-99', 1000)).toThrowError(expect.objectContaining({ status: 404 }));
    }));
});

const HEADER_LINES = [
  "import { calculateTotal } from '../checkout/checkout.ts';",
  "import type { Item } from '../checkout/checkout.ts';",
  '',
  'export function Header(props: { items: Item[] }) {',
  '  const a = 1;',
  '  const b = 2;',
  '  const c = 3;',
  '  const d = 4;',
  '  const e = 5;',
  '  const f = 6;',
  '  const g = 7;',
  '  const h = 8;',
  '  const i = 9;',
  '  const total = calculateTotal(props.items);',
  '  return total;',
  '}',
];
const HEADER = `${HEADER_LINES.join('\n')}\n`;

const update = async (id: string, path: string, baseVersion: number, content: string) => ({
  t: 'file.update',
  id,
  d: { path, baseVersion, content, hash: await sha256Hex(content), clientTs: 0 },
});

describe('GET /v1/tasks/:id/diff (R3 §2.15)', () => {
  async function reviewFlow() {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub, [
      { path: 'src/checkout/checkout.ts', content: OLD_CHECKOUT },
      { path: 'src/ui/Header.tsx', content: HEADER },
    ]);
    const plan = await call(stub, 'POST', '/v1/proposals', {
      token: t.C,
      body: {
        kind: 'plan',
        reason: 'uji',
        payload: {
          goal: 'uji',
          tasks: [
            { ref: 'a', title: 'Kupon', ownerId: 'A', files: ['src/checkout/checkout.ts'] },
            { ref: 'b', title: 'Tampilan', ownerId: 'B', files: ['src/ui/Header.tsx'] },
          ],
        },
      },
    });
    expect(plan.status).toBe(201);
    expect((await call(stub, 'POST', `/v1/proposals/${plan.json.proposalId}/decision`, { token: t.mc, body: { approve: true } })).status).toBe(200);
    const syncA = await hello(stub, t.A!, 'sync');
    await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: ['src/checkout/checkout.ts'], tool: 'write_file', clientTs: 0 } });
    syncA.send(await update('a1', 'src/checkout/checkout.ts', 1, NEW_CHECKOUT));
    await syncA.byType('file.ack');
    syncA.ws.close();
    expect((await call(stub, 'POST', '/v1/tasks/T-1/submit', { token: t.A, body: { summary: 'kupon' } })).status).toBe(200);
    await call(stub, 'POST', '/v1/locks/check', { token: t.B, body: { paths: ['src/ui/Header.tsx'], tool: 'write_file', clientTs: 0 } });
    const review = await call(stub, 'POST', '/v1/proposals', {
      token: t.C,
      body: { kind: 'review', reason: 'ok', payload: { taskId: 'T-1', verdict: 'setujui' } },
    });
    expect(review.status).toBe(201);
    return { stub, t };
  }

  it('shows the patch, the changed export and the importer line', async () => {
    const { stub, t } = await reviewFlow();
    const res = await call(stub, 'GET', '/v1/tasks/T-1/diff', { token: t.C });
    expect(res.status).toBe(200);
    expect(res.json.taskId).toBe('T-1');
    expect(res.json.baseCommit).toBe('abc1234');
    expect(res.json.truncated).toBe(false);
    expect(res.json.files).toHaveLength(1);
    expect(res.json.files[0]).toMatchObject({ path: 'src/checkout/checkout.ts', change: 'modified', fromVersion: 1, toVersion: 2 });
    expect(res.json.files[0].patch).toContain('@@');
    expect(res.json.files[0].patch).toContain('+export function calculateTotal(items: Item[], shipping: number) {');
    expect(res.json.files[0].exportsChanged).toEqual([
      { name: 'calculateTotal', kind: 'function', before: 'calculateTotal(items: Item[])', after: 'calculateTotal(items: Item[], shipping: number)' },
    ]);
    expect(res.json.importers).toEqual([
      {
        path: 'src/ui/Header.tsx',
        imports: 'src/checkout/checkout.ts',
        symbols: ['calculateTotal', 'Item'],
        lines: [14],
        holder: { memberId: 'B', taskId: 'T-2', state: 'dipegang' },
      },
    ]);
  });

  it('refuses coders and unknown tasks', async () => {
    const { stub, t } = await reviewFlow();
    expect((await call(stub, 'GET', '/v1/tasks/T-1/diff', { token: t.A })).status).toBe(403);
    expect((await call(stub, 'GET', '/v1/tasks/T-9/diff', { token: t.C })).status).toBe(404);
  });

  it('truncates patches past 60 KB', async () => {
    const { stub } = freshWorkspace();
    const big = (tag: string) => Array.from({ length: 3000 }, (_, i) => `const ${tag}_${i} = ${i};`).join('\n');
    const t = await seedTestWorkspace(stub, [{ path: 'src/big.ts', content: `${big('a')}\n` }]);
    const plan = await call(stub, 'POST', '/v1/proposals', {
      token: t.C,
      body: { kind: 'plan', reason: 'uji', payload: { goal: 'uji', tasks: [{ ref: 'a', title: 'Besar', ownerId: 'A', files: ['src/big.ts'] }] } },
    });
    expect((await call(stub, 'POST', `/v1/proposals/${plan.json.proposalId}/decision`, { token: t.mc, body: { approve: true } })).status).toBe(200);
    const syncA = await hello(stub, t.A!, 'sync');
    await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: ['src/big.ts'], tool: 'write_file', clientTs: 0 } });
    syncA.send(await update('a1', 'src/big.ts', 1, `${big('b')}\n`));
    await syncA.byType('file.ack');
    syncA.ws.close();
    expect((await call(stub, 'POST', '/v1/tasks/T-1/submit', { token: t.A, body: { summary: 'besar' } })).status).toBe(200);
    const res = await call(stub, 'GET', '/v1/tasks/T-1/diff', { token: t.C });
    expect(res.status).toBe(200);
    expect(res.json.truncated).toBe(true);
    const total = (res.json.files as { patch: string }[]).reduce((n, f) => n + f.patch.length, 0);
    expect(total).toBeLessThanOrEqual(62 * 1024);
  });

  it('reads the real rows (sanity: task title and owner)', async () => {
    const { stub, t } = await reviewFlow();
    const row = await runInDurableObject(stub, (_i, st) =>
      st.storage.sql.exec<{ title: string }>(`SELECT title FROM task WHERE id = 'T-1'`).one(),
    );
    expect(row?.title).toBe('Kupon');
    expect(t.B).toBeTruthy();
  });
});
