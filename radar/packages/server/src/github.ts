// GitHub Git Data API over plain fetch (fase 03 step 8; commits follow in fase 06). One subrequest per call.
import { RadarError } from './http/errors';

const API = 'https://api.github.com';

export interface GithubRefCheck {
  repo: string;
  branch: string;
  headCommit: string;
  token?: string | undefined;
  fetchImpl?: typeof fetch;
}

/** Throws 409 when `headCommit` is not the tip of `branch`, 422 when GitHub cannot be asked. */
export async function verifyHeadCommit(c: GithubRefCheck): Promise<void> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'radar-live-collab' };
  if (c.token) headers.authorization = `Bearer ${c.token}`;
  const url = `${API}/repos/${c.repo}/git/ref/heads/${encodeURIComponent(c.branch)}`;
  let res: Response;
  try {
    res = await (c.fetchImpl ?? fetch)(url, { headers });
  } catch (err) {
    throw new RadarError(422, 'VALIDATION', `GitHub tidak bisa dihubungi untuk memeriksa headCommit (${err instanceof Error ? err.message : 'network error'}).`);
  }
  if (!res.ok) throw new RadarError(422, 'VALIDATION', `GitHub menolak pemeriksaan headCommit (HTTP ${res.status}).`);
  const body = (await res.json()) as { object?: { sha?: unknown } };
  const sha = typeof body.object?.sha === 'string' ? body.object.sha : '';
  if (c.headCommit.length < 7 || !sha.startsWith(c.headCommit)) {
    throw new RadarError(409, 'CONFLICT', `headCommit ${c.headCommit} bukan HEAD ${c.branch} di GitHub (${sha.slice(0, 7) || 'tidak ada'}).`);
  }
}
