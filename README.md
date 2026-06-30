# RESTHeart Cloud Kit

[RESTHeart Cloud](https://restheart.org/cloud) gives you a production-ready backend — MongoDB, REST API, authentication, multi-tenancy, all managed.

This kit gives you the same speed on the frontend.

This is a monorepo with two layers: a **framework-agnostic core** and **framework adapters** built on top of it. Pick what you need.

## Core

**[`@restheart-cloud/kit`](./packages/kit/README.md)** [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit)](https://www.npmjs.com/package/@restheart-cloud/kit)  
Pure TypeScript, zero dependencies. All the auth logic: signup, login, email verification, invitations, password reset, multi-team. Works with any framework or none.

## Framework adapters

**[`@restheart-cloud/kit-ng`](./packages/kit-ng/README.md)** [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit-ng)](https://www.npmjs.com/package/@restheart-cloud/kit-ng)  
Angular — signals, route guards, HTTP interceptor.

`@restheart-cloud/kit-react` — coming soon.  
`@restheart-cloud/kit-vue` — coming soon.

## Quickstart

The fastest path to a working Angular app:

1. Create a service on [RESTHeart Cloud](https://restheart.org/cloud)
2. Fork [`restheart-cloud-starter-ng`](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
3. Set `apiBaseUrl` in `environment.ts`
4. `ng serve`

## Contributing

```bash
npm install        # install all workspace dependencies
npm run build      # build kit, then kit-ng
npm run changeset  # describe your change before opening a PR
```

### Release pipeline

Releases are fully automated. The pipeline has two stages, both triggered by a push to `main`:

**Stage 1 — Version PR** (when there are pending changesets)

Every merged PR that includes a changeset file causes CI to open (or update) a pull request called **"🔖 chore: version packages"**. That PR contains the bumped `package.json` versions and the generated `CHANGELOG.md` entries. No packages are published yet. Integration tests do **not** run at this stage.

**Stage 2 — Publish** (when the Version PR is merged)

Merging the Version PR removes all pending changesets. CI detects this, runs the integration tests against the RESTHeart Cloud test instance, and — only if they pass — publishes both packages to npm.

```
feature PR merged
  └─ CI: opens/updates "Version PR"

Version PR merged
  └─ CI: integration tests → if green → npm publish
```

Integration tests can also be triggered manually from the **Actions** tab → **Integration Tests** → **Run workflow**.
