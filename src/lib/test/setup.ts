import { execSync } from 'child_process';
import { beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Use a file-based SQLite db for testing
process.env.DATABASE_URL = "file:./test.db";

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
