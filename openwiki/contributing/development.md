---
type: Guide
title: Contributing & Development
description: Development setup guide for RESTHeart Cloud Kit. Covers local development, workspace configuration, building packages, and debugging tips.
tags: [contributing, development, setup, debugging]
---

# Contributing & Development

This guide covers local development setup, workspace configuration, building packages, and debugging tips for contributing to RESTHeart Cloud Kit.

## Prerequisites

- **Node.js**: 22.22.3+ (required by Angular 22 CLI for `kit-ng` tests; the rest of the workspace is fine on any Node 22)
- **npm**: 9+ (workspaces support)
- **Git**: 2.30+
- **RESTHeart Cloud**: Account for integration tests ([sign up](https://cloud.restheart.com))

## Quick Setup

### 1. Clone Repository

```bash
git clone https://github.com/SoftInstigate/restheart-cloud-kit.git
cd restheart-cloud-kit
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies for both packages using npm workspaces.

### 3. Build Packages

```bash
npm run build
```

Builds `kit` first, then all adapters (order matters due to dependency).

> **Node ≥ 22.22.3** is required — the Angular 22 CLI that runs `kit-ng`'s tests enforces it. The rest of the workspace is fine on any Node 22.

### 4. Run Tests

**Adapter unit tests** (no backend needed):

```bash
npm run build   # adapters resolve @restheart-cloud/kit from its built dist
npm test -w packages/kit-react -w packages/kit-vue -w packages/kit-ng
```

**Integration tests** (requires RESTHeart Cloud instance):

```bash
# Create test environment file
cat > packages/kit/.env << EOF
RH_TEST_API_URL=https://<your-instance>.restheart.com
RH_TEST_ADMIN_PASSWORD=<root-password>
EOF

# Run integration tests
npm test -w packages/kit
```

## Repository Structure

```
restheart-cloud-kit/
├── packages/
│   ├── kit/                    # Core package
│   │   ├── src/                # Source code
│   │   ├── dist/               # Compiled output (gitignored)
│   │   ├── __tests__/          # Integration tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── kit-ng/                 # Angular adapter
│   │   ├── src/                # Source + unit tests (*.spec.ts)
│   │   ├── dist/               # Compiled output (gitignored)
│   │   ├── angular.json        # Angular workspace config (Vitest runner)
│   │   ├── package.json
│   │   ├── ng-package.json     # Angular packaging config
│   │   └── tsconfig.json
│   │
│   ├── kit-react/              # React adapter
│   │   ├── src/                # Source + unit tests
│   │   ├── src/next/           # /next subpath (Next.js SSR)
│   │   ├── vitest.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── kit-vue/                # Vue adapter
│       ├── src/                # Source + unit tests
│       ├── src/nuxt/           # /nuxt subpath (Nuxt SSR)
│       ├── vitest.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                       # Documentation
│   ├── ADAPTERS.md             # Adapter contract & roadmap
│   └── ADAPTER_CONTRACT.md     # Shared test checklist
├── .github/workflows/          # CI/CD workflows
├── package.json                # Workspace root
├── tsconfig.base.json          # Shared TypeScript config
└── rebuild-kit-ng.sh           # Local dev helper script
```

## Workspace Configuration

### npm Workspaces

The monorepo uses npm workspaces:

```json
{
  "name": "restheart-cloud-kit-monorepo",
  "private": true,
  "workspaces": ["packages/*"]
}
```

**Benefits**:
- Single `npm install` at root
- Shared dependencies
- Workspace-aware commands

### Dependency Resolution

All adapters depend on `kit` at exact version `0.0.0`:

```json
{
  "dependencies": {
    "@restheart-cloud/kit": "0.0.0"
  }
}
```

**Why `0.0.0`?**
- Prevents npm from resolving `kit` from the registry
- Ensures adapters always use local workspace `kit`
- Release workflow rewrites to tag version before publishing

**If resolution looks wrong**:

```bash
rm -rf node_modules packages/*/node_modules
npm install
```

### TypeScript Configuration

**Base config** (`tsconfig.base.json`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Package configs** extend base:
- `packages/kit/tsconfig.json` — Standard TypeScript
- `packages/kit-ng/tsconfig.json` — Angular-specific settings
- `packages/kit-react/tsconfig.json` — React JSX settings
- `packages/kit-vue/tsconfig.json` — Vue settings

## Building

### Build Both Packages

```bash
npm run build
```

**Order**: kit → kit-ng, kit-react, kit-vue (adapters depend on kit)

### Build Individual Packages

```bash
# Build kit only
npm run build -w packages/kit

# Build kit-ng only (requires kit to be built first)
npm run build -w packages/kit-ng
```

### Build Output

**kit**:
- `packages/kit/dist/` — Compiled JavaScript + type declarations
- Entry point: `packages/kit/dist/index.js`
- Types: `packages/kit/dist/index.d.ts`

**kit-ng**:
- `packages/kit-ng/dist/` — Angular package format
- Entry point: `packages/kit-ng/dist/index.js`
- Types: `packages/kit-ng/dist/index.d.ts`

**kit-react**:
- `packages/kit-react/dist/` — ES modules
- Entry point: `packages/kit-react/dist/index.js`
- `/next` subpath: `packages/kit-react/dist/next/`

**kit-vue**:
- `packages/kit-vue/dist/` — ES modules
- Entry point: `packages/kit-vue/dist/index.js`
- `/nuxt` subpath: `packages/kit-vue/dist/nuxt/`

### Watch Mode

```bash
# Watch for changes and rebuild
cd packages/kit
npx tsc --watch
```

## Local Development with Starter App

### Link Packages Locally

For developing against a local Angular app:

```bash
# From monorepo root
npm run build

# Link kit globally
npm link -w packages/kit

# Link kit-ng (from dist directory)
cd packages/kit-ng/dist && npm link

# In your Angular starter app
cd /path/to/your/angular-app
npm link @restheart-cloud/kit @restheart-cloud/kit-ng

# Clear Angular cache if needed
rm -rf .angular/cache
```

### Using rebuild-kit-ng.sh

The `rebuild-kit-ng.sh` script automates linking:

```bash
./rebuild-kit-ng.sh
```

**What it does**:
1. Builds both packages
2. Links `kit` globally
3. Links `kit-ng` from dist directory
4. Links both into starter app
5. Clears Angular cache

**Note**: Update `STARTER_DIR` in script to match your starter app path.

### Unlink Packages

```bash
# In your Angular app
npm unlink @restheart-cloud/kit @restheart-cloud/kit-ng

# In monorepo
npm unlink -w packages/kit
cd packages/kit-ng/dist && npm unlink
```

## Testing

### Adapter Unit Tests

No backend needed — run on every push:

```bash
npm run build
npm test -w packages/kit-react -w packages/kit-vue -w packages/kit-ng
```

See [Testing Guide](../testing/guide.md) and `docs/ADAPTER_CONTRACT.md` for the shared test checklist.

### Integration Tests

Tests run against a real RESTHeart Cloud instance:

```bash
# Create environment file
cat > packages/kit/.env << EOF
RH_TEST_API_URL=https://<your-instance>.restheart.com
RH_TEST_ADMIN_PASSWORD=<root-password>
EOF

# Run tests
npm test -w packages/kit
```

### Test Reports

```bash
# Run tests and open HTML report
npm test -w packages/kit && ./packages/kit/open-report.sh
```

**Output**: `packages/kit/test-results/index.html`

### Watch Mode

```bash
cd packages/kit
npx vitest --watch
```

### Run Specific Tests

```bash
# Run specific test file
npx vitest run src/__tests__/integration/auth.test.ts

# Run tests matching pattern
npx vitest run -t "login"
```

See [Testing Guide](../testing/guide.md) for detailed testing documentation.

## Debugging

### TypeScript Compilation Errors

**Common issues**:

1. **Missing dependencies**
   ```bash
   npm install
   ```

2. **Stale build artifacts**
   ```bash
   rm -rf packages/*/dist
   npm run build
   ```

3. **Type mismatches**
   - Check `types.ts` for interface definitions
   - Verify import paths use `.js` extension (ESM)

### Runtime Errors

**Common issues**:

1. **localStorage unavailable**
   - Kit falls back to in-memory token storage
   - Check browser console for warnings

2. **CORS errors**
   - Ensure `apiBaseUrl` is correct
   - Check RESTHeart Cloud CORS configuration

3. **401 errors**
   - Token expired or invalid
   - Check token in localStorage
   - Verify RESTHeart Cloud is running

### Debug in Browser

1. Open browser DevTools
2. Go to Application → Storage → Local Storage
3. Look for `rh_access_token` key
4. Decode JWT at [jwt.io](https://jwt.io)

### Debug in Node.js (Tests)

```bash
# Run tests with Node.js debugger
cd packages/kit
node --inspect-brk ./node_modules/.bin/vitest run
```

Then attach debugger in VS Code or Chrome DevTools.

## Code Style

### TypeScript

- Strict mode enabled
- ES2022 target
- ESNext modules
- Explicit return types (recommended)
- No `any` types (use `unknown` if needed)

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `auth.service.ts`)
- **Classes**: `PascalCase` (e.g., `RhAuthService`)
- **Functions**: `camelCase` (e.g., `checkSession`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `TOKEN_KEY`)
- **Interfaces**: `PascalCase` (e.g., `UserInfo`)

### Imports

```typescript
// Good: Use .js extension for ESM
import { apiFetch } from './client.js';

// Good: Type-only imports
import type { AuthConfig, UserInfo } from './types.js';

// Bad: Missing .js extension
import { apiFetch } from './client';
```

### Error Handling

```typescript
// Good: Throw ApiError
throw { status: 400, message: 'Invalid input' } satisfies ApiError;

// Good: Catch and handle
try {
  await someOperation();
} catch (error) {
  if (error.status === 401) {
    // Handle 401
  }
}
```

## Git Workflow

### Branch Strategy

- **main**: Production-ready code
- **feature/***: New features
- **bugfix/***: Bug fixes
- **hotfix/***: Critical production fixes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add team management methods
fix: handle localStorage unavailable
docs: update API reference
test: add integration tests for invitations
refactor: extract token management
```

### Pull Requests

1. Create feature branch from main
2. Make changes
3. Run tests locally
4. Push branch and create PR
5. Wait for CI to pass
6. Request review
7. Merge to main

## Common Development Tasks

### Adding New API Endpoint

1. **Add to kit**:
   - Add function to appropriate module (`auth.ts`, `team.ts`, etc.)
   - Export from `index.ts`
   - Add type definitions to `types.ts`

2. **Add to kit-ng**:
   - Add method to `RhAuthService`
   - Update signals if needed

3. **Add tests**:
   - Create test in `__tests__/integration/`
   - Test both bearer and cookie modes

4. **Update documentation**:
   - Update `packages/kit/README.md`
   - Update `packages/kit-ng/README.md`
   - Update wiki docs

### Adding New Type

1. Add to `packages/kit/src/types.ts`
2. Export from `packages/kit/src/index.ts`
3. Use in relevant functions

### Updating Angular Service

1. Edit `packages/kit-ng/src/auth.service.ts`
2. Update signals if needed
3. Rebuild: `npm run build -w packages/kit-ng`
4. Test in starter app

### Modifying Build Configuration

1. Edit `tsconfig.json` or `ng-package.json`
2. Rebuild: `npm run build`
3. Verify output in `dist/`

## Troubleshooting

### Issue: npm install fails

**Solution**:
```bash
# Clear cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules packages/*/node_modules
npm install
```

### Issue: Build fails with type errors

**Solution**:
```bash
# Check TypeScript version
npx tsc --version

# Rebuild from scratch
rm -rf packages/*/dist
npm run build
```

### Issue: Tests fail with connection errors

**Solution**:
- Verify `RH_TEST_API_URL` is correct
- Check RESTHeart Cloud instance is running
- Verify network connectivity

### Issue: Linking doesn't work

**Solution**:
```bash
# Unlink everything
npm unlink -w packages/kit
cd packages/kit-ng/dist && npm unlink

# Rebuild and relink
npm run build
npm link -w packages/kit
cd packages/kit-ng/dist && npm link
```

### Issue: Angular can't find kit-ng

**Solution**:
```bash
# Clear Angular cache
rm -rf .angular/cache

# Verify linking
ls -la node_modules/@restheart-cloud/

# Relink if needed
npm link @restheart-cloud/kit @restheart-cloud/kit-ng
```

## IDE Setup

### VS Code

Recommended extensions:
- TypeScript and JavaScript Language Features
- ESLint
- Prettier

**Settings** (`settings.json`):

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### WebStorm/IntelliJ

- Enable TypeScript service
- Configure npm workspaces
- Set up run configurations for tests

## Performance Tips

### Faster Builds

```bash
# Build only changed package
npm run build -w packages/kit

# Use TypeScript incremental builds
# (enabled by default in tsconfig)
```

### Faster Tests

```bash
# Run specific test file
npx vitest run src/__tests__/integration/auth.test.ts

# Skip cleanup for faster iteration
# (edit global-setup.ts temporarily)
```

### Faster Iteration

1. Use `npm link` for local development
2. Use watch mode for TypeScript compilation
3. Use Angular CLI with hot reload

## Resources

- **[Architecture Overview](../architecture/overview.md)** — Technical architecture
- **[Testing Guide](../testing/guide.md)** — Integration testing
- **[Release Process](../deployment/release.md)** — Tag-driven releases
- **[RESTHeart Cloud Docs](https://cloud.restheart.com)** — Backend documentation
- **[Starter App](https://github.com/SoftInstigate/restheart-cloud-starter-ng)** — Angular starter template
