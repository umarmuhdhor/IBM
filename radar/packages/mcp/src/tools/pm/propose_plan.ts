import { z } from 'zod';
import { RadarToolError } from '../../client.js';
import { defineTool } from '../types.js';

interface ProposalResponse {
  proposalId: string;
  status: string;
}

export default defineTool({
  name: 'propose_plan',
  title: 'Usulkan rencana',
  description: 'Gunakan untuk mengusulkan rencana task baru ke PM. Tentukan tujuan, alasan, dan daftar task beserta pemilik dan file-nya.',
  inputSchema: {
    goal: z.string().min(1).describe('Tujuan rencana'),
    reason: z.string().min(1).describe('Alasan usulan rencana (satu kalimat)'),
    tasks: z.array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        owner: z.string().min(1).describe('ID anggota seperti A atau B (bukan nama)'),
        files: z.array(z.string().min(1)).max(20),
        queued_files: z.array(z.string().min(1)).max(20).optional(),
      }),
    ).min(1).max(8),
  },
  async run(args, client) {
    const payload = {
      goal: args.goal,
      tasks: args.tasks.map((t, i) => ({
        ref: `t${i + 1}`,
        title: t.title,
        description: t.description,
        ownerId: t.owner,
        files: t.files,
        queuedFiles: t.queued_files ?? [],
      })),
    };

    let data: ProposalResponse;
    try {
      data = await client.post<ProposalResponse>('/v1/proposals', { kind: 'plan', reason: args.reason, payload });
    } catch (err) {
      if (err instanceof RadarToolError && err.status === 422) {
        throw new RadarToolError(`${err.message} Perbaiki alokasi lalu panggil propose_plan lagi.`);
      }
      throw err;
    }

    return `Usulan rencana ${data.proposalId} menunggu persetujuan PM di Mission Control.`;
  },
});
