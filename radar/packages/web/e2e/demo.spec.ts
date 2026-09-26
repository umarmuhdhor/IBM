import { expect, test } from '@playwright/test';

// Fase 11D1 langkah 17 DoD. Selectors are the contract handed to the BOB SLICE I1 prompt
// (plan/log/fase-11D1.md) — `/demo` must expose these `data-testid`s.
test.describe('/demo replay', () => {
  test('autoplay starts on load and the near-miss chapter appears within 30s at 8x', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/demo');
    await expect(page.getByTestId('replay-play-toggle')).toHaveAttribute('data-playing', 'true');

    await page.getByTestId('replay-speed-8x').click();
    await expect(page.getByTestId('chapter-near-miss')).toBeVisible({ timeout: 30_000 });
  });

  test('clicking an event fills the Bob inside panel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/demo');
    await expect(page.getByTestId('replay-play-toggle')).toBeVisible();
    // t=0 has no bob.activity yet — seek to the near-miss chapter, then pause so the row stays put.
    await page.getByTestId('chapter-near-miss').click();
    await expect(page.getByTestId('bob-activity-row').first()).toBeVisible();
    await page.getByTestId('replay-play-toggle').click();
    await page.getByTestId('bob-activity-row').first().click();
    await expect(page.getByTestId('bob-inside-panel')).toContainText(/hook|mcp|mode/);
  });

  test('stays paused when the user prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/demo');
    await expect(page.getByTestId('replay-play-toggle')).toHaveAttribute('data-playing', 'false');
  });

  test('never calls out to another origin', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') external.push(req.url());
    });
    await page.goto('/demo');
    // Directory listing of public/demo/*.json also has zero external calls — require the
    // real replay chrome first so this cannot pass on the wrong document.
    await expect(page.getByTestId('replay-play-toggle')).toBeVisible();
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
    await expect(page.getByRole('heading', { name: /@radar\/ui Component Gallery/i })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
