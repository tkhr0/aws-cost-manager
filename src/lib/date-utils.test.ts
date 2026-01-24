import { describe, it, expect } from 'vitest';
import { fillDailyCosts } from './date-utils';

describe('fillDailyCosts', () => {
    it('should generate all days for a 31-day month', () => {
        const records: any[] = [];
        const result = fillDailyCosts(records, 2023, 1); // Jan 2023
        expect(result).toHaveLength(31);
        expect(result[0].name).toBe('Jan 1');
        expect(result[30].name).toBe('Jan 31');
        expect(result.every(r => r.amount === 0)).toBe(true);
    });

    it('should generate all days for a 30-day month', () => {
        const records: any[] = [];
        const result = fillDailyCosts(records, 2023, 4); // Apr 2023
        expect(result).toHaveLength(30);
        expect(result[0].name).toBe('Apr 1');
        expect(result[29].name).toBe('Apr 30');
    });

    it('should handle leap years correctly', () => {
        const records: any[] = [];
        const result = fillDailyCosts(records, 2024, 2); // Feb 2024 (Leap)
        expect(result).toHaveLength(29);
        expect(result[28].name).toBe('Feb 29');
    });

    it('should handle non-leap years correctly', () => {
        const records: any[] = [];
        const result = fillDailyCosts(records, 2023, 2); // Feb 2023
        expect(result).toHaveLength(28);
        expect(result[27].name).toBe('Feb 28');
    });

    it('should populate amounts correctly', () => {
        const records = [
            { date: '2023-01-01', amount: 100 },
            { date: new Date('2023-01-15T00:00:00Z'), amount: 50 },
            { date: '2023-01-31', amount: 200 },
        ];
        // Note: The utility expects exact YYYY-MM-DD match in local time mostly,
        // or handles dates. If inputs are strings, they should be parsable.
        // If Date objects, we extract Y/M/D.
        // Let's ensure input records match the timezone assumption in utility if relevant.
        // The utility uses `new Date(r.date)` then getFullYear/getMonth/getDate.
        // Be careful with UTC vs Local. `new Date('2023-01-01')` is usually UTC/London,
        // which might be prev day in US time zones?
        // In Browser/Node environment, '2023-01-01' -> UTC midnight.
        // If local offset is positive (Japan), it is 9AM same day.
        // If local offset is negative (US), it is prev day evening.
        // So relying on `new Date(string)` is risky for dates without time.
        // Ideally we pass local start-of-day or ensure string parsing is safe.
        // However, existing app likely uses local dates or specific strings from DB.

        // For this test, let's assume environments are consistent or use explicit construction if needed.
        // Or just use YYYY-MM-DD strings and ensure utility handles them as "Local date components".

        // In `fillDailyCosts`:
        // const d = new Date(r.date);
        // const key = `${d.getFullYear()}-${...}`
        // If r.date is '2023-01-01', `new Date` parses as UTC.
        // `d.getDate()` returns local day. 
        // In UTC+9 (Japan), '2023-01-01T00:00:00Z' is 1st.
        // In UTC-5 (EST), it is 2022-12-31.
        // This is a potential bug in the utility *if* inputs are UTC strings and we want "Business Date".
        // But for now, let's write test expecting "Local" interpretation which is current system behavior usually.
        // We can fix utility to be safer if needed (force UTC or use string parsing).

        // Actually, let's update test data to be safe for `getDate()`: use ISO strings or constructive dates.
        // Better: fix utility to parse string carefully?
        // Let's stick to what's written and test it.

        const result = fillDailyCosts(records, 2023, 1);

        // We check if amounts are mapped.
        // Find Jan 1
        const p1 = result.find(r => r.name === 'Jan 1');
        // Find Jan 15
        const p15 = result.find(r => r.name === 'Jan 15');
        // Find Jan 31
        const p31 = result.find(r => r.name === 'Jan 31');

        // Note: this assertion might fail if TIMEZONE shifts the date.
        // Let's observe.
        // If it fails, we will know we need robust date parsing.

        // Actually, since I can edit the file before saving, I might as well fix the logic to be robust.
        // But let's first test the plan as is.

        expect(result[0].amount).toBe(100); // 1st is index 0
        expect(result[14].amount).toBe(50); // 15th is index 14
        expect(result[30].amount).toBe(200); // 31st is index 30
        expect(result[4].amount).toBe(0);    // 5th is index 4, empty
    });
});
