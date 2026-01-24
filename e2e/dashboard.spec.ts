import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock window.electron before page load
        await page.addInitScript(() => {
            window.electron = {
                getAccounts: async () => [
                    { id: 'acc-1', name: 'Test Account', accountId: '123456789012' }
                ],
                getDashboardData: async ({ month }: { month: string }) => {
                    // Return mock data for the chart
                    // month is formatted "YYYY-MM"
                    const [y, m] = month.split('-');
                    return {
                        records: [
                            { date: `${month}-01`, amount: 100, service: 'EC2' },
                            { date: `${month}-15`, amount: 50, service: 'S3' },
                        ],
                        serviceBreakdown: [],
                        budget: 1000,
                        forecast: 1200,
                        exchangeRate: 150,
                    };
                },
                syncCosts: async () => ({ daysSynced: 30 }),
                exportCsv: async () => ({ success: true, filePath: '/tmp/test.csv' }),
            } as any;
        });
    });

    test('loads dashboard and displays full month chart', async ({ page }) => {
        await page.goto('/');

        // Check title
        await expect(page).toHaveTitle(/AWS Cost Manager/);

        // Check header
        await expect(page.locator('h1')).toContainText('クラウドコスト');

        // Check stats are loaded
        await expect(page.locator('text=$150.00')).toBeVisible(); // 100 + 50

        // Check Chart
        // Since we used Recharts, it renders SVG.
        // We expect the chart container to be visible.
        // We verified in unit test that data is filled.
        // Here we can check if x-axis contains multiple ticks.
        // The "date-utils" fillDailyCosts ensures we have data for specific days.
        // Let's check if we can see the text for the 1st and maybe last day of month?
        // The chart formats date as "MMM D" (e.g., "Jan 1").

        // Get current month to know what text to expect
        const now = new Date();
        const monthShort = now.toLocaleDateString('en-US', { month: 'short' });

        // Check for "Jan 1" or similar
        // Note: Recharts XAxis might hide some ticks if space is limited, but "Jan 1" is usually first.
        // We wait for the chart to render something.
        const [y, m] = now.toISOString().split('-');
        const monthIndex = parseInt(m) - 1; // 0-based
        const monthName = new Date(parseInt(y), monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });

        // Expect "Jan 1" to be in the DOM
        await expect(page.locator(`text=${monthName} 1`).first()).toBeVisible({ timeout: 10000 });

        // We can verify that the "No data" alert is NOT visible
        await expect(page.locator('text=コストデータがありません')).not.toBeVisible();
    });
});
