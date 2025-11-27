# INHOST Backend Tests

This directory contains automated tests for the INHOST backend using Bun's built-in test runner.

## Test Structure

```
tests/
├── setup.ts                    # Global test setup and utilities
├── implementations/            # Tests for service implementations
│   └── DatabasePersistence.test.ts
└── routes/                     # Tests for API routes
    └── auth.test.ts
```

## Running Tests

### Run all tests
```bash
bun test
```

### Run tests in watch mode
```bash
bun test --watch
```

### Run tests with coverage
```bash
bun test --coverage
```

### Run specific test file
```bash
bun test tests/routes/auth.test.ts
```

## Prerequisites

Before running tests, ensure:

1. **JWT_SECRET is set** (or will be auto-generated in test environment)
2. **Test database exists**: `inhost_test`
   ```bash
   # Create test database
   psql -U postgres -c "CREATE DATABASE inhost_test;"

   # Run migrations on test database
   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inhost_test" bun run db:push
   ```

3. **PostgreSQL is running**
   ```bash
   bun run dev:db
   ```

4. **API server is running** (for integration tests)
   ```bash
   JWT_SECRET="test-jwt-secret-with-at-least-32-characters-for-testing" bun run dev:api
   ```

## Test Environment

Tests automatically configure:
- `NODE_ENV=test`
- `JWT_SECRET` (auto-generated for tests)
- `DATABASE_URL` (uses `inhost_test` database)
- `RATE_LIMIT_BACKEND=memory` (disables Redis)
- `API_URL=http://localhost:3456`

Override these by setting environment variables before running tests.

## Writing Tests

### Example unit test
```typescript
import { describe, it, expect } from 'bun:test';

describe('MyService', () => {
  it('should do something', () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Example integration test
```typescript
import { describe, it, expect } from 'bun:test';
import { randomEmail } from '../setup';

describe('API Endpoint', () => {
  it('should create resource', async () => {
    const response = await fetch('http://localhost:3456/api/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: randomEmail() }),
    });

    expect(response.status).toBe(200);
  });
});
```

## Test Helpers

Available in `tests/setup.ts`:

- `randomEmail()` - Generate unique test email
- `randomTenantName()` - Generate unique tenant name
- `sleep(ms)` - Async delay utility

## Coverage Goals

Current coverage: **0%** (baseline)

Target coverage by priority:
- **P0 (Critical)**: 80%+ coverage
  - Auth routes
  - DatabasePersistence
  - JWT handling
  - Rate limiting

- **P1 (High)**: 60%+ coverage
  - Message routing
  - WebSocket handlers
  - Admin routes

- **P2 (Medium)**: 40%+ coverage
  - Utility functions
  - Validators
  - Adapters

## Continuous Integration

Tests should run on:
- Every commit (pre-push hook)
- Pull requests (GitHub Actions)
- Before deployment

## Troubleshooting

### "JWT_SECRET environment variable is required"
Set JWT_SECRET before running tests:
```bash
JWT_SECRET="test-secret-at-least-32-chars-long" bun test
```

### "Database connection failed"
Ensure PostgreSQL is running and test database exists:
```bash
bun run dev:db
psql -U postgres -c "CREATE DATABASE inhost_test;"
```

### "Connection refused" in integration tests
Start the API server first:
```bash
JWT_SECRET="test-secret" bun run dev:api
```

Then run tests in another terminal:
```bash
bun test
```
