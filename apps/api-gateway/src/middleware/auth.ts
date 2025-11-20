/**
 * Authentication Middleware
 *
 * Protects routes by requiring valid JWT authentication.
 * Adds authenticated user information to request context.
 */

import { Elysia } from 'elysia';
import { verifyToken, extractTokenFromHeader, type AdminJWTPayload } from '@inhost/shared';

/**
 * Authenticated user context
 * Available in route handlers after requireAuth middleware
 */
export interface AuthContext {
  user: AdminJWTPayload;
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user to context
 *
 * Usage:
 * ```typescript
 * new Elysia()
 *   .use(requireAuth())
 *   .get('/admin/profile', ({ user }) => {
 *     // user is available here
 *     return { userId: user.userId };
 *   })
 * ```
 */
export function requireAuth() {
  return new Elysia({ name: 'auth' })
    .onRequest(async ({ request, set, store }: any) => {
      // Extract token from Authorization header
      const authHeader = request.headers.get('Authorization');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 Auth Middleware - onRequest');
      console.log('Authorization header:', authHeader?.substring(0, 50) + '...');

      const token = extractTokenFromHeader(authHeader || undefined);

      if (!token) {
        console.log('❌ No token extracted from header');
        set.status = 401;
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
          },
        };
      }

      console.log('✅ Token extracted, length:', token.length);

      try {
        // Verify token and extract user data
        const user = await verifyToken(token);

        console.log('✅ Token verified, user:', {
          userId: user.userId,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role
        });

        // Store user in request store (accessible in route handlers)
        store.user = user;
        console.log('✅ User stored in store.user');
      } catch (err) {
        console.log('❌ Token verification failed:', err);
        set.status = 401;
        return {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
          },
        };
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    })
    .derive(({ store }: any) => {
      console.log('🔍 Auth Middleware - derive');
      console.log('store.user exists?', !!store.user);
      console.log('store.user value:', store.user);

      // Make user available in route handler context
      return { user: store.user };
    });
}

/**
 * Optional authentication middleware
 * Adds user to context if token is valid, but doesn't require it
 *
 * Usage:
 * ```typescript
 * new Elysia()
 *   .use(optionalAuth())
 *   .get('/public', ({ user }) => {
 *     // user is available if authenticated, undefined otherwise
 *     if (user) {
 *       return { message: `Hello ${user.email}` };
 *     }
 *     return { message: 'Hello guest' };
 *   })
 * ```
 */
export function optionalAuth() {
  return new Elysia({ name: 'optional-auth' })
    .onRequest(async ({ request, store }: any) => {
      const authHeader = request.headers.get('Authorization');
      const token = extractTokenFromHeader(authHeader || undefined);

      if (!token) {
        store.user = undefined;
        return;
      }

      try {
        const user = await verifyToken(token);
        store.user = user;
      } catch {
        store.user = undefined;
      }
    })
    .derive(({ store }: any) => {
      return { user: store.user };
    });
}

/**
 * Role-based access control middleware
 * Requires specific roles to access routes
 *
 * @param allowedRoles - Array of roles that can access the route
 *
 * Usage:
 * ```typescript
 * new Elysia()
 *   .use(requireAuth())
 *   .use(requireRole(['owner', 'admin']))
 *   .delete('/admin/users/:id', ({ user }) => {
 *     // Only owners and admins can access this
 *   })
 * ```
 */
export function requireRole(allowedRoles: Array<'owner' | 'admin' | 'agent' | 'viewer'>) {
  return new Elysia({ name: 'role-check' })
    .derive(async ({ user, error }: any) => {
      if (!user) {
        return error(401, {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return error(403, {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
          },
        });
      }

      return {};
    });
}
