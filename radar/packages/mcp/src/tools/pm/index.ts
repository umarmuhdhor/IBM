// PM tools for the main agent (R3 §7, MA-01..07). Each file is written in Bob slice B4b; this index only collects them.
// There is deliberately no approve/decide/revoke tool (MA-07): proposals wait for the PM in Mission Control.
import type { ToolDef } from '../types.js';

// TODO(B4b): team_status, propose_plan, list_requests, propose_decision, get_task_diff, propose_review, notify, session_report
export const PM_TOOLS: readonly ToolDef[] = [];
