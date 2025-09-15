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
  fs.writeFileSync("debug.html", html); // temporarily save

  // Select post-message elements
  const messages = await page.evaluate(() => {
    const out = [];
    const nodes = document.querySelectorAll("dd.post-message");

    nodes.forEach(node => {
      // Get direct text content, ignoring child divs
      const text = Array.from(node.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join(" ")
        .trim();

      if (!text) return;

      const timestamp = node.getAttribute("data-timestamp") || Date.now();
      out.push({ user: "Anonymous", text, timestamp });
    });

    return out;
  });

  await browser.close();

  if (!messages || messages.length === 0) {
    console.log("⚠️ No chat messages found. Check debug.html");
  } else {
    // Filter only new messages
    const newOnes = messages.filter(
      m => !seen.find(s => s.timestamp === m.timestamp)
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
  }

  // Delete debug.html after run
  try {
    fs.unlinkSync("debug.html");
    console.log("🗑️ debug.html deleted after run");
  } catch (err) {
    console.warn("⚠️ Could not delete debug.html:", err.message);
  }
})();
