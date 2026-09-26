// The only module that touches `ctx.storage.sql` (R2 §1, fase 03 step 3). Services get a `Db`, so they stay
// testable and never see a Cloudflare object. Values always go through bound parameters.

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export interface Db {
  all<T extends Row>(query: string, ...args: SqlValue[]): T[];
  /** First row, or null. */
  one<T extends Row>(query: string, ...args: SqlValue[]): T | null;
  /** Runs a write; returns rows written. */
  run(query: string, ...args: SqlValue[]): number;
  /** Runs one or more statements without parameters (migrations only). */
  script(query: string): void;
  /** `transactionSync`. Nested calls join the outer transaction. */
  tx<T>(fn: () => T): T;
  readonly inTx: boolean;
}

const MAX_PARAMS = 100;

export function createDb(storage: DurableObjectStorage): Db {
  const sql = storage.sql;
  let depth = 0;
  const check = (args: SqlValue[]) => {
    if (args.length > MAX_PARAMS) throw new Error(`too many SQL parameters (${args.length} > ${MAX_PARAMS})`);
  };
  return {
    all<T extends Row>(query: string, ...args: SqlValue[]): T[] {
      check(args);
      return sql.exec<T>(query, ...args).toArray();
    },
    one<T extends Row>(query: string, ...args: SqlValue[]): T | null {
      check(args);
      const rows = sql.exec<T>(query, ...args).toArray();
      return rows[0] ?? null;
    },
    run(query: string, ...args: SqlValue[]): number {
      check(args);
      const cursor = sql.exec(query, ...args);
      // Drain so the statement runs to completion (exec is lazy for multi-row results).
      cursor.toArray();
      return cursor.rowsWritten;
    },
    script(query: string): void {
      sql.exec(query).toArray();
    },
    tx<T>(fn: () => T): T {
      if (depth > 0) return fn();
      depth++;
      try {
        return storage.transactionSync(fn);
      } finally {
        depth--;
      }
    },
    get inTx() {
      return depth > 0;
    },
  };
}
