// poll.js
const fetch = require("node-fetch");
const fs = require("fs");

const ROOM = "msg"; // replace with tlk.io room
const URL = `https://tlk.io/${ROOM}`;
const STATE_FILE = "lastMessage.txt";

async function getMessages() {
  const res = await fetch(URL);
  const html = await res.text();

  // crude regex to extract messages (tlk.io HTML contains them)
  const matches = [...html.matchAll(/<p class="message_body[^>]*">(.*?)<\/p>/g)];
  return matches.map(m => m[1].replace(/<[^>]*>/g, "").trim());
}

async function sendToTelegram(msg) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg }),
  });
}

(async () => {
  const messages = await getMessages();
  if (messages.length === 0) return;

  const latest = messages[messages.length - 1];
  let lastSent = "";

  if (fs.existsSync(STATE_FILE)) {
    lastSent = fs.readFileSync(STATE_FILE, "utf8").trim();
  }

  if (latest !== lastSent) {
    await sendToTelegram(`💬 New message in ${ROOM}: ${latest}`);
    fs.writeFileSync(STATE_FILE, latest);
  }
})();
