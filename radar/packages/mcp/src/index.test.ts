import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.js';

describe('@radar/mcp', () => {
  it('exposes the package identity and links @radar/common', async () => {
    const common = await import('@radar/common');
    expect(PACKAGE_NAME).toBe('@radar/mcp');
    expect(common.RADAR_CODENAME).toBe('radar');
  });
});
