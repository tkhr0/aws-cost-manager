import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_ACCOUNT_ID = '000000000000';
const DEMO_ACCOUNT_NAME = 'Demo Account (Debug)';

export async function generateDummyData() {
    // 1. Create Demo Account
    let account = await prisma.account.findUnique({
        where: { accountId: DEMO_ACCOUNT_ID },
    });

    if (!account) {
        account = await prisma.account.create({
            data: {
                name: DEMO_ACCOUNT_NAME,
                accountId: DEMO_ACCOUNT_ID,
                profileName: 'demo',
            },
        });
    }

    const accountId = account.id;

    // 2. Generate Records for Last 30 Days
    const now = new Date();
    const services = [
        { name: 'Amazon Elastic Compute Cloud - Compute', base: 50, variance: 10 },
        { name: 'Amazon Relational Database Service', base: 30, variance: 2 },
        { name: 'Amazon Simple Storage Service', base: 15, variance: 1 },
        { name: 'AWS Lambda', base: 5, variance: 8 },
        { name: 'Amazon CloudWatch', base: 8, variance: 3 },
        { name: 'Elastic Load Balancing', base: 12, variance: 1 },
        { name: 'Amazon Virtual Private Cloud', base: 4, variance: 0.5 },
        { name: 'Tax', base: 12, variance: 2 },
    ];

    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        for (const svc of services) {
            // Add some randomness
            let amount = svc.base + (Math.random() * svc.variance * 2 - svc.variance);

            // Reduce usage on weekends for some services
            if (isWeekend && svc.name.includes('Compute')) {
                amount *= 0.7;
            }

            // Add gradual increase trend
            amount *= (1 + (30 - i) * 0.01);

            // Ensure positive
            amount = Math.max(0, amount);

            await prisma.costRecord.upsert({
                where: {
                    date_accountId_service_recordType: {
                        date,
                        accountId,
                        service: svc.name,
                        recordType: 'UnblendedCost',
                    },
                },
                update: { amount },
                create: {
                    date,
                    amount,
                    accountId,
                    service: svc.name,
                    recordType: 'UnblendedCost',
                },
            });
        }
    }

    // 3. Create a Budget
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await prisma.budget.upsert({
        where: {
            month_accountId: {
                month: currentMonth,
                accountId,
            },
        },
        update: { amount: 5000 },
        create: {
            month: currentMonth,
            accountId,
            amount: 5000,
        },
    });

    return { success: true, message: 'Dummy data generated successfully.' };
}
