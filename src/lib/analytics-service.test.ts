
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
        const result = await getAnalyticsData('all', '2023-02-01', '2023-02-28', 'monthly');

        // Assert
        // EC2: Feb=120, Jan=100 -> Diff=20, Sq=20%
        const ec2Row = result.rows.find((r: any) => r.service === 'EC2');
        expect(ec2Row).toBeDefined();
        // Dynamic key for Feb
        expect(Number(ec2Row!['2023-02'])).toBe(120);

        // MoM Columns
        // Note: The implementation needs to add these.
        expect((ec2Row as any).momAmount).toBe(20);
        expect((ec2Row as any).momPercentage).toBeCloseTo(20.0);

        // S3: Feb=50, Jan=50 -> Diff=0, Sq=0%
        const s3Row = result.rows.find((r: any) => r.service === 'S3');
        expect((s3Row as any).momAmount).toBe(0);
        expect((s3Row as any).momPercentage).toBe(0);
    });
});
