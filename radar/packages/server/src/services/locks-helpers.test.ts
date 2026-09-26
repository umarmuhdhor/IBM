// Fase 05: helpers of the lock engine that checkWrite builds on (R4 §2, §4, §6.3).
import { describe, expect, it } from 'vitest';
import { getMember } from '../db/repo/member';
import { getProposal, insertProposal } from '../db/repo/proposal';
import { getTask } from '../db/repo/task';
import { NOW, withLocks } from '../../test/lock-fixture';
import { commitClaimActive, isIgnoredPath, resolveActiveTask, returnTaskToWorking } from './locks';

describe('resolveActiveTask (R4 §4)', () => {
  it('prefers active_task_id, then the latest dikerjakan task, then the oldest terbuka task', async () => {
    await withLocks((f) => {
      const open1 = f.task('A');
      f.task('A');
      expect(resolveActiveTask(f.ctx, 'A').id).toBe(open1.id);
      const working = f.task('A', 'dikerjakan');
      f.db.run('UPDATE member SET active_task_id = NULL WHERE id = ?', 'A');
      expect(resolveActiveTask(f.ctx, 'A').id).toBe(working.id);
      expect(getMember(f.db, 'A')?.active_task_id).toBe(working.id);
      f.db.run('UPDATE member SET active_task_id = ? WHERE id = ?', open1.id, 'A');
      expect(resolveActiveTask(f.ctx, 'A').id).toBe(open1.id);
    });
  });

  it('ignores a finished active task and creates an ad-hoc task when nothing is left', async () => {
    await withLocks((f) => {
      const done = f.task('B', 'selesai');
      f.db.run('UPDATE member SET active_task_id = ? WHERE id = ?', done.id, 'B');
      const t = resolveActiveTask(f.ctx, 'B');
      expect(t).toMatchObject({ adhoc: 1, status: 'dikerjakan', owner_id: 'B', title: 'Ad-hoc Budi' });
      expect(f.events()).toEqual(['task.created']);
    });
  });
});

describe('lock helpers', () => {
  it('treats a commit claim as active only below COMMIT_CLAIM_TTL_MS', () => {
    expect(commitClaimActive({ commit_started_at: null }, NOW)).toBe(false);
    expect(commitClaimActive({ commit_started_at: NOW - 1000 }, NOW)).toBe(true);
    expect(commitClaimActive({ commit_started_at: NOW - 60_000 }, NOW)).toBe(false);
  });

  it('ignores default patterns and the workspace .gitignore held by the server', async () => {
    await withLocks(
      (f) => {
        expect(isIgnoredPath(f.db, 'node_modules/x.js')).toBe(true);
        expect(isIgnoredPath(f.db, 'notes/todo.md')).toBe(true);
        expect(isIgnoredPath(f.db, 'src/app.ts')).toBe(false);
      },
      [{ path: '.gitignore', content: 'notes/\n' }],
    );
  });

  it('returnTaskToWorking puts every lock back to dipegang and expires pending reviews', async () => {
    await withLocks((f) => {
      const t = f.task('A', 'review');
      f.lock('a.ts', t, 'review');
      f.lock('b.ts', t, 'review');
      const p = insertProposal(f.db, { kind: 'review', payload: '{}', reason: 'r', refId: t.id, createdBy: 'C', now: NOW });
      returnTaskToWorking(f.ctx, t.id, 'A');
      expect(f.count("SELECT count(*) AS n FROM lock WHERE task_id = ? AND state = 'dipegang'", t.id)).toBe(2);
      expect(getProposal(f.db, p.id)?.status).toBe('kedaluwarsa');
      expect(getTask(f.db, t.id)?.status).toBe('dikerjakan');
      expect(f.events()).toEqual(['lock.acquired', 'lock.acquired', 'proposal.decided', 'task.status']);
      expect(f.ctx.uow.toSync.map((m) => m.msg.t)).toEqual(['lock.changed', 'lock.changed']);
    });
  });
});
