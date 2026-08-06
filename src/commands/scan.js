import net from "net";
import { allow } from "../lib/rateLimit.js";

// Common ports worth checking for a quick recon pass. Keep this list modest —
// this is meant for spot-checking your own infra, not a full 65535-port sweep.
const COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 6379, 8080, 8443];

function checkPort(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

function isHostname(str) {
  // very loose validation — real hostname/IP validation, blocks obvious garbage
  return /^[a-zA-Z0-9.-]+$/.test(str) && str.length < 256;
}

// This command is registered with the adminOnly middleware in bot.js, so it's
// already restricted to the operator's own Telegram ID. Even so, it requires
// a "CONFIRM" argument as a second speed bump against fat-fingering someone
// else's IP/domain.
export async function scanCommand(ctx) {
  if (!allow(`${ctx.from.id}:scan`, 3, 120_000)) {
    return ctx.reply("Rate-limited — wait a couple minutes between scans.");
  }

  const parts = (ctx.match || "").toString().trim().split(/\s+/);
  const [target, confirm] = parts;

  if (!target || !isHostname(target)) {
    return ctx.reply(
      "Usage: /scan <host> CONFIRM\n\n" +
        "Only scan infrastructure you own or are explicitly authorized to test. " +
        "The CONFIRM flag is required as a deliberate step — this is not for scanning third-party targets."
    );
  }
  if (confirm !== "CONFIRM") {
    return ctx.reply(
      `To scan ${target}, resend as:\n/scan ${target} CONFIRM\n\n` +
        "This confirms you own or are authorized to test this host."
    );
  }

  await ctx.reply(`Scanning ${target} across ${COMMON_PORTS.length} common ports...`);

  const results = await Promise.all(
    COMMON_PORTS.map(async (port) => ({ port, open: await checkPort(target, port) }))
  );
  const open = results.filter((r) => r.open).map((r) => r.port);

  if (open.length === 0) {
    return ctx.reply(`No open ports found among the ${COMMON_PORTS.length} checked.`);
  }
  await ctx.reply(`Open ports on ${target}:\n${open.join(", ")}`);
}
