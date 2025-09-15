const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const ROOM = "msg"; // tlk.io room
const URL = `https://tlk.io/${ROOM}`;
const LAST_FILE = path.join(__dirname, "lastMessages.json");
const DEBUG_FILE = path.join(__dirname, "debug.html");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

// Load last messages to prevent duplicates
let seen = [];
try {
  if (fs.existsSync(LAST_FILE)) {
    seen = JSON.parse(fs.readFileSync(LAST_FILE, "utf-8"));
  }
} catch (err) {
  console.warn("⚠️ Could not read lastMessages.json:", err.message);
}

async function sendToTelegram(msg) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
  });
}

(async () => {
  console.log(`🔎 Launching tlk.io room: ${ROOM}`);
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle2" });
  await page.waitForSelector("dd.post-message"); // wait for at least one message

  // Save debug.html once at startup
  const html = await page.content();
  fs.writeFileSync(DEBUG_FILE, html);

  console.log("✅ Listening for new messages...");

  // Real-time message detection via MutationObserver
  await page.exposeFunction("notifyNode", async node => {
    // Get timestamp and text
    const timestamp = node.getAttribute("data-timestamp") || Date.now();
    const text = Array.from(node.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .join(" ")
      .trim();
    if (!text) return;

    // Check duplicates
    if (seen.find(m => m.timestamp === timestamp)) return;

    // Add to seen
    const message = { user: "Anonymous", text, timestamp };
    seen.push(message);

    // Send Telegram
    const fullMsg = `💬 New message in ${ROOM}\n👤 ${message.user}\n📝 ${message.text}`;
    console.log(fullMsg);
    await sendToTelegram(fullMsg);

    // Save last messages
    fs.writeFileSync(LAST_FILE, JSON.stringify(seen, null, 2));
  });

  // Inject MutationObserver into the page
  await page.evaluate(() => {
    const container = document.querySelector("dd.post-message")?.parentElement;
    if (!container) return;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("post-message")) {
            // Notify Node.js
            window.notifyNode(node);
          }
        });
      });
    });

    observer.observe(container, { childList: true, subtree: false });
  });

  // Keep script running
  process.on("SIGINT", async () => {
    console.log("\n🛑 Exiting...");
    await browser.close();
    try {
      fs.unlinkSync(DEBUG_FILE);
      console.log("🗑️ debug.html deleted");
    } catch {}
    process.exit();
  });
})();
