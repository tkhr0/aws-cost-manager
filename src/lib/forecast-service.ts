import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();



export interface ForecastOptions {
    adjustmentFactor: number; // e.g. 1.0, 1.1 (+10%)
    additionalFixedCost: number; // e.g. 500
    period?: 'current_month' | 'next_month' | 'next_quarter' | 'next_6_months' | 'next_12_months' | 'next_24_months';
}

export interface ServiceTrend {
    serviceName: string;
    slope: number;
    currentDailyAvg: number;
    lastMonthAmount: number;
    forecastTotal: number;
}

export interface ForecastPoint {
    date: string; // YYYY-MM
    dailyAvg: number;
    monthlyTotal: number;
    isForecast: boolean;
}

export interface ForecastResult {
    history: ForecastPoint[];
    forecast: ForecastPoint[];
    totalPredicted: number;
    currentTotal: number;
    budget: number;
    serviceBreakdown: ServiceTrend[];
}

interface LinearRegressionResult {
    slope: number;
    intercept: number;
}

// Helper: Calculate Linear Regression (Least Squares)
function calculateLinearRegression(data: { x: number; y: number }[]): LinearRegressionResult {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: data.length > 0 ? data[0].y : 0 };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (const point of data) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

export async function calculateDetailedForecast(
    accountId: string | undefined,
    options: ForecastOptions
): Promise<ForecastResult> {
    const now = new Date();

    // 1. Determine Target End Date based on period
    let targetEnd: Date;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    switch (options.period) {
        case 'next_month':
            targetEnd = new Date(currentYear, currentMonth + 2, 0); // End of next month
            break;
        case 'next_quarter':
            targetEnd = new Date(currentYear, currentMonth + 4, 0);
            break;
        case 'next_6_months':
            targetEnd = new Date(currentYear, currentMonth + 7, 0);
            break;
        case 'next_12_months':
            targetEnd = new Date(currentYear, currentMonth + 13, 0);
            break;
        case 'next_24_months':
            targetEnd = new Date(currentYear, currentMonth + 25, 0);
            break;
        case 'current_month':
        default:
            targetEnd = new Date(currentYear, currentMonth + 1, 0);
            break;
    }

    // 2. Fetch History (Last 6 months for regression)
    // [Updated Requirement] Change from 1 year to 6 months
    const lookbackStart = new Date(currentYear, currentMonth - 6, 1);
    const todayStart = new Date(currentYear, currentMonth, now.getDate());

    if (isNaN(lookbackStart.getTime())) {
        throw new Error(`Invalid lookbackStart date derived from currentYear=${currentYear}, currentMonth=${currentMonth}`);
    }
    if (isNaN(todayStart.getTime())) {
        throw new Error(`Invalid todayStart date derived from currentYear=${currentYear}, currentMonth=${currentMonth}, day=${now.getDate()}`);
    }

    const whereClause: Prisma.CostRecordWhereInput = {
        date: {
            gte: lookbackStart,
            lt: todayStart,
        },
    };
    if (accountId && accountId !== 'all') {
        whereClause.accountId = accountId;
    }

    const records = await prisma.costRecord.findMany({
        where: whereClause,
        orderBy: { date: 'asc' },
    });

    // 3. Process Data: Group by Service & Monthly
    const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const serviceMonthlyMap = new Map<string, Map<string, number>>();
    const daysInMonthMap = new Map<string, number>();

    // Also track GLOBAL monthly totals for History part of Result
    const historyMonthlyMap = new Map<string, { total: number, days: number }>();

    records.forEach(r => {
        const mKey = getMonthKey(r.date);

        if (!daysInMonthMap.has(mKey)) {
            const d = new Date(r.date);
            const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            daysInMonthMap.set(mKey, dim);
        }

        // [Requirement] Exclude Tax/Support from Chart History / Regression
        if (r.service.includes('Tax') || r.service.includes('Support')) {
            return;
        }

        if (!serviceMonthlyMap.has(r.service)) {
            serviceMonthlyMap.set(r.service, new Map());
        }
        const sMap = serviceMonthlyMap.get(r.service)!;
        sMap.set(mKey, (sMap.get(mKey) || 0) + r.amount);

        // Global History
        if (!historyMonthlyMap.has(mKey)) {
            historyMonthlyMap.set(mKey, { total: 0, days: daysInMonthMap.get(mKey)! });
        }
        historyMonthlyMap.get(mKey)!.total += r.amount;
    });

    // 4. Per Service Regression & Forecast
    // Accumulator (Monthly)
    // Map<MonthKey, { dailyAvgProp: number, days: number }>
    // We sum up the "Daily Averages" from each service to get Global Daily Average for that month.
    // Then total = GlobalDailyAvg * Days.
    const monthlyForecastMap = new Map<string, number>(); // Map<MonthKey, SumOfDailyAvgs>

    // Target Months Array
    const forecastMonths: { key: string, date: Date, days: number }[] = [];
    const endMonthKey = getMonthKey(targetEnd);

    // Loop months
    // We need to cover from current month until targetEnd
    // Start `d` at 1st of current month
    const d = new Date(currentYear, currentMonth); // Start from current month
    d.setDate(1);

    // Safety break
    let loopCount = 0;
    while (loopCount < 36) {
        const key = getMonthKey(d);
        const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        forecastMonths.push({ key, date: new Date(d), days: dim });

        if (key === endMonthKey) break;

        d.setMonth(d.getMonth() + 1);
        loopCount++;
    }

    const serviceBreakdown: ServiceTrend[] = [];

    // Iterate Services
    for (const [serviceName, monthlyData] of serviceMonthlyMap.entries()) {
        const sortedMonths = Array.from(monthlyData.keys()).sort();

        const regressionData = sortedMonths.map((mKey, idx) => {
            const total = monthlyData.get(mKey)!;
            const days = daysInMonthMap.get(mKey) || 30; // fallback
            const dailyAvg = total / days;
            return { x: idx, y: dailyAvg };
        });

        let slope = 0;
        let intercept = 0;
        let useRegression = false;
        let lastValue = 0;

        if (regressionData.length > 0) {
            lastValue = regressionData[regressionData.length - 1].y;
        }

        if (regressionData.length >= 3) {
            useRegression = true;
            const res = calculateLinearRegression(regressionData);
            slope = res.slope;
            intercept = res.intercept;
        } else {
            slope = 0;
            intercept = lastValue;
        }

        // Capture Breakdown Info
        const lastMonthKey = sortedMonths[sortedMonths.length - 1];
        const lastMonthAmount = monthlyData.get(lastMonthKey) || 0;
        const lastMonthDays = daysInMonthMap.get(lastMonthKey) || 30;
        const currentDailyAvg = lastMonthAmount / lastMonthDays;

        let serviceForecastSum = 0; // Totals over the forecast period

        if (sortedMonths.length === 0) continue;

        const firstMonthStr = sortedMonths[0]; // YYYY-MM
        const firstMonthDate = new Date(`${firstMonthStr}-01`);

        forecastMonths.forEach(({ key, date, days }) => {
            // Calculate month difference
            // diff = (targetYear - firstYear) * 12 + (targetMonth - firstMonth)
            const diffMonths = (date.getFullYear() - firstMonthDate.getFullYear()) * 12 +
                (date.getMonth() - firstMonthDate.getMonth());

            let predictedDaily = 0;
            if (useRegression) {
                predictedDaily = slope * diffMonths + intercept;
            } else {
                predictedDaily = intercept;
            }

            // Clamp to 0
            predictedDaily = Math.max(0, predictedDaily);

            // Accumulate to global map
            const current = monthlyForecastMap.get(key) || 0;
            monthlyForecastMap.set(key, current + predictedDaily);

            serviceForecastSum += predictedDaily * days;
        });

        serviceBreakdown.push({
            serviceName,
            slope,
            currentDailyAvg,
            lastMonthAmount,
            forecastTotal: serviceForecastSum
        });
    }

    // Apply global factor to service breakdown forecastTotal for consistency
    serviceBreakdown.forEach(s => {
        s.forecastTotal *= options.adjustmentFactor;
    });
    // Sort
    serviceBreakdown.sort((a, b) => b.forecastTotal - a.forecastTotal);

    // [New Requirement] Multiply forecast by 1.10 (Support Cost Markup)
    const SUPPORT_MARKUP = 1.10;

    // 5. Build History (Monthly)
    // Use historyMonthlyMap constructed during pass
    const history: ForecastPoint[] = Array.from(historyMonthlyMap.entries())
        .map(([date, val]) => ({
            date,
            dailyAvg: val.total / val.days,
            monthlyTotal: val.total,
            isForecast: false
        }))
        .sort((a, b) => a.date.localeCompare(b.date));


    // 6. Build Forecast Array (Monthly)
    const forecast: ForecastPoint[] = forecastMonths.map(({ key, days }) => {
        const rawDailyAvg = monthlyForecastMap.get(key) || 0;

        // Apply Factors
        let finalDaily = rawDailyAvg * options.adjustmentFactor;
        finalDaily += (options.additionalFixedCost / 30); // distribute fixed cost

        // Apply Support Markup
        finalDaily = finalDaily * SUPPORT_MARKUP;

        return {
            date: key,
            dailyAvg: finalDaily,
            monthlyTotal: finalDaily * days,
            isForecast: true
        };
    });

    // 7. Calculate Totals
    // Filter history for "Current Month" MTD if needed?
    // Actually, calculateDetailedForecast usually does NOT include "Chart History" in the "Total" sum unless it is part of the "Period".
    // But since we unified the approach, let's just sum up the FORECAST array for the totalPredicted.

    // NOTE: The previous logic summed MTD + forecast for remainder.
    // Now we have "Monthly" forecast which includes current month (calculated via regression).
    // Should we overwrite current month with ACTUALS?
    // User wants "Forecast" usually to see where it lands.
    // But `currentTotal` usually means "Spending so far".

    // Let's keep `currentTotal` as MTD actuals.
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const mtdClause: Prisma.CostRecordWhereInput = {
        date: { gte: startOfMonth, lt: todayStart }
    };
    if (accountId && accountId !== 'all') mtdClause.accountId = accountId;

    const mtdRecords = await prisma.costRecord.findMany({ where: mtdClause });
    const currentMonthActual = mtdRecords.reduce((sum, r) => {
        if (r.service === 'Total' && mtdRecords.some(x => x.service !== 'Total')) return sum;
        return sum + r.amount;
    }, 0);

    // Forecast Sum
    // If period is 'current_month', we might want to return just that.
    // But our forecast array covers the period.
    // Let's sum the forecast array.
    const totalPredicted = forecast.reduce((sum, f) => sum + f.monthlyTotal, 0);

    // Budget
    const monthKey = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`;
    const budgetRec = await prisma.budget.findFirst({
        where: {
            month: monthKey,
            accountId: (accountId && accountId !== 'all') ? accountId : null,
        }
    });

    return {
        history,
        forecast,
        currentTotal: currentMonthActual,
        totalPredicted,
        budget: budgetRec?.amount || 0,
        serviceBreakdown
    };
}
