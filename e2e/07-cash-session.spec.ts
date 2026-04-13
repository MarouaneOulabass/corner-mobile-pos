import { test, expect } from '@playwright/test';

test.describe('Cash Session Management', () => {
  // Requires running server with test data
  test.skip();

  test('should open a new cash session', async ({ page }) => {
    await page.goto('/pos');

    await page.click('[data-testid="open-cash-session"]');
    await page.fill('[data-testid="opening-amount"]', '1000');
    await page.click('[data-testid="confirm-open-session"]');

    await expect(page.locator('[data-testid="session-active"]')).toBeVisible();
    await expect(page.locator('text=Caisse ouverte')).toBeVisible();
  });

  test('should track sales during cash session', async ({ page }) => {
    await page.goto('/pos');

    // Make a sale
    await page.fill('[data-testid="pos-search"]', 'Coque');
    await page.click('[data-testid="search-result-0"]');
    await page.click('[data-testid="payment-cash"]');
    await page.click('[data-testid="confirm-sale"]');

    // Session total should update
    await expect(page.locator('[data-testid="session-total"]')).not.toContainText('0');
  });

  test('should close cash session with reconciliation', async ({ page }) => {
    await page.goto('/pos');

    await page.click('[data-testid="close-cash-session"]');
    await page.fill('[data-testid="closing-amount"]', '1500');
    await page.click('[data-testid="confirm-close-session"]');

    await expect(page.locator('[data-testid="session-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="expected-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="actual-amount"]')).toContainText('1 500');
  });

  test('should show difference between expected and actual amounts', async ({ page }) => {
    await page.goto('/pos');

    await page.click('[data-testid="close-cash-session"]');
    await page.fill('[data-testid="closing-amount"]', '1400');
    await page.click('[data-testid="confirm-close-session"]');

    await expect(page.locator('[data-testid="session-difference"]')).toBeVisible();
  });
});
