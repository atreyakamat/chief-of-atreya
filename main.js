const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Start the Express backend and background loops
require('./index.js');

let mainWindow;
let tray = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        frame: false, // Sleek frameless UI
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false
    });

    mainWindow.loadURL('http://localhost:3000');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

// IPC Handlers for Custom Title Bar
ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    mainWindow.hide(); // Hide instead of close for persistent background assistant
});

ipcMain.on('app-quit', () => {
    app.quit();
});

app.whenReady().then(() => {
    createWindow();

    // Try to load a tray icon if it exists, otherwise leave empty
    const iconPath = path.join(__dirname, 'ui/icon.png');
    if (fs.existsSync(iconPath)) {
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show Zen', click: () => mainWindow.show() },
            { label: 'Quit', click: () => app.quit() }
        ]);
        tray.setToolTip('Zen Personal Jarvis');
        tray.setContextMenu(contextMenu);
    }

    // Register a global shortcut (Ctrl+Space) to pop open the dashboard
    globalShortcut.register('CommandOrControl+Space', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
