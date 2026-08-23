import type { AdminClient } from './admin.js';
import { createServiceClient, type ServiceClient } from './service.js';
import { MissingEnvError } from './env.js';
import { isApiError } from './http.js';

/**
 * What a step is handed.
 *
 * Both clients, not just the service one: a real plan configures plugins, and
 * install, config and init are admin-node operations. `srvId` rides along so a
 * step body never has to close over the value the runner was given.
 */
export interface StepContext {
  service: ServiceClient;
  admin: AdminClient;
  srvId: string;
}

export interface Step {
  name: string;
  /** Is this already so? Answers the question without changing anything. */
  check(ctx: StepContext): boolean | Promise<boolean>;
  /** Make it so. Runs only when `check` said no, and never in a dry run. */
  apply(ctx: StepContext): unknown | Promise<unknown>;
}

export interface Plan {
  name: string;
  steps: Step[];
}

export type StepState =
  /** The check passed. Nothing was done, and nothing needed to be. */
  | 'satisfied'
  /** The check failed, the apply ran, and the re-check passed. */
  | 'applied'
  /** A dry run found this undone. What the "what am I missing" answer is made of. */
  | 'missing'
  /** The apply threw, or ran and left the check still failing. */
  | 'failed'
  /** An earlier step failed, so this one was not attempted. */
  | 'skipped';

export interface StepResult {
  name: string;
  state: StepState;
  /**
   * Why it failed, when it did.
   *
   * A message, never a value: the run's report is the thing most likely to end
   * up in a CI log, and a step that configures a plugin has a secret in its
   * arguments.
   */
  error?: string;
  durationMs: number;
}

export interface PlanReport {
  plan: string;
  srvId: string;
  dryRun: boolean;
  steps: StepResult[];
  /** True when no step failed. A dry run with missing steps is *not* ok. */
  ok: boolean;
}

/** What the runner emits as it goes. Name and state — never a config. */
export interface ProgressEvent {
  step: string;
  /** `running` precedes every other state for the same step. */
  state: StepState | 'running';
  error?: string;
  /** 1-based, out of `total`, so a subscriber can render a counter. */
  index: number;
  total: number;
}

export interface RunOptions {
  admin: AdminClient;
  srvId: string;
  /** Run checks only. Applies nothing, resolves no `fromEnv`, writes nothing. */
  dryRun?: boolean;
  /** Where progress goes. The CLI subscribes to this; so could a local page. */
  onProgress?: (event: ProgressEvent) => void;
  /** For a plan that shares a service client with something else. */
  service?: ServiceClient;
}

/** Declare a step. A pair of halves, because idempotency is not an afterthought. */
export function step(
  name: string,
  halves: { check: Step['check']; apply: Step['apply'] }
): Step {
  return { name, ...halves };
}

/** Declare a plan: a name, and steps in the order they depend on each other. */
export function definePlan(name: string, steps: Step[]): Plan {
  return { name, steps };
}

/**
 * Run a plan against a service.
 *
 * Sequential, and a failure stops the rest. That is not caution, it is what
 * configuration is like: there is no index before its collection and no plugin
 * config before the plugin is installed, and a runner that carried on past a
 * failed install would report five further failures that all have one cause.
 *
 * A dry run is the exception — it runs every check, because the point of asking
 * what is missing is to be told all of it at once.
 */
export async function runPlan(plan: Plan, opts: RunOptions): Promise<PlanReport> {
  const { admin, srvId, dryRun = false, onProgress } = opts;
  const ctx: StepContext = {
    admin,
    srvId,
    // Lazy all the way down — the client mints no token until a step asks it
    // to, so a plan of nothing but plugin steps never touches the service node.
    service: opts.service ?? createServiceClient(admin, srvId),
  };

  const results: StepResult[] = [];
  const total = plan.steps.length;
  let halted = false;

  const emit = (e: ProgressEvent) => onProgress?.(e);

  for (const [i, s] of plan.steps.entries()) {
    const index = i + 1;

    if (halted) {
      const result: StepResult = { name: s.name, state: 'skipped', durationMs: 0 };
      results.push(result);
      emit({ step: s.name, state: 'skipped', index, total });
      continue;
    }

    emit({ step: s.name, state: 'running', index, total });
    const started = Date.now();

    let state: StepState;
    let error: string | undefined;

    try {
      if (await s.check(ctx)) {
        state = 'satisfied';
      } else if (dryRun) {
        state = 'missing';
      } else {
        await s.apply(ctx);
        // Re-checked rather than trusted. An apply that returned without doing
        // anything — a PUT the server answered 200 to and ignored, a config
        // write that landed on the wrong plugin — would otherwise be reported
        // green, and the run would carry on building on top of it.
        state = (await s.check(ctx)) ? 'applied' : 'failed';
        if (state === 'failed') error = 'applied, but the check still fails';
      }
    } catch (err) {
      state = 'failed';
      error = describe(err);
    }

    const result: StepResult = { name: s.name, state, durationMs: Date.now() - started };
    if (error !== undefined) result.error = error;
    results.push(result);
    emit({ step: s.name, state, ...(error !== undefined ? { error } : {}), index, total });

    // A dry run keeps going: it changed nothing, so nothing downstream is any
    // less answerable than it was.
    if (state === 'failed' && !dryRun) halted = true;
  }

  return {
    plan: plan.name,
    srvId,
    dryRun,
    steps: results,
    ok: !results.some(r => r.state === 'failed' || r.state === 'missing' || r.state === 'skipped'),
  };
}

/** A message for the report — never the thing that failed, only why. */
function describe(err: unknown): string {
  if (err instanceof MissingEnvError) return err.message;
  if (isApiError(err)) {
    return err.status === 0 ? `unreachable: ${err.message}` : `${err.status} ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
