
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Use absolute path for test.db in the project root
const dbPath = path.resolve(__dirname, '../../../test.db');
const dbUrl = `file:${dbPath}`;
process.env.DATABASE_URL = dbUrl;

console.log('Targeting database:', dbUrl);

// Pass datasourceUrl explicitely
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});

async function main() {
    // Ensure DB schema exists
    try {
        console.log('Pushing schema to E2E test database...');
        const { execSync } = await import('child_process');
        // Prepend env var to command to ensure it overrides .env
        execSync(`DATABASE_URL="${dbUrl}" npx prisma db push --skip-generate --accept-data-loss`, { stdio: 'inherit' });
    } catch (e) {
        console.error('Schema push failed:', e);
        process.exit(1);
    }

    console.log('Seeding E2E test database...');

    // Cleanup
    try {
        await prisma.costRecord.deleteMany();
        await prisma.account.deleteMany();
    } catch (e) {
        console.log('Cleanup error (might be empty db):', e);
    }

    const account = await prisma.account.create({
        data: {
            id: 'e2e-account-1',
            name: 'E2E Account',
            accountId: '999999999999',
            profileName: 'e2e-profile'
        }
    });

    await prisma.costRecord.createMany({
        data: [
            {
                date: new Date('2023-01-15'),
                amount: 100,
                service: 'E2E Service',
                accountId: account.id,
                recordType: 'Usage'
            },
            {
                date: new Date('2022-12-20'),
                amount: 200,
                service: 'E2E Service',
                accountId: account.id,
                recordType: 'Usage'
            }
        ]
    });

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
