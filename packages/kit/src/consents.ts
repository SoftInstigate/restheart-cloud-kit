import type { AuthConfig, LoginMode, UserInfo } from './types.js';
import { getUserInfo, renewToken } from './auth.js';
import { updateUser } from './profile.js';

/**
 * Record the signed-in user's acceptance of the application's consents, then
 * get a token that reflects it.
 *
 * This is the client half of the "gating on consents" pattern: a Guards rule
 * blocks every request from a user who has not accepted the current terms, and
 * a permission on `PATCH /users/{userId}` — scoped with `bson-request-whitelist`
 * — is the one request it exempts.
 *
 * **The server decides what is written.** The permission's `mergeRequest`
 * stamps the versions being accepted and the timestamp, so the body sent here
 * carries the whitelisted key and nothing meaningful: a client that stated the
 * version itself could accept terms it was never shown, or backdate the
 * acceptance. `body` is a parameter only because the whitelisted key is the
 * application's to name.
 *
 * **The renewal is not optional.** The token the user holds is a snapshot taken
 * before the acceptance, and it is what the guard reads. Without a new token
 * the rule keeps blocking them for the whole life of the one they have.
 *
 * ```ts
 * // after the user ticks the box
 * const user = await acceptConsents(config, session.user._id);
 * // user.latestConsents now carries the accepted versions
 * ```
 *
 * @param userId  The user's `_id` — their email.
 * @param body    The request body. Defaults to `{ consents: [] }`, matching a
 *                permission whitelisted on `consents`.
 * @param mode    Must match how the session was established: 'bearer'
 *                (default) or 'cookie'.
 * @returns The user document as it is after the acceptance.
 */
export async function acceptConsents<E extends object = Record<never, never>>(
  config: AuthConfig,
  userId: string,
  body: Record<string, unknown> = { consents: [] },
  mode: LoginMode = 'bearer'
): Promise<UserInfo<E>> {
  await updateUser(config, userId, body);
  await renewToken(config, mode);
  return getUserInfo<E>(config);
}
