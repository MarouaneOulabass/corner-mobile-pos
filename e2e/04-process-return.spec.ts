import { test, expect } from '@playwright/test';

test.describe('Process Return', () => {
  // Requires running server with test data
  test.skip();

  test('should navigate to returns page', async ({ page }) => {
    await page.goto('/returns/new');
    await expect(page.locator('text=Nouveau retour')).toBeVisible();
  });

  test('should search and select a recent sale', async ({ page }) => {
    await page.goto('/returns/new');

    await page.fill('[data-testid="sale-search"]', 'VNT-');
    await page.click('[data-testid="sale-result-0"]');

    await expect(page.locator('[data-testid="sale-items"]')).toBeVisible();
  });

  test('should select items to return', async ({ page }) => {
    await page.goto('/returns/new');

    await page.fill('[data-testid="sale-search"]', 'VNT-');
    await page.click('[data-testid="sale-result-0"]');

    // Select first item for return
    await page.check('[data-testid="return-item-0"]');

    await expect(page.locator('[data-testid="refund-amount"]')).toBeVisible();
  });

  test('should confirm return and show refund amount', async ({ page }) => {
    await page.goto('/returns/new');

    await page.fill('[data-testid="sale-search"]', 'VNT-');
    await page.click('[data-testid="sale-result-0"]');
    await page.check('[data-testid="return-item-0"]');

    await page.click('[data-testid="confirm-return"]');

    await expect(page.locator('text=Retour confirmé')).toBeVisible();
    await expect(page.locator('[data-testid="refund-total"]')).toBeVisible();
  });
});
