/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/middleware/auth.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "auth"
 *   purpose: "Middleware de autenticación JWT para proteger rutas y agregar contexto de usuario autenticado a request handlers"
 *
 * DEPENDENCIES:
 *   internal: ["@inhost/shared"]
 *   external: ["elysia"]
 *   infrastructure: ["jwt"]
 *
 * CONTRACTS:
 *   exports: ["requireAuth", "optionalAuth", "AuthContext"]
 *   inputs: ["string:JWT_token"]
 *   outputs: ["AuthContext", "AdminJWTPayload"]
 *   errors: ["UNAUTHORIZED", "INVALID_TOKEN"]
 *
 * INTEGRATION:
 *   data_flow: "[HTTP Request + Authorization header] → [extractToken] → [verifyToken] → [user context] → [route handler]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["routes/admin/*"]
 *   uses: ["@inhost/shared/auth"]
 *   critical: true
 *
 * === DOC_END :: auth.ts ===
 */

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
  return (app: Elysia) =>
    app.derive(async ({ request, set }: any) => {
      console.log('🔍 [AUTH] requireAuth() derive called');

      // Extract token from Authorization header
      const authHeader = request.headers.get('Authorization');
      const token = extractTokenFromHeader(authHeader || undefined);

      if (!token) {
        set.status = 401;
        throw new Error(JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
          },
        }));
      }

      try {
        // Verify token and extract user data
        const user = await verifyToken(token);

        console.log('✅ [AUTH] Token verified successfully:', { userId: user?.userId, tenantId: user?.tenantId });

        // Return user to make it available in route handler context
        return { user };
      } catch (err) {
        console.error('❌ [AUTH] Token verification failed:', err);

        set.status = 401;
        throw new Error(JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
          },
        }));
      }
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
