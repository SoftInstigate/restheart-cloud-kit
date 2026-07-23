import { computed, ref, type ComputedRef, type Ref } from 'vue';
import * as kit from '@restheart-cloud/kit';
import type {
  AuthConfig,
  Invitation,
  LoginMode,
  PendingInvitation,
  TeamMember,
  TeamMembership,
  UserInfo,
} from '@restheart-cloud/kit';

/**
 * The reactive auth store shared app-wide. This is the Vue equivalent of
 * `kit-ng`'s `RhAuthService` and `kit-react`'s `useAuth` — the same contract,
 * exposed as Vue refs and `async` methods.
 *
 * Create it with {@link createRhAuth} and read it with `useAuth()`.
 */
export interface RhAuthStore {
  /** The authenticated user, or `null`. `user._id` is the email. */
  readonly user: Readonly<Ref<UserInfo | null>>;
  /** Teams the user belongs to. */
  readonly teams: Readonly<Ref<TeamMembership[]>>;
  /** Derived from `user`. */
  readonly isAuthenticated: ComputedRef<boolean>;
  /** `true` when the user belongs to more than one team. */
  readonly hasMultipleTeams: ComputedRef<boolean>;
  /** `true` until the initial session check settles. */
  readonly initializing: Readonly<Ref<boolean>>;

  checkSession(): Promise<UserInfo | null>;
  register(payload: {
    email: string;
    password: string;
    teamName: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void>;
  verify(email: string, token: string, delivery?: 'cookie' | 'fragment'): Promise<string>;
  login(email: string, password: string, mode?: LoginMode): Promise<UserInfo>;
  logout(): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(
    payload: { email: string; token: string; password: string },
    mode?: LoginMode
  ): Promise<void>;
  updateProfile(updates: { firstName?: string; lastName?: string }): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  invite(email: string, role: 'owner' | 'member'): Promise<void>;
  getInvitation(email: string, token: string): Promise<Invitation>;
  activate(
    payload: { email: string; token: string; password: string },
    mode?: LoginMode
  ): Promise<void>;
  acceptInvite(token: string): Promise<void>;
  resendInvite(email: string): Promise<void>;
  listInvitations(): Promise<PendingInvitation[]>;
  loadTeams(): Promise<TeamMembership[]>;
  switchTeam(teamId: { $oid: string }, mode?: LoginMode): Promise<void>;
  listTeamMembers(): Promise<TeamMember[]>;
  removeMember(email: string): Promise<void>;
  updateMemberRole(email: string, role: 'owner' | 'member'): Promise<void>;
  createTeam(teamName: string): Promise<TeamMembership>;
  updateTeam(updates: { name?: string; description?: string }): Promise<void>;
  deleteTeam(): Promise<void>;
  clearSession(): void;
}

/**
 * Build the reactive store. Called once by {@link createRhAuth}; on creation it
 * kicks off a session check so a page reload restores the session.
 */
export function createRhAuthStore(config: AuthConfig): RhAuthStore {
  const user = ref<UserInfo | null>(null);
  const teams = ref<TeamMembership[]>([]);
  const initializing = ref(true);

  const isAuthenticated = computed(() => user.value !== null);
  const hasMultipleTeams = computed(() => teams.value.length > 1);

  async function loadTeams(): Promise<TeamMembership[]> {
    const ts = await kit.getTeams(config);
    teams.value = ts;
    return ts;
  }

  async function checkSession(): Promise<UserInfo | null> {
    if (!kit.getToken()) {
      user.value = null;
      teams.value = [];
      return null;
    }
    const u = await kit.checkSession(config);
    user.value = u;
    if (u === null) {
      teams.value = [];
      return null;
    }
    teams.value = await kit.getTeams(config).catch(() => [] as TeamMembership[]);
    return u;
  }

  async function login(
    email: string,
    password: string,
    mode: LoginMode = 'bearer'
  ): Promise<UserInfo> {
    const u = await kit.login(config, email, password, mode);
    user.value = u;
    teams.value = await kit.getTeams(config).catch(() => [] as TeamMembership[]);
    return u;
  }

  async function logout(): Promise<void> {
    await kit.logout(config);
    user.value = null;
    teams.value = [];
  }

  function clearSession(): void {
    kit.clearToken();
    kit.cancelRefresh();
    user.value = null;
    teams.value = [];
  }

  async function acceptInvite(token: string): Promise<void> {
    await kit.acceptInvite(config, token);
    teams.value = await kit.getTeams(config).catch(() => [] as TeamMembership[]);
  }

  async function switchTeam(teamId: { $oid: string }, mode: LoginMode = 'bearer'): Promise<void> {
    await kit.switchTeam(config, teamId, mode);
    await checkSession();
  }

  async function updateProfile(updates: { firstName?: string; lastName?: string }): Promise<void> {
    await kit.updateProfile(config, updates);
    await checkSession();
  }

  const store: RhAuthStore = {
    user,
    teams,
    isAuthenticated,
    hasMultipleTeams,
    initializing,

    checkSession,
    register: (payload) => kit.register(config, payload),
    verify: (email, token, delivery = 'fragment') => kit.verify(config, email, token, delivery),
    login,
    logout,
    forgotPassword: (email) => kit.forgotPassword(config, email),
    resetPassword: async (payload, mode = 'bearer') => {
      await kit.resetPassword(config, payload, mode);
    },
    updateProfile,
    changePassword: (current, next) => kit.changePassword(config, current, next),
    invite: (email, role) => kit.invite(config, email, role),
    getInvitation: (email, token) => kit.getInvitation(config, email, token),
    activate: async (payload, mode = 'bearer') => {
      await kit.activate(config, payload, mode);
    },
    acceptInvite,
    resendInvite: (email) => kit.resendInvite(config, email),
    listInvitations: () => kit.listInvitations(config),
    loadTeams,
    switchTeam,
    listTeamMembers: () => kit.listTeamMembers(config),
    removeMember: (email) => kit.removeMember(config, email),
    updateMemberRole: (email, role) => kit.updateMemberRole(config, email, role),
    createTeam: (teamName) => kit.createTeam(config, teamName),
    updateTeam: (updates) => kit.updateTeam(config, updates),
    deleteTeam: () => kit.deleteTeam(config),
    clearSession,
  };

  // Restore the session once, at store creation.
  void checkSession()
    .catch(() => null)
    .finally(() => {
      initializing.value = false;
    });

  return store;
}
