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
            // Current month + next 3 months? Or align to quarters?
            // "Next Quarter" usually means next 3 months logic in this app context often.
            // Let's interpret as "Next 3 months" roughly or align to quarters.
            // Documentation says "next_quarter" (3 months). Let's do 3 full months ahead.
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

    // 3. Process History for Regression Grouped by Service
    // Group by Service -> Month -> Sum -> Daily Average
    type ServiceHistory = {
        [service: string]: {
            [monthKey: string]: { sum: number; days: number } // monthKey: YYYY-MM
        }
    };

    const serviceHistory: ServiceHistory = {};

    // Helper to get days in month
    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

    records.forEach(r => {
        if (r.service === 'Total') return; // Skip Total records if any (we aggregate manually)

        const d = new Date(r.date);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!serviceHistory[r.service]) serviceHistory[r.service] = {};
        if (!serviceHistory[r.service][mKey]) {
            serviceHistory[r.service][mKey] = { sum: 0, days: getDaysInMonth(d.getFullYear(), d.getMonth()) };
        }
        serviceHistory[r.service][mKey].sum += r.amount;
    });

    // Calculate Regression per Service
    // X = Month Index (relative to start), Y = Daily Average Amount
    interface ServiceTrend {
        slope: number;
        intercept: number;
        lastValue: number; // Fallback
        dataPoints: number;
    }
    const serviceTrends: Map<string, ServiceTrend> = new Map();

    Object.entries(serviceHistory).forEach(([service, monthData]) => {
        const sortedMonths = Object.keys(monthData).sort();
        // Skip regression if too few data points (e.g. < 3 months)
        const dataPoints: { x: number; y: number }[] = [];
        let lastVal = 0;

        sortedMonths.forEach((mKey, index) => {
            const { sum, days } = monthData[mKey];
            const avgDaily = sum / days;
            dataPoints.push({ x: index, y: avgDaily });
            lastVal = avgDaily;
        });

        if (sortedMonths.length >= 3) {
            const { slope, intercept } = calculateLinearRegression(dataPoints);
            serviceTrends.set(service, { slope, intercept, lastValue: lastVal, dataPoints: sortedMonths.length });
        } else {
            // Fallback: Flat trend based on last value
            serviceTrends.set(service, { slope: 0, intercept: lastVal, lastValue: lastVal, dataPoints: sortedMonths.length });
        }
    });

    // 4. Generate Forecast
    // Determine start date for forecast (Today)
    const forecastStart = new Date(todayStart);
    const forecastMap = new Map<string, number>(); // date -> amount

    // We iterate MONTHLY to calculate predicted daily average, then fill daily
    // Current Month remaining days check

    let iterDate = new Date(forecastStart);
    // Align regression X axis:
    // The regression inputs were 0..11 (if 1 year data).
    // Current month is index 12?
    // We need to map current time to the regression X-axis.
    // "lookbackStart" was the 0-point for regression?
    // Yes: lookbackStart month is index 0.

    const getRegressionX = (d: Date) => {
        return (d.getFullYear() - lookbackStart.getFullYear()) * 12 + (d.getMonth() - lookbackStart.getMonth());
    };

    while (iterDate <= targetEnd) {
        const mKey = iterDate.toISOString().split('T')[0];
        const monthX = getRegressionX(iterDate);

        let dailyTotal = 0;

        // Sum predictions for all services
        for (const trend of serviceTrends.values()) {
            let predictedDaily = 0;
            if (trend.slope === 0 && trend.dataPoints < 3) {
                predictedDaily = trend.lastValue;
            } else {
                predictedDaily = trend.slope * monthX + trend.intercept;
            }
            // Floor at 0
            predictedDaily = Math.max(0, predictedDaily);
            dailyTotal += predictedDaily;
        }

        // Apply Adjustment Factor
        dailyTotal *= options.adjustmentFactor;

        // Add additional fixed cost (Daily portion? Or Monthly fixed cost allocated daily?)
        // Spec says "Additional Fixed Cost (USD)". If it's a monthly inputs usually...
        // But the previous code treated it as a flat addition to the TOTAL predicted.
        // Let's check previous impl: `totalPredicted = currentTotal + forecastTotal + options.additionalFixedCost;`
        // It was added once to the grand total. So we don't add it to daily points here.

        forecastMap.set(mKey, dailyTotal);
        iterDate.setDate(iterDate.getDate() + 1);
    }

    const forecast = Array.from(forecastMap.entries())
        .map(([date, amount]) => ({ date, amount, isForecast: true }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // 5. Build History Data for Chart (last 30 days actuals for context)
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

    // Group history daily
    const historyMap = new Map<string, number>();
    historyRecords.forEach(r => {
        if (r.service === 'Total' && historyRecords.some(hr => hr.service !== 'Total')) return;
        const dKey = r.date.toISOString().split('T')[0];
        historyMap.set(dKey, (historyMap.get(dKey) || 0) + r.amount);
    });

    const history = Array.from(historyMap.entries())
        .map(([date, amount]) => ({ date, amount, isForecast: false }))
        .sort((a, b) => a.date.localeCompare(b.date));


    // 6. Calculate Totals
    // We need "currentTotal" (for this month?) and "totalPredicted" (for target period?)
    // This part is ambiguous in 'forecast-service.ts' originally.
    // "currentTotal" seemed to be used for "Achievement so far this month".
    // "totalPredicted" was "currentTotal + forecast remaining".
    // But if we selected "Next 12 months", what should "Total Predicted" be?
    // Probably the total sum of the forecast period + current partial if included.

    // Let's strictly follow the definition:
    // If period is 'current_month': currentTotal (actuals this month) + forecast (remaining days).
    // If period is 'next_12_months': It's usually the sum of the forecast.

    // However, the UI shows "Total Predicted" and "Budget". Budget matches a specific month usually.
    // If we select "2 years", Budget comparison against "One Month Budget" makes no sense.
    // The UI might need adjustment, but here we just return the values.

    // Let's define:
    // currentTotal: Sum of ACTUALs within the Start-End range of the forecast context?
    // OR just "Month to date" for the current month?
    // Previous code:
    // `currentTotal = history.reduce...` where history was "Target Period Actuals".
    // So if target was "Next Month", history actuals was 0.

    // We should probably calculate actuals for the *Current Month* always for reference,
    // AND actuals for the *Target Period* if any overlap.

    // For simplicity and backward compatibility with the 'Current Month' view:
    // If Target Period starts in future, currentTotal (for that target) is 0.
    // If Target Period includes today, we sum actuals.

    // Let's re-calculate "Actuals in Target Period".
    const targetActualsClause: Prisma.CostRecordWhereInput = {
        date: {
            gte: forecastStart, // Wait, forecastStart is today.
            // We need start of the reporting period.
            // For "Current Month", it is Month 1st.
        }
    };

    // Logic refinement:
    // We need a clear start date for the "Prediction Total".
    // Usage: "Current Month Forecast" -> Start 1st, End 30th.
    // "Next 12 Months" -> Start Today? Or Start Next Month 1st?
    // User option says "Next 1 year".
    // Usually means "From now + 1 year" OR "Next Jan to Next Dec"?
    // "Next 12 months" usually means "Coming 12 months".
    // Let's assume prediction summations starts from TODAY until TargetEnd.

    // BUT for "Current Month" mode, we add "Month-to-date Actuals".

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

    // Total Predicted:
    // If period is 'current_month', it is MonthActual + ForecastRemaining.
    // If period is future, it is just ForecastSum.
    // Wait, the UI displays "currentTotal" too.

    let totalPredicted = forecastSum;
    let displayCurrentTotal = 0;

    if (options.period === 'current_month') {
        totalPredicted += currentMonthActual;
        displayCurrentTotal = currentMonthActual;
    } else {
        // For future periods, we might not show "Current Total" or it applies to the start of that period (0).
        displayCurrentTotal = 0;
    }

    totalPredicted += options.additionalFixedCost;

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
        currentTotal: displayCurrentTotal,
        totalPredicted,
        budget: budgetRec?.amount || 0
    };
}
