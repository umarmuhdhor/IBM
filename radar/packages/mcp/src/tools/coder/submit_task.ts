import { z } from 'zod';
import { defineTool } from '../types.js';

interface SubmitResponse {
  taskId: string;
  status: string;
  files: string[];
}

export default defineTool({
  name: 'submit_task',
  title: 'Ajukan task untuk review',
  description: 'Panggil saat task selesai dan sudah kamu cek. Task masuk antrean review PM; kunci tetap milikmu sampai disetujui.',
  inputSchema: {
    task_id: z.string().describe('ID task yang akan disubmit'),
    summary: z.string().max(500).describe('Ringkasan perubahan (maks 500 karakter)'),
  },
  async run(args, client) {
    const data = await client.post<SubmitResponse>(`/v1/tasks/${args.task_id}/submit`, { summary: args.summary });
    return `${data.taskId} diajukan untuk review (${data.files.length} file).`;
  },
});
