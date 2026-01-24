import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    syncCosts: (args: any) => ipcRenderer.invoke('aws:syncCosts', args),
    calculateForecast: (args: any) => ipcRenderer.invoke('aws:calculateForecast', args),
    getAccounts: () => ipcRenderer.invoke('db:getAccounts'),
    addAccount: (args: any) => ipcRenderer.invoke('db:addAccount', args),
    exportCsv: (args: any) => ipcRenderer.invoke('aws:exportCsv', args),
    getDashboardData: (args: any) => ipcRenderer.invoke('db:getDashboardData', args),
    getAnalyticsData: (args: any) => ipcRenderer.invoke('db:getAnalyticsData', args),
    calculateDetailedForecast: (args: any) => ipcRenderer.invoke('db:calculateDetailedForecast', args),
    getAvailableMonths: (args: any) => ipcRenderer.invoke('db:getAvailableMonths', args),
    generateDummyData: () => ipcRenderer.invoke('db:generateDummy'),
});
