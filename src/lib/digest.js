import fetch from "node-fetch";

const DIGEST_COINS = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin" };

export async function buildDigest() {
  const ids = Object.values(DIGEST_COINS).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  );
  const data = await res.json();

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  let msg = `📊 Cryptovest Daily — ${date}\n\n`;
  for (const [symbol, id] of Object.entries(DIGEST_COINS)) {
    const price = data[id]?.usd;
    const change = data[id]?.usd_24h_change;
    if (price === undefined) continue;
    const arrow = change >= 0 ? "🟢" : "🔴";
    msg += `${symbol}: $${price.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${arrow} ${change?.toFixed(2)}%\n`;
  }
  msg += "\n#crypto #bitcoin #ethereum #cryptovest";
  return msg;
}
