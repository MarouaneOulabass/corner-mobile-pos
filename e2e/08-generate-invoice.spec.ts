import { test, expect } from '@playwright/test';

test.describe('Generate Invoice', () => {
  // Requires running server with test data
  test.skip();

  test('should navigate to new invoice page', async ({ page }) => {
    await page.goto('/accounting/invoices/new');
    await expect(page.locator('text=Nouvelle facture')).toBeVisible();
  });

  test('should fill invoice form with customer details', async ({ page }) => {
    await page.goto('/accounting/invoices/new');

    await page.fill('[name="customer_name"]', 'Mohammed Test');
    await page.fill('[name="customer_phone"]', '0661234567');
    await page.fill('[name="customer_ice"]', '001234567000089');
  });

  test('should add line items to invoice', async ({ page }) => {
    await page.goto('/accounting/invoices/new');

    await page.fill('[name="customer_name"]', 'Mohammed Test');

    // Add line item
    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="line-description-0"]', 'iPhone 13 128GB');
    await page.fill('[data-testid="line-quantity-0"]', '1');
    await page.fill('[data-testid="line-price-0"]', '3200');

    await expect(page.locator('[data-testid="invoice-total"]')).toContainText('3 200');
  });

  test('should submit invoice and get invoice number', async ({ page }) => {
    await page.goto('/accounting/invoices/new');

    await page.fill('[name="customer_name"]', 'Mohammed Test');
    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="line-description-0"]', 'iPhone 13 128GB');
    await page.fill('[data-testid="line-quantity-0"]', '1');
    await page.fill('[data-testid="line-price-0"]', '3200');

    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="invoice-number"]')).toBeVisible();
    await expect(page.locator('text=Facture créée')).toBeVisible();
  });

  test('should calculate TVA on invoice', async ({ page }) => {
    await page.goto('/accounting/invoices/new');

    await page.fill('[name="customer_name"]', 'Mohammed Test');
    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="line-description-0"]', 'iPhone 13 128GB');
    await page.fill('[data-testid="line-quantity-0"]', '1');
    await page.fill('[data-testid="line-price-0"]', '3200');

    // TVA at 20%
    await expect(page.locator('[data-testid="invoice-tva"]')).toContainText('640');
    await expect(page.locator('[data-testid="invoice-ttc"]')).toContainText('3 840');
  });
});
