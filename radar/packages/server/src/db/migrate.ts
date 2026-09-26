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
    if (row?.value !== SCHEMA_VERSION) {
      db.run("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", SCHEMA_VERSION);
    }
  });
}
