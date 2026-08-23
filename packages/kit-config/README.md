# @restheart-cloud/kit-config

Configure a RESTHeart Cloud service from a plan committed to git.

A developer who forks a starter gets working code and an unconfigured service. What follows is
clicking: create the catalog collection, add an index, write the ACL permission that lets a guest
`POST` an order, install the `stripe` plugin, fill in its keys, set the success URL. None of that
is in version control, none of it can be re-run against a second service, and the failure mode is
quiet — a missing anonymous `GET /catalog` permission shows up as *an empty shop, no error*.

This package makes it a file:

```ts
// rh-plan.ts
import { ecommercePlan } from '@restheart-cloud/kit-config/recipes/ecommerce';

export default ecommercePlan({ appOrigin: 'https://shop.example.com' });
```

```bash
npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b
```

```
[1/6] · stripe plugin installed
[2/6] + stripe products mode configured
[3/6] + stripe collections and indexes initialised
[4/6] + guests may read the catalog
[5/6] + guests may place an order
[6/6] + guests may read back the order they placed

Ecommerce on ea820b: 1 satisfied, 5 applied
```

Run it again and every line is `·` — satisfied, nothing written.

## Node only, and not by accident

The admin node's `originVetoer` whitelists `cloud.restheart.com` and allows a *missing* `Origin`
header. A page served from your own origin sends one and is vetoed; Node, curl and anything that
is not a browser pass. So this is a CLI and a library for Node, and designing it as a browser page
would have produced an API that cannot work.

It is also the right call on its own merits: the credential here is your RESTHeart Cloud account,
which governs every service you own and its billing — a much larger blast radius than the tenant
token the framework adapters handle, and not a thing to put in a deployed page.

This is **not a fourth adapter**. There is no reactive state, no session to restore, no signal to
update. See [docs/ADAPTERS.md](../../docs/ADAPTERS.md).

## Steps

The unit is not an operation, it is a **step**: a `check` that answers satisfied-or-not, and an
`apply` that makes it so.

```ts
import { definePlan, step } from '@restheart-cloud/kit-config';

export default definePlan('Blog', [
  step('posts collection', {
    check: ({ service }) => service.collectionExists('posts'),
    apply: ({ service }) => service.createCollection('posts'),
  }),
  step('posts are indexed by slug', {
    check: ({ service }) => service.indexExists('posts', 'slug_unique'),
    apply: ({ service }) => service.createIndex('posts', 'slug_unique', { slug: 1 }, { unique: true }),
  }),
]);
```

That shape gives idempotency, resumability, a dry run and a progress report for free, because they
are all the same thing seen from different angles.

A step receives `{ service, admin, srvId }` — both clients, because plugin install, config and
init are admin-node operations while collections and permissions are service-node ones.

| State | Meaning |
|---|---|
| `satisfied` | The check passed. Nothing was done, and nothing needed to be. |
| `applied` | The check failed, the apply ran, the re-check passed. |
| `missing` | A dry run found this undone. |
| `failed` | The apply threw, or ran and left the check still failing. |
| `skipped` | An earlier step failed, so this one was not attempted. |

The runner **re-checks after applying**, so a step that silently did nothing is reported failed
rather than green. A real run halts on a failure, because configuration has real dependencies —
no index before its collection, no plugin config before the plugin is installed. A dry run does
not halt: it changed nothing, and being told all of what is missing is the point.

## Secrets

A plan lives in git. `fromEnv` is how it names a secret without holding one:

```ts
step('stripe configured', {
  check: async ({ admin, srvId }) => …,
  apply: ({ admin, srvId }) => admin.updatePluginConfig(srvId, 'stripe', {
    'secret-key': fromEnv('STRIPE_SECRET_KEY'),
    'success-url': 'https://shop.example.com/shop/order',
  }),
});
```

`fromEnv` returns a marker, not a string. It becomes a value in exactly one place — the admin
client, while it serialises the request body — so the secret never reaches the run report, and a
dry run never resolves one at all. An unset variable fails the step with `missing
STRIPE_SECRET_KEY`: the *name*, which is not a secret, rather than `undefined` sent to Stripe and
a rejection three steps later that reads like a bad key instead of an absent one.

### Reading a config back

`GET .../config` replaces every `format: password` field with a fixed-width `••••••••` — fixed
width because a secret's length is still a leak. `PATCH` replaces the **whole** document and
restores the stored value for any field still holding that placeholder.

So read-modify-write is safe exactly as long as you pass the placeholder through untouched:

```ts
const config = await admin.getPluginConfig(srvId, 'stripe');
await admin.updatePluginConfig(srvId, 'stripe', { ...config, 'success-url': next });
```

