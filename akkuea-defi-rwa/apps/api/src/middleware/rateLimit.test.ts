import { describe, it, expect, beforeEach } from 'bun:test';
import { rateLimit } from './rateLimit';

function createMockRequest(options: {
  headers?: Record<string, string>;
} = {}) {
  const headers = new Headers(options.headers ?? {});
  return {
    headers,
  } as unknown as Request;
}

function createMockSet() {
  const set = {
    status: undefined as number | string | undefined,
    headers: undefined as Record<string, string> | undefined,
  };
  return set;
}

describe('rateLimit middleware', () => {
  describe('basic rate limiting', () => {
    it('should allow requests under the limit', () => {
      const middleware = rateLimit({ max: 10, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.2.1' } });
      const set = createMockSet();

      const result = middleware({ request, set });

      expect(result).toBeUndefined();
      expect(set.status).toBeUndefined();
    });

    it('should block requests over the limit', () => {
      const middleware = rateLimit({ max: 3, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.2.2' } });
      const set = createMockSet();

      middleware({ request, set }); // 1st request
      middleware({ request, set }); // 2nd request
      middleware({ request, set }); // 3rd request
      const result = middleware({ request, set }); // 4th request - should be blocked

      expect(result).toEqual({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      });
      expect(set.status).toBe(429);
    });

    it('should set rate limit headers', () => {
      const middleware = rateLimit({ max: 10, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.3.1' } });
      const set = createMockSet();

      middleware({ request, set });

      expect(set.headers).toBeDefined();
      expect(set.headers!['X-RateLimit-Limit']).toBe('10');
      expect(set.headers!['X-RateLimit-Remaining']).toBe('9');
      expect(set.headers!['X-RateLimit-Reset']).toBeDefined();
    });
  });

  describe('identifier differentiation', () => {
    it('should track anonymous users by IP', () => {
      const middleware = rateLimit({ max: 2, windowMs: 60000 });

      const request1 = createMockRequest({ headers: { 'x-forwarded-for': '198.51.100.1' } });
      const request2 = createMockRequest({ headers: { 'x-forwarded-for': '198.51.100.2' } });
      const set1 = createMockSet();
      const set2 = createMockSet();

      middleware({ request: request1, set: set1 }); // 1st for IP1
      middleware({ request: request1, set: set1 }); // 2nd for IP1 - blocked
      const result2 = middleware({ request: request2, set: set2 }); // 1st for IP2 - should be allowed

      expect(result2).toBeUndefined();
    });

    it('should track authenticated users by x-user-address header', () => {
      const middleware = rateLimit({ max: 2, windowMs: 60000 });

      const request1 = createMockRequest({
        headers: { 'x-user-address': 'GAAAAAAA123456789', 'x-forwarded-for': '192.0.2.1' },
      });
      const request2 = createMockRequest({
        headers: { 'x-user-address': 'GBBBBBB987654321', 'x-forwarded-for': '192.0.2.1' },
      });
      const set1 = createMockSet();
      const set2 = createMockSet();

      middleware({ request: request1, set: set1 }); // 1st for user A
      middleware({ request: request1, set: set1 }); // 2nd for user A - blocked
      const result2 = middleware({ request: request2, set: set2 }); // 1st for user B - should be allowed

      expect(result2).toBeUndefined();
    });

    it('should prioritize user address over IP for authenticated requests', () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000 });

      const request = createMockRequest({
        headers: {
          'x-user-address': 'GCCCCCC555555555',
          'x-forwarded-for': '192.0.2.100',
        },
      });
      const set1 = createMockSet();
      const set2 = createMockSet();

      middleware({ request, set: set1 }); // 1st request
      const result = middleware({ request, set: set2 }); // 2nd request - should be blocked since same user

      expect(result).toEqual({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      });
    });
  });

  describe('Retry-After header', () => {
    it('should set Retry-After header when rate limited', () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.5.1' } });
      const set = createMockSet();

      middleware({ request, set }); // 1st request
      middleware({ request, set }); // 2nd request - blocked

      expect(set.headers!['Retry-After']).toBeDefined();
      expect(Number(set.headers!['Retry-After'])).toBeGreaterThan(0);
    });
  });

  describe('custom keyGenerator', () => {
    it('should use custom key generator when provided', () => {
      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        keyGenerator: (req) => `custom:${req.headers.get('x-api-key') ?? 'unknown'}`,
      });

      const request1 = createMockRequest({ headers: { 'x-api-key': 'key1', 'x-forwarded-for': '192.0.2.1' } });
      const request2 = createMockRequest({ headers: { 'x-api-key': 'key2', 'x-forwarded-for': '192.0.2.1' } });
      const set1 = createMockSet();
      const set2 = createMockSet();

      middleware({ request: request1, set: set1 }); // 1st with key1
      const result2 = middleware({ request: request2, set: set2 }); // 1st with key2 - should be allowed

      expect(result2).toBeUndefined();
    });
  });

  describe('default values', () => {
    it('should use default max of 10 and window of 60000ms', () => {
      const middleware = rateLimit();
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.7.1' } });
      const set = createMockSet();

      middleware({ request, set });

      expect(set.headers!['X-RateLimit-Limit']).toBe('10');
      expect(set.headers!['X-RateLimit-Remaining']).toBe('9');
    });
  });
});
