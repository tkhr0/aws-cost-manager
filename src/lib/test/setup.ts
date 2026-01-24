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

import { resetDatabase } from './db-cleaner';

beforeEach(async () => {
    await resetDatabase(prisma);
});
