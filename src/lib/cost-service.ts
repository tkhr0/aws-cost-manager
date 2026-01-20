import { PrismaClient } from '@prisma/client';
import { AwsCostClient } from './aws-client';

const prisma = new PrismaClient();

export async function syncAwsCosts(
    accountId: string,
    profileName: string,
    startDate: string,
    endDate: string
) {
    const awsClient = new AwsCostClient(profileName);

    // Get existing account or throw error if not configured
    const account = await prisma.account.findUnique({
        where: { accountId },
    });

    if (!account) {
        throw new Error(`Account ${accountId} not found in database. Please configure it first.`);
    }

    // Fetch from AWS with SERVICE grouping
    // Granularity 'DAILY' and grouping by 'SERVICE'
    const filter = {
        And: [{ Dimensions: { Key: 'RECORD_TYPE', Values: ['Usage', 'Recurring', 'Tax', 'Amortized'] } }],
    };

    const results = await awsClient.getCostAndUsage(
        startDate,
        endDate,
        'DAILY',
        { Type: 'DIMENSION', Key: 'SERVICE' } // GroupBy
    );

    for (const day of results) {
        const date = new Date(day.TimePeriod?.Start || '');

        if (day.Groups && day.Groups.length > 0) {
            for (const group of day.Groups) {
                const serviceName = group.Keys?.[0] || 'Unknown';
                const unblendedCost = group.Metrics?.['UnblendedCost']?.Amount || '0';
                const amount = parseFloat(unblendedCost);

                // Skip zero costs to save DB space
                if (amount === 0) continue;

                await prisma.costRecord.upsert({
                    where: {
                        date_accountId_service_recordType: {
                            date,
                            accountId: account.id,
                            service: serviceName,
                            recordType: 'UnblendedCost',
                        },
                    },
                    update: { amount },
                    create: {
                        date,
                        amount,
                        accountId: account.id,
                        service: serviceName,
                        recordType: 'UnblendedCost',
                    },
                });
            }
        }
    }

    return { success: true, daysSynced: results.length };
}

export async function getLocalAccounts() {
    return await prisma.account.findMany();
}

export async function addAccount(name: string, accountId: string, profileName: string) {
    return await prisma.account.create({
        data: { name, accountId, profileName },
    });
}
