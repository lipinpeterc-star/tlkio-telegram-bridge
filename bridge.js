// bridge.js
const https = require('https');
// Import the libraries
const Parser = require('rss-parser'); // We'll keep this for now, might remove later
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ——— CONFIGURATION ——— //
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TLKIO_ROOM_URL = process.env.RSS_FEED_URL.replace('.rss', ''); // Use the main chat page URL

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

// Function to extract messages from HTML using regex
function extractMessagesFromHTML(html) {
    console.log('🔍 Parsing HTML for messages...');
    const messages = [];
    
    // This regex looks for message elements in the HTML
    // This is a simplified version and might need adjustment based on actual HTML structure
    const messageRegex = /<div[^>]*class="[^"]*message[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const usernameRegex = /<span[^>]*class="[^"]*username[^"]*"[^>]*>([^<]*)<\/span>/i;
    const textRegex = /<p[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/p>/i;
    
    let match;
    while ((match = messageRegex.exec(html)) !== null) {
        const messageHtml = match[1];
        const usernameMatch = messageHtml.match(usernameRegex);
        const textMatch = messageHtml.match(textRegex);
        
        if (usernameMatch && textMatch) {
            const username = usernameMatch[1].trim();
            let text = textMatch[1].trim();
            
            // Clean up HTML tags from the message text
            text = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            
            messages.push({
                username: username,
                text: text,
                title: `${username}: ${text}` // For compatibility with existing code
            });
        }
    }
    
    console.log(`ℹ️ Found ${messages.length} messages in HTML`);
    return messages;
}

async function checkTlkIo() {
    let lastMessageTitle = getLastMessageTitle();
    console.log('🤖 Scraping tlk.io chat page...');

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            console.log(`📡 Attempt ${retryCount + 1}/${maxRetries}: Fetching chat page...`);
            const response = await fetch(TLKIO_ROOM_URL, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                },
                timeout: 15000,
            });

            if (!response.ok) {
                throw new Error(`HTTP Error! Status: ${response.status} ${response.statusText}`);
            }

            const html = await response.text();
            console.log('✅ Successfully fetched chat page.');
            
            // DEBUG: Check what we received
            console.log('🔍 First 500 characters of HTML:');
            console.log(html.substring(0, 500));
            
            // Extract messages from HTML
            const messages = extractMessagesFromHTML(html);
            
            if (messages.length > 0) {
                const latestMessage = messages[messages.length - 1]; // Get most recent message
                
                if (latestMessage.title !== lastMessageTitle) {
                    console.log('✅ New message found!: ' + latestMessage.title);
                    const telegramMessage = `💬 New message in tlk.io\\nFrom: ${latestMessage.username}\\nMessage: ${latestMessage.text}`;
                    await sendToTelegram(telegramMessage);
                    setLastMessageTitle(latestMessage.title);
                } else {
                    console.log('ℹ️ No new messages.');
                }
            } else {
                console.log('ℹ️ No messages found in the chat.');
                // If no messages found, let's save the HTML for debugging
                fs.writeFileSync('debug_html.html', html);
                console.log('💾 Saved HTML to debug_html.html for inspection');
            }
            
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

// Run the scraping function instead of RSS
checkTlkIo();
