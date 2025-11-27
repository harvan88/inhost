/**
 * Auth Routes Tests
 *
 * Tests for /admin/auth/* endpoints including signup, login, and JWT handling.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { randomEmail, randomTenantName } from '../setup';

// Test server URL
const API_URL = process.env.API_URL || 'http://localhost:3456';

describe('Auth Routes', () => {
  describe('POST /admin/auth/signup', () => {
    it('should create a new tenant and owner user', async () => {
      const response = await fetch(`${API_URL}/admin/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: randomTenantName(),
          name: 'Test Owner',
          email: randomEmail(),
          password: 'SecurePassword123!',
          plan: 'starter',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.role).toBe('owner');
      expect(data.data.tokens).toBeDefined();
      expect(data.data.tokens.accessToken).toBeDefined();
      expect(data.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject weak passwords', async () => {
      const response = await fetch(`${API_URL}/admin/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: randomTenantName(),
          name: 'Test Owner',
          email: randomEmail(),
          password: '123', // Too weak
          plan: 'starter',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate emails', async () => {
      const email = randomEmail();

      // First signup
      await fetch(`${API_URL}/admin/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: randomTenantName(),
          name: 'Test Owner 1',
          email,
          password: 'SecurePassword123!',
          plan: 'starter',
        }),
      });

      // Try to signup again with same email
      const response = await fetch(`${API_URL}/admin/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: randomTenantName(),
          name: 'Test Owner 2',
          email,
          password: 'SecurePassword123!',
          plan: 'starter',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /admin/auth/login', () => {
    let testUser: {
      email: string;
      password: string;
    };

    beforeAll(async () => {
      // Create a test user for login tests
      testUser = {
        email: randomEmail(),
        password: 'SecurePassword123!',
      };

      await fetch(`${API_URL}/admin/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: randomTenantName(),
          name: 'Test Login User',
          email: testUser.email,
          password: testUser.password,
          plan: 'starter',
        }),
      });
    });

    it('should login with valid credentials', async () => {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(testUser.email);
      expect(data.data.tokens).toBeDefined();
      expect(data.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: 'WrongPassword123!',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent user', async () => {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /admin/auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Create and login a test user
      const email = randomEmail();
      const password = 'SecurePassword123!';

      await fetch(`${API_URL}/admin/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: randomTenantName(),
          name: 'Test Me User',
          email,
          password,
          plan: 'starter',
        }),
      });

      const loginResponse = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();
      accessToken = loginData.data.tokens.accessToken;
    });

    it('should return user info with valid token', async () => {
      const response = await fetch(`${API_URL}/admin/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.email).toBeDefined();
      expect(data.data.tenant).toBeDefined();
    });

    it('should reject request without token', async () => {
      const response = await fetch(`${API_URL}/admin/auth/me`, {
        method: 'GET',
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const response = await fetch(`${API_URL}/admin/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit excessive login attempts', async () => {
      const email = randomEmail();

      // Make 6 rapid login attempts (limit is 5)
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          fetch(`${API_URL}/admin/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password: 'SomePassword123!',
            }),
          })
        );
      }

      const responses = await Promise.all(attempts);
      const statuses = responses.map((r) => r.status);

      // At least one should be rate limited (429)
      expect(statuses.includes(429)).toBe(true);
    });
  });
});
