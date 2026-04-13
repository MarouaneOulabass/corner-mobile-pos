import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  // Requires running server with test data
  test.skip();

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@cornermobile.ma');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Identifiants incorrects')).toBeVisible();
  });

  test('should display user name in header after login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@cornermobile.ma');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
  });
});
