---
type: Guide
title: Testing Guide
description: Integration testing guide for RESTHeart Cloud Kit. Covers test setup, environment configuration, running tests, and writing new tests.
tags: [testing, integration, vitest, guide]
---

# Testing Guide

This guide covers testing for RESTHeart Cloud Kit: core integration tests and adapter unit tests.

## Overview

RESTHeart Cloud Kit has two test tiers:

| Tier | What it tests | Backend needed | Runs on |
|------|---------------|----------------|---------|
| **Core integration** (`packages/kit`) | Auth flows, token lifecycle, teams, invites against live API | RESTHeart Cloud instance + secrets | Tags (release), manual trigger |
| **Adapter unit** (`kit-react`, `kit-vue`, `kit-ng`) | Wiring: reactive state, guards, middleware, cookie bridge | None (mocks `@restheart-cloud/kit`) | Every push and PR |

**Test Framework**: Vitest 4
**Adapter test contract**: `docs/ADAPTER_CONTRACT.md`

## Environment Setup

### 1. Create Environment File

Create `packages/kit/.env` (not committed):

```bash
RH_TEST_API_URL=https://<your-instance>.restheart.com
RH_TEST_ADMIN_PASSWORD=<root-password>
```

**Variables**:
- `RH_TEST_API_URL`: Your RESTHeart Cloud service URL
- `RH_TEST_ADMIN_PASSWORD`: Admin password for test data cleanup

### 2. Verify Configuration

```bash
cd packages/kit
npm test -- --reporter=verbose 2>&1 | head -20
```

## Running Tests

### Basic Test Run

```bash
# From monorepo root
npm test -w packages/kit

# From package directory
cd packages/kit
npm test
```

### With HTML Report

```bash
npm test -w packages/kit && ./packages/kit/open-report.sh
```

**Output**: `packages/kit/test-results/index.html`

### With JUnit XML (CI)

Tests automatically generate JUnit XML at `packages/kit/test-results/junit.xml`.

### Watch Mode

```bash
cd packages/kit
npx vitest --watch
```

### Run Specific Test File

```bash
cd packages/kit
npx vitest run src/__tests__/integration/auth.test.ts
```

### Run Tests Matching Pattern

```bash
cd packages/kit
npx vitest run -t "login"
```

## Test Architecture

### Global Setup

File: `packages/kit/src/__tests__/integration/global-setup.ts`

**Purpose**: Clean all test data before and after test suite

**What it cleans**:
1. All test users (`*@restheart-test.com`)
2. All test teams (created by test users)
3. All test invitations

**When it runs**:
- Before all test suites (setup)
- After all test suites (teardown)

### Test Isolation

Each test run uses unique identifiers:

```typescript
const runId = crypto.randomUUID().slice(0, 8);

export function testEmail(label: string): string {
  return `test-${runId}-${label}@restheart-test.com`;
}
```

**Benefits**:
- Parallel test runs don't conflict
- Easy to identify test data
- Clean separation between test runs

### Helper Utilities

File: `packages/kit/src/__tests__/integration/helpers.ts`

#### Configuration

```typescript
// Get test configuration from environment
getConfig(): AuthConfig

// Get admin password
getAdminPassword(): string
```

#### Test Data

```typescript
// Generate unique test email
testEmail('auth')  // Returns: test-<runId>-auth@restheart-test.com
```

#### Admin Access

```typescript
// Make authenticated request as admin
adminFetch(path: string, init?: RequestInit): Promise<Response>

// GET request as admin
adminGet<T>(path: string): Promise<T>
```

**Usage**: Tests use admin access to:
- Create/verify users directly
- Read verification tokens
- Clean up test data

#### Token Reading

```typescript
// Read verification token from invitation email
readVerificationToken(email: string): Promise<string>

// Read invitation token
readInvitationToken(email: string): Promise<string>
```

#### User Management

```typescript
// Delete user (cleanup)
deleteUser(email: string): Promise<void>
```

#### Cookie Jar (for cookie mode tests)

```typescript
// Install cookie jar for fetch
installCookieJar(): void

// Remove cookie jar
uninstallCookieJar(): void
```

## Test Files

### auth.test.ts

**Purpose**: Registration, login, email verification flows

**Tests**:
- Register creates new user
- CheckSession returns null before login
- Verify returns fragment delivery URL
- Verify with fragment delivery activates account
- Login stores token and returns user info
- CheckSession returns user after login
- Logout clears session

### team.test.ts

**Purpose**: Team switching and multi-team scenarios

**Tests**:
- GetTeams returns all memberships
- SwitchTeam changes active team
- SwitchTeam updates token claims
- Cookie mode team switching

### team-management.test.ts

**Purpose**: Team CRUD and member management

