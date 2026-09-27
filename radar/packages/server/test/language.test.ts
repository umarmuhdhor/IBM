// User-facing text is English (D-alief-18, amends R5). Wire and enum values such as `bebas` or `dipegang` stay
// Indonesian; they are single words and never shown as sentences, so the audit only flags string literals that
// read as an Indonesian sentence (two or more common Indonesian words).
import { describe, expect, it } from 'vitest';

// Tests run inside workerd (no fs): Vite inlines the sources as text.
declare global {
  interface ImportMeta {
    glob<T>(pattern: string | string[], options: { query: string; import: string; eager: true }): Record<string, T>;
  }
}
const SOURCES: Record<string, string> = {
  ...import.meta.glob<string>(['../src/**/*.ts', '!../src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('../../common/src/events.ts', { query: '?raw', import: 'default', eager: true }),
};
const WORDS =
  /\b(tidak|sudah|belum|gagal|bukan|rusak|berubah|pecah|berstatus|sedang|coba|sebentar|berjalan|milikmu|luar|maksimal|panggilan|giliranmu|kini|untuk|antre|posisi|setelah|permintaan|permintaanmu|masuk|antrean|punya|bisa|tunggu|keputusan|dikunci|kamu|usulan|usulkan|lewat|manusia|menyetujui|menulis|menolak|pemeriksaan|isi|diterapkan|diputuskan|peminta|dan|dari|yang|ada|apa|pun|mengubah|dibatalkan|pindah|rencana|harus|relatif|dalam|memegang|hanya|sendiri|milik|dengan|oleh|kalau|jangan|orang|lain|catatan|laporan|ukuran|nilai|judul|pemilik|temuan|lanjutkan|berikutnya|dipindahkan|dipindah|bagian|mulai|ditolak|disetujui|siap|blokir|sinkron|cek|kunci|lokal|rentang)\b/gi;

function indonesianLiterals(path: string, source: string): string[] {
  const out: string[] = [];
  source
    .split('\n')
    .forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      for (const m of line.matchAll(/'([^'\n]*)'|`([^`\n]*)`|"([^"\n]*)"/g)) {
        const text = m[1] ?? m[2] ?? m[3] ?? '';
        if ((text.match(WORDS) ?? []).length >= 2) out.push(`${path}:${i + 1}: ${text.slice(0, 80)}`);
      }
    });
  return out;
}

describe('user-facing language (D-alief-18)', () => {
  it('server messages and feed lines are English', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    const hits = Object.entries(SOURCES).flatMap(([path, source]) => indonesianLiterals(path, source));
    expect(hits).toEqual([]);
  });
});
