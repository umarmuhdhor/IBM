import { z } from 'zod';
import { defineTool } from '../types.js';

interface StepResponse {
  taskId: string;
  steps: { text: string; done: boolean }[];
}

export default defineTool({
  name: 'complete_step',
  title: 'Centang langkah task',
  description: 'Panggil setiap kali satu langkah dari checklist PM selesai. Progres langsung terlihat di halaman PM.',
  inputSchema: {
    task_id: z.string().describe('ID task yang langkahnya dicentang'),
    step: z.number().int().min(1).describe('Nomor langkah (1-based, sesuai urutan di my_tasks)'),
    done: z.boolean().default(true).describe('true untuk mencentang, false untuk membatalkan centang'),
  },
  async run(args, client) {
    const data = await client.post<StepResponse>(`/v1/tasks/${encodeURIComponent(args.task_id)}/steps`, {
      index: args.step - 1,
      done: args.done,
    });
    const total = data.steps.length;
    const checked = data.steps.filter((s) => s.done).length;
    const action = args.done ? 'selesai' : 'dibatalkan';
    return `${data.taskId}: langkah ${args.step}/${total} ${action} (${checked} dari ${total} tercentang).`;
  },
});
