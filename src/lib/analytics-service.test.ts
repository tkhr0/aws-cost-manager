import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnalyticsData } from './analytics-service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const { mockFindMany } = vi.hoisted(() => {
    return {
        mockFindMany: vi.fn(),
    };
});

vi.mock('@prisma/client', () => {
    return {
        PrismaClient: vi.fn().mockImplementation(() => ({
            costRecord: {
                findMany: mockFindMany,
            },
        })),
    };
});

describe('getAnalyticsData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should calculate Month-over-Month (MoM) metrics', async () => {
        // Arrange
        // Target: 2023-02
        const currentRecords = [
            { date: new Date('2023-02-01'), service: 'EC2', amount: 120 },
            { date: new Date('2023-02-01'), service: 'S3', amount: 50 },
        ];

        // Previous: 2023-01
        const previousRecords = [
            { date: new Date('2023-01-01'), service: 'EC2', amount: 100 },
            { date: new Date('2023-01-01'), service: 'S3', amount: 50 },
        ];

        // 1st call: Current Month
        mockFindMany.mockResolvedValueOnce(currentRecords);
        // 2nd call: Previous Month
        mockFindMany.mockResolvedValueOnce(previousRecords);

        // Act
        // Requesting for Feb 2023
        const result = await getAnalyticsData('all', '2023', '02', 'monthly');

        // Assert
        // EC2: Feb=120, Jan=100 -> Diff=20, Sq=20%
        const ec2Row = result.rows.find((r: any) => r.service === 'EC2');
        expect(ec2Row).toBeDefined();

        // MoM Columns
        expect((ec2Row as any).momAmount).toBe(20);
        expect((ec2Row as any).momPercentage).toBeCloseTo(20.0);

        // S3: Feb=50, Jan=50 -> Diff=0, Sq=0%
        const s3Row = result.rows.find((r: any) => r.service === 'S3');
        expect((s3Row as any).momAmount).toBe(0);
        expect((s3Row as any).momPercentage).toBe(0);
    });

    it('should query correct date ranges for target and previous month', async () => {
        mockFindMany.mockResolvedValue([]);

        // Act: 2023-03 (March 2023)
        // Should compare Mar 1-31 vs Feb 1-28
        await getAnalyticsData('all', '2023', '03', 'monthly');

        // Assert
        expect(mockFindMany).toHaveBeenCalledTimes(2);

        // Call 1: Current Month
        const firstCallArgs = mockFindMany.mock.calls[0][0];
        expect(firstCallArgs.where.date.gte.toISOString()).toContain('2023-03-01');
        expect(firstCallArgs.where.date.lte.toISOString()).toContain('2023-03-31');

        // Call 2: Previous Month
        const secondCallArgs = mockFindMany.mock.calls[1][0];
        expect(secondCallArgs.where.date.gte.toISOString()).toContain('2023-02-01');
        // Feb 28th 23:59:59.999Z
        expect(secondCallArgs.where.date.lte.toISOString()).toContain('2023-02-28');
    });

    it('should handle year boundary (Jan 2023 -> Dec 2022)', async () => {
        mockFindMany.mockResolvedValue([]);

        // Act: Jan 2023
        // Should compare Jan 1-31 vs Dec 1-31 (2022)
        await getAnalyticsData('all', '2023', '01', 'monthly');

        // Assert
        const secondCallArgs = mockFindMany.mock.calls[1][0];
        const prevStart = secondCallArgs.where.date.gte;
        const prevEnd = secondCallArgs.where.date.lte;

        expect(prevStart.toISOString()).toContain('2022-12-01');
        expect(prevEnd.toISOString()).toContain('2022-12-31');
    });

    it('should filter by accountId when specified', async () => {
        mockFindMany.mockResolvedValue([]);

        // Act
        const targetAccountId = '123456789012';
        await getAnalyticsData(targetAccountId, '2023', '04', 'monthly');

        // Assert
        // Check that findMany was called with the correct accountId in the where clause
        expect(mockFindMany).toHaveBeenCalled();

        // We expect 2 calls (current month and previous month)
        // Check both have the accountId filter

        // 1. Current Month Call
        const firstCallArgs = mockFindMany.mock.calls[0][0];
        expect(firstCallArgs.where.accountId).toBe(targetAccountId);

        // 2. Previous Month Call
        const secondCallArgs = mockFindMany.mock.calls[1][0];
        expect(secondCallArgs.where.accountId).toBe(targetAccountId);
    });
});
