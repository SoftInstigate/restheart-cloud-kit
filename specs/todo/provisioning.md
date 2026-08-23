# `rhc` — a session, and a service you can create from the terminal

**Status:** to do. **Repo:** `restheart-cloud-kit`, inside the existing `@restheart-cloud/cli`.
**Depends on:** `GET /srv-tiers` on the admin node — see
`restheart-cloud-server/specs/todo/srv-tiers-endpoint.md`. Everything else exists today.
**Related:** [`configuration.md`](./configuration.md), whose CLI this extends.

## Why

`configuration.md` configures a service that exists, and says so twice: provisioning is out of
scope, billing is out of scope. Both exclusions were right *for a plan runner*. Neither is a reason
not to have the command.

The gap is small and obvious in use. You have a plan in git, you have a CLI that applies it, and
the first thing you must do is leave the terminal, open a browser, click through a wizard, and come
back with a six-character id to paste into a flag. The plan describes a service; nothing describes
how you got one.

## The dominant constraint

**Provisioning does not go in CI.** Not "not yet" — not at all.

A plan file is committed, and a pipeline re-runs it on every merge. A step that could create a
service would create one per merge, and a step that could create a *shared* service would start a
purchase per merge. That is not a bug to be guarded against with a flag; it is the wrong thing to
be reachable from that direction at all.

So provisioning is **a command, not a step**. It is not callable from `runPlan`, no plan can reach
it, and it refuses to run without a terminal. The plan runner keeps exactly the property it has
today — a run that changes nothing it was not told to change, and can be a deploy gate.

This also dissolves the hard problem from the earlier design sketch. If provisioning were a step,
`srvId` would stop being an input to `runPlan` and become an output produced mid-run, with every
later step depending on a value that did not exist when the run started. As a command it is just:
create, print the id, and the id goes into the next command.

## The shape

```bash
rhc login                       # once a day
rhc new free   --name shop      # a service, immediately
rhc new shared --name shop      # a service, after you pay for it in a browser
rhc apply --plan ./rh-plan.ts --srv ea820b
```

`rhc` and the `apply` subcommand are **already in place** — the package was renamed from
`kit-config` to `@restheart-cloud/cli` and the subcommand introduced before the first publish, so
that adding `login` and `new` is not a breaking change. `apply` is what the flag-only invocation
became; its flags are unchanged.

Same package. `login`, `new` and `apply` share the admin client, the session and the error
handling, and splitting them would duplicate all three to buy a smaller npm page. The package is
installed globally for `rhc` and locally for a project's plan file — two shapes for two audiences,
which works because a `Plan` is plain data and `fromEnv` matches with `Symbol.for`, so the two
copies interoperate.

## Task 1 — the session

**File:** `packages/cli/src/session.ts`

`/token` on the admin node has `ttl: 1440` (`etc/prod-admin.yml:132`) — twenty-four hours. That is
what makes `rhc login` worth having rather than a synonym for setting two environment variables:
one login covers a day's work.

Stored at `~/.config/restheart/session.json`, mode `0600`, holding the token and the account it
belongs to. **Never the password** — a stored password is a stored password whatever the file mode
says, and there is nothing here that needs to re-authenticate unattended.

**Precedence, and it matters:** `RH_CLOUD_EMAIL`/`RH_CLOUD_PASSWORD` win over the stored session,
always. A pipeline has no `rhc login` step and must keep working exactly as it does today; a
developer's stored session must never be what a CI run silently falls back to, nor the reverse.

An expired token is not an error to decorate — it is `run rhc login`. The exit is non-zero and the
message says that and nothing else.

**Acceptance:** `rhc login` then `rhc apply` with no environment variables set works; the same
`apply` with `RH_CLOUD_*` set uses those and not the file; a session file older than its token's
`exp` produces "session expired, run rhc login" rather than a `401`.

## Task 2 — `rhc new free`

**File:** `packages/cli/src/commands/new.ts`

`POST /provision/free` with `{name, region, tags, org}`. The `srvId` is not in the body — it is in
the `Location` header, as the service URL, and gets parsed out of the hostname.

Three things the command has to get right:

**The org.** An account may have several. `POST /graphql/cloud` with
`{ me { orgs { _id name } } }` — already allowed by `userCanExecuteGQLRequests`, no new endpoint.
One org, use it; several, ask; `--org` to skip the asking.

**The region.** From `GET /srv-tiers` (Task 4's dependency), not from a hardcoded list, so a new
region works without a package release.

**The quota.** `2 + paidCount*2 > freeCount` (`ProvisionFree.java:210`). Over it, the server
answers `403`, which reads as a permissions problem. The command has to say *"you are at your free
service limit (2, plus 2 per paid service)"*, because that is a sentence the user can act on.

**Acceptance:** creates a service and prints its id, its URL, and the `rhc apply --srv <id>` line
to run next; over quota, exits non-zero with the limit explained rather than a `403`.

## Task 3 — `rhc new shared`

Same command, a different path, because the service does not exist when the call returns.

`POST /stripe/checkout-session` with `{name, region, tags, price_id, success_url}` answers
`{id, url}` — a **hosted** Stripe Checkout page. The service is created later, by
`WebhookHandler.addSharedSrv`, when Stripe reports the payment. So:

1. Create the session. Print the URL, and open it — this command is interactive by construction,
   and a URL you have to copy out of a terminal is a URL you paste wrong. `--no-open` for anyone
   who disagrees.
2. `success_url` points at the console, the same one the wizard uses. The browser needs somewhere
   sensible to land, and the CLI deliberately does **not** depend on it: no local callback server,
   no port to be already in use, nothing to fail while the user is mid-payment.
3. Poll `POST /graphql/cloud` for a new service in the org until it appears.
4. Print the id, the URL, and the next command.

The polling is where this command is most likely to be wrong, so: a timeout that says *"payment may
still be processing — check cloud.restheart.com"* rather than "failed", because at that point money
may well have moved and telling the user it failed is worse than telling them nothing. And no
prompt to retry the payment, ever.

**Acceptance:** the command exits non-zero and explains itself if run without a TTY; it never
starts a Checkout session non-interactively; a timeout does not claim failure.

## Task 4 — the tiers

`GET /srv-tiers` (server spec linked above) becomes `admin.srvTiers()`, and is what `new` reads for
both the region list and the `price_id`. A tier with an empty `regions` — `dedicated` today — is
not creatable from here and says so, pointing at the console.

Until that endpoint ships, `rhc new free` works and `rhc new shared` reports that it needs a newer
admin node. That is a better intermediate state than a hardcoded price id, which is a thing that
works right up until it silently does not.

## Order

`Task 1` → `Task 2` → `Task 4` → `Task 3`.

Task 2 before Task 4 because free provisioning needs no price id and proves the org selection, the
`Location` parsing and the quota message against a real server. Task 3 last because it is the only
one that cannot be tested without spending money.

## Out of scope

- **Deleting or resizing services.** `rhc new` is not `rhc manage`. Destructive operations against
  a running service want a confirmation design of their own, not a fourth subcommand added by
  momentum.
- **Dedicated services.** No region registry entry, no defined CLI path. The console's job.
- **A plan step that provisions.** See the dominant constraint. If this is ever revisited, revisit
  the constraint first and in writing.
