import { expect, test } from '@playwright/test';

// Fase 11D1 langkah 17 DoD. Selectors are the contract handed to the BOB SLICE I1 prompt
// (plan/log/fase-11D1.md) — `/demo` must expose these `data-testid`s.
test.describe('/demo replay', () => {
  test('autoplay starts on load and the near-miss chapter appears within 30s at 8x', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('replay-play-toggle')).toHaveAttribute('data-playing', 'true');

    await page.getByTestId('replay-speed-8x').click();
    await expect(page.getByTestId('chapter-near-miss')).toBeVisible({ timeout: 30_000 });
  });

  test('clicking an event fills the Bob inside panel', async ({ page }) => {
    await page.goto('/demo');
    await page.getByTestId('replay-play-toggle').click(); // pause first, so the row stays put
    const firstEvent = page.getByTestId('bob-activity-row').first();
    await firstEvent.click();
    await expect(page.getByTestId('bob-inside-panel')).toContainText(/hook|mcp|mode/);
  });

  test('never calls out to another origin', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') external.push(req.url());
    });
    await page.goto('/demo');
    await page.waitForTimeout(2_000);
    expect(external).toEqual([]);
  });
});

test.describe('/ and /gallery smoke', () => {
  test('landing renders the two primary buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /watch the live replay/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /download for macos/i })).toBeVisible();
  });

  test('gallery renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/gallery');
    expect(errors).toEqual([]);
  });
});
