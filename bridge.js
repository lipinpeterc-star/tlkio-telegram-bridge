const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");

const ROOM = "msg"; // tlk.io room
const URL = `https://tlk.io/${ROOM}`;
const LAST_FILE = "lastMessages.json"; // to store seen messages

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

// Load last seen messages
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
  await sleep(5000); // wait for messages to render

  const html = await page.content();

  const messages = await page.evaluate(() => {
    const selectors = [
      ".messages .message",
      ".tlkio-messages .tlk-message",
      "[data-role='message']"
    ];

    let out = [];
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length > 0) {
        nodes.forEach(node => {
          const user =
            node.querySelector(".username")?.textContent.trim() ||
            node.querySelector(".tlk-username")?.textContent.trim() ||
            "Anonymous";
          const text =
            node.querySelector(".body")?.textContent.trim() ||
            node.querySelector(".tlk-body")?.textContent.trim() ||
            node.textContent.trim();
          if (text) out.push({ user, text });
        });
        break; // use first selector that matches
      }
    }
    return out;
  });

  await browser.close();

  if (!messages || messages.length === 0) {
    fs.writeFileSync("debug.html", html);
    console.log("⚠️ No messages found. Saved debug.html for inspection");
    return;
  }

  // filter new messages
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

  // save last messages
  fs.writeFileSync(LAST_FILE, JSON.stringify(messages, null, 2));
})();
