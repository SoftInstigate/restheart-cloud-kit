export type { AuthConfig, UserInfo, LoginMode, TeamMembership, TeamMember, Invitation, PendingInvitation, ApiError } from './types.js';
export { isValidApiBaseUrl, setToken, getToken, clearToken, getTokenExpiry, apiFetch } from './client.js';
export { register, verify, buildVerifyUrl, login, logout, checkSession, getUserInfo, renewToken, scheduleRefresh, cancelRefresh, applyBearerDelivery } from './auth.js';
export { invite, getInvitation, activate, acceptInvite, resendInvite, listInvitations } from './invite.js';
export { getTeams, switchTeam, listTeamMembers, removeMember, updateMemberRole, createTeam, updateTeam, deleteTeam } from './team.js';
export { forgotPassword, resetPassword } from './password.js';
export { updateProfile, updateUser, changePassword } from './profile.js';
export { acceptConsents } from './consents.js';
