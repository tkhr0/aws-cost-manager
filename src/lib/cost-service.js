"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAwsCosts = syncAwsCosts;
exports.getLocalAccounts = getLocalAccounts;
exports.addAccount = addAccount;
const client_1 = require("@prisma/client");
const aws_client_1 = require("./aws-client");
const prisma = new client_1.PrismaClient();
async function syncAwsCosts(accountId, profileName, startDate, endDate) {
    const awsClient = new aws_client_1.AwsCostClient(profileName);
    // Get existing account or throw error if not configured
    const account = await prisma.account.findUnique({
        where: { accountId },
    });
    if (!account) {
        throw new Error(`Account ${accountId} not found in database. Please configure it first.`);
    }
    // Fetch from AWS
    const results = await awsClient.getCostAndUsage(startDate, endDate, 'DAILY');
    for (const day of results) {
        const date = new Date(day.TimePeriod?.Start || '');
        if (!day.Groups) {
            // If no grouping, handle total cost
            // Note: In a real app, you might want to group by service by default.
            // For simplicity, let's assume we fetch with service grouping in the next iteration.
            // But for now, let's just use total unblended cost if not grouped.
        }
        // Example of saving total daily cost if we didn't group by service
        const amount = parseFloat(day.Metrics?.UnblendedCost?.Amount || '0');
        await prisma.costRecord.upsert({
            where: {
                date_accountId_service_recordType: {
                    date,
                    accountId: account.id,
                    service: 'Total',
                    recordType: 'UnblendedCost',
                },
            },
            update: { amount },
            create: {
                date,
                amount,
                accountId: account.id,
                service: 'Total',
                recordType: 'UnblendedCost',
            },
        });
    }
    return { success: true, daysSynced: results.length };
}
async function getLocalAccounts() {
    return await prisma.account.findMany();
}
async function addAccount(name, accountId, profileName) {
    return await prisma.account.create({
        data: { name, accountId, profileName },
    });
}
