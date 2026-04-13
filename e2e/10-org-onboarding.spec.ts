import { test, expect } from '@playwright/test';

test.describe('Organization Onboarding', () => {
  // Requires running server with test data
  test.skip();

  test.describe('Create new organization', () => {
    test('should display onboarding form', async ({ page }) => {
      await page.goto('/onboarding');
      await expect(page.locator('text=Créer votre organisation')).toBeVisible();
    });

    test('should fill organization details', async ({ page }) => {
      await page.goto('/onboarding');

      await page.fill('[name="org_name"]', 'Corner Mobile Test');
      await page.fill('[name="org_address"]', 'Rabat, Maroc');
      await page.fill('[name="org_phone"]', '0537123456');
      await page.fill('[name="org_ice"]', '001234567000089');
    });
  });

  test.describe('Create store', () => {
    test('should add a store to the organization', async ({ page }) => {
      await page.goto('/onboarding/store');

      await page.fill('[name="store_name"]', 'Corner Mobile M1');
      await page.fill('[name="store_location"]', 'Centre Commercial Ait Baha, Rabat');
      await page.click('button[type="submit"]');

      await expect(page.locator('text=Magasin créé')).toBeVisible();
    });
  });

  test.describe('Create user', () => {
    test('should create admin user for the organization', async ({ page }) => {
      await page.goto('/onboarding/user');

      await page.fill('[name="user_name"]', 'Admin Test');
      await page.fill('[name="user_email"]', 'admin@test-org.ma');
      await page.fill('[name="user_password"]', 'SecurePass123!');
      await page.selectOption('[name="user_role"]', 'manager');
      await page.click('button[type="submit"]');

      await expect(page.locator('text=Utilisateur créé')).toBeVisible();
    });
  });

  test.describe('Data isolation', () => {
    test('should only see own organization data after login', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[type="email"]', 'admin@test-org.ma');
      await page.fill('input[type="password"]', 'SecurePass123!');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL('/');
      // Should not see data from other organizations
      await page.goto('/stock');
      await expect(page.locator('[data-testid="stock-count"]')).toContainText('0');
    });
  });
});
