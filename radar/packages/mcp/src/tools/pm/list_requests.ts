import { z } from 'zod';
import { defineTool } from '../types.js';

interface Requester {
  memberId: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
}

interface Holder {
  memberId: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  state: string;
  editCount: number;
}

interface Request {
  id: string;
  path: string;
  status: string;
  source: string;
  reason: string;
  requester: Requester;
  holder: Holder;
  fileVersion: number;
  createdAt: number;
}

interface RequestsResponse {
  requests: Request[];
}

export default defineTool({
  name: 'list_requests',
  title: 'Daftar permintaan file',
  description: 'Gunakan untuk melihat permintaan file yang terbuka, diusulkan, atau semua. Default menampilkan permintaan terbuka.',
  inputSchema: {
    status: z.enum(['terbuka', 'diusulkan', 'all']).optional().describe('Filter status permintaan (default: terbuka)'),
  },
  async run(args, client) {
    const status = args.status ?? 'terbuka';
    const res = await client.get<Partial<RequestsResponse>>(`/v1/requests?status=${status}`);
    const data = { requests: res.requests ?? [] };

    if (data.requests.length === 0) {
      return `Tidak ada permintaan dengan status "${status}".`;
    }

    const MAX_REQUESTS = 4; // 3 lines each: stays near the ±12-line budget of R3 §7
    const lines: string[] = [];
    for (const r of data.requests.slice(0, MAX_REQUESTS)) {
      const requester = r.requester;
      const holder = r.holder;
      const holderDesc = `dipegang ${holder.memberId} (${holder.taskId} ${holder.taskTitle}, ${holder.editCount} edit, ${holder.state})`;
      lines.push(`${r.id} · ${requester.memberId} (${requester.taskId} ${requester.taskTitle}) butuh ${r.path} · ${holderDesc}`);
      lines.push(requester.taskDescription.slice(0, 200));
      lines.push(holder.taskDescription.slice(0, 200));
    }

    if (data.requests.length > MAX_REQUESTS) lines.push(`+${data.requests.length - MAX_REQUESTS} permintaan lagi (panggil list_requests lagi setelah memutuskan yang di atas).`);
    return lines.join('\n');
  },
});
