const CDP = require('chrome-remote-interface');
const { exec } = require('child_process');
const os = require('os');

class BrowserMonitor {
    constructor() {
        this.client = null;
        this.activeTabs = new Map();
        this.tabTimers = new Map();  // Track time spent per tab
        this.currentFocusTab = null;

        // Distraction domains
        this.distractionDomains = [
            'youtube.com', 'reddit.com', 'twitter.com', 'x.com',
            'facebook.com', 'instagram.com', 'tiktok.com', 'twitch.tv',
            'netflix.com', 'discord.com'
        ];
    }

    async connect() {
        try {
            const targets = await CDP.List({ host: '127.0.0.1', port: 9222 });
            const pageTargets = targets.filter(t => t.type === 'page');

            if (pageTargets.length === 0) {
                const browser = os.platform() === 'linux' ? 'chromium' : 'chrome';
                console.log(`[Browser] No ${browser} pages found. Start ${browser} with --remote-debugging-port=9222`);
                return false;
            }

            this.client = await CDP({ host: '127.0.0.1', port: 9222, target: pageTargets[0] });
            const { Target } = this.client;

            await Target.setDiscoverTargets({ discover: true });

            Target.targetCreated((target) => {
                if (target.targetInfo.type === 'page') {
                    this.activeTabs.set(target.targetInfo.targetId, {
                        ...target.targetInfo,
                        openedAt: Date.now()
                    });
                }
            });

            Target.targetDestroyed((target) => {
                this.activeTabs.delete(target.targetId);
                this.tabTimers.delete(target.targetId);
            });

            Target.targetInfoChanged((target) => {
                if (target.targetInfo.type === 'page') {
                    const existing = this.activeTabs.get(target.targetInfo.targetId);
                    this.activeTabs.set(target.targetInfo.targetId, {
                        ...target.targetInfo,
                        openedAt: existing?.openedAt || Date.now()
                    });
                }
            });

            console.log(`[Browser] Connected via CDP — tracking ${pageTargets.length} tabs`);
            return true;
        } catch (err) {
            console.error('[Browser] CDP connection failed:', err.message);
            return false;
        }
    }

    getTabs() {
        return Array.from(this.activeTabs.values()).map(t => ({
            id: t.targetId,
            url: t.url,
            title: t.title,
            openedAt: t.openedAt,
            isDistraction: this._isDistraction(t.url)
        }));
    }

    getDistractionTabs() {
        return this.getTabs().filter(t => t.isDistraction);
    }

    _isDistraction(url) {
        if (!url) return false;
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            return this.distractionDomains.some(d => hostname.includes(d));
        } catch {
            return false;
        }
    }

    async disconnect() {
        if (this.client) {
            try { await this.client.close(); } catch {}
            this.client = null;
        }
    }
}

module.exports = new BrowserMonitor();
