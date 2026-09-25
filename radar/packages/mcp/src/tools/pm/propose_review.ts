import { z } from 'zod';
import { defineTool } from '../types.js';

interface ProposalResponse {
  proposalId: string;
  status: string;
}

export default defineTool({
  name: 'propose_review',
  title: 'Usulkan review task',
  description: 'Gunakan untuk mengusulkan review task: setujui, setujui dengan notifikasi, atau kembalikan. Sertakan catatan dan opsional flag masalah.',
  inputSchema: {
    task_id: z.string().describe('ID task yang direview'),
    verdict: z.enum(['setujui', 'setujui_beri_tahu', 'kembalikan']).describe('Hasil review'),
    notes: z.string().describe('Catatan review'),
    notify: z
      .array(
        z.object({
          member: z.string().describe('ID anggota yang diberi tahu'),
          message: z.string(),
        }),
      )
      .optional()
      .describe('Anggota yang perlu diberi tahu'),
    flags: z
      .array(
        z.object({
          path: z.string(),
          issue: z.string(),
        }),
      )
      .optional()
      .describe('Masalah spesifik pada file tertentu'),
  },
  async run(args, client) {
    const payload = {
      taskId: args.task_id,
      verdict: args.verdict,
      notes: args.notes,
      notify: (args.notify ?? []).map((n) => ({ memberId: n.member, message: n.message })),
      flags: args.flags ?? [],
    };

    const data = await client.post<ProposalResponse>('/v1/proposals', { kind: 'review', reason: args.notes, payload });

    return `Review ${data.proposalId} untuk task ${args.task_id} (verdict: ${args.verdict}) menunggu persetujuan PM di Mission Control.`;
  },
});
