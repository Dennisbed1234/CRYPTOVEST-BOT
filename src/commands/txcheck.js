import fetch from "node-fetch";
import { allow } from "../lib/rateLimit.js";
import { isKnownScamAddress } from "../lib/threatFeed.js";

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || "";

// Method signatures worth flagging to a user reviewing a tx before they sign/broadcast
const SUSPICIOUS_SELECTORS = {
  "0x095ea7b3": "approve() — grants a spender permission to move a specific token amount",
  "0xa22cb465": "setApprovalForAll() — grants a spender FULL control over all your NFTs/tokens of this type",
  "0x39509351": "increaseAllowance() — raises an existing spending approval",
  "0x23b872dd": "transferFrom() — moves tokens out of an address using a prior approval",
};

function isTxHash(str) {
  return /^0x[a-fA-F0-9]{64}$/.test(str);
}

export async function txCheckCommand(ctx) {
  if (!allow(`${ctx.from.id}:txcheck`, 5, 60_000)) {
    return ctx.reply("Slow down a bit — try again in a minute.");
  }

  const hash = (ctx.match || "").toString().trim();
  if (!isTxHash(hash)) {
    return ctx.reply("Usage: /txcheck <0x transaction hash>");
  }
  if (!ETHERSCAN_KEY) {
    return ctx.reply("Transaction checks need ETHERSCAN_API_KEY configured on the server.");
  }

  try {
    const url = `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${hash}&apikey=${ETHERSCAN_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const tx = data.result;

    if (!tx) return ctx.reply("Transaction not found (wrong hash, or not yet mined).");

    const input = tx.input || "0x";
    const selector = input.slice(0, 10);
    const flag = SUSPICIOUS_SELECTORS[selector];
    const destIsScam = tx.to ? await isKnownScamAddress(tx.to) : false;

    let msg = `Tx: ${hash}\nTo: ${tx.to}\nValue: ${parseInt(tx.value, 16) / 1e18} ETH\n\n`;

    if (destIsScam) {
      msg += "🚨 The destination address is on ScamSniffer's known-scam list. Do not sign or broadcast this transaction.\n\n";
    }

    if (flag) {
      msg += `⚠️ This calls ${flag}\n\nDouble-check the contract address and the amount/spender before approving — this is one of the most common phishing patterns.`;
    } else if (input === "0x") {
      msg += "Plain ETH transfer, no contract call.";
    } else {
      msg += `Calls method ${selector} (not in the flagged list — that doesn't guarantee it's safe, just that it's not one of the common drainer patterns).`;
    }

    await ctx.reply(msg);
  } catch (err) {
    console.error("txcheck error:", err.message);
    await ctx.reply("Couldn't fetch that transaction right now.");
  }
}
