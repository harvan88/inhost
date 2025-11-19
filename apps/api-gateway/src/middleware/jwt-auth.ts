import { Elysia } from 'elysia';
import jwt from 'jsonwebtoken';

/**
 * JWT Authentication Middleware
 *
 * Verifies JWT tokens and adds tenant context to requests.
 * Used for /admin/* routes (tenant users).
 *
 * JWT Payload Structure:
 * {
 *   sub: tenant_user_id (UUID)
 *   email: string
 *   tenant_id: UUID
 *   role: 'owner' | 'admin' | 'agent' | 'viewer'
 *   iat: number
 *   exp: number
 * }
 */

const JWT_SECRET = process.env.JWT_SECRET || 'inhost-dev-secret-change-in-production';

export interface JWTPayload {
  sub: string;           // tenant_user_id
  email: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest {
  tenantUserId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * JWT Authentication Middleware for /admin/* routes
 *
 * Usage:
 * ```typescript
 * export const adminRoutes = new Elysia({ prefix: '/admin' })
 *   .use(authRoutes)        // Public routes (login, signup)
 *   .use(jwtAuth())         // Protect all routes below
 *   .use(tenantRoutes)      // Protected routes
 *   .use(conversationsRoutes);
 * ```
 */
export function jwtAuth() {
  return new Elysia({ name: 'jwt-auth' })
    .derive(async ({ request, set }) => {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        throw new Error('Missing or invalid Authorization header');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

        // Add auth context to request (available in handlers via context)
        const authContext: AuthenticatedRequest = {
          tenantUserId: payload.sub,
          tenantId: payload.tenant_id,
          email: payload.email,
          role: payload.role
        };

        return authContext;
      } catch (error) {
        set.status = 401;
        if (error instanceof jwt.TokenExpiredError) {
          throw new Error('Token expired');
        } else if (error instanceof jwt.JsonWebTokenError) {
          throw new Error('Invalid token');
        } else {
          throw new Error('Authentication failed');
        }
      }
    });
}

/**
 * Generate JWT token for a tenant user
 *
 * @param payload - User payload (sub, email, tenant_id, role)
 * @param expiresIn - Token expiration (default: '24h')
 * @returns JWT token string
 */
export function generateToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresIn: string = '24h'
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify a JWT token without throwing
 *
 * @param token - JWT token string
 * @returns Payload if valid, null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
