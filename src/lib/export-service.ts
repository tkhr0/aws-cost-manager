import { PrismaClient } from '@prisma/client';
import { dialog } from 'electron';
import fs from 'fs';

const prisma = new PrismaClient();

export async function exportToCsv(accountId: string) {
    const records = await prisma.costRecord.findMany({
        where: { accountId },
        orderBy: { date: 'asc' },
    });

    if (records.length === 0) {
        throw new Error('No records found for this account.');
    }

    const header = 'Date,Service,Amount,Type\n';
    const rows = records.map(
        (r: any) => `${r.date.toISOString().split('T')[0]},${r.service},${r.amount},${r.recordType}`
    ).join('\n');

    const csvContent = header + rows;

    const { filePath } = await dialog.showSaveDialog({
        title: 'Export Cost Data',
        defaultPath: `aws-costs-${accountId}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (filePath) {
        fs.writeFileSync(filePath, csvContent);
        return { success: true, filePath };
    }

    return { success: false };
}
