import fetch from "node-fetch";
import { allow } from "../lib/rateLimit.js";

const SYMBOL_TO_ID = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  MATIC: "matic-network",
  LTC: "litecoin",
  USDT: "tether",
};

export async function priceCommand(ctx) {
  if (!allow(`${ctx.from.id}:price`, 10, 60_000)) {
    return ctx.reply("Slow down a bit — try again in a minute.");
  }

  const arg = (ctx.match || "").toString().trim().toUpperCase();
  if (!arg) {
    return ctx.reply(
      "Usage: /price <SYMBOL>\nExample: /price BTC\nSupported: " +
        Object.keys(SYMBOL_TO_ID).join(", ")
    );
  }

  const id = SYMBOL_TO_ID[arg];
  if (!id) {
    return ctx.reply(
      `Don't recognize "${arg}". Supported: ${Object.keys(SYMBOL_TO_ID).join(", ")}`
    );
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
    const data = await res.json();
    const price = data[id]?.usd;
    const change = data[id]?.usd_24h_change;

    if (price === undefined) throw new Error("No price data returned");

    const arrow = change >= 0 ? "🟢" : "🔴";
    await ctx.reply(
      `${arg}: $${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n` +
        `${arrow} 24h: ${change?.toFixed(2)}%`
    );
  } catch (err) {
    console.error("price command error:", err.message);
    await ctx.reply("Couldn't fetch that price right now — try again shortly.");
  }
}

export { SYMBOL_TO_ID };
