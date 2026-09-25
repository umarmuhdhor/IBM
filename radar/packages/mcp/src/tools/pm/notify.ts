import { z } from 'zod';
import { defineTool } from '../types.js';

interface NotifyResponse {
  notificationId: number | string;
}

export default defineTool({
  name: 'notify',
  title: 'Kirim notifikasi',
  description: 'Gunakan untuk mengirim pesan singkat ke anggota tim. Pesan muncul di brief berikutnya. Maksimal 200 karakter.',
  inputSchema: {
    member: z.string().min(1).describe('ID anggota seperti A atau B (bukan nama)'),
    message: z.string().max(200).describe('Pesan (maks 200 karakter)'),
  },
  async run(args, client) {

    const data = await client.post<NotifyResponse>('/v1/notify', { memberId: args.member, message: args.message });

    return `Notifikasi ${data.notificationId} terkirim ke ${args.member}. Pesan akan muncul di brief berikutnya.`;
  },
});