Do not diff, do not strip "empty-looking" fields, do not normalise — any of those writes bullets
over the real key. `REDACTED` and `isRedacted()` are exported so you can *recognise* one; nothing
in this package ever produces one.

A blank or absent secret is **not** redacted, because "not configured" is information you need,
and turning it into bullets would erase it. That distinction is what lets the ecommerce recipe
re-run with no secrets in the environment at all: a stored key comes back as bullets, the check
passes, and the apply that would have read `STRIPE_SECRET_KEY` never runs.

## From a pipeline

Credentials come from `RH_CLOUD_EMAIL` and `RH_CLOUD_PASSWORD`, or from a prompt when the terminal
is interactive — never from a flag, which would put a password in the shell history and in the
process list of every other user on the machine. A run that authenticates itself and needs only
environment variables is already shaped like a CI job.

```yaml
# .github/workflows/deploy.yml
- run: npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b
  env:
    RH_CLOUD_EMAIL: ${{ secrets.RH_CLOUD_EMAIL }}
    RH_CLOUD_PASSWORD: ${{ secrets.RH_CLOUD_PASSWORD }}
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
    STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
```

```yaml
# bitbucket-pipelines.yml
- step:
    script:
      - npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b
    # RH_CLOUD_*, STRIPE_* as repository or deployment variables
```

Both platforms mask a registered secret in their own logs, but that is their safety net and not
this package's: the progress callback emits a step's name and state and nothing else, so there is
nothing of the secret to mask.

| Exit code | Meaning |
|---|---|
| `0` | Every step satisfied or applied. |
| `1` | A step failed. |
| `2` | A dry run found work outstanding — configuration drift, not an error. |

`--dry-run` in a pull-request check and a full run on merge gives you a deploy **gate**: a
misconfigured Stripe key fails the pipeline before it can report success.

## CLI

```
--plan <file>   A module exporting a plan (default export, or `plan`).
                A function export is called with no arguments.
--srv <id>      The service to configure.
--dry-run       Run every check, apply nothing, write nothing.
--api <url>     Admin node (default https://cloud-api.restheart.com).
--json          Emit the report as JSON instead of a step list.
```

A `.ts` plan needs a runtime that can load one — Node 22.18+ strips types on its own, anything
earlier wants `npx tsx`.

## API

### `createAdminClient(config)`

Over `cloud-api.restheart.com`, taking the core's `AuthConfig` plus an optional `env`.

`login`, `pluginCatalog`, `listPlugins`, `isPluginInstalled`, `configSchema`, `getPluginConfig`,
`updatePluginConfig`, `installPlugin`, `uninstallPlugin`, `enablePlugin`, `disablePlugin`,
`initPlugin`, `testPlugin`, `serviceToken`.

`installPlugin` takes no configuration — the server builds the initial document itself and ignores
a body, so configuring is always a second step. Free plugins only; a paid one answers `400` and
points at `/purchase`, which moves money and is deliberately out of reach.

### `createServiceClient(admin, srvId)`

Over the service node, derived from the admin client because that is where its token comes from.

`/jwt` mints a **fifteen-minute** token, and a run that installs a plugin, waits for its `init` and
then writes permissions can outlive that. So the client owns it: fetched lazily, cached, renewed a
minute before expiry, shared between concurrent callers, never returned. A caller handed a token
would die mid-run with a `401` that reads like a permissions problem, against a service left
half-configured.

| Check | Apply |
|---|---|
| `collectionExists(name)` | `createCollection(name, meta?)` |
| `indexExists(coll, id)` | `createIndex(coll, id, keys, opts?)` |
| `permissionExists(id)` | `putPermission(id, doc)` |
| `userExists(id)` | `createUser(id, doc)` |
| `schemaExists(coll)` | `putSchema(coll, schema)` |

Plus `fetch(path, init?)` for what that table does not cover.

A check answers `false` on `404` and throws on anything else — a `403` means the token cannot see
the thing, which is not the same as the thing not being there, and swallowing it would report
"missing", apply, and fail again.

### `runPlan(plan, { admin, srvId, dryRun?, onProgress? })`

Returns a `PlanReport`. Progress is a callback, not `console.log` — the CLI subscribes to it, and
so could a local page.

## Out of scope

- **Creating services.** Provisioning is the console's job; this configures one that exists.
- **Billing.** `/purchase`, `/cancel` and `/invoices` move money. A wizard that can spend your
  money by accident is not a wizard.
- **A hosted configuration page.** Ruled out by the `originVetoer`. A local page served *by* the
  CLI would talk to the CLI's own process, and is a reasonable later addition.
- **Editing arbitrary RESTHeart configuration.** Only plugin config.

## Licence

MIT
