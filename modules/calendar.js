const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

let calendar = null;

function initialize() {
    // Expecting a service account or OAuth credentials in a local file or env var
    const credentialsPath = path.join(__dirname, '../credentials.json');
    if (fs.existsSync(credentialsPath)) {
        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/calendar'],
            });
            calendar = google.calendar({ version: 'v3', auth });
            console.log('[Calendar] Google Calendar API initialized.');
        } catch (e) {
            console.error('[Calendar] Failed to initialize API:', e.message);
        }
    } else {
        console.log('[Calendar] Integration disabled (credentials.json missing).');
    }
}

async function getUpcomingEvents(maxResults = 10) {
    if (!calendar) return [];
    try {
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items || [];
    } catch (e) {
        console.error('[Calendar] Error fetching events:', e.message);
        return [];
    }
}

async function addEvent(summary, description, startTimeISO, endTimeISO) {
    if (!calendar) return { success: false, error: 'Not initialized' };
    try {
        const event = {
            summary,
            description,
            start: { dateTime: startTimeISO },
            end: { dateTime: endTimeISO },
        };
        const res = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        return { success: true, eventLink: res.data.htmlLink };
    } catch (e) {
        console.error('[Calendar] Error adding event:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    initialize,
    getUpcomingEvents,
    addEvent
};