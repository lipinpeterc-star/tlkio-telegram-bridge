// bridge.js
const WebSocket = require("ws");
const fetch = require("node-fetch");

// 🔧 Replace with your room
const ROOM = "test";
const WS_URL = `wss://tlk.io/socket.io/?EIO=3&transport=websocket&room=${ROOM}`;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

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

console.log("🔗 Connecting to tlk.io room:", ROOM);

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("✅ Connected to tlk.io WebSocket");
});

ws.on("message", (data) => {
  const msg = data.toString();

  // tlk.io uses socket.io protocol (messages start with numbers + JSON)
  if (msg.startsWith("42")) {
    try {
      const payload = JSON.parse(msg.slice(2)); // strip socket.io prefix
      const [event, content] = payload;

      if (event === "message") {
        const user = content.author && content.author.name ? content.author.name : "Anonymous";
        const text = content.body || "";
        const fullMsg = `💬 New message in ${ROOM}\n👤 ${user}\n📝 ${text}`;

        console.log(fullMsg);
        sendToTelegram(fullMsg);
      }
    } catch (err) {
      console.error("⚠️ Parse error:", err);
    }
  }
});

ws.on("close", () => {
  console.log("❌ Disconnected from WebSocket");
});

ws.on("error", (err) => {
  console.error("⚠️ WebSocket error:", err);
});
