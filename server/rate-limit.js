function createRateLimiter({ windowMs, limit, key, clock = Date.now, store = new Map(), maxEntries = 10_000 }) {
  return function rateLimit(req, res, next) {
    const now = clock();
    const bucketKey = String(key(req));
    let bucket = store.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    store.set(bucketKey, bucket);
    if (store.size > maxEntries) {
      for (const [entryKey, entry] of store) {
        if (entry.resetAt <= now || store.size > maxEntries) store.delete(entryKey);
      }
    }
    if (bucket.count > limit) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: "Muitas tentativas. Aguarde e tente novamente." });
    }
    next();
  };
}

module.exports = { createRateLimiter };
