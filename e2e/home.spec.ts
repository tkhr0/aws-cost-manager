import { test, expect } from '@playwright/test';

test('dashboard page loads', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/AWS Cost Manager/);

    // Check for the dashboard header or a key element
    await expect(page.locator('h1')).toBeVisible();
});
