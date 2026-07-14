export type { AuthConfig, UserInfo, LoginMode, TeamMembership, Invitation, ApiError } from './types.js';
export { isValidApiBaseUrl, setToken, getToken, clearToken, getTokenExpiry } from './client.js';
export { register, verify, buildVerifyUrl, login, logout, checkSession, scheduleRefresh, cancelRefresh } from './auth.js';
export { invite, getInvitation, activate, acceptInvite, resendInvite } from './invite.js';
export { getTeams, switchTeam } from './team.js';
export { forgotPassword, resetPassword } from './password.js';
