import { describe, expect, it } from 'vitest';
import { shouldAutoplayReplay } from './autoplay';

describe('shouldAutoplayReplay', () => {
  it('autoplays when the user has not asked for reduced motion', () => {
    expect(shouldAutoplayReplay(false)).toBe(true);
  });

  it('stays paused when prefers-reduced-motion is reduce', () => {
    expect(shouldAutoplayReplay(true)).toBe(false);
  });
});
