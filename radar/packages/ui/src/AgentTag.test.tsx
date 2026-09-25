import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentTag } from './index';

afterEach(cleanup);

describe('AgentTag', () => {
  it('renders the agent label with an accessible name', () => {
    render(<AgentTag label="IBM Bob" member="A" />);
    const tag = screen.getByText('IBM Bob');
    expect(tag.getAttribute('data-member')).toBe('A');
    expect(tag.getAttribute('aria-label')).toBe('Agent IBM Bob, member A');
  });
});
