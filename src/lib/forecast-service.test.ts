
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDetailedForecast, ForecastOptions } from './forecast-service';

// Mock Prisma
const { mockFindMany, mockFindFirst } = vi.hoisted(() => {
    return {
        mockFindMany: vi.fn(),
        mockFindFirst: vi.fn(),
    };
});

vi.mock('@prisma/client', () => {
    return {
        PrismaClient: vi.fn().mockImplementation(() => ({
            costRecord: {
                findMany: mockFindMany,
            },
            budget: {
                findFirst: mockFindFirst,
            },
        })),
    };
});

describe('calculateDetailedForecast', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should forecast for "next_month" using linear regression (flat trend)', async () => {
        // Arrange
        const options: ForecastOptions = {
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_month',
        };

        // Mock 1 year of history for Service A
        const now = new Date();
        const mockRecords = [];
        for (let i = 0; i < 12; i++) {
            const m = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
            // Add 1 record per month with $300 (Daily avg $10 approx)
            mockRecords.push({
                date: m,
                amount: 300,
                service: 'Service A',
            });
        }

        // 1st mock: Forecast Period data (empty)
        // 2nd mock: Lookback data (1 year)
        // 3rd mock: Chart History (recent)
        // 4th mock: MTD data (recent)

        // forecast-service calls:
        // 1. findMany (Lookback) - Wait, new logic calls lookback first? No, logic sequence:
        // step 2: Lookback (Last 12 months)
        // step 5: Chart History 
        // step 6: MTD Actuals

        // Actually the code does:
        // 2. Fetch History (Lookback)
        // 5. Build History (Chart)
        // 6. MTD Actuals

        mockFindMany
            .mockResolvedValueOnce(mockRecords) // Regression Data
            .mockResolvedValueOnce([]) // Chart History
            .mockResolvedValueOnce([]); // MTD Actuals

        // Act
        const result = await calculateDetailedForecast('all', options);

        // Assert
        // Flat trend of $300/month -> Daily avg ~$10
        // Forecast for next month (approx 30 days) -> Total ~$300

        // Check forecast length (Next month only)
        // next_month target end is 2 months ahead?
        // Logic: targetEnd = new Date(currentYear, currentMonth + 2, 0); => End of Next Month.
        // Start is Today.
        // So it forecasts "Remains of this month" + "Next Month".

        expect(result.forecast.length).toBeGreaterThan(28); // Should cover at least next month

        // Check daily amount in forecast
        // Since input was monthly sum 300, daily avg is ~10.
        // [Updated Logic] We apply 1.1x markup for Support Cost estimation.
        // Expected: 10 * 1.1 = 11
        const firstPoint = result.forecast[0].amount;
        expect(firstPoint).toBeCloseTo((300 / 30) * 1.1, 0); // Approx 11
    });

    it('should forecast increasing trend (with markup)', async () => {
        const options: ForecastOptions = {
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_12_months',
        };

        // Mock increasing history: Month 0: 100, Month 1: 200 ... Month 11: 1200
        const now = new Date();
        const mockRecords = [];
        for (let i = 0; i < 12; i++) {
            const m = new Date(now.getFullYear(), now.getMonth() - 12 + i, 15);
            mockRecords.push({
                date: m,
                amount: (i + 1) * 300, // Increasing by 300 each month
                service: 'Service A',
            });
        }

        mockFindMany
            .mockResolvedValueOnce(mockRecords)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const result = await calculateDetailedForecast('all', options);

        // Trend: +10 daily increase per month roughly?
        // Month 0: 300 (Daily 10)
        // Month 1: 600 (Daily 20)
        // Slope should be positive.

        const firstForecast = result.forecast[0].amount;
        const lastForecast = result.forecast[result.forecast.length - 1].amount;

        expect(lastForecast).toBeGreaterThan(firstForecast);
    });

    it('should not require lookbackDays in options (Regression Test)', async () => {
        // This test ensures that the service does NOT depend on 'lookbackDays' being present.
        // The old logic triggered "Invalid Date" if lookbackDays was undefined.
        const options: any = { // Force any to simulate missing property type-check if strict
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_month',
            // lookbackDays is explicitly OMITTED
        };

        mockFindMany.mockResolvedValue([]); // Return empty to just pass the date calculation phase

        // Should not throw
        await expect(calculateDetailedForecast('all', options)).resolves.not.toThrow();
    });

    it('should exclude Tax/Support from regression and add 10% markup to forecast', async () => {
        // Mock data:
        // Service Normal: $1000/month constant
        // Service Tax: $500/month (Should be ignored)
        // Service Support: $300/month (Should be ignored)

        // Total Input per month = 1800
        // Expected Logic:
        // Regression Base = 1000 (Normal only)
        // Forecast (Next Month) Base = 1000
        // Markup 10% -> 1100
        // Result Forecast sum should match daily distribution of 1100.

        const options: ForecastOptions = {
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_month',
        };

        const mockRecords = [];
        const now = new Date();
        // 3 months of data to trigger regression (or flat)
        for (let i = 0; i < 3; i++) {
            const m = new Date(now.getFullYear(), now.getMonth() - 3 + i, 15);
            mockRecords.push({ date: m, amount: 1000, service: 'Normal Service' });
            mockRecords.push({ date: m, amount: 500, service: 'Tax' });
            mockRecords.push({ date: m, amount: 300, service: 'AWS Support' });
        }

        mockFindMany
            .mockResolvedValueOnce(mockRecords) // Regression Source
            .mockResolvedValueOnce([]) // Chart History
            .mockResolvedValueOnce([]); // MTD

        const result = await calculateDetailedForecast('all', options);

        // Analyze forecast sum
        const forecastSum = result.forecast.reduce((a, b) => a + b.amount, 0);

        // Expected Base: $1000 * 1.1 = $1100
        // Approx range
        expect(forecastSum).toBeGreaterThan(1050);
        expect(forecastSum).toBeLessThan(1150);

        // Ensure it is NOT 1800+ (which would mean exclusion failed)
        expect(forecastSum).toBeLessThan(1500);

        // Verify Chart History Exclusion
        // Step 5 of the service queries for chart history. 
        // We mocked the second mockFindMany call to return empty array above, 
        // so we can't strictly verify it here without changing mocks.
    });

    it('should exclude Tax/Support from chart history results', async () => {
        const options: ForecastOptions = {
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_month',
        };

        const mockHistRecords = [
            { date: new Date(), amount: 100, service: 'Normal' },
            { date: new Date(), amount: 50, service: 'Tax' },
            { date: new Date(), amount: 30, service: 'AWS Support' }
        ];

        mockFindMany
            .mockResolvedValueOnce([]) // Regression
            .mockResolvedValueOnce(mockHistRecords) // Chart History
            .mockResolvedValueOnce([]); // MTD

        const result = await calculateDetailedForecast('all', options);

        // Chart history should only contain Normal (100)
        const histSum = result.history.reduce((a, b) => a + b.amount, 0);
        expect(histSum).toBe(100);
    });
});
