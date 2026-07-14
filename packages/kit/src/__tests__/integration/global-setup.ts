import { adminFetch } from './helpers';

/**
 * Global cleanup: runs once before all test suites start and after all
 * test suites finish. Removes ALL test data matching the test patterns.
 * Uses bulk DELETE with filter — single request per collection.
 */
async function cleanupAllTestData() {
  // 1. Bulk delete all test users (*@restheart-test.com)
  const userFilter = encodeURIComponent(JSON.stringify({ _id: { $regex: '@restheart-test\\.com$' } }));
  await adminFetch(`/users/*?filter=${userFilter}`, { method: 'DELETE' });

  // 2. Bulk delete all test teams (name starting with Org-)
  const teamFilter = encodeURIComponent(JSON.stringify({ '$or': [{ createdBy: { '$regex': '.*@restheart-test.com' } }, { "createdBy": { '$regex': '.*@example\\.com' } }] }));
  console.log(`/teams/*?filter=${teamFilter}`);
  await adminFetch(`/teams/*?filter=${teamFilter}`, { method: 'DELETE' });

  // 3. Bulk delete all test invitations
  const inviteFilter = encodeURIComponent(JSON.stringify({ email: { $regex: '@restheart-test\\.com$' } }));
  await adminFetch(`/auth_invitations/*?filter=${inviteFilter}`, { method: 'DELETE' });
}

/** Runs once before all test suites. */
export async function setup() {
  await cleanupAllTestData();
}

/** Runs once after all test suites. */
export async function teardown() {
  await cleanupAllTestData();
}
