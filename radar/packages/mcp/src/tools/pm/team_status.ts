import { defineTool } from '../types.js';

interface Member {
  id: string;
  name: string;
  role: string;
  online: boolean;
  lastHeartbeatMs: number;
  activeTaskId: string | null;
}

interface Task {
  id: string;
  title: string;
  ownerId: string;
  status: string;
  files: string[];
  editCount: number;
}

interface Lock {
  path: string;
  taskId: string;
  memberId: string;
  state: string;
  queue: string[];
}

interface TeamResponse {
  members: Member[];
  tasks: Task[];
  locks: Lock[];
  openRequests: number;
  pendingProposals: number;
  headCommit: string;
}

export default defineTool({
  name: 'team_status',
  title: 'Status tim',
  description: 'Gunakan untuk melihat status tim: siapa online, task aktif, file yang dikunci, permintaan terbuka, dan proposal tertunda.',
  inputSchema: {},
  async run(_args, client) {
    const data = await client.get<TeamResponse>('/v1/team');
    const lines: string[] = [];

    lines.push(`Tim: ${data.members.filter((m) => m.online).length} online, ${data.members.filter((m) => !m.online).length} offline — ${data.openRequests} permintaan terbuka, ${data.pendingProposals} proposal tertunda`);

    for (const m of data.members) {
      const task = data.tasks.find((t) => t.id === m.activeTaskId);
      const taskStr = task ? ` → ${task.id} ${task.title} (${task.status})` : '';
      lines.push(`  ${m.name} [${m.online ? 'online' : 'offline'}]${taskStr}`);
    }

    if (data.locks.length > 0) {
      lines.push('Kunci file:');
      for (const lock of data.locks) {
        const queueStr = lock.queue.length > 0 ? ` | antre: ${lock.queue.join(', ')}` : '';
        lines.push(`  ${lock.path} → ${lock.taskId} (${lock.state})${queueStr}`);
      }
    }

    const tasksByStatus: Record<string, Task[]> = {};
    for (const t of data.tasks) {
      (tasksByStatus[t.status] ??= []).push(t);
    }
    for (const [status, tasks] of Object.entries(tasksByStatus)) {
      lines.push(`Task ${status}: ${tasks.map((t) => `${t.id} ${t.title}`).join(', ')}`);
    }

    return lines.slice(0, 25).join('\n');
  },
});
