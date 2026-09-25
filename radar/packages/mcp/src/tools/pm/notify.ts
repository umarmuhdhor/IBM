import { z } from 'zod';
import { RadarToolError } from '../../client.js';
import { defineTool } from '../types.js';

interface NotifyResponse {
  notificationId: number | string;
}

export default defineTool({
  name: 'notify',
  title: 'Kirim notifikasi',
  description: 'Gunakan untuk mengirim pesan singkat ke anggota tim. Pesan muncul di brief berikutnya. Maksimal 200 karakter.',
  inputSchema: {
    member: z.string().describe('ID anggota yang dituju'),
    message: z.string().max(200).describe('Pesan (maks 200 karakter)'),
  },
  async run(args, client) {
    if (args.message.length > 200) {
      throw new RadarToolError('Pesan terlalu panjang. Maksimal 200 karakter.');
    }

    const data = await client.post<NotifyResponse>('/v1/notify', { memberId: args.member, message: args.message });

    return `Notifikasi ${data.notificationId} terkirim ke ${args.member}. Pesan akan muncul di brief berikutnya.`;
  },
});
