import { test, expect } from '@playwright/test';

test.describe('Create Product', () => {
  // Requires running server with test data
  test.skip();

  test('should navigate to add product page', async ({ page }) => {
    await page.goto('/stock/add');
    await expect(page.locator('text=Ajouter un produit')).toBeVisible();
  });

  test('should fill product form and submit', async ({ page }) => {
    await page.goto('/stock/add');

    await page.selectOption('[name="product_type"]', 'phone');
    await page.fill('[name="brand"]', 'Apple');
    await page.fill('[name="model"]', 'iPhone 13');
    await page.fill('[name="storage"]', '128GB');
    await page.fill('[name="color"]', 'Bleu');
    await page.selectOption('[name="condition"]', 'good');
    await page.fill('[name="imei"]', '353456789012345');
    await page.fill('[name="purchase_price"]', '2500');
    await page.fill('[name="selling_price"]', '3200');

    await page.click('button[type="submit"]');

    // Should redirect to stock list
    await expect(page).toHaveURL('/stock');
  });

  test('should reject duplicate IMEI', async ({ page }) => {
    await page.goto('/stock/add');

    await page.fill('[name="imei"]', '353456789012345');
    await page.fill('[name="brand"]', 'Apple');
    await page.fill('[name="model"]', 'iPhone 13');
    await page.fill('[name="purchase_price"]', '2500');
    await page.fill('[name="selling_price"]', '3200');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=IMEI existe')).toBeVisible();
  });

  test('should validate IMEI format with Luhn algorithm', async ({ page }) => {
    await page.goto('/stock/add');

    await page.fill('[name="imei"]', '000000000000000');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=IMEI invalide')).toBeVisible();
  });

  test('should show product in stock list after creation', async ({ page }) => {
    await page.goto('/stock');
    await page.fill('[data-testid="search-input"]', 'iPhone 13');

    await expect(page.locator('text=iPhone 13')).toBeVisible();
    await expect(page.locator('text=3 200')).toBeVisible();
  });
});
