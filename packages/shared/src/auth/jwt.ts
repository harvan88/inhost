/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "packages/shared/src/auth/jwt.ts"
 *   type: "utility"
 *   layer: "shared"
 *   domain: "auth"
 *   purpose: "Utilidades JWT usando librería jose para creación, verificación y extracción de tokens. Implementa validación estricta de JWT_SECRET (min 32 chars, warnings para dev secrets). Exporta createToken (7d default), verifyToken, createRefreshToken (30d), extractTokenFromHeader. ⚠️ ISSUE: JWT_SECRET con fallback mencionado en AUDIT-REPORT.md 1.4"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: ["jose"]
 *   infrastructure: ["process.env.JWT_SECRET"]
 *
 * CONTRACTS:
 *   exports: ["AdminJWTPayload", "createToken", "verifyToken", "createRefreshToken", "extractTokenFromHeader"]
 *   inputs: ["AdminJWTPayload (userId, tenantId, email, role)", "token: string", "authHeader: string"]
 *   outputs: ["Promise<string> (JWT token)", "Promise<AdminJWTPayload>", "string | null"]
 *   errors: ["Error: JWT_SECRET missing/too short", "Error: Invalid or expired token"]
 *
 * INTEGRATION:
 *   data_flow: "[login] → [createToken(payload, '7d')] → [SignJWT with HS256] → [JWT string] → [HTTP response Authorization header] → [middleware extracts] → [verifyToken] → [AdminJWTPayload]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["middleware/auth.ts", "routes/admin/auth.ts"]
 *   uses: ["jose"]
 *   critical: true
 *
 * === DOC_END :: jwt.ts ===
 */

/**
 * JWT Token Utilities
 *
 * Handles creation and verification of JWT tokens for admin authentication.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * JWT payload for admin users
 */
export interface AdminJWTPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
}

/**
 * Get JWT secret from environment with strict validation
 * @throws Error if JWT_SECRET is missing or invalid
 */
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Generate one with: openssl rand -base64 64'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters long. Current length: ${secret.length}`
    );
  }

  if (secret.includes('default') || secret.includes('secret') || secret.includes('dev')) {
    console.warn(
      '⚠️  WARNING: JWT_SECRET appears to be a development secret. ' +
      'Use a strong random secret in production.'
    );
  }

  return new TextEncoder().encode(secret);
}

/**
 * Create a JWT token for an admin user
 * @param payload - User data to encode in the token
 * @param expiresIn - Token expiration time (default: 7 days)
 * @returns Promise<string> - Signed JWT token
 */
export async function createToken(
  payload: Omit<AdminJWTPayload, 'iat' | 'exp'>,
  expiresIn: string = '7d'
): Promise<string> {
  const secret = getJWTSecret();

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns Promise<AdminJWTPayload> - Decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<AdminJWTPayload> {
  const secret = getJWTSecret();

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as AdminJWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns string | null - Token if found, null otherwise
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Create a refresh token with longer expiration
 * @param payload - User data to encode in the token
 * @returns Promise<string> - Signed refresh token
 */
export async function createRefreshToken(
  payload: Omit<AdminJWTPayload, 'iat' | 'exp'>
): Promise<string> {
  return createToken(payload, '30d'); // 30 days expiration
}
