import { test, expect } from '@playwright/test';

test.describe('Create Repair Ticket', () => {
  // Requires running server with test data
  test.skip();

  test('should navigate to new repair page', async ({ page }) => {
    await page.goto('/repairs/new');
    await expect(page.locator('text=Nouvelle réparation')).toBeVisible();
  });

  test('should fill customer and device info', async ({ page }) => {
    await page.goto('/repairs/new');

    // Customer info
    await page.fill('[name="customer_phone"]', '0661234567');
    await page.fill('[name="customer_name"]', 'Mohammed Test');

    // Device info
    await page.fill('[name="device_brand"]', 'Samsung');
    await page.fill('[name="device_model"]', 'Galaxy S23');
    await page.fill('[name="imei"]', '358765432109876');
  });

  test('should select problem type and submit', async ({ page }) => {
    await page.goto('/repairs/new');

    await page.fill('[name="customer_phone"]', '0661234567');
    await page.fill('[name="customer_name"]', 'Mohammed Test');
    await page.fill('[name="device_brand"]', 'Samsung');
    await page.fill('[name="device_model"]', 'Galaxy S23');

    // Select problem
    await page.click('text=Ecran cassé');
    await page.fill('[name="problem_description"]', 'Ecran fissuré en haut à droite');
    await page.fill('[name="estimated_cost"]', '800');

    await page.click('button[type="submit"]');

    // Verify ticket created
    await expect(page.locator('text=Ticket créé')).toBeVisible();
  });

  test('should create repair with deposit', async ({ page }) => {
    await page.goto('/repairs/new');

    await page.fill('[name="customer_phone"]', '0661234567');
    await page.fill('[name="customer_name"]', 'Mohammed Test');
    await page.fill('[name="device_brand"]', 'Apple');
    await page.fill('[name="device_model"]', 'iPhone 14');
    await page.click('text=Batterie');
    await page.fill('[name="estimated_cost"]', '500');
    await page.fill('[name="deposit"]', '200');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=Ticket créé')).toBeVisible();
  });
});
