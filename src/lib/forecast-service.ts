import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ForecastOptions {
    lookbackDays: number; // 7, 14, 30, 60
    adjustmentFactor: number; // e.g. 1.0, 1.1 (+10%)
    additionalFixedCost: number; // e.g. 500
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. Get current month data (actuals)
    const whereClause: any = {
        date: {
            gte: startOfMonth,
            lte: endOfMonth,
        },
        // Exclude specific aggregated records if necessary, but assuming we sum up raw records
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
        if (r.service === 'Total' && currentMonthRecords.some((cr: any) => cr.service !== 'Total')) return; // Avoid double counting if mixed
        const dKey = r.date.toISOString().split('T')[0];
        dailyMap.set(dKey, (dailyMap.get(dKey) || 0) + r.amount);
    });

    const history = Array.from(dailyMap.entries())
        .map(([date, amount]) => ({ date, amount, isForecast: false }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const currentTotal = history.reduce((sum, item) => sum + item.amount, 0);

    // 2. Calculate Daily Average based on Lookback
    // We need past data for lookback. 
    // Lookback is "Last N days". This might cross month boundaries.
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - options.lookbackDays);

    // Fetch lookback data
    const lookbackWhere: any = {
        date: {
            gte: lookbackStart,
            lt: new Date(), // Up to yesterday/today?
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

    // Calculate effective daily average
    // Note: If lookback is 30 days but we only have 5 days of data, average might be skewed if we divide by 30?
    // Or we should divide by distinct days found?
    // Let's divide by options.lookbackDays for simplified "rolling average over window".
    // Alternatively, use actual days with data? 
    // Usually "Last 30 days average" implies Sum(Last 30 days) / 30.
    const dailyAverage = lookbackTotal / options.lookbackDays;

    // Apply adjustment factor
    const adjustedDaily = dailyAverage * options.adjustmentFactor;

    // 3. Generate Forecast for remaining days
    const forecast: { date: string; amount: number; isForecast: boolean }[] = [];
    let forecastTotal = 0;

    // Determine start of forecast (from last actual date + 1 day, or today?)
    // If we have data up to today (partial?), we might want to overwrite today or start tomorrow.
    // Let's assume we forecast from tomorrow.
    const lastHistoryDateStr = history.length > 0 ? history[history.length - 1].date : startOfMonth.toISOString().split('T')[0];
    const lastHistoryDate = new Date(lastHistoryDateStr);

    const simDate = new Date(lastHistoryDate);
    simDate.setDate(simDate.getDate() + 1);

    while (simDate <= endOfMonth) {
        // Simple distinct logic: Variable cost per day + Fixed cost (monthly / days)?
        // Fixed cost option is "Additional Fixed Cost" (e.g. one-time or monthly total).
        // If it represents a monthly total added, we should add it to the final sum, not distribute per day for the sparkline necessarily,
        // BUT for a graph, flat distribution or adding to total is key.
        // Let's keep the daily graph showing variable trends, and add fixed cost to the final Total Predicted.

        forecast.push({
            date: simDate.toISOString().split('T')[0],
            amount: adjustedDaily,
            isForecast: true
        });
        forecastTotal += adjustedDaily;
        simDate.setDate(simDate.getDate() + 1);
    }

    // 4. Budget
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
