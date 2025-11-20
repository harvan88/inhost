<<<<<<< HEAD
import { Elysia, t } from 'elysia';
import bcrypt from 'bcrypt';
import { pool } from '@inhost/shared/database/config';
import { generateToken } from '../../middleware/jwt-auth';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { logger } from '../../middleware/logger';

/**
 * Admin Authentication Routes
 *
 * Public endpoints (no JWT required):
 * - POST /admin/auth/login - Login for tenant users
 * - POST /admin/auth/signup - Create new tenant + owner user
 * - GET /admin/auth/me - Get current user info (requires JWT)
 */

const SALT_ROUNDS = 10;

/**
 * Authentication Routes for /admin/*
 *
 * These routes are PUBLIC (no JWT required) to allow login/signup.
 * All other /admin/* routes require JWT authentication.
 */
export const authRoutes = new Elysia({ prefix: '/auth' })
  /**
   * POST /admin/auth/login
   *
   * Authenticate a tenant user and return JWT token
   *
   * Request:
   * {
   *   "email": "admin@company.com",
   *   "password": "password123"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "token": "eyJhbGc...",
   *     "user": {
   *       "id": "uuid",
   *       "email": "admin@company.com",
   *       "name": "Admin User",
   *       "role": "owner",
   *       "tenant": {
   *         "id": "uuid",
   *         "name": "Company Name",
   *         "slug": "company-name",
   *         "plan": "professional"
   *       }
   *     }
   *   }
   * }
   */
  .post(
    '/login',
    async ({ body, set }) => {
      logger.info('🔐 Login attempt', { email: body.email });

      try {
        // 1. Find tenant_user by email
        const result = await pool.query(
          `
          SELECT
            tu.id,
            tu.email,
            tu.name,
            tu.password_hash,
            tu.role,
            tu.tenant_id,
            t.name as tenant_name,
            t.slug as tenant_slug,
            t.plan,
            t.subscription_status
          FROM tenant_users tu
          JOIN tenants t ON t.id = tu.tenant_id
          WHERE tu.email = $1 AND tu.deleted_at IS NULL
        `,
          [body.email]
        );

        if (result.rows.length === 0) {
          set.status = 401;
          return createErrorResponse('Invalid credentials');
        }

        const user = result.rows[0];

        // 2. Verify password
        const validPassword = await bcrypt.compare(
          body.password,
          user.password_hash
        );

        if (!validPassword) {
          set.status = 401;
          return createErrorResponse('Invalid credentials');
        }

        // 3. Check tenant subscription status
        if (user.subscription_status === 'suspended') {
          set.status = 403;
          return createErrorResponse(
            'Account suspended. Please contact support.'
          );
        }

        // 4. Generate JWT token
        const token = generateToken({
          sub: user.id,
          email: user.email,
          tenant_id: user.tenant_id,
          role: user.role
        });

        logger.info('✅ Login successful', {
          email: body.email,
          tenantId: user.tenant_id
        });

        // 5. Return token and user info
        return createSuccessResponse({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenant: {
              id: user.tenant_id,
              name: user.tenant_name,
              slug: user.tenant_slug,
              plan: user.plan
            }
          }
        });
      } catch (error) {
        logger.error('❌ Login error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        set.status = 500;
        return createErrorResponse('Internal server error');
=======
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
      const { tenantName, name, email, password, plan = 'starter' } = body;

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
        const slug = generateSlug(tenantName);

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
            name: tenantName,
            slug,
            plan: plan as 'starter' | 'professional' | 'enterprise',
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

        // Database connection errors
        if (err.code === 'ECONNREFUSED') {
          return error(503, createErrorResponse(
            'DATABASE_UNAVAILABLE',
            'Database service is currently unavailable. Please try again later or contact support.',
            { hint: 'Make sure PostgreSQL is running (bun run dev:db)' }
          ));
        }

        // Connection timeout
        if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
          return error(504, createErrorResponse(
            'DATABASE_TIMEOUT',
            'Database connection timed out. Please try again.',
            { hint: 'Check database connection settings' }
          ));
        }

        // Unique constraint violations (duplicate email/slug)
        if (err.code === '23505') {
          return error(409, createErrorResponse(
            'DUPLICATE_ENTRY',
            'An account with this information already exists.',
            { hint: 'Try a different email or company name' }
          ));
        }

        // Generic database error
        return error(500, createErrorResponse(
          'SIGNUP_FAILED',
          'Failed to create account due to a server error. Please try again.',
          { hint: err.message }
        ));
>>>>>>> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
      }
    },
    {
      body: t.Object({
<<<<<<< HEAD
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 })
      }),
      detail: {
        summary: 'Login (Tenant User)',
        description:
          'Authenticate a tenant user and receive JWT token for /admin/* endpoints',
        tags: ['Auth']
      }
    }
  )

  /**
   * POST /admin/auth/signup
   *
   * Create a new tenant (organization) and owner user
   *
   * Request:
   * {
   *   "email": "admin@newcompany.com",
   *   "password": "password123",
   *   "name": "Admin User",
   *   "tenantName": "New Company",
   *   "plan": "starter"
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "token": "eyJhbGc...",
   *     "user": { ... },
   *     "tenant": { ... }
   *   }
   * }
   */
  .post(
    '/signup',
    async ({ body, set }) => {
      logger.info('📝 Signup attempt', {
        email: body.email,
        tenantName: body.tenantName
      });

      try {
        // 1. Check if email already exists
        const existingUser = await pool.query(
          'SELECT id FROM tenant_users WHERE email = $1',
          [body.email]
        );

        if (existingUser.rows.length > 0) {
          set.status = 409;
          return createErrorResponse('Email already registered');
        }

        // 2. Generate slug from tenant name
        const slug = body.tenantName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Check if slug already exists
        const existingTenant = await pool.query(
          'SELECT id FROM tenants WHERE slug = $1',
          [slug]
        );

        if (existingTenant.rows.length > 0) {
          set.status = 409;
          return createErrorResponse(
            'Organization name already taken. Please choose a different name.'
          );
        }

        // 3. Hash password
        const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

        // 4. Create tenant (organization)
        const tenantResult = await pool.query(
          `
          INSERT INTO tenants (name, slug, plan, subscription_status)
          VALUES ($1, $2, $3, 'trial')
          RETURNING id, name, slug, plan, subscription_status
        `,
          [body.tenantName, slug, body.plan || 'starter']
        );

        const tenant = tenantResult.rows[0];

        // 5. Create tenant_user (owner)
        const userResult = await pool.query(
          `
          INSERT INTO tenant_users (tenant_id, email, name, password_hash, role)
          VALUES ($1, $2, $3, $4, 'owner')
          RETURNING id, email, name, role, tenant_id
        `,
          [tenant.id, body.email, body.name, passwordHash]
        );

        const user = userResult.rows[0];

        // 6. Apply default capabilities based on plan
        await pool.query(
          `
          SELECT apply_template_to_tenant($1, $2)
        `,
          [tenant.id, body.plan || 'starter']
        );

        // 7. Generate JWT token
        const token = generateToken({
          sub: user.id,
          email: user.email,
          tenant_id: user.tenant_id,
          role: user.role
        });

        logger.info('✅ Signup successful', {
          email: body.email,
          tenantId: tenant.id
        });

        // 8. Return token and user info
        return createSuccessResponse({
          token,
=======
        tenantName: t.String({ minLength: 2, maxLength: 255 }),
        name: t.String({ minLength: 2, maxLength: 255 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        plan: t.Optional(t.Union([t.Literal('starter'), t.Literal('professional'), t.Literal('enterprise')])),
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
>>>>>>> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
<<<<<<< HEAD
            tenant: {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              plan: tenant.plan
            }
          }
        });
      } catch (error) {
        logger.error('❌ Signup error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        set.status = 500;
        return createErrorResponse('Internal server error');
=======
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

        // Database connection errors
        if (err.code === 'ECONNREFUSED') {
          return error(503, createErrorResponse(
            'DATABASE_UNAVAILABLE',
            'Database service is currently unavailable. Please try again later.',
            { hint: 'The server cannot connect to the database. Contact support if this persists.' }
          ));
        }

        // Connection timeout
        if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
          return error(504, createErrorResponse(
            'DATABASE_TIMEOUT',
            'Login request timed out. Please try again.',
            { hint: 'Database connection is slow. Try again in a moment.' }
          ));
        }

        // Generic login error
        return error(500, createErrorResponse(
          'LOGIN_FAILED',
          'Login failed due to a server error. Please try again.',
          { hint: err.message }
        ));
>>>>>>> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
<<<<<<< HEAD
        password: t.String({ minLength: 6 }),
        name: t.String({ minLength: 2 }),
        tenantName: t.String({ minLength: 2 }),
        plan: t.Optional(
          t.Union([
            t.Literal('starter'),
            t.Literal('professional'),
            t.Literal('enterprise')
          ])
        )
      }),
      detail: {
        summary: 'Signup (Create Tenant + Owner)',
        description:
          'Create a new tenant organization and owner user account',
        tags: ['Auth']
      }
=======
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

        // Database connection errors
        if (err.code === 'ECONNREFUSED') {
          return error(503, createErrorResponse(
            'DATABASE_UNAVAILABLE',
            'Database service is currently unavailable. Please try again later.',
            { hint: 'Cannot connect to database' }
          ));
        }

        // Connection timeout
        if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
          return error(504, createErrorResponse(
            'DATABASE_TIMEOUT',
            'Request timed out. Please try again.'
          ));
        }

        // Generic error
        return error(500, createErrorResponse(
          'FETCH_FAILED',
          'Failed to fetch user data due to a server error.',
          { hint: err.message }
        ));
      }
    },
    {
      detail: {
        summary: 'Get Current User',
        description: 'Get authenticated user information',
        tags: ['Admin Auth'],
      },
>>>>>>> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
    }
  );
