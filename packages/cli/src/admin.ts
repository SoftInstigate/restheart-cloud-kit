import { apiFetch, login } from '@restheart-cloud/kit';
import type { AuthConfig, UserInfo } from '@restheart-cloud/kit';
import { resolveEnvRefs, defaultEnv, type EnvSource } from './env.js';
import type {
  CatalogPlugin,
  ConfigSchema,
  MutationResult,
  PluginConfig,
  ServicePlugins,
  ServiceToken,
} from './types.js';

/** What `createAdminClient` needs on top of the core's `AuthConfig`. */
export interface AdminClientConfig extends Omit<AuthConfig, 'getToken' | 'setToken'> {
  /**
   * Where `fromEnv` markers are resolved from. Defaults to the ambient
   * environment; a test supplies its own, which is why the client layer never
   * reads `process.env` directly.
   */
  env?: EnvSource;
}

export interface AdminClient {
  /** Authenticate as the RESTHeart Cloud account. Must precede every other call. */
  login(email: string, password: string): Promise<UserInfo>;

  /**
   * Authenticate with a personal access token instead — what `rhc` does.
   *
   * No round trip: a token *is* the credential, where an email and a password
   * are only the means of getting one. Nothing is verified here; call
   * {@link verifyToken} for that.
   */
  useToken(token: string): void;

  /**
   * A cheap authenticated read, to find out whether the current credential
   * works before doing anything that matters.
   *
   * `GET /plugins` on purpose: it is the least a `cli` token is granted, so a
   * token that fails here fails at everything, and one that passes has cleared
   * both the authenticator and the ACL rather than only the first of the two.
   */
  verifyToken(): Promise<void>;

  /** The marketplace catalog — `GET /plugins`. Includes each plugin's `config_schema`. */
  pluginCatalog(): Promise<CatalogPlugin[]>;

  /** Installed *and* available plugins for a service — `GET /plugins-mgmt/{srvId}`. */
  listPlugins(srvId: string): Promise<ServicePlugins>;

  /** Whether `pluginId` is installed and not uninstalled. The check `installPlugin` needs. */
  isPluginInstalled(srvId: string, pluginId: string): Promise<boolean>;

  /**
   * A plugin's `config_schema`, or `null` when the catalog does not carry one.
   *
   * Reachable for an *uninstalled* plugin too, because `GET /plugins-mgmt/{srvId}`
   * returns the whole catalog under `available` — which is what lets a setup be
   * validated before a run rather than four steps into it.
   */
  configSchema(srvId: string, pluginId: string): Promise<ConfigSchema | null>;

  /** A plugin's stored configuration, with its secrets replaced by {@link REDACTED}. */
  getPluginConfig(srvId: string, pluginId: string): Promise<PluginConfig>;

  /**
   * Replace a plugin's configuration.
   *
   * The server replaces the *whole* document and restores the stored value for
   * any field still holding the redaction placeholder, so passing back what
   * `getPluginConfig` returned — placeholders untouched — leaves the tenant's
   * secrets intact.
   *
   * This is where `fromEnv` markers become values: resolved into a copy while
   * the body is serialised, and nowhere else.
   */
  updatePluginConfig(srvId: string, pluginId: string, config: PluginConfig): Promise<MutationResult>;

  /**
   * Install a plugin. The server builds the initial configuration itself and
   * ignores any body, so configuring one is a second step — `updatePluginConfig`.
   *
   * Free plugins only: a paid one answers `400` and points at `/purchase`, which
   * moves money and is deliberately out of this package's reach.
   */
  installPlugin(srvId: string, pluginId: string): Promise<MutationResult>;
  uninstallPlugin(srvId: string, pluginId: string): Promise<MutationResult>;
  enablePlugin(srvId: string, pluginId: string): Promise<MutationResult>;
  disablePlugin(srvId: string, pluginId: string): Promise<MutationResult>;

  /** Run a plugin's own initialisation — stripe's collections, indexes and products. */
  initPlugin(srvId: string, pluginId: string, mode?: string): Promise<Record<string, unknown>>;

  /** Validate a stored configuration against the real provider. */
  testPlugin(srvId: string, pluginId: string): Promise<MutationResult>;

