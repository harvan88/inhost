/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\utils\security.ts"
 *   type: "utility"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles security functionality"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["sanitizeForLogging"]
 *   inputs: "any"
 *   outputs: "any"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: []
 *   critical: false
 *
 * === DOC_END :: security.ts ===
 */

/**
 * Security Utilities
 *
 * Provides utilities for secure logging and data sanitization
 */

/**
 * Sensitive fields that should never appear in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'privateKey',
  'authorization',
  'cookie',
  'session',
] as const;

/**
 * Sanitize an object for safe logging by removing sensitive fields
 *
 * @param obj - Object to sanitize (can be nested)
 * @param depth - Maximum depth to traverse (prevents infinite loops)
 * @returns Sanitized object safe for logging
 *
 * @example
 * const data = { email: 'user@example.com', password: 'secret123' };
 * sanitizeForLogging(data); // { email: 'user@example.com', password: '[REDACTED]' }
 */
export function sanitizeForLogging(obj: any, depth = 5): any {
  // Prevent infinite recursion
  if (depth <= 0) {
    return '[MAX_DEPTH_REACHED]';
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth - 1));
  }

  // Handle Error objects specially
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
      ...sanitizeForLogging({ ...obj }, depth - 1),
    };
  }

  // Handle regular objects
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if field is sensitive
    const isSensitive = SENSITIVE_FIELDS.some((sensitiveField) =>
      lowerKey.includes(sensitiveField.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, depth - 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
