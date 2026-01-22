
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardData } from './dashboard-service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const { mockFindMany, mockFindFirst, mockAccountFindUnique, mockAccountFindMany } = vi.hoisted(() => {
    return {
        mockFindMany: vi.fn(),
        mockFindFirst: vi.fn(),
        mockAccountFindUnique: vi.fn(),
        mockAccountFindMany: vi.fn(),
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
            account: {
                findUnique: mockAccountFindUnique,
                findMany: mockAccountFindMany,
            },
            forecast: {
                findFirst: vi.fn(),
            },
        })),
    };
});

describe('getDashboardData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should exclude "Tax" records from aggregation and service breakdown', async () => {
        // Arrange
        const mockRecords = [
            {
                date: new Date('2023-01-01'),
                service: 'AmazonEC2',
                amount: 100,
                recordType: 'AmortizedCost',
            },
            {
                date: new Date('2023-01-01'),
                service: 'Tax', // Should be excluded
                amount: 10,
                recordType: 'Tax',
            },
            {
                date: new Date('2023-01-02'),
                service: 'AmazonS3',
                amount: 50,
                recordType: 'AmortizedCost',
            },
        ];

        mockFindMany.mockResolvedValue(mockRecords);
        mockFindFirst.mockResolvedValue({ amount: 1000 }); // Budget
        mockAccountFindUnique.mockResolvedValue({ budget: 1000, exchangeRate: 150 }); // Account


        // Act
        const result = await getDashboardData('total-acc');

        // Assert
        // 1. Total Aggregated Records
        // Should contain EC2 (100) and S3 (50). Total 150.
        const totalAmount = result.records.reduce((sum: number, r: any) => sum + r.amount, 0);
        expect(totalAmount).toBe(150);

        // 2. Service Breakdown
        // Should NOT contain 'Tax'
        const taxEntry = result.serviceBreakdown.find((s: any) => s.name === 'Tax');
        expect(taxEntry).toBeUndefined();

        const ec2Entry = result.serviceBreakdown.find((s: any) => s.name === 'AmazonEC2');
        expect(ec2Entry).toBeDefined();
        expect(ec2Entry?.amount).toBe(100);
    });
});
