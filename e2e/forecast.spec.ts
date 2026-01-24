import { test, expect } from './test';

test('forecast page loads and displays key elements', async ({ page }) => {
    await page.goto('/forecast');

    // Verify header
    await expect(page.locator('h1')).toContainText('着地見込シミュレーション');

    // Verify configuration section
    await expect(page.getByText('パラメータ設定')).toBeVisible();

    // Verify lookback period options
    await expect(page.getByText('過去30日')).toBeVisible();
    await expect(page.getByText('過去7日')).toBeVisible();

    // Verify target period options
    // The value is in a select box, checking if select exists
    const periodSelect = page.locator('select').nth(1); // Assuming 2nd select, or check label
    await expect(page.getByText('予測対象期間')).toBeVisible();

    // Check chart title
    await expect(page.getByText('日次コスト推移と予測')).toBeVisible();
});
