# Extending the kit to configuration

**Status:** to do. **Repo:** `restheart-cloud-kit` (a new package, not a fourth adapter).
**Depends on:** nothing new server-side — everything below already exists and is verified.

## Why

A developer who forks a starter gets working code and an unconfigured service. What follows is
clicking: create the catalog collection, add an index, write an ACL permission that lets a guest
POST an order, install the `stripe` plugin, fill in its keys, set the success URL, turn on the
sign-up features the app expects.

None of that is reproducible. It is not in version control, it cannot be re-run against a second
service, and the failure mode is quiet — the ecommerce starter's README already has to warn that a
missing anonymous `GET /catalog` permission shows up as *an empty shop, no error*. The developer
reads a checklist in a README and performs it by hand, once, hoping they did not miss a line.

The APIs to do all of it exist. What is missing is the layer that makes them scriptable, checkable
and idempotent.

## What the server exposes (verified against the code)

Two hosts. **This is the fact everything else follows from.**

### The admin node — `cloud-api.restheart.com`

Authenticated as the **RESTHeart Cloud (SaaS) account**. It runs `restheart-accounts`
(`etc/prod-admin.yml`: `/accountsService/enabled: true`), so **the kit's existing `login()` already
works against it** — same `/token`, same flows, nothing new to write.

| Endpoint | Method | Purpose |
|---|---|---|
| `/srvs-mgmt/{srvId}/jwt` | `GET` | → `{token, url, node}` — a service-admin JWT *and* the service's URL |
| `/plugins` | `GET` | Marketplace catalog, including each plugin's `config_schema` |
| `/plugins-mgmt/{srvId}` | `GET` | Installed and available plugins for the service |
| `/plugins-mgmt/{srvId}/{pluginId}/install` | `POST` | Install |
| `/plugins-mgmt/{srvId}/{pluginId}/config` | `GET` / `PATCH` | Read / update plugin config |
| `/plugins-mgmt/{srvId}/{pluginId}/enable` \| `/disable` | `POST` | Toggle |
| `/plugins-mgmt/{srvId}/{pluginId}/init` | `POST` | Run the plugin's own initialisation (e.g. stripe's collections and indexes) |
| `/plugins-mgmt/{srvId}/{pluginId}/test` | `POST` | Validate a configuration against the real provider |
| `/plugins-mgmt/{srvId}/{pluginId}` | `DELETE` | Uninstall |

Access control is `hasServiceAccess(userId, roles, srvId)` — the `srvId` must be in the user's
`orgs`.

### The service node — `{srvId}.{region}-{tier}-{n}.restheart.com`

Authenticated with the JWT the admin node just minted. Role `srv-admin`, or `root` for a dedicated
service. From here everything is plain RESTHeart: `PUT /{coll}`, `PUT /{coll}/_indexes/{id}`,
the ACL collection, the users collection.

The service URL does not need configuring separately — `/srvs-mgmt/{srvId}/jwt` returns it.

## The four facts that must shape the API

**1. Two hosts, one login, and a token that expires in fifteen minutes.**
`/jwt` mints through `jwtIssuer`, whose TTL on the admin node is `15` minutes (`etc/prod-admin.yml:115`).
A dedicated service gets 480 because the call passes an explicit TTL; everyone else gets fifteen.

A configuration run that installs a plugin, waits for `init`, creates collections and writes
permissions can outlive that. If the kit hands the caller a token and steps aside, a long run dies
in the middle with a `401` that reads like a permissions problem and leaves the service
half-configured. The service-node client must own the token: fetch it lazily, cache it, and renew
on expiry without the caller knowing it happened.

**2. The admin node refuses third-party browser origins.**

```yaml
# etc/prod-admin.yml:170
/originVetoer:
  enabled: true
  whitelist: [https://cloud.restheart.com, cloud.restheart.com]
  allow-missing-origin: true
```

A page served from the developer's own origin sends `Origin` and is vetoed. A client that sends no
`Origin` header — Node, curl, anything not a browser — passes.

