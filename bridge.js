// bridge.js
const https = require('https');
// Import the RSS Parser library correctly
const Parser = require('rss-parser');
// FIX: Use the correct import syntax for node-fetch
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ——— CONFIGURATION ——— //
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RSS_FEED_URL = process.env.RSS_FEED_URL;
// ... the rest of your code remains exactly the same ...

// bridge.js
const https = require('https');
// Import the libraries
const Parser = require('rss-parser');
const fetch = require('node-fetch'); // Import node-fetch

// ——— CONFIGURATION ——— //
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RSS_FEED_URL = process.env.RSS_FEED_URL;

const parser = new Parser();
const fs = require('fs');
const STATE_FILE = '.last_message_state.txt';

function getLastMessageTitle() {
    try {
        return fs.readFileSync(STATE_FILE, 'utf8').trim();
    } catch (error) {
        return '';
    }
}

function setLastMessageTitle(title) {
    fs.writeFileSync(STATE_FILE, title);
}

async function checkRSS() {
    let lastMessageTitle = getLastMessageTitle();
    console.log('🤖 Checking tlk.io RSS feed...');

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            // FIX: Use node-fetch for a more robust and configurable HTTP request
            console.log(`📡 Attempt ${retryCount + 1}/${maxRetries}: Fetching RSS feed...`);
            const response = await fetch(RSS_FEED_URL, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/xml, text/xml, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                // 15 second timeout
                timeout: 15000,
            });

            // Check if the request was successful
            if (!response.ok) {
                throw new Error(`HTTP Error! Status: ${response.status} ${response.statusText}`);
            }

            // Get the response text (XML)
            const xmlText = await response.text();
            console.log('✅ Successfully fetched RSS feed.');

            // Now parse the XML text with rss-parser
            const feed = await parser.parseString(xmlText);

            // --- Defensive checks remain the same from here ---
            if (!feed) {
                console.log('❌ Error: Feed object is undefined or null.');
                return;
            }
            if (!feed.items || !Array.isArray(feed.items)) {
                console.log('❌ Error: Feed items is not an array or is missing.');
                return;
            }
            console.log(`ℹ️ Found ${feed.items.length} items in the feed.`);
            if (feed.items.length > 0) {
                const latestMessage = feed.items[0];
                if (!latestMessage.title) {
                    console.log('❌ Error: The latest message does not have a title property.');
                    return;
                }
                if (latestMessage.title !== lastMessageTitle) {
                    console.log('✅ New message found!: ' + latestMessage.title);
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
            // Success! Break out of the retry loop.
            break;

        } catch (error) {
            retryCount++;
            console.error(`❌ Attempt ${retryCount}/${maxRetries} failed:`, error.message);
            if (retryCount >= maxRetries) {
                console.error('❌ All retry attempts failed. Giving up.');
                break;
            }
            console.log(`🔄 Retrying in 3 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

async function sendToTelegram(message) {
    const data = JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        disable_notification: false
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
