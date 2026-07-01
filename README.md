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

`@restheart-cloud/kit-react` — coming soon.  
`@restheart-cloud/kit-vue` — coming soon.

## Quickstart

The fastest path to a working Angular app:

1. Create a service on [RESTHeart Cloud](https://cloud.restheart.com)
2. Fork [`restheart-cloud-starter-ng`](https://github.com/SoftInstigate/restheart-cloud-starter-ng)
3. Set `apiBaseUrl` in `environment.ts`
4. `ng serve`

## Contributing

```bash
npm install     # install all workspace dependencies
npm run build   # build kit, then kit-ng
```

### Running integration tests locally

Create `packages/kit/.env` (not committed):

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

CI runs the integration tests against the RESTHeart Cloud test instance. If they pass, both packages are published to npm at that version. If they fail, nothing is published.

Integration tests can also be triggered manually from the **Actions** tab → **Integration Tests** → **Run workflow**.
