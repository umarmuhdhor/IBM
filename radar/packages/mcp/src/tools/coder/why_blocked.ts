import { z } from 'zod';
import { defineTool } from '../types.js';

interface Holder {
  memberId: string;
  memberName: string;
  taskId: string;
  taskTitle: string;
  state: string;
  sinceMs: number;
}

interface Block {
  path: string;
  ts: number;
  via: string;
  holder: Holder;
  requestId: string | null;
  requestStatus: string | null;
  queue: { taskId: string; memberId: string }[];
  suggestion: string;
}

interface BlockResponse {
  block: Block | null;
}

export default defineTool({
  name: 'why_blocked',
  title: 'Mengapa edit ditolak',
  description: 'Panggil SEGERA setelah edit ditolak Radar. Menjelaskan pemilik file, task-nya, dan apa yang bisa kamu kerjakan sekarang.',
  inputSchema: {},
  async run(_args: z.infer<z.ZodObject<{}>>, client) {
    const data = await client.get<BlockResponse>('/v1/blocks/last');
    const { block } = data;
    if (!block) return 'Tidak ada blokir terbaru. Kamu bebas mengedit file yang tersedia di task-mu.';

    const holder = block.holder;
    const sinceMin = Math.round(holder.sinceMs / 60000);
    const lines: string[] = [];
    lines.push(`${block.path} dipegang ${holder.memberName} (${holder.taskId} ${holder.taskTitle}) sejak ${sinceMin} menit.`);
    if (block.requestId) {
      lines.push(`Permintaanmu ${block.requestId} — status: ${block.requestStatus}.`);
    } else {
      lines.push('Belum ada permintaan file dari kamu.');
    }
    lines.push(block.suggestion);
    return lines.slice(0, 12).join('\n');
  },
});
