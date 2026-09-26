import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LockChip } from './LockChip';

afterEach(cleanup);

describe('LockChip', () => {
  it.each([
    ['bebas', 'Free'],
    ['dipesan', 'Reserved'],
    ['dipegang', 'Held'],
    ['review', 'Review'],
  ] as const)('renders %s as %s', (state, label) => {
    render(<LockChip state={state} holder="A" />);
    expect(screen.getByLabelText(label).getAttribute('data-state')).toBe(state);
  });
});
