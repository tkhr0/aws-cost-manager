import { describe, it, expect } from 'vitest';
import { getAnalyticsData } from '@/lib/analytics-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('getAnalyticsData', () => {
    // Note: Database is cleaned up by setup.ts before each test

    it('should calculate Month-over-Month (MoM) metrics', async () => {
        // Arrange
        // Create an account first
        const account = await prisma.account.create({
            data: {
                name: 'Test Account',
                accountId: '123456789012', // AWS Account ID
            }
        });

        // Target: 2023-02
        await prisma.costRecord.createMany({
            data: [
                { date: new Date('2023-02-01'), service: 'EC2', amount: 120, accountId: account.id, recordType: 'Usage' },
                { date: new Date('2023-02-01'), service: 'S3', amount: 50, accountId: account.id, recordType: 'Usage' },
            ]
        });

        // Previous: 2023-01
        await prisma.costRecord.createMany({
            data: [
                { date: new Date('2023-01-01'), service: 'EC2', amount: 100, accountId: account.id, recordType: 'Usage' },
                { date: new Date('2023-01-01'), service: 'S3', amount: 50, accountId: account.id, recordType: 'Usage' },
            ]
        });

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
        // Arrange
        const account = await prisma.account.create({
            data: {
                name: 'Test Account 2',
                accountId: '223456789012',
            }
        });

        // Insert data in March 15th, Feb 15th, and Jan 15th
        // We will query for March, so Feb is previous
        await prisma.costRecord.createMany({
            data: [
                { date: new Date('2023-03-15'), service: 'Lambda', amount: 10, accountId: account.id, recordType: 'Usage' },
                { date: new Date('2023-02-15'), service: 'Lambda', amount: 8, accountId: account.id, recordType: 'Usage' },
                // Jan data shouldn't affect March query directly, but ensures isolation
                { date: new Date('2023-01-15'), service: 'Lambda', amount: 5, accountId: account.id, recordType: 'Usage' },
            ]
        });

        // Act: 2023-03 (March 2023)
        const result = await getAnalyticsData('all', '2023', '03', 'monthly');

        // Assert
        const lambdaRow = result.rows.find(r => r.service === 'Lambda');
        expect(lambdaRow).toBeDefined();
        // Current (Mar) = 10, Previous (Feb) = 8
        // MoM = 2
        expect(lambdaRow?.total).toBe(10);
        expect(lambdaRow?.momAmount).toBe(2);
    });

    it('should handle year boundary (Jan 2023 -> Dec 2022)', async () => {
        // Arrange
        const account = await prisma.account.create({
            data: {
                name: 'Test Account 3',
                accountId: '323456789012',
            }
        });

        // Jan 2023 vs Dec 2022
        await prisma.costRecord.createMany({
            data: [
                { date: new Date('2023-01-10'), service: 'RDS', amount: 200, accountId: account.id, recordType: 'Usage' },
                { date: new Date('2022-12-10'), service: 'RDS', amount: 150, accountId: account.id, recordType: 'Usage' },
            ]
        });

        // Act: Jan 2023
        const result = await getAnalyticsData('all', '2023', '01', 'monthly');

        // Assert
        const rdsRow = result.rows.find(r => r.service === 'RDS');
        expect(rdsRow).toBeDefined();
        // Current (Jan) = 200, Previous (Dec) = 150
        // MoM = 50
        expect(rdsRow?.total).toBe(200);
        expect(rdsRow?.momAmount).toBe(50);
    });

    it('should filter by accountId when specified', async () => {
        // Arrange
        const targetAccount = await prisma.account.create({
            data: {
                name: 'Target Account',
                accountId: '111111111111',
            }
        });
        const otherAccount = await prisma.account.create({
            data: {
                name: 'Other Account',
                accountId: '999999999999',
            }
        });

        await prisma.costRecord.createMany({
            data: [
                // Target Account Data
                { date: new Date('2023-04-10'), service: 'EC2', amount: 50, accountId: targetAccount.id, recordType: 'Usage' },
                // Previous Month Target Account
                { date: new Date('2023-03-10'), service: 'EC2', amount: 40, accountId: targetAccount.id, recordType: 'Usage' },

                // Other Account Data (Should be ignored)
                { date: new Date('2023-04-10'), service: 'EC2', amount: 1000, accountId: otherAccount.id, recordType: 'Usage' },
                { date: new Date('2023-03-10'), service: 'EC2', amount: 1000, accountId: otherAccount.id, recordType: 'Usage' },
            ]
        });

        // Act
        // Note: getAnalyticsData expects the internal UUID if it filters by CostRecord.accountId
        const result = await getAnalyticsData(targetAccount.id, '2023', '04', 'monthly');

        // Assert
        const ec2Row = result.rows.find(r => r.service === 'EC2');
        expect(ec2Row).toBeDefined();
        // Should only sum targetAccountId: 50
        expect(ec2Row?.total).toBe(50);

        // MoM: 50 - 40 = 10
        expect(ec2Row?.momAmount).toBe(10);
    });
});
