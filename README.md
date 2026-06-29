# RESTHeart Cloud Kit

[RESTHeart Cloud](https://restheart.org/cloud) gives you a production-ready backend — MongoDB, REST API, authentication, multi-tenancy, all managed.

This kit gives you the same speed on the frontend.

## Packages

| Package | Description | npm |
|---|---|---|
| [`@restheart-cloud/kit`](./packages/kit) | TypeScript core — zero dependencies, works with any framework | [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit)](https://www.npmjs.com/package/@restheart-cloud/kit) |
| [`@restheart-cloud/kit-ng`](./packages/kit-ng) | Angular adapter — signals, guards, interceptor | [![npm](https://img.shields.io/npm/v/@restheart-cloud/kit-ng)](https://www.npmjs.com/package/@restheart-cloud/kit-ng) |

**Looking for the docs?** → [`@restheart-cloud/kit`](./packages/kit/README.md) · [`@restheart-cloud/kit-ng`](./packages/kit-ng/README.md)

## Quickstart

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

Releases are automated via [changesets](https://github.com/changesets/changesets). Merge a PR with a changeset → CI opens a version PR → merge it → packages publish to npm.