So this runs in **Node**, and that is not an incidental limitation to work around later: designing
it as a browser page would produce an API that cannot work. It also happens to be the right call on
its own merits, because the SaaS credential governs every service on the account and its billing —
a much larger blast radius than the tenant token the adapters handle, and not something to put in a
deployed page.

**3. Secrets come back redacted, and the redaction is load-bearing.**
`GET .../config` replaces every `format: password` field — decided from the plugin's `config_schema`
— with a fixed-width `••••••••` (`PluginSecretsRedactor.REDACTED`; fixed width because leaking a
secret's length is still a leak). `PATCH` replaces the *whole* config document, and the server
restores the stored value for any field still holding the placeholder.

That means read-modify-write is safe **only** if the kit passes the placeholder through untouched.
A helper that tried to be clever — diffing, stripping "empty-looking" fields, normalising — would
write bullets over the tenant's real Stripe key. The kit must treat the placeholder as an opaque
value it never generates and never interprets.

One subtlety worth preserving: a blank or absent secret is *not* redacted, because "not configured"
is information the caller needs and turning it into bullets would erase it. Anything that reports
configuration state has to keep that distinction.

**4. Every operation needs a check, not just an apply.**
The point is a run that can be repeated. Creating a collection that already exists must report
"already there" and move on, not return `409` and abort the wizard four steps from the end. And the
developer needs to be able to ask *what is missing* without changing anything — the honest version
of the README checklist.

So the unit is not an operation, it is a **step**: a `check` that answers satisfied-or-not, and an
`apply` that makes it so. That shape gives idempotency, resumability, a dry run and the
step-by-step progress report for free, because they are all the same thing seen from different
angles.

## Dominant constraint

**This is not a fourth adapter surface.** `docs/ADAPTER_CONTRACT.md` describes reactive client
state, and none of it applies here: there is no user to track, no session to restore, no signal to
update. Adding a `RhConfigService` alongside `RhAuthService` and `RhPaymentsService` would suggest a
parity that does not exist and cannot exist — the thing does not run in a browser.

It gets its own package, **`@restheart-cloud/kit-config`**, depending on `@restheart-cloud/kit` for
`login`, `apiFetch` and the error type. The client layer stays isomorphic (`fetch` only, no Node
built-ins) so it can be unit-tested without a live service; only the CLI is Node-specific.

---

## Task 1 — the admin client

**File:** `packages/kit-config/src/admin.ts`

`createAdminClient(config)` over the admin node, taking the same `AuthConfig` the core already
understands — `apiBaseUrl` pointing at `cloud-api.restheart.com`.

`AuthConfig`'s token store defaults to `localStorage`, which does not exist in Node: `login()`
would throw on `persistToken`, and `apiFetch` would read nothing back. The admin client therefore
supplies its own `getToken`/`setToken` — the hooks `AuthConfig` already has for exactly this
reason (the server runtimes use them to read a cookie) — backed by a variable held in the client's
closure. Per-client, not a module global, so two clients in one process cannot overwrite each
other's session.

Methods, one per endpoint in the table above: `listPlugins(srvId)`, `getPluginConfig`,
`updatePluginConfig`, `installPlugin`, `enablePlugin`, `disablePlugin`, `initPlugin`,
`testPlugin`, `uninstallPlugin`, `pluginCatalog()`. Plus `isPluginInstalled(srvId, pluginId)`,
derived from `listPlugins` — fact 4 wants a check for every apply, and `installPlugin` is an
apply.

Types come from the real responses, including `config_schema` — a JSON Schema, which is what makes
a generic surface possible: the kit does not need to know what `stripe` or `accounts` configure,
only how to read a schema.

`REDACTED` is exported as a constant so callers can recognise a placeholder. Nothing in the kit
ever produces one.

**Acceptance:** reading a config with a secret returns the placeholder; writing that same object
back leaves the stored secret intact.

## Task 2 — the service-node client

**File:** `packages/kit-config/src/service.ts`

`createServiceClient(admin, srvId)` — derived from the admin client, because that is where the
token comes from. It calls `/srvs-mgmt/{srvId}/jwt` on first use, caches `{token, url}`, and
renews before the fifteen minutes are up. The caller never sees a token.

Operations, each split into the two halves fact 4 demands:

| Concern | Check | Apply |
|---|---|---|
| Collection | `collectionExists(name)` | `createCollection(name, meta?)` |
| Index | `indexExists(coll, id)` | `createIndex(coll, id, keys, opts?)` |
| Permission | `permissionExists(id)` | `putPermission(id, doc)` |
| User | `userExists(id)` | `createUser(id, doc)` |
| Schema | `schemaExists(coll)` | `putSchema(coll, schema)` |

**Acceptance:** a run against an already-configured service performs no writes and reports every
step satisfied; the same run against an empty one configures it; the second run is a no-op.

## Task 3 — the step runner

**File:** `packages/kit-config/src/plan.ts`

```ts
const plan = definePlan('Ecommerce', [
  step('catalog collection', {
    check: ({ service }) => service.collectionExists('catalog'),
    apply: ({ service }) => service.createCollection('catalog'),
  }),
  step('guests may read the catalog', {
    check: ({ service }) => service.permissionExists('catalog-read-anon'),
    apply: ({ service }) => service.putPermission('catalog-read-anon', { … }),
  }),
  step('stripe installed', {
    check: ({ admin, srvId }) => admin.isPluginInstalled(srvId, 'stripe'),
    apply: ({ admin, srvId }) => admin.installPlugin(srvId, 'stripe'),
  }),
]);

const report = await runPlan(plan, { admin, srvId, dryRun: false });
```

A step receives a **context**, `{ service, admin, srvId }`, not a bare service client: Task 5's
plugin steps — install, config, init — are admin-node operations, and a plan that could only reach
the service node could not express them. `srvId` rides along so a step body never has to close
over the value the runner was given.

Each step resolves to `satisfied` (check passed, nothing done), `applied`, `failed` or `skipped`
(a dependency failed). `dryRun` runs checks only — the "what am I missing" answer.

The runner re-checks after applying, so a step that silently did nothing is reported as failed
rather than green. Steps run in order and a failure stops what depends on it, because configuration
has real dependencies: no index before its collection, no plugin config before the plugin is
installed.

Progress is a callback, not `console.log` — the CLI subscribes to it, and so could a local page.

**Acceptance:** a step whose `apply` succeeds but whose `check` still fails is reported failed; a
dry run writes nothing.

### Secrets in a plan that lives in git

A plan file for a real starter (Task 5) is committed alongside the code it configures. A step's
`apply` needs a live Stripe secret key; the plan file must never hold one.

```ts
apply: ({ admin, srvId }) => admin.updatePluginConfig(srvId, 'stripe', {
  'secret-key': fromEnv('STRIPE_SECRET_KEY'),
  'success-url': 'https://shop.example.com/checkout/done',
}),
```

`fromEnv(name)` returns a marker object, not a string. Resolution happens in one place — the
admin client, walking the payload immediately before serialising it — so the secret exists as a
value only inside the request that carries it. It reads through an injectable `env` record
defaulting to `globalThis.process?.env ?? {}`, which keeps the client layer free of a Node import
(the Dominant constraint) and lets a unit test supply an environment without setting one. It is never returned to the plan, never held in the
report, and a dry run never resolves one at all, because a dry run runs no `apply`.

An unset variable fails the step with *"missing STRIPE_SECRET_KEY"*. The failure names the
variable, which is not a secret; the marker's `toString` is the same name, so a marker that leaks
into a log through some other path prints `fromEnv(STRIPE_SECRET_KEY)` rather than anything
useful.

**Acceptance:** a plan referencing `fromEnv('STRIPE_SECRET_KEY')` applies correctly when the
variable is set, and fails naming the variable rather than sending `undefined` and collecting a
provider-side rejection when it is not; a dry run of that plan touches `process.env` not at all.

## Task 4 — the CLI

**File:** `packages/kit-config/src/cli.ts`, `bin` entry

```bash
npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b
npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b --dry-run
```

Credentials by prompt or environment (`RH_CLOUD_EMAIL`, `RH_CLOUD_PASSWORD`) — never by flag, which
would put a password in the shell history.

Output is the step list with its state, updated as the run proceeds. Exit non-zero when a step
failed, so this can be a CI gate.

### Running from a pipeline

This is the point of Task 1–3 being Node-only and credential-by-environment by design (fact 2): a
run that authenticates itself and needs only environment variables is already shaped like a CI
job, not shaped into one after the fact.

```yaml
# .github/workflows/deploy.yml
- run: npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b
  env:
    RH_CLOUD_EMAIL: ${{ secrets.RH_CLOUD_EMAIL }}
    RH_CLOUD_PASSWORD: ${{ secrets.RH_CLOUD_PASSWORD }}
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
```

```yaml
# bitbucket-pipelines.yml
- step:
    script:
      - npx @restheart-cloud/kit-config --plan ./rh-plan.ts --srv ea820b
    # RH_CLOUD_EMAIL, RH_CLOUD_PASSWORD, STRIPE_SECRET_KEY set as repository/deployment variables
```

Both platforms mask a value registered as a secret wherever it appears in their own logs, but that
is their safety net, not the kit's — the progress callback (Task 3) must only ever emit a step's
name and state, never its resolved config, so there is nothing of the secret to leak into the log
in the first place.

The non-zero exit on a failed step is what turns this into a deploy *gate* rather than a deploy
script: a misconfigured Stripe key fails the pipeline before it can report success.

**Acceptance:** running against a service already configured exits 0 with every step green and no
writes; the same command, run as a GitHub Actions step with secrets set as repository secrets and
as a Bitbucket Pipelines step with them set as repository/deployment variables, produces the same
result.

## Task 5 — the ecommerce plan, as the first real consumer

**File:** `packages/kit-config/recipes/ecommerce.ts`, wired into `restheart-cloud-starter-ecommerce`

The three settings the starter's README currently asks the developer to get right by hand — the
`success-url`, the anonymous `GET /catalog`, the anonymous `POST /orders` — become steps, plus the
collections, the indexes and the `stripe` plugin's install/config/init.

This is the test of whether the generic surface is actually general: if the plan cannot express
those without reaching around the API, the API is wrong.

**Acceptance:** a fresh service goes from empty to a working shop with one command, and the
starter's README replaces its manual checklist with it.

## Task 6 — documentation

**Files:** `packages/kit-config/README.md`, root `README.md`, `docs/ADAPTERS.md`

`docs/ADAPTERS.md` gets a short section stating what this package is *not*: not an adapter, no
section-E contract, does not run in a browser — with the `originVetoer` reason, so nobody
re-litigates it in six months.

---

## Order

`Task 1` → `Task 2` → `Task 3` → `Task 5` → `Task 4` → `Task 6`.

Task 5 before Task 4 on purpose: the plan for a real service is what proves the runner's shape, and
it is cheaper to change that shape before a CLI is built on top of it.

## Out of scope

- **Creating services.** Provisioning a new RESTHeart Cloud service is the console's job; this
  configures one that exists.
- **Billing.** `/plugins-mgmt/{srvId}/{pluginId}/purchase`, `/cancel` and `/invoices` move money or
  report on it. A wizard that can spend the developer's money by accident is not a wizard.
- **A hosted configuration page.** Ruled out by fact 2. A local page served *by* the CLI is a
  reasonable later addition — it would talk to the CLI's own process, not to the admin node.
- **Editing arbitrary RESTHeart configuration.** Only plugin config, which is what
  `/plugins-mgmt/.../config` covers.

## Open question

`GET /plugins-mgmt/{srvId}` returns installed *and* available plugins, and `GET /plugins` returns
the marketplace catalog with `config_schema`. Whether a plugin's schema is reachable without the
marketplace call — and whether an uninstalled plugin's schema is visible at all — decides if
`definePlan` can validate a config block before the run starts, or only after installing. Worth
settling in Task 1, because "your stripe config was wrong" is much more useful before a run than
four steps into it.
