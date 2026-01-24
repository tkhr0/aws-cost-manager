import { Account } from './index';

export interface IElectronAPI {
    syncCosts: (args: {
        accountId: string;
        profileName: string;
        startDate: string;
        endDate: string;
    }) => Promise<{ success: boolean; daysSynced: number }>;
    getAccounts: () => Promise<Account[]>;
    addAccount: (args: {
        name: string;
        accountId: string;
        profileName: string;
    }) => Promise<Account>;
    exportCsv: (args: { accountId: string }) => Promise<{ success: boolean; filePath?: string }>;
    calculateForecast: (args: { accountId: string; month: string }) => Promise<unknown>; // TODO: Define Forecast type
    getDashboardData: (args: { accountId?: string; month?: string }) => Promise<unknown>; // TODO: Define DashboardData type
    getAnalyticsData: (args: { accountId?: string; year: string; month: string; granularity: 'monthly' | 'daily' }) => Promise<unknown>;
    calculateDetailedForecast: (args: { accountId?: string; options: unknown }) => Promise<unknown>;
    generateDummyData: () => Promise<unknown>;
    updateAccountSettings: (args: {
        id: string;
        budget: number;
        exchangeRate: number;
        profileName?: string | null;
    }) => Promise<Account>;
}

declare global {
    interface Window {
        electron: IElectronAPI;
    }
}
