
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
        const firstPoint = result.forecast[0];
        expect(firstPoint.amount).toBeCloseTo(300 / 30, 0); // Approx 10
    });

    it('should forecast increasing trend', async () => {
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
});
