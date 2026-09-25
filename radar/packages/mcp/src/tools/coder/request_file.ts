import { z } from 'zod';
import { defineTool } from '../types.js';

interface RequestResponse {
  requestId: string | null;
  status: string;
  message?: string;
  duplicate?: boolean;
}

export default defineTool({
  name: 'request_file',
  title: 'Minta akses file',
  description: 'Minta file yang sedang dipegang orang lain ke PM, dengan alasan. Jangan dipanggil untuk file bebas.',
  inputSchema: {
    path: z.string().describe('Path file yang ingin diminta'),
    reason: z.string().describe('Alasan mengapa file ini diperlukan'),
  },
  async run(args, client) {
    const data = await client.post<RequestResponse>('/v1/requests', { path: args.path, reason: args.reason });
    if (data.status === 'bebas') {
      return `${args.path} bebas — langsung edit saja, tidak perlu permintaan.`;
    }
    if (data.duplicate) {
      return `Permintaan ${data.requestId} sudah ada sebelumnya — status: ${data.status}.`;
    }
    return `Permintaan ${data.requestId} dibuat — status: ${data.status}. PM akan memutuskan giliranmu.`;
  },
});
