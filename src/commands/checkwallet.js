import fetch from "node-fetch";
import { allow } from "../lib/rateLimit.js";
import { isKnownScamAddress, feedStatus } from "../lib/threatFeed.js";

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "";

function isValidAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export async function checkWalletCommand(ctx) {
  if (!allow(`${ctx.from.id}:checkwallet`, 5, 60_000)) {
    return ctx.reply("Slow down a bit — try again in a minute.");
  }

  const address = (ctx.match || "").toString().trim();
  if (!isValidAddress(address)) {
    return ctx.reply("Usage: /checkwallet <0x address>\nOnly EVM (ETH/BSC-style) addresses are supported right now.");
  }

  if (!ETHERSCAN_KEY) {
    return ctx.reply(
      "Wallet checks need an Etherscan API key configured on the server (ETHERSCAN_API_KEY). Ask the bot admin to set one — it's free at etherscan.io/apis."
    );
  }

  try {
    await ctx.reply("Checking wallet activity, one sec...");

    // Pull recent token approval events (Approval / ApprovalForAll) for the address
    const url =
      `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}` +
      `&sort=desc&page=1&offset=25&apikey=${ETHERSCAN_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "1" && data.message !== "No transactions found") {
      throw new Error(data.message || "Etherscan error");
    }

    const txs = data.result || [];
    if (txs.length === 0) {
      return ctx.reply("No recent token activity found for this address.");
    }

    const uniqueContracts = [...new Set(txs.map((t) => t.contractAddress))];
    const flagResults = await Promise.all(
      uniqueContracts.map(async (c) => ({ address: c, flagged: await isKnownScamAddress(c) }))
    );
    const flagged = flagResults.filter((r) => r.flagged).map((r) => r.address);

    let msg = `Wallet: ${address}\n`;
    msg += `Recent token interactions: ${txs.length}\n`;
    msg += `Unique contracts touched: ${uniqueContracts.length}\n\n`;

    if (flagged.length > 0) {
      msg += `⚠️ FLAGGED: interacted with ${flagged.length} known-scam contract(s) (ScamSniffer database):\n`;
      msg += flagged.join("\n") + "\n\n";
    } else {
      const { size } = feedStatus();
      msg += `No matches against ScamSniffer's ${size.toLocaleString()}-address scam database. Note: this list has a ~7-day publication delay and can't catch everything — absence of a flag isn't a safety guarantee.\n\n`;
    }

    msg += `Recommended: review and revoke unused approvals at https://revoke.cash/address/${address}`;

    await ctx.reply(msg);
  } catch (err) {
    console.error("checkwallet error:", err.message);
    await ctx.reply("Couldn't complete the check — Etherscan may be rate-limiting or the address had no activity.");
  }
}

export async function revokeCommand(ctx) {
  const address = (ctx.match || "").toString().trim();
  if (!isValidAddress(address)) {
    return ctx.reply("Usage: /revoke <0x address>");
  }
  await ctx.reply(`Review and revoke token approvals here:\nhttps://revoke.cash/address/${address}`);
}
