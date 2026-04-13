import { test, expect } from '@playwright/test';

test.describe('Complete Sale Flow', () => {
  // Requires running server with test data
  test.skip();

  test('should navigate to POS page', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.locator('[data-testid="pos-search"]')).toBeVisible();
  });

  test('should search and add product to cart', async ({ page }) => {
    await page.goto('/pos');

    await page.fill('[data-testid="pos-search"]', 'iPhone 13');
    await page.click('[data-testid="search-result-0"]');

    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);
  });

  test('should edit price inline in cart', async ({ page }) => {
    await page.goto('/pos');

    await page.fill('[data-testid="pos-search"]', 'iPhone 13');
    await page.click('[data-testid="search-result-0"]');

    const priceInput = page.locator('[data-testid="cart-item-price-0"]');
    await priceInput.clear();
    await priceInput.fill('3000');

    await expect(page.locator('[data-testid="cart-total"]')).toContainText('3 000');
  });

  test('should select payment method and confirm sale', async ({ page }) => {
    await page.goto('/pos');

    // Add product
    await page.fill('[data-testid="pos-search"]', 'iPhone 13');
    await page.click('[data-testid="search-result-0"]');

    // Select cash payment
    await page.click('[data-testid="payment-cash"]');

    // Confirm sale
    await page.click('[data-testid="confirm-sale"]');

    // Verify receipt shown
    await expect(page.locator('[data-testid="receipt"]')).toBeVisible();
    await expect(page.locator('text=Vente confirmée')).toBeVisible();
  });

  test('should apply discount to sale', async ({ page }) => {
    await page.goto('/pos');

    await page.fill('[data-testid="pos-search"]', 'iPhone 13');
    await page.click('[data-testid="search-result-0"]');

    // Apply flat discount
    await page.click('[data-testid="add-discount"]');
    await page.fill('[data-testid="discount-amount"]', '200');
    await page.click('[data-testid="apply-discount"]');

    await expect(page.locator('[data-testid="cart-total"]')).toContainText('3 000');
  });
});
