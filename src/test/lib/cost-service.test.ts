
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncAwsCosts, getAvailableMonths } from '@/lib/cost-service';

// Mock dependencies
// Define mockGetCostAndUsage in outer scope or setup in test
const mockGetCostAndUsage = vi.fn();

vi.mock('@/lib/aws-client', () => {
    return {
        AwsCostClient: vi.fn().mockImplementation(() => ({
            getCostAndUsage: mockGetCostAndUsage
        }))
    };
});

vi.mock('@prisma/client', () => {
    const mPrisma = {
        account: {
            findUnique: vi.fn(),
        },
        costRecord: {
            upsert: vi.fn(),
            findMany: vi.fn(), // Added for getAvailableMonths tests
        },
    };
    return { PrismaClient: vi.fn(() => mPrisma) };
});

describe('syncAwsCosts', () => {
    // Access the mocked Prisma instance
    // Since we mocked the constructor, we need to get the instance that was returned
    // But for simplicity in this mocked module approach, we can grab the mock functions directly if we expose them or use a helper.
    // However, vitest's vi.mock behavior on constructor usually requires a specific setup.
    // A simpler way for Prisma is using `vi.mock` factory correctly.

    // Let's rely on importing the mocked client and accessing its methods if possible, 
    // or just assume the mock implementation we provided above works as a singleton for this test file.

    // Actually, `const prisma = new PrismaClient()` is called at the top level of cost-service.ts.
    // So we need to make sure that mock is in place before that file is imported. 
    // Vitest hoists vi.mock, so it should be fine.

    let db: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Re-import to ensure we get the fresh mock if needed, but typically jest/vitest handles this.
        // We need to get the mock object to assert on it.
        // Since `new PrismaClient()` returns our mock object, we can capture it.
        const { PrismaClient } = await import('@prisma/client');
        db = new PrismaClient();
    });

    it('should fetch AmortizedCost and save it with recordType="AmortizedCost"', async () => {
        // Arrange
        const accountId = '123456789012';
        const profileName = 'test-profile';
        const startDate = '2023-01-01';
        const endDate = '2023-01-02';

        // Mock DB Account
        db.account.findUnique.mockResolvedValue({
            id: 'acc-123',
            accountId,
        });

        // Mock AWS Client Response
        // We expect the implementation to ask for AmortizedCost
        mockGetCostAndUsage.mockResolvedValue([
            {
                TimePeriod: { Start: '2023-01-01', End: '2023-01-02' },
                Groups: [
                    {
                        Keys: ['AmazonEC2'],
                        Metrics: {
                            // The real AWS response will include AmortizedCost if requested
                            AmortizedCost: { Amount: '10.5', Unit: 'USD' },
                            UnblendedCost: { Amount: '9.0', Unit: 'USD' }, // Unblended is different
                        },
                    },
                ],
            },
        ]);

        // Clear previous calls
        mockGetCostAndUsage.mockClear();

        // No need to re-mock implementation here as it's defined in the factory


        // Act
        await syncAwsCosts(accountId, profileName, startDate, endDate);

        // Assert
        expect(mockGetCostAndUsage).toHaveBeenCalled();

        // Verify upsert was called with AmortizedCost values
        expect(db.costRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
                amount: 10.5, // Should use AmortizedCost
                recordType: 'AmortizedCost', // Should use this type
                service: 'AmazonEC2',
            }),
        }));
    });
});

describe('getAvailableMonths', () => {
    let db: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { PrismaClient } = await import('@prisma/client');
        db = new PrismaClient();
    });

    it('should return empty array when no data exists', async () => {
        db.costRecord.findMany.mockResolvedValue([]);
        const months = await getAvailableMonths();
        expect(months).toEqual([]);
    });

    it('should return available months in descending order', async () => {
        // Mock data
        db.costRecord.findMany.mockResolvedValue([
            { date: new Date('2023-01-15') },
            { date: new Date('2023-02-20') },
            { date: new Date('2023-01-01') },
        ]);

        // Logic test: The service should process these into unique YYYY-MM strings
        const months = await getAvailableMonths();
        expect(months).toEqual(['2023-02', '2023-01']);
    });

    it('should filter by accountId', async () => {
        db.costRecord.findMany.mockResolvedValue([
            { date: new Date('2023-03-01') },
        ]);

        await getAvailableMonths('acc-123');

        expect(db.costRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { accountId: 'acc-123' }
        }));
    });
});
