// Coder tools (R3 §7). Each file is written in Bob slice B4a; this index only collects them.
import type { ToolDef } from '../types.js';
import myTasks from './my_tasks.js';
import whyBlocked from './why_blocked.js';
import requestFile from './request_file.js';
import teamActivity from './team_activity.js';
import submitTask from './submit_task.js';

export const CODER_TOOLS: readonly ToolDef[] = [myTasks, whyBlocked, requestFile, teamActivity, submitTask];
