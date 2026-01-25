
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tmpDir = path.join(process.cwd(), 'tmp');

    if (!fs.existsSync(tmpDir)) {
        console.error(`Directory not found: ${tmpDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('-service.csv'));

    if (files.length === 0) {
        console.log('No service CSV files found in tmp directory.');
        return;
    }

    console.log(`Found ${files.length} CSV files to import.`);

    for (const file of files) {
        await importFile(path.join(tmpDir, file));
    }
}

async function importFile(filePath: string) {
    const fileName = path.basename(filePath);
    // Extract accountId from filename (e.g. "fo-service.csv" -> "fo")
    const accountId = fileName.replace(/-service\.csv$/, '');

    console.log(`\nImporting ${fileName} for account: ${accountId}...`);

    // Ensure account exists
    let account = await prisma.account.findUnique({
        where: { accountId },
    });

    if (!account) {
        console.log(`Account ${accountId} does not exist. Creating...`);
        account = await prisma.account.create({
            data: {
                accountId,
                name: accountId,
                profileName: accountId, // Default to same as ID
            },
        });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

    if (lines.length < 2) {
        console.log('File is empty or invalid.');
        return;
    }

    // Parse headers
    const headerLine = lines[0];
    // Remove enclosing quotes and split
    const headers = parseCsvLine(headerLine);

    // Identify service columns
    // First column is usually "サービス" (Service) or Date label, we skip it for data mapping
    // We need to map index -> service name
    const serviceMap = new Map<number, string>();

    headers.forEach((h, index) => {
        if (index === 0) return; // Date column

        // Check for Total column to exclude
        if (h === '合計コスト($)' || h === 'Total($)') {
            return;
        }

        // Remove ($) suffix
        const serviceName = h.replace(/\(\$\)$/, '').trim();
        serviceMap.set(index, serviceName);
    });



    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const cols = parseCsvLine(line);
        const dateStr = cols[0];

        // Check if the first column is a date
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            // Skip summary rows or others
            continue;
        }

        const date = new Date(dateStr);

        for (const [index, serviceName] of serviceMap.entries()) {
            const amountStr = cols[index];
            // Handle empty or 0
            const amount = parseFloat(amountStr || '0');

            if (amount !== 0) {
                // Prepare record for upsert/create
                // Because upsert in loop is slow, we might want transaction or just upsert parallel
                // For simplicity and safety, sequential upsert is fine for hundreds of records.

                // We will process them immediately
                await prisma.costRecord.upsert({
                    where: {
                        date_accountId_service_recordType: {
                            date: date,
                            accountId: account.id,
                            service: serviceName,
                            recordType: 'Usage',
                        },
                    },
                    update: {
                        amount: amount,
                    },
                    create: {
                        date: date,
                        accountId: account.id,
                        service: serviceName,
                        recordType: 'Usage',
                        amount: amount,
                    },
                });
            }
        }
    }

    console.log(`Finished importing ${fileName}.`);
}

function parseCsvLine(line: string): string[] {
    // Simple parser for "val","val","val" format
    // We assume the file is strictly quoted as provided in sample
    if (line.startsWith('"') && line.endsWith('"')) {
        return line.slice(1, -1).split('","');
    }
    // Fallback for non-quoted or mixed (not expected based on sample)
    return line.split(',');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
