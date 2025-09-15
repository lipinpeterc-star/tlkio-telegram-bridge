// bridge.js
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const ROOM = "your-room-name"; // change this
const URL = `https://tlk.io/${ROOM}`;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

let seen = [];

async function sendToTelegram(msg) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
    });
  } catch (err) {
    console.error("❌ Telegram error:", err);
  }
}

(async () => {
  console.log(`🔎 Opening room: ${ROOM}`);
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle2" });

  // wait a little so JS loads messages
  await page.waitForTimeout(5000);

  const messages = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".messages .message");
    let out = [];
    nodes.forEach(node => {
      const user = node.querySelector(".username")?.textContent.trim() || "Anonymous";
      const text = node.querySelector(".body")?.textContent.trim() || "";
      if (text) out.push({ user, text });
    });
    return out;
  });

  await browser.close();

  const newOnes = messages.filter(
    m => !seen.find(s => s.user === m.user && s.text === m.text)
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

  seen = messages;
})();
