
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDetailedForecast, ForecastOptions } from './forecast-service';
import { PrismaClient } from '@prisma/client';

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

    it('should forecast for "next_month"', async () => {
        // Arrange
        const options: ForecastOptions = {
            lookbackDays: 30,
            adjustmentFactor: 1.0,
            additionalFixedCost: 0,
            period: 'next_month', // New option
        };

        // Mock recent history (Last 30 days) to establish a trend
        // Say total $300 over 30 days => $10/day average
        const mockLookbackRecords = Array.from({ length: 30 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - 30 + i);
            return {
                date: d,
                amount: 10,
                service: 'Total',
            };
        });

        // 1st call: Target Period (Next Month forecast) -> Should return EMPTY (future)
        mockFindMany.mockResolvedValueOnce([]);

        // 2nd call: Lookback Data -> Used for trend calculation (return mock data)
        mockFindMany.mockResolvedValueOnce(mockLookbackRecords);

        // Act
        const result = await calculateDetailedForecast('all', options);

        // Assert
        // Forecast should cover next month. 
        // We expect about 30 days (depending on month) of forecast data.
        expect(result.forecast.length).toBeGreaterThanOrEqual(28);
        expect(result.forecast.length).toBeLessThanOrEqual(31);

        // Checking amount
        // Daily average $10 * days + fixed 0
        const total = result.totalPredicted;
        const days = result.forecast.length;
        // The totalPredicted should NOT include current month actuals (0 for next month)
        // It should equal Forecast Total
        expect(total).toBeCloseTo(10 * days);

        // Verify start date of forecast is next month 1st
        const firstForecast = result.forecast[0];
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const expectedDateStr = nextMonth.toISOString().split('T')[0];
        expect(firstForecast.date).toBe(expectedDateStr);
    });
});
