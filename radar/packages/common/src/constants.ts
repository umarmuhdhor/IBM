// Shared constants (R5 §4). Every package imports these instead of repeating literals.

export const SYNC_DEBOUNCE_MS = 150;
export const MAX_FILE_BYTES = 1_048_576;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_EXPIRE_MS = 300_000;
export const HOOK_SERVER_TIMEOUT_MS = 1_500;
export const HOOK_TOTAL_TIMEOUT_S = { preToolUse: 3, brief: 5 } as const;
/** Fire-and-forget budget for `POST /v1/bob/activity` (R3 §2.24). */
export const ACTIVITY_TIMEOUT_MS = 800;
export const WRITING_INDICATOR_MS = 3_000;
export const BRIEF_MAX_LINES = 6;
export const BRIEF_MAX_LINE_CHARS = 160;
export const BRIEF_PREFIX = '[Radar] ';
export const WS_HELLO_TIMEOUT_MS = 5_000;
export const COMMIT_CLAIM_TTL_MS = 60_000;
export const WS_PING_MS = 20_000;
/** Exact strings for `setWebSocketAutoResponse`; never rebuild them with JSON.stringify. */
export const WS_PING_FRAME = '{"t":"ping"}';
export const WS_PONG_FRAME = '{"t":"pong"}';

export const MEMBER_COLORS = {
  A: '#78A9FF',
  B: '#BE95FF',
  C: '#FF832B',
  D: '#08BDBA',
} as const;

export const STATUS_COLORS = {
  green: '#42BE65',
  yellow: '#F1C21B',
  red: '#FA4D56',
} as const;

export const TERM_FRAME_MAX_BYTES = 32_768;
export const TERM_RING_BYTES = 262_144;
export const TERM_GUEST_MAX_MS = 600_000;

/** Bob IDE edit tools (BC-04). Confirmed unchanged by the fase 01 spike (D-umar-01 point 7). */
export const EDIT_TOOLS_REGEX = /^(write_file|apply_diff|search_and_replace|insert_content|office_edit)$/;

// Limits used by schemas and the reducer (R3 §2.16, §2.24, §4.1, §6).
export const PLAN_MAX_TASKS = 8;
export const PLAN_MAX_FILES_PER_TASK = 20;
export const NOTIFY_MAX_CHARS = 200;
export const ACTIVITY_TEXT_MAX_CHARS = 200;
export const SUBMIT_SUMMARY_MAX_CHARS = 500;
export const FEED_MAX_ITEMS = 200;
export const BOB_ACTIVITY_MAX_ITEMS = 100;
export const BINARY_SNIFF_BYTES = 8_192;
export const TASK_DIFF_MAX_PATCH_BYTES = 60_000;
