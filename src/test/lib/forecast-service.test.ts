
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDetailedForecast, ForecastOptions } from '@/lib/forecast-service';

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
            mockRecords.push({
                date: m,
                amount: 300,
                service: 'Service A',
            });
        }

        mockFindMany
            .mockResolvedValueOnce(mockRecords) // Regression & History
            .mockResolvedValueOnce([]); // MTD Actuals

        // Act
        const result = await calculateDetailedForecast('all', options);

        // Assert
        expect(result.forecast.length).toBeGreaterThanOrEqual(2);

        // Check daily avg in forecast
        // Input: 300/month. Daily is roughly 10 (300/30) ~ 9.6 (300/31).
        // Markup 10% -> 11 ~ 10.6.
        const firstPoint = result.forecast[0];
        // Relax expectation to allow for 28/30/31 day variations
        expect(firstPoint.dailyAvg).toBeGreaterThan(9.5);
        expect(firstPoint.dailyAvg).toBeLessThan(12.0);

        // Monthly total is dailyAvg * days. 10*30=300 approx.
        expect(firstPoint.monthlyTotal).toBeGreaterThan(250);
        expect(firstPoint.monthlyTotal).toBeLessThan(400);
    });

    it('should forecast increasing trend (with markup)', async () => {
        const options: ForecastOptions = {
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_12_months',
        };

        // Mock increasing history: Month 0: 100... Month 11: 1200
        const now = new Date();
        const mockRecords = [];
        for (let i = 0; i < 12; i++) {
            const m = new Date(now.getFullYear(), now.getMonth() - 12 + i, 15);
            mockRecords.push({
                date: m,
                amount: (i + 1) * 300,
                service: 'Service A',
            });
        }

        mockFindMany
            .mockResolvedValueOnce(mockRecords) // Regression & History
            .mockResolvedValueOnce([]); // MTD

        const result = await calculateDetailedForecast('all', options);

        // Check trend in DAILY AVG
        // Regression on last 6 months (7..12) should be positive
        const firstForecast = result.forecast[0].dailyAvg;
        const lastForecast = result.forecast[result.forecast.length - 1].dailyAvg;

        expect(lastForecast).toBeGreaterThan(firstForecast);
    });

    it('should not require lookbackDays in options (Regression Test)', async () => {
        const options: any = {
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_month',
        };

        mockFindMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        await expect(calculateDetailedForecast('all', options)).resolves.not.toThrow();
    });

    it('should exclude Tax/Support from regression and add 10% markup to forecast', async () => {
        const options: ForecastOptions = {
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_month',
        };

        const mockRecords = [];
        const now = new Date();
        for (let i = 0; i < 3; i++) {
            const m = new Date(now.getFullYear(), now.getMonth() - 3 + i, 15);
            mockRecords.push({ date: m, amount: 1000, service: 'Normal Service' });
            mockRecords.push({ date: m, amount: 500, service: 'Tax' });
            mockRecords.push({ date: m, amount: 300, service: 'AWS Support' });
        }

        mockFindMany
            .mockResolvedValueOnce(mockRecords) // Regression & History
            .mockResolvedValueOnce([]); // MTD

        const result = await calculateDetailedForecast('all', options);

        // Base Daily: 1000 / Days (30~31) ~ 33.3
        // Markup: x1.1 => ~36.6
        const firstPoint = result.forecast[0];
        expect(firstPoint.dailyAvg).toBeGreaterThan(31);
        expect(firstPoint.dailyAvg).toBeLessThan(40);

        // Verify Exclusion in Breakdown
        expect(result.serviceBreakdown.length).toBe(1);
        expect(result.serviceBreakdown[0].serviceName).toBe('Normal Service');
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
            .mockResolvedValueOnce(mockHistRecords) // Regression & History (First Call)
            .mockResolvedValueOnce([]); // MTD

        const result = await calculateDetailedForecast('all', options);

        // Chart history should only contain Normal (100)
        const histSum = result.history.reduce((a, b) => a + b.monthlyTotal, 0);
        expect(histSum).toBe(100);
    });
});
