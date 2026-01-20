import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AnalyticsGranularity = 'monthly' | 'daily';

export interface AnalyticsResult {
    headers: string[]; // Date strings (YYYY-MM or YYYY-MM-DD)
    rows: Array<{
        service: string;
        total: number;
        [dateKey: string]: number | string; // Dynamic date keys
    }>;
}

export async function getAnalyticsData(
    accountId: string | undefined,
    startDate: string,
    endDate: string,
    granularity: AnalyticsGranularity
): Promise<AnalyticsResult> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Ensure end date includes the full day
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    const whereClause: any = {
        date: {
            gte: start,
            lte: endOfDay,
        },
    };

    if (accountId && accountId !== 'all') {
        whereClause.accountId = accountId;
    }

    const records = await prisma.costRecord.findMany({
        where: whereClause,
        orderBy: { date: 'asc' },
    });

    // Aggregation Logic
    const dateKeys = new Set<string>();
    const serviceMap = new Map<string, { [key: string]: number }>();

    records.forEach((record: any) => {
        let dateKey = '';
        if (granularity === 'monthly') {
            dateKey = `${record.date.getFullYear()}-${String(record.date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            dateKey = record.date.toISOString().split('T')[0];
        }

        dateKeys.add(dateKey);

        if (!serviceMap.has(record.service)) {
            serviceMap.set(record.service, { total: 0 });
        }

        const entry = serviceMap.get(record.service)!;
        entry[dateKey] = (entry[dateKey] || 0) + record.amount;
        entry.total += record.amount;
    });

    // Sort headers
    const sortedHeaders = Array.from(dateKeys).sort();

    // Format rows
    const rows = Array.from(serviceMap.entries()).map(([service, data]) => {
        return {
            service,
            ...data,
        } as { service: string; total: number;[key: string]: number | string };
    }).sort((a, b) => b.total - a.total); // Sort by total cost descending

    return {
        headers: sortedHeaders,
        rows: rows as any,
    };
}
