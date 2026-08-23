export { REDACTED, isRedacted } from './types.js';
export type {
  PluginConfig,
  ConfigSchema,
  CatalogPlugin,
  InstalledPlugin,
  ServicePlugins,
  ServiceToken,
  MutationResult,
} from './types.js';

export { fromEnv, isEnvRef, resolveEnvRefs, defaultEnv, MissingEnvError } from './env.js';
export type { EnvRef, EnvSource } from './env.js';

export { createAdminClient } from './admin.js';
export type { AdminClient, AdminClientConfig } from './admin.js';

export { createServiceClient } from './service.js';
export type { ServiceClient, Document, IndexKeys } from './service.js';

export { isApiError } from './http.js';

export { step, definePlan, runPlan } from './plan.js';
export type {
  Step,
  StepContext,
  StepState,
  StepResult,
  Plan,
  PlanReport,
  ProgressEvent,
  RunOptions,
} from './plan.js';
