/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\middleware\auth-rate-limit.ts"
 *   type: "utility"
 *   layer: "backend"
 *   domain: "auth"
 *   purpose: "Handles auth-rate-limit functionality"
 *
 * DEPENDENCIES:
 *   internal: ["../types/api"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["authRateLimit","startAuthRateLimitCleanup"]
 *   inputs: "Request"
 *   outputs: "string"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../types/api"]
 *   critical: true
 *
 * === DOC_END :: auth-rate-limit.ts ===
 */

/**
 * Auth Rate Limiting Middleware
 *
 * Provides IP-based rate limiting for authentication endpoints to prevent brute force attacks.
 * More aggressive limits than general API rate limiting.
 */

import type { Context } from 'elysia';
import { createErrorResponse } from '../types/api';

interface AuthRateLimitEntry {
  attempts: number;
  resetAt: Date;
  blockedUntil?: Date;
}

/**
 * Configuration for auth rate limiting
 */
const AUTH_RATE_LIMIT_CONFIG = {
  /** Maximum attempts per time window */
  maxAttempts: 5,
  /** Time window in milliseconds (15 minutes) */
  windowMs: 15 * 60 * 1000,
  /** Block duration after exceeding limit (1 hour) */
  blockDurationMs: 60 * 60 * 1000,
} as const;

/**
 * In-memory store for rate limiting
 * Key: IP address
 * Value: Rate limit entry
 */
const rateLimitStore = new Map<string, AuthRateLimitEntry>();

/**
 * Extract client IP from request
 */
function getClientIP(request: Request): string {
  // Check X-Forwarded-For header (for proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address (not available in all environments)
  return 'unknown';
}

/**
 * Check if IP is currently rate limited
 */
function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
} {
  const now = new Date();
  let entry = rateLimitStore.get(ip);

  // If no entry exists or window expired, create new entry
  if (!entry || now >= entry.resetAt) {
    entry = {
      attempts: 0,
      resetAt: new Date(now.getTime() + AUTH_RATE_LIMIT_CONFIG.windowMs),
    };
    rateLimitStore.set(ip, entry);
  }

  // Check if IP is blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const retryAfter = Math.ceil((entry.blockedUntil.getTime() - now.getTime()) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter,
    };
  }

  const allowed = entry.attempts < AUTH_RATE_LIMIT_CONFIG.maxAttempts;
  const remaining = Math.max(0, AUTH_RATE_LIMIT_CONFIG.maxAttempts - entry.attempts);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000),
  };
}

/**
 * Record a failed auth attempt
 */
function recordAttempt(ip: string): void {
  const now = new Date();
  const entry = rateLimitStore.get(ip);

  if (!entry) {
    rateLimitStore.set(ip, {
      attempts: 1,
      resetAt: new Date(now.getTime() + AUTH_RATE_LIMIT_CONFIG.windowMs),
    });
    return;
  }

  entry.attempts++;

  // If exceeded limit, block the IP
  if (entry.attempts >= AUTH_RATE_LIMIT_CONFIG.maxAttempts) {
    entry.blockedUntil = new Date(now.getTime() + AUTH_RATE_LIMIT_CONFIG.blockDurationMs);
    console.warn(`🚨 IP blocked due to rate limit exceeded: ${ip}`, {
      attempts: entry.attempts,
      blockedUntil: entry.blockedUntil,
    });
  }
}

/**
 * Auth Rate Limit Middleware
 *
 * Apply this middleware to authentication endpoints to prevent brute force attacks.
 *
 * @example
 * ```typescript
 * app.post('/auth/login', async ({ body }) => {
 *   // handler
 * }, { beforeHandle: [authRateLimit()] })
 * ```
 */
export function authRateLimit() {
  return async ({ request, set }: Context) => {
    const ip = getClientIP(request);
    const result = checkRateLimit(ip);

    // Add rate limit headers
    set.headers = {
      ...set.headers,
      'X-RateLimit-Limit': AUTH_RATE_LIMIT_CONFIG.maxAttempts.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetAt.toISOString(),
    };

    if (!result.allowed) {
      set.status = 429;
      set.headers['Retry-After'] = result.retryAfter?.toString() || '0';

      return createErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        `Too many authentication attempts. Please try again in ${result.retryAfter} seconds.`,
        {
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString(),
        }
      );
    }

    // Record this attempt
    recordAttempt(ip);
  };
}

/**
 * Cleanup expired entries (run periodically)
 */
function cleanup(): void {
  const now = new Date();
  let cleaned = 0;

  for (const [ip, entry] of rateLimitStore.entries()) {
    // Remove if both reset time and block time have passed
    const resetPassed = now >= entry.resetAt;
    const blockPassed = !entry.blockedUntil || now >= entry.blockedUntil;

    if (resetPassed && blockPassed) {
      rateLimitStore.delete(ip);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Auth rate limit cleanup: removed ${cleaned} expired entries`);
  }
}

/**
 * Start periodic cleanup (every 10 minutes)
 */
export function startAuthRateLimitCleanup(): void {
  setInterval(cleanup, 10 * 60 * 1000);
  console.log('✅ Auth rate limit cleanup started');
}
