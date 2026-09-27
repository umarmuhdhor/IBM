// Runs in the DO constructor inside `blockConcurrencyWhile` (fase 03 step 3). Idempotent: schema_version is
// written only when it changes, so a wake from hibernation costs no rows written.
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';
import type { Db } from './sql';

export function migrate(db: Db): void {
  db.tx(() => {
    db.script(SCHEMA_SQL);
    const row = db.one<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'");
    if (row?.value === '1') {
      // v2 (D-alief-10): join_code.member_id became nullable. Codes live at most 30 days, so dropping them is fine.
      db.script('DROP TABLE join_code;');
      db.script(SCHEMA_SQL);
    } else if (row?.value === '2' || row?.value === '3') {
      // v3 (D-alief-11): owner codes. Existing codes are member or open codes, so the default 0 is right.
      if (row.value === '2') db.script('ALTER TABLE join_code ADD COLUMN owner INTEGER NOT NULL DEFAULT 0;');
      // v4 (D-alief-13): open codes remember they were open. Old rows cannot tell, so every non-owner code is
      // treated as open: reusing it then needs the member's own name. Codes live at most 30 days.
      db.script('ALTER TABLE join_code ADD COLUMN open INTEGER NOT NULL DEFAULT 0;');
      db.script('UPDATE join_code SET open = 1 WHERE owner = 0;');
    }
    // v5 (D-alief-17): line-range locks. Existing locks keep NULL = the whole file.
    const lockCols = db.all<{ name: string }>('PRAGMA table_info(lock)').map((c) => c.name);
    if (!lockCols.includes('start_line')) db.script('ALTER TABLE lock ADD COLUMN start_line INTEGER;');
    if (!lockCols.includes('end_line')) db.script('ALTER TABLE lock ADD COLUMN end_line INTEGER;');
    // v6 (D-alief-20): the owner can remove a seat. Existing members stay active.
    const memberCols = db.all<{ name: string }>('PRAGMA table_info(member)').map((c) => c.name);
    if (!memberCols.includes('removed_at')) db.script('ALTER TABLE member ADD COLUMN removed_at INTEGER;');
    // v7: task_step table added via IF NOT EXISTS in SCHEMA_SQL above; no column migrations needed.
    if (row?.value !== SCHEMA_VERSION) {
      db.run("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", SCHEMA_VERSION);
    }
  });
}
