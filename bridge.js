// bridge.js
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

const ROOM = "msg"; // change this
const URL = `https://tlk.io/${ROOM}`;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

// store last seen messages in memory (resets each run in Actions)
let seen = [];

async function getMessages() {
  try {
    const res = await fetch(URL);
    const html = await res.text();

    const dom = new JSDOM(html);
    const nodes = dom.window.document.querySelectorAll(".messages .message");

    let messages = [];
    nodes.forEach(node => {
      const user = node.querySelector(".username")?.textContent.trim() || "Anonymous";
      const text = node.querySelector(".body")?.textContent.trim() || "";
      if (text) messages.push({ user, text });
    });

    return messages;
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return [];
  }
}

async function sendToTelegram(msg) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
  });
}

(async () => {
  console.log(`🔎 Checking room: ${ROOM}`);
  const messages = await getMessages();

  const newOnes = messages.filter(m =>
    !seen.find(s => s.user === m.user && s.text === m.text)
  );

  if (newOnes.length === 0) {
    console.log("⚠️ No new messages");
    return;
  }

  for (const msg of newOnes) {
    const fullMsg = `💬 New message in ${ROOM}\n👤 ${msg.user}\n📝 ${msg.text}`;
    console.log(fullMsg);
    await sendToTelegram(fullMsg);
  }

  seen = messages; // update memory
})();
