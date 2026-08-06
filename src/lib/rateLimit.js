// Simple in-memory sliding-window rate limiter. Good enough for a single-instance
// Railway deployment. Swap for Redis if you scale to multiple instances.

const hits = new Map(); // key -> [timestamps]

/**
 * @param {string} key - unique key, e.g. `${userId}:${command}`
 * @param {number} max - max calls allowed in the window
 * @param {number} windowMs - window size in ms
 * @returns {boolean} true if allowed, false if rate-limited
 */
export function allow(key, max = 5, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

// Periodic cleanup so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, arr] of hits.entries()) {
    const fresh = arr.filter((t) => now - t < 300_000);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, 300_000).unref();
