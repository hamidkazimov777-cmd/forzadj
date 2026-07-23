/**
 * Простой in-process rate limiter (sliding window по ключу).
 * Достаточно для одного инстанса; при горизонтальном масштабировании
 * заменяется на Redis-реализацию за тем же интерфейсом checkRateLimit().
 *
 * Назначение — базовая защита от массового автоматизированного скачивания
 * в дополнение к суточному лимиту (который считается в БД).
 */

const hits = new Map<string, number[]>();

// Периодическая чистка «протухших» ключей, чтобы карта не росла бесконечно.
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    const fresh = times.filter((t) => now - t < windowMs);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(windowMs);

  const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= maxRequests) {
    const oldest = times[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - oldest),
    };
  }

  times.push(now);
  hits.set(key, times);
  return {
    allowed: true,
    remaining: maxRequests - times.length,
    retryAfterMs: 0,
  };
}
