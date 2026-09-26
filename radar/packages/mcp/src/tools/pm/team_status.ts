import { TeamRes } from '@radar/common';
import { expectShape } from '../../client.js';
import { defineTool } from '../types.js';

type Task = TeamRes['tasks'][number];

export default defineTool({
  name: 'team_status',
  title: 'Status tim',
  description: 'Gunakan untuk melihat status tim: siapa online, task aktif, file yang dikunci, permintaan terbuka, dan proposal tertunda.',
  inputSchema: {},
  async run(_args, client) {
    const data = expectShape(TeamRes, await client.get<unknown>('/v1/team'), 'team_status');
    const lines: string[] = [];

    lines.push(`Tim: ${data.members.filter((m) => m.online).length} online, ${data.members.filter((m) => !m.online).length} offline — ${data.openRequests} permintaan terbuka, ${data.pendingProposals} proposal tertunda`);

    for (const m of data.members) {
      const task = data.tasks.find((t) => t.id === m.activeTaskId);
      const taskStr = task ? ` → ${task.id} ${task.title} (${task.status})` : '';
      lines.push(`  ${m.id} ${m.name} [${m.online ? 'online' : 'offline'}]${taskStr}`);
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
