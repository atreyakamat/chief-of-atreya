const notifier = require('node-notifier');
const db = require('../db');
const { exec, spawn } = require('child_process');
const os = require('os');

class NotificationService {
    constructor() {
        this.listenerProcess = null;
        this.platform = os.platform();
    }

    // Sends a notification — uses notify-send on Linux (Arch/Omarchy), node-notifier as fallback
    sendNotification(title, message, urgent = false) {
        if (this.platform === 'linux') {
            // Use notify-send (libnotify) — native on Arch/Omarchy
            const urgency = urgent ? 'critical' : 'normal';
            exec(`notify-send -u ${urgency} -a "CHIEF" "${this._escape(title)}" "${this._escape(message)}"`, (err) => {
                if (err) {
                    console.error('notify-send failed, falling back to node-notifier:', err.message);
                    this._fallbackNotify(title, message, urgent);
                }
            });
        } else {
            this._fallbackNotify(title, message, urgent);
        }

        // Always log to DB
        this.logNotification('CHIEF', title, message, urgent ? 'urgent' : 'normal');
    }

    _fallbackNotify(title, message, urgent) {
        notifier.notify({
            title: title,
            message: message,
            sound: urgent,
            wait: true
        });
    }

    _escape(str) {
        // Escape double quotes and backticks for shell safety
        return (str || '').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    }

    logNotification(source, title, body, priority = 'normal') {
        try {
            const stmt = db.prepare('INSERT INTO notifications (app_source, title, body, priority) VALUES (?, ?, ?, ?)');
            stmt.run(source, title, body, priority);
        } catch (err) {
            console.error('Failed to log notification:', err);
        }
    }

    getRecentNotifications(limit = 20) {
        try {
            const stmt = db.prepare('SELECT * FROM notifications ORDER BY timestamp DESC LIMIT ?');
            return stmt.all(limit);
        } catch (err) {
            console.error('Failed to get notifications:', err);
            return [];
        }
    }

    // Listen for OS notifications via dbus-monitor on Linux (Arch/Omarchy)
    startListening() {
        if (this.platform === 'linux') {
            console.log('[Notifications] Starting dbus-monitor listener for desktop notifications...');
            try {
                this.listenerProcess = spawn('dbus-monitor', [
                    "--session",
                    "interface='org.freedesktop.Notifications',member='Notify'"
                ]);

                let buffer = '';
                this.listenerProcess.stdout.on('data', (data) => {
                    buffer += data.toString();
                    // Parse notification signals from dbus output
                    const notifications = this._parseDbusNotifications(buffer);
                    for (const notif of notifications) {
                        console.log(`[Notification Intercepted] ${notif.app}: ${notif.summary}`);
                        this.logNotification(notif.app, notif.summary, notif.body, 'normal');
                    }
                    // Keep only the last incomplete chunk
                    const lastSignal = buffer.lastIndexOf('signal ');
                    if (lastSignal > 0) {
                        buffer = buffer.substring(lastSignal);
                    }
                });

                this.listenerProcess.stderr.on('data', (data) => {
                    console.error('[dbus-monitor stderr]:', data.toString());
                });

                this.listenerProcess.on('close', (code) => {
                    console.log(`[Notifications] dbus-monitor exited with code ${code}`);
                });

            } catch (err) {
                console.error('[Notifications] Failed to start dbus-monitor:', err.message);
                console.log('[Notifications] Notification interception unavailable. Logging CHIEF-generated notifications only.');
            }
        } else if (this.platform === 'win32') {
            console.log('[Notifications] Windows notification interception is limited. Logging CHIEF-generated notifications.');
        } else if (this.platform === 'darwin') {
            console.log('[Notifications] macOS notification interception placeholder.');
        }
    }

    _parseDbusNotifications(text) {
        const results = [];
        // Very basic dbus-monitor parser — extracts string arguments from Notify calls
        const signalBlocks = text.split('method call');
        for (const block of signalBlocks) {
            if (block.includes("member=Notify")) {
                const strings = [];
                const stringRegex = /string "([^"]*)"/g;
                let match;
                while ((match = stringRegex.exec(block)) !== null) {
                    strings.push(match[1]);
                }
                // Notify args: app_name, replaces_id, icon, summary, body, actions, hints, timeout
                if (strings.length >= 4) {
                    results.push({
                        app: strings[0] || 'Unknown',
                        summary: strings[2] || 'Notification',
                        body: strings[3] || ''
                    });
                }
            }
        }
        return results;
    }

    stopListening() {
        if (this.listenerProcess) {
            this.listenerProcess.kill();
            this.listenerProcess = null;
        }
    }
}

module.exports = new NotificationService();
