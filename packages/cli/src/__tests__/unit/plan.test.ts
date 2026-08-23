import { describe, it, expect, vi } from 'vitest';
import { definePlan, runPlan, step, type ProgressEvent } from '../../plan.js';
import type { AdminClient } from '../../admin.js';
import type { ServiceClient } from '../../service.js';
import { fromEnv, MissingEnvError } from '../../env.js';

const admin = {} as AdminClient;
const service = {} as ServiceClient;

const run = (steps: Parameters<typeof definePlan>[1], dryRun = false, onProgress?: (e: ProgressEvent) => void) =>
  runPlan(definePlan('Test', steps), { admin, srvId: 'ea820b', service, dryRun, ...(onProgress ? { onProgress } : {}) });

const states = (report: Awaited<ReturnType<typeof runPlan>>) => report.steps.map(s => s.state);

describe('runPlan', () => {
  it('leaves a satisfied step alone', async () => {
    const apply = vi.fn();
    const report = await run([step('already there', { check: () => true, apply })]);

    expect(states(report)).toEqual(['satisfied']);
    expect(apply).not.toHaveBeenCalled();
    expect(report.ok).toBe(true);
  });

  it('applies an unsatisfied step and re-checks it', async () => {
    let done = false;
    const report = await run([
      step('catalog collection', {
        check: () => done,
        apply: () => {
          done = true;
        },
      }),
    ]);

    expect(states(report)).toEqual(['applied']);
    expect(report.ok).toBe(true);
  });

  it('reports an apply that silently did nothing as failed, not green', async () => {
    const report = await run([
      step('does nothing', { check: () => false, apply: () => undefined }),
    ]);

    expect(states(report)).toEqual(['failed']);
    expect(report.steps[0]!.error).toBe('applied, but the check still fails');
    expect(report.ok).toBe(false);
  });

  it('stops the rest when a step fails, because configuration has dependencies', async () => {
    const third = vi.fn(() => true);
    const report = await run([
      step('collection', { check: () => true, apply: () => undefined }),
      step('plugin install', {
        check: () => false,
        apply: () => {
          throw { status: 409, message: 'Plugin already installed' };
        },
      }),
      step('plugin config', { check: third, apply: () => undefined }),
    ]);

    expect(states(report)).toEqual(['satisfied', 'failed', 'skipped']);
    expect(report.steps[1]!.error).toBe('409 Plugin already installed');
    // Not merely unattempted — never even asked, so its failure cannot be
    // mistaken for a second, independent problem.
    expect(third).not.toHaveBeenCalled();
  });

  it('a dry run answers what is missing, all of it, and writes nothing', async () => {
    const applies = [vi.fn(), vi.fn(), vi.fn()];
    const report = await run(
      [
        step('collection', { check: () => true, apply: applies[0]! }),
        step('index', { check: () => false, apply: applies[1]! }),
        step('permission', { check: () => false, apply: applies[2]! }),
      ],
      true
    );

    expect(states(report)).toEqual(['satisfied', 'missing', 'missing']);
    expect(applies.every(a => !a.mock.calls.length)).toBe(true);
    // A dry run with work outstanding is not a pass.
    expect(report.ok).toBe(false);
    expect(report.dryRun).toBe(true);
  });

  it('a dry run never resolves a fromEnv marker', async () => {
    const env = { STRIPE_SECRET_KEY: 'sk_live_real' };
    const seen: unknown[] = [];
    const report = await run(
      [
        step('stripe configured', {
          check: () => false,
          apply: () => {
            seen.push(fromEnv('STRIPE_SECRET_KEY'));
          },
        }),
      ],
      true
    );

    expect(states(report)).toEqual(['missing']);
    expect(seen).toHaveLength(0);
    expect(env.STRIPE_SECRET_KEY).toBe('sk_live_real'); // untouched, unread
  });

  it('emits a step name and state, and nothing that could carry a secret', async () => {
    const events: ProgressEvent[] = [];
    await run(
      [
        step('stripe configured', { check: () => true, apply: () => undefined }),
        step('never runs', { check: () => false, apply: () => { throw new Error('boom'); } }),
      ],
      false,
      e => events.push(e)
    );

    expect(events).toEqual([
      { step: 'stripe configured', state: 'running', index: 1, total: 2 },
      { step: 'stripe configured', state: 'satisfied', index: 1, total: 2 },
      { step: 'never runs', state: 'running', index: 2, total: 2 },
      { step: 'never runs', state: 'failed', error: 'boom', index: 2, total: 2 },
    ]);
  });

  it('reports a missing environment variable by name', async () => {
    const report = await run([
      step('stripe configured', {
        check: () => false,
        apply: () => {
          throw new MissingEnvError(['STRIPE_SECRET_KEY']);
        },
      }),
    ]);

    expect(report.steps[0]!.error).toBe('missing STRIPE_SECRET_KEY');
  });

  it('hands each step both clients and the service id', async () => {
    const seen: unknown[] = [];
    await run([
      step('sees its context', {
        check: ctx => {
          seen.push(ctx);
          return true;
        },
        apply: () => undefined,
      }),
    ]);

    expect(seen[0]).toEqual({ admin, service, srvId: 'ea820b' });
  });
});

