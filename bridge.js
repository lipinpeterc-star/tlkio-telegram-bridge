const { io } = require("socket.io-client");
const fetch = require("node-fetch");

const ROOM = "your-room-name";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

// Connect to tlk.io via socket.io
const socket = io("https://tlk.io", {
  path: "/socket.io",
  transports: ["websocket"],
  query: { room: ROOM },
});

socket.on("connect", () => {
  console.log("✅ Connected to tlk.io room:", ROOM);
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from tlk.io");
});

socket.on("message", (msg) => {
  const user = msg?.author?.name || "Anonymous";
  const text = msg?.body || "";
  const fullMsg = `💬 New message in ${ROOM}\n👤 ${user}\n📝 ${text}`;

  console.log(fullMsg);
  sendToTelegram(fullMsg);
});

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
