import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    hello: () => ipcRenderer.invoke('hello'),
});
