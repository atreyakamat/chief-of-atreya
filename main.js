const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
// Start the Express backend and background loops
const { initializeAll } = require('./index.js');

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

    mainWindow.show();
    mainWindow.focus();
}

// IPC Handlers for Custom Title Bar
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.hide(); // Hide instead of close
});

ipcMain.on('app-quit', () => {
    app.quit();
});

ipcMain.on('open-external', (event, url) => {
    require('electron').shell.openExternal(url);
});

let popupWindow;
function createZenPopup() {
    popupWindow = new BrowserWindow({
        width: 320,
        height: 100,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    popupWindow.loadFile(path.join(__dirname, 'ui/popup.html'));

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    popupWindow.setPosition(width - 340, height - 120);
}

ipcMain.on('show-zen-popup', (event, text) => {
    if (popupWindow) {
        popupWindow.webContents.send('update-popup-text', text || "Yes, Sir?");
        popupWindow.show();
        setTimeout(() => popupWindow.hide(), 4000);
    }
});

console.log('[Main] Electron process starting...');
app.whenReady().then(async () => {
    console.log('[Main] App ready, initializing systems...');
    await initializeAll(); // Start Express and background services
    createWindow();
    createZenPopup();

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
