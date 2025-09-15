const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");

const ROOM = "test"; // your tlk.io room
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

  // Save debug.html for inspection
  fs.writeFileSync("debug.html", html);

  // Auto-detect messages: any visible element containing text
  const messages = await page.evaluate(() => {
    const out = [];
    // Select all elements with text content
    const nodes = Array.from(document.querySelectorAll("*")).filter(
      el => el.textContent && el.offsetParent !== null // visible
    );

    nodes.forEach(node => {
      const text = node.textContent.trim();
      // Heuristic: ignore very short texts like username only or empty
      if (text.length > 1) {
        // Try to detect username
        let user = "Anonymous";
        const userEl = node.querySelector(".username, .tlk-username, .user");
        if (userEl) user = userEl.textContent.trim();

        out.push({ user, text });
      }
    });

    return out;
  });

  await browser.close();

  if (!messages || messages.length === 0) {
    console.log("⚠️ No messages detected. Check debug.html");
    return;
  }

  // Filter only new messages
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
