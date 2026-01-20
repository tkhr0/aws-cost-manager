"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const cost_service_1 = require("../src/lib/cost-service");
let mainWindow;
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const isDev = process.env.NODE_ENV === 'development';
    const startUrl = isDev
        ? 'http://localhost:3000'
        : `file://${path_1.default.join(__dirname, '../out/index.html')}`;
    mainWindow.loadURL(startUrl);
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};
electron_1.app.on('ready', () => {
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// IPC Handlers
electron_1.ipcMain.handle('aws:syncCosts', async (_, { accountId, profileName, startDate, endDate }) => {
    return await (0, cost_service_1.syncAwsCosts)(accountId, profileName, startDate, endDate);
});
electron_1.ipcMain.handle('db:getAccounts', async () => {
    return await (0, cost_service_1.getLocalAccounts)();
});
electron_1.ipcMain.handle('db:addAccount', async (_, { name, accountId, profileName }) => {
    return await (0, cost_service_1.addAccount)(name, accountId, profileName);
});
