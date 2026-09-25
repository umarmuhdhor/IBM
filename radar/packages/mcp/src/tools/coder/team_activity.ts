import { z } from 'zod';
import { defineTool } from '../types.js';

interface ActivityItem {
  ts: number;
  actor: string;
  type: string;
  path: string;
  summary: string;
}

interface ActivityResponse {
  items: ActivityItem[];
}

export default defineTool({
  name: 'team_activity',
  title: 'Aktivitas tim terbaru',
  description: 'Lihat perubahan terbaru rekan, opsional untuk satu path.',
  inputSchema: {
    path: z.string().optional().describe('Filter aktivitas untuk path tertentu'),
    limit: z.int().min(1).max(50).optional().describe('Jumlah item (1–50)'),
  },
  async run(args, client) {
    const params = new URLSearchParams();
    if (args.path) params.set('path', args.path);
    if (args.limit !== undefined) params.set('limit', String(args.limit));
    const qs = params.size > 0 ? `?${params.toString()}` : '';
    const data = await client.get<ActivityResponse>(`/v1/activity${qs}`);
    const { items } = data;
    if (!items.length) return 'Belum ada aktivitas tim terbaru.';
    const lines = [`Aktivitas terbaru (${items.length} item):`];
    for (const item of items) {
      lines.push(`  ${item.summary}`);
    }
    return lines.slice(0, 12).join('\n');
  },
});
