const { app, BrowserWindow, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Start the Express backend and background loops
require('./index.js');

let mainWindow;
let tray = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 850,
        frame: false, // Sleek frameless UI
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false // Start hidden until ready
    });

    // Give Express a moment to start, then load the UI
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 2000);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Optional: Hide window when it loses focus (Spotlight effect)
    // mainWindow.on('blur', () => {
    //    mainWindow.hide();
    // });
}

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
