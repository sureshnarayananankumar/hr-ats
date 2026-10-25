import { RoleName } from '@prisma/client';

/**
 * The complete permission catalogue.
 *
 * Authorization is permission-based, not role-based, at the enforcement
 * point: guards check for a permission key, and roles are simply named
 * bundles of keys. That keeps `@RequirePermissions(...)` readable and
 * lets permissions be re-bundled without touching controllers.
 *
 * Naming: "<resource>.<action>[.scope]"
 *   .any  -> across all records
 *   .own  -> only records the caller owns
 */
export const PERMISSIONS = {
  // ---- Users / platform administration ----
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DEACTIVATE: 'user.deactivate',
  ROLE_ASSIGN: 'role.assign',
  PERMISSION_MANAGE: 'permission.manage',
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',
  AUDIT_READ: 'audit.read',

  // ---- Departments ----
  DEPARTMENT_READ: 'department.read',
  DEPARTMENT_MANAGE: 'department.manage',

  // ---- Job requirements ----
  JOB_READ_ANY: 'job.read.any',
  JOB_READ_ASSIGNED: 'job.read.assigned',
  JOB_CREATE: 'job.create',
  JOB_UPDATE: 'job.update',
  JOB_SUBMIT: 'job.submit',
  JOB_APPROVE: 'job.approve',
  JOB_PUBLISH: 'job.publish',
  JOB_HOLD: 'job.hold',
  JOB_CLOSE: 'job.close',
  JOB_CANCEL: 'job.cancel',
  JOB_DUPLICATE: 'job.duplicate',
  JOB_ASSIGN_RECRUITER: 'job.assign_recruiter',
  JOB_EXPORT: 'job.export',

  // ---- Candidates ----
  CANDIDATE_READ_ANY: 'candidate.read.any',
  CANDIDATE_READ_OWN: 'candidate.read.own',
  CANDIDATE_UPDATE_ANY: 'candidate.update.any',
  CANDIDATE_UPDATE_OWN: 'candidate.update.own',
  CANDIDATE_NOTE_MANAGE: 'candidate.note.manage',
  CANDIDATE_TAG_MANAGE: 'candidate.tag.manage',
  CANDIDATE_EXPORT: 'candidate.export',

  // ---- Documents ----
  DOCUMENT_UPLOAD_OWN: 'document.upload.own',
  DOCUMENT_READ_OWN: 'document.read.own',
  DOCUMENT_READ_ANY: 'document.read.any',
  DOCUMENT_DELETE_OWN: 'document.delete.own',

  // ---- Applications ----
  APPLICATION_CREATE_OWN: 'application.create.own',
  APPLICATION_READ_OWN: 'application.read.own',
  APPLICATION_READ_ANY: 'application.read.any',
  APPLICATION_READ_ASSIGNED: 'application.read.assigned',
  APPLICATION_WITHDRAW_OWN: 'application.withdraw.own',
  APPLICATION_TRANSITION: 'application.transition',
  APPLICATION_ASSIGN: 'application.assign',
  APPLICATION_NOTE_MANAGE: 'application.note.manage',
  APPLICATION_BULK: 'application.bulk',
  APPLICATION_EXPORT: 'application.export',

  // ---- Interviews ----
  INTERVIEW_READ_ANY: 'interview.read.any',
  INTERVIEW_READ_ASSIGNED: 'interview.read.assigned',
  INTERVIEW_READ_OWN: 'interview.read.own',
  INTERVIEW_SCHEDULE: 'interview.schedule',
  INTERVIEW_RESCHEDULE: 'interview.reschedule',
  INTERVIEW_CANCEL: 'interview.cancel',
  FEEDBACK_SUBMIT: 'interview.feedback.submit',
  FEEDBACK_READ_ANY: 'interview.feedback.read.any',

  // ---- Offers ----
  OFFER_READ_ANY: 'offer.read.any',
  OFFER_READ_OWN: 'offer.read.own',
  OFFER_CREATE: 'offer.create',
  OFFER_UPDATE: 'offer.update',
  OFFER_APPROVE: 'offer.approve',
  OFFER_SEND: 'offer.send',
  OFFER_WITHDRAW: 'offer.withdraw',
  OFFER_RESPOND_OWN: 'offer.respond.own',

  // ---- Onboarding ----
  ONBOARDING_READ_ANY: 'onboarding.read.any',
  ONBOARDING_READ_OWN: 'onboarding.read.own',
  ONBOARDING_MANAGE: 'onboarding.manage',
  ONBOARDING_TASK_UPDATE: 'onboarding.task.update',

  // ---- Reports & dashboard ----
  DASHBOARD_VIEW: 'dashboard.view',
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',

  // ---- Notifications ----
  NOTIFICATION_READ_OWN: 'notification.read.own',
  NOTIFICATION_TEMPLATE_MANAGE: 'notification.template.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

/** Everything a recruiter can do -- reused by the roles above it. */
const RECRUITER_PERMISSIONS: PermissionKey[] = [
  P.JOB_READ_ASSIGNED,
  P.DEPARTMENT_READ,
  P.CANDIDATE_READ_ANY,
  P.CANDIDATE_NOTE_MANAGE,
  P.CANDIDATE_TAG_MANAGE,
  P.DOCUMENT_READ_ANY,
  P.APPLICATION_READ_ASSIGNED,
  P.APPLICATION_TRANSITION,
  P.APPLICATION_NOTE_MANAGE,
  P.APPLICATION_BULK,
  P.APPLICATION_EXPORT,
  P.INTERVIEW_READ_ASSIGNED,
  P.INTERVIEW_SCHEDULE,
  P.INTERVIEW_RESCHEDULE,
  P.INTERVIEW_CANCEL,
  P.FEEDBACK_READ_ANY,
  P.OFFER_READ_ANY,
  P.ONBOARDING_READ_ANY,
  P.DASHBOARD_VIEW,
  P.REPORT_VIEW,
  P.NOTIFICATION_READ_OWN,
];

const HR_ADMIN_PERMISSIONS: PermissionKey[] = [
  ...RECRUITER_PERMISSIONS,
  P.USER_READ,
  P.DEPARTMENT_MANAGE,
  P.JOB_READ_ANY,
  P.JOB_CREATE,
  P.JOB_UPDATE,
  P.JOB_SUBMIT,
  P.JOB_APPROVE,
  P.JOB_PUBLISH,
  P.JOB_HOLD,
  P.JOB_CLOSE,
  P.JOB_CANCEL,
  P.JOB_DUPLICATE,
  P.JOB_ASSIGN_RECRUITER,
  P.JOB_EXPORT,
  P.CANDIDATE_UPDATE_ANY,
  P.CANDIDATE_EXPORT,
  P.APPLICATION_READ_ANY,
  P.APPLICATION_ASSIGN,
  P.INTERVIEW_READ_ANY,
  P.OFFER_CREATE,
  P.OFFER_UPDATE,
  P.OFFER_APPROVE,
  P.OFFER_SEND,
  P.OFFER_WITHDRAW,
  P.ONBOARDING_MANAGE,
  P.ONBOARDING_TASK_UPDATE,
  P.REPORT_EXPORT,
  P.NOTIFICATION_TEMPLATE_MANAGE,
];

/**
 * Role -> permission bundles. Seeded into the database and treated as
 * the source of truth; the seed script reconciles any drift.
 */
export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: Object.values(P),

  HR_ADMIN: HR_ADMIN_PERMISSIONS,

  RECRUITER: RECRUITER_PERMISSIONS,

  HIRING_MANAGER: [
    P.JOB_READ_ASSIGNED,
    P.DEPARTMENT_READ,
    P.JOB_CREATE,
    P.JOB_SUBMIT,
    P.CANDIDATE_READ_ANY,
    P.DOCUMENT_READ_ANY,
    P.APPLICATION_READ_ASSIGNED,
    P.APPLICATION_TRANSITION,
    P.APPLICATION_NOTE_MANAGE,
    P.INTERVIEW_READ_ASSIGNED,
    P.INTERVIEW_SCHEDULE,
    P.FEEDBACK_SUBMIT,
    P.FEEDBACK_READ_ANY,
    P.OFFER_READ_ANY,
    P.DASHBOARD_VIEW,
    P.REPORT_VIEW,
    P.NOTIFICATION_READ_OWN,
  ],

  INTERVIEWER: [
    P.INTERVIEW_READ_ASSIGNED,
    P.FEEDBACK_SUBMIT,
    P.CANDIDATE_READ_ANY,
    P.DOCUMENT_READ_ANY,
    P.NOTIFICATION_READ_OWN,
  ],

  // A candidate can only ever reach their OWN records. Note the
  // deliberate absence of every ".any" permission.
  CANDIDATE: [
    P.CANDIDATE_READ_OWN,
    P.CANDIDATE_UPDATE_OWN,
    P.DOCUMENT_UPLOAD_OWN,
    P.DOCUMENT_READ_OWN,
    P.DOCUMENT_DELETE_OWN,
    P.APPLICATION_CREATE_OWN,
    P.APPLICATION_READ_OWN,
    P.APPLICATION_WITHDRAW_OWN,
    P.INTERVIEW_READ_OWN,
    P.OFFER_READ_OWN,
    P.OFFER_RESPOND_OWN,
    P.ONBOARDING_READ_OWN,
    P.NOTIFICATION_READ_OWN,
  ],
};

/** Human-readable labels used by the seed + user-management UI. */
export const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_ADMIN: 'HR Admin',
  RECRUITER: 'Recruiter',
  HIRING_MANAGER: 'Hiring Manager',
  INTERVIEWER: 'Interviewer',
  CANDIDATE: 'Candidate',
};

export function describePermission(key: string): { resource: string; action: string } {
  const [resource, ...rest] = key.split('.');
  return { resource, action: rest.join('.') || 'access' };
}
