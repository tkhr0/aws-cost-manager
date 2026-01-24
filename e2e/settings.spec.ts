import { test, expect } from './test';

test('settings page loads and displays key elements', async ({ page }) => {
    await page.goto('/settings');

    // Verify header
    await expect(page.locator('h1')).toContainText('設定');

    // Verify section header
    await expect(page.getByText('AWSアカウント設定')).toBeVisible();

    // Verify add button
    await expect(page.getByText('アカウント追加')).toBeVisible();

    // Verify debug tools section
    await expect(page.getByText('デバッグツール')).toBeVisible();
});
