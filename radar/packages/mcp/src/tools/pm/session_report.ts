import { RadarToolError } from '../../client.js';
import { defineTool } from '../types.js';

interface ReportResponse {
  markdown: string;
  stats: Record<string, unknown>;
}

export default defineTool({
  name: 'session_report',
  title: 'Laporan sesi',
  description: 'Gunakan untuk mendapatkan laporan ringkasan sesi ini. Tersedia setelah fase 12 selesai.',
  inputSchema: {},
  async run(_args, client) {
    try {
      const data = await client.get<ReportResponse>('/v1/report/session');
      return data.markdown;
    } catch (err) {
      if (err instanceof RadarToolError && err.status === 404) {
        return 'Laporan sesi tersedia setelah fase 12.';
      }
      throw err;
    }
  },
});
