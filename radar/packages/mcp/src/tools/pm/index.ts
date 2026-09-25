// PM tools for the main agent (R3 §7, MA-01..07). Each file is written in Bob slice B4b; this index only collects them.
// There is deliberately no approve/decide/revoke tool (MA-07): proposals wait for the PM in Mission Control.
import type { ToolDef } from '../types.js';
import teamStatus from './team_status.js';
import proposePlan from './propose_plan.js';
import listRequests from './list_requests.js';
import proposeDecision from './propose_decision.js';
import getTaskDiff from './get_task_diff.js';
import proposeReview from './propose_review.js';
import notify from './notify.js';
import sessionReport from './session_report.js';

export const PM_TOOLS: readonly ToolDef[] = [
  teamStatus,
  proposePlan,
  listRequests,
  proposeDecision,
  getTaskDiff,
  proposeReview,
  notify,
  sessionReport,
];
