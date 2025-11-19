/**
 * Admin Authentication Routes
 *
 * Endpoints:
 * - POST /admin/auth/signup - Create new tenant and owner user
 * - POST /admin/auth/login - Login and receive JWT token
 * - POST /admin/auth/refresh - Refresh JWT token
 * - GET /admin/auth/me - Get current user information
 */

import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import {
  db,
  adminUsers,
  tenants,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  createToken,
  createRefreshToken,
} from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * Generate unique slug from company name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Admin Authentication Routes
 */
export const adminAuthRoutes = new Elysia({ prefix: '/admin/auth' })
  .use(httpLogger)

  // POST /admin/auth/signup - Create new tenant and owner user
  .post(
    '/signup',
    async ({ body, error }) => {
      const { companyName, name, email, password } = body;

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return error(422, createErrorResponse('VALIDATION_ERROR', passwordValidation.errors.join(', ')));
      }

      try {
        // Check if email already exists
        const existingUser = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.email, email),
        });

        if (existingUser) {
          return error(409, createErrorResponse('EMAIL_EXISTS', 'An account with this email already exists'));
        }

        // Generate slug for tenant
        const slug = generateSlug(companyName);

        // Check if slug already exists
        const existingTenant = await db.query.tenants.findFirst({
          where: eq(tenants.slug, slug),
        });

        if (existingTenant) {
          return error(409, createErrorResponse('TENANT_EXISTS', 'A company with this name already exists'));
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create tenant and owner user in a transaction
        const [newTenant] = await db
          .insert(tenants)
          .values({
            name: companyName,
            slug,
            plan: 'starter',
            subscriptionStatus: 'trialing',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
          })
          .returning();

        const [newUser] = await db
          .insert(adminUsers)
          .values({
            tenantId: newTenant.id,
            email,
            passwordHash,
            name,
            role: 'owner',
            isActive: true,
          })
          .returning();

        // Generate tokens
        const accessToken = await createToken({
          userId: newUser.id,
          tenantId: newTenant.id,
          email: newUser.email,
          role: newUser.role as any,
        });

        const refreshToken = await createRefreshToken({
          userId: newUser.id,
          tenantId: newTenant.id,
          email: newUser.email,
          role: newUser.role as any,
        });

        return createSuccessResponse({
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            tenantId: newTenant.id,
            tenantName: newTenant.name,
            tenantSlug: newTenant.slug,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
          },
        });
      } catch (err: any) {
        console.error('Signup error:', err);
        return error(500, createErrorResponse('SIGNUP_FAILED', 'Failed to create account'));
      }
    },
    {
      body: t.Object({
        companyName: t.String({ minLength: 2, maxLength: 255 }),
        name: t.String({ minLength: 2, maxLength: 255 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
      }),
      detail: {
        summary: 'Sign Up',
        description: 'Create a new tenant account with an owner user',
        tags: ['Admin Auth'],
      },
    }
  )

  // POST /admin/auth/login - Login and receive JWT token
  .post(
    '/login',
    async ({ body, error }) => {
      const { email, password } = body;

      try {
        // Find user by email
        const user = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.email, email),
          with: {
            tenant: true,
          },
        });

        if (!user) {
          return error(401, createErrorResponse('INVALID_CREDENTIALS', 'Invalid email or password'));
        }

        // Check if user is active
        if (!user.isActive) {
          return error(403, createErrorResponse('ACCOUNT_DISABLED', 'Your account has been disabled'));
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
          return error(401, createErrorResponse('INVALID_CREDENTIALS', 'Invalid email or password'));
        }

        // Update last login timestamp
        await db
          .update(adminUsers)
          .set({ lastLoginAt: new Date() })
          .where(eq(adminUsers.id, user.id));

        // Generate tokens
        const accessToken = await createToken({
          userId: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role as any,
        });

        const refreshToken = await createRefreshToken({
          userId: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role as any,
        });

        return createSuccessResponse({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            tenantName: user.tenant.name,
            tenantSlug: user.tenant.slug,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
          },
        });
      } catch (err: any) {
        console.error('Login error:', err);
        return error(500, createErrorResponse('LOGIN_FAILED', 'Login failed'));
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String(),
      }),
      detail: {
        summary: 'Login',
        description: 'Authenticate with email and password',
        tags: ['Admin Auth'],
      },
    }
  )

  // GET /admin/auth/me - Get current user information
  .use(requireAuth())
  .get(
    '/me',
    async ({ user, error }) => {
      try {
        // Fetch full user data from database
        const userData = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.id, user.userId),
          with: {
            tenant: true,
          },
        });

        if (!userData) {
          return error(404, createErrorResponse('USER_NOT_FOUND', 'User not found'));
        }

        return createSuccessResponse({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          isActive: userData.isActive,
          lastLoginAt: userData.lastLoginAt,
          createdAt: userData.createdAt,
          tenant: {
            id: userData.tenant.id,
            name: userData.tenant.name,
            slug: userData.tenant.slug,
            plan: userData.tenant.plan,
            subscriptionStatus: userData.tenant.subscriptionStatus,
            trialEndsAt: userData.tenant.trialEndsAt,
          },
        });
      } catch (err: any) {
        console.error('Get user error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch user data'));
      }
    },
    {
      detail: {
        summary: 'Get Current User',
        description: 'Get authenticated user information',
        tags: ['Admin Auth'],
      },
    }
  );
