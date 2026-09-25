import { z } from 'zod';
import { defineTool } from '../types.js';

interface ExportChanged {
  name: string;
  kind: string;
  before: string;
  after: string;
}

interface FileDiff {
  path: string;
  change: string;
  fromVersion: number | null;
  toVersion: number;
  patch: string;
  exportsChanged: ExportChanged[];
}

interface Importer {
  path: string;
  imports: string;
  symbols: string[];
  lines: number[];
  holder: { memberId: string; taskId: string; state: string } | null;
}

interface DiffResponse {
  taskId: string;
  title: string;
  ownerId: string;
  status: string;
  baseCommit: string;
  summary: string;
  files: FileDiff[];
  importers: Importer[];
  truncated: boolean;
}

const MAX_PATCH_CHARS = 8000;

export default defineTool({
  name: 'get_task_diff',
  title: 'Diff task',
  description: 'Gunakan untuk melihat perubahan file pada task sebelum review. Menampilkan ringkasan ekspor berubah, importer yang terpengaruh, dan patch.',
  inputSchema: {
    task_id: z.string().describe('ID task (mis. T-0)'),
  },
  async run(args, client) {
    const res = await client.get<Partial<DiffResponse>>(`/v1/tasks/${encodeURIComponent(args.task_id)}/diff`);
    // TODO(sync:alief): validate with the @radar/common TaskDiffRes zod schema once fase 02 lands; until then default the arrays.
    const data = { ...res, files: res.files ?? [], importers: res.importers ?? [] };

    const fileCount = data.files.length;

    // Build summary line
    const changedExports = data.files.flatMap((f) => f.exportsChanged ?? []);
    const exportSummary = changedExports
      .map((e) => `ekspor berubah: ${e.before} → ${e.after}`)
      .join('; ');

    const importerSummary = data.importers
      .map((imp) => {
        const lines = (imp.lines ?? []).length > 0 ? (imp.lines ?? []).map((l) => `${imp.path}:${l}`).join(', ') : imp.path;
        const holderStr = imp.holder ? ` (dipegang ${imp.holder.memberId}, ${imp.holder.taskId})` : '';
        return `${lines}${holderStr}`;
      })
      .join('; ');

    const firstLine = [`${fileCount} file berubah`, exportSummary, importerSummary].filter(Boolean).join('; ');

    const lines: string[] = [firstLine];

    // Append patches, cut to 8000 chars total
    let totalPatchChars = 0;
    let wasCut = false;

    for (const f of data.files) {
      const header = `\n--- ${f.path} (${f.change})`;
      const remaining = MAX_PATCH_CHARS - totalPatchChars;
      if (remaining <= 0) {
        wasCut = true;
        break;
      }
      lines.push(header);
      const patch = (f.patch ?? '').slice(0, Math.max(0, remaining - header.length));
      if (patch.length < (f.patch ?? '').length) {
        wasCut = true;
        lines.push(patch);
        break;
      }
      lines.push(patch);
      totalPatchChars += header.length + patch.length;
    }

    if (wasCut) {
      lines.push('(dipotong, gunakan read_file untuk detail)');
    }

    return lines.join('\n');
  },
});
