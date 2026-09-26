import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionCard } from './DecisionCard';

afterEach(cleanup);

describe('DecisionCard', () => {
  it('calls onApprove when the PM approves a pending proposal', () => {
    const onApprove = vi.fn();
    render(
      <DecisionCard
        title="Budi needs checkout.ts"
        reason="Queue Budi after T-1"
        status="pending"
        onApprove={onApprove}
        onDeny={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('hides decision actions in read-only mode', () => {
    render(
      <DecisionCard
        title="Budi needs checkout.ts"
        reason="Queue Budi after T-1"
        readOnly
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );
    expect(screen.getByText('Queue Budi after T-1')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
