export type { AuthConfig, UserInfo, TeamMembership, Invitation, ApiError } from './types.js';
export { isValidApiBaseUrl } from './client.js';
export { register, verify, login, logout, checkSession } from './auth.js';
export { invite, getInvitation, activate, acceptInvite, resendInvite } from './invite.js';
export { getTeams, switchTeam } from './team.js';
export { forgotPassword, resetPassword } from './password.js';
