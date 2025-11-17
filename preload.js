const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadTopics: (page, limit) => ipcRenderer.invoke('load-topics', page, limit),
    executeTrading: (selectedTopic) => ipcRenderer.invoke('execute-trading', selectedTopic),
    getConfig: () => ipcRenderer.invoke('get-config'),
    updateConfig: (config) => ipcRenderer.invoke('update-config', config),
    onLog: (callback) => ipcRenderer.on('log', (event, data) => callback(data))
});