  /** A service-admin JWT and the service's URL — `GET /srvs-mgmt/{srvId}/jwt`. */
  serviceToken(srvId: string): Promise<ServiceToken>;

  /** The `AuthConfig` this client speaks through. The service client derives from it. */
  readonly config: AuthConfig;
  /** Where this client resolves `fromEnv` markers from. */
  readonly env: EnvSource;
}

/**
 * A client over the admin node, `cloud-api.restheart.com`.
 *
 * Runs in Node, not in a browser, and not by accident: the admin node's
 * `originVetoer` allows a missing `Origin` header and whitelists only
 * `cloud.restheart.com`, so a page served from a developer's own origin is
 * vetoed. See `docs/ADAPTERS.md`.
 */
export function createAdminClient(config: AdminClientConfig): AdminClient {
  // `AuthConfig`'s token store defaults to `localStorage`, which does not exist
  // in Node — `login` would throw on persisting and `apiFetch` would read
  // nothing back. These are the hooks the core already has for exactly this
  // (the server runtimes use them to read a cookie), and the token lives in
  // this closure rather than a module global so two clients in one process
  // cannot overwrite each other's session.
  let token: string | null = null;

  const { env: envSource, ...authConfig } = config;
  const env = envSource ?? defaultEnv();

  const cfg: AuthConfig = {
    ...authConfig,
    getToken: () => token,
    setToken: (t: string) => {
      token = t;
    },
  };

  const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await apiFetch(cfg, path, init);
    return (await res.json()) as T;
  };

  const post = <T = MutationResult>(path: string, body?: unknown): Promise<T> =>
    json<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const listPlugins = (srvId: string) =>
    json<ServicePlugins>(`/plugins-mgmt/${encodeURIComponent(srvId)}`);

  const pluginPath = (srvId: string, pluginId: string) =>
    `/plugins-mgmt/${encodeURIComponent(srvId)}/${encodeURIComponent(pluginId)}`;

  return {
    config: cfg,
    env,

    login: (email, password) => login(cfg, email, password),

    useToken: (t: string) => {
      token = t;
    },

    async verifyToken() {
      await json<CatalogPlugin[]>('/plugins');
    },

    pluginCatalog: () => json<CatalogPlugin[]>('/plugins'),

    listPlugins,

    async isPluginInstalled(srvId, pluginId) {
      const { installed } = await listPlugins(srvId);
      return installed.some(p => p.plugin_id === pluginId);
    },

    async configSchema(srvId, pluginId) {
      const { available } = await listPlugins(srvId);
      return available.find(p => p._id === pluginId)?.config_schema ?? null;
    },

    getPluginConfig: (srvId, pluginId) =>
      json<PluginConfig>(`${pluginPath(srvId, pluginId)}/config`),

    // `async` deliberately: `resolveEnvRefs` throws on a missing variable, and
    // an otherwise-Promise-returning method that throws synchronously is a trap
    // — a caller using `.catch()` rather than `try`/`await` would miss it.
    async updatePluginConfig(srvId, pluginId, pluginConfig) {
      return json<MutationResult>(`${pluginPath(srvId, pluginId)}/config`, {
        method: 'PATCH',
        body: JSON.stringify(resolveEnvRefs(pluginConfig, env)),
      });
    },

    installPlugin: (srvId, pluginId) => post(`${pluginPath(srvId, pluginId)}/install`),

    uninstallPlugin: (srvId, pluginId) =>
      json<MutationResult>(pluginPath(srvId, pluginId), { method: 'DELETE' }),

    enablePlugin: (srvId, pluginId) => post(`${pluginPath(srvId, pluginId)}/enable`),
    disablePlugin: (srvId, pluginId) => post(`${pluginPath(srvId, pluginId)}/disable`),

    initPlugin: (srvId, pluginId, mode) =>
      post<Record<string, unknown>>(
        `${pluginPath(srvId, pluginId)}/init`,
        mode === undefined ? undefined : { mode }
      ),

    testPlugin: (srvId, pluginId) => post(`${pluginPath(srvId, pluginId)}/test`),

    serviceToken: (srvId) =>
      json<ServiceToken>(`/srvs-mgmt/${encodeURIComponent(srvId)}/jwt`),
  };
}
