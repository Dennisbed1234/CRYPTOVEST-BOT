import fetch from "node-fetch";

// ScamSniffer's open-source Web3 scam address blacklist. Free, community-run,
// updated daily, published with a 7-day delay (their paid API has real-time data —
// see https://www.scamsniffer.io if you ever want to upgrade this).
const FEED_URL =
  "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // refresh every 6 hours

let cache = {
  addresses: new Set(),
  fetchedAt: 0,
};

async function refresh() {
  try {
    const res = await fetch(FEED_URL, {
      headers: { "user-agent": "cryptovest-bot" },
    });
    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error("Unexpected feed format");

    cache = {
      addresses: new Set(list.map((a) => a.toLowerCase())),
      fetchedAt: Date.now(),
    };
    console.log(`Threat feed refreshed: ${cache.addresses.size} known scam addresses loaded.`);
  } catch (err) {
    console.error("Threat feed refresh failed:", err.message);
    // Keep serving the stale cache (if any) rather than failing checks outright.
  }
}

// Call once at bot startup so the first /checkwallet doesn't wait on a cold fetch.
export async function initThreatFeed() {
  await refresh();
}

// Returns true if the address is a known scam/drainer address.
export async function isKnownScamAddress(address) {
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
    await refresh();
  }
  return cache.addresses.has(address.toLowerCase());
}

export function feedStatus() {
  return {
    size: cache.addresses.size,
    ageMinutes: cache.fetchedAt ? Math.round((Date.now() - cache.fetchedAt) / 60000) : null,
  };
}
