// bridge.js
const https = require('https');
// Import the RSS Parser library correctly
const Parser = require('rss-parser');

// ——— CONFIGURATION ——— //
// !!! IMPORTANT: We will set these secrets in GitHub !!!
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RSS_FEED_URL = process.env.RSS_FEED_URL; // e.g., "https://tlk.io/yourroomname.rss"

// Create a new parser instance
const parser = new Parser();

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
        const feed = await parser.parseURL(RSS_FEED_URL, {
            requestOptions: {
                headers: {
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.9',
                    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'none',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                }
            }
        });

        // FIX: Add defensive checks here!
        if (!feed) {
            console.log('❌ Error: Feed object is undefined or null.');
            return;
        }

        if (!feed.items || !Array.isArray(feed.items)) {
            console.log('❌ Error: Feed items is not an array or is missing.', feed);
            return;
        }

        console.log(`ℹ️ Found ${feed.items.length} items in the feed.`);

        if (feed.items.length > 0) {
            const latestMessage = feed.items[0];
            // Check if the items have the properties we expect
            if (!latestMessage.title) {
                console.log('❌ Error: The latest message does not have a title property.', latestMessage);
                return;
            }
            if (latestMessage.title !== lastMessageTitle) {
                console.log('✅ New message found!: ' + latestMessage.title);
                // Use optional chaining (?.) and a fallback in case 'creator' is missing
                const creator = latestMessage.creator || 'Unknown';
                const telegramMessage = `💬 New message in tlk.io\\nFrom: ${creator}\\nMessage: ${latestMessage.title}`;
                await sendToTelegram(telegramMessage);
                setLastMessageTitle(latestMessage.title);
            } else {
                console.log('ℹ️ No new messages.');
            }
        } else {
            console.log('ℹ️ Feed is empty. No messages found.');
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
