const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const ROOM = "test"; // change to your tlk.io room
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log(`🔎 Opening room: ${ROOM}`);
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle2" });

  // wait so JS can load messages
  await sleep(5000);

  const messages = await page.evaluate(() => {
    // possible selectors tlk.io has used
    const selectors = [
      ".messages .message",                // older
      ".tlkio-messages .tlk-message",      // newer
      "[data-role='message']"              // fallback
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
        break; // stop at first selector that matches
      }
    }
    return out;
  });

  await browser.close();

  if (!messages || messages.length === 0) {
    console.log("⚠️ No messages found in page DOM");
    return;
  }

  const newOnes = messages.filter(
    m => !seen.find(s => s.user === m.user && s.text === m.text)
  );

  if (newOnes.length === 0) {
    console.log("⚠️ No new messages since last check");
    return;
  }

  for (const msg of newOnes) {
    const fullMsg = `💬 New message in ${ROOM}\n👤 ${msg.user}\n📝 ${msg.text}`;
    console.log(fullMsg);
    await sendToTelegram(fullMsg);
  }

  seen = messages;
})();
