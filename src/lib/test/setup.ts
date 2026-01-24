import { execSync } from 'child_process';
import { beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Generate a unique database file for each test run to prevent conflicts
const randomSuffix = Math.random().toString(36).substring(2, 10);
const testDbName = `test_${randomSuffix}.db`;
const testDbPath = path.join(__dirname, '../../../prisma', testDbName);
process.env.DATABASE_URL = `file:${testDbPath}`;

const prisma = new PrismaClient();

// Ensure the database schema is up to date before running tests
// We use 'prisma db push' to sync the schema with the test database
try {
    console.log('Syncing test database...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
    console.log('Test database synced.');
} catch (error) {
    console.error('Failed to sync test database schema:', error);
    process.exit(1);
}

beforeEach(async () => {
    // Clean up all tables before each test
    // Disable foreign keys so we can delete in any order
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');

    const tablenames = await prisma.$queryRaw<
        Array<{ name: string }>
    >`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`;

    for (const { name } of tablenames) {
        try {
            await prisma.$executeRawUnsafe(`DELETE FROM "${name}";`);
        } catch (error) {
            console.log(`Error cleaning table ${name}:`, error);
        }
    }

    // Re-enable foreign keys
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
});

afterAll(async () => {
    // Disconnect Prisma and clean up the test database file
    await prisma.$disconnect();

    try {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
            console.log(`Cleaned up test database: ${testDbName}`);
        }
        // Also clean up journal files if they exist
        const journalPath = `${testDbPath}-journal`;
        if (fs.existsSync(journalPath)) {
            fs.unlinkSync(journalPath);
        }
    } catch (error) {
        console.log(`Could not clean up test database: ${error}`);
    }
});
