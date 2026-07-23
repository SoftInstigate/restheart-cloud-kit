# RESTHeart Cloud Kit

[RESTHeart Cloud](https://cloud.restheart.com) gives you a production-ready backend — MongoDB, REST API, authentication, multi-tenancy, all managed.

This kit gives you the same speed on the frontend.

This is a monorepo with two layers: a **framework-agnostic core** and **framework adapters** built on top of it. Pick what you need.

## Core

**[`@restheart-cloud/kit`](./packages/kit/README.md)** [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit)](https://www.npmjs.com/package/@restheart-cloud/kit)  
Pure TypeScript, zero dependencies. All the auth logic: signup, login, email verification, invitations, password reset, multi-team. Works with any framework or none.

## Framework adapters

**[`@restheart-cloud/kit-ng`](./packages/kit-ng/README.md)** [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit-ng)](https://www.npmjs.com/package/@restheart-cloud/kit-ng)  
Angular — signals, route guards, HTTP interceptor.

**[`@restheart-cloud/kit-react`](./packages/kit-react/README.md)** [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit-react)](https://www.npmjs.com/package/@restheart-cloud/kit-react)  
React — context, hooks, and route guards, plus a `/next` subpath for Next.js: middleware
refresh and guards, first-party session cookie, fragment→cookie bridge, and server actions.

**[`@restheart-cloud/kit-vue`](./packages/kit-vue/README.md)** [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit-vue)](https://www.npmjs.com/package/@restheart-cloud/kit-vue)  
Vue — composables and navigation guards, plus a `/nuxt` subpath for Nuxt on the same pattern.

See **[docs/ADAPTERS.md](./docs/ADAPTERS.md)** for the adapter contract, the roadmap, and how
the access token is delivered in SPA and server-rendered apps.

## Quickstart

The fastest path to a working Angular app:

1. Create a service on [RESTHeart Cloud](https://cloud.restheart.com)
2. Fork [`restheart-cloud-starter-ng`](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
3. Set `apiBaseUrl` in `environment.ts`
4. `ng serve`

## Contributing

```bash
npm install     # install all workspace dependencies
npm run build   # build kit, then the adapters (kit-ng, kit-react, kit-vue)
```

> **Node ≥ 22.22.3** is required — the Angular 22 CLI that runs `kit-ng`'s tests enforces it.
> The rest of the workspace is fine on any Node 22.

Each adapter depends on `kit` at the exact version `0.0.0` — the version every package carries
in git, since releases are tag-driven. That is deliberate: any looser range is also satisfied
by a published version, so npm resolves `kit` from the registry instead of linking the local
workspace, and the adapter then compiles against a stale copy. The release workflow rewrites
this range to the tag before publishing, so `0.0.0` never reaches npm.

If workspace resolution ever looks wrong, reinstall from scratch — note that the nested
`node_modules` matter, because Node resolution walks up from the importing file and a stale
copy under `packages/kit-ng/` shadows the workspace symlink at the root:

```bash
rm -rf node_modules packages/*/node_modules
npm install
```

### Running adapter unit tests

The adapter suites mock `@restheart-cloud/kit`, so they need no backend and no secrets — they
run on every push and pull request (the **Unit Tests** workflow), and locally with:

```bash
npm run build   # adapters resolve @restheart-cloud/kit from its built dist
npm test -w packages/kit-react -w packages/kit-vue -w packages/kit-ng
```

`kit-ng` uses Angular's experimental Vitest runner (hence the Node requirement above); the
others use Vitest directly. See **[docs/ADAPTER_CONTRACT.md](./docs/ADAPTER_CONTRACT.md)** for
the shared behaviour checklist every adapter's tests implement.

### Running integration tests locally

The core's integration tests hit a live RESTHeart Cloud instance. Create `packages/kit/.env`
(not committed):

```
RH_TEST_API_URL=https://<your-instance>.restheart.com
RH_TEST_ADMIN_PASSWORD=<root-password>
```

Then run:

```bash
npm test -w packages/kit
```

To open the HTML report after the run:

```bash
./packages/kit/open-report.sh
```

### Release pipeline

Releases are tag-driven — no manual versioning step needed.

```bash
git tag 1.2.3
git push origin 1.2.3
```

CI runs the integration tests against the RESTHeart Cloud test instance. If they pass, all four packages (`kit`, `kit-ng`, `kit-react`, `kit-vue`) are published to npm at that version. If they fail, nothing is published.

Integration tests can also be triggered manually from the **Actions** tab → **Integration Tests** → **Run workflow**.

## Documentation

Comprehensive documentation is available in the **[openwiki/](./openwiki/)** directory:

- **[Quickstart](./openwiki/quickstart.md)** — Overview and navigation guide
- **[Architecture Overview](./openwiki/architecture/overview.md)** — Technical architecture and design decisions
- **[Token Delivery](./openwiki/architecture/token-delivery.md)** — Bearer vs cookie authentication modes
- **[@restheart-cloud/kit](./openwiki/packages/kit.md)** — Core package API reference
- **[@restheart-cloud/kit-ng](./openwiki/packages/kit-ng.md)** — Angular adapter documentation
- **[Testing Guide](./openwiki/testing/guide.md)** — Integration test setup and execution
- **[Release Process](./openwiki/deployment/release.md)** — Tag-driven release workflow
- **[Contributing & Development](./openwiki/contributing/development.md)** — Local development setup

For framework adapters and token delivery details, see **[docs/ADAPTERS.md](./docs/ADAPTERS.md)**.
