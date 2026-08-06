const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export function isAdmin(ctx) {
  const userId = String(ctx.from?.id || "");
  return ADMIN_IDS.includes(userId);
}

// Use as: bot.command("scan", adminOnly, async (ctx) => {...})
export async function adminOnly(ctx, next) {
  if (!isAdmin(ctx)) {
    await ctx.reply(
      "This command is restricted to authorized operators. Recon/scanning tools are limited to prevent misuse against third-party targets."
    );
    return;
  }
  await next();
}
