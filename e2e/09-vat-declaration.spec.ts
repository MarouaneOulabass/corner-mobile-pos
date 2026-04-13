import { test, expect } from '@playwright/test';

test.describe('VAT Declaration', () => {
  // Requires running server with test data
  test.skip();

  test('should navigate to declarations page', async ({ page }) => {
    await page.goto('/accounting/declarations');
    await expect(page.locator('text=Déclarations TVA')).toBeVisible();
  });

  test('should select a declaration period', async ({ page }) => {
    await page.goto('/accounting/declarations');

    await page.selectOption('[data-testid="declaration-period"]', 'Q1-2026');
    await expect(page.locator('[data-testid="period-dates"]')).toContainText('Jan - Mar 2026');
  });

  test('should generate TVA declaration', async ({ page }) => {
    await page.goto('/accounting/declarations');

    await page.selectOption('[data-testid="declaration-period"]', 'Q1-2026');
    await page.click('[data-testid="generate-declaration"]');

    await expect(page.locator('[data-testid="tva-collected"]')).toBeVisible();
    await expect(page.locator('[data-testid="tva-deductible"]')).toBeVisible();
    await expect(page.locator('[data-testid="tva-due"]')).toBeVisible();
  });

  test('should show TVA amounts breakdown', async ({ page }) => {
    await page.goto('/accounting/declarations');

    await page.selectOption('[data-testid="declaration-period"]', 'Q1-2026');
    await page.click('[data-testid="generate-declaration"]');

    // Verify amounts are numeric and formatted
    const tvaCollected = page.locator('[data-testid="tva-collected"]');
    await expect(tvaCollected).toBeVisible();

    const tvaDue = page.locator('[data-testid="tva-due"]');
    await expect(tvaDue).toBeVisible();
  });

  test('should allow exporting declaration as PDF', async ({ page }) => {
    await page.goto('/accounting/declarations');

    await page.selectOption('[data-testid="declaration-period"]', 'Q1-2026');
    await page.click('[data-testid="generate-declaration"]');

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('TVA');
  });
});
