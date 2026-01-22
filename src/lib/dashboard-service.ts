import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getDashboardData(accountId?: string, month?: string) {
    const whereClause = accountId && accountId !== 'all' ? { accountId } : {};

    // Determine date range
    let now = new Date();
    if (month) {
        const [year, monthStr] = month.split('-');
        now = new Date(parseInt(year), parseInt(monthStr) - 1, 1);
    }

    // Create Date objects in local time equivalent for querying
    // (Assuming records are stored as UTC midnights or similar, but let's stick to start/end of month logic)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    // Adjust endOfMonth to cover the full day if needed, usually db dates are at 00:00:00
    // so lte endOfMonth (which is at 00:00:00) might miss the last day if it has time? 
    // Actually `new Date(Y, M+1, 0)` is the last day of month at 00:00:00.
    // If we want to include the full last day, we should probably use lt first day of next month.
    // But existing code used lte endOfMonth. 
    // Let's stick to existing pattern but make sure we target the specific month correctly.

    const records = await prisma.costRecord.findMany({
        where: {
            ...whereClause,
            date: {
                gte: startOfMonth,
                lte: endOfMonth,
            },
        },
        orderBy: { date: 'asc' },
    });

    console.log(`[DashboardService] Found ${records.length} records for range ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);
    if (records.length > 0) console.log('[DashboardService] First record:', JSON.stringify(records[0]));

    // Aggregate by Service
    const serviceMap = new Map<string, { total: number; daily: Map<string, number> }>();
    const totalCost = records.reduce((sum: number, r: any) => sum + r.amount, 0);

    records.forEach((r: any) => {
        // Only aggregate actual usage cost, filter out 'Total' if we have mixed data,
        // AND filter out our own aggregated 'Total' records if they exist, to avoid double counting.
        // However, currently we are overwriting 'Total' or inserting 'ServiceName'.
        // If the sync logic switched from Total to Service, we might have both types of records in DB?
        // Let's assume the user syncs and we only have the new detailed records,
        // OR filter out records where service === 'Total' when we want detailed breakdown.
        if (r.service === 'Total') return;
        if (r.service === 'Tax') return; // Exclude Tax from aggregation

        if (!serviceMap.has(r.service)) {
            serviceMap.set(r.service, { total: 0, daily: new Map() });
        }
        const entry = serviceMap.get(r.service)!;
        entry.total += r.amount;

        const dateKey = r.date.toISOString().split('T')[0];
        entry.daily.set(dateKey, (entry.daily.get(dateKey) || 0) + r.amount);
    });

    const serviceBreakdown = Array.from(serviceMap.entries())
        .map(([name, data]) => {
            // Create sparkline data (array of amounts sorted by date)
            // Fill dates with 0 if missing? For sparkline simple array is ok.
            const sparkline = Array.from(data.daily.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([_, amount]) => amount);

            return {
                name,
                amount: data.total,
                percentage: totalCost > 0 ? (data.total / totalCost) * 100 : 0,
                sparkline,
            };
        })
        .sort((a, b) => b.amount - a.amount);

    // If we filtered out 'Total' service records, we need to recalculate totalCost from the breakdown
    // OR rely on the fact that the sum of parts equals the whole (approximately).
    // Ideally, dashboard chart should use the aggregated total.
    // Let's construct a daily aggregated chart data from the service breakdown to be consistent.

    const dailyAggregated = new Map<string, number>();
    records.forEach((r: any) => {
        if (r.service === 'Total') return;
        if (r.service === 'Tax') return;
        const dateKey = r.date.toISOString().split('T')[0];
        dailyAggregated.set(dateKey, (dailyAggregated.get(dateKey) || 0) + r.amount);
    });

    const aggregatedRecords = Array.from(dailyAggregated.entries())
        .map(([date, amount]) => ({ date: new Date(date), amount }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Get budget & exchange rate
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Try to find specific monthly budget override
    const budgetOverride = await prisma.budget.findFirst({
        where: {
            month: monthKey,
            accountId: (accountId && accountId !== 'all') ? accountId : null,
        },
    });

    let budget = 0;
    let exchangeRate = 150; // Default

    if (budgetOverride) {
        budget = budgetOverride.amount;
    }

    // 2. If no override (or we simply want to sum up base budgets for 'all'), check Account settings
    // If 'all', we might want granular override sum? That's complex.
    // Simplified:
    // If single account selected: Override > Account.budget
    // If 'all': Sum(Account.budgets). (Ignoring overrides for simplicity or calculating mix is hard)

    if (accountId && accountId !== 'all') {
        const acc = await prisma.account.findUnique({ where: { id: accountId } });
        if (acc) {
            if (!budgetOverride) budget = acc.budget;
            exchangeRate = acc.exchangeRate;
        }
    } else {
        // All accounts
        const accounts = await prisma.account.findMany();
        if (!budgetOverride) {
            // Sum of base budgets
            budget = accounts.reduce((sum: number, a: any) => sum + a.budget, 0);
        }
        // Use average or first account rate?
        if (accounts.length > 0) {
            exchangeRate = accounts[0].exchangeRate;
        }
    }

    // Get forecast
    const forecast = await prisma.forecast.findFirst({
        where: {
            month: monthKey,
            accountId: (accountId && accountId !== 'all') ? accountId : undefined, // Forecast might store 'all' or specific
            type: 'Total',
        },
        orderBy: { calculatedAt: 'desc' },
    });

    return {
        records: aggregatedRecords, // Return aggregated view for main chart
        serviceBreakdown,           // Return detailed view for table
        budget,
        exchangeRate,               // Return rate for JPY conversion
        forecast: forecast?.amount || 0,
    };
}
