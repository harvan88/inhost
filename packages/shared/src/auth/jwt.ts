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
 * Get JWT secret from environment or use default (for development)
 */
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
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
