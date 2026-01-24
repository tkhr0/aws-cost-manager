export interface Account {
    id: string;
    accountId: string;
    name: string;
    profileName?: string | null;
    budget: number;
    exchangeRate: number;
}

export interface CostRecord {
    date: string;
    amount: number;
}

export interface ServiceBreakdown {
    name: string;
    amount: number;
    percentage: number;
    sparkline: number[];
}

export interface DashboardData {
    records: CostRecord[];
    budget: number;
    forecast: number;
    exchangeRate: number;
    serviceBreakdown: ServiceBreakdown[];
}
