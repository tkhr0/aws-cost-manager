
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Use absolute path for test.db in the project root
// Use absolute path for test.db in the project root, or use provided env var
// If running as script, process.env.DATABASE_URL might be set
// If imported, we might pass it.

export async function seed(targetDbUrl?: string) {
    let dbUrl = targetDbUrl || process.env.DATABASE_URL;
    if (!dbUrl) {
        const dbPath = path.resolve(__dirname, '../../../test.db');
        dbUrl = `file:${dbPath}`;
        process.env.DATABASE_URL = dbUrl;
    }

    console.log('Targeting database:', dbUrl);

    // Pass datasourceUrl explicitely
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: dbUrl
            }
        }
    });

    // Ensure DB schema exists
    try {
        console.log('Pushing schema to E2E test database...');
        const { execSync } = await import('child_process');
        execSync(`DATABASE_URL="${dbUrl}" npx prisma db push --skip-generate --accept-data-loss`, { stdio: 'inherit' });
    } catch (e) {
        console.error('Schema push failed:', e);
        throw e;
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
    await prisma.$disconnect();
}

// Standalone execution logic removed to avoid ESM/CJS conflicts
