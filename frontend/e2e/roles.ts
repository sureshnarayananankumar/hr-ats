/**
 * Shared E2E constants.
 *
 * Deliberately NOT a spec file: Playwright forbids a test file from
 * importing another test file, so the role list and storage-state paths
 * live here where both auth.setup.ts and the specs can use them.
 */
export const ROLES = {
  superAdmin: 'superadmin@hr-ats.local',
  hrAdmin: 'hr.admin@hr-ats.local',
  recruiter: 'recruiter@hr-ats.local',
  interviewer: 'interviewer@hr-ats.local',
  candidate: 'candidate1@example.com',
} as const;

export type Role = keyof typeof ROLES;

/** Relative to the frontend directory, which is where Playwright runs. */
export const STATE_DIR = 'e2e/.auth';

export const statePath = (role: Role): string => `${STATE_DIR}/${role}.json`;

/**
 * Origin only. Playwright resolves a leading-slash path from the ORIGIN,
 * so a baseURL ending in /api would be silently discarded.
 */
export const API_ORIGIN = process.env.E2E_API_ORIGIN ?? 'http://localhost:8000';
