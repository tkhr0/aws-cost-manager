import { test, expect } from './test';

test('analytics page loads and displays key elements', async ({ page }) => {
    await page.goto('/analytics');

    // Verify header
    await expect(page.locator('h1')).toContainText('詳細分析');



    // Verify granularity buttons
    await expect(page.getByText('月次')).toBeVisible();
    await expect(page.getByText('日次')).toBeVisible();

    // Verify table headers (using text locator for simplicity)
    await expect(page.getByText('サービス名')).toBeVisible();

    // Switch to daily to see the total column
    await page.getByText('日次').click();
    await expect(page.getByText('合計 (USD)')).toBeVisible();
});
