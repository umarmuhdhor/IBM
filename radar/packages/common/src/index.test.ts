import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, RADAR_CODENAME } from './index.js';

describe('@radar/common', () => {
  it('exposes the package identity', () => {
    expect(PACKAGE_NAME).toBe('@radar/common');
    expect(RADAR_CODENAME).toBe('radar');
  });
});
