# Auth Service E2E Tests

This directory contains end-to-end tests for the authentication service.

## Setup

1. Create test database:
   ```bash
   createdb soc_auth_test
   ```

2. Install dependencies:
   ```bash
   npm install dotenv-cli --save-dev
   ```

3. Run tests:
   ```bash
   npm run test:e2e
   ```

## Test Structure

- `setup.ts` - Test setup utilities and database management
- `auth.e2e-spec.ts` - Authentication endpoint tests
- `test.env` - Test environment configuration

## Test Coverage

The E2E tests cover:
- User registration
- Login/logout flows
- Token refresh
- Password management
- MFA authentication
- API key authentication
- Rate limiting
- Error handling

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Watch mode
npm run test:e2e:watch

# Run specific test
npm run test:e2e -- --testNamePattern="should successfully register"
```

## Database Management

The tests automatically:
- Clean the database before each test
- Seed test data as needed
- Close connections after tests complete

## Troubleshooting

If tests fail:
1. Ensure PostgreSQL is running
2. Verify test database exists
3. Check Redis is running with correct password
4. Verify test.env configuration matches your setup