export interface IElectronAPI {
    syncCosts: (args: {
        accountId: string;
        profileName: string;
        startDate: string;
        endDate: string;
    }) => Promise<{ success: boolean; daysSynced: number }>;
    getAccounts: () => Promise<any[]>;
    addAccount: (args: {
        name: string;
        accountId: string;
        profileName: string;
    }) => Promise<any>;
    exportCsv: (args: { accountId: string }) => Promise<{ success: boolean; filePath?: string }>;
    calculateForecast: (args: { accountId: string; month: string }) => Promise<any>;
    getDashboardData: (args: { accountId?: string; month?: string }) => Promise<any>;
    getAnalyticsData: (args: { accountId?: string; startDate: string; endDate: string; granularity: 'monthly' | 'daily' }) => Promise<any>;
    calculateDetailedForecast: (args: { accountId?: string; options: any }) => Promise<any>;
    calculateDetailedForecast: (args: { accountId?: string; options: any }) => Promise<any>;
    generateDummyData: () => Promise<any>;
    updateAccountSettings: (args: {
        id: string;
        budget: number;
        exchangeRate: number;
        profileName?: string | null;
    }) => Promise<any>;
}

declare global {
    interface Window {
        electron: IElectronAPI;
    }
}
