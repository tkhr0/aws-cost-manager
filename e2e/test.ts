import { test as base } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { resetDatabase } from '../src/lib/test/db-cleaner';

// setup DB path via environment variable
const dbPath = path.resolve(__dirname, '../test.db');
const dbUrl = `file:${dbPath}`;
process.env.DATABASE_URL = dbUrl;

export const test = base.extend<{ dbCleanup: void }>({
    dbCleanup: [async ({ }, use) => {
        // Setup Prisma Client
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: dbUrl
                }
            }
        });

        console.log('Running auto-fixture: DB cleanup...');
        try {
            // Sync schema for every test run to ensure it's up to date
            // Note: In a large suite, you might want to do this once in globalSetup
            // but for now, doing it here or relying on the user to run it once is okay.
            // Given the previous setup, we'll assume schema is pushed.
            // We will just clean the data.
            await resetDatabase(prisma);
        } catch (e) {
            console.error('Failed to cleanup database:', e);
            throw e;
        }

        await use();

        await prisma.$disconnect();
    }, { auto: true }],
});

export { expect } from '@playwright/test';
