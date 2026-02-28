const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openAudioFile: () => ipcRenderer.invoke('open-audio-file'),
  readAudioBase64: (filePath) => ipcRenderer.invoke('read-audio-base64', filePath),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  appendLog: (entry) => ipcRenderer.invoke('append-log', entry),
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});
