interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * In-memory sliding window rate limiter for API endpoints.
 * @param key Unique identifier (e.g. userId or IP)
 * @param limit Maximum allowed requests within the window
 * @param windowMs Window duration in milliseconds (default: 60 seconds)
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = rateLimitMap.get(key) || { timestamps: [] };
  // Keep only timestamps within current window
  const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0];
    const reset = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { success: false, remaining: 0, reset };
  }

  validTimestamps.push(now);
  rateLimitMap.set(key, { timestamps: validTimestamps });

  // Maintenance: prune expired keys if memory size grows
  if (rateLimitMap.size > 5_000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.timestamps.every((ts) => ts <= windowStart)) {
        rateLimitMap.delete(k);
      }
    }
  }

  return {
    success: true,
    remaining: limit - validTimestamps.length,
    reset: Math.ceil(windowMs / 1000),
  };
}
