import "dotenv/config";
import { Bot } from "grammy";
import cron from "node-cron";

import { priceCommand } from "./commands/price.js";
import { alertCommand, myAlertsCommand, checkAlerts } from "./commands/alert.js";
import { checkWalletCommand, revokeCommand } from "./commands/checkwallet.js";
import { txCheckCommand } from "./commands/txcheck.js";
import { cveCommand } from "./commands/cve.js";
import { pwnedCommand } from "./commands/pwned.js";
import { subdomainsCommand } from "./commands/subdomains.js";
import { scanCommand } from "./commands/scan.js";
import { adminOnly } from "./lib/admin.js";
import { buildDigest } from "./lib/digest.js";
import { initThreatFeed } from "./lib/threatFeed.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Missing BOT_TOKEN in environment. Set it in .env or Railway variables.");
  process.exit(1);
}

const bot = new Bot(token);

// --- Public: crypto ---
bot.command("price", priceCommand);
bot.command("alert", alertCommand);
bot.command("myalerts", myAlertsCommand);

// --- Public: wallet security ---
bot.command("checkwallet", checkWalletCommand);
bot.command("revoke", revokeCommand);
bot.command("txcheck", txCheckCommand);

// --- Public: general security lookups (read-only, no active probing of a target) ---
bot.command("cve", cveCommand);
bot.command("pwned", pwnedCommand);

// --- Admin-only: recon tools (passive CT-log lookup + active port scan) ---
bot.command("subdomains", adminOnly, subdomainsCommand);
bot.command("scan", adminOnly, scanCommand);

bot.command("start", (ctx) =>
  ctx.reply(
    "Cryptovest Bot\n\n" +
      "💰 Crypto\n/price <SYM>\n/alert <SYM> <price>\n/myalerts\n\n" +
      "🔒 Wallet security\n/checkwallet <address>\n/revoke <address>\n/txcheck <txhash>\n\n" +
      "🛡️ Security lookups\n/cve <id or keyword>\n/pwned <email>\n\n" +
      "(Recon tools /subdomains and /scan are restricted to authorized operators.)"
  )
);

bot.catch((err) => console.error("Bot error:", err));

// Check price alerts every 5 minutes
cron.schedule("*/5 * * * *", () => checkAlerts(bot));

// Optional daily digest post at 08:00 server time, if DIGEST_CHAT_ID is set
if (process.env.DIGEST_CHAT_ID) {
  cron.schedule("0 8 * * *", async () => {
    try {
      const msg = await buildDigest();
      await bot.api.sendMessage(process.env.DIGEST_CHAT_ID, msg);
    } catch (err) {
      console.error("Digest post failed:", err.message);
    }
  });
}

await initThreatFeed();
bot.start();
console.log("Cryptovest Bot running (long polling)...");
