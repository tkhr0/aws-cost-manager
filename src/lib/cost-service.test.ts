
import { describe, it, expect, beforeEach } from 'vitest';
import { getAvailableMonths, addAccount } from './cost-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('cost-service', () => {
    describe('getAvailableMonths', () => {
        it('should return empty array when no data exists', async () => {
            const months = await getAvailableMonths();
            expect(months).toEqual([]);
        });

        it('should return available months in descending order', async () => {
            // Setup data
            const account = await addAccount('Test Account', '123456789012', 'test-profile');

            // Insert some cost records directly via prisma to avoid making external API calls
            await prisma.costRecord.createMany({
                data: [
                    {
                        date: new Date('2023-01-15'),
                        amount: 100,
                        service: 'Amazon EC2',
                        accountId: account.id,
                        recordType: 'Usage',
                    },
                    {
                        date: new Date('2023-02-20'),
                        amount: 200,
                        service: 'Amazon S3',
                        accountId: account.id,
                        recordType: 'Usage',
                    },
                    {
                        date: new Date('2023-01-01'), // Same month as first
                        amount: 50,
                        service: 'Amazon RDS',
                        accountId: account.id,
                        recordType: 'Usage',
                    }
                ]
            });

            const months = await getAvailableMonths();
            expect(months).toEqual(['2023-02', '2023-01']);
        });

        it('should filter by accountId', async () => {
            const account1 = await addAccount('Account 1', '111111111111', 'p1');
            const account2 = await addAccount('Account 2', '222222222222', 'p2');

            await prisma.costRecord.createMany({
                data: [
                    {
                        date: new Date('2023-03-01'),
                        amount: 100,
                        service: 'S1',
                        accountId: account1.id,
                        recordType: 'Usage',
                    },
                    {
                        date: new Date('2023-04-01'),
                        amount: 100,
                        service: 'S2',
                        accountId: account2.id,
                        recordType: 'Usage',
                    }
                ]
            });

            // Note: getAvailableMonths expects accountId (local DB UUID), not AWS Account ID depending on implementation.
            // Let's check implementation again. It uses `where: { accountId }` on CostRecord.
            // CostRecord.accountId matches Account.id (UUID)? Or Account.accountId (AWS ID)?
            // Schema probably links CostRecord.accountId to Account.id.

            const months1 = await getAvailableMonths(account1.id);
            expect(months1).toEqual(['2023-03']);

            const months2 = await getAvailableMonths(account2.id);
            expect(months2).toEqual(['2023-04']);
        });
    });
});
