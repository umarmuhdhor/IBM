import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReviewCard } from './ReviewCard';

afterEach(cleanup);

it('shows the diff and delegates review actions', () => {
  const onApprove = vi.fn();
  const onSendBack = vi.fn();
  render(<ReviewCard title="Checkout review" added={12} removed={3} fileCount={2} verdict="Ready" onApprove={onApprove} onSendBack={onSendBack} />);
  expect(screen.getByText('+12 −3 · 2 files')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Approve & commit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
  expect(onApprove).toHaveBeenCalledOnce();
  expect(onSendBack).toHaveBeenCalledOnce();
});
