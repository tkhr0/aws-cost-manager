import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type CostRecordRow = Prisma.CostRecordGetPayload<object>;

export interface ForecastOptions {
    adjustmentFactor: number; // e.g. 1.0, 1.1 (+10%)
    additionalFixedCost: number; // e.g. 500
    period?: 'current_month' | 'next_month' | 'next_quarter' | 'next_6_months' | 'next_12_months' | 'next_24_months';
}

export interface ForecastResult {
    history: { date: string; amount: number; isForecast: boolean }[];
    forecast: { date: string; amount: number; isForecast: boolean }[];
    totalPredicted: number;
    currentTotal: number;
    budget: number;
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
    // Target Start is usually "Tomorrow" regarding forecast context, but for "current month" it's end of this month.
    // Actually we want to project from "Now" until "Target End".

    // For "Current Month": Forecast until end of this month.
    // For others: Forecast until end of that period.
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

    // 2. Fetch History (Last 12 months for regression)
    const lookbackStart = new Date(currentYear - 1, currentMonth, 1); // 1 year ago 1st
    const todayStart = new Date(currentYear, currentMonth, now.getDate());

    // Validate Dates to prevent obscure Prisma errors
    if (isNaN(lookbackStart.getTime())) {
        throw new Error(`Invalid lookbackStart date derived from currentYear=${currentYear}, currentMonth=${currentMonth}`);
    }
    if (isNaN(todayStart.getTime())) {
        throw new Error(`Invalid todayStart date derived from currentYear=${currentYear}, currentMonth=${currentMonth}, day=${now.getDate()}`);
    }

