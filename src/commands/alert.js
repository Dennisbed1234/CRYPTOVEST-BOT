import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { SYMBOL_TO_ID } from "./price.js";

// NOTE: Railway's filesystem is ephemeral on redeploy. This JSON file works fine
// for a single long-running instance but will reset on redeploy. For production,
// swap this for Railway's Postgres/Redis add-on.
const DATA_FILE = path.join(process.cwd(), "alerts.json");

function loadAlerts() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveAlerts(alerts) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(alerts, null, 2));
}

export async function alertCommand(ctx) {
  const parts = (ctx.match || "").toString().trim().split(/\s+/);
  const [symbolRaw, targetRaw] = parts;
  const symbol = (symbolRaw || "").toUpperCase();
  const target = parseFloat(targetRaw);

  if (!symbol || !SYMBOL_TO_ID[symbol] || !target || isNaN(target)) {
    return ctx.reply(
      "Usage: /alert <SYMBOL> <TARGET_PRICE>\nExample: /alert BTC 65000"
    );
  }

  const alerts = loadAlerts();
  alerts.push({
    chatId: ctx.chat.id,
    userId: ctx.from.id,
    symbol,
    target,
    createdAt: Date.now(),
    triggered: false,
  });
  saveAlerts(alerts);

  await ctx.reply(`Alert set: I'll ping you when ${symbol} crosses $${target.toLocaleString()}.`);
}

export async function myAlertsCommand(ctx) {
  const alerts = loadAlerts().filter(
    (a) => a.userId === ctx.from.id && !a.triggered
  );
  if (alerts.length === 0) return ctx.reply("You have no active alerts.");
  const lines = alerts.map((a) => `• ${a.symbol} @ $${a.target.toLocaleString()}`);
  await ctx.reply("Your active alerts:\n" + lines.join("\n"));
}

// Call this periodically (see bot.js cron job) to check and fire alerts.
export async function checkAlerts(bot) {
  const alerts = loadAlerts();
  const active = alerts.filter((a) => !a.triggered);
  if (active.length === 0) return;

  const ids = [...new Set(active.map((a) => SYMBOL_TO_ID[a.symbol]))].join(",");
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    if (!res.ok) return;
    const prices = await res.json();

    for (const alert of active) {
      const id = SYMBOL_TO_ID[alert.symbol];
      const current = prices[id]?.usd;
      if (current === undefined) continue;

      const crossed =
        (alert.target >= current && current >= alert.target * 0.999) ||
        (alert.target <= current && current <= alert.target * 1.001);

      if (crossed) {
        alert.triggered = true;
        await bot.api.sendMessage(
          alert.chatId,
          `🔔 ${alert.symbol} hit your target of $${alert.target.toLocaleString()} (now $${current.toLocaleString()})`
        );
      }
    }
    saveAlerts(alerts);
  } catch (err) {
    console.error("checkAlerts error:", err.message);
  }
}
