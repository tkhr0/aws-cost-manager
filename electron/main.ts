import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import 'dotenv/config'; // Load .env file
import { syncAwsCosts, getLocalAccounts, addAccount } from '../src/lib/cost-service';
// import { calculateForecast } from '../src/lib/forecast-service';
import { exportToCsv } from '../src/lib/export-service';
import { getDashboardData } from '../src/lib/dashboard-service';

let mainWindow: BrowserWindow | null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  console.log('Main process starting...', { isDev, NODE_ENV: process.env.NODE_ENV });

  const port = process.env.PORT || 3000;
  const startUrl = isDev
    ? `http://localhost:${port}`
    : `file://${path.join(__dirname, '../out/index.html')}`;

  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('aws:syncCosts', async (_, { accountId, profileName, startDate, endDate }) => {
  return await syncAwsCosts(accountId, profileName, startDate, endDate);
});

// ipcMain.handle('aws:calculateForecast', async (_, { accountId, month }) => {
//   return await calculateForecast(accountId, month);
// });

ipcMain.handle('db:getAccounts', async () => {
  return await getLocalAccounts();
});

ipcMain.handle('db:addAccount', async (_, { name, accountId, profileName }) => {
  return await addAccount(name, accountId, profileName);
});

ipcMain.handle('db:updateAccountSettings', async (_, { id, budget, exchangeRate, profileName }) => {
  // lazy import to avoid circular dep if any, though here cost-service is improved already
  const { updateAccountSettings } = await import('../src/lib/cost-service');
  return await updateAccountSettings(id, budget, exchangeRate, profileName);
});

ipcMain.handle('aws:exportCsv', async (_, { accountId }) => {
  return await exportToCsv(accountId);
});

ipcMain.handle('db:getDashboardData', async (_, args) => {
  return await getDashboardData(args.accountId, args.month);
});

ipcMain.handle('db:getAvailableMonths', async (_, { accountId }) => {
  const { getAvailableMonths } = await import('../src/lib/cost-service');
  return await getAvailableMonths(accountId);
});

ipcMain.handle('db:getAnalyticsData', async (_, args) => {
  const { getAnalyticsData } = await import('../src/lib/analytics-service');
  return await getAnalyticsData(args.accountId, args.year, args.month, args.granularity);
});

ipcMain.handle('db:calculateDetailedForecast', async (_, args) => {
  const { calculateDetailedForecast } = await import('../src/lib/forecast-service');
  return await calculateDetailedForecast(args.accountId, args.options);
});

import { generateDummyData } from '../src/lib/seed-service';
ipcMain.handle('db:generateDummy', async () => {
  return await generateDummyData();
});
