import { describe, expect, it } from 'vitest';
import { SITE } from './site';

describe('@radar/web site metadata', () => {
  it('names the product and the replay route', () => {
    expect(SITE.title).toBe('IBM Bob Live Collab');
    expect(SITE.demoPath).toBe('/demo');
    expect(SITE.disclaimer).toBe('Community hackathon project, not an official IBM product.');
  });
});
