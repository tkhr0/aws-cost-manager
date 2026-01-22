import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AnalyticsGranularity = 'monthly' | 'daily';

export interface AnalyticsResult {
    headers: string[]; // Date strings (YYYY-MM or YYYY-MM-DD)
    rows: Array<{
        service: string;
        total: number;
        momAmount?: number;
        momPercentage?: number;
        [dateKey: string]: number | string | undefined; // Dynamic date keys
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
    const serviceMap = new Map<string, { total: number;[key: string]: number }>();

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

    // MoM Calculation Logic
    const previousMap = new Map<string, number>();

    if (granularity === 'monthly') {
        const prevStart = new Date(start);
        prevStart.setMonth(prevStart.getMonth() - 1);

        const prevEnd = new Date(end);
        prevEnd.setMonth(prevEnd.getMonth() - 1);
        // Adjust end of day
        const prevEndOfDay = new Date(prevEnd);
        prevEndOfDay.setHours(23, 59, 59, 999);

        const prevWhereClause: any = {
            date: {
                gte: prevStart,
                lte: prevEndOfDay,
            },
        };
        if (accountId && accountId !== 'all') {
            prevWhereClause.accountId = accountId;
        }

        const prevRecords = await prisma.costRecord.findMany({
            where: prevWhereClause,
        });

        prevRecords.forEach((r: any) => {
            previousMap.set(r.service, (previousMap.get(r.service) || 0) + r.amount);
        });
    }

    // Sort headers
    const sortedHeaders = Array.from(dateKeys).sort();

    // Format rows
    const rows = Array.from(serviceMap.entries()).map(([service, data]) => {
        const currentTotal = data.total;
        const previousTotal = previousMap.get(service) || 0;
        const momAmount = currentTotal - previousTotal;
        const momPercentage = previousTotal > 0 ? (momAmount / previousTotal) * 100 : 0;

        return {
            service,
            ...data,
            momAmount,
            momPercentage,
        };
    }).sort((a, b) => b.total - a.total); // Sort by total cost descending

    return {
        headers: sortedHeaders,
        rows: rows,
    };
}
