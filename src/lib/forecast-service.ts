import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ForecastOptions {
    lookbackDays: number; // 7, 14, 30, 60
    adjustmentFactor: number; // e.g. 1.0, 1.1 (+10%)
    additionalFixedCost: number; // e.g. 500
    period?: 'current_month' | 'next_month' | 'next_quarter';
}

export interface ForecastResult {
    history: { date: string; amount: number; isForecast: boolean }[];
    forecast: { date: string; amount: number; isForecast: boolean }[];
    totalPredicted: number;
    currentTotal: number;
    budget: number;
}

export async function calculateDetailedForecast(
    accountId: string | undefined,
    options: ForecastOptions
): Promise<ForecastResult> {
    const now = new Date();
    let targetStart: Date;
    let targetEnd: Date;

    // Determine Target Period
    if (options.period === 'next_month') {
        targetStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        targetEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    } else if (options.period === 'next_quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const nextQuarterStartMonth = (currentQuarter + 1) * 3;
        targetStart = new Date(now.getFullYear(), nextQuarterStartMonth, 1);
        targetEnd = new Date(now.getFullYear(), nextQuarterStartMonth + 3, 0);
    } else {
        // Default: Current Month
        targetStart = new Date(now.getFullYear(), now.getMonth(), 1);
        targetEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // 1. Get actuals for the TARGET period
    const whereClause: any = {
        date: {
            gte: targetStart,
            lte: targetEnd,
        },
    };
    if (accountId && accountId !== 'all') {
        whereClause.accountId = accountId;
    }

    const currentMonthRecords = await prisma.costRecord.findMany({
        where: whereClause,
        orderBy: { date: 'asc' },
    });

    // Aggregate by date
    const dailyMap = new Map<string, number>();
    currentMonthRecords.forEach((r: any) => {
        if (r.service === 'Total' && currentMonthRecords.some((cr: any) => cr.service !== 'Total')) return;
        const dKey = r.date.toISOString().split('T')[0];
        dailyMap.set(dKey, (dailyMap.get(dKey) || 0) + r.amount);
    });

    const history = Array.from(dailyMap.entries())
        .map(([date, amount]) => ({ date, amount, isForecast: false }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const currentTotal = history.reduce((sum, item) => sum + item.amount, 0);

    // 2. Calculate Daily Average based on Lookback (Always relative to NOW)
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - options.lookbackDays);

    const lookbackWhere: any = {
        date: {
            gte: lookbackStart,
            lt: new Date(),
        },
    };
    if (accountId && accountId !== 'all') {
        lookbackWhere.accountId = accountId;
    }

    const lookbackRecords = await prisma.costRecord.findMany({
        where: lookbackWhere,
    });

    const lookbackTotal = lookbackRecords
        .filter((r: any) => !(r.service === 'Total' && lookbackRecords.some((lr: any) => lr.service !== 'Total')))
        .reduce((sum: number, r: any) => sum + r.amount, 0);

    const dailyAverage = lookbackTotal / options.lookbackDays;
    const adjustedDaily = dailyAverage * options.adjustmentFactor;

    // 3. Generate Forecast for remaining days in Target Period
    const forecast: { date: string; amount: number; isForecast: boolean }[] = [];
    let forecastTotal = 0;

    // Start forecast from:
    // Max(Latest Actual Date + 1, Target Start)
    // If we have actuals in target period (e.g. current month partial), start after that.
    // If no actuals (future), start from targetStart.

    let simDate: Date;
    if (history.length > 0) {
        const lastHist = new Date(history[history.length - 1].date);
        simDate = new Date(lastHist);
        simDate.setDate(simDate.getDate() + 1);
    } else {
        simDate = new Date(targetStart);
    }

    // Ensure we don't start before targetStart
    if (simDate < targetStart) {
        simDate = new Date(targetStart);
    }

    while (simDate <= targetEnd) {
        forecast.push({
            date: simDate.toISOString().split('T')[0],
            amount: adjustedDaily,
            isForecast: true
        });
        forecastTotal += adjustedDaily;
        simDate.setDate(simDate.getDate() + 1);
    }

    // 4. Budget (fetch for the target month/first month of period)
    const monthKey = `${targetStart.getFullYear()}-${String(targetStart.getMonth() + 1).padStart(2, '0')}`;
    const budgetRec = await prisma.budget.findFirst({
        where: {
            month: monthKey,
            accountId: (accountId && accountId !== 'all') ? accountId : null,
        }
    });

    const totalPredicted = currentTotal + forecastTotal + options.additionalFixedCost;

    return {
        history,
        forecast,
        currentTotal,
        totalPredicted,
        budget: budgetRec?.amount || 0
    };
}
