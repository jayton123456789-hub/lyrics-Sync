const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#0a0a10',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow file:// URLs for local audio
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ── Window controls ──
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ── Open audio file ──
// Returns path info only. The renderer builds a file:// URL to play it.
ipcMain.handle('open-audio-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Audio File',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stats.size,
  };
});

// ── Read audio as base64 (for waveform decoding) ──
ipcMain.handle('read-audio-base64', async (_e, filePath) => {
  try {
    return fs.readFileSync(filePath).toString('base64');
  } catch (e) {
    console.error('read-audio-base64 failed:', e);
    return null;
  }
});

// ── Save file ──
ipcMain.handle('save-file', async (_e, { content, defaultName, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File',
    defaultPath: defaultName,
    filters: filters || [
      { name: 'SRT Subtitle', extensions: ['srt'] },
      { name: 'WebVTT', extensions: ['vtt'] },
      { name: 'ASS Subtitle', extensions: ['ass'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});
