import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type CostRecordRow = Prisma.CostRecordGetPayload<object>;

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
    year: string,
    month: string,
    granularity: AnalyticsGranularity
): Promise<AnalyticsResult> {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10); // 1-12

    // Target Month (UTC)
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    const whereClause: Prisma.CostRecordWhereInput = {
        date: {
            gte: start,
            lte: end,
        },
    };

    if (accountId && accountId !== 'all') {
        whereClause.accountId = accountId;
    }

    const records = await prisma.costRecord.findMany({
        where: whereClause,
        orderBy: { date: 'asc' },
    });

    // Aggregation Logic for Current Month
    const dateKeys = new Set<string>();
    const serviceMap = new Map<string, { total: number;[key: string]: number }>();

    records.forEach((record: CostRecordRow) => {
        let dateKey = '';
        if (granularity === 'monthly') {
            // For monthly granularity, we show YYYY-MM
            dateKey = `${record.date.getUTCFullYear()}-${String(record.date.getUTCMonth() + 1).padStart(2, '0')}`;
        } else {
            // Daily: YYYY-MM-DD
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

    // Previous Month Logic (Strict Month-over-Month)
    // Compare against the full previous month (1st to last day)
    const prevStart = new Date(Date.UTC(y, m - 2, 1));
    const prevEnd = new Date(Date.UTC(y, m - 1, 0, 23, 59, 59, 999));

    const prevWhereClause: Prisma.CostRecordWhereInput = {
        date: {
            gte: prevStart,
            lte: prevEnd,
        },
    };
    if (accountId && accountId !== 'all') {
        prevWhereClause.accountId = accountId;
    }

    const prevRecords = await prisma.costRecord.findMany({
        where: prevWhereClause,
    });

    const previousMap = new Map<string, number>();
    prevRecords.forEach((r: CostRecordRow) => {
        previousMap.set(r.service, (previousMap.get(r.service) || 0) + r.amount);
    });

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
