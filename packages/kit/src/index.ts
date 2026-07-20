export type { AuthConfig, UserInfo, LoginMode, TeamMembership, TeamMember, Invitation, PendingInvitation, ApiError } from './types.js';
export { isValidApiBaseUrl, setToken, getToken, clearToken, getTokenExpiry } from './client.js';
export { register, verify, buildVerifyUrl, login, logout, checkSession, scheduleRefresh, cancelRefresh, applyBearerDelivery } from './auth.js';
export { invite, getInvitation, activate, acceptInvite, resendInvite, listInvitations } from './invite.js';
export { getTeams, switchTeam, listTeamMembers, removeMember, updateMemberRole, createTeam, updateTeam, deleteTeam } from './team.js';
export { forgotPassword, resetPassword } from './password.js';
export { updateProfile, changePassword } from './profile.js';