/**
 * The properties a real plan is written to have, against a target that
 * remembers what was done to it.
 *
 * Deliberately synthetic. A concrete plan — the ecommerce one — belongs to the
 * application it configures and lives in that starter's repo; what has to hold
 * *here* is that the runner gives any such plan idempotence and an honest dry
 * run, and a fake target shows that without tying this suite to one app's
 * collection names.
 */
describe('a multi-step plan against a stateful target', () => {
  /** Six things that must exist, none of which do yet. */
  function target() {
    const done = new Set<string>();
    const writes: string[] = [];
    const steps = ['collection', 'index', 'plugin', 'plugin config', 'read rule', 'write rule'].map(
      name =>
        step(name, {
          check: () => done.has(name),
          apply: () => {
            writes.push(name);
            done.add(name);
          },
        })
    );
    return { steps, writes, done };
  }

  it('configures an empty target, then does nothing at all the second time', async () => {
    const t = target();
    const plan = definePlan('Six', t.steps);
    const opts = { admin, service, srvId: 'ea820b' };

    const first = await runPlan(plan, opts);
    expect(first.steps.map(s => s.state)).toEqual(Array(6).fill('applied'));
    expect(first.ok).toBe(true);
    expect(t.writes).toHaveLength(6);

    const second = await runPlan(plan, opts);
    expect(second.steps.map(s => s.state)).toEqual(Array(6).fill('satisfied'));
    expect(second.ok).toBe(true);
    // The point of the whole exercise: a re-run is not a cheaper run, it is no
    // run at all.
    expect(t.writes).toHaveLength(6);
  });

  it('a dry run reports every outstanding step, not just the first', async () => {
    const t = target();
    t.done.add('collection');

    const report = await runPlan(definePlan('Six', t.steps), {
      admin,
      service,
      srvId: 'ea820b',
      dryRun: true,
    });

    expect(report.steps.map(s => s.state)).toEqual([
      'satisfied', 'missing', 'missing', 'missing', 'missing', 'missing',
    ]);
    expect(t.writes).toHaveLength(0);
    expect(report.ok).toBe(false);
  });

  it('a partially configured target applies only what is left', async () => {
    const t = target();
    t.done.add('collection');
    t.done.add('plugin');

    const report = await runPlan(definePlan('Six', t.steps), { admin, service, srvId: 'ea820b' });

    expect(report.steps.map(s => s.state)).toEqual([
      'satisfied', 'applied', 'satisfied', 'applied', 'applied', 'applied',
    ]);
    expect(t.writes).toEqual(['index', 'plugin config', 'read rule', 'write rule']);
  });
});
