import { describe, it, expect, vi } from 'vitest';
import { ecommercePlan } from '../../recipes/ecommerce.js';
import { runPlan } from '../../plan.js';
import { REDACTED } from '../../types.js';
import { MissingEnvError, resolveEnvRefs } from '../../env.js';
import type { AdminClient } from '../../admin.js';
import type { ServiceClient } from '../../service.js';

/** A service that starts empty and remembers what the plan did to it. */
function fakes(opts: { stripeConfig?: Record<string, unknown>; installed?: boolean } = {}) {
  const collections = new Set<string>();
  const permissions = new Map<string, unknown>();
  let stripeConfig: Record<string, unknown> = opts.stripeConfig ?? {};
  let installed = opts.installed ?? false;

  const admin = {
    isPluginInstalled: vi.fn(async () => installed),
    installPlugin: vi.fn(async () => {
      installed = true;
      return { success: true };
    }),
    getPluginConfig: vi.fn(async () => structuredClone(stripeConfig)),
    // The real client resolves `fromEnv` while serialising the body. This fake
    // stands in for the transport, not for that — so it resolves too, and a
    // marker never reaches "storage" here either.
    updatePluginConfig: vi.fn(async (_srv: string, _id: string, config: Record<string, unknown>) => {
      stripeConfig = resolveEnvRefs(config);
      return { success: true };
    }),
    initPlugin: vi.fn(async () => {
      for (const c of ['catalog', 'orders', 'transactions']) collections.add(c);
      return {};
    }),
  } as unknown as AdminClient;

  const service = {
    collectionExists: vi.fn(async (name: string) => collections.has(name)),
    permissionExists: vi.fn(async (id: string) => permissions.has(id)),
    putPermission: vi.fn(async (id: string, doc: unknown) => {
      permissions.set(id, doc);
    }),
  } as unknown as ServiceClient;

  return { admin, service, permissions, config: () => stripeConfig };
}

const plan = ecommercePlan({ appOrigin: 'https://shop.example.com' });
const run = (f: ReturnType<typeof fakes>, dryRun = false) =>
  runPlan(plan, { admin: f.admin, service: f.service, srvId: 'ea820b', dryRun });

describe('the ecommerce plan', () => {
  it('takes an empty service to a working shop', async () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_x';
    const f = fakes();

    const report = await run(f);

    expect(report.steps.map(s => s.state)).toEqual([
      'applied', 'applied', 'applied', 'applied', 'applied', 'applied',
    ]);
    expect(report.ok).toBe(true);
    expect([...f.permissions.keys()]).toEqual([
      'catalog-read-anon',
      'orders-create-anon',
      // The fourth setting the starter's README does not list, and the return
      // page cannot work without.
      'orders-read-anon',
    ]);
  });

  it('puts the order reference in the fragment, not the query', async () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_x';
    const f = fakes();
    await run(f);

    const products = f.config()['products'] as Record<string, unknown>;
    // A secret in the query reaches the server log and the Referer header.
    expect(products['success-url']).toBe(
      'https://shop.example.com/shop/order#order={ORDER_ID}&secret={ORDER_SECRET}'
    );
  });

  it('is a no-op the second time', async () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_x';
    const f = fakes();
    await run(f);

    // The second run sees stored secrets as bullets, which is "configured".
    const stored = f.config();
    stored['secret-key'] = REDACTED;
    stored['webhook-secret'] = REDACTED;

    const second = await run(f);

    expect(second.steps.map(s => s.state)).toEqual([
      'satisfied', 'satisfied', 'satisfied', 'satisfied', 'satisfied', 'satisfied',
    ]);
    expect(f.admin.installPlugin).toHaveBeenCalledTimes(1);
    expect(f.admin.updatePluginConfig).toHaveBeenCalledTimes(1);
  });

  it('needs no secrets to re-run against a configured service', async () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_x';
    const f = fakes();
    await run(f);
    const stored = f.config();
    stored['secret-key'] = REDACTED;
    stored['webhook-secret'] = REDACTED;

    delete process.env['STRIPE_SECRET_KEY'];
    delete process.env['STRIPE_WEBHOOK_SECRET'];
    const second = await run(f);

    expect(second.ok).toBe(true);
  });

  it('a dry run against an empty service lists everything and writes nothing', async () => {
    const f = fakes();

    const report = await run(f, true);

    expect(report.steps.map(s => s.state)).toEqual([
      'missing', 'missing', 'missing', 'missing', 'missing', 'missing',
    ]);
    expect(report.ok).toBe(false);
    expect(f.admin.installPlugin).not.toHaveBeenCalled();
    expect(f.admin.updatePluginConfig).not.toHaveBeenCalled();
    expect(f.permissions.size).toBe(0);
  });

  it('names the variable when the key is neither stored nor in the environment', async () => {
    delete process.env['STRIPE_SECRET_KEY'];
    delete process.env['STRIPE_WEBHOOK_SECRET'];
    const f = fakes({ installed: true });

    const report = await run(f);

    expect(report.steps[1]!.state).toBe('failed');
    expect(report.steps[1]!.error).toBe('missing STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET');
    // and the rest is not attempted, because there is nothing to initialise
    expect(report.steps.slice(2).every(s => s.state === 'skipped')).toBe(true);
  });

  it('never lets a MissingEnvError carry a value', () => {
    const err = new MissingEnvError(['STRIPE_SECRET_KEY']);
    expect(err.message).toBe('missing STRIPE_SECRET_KEY');
  });
});
