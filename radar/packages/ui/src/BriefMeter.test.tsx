import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { BriefMeter } from './BriefMeter';

afterEach(cleanup);

it('marks a six-line brief as within budget', () => {
  render(<BriefMeter lines={6} maxLines={6} tokens={312} />);
  expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('6');
  expect(screen.getByText(/312 tok/)).toBeTruthy();
});
