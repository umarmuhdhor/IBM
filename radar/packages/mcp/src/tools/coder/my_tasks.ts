import { z } from 'zod';
import { defineTool } from '../types.js';

interface TaskFile {
  path: string;
  lock: string | null;
  queuePos: number;
  waitingFor?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  files: TaskFile[];
}

interface TasksResponse {
  tasks: Task[];
  activeTaskId: string | null;
}

export default defineTool({
  name: 'my_tasks',
  title: 'Lihat task aktif',
  description: 'Panggil di awal setiap sesi. Menampilkan task milikmu, file yang boleh kamu tulis, dan file yang masih antre.',
  inputSchema: {},
  async run(_args: z.infer<z.ZodObject<{}>>, client) {
    const data = await client.get<TasksResponse>('/v1/tasks?owner=me&status=open');
    const { tasks, activeTaskId } = data;
    if (!tasks.length) return 'Tidak ada task aktif saat ini.';

    const lines: string[] = [];
    for (const task of tasks) {
      const isActive = task.id === activeTaskId;
      const label = isActive ? `(${task.status})` : `(${task.status})`;
      lines.push(`Task aktif: ${task.id} ${task.title} ${label}`);
      for (const f of task.files) {
        if (f.lock) {
          lines.push(`  ${f.path} — dipegang`);
        } else if (f.waitingFor) {
          lines.push(`  ${f.path} — antre #${f.queuePos}, menunggu ${f.waitingFor}`);
        } else {
          lines.push(`  ${f.path} — bebas`);
        }
      }
    }
    return lines.slice(0, 12).join('\n');
  },
});
