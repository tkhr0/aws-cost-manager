export interface DailyCost {
  date: Date | string;
  amount: number;
}

export interface ChartPoint {
  name: string;
  amount: number;
}

/**
 * Fills in missing days in a month with 0 amount.
 * Returns an array of ChartPoints covering from the 1st to the last day of the specified month.
 *
 * @param records Existing cost records
 * @param year Year of the month to display (e.g. 2023)
 * @param month Month to display (1-12)
 * @returns Array of formatted chart points
 */
export function fillDailyCosts(records: DailyCost[], year: number, month: number): ChartPoint[] {
  // Determine the number of days in the month
  // new Date(year, month, 0).getDate() returns the last day of the previous month if month is 0-indexed?
  // No, new Date(year, monthIndex + 1, 0) logic:
  // If month is 1-12:
  // new Date(year, month, 0) where month is 1-based passed to Date constructor (which expects 0-based index for month usually?)
  // Wait, Date constructor: new Date(year, monthIndex, day)
  // monthIndex: 0=Jan, 11=Dec.
  // So to get last day of "month", we want the 0th day of "next month".
  // If input `month` is 1-12 (Jan=1).
  // Next month index is `month`. (Jan=1 is index 0. Next month is Feb=index 1).
  // So new Date(year, month, 0) gives last day of "month" (1-based).
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const fullMonthData: ChartPoint[] = [];

  // Create a map for quick lookup
  const costMap = new Map<string, number>();
  records.forEach(r => {
    const d = new Date(r.date);
    // Format YYYY-MM-DD
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    costMap.set(key, r.amount);
  });

  for (let day = 1; day <= daysInMonth; day++) {
    // Construct date string for lookup
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Construct display name "M/D" or "MMM D"
    // Using simple logic to match existing: "ShortMonth numericDay" -> "Jan 1"
    const dateObj = new Date(year, month - 1, day);
    const name = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    fullMonthData.push({
      name,
      amount: costMap.get(dateStr) || 0,
    });
  }

  return fullMonthData;
}
