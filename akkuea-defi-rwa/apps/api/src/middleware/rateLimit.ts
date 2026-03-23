interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (request: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX = 10;

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function getIdentifier(request: Request, keyGenerator?: (request: Request) => string): string {
  if (keyGenerator) {
    return keyGenerator(request);
  }
  const userAddress = request.headers.get('x-user-address');
  if (userAddress) {
    return `user:${userAddress}`;
  }
  return `ip:${getClientIP(request)}`;
}

function createRateLimitStore() {
  const store = new Map<string, RateLimitEntry>();

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }

  function checkLimit(identifier: string, windowMs: number, max: number): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
  } {
    cleanup();
    const now = Date.now();
    const entry = store.get(identifier);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs;
      store.set(identifier, { count: 1, resetAt });
      return { allowed: true, remaining: max - 1, resetAt };
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
    }

    return { allowed: true, remaining, resetAt: entry.resetAt };
  }

  return { checkLimit };
}

export function rateLimit(options: RateLimitOptions = {}) {
  const { windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX, keyGenerator } = options;
  const store = createRateLimitStore();

  return function rateLimitMiddleware({ request, set }: { request: Request; set: { status?: number | string; headers?: Record<string, string> } }) {
    const identifier = getIdentifier(request, keyGenerator);
    const result = store.checkLimit(identifier, windowMs, max);

    set.headers = {
      ...(set.headers ?? {}),
      'X-RateLimit-Limit': String(max),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    };

    if (!result.allowed) {
      set.status = 429;
      if (result.retryAfter) {
        set.headers['Retry-After'] = String(result.retryAfter);
      }
      return {
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      };
    }
  };
}