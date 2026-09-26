// R2 §2, copied verbatim. Kept as a TS string (not schema.sql) because workerd and the vitest pool cannot
// import a .sql file the same way (D-alief-03). Runs on every DO start; every statement is IF NOT EXISTS.
export const SCHEMA_VERSION = '2';

export const SCHEMA_SQL = `
-- Tanpa PRAGMA journal/transaksi: Durable Object mengatur sendiri. FK sudah ON secara default (§1).

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: schema_version, workspace_id, workspace_name, repo_url, head_commit, created_at

CREATE TABLE IF NOT EXISTS counter (
  name TEXT PRIMARY KEY,           -- 'task' | 'request' | 'proposal' | 'review'
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS member (
  id             TEXT PRIMARY KEY,                       -- 'A' | 'B' | 'C'
  name           TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('coder','pm')),
  color          TEXT NOT NULL,                          -- '#78A9FF' dsb. (Carbon 40, lihat R5 §4)
  git_name       TEXT NOT NULL,
  git_email      TEXT NOT NULL,
  active_task_id TEXT,                                   -- FK lunak ke task.id
  last_heartbeat INTEGER,
  online         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS token (
  hash       TEXT PRIMARY KEY,                           -- sha256 hex dari token
  kind       TEXT NOT NULL CHECK (kind IN ('member','mc')),
  member_id  TEXT REFERENCES member(id),                 -- NULL untuk kind='mc'
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS task (
  id              TEXT PRIMARY KEY,                      -- 'T-1'
  seq             INTEGER NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  owner_id        TEXT NOT NULL REFERENCES member(id),
  status          TEXT NOT NULL CHECK (status IN ('draf','terbuka','dikerjakan','review','selesai','batal')),
  adhoc           INTEGER NOT NULL DEFAULT 0,
  base_commit     TEXT,                                  -- HEAD saat task dibuka
  plan_proposal_id TEXT,
  parent_task_id  TEXT,                                  -- untuk hasil keputusan 'pecah'
  submit_summary  TEXT,
  commit_sha      TEXT,
  commit_started_at INTEGER,                             -- terisi selama commit GitHub berjalan; kedaluwarsa setelah COMMIT_CLAIM_TTL_MS (R4 §6.3 poin 5)
  edit_count      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS task_owner ON task(owner_id, status);

CREATE TABLE IF NOT EXISTS file (
  path            TEXT PRIMARY KEY,
  version         INTEGER NOT NULL,                      -- naik 1 setiap update diterima
  hash            TEXT NOT NULL,                         -- sha256 hex isi; '' kalau deleted
  content         TEXT,                                  -- NULL kalau deleted
  deleted         INTEGER NOT NULL DEFAULT 0,
  size            INTEGER NOT NULL DEFAULT 0,
  updated_by      TEXT,                                  -- member id
  updated_task_id TEXT,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_version (
  path     TEXT NOT NULL,
  version  INTEGER NOT NULL,
  hash     TEXT NOT NULL,
  content  TEXT,
  deleted  INTEGER NOT NULL DEFAULT 0,
  by       TEXT,
  task_id  TEXT,
  ai       INTEGER NOT NULL DEFAULT 0,                   -- 1 kalau ditandai PostToolUse (BC-05)
  ts       INTEGER NOT NULL,
  PRIMARY KEY (path, version)
);

CREATE TABLE IF NOT EXISTS allocation (
  task_id   TEXT NOT NULL REFERENCES task(id),
  path      TEXT NOT NULL,
  queue_pos INTEGER NOT NULL,                            -- 0 = pemegang/pemesan saat ini, 1.. = antre
  source    TEXT NOT NULL CHECK (source IN ('plan','auto','decision')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, path)
);
CREATE INDEX IF NOT EXISTS allocation_path ON allocation(path, queue_pos);

CREATE TABLE IF NOT EXISTS lock (
  path        TEXT PRIMARY KEY,                          -- satu baris = satu penulis (invariant I1)
  task_id     TEXT NOT NULL REFERENCES task(id),
  member_id   TEXT NOT NULL REFERENCES member(id),
  state       TEXT NOT NULL CHECK (state IN ('dipesan','dipegang','review')),
  acquired_at INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lock_task ON lock(task_id);

CREATE TABLE IF NOT EXISTS task_touch (                  -- file yang benar-benar diubah task → dasar commit & diff
  task_id       TEXT NOT NULL REFERENCES task(id),
  path          TEXT NOT NULL,
  first_version INTEGER NOT NULL,                        -- versi SEBELUM perubahan pertama task
  last_version  INTEGER NOT NULL,
  deleted       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, path)
);

CREATE TABLE IF NOT EXISTS block (                       -- setiap blokir (dasar why_blocked)
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id     TEXT NOT NULL,
  task_id       TEXT,
  path          TEXT NOT NULL,
  holder_member TEXT NOT NULL,
  holder_task   TEXT NOT NULL,
  via           TEXT NOT NULL CHECK (via IN ('hook','sync')),
  request_id    TEXT,
  ts            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS block_member ON block(member_id, ts);

CREATE TABLE IF NOT EXISTS request (
  id               TEXT PRIMARY KEY,                     -- 'R-1'
  seq              INTEGER NOT NULL UNIQUE,
  requester_member TEXT NOT NULL REFERENCES member(id),
  requester_task   TEXT NOT NULL REFERENCES task(id),
  path             TEXT NOT NULL,
  holder_member    TEXT NOT NULL,
  holder_task      TEXT NOT NULL,
  reason           TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL CHECK (source IN ('hook','sync','mcp')),
  status           TEXT NOT NULL CHECK (status IN ('terbuka','diusulkan','diputuskan','ditolak','batal')),
  proposal_id      TEXT,
  outcome          TEXT,                                 -- 'antre' | 'pindahkan' | 'pecah' | NULL
  created_at       INTEGER NOT NULL,
  decided_at       INTEGER
);
-- SV-05: tidak ada duplikat permintaan aktif untuk task + file yang sama
CREATE UNIQUE INDEX IF NOT EXISTS request_open_dedup
  ON request(requester_task, path) WHERE status IN ('terbuka','diusulkan');

CREATE TABLE IF NOT EXISTS proposal (
  id            TEXT PRIMARY KEY,                        -- 'P-1'
  seq           INTEGER NOT NULL UNIQUE,
  kind          TEXT NOT NULL CHECK (kind IN ('plan','decision','review')),
  status        TEXT NOT NULL CHECK (status IN ('menunggu','disetujui','ditolak','diterapkan_otomatis','kedaluwarsa')),
  payload       TEXT NOT NULL,                           -- JSON sesuai R3 §4
  reason        TEXT NOT NULL,                           -- satu kalimat alasan main agent
  ref_id        TEXT,                                    -- request_id (decision) / task_id (review)
  created_by    TEXT NOT NULL,                           -- member id PM
  created_at    INTEGER NOT NULL,
  decided_by    TEXT,                                    -- 'mc' | 'auto'
  decided_at    INTEGER,
  decision_note TEXT
);
CREATE INDEX IF NOT EXISTS proposal_status ON proposal(status, kind);

CREATE TABLE IF NOT EXISTS review (
  id          TEXT PRIMARY KEY,                          -- 'RV-1'
  seq         INTEGER NOT NULL UNIQUE,
  task_id     TEXT NOT NULL REFERENCES task(id),
  proposal_id TEXT NOT NULL REFERENCES proposal(id),
  verdict     TEXT NOT NULL CHECK (verdict IN ('setujui','setujui_beri_tahu','kembalikan')),
  notes       TEXT NOT NULL DEFAULT '',
  commit_sha  TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notification (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  TEXT REFERENCES member(id),                 -- NULL = kode terbuka, diisi saat pertama dipakai (D-alief-10)
  kind       TEXT NOT NULL CHECK (kind IN ('pm_note','decision','lock','review','system')),
  message    TEXT NOT NULL,
  ref        TEXT,
  event_id   INTEGER NOT NULL,                           -- event yang membuatnya (cursor brief)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notification_member ON notification(member_id, event_id);

CREATE TABLE IF NOT EXISTS event (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,             -- monoton → cursor brief & replay
  ts      INTEGER NOT NULL,
  actor   TEXT NOT NULL,                                 -- 'A' | 'B' | 'C' | 'mc' | 'server' | 'bob:A' | 'main-agent'
  type    TEXT NOT NULL,                                 -- katalog R3 §5
  payload TEXT NOT NULL                                  -- JSON
);
CREATE INDEX IF NOT EXISTS event_type ON event(type, id);

CREATE TABLE IF NOT EXISTS metric (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    INTEGER NOT NULL,
  name  TEXT NOT NULL,                                   -- 'lock_check_ms' | 'sync_rtt_ms' | 'hook_failopen' | ...
  value REAL NOT NULL,
  tags  TEXT                                             -- JSON kecil
);
CREATE INDEX IF NOT EXISTS metric_name ON metric(name, ts);

CREATE TABLE IF NOT EXISTS join_code (                   -- IN-03 (D-alief-09): kode gabung pendek, hanya hash
  hash       TEXT PRIMARY KEY,                           -- sha256 hex dari kode 'K7QM-3XPA'
  member_id  TEXT REFERENCES member(id),                 -- NULL = kode terbuka, diisi saat pertama dipakai (D-alief-10)
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_mark (                     -- BC-05: PostToolUse tiba sebelum file.update dari sync
  member_id TEXT NOT NULL,
  path      TEXT NOT NULL,
  ts        INTEGER NOT NULL,                            -- berlaku AI_MARK_WINDOW_MS (10 s)
  PRIMARY KEY (member_id, path)
);
`;