    const whereClause: Prisma.CostRecordWhereInput = {
        date: {
            gte: lookbackStart,
            lt: todayStart, // Exclude today to avoid partial data messing up average? Or include? usually exclude today for completeness
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
    // Helper to get YYYY-MM key
    const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Group records by Service -> Month
    const serviceMonthlyMap = new Map<string, Map<string, number>>();
    // Also track days in each month for average calc
    const daysInMonthMap = new Map<string, number>();

    records.forEach(r => {
        // [New Requirement] Exclude Tax and Support from Regression Source
        // Use case-insensitive check appropriately or specific strings? 
        // User said "Tax" and "Support". Assuming simple include.
        if (r.service.includes('Tax') || r.service.includes('Support')) {
            return;
        }

        const mKey = getMonthKey(r.date);
        if (!serviceMonthlyMap.has(r.service)) {
            serviceMonthlyMap.set(r.service, new Map());
        }
        const sMap = serviceMonthlyMap.get(r.service)!;
        sMap.set(mKey, (sMap.get(mKey) || 0) + r.amount);

        if (!daysInMonthMap.has(mKey)) {
            const d = new Date(r.date);
            const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            daysInMonthMap.set(mKey, dim);
        }
    });

    // 4. Per Service Regression & Forecast
    // Result Accumulator (Daily)
    // Map<DateString, number>
    const dailyForecastMap = new Map<string, number>();

    // Target Dates Array
    const forecastDates: Date[] = [];
    let d = new Date(todayStart); // Start from today
    while (d <= targetEnd) {
        forecastDates.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    // Iterate Services
    for (const [serviceName, monthlyData] of serviceMonthlyMap.entries()) {
        // Convert map to array for regression
        // We need X (index 0..11) and Y (Daily Average Amount)
        // Sort months
        const sortedMonths = Array.from(monthlyData.keys()).sort();

        // Skip if not enough data points (e.g. < 3 months) ?
        // Strategy: If < 3 months, use Last Value (Average of last existing month)
        // If >= 3 months, use Linear Regression.

        const regressionData = sortedMonths.map((mKey, idx) => {
            const total = monthlyData.get(mKey)!;
            const days = daysInMonthMap.get(mKey) || 30; // fallback
            const dailyAvg = total / days;
            return { x: idx, y: dailyAvg };
        });

        let slope = 0;
        let intercept = 0;
        let useRegression = false;

        // Basic "Last Value" fallback
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
            // Fallback: Flat line from last known value
            slope = 0;
            intercept = lastValue;
        }

        // Forecast for each target day
        // We need to map target day to "X index".

        if (sortedMonths.length === 0) continue;

        const firstMonthStr = sortedMonths[0]; // YYYY-MM
        const firstMonthDate = new Date(`${firstMonthStr}-01`);

        forecastDates.forEach(targetDate => {
            // Calculate month difference
            // diff = (targetYear - firstYear) * 12 + (targetMonth - firstMonth)
            // This is the "Month Index".
            const diffMonths = (targetDate.getFullYear() - firstMonthDate.getFullYear()) * 12 +
                (targetDate.getMonth() - firstMonthDate.getMonth());

            // The regression was built on monthly averages.
            // We can use that average for the whole month?
            // Or interpolate?
            // Simple approach: Use the monthly average prediction for that month.

            let predictedDaily = 0;
            if (useRegression) {
                predictedDaily = slope * diffMonths + intercept;
            } else {
                predictedDaily = intercept; // Last value constant
            }

            // Clamp to 0
            predictedDaily = Math.max(0, predictedDaily);

            // Setup map key
            const key = targetDate.toISOString().split('T')[0];
            const current = dailyForecastMap.get(key) || 0;
            dailyForecastMap.set(key, current + predictedDaily);
        });
    }

    // [New Requirement] Multiply forecast by 1.10 (Support Cost Markup)
    // Apply this to the final daily totals.
    const SUPPORT_MARKUP = 1.10;

    // 5. Build History (Chart)
    // Simplify: just aggregate daily totals from fetched records (Chart shows actuals)
    // Re-query for granular daily history to show on chart
    const chartHistoryStart = new Date();
    chartHistoryStart.setDate(chartHistoryStart.getDate() - 60); // Show last 60 days

    const historyClause: Prisma.CostRecordWhereInput = {
        date: { gte: chartHistoryStart, lt: todayStart }
    };
    if (accountId && accountId !== 'all') historyClause.accountId = accountId;

    const historyRecords = await prisma.costRecord.findMany({
        where: historyClause,
        orderBy: { date: 'asc' }
    });

    const historyMap = new Map<string, number>();
    historyRecords.forEach(r => {
        // [New Requirement] Exclude Tax and Support from Chart History (Actuals)
        if (r.service.includes('Tax') || r.service.includes('Support')) return;

        if (r.service === 'Total' && historyRecords.some(hr => hr.service !== 'Total')) return;
        const key = r.date.toISOString().split('T')[0];
        historyMap.set(key, (historyMap.get(key) || 0) + r.amount);
    });

    const history = Array.from(historyMap.entries())
        .map(([date, amount]) => ({ date, amount, isForecast: false }))
        .sort((a, b) => a.date.localeCompare(b.date));


    // 6. Build Forecast Array
    const forecast = Array.from(dailyForecastMap.entries())
        .map(([date, amount]) => {
            // Apply Factors
            let finalAmount = amount * options.adjustmentFactor;
            finalAmount += (options.additionalFixedCost / 30); // Very rough daily distribution of fixed cost

            // Apply Support Markup
            finalAmount = finalAmount * SUPPORT_MARKUP;

            return { date, amount: finalAmount, isForecast: true };
        })
        .sort((a, b) => a.date.localeCompare(b.date));


    // 7. Calculate Totals
    // Let's re-calculate "Actuals in Target Period".
    // For simplicity and backward compatibility with the 'Current Month' view:
    // If Target Period starts in future, currentTotal (for that target) is 0.
    // If Target Period includes today, we sum actuals.

    // Let's fetch "Month to Date" actuals separate from chart history.
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

    const forecastSum = forecast.reduce((sum, f) => sum + f.amount, 0);

    let totalPredicted = forecastSum;
    let displayCurrentTotal = 0;

    if (options.period === 'current_month') {
        totalPredicted += currentMonthActual;
        displayCurrentTotal = currentMonthActual;
    } else {
        displayCurrentTotal = 0;
    }

    // Budget: fetch for current month as a baseline reference
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
        currentTotal: displayCurrentTotal, // MTD or 0
        totalPredicted, // Forecast Sum (Marked up) + MTD (if current) + Fixed Cost (Allocated) is handled inside forecast array?
        // Wait, additionalFixedCost was added to daily forecast points in step 6.
        // So forecastSum includes it.
        // If current_month, we add MTD actuals.
        budget: budgetRec?.amount || 0
    };
}
