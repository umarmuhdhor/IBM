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
  async run(_args, client) {
    // owner defaults to the caller (R3 §2.4); the real server rejects owner=me (R3 §7 table, D-umar-04)
    const data = await client.get<TasksResponse>('/v1/tasks?status=open');
    const { tasks, activeTaskId } = data;
    if (!tasks.length) return 'Tidak ada task aktif saat ini.';

    const lines: string[] = [];
    const ordered = [...tasks].sort((a, b) => Number(b.id === activeTaskId) - Number(a.id === activeTaskId));
    for (const task of ordered) {
      const isActive = task.id === activeTaskId;
      lines.push(`${isActive ? 'Task aktif' : 'Task'}: ${task.id} ${task.title} (${task.status})`);
      for (const f of task.files) {
        if (f.lock) {
          lines.push(`  ${f.path} — ${f.lock}`);
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