**Tests**:
- CreateTeam creates additional team
- UpdateTeam renames team
- DeleteTeam removes team
- ListTeamMembers returns members
- RemoveMember removes member from team
- UpdateMemberRole changes member role

### invite.test.ts

**Purpose**: Invitation flows

**Tests**:
- Invite sends invitation
- GetInvitation returns invitation details
- Activate sets password for new user
- AcceptInvite adds existing user to team
- ResendInvite resends expired invitation
- ListInvitations returns pending invitations

### password.test.ts

**Purpose**: Password reset flows

**Tests**:
- ForgotPassword sends reset email
- ResetPassword changes password and logs in

### profile.test.ts

**Purpose**: Profile updates

**Tests**:
- UpdateProfile changes profile fields
- ChangePassword updates password

## Writing New Tests

### Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, logout, clearToken } from '../../index';
import { getConfig, testEmail, deleteUser } from './helpers';

const config = getConfig();
const email = testEmail('my-test');
const password = 'Test-Password-99!';

beforeAll(async () => {
  // Setup: create test data
});

afterAll(async () => {
  // Cleanup: remove test data
  clearToken();
  try { await deleteUser(email); } catch { /* ignore */ }
});

describe('my feature', () => {
  it('does something', async () => {
    // Test implementation
  });
});
```

### Best Practices

#### 1. Use Unique Emails

```typescript
const email = testEmail('my-feature');
// Generates: test-<runId>-my-feature@restheart-test.com
```

#### 2. Clean Up After Tests

```typescript
afterAll(async () => {
  clearToken();
  try { await deleteUser(email); } catch { /* ignore */ }
});
```

#### 3. Test Both Bearer and Cookie Modes

```typescript
describe('login', () => {
  it('works in bearer mode', async () => {
    await login(config, email, password, 'bearer');
    expect(getToken()).toBeTruthy();
  });

  it('works in cookie mode', async () => {
    await login(config, email, password, 'cookie');
    expect(getToken()).toBeNull(); // Token in cookie, not localStorage
  });
});
```

#### 4. Verify Token Claims

```typescript
it('switches team and updates token claims', async () => {
  await switchTeam(config, teamId);
  const token = getToken()!;
  const payload = JSON.parse(atob(token.split('.')[1]));
  expect(payload.team._id.$oid).toBe(teamId.$oid);
});
```

#### 5. Test Error Cases

```typescript
it('throws on invalid credentials', async () => {
  await expect(login(config, email, 'wrong-password'))
    .rejects.toMatchObject({ status: 401 });
});
```

### Testing Cookie Mode

For cookie mode tests, use the cookie jar helpers:

```typescript
import { installCookieJar, uninstallCookieJar } from './helpers';

beforeAll(() => installCookieJar());
afterAll(() => uninstallCookieJar());

