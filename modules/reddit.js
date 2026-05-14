const Snoowrap = require('snoowrap');

let r = null;

function initialize() {
    if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_USERNAME && process.env.REDDIT_PASSWORD) {
        r = new Snoowrap({
            userAgent: 'Zen Personal Agent v1.0',
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            username: process.env.REDDIT_USERNAME,
            password: process.env.REDDIT_PASSWORD
        });
        console.log('[Reddit] Initialized for research & discovery.');
    } else {
        console.log('[Reddit] Integration disabled (Missing environment variables).');
    }
}

async function searchReddit(query, limit = 5) {
    if (!r) return { success: false, error: 'Reddit not initialized' };
    
    try {
        const results = await r.search({ query: query, limit: limit, sort: 'relevance' });
        const data = results.map(post => ({
            title: post.title,
            subreddit: post.subreddit.display_name,
            score: post.score,
            url: post.url
        }));
        return { success: true, data };
    } catch (e) {
        console.error('[Reddit] Search error:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    initialize,
    searchReddit
};