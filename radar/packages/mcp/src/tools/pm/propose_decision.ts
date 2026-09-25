import { z } from 'zod';
import { RadarToolError } from '../../client.js';
import { defineTool } from '../types.js';

interface ProposalResponse {
  proposalId: string;
  status: string;
}

export default defineTool({
  name: 'propose_decision',
  title: 'Usulkan keputusan permintaan',
  description: 'Gunakan untuk mengusulkan keputusan atas permintaan file: antre, pindahkan, atau pecah. Opsi pecah memerlukan new_task.',
  inputSchema: {
    request_id: z.string().describe('ID permintaan (mis. R-3)'),
    option: z.enum(['antre', 'pindahkan', 'pecah']).describe('Opsi keputusan'),
    reason: z.string().min(1).describe('Alasan keputusan (satu kalimat, sebut file dan task)'),
    new_task: z
      .object({
        title: z.string(),
        description: z.string(),
        owner: z.string().min(1).describe('ID anggota seperti A atau B (bukan nama)'),
      })
      .optional()
      .describe('Task baru untuk opsi pecah'),
  },
  async run(args, client) {
    if (args.option === 'pecah' && !args.new_task) {
      throw new RadarToolError('Opsi "pecah" memerlukan new_task. Sertakan title, description, dan owner untuk task baru.');
    }

    const payload: Record<string, unknown> = {
      requestId: args.request_id,
      option: args.option,
    };

    if (args.new_task) {
      payload.newTask = {
        title: args.new_task.title,
        description: args.new_task.description,
        ownerId: args.new_task.owner,
      };
    }

    const data = await client.post<ProposalResponse>('/v1/proposals', { kind: 'decision', reason: args.reason, payload });

    if (data.status === 'diterapkan_otomatis') {
      return `Keputusan ${data.proposalId} untuk ${args.request_id} diterapkan otomatis.`;
    }
    return `Keputusan ${data.proposalId} untuk ${args.request_id} menunggu persetujuan PM di Mission Control.`;
  },
});
