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
      }
    },
    {
      body: t.Object({
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
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
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
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
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
    }
  );
