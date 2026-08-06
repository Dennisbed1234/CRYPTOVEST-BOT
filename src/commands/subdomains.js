import fetch from "node-fetch";
import { allow } from "../lib/rateLimit.js";

function isDomain(str) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(str);
}

// Passive-only: queries public certificate transparency logs via crt.sh.
// No packets are sent to the target — this just reads public CT log data,
// which is why it's safe to keep even under admin-only restriction.
export async function subdomainsCommand(ctx) {
  if (!allow(`${ctx.from.id}:subdomains`, 5, 60_000)) {
    return ctx.reply("Slow down a bit — try again in a minute.");
  }

  const domain = (ctx.match || "").toString().trim();
  if (!isDomain(domain)) {
    return ctx.reply("Usage: /subdomains <domain.com>\nOnly use on domains you own or have permission to assess.");
  }

  try {
    const res = await fetch(`https://crt.sh/?q=%25.${domain}&output=json`);
    if (!res.ok) throw new Error(`crt.sh returned ${res.status}`);
    const data = await res.json();

    const names = new Set();
    for (const entry of data) {
      entry.name_value.split("\n").forEach((n) => names.add(n.trim().toLowerCase()));
    }

    const sorted = [...names].filter((n) => !n.startsWith("*.")).sort();
    if (sorted.length === 0) return ctx.reply("No subdomains found in CT logs for this domain.");

    const preview = sorted.slice(0, 40);
    let msg = `Found ${sorted.length} unique names in CT logs for ${domain}:\n\n${preview.join("\n")}`;
    if (sorted.length > 40) msg += `\n\n...and ${sorted.length - 40} more.`;

    await ctx.reply(msg);
  } catch (err) {
    console.error("subdomains command error:", err.message);
    await ctx.reply("Couldn't reach crt.sh right now — try again shortly.");
  }
}
