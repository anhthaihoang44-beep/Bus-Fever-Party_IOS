const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 468,
    height: 832,
    minWidth: 360,
    minHeight: 640,
    useContentSize: true,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: '#1c2c4a',
    title: 'Bus Fever: Party Passenger Loop',
    icon: path.join(__dirname, '../public/icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAspectRatio(9 / 16);
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
