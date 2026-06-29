# RESTHeart Cloud Kit — Monorepo

npm workspaces monorepo for the RESTHeart Cloud Kit packages.

## Packages

| Package | Description |
|---|---|
| [`@restheart-cloud/kit`](./packages/kit) | Pure TypeScript — auth logic, types, HTTP client |
| [`@restheart-cloud/kit-ng`](./packages/kit-ng) | Angular adapter — signals, guards, interceptor |

These packages are consumed by framework-specific apps. See [`restheart-cloud-starter-ng`](https://github.com/softinstigate/restheart-cloud-starter-ng) for the Angular app built on top of them.

## Structure

```
packages/
  kit/       ← @restheart-cloud/kit      (published to npm)
  kit-ng/    ← @restheart-cloud/kit-ng   (published to npm)
```

## Setup

```bash
npm install       # installs dependencies for all packages
npm run build     # builds kit, then kit-ng
```

## References

- [Implementation plan](./PLAN-kit.md)
- [RESTHeart Cloud documentation](https://restheart.org/docs)
