import { test, expect } from '@playwright/test';

test.describe('Repair Status Workflow', () => {
  // Requires running server with test data
  test.skip();

  test('should display repair detail page', async ({ page }) => {
    // Navigate to a known repair ticket
    await page.goto('/repairs');
    await page.click('[data-testid="repair-item-0"]');

    await expect(page.locator('[data-testid="repair-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="repair-timeline"]')).toBeVisible();
  });

  test('should change status from received to diagnosing', async ({ page }) => {
    await page.goto('/repairs');
    await page.click('[data-testid="repair-item-0"]');

    await expect(page.locator('[data-testid="repair-status"]')).toContainText('received');

    await page.click('[data-testid="advance-status"]');

    await expect(page.locator('[data-testid="repair-status"]')).toContainText('diagnosing');
  });

  test('should add timeline entry on status change', async ({ page }) => {
    await page.goto('/repairs');
    await page.click('[data-testid="repair-item-0"]');

    const timelineEntries = page.locator('[data-testid="timeline-entry"]');
    const countBefore = await timelineEntries.count();

    await page.click('[data-testid="advance-status"]');

    await expect(timelineEntries).toHaveCount(countBefore + 1);
  });

  test('should not allow skipping status steps', async ({ page }) => {
    await page.goto('/repairs');
    await page.click('[data-testid="repair-item-0"]');

    // Status should only allow next valid transition
    const skipButton = page.locator('[data-testid="skip-to-delivered"]');
    await expect(skipButton).not.toBeVisible();
  });

  test('should show customer notification option on ready status', async ({ page }) => {
    await page.goto('/repairs');
    // Find a repair in "ready" status
    await page.click('text=Prêt');
    await page.click('[data-testid="repair-item-0"]');

    await expect(page.locator('[data-testid="notify-customer"]')).toBeVisible();
  });
});
