---
type: Guide
title: Release Process
description: Tag-driven release process for RESTHeart Cloud Kit. Covers version management, CI/CD pipeline, and npm publishing.
tags: [release, deployment, ci-cd, npm, github-actions]
---

# Release Process

This document describes the tag-driven release process for RESTHeart Cloud Kit, including version management, CI/CD pipeline, and npm publishing.

## Overview

RESTHeart Cloud Kit uses a **tag-driven release process**:

1. Create a version tag
2. Push tag to GitHub
3. CI runs integration tests
4. If tests pass, all four packages published to npm
5. If tests fail, nothing is published

**No manual versioning step needed** — the tag determines the version.

## Version Management

### Version Strategy

- All packages (`kit`, `kit-ng`, `kit-react`, `kit-vue`) share the same version
- Versions follow [Semantic Versioning](https://semver.org/)
- Current development version: `0.0.0` (in git)

### Workspace Configuration

In development, every adapter depends on `kit` at exact version `0.0.0`:

```json
{
  "dependencies": {
    "@restheart-cloud/kit": "0.0.0"
  }
}
```

**Why `0.0.0`?**
- Prevents npm from resolving `kit` from the registry instead of the workspace
- Ensures adapters always compile against the local `kit` source
- Release workflow rewrites this to the tag version before publishing

### Version Updates

During release, the workflow updates:

1. `packages/kit/package.json` — `version` field
2. `packages/kit-ng/package.json` — `version` and `dependencies.@restheart-cloud/kit`
3. `packages/kit-react/package.json` — `version` and `dependencies.@restheart-cloud/kit`
4. `packages/kit-vue/package.json` — `version` and `dependencies.@restheart-cloud/kit`

All values move together to ensure consistency.

## Release Workflow

### Step 1: Create Version Tag

```bash
# From main branch
git tag 1.2.3
git push origin 1.2.3
```

**Tag Format**: `[major].[minor].[patch]` (e.g., `1.0.0`, `2.1.3`)

### Step 2: CI Pipeline

GitHub Actions automatically triggers the release workflow:

**Workflow**: `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - '[0-9]+.[0-9]+.[0-9]+'

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    environment: integration-test
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g npm@latest
      
      - name: Set version from tag
        run: |
          npm pkg set version=${{ github.ref_name }} -w packages/kit
          npm pkg set version=${{ github.ref_name }} -w packages/kit-ng
          npm pkg set version=${{ github.ref_name }} -w packages/kit-react
          npm pkg set version=${{ github.ref_name }} -w packages/kit-vue
          npm pkg set dependencies.@restheart-cloud/kit=${{ github.ref_name }} -w packages/kit-ng
          npm pkg set dependencies.@restheart-cloud/kit=${{ github.ref_name }} -w packages/kit-react
          npm pkg set dependencies.@restheart-cloud/kit=${{ github.ref_name }} -w packages/kit-vue
      
      - run: npm install
      - run: npm run build
      - run: npm test -w @restheart-cloud/kit
        env:
          RH_TEST_API_URL: ${{ secrets.RH_TEST_API_URL }}
          RH_TEST_ADMIN_PASSWORD: ${{ secrets.RH_TEST_ADMIN_PASSWORD }}
      
      - name: Publish
        run: |
          npm publish --access public -w packages/kit
          npm publish --access public packages/kit-ng/dist
          npm publish --access public -w packages/kit-react
          npm publish --access public -w packages/kit-vue
```

### Step 3: Pipeline Execution

1. **Checkout**: Clone repository at tag
2. **Setup Node**: Install Node.js 22
3. **Update npm**: Install latest npm
4. **Set Versions**: Update all package.json files with tag version (kit + 3 adapters)
5. **Install Dependencies**: `npm install` to reify workspace
6. **Build**: Build all packages (`npm run build`)
7. **Integration Tests**: Run core tests against RESTHeart Cloud
8. **Publish**: Publish all four packages to npm (if tests pass)

### Step 4: Publication

If integration tests pass:
- `@restheart-cloud/kit` published to npm
- `@restheart-cloud/kit-ng` published to npm
- `@restheart-cloud/kit-react` published to npm
- `@restheart-cloud/kit-vue` published to npm
- All packages have same version

If integration tests fail:
- No packages published
- Tag remains in git
- Fix issues and create new tag

## CI/CD Configuration

### Required Secrets

Configure in GitHub repository settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm access token with publish permissions |
| `RH_TEST_API_URL` | RESTHeart Cloud test instance URL |
| `RH_TEST_ADMIN_PASSWORD` | Admin password for test instance |

### Environment

The release workflow uses the `integration-test` environment:

- Required reviewers (optional)
- Environment secrets
- Deployment protection rules

### Permissions

```yaml
permissions:
  contents: read    # Read repository
  id-token: write   # npm provenance attestation
```

## Manual Release Steps

### 1. Prepare Release

```bash
# Ensure you're on main
git checkout main
git pull origin main

# Verify tests pass locally
npm test -w packages/kit

# Update CHANGELOG.md (if maintained)
# Commit any changelog changes
```

### 2. Create and Push Tag

```bash
# Create tag
git tag 1.2.3

# Push tag
git push origin 1.2.3
```

### 3. Monitor CI

- Go to GitHub → Actions → Release workflow
- Watch for successful completion
- Check npm for published packages

### 4. Verify Publication

```bash
# Check npm
npm view @restheart-cloud/kit versions
npm view @restheart-cloud/kit-ng versions
npm view @restheart-cloud/kit-react versions
npm view @restheart-cloud/kit-vue versions

# Test installation
npm install @restheart-cloud/kit@1.2.3
npm install @restheart-cloud/kit-react@1.2.3
```

## Hotfix Releases

For critical bug fixes:

1. Create hotfix branch from tag
2. Apply fix
3. Merge to main
4. Create new patch version tag
5. Push tag to trigger release

```bash
# Create hotfix branch
git checkout -b hotfix/1.2.4 1.2.3

# Apply fix
# ... make changes ...

# Merge to main
git checkout main
git merge hotfix/1.2.4

# Create new tag
git tag 1.2.4
git push origin 1.2.4
```

## Pre-release Versions

For beta/alpha releases:

```bash
# Create pre-release tag
git tag 2.0.0-beta.1
git push origin 2.0.0-beta.1
```

**Note**: Pre-release versions require npm dist-tag configuration:

```bash
# Publish as beta
npm publish -w packages/kit --tag beta
npm publish -w packages/kit-ng --tag beta
```

## Rollback Procedure

If a release has critical issues:

### 1. Deprecate Version on npm

```bash
npm deprecate @restheart-cloud/kit@1.2.3 "Critical bug, use 1.2.4"
npm deprecate @restheart-cloud/kit-ng@1.2.3 "Critical bug, use 1.2.4"
```

### 2. Publish Fixed Version

```bash
# Create fix
# ... make changes ...

# Tag and push
git tag 1.2.4
git push origin 1.2.4
```

### 3. Un-deprecate Previous Version (Optional)

```bash
npm deprecate @restheart-cloud/kit@1.2.3 ""
npm deprecate @restheart-cloud/kit-ng@1.2.3 ""
```

## Changelog Management

### Recommended Format

```markdown
# Changelog

## [1.2.3] - 2024-01-15

### Added
- New feature X

### Changed
- Updated Y behavior

### Fixed
- Bug in Z

### Breaking
- Removed deprecated API W
```

### Automation Options

- [standard-version](https://github.com/conventional-changelog/standard-version)
- [release-please](https://github.com/googleapis/release-please)
- [semantic-release](https://github.com/semantic-release/semantic-release)

## Documentation Updates

### Update README.md

After release, update:
- Version badges
- Installation instructions
- Breaking changes

### Update Package READMEs

- `packages/kit/README.md`
- `packages/kit-ng/README.md`

### Update Documentation

- API changes
- New features
- Migration guides

## Troubleshooting

### Issue: CI Fails on Integration Tests

**Symptoms**: Release workflow fails at test step

**Possible Causes**:
- RESTHeart Cloud test instance down
- Test credentials expired
- API changes breaking tests

**Solution**:
1. Check test instance status
2. Verify secrets are correct
3. Run tests locally to debug

### Issue: npm Publish Fails

**Symptoms**: CI passes but packages not published

**Possible Causes**:
- Invalid npm token
- Version already exists
- Package name conflict

**Solution**:
1. Verify npm token has publish permissions
2. Check if version already exists on npm
3. Ensure package name is available

### Issue: Version Mismatch

**Symptoms**: `kit-ng` can't find `kit` version

**Possible Causes**:
- Version update failed
- npm install didn't reify

**Solution**:
1. Check package.json versions match
2. Verify dependencies field updated
3. Run `npm install` manually

### Issue: Workspace Resolution Problems

**Symptoms**: `kit-ng` uses registry `kit` instead of workspace

**Possible Causes**:
- Stale node_modules
- Nested node_modules shadowing

**Solution**:
```bash
rm -rf node_modules packages/*/node_modules
npm install
```

## Best Practices

### 1. Test Before Tagging

```bash
# Run full test suite
npm test -w packages/kit

# Build all packages
npm run build

# Test in starter app (optional)
cd /path/to/starter
npm link @restheart-cloud/kit @restheart-cloud/kit-ng
ng serve
```

### 2. Use Semantic Versioning

- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

### 3. Write Changelog

Document all changes before releasing:
- New features
- Bug fixes
- Breaking changes
- Deprecations

### 4. Coordinate with Dependencies

If RESTHeart Cloud API changes:
- Update kit to match
- Test against new API version
- Document API version requirement

### 5. Monitor Post-Release

After release:
- Check npm download stats
- Monitor GitHub issues
- Watch for user feedback

## Release Checklist

- [ ] All tests pass locally
- [ ] CHANGELOG.md updated
- [ ] README.md updated (if needed)
- [ ] Package READMEs updated (if needed)
- [ ] Documentation updated (if needed)
- [ ] Tag created with correct version
- [ ] Tag pushed to GitHub
- [ ] CI workflow completed successfully
- [ ] Packages published to npm
- [ ] Installation tested
- [ ] Starter app updated (if needed)
