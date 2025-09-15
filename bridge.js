const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");

const ROOM = "msg"; // your tlk.io room
const URL = `https://tlk.io/${ROOM}`;
const LAST_FILE = "lastMessages.json";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

// Load last messages
let seen = [];
if (fs.existsSync(LAST_FILE)) {
  try {
    seen = JSON.parse(fs.readFileSync(LAST_FILE, "utf-8"));
  } catch {}
}

async function sendToTelegram(msg) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log(`🔎 Checking tlk.io room: ${ROOM}`);
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle2" });
  await sleep(5000);

  const html = await page.content();
  fs.writeFileSync("debug.html", html); // always save for inspection

  // Scrape chat messages
  const messages = await page.evaluate(() => {
    const out = [];
    // Select main chat container(s)
    const chatContainers = document.querySelectorAll(".messages, .tlkio-messages, [data-role='messages']");
    chatContainers.forEach(container => {
      const nodes = container.querySelectorAll("[data-role='message'], .message, .tlk-message");
      nodes.forEach(node => {
        const userEl = node.querySelector(".username, .tlk-username, .user");
        const textEl = node.querySelector(".body, .tlk-body, .message-text");

        if (!textEl) return; // ignore elements without text

        const text = textEl.textContent.trim();
        if (!text) return;

        const user = userEl?.textContent.trim() || "Anonymous";

        out.push({ user, text });
      });
    });
    return out;
  });

  await browser.close();

  if (!messages || messages.length === 0) {
    console.log("⚠️ No chat messages found. Check debug.html");
    return;
  }

  // Filter new messages
  const newOnes = messages.filter(
    m => !seen.find(s => s.user === m.user && s.text === m.text)
  );

  if (newOnes.length === 0) {
    console.log("⚠️ No new messages since last check");
  } else {
    for (const msg of newOnes) {
      const fullMsg = `💬 New message in ${ROOM}\n👤 ${msg.user}\n📝 ${msg.text}`;
      console.log(fullMsg);
      await sendToTelegram(fullMsg);
    }
  }

  // Save last messages
  fs.writeFileSync(LAST_FILE, JSON.stringify(messages, null, 2));
})();
