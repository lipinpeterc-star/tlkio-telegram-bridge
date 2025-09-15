// bridge.js
const https = require('https');
const parser = require('rss-parser');

// ——— CONFIGURATION ——— //
// !!! IMPORTANT: We will set these secrets in GitHub !!!
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RSS_FEED_URL = process.env.RSS_FEED_URL; // e.g., "https://tlk.io/yourroomname.rss"

// A simple in-memory store for the last message.
// This is reset every time the action runs, so we use a hidden file for persistence.
const fs = require('fs');
const STATE_FILE = '.last_message_state.txt';

function getLastMessageTitle() {
    try {
        return fs.readFileSync(STATE_FILE, 'utf8').trim();
    } catch (error) {
        return ''; // File doesn't exist yet
    }
}

function setLastMessageTitle(title) {
    fs.writeFileSync(STATE_FILE, title);
}

async function checkRSS() {
    let lastMessageTitle = getLastMessageTitle();
    console.log('🤖 Checking tlk.io RSS feed...');

    try {
        const feed = await parser.parseURL(RSS_FEED_URL);
        if (feed.items.length > 0) {
            const latestMessage = feed.items[0];
            if (latestMessage.title !== lastMessageTitle) {
                console.log('✅ New message found!: ' + latestMessage.title);
                const telegramMessage = `💬 New message in tlk.io\\nFrom: ${latestMessage.creator}\\nMessage: ${latestMessage.title}`;
                await sendToTelegram(telegramMessage);
                setLastMessageTitle(latestMessage.title);
            } else {
                console.log('ℹ️ No new messages.');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

async function sendToTelegram(message) {
    const data = JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        disable_notification: false // Set to true if you don't want a sound
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Telegram API error: ${responseData}`));
                } else {
                    resolve(responseData);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// Run the script
checkRSS();
