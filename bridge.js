// bridge.js
const fetch = require("node-fetch");
const fs = require("fs");

const ROOM = "your-room-name"; // 👈 replace with your tlk.io room
const URL = `https://tlk.io/${ROOM}`;
const STATE_FILE = "lastMessage.txt";

async function getMessages() {
  const res = await fetch(URL);
  const html = await res.text();

  // Extract chat messages from HTML (tlk.io puts them in <p class="message_body">)
  const matches = [...html.matchAll(/<p class="message_body[^>]*">(.*?)<\/p>/g)];
  return matches.map(m => m[1].replace(/<[^>]*>/g, "").trim());
}

async function sendToTelegram(msg) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg }),
  });
}

(async () => {
  try {
    const messages = await getMessages();
    if (messages.length === 0) {
      console.log("⚠️ No messages found in room:", ROOM);
      return;
    }

    const latest = messages[messages.length - 1];
    let lastSent = "";

    if (fs.existsSync(STATE_FILE)) {
      lastSent = fs.readFileSync(STATE_FILE, "utf8").trim();
    }

    if (latest && latest !== lastSent) {
      console.log("✅ Sending new message:", latest);
      await sendToTelegram(`💬 New message in ${ROOM}:\n${latest}`);
      fs.writeFileSync(STATE_FILE, latest);
    } else {
      console.log("ℹ️ No new messages.");
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