it('works with cookies', async () => {
  await login(config, email, password, 'cookie');
  // Cookie jar handles cookie storage
});
```

## Adapter Unit Tests

Adapter tests mock `@restheart-cloud/kit` and assert only the **wiring**: which core call fires, and how the reactive state (signals / context / refs) and framework glue (guards, middleware, cookies) react.

- Fast, deterministic, **no backend and no secrets**
- Run on every push and PR (the **Unit Tests** CI workflow)
- `kit-react` is the reference implementation

### Running Adapter Tests

```bash
npm run build   # adapters resolve @restheart-cloud/kit from its built dist
npm test -w packages/kit-react -w packages/kit-vue -w packages/kit-ng
```

**Note**: `kit-ng` uses Angular's experimental Vitest runner (requires Node ≥ 22.22.3). The others use Vitest directly.

### Adapter Test Contract

All adapters implement the shared checklist in `docs/ADAPTER_CONTRACT.md`. The contract covers:

| Surface | Tests | Status |
|---------|-------|--------|
| **A. Reactive contract** (every SPA adapter) | Bootstrap, login, logout, switchTeam, updateProfile, acceptInvite, clearSession, hasMultipleTeams | ✅ all three |
| **B. Guards** (every SPA adapter) | authGuard unauthenticated/authenticated, publicGuard authenticated/unauthenticated | ✅ all three |
| **C. Token lifecycle** | 401 clears session (kit-ng interceptor) | ✅ kit-ng |
| **D. SSR extras** (next/nuxt subpaths) | Middleware refresh, protected paths, session routes, action token sinks, fragment bridge | ✅ D1–D9, D10 pending |

### Test File Locations

| Adapter | SPA tests | SSR tests |
|---------|-----------|-----------|
| `kit-react` | `src/__tests__/*.test.tsx` | `src/next/__tests__/*.test.ts` |
| `kit-vue` | `src/__tests__/*.test.ts` | `src/nuxt/__tests__/*.test.ts` |
| `kit-ng` | `src/*.spec.ts` | n/a |

## CI/CD Integration

### GitHub Actions

**Unit Tests** (adapter tests, every push/PR):
- Workflow: `.github/workflows/unit-tests.yml`
- Runs on every push to `main` and every pull request
- No secrets needed — adapters mock `@restheart-cloud/kit`
- Scopes to `kit-react`, `kit-vue`, `kit-ng` (never `--workspaces`, which would also run kit's integration suite)

```yaml
# Runs: npm ci → npm run build → npm test -w packages/kit-react -w packages/kit-vue -w packages/kit-ng
```

**Integration Tests** (core tests, gated):
- Workflow: `.github/workflows/integration-test.yml`
- Manual trigger or as part of the release pipeline
- Requires RESTHeart Cloud instance and secrets

```yaml
name: Integration Tests

on:
  workflow_dispatch:  # Manual trigger

jobs:
  integration:
    runs-on: ubuntu-latest
    environment: integration-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build -w packages/kit
      - run: npm test -w packages/kit
        env:
          RH_TEST_API_URL: ${{ secrets.RH_TEST_API_URL }}
          RH_TEST_ADMIN_PASSWORD: ${{ secrets.RH_TEST_ADMIN_PASSWORD }}
```

### Test Results

- **HTML Report**: `packages/kit/test-results/index.html`
- **JUnit XML**: `packages/kit/test-results/junit.xml`
- **Upload**: Test results uploaded as artifacts in CI

## Debugging Tests

### Verbose Output

```bash
cd packages/kit
npx vitest run --reporter=verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "--reporter=verbose"],
      "console": "integratedTerminal",
      "env": {
        "RH_TEST_API_URL": "https://your-instance.restheart.com",
        "RH_TEST_ADMIN_PASSWORD": "your-password"
      }
    }
  ]
}
```

### Check Test Data

```bash
# List test users
curl -u root:password https://your-instance.restheart.com/users?filter='{"_id":{"$regex":"@restheart-test.com$"}}'

# List test teams
curl -u root:password https://your-instance.restheart.com/teams?filter='{"createdBy":{"$regex":"@restheart-test.com"}}'
```

### Common Issues

**Issue**: Tests fail with "RH_TEST_API_URL is not set"
**Solution**: Create `packages/kit/.env` with required variables

**Issue**: Tests fail with 401 on admin requests
**Solution**: Verify `RH_TEST_ADMIN_PASSWORD` is correct

**Issue**: Tests fail with "user already exists"
**Solution**: Run global cleanup manually or wait for next test run

**Issue**: Token refresh tests fail
**Solution**: Check if RESTHeart instance has token refresh enabled

## Test Configuration

### Vitest Config

File: `packages/kit/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    globals: false,
    globalSetup: ['src/__tests__/integration/global-setup.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    typecheck: { tsconfig: './tsconfig.test.json' },
    reporters: [
      'verbose',
      ['junit', { outputFile: './test-results/junit.xml' }],
      ['html', { outputFile: './test-results/index.html' }]
    ],
  },
});
```

**Key Settings**:
- `testTimeout: 30_000` — 30 second timeout per test
- `hookTimeout: 30_000` — 30 second timeout for hooks
- `sequence: { concurrent: false }` — Tests run sequentially
- `globalSetup` — Runs cleanup before/after all tests

## Extending Tests

### Adding New Test File

1. Create file in `packages/kit/src/__tests__/integration/`
2. Name it `<feature>.test.ts`
3. Import helpers from `./helpers`
4. Use `testEmail()` for unique emails
5. Clean up in `afterAll()`

### Testing New API Endpoints

```typescript
import { apiFetch } from '../../client';

it('calls new endpoint', async () => {
  await login(config, email, password);
  const res = await apiFetch(config, '/new-endpoint');
  expect(res.ok).toBe(true);
});
```

### Testing Error Scenarios

```typescript
it('handles validation errors', async () => {
  try {
    await someOperation(config, invalidData);
    expect.fail('Should have thrown');
  } catch (error) {
    expect(error.status).toBe(400);
    expect(error.message).toContain('validation');
  }
});
```

## Performance Considerations

### Test Execution Time

- Average test suite: ~30-60 seconds
- Individual test: ~1-5 seconds
- Bottleneck: API calls to RESTHeart Cloud

### Optimization Tips

1. **Minimize API calls**: Use admin access for setup
2. **Reuse test data**: Create once, test multiple scenarios
3. **Parallel execution**: Currently disabled (sequential)
4. **Local RESTHeart**: Use local instance for faster tests

### Future Improvements

- [ ] Parallel test execution
- [ ] Test data factories
- [ ] Mock mode for unit tests
- [ ] Performance benchmarks
