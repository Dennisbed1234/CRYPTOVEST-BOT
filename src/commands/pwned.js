import fetch from "node-fetch";
import { allow } from "../lib/rateLimit.js";

// HIBP's breach-search API requires a paid API key (hibp-api-key.com) as of their
// 2024 pricing change — there's no longer a free tier for this endpoint.
const HIBP_KEY = process.env.HIBP_API_KEY || "";

function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export async function pwnedCommand(ctx) {
  if (!allow(`${ctx.from.id}:pwned`, 5, 60_000)) {
    return ctx.reply("Slow down a bit — try again in a minute.");
  }

  const email = (ctx.match || "").toString().trim();
  if (!isEmail(email)) {
    return ctx.reply(
      "Usage: /pwned <email>\nCheck your own email for known data breaches. Please only check addresses you own or are authorized to check."
    );
  }

  if (!HIBP_KEY) {
    return ctx.reply(
      "Breach checks need an HIBP_API_KEY (paid, from haveibeenpwned.com/API/Key) configured on the server.\n\n" +
        "In the meantime, you can check manually at https://haveibeenpwned.com"
    );
  }

  try {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`,
      { headers: { "hibp-api-key": HIBP_KEY, "user-agent": "cryptovest-bot" } }
    );

    if (res.status === 404) {
      return ctx.reply(`✅ No breaches found for ${email}.`);
    }
    if (!res.ok) throw new Error(`HIBP returned ${res.status}`);

    const breaches = await res.json();
    const names = breaches.map((b) => b.Name).join(", ");
    await ctx.reply(
      `⚠️ ${email} appeared in ${breaches.length} breach(es):\n${names}\n\nIf you reused this password anywhere, change it now.`
    );
  } catch (err) {
    console.error("pwned command error:", err.message);
    await ctx.reply("Couldn't complete the breach check right now.");
  }
}
