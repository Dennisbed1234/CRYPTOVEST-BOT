import fetch from "node-fetch";
import { allow } from "../lib/rateLimit.js";

const NVD_KEY = process.env.NVD_API_KEY || "";

export async function cveCommand(ctx) {
  if (!allow(`${ctx.from.id}:cve`, 5, 60_000)) {
    return ctx.reply("Slow down a bit — try again in a minute.");
  }

  const query = (ctx.match || "").toString().trim();
  if (!query) {
    return ctx.reply("Usage: /cve <CVE-ID or keyword>\nExample: /cve CVE-2024-3094\nExample: /cve openssh");
  }

  try {
    let url = "https://services.nvd.nist.gov/rest/json/cves/2.0?";
    if (/^CVE-\d{4}-\d+$/i.test(query)) {
      url += `cveId=${query.toUpperCase()}`;
    } else {
      url += `keywordSearch=${encodeURIComponent(query)}&resultsPerPage=5`;
    }

    const headers = NVD_KEY ? { apiKey: NVD_KEY } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`NVD returned ${res.status}`);
    const data = await res.json();

    const items = data.vulnerabilities || [];
    if (items.length === 0) return ctx.reply("No CVEs found for that query.");

    const lines = items.slice(0, 5).map((v) => {
      const cve = v.cve;
      const id = cve.id;
      const desc =
        cve.descriptions?.find((d) => d.lang === "en")?.value?.slice(0, 200) || "No description";
      const severity =
        cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity ||
        cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseSeverity ||
        cve.metrics?.cvssMetricV2?.[0]?.baseSeverity ||
        "UNRATED";
      return `• ${id} [${severity}]\n${desc}...`;
    });

    await ctx.reply(lines.join("\n\n"));
  } catch (err) {
    console.error("cve command error:", err.message);
    await ctx.reply("Couldn't reach NVD right now — try again shortly, or add NVD_API_KEY to raise rate limits.");
  }
}
