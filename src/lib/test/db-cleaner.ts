import { PrismaClient } from '@prisma/client';

export async function resetDatabase(prisma: PrismaClient) {
    //Clean up all tables before each test
    //Disable foreign keys so we can delete in any order
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

    //Re-enable foreign keys
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
}
